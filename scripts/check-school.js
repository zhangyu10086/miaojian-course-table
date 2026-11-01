// 校验一所学校的教务系统能否被「秒见课表」自动导入。
// 用法：
//   node scripts/check-school.js --name "上海理工大学" --url "https://www.usst.edu.cn"
//   node scripts/check-school.js "上海理工大学" "https://jwgl.usst.edu.cn/jwglxt/"
//
// 只使用不存在的学号做一次登录尝试，不需要真实账号。
// 结果写入 docs/school-check-result.json。
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const ROOT = path.join(__dirname, '..')
const CLOUD_MODULES = path.join(ROOT, 'cloudfunctions', 'syncSchedule', 'node_modules')

function dep(name) {
  try {
    return require(name)
  } catch (err) {
    return require(path.join(CLOUD_MODULES, name))
  }
}

const axios = dep('axios')
const { wrapper } = dep('axios-cookiejar-support')
const { CookieJar } = dep('tough-cookie')
const rsa = require(path.join(ROOT, 'miniprogram', 'utils', 'rsa'))

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const DUMMY_USER = '00000000000'
const DUMMY_PASS = 'not-a-real-password-2026'
const MAX_CANDIDATES = 8
const TIMEOUT = 15000

function parseArgs(argv) {
  const out = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--name' || arg === '-n') {
      out.name = argv[index + 1] || ''
      index += 1
    } else if (arg === '--url' || arg === '-u') {
      out.url = argv[index + 1] || ''
      index += 1
    } else if (!out.name) {
      out.name = arg
    } else if (!out.url) {
      out.url = arg
    }
  }
  return out
}

function normalizeInputUrl(input) {
  let text = String(input || '').trim()
  if (!text) return ''
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = 'https://' + text
  try {
    return new URL(text).toString()
  } catch (err) {
    return ''
  }
}

function dedupe(list) {
  const seen = new Set()
  return list.filter((item) => {
    if (!item || seen.has(item)) return false
    seen.add(item)
    return true
  })
}

function rootDomain(host) {
  const suffixes = [
    'edu.cn',
    'gov.cn',
    'com.cn',
    'net.cn',
    'org.cn',
    'edu',
    'com',
    'net',
    'org',
    'cn'
  ]
  for (const suffix of suffixes) {
    if (host.endsWith('.' + suffix)) {
      const before = host.slice(0, -(suffix.length + 1))
      const label = before.split('.').pop()
      return label + '.' + suffix
    }
  }
  return host
}

function basesFromUrl(input) {
  const url = normalizeInputUrl(input)
  if (!url) return []
  const parsed = new URL(url)
  const origin = parsed.origin
  const host = parsed.hostname
  const bases = []
  const pathname = parsed.pathname.toLowerCase()
  const index = pathname.indexOf('/jwglxt')
  if (index >= 0) bases.push(origin + '/jwglxt')

  // 学校官网地址常见情况：教务系统在 jwgl / jwxt / jwc 等子域
  const root = rootDomain(host)
  const subdomains = [
    'jwgl',
    'jwxt',
    'jwglxt',
    'jw',
    'jwc',
    'zfjw',
    'zhjw',
    'oaa',
    'jwmis',
    'jwx',
    'tdjw',
    'jxgl'
  ]
  subdomains.forEach((sub) => {
    const candidate = host.startsWith(sub + '.') ? host : sub + '.' + root
    bases.push('https://' + candidate + '/jwglxt')
  })

  bases.push(origin + '/jwglxt')

  // http / https 互换
  const otherProtocol = origin.startsWith('https:')
    ? origin.replace(/^https:/, 'http:')
    : origin.replace(/^http:/, 'https:')
  bases.push(otherProtocol + '/jwglxt')

  // www 去掉 / 补上
  if (host.startsWith('www.')) {
    const bare = host.slice(4)
    bases.push('https://' + bare + '/jwglxt')
    bases.push('http://' + bare + '/jwglxt')
  } else {
    bases.push('https://www.' + host + '/jwglxt')
  }
  return dedupe(bases)
}

function extractLinks(html, pageUrl) {
  const out = []
  const re = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match
  while ((match = re.exec(String(html || '')))) {
    let href = match[1].trim()
    const text = match[2]
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (!href || /^javascript:/i.test(href) || href.startsWith('#')) continue
    try {
      href = new URL(href, pageUrl).toString()
    } catch (err) {
      continue
    }
    out.push({ href, text })
  }
  return out
}

async function discoverFromPage(inputUrl) {
  const url = normalizeInputUrl(inputUrl)
  if (!url) return []
  const jar = new CookieJar()
  const client = wrapper(
    axios.create({
      jar,
      withCredentials: true,
      timeout: TIMEOUT,
      maxRedirects: 5,
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }
    })
  )
  const bases = []
  try {
    const res = await client.get(url)
    const finalUrl =
      (res.request && res.request.res && res.request.res.responseUrl) || url
    const html = String(res.data || '')
    const links = extractLinks(html, finalUrl)
    const hits = links.filter((item) =>
      /jwglxt|login_slogin|xtgl|xskbcx|教务|正方|教学管理|kbcx/i.test(
        item.href + ' ' + item.text
      )
    )
    hits.slice(0, 12).forEach((item) => {
      const parsed = new URL(item.href)
      bases.push(parsed.origin + '/jwglxt')
    })

    // 教务处页面再找一层
    const offices = links.filter(
      (item) => /教务处|教学管理|教务管理/.test(item.text) && item.href !== finalUrl
    )
    for (const office of offices.slice(0, 3)) {
      try {
        const sub = await client.get(office.href)
        const subUrl =
          (sub.request && sub.request.res && sub.request.res.responseUrl) ||
          office.href
        extractLinks(String(sub.data || ''), subUrl)
          .filter((item) =>
            /jwglxt|login_slogin|xtgl|xskbcx|正方|kbcx/i.test(
              item.href + ' ' + item.text
            )
          )
          .slice(0, 8)
          .forEach((item) => {
            const parsed = new URL(item.href)
            bases.push(parsed.origin + '/jwglxt')
          })
      } catch (err) {
        // 忽略单个页面失败
      }
    }
  } catch (err) {
    // 首页打不开不影响后续尝试
  }
  return dedupe(bases)
}

function extractCsrf(html) {
  const match = String(html || '').match(
    /name=["']csrftoken["'][^>]*value=["']([^"']+)/i
  )
  return match ? match[1] : ''
}

function hasLoginForm(html) {
  const text = String(html || '')
  return /name=["']yhm["']/i.test(text) && /name=["']mm["']/i.test(text)
}

function captchaInfo(html) {
  const text = String(html || '')
  return {
    yzmInput: /name=["']yzm["']/i.test(text),
    zfcaptcha: /zfcaptchaLogin/i.test(text),
    visible: /id=["']yzmDiv["'][^>]*style=["'][^"']*display\s*:\s*(?!none)/i.test(text)
  }
}

function tipsOf(html) {
  const match = String(html || '').match(
    /id=["']tips["'][^>]*>([\s\S]*?)<\/p>/i
  )
  return match
    ? match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    : ''
}

function looksLikeSso(html, location) {
  const text = String(html || '') + ' ' + String(location || '')
  return /统一身份认证|CAS|OAuth|oauth2|authserver|auth\.|cas\.|ids\./i.test(text)
}

function looksLikeOldZf(html) {
  const text = String(html || '')
  return /default2\.aspx|loginAction\.do|xtgl\/login_slogin\.html/i.test(text) === false &&
    /jwglxt|正方/i.test(text) === false
}

async function testBase(base) {
  const attempt = {
    base,
    steps: [],
    loginUrl: base + '/xtgl/login_slogin.html'
  }
  try {
    const jar = new CookieJar()
    const client = wrapper(
      axios.create({
        jar,
        withCredentials: true,
        timeout: TIMEOUT,
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
        headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }
      })
    )

    const page = await client.get(attempt.loginUrl)
    const html = String(page.data || '')
    attempt.pageStatus = page.status
    attempt.location = page.headers.location || ''
    attempt.pageLength = html.length
    attempt.form = hasLoginForm(html)
    attempt.csrf = !!extractCsrf(html)
    attempt.captcha = captchaInfo(html)
    attempt.sso = looksLikeSso(html, attempt.location)
    attempt.steps.push(
      'GET ' +
        attempt.loginUrl +
        ' -> ' +
        page.status +
        (attempt.location ? ' -> ' + attempt.location : '') +
        ' len=' +
        html.length
    )

    if (page.status >= 300 && attempt.location) {
      attempt.verdict = 'redirect'
      return attempt
    }
    if (!html) {
      attempt.verdict = 'empty'
      return attempt
    }
    if (!attempt.form) {
      attempt.verdict = attempt.sso ? 'sso' : 'no_form'
      return attempt
    }
    if (attempt.captcha.visible) {
      attempt.verdict = 'captcha'
      return attempt
    }
    if (!attempt.csrf) {
      attempt.verdict = 'no_csrf'
      return attempt
    }

    const keyRes = await client.get(
      base + '/xtgl/login_getPublicKey.html?time=' + Date.now()
    )
    let key = keyRes.data
    if (typeof key === 'string') {
      try {
        key = JSON.parse(key)
      } catch (err) {
        key = {}
      }
    }
    attempt.keyStatus = keyRes.status
    attempt.keyOk = !!(key && key.modulus && key.exponent)
    attempt.keyBytes = key && key.modulus
      ? Buffer.from(String(key.modulus), 'base64').length
      : 0
    attempt.steps.push(
      'GET publicKey -> ' +
        keyRes.status +
        ' ok=' +
        attempt.keyOk +
        ' bytes=' +
        attempt.keyBytes
    )
    if (!attempt.keyOk) {
      attempt.verdict = 'no_key'
      return attempt
    }

    const cipher = rsa.encryptWithRandom(
      DUMMY_PASS,
      key.modulus,
      key.exponent,
      (length) => crypto.randomBytes(length)
    )
    attempt.cipherBytes = Buffer.from(cipher, 'base64').length
    const body = new URLSearchParams({
      csrftoken: extractCsrf(html),
      yhm: DUMMY_USER,
      mm: cipher,
      language: 'zh_CN'
    }).toString()
    const res = await client.post(attempt.loginUrl, body, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: attempt.loginUrl
      }
    })
    const text = String(res.data || '')
    attempt.loginStatus = res.status
    attempt.loginLocation = res.headers.location || ''
    attempt.wrongPassword =
      /用户名或密码不正确|密码错误|用户不存在|账号或密码/.test(text)
    attempt.tips = tipsOf(text)
    attempt.afterCaptcha = captchaInfo(text)
    attempt.steps.push(
      'POST login(client RSA) -> ' +
        res.status +
        ' wrong=' +
        attempt.wrongPassword +
        (attempt.tips ? ' tips=' + attempt.tips : '')
    )

    if (attempt.wrongPassword) {
      attempt.verdict = 'usable'
    } else if (attempt.afterCaptcha.yzmInput || /验证码/.test(text)) {
      attempt.verdict = 'captcha'
    } else if (attempt.loginLocation) {
      attempt.verdict = 'login_redirect'
    } else {
      attempt.verdict = 'unknown'
    }
    return attempt
  } catch (err) {
    attempt.error = (err && err.message) || String(err)
    attempt.verdict = /status code 403/.test(attempt.error)
      ? 'forbidden'
      : 'unreachable'
    return attempt
  }
}

function cleanName(name) {
  return String(name || '')
    .replace(/[（(][^）)]*[)）]/g, '')
    .trim()
}

function aliasesFor(name, baseUrl) {
  const result = []
  const push = (value) => {
    const text = String(value || '').trim().toLowerCase()
    if (!text || result.indexOf(text) >= 0) return
    result.push(text)
  }
  const clean = cleanName(name)
  try {
    const { pinyin } = require('pinyin-pro')
    if (clean) {
      push(pinyin(clean, { toneType: 'none', type: 'array' }).join(''))
      push(
        pinyin(clean, {
          pattern: 'first',
          toneType: 'none',
          type: 'array'
        }).join('')
      )
    }
    const short = clean.replace(
      /(大学|学院|职业技术学院|职业学院|技术学院|师范大学|师范学院)$/,
      ''
    )
    if (short && short !== clean) {
      push(short)
      push(pinyin(short, { toneType: 'none', type: 'array' }).join(''))
    }
  } catch (err) {
    // pinyin-pro 不可用时只输出域名别名
  }

  try {
    const host = new URL(baseUrl).hostname.toLowerCase()
    const generic = new Set([
      'www',
      'jwgl',
      'jwglxt',
      'jwxt',
      'jw',
      'jwc',
      'zdbk',
      'zhjw',
      'oaa',
      'jwx',
      'tdjw',
      'jxgl',
      'zfjw',
      'jwmis',
      '106',
      'edu',
      'cn',
      'com',
      'net',
      'org'
    ])
    const label = host.split('.').find((item) => !generic.has(item))
    if (label) push(label)
  } catch (err) {
    // ignore
  }

  return result.slice(0, 6)
}

function baseOrigin(baseUrl) {
  try {
    return new URL(baseUrl).origin
  } catch (err) {
    return baseUrl
  }
}

function redirectBase(location, base) {
  try {
    const url = new URL(location, base + '/xtgl/login_slogin.html')
    return url.origin + '/jwglxt'
  } catch (err) {
    return ''
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const name = String(args.name || '').trim()
  const inputUrl = String(args.url || '').trim()
  if (!name) {
    console.error('缺少 --name')
    process.exit(2)
  }
  if (!inputUrl) {
    console.error('缺少 --url')
    process.exit(2)
  }

  const candidates = dedupe(
    basesFromUrl(inputUrl).concat(await discoverFromPage(inputUrl))
  ).slice(0, MAX_CANDIDATES)

  const attempts = []
  let best = null
  const rank = {
    usable: 5,
    login_redirect: 4,
    captcha: 3,
    sso: 2,
    no_form: 2,
    no_key: 1,
    forbidden: 1,
    unreachable: 0,
    empty: 0,
    no_csrf: 0,
    redirect: 0,
    unknown: 0
  }

  const queue = candidates.slice()
  const tested = new Set()
  let redirectCount = 0
  const maxAttempts = MAX_CANDIDATES + 4

  while (queue.length && tested.size < maxAttempts) {
    const base = queue.shift()
    if (tested.has(base)) continue
    tested.add(base)
    const attempt = await testBase(base)
    attempts.push(attempt)
    if (!best || (rank[attempt.verdict] || 0) > (rank[best.verdict] || 0)) {
      best = attempt
    }
    if (attempt.verdict === 'usable') break

    // http -> https 或 /jwglxt/ 之类的跳转，继续测跳转后的地址
    if (
      attempt.verdict === 'redirect' &&
      attempt.location &&
      redirectCount < 3
    ) {
      redirectCount += 1
      const next = redirectBase(attempt.location, base)
      if (next && !tested.has(next)) queue.unshift(next)
    }
  }

  const usable = best && best.verdict === 'usable'
  const baseUrl = usable ? best.base : ''
  const aliases = baseUrl ? aliasesFor(name, baseUrl) : []

  const result = {
    generatedAt: new Date().toISOString(),
    name,
    inputUrl,
    verdict: best ? best.verdict : 'unreachable',
    usable: !!usable,
    reason: reasonOf(best),
    baseUrl,
    adminForm: usable
      ? {
          name,
          baseUrl: baseOrigin(baseUrl),
          aliases: aliases.join(', ')
        }
      : null,
    aliases,
    evidence: best
      ? {
          pageStatus: best.pageStatus,
          form: best.form,
          csrf: best.csrf,
          keyBytes: best.keyBytes,
          cipherBytes: best.cipherBytes,
          tips: best.tips,
          location: best.location,
          loginLocation: best.loginLocation
        }
      : null,
    attempts
  }

  const outPath = path.join(ROOT, 'docs', 'school-check-result.json')
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf8')

  console.log('verdict=' + result.verdict + ' usable=' + result.usable)
  if (usable) {
    console.log('baseUrl=' + result.baseUrl)
    console.log('adminForm=' + JSON.stringify(result.adminForm))
  }
  console.log('written=' + outPath)
}

function reasonOf(attempt) {
  if (!attempt) return '没有可测试的候选地址'
  const map = {
    usable: '登录接口正常，学校成功解开了手机端密文（使用不存在的学号）',
    captcha: '登录需要验证码或滑块',
    sso: '没有标准正方登录表单，可能使用统一身份认证（SSO）',
    no_form: '没有找到标准正方登录表单',
    no_key: '公钥接口不可用',
    no_csrf: '登录页没有 csrftoken',
    forbidden: '登录页返回 403，可能被 WAF 或地区限制拦截',
    unreachable: '地址无法访问（DNS、超时或连接被拒绝）',
    empty: '登录页返回为空',
    redirect: '登录页发生跳转，未能确定最终地址',
    login_redirect: '登录返回跳转，需要人工确认',
    unknown: '返回了非标准页面，需要查看日志'
  }
  return map[attempt.verdict] || attempt.error || '未知结果'
}

main().catch((err) => {
  console.error('FATAL', err && err.message)
  process.exit(1)
})

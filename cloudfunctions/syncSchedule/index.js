const crypto = require('crypto')
const axios = require('axios')
const { wrapper } = require('axios-cookiejar-support')
const { CookieJar } = require('tough-cookie')

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

const ALLOWED_TERMS = new Set(['3', '12', '16'])

// 学校公钥按会话生成（每次请求 login_getPublicKey 都会轮换），
// 所以手机端不能自己另开会话取公钥，必须由云函数在同一个会话里取。
// prepare 把这条会话（Cookie + csrftoken）打包成一次性 token 交给手机，
// 手机加密完密码再带着 token 回来，云函数恢复会话后提交登录。
const SESSION_TTL_MS = 5 * 60 * 1000
const SESSION_TOKEN_MAX = 4096

function createError(code, message) {
  const error = new Error(message)
  error.code = code
  return error
}

function fail(code, message) {
  return { ok: false, code, message }
}

function normalizeBaseUrl(input) {
  const url = new URL(String(input || '').trim())
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw createError('INVALID_URL', '教务地址必须是 http 或 https')
  }
  let pathname = url.pathname.replace(/\/+$/, '')
  const index = pathname.toLowerCase().indexOf('/jwglxt')
  if (index >= 0) {
    pathname = pathname.slice(0, index) + '/jwglxt'
  } else if (!pathname) {
    pathname = '/jwglxt'
  } else if (!pathname.toLowerCase().endsWith('/jwglxt')) {
    pathname = pathname + '/jwglxt'
  }
  return url.origin + pathname
}

let db = null
let hostCache = null
let hostCacheAt = 0
const HOST_CACHE_MS = 60 * 1000

// 云数据库只在云函数环境里初始化，本地单元测试不加载它。
function getDb() {
  if (db) return db
  if (
    !process.env.TCB_ENV &&
    !process.env.SCF_FUNCTIONNAME &&
    !process.env.WX_CONTEXT_KEYS
  ) {
    return null
  }
  try {
    const cloud = require('wx-server-sdk')
    cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
    db = cloud.database()
    return db
  } catch (err) {
    console.warn('云数据库不可用，回退到 ALLOWED_HOSTS', err && err.message)
    return null
  }
}

function envHosts() {
  const raw = process.env.ALLOWED_HOSTS || ''
  return raw
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)
}

async function dbHosts() {
  const database = getDb()
  if (!database) return []
  try {
    const res = await database
      .collection('schools')
      .limit(1000)
      .field({ host: true, autoImport: true })
      .get()
    return (res.data || [])
      // autoImport === false 表示管理员明确关闭了自动导入
      // 旧数据没有这个字段时继续允许，保持向后兼容
      .filter((item) => item.autoImport !== false)
      .map((item) => String(item.host || '').toLowerCase())
      .filter(Boolean)
  } catch (err) {
    console.warn('读取 schools 集合失败', err && err.message)
    return []
  }
}

// 允许访问的域名 = ALLOWED_HOSTS（兜底） ∪ schools 集合。
async function allowedHosts() {
  const now = Date.now()
  if (hostCache && now - hostCacheAt < HOST_CACHE_MS) return hostCache
  const hosts = Array.from(new Set(envHosts().concat(await dbHosts())))
  hostCache = hosts
  hostCacheAt = now
  return hosts
}

async function isHostAllowed(hostname) {
  const rules = await allowedHosts()
  if (!rules.length) return false
  const host = String(hostname || '').toLowerCase()
  return rules.some((rule) => {
    if (rule.startsWith('*.')) return host.endsWith(rule.slice(1))
    return host === rule
  })
}

// 任意用户成功拉取课表后，把对应学校标记为已验证。
// 失败不影响本次导入结果。
async function markSchoolVerified(hostname) {
  const database = getDb()
  if (!database) return

  try {
    await database
      .collection('schools')
      .where({ host: String(hostname || '').toLowerCase() })
      .update({
        data: {
          verified: true,
          lastSuccessAt: Date.now()
        }
      })
  } catch (err) {
    console.warn('更新学校验证状态失败', err && err.message)
  }
}

function base64Buffer(value) {
  const normalized = String(value || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  return Buffer.from(normalized, 'base64')
}

function exponentToBase64Url(value) {
  const text = String(value || '')
  if (/^\d+$/.test(text)) {
    let big = BigInt(text)
    const bytes = []
    while (big > 0n) {
      bytes.unshift(Number(big & 255n))
      big >>= 8n
    }
    return Buffer.from(bytes).toString('base64url')
  }
  return base64Buffer(text).toString('base64url')
}

function encryptPassword(password, modulus, exponent) {
  const n = base64Buffer(modulus).toString('base64url')
  const e = exponentToBase64Url(exponent)
  const key = crypto.createPublicKey({
    key: { kty: 'RSA', n, e },
    format: 'jwk'
  })
  return crypto
    .publicEncrypt(
      {
        key,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(String(password), 'utf8')
    )
    .toString('base64')
}

function extractCsrf(html) {
  const text = String(html || '')
  const patterns = [
    /<input[^>]*name=["']csrftoken["'][^>]*value=["']([^"']+)["']/i,
    /<input[^>]*value=["']([^"']+)["'][^>]*name=["']csrftoken["']/i,
    /csrftoken["']?\s*[:=]\s*["']([^"']+)["']/i
  ]
  for (let index = 0; index < patterns.length; index += 1) {
    const match = text.match(patterns[index])
    if (match) return match[1]
  }
  return ''
}

function looksLikeLoginPage(body) {
  const text = typeof body === 'string' ? body : JSON.stringify(body || '')
  return /login_slogin\.html/i.test(text) || /name=["']yhm["']/i.test(text)
}

function looksLikeCaptcha(html) {
  const text = String(html || '')
  return /zfcaptchaLogin/i.test(text) && /name=["']yzm["']/i.test(text)
}

async function cookieValue(jar, url, name) {
  try {
    const cookies = await jar.getCookies(url)
    const found = cookies.find((cookie) => cookie.key === name)
    return found ? found.value : ''
  } catch (err) {
    return ''
  }
}

function collectSetCookie(response, list) {
  const raw = response && response.headers && response.headers['set-cookie']
  if (!raw) return
  const items = Array.isArray(raw) ? raw : [raw]
  items.forEach((item) => {
    const text = String(item || '').trim()
    if (text) list.push(text)
  })
}

function currentOpenid() {
  try {
    const cloud = require('wx-server-sdk')
    if (typeof cloud.getWXContext === 'function') {
      const context = cloud.getWXContext() || {}
      return String(context.OPENID || '')
    }
  } catch (err) {
    return ''
  }
  return ''
}

function encodeSessionToken(session) {
  return Buffer.from(
    JSON.stringify({
      o: session.openid || '',
      b: session.baseUrl,
      c: session.csrf,
      k: session.cookies,
      t: session.expiresAt
    }),
    'utf8'
  )
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function decodeSessionToken(token) {
  try {
    const text = String(token || '')
    if (!text || text.length > SESSION_TOKEN_MAX) return null
    const normalized = text.replace(/-/g, '+').replace(/_/g, '/')
    const data = JSON.parse(
      Buffer.from(normalized, 'base64').toString('utf8')
    )
    if (!data || typeof data !== 'object') return null
    if (typeof data.b !== 'string' || typeof data.c !== 'string') return null
    if (!Array.isArray(data.k) || data.k.length > 8) return null
    const invalidCookie = data.k.some(
      (item) => typeof item !== 'string' || item.length > 1024
    )
    if (invalidCookie) return null
    if (!Number.isFinite(data.t)) return null
    const now = Date.now()
    if (data.t < now || data.t > now + SESSION_TTL_MS + 60 * 1000) return null
    return {
      openid: String(data.o || ''),
      baseUrl: data.b,
      csrf: data.c,
      cookies: data.k,
      expiresAt: data.t
    }
  } catch (err) {
    return null
  }
}

async function restoreCookies(jar, session) {
  const list = Array.isArray(session.cookies) ? session.cookies : []
  for (let index = 0; index < list.length; index += 1) {
    try {
      await jar.setCookie(list[index], session.baseUrl)
    } catch (err) {
      // 单个 Cookie 失效不影响整体：登录时服务端会重新下发
    }
  }
}

// 建立登录会话：取登录页 csrftoken，再用同一个会话取公钥。
// 公钥必须是这个会话里最后一次取到的那把，否则学校解不开密文。
async function prepareLogin(base) {
  const jar = new CookieJar()
  const client = createClient(jar)
  const cookies = []
  const loginUrl = base + '/xtgl/login_slogin.html'

  const page = await client.get(loginUrl)
  collectSetCookie(page, cookies)
  const html = String(page.data || '')
  const csrf =
    extractCsrf(html) || (await cookieValue(jar, loginUrl, 'csrftoken'))
  if (!csrf) {
    throw createError(
      'LOGIN_PAGE_CHANGED',
      '登录页没有找到 csrftoken，学校可能定制了登录页'
    )
  }
  if (looksLikeCaptcha(html)) {
    throw createError('CAPTCHA_REQUIRED', '登录页要求验证码或滑块')
  }

  const keyResponse = await client.get(
    base + '/xtgl/login_getPublicKey.html?time=' + Date.now()
  )
  collectSetCookie(keyResponse, cookies)
  let keyData = keyResponse.data || {}
  if (typeof keyData === 'string') {
    try {
      keyData = JSON.parse(keyData)
    } catch (err) {
      keyData = {}
    }
  }
  if (!keyData.modulus || !keyData.exponent) {
    throw createError('PUBLIC_KEY_ERROR', '没有拿到 RSA 公钥')
  }

  return {
    baseUrl: base,
    csrf,
    cookies,
    modulus: String(keyData.modulus),
    exponent: String(keyData.exponent)
  }
}

function createClient(jar) {
  return wrapper(
    axios.create({
      jar,
      withCredentials: true,
      timeout: 12000,
      maxRedirects: 0,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
      }
    })
  )
}

async function login(
  client,
  jar,
  base,
  username,
  password,
  encryptedPassword,
  session
) {
  const loginUrl = base + '/xtgl/login_slogin.html'
  let csrf = String((session && session.csrf) || '')
  let mm = String(encryptedPassword || '').trim()

  if (!session) {
    // 旧流程：云函数自己取登录页和公钥，用于兼容还没升级的客户端。
    const page = await client.get(loginUrl)
    const html = String(page.data || '')
    csrf = extractCsrf(html) || (await cookieValue(jar, loginUrl, 'csrftoken'))

    if (!csrf) {
      throw createError(
        'LOGIN_PAGE_CHANGED',
        '登录页没有找到 csrftoken，学校可能定制了登录页'
      )
    }
    if (looksLikeCaptcha(html)) {
      throw createError('CAPTCHA_REQUIRED', '登录页要求验证码或滑块')
    }

    // 新版本客户端在手机上完成加密；只有旧客户端没有密文时才由云函数加密。
    if (!mm) {
      const keyResponse = await client.get(
        base + '/xtgl/login_getPublicKey.html?time=' + Date.now()
      )
      let keyData = keyResponse.data || {}
      if (typeof keyData === 'string') {
        try {
          keyData = JSON.parse(keyData)
        } catch (err) {
          keyData = {}
        }
      }
      if (!keyData.modulus || !keyData.exponent) {
        throw createError('PUBLIC_KEY_ERROR', '没有拿到 RSA 公钥')
      }

      mm = encryptPassword(password, keyData.modulus, keyData.exponent)
    }
  }

  if (!mm) {
    throw createError(
      'CLIENT_ENCRYPTION_REQUIRED',
      '请更新到最新版本小程序后再导入'
    )
  }

  const body = new URLSearchParams({
    csrftoken: csrf,
    yhm: username,
    mm,
    language: 'zh_CN'
  }).toString()

  if (session) {
    try {
      const cookies = await jar.getCookies(loginUrl)
      console.log(
        '[syncSchedule] session cookies=' +
          cookies.map((item) => item.key).join(',')
      )
    } catch (err) {
      console.log('[syncSchedule] session cookies unavailable')
    }
  }

  const loginResponse = await client.post(loginUrl, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: loginUrl
    }
  })

  // 只记录判断结果，不记录账号、密码或页面内容。
  // 学校在「密码错误」和「密文解不开」时返回的页面不同，这个日志能区分两者。
  const loginText =
    typeof loginResponse.data === 'string' ? loginResponse.data : ''
  console.log(
    '[syncSchedule] login response',
    'status=' + loginResponse.status,
    'redirect=' + (loginResponse.headers.location ? 'yes' : 'no'),
    'passwordRejected=' +
      (/用户名或密码不正确|密码错误|用户不存在/.test(loginText) ? 'yes' : 'no'),
    'bodyLength=' + loginText.length
  )

  if (loginResponse.status >= 300 && loginResponse.headers.location) {
    const nextUrl = new URL(loginResponse.headers.location, loginUrl).toString()
    const next = await client.get(nextUrl, { validateStatus: () => true })
    if (looksLikeLoginPage(next.data)) {
      throw createError('LOGIN_FAILED', '账号或密码错误，或登录后仍停留在登录页')
    }
  } else if (looksLikeLoginPage(loginResponse.data)) {
    throw createError('LOGIN_FAILED', '账号或密码错误')
  }

  const menu = await client.get(base + '/xtgl/index_initMenu.html', {
    validateStatus: () => true
  })
  if (menu.status < 400 && looksLikeLoginPage(menu.data)) {
    throw createError('LOGIN_FAILED', '登录态校验失败，请检查账号密码')
  }
}

async function fetchKbList(client, base, xnm, xqm) {
  const referer =
    base + '/kbcx/xskbcx_cxXskbcxIndex.html?gnmkdm=N2151&layout=default'
  const url = base + '/kbcx/xskbcx_cxXsgrkb.html?gnmkdm=N2151'
  const body = new URLSearchParams({
    xnm,
    xqm,
    kzlx: 'ck',
    xsdm: ''
  }).toString()

  const response = await client.post(url, body, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      'X-Requested-With': 'XMLHttpRequest',
      Referer: referer,
      Accept: 'application/json, text/javascript, */*; q=0.01'
    }
  })

  let data = response.data
  if (typeof data === 'string') {
    const text = data.trim()
    if (looksLikeLoginPage(text)) {
      throw createError('LOGIN_FAILED', '登录态已失效，请重试')
    }
    try {
      data = JSON.parse(text)
    } catch (err) {
      throw createError('PARSE_ERROR', '课表接口返回的不是 JSON')
    }
  }

  if (!data) {
    throw createError('PARSE_ERROR', '课表接口返回为空')
  }
  if (typeof data.kbList === 'string') {
    try {
      data.kbList = JSON.parse(data.kbList)
    } catch (err) {
      throw createError('PARSE_ERROR', 'kbList 不是合法 JSON')
    }
  }
  if (Array.isArray(data.kbList)) return data.kbList
  if (Array.isArray(data.items)) return data.items
  if (data.kbList === null) return []
  throw createError('PARSE_ERROR', '课表返回中没有 kbList 字段')
}

function validate(event) {
  const baseUrl = String((event && event.baseUrl) || '').trim()
  const username = String((event && event.username) || '').trim()
  const password = String((event && event.password) || '')
  const encryptedPassword = String(
    (event && event.encryptedPassword) || ''
  ).trim()
  const xnm = String((event && event.xnm) || '').trim()
  const xqm = String((event && event.xqm) || '').trim()
  const token = String((event && event.token) || '').trim()

  if (!baseUrl) throw createError('INVALID_INPUT', '缺少教务系统地址')
  if (!username || (!password && !encryptedPassword)) {
    throw createError('INVALID_INPUT', '缺少学号或密码')
  }
  if (encryptedPassword && !/^[A-Za-z0-9+/=_-]{20,}$/.test(encryptedPassword)) {
    throw createError('INVALID_INPUT', '加密密码格式不正确')
  }
  if (token && !/^[A-Za-z0-9_-]{20,4096}$/.test(token)) {
    throw createError('INVALID_INPUT', '登录会话参数不正确')
  }
  if (!/^\d{4}$/.test(xnm)) throw createError('INVALID_INPUT', '学年格式应为 4 位年份')
  if (!ALLOWED_TERMS.has(xqm)) throw createError('INVALID_INPUT', '学期参数不合法')

  return { baseUrl, username, password, encryptedPassword, token, xnm, xqm }
}

function mapNetworkError(error) {
  if (!error || !error.code) return error
  const code = String(error.code)
  if (
    code.indexOf('ECONN') === 0 ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNABORTED' ||
    code === 'ERR_NETWORK' ||
    code === 'EAI_AGAIN'
  ) {
    return createError('NETWORK_ERROR', '无法连接教务系统，请检查地址或校园网')
  }
  return error
}

// 第一步：建立登录会话并把公钥交给手机。
// 不接收、不接触密码。
async function handlePrepare(event) {
  const baseUrl = String((event && event.baseUrl) || '').trim()
  if (!baseUrl) throw createError('INVALID_INPUT', '缺少教务系统地址')

  const base = normalizeBaseUrl(baseUrl)
  const hostname = new URL(base).hostname

  if (!(await isHostAllowed(hostname))) {
    return fail('HOST_NOT_ALLOWED', '域名 ' + hostname + ' 不在允许的学校列表中')
  }

  const prepared = await prepareLogin(base)
  const now = Date.now()
  const session = {
    openid: currentOpenid(),
    baseUrl: prepared.baseUrl,
    csrf: prepared.csrf,
    cookies: prepared.cookies,
    expiresAt: now + SESSION_TTL_MS
  }

  return {
    ok: true,
    token: encodeSessionToken(session),
    modulus: prepared.modulus,
    exponent: prepared.exponent,
    expiresAt: session.expiresAt
  }
}

exports.main = async (event) => {
  try {
    // 只记录流程标记，不记录账号、密码或密文，方便排查客户端版本和会话问题。
    console.log(
      '[syncSchedule]',
      event && event.action === 'prepare' ? 'prepare' : 'login',
      'token=' + (event && event.token ? 'yes' : 'no'),
      'cipher=' + (event && event.encryptedPassword ? 'yes' : 'no'),
      'plain=' + (event && event.password ? 'yes' : 'no')
    )

    if (event && event.action === 'prepare') {
      return await handlePrepare(event)
    }

    const input = validate(event)
    const base = normalizeBaseUrl(input.baseUrl)
    const hostname = new URL(base).hostname

    if (!(await isHostAllowed(hostname))) {
      return fail('HOST_NOT_ALLOWED', '域名 ' + hostname + ' 不在 ALLOWED_HOSTS 中')
    }

    // 发布新客户端后可以设置该环境变量，彻底拒绝明文密码。
    if (
      process.env.REQUIRE_CLIENT_ENCRYPT === 'true' &&
      !input.encryptedPassword
    ) {
      return fail(
        'CLIENT_ENCRYPTION_REQUIRED',
        '请更新到最新版本小程序后再导入'
      )
    }

    const session = input.token ? decodeSessionToken(input.token) : null
    if (input.token && (!session || session.baseUrl !== base)) {
      return fail('SESSION_EXPIRED', '登录会话已过期，请重新导入')
    }
    if (session) {
      const openid = currentOpenid()
      if (session.openid && openid && session.openid !== openid) {
        return fail('SESSION_EXPIRED', '登录会话已失效，请重新导入')
      }
    }

    const jar = new CookieJar()
    if (session) await restoreCookies(jar, session)
    const client = createClient(jar)

    await login(
      client,
      jar,
      base,
      input.username,
      input.password,
      input.encryptedPassword,
      session
    )
    const kbList = await fetchKbList(client, base, input.xnm, input.xqm)

    if (!kbList.length) {
      return fail('NO_COURSES', '该学期没有查询到课程')
    }

    await markSchoolVerified(hostname)

    return {
      ok: true,
      kbList,
      meta: {
        host: hostname,
        xnm: input.xnm,
        xqm: input.xqm
      }
    }
  } catch (error) {
    const mapped = mapNetworkError(error)
    console.error('syncSchedule failed:', mapped && mapped.code, mapped && mapped.message)
    return fail(
      (mapped && mapped.code) || 'INTERNAL_ERROR',
      (mapped && mapped.message) || '同步失败'
    )
  }
}

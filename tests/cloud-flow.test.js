const test = require('node:test')
const assert = require('node:assert/strict')
const http = require('node:http')
const crypto = require('node:crypto')
const { once } = require('node:events')

for (const key of ['HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy']) {
  delete process.env[key]
}
process.env.NO_PROXY = '127.0.0.1,localhost'
process.env.ALLOWED_HOSTS = '127.0.0.1'

const sync = require('../cloudfunctions/syncSchedule')
const rsa = require('../miniprogram/utils/rsa')

const LOGIN_PAGE =
  '<html><input type="hidden" name="csrftoken" value="abc123">' +
  '<form><input name="yhm"><input name="mm"></form></html>'

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function newKeyPair() {
  return crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
}

function publicParts(pair) {
  const jwk = pair.publicKey.export({ format: 'jwk' })
  return {
    modulus: Buffer.from(jwk.n, 'base64url').toString('base64'),
    exponent: Buffer.from(jwk.e, 'base64url').toString('base64')
  }
}

const deterministicRandom = (length) => new Uint8Array(length).fill(1)

// 模拟武昌工学院这类「每次取公钥都换一对密钥」的学校：
// 私钥只存在会话里，必须用同一个 JSESSIONID 才能解开密文。
function createSchoolServer() {
  const sessions = new Map()
  let sessionSeq = 0
  const state = {
    lastKbCookie: '',
    loginAttempts: 0
  }

  function sessionOf(req) {
    const cookie = String(req.headers.cookie || '')
    const match = cookie.match(/JSESSIONID=([^;]+)/)
    if (!match) return null
    return sessions.get(match[1]) || null
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')

    if (req.method === 'GET' && url.pathname === '/jwglxt/xtgl/login_slogin.html') {
      let session = sessionOf(req)
      if (!session) {
        sessionSeq += 1
        const sid = 'session' + sessionSeq
        session = { sid, key: null, loggedIn: false }
        sessions.set(sid, session)
        res.setHeader('Set-Cookie', [
          'JSESSIONID=' + sid + '; Path=/',
          'csrftoken=abc123; Path=/'
        ])
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end(LOGIN_PAGE)
      return
    }

    if (
      req.method === 'GET' &&
      url.pathname === '/jwglxt/xtgl/login_getPublicKey.html'
    ) {
      let session = sessionOf(req)
      // 没有会话时按新会话处理，和真实学校一样会下发新的 JSESSIONID
      if (!session) {
        sessionSeq += 1
        const sid = 'session' + sessionSeq
        session = { sid, key: null, loggedIn: false }
        sessions.set(sid, session)
        res.setHeader('Set-Cookie', 'JSESSIONID=' + sid + '; Path=/')
      }
      // 关键点：每次请求都轮换一对新密钥，只留最新的一对
      session.key = newKeyPair()
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(publicParts(session.key)))
      return
    }

    if (req.method === 'POST' && url.pathname === '/jwglxt/xtgl/login_slogin.html') {
      state.loginAttempts += 1
      const session = sessionOf(req)
      const body = await readBody(req)
      const params = new URLSearchParams(body)

      if (!session || !session.key) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(LOGIN_PAGE)
        return
      }

      let decrypted = ''
      try {
        decrypted = crypto
          .privateDecrypt(
            {
              key: session.key.privateKey,
              padding: crypto.constants.RSA_PKCS1_PADDING
            },
            Buffer.from(params.get('mm'), 'base64')
          )
          .toString('utf8')
      } catch (err) {
        // 密文不是用本会话的公钥加密的，学校会当成登录失败
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(LOGIN_PAGE)
        return
      }

      if (params.get('csrftoken') !== 'abc123' || decrypted !== 'secret123') {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(LOGIN_PAGE)
        return
      }

      session.loggedIn = true
      res.statusCode = 302
      res.setHeader('Location', '/jwglxt/xtgl/index_initMenu.html')
      res.end()
      return
    }

    if (req.method === 'GET' && url.pathname === '/jwglxt/xtgl/index_initMenu.html') {
      const session = sessionOf(req)
      if (!session || !session.loggedIn) {
        res.statusCode = 302
        res.setHeader('Location', '/jwglxt/xtgl/login_slogin.html')
        res.end()
        return
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.end('<html><body><div id="menu">ok</div></body></html>')
      return
    }

    if (
      req.method === 'POST' &&
      url.pathname === '/jwglxt/kbcx/xskbcx_cxXsgrkb.html'
    ) {
      state.lastKbCookie = String(req.headers.cookie || '')
      const session = sessionOf(req)
      if (!session || !session.loggedIn) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(LOGIN_PAGE)
        return
      }
      const body = await readBody(req)
      const params = new URLSearchParams(body)
      assert.equal(params.get('xnm'), '2026')
      assert.equal(params.get('xqm'), '3')
      res.setHeader('Content-Type', 'application/json;charset=utf-8')
      res.end(
        JSON.stringify({
          kbList: [
            {
              kcmc: '高等数学',
              xm: '张老师',
              cdmc: 'A101',
              xqj: '1',
              jcs: '1-2节',
              zcd: '1-16周'
            }
          ]
        })
      )
      return
    }

    res.statusCode = 404
    res.end('not found')
  })

  return { server, state }
}

async function startServer(t) {
  const { server, state } = createSchoolServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(() => server.close())
  return {
    baseUrl: 'http://127.0.0.1:' + server.address().port,
    state
  }
}

test('两步式导入：prepare 取公钥，同一会话加密后登录并返回 kbList', async (t) => {
  const { baseUrl, state } = await startServer(t)

  const prepared = await sync.main({ action: 'prepare', baseUrl })
  assert.equal(prepared.ok, true)
  assert.ok(prepared.token)
  assert.ok(prepared.modulus)
  assert.ok(prepared.exponent)

  const encryptedPassword = rsa.encryptWithRandom(
    'secret123',
    prepared.modulus,
    prepared.exponent,
    deterministicRandom
  )

  const result = await sync.main({
    token: prepared.token,
    baseUrl,
    username: 'student',
    encryptedPassword,
    xnm: '2026',
    xqm: '3'
  })

  assert.equal(result.ok, true)
  assert.equal(result.kbList.length, 1)
  assert.equal(result.kbList[0].kcmc, '高等数学')
  assert.ok(state.lastKbCookie.indexOf('JSESSIONID=session') >= 0)
})

test('用另一个会话的公钥加密会登录失败（旧客户端的问题）', async (t) => {
  const { baseUrl } = await startServer(t)

  const first = await sync.main({ action: 'prepare', baseUrl })
  const second = await sync.main({ action: 'prepare', baseUrl })

  // 用第二个会话的公钥加密，却拿第一个会话的 token 去登录
  const encryptedPassword = rsa.encryptWithRandom(
    'secret123',
    second.modulus,
    second.exponent,
    deterministicRandom
  )

  const result = await sync.main({
    token: first.token,
    baseUrl,
    username: 'student',
    encryptedPassword,
    xnm: '2026',
    xqm: '3'
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'LOGIN_FAILED')
})

test('token 过期或地址不一致时返回 SESSION_EXPIRED', async (t) => {
  const { baseUrl } = await startServer(t)

  const prepared = await sync.main({ action: 'prepare', baseUrl })
  const encryptedPassword = rsa.encryptWithRandom(
    'secret123',
    prepared.modulus,
    prepared.exponent,
    deterministicRandom
  )

  const broken =
    prepared.token.slice(0, 10) + 'ZZZZ' + prepared.token.slice(14)
  const result = await sync.main({
    token: broken,
    baseUrl,
    username: 'student',
    encryptedPassword,
    xnm: '2026',
    xqm: '3'
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'SESSION_EXPIRED')
})

const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const rsa = require('../miniprogram/utils/rsa')

function createKey(bits, javaStyle) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: bits || 2048
  })
  const jwk = publicKey.export({ format: 'jwk' })
  const raw = Buffer.from(jwk.n, 'base64url')
  const modulus = javaStyle
    ? Buffer.concat([Buffer.from([0]), raw])
    : raw
  return {
    modulus: modulus.toString('base64'),
    exponent: Buffer.from(jwk.e, 'base64url').toString('base64'),
    privateKey
  }
}

function decrypt(cipher, privateKey) {
  return crypto
    .privateDecrypt(
      {
        key: privateKey,
        padding: crypto.constants.RSA_PKCS1_PADDING
      },
      Buffer.from(cipher, 'base64')
    )
    .toString('utf8')
}

test('base64 编解码往返', () => {
  const bytes = [0, 1, 2, 127, 128, 255, 10, 20]
  const encoded = rsa.bytesToBase64(bytes)
  assert.deepEqual(rsa.base64ToBytes(encoded), bytes)
})

test('RSA 加密后可用私钥解出原密码', () => {
  const key = createKey()
  const cipher = rsa.encryptWithRandom(
    'secret123',
    key.modulus,
    key.exponent,
    (length) => new Uint8Array(length).fill(1)
  )
  assert.equal(decrypt(cipher, key.privateKey), 'secret123')
  assert.ok(cipher.length > 300)
})

test('RSA 支持中文密码', () => {
  const key = createKey()
  const cipher = rsa.encryptWithRandom(
    '密码123',
    key.modulus,
    key.exponent,
    (length) => new Uint8Array(length).fill(2)
  )
  assert.equal(decrypt(cipher, key.privateKey), '密码123')
})

test('modulus 带 Java 前导零时按真实长度填充', () => {
  const key = createKey(1024, true)
  const cipher = rsa.encryptWithRandom(
    'Jzz200505174259!',
    key.modulus,
    key.exponent,
    (length) => new Uint8Array(length).fill(3)
  )
  assert.equal(Buffer.from(cipher, 'base64').length, 128)
  assert.equal(decrypt(cipher, key.privateKey), 'Jzz200505174259!')
})

test('2048 位密钥带前导零也能正确解密', () => {
  const key = createKey(2048, true)
  const cipher = rsa.encryptWithRandom(
    'secret123',
    key.modulus,
    key.exponent,
    (length) => new Uint8Array(length).fill(4)
  )
  assert.equal(Buffer.from(cipher, 'base64').length, 256)
  assert.equal(decrypt(cipher, key.privateKey), 'secret123')
})

test('超长密码会被拒绝', () => {
  const key = createKey()
  assert.throws(
    () =>
      rsa.encryptWithRandom(
        'a'.repeat(300),
        key.modulus,
        key.exponent,
        (length) => new Uint8Array(length).fill(1)
      ),
    /密码过长/
  )
})

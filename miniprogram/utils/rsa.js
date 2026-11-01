// 轻量 RSA PKCS#1 v1.5 加密（只用于登录密码）。
// 依赖 BigInt 和微信的安全随机数，不引入第三方库。

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
const ZERO = BigInt(0)
const ONE = BigInt(1)
const TWO_FIVE_FIVE = BigInt(255)
const EIGHT = BigInt(8)
const SIX = BigInt(6)

function base64ToBytes(input) {
  const text = String(input || '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/[^A-Za-z0-9+/=]/g, '')
    .replace(/=+$/, '')

  const bytes = []
  let buffer = 0
  let bits = 0

  for (const char of text) {
    const value = B64.indexOf(char)
    if (value < 0) continue
    buffer = (buffer << 6) | value
    bits += 6
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >> bits) & 0xff)
    }
  }
  return bytes
}

function bytesToBase64(bytes) {
  let result = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index]
    const second = index + 1 < bytes.length ? bytes[index + 1] : 0
    const third = index + 2 < bytes.length ? bytes[index + 2] : 0
    const value = (first << 16) | (second << 8) | third

    result += B64[(value >> 18) & 63]
    result += B64[(value >> 12) & 63]
    result += index + 1 < bytes.length ? B64[(value >> 6) & 63] : '='
    result += index + 2 < bytes.length ? B64[value & 63] : '='
  }
  return result
}

function utf8Bytes(text) {
  const bytes = []
  for (const char of String(text)) {
    const code = char.codePointAt(0)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f))
    } else if (code < 0x10000) {
      bytes.push(
        0xe0 | (code >> 12),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      )
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      )
    }
  }
  return bytes
}

function bytesToBigInt(bytes) {
  let value = ZERO
  for (const byte of bytes) {
    value = (value << EIGHT) | BigInt(byte)
  }
  return value
}

// 正方/Java 返回的 modulus 有时会带一个 0x00 符号字节（1024 位密钥会变成 129 字节）。
// RSA 的密钥长度 k 必须按去掉前导零后的真实字节数计算，
// 否则 PKCS#1 填充会多一个字节，学校解出来的明文就是错的。
function modulusBytesOf(modulusB64) {
  const bytes = base64ToBytes(modulusB64)
  let start = 0
  while (start < bytes.length - 1 && bytes[start] === 0) start += 1
  return bytes.slice(start)
}

function bigIntToBytes(value, length) {
  const bytes = new Array(length).fill(0)
  let current = value
  for (let index = length - 1; index >= 0; index -= 1) {
    bytes[index] = Number(current & TWO_FIVE_FIVE)
    current >>= EIGHT
  }
  return bytes
}

function modPow(base, exponent, modulus) {
  let result = ONE
  let currentBase = base % modulus
  let currentExponent = exponent

  while (currentExponent > ZERO) {
    if ((currentExponent & ONE) === ONE) {
      result = (result * currentBase) % modulus
    }
    currentExponent >>= ONE
    currentBase = (currentBase * currentBase) % modulus
  }
  return result
}

// 测试时可注入固定随机数；正式调用走 encryptPassword。
function encryptWithRandom(password, modulusB64, exponentB64, randomBytes) {
  if (typeof BigInt !== 'function') {
    throw new Error('当前环境不支持 BigInt')
  }

  const modulusBytes = modulusBytesOf(modulusB64)
  const modulus = bytesToBigInt(modulusBytes)
  const exponent = bytesToBigInt(base64ToBytes(exponentB64))
  const keyLength = modulusBytes.length
  const message = utf8Bytes(password)

  if (message.length > keyLength - 11) {
    throw new Error('密码过长，超过 RSA 可加密长度')
  }

  const paddingLength = keyLength - message.length - 3
  const padding = randomBytes(paddingLength)
  if (!padding || padding.length !== paddingLength) {
    throw new Error('随机数长度不正确')
  }

  const encoded = [0x00, 0x02]
  for (let index = 0; index < padding.length; index += 1) {
    // PKCS#1 v1.5 填充字节不能为 0
    const byte = padding[index] & 0xff
    encoded.push(byte === 0 ? 1 : byte)
  }
  encoded.push(0x00)
  for (const byte of message) encoded.push(byte)

  const encrypted = modPow(bytesToBigInt(encoded), exponent, modulus)
  return bytesToBase64(bigIntToBytes(encrypted, keyLength))
}

function getRandomApi() {
  if (typeof wx === 'undefined') return null
  if (wx.getRandomValues) return wx
  if (wx.getUserCryptoManager) {
    try {
      return wx.getUserCryptoManager()
    } catch (err) {
      return null
    }
  }
  return null
}

function getRandomBytes(length) {
  return new Promise((resolve, reject) => {
    const api = getRandomApi()
    if (!api || !api.getRandomValues) {
      reject(new Error('当前微信版本不支持安全随机数'))
      return
    }

    api.getRandomValues({
      length,
      success: (res) => resolve(new Uint8Array(res.randomValues)),
      fail: (err) =>
        reject(new Error((err && err.errMsg) || '获取安全随机数失败'))
    })
  })
}

async function encryptPassword(password, modulusB64, exponentB64) {
  if (typeof BigInt !== 'function') {
    throw new Error('当前微信版本不支持 BigInt，无法安全加密')
  }

  const modulusBytes = modulusBytesOf(modulusB64)
  const messageLength = utf8Bytes(password).length
  const paddingLength = modulusBytes.length - messageLength - 3
  if (paddingLength < 8) {
    throw new Error('密码过长，超过 RSA 可加密长度')
  }

  const random = await getRandomBytes(paddingLength)
  return encryptWithRandom(password, modulusB64, exponentB64, () => random)
}

module.exports = {
  encryptPassword,
  encryptWithRandom,
  base64ToBytes,
  bytesToBase64
}

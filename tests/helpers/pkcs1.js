const crypto = require('node:crypto')

/**
 * 用私钥解出 PKCS#1 v1.5 加密的密文。
 *
 * Node 从 20.11.1 起出于安全考虑（CVE-2023-46809）禁用了
 * RSA_PKCS1_PADDING 私钥解密，所以这里改用 RSA_NO_PADDING，
 * 再按 PKCS#1 v1.5 的格式手动去掉填充：
 *   0x00 0x02 [至少 8 字节非零随机数] 0x00 [明文]
 */
function decryptPkcs1(base64Cipher, privateKey) {
  const raw = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_NO_PADDING
    },
    Buffer.from(base64Cipher, 'base64')
  )

  if (raw[0] !== 0x00 || raw[1] !== 0x02) {
    throw new Error('不是 PKCS#1 v1.5 填充')
  }

  const separator = raw.indexOf(0x00, 2)
  if (separator < 0) {
    throw new Error('PKCS#1 填充缺少分隔符')
  }

  return raw.subarray(separator + 1).toString('utf8')
}

module.exports = {
  decryptPkcs1
}

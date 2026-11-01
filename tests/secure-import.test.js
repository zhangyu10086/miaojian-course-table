const test = require('node:test')
const assert = require('node:assert/strict')
const secureImport = require('../miniprogram/utils/secure-import')

test('白名单学校支持安全导入', () => {
  assert.equal(
    secureImport.isSupported(
      'https://jwglxt.wuit.cn/jwglxt/xtgl/login_slogin.html'
    ),
    true
  )
  assert.equal(
    secureImport.isSupported('https://jwxt.xjau.edu.cn'),
    true
  )
  assert.equal(secureImport.isSupported('https://jwgl.cwxu.edu.cn'), true)
  assert.equal(secureImport.isSupported('https://jwglxt.haut.edu.cn'), true)
  assert.equal(secureImport.isSupported('https://tdjw.ntu.edu.cn'), true)
  assert.equal(secureImport.SECURE_IMPORT_HOSTS.length, 12)
})

test('非白名单学校不支持安全导入', () => {
  assert.equal(secureImport.isSupported('https://jw.example.edu.cn'), false)
  assert.equal(secureImport.isSupported(''), false)
})

test('hostOf 忽略协议、路径和端口', () => {
  assert.equal(
    secureImport.hostOf(
      'https://jwglxt.wuit.cn:443/jwglxt/xtgl/login_slogin.html'
    ),
    'jwglxt.wuit.cn'
  )
  assert.equal(secureImport.hostOf(''), '')
})

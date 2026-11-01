const test = require('node:test')
const assert = require('node:assert/strict')
const schools = require('../miniprogram/utils/schools')

test('hostOf 提取域名时忽略协议、路径和端口', () => {
  assert.equal(schools.hostOf('https://jwglxt.wuit.cn'), 'jwglxt.wuit.cn')
  assert.equal(
    schools.hostOf('https://jwglxt.wuit.cn/jwglxt/xtgl/login_slogin.html'),
    'jwglxt.wuit.cn'
  )
  assert.equal(schools.hostOf('http://jwglxt.wuit.cn:8080/jwglxt'), 'jwglxt.wuit.cn')
  assert.equal(schools.hostOf(''), '')
})

test('search 支持校名、拼音缩写和域名', () => {
  assert.equal(schools.search('武昌').length, 1)
  assert.equal(schools.search('wuit')[0].id, 'WUIT')
  assert.equal(schools.search('wcgxy')[0].id, 'WUIT')
  assert.equal(schools.search('wuchanggongxueyuan')[0].id, 'WUIT')
  assert.equal(schools.search('jwglxt.wuit.cn')[0].id, 'WUIT')
  assert.equal(schools.search('不存在的学校').length, 0)
  assert.equal(schools.search('').length, schools.getAll().length)
})

test('findByBaseUrl 能从完整登录地址匹配学校', () => {
  const matched = schools.findByBaseUrl(
    'https://jwglxt.wuit.cn/jwglxt/xtgl/login_slogin.html'
  )
  assert.equal(matched.id, 'WUIT')
  assert.equal(matched.host, 'jwglxt.wuit.cn')
  assert.equal(schools.findByBaseUrl('https://example.edu.cn'), null)
})

test('getAll 返回带 host 的副本', () => {
  const list = schools.getAll()
  assert.ok(list.length > 0)
  assert.ok(list[0].host)
  assert.equal(list[0].system, 'zfn_v2')
})

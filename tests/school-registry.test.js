const test = require('node:test')
const assert = require('node:assert/strict')
const registry = require('../miniprogram/utils/school-registry')

test('getAll 在没有云缓存时回退到内置学校', () => {
  const list = registry.getAll()
  assert.ok(list.length > 0)
  assert.ok(list.some((item) => item.id === 'WUIT'))
  assert.ok(list[0].host)
})

test('filter 支持校名、拼音缩写和域名', () => {
  const list = registry.getAll()
  assert.equal(registry.filter(list, '武昌').length, 1)
  assert.equal(registry.filter(list, 'wuit')[0].id, 'WUIT')
  assert.equal(registry.filter(list, 'wcgxy')[0].id, 'WUIT')
  assert.equal(registry.filter(list, 'wuchanggongxueyuan')[0].id, 'WUIT')
  assert.equal(registry.filter(list, 'jwglxt.wuit.cn')[0].id, 'WUIT')
  assert.equal(registry.filter(list, '不存在').length, 0)
  assert.equal(registry.filter(list, '').length, list.length)
})

test('findByBaseUrl 从完整登录地址匹配学校', () => {
  const matched = registry.findByBaseUrl(
    'https://jwglxt.wuit.cn/jwglxt/xtgl/login_slogin.html'
  )
  assert.equal(matched.id, 'WUIT')
  assert.equal(registry.findByBaseUrl('https://example.edu.cn'), null)
})

test('findById 在给定列表中查找', () => {
  const list = registry.getAll()
  assert.equal(registry.findById(list, 'WUIT').name, '武昌工学院')
  assert.equal(registry.findById(list, 'NOPE'), null)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const normalize = require('../cloudfunctions/manageSchool/normalize')

test('教务地址自动补全 /jwglxt', () => {
  assert.equal(
    normalize.normalizeBaseUrl('https://jwglxt.wuit.cn'),
    'https://jwglxt.wuit.cn/jwglxt'
  )
  assert.equal(
    normalize.normalizeBaseUrl(
      'https://jwglxt.wuit.cn/jwglxt/xtgl/login_slogin.html'
    ),
    'https://jwglxt.wuit.cn/jwglxt'
  )
  assert.equal(
    normalize.normalizeBaseUrl('jwglxt.wuit.cn'),
    'https://jwglxt.wuit.cn/jwglxt'
  )
})

test('拒绝非 http/https 地址', () => {
  assert.throws(() => normalize.normalizeBaseUrl('ftp://example.com'), /http/)
})

test('识别内网和本地地址', () => {
  const blocked = [
    'localhost',
    '10.0.0.1',
    '192.168.1.1',
    '172.20.0.1',
    '127.0.0.1',
    'foo.local',
    '::1'
  ]
  blocked.forEach((host) => {
    assert.equal(normalize.isPrivateHost(host), true, host)
  })
  assert.equal(normalize.isPrivateHost('jwglxt.wuit.cn'), false)
})

test('别名去重、转小写并限制数量', () => {
  assert.deepEqual(
    normalize.normalizeAliases('WUIT, wuit,  wcgxy，武昌工学院'),
    ['wuit', 'wcgxy', '武昌工学院']
  )
})

test('学校 id 稳定且不同域名不冲突', () => {
  const first = normalize.schoolIdFor('jwglxt.wuit.cn')
  const second = normalize.schoolIdFor('jwglxt.wuit.cn')
  const other = normalize.schoolIdFor('jwxt.xjau.edu.cn')
  assert.equal(first, second)
  assert.notEqual(first, other)
  assert.ok(/^SCH_[a-z0-9_]+$/.test(first))
})

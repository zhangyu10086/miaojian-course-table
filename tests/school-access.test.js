const test = require('node:test')
const assert = require('node:assert/strict')
const access = require('../miniprogram/utils/school-access')

test('数据库 autoImport=true 优先于本地白名单', () => {
  assert.equal(
    access.supportsAutoImport({
      baseUrl: 'https://example.edu.cn',
      autoImport: true
    }),
    true
  )
})

test('数据库 autoImport=false 关闭自动导入', () => {
  assert.equal(
    access.supportsAutoImport({
      baseUrl: 'https://jwglxt.wuit.cn',
      autoImport: false
    }),
    false
  )
})

test('旧数据没有 autoImport 时回退到本地白名单', () => {
  assert.equal(
    access.supportsAutoImport({ baseUrl: 'https://jwglxt.wuit.cn' }),
    true
  )
  assert.equal(
    access.supportsAutoImport({ baseUrl: 'https://example.edu.cn' }),
    false
  )
})

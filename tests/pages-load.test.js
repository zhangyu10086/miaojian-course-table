const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')

const pages = []
const memory = {}

global.wx = {
  getStorageSync(key) {
    return memory[key] === undefined ? '' : memory[key]
  },
  setStorageSync(key, value) {
    memory[key] = value
  },
  removeStorageSync(key) {
    delete memory[key]
  },
  getSetting() {},
  authorize() {}
}

global.getApp = () => ({
  globalData: { cloudReady: false }
})

global.Page = (config) => {
  pages.push(config)
}

test('所有页面模块可以正常加载', () => {
  const pageFiles = [
    '../miniprogram/pages/entry/entry.js',
    '../miniprogram/pages/schedule/schedule.js',
    '../miniprogram/pages/today/today.js',
    '../miniprogram/pages/mine/mine.js',
    '../miniprogram/pages/course-edit/course-edit.js',
    '../miniprogram/pages/sync/sync.js',
    '../miniprogram/pages/settings/settings.js',
    '../miniprogram/pages/admin/admin.js',
    '../miniprogram/pages/school-admin/school-admin.js'
  ]

  pageFiles.forEach((file) => {
    require(path.join(__dirname, file))
  })

  assert.equal(pages.length, pageFiles.length)
  pages.forEach((config) => {
    assert.ok(config.data, '页面缺少 data')
    assert.ok(typeof config.onLoad === 'function' || typeof config.onShow === 'function')
  })
})

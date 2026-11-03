const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

const memory = {}

global.wx = {
  getStorageSync(key) {
    return memory[key] === undefined ? '' : memory[key]
  },
  setStorageSync(key, value) {
    memory[key] = JSON.parse(JSON.stringify(value))
  },
  removeStorageSync(key) {
    delete memory[key]
  }
}

const store = require('../miniprogram/utils/store')

beforeEach(() => {
  Object.keys(memory).forEach((key) => delete memory[key])
  store.ensureDefaults()
})

test('ensureDefaults 初始化设置和空课程', () => {
  assert.equal(store.getCourses().length, 0)
  const settings = store.getSettings()
  assert.equal(settings.totalWeeks, 20)
  assert.ok(settings.sections.length >= 10)
})

test('upsertCourse 新增、修改、删除', () => {
  store.upsertCourse({
    id: 'c1',
    name: '高等数学',
    day: 1,
    startSection: 1,
    endSection: 2,
    weeks: [1, 2, 3],
    source: 'manual'
  })

  let courses = store.getCourses()
  assert.equal(courses.length, 1)
  assert.equal(courses[0].name, '高等数学')

  store.upsertCourse({ id: 'c1', name: '高等数学 A' })
  courses = store.getCourses()
  assert.equal(courses.length, 1)
  assert.equal(courses[0].name, '高等数学 A')

  store.deleteCourse('c1')
  assert.equal(store.getCourses().length, 0)
})

test('replaceSyncedCourses 保留手动课程并避免重复', () => {
  store.upsertCourse({
    id: 'manual-1',
    name: '高等数学',
    day: 1,
    startSection: 1,
    endSection: 2,
    weeks: [1, 2],
    source: 'manual'
  })

  store.replaceSyncedCourses([
    {
      name: '高等数学',
      day: 1,
      startSection: 1,
      endSection: 2,
      weeks: [1, 2, 3],
      source: 'sync'
    },
    {
      name: '大学英语',
      day: 2,
      startSection: 3,
      endSection: 4,
      weeks: [1, 2],
      source: 'sync'
    }
  ])

  const courses = store.getCourses()
  assert.equal(courses.length, 2)
  assert.equal(courses.filter((item) => item.source === 'manual').length, 1)
  assert.equal(courses.filter((item) => item.source === 'sync').length, 1)
  assert.equal(courses.find((item) => item.source === 'sync').name, '大学英语')
})

test('saveSettings 合并 term 而不丢字段', () => {
  store.saveSettings({ term: { xnm: '2026', xqm: '3' } })
  store.saveSettings({ term: { xqm: '12' } })
  const settings = store.getSettings()
  assert.equal(settings.term.xnm, '2026')
  assert.equal(settings.term.xqm, '12')
})

test('defaultTab 默认课表，只接受课表/今日', () => {
  assert.equal(store.getSettings().defaultTab, 'schedule')
  store.saveSettings({ defaultTab: 'today' })
  assert.equal(store.getSettings().defaultTab, 'today')
  store.saveSettings({ defaultTab: 'invalid' })
  assert.equal(store.getSettings().defaultTab, 'schedule')
})

test('getAuth 与 saveAuth 往返', () => {
  store.saveAuth({
    baseUrl: 'https://jw.example.edu.cn',
    username: '20260001',
    password: 'secret',
    remember: true,
    xnm: '2026',
    xqm: '3'
  })
  const auth = store.getAuth()
  assert.equal(auth.baseUrl, 'https://jw.example.edu.cn')
  assert.equal(auth.username, '20260001')
  assert.equal(auth.remember, true)
})

test('addRecentSchool 去重、置顶并限制 5 条', () => {
  for (let index = 1; index <= 6; index += 1) {
    store.addRecentSchool({
      name: '学校' + index,
      baseUrl: 'https://jw' + index + '.example.edu.cn'
    })
  }
  store.addRecentSchool({
    name: '学校3-新',
    baseUrl: 'https://jw3.example.edu.cn'
  })

  const recent = store.getRecentSchools()
  assert.equal(recent.length, 5)
  assert.equal(recent[0].name, '学校3-新')
  assert.equal(recent.filter((item) => item.baseUrl === 'https://jw3.example.edu.cn').length, 1)
})

test('upsertCourses 批量写入并共享 groupId', () => {
  const groupId = store.genGroupId()
  store.upsertCourses([
    { name: '高数', day: 1, startSection: 1, endSection: 2, weeks: [1], groupId },
    { name: '高数', day: 3, startSection: 3, endSection: 4, weeks: [1], groupId }
  ])
  const group = store.getCourseGroup(groupId)
  assert.equal(group.length, 2)
  assert.equal(group[1].day, 3)
})

test('getCourses 保留 groupId', () => {
  store.upsertCourses([{ name: '英语', day: 2, startSection: 1, endSection: 2, weeks: [1], groupId: 'g1' }])
  assert.equal(store.getCourses()[0].groupId, 'g1')
})

test('upsertCourses 同 id 再次写入是更新而不是新增', () => {
  store.upsertCourses([
    { id: 'c1', name: '高数', day: 1, startSection: 1, endSection: 2, weeks: [1] }
  ])
  store.upsertCourses([
    { id: 'c1', name: '高数（改）', day: 1, startSection: 1, endSection: 2, weeks: [1] }
  ])
  const list = store.getCourses()
  assert.equal(list.length, 1)
  assert.equal(list[0].name, '高数（改）')
})

test('批量写入后每条记录的 id 非空且互不相同', () => {
  store.upsertCourses([
    { name: 'A', day: 1, startSection: 1, endSection: 2, weeks: [1] },
    { name: 'B', day: 2, startSection: 1, endSection: 2, weeks: [1] }
  ])
  const ids = store.getCourses().map((item) => item.id)
  assert.ok(ids.every((id) => !!id))
  assert.equal(new Set(ids).size, 2)
})

test('deleteCourseGroup 只删除同组记录', () => {
  store.upsertCourses([
    { name: '高数', day: 1, startSection: 1, endSection: 2, weeks: [1], groupId: 'g1' },
    { name: '高数', day: 3, startSection: 3, endSection: 4, weeks: [1], groupId: 'g1' },
    { name: '英语', day: 2, startSection: 1, endSection: 2, weeks: [1] }
  ])
  store.deleteCourseGroup('g1')
  const left = store.getCourses()
  assert.equal(left.length, 1)
  assert.equal(left[0].name, '英语')
})

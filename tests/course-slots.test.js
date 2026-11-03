const test = require('node:test')
const assert = require('node:assert/strict')
const slotsUtil = require('../miniprogram/utils/course-slots')

test('duplicateSlotIndex 找到完全重复的时间段', () => {
  const slots = [
    { day: 1, startSection: 1, endSection: 2 },
    { day: 3, startSection: 3, endSection: 4 },
    { day: 1, startSection: 1, endSection: 2 }
  ]
  assert.equal(slotsUtil.duplicateSlotIndex(slots), 2)
})

test('duplicateSlotIndex 没有重复时返回 -1', () => {
  const slots = [
    { day: 1, startSection: 1, endSection: 2 },
    { day: 3, startSection: 3, endSection: 4 }
  ]
  assert.equal(slotsUtil.duplicateSlotIndex(slots), -1)
})

test('buildCourseRecords 把公共字段复制到每条记录', () => {
  const records = slotsUtil.buildCourseRecords(
    [
      { day: 1, startSection: 1, endSection: 2 },
      { day: 3, startSection: 3, endSection: 4 }
    ],
    { name: '高数', weeks: [1, 2], groupId: 'g1' }
  )
  assert.equal(records.length, 2)
  assert.equal(records[0].name, '高数')
  assert.equal(records[1].day, 3)
  assert.equal(records[1].groupId, 'g1')
})

test('slotsFromCourse 兼容没有时段数组的旧数据', () => {
  assert.deepEqual(
    slotsUtil.slotsFromCourse({ day: 2, startSection: 1, endSection: 2 }),
    [{ day: 2, startSection: 1, endSection: 2 }]
  )
})

test('slotsFromCourse 缺 endSection 时回退到 startSection', () => {
  const slots = slotsUtil.slotsFromCourse({
    slots: [{ day: 1, startSection: 3 }]
  })
  assert.equal(slots[0].startSection, 3)
  assert.equal(slots[0].endSection, 3)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const { HEAD_HEIGHT, buildWeekPanels } = require('../miniprogram/utils/week-panels')

const settings = {
  semesterStartDate: '2026-09-07',
  totalWeeks: 20,
  firstDayOfWeek: 1,
  showWeekends: false,
  sections: [
    { number: 1, startTime: '08:00', endTime: '08:45' },
    { number: 2, startTime: '08:55', endTime: '09:40' },
    { number: 3, startTime: '10:00', endTime: '10:45' },
    { number: 4, startTime: '10:55', endTime: '11:40' }
  ]
}

const courses = [
  {
    id: 'a',
    name: '高等数学',
    day: 1,
    startSection: 1,
    endSection: 2,
    weeks: [9, 10, 11],
    colorIndex: 0
  },
  {
    id: 'b',
    name: '大学英语',
    day: 2,
    startSection: 3,
    endSection: 4,
    weeks: [1],
    colorIndex: 1
  },
  {
    id: 'c',
    name: '只在第十周',
    day: 3,
    startSection: 1,
    endSection: 2,
    weeks: [10],
    colorIndex: 2
  }
]

test('中间周生成上一周、当前周、下一周三页', () => {
  const result = buildWeekPanels(settings, courses, 10, 100)

  assert.deepEqual(
    result.panels.map((panel) => panel.week),
    [9, 10, 11]
  )
  assert.equal(result.current, 10)
  assert.equal(result.pagerIndex, 1)
  assert.equal(result.isFirst, false)
  assert.equal(result.isLast, false)
  assert.equal(result.gridHeight, 400)
  assert.equal(result.swiperHeight, 400 + HEAD_HEIGHT)
  assert.equal(result.gridLines.length, 3)
  assert.deepEqual(result.gridLines, [100, 200, 300])
})

test('只在某一周出现的课程只出现在对应页', () => {
  const result = buildWeekPanels(settings, courses, 10, 100)

  const currentWednesday = result.panels[1].days.find((day) => day.day === 3)
  assert.equal(currentWednesday.blocks.length, 1)
  assert.equal(currentWednesday.blocks[0].course.name, '只在第十周')

  const previousWednesday = result.panels[0].days.find((day) => day.day === 3)
  assert.equal(previousWednesday.blocks.length, 0)

  const nextWednesday = result.panels[2].days.find((day) => day.day === 3)
  assert.equal(nextWednesday.blocks.length, 0)
})

test('第 1 周只生成 [1, 2]，边界方向没有可滑页', () => {
  const result = buildWeekPanels(settings, courses, 1, 100)

  assert.deepEqual(
    result.panels.map((panel) => panel.week),
    [1, 2]
  )
  assert.equal(result.pagerIndex, 0)
  assert.equal(result.isFirst, true)
  assert.notEqual(result.panels[0].key, result.panels[1].key)

  const tuesday = result.panels[0].days.find((day) => day.day === 2)
  assert.equal(tuesday.blocks.length, 1)
  assert.equal(tuesday.blocks[0].course.name, '大学英语')

  const weekTwoTuesday = result.panels[1].days.find((day) => day.day === 2)
  assert.equal(weekTwoTuesday.blocks.length, 0)
})

test('最后一周只生成 [19, 20]，边界方向没有可滑页', () => {
  const result = buildWeekPanels(settings, courses, 20, 100)

  assert.deepEqual(
    result.panels.map((panel) => panel.week),
    [19, 20]
  )
  assert.equal(result.pagerIndex, 1)
  assert.equal(result.isLast, true)
  assert.notEqual(result.panels[0].key, result.panels[1].key)
})

test('周次越界时会被夹到 1..totalWeeks', () => {
  assert.deepEqual(
    buildWeekPanels(settings, courses, 0, 100).panels.map((panel) => panel.week),
    [1, 2]
  )
  assert.deepEqual(
    buildWeekPanels(settings, courses, 99, 100).panels.map((panel) => panel.week),
    [19, 20]
  )
})

test('只有一周时只生成一页', () => {
  const result = buildWeekPanels(
    Object.assign({}, settings, { totalWeeks: 1 }),
    courses,
    1,
    100
  )
  assert.deepEqual(
    result.panels.map((panel) => panel.week),
    [1]
  )
  assert.equal(result.pagerIndex, 0)
  assert.equal(result.isFirst, true)
  assert.equal(result.isLast, true)
})

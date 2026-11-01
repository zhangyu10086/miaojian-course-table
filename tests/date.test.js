const test = require('node:test')
const assert = require('node:assert/strict')
const dateUtil = require('../miniprogram/utils/date')

const settings = {
  semesterStartDate: '2026-09-07',
  totalWeeks: 20,
  firstDayOfWeek: 1,
  showWeekends: false,
  sections: [
    { number: 1, startTime: '08:00', endTime: '08:45' },
    { number: 2, startTime: '08:55', endTime: '09:40' }
  ]
}

test('parseDate 只接受 yyyy-MM-dd', () => {
  assert.equal(dateUtil.formatDate(dateUtil.parseDate('2026-09-07')), '2026-09-07')
  assert.equal(dateUtil.parseDate('2026/09/07'), null)
  assert.equal(dateUtil.parseDate('2026-02-30'), null)
})

test('getWeekNumber 计算学期中的周次', () => {
  assert.equal(dateUtil.getWeekNumber(settings, new Date(2026, 8, 7)).week, 1)
  assert.equal(dateUtil.getWeekNumber(settings, new Date(2026, 8, 14)).week, 2)
  assert.equal(dateUtil.getWeekNumber(settings, new Date(2026, 9, 20)).week, 7)
})

test('getWeekNumber 处理学期开始前和结束后', () => {
  const before = dateUtil.getWeekNumber(settings, new Date(2026, 7, 1))
  assert.equal(before.week, 1)
  assert.equal(before.before, true)

  const after = dateUtil.getWeekNumber(settings, new Date(2027, 2, 1))
  assert.equal(after.week, 20)
  assert.equal(after.after, true)
})

test('getDisplayDays 默认只显示工作日', () => {
  const days = dateUtil.getDisplayDays(settings, 1, new Date(2026, 8, 7))
  assert.equal(days.length, 5)
  assert.equal(days[0].label, '一')
  assert.equal(days[0].dateLabel, '09-07')
  assert.equal(days[4].label, '五')
})

test('getDisplayDays 周日开始时排序正确', () => {
  const sundayFirst = Object.assign({}, settings, {
    firstDayOfWeek: 7,
    showWeekends: true
  })
  const days = dateUtil.getDisplayDays(sundayFirst, 1, new Date(2026, 8, 7))
  assert.equal(days.length, 7)
  assert.equal(days[0].label, '日')
  assert.equal(days[0].dateLabel, '09-06')
  assert.equal(days[1].label, '一')
})

test('formatWeekRange 使用实际显示范围', () => {
  assert.equal(dateUtil.formatWeekRange(settings, 1), '09-07 — 09-11')
})

test('getOccurrenceDate 计算课程日期', () => {
  const mondayCourse = { day: 1 }
  const sundayCourse = { day: 7 }
  assert.equal(
    dateUtil.formatDate(dateUtil.getOccurrenceDate(settings, mondayCourse, 2)),
    '2026-09-14'
  )
  assert.equal(
    dateUtil.formatDate(dateUtil.getOccurrenceDate(settings, sundayCourse, 2)),
    '2026-09-20'
  )
})

test('timeToMinutes 与 minutesToTime 互转', () => {
  assert.equal(dateUtil.timeToMinutes('08:05'), 485)
  assert.equal(dateUtil.minutesToTime(485), '08:05')
  assert.equal(dateUtil.minutesToTime(1440), '00:00')
})

test('formatCountdown 输出可读倒计时', () => {
  assert.equal(dateUtil.formatCountdown(0), '即将开始')
  assert.equal(dateUtil.formatCountdown(25), '还有 25 分钟')
  assert.equal(dateUtil.formatCountdown(90), '还有 1 小时 30 分钟')
})

const test = require('node:test')
const assert = require('node:assert/strict')
const transfer = require('../miniprogram/utils/transfer')

const settings = {
  semesterStartDate: '2026-09-07',
  totalWeeks: 17,
  firstDayOfWeek: 1,
  sections: [
    { number: 1, startTime: '08:00', endTime: '08:45' },
    { number: 2, startTime: '08:55', endTime: '09:40' },
    { number: 3, startTime: '10:25', endTime: '11:10' }
  ]
}

const courses = [
  {
    id: 'a',
    name: '高等数学',
    teacher: '华罗庚',
    location: 'A101',
    day: 1,
    startSection: 1,
    endSection: 2,
    weeks: [1, 2, 3, 5],
    colorIndex: 1,
    remark: '带计算器',
    credit: 4
  },
  {
    id: 'b',
    name: '软件测试',
    teacher: '谢玉峰',
    location: 'E03-A102',
    day: 3,
    startSection: 3,
    endSection: 3,
    weeks: [1, 3, 5],
    colorIndex: 2,
    remark: '',
    credit: 2
  }
]

test('CSV 导入导出往返', () => {
  const csv = transfer.toCsv(courses)
  const result = transfer.parseCsv(csv)
  assert.equal(result.courses.length, 2)
  assert.equal(result.courses[0].name, '高等数学')
  assert.deepEqual(result.courses[0].weeks, [1, 2, 3, 5])
  assert.equal(result.courses[1].location, 'E03-A102')
})

test('CSV 处理引号、逗号和换行', () => {
  const csv = transfer.toCsv([
    {
      name: '课程,测试',
      teacher: 'A"B',
      location: '教室\n二楼',
      day: 2,
      startSection: 1,
      endSection: 2,
      weeks: [1]
    }
  ])
  const result = transfer.parseCsv(csv)
  assert.equal(result.courses[0].name, '课程,测试')
  assert.equal(result.courses[0].teacher, 'A"B')
  assert.equal(result.courses[0].location, '教室\n二楼')
})

test('JSON 导入导出往返', () => {
  const json = transfer.toJson(courses, settings)
  const result = transfer.parseJson(json)
  assert.equal(result.courses.length, 2)
  assert.equal(result.settings.totalWeeks, 17)
})

test('ICS 导出包含自定义课表数据，可往返', () => {
  const ics = transfer.toIcs(courses, settings)
  assert.match(ics, /BEGIN:VCALENDAR/)
  assert.match(ics, /X-MIAOJIAN-COURSE:/)
  assert.match(ics, /X-MIAOJIAN-SETTINGS:/)

  const result = transfer.parseIcs(ics, settings)
  assert.equal(result.courses.length, 2)
  assert.equal(result.settings.totalWeeks, 17)
  const math = result.courses.find((course) => course.name === '高等数学')
  assert.deepEqual(math.weeks, [1, 2, 3, 5])
})

test('ICS 没有学期设置时拒绝导出', () => {
  assert.throws(
    () => transfer.toIcs(courses, { ...settings, semesterStartDate: '' }),
    /第 1 周开始日期/
  )
})

test('周次格式支持范围和多段', () => {
  assert.equal(transfer.formatWeeks([1, 2, 3, 5, 6]), '1-3|5-6')
  assert.deepEqual(transfer.parseWeeksText('1-3|5,6,8-9周'), [1, 2, 3, 5, 6, 8, 9])
})

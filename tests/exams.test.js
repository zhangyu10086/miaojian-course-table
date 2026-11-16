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

const exams = require('../miniprogram/utils/exams')

beforeEach(() => {
  Object.keys(memory).forEach((key) => delete memory[key])
})

test('parseExamTime 解析日期和时段', () => {
  assert.deepEqual(exams.parseExamTime('2026-11-18(14:00-15:30)'), {
    date: '2026-11-18',
    startTime: '14:00',
    endTime: '15:30'
  })
  assert.deepEqual(exams.parseExamTime('2026-11-18 09:00~10:30'), {
    date: '2026-11-18',
    startTime: '09:00',
    endTime: '10:30'
  })
  assert.deepEqual(exams.parseExamTime('2026-11-18'), {
    date: '2026-11-18',
    startTime: '',
    endTime: ''
  })
  assert.deepEqual(exams.parseExamTime(''), {
    date: '',
    startTime: '',
    endTime: ''
  })
})

test('parseExamTime 补零月份和日期', () => {
  assert.equal(exams.parseExamTime('2026-1-8(08:00-09:30)').date, '2026-01-08')
})

test('normalizeExam 把教务字段映射成考试结构', () => {
  const item = exams.normalizeExam({
    kcmc: '软件测试',
    ksmc: '第12周-期末（分散）',
    kssj: '2026-11-18(14:00-15:30)',
    cdmc: 'E03-A102',
    cdxqmc: '北校区',
    khfs: '考查',
    xf: '2.0',
    jsxx: '2023074/谢玉峰',
    source: 'sync'
  })
  assert.equal(item.name, '软件测试')
  assert.equal(item.title, '第12周-期末（分散）')
  assert.equal(item.date, '2026-11-18')
  assert.equal(item.startTime, '14:00')
  assert.equal(item.endTime, '15:30')
  assert.equal(item.location, 'E03-A102')
  assert.equal(item.campus, '北校区')
  assert.equal(item.credit, 2)
  assert.equal(item.teacher, '谢玉峰')
  assert.equal(item.source, 'sync')
})

test('replaceSyncedExams 替换教务来源并保留手动添加', () => {
  exams.saveExams([
    { name: '手动课', date: '2026-11-20', startTime: '09:00', source: 'manual' },
    { name: '旧考试', date: '2026-11-19', startTime: '09:00', source: 'sync' }
  ])
  exams.replaceSyncedExams([
    { kcmc: '软件测试', kssj: '2026-11-18(14:00-15:30)' },
    { kcmc: '手动课', kssj: '2026-11-20(09:00-10:00)' }
  ])
  const list = exams.getExams()
  assert.equal(list.length, 2)
  assert.ok(list.some((item) => item.name === '手动课'))
  assert.ok(list.some((item) => item.name === '软件测试'))
  assert.ok(!list.some((item) => item.name === '旧考试'))
})

test('sortExams 和 splitExams 区分未考与已考', () => {
  const now = new Date(2026, 10, 16, 12, 0).getTime()
  const list = [
    { name: '已考', date: '2026-11-10', startTime: '09:00', endTime: '10:30' },
    { name: '后天', date: '2026-11-18', startTime: '14:00', endTime: '15:30' },
    { name: '明天', date: '2026-11-17', startTime: '09:00', endTime: '10:30' }
  ]
  const split = exams.splitExams(list, now)
  assert.deepEqual(
    split.upcoming.map((item) => item.name),
    ['明天', '后天']
  )
  assert.deepEqual(
    split.past.map((item) => item.name),
    ['已考']
  )
})

test('daysUntil 计算剩余天数', () => {
  const now = new Date(2026, 10, 16, 20, 0).getTime()
  assert.equal(exams.daysUntil({ date: '2026-11-16' }, now), 0)
  assert.equal(exams.daysUntil({ date: '2026-11-18' }, now), 2)
  assert.equal(exams.daysUntil({ date: '2026-11-10' }, now), -6)
  assert.equal(exams.daysUntil({ date: '' }, now), null)
})

test('nextExam 只返回限定天数内的未考考试', () => {
  const now = new Date(2026, 10, 16, 12, 0).getTime()
  const list = [
    { name: '三天后', date: '2026-11-19', startTime: '09:00', endTime: '10:30' },
    { name: '十天后', date: '2026-11-26', startTime: '09:00', endTime: '10:30' }
  ]
  assert.equal(exams.nextExam(list, now, 7).name, '三天后')
  assert.equal(exams.nextExam(list, now, 1), null)
})

test('upsertExam 与 deleteExam 增删改', () => {
  exams.upsertExam({ name: '软件测试', date: '2026-11-18', startTime: '14:00' })
  const first = exams.getExams()[0]
  exams.upsertExam(Object.assign({}, first, { location: 'A101' }))
  assert.equal(exams.getExams().length, 1)
  assert.equal(exams.getExams()[0].location, 'A101')
  exams.deleteExam(first.id)
  assert.equal(exams.getExams().length, 0)
})

const test = require('node:test')
const assert = require('node:assert/strict')
const parser = require('../miniprogram/utils/parser')

test('parseWeeks 解析普通周次', () => {
  assert.deepEqual(
    parser.parseWeeks('1-4周'),
    [1, 2, 3, 4]
  )
})

test('parseWeeks 解析单周', () => {
  assert.deepEqual(
    parser.parseWeeks('1-8周(单)'),
    [1, 3, 5, 7]
  )
})

test('parseWeeks 解析双周与中文括号', () => {
  assert.deepEqual(
    parser.parseWeeks('1-8周（双）'),
    [2, 4, 6, 8]
  )
})

test('parseWeeks 解析多段周次', () => {
  assert.deepEqual(
    parser.parseWeeks('1-4,6-8,10周'),
    [1, 2, 3, 4, 6, 7, 8, 10]
  )
})

test('parseSectionRanges 解析连续节次', () => {
  assert.deepEqual(parser.parseSectionRanges('1-2节'), [[1, 2]])
})

test('parseSectionRanges 解析多段节次', () => {
  assert.deepEqual(parser.parseSectionRanges('1-2,5-6节'), [
    [1, 2],
    [5, 6]
  ])
})

test('parseSectionRanges 合并相邻单节', () => {
  assert.deepEqual(parser.parseSectionRanges('3,4,5节'), [[3, 5]])
})

test('parseKbList 合并同一门课的不同周次记录', () => {
  const courses = parser.parseKbList(
    [
      {
        kcmc: '高等数学',
        xm: '张老师',
        cdmc: 'A101',
        xqj: '1',
        jcs: '1-2节',
        zcd: '1-16周'
      },
      {
        kcmc: '高等数学',
        xm: '张老师',
        cdmc: 'A101',
        xqj: '1',
        jcs: '1-2节',
        zcd: '1-16周(单)'
      }
    ],
    { totalWeeks: 20 }
  )

  assert.equal(courses.length, 1)
  assert.deepEqual(courses[0].weeks, [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16
  ])
  assert.equal(courses[0].name, '高等数学')
  assert.equal(courses[0].source, 'sync')
})

test('parseKbList 拆分不连续节次', () => {
  const courses = parser.parseKbList(
    [
      {
        kcmc: '大学英语',
        xm: '李老师',
        cdmc: 'B203',
        xqj: '3',
        jcs: '1-2,5-6节',
        zcd: '1-16周'
      }
    ],
    { totalWeeks: 20 }
  )

  assert.equal(courses.length, 2)
  assert.deepEqual(
    courses.map((item) => [item.startSection, item.endSection]),
    [
      [1, 2],
      [5, 6]
    ]
  )
})

test('parseKbList 过滤超出总周数的周次', () => {
  const courses = parser.parseKbList(
    [
      {
        kcmc: '体育',
        xm: '王老师',
        cdmc: '操场',
        xqj: '5',
        jcs: '3-4节',
        zcd: '1-24周'
      }
    ],
    { totalWeeks: 20 }
  )

  assert.equal(courses.length, 1)
  assert.deepEqual(courses[0].weeks, Array.from({ length: 20 }, (_, index) => index + 1))
})

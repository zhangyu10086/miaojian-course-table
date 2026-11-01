const test = require('node:test')
const assert = require('node:assert/strict')
const layout = require('../miniprogram/utils/layout')

function course(id, startSection, endSection, day, weeks) {
  return {
    id,
    name: id,
    teacher: '',
    location: '',
    day: day || 1,
    startSection,
    endSection,
    weeks: weeks || [1],
    colorIndex: 0
  }
}

test('buildBlocks 无冲突时占满整列', () => {
  const blocks = layout.buildBlocks(
    [course('a', 1, 2), course('b', 4, 5)],
    1,
    1,
    100
  )

  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].left, 0)
  assert.equal(blocks[0].width, 100)
  assert.equal(blocks[0].top, 0)
  assert.equal(blocks[0].height, 200)
  assert.equal(blocks[1].top, 300)
})

test('buildBlocks 两门课冲突时分两列', () => {
  const blocks = layout.buildBlocks(
    [course('a', 1, 2), course('b', 2, 3)],
    1,
    1,
    100
  )

  assert.equal(blocks.length, 2)
  assert.equal(blocks[0].columnCount, 2)
  assert.equal(blocks[1].columnCount, 2)
  assert.equal(blocks[0].width, 50)
  assert.equal(blocks[1].width, 50)
})

test('buildBlocks 三门课冲突时按可用列分配', () => {
  const blocks = layout.buildBlocks(
    [course('a', 1, 4), course('b', 2, 3), course('c', 3, 5)],
    1,
    1,
    100
  )

  const byId = {}
  blocks.forEach((block) => {
    byId[block.course.id] = block
  })

  // 第 3 节 A、B、C 三门课同时出现，需要三列
  assert.equal(byId.a.columnCount, 3)
  assert.equal(byId.b.columnCount, 3)
  assert.equal(byId.c.columnCount, 3)
  assert.equal(byId.a.left, 0)
  assert.equal(Math.round(byId.b.left), 33)
  assert.equal(Math.round(byId.c.left), 67)
})

test('buildBlocks 只显示当前周的课程', () => {
  const blocks = layout.buildBlocks(
    [course('a', 1, 2, 1, [1]), course('b', 1, 2, 1, [2])],
    2,
    1,
    100
  )

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].course.id, 'b')
})

test('buildBlocks 忽略非法节次', () => {
  const blocks = layout.buildBlocks(
    [course('a', 0, 2), course('b', 3, 2), course('c', 1, 2)],
    1,
    1,
    100
  )

  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].course.id, 'c')
})

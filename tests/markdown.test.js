const test = require('node:test')
const assert = require('node:assert/strict')
const markdown = require('../miniprogram/utils/markdown')

test('解析标题层级', () => {
  const blocks = markdown.parseMarkdown('# 大标题\n## 小标题\n### 更小')
  assert.deepEqual(
    blocks.map((block) => block.level),
    [1, 2, 3]
  )
  assert.equal(blocks[0].parts[0].text, '大标题')
})

test('解析加粗和普通文字', () => {
  const blocks = markdown.parseMarkdown('今天是 **重要** 通知')
  assert.equal(blocks[0].type, 'paragraph')
  assert.deepEqual(
    blocks[0].parts.map((part) => [part.text, part.bold]),
    [
      ['今天是 ', false],
      ['重要', true],
      [' 通知', false]
    ]
  )
})

test('未闭合的星号按普通文字处理', () => {
  const blocks = markdown.parseMarkdown('**没有闭合')
  assert.equal(blocks[0].parts[0].text, '**没有闭合')
  assert.equal(blocks[0].parts[0].bold, false)
})

test('解析无序列表和有序列表', () => {
  const blocks = markdown.parseMarkdown('- 第一项\n- 第二项\n\n1. 步骤一\n2. 步骤二')
  assert.equal(blocks[0].type, 'list')
  assert.equal(blocks[0].ordered, false)
  assert.equal(blocks[0].items.length, 2)
  assert.equal(blocks[1].type, 'list')
  assert.equal(blocks[1].ordered, true)
  assert.equal(blocks[1].items[1].number, 2)
})

test('解析引用和段落', () => {
  const blocks = markdown.parseMarkdown('> 引用内容\n\n普通段落第一行\n第二行')
  assert.equal(blocks[0].type, 'quote')
  assert.equal(blocks[0].parts[0].text, '引用内容')
  assert.equal(blocks[1].type, 'paragraph')
  assert.equal(blocks[1].parts[0].text, '普通段落第一行\n第二行')
})

test('支持带缩进的子列表', () => {
  const blocks = markdown.parseMarkdown(
    '- 打开就能看到课表\n  - 课表默认保存在本机\n  - 不会跳转到无关页面'
  )
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'list')
  assert.deepEqual(
    blocks[0].items.map((item) => item.level),
    [0, 1, 1]
  )
})

test('支持带缩进的引用', () => {
  const blocks = markdown.parseMarkdown('  > 感谢每一个愿意用它的同学。')
  assert.equal(blocks.length, 1)
  assert.equal(blocks[0].type, 'quote')
  assert.equal(blocks[0].parts[0].text, '感谢每一个愿意用它的同学。')
})

test('stripMarkdown 去掉标记并压成一行', () => {
  const text = markdown.stripMarkdown('# 标题\n\n- **加粗** 内容\n1. 第一项')
  assert.equal(text, '标题 加粗 内容 第一项')
})

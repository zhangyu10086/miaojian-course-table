const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const root = path.join(__dirname, '..', 'miniprogram')
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))

test('app.json 中的每个页面都有四类文件', () => {
  appJson.pages.forEach((page) => {
    ;['.js', '.json', '.wxml', '.wxss'].forEach((ext) => {
      const file = path.join(root, page + ext)
      assert.ok(fs.existsSync(file), '缺少文件: ' + file)
    })
  })
})

function checkWxml(file) {
  const text = fs.readFileSync(file, 'utf8')
  const stack = []
  let index = 0

  while (index < text.length) {
    const start = text.indexOf('<', index)
    if (start === -1) break
    index = start + 1

    if (text.startsWith('<!--', start)) {
      const end = text.indexOf('-->', start + 4)
      index = end === -1 ? text.length : end + 3
      continue
    }

    let cursor = start + 1
    let quote = null
    while (cursor < text.length) {
      const char = text[cursor]
      if (quote) {
        if (char === quote) quote = null
      } else if (char === '"' || char === "'") {
        quote = char
      } else if (char === '>') {
        break
      }
      cursor += 1
    }

    const raw = text.slice(start + 1, cursor).trim()
    index = cursor + 1
    if (!raw) continue

    const closing = raw.startsWith('/')
    const selfClosing = raw.endsWith('/')
    const match = raw.match(/^\/?\s*([a-zA-Z0-9-]+)/)
    if (!match) continue
    const name = match[1]

    if (closing) {
      const last = stack.pop()
      assert.equal(last, name, file + ' 标签未正确闭合: ' + name)
    } else if (!selfClosing) {
      stack.push(name)
    }
  }

  assert.deepEqual(stack, [], file + ' 存在未闭合标签')
}

test('所有 WXML 标签闭合正确', () => {
  appJson.pages.forEach((page) => {
    checkWxml(path.join(root, page + '.wxml'))
  })
})

test('所有 WXSS 花括号配对', () => {
  appJson.pages.forEach((page) => {
    const file = path.join(root, page + '.wxss')
    const text = fs.readFileSync(file, 'utf8')
    const open = (text.match(/{/g) || []).length
    const close = (text.match(/}/g) || []).length
    assert.equal(open, close, file + ' 花括号不配对')
  })
})

// 审核视角静态自查：事件处理函数、页面跳转、遗留字样。
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', 'miniprogram')
const app = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8'))
const issues = []

for (const page of app.pages) {
  const wxmlPath = path.join(ROOT, page + '.wxml')
  const jsPath = path.join(ROOT, page + '.js')
  const wxml = fs.readFileSync(wxmlPath, 'utf8')
  const js = fs.readFileSync(jsPath, 'utf8')

  const handlers = new Set()
  const handlerRe = /(?:bind|catch)[a-z]+="([A-Za-z0-9_]+)"/g
  let match
  while ((match = handlerRe.exec(wxml))) handlers.add(match[1])

  for (const handler of handlers) {
    const definition = new RegExp(handler + '\\s*\\(')
    if (!definition.test(js)) {
      issues.push(page + ': 缺少事件处理函数 ' + handler)
    }
  }

  const urlRe = /url="\/(pages\/[^"?]+)/g
  while ((match = urlRe.exec(wxml))) {
    const target = match[1]
    if (!app.pages.includes(target)) {
      issues.push(page + ': 跳转到未注册页面 ' + target)
    }
  }
}

const banned = ['体验版', '自用', '测试版', 'TODO']
for (const page of app.pages) {
  const wxml = fs.readFileSync(path.join(ROOT, page + '.wxml'), 'utf8')
  for (const word of banned) {
    if (wxml.includes(word)) issues.push(page + ': 页面含遗留字样 ' + word)
  }
}

if (issues.length) {
  console.log(issues.join('\n'))
  process.exitCode = 1
} else {
  console.log('审计通过：事件处理函数、页面跳转、页面字样均正常')
}

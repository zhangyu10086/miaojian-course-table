// 离线生成学校名称的全拼与拼音首字母，写入 aliases。
// 用法：
//   node scripts/build-school-aliases.js            # 重建 docs 下的种子文件
//   node scripts/build-school-aliases.js 武昌工学院  # 只打印某所学校的别名
const fs = require('fs')
const path = require('path')
const { pinyin } = require('pinyin-pro')

const FILES = [
  path.join(__dirname, '..', 'docs', 'schools-seed.json'),
  path.join(__dirname, '..', 'docs', 'schools-batch.json')
]

function aliasesOf(name) {
  const full = pinyin(name, { toneType: 'none', type: 'array' }).join('')
  const initials = pinyin(name, {
    pattern: 'first',
    toneType: 'none',
    type: 'array'
  }).join('')
  return [full, initials].filter(Boolean).map((item) => item.toLowerCase())
}

function buildAliases(name, existing) {
  const merged = (existing || []).concat(aliasesOf(name))
  return [...new Set(merged.map((item) => String(item).toLowerCase()).filter(Boolean))]
}

function rebuildFile(file) {
  if (!fs.existsSync(file)) return 0
  const lines = fs
    .readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let changed = 0
  const next = lines.map((line) => {
    const school = JSON.parse(line)
    const aliases = buildAliases(school.name, school.aliases)
    if (JSON.stringify(aliases) !== JSON.stringify(school.aliases || [])) changed += 1
    school.aliases = aliases
    return JSON.stringify(school)
  })

  fs.writeFileSync(file, next.join('\n') + '\n')
  console.log(path.basename(file) + ': ' + next.length + ' 条，更新 ' + changed + ' 条')
  return next.length
}

const nameArg = process.argv.slice(2).join(' ').trim()
if (nameArg) {
  console.log(JSON.stringify(aliasesOf(nameArg)))
} else {
  FILES.forEach(rebuildFile)
}

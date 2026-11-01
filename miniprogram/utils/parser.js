// 周次解析参考 shiguang_warehouse（MIT），详见 THIRD_PARTY_NOTICES.md。
const { PALETTE } = require('./constants')

function clean(value) {
  return String(value == null ? '' : value)
    .replace(/[●★○]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizePunctuation(value) {
  return String(value == null ? '' : value)
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/，/g, ',')
    .replace(/、/g, ',')
    .replace(/；/g, ';')
    .replace(/[–—]/g, '-')
}

/**
 * 解析正方 zcd 字段，例如：
 * "1-16周"、"1-16周(单)"、"1-8,10-16周"、"1-4,6-8周(双)"
 */
function parseWeeks(raw) {
  const text = normalizePunctuation(raw).replace(/第/g, '').replace(/周/g, '')
  if (!text) return []

  const weeks = new Set()
  text.split(/[,;]/).forEach((segment) => {
    const regex = /(\d+)\s*(?:-\s*(\d+))?\s*(?:\(([单双])\))?/g
    let match
    while ((match = regex.exec(segment)) !== null) {
      const start = Number(match[1])
      const end = match[2] ? Number(match[2]) : start
      const parity = match[3] || ''
      if (!start || !end || start > end) continue
      for (let week = start; week <= end; week += 1) {
        if (parity === '单' && week % 2 === 0) continue
        if (parity === '双' && week % 2 === 1) continue
        weeks.add(week)
      }
    }
  })

  return Array.from(weeks).sort((a, b) => a - b)
}

/**
 * 解析节次字段，例如 "1-2节"、"3-5节"、"1,2,5-6节"
 * 返回 [[start, end], ...]，相邻区间会合并。
 */
function parseSectionRanges(raw) {
  const text = normalizePunctuation(raw).replace(/节/g, '')
  if (!text) return []

  const ranges = []
  text.split(',').forEach((segment) => {
    const rangeMatch = segment.match(/(\d+)\s*-\s*(\d+)/)
    const singleMatch = segment.match(/(\d+)/)
    if (rangeMatch) {
      let start = Number(rangeMatch[1])
      let end = Number(rangeMatch[2])
      if (!start || !end) return
      if (start > end) {
        const temp = start
        start = end
        end = temp
      }
      ranges.push([start, end])
    } else if (singleMatch) {
      const value = Number(singleMatch[1])
      if (value) ranges.push([value, value])
    }
  })

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1])
  const merged = []
  ranges.forEach((range) => {
    const last = merged[merged.length - 1]
    if (last && range[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], range[1])
    } else {
      merged.push([range[0], range[1]])
    }
  })
  return merged
}

function hashString(value) {
  let hash = 0
  const text = String(value || '')
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0
  }
  return hash
}

/**
 * 把正方 kbList 归一化为本应用的 Course 结构。
 * 相同课程、相同节次的多条记录会合并周次。
 */
function parseKbList(kbList, settings) {
  if (!Array.isArray(kbList)) return []
  const totalWeeks = Math.max(1, Number(settings && settings.totalWeeks) || 20)
  const result = new Map()

  kbList.forEach((item) => {
    if (!item) return
    const name = clean(item.kcmc || item.courseName)
    const teacher = clean(item.xm || item.teacher)
    const location = clean(item.cdmc || item.location)
    const day = Number(item.xqj || item.day)
    const weeks = parseWeeks(item.zcd || item.weeks).filter(
      (week) => week >= 1 && week <= totalWeeks
    )
    const ranges = parseSectionRanges(item.jcs || item.jc || item.sections)

    if (!name || !day || day < 1 || day > 7 || !weeks.length || !ranges.length) return

    ranges.forEach((range) => {
      const key = [name, teacher, location, day, range[0], range[1]].join('|')
      const existing = result.get(key)
      if (existing) {
        const mergedWeeks = new Set(existing.weeks.concat(weeks))
        existing.weeks = Array.from(mergedWeeks).sort((a, b) => a - b)
        return
      }
      result.set(key, {
        name,
        teacher,
        location,
        day,
        startSection: range[0],
        endSection: range[1],
        weeks: weeks.slice(),
        colorIndex: hashString(name) % PALETTE.length,
        remark: '',
        credit: 0,
        source: 'sync'
      })
    })
  })

  return Array.from(result.values()).sort(
    (a, b) => a.day - b.day || a.startSection - b.startSection
  )
}

module.exports = {
  clean,
  normalizePunctuation,
  parseWeeks,
  parseSectionRanges,
  hashString,
  parseKbList
}

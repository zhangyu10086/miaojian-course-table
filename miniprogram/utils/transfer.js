// 课表数据转换：JSON / CSV / ICS。
// 纯函数，不依赖 wx，便于单元测试。
const dateUtil = require('./date')

const CSV_HEADER = [
  '课程名',
  '教师',
  '地点',
  '星期',
  '开始节次',
  '结束节次',
  '周次',
  '颜色序号',
  '备注',
  '学分'
]

const HEADER_MAP = {
  课程名: 'name',
  课程名称: 'name',
  name: 'name',
  教师: 'teacher',
  老师: 'teacher',
  teacher: 'teacher',
  地点: 'location',
  教室: 'location',
  location: 'location',
  星期: 'day',
  周几: 'day',
  day: 'day',
  开始节次: 'startSection',
  起始节次: 'startSection',
  startSection: 'startSection',
  结束节次: 'endSection',
  endSection: 'endSection',
  周次: 'weeks',
  上课周次: 'weeks',
  weeks: 'weeks',
  颜色序号: 'colorIndex',
  颜色: 'colorIndex',
  colorIndex: 'colorIndex',
  备注: 'remark',
  remark: 'remark',
  学分: 'credit',
  credit: 'credit'
}

function pad2(value) {
  return value < 10 ? '0' + value : String(value)
}

function normalizeWeeks(weeks) {
  const list = (Array.isArray(weeks) ? weeks : [])
    .map((week) => Number(week))
    .filter((week) => Number.isInteger(week) && week > 0)
  return [...new Set(list)].sort((a, b) => a - b)
}

function formatWeeks(weeks) {
  const list = normalizeWeeks(weeks)
  const groups = []
  list.forEach((week) => {
    const last = groups[groups.length - 1]
    if (last && week === last[1] + 1) {
      last[1] = week
    } else {
      groups.push([week, week])
    }
  })
  return groups
    .map((group) => (group[0] === group[1] ? String(group[0]) : group[0] + '-' + group[1]))
    .join('|')
}

function parseWeeksText(text) {
  const source = String(text || '').replace(/周/g, '')
  const weeks = []
  source.split(/[|,，、;；\s]+/).forEach((part) => {
    const value = part.trim()
    if (!value) return
    const range = value.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      for (let week = start; week <= end; week += 1) weeks.push(week)
      return
    }
    if (/^\d+$/.test(value)) weeks.push(Number(value))
  })
  return normalizeWeeks(weeks)
}

function parseDay(value) {
  const text = String(value || '').trim()
  if (/^\d+$/.test(text)) {
    const day = Number(text)
    return day >= 1 && day <= 7 ? day : 1
  }
  const names = ['一', '二', '三', '四', '五', '六', '日']
  const index = names.findIndex((name) => text.indexOf(name) >= 0)
  return index >= 0 ? index + 1 : 1
}

function normalizeCourse(item) {
  const name = String((item && item.name) || '').trim()
  if (!name) return null

  const startSection = Math.max(1, Number(item.startSection) || 1)
  const endSection = Math.max(startSection, Number(item.endSection) || startSection)

  return {
    id: String(item.id || ''),
    name,
    teacher: String(item.teacher || '').trim(),
    location: String(item.location || '').trim(),
    day: parseDay(item.day),
    startSection,
    endSection,
    weeks: Array.isArray(item.weeks)
      ? normalizeWeeks(item.weeks)
      : parseWeeksText(item.weeks),
    colorIndex: Math.abs(Number(item.colorIndex) || 0),
    remark: String(item.remark || '').trim(),
    credit: Number(item.credit) || 0,
    source: item.source === 'sync' ? 'sync' : 'manual',
    updatedAt: Number(item.updatedAt) || Date.now()
  }
}

function normalizeCourses(list) {
  return (Array.isArray(list) ? list : [])
    .map(normalizeCourse)
    .filter(Boolean)
}

function buildPayload(courses, settings) {
  return {
    version: 1,
    exportedAt: Date.now(),
    settings: settings || null,
    courses: normalizeCourses(courses)
  }
}

function toJson(courses, settings) {
  return JSON.stringify(buildPayload(courses, settings), null, 2)
}

function parseJson(text) {
  let data = null
  try {
    data = JSON.parse(String(text || '').replace(/^﻿/, ''))
  } catch (err) {
    throw new Error('不是有效的 JSON 文件')
  }
  if (!data || !Array.isArray(data.courses)) {
    throw new Error('JSON 里没有 courses 数组')
  }
  const courses = normalizeCourses(data.courses)
  if (!courses.length) throw new Error('JSON 里没有可识别的课程')
  return { courses, settings: data.settings || null }
}

function csvCell(value) {
  const text = String(value === undefined || value === null ? '' : value)
  if (/[",\r\n]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"'
  }
  return text
}

function toCsv(courses) {
  const lines = [CSV_HEADER.join(',')]
  normalizeCourses(courses).forEach((course) => {
    lines.push(
      [
        course.name,
        course.teacher,
        course.location,
        course.day,
        course.startSection,
        course.endSection,
        formatWeeks(course.weeks),
        course.colorIndex,
        course.remark,
        course.credit
      ]
        .map(csvCell)
        .join(',')
    )
  })
  return lines.join('\r\n') + '\r\n'
}

function parseCsvRows(text) {
  const source = String(text || '').replace(/^﻿/, '')
  const rows = []
  let row = []
  let cell = ''
  let quoted = false

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        cell += char
      }
      continue
    }

    if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else if (char !== '\r') {
      cell += char
    }
  }

  if (cell || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((item) => item.some((value) => String(value).trim() !== ''))
}

function parseCsv(text) {
  const rows = parseCsvRows(text)
  if (rows.length < 2) throw new Error('CSV 没有数据行')

  const header = rows[0].map((value) => String(value).trim())
  const columns = header.map((value) => HEADER_MAP[value] || '')
  if (columns.indexOf('name') < 0) {
    throw new Error('CSV 缺少「课程名」列')
  }

  const courses = []
  for (let index = 1; index < rows.length; index += 1) {
    const row = rows[index]
    const item = {}
    columns.forEach((key, columnIndex) => {
      if (key) item[key] = row[columnIndex]
    })
    const course = normalizeCourse(item)
    if (course) courses.push(course)
  }

  if (!courses.length) throw new Error('CSV 里没有可识别的课程')
  return { courses, settings: null }
}

function icsEscape(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function icsUnescape(text) {
  return String(text || '')
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
}

function foldLine(line) {
  const text = String(line)
  if (text.length <= 75) return text
  const parts = []
  let index = 0
  while (index < text.length) {
    const size = index === 0 ? 75 : 74
    parts.push((index === 0 ? '' : ' ') + text.slice(index, index + size))
    index += size
  }
  return parts.join('\r\n')
}

function icsStamp(date) {
  return (
    date.getFullYear() +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    'T' +
    pad2(date.getHours()) +
    pad2(date.getMinutes()) +
    pad2(date.getSeconds())
  )
}

function icsUtcStamp(date) {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function unfoldIcs(text) {
  return String(text || '').replace(/^﻿/, '').replace(/\r?\n[ \t]/g, '')
}

function toIcs(courses, settings) {
  if (!settings || !settings.semesterStartDate) {
    throw new Error('请先在「学期与节次设置」里填写第 1 周开始日期')
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MiaoJian Course Table//CN',
    'CALSCALE:GREGORIAN',
    'X-MIAOJIAN-SETTINGS:' + icsEscape(JSON.stringify(settings))
  ]

  const totalWeeks = Math.max(1, Number(settings.totalWeeks) || 20)
  normalizeCourses(courses).forEach((course) => {
    const weeks = course.weeks.length
      ? course.weeks.filter((week) => week <= totalWeeks)
      : []
    const range = dateUtil.getCourseTimeRange(course, settings)
    if (!range.startTime || !range.endTime) return

    weeks.forEach((week) => {
      const date = dateUtil.getOccurrenceDate(settings, course, week)
      if (!date) return

      const start = dateUtil.dateAtTime(date, range.startTime)
      const end = dateUtil.dateAtTime(date, range.endTime)
      const uid = (course.id || 'course') + '-' + week + '@miaojian'
      const description =
        '教师：' +
        (course.teacher || '未填写') +
        ' 周次：第 ' +
        week +
        ' 周'

      lines.push(
        'BEGIN:VEVENT',
        'UID:' + icsEscape(uid),
        'DTSTAMP:' + icsUtcStamp(new Date()),
        'DTSTART:' + icsStamp(start),
        'DTEND:' + icsStamp(end),
        'SUMMARY:' + icsEscape(course.name),
        'LOCATION:' + icsEscape(course.location),
        'DESCRIPTION:' + icsEscape(description),
        'X-MIAOJIAN-COURSE:' + icsEscape(JSON.stringify(course)),
        'END:VEVENT'
      )
    })
  })

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

function parseIcsTime(value) {
  const match = String(value || '').match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/)
  if (!match) return null
  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6])
  )
}

function courseKey(course) {
  return [
    course.name,
    course.day,
    course.startSection,
    course.endSection
  ].join('|')
}

function parseIcs(text, settings) {
  const lines = unfoldIcs(text).split(/\r?\n/)
  let event = null
  let icsSettings = null
  const customCourses = []
  const fallbackCourses = []

  lines.forEach((line) => {
    if (line.indexOf('X-MIAOJIAN-SETTINGS:') === 0) {
      try {
        icsSettings = JSON.parse(
          icsUnescape(line.slice('X-MIAOJIAN-SETTINGS:'.length))
        )
      } catch (err) {
        icsSettings = null
      }
      return
    }

    if (line === 'BEGIN:VEVENT') {
      event = {}
      return
    }
    if (line === 'END:VEVENT') {
      if (event) {
        const custom = event['X-MIAOJIAN-COURSE']
        if (custom) {
          try {
            const course = normalizeCourse(
              JSON.parse(icsUnescape(custom))
            )
            if (course) customCourses.push(course)
          } catch (err) {
            // 忽略损坏的自定义字段，尝试普通字段
          }
        } else if (settings) {
          const start = parseIcsTime(event.DTSTART)
          const end = parseIcsTime(event.DTEND)
          if (start) {
            const weekInfo = dateUtil.getWeekNumber(settings, start)
            const startTime =
              pad2(start.getHours()) + ':' + pad2(start.getMinutes())
            const endTime = end
              ? pad2(end.getHours()) + ':' + pad2(end.getMinutes())
              : ''

            let startSection = 0
            let endSection = 0
            ;(settings.sections || []).forEach((section) => {
              if (section.startTime === startTime) startSection = section.number
              if (endTime && section.endTime === endTime) {
                endSection = section.number
              }
            })

            if (weekInfo.week && startSection) {
              const course = normalizeCourse({
                name: icsUnescape(event.SUMMARY || ''),
                location: icsUnescape(event.LOCATION || ''),
                day: ((start.getDay() + 6) % 7) + 1,
                startSection,
                endSection: endSection || startSection,
                weeks: [weekInfo.week]
              })
              if (course) fallbackCourses.push(course)
            }
          }
        }
      }
      event = null
      return
    }

    if (event) {
      const separator = line.indexOf(':')
      if (separator > 0) {
        const key = line.slice(0, separator).split(';')[0]
        event[key] = line.slice(separator + 1)
      }
    }
  })

  let courses = []
  if (customCourses.length) {
    const unique = new Map()
    customCourses.forEach((course) => {
      const key = course.id || courseKey(course)
      if (!unique.has(key)) unique.set(key, course)
    })
    courses = [...unique.values()]
  } else {
    courses = fallbackCourses
  }

  // 合并同名同节次的多次事件（普通 ICS 每天一条的情况）
  if (!customCourses.length && courses.length) {
    const merged = new Map()
    courses.forEach((course) => {
      const key = courseKey(course)
      const existing = merged.get(key)
      if (existing) {
        existing.weeks = normalizeWeeks(existing.weeks.concat(course.weeks))
      } else {
        merged.set(key, course)
      }
    })
    courses = [...merged.values()]
  }

  if (!courses.length) {
    throw new Error('没有从 ICS 里解析到课程')
  }

  return {
    courses: normalizeCourses(courses),
    settings: icsSettings
  }
}

module.exports = {
  CSV_HEADER,
  normalizeWeeks,
  formatWeeks,
  parseWeeksText,
  parseDay,
  normalizeCourse,
  normalizeCourses,
  buildPayload,
  toJson,
  parseJson,
  toCsv,
  parseCsv,
  toIcs,
  parseIcs
}

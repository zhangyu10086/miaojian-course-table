// 考试安排：本地存储 + 解析 + 排序。
// 数据只存在手机上，不上传服务器。
const KEY_EXAMS = 'ct_exams_v1'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function read() {
  try {
    const value = wx.getStorageSync(KEY_EXAMS)
    return Array.isArray(value) ? value : []
  } catch (err) {
    console.warn('读取考试数据失败', err)
    return []
  }
}

function write(list) {
  try {
    wx.setStorageSync(KEY_EXAMS, Array.isArray(list) ? list : [])
    return true
  } catch (err) {
    console.warn('保存考试数据失败', err)
    return false
  }
}

function genId() {
  return 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function pad2(value) {
  return value < 10 ? '0' + value : String(value)
}

// 解析教务返回的时间，例如：
// "2026-11-18(14:00-15:30)"、"2026-11-18 14:00-15:30"、"2026-11-18"
function parseExamTime(raw) {
  const text = String(raw || '').trim()
  if (!text) return { date: '', startTime: '', endTime: '' }

  const dateMatch = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!dateMatch) return { date: '', startTime: '', endTime: '' }

  const date =
    dateMatch[1] +
    '-' +
    pad2(Number(dateMatch[2])) +
    '-' +
    pad2(Number(dateMatch[3]))

  const timeMatch = text.match(/(\d{1,2}:\d{2})\s*[-~～至]\s*(\d{1,2}:\d{2})/)
  return {
    date,
    startTime: timeMatch ? timeMatch[1] : '',
    endTime: timeMatch ? timeMatch[2] : ''
  }
}

function teacherFromJsxx(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  const parts = text.split('/')
  return parts[parts.length - 1].trim()
}

function normalizeExam(raw) {
  const item = raw || {}
  const name = String(item.name || item.kcmc || '').trim()
  const time = item.date
    ? { date: item.date, startTime: item.startTime || '', endTime: item.endTime || '' }
    : parseExamTime(item.kssj || item.time || '')

  return {
    id: String(item.id || ''),
    name,
    title: String(item.title || item.ksmc || '').trim(),
    date: time.date,
    startTime: time.startTime,
    endTime: time.endTime,
    location: String(item.location || item.cdmc || '').trim(),
    campus: String(item.campus || item.cdxqmc || '').trim(),
    mode: String(item.mode || item.khfs || '').trim(),
    credit: Number(item.credit || item.xf) || 0,
    teacher: String(item.teacher || '').trim() || teacherFromJsxx(item.jsxx),
    remark: String(item.remark || '').trim(),
    source: item.source === 'sync' ? 'sync' : 'manual',
    updatedAt: Number(item.updatedAt) || Date.now()
  }
}

function getExams() {
  return read()
    .filter((item) => item && (item.name || item.kcmc))
    .map(normalizeExam)
}

function saveExams(list) {
  const next = (Array.isArray(list) ? list : [])
    .filter((item) => item && item.name)
    .map(normalizeExam)
  write(next)
  return next
}

function upsertExam(exam) {
  const list = getExams()
  const item = normalizeExam(exam)
  const index = list.findIndex((current) => current.id && current.id === item.id)
  if (index >= 0) {
    list[index] = Object.assign({}, list[index], item, { updatedAt: Date.now() })
  } else {
    list.push(
      Object.assign({}, item, {
        id: item.id || genId(),
        updatedAt: Date.now()
      })
    )
  }
  return saveExams(list)
}

function deleteExam(id) {
  const key = String(id || '')
  return saveExams(getExams().filter((item) => item.id !== key))
}

function examKey(item) {
  return [item.name, item.date, item.startTime].join('|')
}

// 重新导入时：替换教务来源的考试，保留手动添加的。
function replaceSyncedExams(incoming) {
  const manual = getExams().filter((item) => item.source !== 'sync')
  const manualKeys = new Set(manual.map(examKey))
  const synced = (incoming || [])
    .map(normalizeExam)
    .filter((item) => item.name && !manualKeys.has(examKey(item)))
    .map((item) =>
      Object.assign({}, item, {
        id: genId(),
        source: 'sync',
        updatedAt: Date.now()
      })
    )
  return saveExams(manual.concat(synced))
}

function dateTimeOf(item) {
  const date = String(item.date || '')
  if (!date) return Number.MAX_SAFE_INTEGER
  const time = item.startTime || '00:00'
  return new Date(date + 'T' + time + ':00').getTime()
}

// 按考试开始时间正序；没有日期的排在最后。
function sortExams(list) {
  return (list || []).slice().sort((a, b) => dateTimeOf(a) - dateTimeOf(b))
}

function isPast(item, now) {
  const start = dateTimeOf(item)
  if (start === Number.MAX_SAFE_INTEGER) return false
  const end = item.endTime
    ? new Date(item.date + 'T' + item.endTime + ':00').getTime()
    : start + 60 * 60 * 1000
  return end < (Number(now) || Date.now())
}

function splitExams(list, now) {
  const upcoming = []
  const past = []
  sortExams(list).forEach((item) => {
    if (isPast(item, now)) past.push(item)
    else upcoming.push(item)
  })
  return { upcoming, past }
}

function startOfDay(date) {
  const next = new Date(date.getTime())
  next.setHours(0, 0, 0, 0)
  return next
}

// 距离考试还有几天：今天考返回 0，明天返回 1，已过返回负数
function daysUntil(item, now) {
  if (!item || !item.date) return null
  const target = new Date(item.date + 'T00:00:00')
  if (Number.isNaN(target.getTime())) return null
  const base = startOfDay(new Date(Number(now) || Date.now()))
  return Math.round((target.getTime() - base.getTime()) / 86400000)
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function formatExamDate(item) {
  if (!item || !item.date) return '时间待定'
  const date = new Date(item.date + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return item.date
  return date.getMonth() + 1 + '月' + date.getDate() + '日 ' + WEEKDAYS[date.getDay()]
}

function formatTimeRange(item) {
  if (!item || !item.startTime) return '时间待定'
  if (!item.endTime) return item.startTime
  return item.startTime + '-' + item.endTime
}

// 下一场未考的考试；超出 maxDays 天则返回 null
function nextExam(list, now, maxDays) {
  const current = Number(now) || Date.now()
  const limit = Number(maxDays) || 0
  const candidate = sortExams(list).find((item) => {
    if (!item.date || isPast(item, current)) return false
    if (!limit) return true
    const days = daysUntil(item, current)
    return days !== null && days <= limit
  })
  return candidate || null
}

module.exports = {
  genId,
  parseExamTime,
  normalizeExam,
  getExams,
  saveExams,
  upsertExam,
  deleteExam,
  replaceSyncedExams,
  sortExams,
  splitExams,
  isPast,
  daysUntil,
  formatExamDate,
  formatTimeRange,
  nextExam
}

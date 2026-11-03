const { WEEKDAYS } = require('./constants')

function pad2(value) {
  return value < 10 ? '0' + value : String(value)
}

function parseDate(value) {
  if (!value || typeof value !== 'string') return null
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (
    date.getFullYear() !== Number(match[1]) ||
    date.getMonth() !== Number(match[2]) - 1 ||
    date.getDate() !== Number(match[3])
  ) {
    return null
  }
  return date
}

function formatDate(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
}

function formatShortDate(date) {
  return pad2(date.getMonth() + 1) + '-' + pad2(date.getDate())
}

function startOfDay(date) {
  const next = new Date(date.getTime())
  next.setHours(0, 0, 0, 0)
  return next
}

function addDays(date, days) {
  const next = new Date(date.getTime())
  next.setDate(next.getDate() + days)
  return next
}

function startOfWeek(date, firstDayOfWeek) {
  const base = startOfDay(date)
  const first = Number(firstDayOfWeek) === 7 ? 7 : 1
  const weekday = base.getDay()
  const offset = first === 7 ? weekday : (weekday + 6) % 7
  return addDays(base, -offset)
}

function daysBetween(a, b) {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000)
}

function getWeekNumber(settings, date) {
  const totalWeeks = Number(settings.totalWeeks) || 20
  const firstDay = Number(settings.firstDayOfWeek) === 7 ? 7 : 1
  const semesterStart = parseDate(settings.semesterStartDate)
  if (!semesterStart) {
    return { week: null, rawWeek: null, before: false, after: false }
  }
  const weekOneStart = startOfWeek(semesterStart, firstDay)
  const currentStart = startOfWeek(date || new Date(), firstDay)
  const rawWeek = Math.round(daysBetween(weekOneStart, currentStart) / 7) + 1
  return {
    week: Math.max(1, Math.min(totalWeeks, rawWeek)),
    rawWeek,
    before: rawWeek < 1,
    after: rawWeek > totalWeeks
  }
}

function getWeekDates(settings, weekNumber) {
  const firstDay = Number(settings.firstDayOfWeek) === 7 ? 7 : 1
  const semesterStart = parseDate(settings.semesterStartDate)
  const base = semesterStart
    ? startOfWeek(semesterStart, firstDay)
    : startOfWeek(new Date(), firstDay)
  const weekStart = addDays(base, (Math.max(1, weekNumber) - 1) * 7)
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

function dayNumberForDisplayIndex(firstDayOfWeek, index) {
  const first = Number(firstDayOfWeek) === 7 ? 7 : 1
  return ((first - 1 + index) % 7) + 1
}

function isSameDay(a, b) {
  return (
    a &&
    b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function getDisplayDays(settings, weekNumber, now) {
  const dates = getWeekDates(settings, weekNumber)
  const today = now || new Date()
  const days = dates.map((date, index) => {
    const day = dayNumberForDisplayIndex(settings.firstDayOfWeek, index)
    return {
      day,
      label: WEEKDAYS[day - 1],
      date,
      dateLabel: formatShortDate(date),
      isToday: isSameDay(date, today)
    }
  })
  return settings.showWeekends ? days : days.filter((item) => item.day <= 5)
}

function todayDayNumber(date) {
  const weekday = (date || new Date()).getDay()
  return weekday === 0 ? 7 : weekday
}

function formatWeekRange(settings, weekNumber) {
  const days = getDisplayDays(settings, weekNumber)
  if (!days.length) return ''
  return formatShortDate(days[0].date) + ' — ' + formatShortDate(days[days.length - 1].date)
}

function weekStartDate(settings, weekNumber) {
  return getWeekDates(settings, weekNumber)[0]
}

// 周次日期用斜杠分隔，例如 09/07（区别于 formatShortDate 的横杠格式）
function weekStartLabel(settings, weekNumber) {
  const date = weekStartDate(settings, weekNumber)
  return pad2(date.getMonth() + 1) + '/' + pad2(date.getDate())
}

// 每个周次格子第二行显示的日期，例如 [{ week: 1, label: '09/07' }]
function weekDateLabels(settings, totalWeeks) {
  const count = Math.max(1, Number(totalWeeks) || 20)
  return Array.from({ length: count }, (_, index) => ({
    week: index + 1,
    label: weekStartLabel(settings, index + 1)
  }))
}

// 日期选择器的可选范围；没有开学日期时返回 null，调用方据此禁用选择器
function semesterDateRange(settings) {
  if (!parseDate(settings.semesterStartDate)) return null
  const totalWeeks = Math.max(1, Number(settings.totalWeeks) || 20)
  const start = weekStartDate(settings, 1)
  const end = addDays(start, totalWeeks * 7 - 1)
  return { start: formatDate(start), end: formatDate(end) }
}

function timeToMinutes(time) {
  const match = String(time || '').match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return 0
  return Number(match[1]) * 60 + Number(match[2])
}

function minutesToTime(minutes) {
  const total = (((Number(minutes) || 0) % 1440) + 1440) % 1440
  return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60)
}

function nowMinutes(date) {
  const current = date || new Date()
  return current.getHours() * 60 + current.getMinutes()
}

function getSection(settings, number) {
  return (settings.sections || []).find((item) => Number(item.number) === Number(number))
}

function getCourseTimeRange(course, settings) {
  const start = getSection(settings, course.startSection)
  const end = getSection(settings, course.endSection)
  return {
    startTime: start ? start.startTime : '',
    endTime: end ? end.endTime : '',
    startMinutes: start ? timeToMinutes(start.startTime) : 0,
    endMinutes: end ? timeToMinutes(end.endTime) : 0
  }
}

function getOccurrenceDate(settings, course, weekNumber) {
  const firstDay = Number(settings.firstDayOfWeek) === 7 ? 7 : 1
  const semesterStart = parseDate(settings.semesterStartDate)
  if (!semesterStart) return null
  const weekOneStart = startOfWeek(semesterStart, firstDay)
  const offset = (Number(course.day) - firstDay + 7) % 7
  return addDays(weekOneStart, (Math.max(1, weekNumber) - 1) * 7 + offset)
}

function dateAtTime(date, time) {
  const minutes = timeToMinutes(time)
  const next = new Date(date.getTime())
  next.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return next
}

function formatCountdown(minutes) {
  if (minutes <= 0) return '即将开始'
  if (minutes < 60) return '还有 ' + minutes + ' 分钟'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return '还有 ' + hours + ' 小时' + (rest ? ' ' + rest + ' 分钟' : '')
}

module.exports = {
  pad2,
  parseDate,
  formatDate,
  formatShortDate,
  startOfDay,
  addDays,
  startOfWeek,
  daysBetween,
  getWeekNumber,
  getWeekDates,
  weekStartDate,
  weekStartLabel,
  weekDateLabels,
  semesterDateRange,
  getDisplayDays,
  todayDayNumber,
  formatWeekRange,
  timeToMinutes,
  minutesToTime,
  nowMinutes,
  getSection,
  getCourseTimeRange,
  getOccurrenceDate,
  dateAtTime,
  formatCountdown
}

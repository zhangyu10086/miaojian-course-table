const { DEFAULT_SETTINGS, DEFAULT_SECTIONS } = require('./constants')

const KEY_COURSES = 'ct_courses_v1'
const KEY_SETTINGS = 'ct_settings_v1'
const KEY_AUTH = 'ct_auth_v1'
const KEY_RECENT_SCHOOLS = 'ct_recent_schools_v1'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function read(key, fallback) {
  try {
    const value = wx.getStorageSync(key)
    return value === '' || value === undefined || value === null ? fallback : value
  } catch (err) {
    console.warn('读取本地数据失败', key, err)
    return fallback
  }
}

function write(key, value) {
  try {
    wx.setStorageSync(key, value)
    return true
  } catch (err) {
    console.warn('写入本地数据失败', key, err)
    return false
  }
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function normalizeSections(sections) {
  if (!Array.isArray(sections) || !sections.length) {
    return clone(DEFAULT_SECTIONS)
  }
  return sections
    .map((item, index) => ({
      number: index + 1,
      startTime: item.startTime || '08:00',
      endTime: item.endTime || '08:45'
    }))
    .filter((item) => /^\d{2}:\d{2}$/.test(item.startTime) && /^\d{2}:\d{2}$/.test(item.endTime))
}

function getSettings() {
  const saved = read(KEY_SETTINGS, {})
  const settings = Object.assign({}, clone(DEFAULT_SETTINGS), saved)
  settings.sections = normalizeSections(saved.sections)
  settings.term = Object.assign({ xnm: '', xqm: '3' }, saved.term || {})
  settings.totalWeeks = Math.max(1, Number(settings.totalWeeks) || 20)
  settings.firstDayOfWeek = Number(settings.firstDayOfWeek) === 7 ? 7 : 1
  settings.showWeekends = !!settings.showWeekends
  settings.defaultTab = settings.defaultTab === 'today' ? 'today' : 'schedule'
  return settings
}

function saveSettings(patch) {
  const next = Object.assign({}, getSettings(), patch || {})
  if (patch && patch.term) {
    next.term = Object.assign({}, getSettings().term, patch.term)
  }
  write(KEY_SETTINGS, next)
  return next
}

function getCourses() {
  const list = read(KEY_COURSES, [])
  if (!Array.isArray(list)) return []
  return list
    .filter((item) => item && item.name)
    .map((item) => ({
      id: item.id || genId(),
      name: String(item.name || ''),
      teacher: String(item.teacher || ''),
      location: String(item.location || ''),
      day: Number(item.day) || 1,
      startSection: Number(item.startSection) || 1,
      endSection: Number(item.endSection) || Number(item.startSection) || 1,
      weeks: Array.isArray(item.weeks) ? item.weeks.map(Number).filter((n) => n > 0) : [],
      colorIndex: Number(item.colorIndex) || 0,
      remark: String(item.remark || ''),
      credit: Number(item.credit) || 0,
      source: item.source === 'sync' ? 'sync' : 'manual',
      updatedAt: Number(item.updatedAt) || Date.now()
    }))
}

function saveCourses(courses) {
  return write(KEY_COURSES, Array.isArray(courses) ? courses : [])
}

function upsertCourse(course) {
  const list = getCourses()
  const index = list.findIndex((item) => item.id === course.id)
  if (index >= 0) {
    list[index] = Object.assign({}, list[index], course, { updatedAt: Date.now() })
  } else {
    list.push(Object.assign({ id: genId() }, course, { updatedAt: Date.now() }))
  }
  saveCourses(list)
  return list
}

function deleteCourse(id) {
  const list = getCourses().filter((item) => item.id !== id)
  saveCourses(list)
  return list
}

function courseKey(item) {
  return [item.name, item.day, item.startSection, item.endSection].join('|')
}

function replaceSyncedCourses(incoming) {
  const manual = getCourses().filter((item) => item.source !== 'sync')
  const manualKeys = new Set(manual.map(courseKey))
  const synced = (incoming || [])
    .filter((item) => !manualKeys.has(courseKey(item)))
    .map((item) =>
      Object.assign({}, item, {
        id: genId(),
        source: 'sync',
        updatedAt: Date.now()
      })
    )
  const next = manual.concat(synced)
  saveCourses(next)
  return next
}

function clearCourses() {
  saveCourses([])
}

function getAuth() {
  const auth = read(KEY_AUTH, {})
  return {
    baseUrl: auth.baseUrl || '',
    username: auth.username || '',
    password: auth.password || '',
    remember: !!auth.remember,
    xnm: auth.xnm || '',
    xqm: auth.xqm || '3'
  }
}

function saveAuth(auth) {
  write(KEY_AUTH, auth || {})
  return auth
}

function clearAuth() {
  try {
    wx.removeStorageSync(KEY_AUTH)
  } catch (err) {
    console.warn('清除登录信息失败', err)
  }
}

function getRecentSchools() {
  const list = read(KEY_RECENT_SCHOOLS, [])
  if (!Array.isArray(list)) return []
  return list
    .filter((item) => item && item.name && item.baseUrl)
    .slice(0, 5)
}

// 最近使用最多保留 5 条，同一域名只保留一条。
function addRecentSchool(school) {
  if (!school || !school.baseUrl) return getRecentSchools()
  const baseUrl = String(school.baseUrl || '').trim()
  const list = getRecentSchools().filter(
    (item) => String(item.baseUrl || '').toLowerCase() !== baseUrl.toLowerCase()
  )
  list.unshift({
    id: school.id || '',
    name: school.name || baseUrl,
    baseUrl,
    system: school.system || 'zfn_v2',
    selectedAt: Date.now()
  })
  const next = list.slice(0, 5)
  write(KEY_RECENT_SCHOOLS, next)
  return next
}

function clearRecentSchools() {
  try {
    wx.removeStorageSync(KEY_RECENT_SCHOOLS)
  } catch (err) {
    console.warn('清除最近学校失败', err)
  }
}

function ensureDefaults() {
  const settings = read(KEY_SETTINGS, null)
  if (!settings) write(KEY_SETTINGS, clone(DEFAULT_SETTINGS))
  const courses = read(KEY_COURSES, null)
  if (!courses) write(KEY_COURSES, [])
}

function getStats() {
  const courses = getCourses()
  const settings = getSettings()
  return {
    courseCount: courses.length,
    manualCount: courses.filter((item) => item.source === 'manual').length,
    syncCount: courses.filter((item) => item.source === 'sync').length,
    totalWeeks: settings.totalWeeks,
    semesterStartDate: settings.semesterStartDate
  }
}

module.exports = {
  genId,
  ensureDefaults,
  getSettings,
  saveSettings,
  getCourses,
  saveCourses,
  upsertCourse,
  deleteCourse,
  replaceSyncedCourses,
  clearCourses,
  getAuth,
  saveAuth,
  clearAuth,
  getRecentSchools,
  addRecentSchool,
  clearRecentSchools,
  getStats
}

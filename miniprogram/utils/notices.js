// 公告：远端从 notices 集合读取，本地缓存列表和已读 id。
const cloud = require('./cloud')
const markdown = require('./markdown')

const CACHE_KEY = 'ct_notices_cache_v1'
const CACHE_AT_KEY = 'ct_notices_cache_at_v1'
const READ_KEY = 'ct_notices_read_v1'
const READ_LIMIT = 300
const CACHE_TTL = 2 * 60 * 1000
const FORCE_MIN_INTERVAL = 10 * 1000

function toTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function pad(number) {
  return number < 10 ? '0' + number : String(number)
}

function formatDate(value) {
  const time = toTime(value)
  if (!time) return ''
  const date = new Date(time)
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate())
}

function formatDateTime(value) {
  const time = toTime(value)
  if (!time) return ''
  const date = new Date(time)
  return (
    formatDate(time) +
    ' ' +
    pad(date.getHours()) +
    ':' +
    pad(date.getMinutes())
  )
}

function formatRelative(value, now) {
  const time = toTime(value)
  if (!time) return ''
  const diff = Math.max(0, (Number(now) || Date.now()) - time)
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return Math.floor(diff / minute) + ' 分钟前'
  if (diff < day) return Math.floor(diff / hour) + ' 小时前'
  if (diff < 2 * day) return '昨天'
  if (diff < 7 * day) return Math.floor(diff / day) + ' 天前'
  return formatDate(time)
}

function normalize(item) {
  const publishedAt = toTime(item.publishedAt)
  const updatedAt = toTime(item.updatedAt) || publishedAt
  return {
    id: String(item.id || item._id || ''),
    title: String(item.title || ''),
    content: String(item.content || ''),
    summary: markdown.stripMarkdown(item.content),
    source: String(item.source || '金枪鱼2026'),
    qqGroup: String(item.qqGroup || ''),
    views: Math.max(0, Number(item.views) || 0),
    pinned: !!item.pinned,
    publishedAt,
    updatedAt,
    dateLabel: formatDate(publishedAt),
    datetimeLabel: formatDateTime(publishedAt),
    updatedDatetimeLabel: formatDateTime(updatedAt),
    relativeLabel: formatRelative(publishedAt),
    hasUpdate: updatedAt > publishedAt + 1000
  }
}

// 置顶优先，其余按发布时间倒序。
function sortNotices(list) {
  return (list || [])
    .map(normalize)
    .filter((item) => item.id && item.title && item.content)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.publishedAt - a.publishedAt
    })
}

function getCache() {
  try {
    const cached = wx.getStorageSync(CACHE_KEY)
    return Array.isArray(cached) ? cached : []
  } catch (err) {
    return []
  }
}

function saveCache(list) {
  try {
    wx.setStorageSync(CACHE_KEY, list)
    wx.setStorageSync(CACHE_AT_KEY, Date.now())
  } catch (err) {
    console.warn('缓存公告失败', err)
  }
}

function cacheAge() {
  try {
    const savedAt = Number(wx.getStorageSync(CACHE_AT_KEY) || 0)
    return savedAt ? Date.now() - savedAt : Infinity
  } catch (err) {
    return Infinity
  }
}

function getReadIds() {
  try {
    const ids = wx.getStorageSync(READ_KEY)
    return Array.isArray(ids) ? ids.filter((id) => typeof id === 'string') : []
  } catch (err) {
    return []
  }
}

function saveReadIds(ids) {
  try {
    wx.setStorageSync(READ_KEY, ids.slice(-READ_LIMIT))
  } catch (err) {
    console.warn('保存已读公告失败', err)
  }
}

function withUnread(list) {
  const read = new Set(getReadIds())
  return (list || []).map((item) =>
    Object.assign({}, item, { unread: !read.has(item.id) })
  )
}

function unreadCount(list) {
  const read = new Set(getReadIds())
  return (list || []).filter((item) => !read.has(item.id)).length
}

function markRead(id) {
  const key = String(id || '')
  if (!key) return
  const read = new Set(getReadIds())
  if (read.has(key)) return
  read.add(key)
  saveReadIds([...read])
}

function markAllRead(list) {
  const read = new Set(getReadIds())
  ;(list || []).forEach((item) => {
    if (item && item.id) read.add(item.id)
  })
  saveReadIds([...read])
}

// 默认 5 分钟内直接用缓存；force 表示用户主动打开公告，最多 30 秒一次请求。
// 拉取失败时退回本地缓存，保证离线也能看到上次的公告。
async function fetchNotices(force) {
  const cached = sortNotices(getCache())
  const age = cacheAge()
  const ttl = force ? FORCE_MIN_INTERVAL : CACHE_TTL
  if (age < ttl) return cached

  try {
    const list = await cloud.callNotices()
    const sorted = sortNotices(list)
    saveCache(sorted)
    return sorted
  } catch (err) {
    return cached
  }
}

async function fetchDetail(id) {
  const notice = await cloud.callNoticeDetail(id)
  return normalize(notice)
}

// 同步返回本地缓存，用于打开页面时先渲染，再后台刷新。
function getCachedNotices() {
  return sortNotices(getCache())
}

module.exports = {
  formatDate,
  formatDateTime,
  formatRelative,
  sortNotices,
  withUnread,
  unreadCount,
  markRead,
  markAllRead,
  fetchNotices,
  fetchDetail,
  getCachedNotices
}

// 学校注册表：优先使用云数据库 schools 集合的结果（本地缓存 24 小时），
// 未配置云开发或拉取失败时回退到内置的 schools.js。
const builtin = require('./schools')
const cloud = require('./cloud')

const KEY_CACHE = 'ct_schools_cache_v1'
const CACHE_TTL = 24 * 60 * 60 * 1000

function normalize(school) {
  const item = Object.assign({}, school)
  if (!item.host) item.host = builtin.hostOf(item.baseUrl)
  if (!Array.isArray(item.aliases)) item.aliases = []
  if (!item.system) item.system = 'zfn_v2'
  return item
}

function readCache() {
  try {
    const cached = wx.getStorageSync(KEY_CACHE)
    if (!cached || !Array.isArray(cached.schools)) return null
    if (Date.now() - Number(cached.savedAt || 0) > CACHE_TTL) return null
    return cached.schools.map(normalize)
  } catch (err) {
    return null
  }
}

function writeCache(schools) {
  try {
    wx.setStorageSync(KEY_CACHE, { savedAt: Date.now(), schools })
  } catch (err) {
    console.warn('缓存学校列表失败', err)
  }
}

function getAll() {
  const cached = readCache()
  if (cached && cached.length) return cached
  return builtin.getAll()
}

// 是否已经拉取过云端列表。
// 没有缓存时学校选择页应先等云端结果，避免先显示内置的少量学校再被替换。
function hasCache() {
  const cached = readCache()
  return !!(cached && cached.length)
}

function filter(list, keyword) {
  const source = Array.isArray(list) ? list : []
  const query = String(keyword || '').trim().toLowerCase()
  if (!query) return source.slice()
  return source.filter((school) => {
    const haystack = [
      school.name,
      school.id,
      school.initial,
      school.baseUrl,
      school.host
    ]
      .concat(school.aliases || [])
      .join(' ')
      .toLowerCase()
    return haystack.indexOf(query) >= 0
  })
}

function findById(list, id) {
  const source = Array.isArray(list) && list.length ? list : getAll()
  return source.find((item) => item.id === id) || builtin.findById(id)
}

function findByBaseUrl(baseUrl) {
  const host = builtin.hostOf(baseUrl)
  if (!host) return null
  return (
    getAll().find((item) => (item.host || builtin.hostOf(item.baseUrl)) === host) ||
    null
  )
}

// 从云数据库刷新；失败时保留现有缓存和内置数据。
async function refresh() {
  try {
    const schools = await cloud.callSchools()
    if (Array.isArray(schools) && schools.length) {
      const normalized = schools.map(normalize)
      writeCache(normalized)
      return normalized
    }
  } catch (err) {
    console.warn('刷新学校列表失败', err && err.message)
  }
  return getAll()
}

module.exports = {
  getAll,
  hasCache,
  filter,
  findById,
  findByBaseUrl,
  refresh,
  hostOf: builtin.hostOf
}

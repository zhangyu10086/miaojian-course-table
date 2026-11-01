// 学校地址与别名的纯函数，单独放一份便于本地单元测试。
function normalizeBaseUrl(input) {
  let text = String(input || '').trim()
  if (text && !/^[a-z]+:\/\//i.test(text)) text = 'https://' + text
  const url = new URL(text)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('教务地址必须以 http:// 或 https:// 开头')
  }
  let pathname = url.pathname.replace(/\/+$/, '')
  const index = pathname.toLowerCase().indexOf('/jwglxt')
  if (index >= 0) {
    pathname = pathname.slice(0, index) + '/jwglxt'
  } else if (!pathname) {
    pathname = '/jwglxt'
  } else if (!pathname.toLowerCase().endsWith('/jwglxt')) {
    pathname = pathname + '/jwglxt'
  }
  return url.origin + pathname
}

function isPrivateHost(host) {
  const text = String(host || '').toLowerCase()
  if (!text || text === 'localhost' || text.endsWith('.local')) return true
  if (text === '::1' || text === '0.0.0.0') return true

  const match = text.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false

  const parts = match.slice(1).map(Number)
  if (parts.some((part) => part > 255)) return true
  if (parts[0] === 0 || parts[0] === 10 || parts[0] === 127) return true
  if (parts[0] === 169 && parts[1] === 254) return true
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true
  if (parts[0] === 192 && parts[1] === 168) return true
  return false
}

function normalizeAliases(input) {
  const list = Array.isArray(input)
    ? input
    : String(input || '').split(/[,，、\s]+/)
  const seen = new Set()
  const result = []
  list.forEach((item) => {
    const alias = String(item || '').trim().toLowerCase()
    if (!alias || alias.length > 30 || seen.has(alias)) return
    seen.add(alias)
    result.push(alias)
  })
  return result.slice(0, 10)
}

function schoolIdFor(host) {
  const text = String(host || '').toLowerCase()
  let hash = 0
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0
  }
  const slug = text
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 24)
  return 'SCH_' + Math.abs(hash).toString(36) + (slug ? '_' + slug : '')
}

module.exports = {
  normalizeBaseUrl,
  isPrivateHost,
  normalizeAliases,
  schoolIdFor
}

// 内置学校索引。
// 字段参考拾光课程表 shiguang_warehouse 的 root_index.yaml（id/name/initial），
// 换成小程序需要的 baseUrl/system，保持结构简单，后续可平移到云数据库。
// system 目前只支持 zfn_v2（新版正方 jwglxt）。
const SCHOOLS = [
  {
    id: 'WUIT',
    name: '武昌工学院',
    initial: 'W',
    aliases: ['wuit', 'wcgxy', 'wuchanggongxueyuan'],
    baseUrl: 'https://jwglxt.wuit.cn',
    system: 'zfn_v2',
    verified: true
  },
  {
    id: 'XJAU',
    name: '新疆农业大学',
    initial: 'X',
    aliases: ['xjau', 'xinjiangnongyedaxue', 'xjnydx'],
    baseUrl: 'https://jwxt.xjau.edu.cn',
    system: 'zfn_v2',
    verified: false
  }
]

// 从任意教务地址里取出主机名：支持带协议、带路径、带端口。
function hostOf(input) {
  const text = String(input || '').trim()
  if (!text) return ''
  const matched = text.match(/^(?:https?:\/\/)?([^/?#]+)/i)
  if (!matched) return ''
  return matched[1]
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/^www\./, '')
}

function withHost(school) {
  return Object.assign({}, school, { host: hostOf(school.baseUrl) })
}

function getAll() {
  return SCHOOLS.map(withHost)
}

// 支持按校名、拼音缩写、学校 id、域名搜索。
function search(keyword) {
  const query = String(keyword || '').trim().toLowerCase()
  if (!query) return getAll()
  return SCHOOLS.filter((school) => {
    const haystack = [school.name, school.id, school.initial, school.baseUrl]
      .concat(school.aliases || [])
      .join(' ')
      .toLowerCase()
    return haystack.indexOf(query) >= 0
  }).map(withHost)
}

function findById(id) {
  const found = SCHOOLS.find((school) => school.id === id)
  return found ? withHost(found) : null
}

// 用户手填的地址可能带 /jwglxt/xtgl/... 路径，按域名匹配即可。
function findByBaseUrl(input) {
  const host = hostOf(input)
  if (!host) return null
  const found = SCHOOLS.find((school) => hostOf(school.baseUrl) === host)
  return found ? withHost(found) : null
}

module.exports = {
  getAll,
  search,
  findById,
  findByBaseUrl,
  hostOf
}

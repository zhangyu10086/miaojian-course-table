// 判断学校是否开放自动导入。
// 优先使用云数据库 schools 集合里的 autoImport；
// 旧数据没有这个字段时，回退到内置白名单 secure-import.js。
const registry = require('./school-registry')
const secureImport = require('./secure-import')

function supportsAutoImport(school) {
  if (!school) return false
  if (typeof school.autoImport === 'boolean') return school.autoImport
  return secureImport.isSupported(school.baseUrl)
}

function supportsAutoImportByUrl(baseUrl) {
  const matched = registry.findByBaseUrl(baseUrl)
  if (matched) return supportsAutoImport(matched)
  return secureImport.isSupported(baseUrl)
}

module.exports = {
  supportsAutoImport,
  supportsAutoImportByUrl
}

// 支持自动导入的学校白名单。
// 公钥和登录都由云函数在同一个会话里完成，不需要把学校域名加入
// 小程序 request 合法域名。新增学校时，先实测一次导入再加到这里。
const SECURE_IMPORT_HOSTS = [
  'jwglxt.wuit.cn',
  'jwxt.xjau.edu.cn',
  'jwgl.cwxu.edu.cn',
  'jw.gsmc.edu.cn',
  'jwglxt.haut.edu.cn',
  'jw.lcudcc.edu.cn',
  'tdjw.ntu.edu.cn',
  'jxgl.qut.edu.cn',
  'jw.swfu.edu.cn',
  'jw1.hustwenhua.net',
  'jwglxt.xcu.edu.cn',
  'jwmk.zcmu.edu.cn'
]

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

function isSupported(baseUrl) {
  const host = hostOf(baseUrl)
  return !!host && SECURE_IMPORT_HOSTS.indexOf(host) >= 0
}

module.exports = {
  SECURE_IMPORT_HOSTS,
  hostOf,
  isSupported
}

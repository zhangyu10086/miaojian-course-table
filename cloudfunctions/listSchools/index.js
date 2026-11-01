const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function normalize(item) {
  return {
    id: item._id || item.id || '',
    name: item.name || '',
    initial: item.initial || '',
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    baseUrl: item.baseUrl || '',
    host: item.host || '',
    system: item.system || 'zfn_v2',
    verified: !!item.verified,
    // null 表示旧数据没有配置，客户端回退到本地白名单
    autoImport: typeof item.autoImport === 'boolean' ? item.autoImport : null
  }
}

// 学校注册表：小程序端从这里拉取列表，syncSchedule 也用它做域名白名单。
exports.main = async () => {
  try {
    const res = await db.collection('schools').limit(1000).get()
    const schools = (res.data || [])
      .map(normalize)
      .filter((item) => item.name && item.baseUrl)
    return { ok: true, schools, count: schools.length }
  } catch (err) {
    console.error('listSchools failed:', err && err.message)
    return {
      ok: false,
      code: 'DB_ERROR',
      message: '学校列表读取失败，请确认 schools 集合已创建'
    }
  }
}

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

const {
  normalizeBaseUrl,
  isPrivateHost,
  normalizeAliases,
  schoolIdFor
} = require('./normalize')

function fail(code, message) {
  return { ok: false, code, message }
}

function adminOpenids() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalize(item) {
  return {
    id: item._id,
    name: String(item.name || ''),
    baseUrl: String(item.baseUrl || ''),
    host: String(item.host || ''),
    aliases: Array.isArray(item.aliases) ? item.aliases : [],
    autoImport: typeof item.autoImport === 'boolean' ? item.autoImport : null,
    verified: !!item.verified,
    updatedAt: Number(item.updatedAt) || 0
  }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const admins = adminOpenids()

  if (!admins.length) {
    return {
      ok: false,
      code: 'ADMIN_NOT_CONFIGURED',
      message:
        'manageSchool 还没有配置管理员，请把当前 openid 加到它的环境变量 ADMIN_OPENIDS',
      openid: OPENID
    }
  }
  if (admins.indexOf(OPENID) < 0) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: '当前微信不是管理员',
      openid: OPENID
    }
  }

  const action = String(event.action || 'list')

  try {
    if (action === 'whoami') {
      return { ok: true, admin: true, openid: OPENID }
    }

    if (action === 'list') {
      const res = await db.collection('schools').limit(1000).get()
      const schools = (res.data || [])
        .map(normalize)
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
      return { ok: true, schools, count: schools.length }
    }

    if (action === 'save') {
      const name = String(event.name || '').trim()
      if (!name) return fail('INVALID_INPUT', '请填写学校名称')
      if (name.length > 40) {
        return fail('INVALID_INPUT', '学校名称不能超过 40 个字')
      }

      let baseUrl
      try {
        baseUrl = normalizeBaseUrl(event.baseUrl)
      } catch (err) {
        return fail('INVALID_URL', (err && err.message) || '教务地址格式不正确')
      }

      const host = new URL(baseUrl).hostname.toLowerCase()
      if (!host.includes('.') || isPrivateHost(host)) {
        return fail('INVALID_URL', '请填写公网可访问的教务地址')
      }

      const id = String(event.id || '').trim()
      const aliases = normalizeAliases(event.aliases)
      const autoImport = event.autoImport !== false
      const verified = !!event.verified

      // 同一个教务域名只保留一条记录
      const existing = await db
        .collection('schools')
        .where({ host })
        .limit(1)
        .get()
      const found = (existing.data || [])[0]
      if (found && found._id !== id) {
        return fail('DUPLICATE_HOST', '这个教务地址已经添加过了')
      }

      const data = {
        name,
        baseUrl,
        host,
        aliases,
        system: 'zfn_v2',
        autoImport,
        verified,
        updatedAt: Date.now()
      }
      const targetId = id || schoolIdFor(host)
      if (id) {
        // 编辑时用 update，保留 lastSuccessAt 等已有字段
        await db.collection('schools').doc(targetId).update({ data })
      } else {
        await db.collection('schools').doc(targetId).set({ data })
      }

      const saved = await db
        .collection('schools')
        .doc(targetId)
        .get()
      return { ok: true, school: normalize(saved.data) }
    }

    if (action === 'remove') {
      const id = String(event.id || '').trim()
      if (!id) return fail('INVALID_INPUT', '缺少学校 id')
      await db.collection('schools').doc(id).remove()
      return { ok: true }
    }

    return fail('INVALID_ACTION', '不支持的操作')
  } catch (err) {
    console.error('manageSchool failed:', err && err.message)
    return fail('DB_ERROR', (err && err.message) || '学校管理操作失败')
  }
}

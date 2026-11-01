const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function adminOpenids() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const admins = adminOpenids()
  const isAdmin = admins.indexOf(OPENID) >= 0

  // 用于首次配置：告诉当前微信的 openid，以及是否已配置为管理员。
  if (event.action === 'whoami') {
    return {
      ok: true,
      openid: OPENID,
      admin: isAdmin,
      configured: admins.length > 0
    }
  }

  if (!admins.length) {
    return {
      ok: false,
      code: 'ADMIN_NOT_CONFIGURED',
      message: '还没有配置管理员，请先把当前 openid 加到环境变量 ADMIN_OPENIDS',
      openid: OPENID
    }
  }

  if (!isAdmin) {
    return {
      ok: false,
      code: 'FORBIDDEN',
      message: '当前微信不是管理员',
      openid: OPENID
    }
  }

  const title = String(event.title || '').trim()
  const content = String(event.content || '').trim()

  if (!title) {
    return { ok: false, code: 'INVALID_INPUT', message: '请填写公告标题' }
  }
  if (title.length > 80) {
    return { ok: false, code: 'INVALID_INPUT', message: '标题不能超过 80 个字' }
  }
  if (!content) {
    return { ok: false, code: 'INVALID_INPUT', message: '请填写公告正文' }
  }
  if (content.length > 2000) {
    return { ok: false, code: 'INVALID_INPUT', message: '正文不能超过 2000 个字' }
  }

  const qqGroup = String(event.qqGroup || '').trim()
  if (qqGroup && !/^\d{5,15}$/.test(qqGroup)) {
    return { ok: false, code: 'INVALID_INPUT', message: '交流群号应为 5–15 位数字' }
  }

  try {
    // 发布时间由服务端写入，不需要手动填时间戳。
    const publishedAt = Date.now()
    const res = await db.collection('notices').add({
      data: {
        title,
        content,
        source: '金枪鱼2026',
        qqGroup,
        views: 0,
        pinned: false,
        publishedAt,
        updatedAt: publishedAt,
        visible: true
      }
    })
    return { ok: true, id: res._id, publishedAt }
  } catch (err) {
    console.error('publishNotice failed:', err && err.message)
    return {
      ok: false,
      code: 'DB_ERROR',
      message: '发布失败，请确认 notices 集合已创建'
    }
  }
}

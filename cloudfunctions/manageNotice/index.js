const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const NOTICE_SOURCE = '金枪鱼2026'

function toTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function adminOpenids() {
  return String(process.env.ADMIN_OPENIDS || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalize(item, withContent) {
  const publishedAt = toTime(item.publishedAt)
  const notice = {
    id: item._id,
    title: String(item.title || ''),
    source: String(item.source || NOTICE_SOURCE),
    qqGroup: String(item.qqGroup || ''),
    views: Number(item.views) || 0,
    pinned: !!item.pinned,
    publishedAt,
    updatedAt: toTime(item.updatedAt) || publishedAt
  }
  if (withContent) notice.content = String(item.content || '')
  return notice
}

function sortNotices(list) {
  return (list || []).sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return b.publishedAt - a.publishedAt
  })
}

function fail(code, message) {
  return { ok: false, code, message }
}

exports.main = async (event = {}) => {
  const { OPENID } = cloud.getWXContext()
  const admins = adminOpenids()

  if (!admins.length) {
    return fail(
      'ADMIN_NOT_CONFIGURED',
      '还没有配置管理员，请先把当前 openid 加到环境变量 ADMIN_OPENIDS'
    )
  }
  if (admins.indexOf(OPENID) < 0) {
    return fail('FORBIDDEN', '当前微信不是管理员')
  }

  const action = String(event.action || 'list')

  try {
    if (action === 'list') {
      const res = await db.collection('notices').limit(100).get()
      const notices = sortNotices((res.data || []).map((item) => normalize(item, false)))
      return { ok: true, notices }
    }

    const id = String(event.id || '').trim()
    if (!id) return fail('INVALID_INPUT', '缺少公告 id')

    if (action === 'get') {
      const res = await db.collection('notices').doc(id).get()
      return { ok: true, notice: normalize(res.data, true) }
    }

    if (action === 'update') {
      const title = String(event.title || '').trim()
      const content = String(event.content || '').trim()
      if (!title) return fail('INVALID_INPUT', '请填写公告标题')
      if (title.length > 80) return fail('INVALID_INPUT', '标题不能超过 80 个字')
      if (!content) return fail('INVALID_INPUT', '请填写公告正文')
      if (content.length > 2000) return fail('INVALID_INPUT', '正文不能超过 2000 个字')

      const qqGroup = String(event.qqGroup || '').trim()
      if (qqGroup && !/^\d{5,15}$/.test(qqGroup)) {
        return fail('INVALID_INPUT', '交流群号应为 5–15 位数字')
      }

      await db
        .collection('notices')
        .doc(id)
        .update({ data: { title, content, qqGroup, updatedAt: Date.now() } })

      const res = await db.collection('notices').doc(id).get()
      return { ok: true, notice: normalize(res.data, true) }
    }

    if (action === 'remove') {
      await db.collection('notices').doc(id).remove()
      try {
        await db.collection('notice_views').where({ noticeId: id }).remove()
      } catch (err) {
        console.warn('清理浏览记录失败', err && err.message)
      }
      return { ok: true }
    }

    if (action === 'pin' || action === 'unpin') {
      // 先确认公告存在
      try {
        await db.collection('notices').doc(id).get()
      } catch (err) {
        return fail('NOT_FOUND', '公告不存在或已删除')
      }

      if (action === 'pin') {
        // 只允许一条置顶：先把其他置顶取消
        await db.collection('notices').where({ pinned: true }).update({
          data: { pinned: false }
        })
      }

      await db
        .collection('notices')
        .doc(id)
        .update({ data: { pinned: action === 'pin' } })

      return { ok: true }
    }

    return fail('INVALID_ACTION', '不支持的操作')
  } catch (err) {
    console.error('manageNotice failed:', action, err && err.message)
    return fail('DB_ERROR', '操作失败，请确认 notices 集合已创建')
  }
}

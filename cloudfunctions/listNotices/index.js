const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

function toTime(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (value instanceof Date) return value.getTime()
  const numeric = Number(value)
  if (!Number.isNaN(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

// 公告读取：小程序端不直接读数据库，统一走这里。
exports.main = async () => {
  try {
    const res = await db
      .collection('notices')
      .orderBy('publishedAt', 'desc')
      .limit(50)
      .get()

    const notices = (res.data || [])
      .filter((item) => item && item.title && item.content && item.visible !== false)
      .map((item) => {
        const publishedAt = toTime(item.publishedAt)
        return {
          id: item._id,
          title: String(item.title || ''),
          content: String(item.content || ''),
          source: String(item.source || '金枪鱼2026'),
          qqGroup: String(item.qqGroup || ''),
          views: Number(item.views) || 0,
          pinned: !!item.pinned,
          publishedAt,
          updatedAt: toTime(item.updatedAt) || publishedAt
        }
      })
      .sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
        return b.publishedAt - a.publishedAt
      })

    return { ok: true, notices, count: notices.length }
  } catch (err) {
    console.error('listNotices failed:', err && err.message)
    return {
      ok: false,
      code: 'DB_ERROR',
      message: '公告读取失败，请确认 notices 集合已创建'
    }
  }
}

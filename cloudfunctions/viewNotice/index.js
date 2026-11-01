const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command
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

function fail(code, message) {
  return { ok: false, code, message }
}

exports.main = async (event = {}) => {
  const id = String(event.id || '').trim()
  if (!id) return fail('INVALID_INPUT', '缺少公告 id')

  const { OPENID } = cloud.getWXContext()

  let notice = null
  try {
    const res = await db.collection('notices').doc(id).get()
    notice = res.data
  } catch (err) {
    return fail('NOT_FOUND', '公告不存在或已删除')
  }

  if (!notice || notice.visible === false) {
    return fail('NOT_FOUND', '公告不存在或已删除')
  }

  let views = Number(notice.views) || 0
  const viewerKey = id + '_' + (OPENID || 'anonymous')

  // 同一个用户只计一次浏览。
  let firstView = false
  try {
    const viewed = await db.collection('notice_views').doc(viewerKey).get()
    firstView = !viewed.data
  } catch (err) {
    firstView = true
  }

  if (firstView) {
    try {
      await db.collection('notice_views').doc(viewerKey).set({
        data: {
          noticeId: id,
          openid: OPENID || '',
          viewedAt: Date.now()
        }
      })
      await db
        .collection('notices')
        .doc(id)
        .update({ data: { views: _.inc(1) } })
      views += 1
    } catch (err) {
      console.warn('记录浏览量失败', err && err.message)
    }
  }

  const publishedAt = toTime(notice.publishedAt)
  return {
    ok: true,
    notice: {
      id,
      title: String(notice.title || ''),
      content: String(notice.content || ''),
      source: String(notice.source || NOTICE_SOURCE),
      qqGroup: String(notice.qqGroup || ''),
      views,
      pinned: !!notice.pinned,
      publishedAt,
      updatedAt: toTime(notice.updatedAt) || publishedAt
    }
  }
}

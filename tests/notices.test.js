const { test, beforeEach } = require('node:test')
const assert = require('node:assert/strict')

const memory = {}

global.wx = {
  getStorageSync(key) {
    return memory[key] === undefined ? '' : memory[key]
  },
  setStorageSync(key, value) {
    memory[key] = JSON.parse(JSON.stringify(value))
  },
  removeStorageSync(key) {
    delete memory[key]
  }
}

const notices = require('../miniprogram/utils/notices')

beforeEach(() => {
  Object.keys(memory).forEach((key) => delete memory[key])
})

test('formatDate 把时间戳格式化为日期', () => {
  assert.equal(notices.formatDate(new Date(2026, 9, 22).getTime()), '2026-10-22')
  assert.equal(notices.formatDate('2026-10-22T08:00:00+08:00'), '2026-10-22')
  assert.equal(notices.formatDate(''), '')
})

test('formatDateTime 输出到分钟', () => {
  const time = new Date(2026, 9, 22, 17, 5).getTime()
  assert.equal(notices.formatDateTime(time), '2026-10-22 17:05')
})

test('formatRelative 输出相对时间', () => {
  const now = new Date(2026, 9, 22, 17, 0).getTime()
  const minute = 60 * 1000
  const hour = 60 * minute
  const day = 24 * hour

  assert.equal(notices.formatRelative(now - 30 * 1000, now), '刚刚')
  assert.equal(notices.formatRelative(now - 5 * minute, now), '5 分钟前')
  assert.equal(notices.formatRelative(now - 3 * hour, now), '3 小时前')
  assert.equal(notices.formatRelative(now - 30 * hour, now), '昨天')
  assert.equal(notices.formatRelative(now - 3 * day, now), '3 天前')
  assert.equal(notices.formatRelative(now - 10 * day, now), '2026-10-12')
})

test('sortNotices 置顶优先，其余按发布时间倒序', () => {
  const list = notices.sortNotices([
    { id: 'a', title: 'A', content: 'a', publishedAt: 300 },
    { id: 'b', title: 'B', content: 'b', publishedAt: 100, pinned: true },
    { id: 'c', title: 'C', content: 'c', publishedAt: 200 }
  ])
  assert.deepEqual(
    list.map((item) => item.id),
    ['b', 'a', 'c']
  )
})

test('sortNotices 给旧数据补默认来源和浏览量', () => {
  const list = notices.sortNotices([
    { id: 'a', title: 'A', content: 'a', publishedAt: 100 }
  ])
  assert.equal(list[0].source, '金枪鱼2026')
  assert.equal(list[0].views, 0)
  assert.equal(list[0].pinned, false)
  assert.equal(list[0].qqGroup, '')
})

test('sortNotices 保留交流群号', () => {
  const list = notices.sortNotices([
    {
      id: 'a',
      title: 'A',
      content: 'a',
      publishedAt: 100,
      qqGroup: '1124141900'
    }
  ])
  assert.equal(list[0].qqGroup, '1124141900')
})

test('sortNotices 过滤非法数据并按时间倒序', () => {
  const list = notices.sortNotices([
    { id: 'a', title: '旧', content: '内容', publishedAt: 100 },
    { id: 'b', title: '新', content: '内容', publishedAt: 200 },
    { id: '', title: '无 id', content: '内容', publishedAt: 300 },
    { id: 'c', title: '', content: '内容', publishedAt: 400 }
  ])
  assert.equal(list.length, 2)
  assert.equal(list[0].id, 'b')
  assert.equal(list[1].id, 'a')
})

test('未读状态在全部标记已读后清零', () => {
  const list = notices.sortNotices([
    { id: 'a', title: 'A', content: 'a', publishedAt: 100 },
    { id: 'b', title: 'B', content: 'b', publishedAt: 200 }
  ])

  assert.equal(notices.unreadCount(list), 2)
  assert.equal(notices.withUnread(list).filter((item) => item.unread).length, 2)

  notices.markAllRead(list)
  assert.equal(notices.unreadCount(list), 0)
  assert.equal(notices.withUnread(list).filter((item) => item.unread).length, 0)
})

test('getCachedNotices 同步返回缓存并保持置顶排序', () => {
  wx.setStorageSync('ct_notices_cache_v1', [
    { id: 'a', title: 'A', content: 'a', publishedAt: 100 },
    { id: 'b', title: 'B', content: 'b', publishedAt: 200, pinned: true }
  ])
  const list = notices.getCachedNotices()
  assert.deepEqual(
    list.map((item) => item.id),
    ['b', 'a']
  )
})

test('markRead 只把指定公告标记为已读', () => {
  const list = notices.sortNotices([
    { id: 'a', title: 'A', content: 'a', publishedAt: 100 },
    { id: 'b', title: 'B', content: 'b', publishedAt: 200 }
  ])

  notices.markRead('a')
  assert.equal(notices.unreadCount(list), 1)
  assert.equal(notices.withUnread(list).find((item) => item.id === 'a').unread, false)
  assert.equal(notices.withUnread(list).find((item) => item.id === 'b').unread, true)
})

test('新增公告会重新出现未读', () => {
  const first = notices.sortNotices([
    { id: 'a', title: 'A', content: 'a', publishedAt: 100 }
  ])
  notices.markAllRead(first)

  const next = notices.sortNotices([
    { id: 'a', title: 'A', content: 'a', publishedAt: 100 },
    { id: 'b', title: 'B', content: 'b', publishedAt: 200 }
  ])
  assert.equal(notices.unreadCount(next), 1)
  assert.equal(notices.withUnread(next).find((item) => item.id === 'b').unread, true)
})

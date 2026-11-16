const store = require('../../utils/store')
const examsUtil = require('../../utils/exams')
const cloud = require('../../utils/cloud')
const rsa = require('../../utils/rsa')

function decorate(item, now) {
  const days = examsUtil.daysUntil(item, now)
  let daysLabel = ''
  if (days === 0) daysLabel = '今天'
  else if (days !== null && days > 0) daysLabel = '还有 ' + days + ' 天'
  return Object.assign({}, item, {
    dateLabel: examsUtil.formatExamDate(item),
    timeLabel: examsUtil.formatTimeRange(item),
    daysLabel,
    urgent: days !== null && days >= 0 && days <= 3
  })
}

function fallbackYear() {
  const now = new Date()
  return now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1
}

Page({
  data: {
    upcoming: [],
    past: [],
    showPast: false,
    refreshing: false
  },

  onShow() {
    this.load()
  },

  load() {
    const now = Date.now()
    const split = examsUtil.splitExams(examsUtil.getExams(), now)
    this.setData({
      upcoming: split.upcoming.map((item) => decorate(item, now)),
      past: split.past
        .slice()
        .reverse()
        .map((item) => decorate(item, now))
    })
  },

  onTogglePast() {
    this.setData({ showPast: !this.data.showPast })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/exam-edit/exam-edit' })
  },

  onEdit(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/exam-edit/exam-edit?id=' + id })
  },

  async onRefresh() {
    if (this.data.refreshing) return

    const auth = store.getAuth()
    if (!auth.baseUrl || !auth.username || !auth.password) {
      wx.showModal({
        title: '需要教务账号',
        content:
          '刷新考试安排需要登录教务系统。请先在「我的 → 从教务系统导入」填写一次账号，并勾选「记住密码」。',
        confirmText: '去导入',
        success: (res) => {
          if (res.confirm) wx.navigateTo({ url: '/pages/sync/sync' })
        }
      })
      return
    }

    const settings = store.getSettings()
    const xnm = auth.xnm || settings.term.xnm || String(fallbackYear())
    const xqm = auth.xqm || settings.term.xqm || '3'

    this.setData({ refreshing: true })
    wx.showLoading({ title: '正在刷新考试', mask: true })

    try {
      const prepared = await cloud.prepareSync(auth.baseUrl)
      const encryptedPassword = await rsa.encryptPassword(
        auth.password,
        prepared.modulus,
        prepared.exponent
      )
      const result = await cloud.callSync({
        action: 'exams',
        token: prepared.token,
        baseUrl: auth.baseUrl,
        username: auth.username,
        encryptedPassword,
        xnm,
        xqm
      })
      examsUtil.replaceSyncedExams(result.exams || [])
      this.load()
      wx.hideLoading()
      wx.showToast({ title: '已更新', icon: 'success' })
    } catch (err) {
      wx.hideLoading()
      wx.showModal({
        title: '刷新失败',
        content: (err && err.message) || '请稍后重试，或在「从教务系统导入」里重新登录',
        showCancel: false
      })
    } finally {
      this.setData({ refreshing: false })
    }
  }
})

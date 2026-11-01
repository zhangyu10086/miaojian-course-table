const noticeUtil = require('../../utils/notices')

Page({
  data: {
    loading: true,
    error: '',
    title: '',
    content: '',
    qqGroup: '',
    meta: null,
    saving: false
  },

  onLoad(options) {
    this.id = options && options.id ? decodeURIComponent(options.id) : ''
    this.load()
  },

  load() {
    if (!this.id) {
      this.setData({ loading: false, error: '缺少公告 id' })
      return
    }

    this.setData({ loading: true, error: '' })

    wx.cloud
      .callFunction({
        name: 'manageNotice',
        data: { action: 'get', id: this.id }
      })
      .then((res) => {
        const result = (res && res.result) || {}
        if (result.ok === false) {
          this.setData({
            loading: false,
            error: result.message || '公告加载失败'
          })
          return
        }
        const notice = result.notice || {}
        this.setData({
          loading: false,
          title: notice.title || '',
          content: notice.content || '',
          qqGroup: notice.qqGroup || '',
          meta: {
            source: notice.source || '金枪鱼2026',
            publishedLabel: noticeUtil.formatDateTime(notice.publishedAt),
            updatedLabel: noticeUtil.formatDateTime(notice.updatedAt),
            views: notice.views || 0,
            pinned: !!notice.pinned
          }
        })
      })
      .catch((err) => {
        this.setData({
          loading: false,
          error: (err && (err.errMsg || err.message)) || '公告加载失败'
        })
      })
  },

  onTitleInput(event) {
    this.setData({ title: event.detail.value })
  },

  onContentInput(event) {
    this.setData({ content: event.detail.value })
  },

  onQqGroupInput(event) {
    this.setData({ qqGroup: event.detail.value })
  },

  onSave() {
    if (this.data.saving) return

    const title = String(this.data.title || '').trim()
    const content = String(this.data.content || '').trim()
    if (!title) {
      wx.showModal({ title: '还没填标题', content: '请填写公告标题。', showCancel: false })
      return
    }
    if (!content) {
      wx.showModal({ title: '还没填正文', content: '请填写公告正文。', showCancel: false })
      return
    }

    const qqGroup = String(this.data.qqGroup || '').trim()
    if (qqGroup && !/^\d{5,15}$/.test(qqGroup)) {
      wx.showModal({
        title: '交流群号格式不对',
        content: '请填写 5–15 位数字，或留空。',
        showCancel: false
      })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '正在保存', mask: true })

    wx.cloud
      .callFunction({
        name: 'manageNotice',
        data: { action: 'update', id: this.id, title, content, qqGroup }
      })
      .then((res) => {
        const result = (res && res.result) || {}
        wx.hideLoading()
        this.setData({ saving: false })

        if (result.ok === false) {
          wx.showModal({
            title: '保存失败',
            content: result.message || '请稍后重试',
            showCancel: false
          })
          return
        }

        wx.showToast({ title: '已更新', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 500)
      })
      .catch((err) => {
        wx.hideLoading()
        this.setData({ saving: false })
        wx.showModal({
          title: '保存失败',
          content:
            (err && (err.errMsg || err.message)) || '云函数调用失败',
          showCancel: false
        })
      })
  }
})

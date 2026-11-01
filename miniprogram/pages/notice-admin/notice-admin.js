const cloud = require('../../utils/cloud')
const noticeUtil = require('../../utils/notices')

Page({
  data: {
    checking: true,
    configured: false,
    admin: false,
    openid: '',
    title: '',
    content: '',
    qqGroup: '',
    publishing: false,
    error: '',
    notices: [],
    listLoading: false,
    listError: ''
  },

  onLoad() {
    this.check()
  },

  onShow() {
    if (this.data.admin) this.loadList()
  },

  check() {
    this.setData({ checking: true, error: '' })

    if (!cloud.isReady()) {
      this.setData({
        checking: false,
        error: '云开发还没有配置，请先填写环境 ID 并部署云函数'
      })
      return
    }

    wx.cloud
      .callFunction({ name: 'publishNotice', data: { action: 'whoami' } })
      .then((res) => {
        const result = (res && res.result) || {}
        console.log('publishNotice whoami', result)
        const isAdmin = !!result.admin
        this.setData({
          checking: false,
          configured: !!result.configured,
          admin: isAdmin,
          openid: result.openid || '',
          error: result.ok === false ? result.message || '检查失败' : ''
        })
        if (isAdmin) this.loadList()
      })
      .catch((err) => {
        this.setData({
          checking: false,
          error:
            (err && (err.errMsg || err.message)) ||
            '检查管理员身份失败，请确认 publishNotice 已部署'
        })
      })
  },

  onCheck() {
    this.check()
  },

  onCopyOpenid() {
    const openid = this.data.openid
    if (!openid) {
      wx.showToast({ title: 'openid 还没加载，请点重新检查', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: openid,
      success: () => {
        wx.showToast({ title: 'openid 已复制', icon: 'success' })
      },
      fail: (err) => {
        console.warn('复制 openid 失败', err)
        wx.showModal({
          title: '复制失败',
          content: '请长按上面的 openid 文字，手动选择并复制。',
          showCancel: false
        })
      }
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

  onPublish() {
    if (this.data.publishing) return

    if (!this.data.admin) {
      wx.showModal({
        title: '还不是管理员',
        content:
          '当前微信没有发布权限。请先完成 ADMIN_OPENIDS 配置，再点「重新检查」。',
        showCancel: false
      })
      return
    }

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

    this.setData({ publishing: true })
    wx.showLoading({ title: '正在发布', mask: true })

    wx.cloud
      .callFunction({ name: 'publishNotice', data: { title, content, qqGroup } })
      .then((res) => {
        const result = (res && res.result) || {}
        console.log('publishNotice result', result)
        wx.hideLoading()
        this.setData({ publishing: false })

        if (result.ok === false) {
          wx.showModal({
            title: '发布失败',
            content: result.message || '请稍后重试',
            showCancel: false
          })
          return
        }

        this.setData({ title: '', content: '', qqGroup: '' })
        this.loadList()
        wx.showModal({
          title: '发布成功',
          content: '发布时间已自动记录。用户下次打开首页会看到红点。',
          showCancel: false
        })
      })
      .catch((err) => {
        console.error('publishNotice error', err)
        wx.hideLoading()
        this.setData({ publishing: false })
        wx.showModal({
          title: '发布失败',
          content:
            (err && (err.errMsg || err.message)) ||
            '云函数调用失败，请确认 publishNotice 已部署',
          showCancel: false
        })
      })
  },

  loadList() {
    if (!this.data.admin) return

    this.setData({ listLoading: true, listError: '' })

    wx.cloud
      .callFunction({ name: 'manageNotice', data: { action: 'list' } })
      .then((res) => {
        const result = (res && res.result) || {}
        if (result.ok === false) {
          this.setData({
            listLoading: false,
            listError: result.message || '公告列表加载失败'
          })
          return
        }

        const notices = (result.notices || []).map((item) =>
          Object.assign({}, item, {
            publishedLabel: noticeUtil.formatDateTime(item.publishedAt),
            updatedLabel: noticeUtil.formatDateTime(item.updatedAt)
          })
        )
        this.setData({ listLoading: false, listError: '', notices })
      })
      .catch((err) => {
        this.setData({
          listLoading: false,
          listError:
            (err && (err.errMsg || err.message)) || '公告列表加载失败'
        })
      })
  },

  onTogglePin(event) {
    const id = event.currentTarget.dataset.id
    const item = (this.data.notices || []).find((notice) => notice.id === id)
    if (!item) return

    const action = item.pinned ? 'unpin' : 'pin'
    wx.showLoading({
      title: action === 'pin' ? '正在置顶' : '正在取消',
      mask: true
    })

    wx.cloud
      .callFunction({ name: 'manageNotice', data: { action, id } })
      .then((res) => {
        wx.hideLoading()
        const result = (res && res.result) || {}
        if (result.ok === false) {
          wx.showModal({
            title: '操作失败',
            content: result.message || '请稍后重试',
            showCancel: false
          })
          return
        }
        this.loadList()
      })
      .catch((err) => {
        wx.hideLoading()
        wx.showModal({
          title: '操作失败',
          content:
            (err && (err.errMsg || err.message)) || '云函数调用失败',
          showCancel: false
        })
      })
  },

  onEditNotice(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: '/pages/notice-edit/notice-edit?id=' + encodeURIComponent(id)
    })
  },

  onDeleteNotice(event) {
    const id = event.currentTarget.dataset.id
    const item = (this.data.notices || []).find((notice) => notice.id === id)
    if (!id) return

    wx.showModal({
      title: '删除公告',
      content:
        '确定删除「' +
        (item ? item.title : '这条公告') +
        '」吗？删除后不可恢复。',
      confirmText: '删除',
      confirmColor: '#c4473a',
      success: (res) => {
        if (!res.confirm) return

        wx.showLoading({ title: '正在删除', mask: true })
        wx.cloud
          .callFunction({ name: 'manageNotice', data: { action: 'remove', id } })
          .then((result) => {
            wx.hideLoading()
            const data = (result && result.result) || {}
            if (data.ok === false) {
              wx.showModal({
                title: '删除失败',
                content: data.message || '请稍后重试',
                showCancel: false
              })
              return
            }
            this.loadList()
          })
          .catch((err) => {
            wx.hideLoading()
            wx.showModal({
              title: '删除失败',
              content:
                (err && (err.errMsg || err.message)) || '云函数调用失败',
              showCancel: false
            })
          })
      }
    })
  }
})

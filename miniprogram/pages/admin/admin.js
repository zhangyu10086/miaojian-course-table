const cloud = require('../../utils/cloud')

function callWhoami(name) {
  return wx.cloud
    .callFunction({ name, data: { action: 'whoami' } })
    .then((res) => (res && res.result) || {
      ok: false,
      code: 'EMPTY_RESULT',
      message: name + ' 没有返回结果'
    })
    .catch((err) => ({
      ok: false,
      code: 'CLOUD_ERROR',
      message:
        (err && (err.errMsg || err.message)) || name + ' 调用失败'
    }))
}

Page({
  data: {
    checking: true,
    admin: false,
    configured: false,
    schoolAdmin: false,
    openid: '',
    error: '',
    schoolError: ''
  },

  onLoad() {
    this.check()
  },

  check() {
    this.setData({ checking: true, error: '', schoolError: '' })

    if (!cloud.isReady()) {
      this.setData({
        checking: false,
        error: '云开发还没有配置，请先填写环境 ID 并部署云函数'
      })
      return
    }

    Promise.all([callWhoami('publishNotice'), callWhoami('manageSchool')])
      .then(([notice, school]) => {
        this.setData({
          checking: false,
          admin: !!notice.admin,
          configured: !!notice.configured,
          schoolAdmin: !!school.admin,
          openid: notice.openid || school.openid || '',
          error: notice.ok === false && !notice.admin ? notice.message || '' : '',
          schoolError: school.ok === false ? school.message || '' : ''
        })
      })
      .catch(() => {
        this.setData({
          checking: false,
          error: '检查管理员身份失败，请稍后重试'
        })
      })
  },

  onCopyOpenid() {
    const openid = this.data.openid
    if (!openid) {
      wx.showToast({ title: 'openid 还没加载，请点刷新', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: openid,
      success: () => {
        wx.showToast({ title: 'openid 已复制', icon: 'success' })
      },
      fail: () => {
        wx.showModal({
          title: '复制失败',
          content: '请长按上面的 openid 文字，手动选择并复制。',
          showCancel: false
        })
      }
    })
  },

  onNotices() {
    wx.navigateTo({ url: '/pages/notice-admin/notice-admin' })
  },

  onSchools() {
    wx.navigateTo({ url: '/pages/school-admin/school-admin' })
  }
})

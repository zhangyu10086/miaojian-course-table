const store = require('../../utils/store')

Page({
  data: {},

  onLoad() {
    this.redirectToPreferredTab()
  },

  redirectToPreferredTab() {
    const settings = store.getSettings()
    const target =
      settings.defaultTab === 'today'
        ? '/pages/today/today'
        : '/pages/schedule/schedule'

    wx.switchTab({
      url: target,
      fail: () => {
        wx.reLaunch({ url: target })
      }
    })
  }
})

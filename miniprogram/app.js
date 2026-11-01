const store = require('./utils/store')
const config = require('./config')

// 云开发环境 ID 只放在 config.js，该文件不会提交到仓库。
// 开源版请复制 config.example.js 为 config.js 后填写。
const CLOUD_ENV_ID = config.cloudEnvId || ''

App({
  globalData: {
    cloudReady: false,
    foregroundAt: 0
  },

  onLaunch() {
    this.globalData.foregroundAt = Date.now()
    store.ensureDefaults()
    this.initCloud()
  },

  // 冷启动、从后台回到前台都会触发，用于强制检查一次公告。
  onShow() {
    this.globalData.foregroundAt = Date.now()
  },

  initCloud() {
    if (!wx.cloud) return
    if (!CLOUD_ENV_ID || CLOUD_ENV_ID.indexOf('YOUR_') === 0) return

    try {
      wx.cloud.init({
        env: CLOUD_ENV_ID,
        traceUser: true
      })
      this.globalData.cloudReady = true
    } catch (err) {
      console.warn('云开发初始化失败，可继续使用本地课表', err)
    }
  }
})

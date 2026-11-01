function isReady() {
  const app = getApp()
  return !!(
    wx.cloud &&
    app &&
    app.globalData &&
    app.globalData.cloudReady
  )
}

// 第一步：让云函数在自己的会话里取登录页 csrftoken 和学校公钥。
// 学校公钥按会话生成，手机端不能另开会话自己取，否则密文解不开。
function prepareSync(baseUrl) {
  return new Promise((resolve, reject) => {
    if (!isReady()) {
      reject({
        code: 'CLOUD_UNAVAILABLE',
        message: '还没有配置云开发环境，请先按 README 开通并填写环境 ID。'
      })
      return
    }

    wx.cloud
      .callFunction({
        name: 'syncSchedule',
        data: { action: 'prepare', baseUrl }
      })
      .then((res) => {
        const result = res && res.result
        if (!result || result.ok === false) {
          reject({
            code: (result && result.code) || 'EMPTY_RESULT',
            message: (result && result.message) || '无法建立登录会话'
          })
          return
        }
        if (!result.token || !result.modulus || !result.exponent) {
          reject({
            code: 'PUBLIC_KEY_ERROR',
            message: '学校没有返回可用的公钥'
          })
          return
        }
        resolve(result)
      })
      .catch((err) => {
        reject({
          code: 'CLOUD_ERROR',
          message: (err && (err.errMsg || err.message)) || '云函数调用失败'
        })
      })
  })
}

function callSync(payload) {
  return new Promise((resolve, reject) => {
    if (!isReady()) {
      reject({
        code: 'CLOUD_UNAVAILABLE',
        message: '还没有配置云开发环境，请先按 README 开通并填写环境 ID。'
      })
      return
    }

    wx.cloud
      .callFunction({
        name: 'syncSchedule',
        data: payload || {}
      })
      .then((res) => {
        const result = res && res.result
        if (!result) {
          reject({ code: 'EMPTY_RESULT', message: '云函数没有返回数据' })
          return
        }
        if (result.ok === false) {
          reject(result)
          return
        }
        resolve(result)
      })
      .catch((err) => {
        reject({
          code: 'CLOUD_ERROR',
          message: (err && (err.errMsg || err.message)) || '云函数调用失败'
        })
      })
  })
}

// 管理员学校管理：list / save / remove / whoami
function callManageSchools(payload) {
  return new Promise((resolve, reject) => {
    if (!isReady()) {
      reject({
        code: 'CLOUD_UNAVAILABLE',
        message: '还没有配置云开发环境'
      })
      return
    }

    wx.cloud
      .callFunction({ name: 'manageSchool', data: payload || {} })
      .then((res) => {
        const result = res && res.result
        if (!result || result.ok === false) {
          reject({
            code: (result && result.code) || 'EMPTY_RESULT',
            message: (result && result.message) || '学校管理操作失败',
            openid: (result && result.openid) || ''
          })
          return
        }
        resolve(result)
      })
      .catch((err) => {
        const text =
          (err && (err.errMsg || err.message)) || '云函数调用失败'
        if (
          text.indexOf('FunctionName') >= 0 ||
          text.indexOf('not found') >= 0 ||
          text.indexOf('不存在') >= 0
        ) {
          reject({
            code: 'FUNCTION_NOT_DEPLOYED',
            message: '请先部署 manageSchool 云函数，再刷新'
          })
          return
        }
        reject({ code: 'CLOUD_ERROR', message: text })
      })
  })
}

function callSchools() {
  return new Promise((resolve, reject) => {
    if (!isReady()) {
      reject({
        code: 'CLOUD_UNAVAILABLE',
        message: '还没有配置云开发环境'
      })
      return
    }

    wx.cloud
      .callFunction({ name: 'listSchools' })
      .then((res) => {
        const result = res && res.result
        if (!result || result.ok === false) {
          reject({
            code: (result && result.code) || 'EMPTY_RESULT',
            message: (result && result.message) || '学校列表为空'
          })
          return
        }
        resolve(result.schools || [])
      })
      .catch((err) => {
        reject({
          code: 'CLOUD_ERROR',
          message:
            (err && (err.errMsg || err.message)) || '学校列表加载失败'
        })
      })
  })
}

function callNotices() {
  return new Promise((resolve, reject) => {
    if (!isReady()) {
      reject({
        code: 'CLOUD_UNAVAILABLE',
        message: '还没有配置云开发环境'
      })
      return
    }

    wx.cloud
      .callFunction({ name: 'listNotices' })
      .then((res) => {
        const result = res && res.result
        if (!result || result.ok === false) {
          reject({
            code: (result && result.code) || 'EMPTY_RESULT',
            message: (result && result.message) || '公告列表为空'
          })
          return
        }
        resolve(result.notices || [])
      })
      .catch((err) => {
        reject({
          code: 'CLOUD_ERROR',
          message: (err && (err.errMsg || err.message)) || '公告加载失败'
        })
      })
  })
}

function callNoticeDetail(id) {
  return new Promise((resolve, reject) => {
    if (!isReady()) {
      reject({
        code: 'CLOUD_UNAVAILABLE',
        message: '还没有配置云开发环境'
      })
      return
    }

    wx.cloud
      .callFunction({ name: 'viewNotice', data: { id } })
      .then((res) => {
        const result = res && res.result
        if (!result || result.ok === false) {
          reject({
            code: (result && result.code) || 'EMPTY_RESULT',
            message: (result && result.message) || '公告详情加载失败'
          })
          return
        }
        resolve(result.notice || null)
      })
      .catch((err) => {
        reject({
          code: 'CLOUD_ERROR',
          message: (err && (err.errMsg || err.message)) || '公告详情加载失败'
        })
      })
  })
}

module.exports = {
  isReady,
  prepareSync,
  callSync,
  callManageSchools,
  callSchools,
  callNotices,
  callNoticeDetail
}

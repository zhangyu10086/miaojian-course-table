const store = require('../../utils/store')
const parser = require('../../utils/parser')
const cloud = require('../../utils/cloud')
const registry = require('../../utils/school-registry')
const schoolAccess = require('../../utils/school-access')
const rsa = require('../../utils/rsa')
const { TERMS } = require('../../utils/constants')

function schoolNameFor(baseUrl) {
  if (!String(baseUrl || '').trim()) return ''
  const matched = registry.findByBaseUrl(baseUrl)
  return matched ? matched.name : '手动输入'
}

function buildYears() {
  const now = new Date()
  const startYear = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1
  return Array.from({ length: 6 }, (_, index) => {
    const year = startYear - index
    return {
      label: year + '-' + (year + 1),
      value: String(year)
    }
  })
}

const INITIAL_YEARS = buildYears()

Page({
  data: {
    baseUrl: '',
    schoolName: '',
    username: '',
    password: '',
    remember: false,
    showPassword: false,
    years: INITIAL_YEARS,
    yearIndex: 0,
    terms: TERMS,
    termIndex: 0,
    xnm: INITIAL_YEARS[0].value,
    xqm: '3',
    loading: false,
    cloudReady: false,
    agreed: false,
    secureSupported: true
  },

  onLoad() {
    const settings = store.getSettings()
    const auth = store.getAuth()
    const years = buildYears()
    const xnm = auth.xnm || settings.term.xnm || years[0].value
    const xqm = auth.xqm || settings.term.xqm || '3'
    const yearIndex = Math.max(
      0,
      years.findIndex((item) => item.value === String(xnm))
    )
    const termIndex = Math.max(
      0,
      TERMS.findIndex((item) => item.value === String(xqm))
    )

    const baseUrl = auth.baseUrl || settings.jwBaseUrl || ''

    this.setData({
      baseUrl,
      schoolName: schoolNameFor(baseUrl),
      secureSupported: baseUrl ? schoolAccess.supportsAutoImportByUrl(baseUrl) : true,
      username: auth.username || '',
      password: auth.remember ? auth.password || '' : '',
      remember: !!auth.remember,
      years,
      yearIndex,
      terms: TERMS,
      termIndex,
      xnm: years[yearIndex].value,
      xqm: TERMS[termIndex].value
    })

    // 管理员可能刚在云端加了学校，刷新后重新判断
    registry.refresh().then(() => {
      if (!this.data.baseUrl) return
      this.setData({
        schoolName: schoolNameFor(this.data.baseUrl),
        secureSupported: schoolAccess.supportsAutoImportByUrl(this.data.baseUrl)
      })
    })
  },

  onShow() {
    this.setData({ cloudReady: cloud.isReady() })
  },

  onChooseSchool() {
    wx.navigateTo({
      url: '/pages/school-picker/school-picker',
      events: {
        selectSchool: (school) => {
          if (!school) return
          this.setData({
            baseUrl: school.baseUrl,
            schoolName: school.name,
            secureSupported: schoolAccess.supportsAutoImport(school)
          })
        }
      }
    })
  },

  onBaseUrlInput(event) {
    const baseUrl = event.detail.value
    this.setData({
      baseUrl,
      schoolName: schoolNameFor(baseUrl),
      secureSupported: baseUrl ? schoolAccess.supportsAutoImportByUrl(baseUrl) : true
    })
  },

  onManualAdd() {
    wx.navigateTo({ url: '/pages/course-edit/course-edit' })
  },

  onUsernameInput(event) {
    this.setData({ username: event.detail.value })
  },

  onPasswordInput(event) {
    this.setData({ password: event.detail.value })
  },

  onRememberChange(event) {
    this.setData({ remember: !!event.detail.value })
  },

  onTogglePassword() {
    this.setData({ showPassword: !this.data.showPassword })
  },

  onToggleAgree() {
    this.setData({ agreed: !this.data.agreed })
  },

  onPrivacy() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  onYearChange(event) {
    const index = Number(event.detail.value)
    this.setData({ yearIndex: index, xnm: this.data.years[index].value })
  },

  onTermChange(event) {
    const index = Number(event.detail.value)
    this.setData({ termIndex: index, xqm: this.data.terms[index].value })
  },

  onHelp() {
    wx.showModal({
      title: '导入说明',
      content:
        '1. 地址填教务系统首页，例如 https://jw.example.edu.cn\n' +
        '2. 学号、密码就是教务系统的账号密码\n' +
        '3. 学年选起始年，学期按实际选择\n' +
        '4. 如果提示验证码/滑块，说明学校开启了人机验证，自动导入暂时不可用\n' +
        '5. 导入会替换上次教务导入的课程，手动添加的课程保留',
      showCancel: false
    })
  },

  async onImport() {
    if (this.data.loading) return
    if (!this.data.agreed) {
      wx.showToast({ title: '请先确认使用本人账号', icon: 'none' })
      return
    }
    const baseUrl = String(this.data.baseUrl || '')
      .trim()
      .replace(/\/+$/, '')
    const username = String(this.data.username || '').trim()
    const password = String(this.data.password || '')

    if (!/^https?:\/\//i.test(baseUrl)) {
      wx.showToast({ title: '请填写完整的教务系统地址', icon: 'none' })
      return
    }
    if (!username || !password) {
      wx.showToast({ title: '请填写学号和密码', icon: 'none' })
      return
    }
    if (!schoolAccess.supportsAutoImportByUrl(baseUrl)) {
      wx.showModal({
        title: '该学校暂不支持自动导入',
        content:
          '为了保护密码，目前只对部分学校开放手机端加密导入。你可以手动添加课程，课表、今日课程和导入导出功能都可以正常使用。',
        confirmText: '手动添加',
        showCancel: false,
        success: () => this.onManualAdd()
      })
      return
    }
    if (!cloud.isReady()) {
      wx.showModal({
        title: '云开发还没有配置',
        content:
          '本地课表可以正常使用，但教务同步需要云开发环境。请按项目 README 开通云开发、填写环境 ID，并上传 syncSchedule 云函数。',
        showCancel: false
      })
      return
    }

    // 密码只在手机本地加密，云函数只接收密文。
    // 学校公钥按会话生成，必须由云函数在准备登录的同一个会话里取回，
    // 手机端不能另开一个会话自己取，否则学校解不开密文。
    this.setData({ loading: true })
    wx.showLoading({ title: '正在建立登录会话', mask: true })

    let prepared = null
    let encryptedPassword = ''
    try {
      prepared = await cloud.prepareSync(baseUrl)
      wx.showLoading({ title: '正在加密密码', mask: true })
      encryptedPassword = await rsa.encryptPassword(
        password,
        prepared.modulus,
        prepared.exponent
      )
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      if (err && err.code) {
        this.showError(err)
      } else {
        this.showEncryptError((err && err.message) || '无法获取学校公钥')
      }
      return
    }

    const auth = {
      baseUrl,
      username,
      password: this.data.remember ? password : '',
      remember: this.data.remember,
      xnm: this.data.xnm,
      xqm: this.data.xqm
    }
    store.saveAuth(auth)
    store.saveSettings({
      jwBaseUrl: baseUrl,
      term: { xnm: this.data.xnm, xqm: this.data.xqm }
    })

    const matchedSchool = registry.findByBaseUrl(baseUrl)
    store.addRecentSchool({
      id: matchedSchool ? matchedSchool.id : '',
      name: matchedSchool ? matchedSchool.name : registry.hostOf(baseUrl) || baseUrl,
      baseUrl,
      system: matchedSchool ? matchedSchool.system : 'zfn_v2'
    })

    this.setData({ loading: true })
    wx.showLoading({ title: '正在登录教务系统', mask: true })

    try {
      const result = await this.callSyncWithRetry(
        {
          token: prepared.token,
          baseUrl,
          username,
          encryptedPassword,
          xnm: this.data.xnm,
          xqm: this.data.xqm
        },
        baseUrl,
        username,
        password
      )
      wx.hideLoading()
      this.setData({ loading: false })

      const settings = store.getSettings()
      const courses = parser.parseKbList(result.kbList, settings)

      if (!courses.length) {
        wx.showModal({
          title: '没有解析到课程',
          content:
            '登录成功了，但该学期没有返回可识别的课程。请确认学年/学期选择是否正确，或换一个学期再试。',
          showCancel: false
        })
        return
      }

      wx.showModal({
        title: '导入完成',
        content:
          '解析到 ' +
          courses.length +
          ' 门课程。确认后将替换上次从教务导入的课程，手动添加的课程会保留。',
        confirmText: '写入课表',
        success: (res) => {
          if (!res.confirm) return
          store.replaceSyncedCourses(courses)
          wx.showToast({ title: '已导入 ' + courses.length + ' 门', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
        }
      })
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      this.showError(err)
    }
  },

  // 会话 5 分钟过期，正常情况下不会遇到；
  // 万一云函数实例切换导致会话丢失，重建一次再试。
  async callSyncWithRetry(payload, baseUrl, username, password) {
    try {
      return await cloud.callSync(payload)
    } catch (err) {
      if (!err || err.code !== 'SESSION_EXPIRED') throw err

      wx.showLoading({ title: '正在重新建立会话', mask: true })
      const key = await cloud.prepareSync(baseUrl)
      const encryptedPassword = await rsa.encryptPassword(
        password,
        key.modulus,
        key.exponent
      )
      wx.showLoading({ title: '正在登录教务系统', mask: true })
      return cloud.callSync({
        token: key.token,
        baseUrl,
        username,
        encryptedPassword,
        xnm: payload.xnm,
        xqm: payload.xqm
      })
    }
  },

  showEncryptError(message) {
    wx.showModal({
      title: '无法安全加密密码',
      content:
        message +
        '\n\n为避免密码经过云函数，本次导入已停止。你可以手动添加课程，或检查网络后重试。',
      confirmText: '手动添加',
      cancelText: '重试',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/course-edit/course-edit' })
        }
      }
    })
  },

  showError(err) {
    const code = err && err.code
    const messages = {
      CLOUD_UNAVAILABLE: '还没有配置云开发环境，请先按 README 开通并填写环境 ID。',
      LOGIN_FAILED: '账号或密码错误，或者教务系统登录页结构有变化。',
      CAPTCHA_REQUIRED: '教务系统要求验证码或滑块验证，暂时无法自动导入。',
      NETWORK_ERROR: '无法连接教务系统，请检查地址、校园网或 VPN。',
      PARSE_ERROR: '教务系统返回的不是预期课表数据，可能是学期参数不对或接口被改动。',
      NO_COURSES: '该学期没有查询到课程，请确认学年和学期。',
      CLIENT_ENCRYPTION_REQUIRED: '请更新到最新版本小程序后再导入。',
      HOST_NOT_ALLOWED:
        '这所学校暂未开放自动导入，或刚添加还没生效（约 1 分钟）。可以稍后重试，或先手动添加课程。',
      SESSION_EXPIRED: '登录会话已过期，请重新点击导入。',
      LOGIN_PAGE_CHANGED: '教务系统登录页结构有变化，暂时无法自动导入。',
      PUBLIC_KEY_ERROR: '学校没有返回可用的公钥，暂时无法自动导入。',
      INVALID_INPUT: '导入参数不完整，请检查后重试。',
      CLOUD_ERROR: '云函数调用失败，请检查云函数是否已部署。'
    }
    wx.showModal({
      title: '导入失败',
      content: messages[code] || (err && err.message) || '未知错误，请稍后重试。',
      showCancel: false
    })
  }
})

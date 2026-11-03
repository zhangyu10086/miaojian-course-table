const store = require('../../utils/store')
const dateUtil = require('../../utils/date')
const cloud = require('../../utils/cloud')
const transfer = require('../../utils/transfer')
const transferFile = require('../../utils/transfer-file')

const LAUNCH_OPTIONS = [
  { label: '课表', value: 'schedule' },
  { label: '今日', value: 'today' }
]

Page({
  data: {
    stats: {
      courseCount: 0,
      syncCount: 0,
      manualCount: 0
    },
    semesterLabel: '未设置',
    currentWeekLabel: '',
    cloudReady: false,
    hasCourses: false,
    launchOptions: LAUNCH_OPTIONS,
    launchIndex: 0
  },

  onShow() {
    this.load()
  },

  load() {
    const settings = store.getSettings()
    const stats = store.getStats()
    const current = dateUtil.getWeekNumber(settings)
    const launchIndex = Math.max(
      0,
      LAUNCH_OPTIONS.findIndex((item) => item.value === settings.defaultTab)
    )
    this.setData({
      stats,
      semesterLabel: settings.semesterStartDate
        ? settings.semesterStartDate + ' 开始 · 共 ' + settings.totalWeeks + ' 周'
        : '未设置',
      currentWeekLabel: current.week ? '第 ' + current.week + ' 周' : '未设置学期',
      cloudReady: cloud.isReady(),
      hasCourses: stats.courseCount > 0,
      launchIndex
    })
  },

  onSync() {
    wx.navigateTo({ url: '/pages/sync/sync' })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/course-edit/course-edit' })
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onLaunchChange(event) {
    const index = Number(event.detail.value)
    const option = this.data.launchOptions[index]
    if (!option) return
    store.saveSettings({ defaultTab: option.value })
    this.setData({ launchIndex: index })
    wx.showToast({ title: '下次打开生效', icon: 'none' })
  },

  onExport() {
    wx.showActionSheet({
      itemList: ['分享 JSON 文件', '分享 CSV 文件', '导出 ICS 文件', '复制 JSON 到剪贴板'],
      success: (res) => {
        const actions = [
          () => this.exportJsonFile(),
          () => this.exportCsvFile(),
          () => this.exportIcsFile(),
          () => this.copyJson()
        ]
        if (actions[res.tapIndex]) actions[res.tapIndex]()
      }
    })
  },

  exportBaseName() {
    return '秒见课表-' + dateUtil.formatDate(new Date())
  },

  exportJsonFile() {
    const content = transfer.toJson(store.getCourses(), store.getSettings())
    transferFile
      .shareText(content, 'json', this.exportBaseName())
      .catch((err) => this.handleTransferError(err))
  },

  exportCsvFile() {
    const content = '﻿' + transfer.toCsv(store.getCourses())
    transferFile
      .shareText(content, 'csv', this.exportBaseName())
      .catch((err) => this.handleTransferError(err))
  },

  exportIcsFile() {
    let content = ''
    try {
      content = transfer.toIcs(store.getCourses(), store.getSettings())
    } catch (err) {
      wx.showModal({
        title: '无法导出 ICS',
        content: (err && err.message) || '请先完善学期设置',
        showCancel: false
      })
      return
    }

    transferFile
      .shareText(content, 'ics', this.exportBaseName())
      .catch((err) => this.handleTransferError(err))
  },

  copyJson() {
    const content = transfer.toJson(store.getCourses(), store.getSettings())
    wx.setClipboardData({
      data: content,
      success: () => wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
    })
  },

  onImportData() {
    wx.showActionSheet({
      itemList: ['从微信文件导入', '从剪贴板导入', '手动添加课程'],
      success: (res) => {
        if (res.tapIndex === 0) this.importFromFile()
        else if (res.tapIndex === 1) this.importFromClipboard()
        else if (res.tapIndex === 2) this.onAdd()
      }
    })
  },

  importFromFile() {
    wx.showLoading({ title: '正在读取文件', mask: true })

    transferFile
      .chooseFile()
      .then((file) => {
        const filePath = file.path || file.tempFilePath
        return transferFile.readText(filePath).then((text) => ({ file, text }))
      })
      .then(({ file, text }) => {
        wx.hideLoading()
        const type = transferFile.detectType(file.name, text)
        const settings = store.getSettings()

        let result = null
        if (type === 'json') {
          result = transfer.parseJson(text)
        } else if (type === 'csv') {
          result = transfer.parseCsv(text)
        } else if (type === 'ics') {
          result = transfer.parseIcs(text, settings)
        } else {
          throw new Error('无法识别文件格式，请选择 JSON、CSV 或 ICS 文件')
        }

        this.confirmImport(result, '文件')
      })
      .catch((err) => {
        wx.hideLoading()
        this.handleTransferError(err)
      })
  },

  importFromClipboard() {
    wx.getClipboardData({
      success: (res) => {
        let result = null
        try {
          result = transfer.parseJson(res.data)
        } catch (err) {
          this.handleTransferError(err)
          return
        }
        this.confirmImport(result, '剪贴板')
      },
      fail: () => wx.showToast({ title: '读取剪贴板失败', icon: 'none' })
    })
  },

  confirmImport(result, sourceLabel) {
    const courses = (result.courses || []).map((course) =>
      Object.assign({}, course, { id: course.id || store.genId() })
    )

    if (!courses.length) {
      this.handleTransferError(new Error('文件里没有可识别的课程'))
      return
    }

    const hasSettings = !!result.settings
    wx.showModal({
      title: '导入课表',
      content:
        '将从' +
        sourceLabel +
        '导入 ' +
        courses.length +
        ' 门课程，替换当前课表' +
        (hasSettings ? '，并覆盖学期设置' : '') +
        '。',
      confirmText: '导入',
      success: (modal) => {
        if (!modal.confirm) return
        store.saveCourses(courses)
        if (hasSettings) store.saveSettings(result.settings)
        this.load()
        wx.showToast({ title: '已导入 ' + courses.length + ' 门', icon: 'success' })
      }
    })
  },

  handleTransferError(err) {
    const message = (err && err.message) || ''
    if (message === 'CANCELLED') return
    wx.showModal({
      title: '操作失败',
      content: message || '请稍后重试',
      showCancel: false
    })
  },

  onClear() {
    wx.showModal({
      title: '清空课表',
      content: '会删除全部课程（包括手动课程和教务导入课程），此操作不可撤销。',
      confirmText: '清空',
      confirmColor: '#c4473a',
      success: (res) => {
        if (!res.confirm) return
        store.clearCourses()
        this.load()
        wx.showToast({ title: '已清空', icon: 'success' })
      }
    })
  },

  onAbout() {
    wx.navigateTo({ url: '/pages/privacy/privacy' })
  },

  onJoinGroup() {
    wx.setClipboardData({
      data: '1124141900',
      success: () => {
        wx.showModal({
          title: '群号已复制',
          content: '打开 QQ，搜索群号 1124141900 加入「秒见课表 社区群」。',
          showCancel: false
        })
      },
      fail: () => {
        wx.showModal({
          title: '交流群',
          content: 'QQ 群号：1124141900，请手动搜索加入。',
          showCancel: false
        })
      }
    })
  },

  onAdmin() {
    // 长按「隐私说明与开源声明」进入管理员入口，云端会校验 openid
    wx.navigateTo({ url: '/pages/admin/admin' })
  }
})

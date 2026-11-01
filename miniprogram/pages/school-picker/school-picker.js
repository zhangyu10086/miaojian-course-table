const registry = require('../../utils/school-registry')
const schoolAccess = require('../../utils/school-access')
const store = require('../../utils/store')

function decorate(school) {
  return Object.assign({}, school, {
    secure: schoolAccess.supportsAutoImport(school)
  })
}

function schoolKeyOf(school) {
  return (school && (school.id || school.host || school.baseUrl)) || ''
}

Page({
  data: {
    keyword: '',
    schools: [],
    recent: [],
    loading: false
  },

  onLoad() {
    if (registry.hasCache()) {
      // 有缓存时列表是完整的，先渲染，再在后台静默对比更新，避免闪烁。
      this.allSchools = registry.getAll()
      this.refresh('')
      this.silentRefresh()
      return
    }

    // 首次使用没有缓存，先等云端列表，避免先显示内置的 2 所再突然变成 26 所。
    this.setData({ loading: true })
    registry.refresh().then((list) => {
      if (Array.isArray(list) && list.length) this.allSchools = list
      this.setData({ loading: false })
      this.refresh('')
    })
  },

  // 后台刷新：只有学校集合真的变了才重新渲染。
  silentRefresh() {
    registry.refresh().then((list) => {
      if (!Array.isArray(list) || !list.length) return
      const before = this.allSchools.map(schoolKeyOf).join('|')
      const after = list.map(schoolKeyOf).join('|')
      if (before === after) return
      this.allSchools = list
      this.refresh(this.data.keyword)
    })
  },

  onPullDownRefresh() {
    registry
      .refresh()
      .then((list) => {
        if (Array.isArray(list) && list.length) this.allSchools = list
        this.refresh(this.data.keyword)
      })
      .finally(() => wx.stopPullDownRefresh())
  },

  refresh(keyword) {
    const recent = store.getRecentSchools().map((item) => {
      const matched = registry.findByBaseUrl(item.baseUrl)
      return decorate(Object.assign({}, matched || {}, item))
    })

    this.setData({
      keyword,
      schools: registry.filter(this.allSchools, keyword).map(decorate),
      recent
    })
  },

  onSearch(event) {
    this.refresh(event.detail.value)
  },

  onPick(event) {
    this.finish(
      registry.findById(this.allSchools, event.currentTarget.dataset.id)
    )
  },

  onPickRecent(event) {
    const index = Number(event.currentTarget.dataset.index)
    this.finish(this.data.recent[index])
  },

  finish(school) {
    if (!school) return
    const item = Object.assign({}, school)
    if (!item.host) item.host = registry.hostOf(item.baseUrl)
    store.addRecentSchool(item)
    try {
      const channel = this.getOpenerEventChannel()
      if (channel && channel.emit) channel.emit('selectSchool', item)
    } catch (err) {
      console.warn('回传学校选择失败', err)
    }
    wx.navigateBack()
  },

  onManualAdd() {
    wx.navigateTo({ url: '/pages/course-edit/course-edit' })
  }
})

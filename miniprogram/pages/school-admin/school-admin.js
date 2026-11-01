const cloud = require('../../utils/cloud')
const registry = require('../../utils/school-registry')

const EMPTY_FORM = {
  id: '',
  name: '',
  baseUrl: '',
  aliasesText: '',
  autoImport: true,
  verified: false
}

function decorate(item) {
  const aliases = Array.isArray(item.aliases) ? item.aliases : []
  return Object.assign({}, item, {
    aliases,
    aliasesText: aliases.join(', '),
    autoLabel:
      item.autoImport === true
        ? '自动导入'
        : item.autoImport === false
          ? '仅手动'
          : '默认规则',
    autoClass:
      item.autoImport === true
        ? 'secure'
        : item.autoImport === false
          ? 'manual'
          : 'default',
    statusLabel: item.verified ? '已验证' : '待验证',
    statusClass: item.verified ? 'verified' : 'pending'
  })
}

function filterSchools(list, keyword) {
  const query = String(keyword || '').trim().toLowerCase()
  if (!query) return list
  return list.filter((item) => {
    const haystack = [item.name, item.host, item.baseUrl]
      .concat(item.aliases || [])
      .join(' ')
      .toLowerCase()
    return haystack.indexOf(query) >= 0
  })
}

Page({
  data: {
    checking: true,
    admin: false,
    error: '',
    openid: '',
    keyword: '',
    schools: [],
    visibleSchools: [],
    editing: false,
    saving: false,
    deletingId: '',
    form: Object.assign({}, EMPTY_FORM)
  },

  onLoad() {
    this.loadList(true)
  },

  onPullDownRefresh() {
    this.loadList(false).finally(() => wx.stopPullDownRefresh())
  },

  onRefresh() {
    this.loadList(true)
  },

  loadList(first) {
    if (first) this.setData({ checking: true, error: '' })

    return cloud
      .callManageSchools({ action: 'list' })
      .then((result) => {
        const schools = (result.schools || []).map(decorate)
        this.setData({
          checking: false,
          admin: true,
          error: '',
          schools,
          visibleSchools: filterSchools(schools, this.data.keyword)
        })
      })
      .catch((err) => {
        this.setData({
          checking: false,
          admin: false,
          error: (err && err.message) || '加载学校列表失败',
          openid: (err && err.openid) || ''
        })
      })
  },

  onSearch(event) {
    const keyword = event.detail.value
    this.setData({
      keyword,
      visibleSchools: filterSchools(this.data.schools, keyword)
    })
  },

  onAdd() {
    this.setData({
      editing: true,
      saving: false,
      form: Object.assign({}, EMPTY_FORM)
    })
  },

  onEdit(event) {
    const id = event.currentTarget.dataset.id
    const school = this.data.schools.find((item) => item.id === id)
    if (!school) return
    this.setData({
      editing: true,
      saving: false,
      form: {
        id: school.id,
        name: school.name,
        baseUrl: school.baseUrl,
        aliasesText: school.aliasesText || '',
        autoImport: school.autoImport !== false,
        verified: !!school.verified
      }
    })
  },

  onCancel() {
    this.setData({ editing: false, saving: false })
  },

  onFieldInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) return
    this.setData({ ['form.' + field]: event.detail.value })
  },

  onSwitch(event) {
    const field = event.currentTarget.dataset.field
    if (!field) return
    this.setData({ ['form.' + field]: !!event.detail.value })
  },

  onSave() {
    if (this.data.saving) return

    const form = this.data.form
    const name = String(form.name || '').trim()
    const baseUrl = String(form.baseUrl || '').trim()

    if (!name) {
      wx.showToast({ title: '请填写学校名称', icon: 'none' })
      return
    }
    if (!/^https?:\/\//i.test(baseUrl)) {
      wx.showToast({ title: '教务地址要以 http(s):// 开头', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.showLoading({ title: '正在保存', mask: true })

    cloud
      .callManageSchools({
        action: 'save',
        id: form.id,
        name,
        baseUrl,
        aliases: form.aliasesText,
        autoImport: !!form.autoImport,
        verified: !!form.verified
      })
      .then(() => {
        wx.hideLoading()
        this.setData({ saving: false, editing: false })
        wx.showToast({ title: '已保存', icon: 'success' })
        this.loadList(false)
        // 顺便刷新本地学校缓存，用户回到导入页时能立即看到
        registry.refresh()
      })
      .catch((err) => {
        wx.hideLoading()
        this.setData({ saving: false })
        if (err && err.code === 'FORBIDDEN') {
          this.setData({
            admin: false,
            error: err.message || '当前微信不是管理员',
            openid: err.openid || ''
          })
          return
        }
        wx.showModal({
          title: '保存失败',
          content: (err && err.message) || '请稍后重试',
          showCancel: false
        })
      })
  },

  onDelete(event) {
    if (this.data.deletingId) return
    const id = event.currentTarget.dataset.id
    const name = event.currentTarget.dataset.name || '这所学校'
    if (!id) return

    wx.showModal({
      title: '删除学校',
      content:
        '确定删除「' +
        name +
        '」吗？删除后用户选择页不再显示它，已导入的课程不受影响。',
      confirmText: '删除',
      confirmColor: '#b94a3f',
      success: (res) => {
        if (!res.confirm) return
        this.setData({ deletingId: id })
        wx.showLoading({ title: '正在删除', mask: true })

        cloud
          .callManageSchools({ action: 'remove', id })
          .then(() => {
            wx.hideLoading()
            this.setData({ deletingId: '' })
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadList(false)
            registry.refresh()
          })
          .catch((err) => {
            wx.hideLoading()
            this.setData({ deletingId: '' })
            wx.showModal({
              title: '删除失败',
              content: (err && err.message) || '请稍后重试',
              showCancel: false
            })
          })
      }
    })
  }
})

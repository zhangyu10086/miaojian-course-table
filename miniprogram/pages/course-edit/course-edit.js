const store = require('../../utils/store')
const { PALETTE } = require('../../utils/constants')

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

Page({
  data: {
    isEdit: false,
    courseId: '',
    name: '',
    teacher: '',
    location: '',
    day: 1,
    dayIndex: 0,
    startSection: 1,
    endSection: 1,
    startIndex: 0,
    endIndex: 0,
    weekChips: [],
    weekCount: 0,
    colorIndex: 0,
    colors: PALETTE,
    remark: '',
    credit: '',
    days: DAY_LABELS,
    sections: [],
    sectionLabels: [],
    totalWeeks: 20
  },

  onLoad(options) {
    const settings = store.getSettings()
    const sections = settings.sections
    const totalWeeks = settings.totalWeeks
    const course = options.id
      ? store.getCourses().find((item) => item.id === options.id)
      : null

    this._oldSource = course ? course.source : 'manual'

    const day = course ? Number(course.day) : Number(options.day) || 1
    const startSection = course
      ? Number(course.startSection)
      : Number(options.section) || 1
    const endSection = course ? Number(course.endSection) : startSection
    const weeks = course
      ? course.weeks.slice()
      : Array.from({ length: totalWeeks }, (_, index) => index + 1)

    let startIndex = sections.findIndex((item) => Number(item.number) === startSection)
    let endIndex = sections.findIndex((item) => Number(item.number) === endSection)
    if (startIndex < 0) startIndex = 0
    if (endIndex < 0) endIndex = startIndex
    if (endIndex < startIndex) endIndex = startIndex

    const weekChips = Array.from({ length: totalWeeks }, (_, index) => ({
      week: index + 1,
      selected: weeks.indexOf(index + 1) >= 0
    }))

    wx.setNavigationBarTitle({ title: course ? '编辑课程' : '添加课程' })

    this.setData({
      isEdit: !!course,
      courseId: course ? course.id : '',
      name: course ? course.name : '',
      teacher: course ? course.teacher : '',
      location: course ? course.location : '',
      day,
      dayIndex: Math.max(0, Math.min(6, day - 1)),
      startSection: sections[startIndex].number,
      endSection: sections[endIndex].number,
      startIndex,
      endIndex,
      weekChips,
      weekCount: weeks.length,
      colorIndex: course ? course.colorIndex : Math.floor(Math.random() * PALETTE.length),
      remark: course ? course.remark : '',
      credit: course && course.credit ? String(course.credit) : '',
      sections,
      sectionLabels: sections.map(
        (item) => item.number + ' 节 · ' + item.startTime + '-' + item.endTime
      ),
      totalWeeks
    })
  },

  onNameInput(event) {
    this.setData({ name: event.detail.value })
  },

  onTeacherInput(event) {
    this.setData({ teacher: event.detail.value })
  },

  onLocationInput(event) {
    this.setData({ location: event.detail.value })
  },

  onRemarkInput(event) {
    this.setData({ remark: event.detail.value })
  },

  onCreditInput(event) {
    this.setData({ credit: event.detail.value })
  },

  onDayChange(event) {
    const index = Number(event.detail.value)
    this.setData({ dayIndex: index, day: index + 1 })
  },

  onStartChange(event) {
    const index = Number(event.detail.value)
    const sections = this.data.sections
    let endIndex = this.data.endIndex
    if (sections[endIndex].number < sections[index].number) endIndex = index
    this.setData({
      startIndex: index,
      startSection: sections[index].number,
      endIndex,
      endSection: sections[endIndex].number
    })
  },

  onEndChange(event) {
    const index = Number(event.detail.value)
    const sections = this.data.sections
    let startIndex = this.data.startIndex
    if (sections[index].number < sections[startIndex].number) startIndex = index
    this.setData({
      endIndex: index,
      endSection: sections[index].number,
      startIndex,
      startSection: sections[startIndex].number
    })
  },

  onWeekToggle(event) {
    const index = Number(event.currentTarget.dataset.index)
    const chips = this.data.weekChips.map((chip, chipIndex) =>
      chipIndex === index ? Object.assign({}, chip, { selected: !chip.selected }) : chip
    )
    this.applyChips(chips)
  },

  onSelectAllWeeks() {
    this.applyChips(this.data.weekChips.map((chip) => Object.assign({}, chip, { selected: true })))
  },

  onSelectOddWeeks() {
    this.applyChips(
      this.data.weekChips.map((chip) =>
        Object.assign({}, chip, { selected: chip.week % 2 === 1 })
      )
    )
  },

  onSelectEvenWeeks() {
    this.applyChips(
      this.data.weekChips.map((chip) =>
        Object.assign({}, chip, { selected: chip.week % 2 === 0 })
      )
    )
  },

  onClearWeeks() {
    this.applyChips(this.data.weekChips.map((chip) => Object.assign({}, chip, { selected: false })))
  },

  applyChips(chips) {
    this.setData({
      weekChips: chips,
      weekCount: chips.filter((chip) => chip.selected).length
    })
  },

  onColorSelect(event) {
    this.setData({ colorIndex: Number(event.currentTarget.dataset.index) })
  },

  onSave() {
    const name = String(this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '请填写课程名', icon: 'none' })
      return
    }
    const weeks = this.data.weekChips
      .filter((chip) => chip.selected)
      .map((chip) => chip.week)
    if (!weeks.length) {
      wx.showToast({ title: '至少选择一周', icon: 'none' })
      return
    }
    if (this.data.endSection < this.data.startSection) {
      wx.showToast({ title: '结束节次不能早于开始节次', icon: 'none' })
      return
    }

    const source =
      this.data.isEdit && this._oldSource === 'sync'
        ? 'manual'
        : this.data.isEdit
        ? this._oldSource
        : 'manual'

    const course = {
      id: this.data.courseId || store.genId(),
      name,
      teacher: String(this.data.teacher || '').trim(),
      location: String(this.data.location || '').trim(),
      day: this.data.day,
      startSection: this.data.startSection,
      endSection: this.data.endSection,
      weeks,
      colorIndex: this.data.colorIndex,
      remark: String(this.data.remark || '').trim(),
      credit: Number(this.data.credit) || 0,
      source,
      updatedAt: Date.now()
    }

    store.upsertCourse(course)
    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 350)
  },

  onDelete() {
    if (!this.data.isEdit) return
    wx.showModal({
      title: '删除课程',
      content: '确定删除「' + this.data.name + '」吗？',
      confirmText: '删除',
      confirmColor: '#c4473a',
      success: (res) => {
        if (!res.confirm) return
        store.deleteCourse(this.data.courseId)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 300)
      }
    })
  }
})

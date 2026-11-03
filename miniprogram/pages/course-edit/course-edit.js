const store = require('../../utils/store')
const courseSlots = require('../../utils/course-slots')
const dateUtil = require('../../utils/date')
const { PALETTE } = require('../../utils/constants')

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

Page({
  data: {
    isEdit: false,
    courseId: '',
    name: '',
    teacher: '',
    location: '',
    slots: [],
    groupId: '',
    groupCount: 0,
    syncGroup: false,
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

    const baseSlot = {
      day: course ? Number(course.day) : Number(options.day) || 1,
      startSection: course ? Number(course.startSection) : Number(options.section) || 1,
      endSection: course ? Number(course.endSection) : Number(options.section) || 1
    }

    const groupId = course && course.groupId ? course.groupId : ''
    const group = groupId ? store.getCourseGroup(groupId) : []
    const sourceSlots = group.length ? group : [baseSlot]
    const slots = sourceSlots.map((item) => this.toSlotRow(item, sections))

    const weeks = course
      ? course.weeks.slice()
      : Array.from({ length: totalWeeks }, (_, index) => index + 1)

    const labels = dateUtil.weekDateLabels(settings, totalWeeks)
    const weekChips = labels.map((item) => ({
      week: item.week,
      label: item.label,
      selected: weeks.indexOf(item.week) >= 0
    }))

    const dateRange = dateUtil.semesterDateRange(settings)
    const nowWeek = dateUtil.getWeekNumber(settings, new Date())
    const currentWeekLabel =
      dateRange && nowWeek.week && !nowWeek.before && !nowWeek.after
        ? '本周是第 ' + nowWeek.week + ' 周 · ' + dateUtil.formatWeekRange(settings, nowWeek.week)
        : ''

    wx.setNavigationBarTitle({ title: course ? '编辑课程' : '添加课程' })

    this.setData({
      isEdit: !!course,
      courseId: course ? course.id : '',
      name: course ? course.name : '',
      teacher: course ? course.teacher : '',
      location: course ? course.location : '',
      slots,
      groupId,
      groupCount: group.length,
      syncGroup: group.length > 1,
      weekChips,
      weekCount: weeks.length,
      dateRange,
      currentWeekLabel,
      pickedHint: '',
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

  onShow() {
    // 从设置页返回时需要重新计算周次日期，否则「去设置」回来仍是旧状态
    this.refreshWeekMeta()
  },

  // 只刷新周次卡片相关字段，保留用户已选周次
  refreshWeekMeta() {
    const settings = store.getSettings()
    const dateRange = dateUtil.semesterDateRange(settings)
    const labels = dateUtil.weekDateLabels(settings, settings.totalWeeks)
    const selected = new Set(
      this.data.weekChips.filter((chip) => chip.selected).map((chip) => chip.week)
    )
    const weekChips = labels.map((item) => ({
      week: item.week,
      label: dateRange ? item.label : '',
      selected: selected.has(item.week)
    }))

    const nowWeek = dateUtil.getWeekNumber(settings, new Date())
    const currentWeekLabel =
      dateRange && nowWeek.week && !nowWeek.before && !nowWeek.after
        ? '本周是第 ' + nowWeek.week + ' 周 · ' + dateUtil.formatWeekRange(settings, nowWeek.week)
        : ''

    this.setData({
      dateRange,
      currentWeekLabel,
      weekChips,
      weekCount: weekChips.filter((chip) => chip.selected).length
    })
  },

  // 把课程记录转换成页面用的时段行（带下拉索引）
  toSlotRow(item, sections) {
    const list = sections || this.data.sections
    let startIndex = list.findIndex((sec) => Number(sec.number) === Number(item.startSection))
    let endIndex = list.findIndex((sec) => Number(sec.number) === Number(item.endSection))
    if (startIndex < 0) startIndex = 0
    if (endIndex < 0) endIndex = startIndex
    if (endIndex < startIndex) endIndex = startIndex
    this._slotSeq = (this._slotSeq || 0) + 1
    return {
      key: 's' + this._slotSeq,
      day: Number(item.day) || 1,
      dayIndex: Math.max(0, Math.min(6, (Number(item.day) || 1) - 1)),
      startSection: list[startIndex].number,
      endSection: list[endIndex].number,
      startIndex,
      endIndex
    }
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

  onSlotDayChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const dayIndex = Number(event.detail.value)
    this.updateSlot(index, { dayIndex, day: dayIndex + 1 })
  },

  onSlotStartChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const sections = this.data.sections
    const startIndex = Number(event.detail.value)
    const slot = this.data.slots[index]
    const endIndex = Math.max(startIndex, slot.endIndex)
    this.updateSlot(index, {
      startIndex,
      endIndex,
      startSection: sections[startIndex].number,
      endSection: sections[endIndex].number
    })
  },

  onSlotEndChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const sections = this.data.sections
    const slot = this.data.slots[index]
    const endIndex = Math.max(slot.startIndex, Number(event.detail.value))
    this.updateSlot(index, {
      endIndex,
      endSection: sections[endIndex].number
    })
  },

  updateSlot(index, patch) {
    const slots = this.data.slots.map((slot, slotIndex) =>
      slotIndex === index ? Object.assign({}, slot, patch) : slot
    )
    this.setData({ slots })
  },

  onAddSlot() {
    const last = this.data.slots[this.data.slots.length - 1]
    const day = (last.day % 7) + 1
    this._slotSeq = (this._slotSeq || 0) + 1
    this.setData({
      slots: this.data.slots.concat([
        Object.assign({}, last, {
          key: 's' + this._slotSeq,
          day,
          dayIndex: day - 1
        })
      ])
    })
  },

  onRemoveSlot(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (this.data.slots.length <= 1) return
    this.setData({
      slots: this.data.slots.filter((slot, slotIndex) => slotIndex !== index)
    })
  },

  onToggleSyncGroup() {
    const syncGroup = !this.data.syncGroup
    if (!syncGroup) {
      // 取消同步时只保留当前这条课程自己的时段，避免误以为会改到别的时段
      const current = store
        .getCourses()
        .find((item) => item.id === this.data.courseId)
      if (current) {
        this.setData({
          syncGroup,
          slots: [this.toSlotRow(current)]
        })
        return
      }
    } else if (this.data.groupId) {
      const group = store.getCourseGroup(this.data.groupId)
      if (group.length) {
        this.setData({
          syncGroup,
          slots: group.map((item) => this.toSlotRow(item))
        })
        return
      }
    }
    this.setData({ syncGroup })
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
      weekCount: chips.filter((chip) => chip.selected).length,
      pickedHint: ''
    })
  },

  onUseCurrentWeek() {
    const settings = store.getSettings()
    const info = dateUtil.getWeekNumber(settings, new Date())
    if (!info.week || info.before || info.after) {
      wx.showToast({ title: '当前不在学期内', icon: 'none' })
      return
    }
    const chips = this.data.weekChips.map((chip) =>
      Object.assign({}, chip, { selected: chip.week === info.week })
    )
    this.setData({ weekChips: chips, weekCount: 1, pickedHint: '' })
  },

  onUseAllWeeks() {
    this.onSelectAllWeeks()
  },

  onPickDate(event) {
    const settings = store.getSettings()
    const date = dateUtil.parseDate(event.detail.value)
    if (!date) return

    const info = dateUtil.getWeekNumber(settings, date)
    if (!info.week) {
      wx.showToast({ title: '请先设置开学日期', icon: 'none' })
      return
    }
    if (info.before || info.after) {
      wx.showToast({ title: '这天不在学期周次范围内', icon: 'none' })
      return
    }

    const chips = this.data.weekChips.map((chip) =>
      Object.assign({}, chip, { selected: chip.week === info.week })
    )
    const dateLabel = dateUtil.formatShortDate(date)
    const day = date.getDay() === 0 ? 7 : date.getDay()
    const singleSlot = this.data.slots.length === 1

    // 只有一个时段时顺带设置星期；多个时段时只定位周次，避免改错行
    const slots = singleSlot
      ? this.data.slots.map((slot, index) =>
          index === 0 ? Object.assign({}, slot, { day, dayIndex: day - 1 }) : slot
        )
      : this.data.slots

    this.setData({
      weekChips: chips,
      weekCount: 1,
      slots,
      pickedHint: singleSlot
        ? '已设为 ' + dateLabel + '（第 ' + info.week + ' 周）· 只这一次'
        : '已定位到第 ' + info.week + ' 周'
    })
  },

  onGoSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
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
    const slots = this.data.slots
    if (!slots.length) {
      wx.showToast({ title: '请至少添加一个上课时间', icon: 'none' })
      return
    }
    if (slots.some((slot) => slot.endSection < slot.startSection)) {
      wx.showToast({ title: '结束节次不能早于开始节次', icon: 'none' })
      return
    }
    if (courseSlots.duplicateSlotIndex(slots) >= 0) {
      wx.showToast({ title: '有两个时间段的星期和节次完全一样', icon: 'none' })
      return
    }

    const source =
      this.data.isEdit && this._oldSource === 'sync'
        ? 'manual'
        : this.data.isEdit
        ? this._oldSource
        : 'manual'

    const plan = courseSlots.planSave({
      isEdit: this.data.isEdit,
      courseId: this.data.courseId,
      groupId: this.data.groupId,
      syncGroup: this.data.syncGroup,
      slotCount: slots.length
    })

    const groupId = plan.needsGroup
      ? this.data.groupId || store.genGroupId()
      : ''

    const base = {
      name,
      teacher: String(this.data.teacher || '').trim(),
      location: String(this.data.location || '').trim(),
      weeks,
      colorIndex: this.data.colorIndex,
      remark: String(this.data.remark || '').trim(),
      credit: Number(this.data.credit) || 0,
      source,
      groupId
    }

    if (plan.rebuildGroup) {
      // 整组重建：时段增删、改名、改周次一次同步
      store.deleteCourseGroup(this.data.groupId)
    }

    const records = courseSlots.buildCourseRecords(slots, base)
    if (plan.firstId) records[0].id = plan.firstId
    store.upsertCourses(records)

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

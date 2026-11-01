const store = require('../../utils/store')
const dateUtil = require('../../utils/date')
const { DEFAULT_SECTIONS } = require('../../utils/constants')

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function buildTotalWeeksOptions() {
  return Array.from({ length: 21 }, (_, index) => ({
    label: index + 10 + ' 周',
    value: index + 10
  }))
}

Page({
  data: {
    semesterStartDate: '',
    totalWeeksOptions: buildTotalWeeksOptions(),
    totalWeeksIndex: 10,
    firstDayOptions: [
      { label: '周一', value: 1 },
      { label: '周日', value: 7 }
    ],
    firstDayIndex: 0,
    showWeekends: false,
    sections: []
  },

  onLoad() {
    const settings = store.getSettings()
    const totalWeeksOptions = buildTotalWeeksOptions()

    this.setData({
      semesterStartDate: settings.semesterStartDate,
      totalWeeksOptions,
      totalWeeksIndex: Math.max(
        0,
        totalWeeksOptions.findIndex((item) => item.value === settings.totalWeeks)
      ),
      firstDayIndex: settings.firstDayOfWeek === 7 ? 1 : 0,
      showWeekends: settings.showWeekends,
      sections: clone(settings.sections)
    })
  },

  onStartDateChange(event) {
    this.setData({ semesterStartDate: event.detail.value })
  },

  onClearStartDate() {
    this.setData({ semesterStartDate: '' })
  },

  onTotalWeeksChange(event) {
    const index = Number(event.detail.value)
    this.setData({ totalWeeksIndex: index })
  },

  onFirstDayChange(event) {
    this.setData({ firstDayIndex: Number(event.detail.value) })
  },

  onShowWeekendsChange(event) {
    this.setData({ showWeekends: !!event.detail.value })
  },

  onSectionTimeChange(event) {
    const index = Number(event.currentTarget.dataset.index)
    const field = event.currentTarget.dataset.field
    const sections = this.data.sections.map((section, sectionIndex) => {
      if (sectionIndex !== index) return section
      const next = Object.assign({}, section)
      next[field] = event.detail.value
      return next
    })
    this.setData({ sections })
  },

  onAddSection() {
    const sections = this.data.sections.slice()
    const last = sections[sections.length - 1]
    const start = last ? dateUtil.timeToMinutes(last.endTime) + 10 : dateUtil.timeToMinutes('08:00')
    sections.push({
      number: sections.length + 1,
      startTime: dateUtil.minutesToTime(start),
      endTime: dateUtil.minutesToTime(start + 45)
    })
    this.setData({ sections })
  },

  onRemoveSection(event) {
    if (this.data.sections.length <= 1) {
      wx.showToast({ title: '至少保留一节', icon: 'none' })
      return
    }
    const index = Number(event.currentTarget.dataset.index)
    const sections = this.data.sections
      .filter((_, sectionIndex) => sectionIndex !== index)
      .map((section, sectionIndex) => Object.assign({}, section, { number: sectionIndex + 1 }))
    this.setData({ sections })
  },

  onResetSections() {
    this.setData({ sections: clone(DEFAULT_SECTIONS) })
  },

  onSave() {
    for (let index = 0; index < this.data.sections.length; index += 1) {
      const section = this.data.sections[index]
      if (dateUtil.timeToMinutes(section.startTime) >= dateUtil.timeToMinutes(section.endTime)) {
        wx.showToast({
          title: '第 ' + (index + 1) + ' 节结束时间应晚于开始时间',
          icon: 'none'
        })
        return
      }
    }

    const totalWeeks = this.data.totalWeeksOptions[this.data.totalWeeksIndex].value
    const firstDayOfWeek = this.data.firstDayOptions[this.data.firstDayIndex].value

    store.saveSettings({
      semesterStartDate: this.data.semesterStartDate,
      totalWeeks,
      firstDayOfWeek,
      showWeekends: this.data.showWeekends,
      sections: this.data.sections
    })

    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 350)
  }
})

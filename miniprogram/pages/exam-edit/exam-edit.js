const examsUtil = require('../../utils/exams')

function todayString() {
  const now = new Date()
  const pad = (value) => (value < 10 ? '0' + value : String(value))
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
}

Page({
  data: {
    isEdit: false,
    examId: '',
    name: '',
    title: '',
    date: '',
    startTime: '',
    endTime: '',
    location: '',
    campus: '',
    mode: '',
    remark: '',
    sourceHint: '',
    dateHint: '',
    showTitle: false
  },

  onLoad(options) {
    const id = options && options.id ? decodeURIComponent(options.id) : ''
    if (!id) {
      const date = todayString()
      this.setData({
        date,
        sourceHint: '填写后保存在本机，只有你自己能看到',
        dateHint: this.describeDate(date)
      })
      wx.setNavigationBarTitle({ title: '添加考试' })
      return
    }

    const exam = examsUtil
      .getExams()
      .find((item) => item.id === id)
    if (!exam) {
      wx.showToast({ title: '考试不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 400)
      return
    }

    wx.setNavigationBarTitle({ title: '编辑考试' })
    this.setData({
      isEdit: true,
      examId: exam.id,
      name: exam.name,
      title: exam.title,
      date: exam.date || todayString(),
      startTime: exam.startTime,
      endTime: exam.endTime,
      location: exam.location,
      campus: exam.campus,
      mode: exam.mode,
      remark: exam.remark,
      sourceHint:
        exam.source === 'sync'
          ? '来自教务导入，保存后转为手动考试，重新导入不会覆盖'
          : '手动添加的考试，重新导入不会覆盖',
      dateHint: this.describeDate(exam.date || todayString()),
      // 考试名称来自教务，手动添加时不展示，避免和科目混淆
      showTitle: !!exam.title
    })
  },

  onInput(event) {
    const field = event.currentTarget.dataset.field
    if (!field) return
    this.setData({ [field]: event.detail.value })
  },

  // 日期下方的提示，例如「还有 3 天」「就是今天」
  describeDate(date) {
    if (!date) return '选好日期后，先显示在考试安排里'
    const days = examsUtil.daysUntil({ date }, Date.now())
    if (days === null) return ''
    if (days === 0) return '就是今天'
    if (days > 0) return '还有 ' + days + ' 天'
    return '已经过去 ' + Math.abs(days) + ' 天'
  },

  onDateChange(event) {
    const date = event.detail.value
    this.setData({ date, dateHint: this.describeDate(date) })
  },

  onStartTimeChange(event) {
    this.setData({ startTime: event.detail.value })
  },

  onEndTimeChange(event) {
    this.setData({ endTime: event.detail.value })
  },

  onSave() {
    const name = String(this.data.name || '').trim()
    if (!name) {
      wx.showToast({ title: '请填写考试科目', icon: 'none' })
      return
    }
    if (!this.data.date) {
      wx.showToast({ title: '请选择考试日期', icon: 'none' })
      return
    }

    examsUtil.upsertExam({
      id: this.data.examId,
      name,
      title: String(this.data.title || '').trim(),
      date: this.data.date,
      startTime: this.data.startTime,
      endTime: this.data.endTime,
      location: String(this.data.location || '').trim(),
      campus: String(this.data.campus || '').trim(),
      mode: String(this.data.mode || '').trim(),
      remark: String(this.data.remark || '').trim(),
      // 手动修改过的考试转为手动来源，重新导入时不会被覆盖
      source: 'manual'
    })

    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 350)
  },

  onDelete() {
    if (!this.data.isEdit) return
    wx.showModal({
      title: '删除考试',
      content: '确定删除「' + this.data.name + '」吗？',
      confirmText: '删除',
      confirmColor: '#c4473a',
      success: (res) => {
        if (!res.confirm) return
        examsUtil.deleteExam(this.data.examId)
        wx.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 300)
      }
    })
  }
})

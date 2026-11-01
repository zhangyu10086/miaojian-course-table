const store = require('../../utils/store')
const dateUtil = require('../../utils/date')
const layout = require('../../utils/layout')

Page({
  data: {
    dateLabel: '',
    weekdayLabel: '',
    weekLabel: '',
    nowLabel: '',
    semesterSet: false,
    isEmpty: true,
    hasCourses: false,
    courses: [],
    nextCourse: null,
    nextCountdown: ''
  },

  onShow() {
    this.load()
    this.startTimer()
  },

  onHide() {
    this.stopTimer()
  },

  onUnload() {
    this.stopTimer()
  },

  onPullDownRefresh() {
    this.load()
    wx.stopPullDownRefresh()
  },

  startTimer() {
    this.stopTimer()
    this.timer = setInterval(() => this.load(), 30000)
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  load() {
    const settings = store.getSettings()
    const allCourses = store.getCourses()
    const now = new Date()
    const current = dateUtil.getWeekNumber(settings)
    const week = current.week || 1
    const todayDay = dateUtil.todayDayNumber(now)
    const nowMinutes = dateUtil.nowMinutes(now)

    const todayCourses = allCourses
      .filter(
        (course) =>
          Number(course.day) === todayDay &&
          Array.isArray(course.weeks) &&
          course.weeks.indexOf(week) >= 0
      )
      .map((course) => {
        const time = dateUtil.getCourseTimeRange(course, settings)
        let statusClass = 'upcoming'
        let statusLabel = '即将开始'
        if (nowMinutes > time.endMinutes) {
          statusClass = 'past'
          statusLabel = '已结束'
        } else if (nowMinutes >= time.startMinutes) {
          statusClass = 'ongoing'
          statusLabel = '进行中'
        }
        return Object.assign({}, course, {
          startTime: time.startTime,
          endTime: time.endTime,
          startMinutes: time.startMinutes,
          endMinutes: time.endMinutes,
          statusClass,
          statusLabel,
          color: layout.courseColor(course.colorIndex)
        })
      })
      .sort((a, b) => a.startMinutes - b.startMinutes)

    const next = todayCourses.find((course) => course.endMinutes >= nowMinutes) || null
    let nextCountdown = ''
    if (next) {
      if (nowMinutes < next.startMinutes) {
        nextCountdown = dateUtil.formatCountdown(next.startMinutes - nowMinutes)
      } else {
        nextCountdown = '正在上课'
      }
    }

    const weekday = todayDay
    this.setData({
      dateLabel: now.getMonth() + 1 + '月' + now.getDate() + '日',
      weekdayLabel: '周' + ['一', '二', '三', '四', '五', '六', '日'][weekday - 1],
      weekLabel: settings.semesterStartDate ? '第 ' + week + ' 周' : '未设置学期',
      nowLabel: dateUtil.pad2(now.getHours()) + ':' + dateUtil.pad2(now.getMinutes()),
      semesterSet: !!settings.semesterStartDate,
      isEmpty: todayCourses.length === 0,
      hasCourses: allCourses.length > 0,
      courses: todayCourses,
      nextCourse: next
        ? Object.assign({}, next, {
            timeLabel: next.startTime + ' - ' + next.endTime
          })
        : null,
      nextCountdown
    })
  },

  onCourseTap(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: '/pages/course-edit/course-edit?id=' + id })
  },

  onSetup() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onSync() {
    wx.navigateTo({ url: '/pages/sync/sync' })
  },

  onAdd() {
    wx.navigateTo({ url: '/pages/course-edit/course-edit' })
  }
})

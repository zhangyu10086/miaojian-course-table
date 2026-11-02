const store = require('../../utils/store')
const dateUtil = require('../../utils/date')
const layout = require('../../utils/layout')
const noticeUtil = require('../../utils/notices')
const weekPanelsUtil = require('../../utils/week-panels')

const ONBOARD_KEY = 'ct_onboard_dismissed_v1'

function isOnboardDismissed() {
  try {
    return wx.getStorageSync(ONBOARD_KEY) === true
  } catch (err) {
    return false
  }
}

function formatWeeks(weeks) {
  const list = (weeks || []).slice().sort((a, b) => a - b)
  if (!list.length) return ''
  const groups = []
  list.forEach((week) => {
    const last = groups[groups.length - 1]
    if (last && week === last[1] + 1) {
      last[1] = week
    } else {
      groups.push([week, week])
    }
  })
  return (
    groups
      .map((group) => (group[0] === group[1] ? String(group[0]) : group[0] + '-' + group[1]))
      .join(',') + '周'
  )
}

Page({
  data: {
    week: 1,
    currentWeek: 1,
    totalWeeks: 20,
    weekRange: '',
    weekPanels: [],
    centerIndex: 1,
    trackX: 0,
    pagerTransition: false,
    dragging: false,
    swiperHeight: 0,
    sections: [],
    rowHeight: 112,
    gridHeight: 0,
    semesterSet: false,
    showWeekends: false,
    isEmpty: false,
    showOnboarding: false,
    gridLines: [],
    weekOptions: [],
    weekPickerVisible: false,
    detailVisible: false,
    detail: null,
    weekIsCurrent: true,
    notices: [],
    noticeUnread: false,
    noticeUnreadCount: 0,
    noticeVisible: false
  },

  onLoad() {
    this._hasLoaded = false
    this._pagerWidth = 0
    this._axis = null
    this._startX = 0
    this._startY = 0
    this._startTime = 0
    this._lastDx = 0
    this._animating = false
    this._ignoreTouch = false
    this._springTimer = null
    this._commitTimer = null
    this.load()
  },

  onReady() {
    const query = wx.createSelectorQuery()
    query
      .select('.week-track')
      .boundingClientRect((rect) => {
        if (rect && rect.width) {
          this._pagerWidth = rect.width
          this.setData({ trackX: -this.data.centerIndex * rect.width })
        }
      })
      .exec()
  },

  onShow() {
    this.load()

    const app = getApp()
    const foregroundAt =
      app && app.globalData ? Number(app.globalData.foregroundAt) || 0 : 0
    // 冷启动或从后台回来时强制检查一次公告，确保红点及时出现。
    const force = Date.now() - foregroundAt < 3000
    if (force && app && app.globalData) app.globalData.foregroundAt = 0
    this.loadNotices(force)

    if (!this.data.noticeVisible) this.startNoticeTimer()
  },

  onHide() {
    this.stopNoticeTimer()
  },

  onUnload() {
    this.stopNoticeTimer()
    if (this._springTimer) {
      clearTimeout(this._springTimer)
      this._springTimer = null
    }
    if (this._commitTimer) {
      clearTimeout(this._commitTimer)
      this._commitTimer = null
    }
  },

  startNoticeTimer() {
    this.stopNoticeTimer()
    // 公告列表打开时不轮询，避免用户阅读时列表跳动。
    if (this.data.noticeVisible) return
    // 每 60 秒检查一次，实际是否请求由 2 分钟缓存决定。
    this.noticeTimer = setInterval(() => {
      this.loadNotices()
    }, 60 * 1000)
  },

  stopNoticeTimer() {
    if (this.noticeTimer) {
      clearInterval(this.noticeTimer)
      this.noticeTimer = null
    }
  },

  async loadNotices(force) {
    const seq = (this._noticeSeq || 0) + 1
    this._noticeSeq = seq

    // 先把本地缓存渲染出来，红点不用等网络。
    const cached = noticeUtil.getCachedNotices()
    if (cached.length) this.applyNotices(cached)

    const list = await noticeUtil.fetchNotices(force)
    if (seq !== this._noticeSeq) return
    this.applyNotices(list)
  },

  applyNotices(list) {
    const items = noticeUtil.withUnread(list)
    const unread = noticeUtil.unreadCount(list)
    this.setData({
      notices: items,
      noticeUnread: unread > 0,
      noticeUnreadCount: unread
    })
  },

  onNoticeTap() {
    this.stopNoticeTimer()
    this.setData({ noticeVisible: true })
    // 用户主动打开公告时刷新一次，但 10 秒内不重复请求。
    this.loadNotices(true)
  },

  closeNotices() {
    this.setData({ noticeVisible: false })
    this.startNoticeTimer()
  },

  onNoticeDetail(event) {
    const id = event.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({
      url: '/pages/notice-detail/notice-detail?id=' + encodeURIComponent(id)
    })
  },

  onShareAppMessage() {
    return {
      title: '我的课程表',
      path: '/pages/schedule/schedule'
    }
  },

  load() {
    const settings = store.getSettings()
    const courses = store.getCourses()
    const current = dateUtil.getWeekNumber(settings)

    let week = this.data.week
    if (!this._hasLoaded) {
      week = current.week || 1
      this._hasLoaded = true
    }
    week = Math.max(1, Math.min(settings.totalWeeks, week || 1))

    const panelData = weekPanelsUtil.buildWeekPanels(
      settings,
      courses,
      week,
      this.data.rowHeight
    )
    const weekOptions = Array.from({ length: settings.totalWeeks }, (_, index) => ({
      week: index + 1,
      isCurrent: current.week === index + 1
    }))

    if (this._commitTimer) {
      clearTimeout(this._commitTimer)
      this._commitTimer = null
    }
    if (this._springTimer) {
      clearTimeout(this._springTimer)
      this._springTimer = null
    }
    this._animating = false
    this._ignoreTouch = false
    this._axis = null
    const width = this.getPagerWidth()
    this.setData({
      week: panelData.current,
      currentWeek: current.week || 1,
      totalWeeks: settings.totalWeeks,
      weekRange: dateUtil.formatWeekRange(settings, panelData.current),
      weekPanels: panelData.panels,
      centerIndex: panelData.pagerIndex,
      trackX: -panelData.pagerIndex * width,
      pagerTransition: false,
      dragging: false,
      swiperHeight: panelData.swiperHeight,
      sections: settings.sections,
      gridHeight: panelData.gridHeight,
      semesterSet: !!settings.semesterStartDate,
      showWeekends: settings.showWeekends,
      isEmpty: courses.length === 0,
      gridLines: panelData.gridLines,
      showOnboarding:
        !settings.semesterStartDate &&
        courses.length === 0 &&
        !isOnboardDismissed(),
      weekOptions,
      weekIsCurrent: !current.week || current.week === panelData.current
    })
  },

  goToWeek(week) {
    this.applyWeek(week)
  },

  applyWeek(week) {
    if (this._commitTimer) {
      clearTimeout(this._commitTimer)
      this._commitTimer = null
    }
    if (this._springTimer) {
      clearTimeout(this._springTimer)
      this._springTimer = null
    }

    const settings = store.getSettings()
    const courses = store.getCourses()
    const panelData = weekPanelsUtil.buildWeekPanels(
      settings,
      courses,
      week,
      this.data.rowHeight
    )
    const nextWeek = panelData.current
    const width = this.getPagerWidth()

    this._animating = false
    this._axis = null
    this.setData({
      week: nextWeek,
      weekRange: dateUtil.formatWeekRange(settings, nextWeek),
      weekPanels: panelData.panels,
      centerIndex: panelData.pagerIndex,
      trackX: -panelData.pagerIndex * width,
      pagerTransition: false,
      dragging: false,
      swiperHeight: panelData.swiperHeight,
      gridHeight: panelData.gridHeight,
      gridLines: panelData.gridLines,
      weekIsCurrent: !this.data.currentWeek || this.data.currentWeek === nextWeek
    })
  },

  onPrevWeek() {
    if (this._animating) return
    const target = this.data.centerIndex - 1
    if (target < 0) {
      wx.showToast({ title: '已经是第一周', icon: 'none' })
      return
    }
    this.commitPanel(target)
  },

  onNextWeek() {
    if (this._animating) return
    const target = this.data.centerIndex + 1
    if (target >= this.data.weekPanels.length) {
      wx.showToast({ title: '已经是最后一周', icon: 'none' })
      return
    }
    this.commitPanel(target)
  },

  onTodayWeek() {
    const settings = store.getSettings()
    const current = dateUtil.getWeekNumber(settings)
    if (!current.week) {
      wx.showToast({ title: '请先设置学期开始日期', icon: 'none' })
      return
    }
    this.goToWeek(current.week)
  },

  onWeekTitleTap() {
    this.setData({ weekPickerVisible: true })
  },

  closeWeekPicker() {
    this.setData({ weekPickerVisible: false })
  },

  onWeekSelect(event) {
    const week = Number(event.currentTarget.dataset.week)
    this.setData({ weekPickerVisible: false })
    this.goToWeek(week)
  },

  getPagerWidth() {
    if (this._pagerWidth) return this._pagerWidth
    let windowWidth = 375
    try {
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
      windowWidth = Number(info.windowWidth) || 375
    } catch (err) {
      windowWidth = 375
    }
    // schedule-page 左右各 20rpx 内边距 + pager 左右各 1rpx 边框
    this._pagerWidth = windowWidth - (42 / 750) * windowWidth
    return this._pagerWidth
  },

  onPagerTouchStart(event) {
    // 上一次翻页动画还没结束时，新触摸不再被丢弃，而是先把pending的周次
    // 立刻应用掉，让手指马上接管。否则快速连滑时第二次会被吞掉。
    if (this._animating) this.finishCommitNow()
    this._ignoreTouch = false
    if (this._springTimer) {
      clearTimeout(this._springTimer)
      this._springTimer = null
    }
    const touch = event.touches && event.touches[0]
    if (!touch) return
    this._axis = null
    this._startX = touch.clientX
    this._startY = touch.clientY
    this._startTime = Date.now()
    this._lastDx = 0
    this._lastMoveAt = 0
    this._prevDx = 0
    this._prevAt = 0
    this._velocity = 0
    // 如果上一次回弹动画还没结束，先停止它，让手指重新接管。
    if (this.data.pagerTransition) this.setData({ pagerTransition: false })
  },

  onPagerTouchMove(event) {
    if (this._ignoreTouch || this._animating) return
    const touch = event.touches && event.touches[0]
    if (!touch) return

    const dx = touch.clientX - this._startX
    const dy = touch.clientY - this._startY

    if (!this._axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      this._axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (this._axis === 'y') return
    }
    if (this._axis !== 'x') return

    this._lastDx = dx

    // 记录瞬时速度，用于判断「快速轻扫」。
    // 用整段手势的平均速度会被起手停顿拖慢，短距离快滑容易不翻页。
    const stamp = Date.now()
    const dt = stamp - (this._prevAt || 0)
    if (dt >= 8) {
      this._velocity = Math.abs(dx - (this._prevDx || 0)) / dt
      this._prevDx = dx
      this._prevAt = stamp
    }

    // 慢速拖动时 touchmove 触发得很密集，每次都 setData 会挤占渲染线程，
    // 表现就是「越慢越卡」。这里限制到约 60fps，位移没变化也不更新。
    const now = stamp
    if (now - (this._lastMoveAt || 0) < 16) return
    this._lastMoveAt = now

    const width = this.getPagerWidth()
    const base = -this.data.centerIndex * width
    const atFirst = this.data.week <= 1
    const atLast = this.data.week >= this.data.totalWeeks

    let nextX
    if ((atFirst && dx > 0) || (atLast && dx < 0)) {
      // 边界：阻尼位移，形成「拉不动」的手感。
      // 不再对每个文字节点做 scaleX，避免拖动时大面积重算样式。
      const pull = Math.min(Math.abs(dx) / width, 1)
      const damped = Math.pow(pull, 0.7) * width * 0.18
      nextX = Math.round(base + (dx > 0 ? damped : -damped))
    } else {
      const offset = Math.max(-width, Math.min(width, dx))
      nextX = Math.round(base + offset)
    }

    if (this.data.dragging && nextX === this.data.trackX) return
    this.setData({
      dragging: true,
      pagerTransition: false,
      trackX: nextX
    })
  },

  onPagerTouchEnd() {
    if (this._ignoreTouch) {
      this._ignoreTouch = false
      this._axis = null
      return
    }
    if (this._animating) {
      this._axis = null
      return
    }
    const axis = this._axis
    this._axis = null
    if (axis !== 'x') return

    const dx = this._lastDx
    const width = this.getPagerWidth()
    const atFirst = this.data.week <= 1
    const atLast = this.data.week >= this.data.totalWeeks

    // 手指停住后再抬起，速度要按 0 算，避免「按住不动也翻页」。
    const idle = Date.now() - (this._prevAt || 0) > 120
    const velocity = idle ? 0 : this._velocity || 0
    const threshold = Math.max(36, width * 0.22)
    const fling = Math.abs(dx) > 14 && velocity > 0.3

    if ((atFirst && dx > 0) || (atLast && dx < 0)) {
      this.springBack()
      return
    }

    if (Math.abs(dx) >= threshold || fling) {
      const direction = dx < 0 ? 1 : -1
      const target = this.data.centerIndex + direction
      if (target >= 0 && target < this.data.weekPanels.length) {
        this.commitPanel(target)
        return
      }
    }

    this.springBack()
  },

  onPagerTouchCancel() {
    const axis = this._axis
    this._axis = null
    if (this._ignoreTouch) {
      this._ignoreTouch = false
      return
    }
    if (axis !== 'x' || this._animating) return
    this.springBack()
  },

  springBack() {
    const width = this.getPagerWidth()
    const base = -this.data.centerIndex * width
    this.setData(
      {
        trackX: base,
        dragging: false,
        pagerTransition: true
      },
      () => {
        if (this._springTimer) clearTimeout(this._springTimer)
        this._springTimer = setTimeout(() => {
          this.setData({ pagerTransition: false })
          this._springTimer = null
        }, 190)
      }
    )
  },


  commitPanel(targetIndex) {
    if (this._animating) return
    const panel = this.data.weekPanels[targetIndex]
    if (!panel) return

    const width = this.getPagerWidth()
    this._animating = true
    this._pendingWeek = panel.week
    this._lastDx = 0
    if (this._springTimer) {
      clearTimeout(this._springTimer)
      this._springTimer = null
    }
    this.setData(
      {
        trackX: -targetIndex * width,
        dragging: false,
        pagerTransition: true
      },
      () => {
        if (this._commitTimer) clearTimeout(this._commitTimer)
        this._commitTimer = setTimeout(() => {
          this._commitTimer = null
          const week = this._pendingWeek
          this._pendingWeek = null
          if (week) this.applyWeek(week)
        }, 190)
      }
    )
  },

  // 动画期间又来了新的触摸：立刻把待应用的周次结算掉，
  // 让新手势从正确的位置开始，避免快速连滑被吞掉。
  finishCommitNow() {
    if (!this._animating) return
    if (this._commitTimer) {
      clearTimeout(this._commitTimer)
      this._commitTimer = null
    }
    const week = this._pendingWeek
    this._pendingWeek = null
    if (week) {
      this.applyWeek(week)
    } else {
      this._animating = false
    }
  },

  onCellTap(event) {
    const day = Number(event.currentTarget.dataset.day)
    const section = Number(event.currentTarget.dataset.section)
    wx.navigateTo({
      url: '/pages/course-edit/course-edit?day=' + day + '&section=' + section
    })
  },

  onBlockTap(event) {
    const id = event.currentTarget.dataset.id
    const course = store.getCourses().find((item) => item.id === id)
    if (!course) return
    const settings = store.getSettings()
    const time = dateUtil.getCourseTimeRange(course, settings)
    this.setData({
      detailVisible: true,
      detail: {
        course,
        color: layout.courseColor(course.colorIndex),
        timeLabel: time.startTime + ' - ' + time.endTime,
        weeksLabel: formatWeeks(course.weeks)
      }
    })
  },

  closeDetail() {
    this.setData({ detailVisible: false, detail: null })
  },

  onEditCourse() {
    const detail = this.data.detail
    if (!detail) return
    this.setData({ detailVisible: false })
    wx.navigateTo({
      url: '/pages/course-edit/course-edit?id=' + detail.course.id
    })
  },

  onDeleteCourse() {
    const detail = this.data.detail
    if (!detail) return
    const course = detail.course
    wx.showModal({
      title: '删除课程',
      content: '确定删除「' + course.name + '」吗？',
      confirmColor: '#c4473a',
      success: (res) => {
        if (!res.confirm) return
        store.deleteCourse(course.id)
        this.setData({ detailVisible: false, detail: null })
        this.load()
        wx.showToast({ title: '已删除', icon: 'success' })
      }
    })
  },

  onAddCourse() {
    wx.navigateTo({ url: '/pages/course-edit/course-edit' })
  },

  onSync() {
    wx.navigateTo({ url: '/pages/sync/sync' })
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },

  onSkipOnboarding() {
    try {
      wx.setStorageSync(ONBOARD_KEY, true)
    } catch (err) {
      console.warn('记录引导状态失败', err)
    }
    this.setData({ showOnboarding: false })
  },

  noop() {}
})

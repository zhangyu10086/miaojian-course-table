const dateUtil = require('./date')
const layout = require('./layout')

// 与 schedule.wxss 里 .grid-head 的高度保持一致
const HEAD_HEIGHT = 80

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function buildPanel(settings, courses, week, rowHeight, index) {
  const rawDays = dateUtil.getDisplayDays(settings, week)
  const blocksByDay = layout.buildWeekBlocks(courses, week, rawDays, rowHeight)
  return {
    key: week + '-' + index,
    week,
    weekRange: dateUtil.formatWeekRange(settings, week),
    days: rawDays.map((day) => ({
      day: day.day,
      label: day.label,
      dateLabel: day.dateLabel,
      isToday: day.isToday,
      blocks: blocksByDay[day.day] || []
    }))
  }
}

/**
 * 构建滑动窗口：
 * - 中间周：[上一周, 当前周, 下一周]，pagerIndex = 1
 * - 第 1 周：[当前周, 下一周]，pagerIndex = 0
 * - 最后一周：[上一周, 当前周]，pagerIndex = 1
 * - 只有一周：[当前周]，pagerIndex = 0
 *
 * 边界周不复制页面，这样 swiper 在边界方向没有可滑动的 item，
 * 用户往边界方向滑时会“划不动”，而不是滑出去再弹回。
 */
function buildWeekPanels(settings, courses, week, rowHeight) {
  const totalWeeks = Math.max(1, Number(settings && settings.totalWeeks) || 20)
  const current = clamp(Number(week) || 1, 1, totalWeeks)
  const height = Number(rowHeight) || 112

  let weeks
  let pagerIndex
  if (totalWeeks === 1) {
    weeks = [1]
    pagerIndex = 0
  } else if (current === 1) {
    weeks = [1, 2]
    pagerIndex = 0
  } else if (current === totalWeeks) {
    weeks = [totalWeeks - 1, totalWeeks]
    pagerIndex = 1
  } else {
    weeks = [current - 1, current, current + 1]
    pagerIndex = 1
  }

  const panels = weeks.map((panelWeek, index) =>
    buildPanel(settings, courses, panelWeek, height, index)
  )
  const sections = (settings && settings.sections) || []
  const gridHeight = sections.length * height
  const gridLines = sections
    .slice(0, -1)
    .map((_, index) => (index + 1) * height)

  return {
    current,
    totalWeeks,
    panels,
    pagerIndex,
    gridHeight,
    gridLines,
    swiperHeight: gridHeight + HEAD_HEIGHT,
    isFirst: current === 1,
    isLast: current === totalWeeks
  }
}

module.exports = {
  HEAD_HEIGHT,
  buildWeekPanels,
  buildPanel
}

// 冲突分列布局参考拾光课程表（Apache-2.0）、shiguang_warehouse（MIT），详见 THIRD_PARTY_NOTICES.md。
const { PALETTE } = require('./constants')

function courseColor(colorIndex) {
  const index = Math.abs(Number(colorIndex) || 0) % PALETTE.length
  return PALETTE[index]
}

/**
 * 计算某一天、某一周的课程块。
 * 重叠课程按区间聚类后分列并排，返回可直接用于绝对定位的数据。
 */
function buildBlocks(courses, weekNumber, day, rowHeight) {
  const height = Number(rowHeight) || 112
  const items = (courses || [])
    .filter(
      (course) =>
        Number(course.day) === Number(day) &&
        Array.isArray(course.weeks) &&
        course.weeks.indexOf(Number(weekNumber)) >= 0
    )
    .map((course) => ({
      course,
      start: Number(course.startSection) || 0,
      end: Number(course.endSection) || 0
    }))
    .filter((item) => item.start >= 1 && item.end >= item.start)

  items.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))

  const clusters = []
  items.forEach((item) => {
    const cluster = clusters.find((group) =>
      group.some((other) => item.start <= other.end && item.end >= other.start)
    )
    if (cluster) {
      cluster.push(item)
    } else {
      clusters.push([item])
    }
  })

  const blocks = []
  clusters.forEach((cluster) => {
    cluster.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start))
    const columnEnds = []
    const columnMap = new Map()

    cluster.forEach((item) => {
      let column = -1
      for (let index = 0; index < columnEnds.length; index += 1) {
        if (columnEnds[index] < item.start) {
          column = index
          break
        }
      }
      if (column === -1) {
        column = columnEnds.length
        columnEnds.push(item.end)
      } else {
        columnEnds[column] = item.end
      }
      columnMap.set(item, column)
    })

    const columnCount = columnEnds.length
    cluster.forEach((item) => {
      const column = columnMap.get(item) || 0
      blocks.push({
        id: item.course.id,
        course: item.course,
        top: (item.start - 1) * height,
        height: (item.end - item.start + 1) * height,
        left: (column / columnCount) * 100,
        width: 100 / columnCount,
        color: courseColor(item.course.colorIndex),
        columnCount
      })
    })
  })

  blocks.sort((a, b) => a.top - b.top)
  return blocks
}

function buildWeekBlocks(courses, weekNumber, days, rowHeight) {
  const result = {}
  ;(days || []).forEach((day) => {
    result[day.day] = buildBlocks(courses, weekNumber, day.day, rowHeight)
  })
  return result
}

module.exports = {
  courseColor,
  buildBlocks,
  buildWeekBlocks
}

// 多时段课程的纯函数工具：只做计算，不读写存储，便于单元测试。

function slotKey(slot) {
  return [slot.day, slot.startSection, slot.endSection].join('|')
}

// 返回第一个与前面重复的时段下标；没有重复返回 -1
function duplicateSlotIndex(slots) {
  const seen = new Set()
  const list = Array.isArray(slots) ? slots : []
  for (let index = 0; index < list.length; index += 1) {
    const key = slotKey(list[index])
    if (seen.has(key)) return index
    seen.add(key)
  }
  return -1
}

// 把公共字段（课程名、周次、颜色等）复制到每个时段，生成待保存的记录
function buildCourseRecords(slots, base) {
  const common = base || {}
  return (Array.isArray(slots) ? slots : []).map((slot) =>
    Object.assign({}, common, {
      day: Number(slot.day) || 1,
      startSection: Number(slot.startSection) || 1,
      endSection: Number(slot.endSection) || Number(slot.startSection) || 1
    })
  )
}

// 从已有课程还原时段列表；旧数据没有 slots 字段时退化成单条
function slotsFromCourse(course) {
  if (!course) return []
  if (Array.isArray(course.slots) && course.slots.length) {
    return course.slots.map((slot) => ({
      day: Number(slot.day) || 1,
      startSection: Number(slot.startSection) || 1,
      endSection: Number(slot.endSection) || 1
    }))
  }
  return [
    {
      day: Number(course.day) || 1,
      startSection: Number(course.startSection) || 1,
      endSection: Number(course.endSection) || Number(course.startSection) || 1
    }
  ]
}

module.exports = {
  duplicateSlotIndex,
  buildCourseRecords,
  slotsFromCourse
}

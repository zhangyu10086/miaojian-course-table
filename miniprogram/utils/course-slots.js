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
      endSection: Number(slot.endSection) || Number(slot.startSection) || 1
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

// 决定保存策略，纯函数便于测试。
// rebuildGroup：整组重建（编辑已分组课程且勾选同步）
// needsGroup：本次保存是否需要 groupId（已分组或多时段）
// firstId：第一条记录沿用的 id（编辑单条时保留，整组重建时重新生成）
function planSave(options) {
  const opt = options || {}
  const isEdit = !!opt.isEdit
  const courseId = String(opt.courseId || '')
  const groupId = String(opt.groupId || '')
  const syncGroup = !!opt.syncGroup
  const slotCount = Math.max(1, Number(opt.slotCount) || 1)

  const rebuildGroup = isEdit && !!groupId && syncGroup
  const needsGroup = !!groupId || slotCount > 1
  const firstId = isEdit && courseId && !rebuildGroup ? courseId : ''
  return { rebuildGroup, needsGroup, firstId }
}

module.exports = {
  duplicateSlotIndex,
  buildCourseRecords,
  slotsFromCourse,
  planSave
}

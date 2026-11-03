# 课程编辑：多时段与按日期添加 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户在一个页面里录入一门课的多个「星期 + 节次」时段，并能按具体日期反查周次、一键添加单次课。

**Architecture:** 不改课程数据结构。同一门课的多条记录共享 `groupId`，每条仍然是「单天 + 单节次」，因此课表布局、今日页、冲突并排、导出导入全部零改动。周次仍然是周号数组，日期只作为输入辅助。

**Tech Stack:** 微信小程序原生（WXML/WXSS/JS），Node 内置 `node:test` 做单元测试。

## Global Constraints

- 不改 `layout.js`、`week-panels.js`、`today.js`、`schedule.js`、`transfer.js`、`parser.js` 和任何云函数。
- JSON / CSV / ICS 导出格式保持不变，`groupId` 不写入导出文件。
- 旧数据没有 `groupId` 时按独立课程处理，不做迁移。
- 所有注释、提示文案使用中文。
- 每个任务结束前必须通过 `npm test` 和 `npm run audit`。
- 课程字段命名沿用现有：`day`（1=周一…7=周日）、`startSection`、`endSection`、`weeks`。

---

### Task 1: 周次日期工具

**Files:**
- Modify: `miniprogram/utils/date.js`
- Test: `tests/date.test.js`

**Interfaces:**
- Consumes: 现有的 `getWeekDates`、`formatShortDate`、`formatDate`、`parseDate`
- Produces:
  - `weekStartDate(settings, weekNumber) => Date`
  - `weekStartLabel(settings, weekNumber) => '11/03'`
  - `weekDateLabels(settings, totalWeeks) => [{ week: number, label: string }]`
  - `semesterDateRange(settings) => { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD' } | null`

- [ ] **Step 1: 在 `tests/date.test.js` 末尾写失败测试**

```js
test('weekStartLabel 返回该周周一的月日', () => {
  assert.equal(dateUtil.weekStartLabel(settings, 1), '09/07')
  assert.equal(dateUtil.weekStartLabel(settings, 10), '11/09')
})

test('weekDateLabels 覆盖全部周次', () => {
  const labels = dateUtil.weekDateLabels(settings, 3)
  assert.deepEqual(
    labels.map((item) => item.week),
    [1, 2, 3]
  )
  assert.equal(labels[2].label, '09/21')
})

test('semesterDateRange 返回第 1 周周一到最后一周周日', () => {
  assert.deepEqual(dateUtil.semesterDateRange(settings), {
    start: '2026-09-07',
    end: '2027-01-24'
  })
})

test('没有开学日期时 semesterDateRange 返回 null', () => {
  assert.equal(
    dateUtil.semesterDateRange({ semesterStartDate: '', totalWeeks: 20 }),
    null
  )
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/date.test.js`
Expected: FAIL，提示 `dateUtil.weekStartLabel is not a function`

- [ ] **Step 3: 在 `miniprogram/utils/date.js` 的 `formatWeekRange` 之后添加实现**

```js
function weekStartDate(settings, weekNumber) {
  return getWeekDates(settings, weekNumber)[0]
}

function weekStartLabel(settings, weekNumber) {
  return formatShortDate(weekStartDate(settings, weekNumber))
}

// 每个周次格子第二行显示的日期，例如 [{ week: 1, label: '09/07' }]
function weekDateLabels(settings, totalWeeks) {
  const count = Math.max(1, Number(totalWeeks) || 20)
  return Array.from({ length: count }, (_, index) => ({
    week: index + 1,
    label: weekStartLabel(settings, index + 1)
  }))
}

// 日期选择器的可选范围；没有开学日期时返回 null，调用方据此禁用选择器
function semesterDateRange(settings) {
  if (!parseDate(settings.semesterStartDate)) return null
  const totalWeeks = Math.max(1, Number(settings.totalWeeks) || 20)
  const start = weekStartDate(settings, 1)
  const end = addDays(start, totalWeeks * 7 - 1)
  return { start: formatDate(start), end: formatDate(end) }
}
```

- [ ] **Step 4: 把新函数加入 `module.exports`**

在 `module.exports` 中 `getWeekDates,` 之后加入：

```js
  weekStartDate,
  weekStartLabel,
  weekDateLabels,
  semesterDateRange,
```

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/date.test.js`
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add miniprogram/utils/date.js tests/date.test.js
git commit -m "feat: 增加周次日期工具"
```

---

### Task 2: store 支持课程分组

**Files:**
- Modify: `miniprogram/utils/store.js`
- Test: `tests/store.test.js`

**Interfaces:**
- Consumes: 现有 `getCourses`、`saveCourses`、`genId`
- Produces:
  - `genGroupId() => string`
  - `upsertCourses(courses) => 课程数组`
  - `getCourseGroup(groupId) => 课程数组`
  - `deleteCourseGroup(groupId) => 课程数组`
  - `getCourses()` 返回值新增字段 `groupId: string`

- [ ] **Step 1: 在 `tests/store.test.js` 末尾写失败测试**

```js
test('upsertCourses 批量写入并共享 groupId', () => {
  const groupId = store.genGroupId()
  store.upsertCourses([
    { name: '高数', day: 1, startSection: 1, endSection: 2, weeks: [1], groupId },
    { name: '高数', day: 3, startSection: 3, endSection: 4, weeks: [1], groupId }
  ])
  const group = store.getCourseGroup(groupId)
  assert.equal(group.length, 2)
  assert.equal(group[1].day, 3)
})

test('getCourses 保留 groupId', () => {
  store.upsertCourses([{ name: '英语', day: 2, startSection: 1, endSection: 2, weeks: [1], groupId: 'g1' }])
  assert.equal(store.getCourses()[0].groupId, 'g1')
})

test('deleteCourseGroup 只删除同组记录', () => {
  store.upsertCourses([
    { name: '高数', day: 1, startSection: 1, endSection: 2, weeks: [1], groupId: 'g1' },
    { name: '高数', day: 3, startSection: 3, endSection: 4, weeks: [1], groupId: 'g1' },
    { name: '英语', day: 2, startSection: 1, endSection: 2, weeks: [1] }
  ])
  store.deleteCourseGroup('g1')
  const left = store.getCourses()
  assert.equal(left.length, 1)
  assert.equal(left[0].name, '英语')
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/store.test.js`
Expected: FAIL，提示 `store.genGroupId is not a function`

- [ ] **Step 3: 在 `getCourses()` 的 normalize 中加 `groupId`**

把 `getCourses` 里返回对象中的 `source:` 一行前面加上：

```js
      groupId: String(item.groupId || ''),
```

- [ ] **Step 4: 在 `genId()` 之后添加 `genGroupId()`**

```js
function genGroupId() {
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
}
```

- [ ] **Step 5: 在 `upsertCourse` 之后添加批量与分组函数**

```js
// 一次写入多条课程，用于「同一门课多个时段」，id 为空时自动生成
function upsertCourses(courses) {
  const list = getCourses()
  ;(courses || []).forEach((course) => {
    const index = list.findIndex((item) => item.id && item.id === course.id)
    const next = Object.assign({}, course, { updatedAt: Date.now() })
    if (index >= 0) {
      list[index] = Object.assign({}, list[index], next)
    } else {
      list.push(Object.assign({ id: genId() }, next))
    }
  })
  saveCourses(list)
  return list
}

function getCourseGroup(groupId) {
  if (!groupId) return []
  return getCourses().filter((item) => item.groupId === groupId)
}

function deleteCourseGroup(groupId) {
  if (!groupId) return getCourses()
  const list = getCourses().filter((item) => item.groupId !== groupId)
  saveCourses(list)
  return list
}
```

- [ ] **Step 6: 加入模块导出**

在 `module.exports` 中 `upsertCourse,` 之后添加：

```js
  upsertCourses,
  getCourseGroup,
  deleteCourseGroup,
  genGroupId,
```

- [ ] **Step 7: 运行测试确认通过**

Run: `node --test tests/store.test.js`
Expected: 全部 PASS

- [ ] **Step 8: 提交**

```bash
git add miniprogram/utils/store.js tests/store.test.js
git commit -m "feat: store 支持课程分组"
```

---

### Task 3: 时段纯函数工具

**Files:**
- Create: `miniprogram/utils/course-slots.js`
- Create: `tests/course-slots.test.js`
- Modify: `package.json`（test 脚本加入新测试文件）

**Interfaces:**
- Consumes: 无
- Produces:
  - `duplicateSlotIndex(slots) => number`（重复行的下标，没有则返回 -1）
  - `buildCourseRecords(slots, base) => 课程数组`，每个元素含 `day/startSection/endSection` 与 `base` 的其他字段
  - `slotsFromCourse(course) => [{ day, startSection, endSection }]`

- [ ] **Step 1: 写失败测试 `tests/course-slots.test.js`**

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const slotsUtil = require('../miniprogram/utils/course-slots')

test('duplicateSlotIndex 找到完全重复的时间段', () => {
  const slots = [
    { day: 1, startSection: 1, endSection: 2 },
    { day: 3, startSection: 3, endSection: 4 },
    { day: 1, startSection: 1, endSection: 2 }
  ]
  assert.equal(slotsUtil.duplicateSlotIndex(slots), 2)
})

test('duplicateSlotIndex 没有重复时返回 -1', () => {
  const slots = [
    { day: 1, startSection: 1, endSection: 2 },
    { day: 3, startSection: 3, endSection: 4 }
  ]
  assert.equal(slotsUtil.duplicateSlotIndex(slots), -1)
})

test('buildCourseRecords 把公共字段复制到每条记录', () => {
  const records = slotsUtil.buildCourseRecords(
    [
      { day: 1, startSection: 1, endSection: 2 },
      { day: 3, startSection: 3, endSection: 4 }
    ],
    { name: '高数', weeks: [1, 2], groupId: 'g1' }
  )
  assert.equal(records.length, 2)
  assert.equal(records[0].name, '高数')
  assert.equal(records[1].day, 3)
  assert.equal(records[1].groupId, 'g1')
})

test('slotsFromCourse 兼容没有时段数组的旧数据', () => {
  assert.deepEqual(
    slotsUtil.slotsFromCourse({ day: 2, startSection: 1, endSection: 2 }),
    [{ day: 2, startSection: 1, endSection: 2 }]
  )
})
```

- [ ] **Step 2: 运行测试确认失败**

Run: `node --test tests/course-slots.test.js`
Expected: FAIL，提示找不到模块 `course-slots`

- [ ] **Step 3: 创建 `miniprogram/utils/course-slots.js`**

```js
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
```

- [ ] **Step 4: 把新测试加入 `package.json`**

在 `"test": "node --test ..."` 的文件列表末尾（`tests/transfer.test.js` 之后）加入 ` tests/course-slots.test.js`。

- [ ] **Step 5: 运行测试确认通过**

Run: `node --test tests/course-slots.test.js`
Expected: 全部 PASS

- [ ] **Step 6: 提交**

```bash
git add miniprogram/utils/course-slots.js tests/course-slots.test.js package.json
git commit -m "feat: 增加多时段纯函数工具"
```

---

### Task 4: 课程编辑页改造为多时段录入

**Files:**
- Modify: `miniprogram/pages/course-edit/course-edit.js`
- Modify: `miniprogram/pages/course-edit/course-edit.wxml`
- Modify: `miniprogram/pages/course-edit/course-edit.wxss`

**Interfaces:**
- Consumes: `courseSlots.slotsFromCourse`、`courseSlots.buildCourseRecords`、`courseSlots.duplicateSlotIndex`、`store.upsertCourses`、`store.deleteCourseGroup`、`store.getCourseGroup`、`store.genGroupId`
- Produces: 页面 data 中的 `slots`、`groupId`、`syncGroup`、`groupCount`；`onAddSlot`、`onRemoveSlot` 等处理函数

- [ ] **Step 1: 替换 `onLoad` 中的单天逻辑**

在文件顶部引入：

```js
const courseSlots = require('../../utils/course-slots')
```

把 `onLoad` 中构造 `day / startSection / endSection / startIndex / endIndex` 的代码替换为：

```js
    const sections = settings.sections
    const baseSlot = {
      day: course ? Number(course.day) : Number(options.day) || 1,
      startSection: course ? Number(course.startSection) : Number(options.section) || 1,
      endSection: course ? Number(course.endSection) : Number(options.section) || 1
    }

    const groupId = course && course.groupId ? course.groupId : ''
    const group = groupId ? store.getCourseGroup(groupId) : []
    const sourceSlots = group.length ? group : [baseSlot]
    const slots = sourceSlots.map((item) => this.toSlotRow(item, sections))
```

- [ ] **Step 2: 在 Page 对象中添加辅助方法**

```js
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
```

- [ ] **Step 3: 更新 `setData` 中的字段**

在 `onLoad` 的 `this.setData({ ... })` 中，把 `day / dayIndex / startSection / endSection / startIndex / endIndex` 替换为：

```js
      slots,
      groupId,
      groupCount: group.length,
      syncGroup: group.length > 1,
```

完整 `setData` 应仍包含：`isEdit, courseId, name, teacher, location, weekChips, weekCount, colorIndex, remark, credit, sections, sectionLabels, totalWeeks`。

- [ ] **Step 4: 添加时段行的事件处理函数**

删除原来的 `onDayChange`、`onStartChange`、`onEndChange`，替换为：

```js
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
```

- [ ] **Step 5: 重写 `onSave`**

```js
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

    const editingGroup = this.data.isEdit && this.data.groupId && this.data.syncGroup
    const groupId =
      editingGroup || (!this.data.isEdit && slots.length > 1)
        ? this.data.groupId || store.genGroupId()
        : this.data.groupId || ''

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

    if (editingGroup) {
      // 整组重建：时段增删、改名、改周次都一次同步
      store.deleteCourseGroup(this.data.groupId)
      store.upsertCourses(courseSlots.buildCourseRecords(slots, base))
    } else {
      const records = courseSlots.buildCourseRecords(slots, base)
      records[0].id = this.data.courseId || ''
      store.upsertCourses([records[0]])
    }

    wx.showToast({ title: '已保存', icon: 'success' })
    setTimeout(() => wx.navigateBack(), 350)
  },
```

- [ ] **Step 6: 替换 WXML 中的「星期 / 开始节次 / 结束节次」区块**

删除原来包含三个 `picker` 的 `<view class="form-card">`（第 33–66 行左右），替换为：

```xml
  <view class="form-card">
    <view class="slot-head">
      <view class="form-title">上课时间</view>
      <view class="form-hint">可以添加多个时间段，节次可以不同</view>
    </view>

    <view wx:for="{{slots}}" wx:key="key" class="slot-row">
      <picker
        mode="selector"
        range="{{days}}"
        value="{{item.dayIndex}}"
        data-index="{{index}}"
        bindchange="onSlotDayChange"
      >
        <view class="slot-picker">{{days[item.dayIndex]}}</view>
      </picker>

      <picker
        mode="selector"
        range="{{sectionLabels}}"
        value="{{item.startIndex}}"
        data-index="{{index}}"
        bindchange="onSlotStartChange"
      >
        <view class="slot-picker">第 {{item.startSection}} 节</view>
      </picker>

      <text class="slot-dash">-</text>

      <picker
        mode="selector"
        range="{{sectionLabels}}"
        value="{{item.endIndex}}"
        data-index="{{index}}"
        bindchange="onSlotEndChange"
      >
        <view class="slot-picker">第 {{item.endSection}} 节</view>
      </picker>

      <text
        wx:if="{{slots.length > 1}}"
        class="slot-remove"
        data-index="{{index}}"
        catchtap="onRemoveSlot"
      >删除</text>
    </view>

    <view class="slot-add" bindtap="onAddSlot">+ 添加时间段</view>

    <view wx:if="{{isEdit && groupCount > 1}}" class="sync-row" bindtap="onToggleSyncGroup">
      <text class="sync-box {{syncGroup ? 'checked' : ''}}">{{syncGroup ? '✓' : ''}}</text>
      <text class="sync-text">同时修改这门课的其他 {{groupCount - 1}} 个时段</text>
    </view>
  </view>
```

- [ ] **Step 7: 在 `course-edit.wxss` 添加样式**

```css
.slot-head {
  margin-bottom: 14rpx;
}

.slot-row {
  display: flex;
  align-items: center;
  margin-bottom: 14rpx;
}

.slot-picker {
  padding: 16rpx 14rpx;
  background: var(--soft);
  border-radius: 12rpx;
  font-size: 25rpx;
}

.slot-row > picker {
  margin-right: 10rpx;
}

.slot-dash {
  margin-right: 10rpx;
  color: var(--muted);
}

.slot-remove {
  margin-left: auto;
  font-size: 22rpx;
  color: var(--danger);
}

.slot-add {
  padding: 18rpx 0;
  text-align: center;
  font-size: 25rpx;
  color: var(--text);
  border: 1rpx dashed var(--line);
  border-radius: 14rpx;
}

.sync-row {
  display: flex;
  align-items: center;
  margin-top: 20rpx;
}

.sync-box {
  width: 32rpx;
  height: 32rpx;
  line-height: 32rpx;
  text-align: center;
  border-radius: 8rpx;
  border: 1rpx solid var(--line);
  font-size: 22rpx;
  margin-right: 12rpx;
}

.sync-box.checked {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
}

.sync-text {
  font-size: 23rpx;
  color: var(--muted);
}
```

- [ ] **Step 8: 运行页面加载测试与审计**

Run: `npm test && npm run audit`
Expected: 94 项全部 PASS，审计通过

- [ ] **Step 9: 提交**

```bash
git add miniprogram/pages/course-edit miniprogram/utils/course-slots.js
git commit -m "feat: 课程编辑支持多时段"
```

---

### Task 5: 周次格子显示日期 + 按日期添加

**Files:**
- Modify: `miniprogram/pages/course-edit/course-edit.js`
- Modify: `miniprogram/pages/course-edit/course-edit.wxml`
- Modify: `miniprogram/pages/course-edit/course-edit.wxss`

**Interfaces:**
- Consumes: `dateUtil.weekDateLabels`、`dateUtil.semesterDateRange`、`dateUtil.getWeekNumber`、`dateUtil.parseDate`、`dateUtil.formatShortDate`
- Produces: 页面 data 中的 `weekChips[].label`、`currentWeekLabel`、`dateRange`、`pickedHint`；`onPickDate`、`onUseCurrentWeek`、`onUseAllWeeks`

- [ ] **Step 1: 引入日期工具并在 `onLoad` 构造带日期的周次**

文件顶部添加：

```js
const dateUtil = require('../../utils/date')
```

把 `weekChips` 的构造替换为：

```js
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
```

- [ ] **Step 2: 在 `setData` 中加入新字段**

```js
      weekChips,
      weekCount: weeks.length,
      dateRange,
      currentWeekLabel,
      pickedHint: '',
```

- [ ] **Step 3: 添加新的事件处理函数（放在 `applyChips` 之后）**

```js
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
```

- [ ] **Step 4: 让手动改周次清除提示**

把 `applyChips` 改成：

```js
  applyChips(chips) {
    this.setData({
      weekChips: chips,
      weekCount: chips.filter((chip) => chip.selected).length,
      pickedHint: ''
    })
  },
```

- [ ] **Step 5: 替换周次区块的 WXML**

把原来的「上课周次」卡片替换为：

```xml
  <view class="form-card">
    <view class="week-head">
      <view>
        <view class="form-title">上课周次</view>
        <view class="form-hint">已选 {{weekCount}} 周</view>
      </view>
      <view class="week-actions">
        <text class="mini-btn" bindtap="onSelectAllWeeks">全选</text>
        <text class="mini-btn" bindtap="onSelectOddWeeks">单周</text>
        <text class="mini-btn" bindtap="onSelectEvenWeeks">双周</text>
        <text class="mini-btn" bindtap="onClearWeeks">清空</text>
      </view>
    </view>

    <view wx:if="{{currentWeekLabel}}" class="week-now">
      <text class="week-now-text">{{currentWeekLabel}}</text>
      <text class="week-now-btn" bindtap="onUseCurrentWeek">只选本周</text>
    </view>
    <view wx:elif="{{!dateRange}}" class="week-now">
      <text class="week-now-text">先设置开学日期，才能按日期添加</text>
      <text class="week-now-btn" bindtap="onGoSettings">去设置</text>
    </view>

    <view class="date-row">
      <text class="date-label">按日期添加</text>
      <picker
        wx:if="{{dateRange}}"
        mode="date"
        start="{{dateRange.start}}"
        end="{{dateRange.end}}"
        bindchange="onPickDate"
      >
        <view class="date-value">选择日期 ›</view>
      </picker>
      <text wx:else class="date-value disabled">请先设置开学日期</text>
    </view>

    <view wx:if="{{pickedHint}}" class="picked-hint">
      <text class="picked-text">{{pickedHint}}</text>
      <text class="picked-link" bindtap="onUseAllWeeks">改为每周都上</text>
    </view>

    <view class="week-grid">
      <view
        wx:for="{{weekChips}}"
        wx:key="week"
        class="week-chip {{item.selected ? 'selected' : ''}}"
        data-index="{{index}}"
        bindtap="onWeekToggle"
      >
        <text class="chip-week">{{item.week}}</text>
        <text class="chip-date">{{item.label}}</text>
      </view>
    </view>
  </view>
```

- [ ] **Step 6: 添加「去设置」跳转**

```js
  onGoSettings() {
    wx.navigateTo({ url: '/pages/settings/settings' })
  },
```

- [ ] **Step 7: 在 `course-edit.wxss` 添加样式**

```css
.week-now {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 16rpx;
  margin-bottom: 14rpx;
  background: var(--soft);
  border-radius: 12rpx;
}

.week-now-text {
  font-size: 22rpx;
  color: var(--muted);
}

.week-now-btn {
  font-size: 22rpx;
  color: var(--text);
  text-decoration: underline;
}

.date-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.date-label {
  font-size: 24rpx;
  color: var(--muted);
}

.date-value {
  font-size: 24rpx;
  color: var(--text);
}

.date-value.disabled {
  color: var(--muted);
}

.picked-hint {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12rpx 16rpx;
  margin-bottom: 14rpx;
  background: #e8f2ea;
  border-radius: 12rpx;
}

.picked-text {
  font-size: 22rpx;
  color: #2f6b45;
}

.picked-link {
  font-size: 22rpx;
  color: #2f6b45;
  text-decoration: underline;
}

.week-chip {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10rpx 0;
}

.chip-week {
  font-size: 25rpx;
  line-height: 1.2;
}

.chip-date {
  font-size: 17rpx;
  color: var(--muted);
  line-height: 1.3;
}

.week-chip.selected .chip-date {
  color: rgba(255, 255, 255, 0.85);
}
```

- [ ] **Step 8: 运行测试与审计**

Run: `npm test && npm run audit`
Expected: 全部 PASS；审计提示没有缺失的事件处理函数

- [ ] **Step 9: 提交**

```bash
git add miniprogram/pages/course-edit
git commit -m "feat: 周次显示日期并支持按日期添加"
```

---

### Task 6: 分组删除

**Files:**
- Modify: `miniprogram/pages/course-edit/course-edit.js`

**Interfaces:**
- Consumes: `store.getCourseGroup`、`store.deleteCourseGroup`、`store.deleteCourse`
- Produces: 无新导出，仅改 `onDelete` 行为

- [ ] **Step 1: 替换 `onDelete`**

```js
  onDelete() {
    if (!this.data.isEdit) return

    const group = this.data.groupId ? store.getCourseGroup(this.data.groupId) : []
    if (group.length > 1) {
      wx.showActionSheet({
        itemList: [
          '删除整门课（' + group.length + ' 个时段）',
          '只删除当前时段'
        ],
        success: (res) => {
          if (res.tapIndex === 0) {
            store.deleteCourseGroup(this.data.groupId)
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 300)
          } else if (res.tapIndex === 1) {
            store.deleteCourse(this.data.courseId)
            wx.showToast({ title: '已删除', icon: 'success' })
            setTimeout(() => wx.navigateBack(), 300)
          }
        }
      })
      return
    }

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
  },
```

- [ ] **Step 2: 运行测试与审计**

Run: `npm test && npm run audit`
Expected: 全部 PASS

- [ ] **Step 3: 提交**

```bash
git add miniprogram/pages/course-edit/course-edit.js
git commit -m "feat: 支持按整组或单条删除课程"
```

---

### Task 7: 文档与整体验证

**Files:**
- Modify: `docs/manual-test.md`

**Interfaces:**
- Consumes: 前六个任务的成果
- Produces: 手工测试清单

- [ ] **Step 1: 在 `docs/manual-test.md` 用例表末尾追加**

```markdown
| 27 | 多时段添加 | 添加课程，点两次「添加时间段」，设置周一 1-2 节、周三 3-4 节 | 课表两处都显示，名称一致 |
| 28 | 时段重复校验 | 添加两个完全相同的时间段 | 保存被拦截并提示 |
| 29 | 同组改名 | 编辑其中一个色块，改名并保持「同时修改其他时段」勾选 | 另一个时段同步改名 |
| 30 | 取消同步 | 编辑时取消勾选 | 时段列表只剩当前时段 |
| 31 | 删除整门 | 删除时选「删除整门课」 | 两个时段都消失 |
| 32 | 删除单条 | 删除时选「只删除当前时段」 | 另一个仍保留 |
| 33 | 周次日期 | 打开添加课程 | 每个周次格子显示周号和日期 |
| 34 | 按日期添加 | 选 11 月 5 日 | 只勾选对应周，提示「只这一次」 |
| 35 | 改为每周 | 点提示条右侧「改为每周都上」 | 变为全选 |
| 36 | 未设开学日期 | 清空开学日期后打开添加课程 | 日期选择器禁用，显示「去设置」 |
```

并在「记录」表格末尾补上 27–36 的空行。

- [ ] **Step 2: 全量测试**

Run: `npm test`
Expected: 全部 PASS（约 100 项）

- [ ] **Step 3: 页面审计**

Run: `npm run audit`
Expected: `审计通过：事件处理函数、页面跳转、页面字样均正常`

- [ ] **Step 4: 真机验证**

用开发者工具编译后在手机预览，依次执行手工测试清单 27–36。

- [ ] **Step 5: 提交**

```bash
git add docs/manual-test.md
git commit -m "docs: 补充多时段与按日期添加的测试用例"
```

---

## 自检结果

- 规格覆盖：多时段录入（Task 3、4）、周次日期与按日期添加（Task 1、5）、分组编辑与删除（Task 2、4、6）、测试与文档（Task 7）均有对应任务。
- 未改动规格中声明不改的文件。
- 类型与命名一致：`groupId`、`slots`、`syncGroup`、`buildCourseRecords`、`duplicateSlotIndex` 在各任务中保持一致。
- 无占位符。

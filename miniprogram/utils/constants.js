// 课程块配色：低饱和、深色文字可读
const PALETTE = [
  '#f6c6d0',
  '#f7e3a1',
  '#c9ecd2',
  '#bfe3f7',
  '#d9c8f2',
  '#f7d3b3',
  '#c8e6e0',
  '#e6d3b3',
  '#d6e8b8',
  '#f2c9e6',
  '#cfe0f7',
  '#f4d6d0'
]

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']

const TERMS = [
  { label: '第一学期', value: '3' },
  { label: '第二学期', value: '12' },
  { label: '短学期', value: '16' }
]

// 默认作息示例：共 11 节，请按所在学校实际时间修改。
const DEFAULT_SECTIONS = [
  { number: 1, startTime: '08:00', endTime: '08:45' },
  { number: 2, startTime: '08:55', endTime: '09:40' },
  { number: 3, startTime: '10:25', endTime: '11:10' },
  { number: 4, startTime: '11:15', endTime: '12:00' },
  { number: 5, startTime: '14:00', endTime: '14:45' },
  { number: 6, startTime: '14:50', endTime: '15:35' },
  { number: 7, startTime: '15:55', endTime: '16:40' },
  { number: 8, startTime: '16:45', endTime: '17:30' },
  { number: 9, startTime: '18:30', endTime: '19:15' },
  { number: 10, startTime: '19:20', endTime: '20:05' },
  { number: 11, startTime: '20:10', endTime: '20:55' }
]

const DEFAULT_SETTINGS = {
  semesterStartDate: '',
  totalWeeks: 20,
  firstDayOfWeek: 1,
  showWeekends: false,
  sections: DEFAULT_SECTIONS,
  jwBaseUrl: '',
  term: { xnm: '', xqm: '3' },
  defaultTab: 'schedule'
}

module.exports = {
  PALETTE,
  WEEKDAYS,
  TERMS,
  DEFAULT_SECTIONS,
  DEFAULT_SETTINGS
}

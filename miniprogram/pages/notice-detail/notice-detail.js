const noticeUtil = require('../../utils/notices')
const markdown = require('../../utils/markdown')

Page({
  data: {
    loading: true,
    error: '',
    notice: null,
    blocks: []
  },

  onLoad(options) {
    this.id = options && options.id ? decodeURIComponent(options.id) : ''
    this.load()
  },

  load() {
    if (!this.id) {
      this.setData({ loading: false, error: '缺少公告 id' })
      return
    }

    this.setData({ loading: true, error: '' })

    noticeUtil
      .fetchDetail(this.id)
      .then((notice) => {
        if (!notice) {
          this.setData({ loading: false, error: '公告不存在或已删除' })
          return
        }
        // 打开详情才算已读
        noticeUtil.markRead(this.id)
        this.setData({
          loading: false,
          notice,
          blocks: markdown.parseMarkdown(notice.content)
        })
      })
      .catch((err) => {
        this.setData({
          loading: false,
          error: (err && err.message) || '公告详情加载失败'
        })
      })
  },

  onRetry() {
    this.load()
  },

  onCopyGroup() {
    const qqGroup = this.data.notice && this.data.notice.qqGroup
    if (!qqGroup) return

    wx.setClipboardData({
      data: qqGroup,
      success: () => {
        wx.showModal({
          title: '群号已复制',
          content: '打开 QQ，搜索 ' + qqGroup + ' 即可加入交流群。',
          showCancel: false
        })
      },
      fail: (err) => {
        console.warn('复制群号失败', err)
        wx.showModal({
          title: '复制失败',
          content: '请长按页面上的群号手动选择复制。',
          showCancel: false
        })
      }
    })
  }
})

const noticeUtil = require('../../utils/notices')
const markdown = require('../../utils/markdown')

Page({
  data: {
    loading: true,
    error: '',
    notice: null,
    blocks: [],
    banner: null
  },

  onLoad(options) {
    this.id = options && options.id ? decodeURIComponent(options.id) : ''
    if (!this.id) {
      this.setData({ loading: false, error: '缺少公告 id' })
      return
    }

    const cached = noticeUtil.getCachedNotice(this.id)
    if (cached) {
      // 先用本地缓存立即渲染，再悄悄刷新，避免打开详情时干等云函数。
      this.render(cached)
      this.refresh(true)
    } else {
      this.refresh(false)
    }

    // onLoad 之后马上会触发 onShow，跳过这一次，避免重复请求。
    this._skipNextShow = true
  },

  onShow() {
    if (this._skipNextShow) {
      this._skipNextShow = false
      return
    }
    if (!this.id || this.data.loading || !this.data.notice) return
    this.refresh(true)
  },

  onPullDownRefresh() {
    this.refresh(true).then(
      () => wx.stopPullDownRefresh(),
      () => wx.stopPullDownRefresh()
    )
  },

  render(notice) {
    noticeUtil.markRead(this.id)
    this.setData({
      loading: false,
      error: '',
      notice,
      blocks: markdown.parseMarkdown(notice.content)
    })
  },

  // silent=true 表示页面上已经显示了内容，这次刷新不能打断阅读
  async refresh(silent) {
    if (this._refreshing) return
    this._refreshing = true
    if (!silent) this.setData({ loading: true, error: '' })

    const current = this.data.notice

    try {
      const notice = await noticeUtil.fetchDetail(this.id)
      if (!notice) {
        this.handleDeleted(!!current)
        return
      }

      if (current && noticeUtil.sameNotice(current, notice)) {
        // 正文没变：只同步浏览量和更新时间，不提示
        this.setData({
          loading: false,
          notice: Object.assign({}, current, {
            views: notice.views,
            updatedAt: notice.updatedAt,
            updatedDatetimeLabel: notice.updatedDatetimeLabel,
            hasUpdate: notice.hasUpdate
          })
        })
        noticeUtil.patchCachedNotice(this.id, notice)
        return
      }

      const wasRendered = !!current
      this.render(notice)
      noticeUtil.patchCachedNotice(this.id, notice)

      if (wasRendered) {
        this.setData({
          banner: {
            type: 'updated',
            text: '公告已于 ' + notice.updatedDatetimeLabel + ' 更新'
          }
        })
      }
    } catch (err) {
      const code = err && err.code
      if (code === 'NOT_FOUND') {
        this.handleDeleted(!!current)
        return
      }
      if (current) {
        // 有缓存时网络失败不打扰用户，继续显示旧内容
        this.setData({ loading: false })
        return
      }
      this.setData({
        loading: false,
        error: (err && err.message) || '公告详情加载失败'
      })
    } finally {
      this._refreshing = false
    }
  },

  handleDeleted(hasContent) {
    noticeUtil.removeCachedNotice(this.id)
    if (!hasContent) {
      this.setData({ loading: false, error: '公告不存在或已删除' })
      return
    }
    this.setData({
      loading: false,
      banner: { type: 'deleted', text: '这条公告已被删除' }
    })
  },

  onBack() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/schedule/schedule' })
    })
  },

  onRetry() {
    this.setData({ banner: null })
    this.refresh(false)
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

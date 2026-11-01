// 微信文件选择、读取和分享。
const MAX_SIZE = 5 * 1024 * 1024

function chooseFile() {
  return new Promise((resolve, reject) => {
    if (!wx.chooseMessageFile) {
      reject(new Error('当前微信版本不支持选择文件'))
      return
    }

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json', 'csv', 'ics', 'txt'],
      success: (res) => {
        const file = res && res.tempFiles && res.tempFiles[0]
        if (!file) {
          reject(new Error('没有选择文件'))
          return
        }
        if (file.size && file.size > MAX_SIZE) {
          reject(new Error('文件超过 5MB，无法导入'))
          return
        }
        resolve(file)
      },
      fail: (err) => {
        const message = (err && err.errMsg) || ''
        if (message.indexOf('cancel') >= 0) {
          reject(new Error('CANCELLED'))
          return
        }
        reject(new Error(message || '选择文件失败'))
      }
    })
  })
}

function readText(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'utf8',
      success: (res) => resolve(String(res.data || '')),
      fail: (err) => reject(new Error((err && err.errMsg) || '读取文件失败'))
    })
  })
}

function extensionOf(name) {
  const matched = String(name || '').toLowerCase().match(/\.([a-z0-9]+)$/)
  return matched ? matched[1] : ''
}

function detectType(name, content) {
  const ext = extensionOf(name)
  if (ext === 'json' || ext === 'csv' || ext === 'ics') return ext
  const text = String(content || '').trim()
  if (text[0] === '{' || text[0] === '[') return 'json'
  if (/BEGIN:VCALENDAR/i.test(text)) return 'ics'
  if (/,/.test(text.split(/\r?\n/)[0] || '')) return 'csv'
  return ''
}

function shareText(content, ext, baseName) {
  return new Promise((resolve, reject) => {
    if (!wx.env || !wx.env.USER_DATA_PATH) {
      reject(new Error('当前环境不支持写入文件'))
      return
    }

    const fileName = baseName + '.' + ext
    const filePath = wx.env.USER_DATA_PATH + '/' + baseName + '.' + ext
    const fileSystem = wx.getFileSystemManager()

    // 必须同步写完文件，紧接着调用 shareFileMessage。
    // 如果先异步 writeFile，回调里再分享，会丢失用户点击手势，报
    // "fail can be invoked by user TAP gesture"。
    try {
      fileSystem.writeFileSync(filePath, content, 'utf8')
    } catch (err) {
      reject(new Error((err && err.errMsg) || '写入文件失败'))
      return
    }

    const copyFallback = () => {
      wx.setClipboardData({
        data: content,
        success: () => {
          reject(new Error('文件分享失败，内容已复制到剪贴板'))
        },
        fail: () => reject(new Error('分享文件失败'))
      })
    }

    if (!wx.shareFileMessage) {
      copyFallback()
      return
    }

    wx.shareFileMessage({
      filePath,
      fileName,
      success: () => resolve({ filePath, fileName }),
      fail: (err) => {
        const message = (err && err.errMsg) || ''
        if (message.indexOf('cancel') >= 0) {
          reject(new Error('CANCELLED'))
          return
        }
        copyFallback()
      }
    })
  })
}

module.exports = {
  chooseFile,
  readText,
  detectType,
  extensionOf,
  shareText
}

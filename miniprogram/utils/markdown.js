// 轻量 Markdown：只支持公告需要的标题、加粗、列表、引用。
// 不解析 HTML，渲染时全部作为纯文本节点，不存在注入问题。

function parseInline(text) {
  const source = String(text || '')
  const parts = []
  const regex = /\*\*([\s\S]+?)\*\*/g
  let last = 0
  let match

  while ((match = regex.exec(source))) {
    if (match.index > last) {
      parts.push({ text: source.slice(last, match.index), bold: false })
    }
    parts.push({ text: match[1], bold: true })
    last = match.index + match[0].length
  }

  if (last < source.length) {
    parts.push({ text: source.slice(last), bold: false })
  }
  if (!parts.length) parts.push({ text: '', bold: false })
  return parts.map((part, index) => Object.assign({ key: index }, part))
}

function indentWidth(line) {
  const matched = String(line || '').match(/^[ \t]*/)
  if (!matched) return 0
  return matched[0].replace(/\t/g, '  ').length
}

function listLevel(line) {
  return Math.min(3, Math.floor(indentWidth(line) / 2))
}

function isBlockStart(line) {
  return (
    /^[ \t]*#{1,3}\s+/.test(line) ||
    /^[ \t]*>\s?/.test(line) ||
    /^[ \t]*[-*]\s+/.test(line) ||
    /^[ \t]*\d+[.)]\s+/.test(line)
  )
}

function parseMarkdown(content) {
  const lines = String(content || '').replace(/\r\n/g, '\n').split('\n')
  const blocks = []
  let index = 0
  let match

  while (index < lines.length) {
    const line = lines[index]
    if (!line.trim()) {
      index += 1
      continue
    }

    if ((match = line.match(/^[ \t]*#{1,3}\s+(.*)$/))) {
      const level = line.match(/^[ \t]*(#{1,3})/)[1].length
      blocks.push({
        type: 'heading',
        level,
        parts: parseInline(match[1].trim())
      })
      index += 1
      continue
    }

    if ((match = line.match(/^[ \t]*>\s?(.*)$/))) {
      const quoteLines = []
      while (index < lines.length && (match = lines[index].match(/^[ \t]*>\s?(.*)$/))) {
        quoteLines.push(match[1])
        index += 1
      }
      blocks.push({
        type: 'quote',
        parts: parseInline(quoteLines.join('\n'))
      })
      continue
    }

    if ((match = line.match(/^([ \t]*)[-*]\s+(.*)$/))) {
      const items = []
      while (index < lines.length && (match = lines[index].match(/^([ \t]*)[-*]\s+(.*)$/))) {
        items.push({
          key: items.length,
          level: listLevel(lines[index]),
          parts: parseInline(match[2])
        })
        index += 1
      }
      blocks.push({ type: 'list', ordered: false, items })
      continue
    }

    if ((match = line.match(/^([ \t]*)\d+[.)]\s+(.*)$/))) {
      const items = []
      while (index < lines.length && (match = lines[index].match(/^([ \t]*)\d+[.)]\s+(.*)$/))) {
        items.push({
          key: items.length,
          number: items.length + 1,
          level: listLevel(lines[index]),
          parts: parseInline(match[2])
        })
        index += 1
      }
      blocks.push({ type: 'list', ordered: true, items })
      continue
    }

    const paragraph = []
    while (index < lines.length && lines[index].trim() && !isBlockStart(lines[index])) {
      paragraph.push(lines[index])
      index += 1
    }
    blocks.push({ type: 'paragraph', parts: parseInline(paragraph.join('\n')) })
  }

  return blocks.map((block, index) => Object.assign({ key: index }, block))
}

// 列表摘要用：去掉 Markdown 标记，压成一行。
function stripMarkdown(content) {
  return String(content || '')
    .replace(/^[ \t]*#{1,6}\s+/gm, '')
    .replace(/^[ \t]*>\s?/gm, '')
    .replace(/^[ \t]*[-*]\s+/gm, '')
    .replace(/^[ \t]*\d+[.)]\s+/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

module.exports = {
  parseMarkdown,
  stripMarkdown
}

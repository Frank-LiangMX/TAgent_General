/**
 * strip-design-context / formatDesignContext 单测
 */

import { describe, expect, it } from 'vitest'

import type { DesignContextForAgent } from '@/atoms/design-preview-atoms'
import { formatDesignContextForMessage } from '@/hooks/useDesignContext'

import { stripDesignContextFromUserMessage } from './strip-design-context'

describe('stripDesignContextFromUserMessage', () => {
  it('原样返回无上下文的消息', () => {
    const r = stripDesignContextFromUserMessage('把按钮改成红色')
    expect(r.displayText).toBe('把按钮改成红色')
    expect(r.hadDesignContext).toBe(false)
  })

  it('剥离旧格式前置 DESIGN_PREVIEW 块，只留用户正文', () => {
    const raw = `===== DESIGN_PREVIEW 上下文 START =====
【必读】以下内容是 Design Preview 画布当前状态
[当前 HTML]
\`\`\`html
<html><body>huge</body></html>
\`\`\`
===== DESIGN_PREVIEW 上下文 END =====

----- 以下是用户的实际问题 -----

把按钮改成红色`
    const r = stripDesignContextFromUserMessage(raw)
    expect(r.hadDesignContext).toBe(true)
    expect(r.displayText).toBe('把按钮改成红色')
  })

  it('剥离末尾 <design-context> 块', () => {
    const raw = `把标题加大

<design-context>
[Design Preview 已启用] 当前设备: desktop
[选中的元素]
  - id: d-1, tag: h1, role: heading
</design-context>`
    const r = stripDesignContextFromUserMessage(raw)
    expect(r.hadDesignContext).toBe(true)
    expect(r.displayText).toBe('把标题加大')
  })

  it('空字符串', () => {
    const r = stripDesignContextFromUserMessage('')
    expect(r.displayText).toBe('')
    expect(r.hadDesignContext).toBe(false)
  })
})

describe('formatDesignContextForMessage', () => {
  it('disabled / null 返回空', () => {
    expect(formatDesignContextForMessage(null)).toBe('')
    expect(
      formatDesignContextForMessage({
        designModeEnabled: false,
        device: 'desktop',
      })
    ).toBe('')
  })

  it('有选中时输出元素与选择器，不含整页 HTML', () => {
    const ctx: DesignContextForAgent = {
      designModeEnabled: true,
      device: 'mobile',
      htmlSummary: '登录页摘要很长很长',
      userSelection: {
        region: { x: 0, y: 0, width: 0, height: 0 },
        elements: [
          {
            id: 'd-1',
            tag: 'button',
            text: '登录',
            role: 'button',
            className: 'btn-primary',
            selector: 'form > button.btn-primary',
            bounds: { x: 10, y: 20, width: 100, height: 40 },
          },
        ],
      },
    }
    const text = formatDesignContextForMessage(ctx)
    expect(text).toContain('<design-context>')
    expect(text).toContain('CSS 选择器: form > button.btn-primary')
    expect(text).toContain('id: d-1')
    expect(text).not.toContain('[当前 HTML]')
    expect(text).not.toContain('```html')
    expect(text).not.toContain('[页面摘要]')
  })

  it('无选中时带页面短摘要，不含整页 HTML', () => {
    const ctx: DesignContextForAgent = {
      designModeEnabled: true,
      device: 'desktop',
      htmlSummary: '仪表盘概览',
    }
    const text = formatDesignContextForMessage(ctx)
    expect(text).toContain('[页面摘要] 仪表盘概览')
    expect(text).not.toContain('[当前 HTML]')
    expect(text).not.toContain('[当前 CSS]')
  })
})

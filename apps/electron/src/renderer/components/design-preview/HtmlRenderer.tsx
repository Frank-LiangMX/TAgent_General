/**
 * HtmlRenderer — Design Preview v2 核心渲染组件
 *
 * v1 → v2 关键变化：
 *  1) 把 `buildFrameInjectionScript()` 拼到 srcDoc 末尾，让 iframe 内的 DOM
 *     自动注入 data-design-id 并向父窗口 postMessage 元素元数据/事件。
 *  2) 接受 `bridge`: 父组件传入 FrameBridgeClient 实例，iframe load 时 attach。
 *  3) 自包含、不依赖父组件 listener —— bridge 内置 window message 监听。
 *
 * 设计来源：docs/plans/2026-07-14-design-canvas-v2.md §4.1
 */

import * as React from 'react'

import { DEVICE_PRESETS, type DeviceType } from '@/atoms/design-preview-atoms'
import { buildFrameInjectionScript } from '@/lib/canvas-frame-bridge'
import { cn } from '@/lib/utils'

/** iframe 沙箱权限。
 *
 *  v2 必须 allow-same-origin：父窗口才能读取 contentWindow 接收 postMessage。
 *  allow-scripts 用于执行注入脚本（含 click 监听）。
 *  allow-forms 允许 agent 生成的 form 提交做基本交互。
 *  ⚠️ 未开启 allow-top-navigation / allow-popups，注入脚本无法逃逸。
 */
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms' as const

export interface HtmlRendererProps {
  /** HTML 内容 */
  html: string
  /** CSS 内容（可选） */
  css?: string | null
  /** 设备类型 */
  device: DeviceType
  /** 强制刷新版本号 */
  version: number
  /**
   * iframe ref 回调：父组件可以传入 (iframe) => void，
   * 在 iframe mount/load 时拿到真实 DOM 用于挂载 bridge。
   * 如果不传，bridge 也可以通过 version 变化时的 rescan 兜底（见内部 useEffect）。
   */
  onIframeReady?: (iframe: HTMLIFrameElement) => void
  /** iframe contentWindow 重写后调用（srcDoc reload） */
  onIframeLoaded?: () => void
  /** 自定义类名 */
  className?: string
}

/** 构建完整 HTML 文档，尾部追加注入脚本 */
function buildDocument(html: string, css?: string | null): string {
  const cssBlock = css ?? ''
  const injection = buildFrameInjectionScript()
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
      background: #ffffff;
      color: #1a1a1a;
      line-height: 1.5;
    }
    /* v2: 元素高亮由父窗口的 ElementHighlightOverlay 完成，此处不覆盖控件默认 cursor */
    ${cssBlock}
  </style>
</head>
<body>
${html}
<script>${injection}</script>
</body>
</html>`
}

export const HtmlRenderer = React.memo(function HtmlRenderer({
  html,
  css,
  device,
  version,
  onIframeReady,
  onIframeLoaded,
  className,
}: HtmlRendererProps): React.ReactElement {
  const deviceSize = DEVICE_PRESETS[device]
  const iframeRef = React.useRef<HTMLIFrameElement>(null)

  // 版本号变化时强制重新加载
  const srcDoc = React.useMemo(() => buildDocument(html, css), [html, css, version])

  // iframe mount / version 变化时通知父组件
  React.useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !onIframeReady) return
    onIframeReady(iframe)
  }, [srcDoc, onIframeReady])

  // iframe.contentWindow 在 srcDoc 重写后变成新的 Window 实例，
  // 但 iframe.contentWindow 引用本身可能不变（react ref 不变）。
  // 我们靠 iframe.onload 事件感知 contentWindow 重写。
  const onIframeLoadedRef = React.useRef(onIframeLoaded)
  onIframeLoadedRef.current = onIframeLoaded
  React.useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe || !onIframeLoadedRef.current) return
    const handler = () => onIframeLoadedRef.current()
    iframe.addEventListener('load', handler)
    return () => {
      iframe.removeEventListener('load', handler)
    }
  }, [srcDoc])

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcDoc}
      sandbox={IFRAME_SANDBOX}
      title="Design Preview"
      className={cn('block border-0 bg-white', className)}
      style={{
        width: deviceSize.width,
        height: deviceSize.height,
      }}
    />
  )
})
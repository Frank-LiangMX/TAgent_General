/**
 * BrowserPanel — 通用网页预览面板（薄包装）
 *
 * 实际 webview 逻辑在 WebPreviewFrame；保留本组件供旧引用与右栏复用。
 */

import type { ReactElement } from 'react'

import { WebPreviewFrame, type WebPreviewFrameProps } from './WebPreviewFrame'

export type BrowserPanelProps = WebPreviewFrameProps

export function BrowserPanel(props: BrowserPanelProps): ReactElement {
  return <WebPreviewFrame {...props} showToolbar />
}

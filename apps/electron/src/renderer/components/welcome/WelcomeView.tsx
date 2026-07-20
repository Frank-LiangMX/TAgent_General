/**
 * WelcomeView — 主区域空状态启动器
 *
 * 没有当前模式下打开的会话时展示引导首页（问候 / 快速开始 / 上手指引）。
 */

import * as React from 'react'

import { WelcomeEmptyState } from './WelcomeEmptyState'

export function WelcomeView(): React.ReactElement {
  return <WelcomeEmptyState />
}

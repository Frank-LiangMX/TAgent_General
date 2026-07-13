/**
 * WelcomeView — 主区域空状态启动器
 *
 * 没有当前模式下打开的会话时展示明确引导，由用户主动创建新会话。
 */

import * as React from 'react'

import { WelcomeEmptyState } from './WelcomeEmptyState'

export function WelcomeView(): React.ReactElement {
  return <WelcomeEmptyState />
}

/**
 * SettingsPage - 设置选项页根容器
 *
 * 统一垂直节奏，与 settings-shell pagehead 配套。
 * 各 Tab 根节点应使用本组件，避免各自 space-y-*。
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

type SettingsPageVariant = 'default' | 'dense' | 'dashboard'

interface SettingsPageProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  /** dense: 外观等更紧凑；dashboard: Insights 仪表盘 */
  variant?: SettingsPageVariant
}

const VARIANT_CLASS: Record<SettingsPageVariant, string> = {
  default: 'settings-page',
  dense: 'settings-page settings-page-dense',
  dashboard: 'settings-page settings-page-dashboard',
}

export function SettingsPage({
  children,
  className,
  variant = 'default',
  ...props
}: SettingsPageProps): React.ReactElement {
  return (
    <div className={cn(VARIANT_CLASS[variant], className)} {...props}>
      {children}
    </div>
  )
}

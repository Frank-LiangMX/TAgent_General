/**
 * SettingsSubpageChrome - 设置子页顶栏（返回 + 标题 + 可选右侧动作）
 *
 * 用于渠道表单等替换整页内容的场景，避免与壳层 pagehead 抢「大标题」视觉。
 */

import { ArrowLeft } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

interface SettingsSubpageChromeProps {
  title: string
  onBack: () => void
  action?: React.ReactNode
  className?: string
}

export function SettingsSubpageChrome({
  title,
  onBack,
  action,
  className,
}: SettingsSubpageChromeProps): React.ReactElement {
  return (
    <div className={cn('settings-subpage-chrome', className)}>
      <button type="button" onClick={onBack} className="settings-subpage-back" aria-label="返回">
        <ArrowLeft size={16} strokeWidth={2} />
      </button>
      <h3 className="settings-subpage-title min-w-0 flex-1 truncate">{title}</h3>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

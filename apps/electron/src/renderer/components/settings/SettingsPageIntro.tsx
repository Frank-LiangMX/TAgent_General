/**
 * SettingsPageIntro - 页内轻量标题（替代旧壳层 pagehead）
 */

import * as React from 'react'

import { cn } from '@/lib/utils'

interface SettingsPageIntroProps {
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function SettingsPageIntro({
  title,
  description,
  action,
  className,
}: SettingsPageIntroProps): React.ReactElement {
  return (
    <div className={cn('settings-page-intro', className)}>
      <div className="settings-page-intro-copy">
        <h2 className="settings-page-intro-title">{title}</h2>
        {description ? <p className="settings-page-intro-desc">{description}</p> : null}
      </div>
      {action ? <div className="settings-page-intro-action">{action}</div> : null}
    </div>
  )
}

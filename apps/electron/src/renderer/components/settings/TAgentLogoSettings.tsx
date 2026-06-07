/**
 * TAgentLogoSettings - TAgent 品牌 Logo 下载
 *
 * 当前仅保留主应用图标资源，多色变体已下线，后续按需重新提供。
 */

import * as React from 'react'
import { SettingsSection } from './primitives/SettingsSection'
import { SettingsCard } from './primitives/SettingsCard'

export function TAgentLogoSettings(): React.ReactElement {
  return (
    <>
      <SettingsSection
        title="品牌 Logo"
        description="下载 TAgent Logo 用作机器人头像"
      >
        <SettingsCard divided={false}>
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            当前仅提供主应用 Logo，<br />
            多色变体暂未开放，后续按需添加。
          </div>
        </SettingsCard>
      </SettingsSection>
    </>
  )
}

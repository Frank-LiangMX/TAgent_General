/**
 * DesignImmersiveLayout — Design Preview 沉浸全屏布局
 *
 * 盖住整个壳层（含 left rail），只保留会话 + 画布。
 * macOS 顶栏仅作红绿灯避让 + 拖拽，操作按钮放在 Dock，避免与窗口控制重叠。
 */

import { useAtomValue } from 'jotai'
import * as React from 'react'

import { designImmersiveHideChatAtom } from '@/atoms/design-preview-atoms'
import { MainArea } from '@/components/tabs/MainArea'
import { DesignPreviewPanel } from '@/components/design-preview/DesignPreviewPanel'
import {
  detectIsMac,
  NAV_MAC_CHROME_HEIGHT,
  NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET,
  SHELL_EDGE_PADDING,
} from '@/lib/platform'
import { cn } from '@/lib/utils'

/** macOS 红绿灯组大约占用的水平宽度（相对窗口左缘） */
const MAC_TRAFFIC_LIGHT_RESERVE_X = SHELL_EDGE_PADDING + NAV_MAC_TRAFFIC_LIGHT_RAIL_INSET + 68

export interface DesignImmersiveLayoutProps {
  /** 是否处于打开态（用于进场/退场动画） */
  open: boolean
  className?: string
}

export function DesignImmersiveLayout({
  open,
  className,
}: DesignImmersiveLayoutProps): React.ReactElement {
  const isMac = React.useMemo(() => detectIsMac(), [])
  const hideChat = useAtomValue(designImmersiveHideChatAtom)
  const chromeHeight = isMac ? Math.max(NAV_MAC_CHROME_HEIGHT, 36) : 36

  return (
    <div
      className={cn('design-mode-overlay design-mode-overlay--immersive', className)}
      data-open={open ? 'true' : 'false'}
      aria-hidden={!open}
    >
      {/* 顶栏：只负责拖拽 + mac 红绿灯避让，不放操作按钮（避免与 Win 窗口控制重叠） */}
      <div
        className="relative flex shrink-0 items-center border-b border-border/30 bg-background/90 backdrop-blur titlebar-drag-region"
        style={{
          height: chromeHeight,
          paddingLeft: isMac ? MAC_TRAFFIC_LIGHT_RESERVE_X : 12,
          paddingRight: 12,
        }}
      >
        <span className="text-[11px] text-muted-foreground titlebar-no-drag select-none">
          沉浸全屏 · Esc 退出 · 操作用下方 Dock
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            'design-theater-chat flex h-full shrink-0 flex-col border-r border-border/40 bg-background',
            hideChat && 'design-theater-chat--hidden'
          )}
        >
          <div className="design-theater-chat-inner min-h-0 flex-1">
            <MainArea />
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-hidden">
          <DesignPreviewPanel />
        </div>
      </div>
    </div>
  )
}

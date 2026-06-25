/**
 * WindowDragStrip — 侧栏顶部窗口拖拽条（Windows）
 */

import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

const WINDOWS_SIDEBAR_DRAG_STRIP_HEIGHT = 4
/** 与 TabBar 顶栏高度对齐，供无 TabBar 的主区（文件页等）使用 */
const CONTENT_TOP_DRAG_BAND_HEIGHT = 44
const WINDOWS_WINDOW_CONTROLS_RIGHT_INSET = 126

interface WindowDragStripProps {
  className?: string
  /** 拖拽条下方留白（与 SidebarTopControlsRow 对齐） */
  withSpacer?: boolean
}

export function WindowDragStrip({
  className,
  withSpacer = false,
}: WindowDragStripProps): React.ReactElement | null {
  if (detectIsMac()) return null

  return (
    <div className={cn('relative shrink-0 nav-island-body-start', className)}>
      <div
        aria-hidden
        className="sidebar-window-drag-strip"
        style={{ height: WINDOWS_SIDEBAR_DRAG_STRIP_HEIGHT }}
      />
      {withSpacer ? <div className="h-2 shrink-0" aria-hidden /> : null}
    </div>
  )
}

/** 主内容区顶栏拖拽带（文件页等无 TabBar 路由） */
export function ContentWindowDragBand({
  className,
}: {
  className?: string
}): React.ReactElement | null {
  if (detectIsMac()) return null

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute top-0 left-0 z-[30] titlebar-drag-region', className)}
      style={{
        right: WINDOWS_WINDOW_CONTROLS_RIGHT_INSET,
        height: CONTENT_TOP_DRAG_BAND_HEIGHT,
      }}
    />
  )
}

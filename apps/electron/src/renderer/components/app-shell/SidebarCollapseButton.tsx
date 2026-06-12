/**
 * SidebarCollapseButton — 侧栏折叠/展开（会话页专用）
 */

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getAcceleratorDisplay, getActiveAccelerator } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

interface SidebarCollapseButtonProps {
  collapsed: boolean
  onClick: () => void
  /** rail = 折叠后显示在 Rail 顶；sidebar = 与工作区选择器同行 */
  placement?: 'rail' | 'sidebar'
  className?: string
}

export function SidebarCollapseButton({
  collapsed,
  onClick,
  placement = 'sidebar',
  className,
}: SidebarCollapseButtonProps): React.ReactElement {
  const shortcut = getAcceleratorDisplay(getActiveAccelerator('toggle-sidebar'))

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={collapsed ? '展开侧边栏' : '收起侧边栏'}
          onClick={onClick}
          className={cn(
            'titlebar-no-drag flex shrink-0 items-center justify-center transition-colors duration-100',
            placement === 'rail'
              ? 'button-glass size-10 rounded-[12px] text-foreground/60 hover:text-foreground dark:text-foreground/75'
              : 'size-10 rounded-[12px] border border-border/40 bg-primary/5 text-foreground/50 hover:bg-primary/10 hover:text-foreground/70 hover:border-border/70',
            className,
          )}
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </TooltipTrigger>
      <TooltipContent side={placement === 'rail' ? 'right' : 'bottom'}>
        {collapsed ? '展开侧边栏' : `收起侧边栏 (${shortcut})`}
      </TooltipContent>
    </Tooltip>
  )
}

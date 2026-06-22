/**
 * RightPanelToggle — 右侧文件浮岛统一锚点按钮
 *
 * 锚定于 shell 内边距右缘；开/关完整显示，屏幕位置不变。
 */

import { useAtomValue } from 'jotai'
import { PanelRight, PanelRightClose } from 'lucide-react'
import * as React from 'react'

import { workspaceFilesVersionAtom } from '@/atoms/agent-atoms'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { registerShortcut } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

const SHORTCUT_HINT = navigator.platform.includes('Mac') ? '⌘⇧B' : 'Ctrl+Shift+B'

interface RightPanelToggleProps {
  open: boolean
  onToggle: () => void
  className?: string
}

export function RightPanelToggle({
  open,
  onToggle,
  className,
}: RightPanelToggleProps): React.ReactElement {
  const filesVersion = useAtomValue(workspaceFilesVersionAtom)
  const hasFileChanges = filesVersion > 0

  React.useEffect(() => {
    return registerShortcut('toggle-right-panel', onToggle)
  }, [onToggle])

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'relative size-[36px] shrink-0 rounded-full titlebar-no-drag',
            'text-foreground/60 hover:text-foreground',
            className
          )}
          onClick={onToggle}
          aria-expanded={open}
          aria-label={open ? '折叠文件面板' : '展开文件面板'}
        >
          {open ? <PanelRightClose className="size-4" /> : <PanelRight className="size-4" />}
          {!open && hasFileChanges && (
            <span className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-1 ring-background" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>
          {open ? '折叠' : '展开'}文件面板 ({SHORTCUT_HINT})
        </p>
      </TooltipContent>
    </Tooltip>
  )
}

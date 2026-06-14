/**
 * PermissionModeSelector — Agent 权限模式选择器
 *
 * 圆形按钮 + Popover 三选项形式，与 SubagentEagernessSelector 风格统一。
 * 每个会话独立维护自己的权限模式。
 */

import { TAGENT_PERMISSION_MODE_CONFIG, TAGENT_PERMISSION_MODE_ORDER } from '@tagent/shared'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Zap, Compass, Map as MapIcon } from 'lucide-react'
import * as React from 'react'

import type { TAgentPermissionMode } from '@tagent/shared'

import { agentPermissionModeMapAtom, agentDefaultPermissionModeAtom, sessionPersistedPermissionModeAtom, sessionExistsAtom, agentPlanModeSessionsAtom } from '@/atoms/agent-atoms'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { updatePlanModeSessionSet } from '@/lib/agent-plan-mode'
import { cn } from '@/lib/utils'

const MODE_ICONS: Record<TAgentPermissionMode, React.ComponentType<{ className?: string }>> = {
  auto: Compass,
  bypassPermissions: Zap,
  plan: MapIcon,
}

/** 权限模式对应视觉颜色 */
const MODE_COLORS: Record<TAgentPermissionMode, string> = {
  auto: 'text-foreground/60',
  bypassPermissions: 'text-amber-500 dark:text-amber-400',
  plan: 'text-blue-500 dark:text-blue-400',
}

interface PermissionModeSelectorProps {
  sessionId: string
  /** 禁用切换（Ask 档位下不适用） */
  disabled?: boolean
}

export function PermissionModeSelector({ sessionId, disabled = false }: PermissionModeSelectorProps): React.ReactElement | null {
  const [modeMap, setModeMap] = useAtom(agentPermissionModeMapAtom)
  const setPlanModeSessions = useSetAtom(agentPlanModeSessionsAtom)
  const defaultMode = useAtomValue(agentDefaultPermissionModeAtom)
  const persistedSessionMode = useAtomValue(sessionPersistedPermissionModeAtom(sessionId))
  const mode = modeMap.get(sessionId) ?? persistedSessionMode ?? defaultMode
  const sessionExistsInList = useAtomValue(sessionExistsAtom(sessionId))
  const [open, setOpen] = React.useState(false)

  // 初始化：如果当前 session 不在 Map 中，按以下优先级读回：
  // 1. session meta.permissionMode（每个 tab 独立持久化，重启恢复各自的值）
  // 2. 默认完全自动模式
  React.useEffect(() => {
    if (!sessionExistsInList) return

    setModeMap((prev: Map<string, TAgentPermissionMode>) => {
      if (prev.has(sessionId)) return prev
      const next = new Map(prev)
      next.set(sessionId, persistedSessionMode ?? defaultMode)
      return next
    })
  }, [sessionId, persistedSessionMode, sessionExistsInList, defaultMode, setModeMap])

  /** 切换到指定模式（乐观更新 + 失败回滚） */
  const selectMode = React.useCallback(async (nextMode: TAgentPermissionMode) => {
    if (disabled) return
    const prevMode = mode

    setOpen(false)

    // 乐观更新当前 session 的模式
    setModeMap((prev: Map<string, TAgentPermissionMode>) => {
      const next = new Map(prev)
      next.set(sessionId, nextMode)
      return next
    })
    setPlanModeSessions((prev: Set<string>) =>
      updatePlanModeSessionSet(prev, sessionId, nextMode === 'plan')
    )

    // 热切换运行中的当前 session；失败时回滚 modeMap 保持 UI/后端一致
    try {
      await window.electronAPI.updateSessionPermissionMode(sessionId, nextMode)
    } catch (error) {
      console.error('[PermissionModeSelector] 运行中切换权限模式失败，回滚 UI:', error)
      setModeMap((prev: Map<string, TAgentPermissionMode>) => {
        const next = new Map(prev)
        next.set(sessionId, prevMode)
        return next
      })
      setPlanModeSessions((prev: Set<string>) =>
        updatePlanModeSessionSet(prev, sessionId, prevMode === 'plan')
      )
    }
  }, [disabled, mode, sessionId, setModeMap, setPlanModeSessions])

  const config = TAGENT_PERMISSION_MODE_CONFIG[mode]
  const Icon = MODE_ICONS[mode]
  const colorClass = MODE_COLORS[mode]

  if (disabled) {
    // Ask 档位下：纯展示（不接收点击），Tooltip 文案改为说明
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={config.label}
              disabled
              className={cn('size-[36px] rounded-full opacity-40 cursor-not-allowed', colorClass)}
            >
              <Icon className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="font-medium">Ask 档位不适用</p>
            <p className="text-xs text-muted-foreground mt-0.5">权限模式是 Agent 档位的概念，Ask 不能写文件或执行命令</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={config.label}
                className={cn('size-[36px] rounded-full', colorClass)}
              >
                <Icon className="size-5" />
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="bottom" className="max-w-[200px]">
            <p className="font-medium">{config.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
            <p className="text-xs text-muted-foreground mt-1">点击切换模式</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-auto min-w-[200px] p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-0.5">
          {TAGENT_PERMISSION_MODE_ORDER.map((k) => {
            const cfg = TAGENT_PERMISSION_MODE_CONFIG[k]
            const ModeIcon = MODE_ICONS[k]
            return (
              <button
                key={k}
                type="button"
                onClick={() => { selectMode(k) }}
                className={cn(
                  'flex items-start gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  mode === k && 'bg-accent/50',
                )}
              >
                <ModeIcon className="size-4 mt-0.5 shrink-0 text-foreground/70" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium">{cfg.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{cfg.description}</span>
                </div>
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

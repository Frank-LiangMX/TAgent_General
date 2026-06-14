/**
 * ComposerModeSelector — Composer 档位切换器
 *
 * 圆形按钮 + Popover 两选项形式（Ask | Agent），与 PermissionModeSelector 风格统一。
 *
 * - Ask = 只对话，不能写文件、不能执行命令、不能 MCP/Skills
 * - Agent = 可动手（走 SDK orchestrator，默认）
 *
 * 档位切换会触发 AgentView 重新路由发送分支（ask 走 ask-service，agent 走 runAgent）。
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { MessageCircle, Zap } from 'lucide-react'
import * as React from 'react'

import { DEFAULT_COMPOSER_MODE, type ComposerMode } from '@tagent/shared'

import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { currentComposerModeAtom, composerModeMapAtom, composerModeSyncedSessionsAtom } from '@/atoms/composer-atoms'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const MODE_ICONS: Record<ComposerMode, React.ComponentType<{ className?: string }>> = {
  ask: MessageCircle,
  agent: Zap,
}

/** 档位对应视觉颜色 */
const MODE_COLORS: Record<ComposerMode, string> = {
  ask: 'text-blue-500 dark:text-blue-400',
  agent: 'text-foreground/60',
}

/** 档位元数据 */
const MODE_META: Record<ComposerMode, { label: string; description: string }> = {
  ask: {
    label: 'Ask',
    description: '只对话，不修改文件或执行命令',
  },
  agent: {
    label: 'Agent',
    description: '可动手：工具、工作区、MCP、Skills',
  },
}

interface ComposerModeSelectorProps {
  /** 透传到 button 的 className（用于控制位置/尺寸） */
  className?: string
}

export function ComposerModeSelector({ className }: ComposerModeSelectorProps): React.ReactElement | null {
  const currentMode = useAtomValue(currentComposerModeAtom)
  const [modeMap, setModeMap] = useAtom(composerModeMapAtom)
  const addSynced = useSetAtom(composerModeSyncedSessionsAtom)
  const sessionId = useAtomValue(currentAgentSessionIdAtom)
  const [open, setOpen] = React.useState(false)

  /** 切换到指定档位（乐观更新 + IPC 落盘） */
  const selectMode = React.useCallback(async (nextMode: ComposerMode) => {
    if (!sessionId) return
    const prevMode = modeMap.get(sessionId) ?? currentMode
    if (prevMode === nextMode) {
      setOpen(false)
      return
    }

    setOpen(false)

    // 乐观更新
    setModeMap((prev) => {
      const next = new Map(prev)
      next.set(sessionId, nextMode)
      return next
    })

    try {
      await window.electronAPI.setComposerMode(sessionId, nextMode)
      addSynced((prev) => {
        const next = new Set(prev)
        next.add(sessionId)
        return next
      })
    } catch (error) {
      console.error('[ComposerModeSelector] 切换档位失败，回滚 UI:', error)
      setModeMap((prev) => {
        const next = new Map(prev)
        next.set(sessionId, prevMode)
        return next
      })
    }
  }, [sessionId, currentMode, modeMap, setModeMap, addSynced])

  // 没有当前会话时不渲染（但 AgentView 通常保证有 sessionId）
  if (!sessionId) return null

  const Icon = MODE_ICONS[currentMode]
  const colorClass = MODE_COLORS[currentMode]
  const meta = MODE_META[currentMode]

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
                aria-label={meta.label}
                className={cn('size-[36px] rounded-full', colorClass, className)}
              >
                <Icon className="size-5" />
              </Button>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            <p className="font-medium">{meta.label} 档位</p>
            <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
            <p className="text-xs text-muted-foreground mt-1">点击切换档位</p>
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
          {(['ask', 'agent'] as const).map((k) => {
            const cfg = MODE_META[k]
            const ModeIcon = MODE_ICONS[k]
            return (
              <button
                key={k}
                type="button"
                onClick={() => { selectMode(k) }}
                className={cn(
                  'flex items-start gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors',
                  'hover:bg-accent hover:text-accent-foreground',
                  currentMode === k && 'bg-accent/50',
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

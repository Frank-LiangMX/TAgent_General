/**
 * ComposerModeSelector — Composer 档位切换器
 *
 * 简化设计：默认 Agent 模式，点击 Ask 图标按钮切换到 Ask 模式。
 * Ask 激活时按钮高亮，再点击切回 Agent。
 *
 * - Ask = 只对话，不能写文件、不能执行命令、不能 MCP/Skills
 * - Agent = 可动手（走 SDK orchestrator，默认）
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { MessageSquareText } from 'lucide-react'
import * as React from 'react'

import { DEFAULT_COMPOSER_MODE, type ComposerMode } from '@tagent/shared'

import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { currentComposerModeAtom, composerModeMapAtom, composerModeSyncedSessionsAtom } from '@/atoms/composer-atoms'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ComposerModeSelectorProps {
  /** 透传到 button 的 className（用于控制位置/尺寸） */
  className?: string
}

export function ComposerModeSelector({ className }: ComposerModeSelectorProps): React.ReactElement | null {
  const currentMode = useAtomValue(currentComposerModeAtom)
  const [modeMap, setModeMap] = useAtom(composerModeMapAtom)
  const addSynced = useSetAtom(composerModeSyncedSessionsAtom)
  const sessionId = useAtomValue(currentAgentSessionIdAtom)

  const isAskMode = currentMode === 'ask'

  /** 切换档位 */
  const toggleMode = React.useCallback(async () => {
    if (!sessionId) return

    const nextMode: ComposerMode = isAskMode ? 'agent' : 'ask'
    const prevMode = currentMode

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
  }, [sessionId, currentMode, isAskMode, setModeMap, addSynced])

  // 没有当前会话时不渲染
  if (!sessionId) return null

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={isAskMode ? 'Ask 模式（点击切回 Agent）' : '切换到 Ask 模式'}
            onClick={toggleMode}
            className={cn(
              'size-[36px] rounded-full',
              isAskMode
                ? 'text-blue-500 dark:text-blue-400 bg-blue-500/10'
                : 'text-foreground/60 hover:text-foreground',
              className
            )}
          >
            <MessageSquareText className="size-5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[200px]">
          {isAskMode ? (
            <>
              <p className="font-medium text-blue-500">Ask 模式</p>
              <p className="text-xs text-muted-foreground mt-0.5">只对话，不修改文件或执行命令</p>
              <p className="text-xs text-muted-foreground mt-1">点击切回 Agent</p>
            </>
          ) : (
            <>
              <p className="font-medium">Agent 模式</p>
              <p className="text-xs text-muted-foreground mt-0.5">点击切换到 Ask（只对话）</p>
            </>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

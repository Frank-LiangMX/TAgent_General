/**
 * AgentSwitchBanner — Ask → Agent 档位升级引导
 *
 * 当 Ask 流式中模型调用 suggest_agent_switch 工具时，
 * 在 Composer 上方展示升级横幅（与 AskUserBanner / PermissionBanner 同位置）。
 *
 * 与 AgentRecommendBanner 的关键区别：
 * - AgentRecommendBanner：Chat 模式 → 创建新 Agent 会话 + 迁移历史（跨会话）
 * - AgentSwitchBanner：Ask 档位 → 切到 Agent 档位（**同会话、不创建新会话**）
 *
 * 升级流程：
 * 1. 清除 pendingAgentSwitchSuggestionAtom
 * 2. 调用 setComposerMode(sessionId, 'agent') 持久化 + 本地缓存
 * 3. 写入 agentPromptSuggestionsAtom，预填 suggestedPrompt
 * 4. AgentView 监听该 atom，点击后发送（与现有 prompt-suggestion 行为一致）
 */

import { useAtom, useAtomValue, useStore } from 'jotai'
import { Sparkles, X, ArrowRight } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { currentAgentSessionIdAtom, agentPromptSuggestionsAtom } from '@/atoms/agent-atoms'
import { pendingAgentSwitchSuggestionAtom } from '@/atoms/ask-atoms'
import {
  composerModeMapAtom,
  composerModeSyncedSessionsAtom,
  currentComposerModeAtom,
} from '@/atoms/composer-atoms'
import { Button } from '@/components/ui/button'

export function AgentSwitchBanner(): React.ReactElement | null {
  const [suggestion, setSuggestion] = useAtom(pendingAgentSwitchSuggestionAtom)
  const store = useStore()
  const composerMode = useAtomValue(currentComposerModeAtom)
  const [switching, setSwitching] = React.useState(false)

  // 仅在 ask 档位下展示：用户已切到 agent 档位后自动消失（用户主动接受/忽略都已处理）
  if (!suggestion || composerMode !== 'ask') return null

  const handleDismiss = (): void => {
    setSuggestion(null)
  }

  const handleSwitch = async (): Promise<void> => {
    if (switching) return
    const sessionId = store.get(currentAgentSessionIdAtom)
    if (!sessionId) {
      toast.error('当前没有选中的会话')
      return
    }

    const { suggestedPrompt } = suggestion

    // 先清建议，避免后续 effect 误读
    setSuggestion(null)
    setSwitching(true)

    try {
      // 1. 乐观更新本地档位
      store.set(composerModeMapAtom, (prev) => {
        const next = new Map(prev)
        next.set(sessionId, 'agent')
        return next
      })
      store.set(composerModeSyncedSessionsAtom, (prev) => {
        const next = new Set(prev)
        next.add(sessionId)
        return next
      })

      // 2. IPC 落盘
      await window.electronAPI.setComposerMode(sessionId, 'agent')

      // 3. 预填 suggestedPrompt 到 AgentView 的输入区草稿
      //    （agentPromptSuggestionsAtom 的现有行为：AgentView 监听后展示为 suggestion chip，
      //    用户点击 chip 或 Enter 触发发送——与 chat recommend banner 一致）
      store.set(agentPromptSuggestionsAtom, (prev) => {
        const map = new Map(prev)
        map.set(sessionId, suggestedPrompt)
        return map
      })

      // 4. 通知用户
      toast.success('已切到 Agent 档位', {
        description: '点击输入区的建议提示即可发送',
      })
    } catch (error) {
      console.error('[AgentSwitchBanner] 切换档位失败，回滚 UI:', error)
      // 回滚本地档位（不主动回滚 IPC 端，主进程已是 agent，期望态）
      store.set(composerModeMapAtom, (prev) => {
        const next = new Map(prev)
        next.set(sessionId, 'ask')
        return next
      })
      toast.error('切换档位失败')
    } finally {
      setSwitching(false)
    }
  }

  return (
    <div className="session-glass-modal mx-4 mb-2 overflow-hidden animate-in slide-in-from-bottom-2 duration-200">
      {/* 头部 */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-blue-500" />
            <span className="text-sm font-medium text-foreground">需要 Agent 档位才能完成</span>
          </div>
          <button
            type="button"
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={handleDismiss}
            aria-label="关闭"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 升级理由 */}
      <div className="px-4 pb-3">
        <p className="text-sm text-foreground/80 leading-relaxed">{suggestion.reason}</p>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center justify-end px-4 pb-3">
        <Button
          variant="default"
          size="sm"
          onClick={handleSwitch}
          disabled={switching}
          className="h-7 px-3 text-xs"
        >
          {switching ? '切换中...' : '切到 Agent 档位并预填'}
          {!switching && <ArrowRight className="size-3 ml-1" />}
        </Button>
      </div>
    </div>
  )
}

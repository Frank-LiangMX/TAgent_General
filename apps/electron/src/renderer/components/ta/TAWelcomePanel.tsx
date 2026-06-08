/**
 * TAWelcomePanel — TA 模式『会话』Tab 的主区内容
 *
 * 占据主区的 TA 模式下『与 Agent 沟通』入口位置。
 *
 * 当前实现：占位面板，引导用户创建或打开 TA 会话。
 * 数据隔离：TA 会话在 agent-sessions 表中以 mode: 'ta' 标记，与通用模式互不干扰。
 *
 * 完整流程（待实现）：
 * 1. 用户在主区输入问题 → 调用 createAgentSession({ mode: 'ta' })
 * 2. 切换到通用模式 → useOpenSession 打开该 session
 * 3. 通用模式的 AgentView 渲染该 session（自动注入 TA system prompt 和工具集）
 */

import { MessageSquare, ArrowRight } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { useOpenSession } from '@/hooks/useOpenSession'
import { useCreateSession } from '@/hooks/useCreateSession'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { useSetAtom } from 'jotai'

export function TAWelcomePanel(): React.ReactElement {
  const setTopLevelMode = useSetAtom(topLevelModeAtom)
  const createSession = useCreateSession()
  const openSession = useOpenSession()

  const handleStartTAChat = React.useCallback(async () => {
    // 创建 TA 会话 → 切到通用模式 → 打开该 session
    const meta = await createSession.createAgent({ mode: 'ta' })
    if (!meta) return
    setTopLevelMode('general')
    openSession('agent', meta.id, meta.title)
  }, [createSession, openSession, setTopLevelMode])

  return (
    <div className="h-full flex items-center justify-center bg-content-area">
      <div className="max-w-md text-center px-6">
        <div className="size-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <MessageSquare size={24} />
        </div>
        <h2 className="text-lg font-medium text-foreground mb-2">
          与 Agent 对话
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          在 TA 模式下与 Agent 沟通，所有会话数据独立存储。<br />
          点击下方按钮创建一个新的 TA 会话。
        </p>
        <Button onClick={handleStartTAChat} className="gap-2">
          开始新对话
          <ArrowRight size={14} />
        </Button>
      </div>
    </div>
  )
}

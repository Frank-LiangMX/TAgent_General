/**
 * WelcomeEmptyState — 会话空状态引导
 *
 * 在没有会话时展示：
 * 1. 个性化时段问候
 * 2. Agent 相关操作提示
 * 3. 主操作按钮（新建 Agent 会话）
 *
 * 注：Chat/Agent 模式切换已移至 Composer 档位，此处不再展示 Tab。
 */

import { useAtomValue } from 'jotai'
import { Bot, Loader2, Sparkles } from 'lucide-react'
import * as React from 'react'

import { Button } from '@tagent/ui'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { userProfileAtom } from '@/atoms/user-profile'
import { useCreateSession } from '@/hooks/useCreateSession'

/** 根据小时返回时段问候 */
function getGreeting(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

/** 与模式相关的操作提示 */
const MODE_TIPS: Record<string, string> = {
  agent: '附加文件夹让 Agent 访问你的项目',
  ta: '选择工作区来配置项目资产规范',
}

export function WelcomeEmptyState(): React.ReactElement {
  const userProfile = useAtomValue(userProfileAtom)
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const { createAgent } = useCreateSession()
  const [creating, setCreating] = React.useState(false)

  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const displayName = userProfile.userName || '用户'

  const isTAMode = topLevelMode === 'ta'
  const primaryLabel = isTAMode ? '新建 TA 会话' : '开始新 Agent 会话'

  const tipKey = isTAMode ? 'ta' : 'agent'
  const tipText = MODE_TIPS[tipKey] ?? MODE_TIPS['agent']!

  /** 创建新 Agent 会话 */
  const handleStart = React.useCallback(async (): Promise<void> => {
    if (creating) return
    setCreating(true)
    try {
      if (isTAMode) {
        await createAgent({ mode: 'ta' })
      } else {
        await createAgent({ mode: 'general' })
      }
    } finally {
      setCreating(false)
    }
  }, [creating, isTAMode, createAgent])

  return (
    <div className="flex h-full flex-col items-center justify-center px-4">
      {/* 核心内容区 — 紧凑垂直节奏 */}
      <div className="flex flex-col items-center gap-1">
        {/* 问候语 */}
        <h1 className="text-[28px] font-semibold tracking-tight text-foreground">
          {displayName}，{greeting}
        </h1>

        {/* 操作提示 */}
        <p className="text-[13px] text-muted-foreground">{tipText}</p>
      </div>

      {/* 提示标签 */}
      <div className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-muted/50 px-3.5 py-1.5 text-[11px] text-muted-foreground/70">
        <Sparkles size={12} className="opacity-60" />
        {isTAMode
          ? '先配置项目规则，再开始 TA 会话'
          : '从一个新会话开始，让 Agent 接入你的当前工作'}
      </div>

      {/* 主按钮 */}
      <Button
        size="lg"
        onClick={() => {
          void handleStart()
        }}
        disabled={creating}
        className="mt-6 gap-2 rounded-full"
      >
        {creating ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
        {primaryLabel}
      </Button>
    </div>
  )
}

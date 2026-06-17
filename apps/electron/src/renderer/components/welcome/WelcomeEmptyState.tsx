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
import { Bot, Loader2 } from 'lucide-react'
import * as React from 'react'

import { topLevelModeAtom } from '@/atoms/app-mode'
import { userProfileAtom } from '@/atoms/user-profile'
import { useCreateSession } from '@/hooks/useCreateSession'
import { cn } from '@/lib/utils'

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
      {/* 问候语 — hero */}
      <h1 className="text-[30px] font-semibold tracking-tight text-foreground">
        {displayName}，{greeting}
      </h1>

      {/* 操作提示 — supporting */}
      <p className="mt-2.5 text-[13px] text-muted-foreground">{tipText}</p>

      {/* 呼吸空间 — 信息区与操作区分离 */}
      <div className="h-14" />

      {/* 主按钮 */}
      <button
        type="button"
        onClick={() => {
          void handleStart()
        }}
        disabled={creating}
        className={cn(
          'mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60'
        )}
      >
        {creating ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />}
        {primaryLabel}
      </button>
    </div>
  )
}

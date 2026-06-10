/**
 * WelcomeEmptyState — 对话/会话空状态引导
 *
 * 在没有会话时展示：
 * 1. 个性化时段问候
 * 2. 与当前模式相关的操作提示（随模式切换变化）
 * 3. Chat/Agent 模式切换 Tab
 * 4. 主操作按钮
 */

import { useAtomValue, useAtom } from 'jotai'
import { MessageSquare, Bot, StickyNote, Loader2 } from 'lucide-react'
import * as React from 'react'

import { appModeAtom, topLevelModeAtom, type AppMode } from '@/atoms/app-mode'
import { themeStyleAtom } from '@/atoms/theme'
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

/** 模式配置 */
const MODE_CONFIG: Record<AppMode, { icon: React.ReactNode; label: string }> = {
  chat: { icon: <MessageSquare size={15} />, label: 'Chat' },
  agent: { icon: <Bot size={15} />, label: 'Agent' },
  scratch: { icon: <StickyNote size={15} />, label: 'Scratch Pad' },
}

/** 与模式相关的操作提示 — 索引稳定，随模式切换 */
const MODE_TIPS: Record<string, string> = {
  agent: '附加文件夹让 Agent 访问你的项目',
  chat: '点击输入栏右侧切换模型和渠道',
  ta: '选择工作区来配置项目资产规范',
}

export function WelcomeEmptyState(): React.ReactElement {
  const userProfile = useAtomValue(userProfileAtom)
  const [mode, setMode] = useAtom(appModeAtom)
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const themeStyle = useAtomValue(themeStyleAtom)
  const { createChat, createAgent } = useCreateSession()
  const [creating, setCreating] = React.useState(false)

  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const displayName = userProfile.userName || '用户'

  const selectedColor = themeStyle === 'forest-light' ? '#3f8361' : undefined
  const isTAMode = topLevelMode === 'ta'
  const primaryLabel = isTAMode
    ? '新建 TA 会话'
    : mode === 'chat'
      ? '开始新对话'
      : '开始新 Agent 会话'

  const tipKey = isTAMode ? 'ta' : mode
  const tipText = MODE_TIPS[tipKey] ?? MODE_TIPS['agent']!

  /** 切换模式 */
  const handleModeSwitch = React.useCallback((targetMode: AppMode): void => {
    if (targetMode === mode) return
    setMode(targetMode)
  }, [mode, setMode])

  /** 创建新会话 */
  const handleStart = React.useCallback(async (): Promise<void> => {
    if (creating) return
    setCreating(true)
    try {
      if (isTAMode) {
        await createAgent({ mode: 'ta' })
      } else if (mode === 'chat') {
        await createChat()
      } else {
        await createAgent({ mode: 'general' })
      }
    } finally {
      setCreating(false)
    }
  }, [creating, isTAMode, mode, createAgent, createChat])

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

      {/* 模式切换 Tab — 仅非 TA 模式 */}
      {!isTAMode && (
        <div className="relative flex rounded-xl bg-muted/60 p-1">
          <div
            className={cn(
              'absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-lg bg-background shadow-sm transition-transform duration-300 ease-in-out',
              mode === 'agent' ? 'translate-x-0' : 'translate-x-full',
            )}
          />
          {(['agent', 'chat'] as const).map((m) => {
            const config = MODE_CONFIG[m]
            const isSelected = mode === m
            return (
              <button
                key={m}
                onClick={() => handleModeSwitch(m)}
                style={isSelected && selectedColor ? { color: selectedColor } : undefined}
                className={cn(
                  'relative z-[1] flex items-center gap-1.5 rounded-lg px-5 py-1.5 text-[13px] font-medium transition-colors duration-200',
                  isSelected
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {config.icon}
                {config.label}
              </button>
            )
          })}
        </div>
      )}

      {/* 主按钮 */}
      <button
        type="button"
        onClick={() => { void handleStart() }}
        disabled={creating}
        className={cn(
          'mt-3 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-60',
        )}
      >
        {creating
          ? <Loader2 size={16} className="animate-spin" />
          : isTAMode || mode === 'agent'
            ? <Bot size={16} />
            : <MessageSquare size={16} />}
        {primaryLabel}
      </button>
    </div>
  )
}

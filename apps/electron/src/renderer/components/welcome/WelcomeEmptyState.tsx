/**
 * WelcomeEmptyState — 无会话时的启动引导
 *
 * 参考市面 Agent 首页：问候 + 主 CTA + 快速开始卡片 + 上手指引。
 * 表面用 kanban-crew-badge（spatial 浮岛），避免白卡片发亮。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import {
  ArrowRight,
  BookOpen,
  Bug,
  Code2,
  FolderOpen,
  Loader2,
  MessageSquare,
  MessageSquarePlus,
  Settings2,
  Sparkles,
  Telescope,
} from 'lucide-react'
import * as React from 'react'

import { AssistantPresence } from './assistant-presence/AssistantPresence'
import { beginAssistantPresenceTransition } from './assistant-presence/assistant-presence-transition'

import {
  agentSessionDraftHtmlAtom,
  agentSessionDraftsAtom,
  agentSessionsAtom,
} from '@/atoms/agent-atoms'
import { topLevelModeAtom } from '@/atoms/app-mode'
import { channelsAtom } from '@/atoms/model-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import { userProfileAtom } from '@/atoms/user-profile'
import { useCreateSession } from '@/hooks/useCreateSession'
import { useOpenSession } from '@/hooks/useOpenSession'
import { cn } from '@/lib/utils'

/** 根据小时返回时段问候 */
function getGreeting(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

interface QuickStartItem {
  id: string
  title: string
  description: string
  prompt: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>
  iconClass: string
}

interface GuideItem {
  id: string
  title: string
  description: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>
  iconClass: string
  action: 'channels' | 'attach-hint' | 'tutorial'
}

const GENERAL_QUICK_STARTS: QuickStartItem[] = [
  {
    id: 'explore',
    title: '探索代码库',
    description: '摸清目录结构与关键入口',
    prompt:
      '请先探索当前工作区的目录结构，总结项目类型、主要模块和我接下来最该看的文件，用简洁中文回复。',
    Icon: Telescope,
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'feature',
    title: '实现一个功能',
    description: '从需求说到可落地的改动',
    prompt:
      '我想实现一个新功能。请先向我确认目标与约束，再给出实现计划（涉及文件、步骤、风险），等我确认后再动手。',
    Icon: Code2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'debug',
    title: '排查问题',
    description: '定位报错与可疑改动',
    prompt:
      '我遇到了一个问题需要排查。请先让我补充报错信息或复现步骤，再给出假设、排查顺序和需要查看的文件。',
    Icon: Bug,
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
]

const TA_QUICK_STARTS: QuickStartItem[] = [
  {
    id: 'ta-rules',
    title: '核对项目规范',
    description: '检查资产与流水线约定',
    prompt:
      '请检查当前 TA 工作区的项目规范与资产约定，总结已配置项、缺失项，以及我接下来最该补齐什么。',
    Icon: Sparkles,
    iconClass: 'text-violet-600 dark:text-violet-400',
  },
  {
    id: 'ta-pipeline',
    title: '跑通资产流程',
    description: '从导入到产出一步步走',
    prompt:
      '我想跑通一条资产处理流程。请先确认当前工具与工作区状态，再给出可执行步骤，缺配置时明确告诉我。',
    Icon: Code2,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'ta-review',
    title: '审查资产质量',
    description: '找出命名与规范问题',
    prompt:
      '请审查当前工作区资产质量（命名、目录、规范符合度），列出问题清单并按优先级给出修复建议。',
    Icon: Bug,
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
]

const GENERAL_GUIDES: GuideItem[] = [
  {
    id: 'channels',
    title: '配置模型渠道',
    description: '接入 API Key，选好默认模型',
    Icon: Settings2,
    iconClass: 'text-teal-700 dark:text-teal-400',
    action: 'channels',
  },
  {
    id: 'attach',
    title: '附加项目文件夹',
    description: '开会话后在右侧挂上本地目录',
    Icon: FolderOpen,
    iconClass: 'text-blue-600 dark:text-blue-400',
    action: 'attach-hint',
  },
  {
    id: 'tutorial',
    title: '查看新手教程',
    description: '快速了解会话、权限与工具',
    Icon: BookOpen,
    iconClass: 'text-violet-600 dark:text-violet-400',
    action: 'tutorial',
  },
]

const TA_GUIDES: GuideItem[] = [
  {
    id: 'channels',
    title: '配置模型渠道',
    description: 'TA 会话同样依赖可用渠道',
    Icon: Settings2,
    iconClass: 'text-teal-700 dark:text-teal-400',
    action: 'channels',
  },
  {
    id: 'attach',
    title: '选择工作区',
    description: '在侧栏绑定项目资产目录',
    Icon: FolderOpen,
    iconClass: 'text-blue-600 dark:text-blue-400',
    action: 'attach-hint',
  },
  {
    id: 'tutorial',
    title: '查看新手教程',
    description: '了解 TA 模式与工具链',
    Icon: BookOpen,
    iconClass: 'text-violet-600 dark:text-violet-400',
    action: 'tutorial',
  },
]

function SectionLabel({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <p className="mb-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-foreground/40">
      {children}
    </p>
  )
}

function GuideCard({
  title,
  description,
  Icon,
  iconClass,
  onClick,
  disabled,
  trailing,
}: {
  title: string
  description: string
  Icon: React.ComponentType<{ className?: string; strokeWidth?: string | number }>
  iconClass: string
  onClick: () => void
  disabled?: boolean
  trailing?: React.ReactNode
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'kanban-crew-badge group flex w-full items-start gap-3 p-3.5 text-left titlebar-no-drag ui-pressable',
        'disabled:pointer-events-none disabled:opacity-50'
      )}
    >
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-glass-popover bg-foreground/[0.05]',
          iconClass
        )}
      >
        <Icon className="size-4" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium tracking-tight text-foreground">
            {title}
          </span>
          {trailing}
          <ArrowRight className="ml-auto size-3.5 shrink-0 text-foreground/25 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/50" />
        </div>
        <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/50">{description}</p>
      </div>
    </button>
  )
}

export function WelcomeEmptyState(): React.ReactElement {
  const userProfile = useAtomValue(userProfileAtom)
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const channels = useAtomValue(channelsAtom)
  const sessions = useAtomValue(agentSessionsAtom)
  const { createAgent } = useCreateSession()
  const openSession = useOpenSession()
  const setDraftsMap = useSetAtom(agentSessionDraftsAtom)
  const setDraftHtmlMap = useSetAtom(agentSessionDraftHtmlAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)

  const [busyId, setBusyId] = React.useState<string | null>(null)

  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const displayName = userProfile.userName || '用户'
  const isTAMode = topLevelMode === 'ta'
  const mode: 'general' | 'ta' = isTAMode ? 'ta' : 'general'
  const primaryLabel = isTAMode ? '新建 TA 会话' : '新会话'
  const hasChannel = channels.length > 0

  const quickStarts = isTAMode ? TA_QUICK_STARTS : GENERAL_QUICK_STARTS
  const guides = isTAMode ? TA_GUIDES : GENERAL_GUIDES

  const recentSessions = React.useMemo(() => {
    return sessions
      .filter((s) => !s.archived && (s.mode ?? 'general') === mode && !s.parentBoardId)
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 3)
  }, [sessions, mode])

  const runCreate = React.useCallback(
    async (key: string, prompt?: string): Promise<void> => {
      if (busyId) return
      setBusyId(key)
      const transition = beginAssistantPresenceTransition(
        document.querySelector<HTMLElement>('[data-assistant-transition-source="true"]')
      )
      try {
        const draftText = prompt?.trim() ?? ''
        const session = await createAgent({
          mode,
          // 先完成欢迎卡片离场，再打开会话；草稿仍在 AgentView 挂载前写入。
          beforeOpen: async (session) => {
            if (draftText) {
              setDraftsMap((prev) => {
                const map = new Map(prev)
                map.set(session.id, draftText)
                return map
              })
              setDraftHtmlMap((prev) => {
                const map = new Map(prev)
                map.delete(session.id)
                return map
              })
            }
            await transition?.readyForNavigation
          },
        })
        if (!session) {
          transition?.cancel()
          return
        }
        await transition?.finish(session.id)
        if (draftText) {
          requestAnimationFrame(() => {
            window.dispatchEvent(new CustomEvent('tagent:focus-input'))
          })
        }
      } finally {
        transition?.cancel()
        setBusyId(null)
      }
    },
    [busyId, createAgent, mode, setDraftHtmlMap, setDraftsMap]
  )

  const handleGuide = React.useCallback(
    (action: GuideItem['action']): void => {
      if (action === 'channels') {
        setSettingsTab('channels')
        setSettingsOpen(true)
        return
      }
      if (action === 'tutorial') {
        setSettingsTab('tutorial')
        setSettingsOpen(true)
        return
      }
      // 附加文件夹：先开会话，用户在会话右侧挂目录
      void runCreate('attach-hint')
    },
    [runCreate, setSettingsOpen, setSettingsTab]
  )

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-6 py-10 scrollbar-thin">
      <div
        className="my-auto w-full max-w-[720px] animate-in fade-in-0 duration-300"
        data-assistant-welcome-transition
      >
        <div className="assistant-presence-stage">
          <AssistantPresence roaming transitionSource />
        </div>
        {/* 头栏：对齐侧栏 sidebar-head（kicker + 标题 + accent 胶囊），不用实心主按钮 */}
        <header
          className="kanban-crew-badge mb-7 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5"
          data-welcome-transition-direction="left"
          data-welcome-transition-item
        >
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/35">
              {isTAMode ? 'TA MODE' : 'WORKSPACE'}
            </p>
            <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-[color:var(--spatial-ink,hsl(var(--foreground)))]">
              {displayName}，{greeting}
            </h1>
            <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/45">
              {isTAMode
                ? '配置工作区与规范后，开始一条 TA 会话'
                : '选一条快捷路径，或直接开空白会话'}
            </p>
          </div>
          <button
            type="button"
            disabled={!!busyId}
            onClick={() => void runCreate('primary')}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-glass-popover px-3.5 text-[12px] font-semibold tracking-tight titlebar-no-drag ui-pressable',
              'text-[color:var(--spatial-accent,hsl(var(--primary)))] bg-[var(--spatial-accent-soft,hsl(var(--primary)/0.12))]',
              'hover:brightness-[1.03] disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            {busyId === 'primary' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <MessageSquare className="size-3.5" strokeWidth={1.75} />
            )}
            {primaryLabel}
          </button>
        </header>

        {/* 快速开始 */}
        <section
          className="mb-6"
          data-welcome-transition-direction="right"
          data-welcome-transition-item
        >
          <SectionLabel>快速开始</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {quickStarts.map((item) => {
              const busy = busyId === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  disabled={!!busyId}
                  onClick={() => void runCreate(item.id, item.prompt)}
                  className={cn(
                    'kanban-crew-badge group flex h-full flex-col items-start gap-3 p-3.5 text-left titlebar-no-drag ui-pressable',
                    'disabled:pointer-events-none disabled:opacity-50'
                  )}
                >
                  <div
                    className={cn(
                      'flex size-8 items-center justify-center rounded-glass-popover bg-foreground/[0.05]',
                      item.iconClass
                    )}
                  >
                    {busy ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <item.Icon className="size-3.5" strokeWidth={1.75} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium tracking-tight text-foreground">
                      {item.title}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/50">
                      {item.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        {/* 上手指引 */}
        <section
          className="mb-6"
          data-welcome-transition-direction="left"
          data-welcome-transition-item
        >
          <SectionLabel>上手指引</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {guides.map((item) => (
              <GuideCard
                key={item.id}
                title={item.title}
                description={item.description}
                Icon={item.Icon}
                iconClass={item.iconClass}
                onClick={() => handleGuide(item.action)}
                disabled={!!busyId && item.action === 'attach-hint'}
                trailing={
                  item.action === 'channels' && !hasChannel ? (
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">
                      未配置
                    </span>
                  ) : null
                }
              />
            ))}
          </div>
        </section>

        {/* 最近会话 */}
        {recentSessions.length > 0 ? (
          <section data-welcome-transition-direction="right" data-welcome-transition-item>
            <SectionLabel>最近会话</SectionLabel>
            <div className="overflow-hidden rounded-glass-popover border border-foreground/[0.06] bg-foreground/[0.03]">
              {recentSessions.map((session, idx) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => openSession('agent', session.id, session.title, mode)}
                  className={cn(
                    'group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors hover:bg-foreground/[0.04]',
                    idx > 0 && 'border-t border-foreground/[0.05]'
                  )}
                >
                  <MessageSquarePlus className="size-3.5 shrink-0 text-foreground/35" />
                  <span className="min-w-0 flex-1 truncate text-[12px] text-foreground/80">
                    {session.title || '未命名会话'}
                  </span>
                  <ArrowRight className="size-3 shrink-0 text-foreground/20 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground/45" />
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

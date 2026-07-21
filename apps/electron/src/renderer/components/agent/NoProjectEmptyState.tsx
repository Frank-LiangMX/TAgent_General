/**
 * NoProjectEmptyState — 无项目工作区时的启动引导
 *
 * 视觉与交互对齐 WelcomeEmptyState：
 * kanban-crew-badge 浮岛 + 分区标签 + 软 accent CTA，避免白卡片发亮。
 * 主行动：选择本地代码目录并创建项目工作区。
 */

import { useAtomValue, useSetAtom } from 'jotai'
import {
  ArrowRight,
  BookOpen,
  Code2,
  FolderOpen,
  Loader2,
  Settings2,
  Shield,
  Sparkles,
  Telescope,
  type LucideIcon,
} from 'lucide-react'
import * as React from 'react'

import { topLevelModeAtom } from '@/atoms/app-mode'
import { channelsAtom } from '@/atoms/model-atoms'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import { userProfileAtom } from '@/atoms/user-profile'
import { useWorkspaceActions } from '@/hooks/useWorkspaceActions'
import { cn } from '@/lib/utils'

/** 根据小时返回时段问候 */
function getGreeting(hour: number): string {
  if (hour < 6) return '夜深了'
  if (hour < 12) return '早上好'
  if (hour < 18) return '下午好'
  return '晚上好'
}

interface BenefitItem {
  id: string
  title: string
  description: string
  Icon: LucideIcon
  iconClass: string
}

interface GuideItem {
  id: string
  title: string
  description: string
  Icon: LucideIcon
  iconClass: string
  action: 'channels' | 'pick-project' | 'tutorial'
}

const BENEFITS: BenefitItem[] = [
  {
    id: 'explore',
    title: '在真实代码里工作',
    description: 'Agent 直接读写你选择的项目目录',
    Icon: Telescope,
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'tools',
    title: '工具与权限落在项目内',
    description: '命令、文件改动都以该目录为边界',
    Icon: Shield,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'sessions',
    title: '会话绑定项目上下文',
    description: '后续会话默认在此项目中继续协作',
    Icon: Code2,
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
]

const GENERAL_GUIDES: GuideItem[] = [
  {
    id: 'pick',
    title: '选择项目目录',
    description: '打开本地文件夹，创建第一个项目',
    Icon: FolderOpen,
    iconClass: 'text-blue-600 dark:text-blue-400',
    action: 'pick-project',
  },
  {
    id: 'channels',
    title: '配置模型渠道',
    description: '接入 API Key，选好默认模型',
    Icon: Settings2,
    iconClass: 'text-teal-700 dark:text-teal-400',
    action: 'channels',
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
    id: 'pick',
    title: '选择资产工作区',
    description: '绑定本地项目 / 资产目录',
    Icon: FolderOpen,
    iconClass: 'text-blue-600 dark:text-blue-400',
    action: 'pick-project',
  },
  {
    id: 'channels',
    title: '配置模型渠道',
    description: 'TA 会话同样依赖可用渠道',
    Icon: Settings2,
    iconClass: 'text-teal-700 dark:text-teal-400',
    action: 'channels',
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
  busy,
}: {
  title: string
  description: string
  Icon: LucideIcon
  iconClass: string
  onClick: () => void
  disabled?: boolean
  trailing?: React.ReactNode
  busy?: boolean
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
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Icon className="size-4" strokeWidth={1.75} />
        )}
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

export function NoProjectEmptyState(): React.ReactElement {
  const userProfile = useAtomValue(userProfileAtom)
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const channels = useAtomValue(channelsAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const { createProject } = useWorkspaceActions()

  const [busy, setBusy] = React.useState(false)

  const hour = new Date().getHours()
  const greeting = getGreeting(hour)
  const displayName = userProfile.userName || '用户'
  const isTAMode = topLevelMode === 'ta'
  const hasChannel = channels.length > 0
  const guides = isTAMode ? TA_GUIDES : GENERAL_GUIDES

  const handlePickProject = React.useCallback(async (): Promise<void> => {
    if (busy) return
    setBusy(true)
    try {
      await createProject()
    } finally {
      setBusy(false)
    }
  }, [busy, createProject])

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
      void handlePickProject()
    },
    [handlePickProject, setSettingsOpen, setSettingsTab]
  )

  return (
    <div className="flex h-full min-h-0 flex-col items-center overflow-y-auto px-6 py-10 scrollbar-thin">
      <div className="my-auto w-full max-w-[720px] animate-in fade-in-0 duration-300">
        {/* 头栏：对齐 WelcomeEmptyState / 侧栏 sidebar-head */}
        <header className="kanban-crew-badge mb-7 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/35">
              {isTAMode ? 'TA MODE' : 'WORKSPACE'}
            </p>
            <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-[color:var(--spatial-ink,hsl(var(--foreground)))]">
              {displayName}，{greeting}
            </h1>
            <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/45">
              {isTAMode
                ? '先绑定本地项目 / 资产目录，再开始 TA 协作'
                : '选择一个本地代码目录，TAgent 将在其中工作'}
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handlePickProject()}
            className={cn(
              'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-glass-popover px-3.5 text-[12px] font-semibold tracking-tight titlebar-no-drag ui-pressable',
              'text-[color:var(--spatial-accent,hsl(var(--primary)))] bg-[var(--spatial-accent-soft,hsl(var(--primary)/0.12))]',
              'hover:brightness-[1.03] disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FolderOpen className="size-3.5" strokeWidth={1.75} />
            )}
            选择目录
          </button>
        </header>

        {/* 选择目录后你将获得 */}
        <section className="mb-6">
          <SectionLabel>选择目录后</SectionLabel>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {BENEFITS.map((item) => (
              <div
                key={item.id}
                className="kanban-crew-badge flex h-full flex-col items-start gap-3 p-3.5"
              >
                <div
                  className={cn(
                    'flex size-8 items-center justify-center rounded-glass-popover bg-foreground/[0.05]',
                    item.iconClass
                  )}
                >
                  <item.Icon className="size-3.5" strokeWidth={1.75} />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium tracking-tight text-foreground">
                    {item.title}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/50">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 上手指引 */}
        <section className="mb-6">
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
                disabled={busy && item.action === 'pick-project'}
                busy={busy && item.action === 'pick-project'}
                trailing={
                  item.action === 'channels' && !hasChannel ? (
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium text-amber-700 dark:text-amber-400">
                      未配置
                    </span>
                  ) : item.action === 'pick-project' ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--spatial-accent-soft,hsl(var(--primary)/0.12))] px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--spatial-accent,hsl(var(--primary)))]">
                      <Sparkles className="size-2.5" strokeWidth={2} />
                      推荐
                    </span>
                  ) : null
                }
              />
            ))}
          </div>
        </section>

        {/* 底部提示 */}
        <p className="text-center text-[11px] leading-relaxed text-foreground/35">
          目录仅作工作区边界，不会上传整盘文件；也可稍后在左侧侧栏新建项目。
        </p>
      </div>
    </div>
  )
}

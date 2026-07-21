/**
 * Onboarding 视图组件
 *
 * 首次启动时显示的全屏欢迎界面。
 * 视觉对齐 WelcomeEmptyState / NoProjectEmptyState：
 * kanban-crew-badge 浮岛 + 分区标签 + 软 accent CTA。
 *
 * 流程：
 *  Step 1：欢迎 + 能力速览 + 教程入口
 *  Step 2：Windows 环境检测（仅 Windows，其他平台自动跳过）
 */

import { useAtomValue } from 'jotai'
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  Code2,
  FolderOpen,
  GraduationCap,
  Loader2,
  MessageSquare,
  Shield,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'

import { ScrollArea, Sheet, SheetContent, SheetHeader, SheetTitle } from '@tagent/ui'
import { isShellEnvironmentOkAtom } from '@/atoms/environment'
import { EnvironmentCheckPanel } from '@/components/environment/EnvironmentCheckPanel'
import { TutorialViewer } from '@/components/tutorial/TutorialViewer'
import { detectIsWindows } from '@/lib/platform'
import { cn } from '@/lib/utils'

interface OnboardingViewProps {
  /** 完成回调（进入主界面） */
  onComplete: () => void
}

interface HighlightItem {
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
  action: 'tutorial' | 'next'
}

const HIGHLIGHTS: HighlightItem[] = [
  {
    id: 'agent',
    title: '通用 Agent 会话',
    description: '对话、改代码、跑命令，一条会话闭环',
    Icon: MessageSquare,
    iconClass: 'text-sky-600 dark:text-sky-400',
  },
  {
    id: 'project',
    title: '项目目录工作区',
    description: '绑定本地代码，工具与改动都落在边界内',
    Icon: FolderOpen,
    iconClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    id: 'permissions',
    title: '权限与计划模式',
    description: '先看计划再动手，关键操作可确认',
    Icon: Shield,
    iconClass: 'text-amber-600 dark:text-amber-400',
  },
]

const GUIDES: GuideItem[] = [
  {
    id: 'tutorial',
    title: '查看使用教程',
    description: '了解会话、权限、工具与快捷操作',
    Icon: BookOpen,
    iconClass: 'text-violet-600 dark:text-violet-400',
    action: 'tutorial',
  },
  {
    id: 'start',
    title: '进入主界面',
    description: '之后也能在设置里找回教程与环境检测',
    Icon: Sparkles,
    iconClass: 'text-teal-700 dark:text-teal-400',
    action: 'next',
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
  trailing,
}: {
  title: string
  description: string
  Icon: LucideIcon
  iconClass: string
  onClick: () => void
  trailing?: React.ReactNode
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'kanban-crew-badge group flex w-full items-start gap-3 p-3.5 text-left titlebar-no-drag ui-pressable'
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

function SoftAccentButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  className?: string
}): React.ReactElement {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-glass-popover px-3.5 text-[12px] font-semibold tracking-tight titlebar-no-drag ui-pressable',
        'text-[color:var(--spatial-accent,hsl(var(--primary)))] bg-[var(--spatial-accent-soft,hsl(var(--primary)/0.12))]',
        'hover:brightness-[1.03] disabled:pointer-events-none disabled:opacity-50',
        className
      )}
    >
      {children}
    </button>
  )
}

function GhostButton({
  children,
  onClick,
  className,
}: {
  children: React.ReactNode
  onClick: () => void
  className?: string
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center gap-1 rounded-glass-popover px-3 text-[12px] font-medium tracking-tight titlebar-no-drag ui-pressable',
        'text-foreground/55 hover:text-foreground hover:bg-foreground/[0.04]',
        className
      )}
    >
      {children}
    </button>
  )
}

export function OnboardingView({ onComplete }: OnboardingViewProps): React.ReactElement {
  const [showTutorial, setShowTutorial] = useState(false)
  const [step, setStep] = useState<'welcome' | 'environment'>('welcome')
  const [finishing, setFinishing] = useState(false)
  const isWindows = useMemo(() => detectIsWindows(), [])
  const shellOk = useAtomValue(isShellEnvironmentOkAtom)

  const handleFinish = async (): Promise<void> => {
    if (finishing) return
    setFinishing(true)
    try {
      await window.electronAPI.updateSettings({
        onboardingCompleted: true,
      })
      onComplete()
    } catch (error) {
      console.error('[Onboarding] 完成失败:', error)
      setFinishing(false)
    }
  }

  const handleNextFromWelcome = (): void => {
    if (isWindows) {
      setStep('environment')
    } else {
      void handleFinish()
    }
  }

  const handleGuide = (action: GuideItem['action']): void => {
    if (action === 'tutorial') {
      setShowTutorial(true)
      return
    }
    handleNextFromWelcome()
  }

  return (
    <div className="flex h-screen min-h-0 flex-col items-center overflow-y-auto bg-background px-6 py-10 scrollbar-thin">
      <div className="my-auto w-full max-w-[720px] animate-in fade-in-0 duration-300">
        {step === 'welcome' && (
          <>
            <header className="kanban-crew-badge mb-7 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/35">
                  ONBOARDING
                </p>
                <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-[color:var(--spatial-ink,hsl(var(--foreground)))]">
                  欢迎使用 TAgent
                </h1>
                <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/45">
                  桌面端通用 Agent：在本地项目里对话、改代码、跑工具
                </p>
              </div>
              <SoftAccentButton
                onClick={handleNextFromWelcome}
                disabled={finishing}
              >
                {finishing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : isWindows ? (
                  <>
                    下一步
                    <ArrowRight className="size-3.5" strokeWidth={2} />
                  </>
                ) : (
                  <>
                    <Sparkles className="size-3.5" strokeWidth={1.75} />
                    开始使用
                  </>
                )}
              </SoftAccentButton>
            </header>

            <section className="mb-6">
              <SectionLabel>你将获得</SectionLabel>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {HIGHLIGHTS.map((item) => (
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

            <section className="mb-6">
              <SectionLabel>上手指引</SectionLabel>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {GUIDES.map((item) => (
                  <GuideCard
                    key={item.id}
                    title={item.title}
                    description={
                      item.action === 'next' && isWindows
                        ? '下一步先做一次 Windows 环境检测'
                        : item.description
                    }
                    Icon={item.Icon}
                    iconClass={item.iconClass}
                    onClick={() => handleGuide(item.action)}
                    trailing={
                      item.action === 'next' ? (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--spatial-accent-soft,hsl(var(--primary)/0.12))] px-1.5 py-0.5 text-[9px] font-medium text-[color:var(--spatial-accent,hsl(var(--primary)))]">
                          {isWindows ? '下一步' : '推荐'}
                        </span>
                      ) : null
                    }
                  />
                ))}
              </div>
            </section>

            <p className="text-center text-[11px] leading-relaxed text-foreground/35">
              教程与环境检测之后也能在设置中打开，不用担心错过
            </p>
          </>
        )}

        {step === 'environment' && isWindows && (
          <>
            <header className="kanban-crew-badge mb-7 flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-foreground/35">
                  ENVIRONMENT
                </p>
                <h1 className="mt-0.5 truncate text-[15px] font-semibold tracking-tight text-[color:var(--spatial-ink,hsl(var(--foreground)))]">
                  先检查一下环境
                </h1>
                <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/45">
                  Windows 上需要 Git Bash 或 WSL，Agent 才能执行命令
                </p>
              </div>
              <SoftAccentButton onClick={() => void handleFinish()} disabled={finishing}>
                {finishing ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : shellOk ? (
                  <>
                    <Sparkles className="size-3.5" strokeWidth={1.75} />
                    开始使用
                  </>
                ) : (
                  <>
                    稍后处理
                    <ArrowRight className="size-3.5" strokeWidth={2} />
                  </>
                )}
              </SoftAccentButton>
            </header>

            <section className="mb-6">
              <SectionLabel>运行时检测</SectionLabel>
              <div className="kanban-crew-badge p-4">
                <EnvironmentCheckPanel autoDetectOnMount />
              </div>
            </section>

            <section className="mb-6">
              <SectionLabel>说明</SectionLabel>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <div className="kanban-crew-badge flex items-start gap-3 p-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-glass-popover bg-foreground/[0.05] text-sky-600 dark:text-sky-400">
                    <Code2 className="size-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium tracking-tight text-foreground">
                      Shell 环境
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/50">
                      Git Bash 或 WSL 任一可用即可执行终端命令
                    </p>
                  </div>
                </div>
                <div className="kanban-crew-badge flex items-start gap-3 p-3.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-glass-popover bg-foreground/[0.05] text-amber-600 dark:text-amber-400">
                    <Shield className="size-4" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13px] font-medium tracking-tight text-foreground">
                      可稍后处理
                    </div>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-foreground/50">
                      未就绪也能进入主界面，之后在设置里继续安装
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between gap-3">
              <GhostButton onClick={() => setStep('welcome')}>
                <ChevronLeft className="size-3.5" strokeWidth={2} />
                上一步
              </GhostButton>
              <p className="text-[11px] text-foreground/35">
                {shellOk ? '环境已就绪' : '环境未就绪也可先进入'}
              </p>
            </div>
          </>
        )}
      </div>

      <Sheet open={showTutorial} onOpenChange={setShowTutorial}>
        <SheetContent side="right" className="w-[560px] sm:max-w-[560px] p-0">
          <SheetHeader className="border-b px-6 pb-4 pt-6">
            <SheetTitle className="flex items-center gap-2">
              <GraduationCap size={18} className="text-primary" />
              TAgent 使用教程
            </SheetTitle>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-80px)]">
            <div className="px-6 py-4">
              <TutorialViewer />
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  )
}

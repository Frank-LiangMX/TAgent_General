/**
 * FunctionalRail - 左侧功能栏（图标列）
 *
 * 布局（自上而下）：
 * - 功能区图标（会话 / 文件 / Skills…）
 * - 弹性空白
 * - 通用 / TA 模式切换（靠底，避免挤占与 Sidebar 首行对齐的顶栏）
 * - 用户头像
 */

import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import {
  Settings,
  Loader2,
  Sparkles,
  PencilRuler,
} from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'

/** 设计原型自定义 SVG 图标 */
const IconChat = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H10l-3.5 3v-3H7.5A2.5 2.5 0 0 1 5 13.5v-6Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

const IconKanban = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="4" y="5" width="5" height="14" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="10.5" y="5" width="5" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="17" y="5" width="3" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

const IconClock = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
    <path d="M12 8v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const IconDraft = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M7 19V8.5a1 1 0 0 1 1-1h5.5L18 12v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M13.5 7.5V12H18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const IconMemory = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Z" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 12c0-2.21 1.79-4 4-4s4 1.79 4 4-1.79 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
  </svg>
)

const IconAssets = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H10l2 2h6.5A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5v-10Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

const IconReview = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const IconPipeline = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <circle cx="6" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="18" cy="6" r="2" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="12" cy="18" r="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="M6 8v4l6 4M18 8v4l-6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
)

const IconSkills = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <rect x="4" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="14" y="4" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="4" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    <rect x="14" y="14" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
  </svg>
)

import {
  topLevelModeAtom,
  activeRailItemAtom,
  appModeAtom,
  type GeneralRailItem,
  type TARailItem,
  type TopLevelMode,
} from '@/atoms/app-mode'
import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { activeTabIdAtom, tabsAtom } from '@/atoms/tab-atoms'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { settingsOpenAtom } from '@/atoms/settings-tab'
import { hasUpdateAtom } from '@/atoms/updater'
import { userProfileAtom } from '@/atoms/user-profile'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

/** 通用模式功能区配置（文件功能已迁移至右侧边栏） */
const GENERAL_RAIL_ITEMS: Array<{
  id: GeneralRailItem
  label: string
  icon: React.ReactNode
  description: string
}> = [
  {
    id: 'sessions',
    label: '会话',
    icon: <IconChat />,
    description: 'Chat / Agent 会话列表',
  },
  {
    id: 'kanban',
    label: '看板',
    icon: <IconKanban />,
    description: '多 Agent 任务编排看板（全局视图）',
  },
  {
    id: 'automation',
    label: '自动任务',
    icon: <IconClock />,
    description: '定时任务与调度',
  },
  {
    id: 'memory',
    label: '记忆',
    icon: <IconMemory />,
    description: 'L0-L5 记忆层监控',
  },
]

/** 双模式常驻功能区（Rail 顶端） */
const COMMON_TOP_RAIL_ITEMS: Array<{
  id: 'draft' | 'skills'
  label: string
  icon: React.ReactNode
  description: string
}> = [
  {
    id: 'draft',
    label: '草稿',
    icon: <IconDraft />,
    description: '需求草稿',
  },
  {
    id: 'skills',
    label: '插件',
    icon: <IconSkills />,
    description: '工作区插件管理',
  },
]

/** TA模式功能区配置 */
const TA_RAIL_ITEMS: Array<{
  id: TARailItem
  label: string
  icon: React.ReactNode
  description: string
}> = [
  {
    id: 'sessions',
    label: '会话',
    icon: <IconChat />,
    description: 'TA 会话（与通用模式数据隔离）',
  },
  {
    id: 'kanban',
    label: '看板',
    icon: <IconKanban />,
    description: '多 Agent 任务编排看板（批量资产流水线）',
  },
  { id: 'assets', label: '资产库', icon: <IconAssets />, description: '资产库管理' },
  { id: 'review', label: '审核', icon: <IconReview />, description: '审核队列' },
  { id: 'pipeline', label: '流水线', icon: <IconPipeline />, description: '流水线管理' },
  { id: 'memory', label: '记忆', icon: <IconMemory />, description: '记忆监控' },
  { id: 'config', label: '配置', icon: <Settings size={18} />, description: 'TA 配置' },
]

/** ModeManager 状态摘要 */
interface ModeStatusSummary {
  activeMode: TopLevelMode
  isSwitching: boolean
  generalTasks: number
  taTasks: number
  generalPaused: boolean
  taPaused: boolean
}

export interface FunctionalRailProps {
  /** 目录区固定显示(折叠功能已移除) */
  children?: never
}

export function FunctionalRail(_props: FunctionalRailProps): React.ReactElement {
  const [topLevelMode, setTopLevelMode] = useAtom(topLevelModeAtom)
  const [activeRailItem, setActiveRailItem] = useAtom(activeRailItemAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const store = useStore()
  const isMac = React.useMemo(() => detectIsMac(), [])

  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const userProfile = useAtomValue(userProfileAtom)

  const [modeStatus, setModeStatus] = React.useState<ModeStatusSummary | null>(null)
  const [isSwitching, setIsSwitching] = React.useState(false)

  React.useEffect(() => {
    let mounted = true

    async function fetchStatus(): Promise<void> {
      try {
        const status = await window.electronAPI.getModeStatus()
        if (mounted) {
          setModeStatus(status)
          if (status.activeMode !== topLevelMode) {
            setTopLevelMode(status.activeMode)
          }
        }
      } catch (error) {
        console.error('[FunctionalRail] 获取模式状态失败:', error)
      }
    }

    fetchStatus()

    const unsubscribe = window.electronAPI.onModeChanged((data) => {
      if (mounted) {
        setTopLevelMode(data.currentMode as TopLevelMode)
        fetchStatus()
      }
    })

    return () => {
      mounted = false
      unsubscribe()
    }
  }, [setTopLevelMode, topLevelMode])

  const handleModeSwitch = React.useCallback(
    async (targetMode: TopLevelMode) => {
      if (isSwitching || targetMode === topLevelMode) return

      setIsSwitching(true)
      try {
        const result = await window.electronAPI.switchMode({
          targetMode,
          source: 'user-click',
          force: false,
        })

        if (result.success) {
          setTopLevelMode(targetMode)
        } else {
          console.warn('[FunctionalRail] 切换失败:', result.error)
        }
      } catch (error) {
        console.error('[FunctionalRail] 切换模式失败:', error)
      } finally {
        setIsSwitching(false)
      }
    },
    [isSwitching, topLevelMode, setTopLevelMode]
  )

  /** 处理 Rail 按钮点击：草稿按钮仅切换侧边栏面板，不自动创建草稿 */
  const handleRailItemClick = React.useCallback(
    (item: { id: string }) => {
      if (item.id === 'draft') {
        setActiveRailItem('draft')
      } else {
        setActiveRailItem(item.id as GeneralRailItem | TARailItem)
        // 如果当前在草稿模式，切回 agent 并同步 currentAgentSessionId
        if (store.get(appModeAtom) === 'draft') {
          setAppMode('agent')
          const currentActiveTabId = store.get(activeTabIdAtom)
          const currentTabs = store.get(tabsAtom)
          const activeTab = currentActiveTabId
            ? (currentTabs.find((t) => t.id === currentActiveTabId) ?? null)
            : null
          if (activeTab && (activeTab.type === 'agent' || activeTab.type === 'preview')) {
            store.set(currentAgentSessionIdAtom, activeTab.sessionId)
          } else {
            store.set(currentAgentSessionIdAtom, null)
          }
        }
      }
    },
    [store, setActiveRailItem, setAppMode]
  )

  const railItems = topLevelMode === 'ta' ? TA_RAIL_ITEMS : GENERAL_RAIL_ITEMS

  const modeButtons = [
    {
      value: 'general' as TopLevelMode,
      label: '通用',
      icon: <Sparkles strokeWidth={1.5} style={{ width: 15, height: 15 }} />,
      description: 'Chat / Agent / 需求草稿',
    },
    {
      value: 'ta' as TopLevelMode,
      label: 'TA',
      icon: <PencilRuler strokeWidth={1.5} style={{ width: 15, height: 15 }} />,
      description: '技术美术工具',
    },
  ]

  return (
    <div className="nav-island-rail relative z-[1] h-full flex flex-col items-center px-2 pb-2 shrink-0">
      {!isMac ? <div className="w-full shrink-0 h-2" aria-hidden /> : null}

      <div className="nav-island-body-start w-full flex flex-col items-center">
        <div className="relative flex flex-col items-center gap-1.5 w-full">
          {COMMON_TOP_RAIL_ITEMS.map((item) => {
            const isActive = activeRailItem === item.id
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-rail-id={item.id}
                    onClick={() => handleRailItemClick(item)}
                    className={cn(
                      'rail-island-btn size-10 flex items-center justify-center rounded-[16px] titlebar-no-drag relative z-[2]',
                      isActive && 'rail-island-btn--active'
                    )}
                  >
                    {item.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-xs">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-muted-foreground">{item.description}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}

          <div className="glass-divider my-0.5 w-8 shrink-0 relative z-[2]" />

          {railItems.map((item) => {
            const isActive = activeRailItem === item.id
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    data-rail-id={item.id}
                    onClick={() => handleRailItemClick(item)}
                    className={cn(
                      'rail-island-btn size-10 flex items-center justify-center rounded-[16px] titlebar-no-drag relative z-[2]',
                      isActive && 'rail-island-btn--active'
                    )}
                  >
                    {item.icon}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="text-xs">
                    <div className="font-medium">{item.label}</div>
                    <div className="text-muted-foreground">{item.description}</div>
                  </div>
                </TooltipContent>
              </Tooltip>
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0" />

      <div className="glass-divider my-2 w-8 shrink-0" />

      <div className="flex flex-col items-center gap-1.5 w-full">
        {modeButtons.map(({ value, label, icon, description }) => {
          const isActive = topLevelMode === value
          const taskCount =
            value === 'general' ? (modeStatus?.generalTasks ?? 0) : (modeStatus?.taTasks ?? 0)
          const isPaused =
            value === 'general'
              ? (modeStatus?.generalPaused ?? false)
              : (modeStatus?.taPaused ?? false)

          return (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleModeSwitch(value)}
                  disabled={isSwitching}
                  className={cn(
                    'rail-island-btn relative size-10 flex items-center justify-center rounded-[16px] titlebar-no-drag',
                    isActive && 'rail-island-btn--active',
                    isSwitching && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isSwitching && isActive ? <Loader2 size={18} className="animate-spin" /> : icon}
                  {taskCount > 0 && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 px-1 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-[9px] font-semibold min-w-[14px] text-center">
                      {taskCount}
                    </span>
                  )}
                  {isPaused && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <div className="text-xs">
                  <div className="font-medium">{label}</div>
                  <div className="text-muted-foreground">{description}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>

      <div className="pt-2 pb-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="打开设置"
              onClick={() => setSettingsOpen(true)}
              className="rail-avatar-btn relative size-10 flex items-center justify-center rounded-[16px] titlebar-no-drag"
            >
              <span className="rail-avatar-letter">
                {userProfile.userName?.charAt(0)?.toUpperCase() || 'U'}
              </span>
              {(hasUpdate || hasEnvironmentIssues) && (
                <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">设置</TooltipContent>
        </Tooltip>
      </div>
    </div>
  )
}

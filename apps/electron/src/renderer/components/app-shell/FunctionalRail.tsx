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
  BadgeCheck,
  Blocks,
  BrainCircuit,
  Building2,
  Clock3,
  Columns3,
  FilePenLine,
  FolderOpen,
  Loader2,
  MessageCircle,
  Settings,
  Workflow,
} from 'lucide-react'
import * as React from 'react'

import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'

import { deriveRailSelection } from './shell-layout'

import {
  topLevelModeAtom,
  activeRailItemAtom,
  appModeAtom,
  navigationSidebarOpenAtom,
  type GeneralRailItem,
  type TARailItem,
  type TopLevelMode,
} from '@/atoms/app-mode'
import { globalOfficeModeAtom } from '@/atoms/session-presentation-atoms'
import { currentAgentSessionIdAtom } from '@/atoms/agent-atoms'
import { activeTabIdAtom, tabsAtom } from '@/atoms/tab-atoms'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { settingsOpenAtom } from '@/atoms/settings-tab'
import { hasUpdateAtom, updateDownloadedAtom } from '@/atoms/updater'
import { userProfileAtom } from '@/atoms/user-profile'
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
    icon: <MessageCircle strokeWidth={1.5} />,
    description: 'Chat / Agent 会话列表',
  },
  {
    id: 'kanban',
    label: '看板',
    icon: <Columns3 strokeWidth={1.5} />,
    description: '多 Agent 任务编排看板（全局视图）',
  },
  {
    id: 'automation',
    label: '自动任务',
    icon: <Clock3 strokeWidth={1.5} />,
    description: '定时任务与调度',
  },
  {
    id: 'memory',
    label: '记忆',
    icon: <BrainCircuit strokeWidth={1.5} />,
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
    icon: <FilePenLine strokeWidth={1.5} />,
    description: '需求草稿',
  },
  {
    id: 'skills',
    label: '插件',
    icon: <Blocks strokeWidth={1.5} />,
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
    icon: <MessageCircle strokeWidth={1.5} />,
    description: 'TA 会话（与通用模式数据隔离）',
  },
  {
    id: 'kanban',
    label: '看板',
    icon: <Columns3 strokeWidth={1.5} />,
    description: '多 Agent 任务编排看板（批量资产流水线）',
  },
  {
    id: 'assets',
    label: '资产库',
    icon: <FolderOpen strokeWidth={1.5} />,
    description: '资产库管理',
  },
  {
    id: 'review',
    label: '审核',
    icon: <BadgeCheck strokeWidth={1.5} />,
    description: '审核队列',
  },
  {
    id: 'pipeline',
    label: '流水线',
    icon: <Workflow strokeWidth={1.5} />,
    description: '流水线管理',
  },
  {
    id: 'memory',
    label: '记忆',
    icon: <BrainCircuit strokeWidth={1.5} />,
    description: '记忆监控',
  },
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

export function FunctionalRail(): React.ReactElement {
  const [topLevelMode, setTopLevelMode] = useAtom(topLevelModeAtom)
  const [activeRailItem, setActiveRailItem] = useAtom(activeRailItemAtom)
  const [sidebarOpen, setSidebarOpen] = useAtom(navigationSidebarOpenAtom)
  const setAppMode = useSetAtom(appModeAtom)
  const store = useStore()

  const hasUpdate = useAtomValue(hasUpdateAtom)
  const updateReadyVersion = useAtomValue(updateDownloadedAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const userProfile = useAtomValue(userProfileAtom)
  const [globalOfficeMode, setGlobalOfficeMode] = useAtom(globalOfficeModeAtom)

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
      const nextSelection = deriveRailSelection(
        { activeRailItem, sidebarOpen },
        item.id as GeneralRailItem | TARailItem
      )
      setSidebarOpen(nextSelection.sidebarOpen)

      if (item.id === 'draft') {
        setActiveRailItem(nextSelection.activeRailItem)
      } else {
        setActiveRailItem(nextSelection.activeRailItem)
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
    [activeRailItem, sidebarOpen, store, setActiveRailItem, setAppMode, setSidebarOpen]
  )

  const railItems = topLevelMode === 'ta' ? TA_RAIL_ITEMS : GENERAL_RAIL_ITEMS

  const modeButtons = [
    {
      value: 'general' as TopLevelMode,
      label: '通用',
      icon: <span className="app-rail-mode-label">G</span>,
      description: 'Chat / Agent / 需求草稿',
    },
    {
      value: 'ta' as TopLevelMode,
      label: 'TA',
      icon: <span className="app-rail-mode-label app-rail-mode-label--ta">TA</span>,
      description: '技术美术工具',
    },
  ]

  return (
    <div className="nav-island-rail relative z-[1] h-full flex flex-col items-center shrink-0">
      <div className="app-rail-island app-rail-island--primary">
        <div className="app-rail-brand" aria-hidden="true">
          T
        </div>
        <div className="w-full flex flex-col items-center">
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
                      aria-label={item.label}
                      aria-controls="app-navigation-sidebar"
                      aria-expanded={isActive ? sidebarOpen : undefined}
                      className={cn(
                        'rail-island-btn size-9 flex items-center justify-center rounded-xl titlebar-no-drag relative z-[2]',
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

            <div className="glass-divider my-1 w-5 shrink-0 relative z-[2] opacity-60" />

            {railItems.map((item) => {
              const isActive = activeRailItem === item.id
              return (
                <Tooltip key={item.id}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      data-rail-id={item.id}
                      onClick={() => handleRailItemClick(item)}
                      aria-label={item.label}
                      aria-controls="app-navigation-sidebar"
                      aria-expanded={isActive ? sidebarOpen : undefined}
                      className={cn(
                        'rail-island-btn size-9 flex items-center justify-center rounded-xl titlebar-no-drag relative z-[2]',
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
      </div>

      <div className="flex-1 min-h-0" />

      <div className="app-rail-island app-rail-island--system">
        <div className="glass-divider mb-1 w-5 shrink-0 opacity-60" />

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
                    aria-label={label}
                    className={cn(
                      'rail-island-btn relative size-9 flex items-center justify-center rounded-xl titlebar-no-drag',
                      isActive && 'rail-island-btn--active',
                      isSwitching && 'opacity-50 cursor-not-allowed'
                    )}
                  >
                    {isSwitching && isActive ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      icon
                    )}
                    {taskCount > 0 && !isActive && (
                      <span className="absolute -top-0.5 -right-0.5 px-1 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-[9px] font-semibold min-w-[14px] text-center">
                        {taskCount}
                      </span>
                    )}
                    {isPaused && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500 ring-2 ring-background" />
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

        <div className="glass-divider my-1 w-5 shrink-0 opacity-60" />

        {/* Office 全局模式切换 */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setGlobalOfficeMode(!globalOfficeMode)}
                aria-label="AI Office"
                className={cn(
                  'rail-island-btn size-9 flex items-center justify-center rounded-xl titlebar-no-drag',
                  globalOfficeMode && 'rail-island-btn--active'
                )}
              >
                <Building2 size={18} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <div className="text-xs">
                <div className="font-medium">AI Office</div>
                <div className="text-muted-foreground">
                  {globalOfficeMode ? '返回经典工作台' : '进入沉浸式办公室'}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="pt-1.5 flex flex-col items-center gap-1.5">
          {/* 更新就绪按钮：下载完成后显示 */}
          {updateReadyVersion && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => window.electronAPI.updater?.quitAndInstall()}
                  className="flex items-center justify-center rounded-full bg-primary/15 text-primary px-2.5 py-1 text-[10px] font-semibold leading-none hover:bg-primary/25 transition-colors titlebar-no-drag"
                >
                  更新
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">
                v{updateReadyVersion} 已下载，重启以应用更新
              </TooltipContent>
            </Tooltip>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="打开设置"
                onClick={() => setSettingsOpen(true)}
                className="rail-avatar-btn relative size-9 flex items-center justify-center rounded-full titlebar-no-drag"
              >
                <span className="rail-avatar-letter">
                  {userProfile.userName?.charAt(0)?.toUpperCase() || 'U'}
                </span>
                {(hasUpdate || hasEnvironmentIssues) && (
                  <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-red-500 ring-2 ring-background" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">设置</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

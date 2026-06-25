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
  Layers,
  Palette,
  MessageSquare,
  FolderOpen,
  LayoutGrid,
  Database,
  ClipboardCheck,
  GitBranch,
  Brain,
  Settings,
  Loader2,
  StickyNote,
  Clock,
} from 'lucide-react'
import * as React from 'react'

import {
  topLevelModeAtom,
  activeRailItemAtom,
  appModeAtom,
  type GeneralRailItem,
  type TARailItem,
  type TopLevelMode,
} from '@/atoms/app-mode'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { settingsOpenAtom } from '@/atoms/settings-tab'
import {
  tabsAtom,
  activeTabIdAtom,
  openTab,
  closeTab,
  SCRATCH_PAD_ID,
  SCRATCH_PAD_TITLE,
} from '@/atoms/tab-atoms'
import { hasUpdateAtom } from '@/atoms/updater'
import { userProfileAtom } from '@/atoms/user-profile'
import { UserAvatar } from '@/components/shared/UserAvatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { detectIsMac } from '@/lib/platform'
import { cn } from '@/lib/utils'

/** 通用模式功能区配置 */
const GENERAL_RAIL_ITEMS: Array<{
  id: GeneralRailItem
  label: string
  icon: React.ReactNode
  description: string
}> = [
  {
    id: 'sessions',
    label: '会话',
    icon: <MessageSquare size={17} />,
    description: 'Chat / Agent 会话列表',
  },
  {
    id: 'files',
    label: '文件',
    icon: <FolderOpen size={17} />,
    description: '工作区文件树',
  },
  {
    id: 'automation',
    label: '自动任务',
    icon: <Clock size={17} />,
    description: '定时任务与调度',
  },
]

/** 双模式常驻功能区（Rail 顶端） */
const COMMON_TOP_RAIL_ITEMS: Array<{
  id: 'scratch' | 'skills'
  label: string
  icon: React.ReactNode
  description: string
}> = [
  {
    id: 'scratch',
    label: '草稿',
    icon: <StickyNote size={17} />,
    description: '草稿本',
  },
  {
    id: 'skills',
    label: '插件',
    icon: <LayoutGrid size={17} strokeWidth={1.75} />,
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
    icon: <MessageSquare size={17} />,
    description: 'TA 会话（与通用模式数据隔离）',
  },
  { id: 'assets', label: '资产库', icon: <Database size={17} />, description: '资产库管理' },
  { id: 'review', label: '审核', icon: <ClipboardCheck size={17} />, description: '审核队列' },
  { id: 'pipeline', label: '流水线', icon: <GitBranch size={17} />, description: '流水线管理' },
  { id: 'memory', label: '记忆', icon: <Brain size={17} />, description: '记忆监控' },
  { id: 'config', label: '配置', icon: <Settings size={17} />, description: 'TA 配置' },
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

  /** 处理 Rail 按钮点击：草稿按钮点击时直接打开草稿 Tab 并同步 rail 选中态 */
  const handleRailItemClick = React.useCallback(
    (item: { id: string }) => {
      if (item.id === 'scratch') {
        setActiveRailItem('scratch')
        // 打开草稿 Tab
        const currentTabs = store.get(tabsAtom)
        const { tabs: newTabs, activeTabId: newActiveTabId } = openTab(currentTabs, {
          type: 'scratch',
          sessionId: SCRATCH_PAD_ID,
          title: SCRATCH_PAD_TITLE,
        })
        store.set(tabsAtom, newTabs)
        store.set(activeTabIdAtom, newActiveTabId)
        // 设置 appMode 为 scratch，确保主区域正确渲染
        setAppMode('scratch')
      } else {
        setActiveRailItem(item.id as GeneralRailItem | TARailItem)
        // 点击非草稿功能时，关闭草稿 Tab 并切换回 agent 模式
        const currentTabs = store.get(tabsAtom)
        const scratchTab = currentTabs.find((t) => t.type === 'scratch')
        if (scratchTab) {
          const currentActiveTabId = store.get(activeTabIdAtom)
          const tabResult = closeTab(currentTabs, currentActiveTabId, scratchTab.id)
          store.set(tabsAtom, tabResult.tabs)
          store.set(activeTabIdAtom, tabResult.activeTabId)
        }
        // 确保 appMode 为 agent（会话/文件/Skills 都属于 agent 模式）
        setAppMode('agent')
      }
    },
    [store, setActiveRailItem, setAppMode]
  )

  const railItems = topLevelMode === 'ta' ? TA_RAIL_ITEMS : GENERAL_RAIL_ITEMS

  const modeButtons = [
    {
      value: 'general' as TopLevelMode,
      label: '通用',
      icon: <Layers size={14} />,
      description: 'Chat / Agent / 草稿本',
    },
    {
      value: 'ta' as TopLevelMode,
      label: 'TA',
      icon: <Palette size={14} />,
      description: '技术美术工具',
    },
  ]

  return (
    <div className="nav-island-rail relative z-[1] h-full flex flex-col items-center px-2 pb-2 shrink-0">
      {!isMac ? <div className="w-full shrink-0 h-2" aria-hidden /> : null}

      <div className="nav-island-body-start w-full flex flex-col items-center">
        <div className="flex flex-col items-center gap-1.5 w-full">
          {COMMON_TOP_RAIL_ITEMS.map((item) => {
            const isActive = activeRailItem === item.id
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleRailItemClick(item)}
                    className={cn(
                      'rail-island-btn size-10 flex items-center justify-center rounded-[12px] titlebar-no-drag',
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

          <div className="glass-divider my-0.5 w-8 shrink-0" />

          {railItems.map((item) => {
            const isActive = activeRailItem === item.id
            return (
              <Tooltip key={item.id}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => handleRailItemClick(item)}
                    className={cn(
                      'rail-island-btn size-10 flex items-center justify-center rounded-[12px] titlebar-no-drag',
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
                    'rail-island-btn relative size-10 flex items-center justify-center rounded-[12px] titlebar-no-drag',
                    isActive && 'rail-island-btn--active',
                    isSwitching && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  {isSwitching && isActive ? <Loader2 size={14} className="animate-spin" /> : icon}
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
              className="relative size-10 flex items-center justify-center rounded-[12px] transition-colors titlebar-no-drag hover:bg-foreground/5"
            >
              <UserAvatar avatar={userProfile.avatar} size={28} />
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

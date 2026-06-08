/**
 * FunctionalRail - 左侧功能栏（图标列）
 *
 * 显示模式切换和功能区切换的图标按钮：
 * - 顶部：通用/TA 模式切换
 * - 中间：功能区图标（根据模式动态变化）
 * - 底部：最近会话快捷入口 + 用户头像
 *
 * 宽度：60px 固定
 */

import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import {
  Layers,
  Palette,
  MessageSquare,
  Bot,
  FolderOpen,
  Zap,
  Database,
  ClipboardCheck,
  GitBranch,
  Brain,
  Settings,
  PanelLeftOpen,
  PanelLeftClose,
  Plus,
  Search,
  Loader2,
  Briefcase,
  Check,
} from 'lucide-react'
import * as React from 'react'

import type { GeneralRailItem, TARailItem, RailItem } from '@/atoms/app-mode'
import {
  topLevelModeAtom,
  appModeAtom,
  activeRailItemAtom,
  type TopLevelMode,
} from '@/atoms/app-mode'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { hasUpdateAtom } from '@/atoms/updater'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { settingsOpenAtom, settingsTabAtom } from '@/atoms/settings-tab'
import { userProfileAtom } from '@/atoms/user-profile'
import { currentAgentWorkspaceIdAtom, agentWorkspacesAtom } from '@/atoms/agent-atoms'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import { useWorkspaceActions } from '@/hooks/useWorkspaceActions'
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
    id: 'skills',
    label: 'Skills',
    icon: <Zap size={17} />,
    description: 'MCP Server & Skills',
  },
]

/** TA模式功能区配置 */
const TA_RAIL_ITEMS: Array<{
  id: TARailItem
  label: string
  icon: React.ReactNode
  description: string
}> = [
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
  /** 切换目录区展开/折叠状态（顶部按钮使用） */
  onToggleSidebar?: () => void
  /** 最近会话入口（折叠模式下显示） */
  recentItems?: Array<{
    id: string
    title: string
    type: 'chat' | 'agent'
    initial: string
    active: boolean
    status: 'idle' | 'running' | 'blocked' | 'completed'
  }>
  /** 最近会话点击回调 */
  onRecentItemSelect?: (item: { id: string; title: string; type: 'chat' | 'agent' }) => void
  /** 新建会话回调 */
  onNewSession?: () => void
  /** 搜索回调 */
  onSearch?: () => void
  /** 目录区是否折叠（控制高频操作和最近会话的显示） */
  sidebarCollapsed?: boolean
  /** 当前顶层模式（控制 TA 模式下不显示高频操作/最近会话） */
  topLevelMode?: TopLevelMode
}

export function FunctionalRail({
  onToggleSidebar,
  recentItems = [],
  onRecentItemSelect,
  onNewSession,
  onSearch,
  sidebarCollapsed = false,
  topLevelMode: topLevelModeProp,
}: FunctionalRailProps): React.ReactElement {
  const [topLevelMode, setTopLevelMode] = useAtom(topLevelModeAtom)
  const [activeRailItem, setActiveRailItem] = useAtom(activeRailItemAtom)
  const appMode = useAtomValue(appModeAtom)
  // 优先用 prop 传入的顶层模式（避免短暂不一致），无 prop 时回退到 atom
  const effectiveTopLevelMode = topLevelModeProp ?? topLevelMode
  const isMac = React.useMemo(() => detectIsMac(), [])

  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const userProfile = useAtomValue(userProfileAtom)

  // 当前工作区（仅 Agent 模式使用）
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const { selectWorkspace } = useWorkspaceActions()
  const setWorkspaceManagerOpen = useSetAtom(workspaceManagerOpenAtom)
  const currentWorkspaceName = React.useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? null,
    [workspaces, currentWorkspaceId],
  )
  const workspaceInitial = React.useMemo(
    () => (currentWorkspaceName?.trim().slice(0, 1).toUpperCase() || '·'),
    [currentWorkspaceName],
  )

  const [modeStatus, setModeStatus] = React.useState<ModeStatusSummary | null>(null)
  const [isSwitching, setIsSwitching] = React.useState(false)

  // 获取 ModeManager 状态
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

  // 模式切换时自动切换功能区
  React.useEffect(() => {
    if (topLevelMode === 'ta') {
      setActiveRailItem('assets')
    } else {
      setActiveRailItem('sessions')
    }
  }, [topLevelMode, setActiveRailItem])

  // 切换模式
  const handleModeSwitch = React.useCallback(async (targetMode: TopLevelMode) => {
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
  }, [isSwitching, topLevelMode, setTopLevelMode])

  // 当前模式的功能区列表
  // TA 模式下不渲染功能区图标（主区 TATabBar 已经显示了资产库/审核/流水线/记忆/配置，
  // 再在 rail 显示会造成双层入口重复）。TA 模式的功能区入口由主区 TATabBar 承担。
  const railItems = topLevelMode === 'ta' ? [] : GENERAL_RAIL_ITEMS

  // 模式切换按钮配置
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
    <div className="relative h-full flex flex-col items-center bg-background rounded-2xl shadow-xl px-2 py-2" style={{ width: 60, flexShrink: 0 }}>
      {/* macOS 红绿灯避让 */}
      <div className={cn('w-full flex-shrink-0 titlebar-drag-region', isMac ? 'h-[50px]' : 'h-2')} />

      {/* 切换目录区：展开态显示 [>>] 折叠、折叠态显示 [<<] 展开 */}
      {onToggleSidebar && (
        <div className="mb-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                onClick={onToggleSidebar}
                className="size-10 flex items-center justify-center rounded-[12px] text-foreground/60 bg-muted hover:bg-foreground/[0.08] hover:text-foreground transition-colors titlebar-no-drag"
              >
                {sidebarCollapsed
                  ? <PanelLeftOpen size={17} />
                  : <PanelLeftClose size={17} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {sidebarCollapsed ? '展开侧边栏' : `收起侧边栏 (${navigator.platform.includes('Mac') ? '⌘B' : 'Ctrl+B'})`}
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 模式切换按钮 */}
      <div className="flex flex-col items-center gap-1.5">
        {modeButtons.map(({ value, label, icon, description }) => {
          const isActive = topLevelMode === value
          const taskCount = value === 'general' ? (modeStatus?.generalTasks ?? 0) : (modeStatus?.taTasks ?? 0)
          const isPaused = value === 'general' ? (modeStatus?.generalPaused ?? false) : (modeStatus?.taPaused ?? false)

          return (
            <Tooltip key={value}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleModeSwitch(value)}
                  disabled={isSwitching}
                  className={cn(
                    'relative size-10 flex items-center justify-center rounded-[12px] transition-colors titlebar-no-drag',
                    isActive
                      ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                      : 'text-foreground/45 hover:bg-foreground/[0.06] hover:text-foreground/75',
                    isSwitching && 'opacity-50 cursor-not-allowed'
                  )}
                  title={description}
                >
                  {isSwitching && isActive ? <Loader2 size={14} className="animate-spin" /> : icon}
                  {/* 后台任务数量 */}
                  {taskCount > 0 && !isActive && (
                    <span className="absolute -top-0.5 -right-0.5 px-1 py-0.5 rounded-full bg-amber-500/20 text-amber-600 text-[9px] font-semibold min-w-[14px] text-center">
                      {taskCount}
                    </span>
                  )}
                  {/* 暂停指示器 */}
                  {isPaused && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" title="已暂停" />
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

      {/* 工作区管理 Popover（仅 Agent 模式 + 目录区折叠时显示，展开时由目录区顶端 Popover 承担） */}
      {appMode === 'agent' && sidebarCollapsed && (
        <>
          <div className="my-3 h-px w-8 bg-border/70" />
          <div className="flex flex-col items-center gap-1.5">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="切换工作区"
                  className="relative size-10 flex items-center justify-center rounded-[12px] text-foreground/55 bg-primary/5 hover:bg-primary/10 hover:text-foreground/75 transition-colors titlebar-no-drag border border-dashed border-[hsl(var(--dashed-border))] hover:border-[hsl(var(--dashed-border-hover))]"
                >
                  <Briefcase size={16} />
                  {currentWorkspaceName && (
                    <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center leading-none shadow-sm">
                      {workspaceInitial}
                    </span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={6}
                className="w-64 p-0 overflow-hidden"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/40">
                  <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide">
                    切换工作区
                  </span>
                  <button
                    type="button"
                    onClick={() => setWorkspaceManagerOpen(true)}
                    className="text-[11px] text-primary/70 hover:text-primary transition-colors titlebar-no-drag"
                  >
                    管理 →
                  </button>
                </div>
                <div className="max-h-[50vh] overflow-y-auto scrollbar-thin p-1">
                  {workspaces.length === 0 ? (
                    <div className="py-3 text-center text-[12px] text-foreground/40">
                      暂无工作区
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {workspaces.map((ws) => {
                        const isActive = ws.id === currentWorkspaceId
                        return (
                          <button
                            key={ws.id}
                            type="button"
                            onClick={() => selectWorkspace(ws.id)}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition-colors duration-100 text-left',
                              isActive
                                ? 'bg-foreground/[0.08] text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                                : 'text-foreground/70 hover:bg-foreground/[0.04]',
                            )}
                          >
                            <FolderOpen size={13} className="flex-shrink-0 text-foreground/40" />
                            <span className="flex-1 min-w-0 truncate font-medium">{ws.name}</span>
                            {isActive && (
                              <Check size={12} className="flex-shrink-0 text-primary" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </>
      )}

      <div className="my-3 h-px w-8 bg-border/70" />

      {/* 功能区切换按钮 */}
      <div className="flex flex-col items-center gap-1.5">
        {railItems.map((item) => (
          <Tooltip key={item.id}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => setActiveRailItem(item.id)}
                className={cn(
                  'size-10 flex items-center justify-center rounded-[12px] transition-colors titlebar-no-drag',
                  activeRailItem === item.id
                    ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                    : 'text-foreground/45 hover:bg-foreground/[0.06] hover:text-foreground/75'
                )}
                title={item.description}
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
        ))}
      </div>

      <div className="my-3 h-px w-8 bg-border/70" />

      {/* 高频操作：仅在通用模式 + 目录区折叠时显示（避免与目录区内容重复） */}
      {effectiveTopLevelMode === 'general' && sidebarCollapsed && (
        <div className="flex flex-col items-center gap-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={appMode === 'agent' ? '新建 Agent 会话' : '新建 Chat 对话'}
                onClick={onNewSession}
                className="size-10 flex items-center justify-center rounded-[12px] text-foreground/70 bg-primary/5 hover:bg-primary/10 transition-colors titlebar-no-drag border border-dashed border-[hsl(var(--dashed-border))] hover:border-[hsl(var(--dashed-border-hover))]"
              >
                <Plus size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              {appMode === 'agent' ? '新会话' : '新对话'}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label="搜索"
                onClick={onSearch}
                className="size-10 flex items-center justify-center rounded-[12px] text-foreground/45 bg-primary/5 hover:bg-primary/10 hover:text-foreground/70 transition-colors titlebar-no-drag border border-dashed border-[hsl(var(--dashed-border))] hover:border-[hsl(var(--dashed-border-hover))]"
              >
                <Search size={16} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">搜索</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 最近会话入口：仅在通用模式 + 目录区折叠时显示（避免与目录区会话列表重复） */}
      {effectiveTopLevelMode === 'general' && sidebarCollapsed && recentItems.length > 0 && (
        <>
          <div className="my-3 h-px w-8 bg-border/70" />
          <div className="flex-1 min-h-0 w-full overflow-y-auto scrollbar-thin animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex flex-col items-center gap-1.5 pb-2">
              {recentItems.map((item) => (
                <Tooltip key={`${item.type}-${item.id}`}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => onRecentItemSelect?.(item)}
                      className={cn(
                        'relative size-10 flex items-center justify-center rounded-[12px] transition-colors titlebar-no-drag',
                        item.active
                          ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                          : 'text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground/80'
                      )}
                    >
                      <span className="text-[13px] font-semibold leading-none">{item.initial}</span>
                      {/* 状态指示器 */}
                      {item.status !== 'idle' && (
                        <span
                          className={cn(
                            'absolute inset-y-0 left-0 w-0 border-l-[3px] rounded-l-[12px] pointer-events-none',
                            item.status === 'running' && 'border-blue-500 animate-pulse',
                            item.status === 'blocked' && 'border-orange-500',
                            item.status === 'completed' && 'border-emerald-500'
                          )}
                        />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    {item.type === 'agent' ? 'Agent' : 'Chat'} · {item.title}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </>
      )}

      {/* 填充剩余空间（不在通用模式时、或通用模式但目录区展开时需要 flex-1 撑开） */}
      {(effectiveTopLevelMode !== 'general' || !sidebarCollapsed) && <div className="flex-1" />}

      {/* 用户头像（点击打开设置） */}
      <div className="pt-3 pb-1">
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

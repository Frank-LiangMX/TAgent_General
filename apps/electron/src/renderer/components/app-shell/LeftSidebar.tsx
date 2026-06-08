/**
 * LeftSidebar - 左侧功能区内容面板
 *
 * 根据 activeRailItem 显示不同功能区内容：
 * - sessions: 会话列表（Chat/Agent 模式）
 * - files: 工作区文件树
 * - skills: MCP Server & Skills 管理
 * - TA 模式的各种功能面板
 *
 * 不再包含模式切换器（已移至 FunctionalRail）
 */

import { useAtom, useSetAtom, useAtomValue, useStore } from 'jotai'
import { Pin, PinOff, Settings, Plus, Trash2, Pencil, ChevronDown, ChevronRight, ArrowRightLeft, Search, Archive, ArchiveRestore, ArrowLeft, Hammer, Bot, MessageSquare, MoreHorizontal, Check, FolderOpen, Info } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'


import { SearchDialog } from './SearchDialog'

import type { ActiveView } from '@/atoms/active-view'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import type { ConversationMeta, AgentSessionMeta, WorkspaceCapabilities } from '@tagent/shared'
import type { RailItem } from '@/atoms/app-mode'

import { activeViewAtom } from '@/atoms/active-view'
import {
  agentSessionsAtom,
  agentSDKMessagesCacheAtom,
  currentAgentSessionIdAtom,
  agentSessionIndicatorMapAtom,
  unviewedCompletedSessionIdsAtom,
  workingDoneSessionIdsAtom,
  agentChannelIdAtom,
  agentModelIdAtom,
  agentSessionChannelMapAtom,
  agentSessionModelMapAtom,
  currentAgentWorkspaceIdAtom,
  agentWorkspacesAtom,
  workspaceCapabilitiesVersionAtom,
  agentDiffPanelTabAtom,
  agentDiffRefreshVersionAtom,
  agentDiffUnseenChangesAtom,
  agentDiffUnseenFilesAtom,
  agentDiffDataAtom,
  agentStreamingStatesAtom,
  liveMessagesMapAtom,
  agentSessionPendingFilesAtom,
  agentSessionStreamingStateAtomFamily,
  agentSessionDraftAtomFamily,
  agentSessionDraftHtmlAtomFamily,
  agentPendingFilesAtomFamily,
  backgroundTasksAtomFamily,
  sessionPersistedPermissionModeAtom,
  sessionExistsAtom,
} from '@/atoms/agent-atoms'
import { appModeAtom, type AppMode, topLevelModeAtom } from '@/atoms/app-mode'
import {
  conversationsAtom,
  currentConversationIdAtom,
  selectedModelAtom,
  streamingConversationIdsAtom,
  conversationModelsAtom,
  conversationContextLengthAtom,
  conversationThinkingEnabledAtom,
  conversationParallelModeAtom,
} from '@/atoms/chat-atoms'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import { hasEnvironmentIssuesAtom } from '@/atoms/environment'
import { previewPanelOpenMapAtom, previewFileMapAtom } from '@/atoms/preview-atoms'
import { searchDialogOpenAtom } from '@/atoms/search-atoms'
import { settingsTabAtom, settingsOpenAtom } from '@/atoms/settings-tab'
// sidebarViewModeAtom 已不再使用：归档会话由底部 Popover 展示，不再切换整页视图

import { promptConfigAtom, selectedPromptIdAtom, conversationPromptIdAtom } from '@/atoms/system-prompt-atoms'
import {
  tabsAtom,
  activeTabIdAtom,
  activeSessionIdAtom,
  sidebarCollapsedAtom,
  closeTab,
  updateTabTitle,
  sessionViewStateMapAtom,
} from '@/atoms/tab-atoms'
import { hasUpdateAtom } from '@/atoms/updater'
import { userProfileAtom } from '@/atoms/user-profile'
import { workingSessionGroupsAtom, workingSessionIdsSetAtom } from '@/atoms/working-atoms'
import { MoveSessionDialog } from '@/components/agent/MoveSessionDialog'
import { SkillsPanel } from '@/components/agent/SkillsPanel'
import { WorkspaceFilesView } from '@/components/agent/WorkspaceFilesView'
import { TASidebar } from '@/components/ta/TASidebar'
import { UserAvatar } from '@/components/chat/UserAvatar'
import { clearPreviewCacheForSession } from '@/components/diff/DiffTabContent'
import {
  SessionMiniMapPopover,
  useSessionMiniMapHover,
  type SessionMiniMapType,
} from '@/components/session-preview/SessionMiniMapPopover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { useOpenSession } from '@/hooks/useOpenSession'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { useWorkspaceActions } from '@/hooks/useWorkspaceActions'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import {
  replaceAgentSessionInFreshnessOrder,
  sortAgentSessionsByUpdatedAtDesc,
} from '@/lib/agent-session-list'
import { detectIsMac } from '@/lib/platform'
import { getActiveAccelerator, getAcceleratorDisplay } from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'

interface SidebarItemProps {
  icon: React.ReactNode
  label: string
  active?: boolean
  /** 右侧额外元素（如展开/收起箭头） */
  suffix?: React.ReactNode
  onClick?: () => void
}

function SidebarItem({ icon, label, active, suffix, onClick }: SidebarItemProps): React.ReactElement {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors duration-100 titlebar-no-drag',
        active
          ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
          : 'text-foreground/60 hover:bg-primary/5 hover:text-foreground'
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex-shrink-0 w-[18px] h-[18px]">{icon}</span>
        <span>{label}</span>
      </div>
      {suffix}
    </button>
  )
}

export interface LeftSidebarProps {
  /** 可选固定宽度，默认使用 CSS 响应式宽度 */
  width?: number
  /** 当前激活的功能区 */
  activeRailItem?: RailItem
  /** 是否折叠 */
  collapsed?: boolean
  /** 折叠状态变更回调 */
  onCollapsedChange?: (collapsed: boolean) => void
}

/** 侧边栏导航项标识 */
type SidebarItemId = 'pinned' | 'all-chats'

/** 导航项到视图的映射 */
const ITEM_TO_VIEW: Record<SidebarItemId, ActiveView> = {
  pinned: 'conversations',
  'all-chats': 'conversations',
}

/** 日期分组标签 */
type DateGroup = '今天' | '昨天' | '更早'

/** 按 updatedAt 将项目分为 今天 / 昨天 / 更早 三组 */
function groupByDate<T extends { updatedAt: number }>(items: T[]): Array<{ label: DateGroup; items: T[] }> {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000

  const today: T[] = []
  const yesterday: T[] = []
  const earlier: T[] = []

  for (const item of items) {
    if (item.updatedAt >= todayStart) {
      today.push(item)
    } else if (item.updatedAt >= yesterdayStart) {
      yesterday.push(item)
    } else {
      earlier.push(item)
    }
  }

  const groups: Array<{ label: DateGroup; items: T[] }> = []
  if (today.length > 0) groups.push({ label: '今天', items: today })
  if (yesterday.length > 0) groups.push({ label: '昨天', items: yesterday })
  if (earlier.length > 0) groups.push({ label: '更早', items: earlier })
  return groups
}

const RAIL_STATUS_CLASS: Record<SessionIndicatorStatus, string> = {
  idle: 'hidden',
  running: 'border-blue-500 animate-pulse',
  blocked: 'border-orange-500',
  completed: 'border-emerald-500',
}

const SIDEBAR_DRAG_STRIP_HEIGHT = {
  collapsedMac: 50,
  expandedMac: 30,
  collapsed: 8,
  expanded: 4,
} as const

function getRailInitial(title: string): string {
  return title.trim().slice(0, 1).toUpperCase() || '·'
}

interface RailRecentItem {
  id: string
  title: string
  type: SessionMiniMapType
  initial: string
  active: boolean
  status: SessionIndicatorStatus
  pinned: boolean
  workspaceName?: string
}

function RailRecentButton({
  item,
  onSelect,
}: {
  item: RailRecentItem
  onSelect: (item: RailRecentItem) => void
}): React.ReactElement {
  const preview = useSessionMiniMapHover()

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={preview.setAnchorRef}
            type="button"
            aria-label={`打开${item.type === 'agent' ? 'Agent 会话' : 'Chat 对话'}：${item.title}`}
            onClick={() => onSelect(item)}
            onMouseEnter={preview.handleMouseEnter}
            onMouseLeave={preview.handleMouseLeave}
            className={cn(
              'relative size-10 flex items-center justify-center overflow-hidden rounded-[12px] transition-colors titlebar-no-drag',
              item.active
                ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                : 'text-foreground/55 hover:bg-foreground/[0.06] hover:text-foreground/80'
            )}
          >
            <span
              className={cn(
                'absolute inset-y-0 left-0 w-0 border-l-[3px] rounded-l-[12px] pointer-events-none',
                RAIL_STATUS_CLASS[item.status]
              )}
            />
            <span className="text-[13px] font-semibold leading-none">{item.initial}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {item.type === 'agent' ? 'Agent' : 'Chat'} · {item.title}
        </TooltipContent>
      </Tooltip>
      <SessionMiniMapPopover
        target={{
          type: item.type,
          sessionId: item.id,
          title: item.title,
          workspaceName: item.workspaceName,
        }}
        anchorRef={preview.anchorRef}
        open={preview.isOpen}
        isLeaving={preview.isLeaving}
        onMouseEnter={preview.handlePanelMouseEnter}
        onMouseLeave={preview.handlePanelMouseLeave}
      />
    </>
  )
}

function SidebarWindowDragStrip({ height }: { height: number }): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      className="sidebar-window-drag-strip"
      style={{ height }}
    />
  )
}

export function LeftSidebar({ width, activeRailItem = 'sessions', collapsed, onCollapsedChange }: LeftSidebarProps): React.ReactElement | null {
  const [activeView, setActiveView] = useAtom(activeViewAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const [_activeItem, setActiveItem] = React.useState<SidebarItemId>('all-chats')
  const [conversations, setConversations] = useAtom(conversationsAtom)
  const currentConversationId = useAtomValue(currentConversationIdAtom)
  const draftSessionIds = useAtomValue(draftSessionIdsAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const setAgentMessagesCache = useSetAtom(agentSDKMessagesCacheAtom)

  /** 待删除对话 ID，非空时显示确认弹窗 */
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  /** 待迁移会话 ID，非空时显示迁移对话框 */
  const [moveTargetId, setMoveTargetId] = React.useState<string | null>(null)
  /** 置顶区域展开/收起 */
  const [pinnedExpanded, setPinnedExpanded] = React.useState(true)
  const [userProfile, setUserProfile] = useAtom(userProfileAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const streamingIds = useAtomValue(streamingConversationIdsAtom)
  const mode = useAtomValue(appModeAtom)
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const isMac = React.useMemo(() => detectIsMac(), [])
  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const promptConfig = useAtomValue(promptConfigAtom)
  const setSelectedPromptId = useSetAtom(selectedPromptIdAtom)

  // 侧边栏折叠状态（现在由外部控制，但也支持内部切换）
  const [sidebarCollapsedState, setSidebarCollapsedState] = useAtom(sidebarCollapsedAtom)
  const isSidebarCollapsed = collapsed ?? sidebarCollapsedState

  const handleToggleCollapsed = React.useCallback(() => {
    const newValue = !isSidebarCollapsed
    setSidebarCollapsedState(newValue)
    onCollapsedChange?.(newValue)
  }, [isSidebarCollapsed, setSidebarCollapsedState, onCollapsedChange])

  // Agent 模式状态
  const [agentSessions, setAgentSessions] = useAtom(agentSessionsAtom)
  const [currentAgentSessionId, setCurrentAgentSessionId] = useAtom(currentAgentSessionIdAtom)
  const agentIndicatorMap = useAtomValue(agentSessionIndicatorMapAtom)
  const unviewedCompletedSessionIds = useAtomValue(unviewedCompletedSessionIdsAtom)
  const setUnviewedCompleted = useSetAtom(unviewedCompletedSessionIdsAtom)
  const agentChannelId = useAtomValue(agentChannelIdAtom)
  const agentModelId = useAtomValue(agentModelIdAtom)
  const setSessionChannelMap = useSetAtom(agentSessionChannelMapAtom)
  const setSessionModelMap = useSetAtom(agentSessionModelMapAtom)
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const workspaces = useAtomValue(agentWorkspacesAtom)
  const { selectWorkspace } = useWorkspaceActions()
  const setWorkspaceManagerOpen = useSetAtom(workspaceManagerOpenAtom)

  /** 当前工作区名称（用于目录区顶端工作区选择按钮显示） */
  const currentWorkspaceName = React.useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? null,
    [workspaces, currentWorkspaceId],
  )
  const setMode = useSetAtom(appModeAtom)

  // 工作区能力（MCP + Skill 计数）
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities | null>(null)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)

  // Tab 状态
  const [tabs, setTabs] = useAtom(tabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  // 会话高亮按"激活 Tab 所属会话"判定：预览 Tab 激活时其 owner 会话仍保持高亮
  const activeSessionId = useAtomValue(activeSessionIdAtom)
  const [sidebarCollapsed, setSidebarCollapsed] = useAtom(sidebarCollapsedAtom)
  const openSession = useOpenSession()
  const syncActiveTabSideEffects = useSyncActiveTabSideEffects()
  const store = useStore()

  // 搜索状态（归档会话已从主列表分离，由底部 Popover 独立展示）
  const setSearchDialogOpen = useSetAtom(searchDialogOpenAtom)

  // 当 activeTabId 变化时，自动滚动侧边栏使选中项可见
  React.useEffect(() => {
    if (!activeTabId) return
    requestAnimationFrame(() => {
      const el = document.querySelector('.session-item-selected')
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [activeTabId])

  // per-conversation/session Map atoms（删除时清理）
  const setConvModels = useSetAtom(conversationModelsAtom)
  const setConvContextLength = useSetAtom(conversationContextLengthAtom)
  const setConvThinking = useSetAtom(conversationThinkingEnabledAtom)
  const setConvParallel = useSetAtom(conversationParallelModeAtom)
  const setConvPromptId = useSetAtom(conversationPromptIdAtom)
  const setPreviewPanelOpen = useSetAtom(previewPanelOpenMapAtom)
  const setPreviewFile = useSetAtom(previewFileMapAtom)
  const setDiffPanelTab = useSetAtom(agentDiffPanelTabAtom)
  const setDiffRefreshVersion = useSetAtom(agentDiffRefreshVersionAtom)
  const setDiffUnseen = useSetAtom(agentDiffUnseenChangesAtom)
  const setDiffUnseenFiles = useSetAtom(agentDiffUnseenFilesAtom)
  const setDiffData = useSetAtom(agentDiffDataAtom)
  const setWorkingDone = useSetAtom(workingDoneSessionIdsAtom)
  const setStreamingStates = useSetAtom(agentStreamingStatesAtom)
  const setLiveMessagesMap = useSetAtom(liveMessagesMapAtom)
  const setSessionPendingFiles = useSetAtom(agentSessionPendingFilesAtom)
  const setSessionViewStateMap = useSetAtom(sessionViewStateMapAtom)

  /** 清理 per-conversation/session Map atoms 条目 */
  const cleanupMapAtoms = React.useCallback((id: string) => {
    const deleteKey = <T,>(prev: Map<string, T>): Map<string, T> => {
      if (!prev.has(id)) return prev
      const map = new Map(prev)
      map.delete(id)
      return map
    }
    setConvModels(deleteKey)
    setConvContextLength(deleteKey)
    setConvThinking(deleteKey)
    setConvParallel(deleteKey)
    setConvPromptId(deleteKey)
    setPreviewPanelOpen(deleteKey)
    setPreviewFile(deleteKey)
    setDiffPanelTab(deleteKey)
    setDiffRefreshVersion(deleteKey)
    setDiffUnseen(deleteKey)
    setDiffUnseenFiles(deleteKey)
    setDiffData(deleteKey)
    setSessionChannelMap(deleteKey)
    setSessionModelMap(deleteKey)
    // 视图状态（预览开关 + 上次视图）：删除/归档是终态，统一清理避免孤立条目
    setSessionViewStateMap(deleteKey)

    // 重型流式数据：streamingStates（累积 content + toolActivities）与 liveMessages（SDK 消息数组）
    setStreamingStates(deleteKey)
    setLiveMessagesMap(deleteKey)

    // 待发送附件：先释放 blob URL 和 window 缓存中的 base64，再删 base map entry。
    // 与文字草稿不同，附件涉及 ObjectURL 和大体积二进制数据，删除/归档时不保留。
    const sessionPending = store.get(agentSessionPendingFilesAtom).get(id)
    if (sessionPending && sessionPending.length > 0) {
      for (const f of sessionPending) {
        if (f.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(f.previewUrl)
        window.__pendingAgentFileData?.delete(f.id)
      }
      setSessionPendingFiles(deleteKey)
    }

    // atomFamily 内部缓存（Jotai 对 string key 强引用 Map，不显式 remove 永不释放）。
    // 删除/归档是会话的终态，连同草稿一起清理，无需像关闭 Tab 那样保留可恢复输入。
    agentSessionStreamingStateAtomFamily.remove(id)
    agentSessionDraftAtomFamily.remove(id)
    agentSessionDraftHtmlAtomFamily.remove(id)
    agentPendingFilesAtomFamily.remove(id)
    backgroundTasksAtomFamily.remove(id)
    sessionPersistedPermissionModeAtom.remove(id)
    sessionExistsAtom.remove(id)

    clearPreviewCacheForSession(id)
  }, [setConvModels, setConvContextLength, setConvThinking, setConvParallel, setConvPromptId, setPreviewPanelOpen, setPreviewFile, setDiffPanelTab, setDiffRefreshVersion, setDiffUnseen, setDiffUnseenFiles, setDiffData, setSessionChannelMap, setSessionModelMap, setSessionViewStateMap, setStreamingStates, setLiveMessagesMap, setSessionPendingFiles, store])

  const currentWorkspaceSlug = React.useMemo(() => {
    if (!currentWorkspaceId) return null
    return workspaces.find((w) => w.id === currentWorkspaceId)?.slug ?? null
  }, [currentWorkspaceId, workspaces])

  const workspaceNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const w of workspaces) map.set(w.id, w.name)
    return map
  }, [workspaces])

  React.useEffect(() => {
    if (!currentWorkspaceSlug || mode !== 'agent') {
      setCapabilities(null)
      return
    }
    window.electronAPI
      .getWorkspaceCapabilities(currentWorkspaceSlug)
      .then(setCapabilities)
      .catch(console.error)
  }, [currentWorkspaceSlug, mode, activeView, capabilitiesVersion])

  /** 置顶对话列表（排除 draft，归档由底部 Popover 展示） */
  const pinnedConversations = React.useMemo(
    () => conversations.filter((c) => c.pinned && !draftSessionIds.has(c.id)),
    [conversations, draftSessionIds]
  )

  /** Working 区域状态（已不用于目录区分组，但保留状态供其他模块用） */
  const workingSessionIds = useAtomValue(workingSessionIdsSetAtom)

  /** 置顶 Agent 会话列表已废弃：目录区不再拆"工作中/置顶"两组，
   * 全部会话（含 pinned/working）统一按 updatedAt 倒序平铺。 */

  /** 对话按日期分组（排除归档，归档会话由底部 Popover 展示） */
  const conversationGroups = React.useMemo(
    () => {
      const filtered = conversations.filter((c) => !c.archived && !c.pinned && !draftSessionIds.has(c.id))
      return groupByDate(filtered)
    },
    [conversations, draftSessionIds]
  )

  /** 已归档对话数量 */
  const archivedConversationCount = React.useMemo(
    () => conversations.filter((c) => c.archived).length,
    [conversations]
  )

  /** 已归档 Agent 会话数量（当前工作区） */
  const archivedAgentSessionCount = React.useMemo(
    () => agentSessions.filter((s) => s.archived && (!currentWorkspaceId || s.workspaceId === currentWorkspaceId)).length,
    [agentSessions, currentWorkspaceId]
  )

  /** 归档的 Chat 对话列表（按 updatedAt 倒序，不分组供 Popover 平铺） */
  const archivedConversations = React.useMemo(
    () => conversations
      .filter((c) => c.archived && !draftSessionIds.has(c.id))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [conversations, draftSessionIds],
  )

  /** 归档的 Agent 会话列表（按 updatedAt 倒序，平铺） */
  const archivedAgentSessionsList = React.useMemo(
    () => agentSessions
      .filter((s) => s.archived && (!currentWorkspaceId || s.workspaceId === currentWorkspaceId) && !draftSessionIds.has(s.id))
      .sort((a, b) => b.updatedAt - a.updatedAt),
    [agentSessions, currentWorkspaceId, draftSessionIds],
  )

  // 初始加载对话列表 + 用户档案 + Agent 会话
  React.useEffect(() => {
    window.electronAPI
      .listConversations()
      .then((list) => {
        setConversations(list)
      })
      .catch(console.error)
    window.electronAPI
      .getUserProfile()
      .then(setUserProfile)
      .catch(console.error)
    window.electronAPI
      .listAgentSessions()
      .then(setAgentSessions)
      .catch(console.error)
     
  }, [setConversations, setUserProfile, setAgentSessions])

  // 窗口聚焦时重新同步列表，修复长时间后前后端不一致
  React.useEffect(() => {
    const handleFocus = (): void => {
      window.electronAPI.listConversations().then(setConversations).catch(console.error)
      window.electronAPI.listAgentSessions().then(setAgentSessions).catch(console.error)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [setConversations, setAgentSessions])

  /** 处理导航项点击 */
  const handleItemClick = (item: SidebarItemId): void => {
    if (item === 'pinned') {
      // 置顶按钮仅切换展开/收起，不改变 activeView
      setPinnedExpanded((prev) => !prev)
      return
    }
    setActiveItem(item)
    setActiveView(ITEM_TO_VIEW[item])
  }

  /** 创建新对话（继承当前选中的模型/渠道） */
  const handleNewConversation = async (): Promise<void> => {
    try {
      const meta = await window.electronAPI.createConversation(
        undefined,
        selectedModel?.modelId,
        selectedModel?.channelId,
      )
      setConversations((prev) => [meta, ...prev])
      // 打开新标签页
      openSession('chat', meta.id, meta.title)
      // 确保在对话视图
      setActiveView('conversations')
      setActiveItem('all-chats')
      // 根据默认提示词重置选中
      if (promptConfig.defaultPromptId) {
        setSelectedPromptId(promptConfig.defaultPromptId)
      }
    } catch (error) {
      console.error('[侧边栏] 创建对话失败:', error)
    }
  }

  /** 选择对话（打开或聚焦标签页） */
  const handleSelectConversation = React.useCallback((id: string, title: string): void => {
    openSession('chat', id, title)
    setActiveView('conversations')
    setActiveItem('all-chats')
  }, [openSession, setActiveView])

  /** 请求删除对话（弹出确认框） */
  const handleRequestDelete = React.useCallback((id: string): void => {
    setPendingDeleteId(id)
  }, [])

  /** 重命名对话标题 */
  const handleRename = React.useCallback(async (id: string, newTitle: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.updateConversationTitle(id, newTitle)
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
      // 同步更新标签页标题
      setTabs((prev) => updateTabTitle(prev, id, newTitle))
    } catch (error) {
      console.error('[侧边栏] 重命名对话失败:', error)
    }
  }, [setConversations, setTabs])

  /** 切换对话置顶状态 */
  const handleTogglePin = React.useCallback(async (id: string): Promise<void> => {
    try {
      const original = store.get(conversationsAtom).find((c) => c.id === id)
      const updated = await window.electronAPI.togglePinConversation(id)
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
      // 归档会话被置顶时会自动取消归档
      if (original?.archived && updated.pinned && !updated.archived) {
        toast.success('已取消归档并置顶')
      }
    } catch (error) {
      console.error('[侧边栏] 切换置顶失败:', error)
    }
  }, [store, setConversations])

  /** 切换对话归档状态 */
  const handleToggleArchive = React.useCallback(async (id: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.toggleArchiveConversation(id)
      setConversations((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      )
      // 归档时自动关闭该对话的标签页，并同步新激活标签的副作用
      // （appMode、currentXxxId 等），避免文件面板/工具栏等 per-tab
      // 状态被遗留为旧值或被错误地置 null。
      if (updated.archived) {
        const currentTabs = store.get(tabsAtom)
        const currentActiveTabId = store.get(activeTabIdAtom)
        const wasActive = currentActiveTabId === id
        const tabResult = closeTab(currentTabs, currentActiveTabId, id)
        setTabs(tabResult.tabs)
        setActiveTabId(tabResult.activeTabId)
        cleanupMapAtoms(id)
        if (wasActive) {
          const newActiveTab = tabResult.activeTabId
            ? tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null
            : null
          syncActiveTabSideEffects(newActiveTab)
        }
      }
      toast.success(updated.archived ? '已归档' : '已取消归档')
    } catch (error) {
      console.error('[侧边栏] 切换归档失败:', error)
    }
  }, [store, setConversations, setTabs, setActiveTabId, cleanupMapAtoms, syncActiveTabSideEffects])

  /** 确认删除对话 */
  const handleConfirmDelete = async (): Promise<void> => {
    if (!pendingDeleteId) return

    // 关闭对应的标签页：setTabs 与 setActiveTabId 成组更新，便于阅读，
    // 也避免将来在两者之间意外插入 await 导致跨渲染状态不一致。
    // （React 18 在同一事件回调中会自动批处理多次 setState，所以单次渲染
    // 的一致性由 React 保证，这里只是保持代码组织清晰。）
    const wasActive = activeTabId === pendingDeleteId
    const tabResult = closeTab(tabs, activeTabId, pendingDeleteId)
    setTabs(tabResult.tabs)
    setActiveTabId(tabResult.activeTabId)

    // 若关闭的是当前活跃标签，同步新激活标签的副作用（appMode、
    // currentXxxId、以及右侧文件面板等 per-tab 状态），保持与 TabBar
    // 关闭逻辑一致，避免删除/归档当前会话后新标签状态缺失。
    if (wasActive) {
      const newActiveTab = tabResult.activeTabId
        ? tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null
        : null
      syncActiveTabSideEffects(newActiveTab)
    }

    // 清理 draft 标记（如有）
    setDraftSessionIds((prev: Set<string>) => {
      if (!prev.has(pendingDeleteId)) return prev
      const next = new Set(prev)
      next.delete(pendingDeleteId)
      return next
    })

    // 清理 per-conversation/session Map atoms 条目
    cleanupMapAtoms(pendingDeleteId)

    // 从 Working Done 集合移除
    setWorkingDone((prev) => {
      if (!prev.has(pendingDeleteId)) return prev
      const next = new Set(prev)
      next.delete(pendingDeleteId)
      return next
    })

    if (mode === 'agent') {
      // Agent 模式：删除 Agent 会话
      // 注意：当前会话指针（currentAgentSessionId）已由上面的
      // syncActiveTabSideEffects 在 wasActive 分支同步到新激活标签，
      // 这里不要再按旧闭包值强制置 null，否则会覆盖新 sessionId，
      // 导致 RightSidePanel 消失（依赖 currentAgentSessionIdAtom）。
      try {
        await window.electronAPI.deleteAgentSession(pendingDeleteId)
        // 全量刷新确保与后端同步
        const sessions = await window.electronAPI.listAgentSessions()
        setAgentSessions(sessions)
      } catch (error) {
        console.error('[侧边栏] 删除 Agent 会话失败:', error)
        // 即使后端报错，也从本地列表移除（可能是会话已不存在）
        setAgentSessions((prev) => prev.filter((s) => s.id !== pendingDeleteId))
      } finally {
        // 清理该会话的消息缓存，避免已删除会话的消息数组滞留内存
        setAgentMessagesCache((prev) => {
          if (!prev.has(pendingDeleteId)) return prev
          const next = new Map(prev)
          next.delete(pendingDeleteId)
          return next
        })
        setPendingDeleteId(null)
      }
      return
    }

    try {
      await window.electronAPI.deleteConversation(pendingDeleteId)
      // 全量刷新确保与后端同步
      const conversations = await window.electronAPI.listConversations()
      setConversations(conversations)
    } catch (error) {
      console.error('[侧边栏] 删除对话失败:', error)
      // 即使后端报错，也从本地列表移除（可能是对话已不存在）
      setConversations((prev) => prev.filter((c) => c.id !== pendingDeleteId))
    } finally {
      setPendingDeleteId(null)
    }
  }

  /** 创建新 Agent 会话 */
  const handleNewAgentSession = async (): Promise<void> => {
    try {
      const meta = await window.electronAPI.createAgentSession(
        undefined,
        agentChannelId || undefined,
        currentWorkspaceId || undefined,
      )
      setAgentSessions((prev) => [meta, ...prev])
      // 从全局默认值初始化 per-session 渠道/模型配置
      if (agentChannelId) {
        setSessionChannelMap((prev) => {
          const map = new Map(prev)
          map.set(meta.id, agentChannelId)
          return map
        })
      }
      if (agentModelId) {
        setSessionModelMap((prev) => {
          const map = new Map(prev)
          map.set(meta.id, agentModelId)
          return map
        })
      }
      // 打开新标签页
      openSession('agent', meta.id, meta.title)
      setActiveView('conversations')
      setActiveItem('all-chats')
    } catch (error) {
      console.error('[侧边栏] 创建 Agent 会话失败:', error)
    }
  }

  /** 选择 Agent 会话（打开或聚焦标签页） */
  const handleSelectAgentSession = React.useCallback((id: string, title: string): void => {
    openSession('agent', id, title)
    setActiveView('conversations')
    setActiveItem('all-chats')
    // 清除该会话的"已完成未查看"标记
    setUnviewedCompleted((prev: Set<string>) => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }, [openSession, setActiveView, setUnviewedCompleted])

  /** 重命名 Agent 会话标题 */
  const handleAgentRename = React.useCallback(async (id: string, newTitle: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.updateAgentSessionTitle(id, newTitle)
      setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
      // 同步更新标签页标题
      setTabs((prev) => updateTabTitle(prev, id, newTitle))
    } catch (error) {
      console.error('[侧边栏] 重命名 Agent 会话失败:', error)
    }
  }, [setAgentSessions, setTabs])

  /** 切换 Agent 会话置顶状态 */
  const handleTogglePinAgent = React.useCallback(async (id: string): Promise<void> => {
    try {
      const original = store.get(agentSessionsAtom).find((s) => s.id === id)
      const updated = await window.electronAPI.togglePinAgentSession(id)
      setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
      if (updated.pinned) {
        const isRunning = store.get(agentSessionIndicatorMapAtom).get(id) === 'running'
        if (isRunning) {
          toast.success('已置顶', {
            description: '当前 Agent 正在执行中，移出工作中后会显示到置顶区域',
          })
        } else if (original?.archived && !updated.archived) {
          toast.success('已置顶', { description: '已自动取消归档' })
        } else {
          toast.success('已置顶')
        }
      } else {
        toast.success('已取消置顶')
      }
    } catch (error) {
      console.error('[侧边栏] 切换 Agent 会话置顶失败:', error)
    }
  }, [store, setAgentSessions])

  /** 切换 Agent 会话手动工作中状态 */
  const handleToggleManualWorkingAgent = React.useCallback(async (id: string): Promise<void> => {
    try {
      const isCurrentlyInWorking = store.get(workingSessionIdsSetAtom).has(id)
      if (isCurrentlyInWorking) {
        // 从工作中移出：清除 manualWorking + 清除 workingDone
        const session = store.get(agentSessionsAtom).find((s) => s.id === id)
        if (session?.manualWorking) {
          const updated = await window.electronAPI.toggleManualWorkingAgentSession(id)
          setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
        }
        setWorkingDone((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
      } else {
        // 加入工作中
        const original = store.get(agentSessionsAtom).find((s) => s.id === id)
        const updated = await window.electronAPI.toggleManualWorkingAgentSession(id)
        setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
        if (original?.archived && updated.manualWorking && !updated.archived) {
          toast.success('已取消归档并标记为工作中')
        }
      }
    } catch (error) {
      console.error('[Sidebar] Failed to toggle manual working:', error)
      toast.error('操作失败')
    }
  }, [store, setAgentSessions, setWorkingDone])

  /** 确认已完成：从 Working 中移出，但会话仍可通过搜索或最近工作找到 */
  const handleConfirmWorkingDoneAgent = React.useCallback(async (id: string): Promise<void> => {
    try {
      // 通过 IPC 清除持久化的 completedButUnconfirmed 和 manualWorking 状态
      const updated = await window.electronAPI.confirmWorkingDoneAgentSession(id)
      setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))

      setWorkingDone((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setUnviewedCompleted((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })

      toast.success('已标记为完成', {
        description: '之后可以通过搜索或最近工作找到这个会话',
      })
    } catch (error) {
      console.error('[侧边栏] 标记完成失败:', error)
      toast.error('标记完成失败')
    }
  }, [setAgentSessions, setWorkingDone, setUnviewedCompleted])

  /** 切换 Agent 会话归档状态 */
  const handleToggleArchiveAgent = React.useCallback(async (id: string): Promise<void> => {
    try {
      const updated = await window.electronAPI.toggleArchiveAgentSession(id)
      setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
      // 归档时自动关闭该会话的标签页，并同步新激活标签的副作用，
      // 否则 RightSidePanel（依赖 currentAgentSessionIdAtom）会因为
      // 指针被错误置 null 而消失。
      if (updated.archived) {
        const currentTabs = store.get(tabsAtom)
        const currentActiveTabId = store.get(activeTabIdAtom)
        const wasActive = currentActiveTabId === id
        const tabResult = closeTab(currentTabs, currentActiveTabId, id)
        setTabs(tabResult.tabs)
        setActiveTabId(tabResult.activeTabId)
        cleanupMapAtoms(id)
        // 从 Working Done 集合移除
        setWorkingDone((prev) => {
          if (!prev.has(id)) return prev
          const next = new Set(prev)
          next.delete(id)
          return next
        })
        if (wasActive) {
          const newActiveTab = tabResult.activeTabId
            ? tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null
            : null
          syncActiveTabSideEffects(newActiveTab)
        }
      }
      toast.success(updated.archived ? '已归档' : '已取消归档')
    } catch (error) {
      console.error('[侧边栏] 切换 Agent 会话归档失败:', error)
    }
  }, [store, setAgentSessions, setTabs, setActiveTabId, cleanupMapAtoms, setWorkingDone, syncActiveTabSideEffects])

  /** 请求迁移会话到其他工作区（弹出迁移对话框） */
  const handleRequestMove = React.useCallback((id: string): void => {
    setMoveTargetId(id)
  }, [])

  /** 迁移会话到另一个工作区后的回调 */
  const handleSessionMoved = (updatedSession: AgentSessionMeta, targetWorkspaceName: string): void => {
    setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updatedSession))
    // 如果迁移的是当前选中的会话，取消选中并关闭标签页
    if (currentAgentSessionId === updatedSession.id) {
      const tabResult = closeTab(tabs, activeTabId, updatedSession.id)
      setTabs(tabResult.tabs)
      setActiveTabId(tabResult.activeTabId)
      setCurrentAgentSessionId(null)
      // 从 Working Done 集合移除
      setWorkingDone((prev) => {
        if (!prev.has(updatedSession.id)) return prev
        const next = new Set(prev)
        next.delete(updatedSession.id)
        return next
      })
    }
    setMoveTargetId(null)
    toast.success('会话已迁移', {
      description: `已迁移到「${targetWorkspaceName}」，请切换工作区查看`,
    })
  }

  /** Agent 会话按工作区过滤 + 排除归档（归档会话由底部 Popover 展示） */
  const filteredAgentSessions = React.useMemo(
    () => {
      const byWorkspace = agentSessions.filter((s) => s.workspaceId === currentWorkspaceId && !draftSessionIds.has(s.id))
      return sortAgentSessionsByUpdatedAtDesc(byWorkspace.filter((s) => !s.archived))
    },
    [agentSessions, currentWorkspaceId, draftSessionIds]
  )

  const railRecentItems = React.useMemo(() => {
    if (mode === 'chat') {
      return conversations
        .filter((c) => !c.archived && !draftSessionIds.has(c.id))
        .sort((a, b) => {
          const activeDelta = Number(b.id === activeSessionId) - Number(a.id === activeSessionId)
          if (activeDelta !== 0) return activeDelta
          const streamingDelta = Number(streamingIds.has(b.id)) - Number(streamingIds.has(a.id))
          if (streamingDelta !== 0) return streamingDelta
          const pinnedDelta = Number(!!b.pinned) - Number(!!a.pinned)
          if (pinnedDelta !== 0) return pinnedDelta
          return b.updatedAt - a.updatedAt
        })
        .slice(0, 5)
        .map((conversation) => ({
          id: conversation.id,
          title: conversation.title,
          type: 'chat' as const,
          initial: getRailInitial(conversation.title),
          active: conversation.id === activeSessionId,
          status: streamingIds.has(conversation.id) ? 'running' as const : 'idle' as const,
          pinned: !!conversation.pinned,
          workspaceName: undefined,
        }))
    }

    return agentSessions
      .filter((session) =>
        !session.archived
        && !draftSessionIds.has(session.id)
        && (!currentWorkspaceId || session.workspaceId === currentWorkspaceId)
      )
      .sort((a, b) => {
        const statusA = agentIndicatorMap.get(a.id) ?? (unviewedCompletedSessionIds.has(a.id) ? 'completed' : 'idle')
        const statusB = agentIndicatorMap.get(b.id) ?? (unviewedCompletedSessionIds.has(b.id) ? 'completed' : 'idle')
        const priority = (session: AgentSessionMeta, status: SessionIndicatorStatus): number => {
          if (session.id === activeSessionId) return 0
          if (status === 'blocked') return 1
          if (status === 'running') return 2
          if (workingSessionIds.has(session.id)) return 3
          if (session.pinned) return 4
          if (status === 'completed') return 5
          return 6
        }
        const priorityDelta = priority(a, statusA) - priority(b, statusB)
        if (priorityDelta !== 0) return priorityDelta
        return b.updatedAt - a.updatedAt
      })
      .slice(0, 5)
      .map((session) => ({
        id: session.id,
        title: session.title,
        type: 'agent' as const,
        initial: getRailInitial(session.title),
        active: session.id === activeSessionId,
        status: agentIndicatorMap.get(session.id) ?? (unviewedCompletedSessionIds.has(session.id) ? 'completed' as const : 'idle' as const),
        pinned: !!session.pinned,
        workspaceName: session.workspaceId ? workspaceNameMap.get(session.workspaceId) : undefined,
      }))
  }, [
    mode,
    conversations,
    agentSessions,
    draftSessionIds,
    currentWorkspaceId,
    activeSessionId,
    streamingIds,
    agentIndicatorMap,
    unviewedCompletedSessionIds,
    workingSessionIds,
    workspaceNameMap,
  ])

  // 删除确认弹窗（collapsed/expanded 共享）
  const deleteDialog = (
    <AlertDialog
      open={pendingDeleteId !== null}
      onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
    >
      <AlertDialogContent
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            handleConfirmDelete()
          }
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除对话</AlertDialogTitle>
          <AlertDialogDescription>
            删除后将无法恢复，确定要删除这个对话吗？
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>取消</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirmDelete}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            删除
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )

  // 迁移会话对话框（collapsed/expanded 共享）
  const moveDialog = (
    <MoveSessionDialog
      open={moveTargetId !== null}
      onOpenChange={(open) => { if (!open) setMoveTargetId(null) }}
      sessionId={moveTargetId ?? ''}
      currentWorkspaceId={currentWorkspaceId ?? undefined}
      workspaces={workspaces}
      onMoved={handleSessionMoved}
    />
  )

  // ===== 折叠/展开：组件始终挂载，通过外层 width/opacity transition 实现动画 =====
  // 内容始终渲染，仅在折叠态通过外层 pointer-events-none 屏蔽交互

  // ===== 展开状态：完整侧边栏 =====
  // 根据 topLevelMode + activeRailItem 渲染不同功能区内容
  const renderRailContent = () => {
    // TA 模式：LeftSidebar 内容由主区 TATabBar 决定（订阅 taActiveTabAtom）
    if (topLevelMode === 'ta') {
      return <TASidebar />
    }

    // 通用模式根据 activeRailItem 渲染
    switch (activeRailItem) {
      case 'files':
        return <FilesRailContent workspaceKey={currentWorkspaceId ?? 'no-workspace'} />
      case 'skills':
        return (
          <SkillsRailContent
            capabilities={capabilities}
            onConfigure={() => { setSettingsTab('agent'); setSettingsOpen(true) }}
          />
        )
      case 'sessions':
      default:
        return (
          <SessionsRailContent
            mode={mode}
            pinnedExpanded={pinnedExpanded}
            setPinnedExpanded={setPinnedExpanded}
            pinnedConversations={pinnedConversations}
            conversationGroups={conversationGroups}
            activeSessionId={activeSessionId}
            streamingIds={streamingIds}
            filteredAgentSessions={filteredAgentSessions}
            agentIndicatorMap={agentIndicatorMap}
            workingSessionIds={workingSessionIds}
            handleSelectConversation={handleSelectConversation}
            handleRequestDelete={handleRequestDelete}
            handleRename={handleRename}
            handleTogglePin={handleTogglePin}
            handleToggleArchive={handleToggleArchive}
            handleSelectAgentSession={handleSelectAgentSession}
            handleAgentRename={handleAgentRename}
            handleTogglePinAgent={handleTogglePinAgent}
            handleToggleManualWorkingAgent={handleToggleManualWorkingAgent}
            handleToggleArchiveAgent={handleToggleArchiveAgent}
            handleConfirmWorkingDoneAgent={handleConfirmWorkingDoneAgent}
            handleRequestMove={handleRequestMove}
            workspaceNameMap={workspaceNameMap}
          />
        )
    }
  }

  return (
    <div
      className={cn(
        'relative h-full flex flex-col bg-background rounded-2xl shadow-xl overflow-hidden',
        'transition-[width,opacity,margin-left] duration-300 ease-in-out',
        isSidebarCollapsed
          ? 'opacity-0 pointer-events-none ml-0'
          : 'opacity-100 ml-2',
      )}
      style={{
        width: isSidebarCollapsed ? 0 : (width ?? 240),
        minWidth: 0,
        flexShrink: 0,
      }}
    >
      <SidebarWindowDragStrip
        height={isMac ? SIDEBAR_DRAG_STRIP_HEIGHT.expandedMac : SIDEBAR_DRAG_STRIP_HEIGHT.expanded}
      />

      {/* macOS 需要避开左上角红绿灯；边栏覆盖全局标题栏拖拽层，因此留白自身也要可拖拽。 */}
      <div className={cn('w-full flex-shrink-0 titlebar-drag-region', isMac ? 'h-[30px]' : 'h-1')} />

      {/* 功能区标题：静态文字标识当前选中内容。收起/展开目录区走 Cmd+B 快捷键或悬停在功能区顶部按钮 */}
      <div className="titlebar-drag-region flex items-center px-3 h-8">
        <span className="text-xs font-medium text-muted-foreground">
          {activeRailItem === 'sessions' && '会话'}
          {activeRailItem === 'files' && '文件'}
          {activeRailItem === 'skills' && 'Skills'}
        </span>
      </div>

      {/* 工作区选择（仅 Agent 模式 + 目录区展开时）：目录区折叠时由功能区的 Briefcase 按钮承担 */}
      {mode === 'agent' && !isSidebarCollapsed && (
        <div className="px-3 pb-1 flex-shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-[10px] text-[12px] text-foreground/70 bg-primary/5 hover:bg-primary/10 transition-colors duration-100 titlebar-no-drag border border-border/40 hover:border-border/70"
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <FolderOpen size={12} className="flex-shrink-0 text-foreground/40" />
                  <span className="truncate font-medium">
                    {currentWorkspaceName ?? '选择工作区'}
                  </span>
                </span>
                <ChevronDown size={12} className="flex-shrink-0 text-foreground/40" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              sideOffset={4}
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
      )}

      {/* 新对话/新会话按钮 + 搜索按钮（仅会话功能区显示） */}
      {activeRailItem === 'sessions' && (
        <div className="px-3 pt-2 flex items-center gap-1.5">
          <button
            onClick={mode === 'agent' ? handleNewAgentSession : handleNewConversation}
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-[10px] text-[13px] font-medium text-foreground/70 bg-primary/5 hover:bg-primary/10 transition-colors duration-100 titlebar-no-drag border border-border/40 hover:border-border/70"
          >
            <Plus size={14} />
            <span>{mode === 'agent' ? '新会话' : '新对话'}</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setSearchDialogOpen(true)}
                className="flex-shrink-0 size-[36px] flex items-center justify-center rounded-[10px] text-foreground/40 bg-primary/5 hover:bg-primary/10 hover:text-foreground/60 transition-colors duration-100 titlebar-no-drag border border-border/40 hover:border-border/70"
              >
                <Search size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">搜索 ({getAcceleratorDisplay(getActiveAccelerator('global-search'))})</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 功能区内容 */}
      {renderRailContent()}

      {/* 已归档 Popover 入口：固定在底部，点击展开成完整列表（不切换整页 viewMode） */}
      {activeRailItem === 'sessions' && (
        <div className="px-3 pb-1 flex-shrink-0">
          {mode === 'chat' && archivedConversationCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] text-foreground/40 hover:bg-foreground/[0.04] hover:text-foreground/60 transition-colors titlebar-no-drag"
                >
                  <Archive size={13} className="text-foreground/30" />
                  <span>已归档 ({archivedConversationCount})</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={6}
                className="w-72 p-0 overflow-hidden"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/40">
                  <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide">
                    已归档对话 · {archivedConversationCount}
                  </span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-1">
                  {archivedConversations.length === 0 ? (
                    <div className="py-3 text-center text-[12px] text-foreground/40">
                      暂无已归档对话
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {archivedConversations.map((conv) => (
                        <ConversationItem
                          key={conv.id}
                          conversation={conv}
                          active={conv.id === activeSessionId}
                          streaming={streamingIds.has(conv.id)}
                          showPinIcon={!!conv.pinned}
                          onSelect={handleSelectConversation}
                          onRequestDelete={handleRequestDelete}
                          onRename={handleRename}
                          onTogglePin={handleTogglePin}
                          onToggleArchive={handleToggleArchive}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
          {mode === 'agent' && archivedAgentSessionCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] text-foreground/40 hover:bg-foreground/[0.04] hover:text-foreground/60 transition-colors titlebar-no-drag"
                >
                  <Archive size={13} className="text-foreground/30" />
                  <span>已归档 ({archivedAgentSessionCount})</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="top"
                align="start"
                sideOffset={6}
                className="w-72 p-0 overflow-hidden"
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-border/40">
                  <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide">
                    已归档会话 · {archivedAgentSessionCount}
                  </span>
                </div>
                <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-1">
                  {archivedAgentSessionsList.length === 0 ? (
                    <div className="py-3 text-center text-[12px] text-foreground/40">
                      暂无已归档会话
                    </div>
                  ) : (
                    <div className="flex flex-col gap-0.5">
                      {archivedAgentSessionsList.map((session) => (
                        <AgentSessionItem
                          key={session.id}
                          session={session}
                          active={session.id === activeSessionId}
                          indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
                          isInWorkingSection={workingSessionIds.has(session.id)}
                          showPinIcon={!!session.pinned}
                          workspaceName={session.workspaceId ? workspaceNameMap.get(session.workspaceId) : undefined}
                          onSelect={handleSelectAgentSession}
                          onConfirmDone={handleConfirmWorkingDoneAgent}
                          onRequestDelete={handleRequestDelete}
                          onRequestMove={handleRequestMove}
                          onRename={handleAgentRename}
                          onTogglePin={handleTogglePinAgent}
                          onToggleManualWorking={handleToggleManualWorkingAgent}
                          onToggleArchive={handleToggleArchiveAgent}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {deleteDialog}
      {moveDialog}
      <SearchDialog />
    </div>
  )
}

// ===== 功能区内容组件 =====

/** 会话功能区内容 */
function SessionsRailContent({
  mode,
  pinnedExpanded,
  setPinnedExpanded,
  pinnedConversations,
  conversationGroups,
  activeSessionId,
  streamingIds,
  filteredAgentSessions,
  agentIndicatorMap,
  workingSessionIds,
  handleSelectConversation,
  handleRequestDelete,
  handleRename,
  handleTogglePin,
  handleToggleArchive,
  handleSelectAgentSession,
  handleAgentRename,
  handleTogglePinAgent,
  handleToggleManualWorkingAgent,
  handleToggleArchiveAgent,
  handleConfirmWorkingDoneAgent,
  handleRequestMove,
  workspaceNameMap,
}: {
  mode: AppMode
  pinnedExpanded: boolean
  setPinnedExpanded: (v: boolean) => void
  pinnedConversations: ConversationMeta[]
  conversationGroups: Array<{ label: string; items: ConversationMeta[] }>
  activeSessionId: string | null
  streamingIds: Set<string>
  filteredAgentSessions: AgentSessionMeta[]
  agentIndicatorMap: Map<string, SessionIndicatorStatus>
  workingSessionIds: Set<string>
  handleSelectConversation: (id: string, title: string) => void
  handleRequestDelete: (id: string) => void
  handleRename: (id: string, newTitle: string) => Promise<void>
  handleTogglePin: (id: string) => Promise<void>
  handleToggleArchive: (id: string) => Promise<void>
  handleSelectAgentSession: (id: string, title: string) => void
  handleAgentRename: (id: string, newTitle: string) => Promise<void>
  handleTogglePinAgent: (id: string) => Promise<void>
  handleToggleManualWorkingAgent: (id: string) => Promise<void>
  handleToggleArchiveAgent: (id: string) => Promise<void>
  handleConfirmWorkingDoneAgent: (id: string) => Promise<void>
  handleRequestMove: (id: string) => void
  workspaceNameMap: Map<string, string>
}): React.ReactElement {
  // Chat 模式：导航菜单（置顶区域）
  if (mode === 'chat') {
    return (
      <>
        <div className="flex flex-col gap-1 pt-3 px-3">
          <SidebarItem
            icon={<Pin size={16} />}
            label="置顶对话"
            suffix={
              pinnedConversations.length > 0 ? (
                pinnedExpanded
                  ? <ChevronDown size={14} className="text-foreground/40" />
                  : <ChevronRight size={14} className="text-foreground/40" />
              ) : undefined
            }
            onClick={() => setPinnedExpanded(!pinnedExpanded)}
          />
        </div>

        {/* 置顶对话区域 */}
        {pinnedExpanded && pinnedConversations.length > 0 && (
          <div className="px-3 pt-1 pb-1">
            <div className="flex flex-col gap-0.5 pl-1 border-l-2 border-primary/20 ml-2">
              {pinnedConversations.map((conv) => (
                <ConversationItem
                  key={`pinned-${conv.id}`}
                  conversation={conv}
                  active={conv.id === activeSessionId}
                  streaming={streamingIds.has(conv.id)}
                  showPinIcon={false}
                  onSelect={handleSelectConversation}
                  onRequestDelete={handleRequestDelete}
                  onRename={handleRename}
                  onTogglePin={handleTogglePin}
                  onToggleArchive={handleToggleArchive}
                />
              ))}
            </div>
          </div>
        )}

        {/* 对话列表 */}
        <div className="flex-1 overflow-y-auto px-3 pt-2 pb-3 scrollbar-thin titlebar-no-drag">
          {conversationGroups.map((group) => (
            <div key={group.label} className="mb-1">
              <div className="px-3 pt-2 pb-1 text-[11px] font-medium text-foreground/40 select-none">
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    active={conv.id === activeSessionId}
                    streaming={streamingIds.has(conv.id)}
                    showPinIcon={!!conv.pinned}
                    onSelect={handleSelectConversation}
                    onRequestDelete={handleRequestDelete}
                    onRename={handleRename}
                    onTogglePin={handleTogglePin}
                    onToggleArchive={handleToggleArchive}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </>
    )
  }

  // Agent 模式
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin min-h-0 titlebar-no-drag">
      {filteredAgentSessions.length === 0 ? (
        <div className="px-2 py-3 text-[11px] text-foreground/30 text-center select-none">
          暂无会话，点击上方"+新会话"创建
        </div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {filteredAgentSessions.map((session) => (
            <AgentSessionItem
              key={session.id}
              session={session}
              active={session.id === activeSessionId}
              indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
              isInWorkingSection={workingSessionIds.has(session.id)}
              showPinIcon={!!session.pinned}
              workspaceName={session.workspaceId ? workspaceNameMap.get(session.workspaceId) : undefined}
              onSelect={handleSelectAgentSession}
              onConfirmDone={handleConfirmWorkingDoneAgent}
              onRequestDelete={handleRequestDelete}
              onRequestMove={handleRequestMove}
              onRename={handleAgentRename}
              onTogglePin={handleTogglePinAgent}
              onToggleManualWorking={handleToggleManualWorkingAgent}
              onToggleArchive={handleToggleArchiveAgent}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/** 文件功能区内容 —— 工作区文件树（已从 RightSidePanel 迁出） */
function FilesRailContent({ workspaceKey }: { workspaceKey: string }): React.ReactElement {
  return <WorkspaceFilesView workspaceKey={workspaceKey} />
}

/** Skills 功能区内容 —— MCP server 列表 + Skills 列表 + 能力计数 */
function SkillsRailContent({
  capabilities,
  onConfigure,
}: {
  capabilities: WorkspaceCapabilities | null
  onConfigure: () => void
}): React.ReactElement {
  return <SkillsPanel capabilities={capabilities} onConfigure={onConfigure} />
}

// ===== 对话列表项 =====

// ===== 对话列表项 =====

interface ConversationItemProps {
  conversation: ConversationMeta
  active: boolean
  streaming: boolean
  /** 是否在标题旁显示 Pin 图标 */
  showPinIcon: boolean
  onSelect: (id: string, title: string) => void
  onRequestDelete: (id: string) => void
  onRename: (id: string, newTitle: string) => Promise<void>
  onTogglePin: (id: string) => Promise<void>
  onToggleArchive: (id: string) => Promise<void>
}

const ConversationItem = React.memo(function ConversationItem({
  conversation,
  active,
  streaming,
  showPinIcon,
  onSelect,
  onRequestDelete,
  onRename,
  onTogglePin,
  onToggleArchive,
}: ConversationItemProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const [menuOpen, setMenuOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)
  // 菜单打开时关闭迷你地图预览，避免预览面板盖住菜单项导致点不动
  const preview = useSessionMiniMapHover(300, menuOpen)

  /** 进入编辑模式 */
  const startEdit = (): void => {
    setEditTitle(conversation.title)
    setEditing(true)
    justStartedEditing.current = true
    // 延迟聚焦，等待 ContextMenu 完全关闭后再 focus
    setTimeout(() => {
      justStartedEditing.current = false
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 300)
  }

  /** 保存标题 */
  const saveTitle = async (): Promise<void> => {
    // ContextMenu 关闭导致的 blur，忽略
    if (justStartedEditing.current) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === conversation.title) {
      setEditing(false)
      return
    }
    await onRename(conversation.id, trimmed)
    setEditing(false)
  }

  /** 键盘事件 */
  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  const isPinned = !!conversation.pinned

  const menuItems = (
    MenuItem: typeof ContextMenuItem | typeof DropdownMenuItem,
    MenuSeparator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator,
  ) => (
    <>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => onTogglePin(conversation.id)}>
        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        {isPinned ? '取消置顶' : '置顶对话'}
      </MenuItem>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => startEdit()}>
        <Pencil size={14} />
        重命名
      </MenuItem>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => onToggleArchive(conversation.id)}>
        {conversation.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        {conversation.archived ? '取消归档' : '归档'}
      </MenuItem>
      <MenuSeparator className="my-0.5" />
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5 text-destructive" onSelect={() => onRequestDelete(conversation.id)}>
        <Trash2 size={14} />
        删除对话
      </MenuItem>
    </>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={preview.setAnchorRef}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(conversation.id, conversation.title)}
          onMouseEnter={preview.handleMouseEnter}
          onMouseLeave={preview.handleMouseLeave}
          onDoubleClick={(e) => {
            e.stopPropagation()
            startEdit()
          }}
          className={cn(
            'group relative w-full flex items-center gap-2 px-3 py-[7px] rounded-md transition-colors duration-100 titlebar-no-drag text-left',
            active
              ? 'session-item-selected bg-primary/10 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
              : 'hover:bg-primary/5'
          )}
        >
          {/* 流式状态左侧竖线条（与 Agent 保持一致） */}
          {streaming && (
            <span
              className="absolute left-1 top-1.5 bottom-1.5 w-[2px] rounded-full bg-blue-500 animate-pulse pointer-events-none"
              aria-hidden="true"
            />
          )}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={saveTitle}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent text-[13px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0"
                maxLength={100}
              />
            ) : (
              <div className={cn(
                'truncate text-[13px] leading-5 flex items-center gap-1.5',
                active ? 'text-foreground' : 'text-foreground/80'
              )}>
                {/* 置顶标记 */}
                {showPinIcon && (
                  <Pin size={11} className="flex-shrink-0 text-primary/60" />
                )}
                <span className="truncate">{conversation.title}</span>
              </div>
            )}
          </div>

          {/* 三点菜单按钮（hover 时可见，始终占位避免跳动） */}
          {!editing && (
            <div
              className="flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'p-1 rounded-md text-foreground/30 hover:bg-foreground/[0.08] hover:text-foreground/60 transition-colors',
                      'opacity-0 pointer-events-none',
                      'group-hover:opacity-100 group-hover:pointer-events-auto',
                      'data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto',
                    )}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40 z-[9999] min-w-0 p-0.5">
                  {menuItems(DropdownMenuItem, DropdownMenuSeparator)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-40 z-[9999] min-w-0 p-0.5">
        {menuItems(ContextMenuItem, ContextMenuSeparator)}
      </ContextMenuContent>
      <SessionMiniMapPopover
        target={{
          type: 'chat',
          sessionId: conversation.id,
          title: conversation.title,
        }}
        anchorRef={preview.anchorRef}
        open={preview.isOpen}
        isLeaving={preview.isLeaving}
        onMouseEnter={preview.handlePanelMouseEnter}
        onMouseLeave={preview.handlePanelMouseLeave}
      />
    </ContextMenu>
  )
})

// ===== Agent 会话列表项 =====

/** 会话行左侧状态色块的颜色 — 与 SessionIndicatorStatus 呼应 */
type SessionLeftAccent = 'orange' | 'blue' | 'green'
const SESSION_LEFT_ACCENT_CLASS: Record<SessionLeftAccent, string> = {
  orange: 'border-orange-500',
  blue: 'border-blue-500',
  green: 'border-green-500',
}

interface AgentSessionItemProps {
  session: AgentSessionMeta
  active: boolean
  indicatorStatus: SessionIndicatorStatus
  showPinIcon?: boolean
  /** 是否在工作中分区（auto 或 manual） */
  isInWorkingSection?: boolean
  /** 行左侧状态色块；未传则不显示 */
  leftAccent?: SessionLeftAccent
  /** 是否显示“确认完成”按钮 */
  showConfirmDone?: boolean
  /** 是否禁用悬浮 Mini 地图 */
  disableMiniMap?: boolean
  /** 工作区名称 Badge（跨工作区列表时显示） */
  workspaceName?: string
  onSelect: (id: string, title: string) => void
  onConfirmDone: (id: string) => Promise<void>
  onRequestDelete: (id: string) => void
  onRequestMove: (id: string) => void
  onRename: (id: string, newTitle: string) => Promise<void>
  onTogglePin: (id: string) => Promise<void>
  onToggleManualWorking: (id: string) => Promise<void>
  onToggleArchive: (id: string) => Promise<void>
}

/** 时间显示格式：今天 HH:mm / 昨天 HH:mm / MM/DD */
function formatSessionTime(updatedAt: number): string {
  const date = new Date(updatedAt)
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const pad = (n: number): string => n.toString().padStart(2, '0')
  if (updatedAt >= todayStart) {
    return `今天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  if (updatedAt >= yesterdayStart) {
    return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const AgentSessionItem = React.memo(function AgentSessionItem({
  session,
  active,
  indicatorStatus,
  showPinIcon,
  isInWorkingSection,
  leftAccent,
  showConfirmDone,
  disableMiniMap,
  workspaceName,
  onSelect,
  onConfirmDone,
  onRequestDelete,
  onRequestMove,
  onRename,
  onTogglePin,
  onToggleManualWorking,
  onToggleArchive,
}: AgentSessionItemProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false)
  const [editTitle, setEditTitle] = React.useState('')
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [confirmingDone, setConfirmingDone] = React.useState(false)
  const confirmingDoneTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)
  // 菜单打开时关闭迷你地图预览，避免预览面板盖住菜单项导致点不动
  const preview = useSessionMiniMapHover(300, disableMiniMap || menuOpen)

  React.useEffect(() => {
    return () => {
      if (confirmingDoneTimer.current) clearTimeout(confirmingDoneTimer.current)
    }
  }, [])

  const startEdit = (): void => {
    setEditTitle(session.title)
    setEditing(true)
    justStartedEditing.current = true
    setTimeout(() => {
      justStartedEditing.current = false
      inputRef.current?.focus()
      inputRef.current?.select()
    }, 300)
  }

  const saveTitle = async (): Promise<void> => {
    if (justStartedEditing.current) return
    const trimmed = editTitle.trim()
    if (!trimmed || trimmed === session.title) {
      setEditing(false)
      return
    }
    await onRename(session.id, trimmed)
    setEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      saveTitle()
    } else if (e.key === 'Escape') {
      setEditing(false)
    }
  }

  const isWorking = isInWorkingSection || session.manualWorking
  const canMove = indicatorStatus === 'idle' || indicatorStatus === 'completed'

  const menuItems = (
    MenuItem: typeof ContextMenuItem | typeof DropdownMenuItem,
    MenuSeparator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator,
  ) => (
    <>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => onTogglePin(session.id)}>
        {session.pinned ? <PinOff size={14} /> : <Pin size={14} />}
        {session.pinned ? '取消置顶' : '置顶会话'}
      </MenuItem>
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5"
        disabled={indicatorStatus === 'running'}
        onSelect={() => { if (indicatorStatus !== 'running') onToggleManualWorking(session.id) }}
      >
        <Hammer size={14} className={isWorking ? 'fill-current' : ''} />
        {indicatorStatus === 'running' ? '运行中无法移出' : isWorking ? '取消工作中' : '标记为工作中'}
      </MenuItem>
      {canMove && (
        <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => onRequestMove(session.id)}>
          <ArrowRightLeft size={14} />
          迁移到其他工作区
        </MenuItem>
      )}
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => startEdit()}>
        <Pencil size={14} />
        重命名
      </MenuItem>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => onToggleArchive(session.id)}>
        {session.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        {session.archived ? '取消归档' : '归档'}
      </MenuItem>
      <MenuSeparator className="my-0.5" />
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5 text-destructive" onSelect={() => onRequestDelete(session.id)}>
        <Trash2 size={14} />
        删除会话
      </MenuItem>
    </>
  )

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={preview.setAnchorRef}
          role="button"
          tabIndex={0}
          onClick={() => onSelect(session.id, session.title)}
          onMouseEnter={preview.handleMouseEnter}
          onMouseLeave={preview.handleMouseLeave}
          onDoubleClick={(e) => {
            e.stopPropagation()
            startEdit()
          }}
          className={cn(
            'group relative w-full flex items-center gap-2 px-3 py-[7px] rounded-md transition-colors duration-100 titlebar-no-drag text-left',
            active
              ? 'session-item-selected bg-primary/10 shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
              : 'hover:bg-primary/5'
          )}
        >
          {leftAccent && (
            <span
              className={cn(
                'absolute inset-y-0 left-0 w-0 border-l-[3px] rounded-l-md pointer-events-none',
                SESSION_LEFT_ACCENT_CLASS[leftAccent]
              )}
            />
          )}
          <div className="flex-1 min-w-0">
            {editing ? (
              <input
                ref={inputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={saveTitle}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-transparent text-[13px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0"
                maxLength={100}
              />
            ) : (
              <div className={cn(
                'truncate text-[13px] leading-5 flex items-center gap-1.5',
                active ? 'text-foreground' : 'text-foreground/80'
              )}>
                {showPinIcon && (
                  <Pin size={11} className="flex-shrink-0 text-primary/60" />
                )}
                <span className="truncate flex-1 min-w-0">{session.title}</span>
                {workspaceName && (
                  <span className="flex-shrink-0 px-1.5 py-0 rounded-full bg-primary/10 text-[10px] leading-4 workspace-badge font-medium truncate max-w-[80px]">
                    {workspaceName}
                  </span>
                )}
                <span className="flex-shrink-0 text-[10px] text-foreground/35 tabular-nums">
                  {formatSessionTime(session.updatedAt)}
                </span>
              </div>
            )}
          </div>

          {!editing && showConfirmDone && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={confirmingDone ? '确认完成' : '标记为完成'}
                  className={cn(
                    'flex-shrink-0 p-1 rounded-md transition-colors',
                    confirmingDone
                      ? 'bg-destructive/15 text-destructive hover:bg-destructive/25 opacity-100 pointer-events-auto'
                      : cn(
                          'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary',
                          'opacity-0 pointer-events-none',
                          'group-hover:opacity-100 group-hover:pointer-events-auto',
                          'group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
                        ),
                  )}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!confirmingDone) {
                      setConfirmingDone(true)
                      if (confirmingDoneTimer.current) clearTimeout(confirmingDoneTimer.current)
                      confirmingDoneTimer.current = setTimeout(() => setConfirmingDone(false), 3000)
                    } else {
                      setConfirmingDone(false)
                      if (confirmingDoneTimer.current) clearTimeout(confirmingDoneTimer.current)
                      void onConfirmDone(session.id)
                    }
                  }}
                  onMouseLeave={() => {
                    if (confirmingDone) {
                      if (confirmingDoneTimer.current) clearTimeout(confirmingDoneTimer.current)
                      confirmingDoneTimer.current = setTimeout(() => setConfirmingDone(false), 1500)
                    }
                  }}
                >
                  {confirmingDone ? <Check size={14} strokeWidth={3} /> : <Check size={14} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px]">
                {confirmingDone ? '再次点击确认完成' : '标记为完成。之后可以随时通过搜索或最近工作找到这个会话。'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* 三点菜单按钮（hover 时可见，始终占位避免跳动） */}
          {!editing && (
            <div
              className="flex-shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <DropdownMenu onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'p-1 rounded-md text-foreground/30 hover:bg-foreground/[0.08] hover:text-foreground/60 transition-colors',
                      'opacity-0 pointer-events-none',
                      'group-hover:opacity-100 group-hover:pointer-events-auto',
                      'data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto',
                    )}
                  >
                    <MoreHorizontal size={14} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-40 z-[9999] min-w-0 p-0.5">
                  {menuItems(DropdownMenuItem, DropdownMenuSeparator)}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-40 z-[9999] min-w-0 p-0.5">
        {menuItems(ContextMenuItem, ContextMenuSeparator)}
      </ContextMenuContent>
      {!disableMiniMap && (
        <SessionMiniMapPopover
          target={{
            type: 'agent',
            sessionId: session.id,
            title: session.title,
            workspaceName,
          }}
          anchorRef={preview.anchorRef}
          open={preview.isOpen}
          isLeaving={preview.isLeaving}
          onMouseEnter={preview.handlePanelMouseEnter}
          onMouseLeave={preview.handlePanelMouseLeave}
        />
      )}
    </ContextMenu>
  )
})

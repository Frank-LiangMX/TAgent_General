/**
 * LeftSidebar - 左侧功能区内容面板
 *
 * 根据 activeRailItem 显示不同功能区内容：
 * - sessions: 会话列表（Chat/Agent 模式）
 * - files: 工作区文件树
 * - skills: 插件管理
 * - TA 模式的各种功能面板
 *
 * 不再包含模式切换器（已移至 FunctionalRail）
 */

import { useAtom, useSetAtom, useAtomValue, useStore } from 'jotai'
import {
  Pin,
  PinOff,
  Plus,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronRight,
  ArrowRightLeft,
  Search,
  Archive,
  ArchiveRestore,
  Hammer,
  MoreHorizontal,
  Check,
  FolderOpen,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { SearchDialog } from './SearchDialog'

import type { ActiveView } from '@/atoms/active-view'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import type { ConversationMeta, AgentSessionMeta, WorkspaceCapabilities } from '@tagent/shared'

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
import {
  appModeAtom,
  pluginKindTabAtom,
  selectedCapabilityAtom,
  type AppMode,
  topLevelModeAtom,
  type RailItem,
  type TARailItem,
} from '@/atoms/app-mode'
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
import {
  promptConfigAtom,
  selectedPromptIdAtom,
  conversationPromptIdAtom,
} from '@/atoms/system-prompt-atoms'
import {
  tabsAtom,
  activeTabIdAtom,
  activeSessionIdAtom,
  closeTab,
  updateTabTitle,
  sessionViewStateMapAtom,
} from '@/atoms/tab-atoms'
import { hasUpdateAtom } from '@/atoms/updater'
import { userProfileAtom } from '@/atoms/user-profile'
import { workingSessionIdsSetAtom } from '@/atoms/working-atoms'
import { workspaceManagerOpenAtom } from '@/atoms/workspace'
import { MoveSessionDialog } from '@/components/agent/MoveSessionDialog'
import { PluginsPanel } from '@/components/agent/SkillsPanel'
import { WorkspaceFilesView } from '@/components/agent/WorkspaceFilesView'
import { clearPreviewCacheForSession } from '@/components/diff/DiffTabContent'
import {
  SessionMiniMapPopover,
  useSessionMiniMapHover,
  type SessionMiniMapType,
} from '@/components/session-preview/SessionMiniMapPopover'
import { TASidebar } from '@/components/ta/TASidebar'
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
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useOpenSession } from '@/hooks/useOpenSession'
import {
  sessionListItemSelector,
  useSessionListSlideIndicator,
} from '@/hooks/useSessionListSlideIndicator'
import { useSyncActiveTabSideEffects } from '@/hooks/useSyncActiveTabSideEffects'
import { useWorkspaceActions } from '@/hooks/useWorkspaceActions'
import {
  replaceAgentSessionInFreshnessOrder,
  sortAgentSessionsByUpdatedAtDesc,
} from '@/lib/agent-session-list'
import {
  LIST_SLIDE_HOST_CLASS,
  LIST_SLIDE_INDICATOR_CLASS,
  LIST_SLIDE_ITEM_GHOST_CLASS,
  LIST_SLIDE_ITEM_SELECTED_CLASS,
} from '@/lib/list-slide-selection'
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

function SidebarItem({
  icon,
  label,
  active,
  suffix,
  onClick,
}: SidebarItemProps): React.ReactElement {
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
function groupByDate<T extends { updatedAt: number }>(
  items: T[]
): Array<{ label: DateGroup; items: T[] }> {
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

const SIDEBAR_DRAG_STRIP_HEIGHT = {
  collapsedMac: 50,
  expandedMac: 30,
  collapsed: 8,
  expanded: 4,
} as const

function getSessionLeftAccent(
  indicatorStatus: SessionIndicatorStatus,
  active: boolean
): SessionLeftAccent | undefined {
  if (indicatorStatus === 'blocked') return 'orange'
  if (indicatorStatus === 'running') return 'blue'
  if (indicatorStatus === 'completed') return 'green'
  if (active) return 'primary'
  return undefined
}

function isAgentSessionInTopLevelMode(
  session: AgentSessionMeta,
  topLevelMode: 'general' | 'ta'
): boolean {
  return (session.mode ?? 'general') === topLevelMode
}

function SidebarWindowDragStrip({ height }: { height: number }): React.ReactElement {
  return <div aria-hidden="true" className="sidebar-window-drag-strip" style={{ height }} />
}

/** 与 Rail 首个按钮（size-10）齐平的顶栏控件样式 */
const SIDEBAR_TOP_CONTROL_CLASS =
  'h-10 rounded-[12px] border border-border/40 bg-primary/5 text-[11px] text-foreground/70 transition-colors duration-100 hover:border-border/70 hover:bg-primary/10 titlebar-no-drag'

/** 侧栏顶栏行：与 Rail 首行共用 nav-island-body-start + nav-island-header-row */
function SidebarTopControlsRow({
  isMac,
  children,
}: {
  isMac: boolean
  children: React.ReactNode
}): React.ReactElement {
  return (
    <div className="relative shrink-0 px-3 nav-island-body-start">
      {!isMac ? <SidebarWindowDragStrip height={SIDEBAR_DRAG_STRIP_HEIGHT.expanded} /> : null}
      {!isMac ? <div className="h-2 shrink-0" aria-hidden /> : null}
      <div className="nav-island-header-row gap-1.5">{children}</div>
    </div>
  )
}

export function LeftSidebar({
  width,
  activeRailItem = 'sessions',
}: LeftSidebarProps): React.ReactElement | null {
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

  // Agent 模式状态
  const [agentSessions, setAgentSessions] = useAtom(agentSessionsAtom)
  const currentModeAgentSessions = React.useMemo(
    () => agentSessions.filter((session) => isAgentSessionInTopLevelMode(session, topLevelMode)),
    [agentSessions, topLevelMode]
  )
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
    [workspaces, currentWorkspaceId]
  )

  // 工作区能力（MCP + Skill 计数）
  const [capabilities, setCapabilities] = React.useState<WorkspaceCapabilities | null>(null)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)

  // Tab 状态
  const [tabs, setTabs] = useAtom(tabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  // 会话高亮按"激活 Tab 所属会话"判定：预览 Tab 激活时其 owner 会话仍保持高亮
  const activeSessionId = useAtomValue(activeSessionIdAtom)
  const openSession = useOpenSession()
  const syncActiveTabSideEffects = useSyncActiveTabSideEffects()
  const store = useStore()

  // 搜索状态（归档会话已从主列表分离，由底部 Popover 独立展示）
  const setSearchDialogOpen = useSetAtom(searchDialogOpenAtom)

  // 选中会话变化时，自动滚动侧栏使对应项可见
  React.useEffect(() => {
    if (!activeSessionId) return
    requestAnimationFrame(() => {
      const el = document.querySelector(sessionListItemSelector(activeSessionId))
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [activeSessionId])

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
  const cleanupMapAtoms = React.useCallback(
    (id: string) => {
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
    },
    [
      setConvModels,
      setConvContextLength,
      setConvThinking,
      setConvParallel,
      setConvPromptId,
      setPreviewPanelOpen,
      setPreviewFile,
      setDiffPanelTab,
      setDiffRefreshVersion,
      setDiffUnseen,
      setDiffUnseenFiles,
      setDiffData,
      setSessionChannelMap,
      setSessionModelMap,
      setSessionViewStateMap,
      setStreamingStates,
      setLiveMessagesMap,
      setSessionPendingFiles,
      store,
    ]
  )

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

  const [selectedCapability, setSelectedCapability] = useAtom(selectedCapabilityAtom)
  const pluginKindTab = useAtomValue(pluginKindTabAtom)

  const selectedCapabilityKey = selectedCapability?.key ?? null
  const selectedCapabilityType = selectedCapability?.type ?? null

  // 进入插件区 / 切换工作区时：仅在校选项失效时补选（不跨 Tab 兜底，避免与侧栏 Tab 冲突）
  React.useEffect(() => {
    if (activeRailItem !== 'skills' || !capabilities) {
      return
    }
    if (selectedCapabilityType && selectedCapabilityKey) {
      const stillValid =
        selectedCapabilityType === 'mcp'
          ? capabilities.mcpServers.some((s) => s.name === selectedCapabilityKey)
          : capabilities.skills.some((s) => s.slug === selectedCapabilityKey)
      if (stillValid) return
    }

    const list =
      pluginKindTab === 'mcp' ? capabilities.mcpServers : capabilities.skills
    if (list.length === 0) {
      setSelectedCapability(null)
      return
    }
    const first = list[0]!
    if (pluginKindTab === 'mcp') {
      setSelectedCapability({ type: 'mcp', key: first.name })
    } else {
      setSelectedCapability({ type: 'skill', key: (first as { slug: string }).slug })
    }
  }, [
    activeRailItem,
    capabilities,
    selectedCapabilityKey,
    selectedCapabilityType,
    setSelectedCapability,
    currentWorkspaceSlug,
    pluginKindTab,
  ])

  /** Working 区域状态（已不用于目录区分组，但保留状态供其他模块用） */
  const workingSessionIds = useAtomValue(workingSessionIdsSetAtom)

  /** 置顶 Agent 会话列表已废弃：目录区不再拆"工作中/置顶"两组，
   * 全部会话（含 pinned/working）统一按 updatedAt 倒序平铺。 */

  /** 已归档 Agent 会话数量（当前工作区） */
  const archivedAgentSessionCount = React.useMemo(
    () =>
      currentModeAgentSessions.filter(
        (s) => s.archived && (!currentWorkspaceId || s.workspaceId === currentWorkspaceId)
      ).length,
    [currentModeAgentSessions, currentWorkspaceId]
  )

  /** 归档的 Agent 会话列表（按 updatedAt 倒序，平铺） */
  const archivedAgentSessionsList = React.useMemo(
    () =>
      currentModeAgentSessions
        .filter(
          (s) =>
            s.archived &&
            (!currentWorkspaceId || s.workspaceId === currentWorkspaceId) &&
            !draftSessionIds.has(s.id)
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [currentModeAgentSessions, currentWorkspaceId, draftSessionIds]
  )

  // 初始加载对话列表 + 用户档案 + Agent 会话
  React.useEffect(() => {
    window.electronAPI
      .listConversations()
      .then((list) => {
        setConversations(list)
      })
      .catch(console.error)
    window.electronAPI.getUserProfile().then(setUserProfile).catch(console.error)
    window.electronAPI.listAgentSessions().then(setAgentSessions).catch(console.error)
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
    setActiveItem(item)
    setActiveView(ITEM_TO_VIEW[item])
  }

  /** 请求删除会话（Agent 共用，弹出确认框） */
  const handleRequestDelete = React.useCallback((id: string): void => {
    setPendingDeleteId(id)
  }, [])

  /** 确认删除会话（Agent / 历史 Chat 共用） */
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
        ? (tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null)
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
      // TA 模式创建的会话必须带 mode='ta' 标记，否则 TabBar 过滤后该 tab 不会显示
      const sessionMode = topLevelMode === 'ta' ? 'ta' : 'general'
      const meta = await window.electronAPI.createAgentSession(
        undefined,
        agentChannelId || undefined,
        currentWorkspaceId || undefined,
        sessionMode
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
      openSession('agent', meta.id, meta.title, sessionMode)
      setActiveView('conversations')
      setActiveItem('all-chats')
    } catch (error) {
      console.error('[侧边栏] 创建 Agent 会话失败:', error)
    }
  }

  /** 选择 Agent 会话（打开或聚焦标签页） */
  const handleSelectAgentSession = React.useCallback(
    (id: string, title: string): void => {
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
    },
    [openSession, setActiveView, setUnviewedCompleted]
  )

  /** 重命名 Agent 会话标题 */
  const handleAgentRename = React.useCallback(
    async (id: string, newTitle: string): Promise<void> => {
      try {
        const updated = await window.electronAPI.updateAgentSessionTitle(id, newTitle)
        setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
        // 同步更新标签页标题
        setTabs((prev) => updateTabTitle(prev, id, newTitle))
      } catch (error) {
        console.error('[侧边栏] 重命名 Agent 会话失败:', error)
      }
    },
    [setAgentSessions, setTabs]
  )

  /** 切换 Agent 会话置顶状态 */
  const handleTogglePinAgent = React.useCallback(
    async (id: string): Promise<void> => {
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
    },
    [store, setAgentSessions]
  )

  /** 切换 Agent 会话手动工作中状态 */
  const handleToggleManualWorkingAgent = React.useCallback(
    async (id: string): Promise<void> => {
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
    },
    [store, setAgentSessions, setWorkingDone]
  )

  /** 确认已完成：从 Working 中移出，但会话仍可通过搜索或最近工作找到 */
  const handleConfirmWorkingDoneAgent = React.useCallback(
    async (id: string): Promise<void> => {
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
    },
    [setAgentSessions, setWorkingDone, setUnviewedCompleted]
  )

  /** 切换 Agent 会话归档状态 */
  const handleToggleArchiveAgent = React.useCallback(
    async (id: string): Promise<void> => {
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
              ? (tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null)
              : null
            syncActiveTabSideEffects(newActiveTab)
          }
        }
        toast.success(updated.archived ? '已归档' : '已取消归档')
      } catch (error) {
        console.error('[侧边栏] 切换 Agent 会话归档失败:', error)
      }
    },
    [
      store,
      setAgentSessions,
      setTabs,
      setActiveTabId,
      cleanupMapAtoms,
      setWorkingDone,
      syncActiveTabSideEffects,
    ]
  )

  /** 请求迁移会话到其他工作区（弹出迁移对话框） */
  const handleRequestMove = React.useCallback((id: string): void => {
    setMoveTargetId(id)
  }, [])

  /** 迁移会话到另一个工作区后的回调 */
  const handleSessionMoved = (
    updatedSession: AgentSessionMeta,
    targetWorkspaceName: string
  ): void => {
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

  /** Agent 会话按工作区过滤 + 排除归档（归档会话由底部 Popover 展示）
   *  + 按顶层模式隔离：通用模式只显示 mode='general'，TA 模式只显示 mode='ta' */
  const filteredAgentSessions = React.useMemo(() => {
    const byWorkspace = currentModeAgentSessions.filter(
      (s) => s.workspaceId === currentWorkspaceId && !draftSessionIds.has(s.id)
    )
    const byMode = byWorkspace.filter((s) => (s.mode ?? 'general') === topLevelMode)
    return sortAgentSessionsByUpdatedAtDesc(byMode.filter((s) => !s.archived))
  }, [currentModeAgentSessions, currentWorkspaceId, draftSessionIds, topLevelMode])

  // 删除确认弹窗（collapsed/expanded 共享）
  const deleteDialog = (
    <AlertDialog
      open={pendingDeleteId !== null}
      onOpenChange={(open) => {
        if (!open) setPendingDeleteId(null)
      }}
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
          <AlertDialogDescription>删除后将无法恢复，确定要删除这个对话吗？</AlertDialogDescription>
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
      onOpenChange={(open) => {
        if (!open) setMoveTargetId(null)
      }}
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
    // TA 模式：根据 activeRailItem 渲染。选中『会话』走通用 SessionsRailContent
    // （数据被 filteredAgentSessions 按 mode='ta' 过滤，自动数据隔离）；
    // 其他 5 个模块走 TASidebar 的概览面板。
    if (topLevelMode === 'ta') {
      if (activeRailItem === 'sessions') {
        return (
          <SessionsRailContent
            activeSessionId={activeSessionId}
            filteredAgentSessions={filteredAgentSessions}
            agentIndicatorMap={agentIndicatorMap}
            workingSessionIds={workingSessionIds}
            handleRequestDelete={handleRequestDelete}
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
      if (activeRailItem === 'skills') {
        return (
          <SkillsRailContent capabilities={capabilities} />
        )
      }
      return <TASidebar activeRailItem={activeRailItem as TARailItem} />
    }

    // 通用模式根据 activeRailItem 渲染
    switch (activeRailItem) {
      case 'files':
        return <FilesRailContent workspaceKey={currentWorkspaceId ?? 'no-workspace'} />
      case 'skills':
        return (
          <SkillsRailContent capabilities={capabilities} />
        )
      case 'scratch':
        // 草稿功能区不需要侧边栏内容，由主区域 Tab 显示
        return null
      case 'sessions':
      default:
        return (
          <SessionsRailContent
            activeSessionId={activeSessionId}
            filteredAgentSessions={filteredAgentSessions}
            agentIndicatorMap={agentIndicatorMap}
            workingSessionIds={workingSessionIds}
            handleRequestDelete={handleRequestDelete}
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
        'nav-island-sidebar relative z-[1] h-full flex flex-col overflow-hidden shrink-0',
        'transition-[width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        activeRailItem === 'skills' && 'nav-island-sidebar--plugins'
      )}
      style={{
        width: width ?? 240,
      }}
    >
      {/* Win：无顶栏控件时仍保留拖拽条（如 Skills） */}
      {!isMac && activeRailItem !== 'sessions' && activeRailItem !== 'files' ? (
        <SidebarWindowDragStrip height={SIDEBAR_DRAG_STRIP_HEIGHT.expanded} />
      ) : null}

      {/* 会话页顶栏：工作区选择(折叠按钮已移除) */}
      {activeRailItem === 'sessions' ? (
        <SidebarTopControlsRow isMac={isMac}>
          {mode === 'agent' && topLevelMode === 'general' ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    SIDEBAR_TOP_CONTROL_CLASS,
                    'flex min-w-0 flex-1 items-center justify-between gap-1.5 px-2.5'
                  )}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <FolderOpen size={12} className="shrink-0 text-foreground/40" />
                    <span className="truncate font-medium">
                      {currentWorkspaceName ?? '选择工作区'}
                    </span>
                  </span>
                  <ChevronDown size={12} className="shrink-0 text-foreground/40" />
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
                                : 'text-foreground/70 hover:bg-foreground/[0.04]'
                            )}
                          >
                            <FolderOpen size={13} className="flex-shrink-0 text-foreground/40" />
                            <span className="flex-1 min-w-0 truncate font-medium">{ws.name}</span>
                            {isActive && <Check size={12} className="flex-shrink-0 text-primary" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <div className="min-w-0 flex-1" aria-hidden />
          )}
        </SidebarTopControlsRow>
      ) : null}

      {/* 文件页：仅工作区选择 */}
      {activeRailItem === 'files' && mode === 'agent' && topLevelMode === 'general' ? (
        <SidebarTopControlsRow isMac={isMac}>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  SIDEBAR_TOP_CONTROL_CLASS,
                  'flex w-full items-center justify-between gap-1.5 px-2.5'
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <FolderOpen size={12} className="shrink-0 text-foreground/40" />
                  <span className="truncate font-medium">
                    {currentWorkspaceName ?? '选择工作区'}
                  </span>
                </span>
                <ChevronDown size={12} className="shrink-0 text-foreground/40" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="start"
              sideOffset={4}
              className="w-64 overflow-hidden p-0"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="flex items-center justify-between border-b border-border/40 px-2.5 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-foreground/50">
                  切换工作区
                </span>
                <button
                  type="button"
                  onClick={() => setWorkspaceManagerOpen(true)}
                  className="text-[11px] text-primary/70 transition-colors hover:text-primary titlebar-no-drag"
                >
                  管理 →
                </button>
              </div>
              <div className="max-h-[50vh] overflow-y-auto p-1 scrollbar-thin">
                {workspaces.length === 0 ? (
                  <div className="py-3 text-center text-[12px] text-foreground/40">暂无工作区</div>
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
                            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors duration-100',
                            isActive
                              ? 'bg-foreground/[0.08] text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
                              : 'text-foreground/70 hover:bg-foreground/[0.04]'
                          )}
                        >
                          <FolderOpen size={13} className="shrink-0 text-foreground/40" />
                          <span className="min-w-0 flex-1 truncate font-medium">{ws.name}</span>
                          {isActive ? <Check size={12} className="shrink-0 text-primary" /> : null}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </SidebarTopControlsRow>
      ) : null}

      {/* 新会话按钮 + 搜索按钮（仅 Agent 会话功能区显示） */}
      {activeRailItem === 'sessions' && (
        <div className="nav-island-action-row px-3 gap-1.5">
          <button
            onClick={handleNewAgentSession}
            className="flex-1 flex items-center gap-2 px-3 h-10 rounded-[10px] text-[13px] font-medium text-foreground/70 bg-primary/5 hover:bg-primary/10 transition-colors duration-100 titlebar-no-drag border border-border/40 hover:border-border/70"
          >
            <Plus size={14} />
            <span>新会话</span>
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
            <TooltipContent side="bottom">
              搜索 ({getAcceleratorDisplay(getActiveAccelerator('global-search'))})
            </TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 功能区内容：切换 Rail 时淡入，避免侧栏翼内容突变生硬 */}
      <div
        key={activeRailItem}
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden animate-in fade-in duration-200',
          activeRailItem !== 'sessions' && activeRailItem !== 'files' && 'nav-island-body-start'
        )}
      >
        {renderRailContent()}
      </div>

      {/* 已归档 Popover 入口：固定在底部，点击展开成完整列表（不切换整页 viewMode） */}
      {activeRailItem === 'sessions' && (
        <div className="px-3 pb-1 flex-shrink-0">
          {mode === 'agent' && archivedAgentSessionCount > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center gap-2 px-3 py-2 rounded-[10px] text-[12px] text-foreground/40 hover:bg-foreground/[0.04] hover:text-foreground/60 transition-colors titlebar-no-drag">
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
                          leftAccent={getSessionLeftAccent(
                            agentIndicatorMap.get(session.id) ?? 'idle',
                            session.id === activeSessionId
                          )}
                          showPinIcon={!!session.pinned}
                          workspaceName={
                            session.workspaceId
                              ? workspaceNameMap.get(session.workspaceId)
                              : undefined
                          }
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

/** 会话功能区内容（仅 Agent 会话） */
function SessionsRailContent({
  activeSessionId,
  filteredAgentSessions,
  agentIndicatorMap,
  workingSessionIds,
  handleRequestDelete,
  handleSelectAgentSession,
  handleAgentRename,
  handleTogglePinAgent,
  handleToggleManualWorkingAgent,
  handleToggleArchiveAgent,
  handleConfirmWorkingDoneAgent,
  handleRequestMove,
  workspaceNameMap,
}: {
  activeSessionId: string | null
  filteredAgentSessions: AgentSessionMeta[]
  agentIndicatorMap: Map<string, SessionIndicatorStatus>
  workingSessionIds: Set<string>
  handleRequestDelete: (id: string) => void
  handleSelectAgentSession: (id: string, title: string) => void
  handleAgentRename: (id: string, newTitle: string) => Promise<void>
  handleTogglePinAgent: (id: string) => Promise<void>
  handleToggleManualWorkingAgent: (id: string) => Promise<void>
  handleToggleArchiveAgent: (id: string) => Promise<void>
  handleConfirmWorkingDoneAgent: (id: string) => Promise<void>
  handleRequestMove: (id: string) => void
  workspaceNameMap: Map<string, string>
}): React.ReactElement {
  const listRef = React.useRef<HTMLDivElement>(null)
  const sessionLayoutKey = filteredAgentSessions.map((session) => session.id).join('|')
  const { plateStyle, accentStyle } = useSessionListSlideIndicator(
    listRef,
    activeSessionId,
    sessionLayoutKey
  )
  const activeAccent = activeSessionId
    ? getSessionLeftAccent(agentIndicatorMap.get(activeSessionId) ?? 'idle', true)
    : undefined

  // Agent 模式
  return (
    <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin min-h-0 titlebar-no-drag">
      {filteredAgentSessions.length === 0 ? (
        <div className="px-2 py-3 text-[11px] text-foreground/30 text-center select-none">
          暂无会话，点击上方"+新会话"创建
        </div>
      ) : (
        <div ref={listRef} className={cn('relative', LIST_SLIDE_HOST_CLASS)}>
          <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
            {plateStyle && <div className={LIST_SLIDE_INDICATOR_CLASS} style={plateStyle} />}
            {accentStyle && activeAccent && (
              <div
                className={cn(
                  'sidebar-session-slide-accent session-sidebar-accent rounded-full',
                  SESSION_LEFT_ACCENT_CLASS[activeAccent],
                  activeAccent === 'blue' && 'animate-pulse'
                )}
                style={accentStyle}
              />
            )}
          </div>
          <div className="relative z-10 flex flex-col gap-0.5">
            {filteredAgentSessions.map((session) => (
              <AgentSessionItem
                key={session.id}
                session={session}
                active={session.id === activeSessionId}
                useListSlideIndicator
                indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
                isInWorkingSection={workingSessionIds.has(session.id)}
                leftAccent={
                  session.id === activeSessionId
                    ? undefined
                    : getSessionLeftAccent(agentIndicatorMap.get(session.id) ?? 'idle', false)
                }
                showPinIcon={!!session.pinned}
                workspaceName={
                  session.workspaceId ? workspaceNameMap.get(session.workspaceId) : undefined
                }
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
        </div>
      )}
    </div>
  )
}

/** 文件功能区内容 —— 工作区文件树（已从 RightSidePanel 迁出） */
function FilesRailContent({ workspaceKey }: { workspaceKey: string }): React.ReactElement {
  return <WorkspaceFilesView workspaceKey={workspaceKey} layout="navigator" />
}

/** 插件功能区内容 —— 统一插件列表 */
function SkillsRailContent({
  capabilities,
}: {
  capabilities: WorkspaceCapabilities | null
}): React.ReactElement {
  return <PluginsPanel capabilities={capabilities} />
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
    MenuSeparator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
  ) => (
    <>
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5"
        onSelect={() => onTogglePin(conversation.id)}
      >
        {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
        {isPinned ? '取消置顶' : '置顶对话'}
      </MenuItem>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => startEdit()}>
        <Pencil size={14} />
        重命名
      </MenuItem>
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5"
        onSelect={() => onToggleArchive(conversation.id)}
      >
        {conversation.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        {conversation.archived ? '取消归档' : '归档'}
      </MenuItem>
      <MenuSeparator className="my-0.5" />
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5 text-destructive"
        onSelect={() => onRequestDelete(conversation.id)}
      >
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
            'group relative w-full flex items-center gap-2 px-3 py-[7px] transition-all duration-150 titlebar-no-drag text-left',
            active
              ? 'session-item-selected session-glass session-glass-sidebar'
              : 'rounded-md hover:bg-primary/5'
          )}
        >
          {/* 流式状态左侧竖线条（与 Agent 保持一致） */}
          {streaming && (
            <span
              className="session-sidebar-accent left-1.5 top-1.5 bottom-1.5 w-[3px] rounded-full bg-blue-500 animate-pulse pointer-events-none"
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
              <div
                className={cn(
                  'truncate text-[13px] leading-5 flex items-center gap-1.5',
                  active ? 'text-foreground' : 'text-foreground/80'
                )}
              >
                {/* 置顶标记 */}
                {showPinIcon && <Pin size={11} className="flex-shrink-0 text-primary/60" />}
                <span className="truncate">{conversation.title}</span>
              </div>
            )}
          </div>

          {/* 三点菜单按钮（hover 时可见，始终占位避免跳动） */}
          {!editing && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'p-1 rounded-md text-foreground/30 hover:bg-foreground/[0.08] hover:text-foreground/60 transition-colors',
                      'opacity-0 pointer-events-none',
                      'group-hover:opacity-100 group-hover:pointer-events-auto',
                      'data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto'
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
          type: 'agent', // P3: chat 已退役，此组件为遗留代码
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
type SessionLeftAccent = 'orange' | 'blue' | 'green' | 'primary'
const SESSION_LEFT_ACCENT_CLASS: Record<SessionLeftAccent, string> = {
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  primary: 'bg-primary',
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
  /** 父级列表绘制滑动指示器时，本项不再铺选中玻璃底 */
  useListSlideIndicator?: boolean
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
  useListSlideIndicator = false,
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
    MenuSeparator: typeof ContextMenuSeparator | typeof DropdownMenuSeparator
  ) => (
    <>
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => onTogglePin(session.id)}>
        {session.pinned ? <PinOff size={14} /> : <Pin size={14} />}
        {session.pinned ? '取消置顶' : '置顶会话'}
      </MenuItem>
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5"
        disabled={indicatorStatus === 'running'}
        onSelect={() => {
          if (indicatorStatus !== 'running') onToggleManualWorking(session.id)
        }}
      >
        <Hammer size={14} className={isWorking ? 'fill-current' : ''} />
        {indicatorStatus === 'running'
          ? '运行中无法移出'
          : isWorking
            ? '取消工作中'
            : '标记为工作中'}
      </MenuItem>
      {canMove && (
        <MenuItem
          className="text-xs py-1 [&>svg]:size-3.5"
          onSelect={() => onRequestMove(session.id)}
        >
          <ArrowRightLeft size={14} />
          迁移到其他工作区
        </MenuItem>
      )}
      <MenuItem className="text-xs py-1 [&>svg]:size-3.5" onSelect={() => startEdit()}>
        <Pencil size={14} />
        重命名
      </MenuItem>
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5"
        onSelect={() => onToggleArchive(session.id)}
      >
        {session.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
        {session.archived ? '取消归档' : '归档'}
      </MenuItem>
      <MenuSeparator className="my-0.5" />
      <MenuItem
        className="text-xs py-1 [&>svg]:size-3.5 text-destructive"
        onSelect={() => onRequestDelete(session.id)}
      >
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
          data-session-list-id={session.id}
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
            'group relative w-full flex items-center gap-2 px-3 py-[7px] transition-colors duration-150 titlebar-no-drag text-left',
            (leftAccent || (useListSlideIndicator && active)) && 'pl-5',
            active
              ? useListSlideIndicator
                ? cn(
                    'session-item-selected session-item-selected--ghost',
                    LIST_SLIDE_ITEM_SELECTED_CLASS,
                    LIST_SLIDE_ITEM_GHOST_CLASS,
                    'rounded-[10px] z-10'
                  )
                : 'session-item-selected session-glass session-glass-sidebar'
              : 'rounded-md hover:bg-primary/5'
          )}
        >
          {leftAccent && (
            <span
              className={cn(
                'session-sidebar-accent session-sidebar-accent--inline left-1.5 top-2 bottom-2 w-[3px] rounded-full pointer-events-none',
                SESSION_LEFT_ACCENT_CLASS[leftAccent],
                leftAccent === 'blue' && 'animate-pulse'
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
              <div
                className={cn(
                  'truncate text-[13px] leading-5 flex items-center gap-1.5',
                  active ? 'text-foreground' : 'text-foreground/80'
                )}
              >
                {showPinIcon && <Pin size={11} className="flex-shrink-0 text-primary/60" />}
                <span className="truncate flex-1 min-w-0">{session.title}</span>
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
                          'group-focus-within:opacity-100 group-focus-within:pointer-events-auto'
                        )
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
                {confirmingDone
                  ? '再次点击确认完成'
                  : '标记为完成。之后可以随时通过搜索或最近工作找到这个会话。'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* 三点菜单按钮（hover 时可见，始终占位避免跳动） */}
          {!editing && (
            <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu onOpenChange={setMenuOpen}>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      'p-1 rounded-md text-foreground/30 hover:bg-foreground/[0.08] hover:text-foreground/60 transition-colors',
                      'opacity-0 pointer-events-none',
                      'group-hover:opacity-100 group-hover:pointer-events-auto',
                      'data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto'
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

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
  MoreVertical,
  Check,
  CircleCheckBig,
  FolderOpen,
  Folder,
  Hourglass,
  Timer,
  Settings,
} from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { SearchDialog } from './SearchDialog'
import { DraftSearchDialog } from '@/components/draft/DraftSearchDialog'

import type { ActiveView } from '@/atoms/active-view'
import type { SessionIndicatorStatus } from '@/atoms/agent-atoms'
import type { ConversationMeta, AgentSessionMeta, WorkspaceCapabilities, AgentWorkspace } from '@tagent/shared'

// ===== 项目分组类型 =====
interface AgentProjectGroup {
  workspace: AgentWorkspace
  sessions: AgentSessionMeta[]
}

/** 活跃会话状态集合（运行中/阻塞/未查看已完成） */
const ACTIVE_SESSION_STATUSES = new Set<SessionIndicatorStatus>(['running', 'blocked', 'completed'])
const ACTIVE_SESSION_STATUS_PRIORITY: Record<SessionIndicatorStatus, number> = {
  blocked: 0,
  running: 1,
  completed: 2,
  idle: 3,
}
const PROJECT_SESSION_PREVIEW_LIMIT = 5
const PROJECT_SESSION_RECENT_WINDOW_MS = 3 * 86_400_000
const PROJECT_SESSION_EXPAND_STEP = 10

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
  activeRailItemAtom,
  type AppMode,
  topLevelModeAtom,
  type RailItem,
  type TARailItem,
} from '@/atoms/app-mode'
import { conversationsAtom } from '@/atoms/agent-atoms'
import { channelsAtom, selectedModelAtom } from '@/atoms/model-atoms'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import { draftsAtom, draftSearchOpenAtom } from '@/atoms/draft-atoms'
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
import { clearPreviewCacheForSession } from '@/components/diff/DiffTabContent'
import { DraftListPanel } from '@/components/draft/DraftListPanel'
import {
  SessionMiniMapPopover,
  useSessionMiniMapHover,
  type SessionMiniMapType,
} from '@/components/session-preview/SessionMiniMapPopover'
import { TASidebar } from '@/components/ta/TASidebar'
import { AutomationRailList } from '@/components/automation/AutomationRailList'
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

function getSessionLeftAccent(
  indicatorStatus: SessionIndicatorStatus,
  active: boolean,
  manualWorking?: boolean
): SessionLeftAccent {
  if (indicatorStatus === 'blocked') return 'orange'
  if (indicatorStatus === 'running') return 'blue'
  if (indicatorStatus === 'completed') return 'green'
  if (manualWorking) return 'amber'
  if (active) return 'primary'
  return 'idle'
}

function isAgentSessionInTopLevelMode(
  session: AgentSessionMeta,
  topLevelMode: 'general' | 'ta'
): boolean {
  return (session.mode ?? 'general') === topLevelMode
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
  const draftSessionIds = useAtomValue(draftSessionIdsAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const setAgentMessagesCache = useSetAtom(agentSDKMessagesCacheAtom)

  /** 待删除对话 ID，非空时显示确认弹窗 */
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)
  /** 待迁移会话 ID，非空时显示迁移对话框 */
  const [moveTargetId, setMoveTargetId] = React.useState<string | null>(null)
  const [userProfile, setUserProfile] = useAtom(userProfileAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
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
  const [drafts, setDrafts] = useAtom(draftsAtom)
  const [draftSearchOpen, setDraftSearchOpen] = useAtom(draftSearchOpenAtom)
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
  const { selectWorkspace, createProject } = useWorkspaceActions()
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

    const list = pluginKindTab === 'mcp' ? capabilities.mcpServers : capabilities.skills
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

  /** Working 区域状态（供归档区判断用） */
  const workingSessionIds = useAtomValue(workingSessionIdsSetAtom)

  /** 置顶会话列表（非归档、非草稿） */
  const pinnedAgentSessions = React.useMemo(
    () =>
      currentModeAgentSessions
        .filter((s) => s.pinned && !s.archived && !draftSessionIds.has(s.id))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [currentModeAgentSessions, draftSessionIds]
  )

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
    // 注意：draft tab 的 id 格式为 __draft__:<draftId>，需要从 tabs 列表查找
    const tabToClose = tabs.find((t) => t.sessionId === pendingDeleteId)
    const tabIdToClose = tabToClose?.id ?? pendingDeleteId
    const wasActive = activeTabId === tabIdToClose
    const tabResult = closeTab(tabs, activeTabId, tabIdToClose)
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

  /** 创建新草稿 */
  const handleNewDraft = async (): Promise<void> => {
    try {
      const doc = await window.electronAPI.draft.create({ title: '未命名草稿' })
      setDrafts((prev) => [doc, ...prev])
      openSession('draft', doc.id, doc.title)
    } catch (error) {
      console.error('[侧边栏] 创建草稿失败:', error)
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

  /** 在指定工作区中新建会话（项目分组 Plus 按钮使用） */
  const handleNewSessionInWorkspace = React.useCallback(
    async (workspaceId: string): Promise<void> => {
      try {
        const sessionMode = topLevelMode === 'ta' ? 'ta' : 'general'
        const meta = await window.electronAPI.createAgentSession(
          undefined,
          agentChannelId || undefined,
          workspaceId,
          sessionMode
        )
        setAgentSessions((prev) => [meta, ...prev])
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
        openSession('agent', meta.id, meta.title, sessionMode)
        setActiveView('conversations')
        setActiveItem('all-chats')
      } catch (error) {
        console.error('[侧边栏] 在工作区中创建 Agent 会话失败:', error)
      }
    },
    [agentChannelId, agentModelId, openSession, setActiveView, setActiveItem, setAgentSessions, setSessionChannelMap, setSessionModelMap, topLevelMode]
  )

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
      // 同步副作用到新激活标签（替代无条件 setCurrentAgentSessionId(null)）
      const newActiveTab = tabResult.activeTabId
        ? (tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null)
        : null
      syncActiveTabSideEffects(newActiveTab)
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

  // ===== 项目分组数据层 =====
  /** Agent 会话按项目（工作区）分组，平铺展示所有项目的会话 */
  const agentProjectGroups = React.useMemo<AgentProjectGroup[]>(() => {
    const sessionsByWorkspaceId = new Map<string, AgentSessionMeta[]>()
    for (const workspace of workspaces) {
      sessionsByWorkspaceId.set(workspace.id, [])
    }
    const defaultWsId =
      workspaces.find((ws) => ws.slug === 'default')?.id ?? workspaces[0]?.id

    const visibleHistory = sortAgentSessionsByUpdatedAtDesc(
      currentModeAgentSessions.filter(
        (session) =>
          !session.archived &&
          !session.pinned &&
          !draftSessionIds.has(session.id)
      )
    )

    for (const session of visibleHistory) {
      const targetId =
        session.workspaceId && sessionsByWorkspaceId.has(session.workspaceId)
          ? session.workspaceId
          : defaultWsId
      if (!targetId) continue
      sessionsByWorkspaceId.get(targetId)!.push(session)
    }

    return workspaces.map((workspace) => ({
      workspace,
      sessions: sessionsByWorkspaceId.get(workspace.id) ?? [],
    }))
  }, [currentModeAgentSessions, draftSessionIds, workspaces])

  /** 折叠状态：用户手动折叠的项目 ID 集合 */
  const [collapsedWorkspaceIds, setCollapsedWorkspaceIds] = React.useState<Set<string>>(new Set())

  /** 额外展开数量：超出预览限制后用户点击"显示更多"展开的条数 */
  const [extraSessionCounts, setExtraSessionCounts] = React.useState<Map<string, number>>(new Map())

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
    // （数据被 agentProjectGroups 按 mode='ta' 过滤，自动数据隔离）；
    // 其他 5 个模块走 TASidebar 的概览面板。
    if (topLevelMode === 'ta') {
      if (activeRailItem === 'sessions') {
        return (
          <SessionsRailContent
            activeSessionId={activeSessionId}
            agentProjectGroups={agentProjectGroups}
            agentIndicatorMap={agentIndicatorMap}
            collapsedWorkspaceIds={collapsedWorkspaceIds}
            setCollapsedWorkspaceIds={setCollapsedWorkspaceIds}
            extraSessionCounts={extraSessionCounts}
            setExtraSessionCounts={setExtraSessionCounts}
            currentWorkspaceId={currentWorkspaceId}
            pinnedAgentSessions={pinnedAgentSessions}
            handleRequestDelete={handleRequestDelete}
            handleSelectAgentSession={handleSelectAgentSession}
            handleAgentRename={handleAgentRename}
            handleTogglePinAgent={handleTogglePinAgent}
            handleToggleManualWorkingAgent={handleToggleManualWorkingAgent}
            handleToggleArchiveAgent={handleToggleArchiveAgent}
            handleConfirmWorkingDoneAgent={handleConfirmWorkingDoneAgent}
            handleRequestMove={handleRequestMove}
            workspaceNameMap={workspaceNameMap}
            selectWorkspace={selectWorkspace}
            handleNewSessionInWorkspace={handleNewSessionInWorkspace}
            setWorkspaceManagerOpen={setWorkspaceManagerOpen}
          />
        )
      }
      if (activeRailItem === 'skills') {
        return <SkillsRailContent capabilities={capabilities} />
      }
      return <TASidebar activeRailItem={activeRailItem as TARailItem} />
    }

    // 通用模式根据 activeRailItem 渲染
    switch (activeRailItem) {
      case 'skills':
        return <SkillsRailContent capabilities={capabilities} />
      case 'automation':
        return <AutomationRailList />
      case 'draft':
        return <DraftListPanel />
      case 'sessions':
      default:
        return (
          <SessionsRailContent
            activeSessionId={activeSessionId}
            agentProjectGroups={agentProjectGroups}
            agentIndicatorMap={agentIndicatorMap}
            collapsedWorkspaceIds={collapsedWorkspaceIds}
            setCollapsedWorkspaceIds={setCollapsedWorkspaceIds}
            extraSessionCounts={extraSessionCounts}
            setExtraSessionCounts={setExtraSessionCounts}
            currentWorkspaceId={currentWorkspaceId}
            pinnedAgentSessions={pinnedAgentSessions}
            handleRequestDelete={handleRequestDelete}
            handleSelectAgentSession={handleSelectAgentSession}
            handleAgentRename={handleAgentRename}
            handleTogglePinAgent={handleTogglePinAgent}
            handleToggleManualWorkingAgent={handleToggleManualWorkingAgent}
            handleToggleArchiveAgent={handleToggleArchiveAgent}
            handleConfirmWorkingDoneAgent={handleConfirmWorkingDoneAgent}
            handleRequestMove={handleRequestMove}
            workspaceNameMap={workspaceNameMap}
            selectWorkspace={selectWorkspace}
            handleNewSessionInWorkspace={handleNewSessionInWorkspace}
            setWorkspaceManagerOpen={setWorkspaceManagerOpen}
          />
        )
    }
  }

  return (
    <div
      className={cn(
        'nav-island-sidebar relative z-[1] h-full flex flex-col overflow-hidden shrink-0',
        'transition-[width,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]',
        activeRailItem === 'skills' && 'nav-island-sidebar--plugins',
        !isMac && 'pt-[28px]'
      )}
      style={{
        width: width ?? 240,
      }}
    >
      {/* Windows 顶部拖拽条：避开右上角窗口按钮区域（与 SidePanel / RailInspectorHeader 一致） */}
      {!isMac && (
        <div
          className="pointer-events-auto absolute inset-x-0 top-0 z-[1] h-[28px] titlebar-drag-region"
          style={{ right: 0 }}
          aria-hidden
        />
      )}
      {/* 会话页顶栏 */}
      {activeRailItem === 'sessions' ? (
        <div className="shrink-0 flex items-center justify-between px-3 pt-2 pb-1 titlebar-no-drag">
          <span className="text-[11px] font-medium text-foreground/50 uppercase tracking-wide">
            项目
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => void createProject()}
                className="size-5 flex items-center justify-center rounded-md text-foreground/35 hover:bg-foreground/[0.06] hover:text-foreground/60 transition-colors"
                aria-label="新建项目"
              >
                <Plus size={13} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top">新建项目</TooltipContent>
          </Tooltip>
        </div>
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

      {/* 新草稿按钮 + 搜索按钮（仅草稿功能区显示） */}
      {activeRailItem === 'draft' && (
        <div className="nav-island-action-row px-3 gap-1.5">
          <button
            onClick={handleNewDraft}
            className="flex-1 flex items-center gap-2 px-3 h-10 rounded-[10px] text-[13px] font-medium text-foreground/70 bg-primary/5 hover:bg-primary/10 transition-colors duration-100 titlebar-no-drag border border-border/40 hover:border-border/70"
          >
            <Plus size={14} />
            <span>新草稿</span>
          </button>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setDraftSearchOpen(true)}
                className="flex-shrink-0 size-[36px] flex items-center justify-center rounded-[10px] text-foreground/40 bg-primary/5 hover:bg-primary/10 hover:text-foreground/60 transition-colors duration-100 titlebar-no-drag border border-border/40 hover:border-border/70"
              >
                <Search size={14} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom">搜索草稿</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* 功能区内容：切换 Rail 时淡入，避免侧栏翼内容突变生硬 */}
      <div
        key={activeRailItem}
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden animate-in fade-in duration-200',
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
                          leftAccent={getSessionLeftAccent(
                            agentIndicatorMap.get(session.id) ?? 'idle',
                            session.id === activeSessionId,
                            session.manualWorking
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
      <DraftSearchDialog />
    </div>
  )
}

// ===== 功能区内容组件 =====

/** 会话功能区内容（仅 Agent 会话） */
function SessionsRailContent({
  activeSessionId,
  agentProjectGroups,
  agentIndicatorMap,
  collapsedWorkspaceIds,
  setCollapsedWorkspaceIds,
  extraSessionCounts,
  setExtraSessionCounts,
  currentWorkspaceId,
  pinnedAgentSessions,
  handleRequestDelete,
  handleSelectAgentSession,
  handleAgentRename,
  handleTogglePinAgent,
  handleToggleManualWorkingAgent,
  handleToggleArchiveAgent,
  handleConfirmWorkingDoneAgent,
  handleRequestMove,
  workspaceNameMap,
  selectWorkspace,
  handleNewSessionInWorkspace,
  setWorkspaceManagerOpen,
}: {
  activeSessionId: string | null
  agentProjectGroups: AgentProjectGroup[]
  agentIndicatorMap: Map<string, SessionIndicatorStatus>
  collapsedWorkspaceIds: Set<string>
  setCollapsedWorkspaceIds: React.Dispatch<React.SetStateAction<Set<string>>>
  extraSessionCounts: Map<string, number>
  setExtraSessionCounts: React.Dispatch<React.SetStateAction<Map<string, number>>>
  currentWorkspaceId: string | null
  pinnedAgentSessions: AgentSessionMeta[]
  handleRequestDelete: (id: string) => void
  handleSelectAgentSession: (id: string, title: string) => void
  handleAgentRename: (id: string, newTitle: string) => Promise<void>
  handleTogglePinAgent: (id: string) => Promise<void>
  handleToggleManualWorkingAgent: (id: string) => Promise<void>
  handleToggleArchiveAgent: (id: string) => Promise<void>
  handleConfirmWorkingDoneAgent: (id: string) => Promise<void>
  handleRequestMove: (id: string) => void
  workspaceNameMap: Map<string, string>
  selectWorkspace: (id: string) => void
  handleNewSessionInWorkspace: (workspaceId: string) => Promise<void>
  setWorkspaceManagerOpen: (open: boolean) => void
}): React.ReactElement {
  const store = useStore()

  const toggleCollapsed = React.useCallback(
    (workspaceId: string): void => {
      setCollapsedWorkspaceIds((prev) => {
        const next = new Set(prev)
        if (next.has(workspaceId)) next.delete(workspaceId)
        else next.add(workspaceId)
        return next
      })
    },
    [setCollapsedWorkspaceIds]
  )

  const showMore = React.useCallback(
    (workspaceId: string): void => {
      setExtraSessionCounts((prev) => {
        const next = new Map(prev)
        next.set(workspaceId, (prev.get(workspaceId) ?? 0) + PROJECT_SESSION_EXPAND_STEP)
        return next
      })
    },
    [setExtraSessionCounts]
  )

  const collapseExtra = React.useCallback(
    (workspaceId: string): void => {
      setExtraSessionCounts((prev) => {
        const next = new Map(prev)
        next.delete(workspaceId)
        return next
      })
    },
    [setExtraSessionCounts]
  )

  const handleRenameWorkspace = React.useCallback(
    async (id: string, name: string): Promise<void> => {
      try {
        await window.electronAPI.updateAgentWorkspace(id, { name })
      } catch (err) {
        console.error('[侧边栏] 重命名工作区失败:', err)
      }
    },
    []
  )

  const handleConfigureProject = React.useCallback(
    (workspaceId: string): void => {
      selectWorkspace(workspaceId)
      store.set(activeRailItemAtom, 'skills')
      store.set(selectedCapabilityAtom, null)
    },
    [selectWorkspace, store]
  )

  const handleRequestDeleteWorkspace = React.useCallback(
    (workspaceId: string): void => {
      setWorkspaceManagerOpen(true)
    },
    [setWorkspaceManagerOpen]
  )

  const listRef = React.useRef<HTMLDivElement>(null)
  const sessionLayoutKey = [
    ...pinnedAgentSessions.map((s) => s.id),
    ...agentProjectGroups.flatMap((g) => g.sessions.map((s) => s.id)),
  ].join('|')

  // 活跃会话是否在可见列表中（折叠的项目其会话不在 DOM 中）
  const isActiveSessionVisible = activeSessionId
    ? pinnedAgentSessions.some((s) => s.id === activeSessionId) ||
      agentProjectGroups.some(
        (g) => !collapsedWorkspaceIds.has(g.workspace.id) && g.sessions.some((s) => s.id === activeSessionId)
      )
    : false

  const { plateStyle, accentStyle } = useSessionListSlideIndicator(
    listRef,
    isActiveSessionVisible ? activeSessionId : null,
    sessionLayoutKey
  )
  const activeSession = activeSessionId
    ? store.get(agentSessionsAtom).find((s) => s.id === activeSessionId)
    : undefined
  const activeAccent = activeSessionId
    ? getSessionLeftAccent(
        agentIndicatorMap.get(activeSessionId) ?? 'idle',
        true,
        activeSession?.manualWorking
      )
    : undefined

  return (
    <div ref={listRef} className={cn('flex-1 overflow-y-auto px-3 py-2 scrollbar-thin min-h-0 titlebar-no-drag relative', LIST_SLIDE_HOST_CLASS)}>
      <div className="pointer-events-none absolute inset-0 z-[1]" aria-hidden>
        {plateStyle && <div className={LIST_SLIDE_INDICATOR_CLASS} style={plateStyle} />}
        {accentStyle && activeAccent && (
          <>
            <div
              className={cn(
                'sidebar-session-slide-accent session-sidebar-accent rounded-full',
                SESSION_LEFT_ACCENT_CLASS[activeAccent],
                activeAccent === 'blue' && 'animate-pulse'
              )}
              style={accentStyle}
            />
            {activeAccent === 'amber' && (
              <Timer
                size={12}
                className="absolute z-[2] text-amber-600 dark:text-amber-300"
                style={{
                  left: `${Number(accentStyle.left || 0) + 4}px`,
                  top: `${Number(accentStyle.top || 0) + Number(accentStyle.height || 0) / 2 - 6}px`,
                }}
              />
            )}
            {activeAccent === 'primary' && activeSession?.pinned && (
              <Pin
                size={11}
                className="absolute z-[2] text-primary/60"
                style={{
                  left: `${Number(accentStyle.left || 0) + 4}px`,
                  top: `${Number(accentStyle.top || 0) + Number(accentStyle.height || 0) / 2 - 5.5}px`,
                }}
              />
            )}
          </>
        )}
      </div>

      <div className="relative z-10">
        {/* 置顶分区 */}
        {pinnedAgentSessions.length > 0 && (
          <div className="mb-1.5">
            <div className="flex items-center gap-1 px-1 pb-0.5">
              <Pin size={11} className="text-foreground/30" />
              <span className="text-[11px] font-medium text-foreground/35">置顶</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {pinnedAgentSessions.map((session) => (
                <AgentSessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeSessionId}
                  indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
                  useListSlideIndicator
                  leftAccent={getSessionLeftAccent(agentIndicatorMap.get(session.id) ?? 'idle', session.id === activeSessionId, session.manualWorking)}
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

        {/* 项目分组 */}
        {agentProjectGroups.length === 0 && pinnedAgentSessions.length === 0 ? (
          <div className="px-2 py-3 text-[11px] text-foreground/30 text-center select-none">
            暂无项目，点击上方"+新会话"创建
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {agentProjectGroups.map((group) => (
            <AgentProjectGroupItem
              key={group.workspace.id}
              group={group}
              currentWorkspaceId={currentWorkspaceId}
              collapsed={collapsedWorkspaceIds.has(group.workspace.id)}
              activeSessionId={activeSessionId}
              agentIndicatorMap={agentIndicatorMap}
              expanded={extraSessionCounts.has(group.workspace.id)}
              extraCount={extraSessionCounts.get(group.workspace.id) ?? 0}
              workspaceNameMap={workspaceNameMap}
              onSelectProject={(id) => {
                selectWorkspace(id)
                toggleCollapsed(id)
              }}
              onNewSession={handleNewSessionInWorkspace}
              onRenameWorkspace={handleRenameWorkspace}
              onRequestDeleteWorkspace={handleRequestDeleteWorkspace}
              onConfigureProject={handleConfigureProject}
              onSelectSession={handleSelectAgentSession}
              onShowMore={showMore}
              onCollapseExtra={collapseExtra}
              handleRequestDelete={handleRequestDelete}
              handleAgentRename={handleAgentRename}
              handleTogglePinAgent={handleTogglePinAgent}
              handleToggleManualWorkingAgent={handleToggleManualWorkingAgent}
              handleToggleArchiveAgent={handleToggleArchiveAgent}
              handleConfirmWorkingDoneAgent={handleConfirmWorkingDoneAgent}
              handleRequestMove={handleRequestMove}
            />
          ))}
          </div>
      )}
    </div>
  </div>
  )
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
                    <MoreVertical size={14} />
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
type SessionLeftAccent = 'orange' | 'blue' | 'green' | 'primary' | 'amber' | 'idle'
const SESSION_LEFT_ACCENT_CLASS: Record<SessionLeftAccent, string> = {
  orange: 'bg-orange-500',
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  primary: 'bg-primary',
  amber: 'bg-amber-500',
  idle: 'bg-transparent',
}

interface AgentSessionItemProps {
  session: AgentSessionMeta
  active: boolean
  indicatorStatus: SessionIndicatorStatus
  showPinIcon?: boolean
  /** 行左侧状态色块；未传则不显示 */
  leftAccent?: SessionLeftAccent
  /** 是否禁用悬浮 Mini 地图 */
  disableMiniMap?: boolean
  /** 工作区名称 Badge（跨工作区列表时显示） */
  workspaceName?: string
  /** 父级列表绘制滑动指示器时，本项不再铺选中玻璃底 */
  useListSlideIndicator?: boolean
  /** 子行扩展样式（如 -ml-4 w-[calc(100%+1rem)] 让选中遮罩铺满侧栏边界） */
  childClassName?: string
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
  leftAccent,
  disableMiniMap,
  workspaceName,
  useListSlideIndicator = false,
  childClassName,
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
  const inputRef = React.useRef<HTMLInputElement>(null)
  const justStartedEditing = React.useRef(false)
  const preview = useSessionMiniMapHover(300, disableMiniMap || menuOpen)

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

  const isWorking = session.manualWorking
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
      {isWorking && (
        <MenuItem
          className="text-xs py-1 [&>svg]:size-3.5"
          onSelect={() => onConfirmDone(session.id)}
        >
          <CircleCheckBig size={14} />
          标记为完成
        </MenuItem>
      )}
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
            childClassName,
            leftAccent && 'pl-7',
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
          {/* 非选中态：竖条和文本之间的小图标 */}
          {session.manualWorking && !active && (
            <Timer size={12} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-amber-500 dark:text-amber-400 pointer-events-none" />
          )}
          {session.pinned && !active && !session.manualWorking && (
            <Pin size={11} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-primary/60 pointer-events-none" />
          )}
          {leftAccent && !(active && useListSlideIndicator) && !(session.manualWorking && !active) && !(session.pinned && !active && !session.manualWorking) && (
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
                  'truncate text-[13px] leading-5 flex items-center gap-1.5 transition-[padding] duration-150 pr-1 group-hover:pr-4',
                  active ? 'text-foreground' : 'text-foreground/80'
                )}
              >
                <span className="truncate flex-1 min-w-0">{session.title}</span>
                <span className="flex-shrink-0 text-[9px] text-foreground/30 tabular-nums">
                  {formatSessionTime(session.updatedAt)}
                </span>
              </div>
            )}
          </div>
          {!editing && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2" onClick={(e) => e.stopPropagation()}>
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
                    <MoreVertical size={14} />
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

// ===== 项目分组组件 =====

const AgentProjectGroupItem = React.memo(function AgentProjectGroupItem({
  group,
  currentWorkspaceId,
  collapsed,
  activeSessionId,
  agentIndicatorMap,
  expanded,
  extraCount,
  workspaceNameMap,
  onSelectProject,
  onNewSession,
  onRenameWorkspace,
  onRequestDeleteWorkspace,
  onConfigureProject,
  onSelectSession,
  onShowMore,
  onCollapseExtra,
  handleRequestDelete,
  handleAgentRename,
  handleTogglePinAgent,
  handleToggleManualWorkingAgent,
  handleToggleArchiveAgent,
  handleConfirmWorkingDoneAgent,
  handleRequestMove,
}: {
  group: AgentProjectGroup
  currentWorkspaceId: string | null
  collapsed: boolean
  activeSessionId: string | null
  agentIndicatorMap: Map<string, SessionIndicatorStatus>
  expanded: boolean
  extraCount: number
  workspaceNameMap: Map<string, string>
  onSelectProject: (id: string) => void
  onNewSession: (workspaceId: string) => void
  onRenameWorkspace: (id: string, name: string) => void
  onRequestDeleteWorkspace: (id: string) => void
  onConfigureProject: (id: string) => void
  onSelectSession: (id: string, title: string) => void
  onShowMore: (workspaceId: string) => void
  onCollapseExtra: (workspaceId: string) => void
  handleRequestDelete: (id: string) => void
  handleAgentRename: (id: string, newTitle: string) => Promise<void>
  handleTogglePinAgent: (id: string) => Promise<void>
  handleToggleManualWorkingAgent: (id: string) => Promise<void>
  handleToggleArchiveAgent: (id: string) => Promise<void>
  handleConfirmWorkingDoneAgent: (id: string) => Promise<void>
  handleRequestMove: (id: string) => void
}): React.ReactElement {
  const isCurrent = group.workspace.id === currentWorkspaceId
  const [renaming, setRenaming] = React.useState(false)
  const [editName, setEditName] = React.useState('')
  const editRef = React.useRef<HTMLInputElement>(null)
  const justStartedRef = React.useRef(false)

  const handleStartRename = (): void => {
    setEditName(group.workspace.name)
    setRenaming(true)
    justStartedRef.current = true
    setTimeout(() => {
      justStartedRef.current = false
      editRef.current?.focus()
      editRef.current?.select()
    }, 300)
  }

  const handleCommitRename = async (): Promise<void> => {
    if (justStartedRef.current) return
    const trimmed = editName.trim()
    if (!trimmed || trimmed === group.workspace.name) {
      setRenaming(false)
      return
    }
    await onRenameWorkspace(group.workspace.id, trimmed)
    setRenaming(false)
  }

  const handleRenameKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (e.nativeEvent.isComposing) return
      e.preventDefault()
      void handleCommitRename()
    } else if (e.key === 'Escape') {
      setRenaming(false)
    }
  }

  const recentCutoff = Date.now() - PROJECT_SESSION_RECENT_WINDOW_MS
  const getStatus = (sessionId: string): SessionIndicatorStatus =>
    agentIndicatorMap.get(sessionId) ?? 'idle'

  // 会话排序优先级：置顶 > 工作中(running/blocked) > 工作中(done/manual) > 活跃 > 最近更新
  const sessionPriority = (s: AgentSessionMeta): number => {
    if (s.pinned) return 0
    const status = getStatus(s.id)
    if (ACTIVE_SESSION_STATUSES.has(status)) return 1 + ACTIVE_SESSION_STATUS_PRIORITY[status]
    if (s.manualWorking) return 10
    return 20
  }

  const activeSessions = group.sessions
    .filter((s) => ACTIVE_SESSION_STATUSES.has(getStatus(s.id)))
    .slice()
    .sort((a, b) => {
      const pa = sessionPriority(a), pb = sessionPriority(b)
      if (pa !== pb) return pa - pb
      return b.updatedAt - a.updatedAt
    })
  const activeIds = new Set(activeSessions.map((s) => s.id))

  const fillSessions = group.sessions
    .filter((s) => !activeIds.has(s.id) && (s.pinned || s.manualWorking || s.updatedAt >= recentCutoff))
    .slice()
    .sort((a, b) => {
      const pa = sessionPriority(a), pb = sessionPriority(b)
      if (pa !== pb) return pa - pb
      return b.updatedAt - a.updatedAt
    })
    .slice(0, PROJECT_SESSION_PREVIEW_LIMIT + group.sessions.filter((s) => s.pinned || s.manualWorking).length)
  const fillIds = new Set(fillSessions.map((s) => s.id))

  const currentSession =
    activeSessionId && !activeIds.has(activeSessionId) && !fillIds.has(activeSessionId)
      ? group.sessions.find((s) => s.id === activeSessionId) ?? null
      : null

  const collapsedSessions = [
    ...activeSessions,
    ...(currentSession ? [currentSession] : []),
    ...fillSessions,
  ]
  const collapsedIds = new Set(collapsedSessions.map((s) => s.id))
  const remainingSessions = group.sessions.filter((s) => !collapsedIds.has(s.id))
  const extraSessions = remainingSessions.slice(0, extraCount)
  const sessions = [...collapsedSessions, ...extraSessions]
  const hiddenCount = Math.max(0, group.sessions.length - sessions.length)

  return (
    <section className="py-0.5">
      <div className="group/project relative flex items-center">
        {renaming ? (
          <div
            className={cn(
              'relative flex-1 min-w-0 flex items-center gap-1 px-1 py-1 rounded-md text-left titlebar-no-drag',
              isCurrent ? 'text-foreground' : 'text-foreground/65',
            )}
          >
            {!collapsed ? <FolderOpen size={13} className="flex-shrink-0 text-foreground/40" /> : <Folder size={13} className="flex-shrink-0 text-foreground/40" />}
            <input
              ref={editRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={handleRenameKeyDown}
              onBlur={() => void handleCommitRename()}
              className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-foreground border-b border-primary/50 outline-none px-0.5 leading-[18px]"
              maxLength={50}
            />
          </div>
        ) : (
          <button
            type="button"
            aria-expanded={!collapsed}
            onClick={() => onSelectProject(group.workspace.id)}
            className={cn(
              'relative flex-1 min-w-0 flex items-center gap-1 px-1 py-1 rounded-md text-left transition-colors titlebar-no-drag group-hover/project:pr-11 hover:bg-foreground/[0.025]',
              isCurrent ? 'text-foreground' : 'text-foreground/65 hover:text-foreground/88',
            )}
          >
            {!collapsed ? <FolderOpen size={13} className="flex-shrink-0 text-foreground/40" /> : <Folder size={13} className="flex-shrink-0 text-foreground/40" />}
            <span className="flex-1 min-w-0 truncate text-[13px] font-medium leading-[18px]">
              {group.workspace.name}
            </span>
            <ChevronRight
              size={12}
              className={cn(
                'flex-shrink-0 text-foreground/30 transition-transform duration-150',
                collapsed ? '-rotate-90' : 'rotate-90',
              )}
            />
          </button>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`在「${group.workspace.name}」中新建会话`}
              onClick={(e) => {
                e.stopPropagation()
                onNewSession(group.workspace.id)
              }}
              className="absolute right-5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-foreground/30 opacity-0 transition-colors hover:bg-foreground/[0.055] hover:text-foreground/65 group-hover/project:opacity-100 titlebar-no-drag"
            >
              <Plus size={13} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top">在此项目中新建会话</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="项目菜单"
              className="absolute right-0 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-foreground/30 opacity-0 transition-colors hover:bg-foreground/[0.055] hover:text-foreground/60 group-hover/project:opacity-100 data-[state=open]:opacity-100 titlebar-no-drag"
            >
              <MoreVertical size={13} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44 z-[9999] min-w-0 p-0.5">
            <DropdownMenuItem
              className="text-xs py-1 [&>svg]:size-3.5"
              onSelect={() => onSelectProject(group.workspace.id)}
            >
              <FolderOpen size={14} />
              设为当前项目
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs py-1 [&>svg]:size-3.5"
              onSelect={handleStartRename}
            >
              <Pencil size={14} />
              重命名
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs py-1 [&>svg]:size-3.5"
              onSelect={() => onConfigureProject(group.workspace.id)}
            >
              <Settings size={14} />
              配置 MCP 与 Skills
            </DropdownMenuItem>
            <DropdownMenuSeparator className="my-0.5" />
            <DropdownMenuItem
              className={cn(
                'text-xs py-1 [&>svg]:size-3.5',
                'text-destructive focus:text-destructive',
              )}
              onSelect={() => onRequestDeleteWorkspace(group.workspace.id)}
            >
              <Trash2 size={14} />
              删除项目
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="ml-4 mt-px grid transition-[grid-template-rows] duration-200 ease-in-out"
        style={{ gridTemplateRows: collapsed ? '0fr' : '1fr' }}
      >
        <div className="overflow-hidden">
          {!collapsed && sessions.length > 0 ? (
            <div className="flex flex-col gap-0.5">
              {sessions.map((session) => (
                <AgentSessionItem
                  key={session.id}
                  session={session}
                  active={session.id === activeSessionId}
                  useListSlideIndicator
                  indicatorStatus={agentIndicatorMap.get(session.id) ?? 'idle'}
                  showPinIcon={!!session.pinned}
                  leftAccent={getSessionLeftAccent(agentIndicatorMap.get(session.id) ?? 'idle', session.id === activeSessionId, session.manualWorking)}
                  childClassName="-ml-4 w-[calc(100%+1rem)] pl-7"
                  workspaceName={
                    session.workspaceId ? workspaceNameMap.get(session.workspaceId) : undefined
                  }
                  onSelect={onSelectSession}
                  onRequestDelete={handleRequestDelete}
                  onRequestMove={handleRequestMove}
                  onRename={handleAgentRename}
                  onTogglePin={handleTogglePinAgent}
                  onToggleManualWorking={handleToggleManualWorkingAgent}
                  onToggleArchive={handleToggleArchiveAgent}
                  onConfirmDone={handleConfirmWorkingDoneAgent}
                />
              ))}
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => onShowMore(group.workspace.id)}
                  className="w-full text-left px-1.5 py-1 rounded-md text-[12px] text-foreground/35 hover:bg-foreground/[0.03] hover:text-foreground/60 transition-colors titlebar-no-drag"
                >
                  显示更多
                </button>
              )}
              {expanded && (
                <button
                  type="button"
                  onClick={() => onCollapseExtra(group.workspace.id)}
                  className="w-full text-left px-1.5 py-1 rounded-md text-[12px] text-foreground/35 hover:bg-foreground/[0.03] hover:text-foreground/60 transition-colors titlebar-no-drag"
                >
                  收起
                </button>
              )}
            </div>
          ) : !collapsed ? (
            <div className="px-1.5 py-0.5 text-[12px] text-foreground/22 select-none">
              暂无会话
            </div>
          ) : null}
        </div>
      </div>
    </section>
  )
})

import { createHotContext as __vite__createHotContext } from '/@vite/client'
import.meta.hot = __vite__createHotContext('/components/app-shell/LeftSidebar.tsx')
import __vite__cjsImport0_react_jsxDevRuntime from '/@fs/F:/TAgent_General/apps/electron/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=9d13717e'
const Fragment = __vite__cjsImport0_react_jsxDevRuntime['Fragment']
const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime['jsxDEV']
import * as RefreshRuntime from '/@react-refresh'
const inWebWorker = typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope
let prevRefreshReg
let prevRefreshSig
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error("@vitejs/plugin-react can't detect preamble. Something is wrong.")
  }
  prevRefreshReg = window.$RefreshReg$
  prevRefreshSig = window.$RefreshSig$
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg(
    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx'
  )
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform
}
var _s = $RefreshSig$(),
  _s2 = $RefreshSig$(),
  _s3 = $RefreshSig$(),
  _s4 = $RefreshSig$(),
  _s5 = $RefreshSig$()
import {
  useAtom,
  useSetAtom,
  useAtomValue,
  useStore,
} from '/@fs/F:/TAgent_General/apps/electron/node_modules/.vite/deps/jotai.js?v=9d13717e'
import { ChatsCircle } from '/@fs/F:/TAgent_General/apps/electron/node_modules/.vite/deps/@phosphor-icons_react.js?v=9d13717e'
import {
  Pin,
  PinOff,
  Plus,
  Trash2,
  Pencil,
  ChevronRight,
  Search,
  Archive,
  ArchiveRestore,
  MoreVertical,
  Check,
  CheckSquare,
  Square,
  FolderOpen,
  Hourglass,
  Settings,
  GripVertical,
  PanelLeftClose,
} from '/@fs/F:/TAgent_General/apps/electron/node_modules/.vite/deps/lucide-react.js?v=9d13717e'
import __vite__cjsImport6_react from '/@fs/F:/TAgent_General/apps/electron/node_modules/.vite/deps/react.js?v=9d13717e'
const React = ((m) =>
  m?.__esModule
    ? m
    : {
        ...((typeof m === 'object' && !Array.isArray(m)) || typeof m === 'function' ? m : {}),
        default: m,
      })(__vite__cjsImport6_react)
import { toast } from '/@fs/F:/TAgent_General/apps/electron/node_modules/.vite/deps/sonner.js?v=9d13717e'
import { resolveAgentSessionModelId } from '/@fs/F:/TAgent_General/packages/shared/src/index.ts'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Popover,
  PopoverTrigger,
  PopoverContent,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '/@fs/F:/TAgent_General/packages/ui/src/index.ts'
import { SessionSearchInline } from '/components/app-shell/SessionSearchInline.tsx?t=1784799029059'
import { DraftSearchDialog } from '/components/draft/DraftSearchDialog.tsx'
const ACTIVE_SESSION_STATUSES = /* @__PURE__ */ new Set(['running', 'blocked', 'completed'])
const ACTIVE_SESSION_STATUS_PRIORITY = {
  blocked: 0,
  running: 1,
  completed: 2,
  idle: 3,
}
import { activeViewAtom } from '/atoms/active-view.ts'
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
  conversationsAtom,
} from '/atoms/agent-atoms.ts'
import {
  appModeAtom,
  activeRailItemAtom,
  navigationSidebarOpenAtom,
  topLevelModeAtom,
} from '/atoms/app-mode.ts'
import { channelsAtom, selectedModelAtom } from '/atoms/model-atoms.ts'
import { draftSessionIdsAtom } from '/atoms/draft-session-atoms.ts'
import { draftsAtom, draftSearchOpenAtom } from '/atoms/draft-atoms.ts'
import { hasEnvironmentIssuesAtom } from '/atoms/environment.ts'
import { previewPanelOpenMapAtom, previewFileMapAtom } from '/atoms/preview-atoms.ts'
import { settingsTabAtom, settingsOpenAtom } from '/atoms/settings-tab.ts'
import {
  promptConfigAtom,
  selectedPromptIdAtom,
  conversationPromptIdAtom,
} from '/atoms/system-prompt-atoms.ts'
import {
  tabsAtom,
  activeTabIdAtom,
  activeSessionIdAtom,
  closeTab,
  updateTabTitle,
  sessionViewStateMapAtom,
} from '/atoms/tab-atoms.ts'
import { hasUpdateAtom } from '/atoms/updater.ts'
import { userProfileAtom } from '/atoms/user-profile.ts'
import { PluginSidebarNav } from '/components/agent/PluginSidebarNav.tsx'
import { clearPreviewCacheForSession } from '/components/diff/DiffTabContent.tsx'
import { DraftListPanel } from '/components/draft/DraftListPanel.tsx?t=1784802380616'
import { KanbanRailContent } from '/components/kanban/KanbanRailContent.tsx?t=1784802348769'
import {
  SessionMiniMapPopover,
  useSessionMiniMapHover,
} from '/components/session-preview/SessionMiniMapPopover.tsx'
import { TASidebar } from '/components/ta/TASidebar.tsx'
import { automationsAtom } from '/atoms/automation-atoms.ts'
import { useOpenSession } from '/hooks/useOpenSession.ts'
import { useSyncActiveTabSideEffects } from '/hooks/useSyncActiveTabSideEffects.ts'
import { useWorkspaceActions } from '/hooks/useWorkspaceActions.ts'
import {
  replaceAgentSessionInFreshnessOrder,
  sortAgentSessionsByUpdatedAtDesc,
} from '/lib/agent-session-list.ts'
import { detectIsMac } from '/lib/platform.ts'
import { getAgentSessionVisualState } from '/lib/agent-session-visual-state.ts'
import { resolveModelDisplayName } from '/lib/model-logo.ts'
import { cn } from '/lib/utils.ts'
function SidebarItem({ icon, label, active, suffix, onClick }) {
  return /* @__PURE__ */ jsxDEV(
    'button',
    {
      onClick,
      className: cn(
        'w-full flex items-center justify-between px-3 py-2 rounded-md text-[13px] transition-colors duration-100 titlebar-no-drag',
        active
          ? 'bg-primary/10 text-foreground shadow-[0_1px_2px_0_rgba(0,0,0,0.05)]'
          : 'text-foreground/60 hover:bg-primary/5 hover:text-foreground'
      ),
      children: [
        /* @__PURE__ */ jsxDEV(
          'div',
          {
            className: 'flex items-center gap-3',
            children: [
              /* @__PURE__ */ jsxDEV(
                'span',
                { className: 'flex-shrink-0 w-[18px] h-[18px]', children: icon },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 229,
                  columnNumber: 9,
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                'span',
                { children: label },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 230,
                  columnNumber: 9,
                },
                this
              ),
            ],
          },
          void 0,
          true,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 228,
            columnNumber: 7,
          },
          this
        ),
        suffix,
      ],
    },
    void 0,
    true,
    {
      fileName: 'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      lineNumber: 219,
      columnNumber: 5,
    },
    this
  )
}
_c = SidebarItem
const ITEM_TO_VIEW = {
  pinned: 'conversations',
  'all-chats': 'conversations',
}
function groupByDate(items) {
  const now = /* @__PURE__ */ new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 864e5
  const today = []
  const yesterday = []
  const earlier = []
  for (const item of items) {
    if (item.updatedAt >= todayStart) {
      today.push(item)
    } else if (item.updatedAt >= yesterdayStart) {
      yesterday.push(item)
    } else {
      earlier.push(item)
    }
  }
  const groups = []
  if (today.length > 0) groups.push({ label: 'ä»å¤©', items: today })
  if (yesterday.length > 0) groups.push({ label: 'æ¨å¤©', items: yesterday })
  if (earlier.length > 0) groups.push({ label: 'æ´æ©', items: earlier })
  return groups
}
function getSessionLeftAccent(indicatorStatus, active, manualWorking) {
  if (indicatorStatus === 'blocked') return 'orange'
  if (indicatorStatus === 'running') return 'blue'
  if (indicatorStatus === 'completed') return 'green'
  if (manualWorking) return 'amber'
  if (active) return 'primary'
  return 'idle'
}
function isAgentSessionInTopLevelMode(session, topLevelMode) {
  if (session.sourceKanbanTaskId) return false
  return (session.mode ?? 'general') === topLevelMode
}
const SIDEBAR_TOP_CONTROL_CLASS =
  'h-10 rounded-[12px] border border-border/40 bg-primary/5 text-[11px] text-foreground/70 transition-colors duration-100 hover:border-border/70 hover:bg-primary/10 titlebar-no-drag'
function SidebarTopControlsRow({ isMac, children }) {
  return /* @__PURE__ */ jsxDEV(
    'div',
    {
      className: 'relative shrink-0 px-3 nav-island-body-start',
      children: /* @__PURE__ */ jsxDEV(
        'div',
        { className: 'nav-island-header-row gap-1.5', children },
        void 0,
        false,
        {
          fileName:
            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
          lineNumber: 322,
          columnNumber: 7,
        },
        this
      ),
    },
    void 0,
    false,
    {
      fileName: 'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      lineNumber: 321,
      columnNumber: 5,
    },
    this
  )
}
_c2 = SidebarTopControlsRow
export function LeftSidebar({ width: _width, activeRailItem = 'sessions' }) {
  _s()
  const [activeView, setActiveView] = useAtom(activeViewAtom)
  const setSettingsTab = useSetAtom(settingsTabAtom)
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const [_activeItem, setActiveItem] = React.useState('all-chats')
  const [conversations, setConversations] = useAtom(conversationsAtom)
  const draftSessionIds = useAtomValue(draftSessionIdsAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const setAgentMessagesCache = useSetAtom(agentSDKMessagesCacheAtom)
  const setAutomations = useSetAtom(automationsAtom)
  const [pendingDeleteId, setPendingDeleteId] = React.useState(null)
  const [pendingDeleteWorkspaceId, setPendingDeleteWorkspaceId] = React.useState(null)
  const [deletingWorkspaceId, setDeletingWorkspaceId] = React.useState(null)
  const [collapsedWorkspaceIds, setCollapsedWorkspaceIds] = React.useState(
    /* @__PURE__ */ new Set()
  )
  const [dragProjectId, setDragProjectId] = React.useState(null)
  const [projectDropIndicator, setProjectDropIndicator] = React.useState(null)
  const [batchSelectWorkspaceId, setBatchSelectWorkspaceId] = React.useState(null)
  const [batchSelectedSessionIds, setBatchSelectedSessionIds] = React.useState(
    /* @__PURE__ */ new Set()
  )
  const [batchDeleteConfirmOpen, setBatchDeleteConfirmOpen] = React.useState(false)
  const [userProfile, setUserProfile] = useAtom(userProfileAtom)
  const selectedModel = useAtomValue(selectedModelAtom)
  const mode = useAtomValue(appModeAtom)
  const topLevelMode = useAtomValue(topLevelModeAtom)
  const isMac = React.useMemo(() => detectIsMac(), [])
  const hasUpdate = useAtomValue(hasUpdateAtom)
  const hasEnvironmentIssues = useAtomValue(hasEnvironmentIssuesAtom)
  const promptConfig = useAtomValue(promptConfigAtom)
  const setSelectedPromptId = useSetAtom(selectedPromptIdAtom)
  const [agentSessions, setAgentSessions] = useAtom(agentSessionsAtom)
  const setSessionChannelMap = useSetAtom(agentSessionChannelMapAtom)
  const setSessionModelMap = useSetAtom(agentSessionModelMapAtom)
  const sessionModelMap = useAtomValue(agentSessionModelMapAtom)
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
  const legacyGlobalModelId = useAtomValue(agentModelIdAtom)
  const channels = useAtomValue(channelsAtom)
  const defaultModelForNewSession = React.useMemo(() => {
    if (!agentChannelId) return void 0
    const channel = channels.find((c) => c.id === agentChannelId && c.enabled)
    return resolveAgentSessionModelId(channel, void 0, legacyGlobalModelId)
  }, [agentChannelId, channels, legacyGlobalModelId])
  const currentWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const setCurrentWorkspaceId = useSetAtom(currentAgentWorkspaceIdAtom)
  const [workspaces, setWorkspaces] = useAtom(agentWorkspacesAtom)
  const { selectWorkspace, createProject } = useWorkspaceActions()
  const currentWorkspaceName = React.useMemo(
    () => workspaces.find((w) => w.id === currentWorkspaceId)?.name ?? null,
    [workspaces, currentWorkspaceId]
  )
  const [capabilities, setCapabilities] = React.useState(null)
  const capabilitiesVersion = useAtomValue(workspaceCapabilitiesVersionAtom)
  const [tabs, setTabs] = useAtom(tabsAtom)
  const [activeTabId, setActiveTabId] = useAtom(activeTabIdAtom)
  const activeSessionId = useAtomValue(activeSessionIdAtom)
  const openSession = useOpenSession()
  const syncActiveTabSideEffects = useSyncActiveTabSideEffects()
  const store = useStore()
  const setNavigationSidebarOpen = useSetAtom(navigationSidebarOpenAtom)
  React.useEffect(() => {
    if (!activeSessionId) return
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-session-list-id="${activeSessionId}"]`)
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    })
  }, [activeSessionId])
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
  const cleanupMapAtoms = React.useCallback(
    (id) => {
      const deleteKey = (prev) => {
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
      setSessionViewStateMap(deleteKey)
      setStreamingStates(deleteKey)
      setLiveMessagesMap(deleteKey)
      const sessionPending = store.get(agentSessionPendingFilesAtom).get(id)
      if (sessionPending && sessionPending.length > 0) {
        for (const f of sessionPending) {
          if (f.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(f.previewUrl)
          window.__pendingAgentFileData?.delete(f.id)
        }
        setSessionPendingFiles(deleteKey)
      }
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
    const map = /* @__PURE__ */ new Map()
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
  const pinnedAgentSessions = React.useMemo(
    () =>
      currentModeAgentSessions
        .filter((s) => s.pinned && !s.archived && !draftSessionIds.has(s.id))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [currentModeAgentSessions, draftSessionIds]
  )
  const archivedAgentSessionCount = React.useMemo(
    () => currentModeAgentSessions.filter((s) => s.archived && !draftSessionIds.has(s.id)).length,
    [currentModeAgentSessions, draftSessionIds]
  )
  const archivedAgentSessionsList = React.useMemo(
    () =>
      currentModeAgentSessions
        .filter((s) => s.archived && !draftSessionIds.has(s.id))
        .sort((a, b) => b.updatedAt - a.updatedAt),
    [currentModeAgentSessions, draftSessionIds]
  )
  React.useEffect(() => {
    window.electronAPI
      .listConversations()
      .then((list) => {
        setConversations(list)
      })
      .catch(console.error)
    window.electronAPI.getUserProfile().then(setUserProfile).catch(console.error)
    window.electronAPI
      .listAgentSessions()
      .then((sessions) => {
        setAgentSessions(sessions)
        setSessionChannelMap((prev) => {
          const next = new Map(prev)
          for (const s of sessions) {
            if (s.channelId) next.set(s.id, s.channelId)
          }
          return next
        })
        setSessionModelMap((prev) => {
          const next = new Map(prev)
          for (const s of sessions) {
            if (s.modelId) next.set(s.id, s.modelId)
          }
          return next
        })
      })
      .catch(console.error)
  }, [setConversations, setUserProfile, setAgentSessions, setSessionChannelMap, setSessionModelMap])
  React.useEffect(() => {
    window.electronAPI
      .runAutoArchive()
      .then((count) => {
        if (count > 0) {
          console.log(`[ä¾§è¾¹æ ] èªå¨å½æ¡£äº ${count} ä¸ªè¿æä¼è¯`)
          window.electronAPI.listAgentSessions().then(setAgentSessions).catch(console.error)
        }
      })
      .catch(console.error)
  }, [setAgentSessions])
  React.useEffect(() => {
    const handleFocus = () => {
      window.electronAPI.listConversations().then(setConversations).catch(console.error)
      window.electronAPI
        .listAgentSessions()
        .then((sessions) => {
          setAgentSessions(sessions)
          setSessionChannelMap((prev) => {
            const next = new Map(prev)
            for (const s of sessions) {
              if (s.channelId) next.set(s.id, s.channelId)
            }
            return next
          })
          setSessionModelMap((prev) => {
            const next = new Map(prev)
            for (const s of sessions) {
              if (s.modelId) next.set(s.id, s.modelId)
            }
            return next
          })
        })
        .catch(console.error)
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [setConversations, setAgentSessions])
  const handleItemClick = (item) => {
    setActiveItem(item)
    setActiveView(ITEM_TO_VIEW[item])
  }
  const handleRequestDelete = React.useCallback((id) => {
    setPendingDeleteId(id)
  }, [])
  const handleConfirmDelete = async () => {
    if (!pendingDeleteId) return
    const tabToClose = tabs.find((t) => t.sessionId === pendingDeleteId)
    const tabIdToClose = tabToClose?.id ?? pendingDeleteId
    const wasActive = activeTabId === tabIdToClose
    const tabResult = closeTab(tabs, activeTabId, tabIdToClose)
    setTabs(tabResult.tabs)
    setActiveTabId(tabResult.activeTabId)
    if (wasActive) {
      const newActiveTab = tabResult.activeTabId
        ? (tabResult.tabs.find((t) => t.id === tabResult.activeTabId) ?? null)
        : null
      syncActiveTabSideEffects(newActiveTab)
    }
    setDraftSessionIds((prev) => {
      if (!prev.has(pendingDeleteId)) return prev
      const next = new Set(prev)
      next.delete(pendingDeleteId)
      return next
    })
    cleanupMapAtoms(pendingDeleteId)
    setWorkingDone((prev) => {
      if (!prev.has(pendingDeleteId)) return prev
      const next = new Set(prev)
      next.delete(pendingDeleteId)
      return next
    })
    if (mode === 'agent') {
      try {
        await window.electronAPI.deleteAgentSession(pendingDeleteId)
        const sessions = await window.electronAPI.listAgentSessions()
        setAgentSessions(sessions)
      } catch (error) {
        console.error('[ä¾§è¾¹æ ] å é¤ Agent ä¼è¯å¤±è´¥:', error)
        setAgentSessions((prev) => prev.filter((s) => s.id !== pendingDeleteId))
      } finally {
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
      const conversations2 = await window.electronAPI.listConversations()
      setConversations(conversations2)
    } catch (error) {
      console.error('[ä¾§è¾¹æ ] å é¤å¯¹è¯å¤±è´¥:', error)
      setConversations((prev) => prev.filter((c) => c.id !== pendingDeleteId))
    } finally {
      setPendingDeleteId(null)
    }
  }
  const handleEnterBatchSelect = React.useCallback((workspaceId) => {
    setBatchSelectWorkspaceId(workspaceId)
    setBatchSelectedSessionIds(/* @__PURE__ */ new Set())
  }, [])
  const handleExitBatchSelect = React.useCallback(() => {
    setBatchSelectWorkspaceId(null)
    setBatchSelectedSessionIds(/* @__PURE__ */ new Set())
  }, [])
  const handleToggleBatchSelect = React.useCallback((sessionId) => {
    setBatchSelectedSessionIds((prev) => {
      const next = new Set(prev)
      if (next.has(sessionId)) next.delete(sessionId)
      else next.add(sessionId)
      return next
    })
  }, [])
  const handleRequestBatchDelete = React.useCallback(() => {
    if (batchSelectedSessionIds.size === 0) return
    setBatchDeleteConfirmOpen(true)
  }, [batchSelectedSessionIds.size])
  const handleConfirmBatchDelete = async () => {
    if (batchSelectedSessionIds.size === 0) return
    const ids = [...batchSelectedSessionIds]
    const tabsToClose = tabs.filter((t) => ids.includes(t.sessionId))
    let currentTabs = tabs
    let currentActive = activeTabId
    for (const tab of tabsToClose) {
      const result = closeTab(currentTabs, currentActive, tab.id)
      currentTabs = result.tabs
      currentActive = result.activeTabId
    }
    setTabs(currentTabs)
    setActiveTabId(currentActive)
    if (tabsToClose.some((t) => t.id === activeTabId)) {
      const newActive = currentActive
        ? (currentTabs.find((t) => t.id === currentActive) ?? null)
        : null
      syncActiveTabSideEffects(newActive)
    }
    for (const id of ids) {
      setDraftSessionIds((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      cleanupMapAtoms(id)
      setWorkingDone((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      setAgentMessagesCache((prev) => {
        if (!prev.has(id)) return prev
        const next = new Map(prev)
        next.delete(id)
        return next
      })
    }
    if (mode === 'agent') {
      await Promise.all(
        ids.map(async (id) => {
          try {
            await window.electronAPI.deleteAgentSession(id)
          } catch (error) {
            console.error(`[ä¾§è¾¹æ ] æ¹éå é¤ä¼è¯ ${id} å¤±è´¥:`, error)
          }
        })
      )
      try {
        const sessions = await window.electronAPI.listAgentSessions()
        setAgentSessions(sessions)
      } catch (error) {
        console.error('[ä¾§è¾¹æ ] æ¹éå é¤åå·æ°ä¼è¯åè¡¨å¤±è´¥:', error)
        setAgentSessions((prev) => prev.filter((s) => !ids.includes(s.id)))
      }
    }
    handleExitBatchSelect()
    setBatchDeleteConfirmOpen(false)
  }
  const handleNewDraft = async () => {
    try {
      const doc = await window.electronAPI.draft.create({ title: 'æªå½åèç¨¿' })
      setDrafts((prev) => [doc, ...prev])
      openSession('draft', doc.id, doc.title)
    } catch (error) {
      console.error('[ä¾§è¾¹æ ] åå»ºèç¨¿å¤±è´¥:', error)
    }
  }
  const handleNewAgentSession = async () => {
    try {
      const sessionMode = topLevelMode === 'ta' ? 'ta' : 'general'
      const meta = await window.electronAPI.createAgentSession(
        void 0,
        agentChannelId || void 0,
        currentWorkspaceId || void 0,
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
      if (defaultModelForNewSession) {
        setSessionModelMap((prev) => {
          const map = new Map(prev)
          map.set(meta.id, defaultModelForNewSession)
          return map
        })
      }
      openSession('agent', meta.id, meta.title, sessionMode)
      setActiveView('conversations')
      setActiveItem('all-chats')
    } catch (error) {
      console.error('[ä¾§è¾¹æ ] åå»º Agent ä¼è¯å¤±è´¥:', error)
    }
  }
  const handleNewSessionInWorkspace = React.useCallback(
    async (workspaceId) => {
      try {
        const sessionMode = topLevelMode === 'ta' ? 'ta' : 'general'
        const meta = await window.electronAPI.createAgentSession(
          void 0,
          agentChannelId || void 0,
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
        if (defaultModelForNewSession) {
          setSessionModelMap((prev) => {
            const map = new Map(prev)
            map.set(meta.id, defaultModelForNewSession)
            return map
          })
        }
        openSession('agent', meta.id, meta.title, sessionMode)
        setActiveView('conversations')
        setActiveItem('all-chats')
      } catch (error) {
        console.error('[ä¾§è¾¹æ ] å¨å·¥ä½åºä¸­åå»º Agent ä¼è¯å¤±è´¥:', error)
      }
    },
    [
      agentChannelId,
      defaultModelForNewSession,
      openSession,
      setActiveView,
      setActiveItem,
      setAgentSessions,
      setSessionChannelMap,
      setSessionModelMap,
      topLevelMode,
    ]
  )
  const handleSelectAgentSession = React.useCallback(
    (id, title) => {
      openSession('agent', id, title)
      setActiveView('conversations')
      setActiveItem('all-chats')
      setUnviewedCompleted((prev) => {
        if (!prev.has(id)) return prev
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    },
    [openSession, setActiveView, setUnviewedCompleted]
  )
  const handleAgentRename = React.useCallback(
    async (id, newTitle) => {
      try {
        const updated = await window.electronAPI.updateAgentSessionTitle(id, newTitle)
        setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
        setTabs((prev) => updateTabTitle(prev, id, newTitle))
      } catch (error) {
        console.error('[ä¾§è¾¹æ ] éå½å Agent ä¼è¯å¤±è´¥:', error)
      }
    },
    [setAgentSessions, setTabs]
  )
  const handleWorkspaceRename = React.useCallback(
    async (workspaceId, newName) => {
      try {
        const updated = await window.electronAPI.updateAgentWorkspace(workspaceId, {
          name: newName,
        })
        setWorkspaces((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
      } catch (error) {
        console.error('[ä¾§è¾¹æ ] éå½åå·¥ä½åºå¤±è´¥:', error)
        const msg = error instanceof Error ? error.message : 'éå½åå¤±è´¥'
        toast.error(msg)
      }
    },
    [setWorkspaces]
  )
  const canDeleteWorkspace = React.useCallback(
    (workspace) => workspace.slug !== 'default' && workspaces.length > 1,
    [workspaces.length]
  )
  const pendingDeleteWorkspace = React.useMemo(
    () => workspaces.find((workspace) => workspace.id === pendingDeleteWorkspaceId) ?? null,
    [pendingDeleteWorkspaceId, workspaces]
  )
  const handleRequestDeleteWorkspace = React.useCallback((workspaceId) => {
    setPendingDeleteWorkspaceId(workspaceId)
  }, [])
  const handleProjectDragStart = React.useCallback((e, workspaceId) => {
    setDragProjectId(workspaceId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', workspaceId)
  }, [])
  const handleProjectDragOver = React.useCallback(
    (e, workspaceId) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (!dragProjectId || dragProjectId === workspaceId) {
        setProjectDropIndicator(null)
        return
      }
      const rect = e.currentTarget.getBoundingClientRect()
      const ratio = (e.clientY - rect.top) / rect.height
      const position = ratio < 0.5 ? 'before' : 'after'
      setProjectDropIndicator((prev) =>
        prev?.id === workspaceId && prev.position === position
          ? prev
          : { id: workspaceId, position }
      )
    },
    [dragProjectId]
  )
  const handleProjectDragLeave = React.useCallback((e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setProjectDropIndicator(null)
    }
  }, [])
  const handleProjectDrop = React.useCallback(
    async (e, targetWorkspaceId) => {
      e.preventDefault()
      const indicator = projectDropIndicator
      if (
        !dragProjectId ||
        dragProjectId === targetWorkspaceId ||
        !indicator ||
        indicator.id !== targetWorkspaceId
      ) {
        setDragProjectId(null)
        setProjectDropIndicator(null)
        return
      }
      const ids = workspaces.map((w) => w.id)
      const fromIndex = ids.indexOf(dragProjectId)
      const toIndex = ids.indexOf(targetWorkspaceId)
      if (fromIndex === -1 || toIndex === -1) {
        setDragProjectId(null)
        setProjectDropIndicator(null)
        return
      }
      const newIds = ids.filter((id) => id !== dragProjectId)
      let insertAt = newIds.indexOf(targetWorkspaceId)
      if (insertAt === -1) insertAt = newIds.length
      if (indicator.position === 'after') insertAt += 1
      newIds.splice(insertAt, 0, dragProjectId)
      setDragProjectId(null)
      setProjectDropIndicator(null)
      const byId = new Map(workspaces.map((w) => [w.id, w]))
      const reordered = newIds.map((id) => byId.get(id)).filter(Boolean)
      setWorkspaces(reordered)
      try {
        const saved = await window.electronAPI.reorderAgentWorkspaces(newIds)
        setWorkspaces(saved)
      } catch (error) {
        console.error('[å·¥ä½åºæåº] æä¹åå¤±è´¥:', error)
      }
    },
    [dragProjectId, projectDropIndicator, workspaces, setWorkspaces]
  )
  const handleProjectDragEnd = React.useCallback(() => {
    setDragProjectId(null)
    setProjectDropIndicator(null)
  }, [])
  const handleConfirmDeleteWorkspace = React.useCallback(async () => {
    const workspaceId = pendingDeleteWorkspaceId
    const workspace = workspaces.find((item) => item.id === workspaceId)
    if (!workspaceId || !workspace) return
    if (!canDeleteWorkspace(workspace)) {
      toast.error(workspace.slug === 'default' ? 'é»è®¤é¡¹ç®ä¸è½å é¤' : 'è³å°éè¦ä¿çä¸ä¸ªé¡¹ç®')
      setPendingDeleteWorkspaceId(null)
      return
    }
    const deletedSessionIds = new Set(
      agentSessions
        .filter((session) => session.workspaceId === workspaceId)
        .map((session) => session.id)
    )
    try {
      setDeletingWorkspaceId(workspaceId)
      await window.electronAPI.deleteAgentWorkspace(workspaceId)
      for (const sessionId of deletedSessionIds) {
        cleanupMapAtoms(sessionId)
      }
      setDraftSessionIds((prev) => {
        let changed = false
        const next = new Set(prev)
        for (const sessionId of deletedSessionIds) {
          if (next.delete(sessionId)) changed = true
        }
        return changed ? next : prev
      })
      setAgentMessagesCache((prev) => {
        let changed = false
        const next = new Map(prev)
        for (const sessionId of deletedSessionIds) {
          if (next.delete(sessionId)) changed = true
        }
        return changed ? next : prev
      })
      setAutomations((prev) => prev.filter((automation) => automation.workspaceId !== workspaceId))
      const currentTabs = store.get(tabsAtom)
      const currentActiveTabId = store.get(activeTabIdAtom)
      const nextTabs = currentTabs.filter(
        (tab) =>
          (tab.type !== 'agent' && tab.type !== 'preview') || !deletedSessionIds.has(tab.sessionId)
      )
      const nextActiveTabId =
        currentActiveTabId && nextTabs.some((tab) => tab.id === currentActiveTabId)
          ? currentActiveTabId
          : (nextTabs[0]?.id ?? null)
      setTabs(nextTabs)
      setActiveTabId(nextActiveTabId)
      syncActiveTabSideEffects(
        nextActiveTabId ? (nextTabs.find((tab) => tab.id === nextActiveTabId) ?? null) : null
      )
      const [remainingWorkspaces, sessions] = await Promise.all([
        window.electronAPI.listAgentWorkspaces(),
        window.electronAPI.listAgentSessions(),
      ])
      setWorkspaces(remainingWorkspaces)
      setAgentSessions(sessions)
      setCollapsedWorkspaceIds((prev) => {
        if (!prev.has(workspaceId)) return prev
        const next = new Set(prev)
        next.delete(workspaceId)
        return next
      })
      if (workspaceId === currentWorkspaceId) {
        const fallback =
          remainingWorkspaces.find((item) => item.slug === 'default') ??
          remainingWorkspaces[0] ??
          null
        setCurrentWorkspaceId(fallback?.id ?? null)
        if (fallback) {
          window.electronAPI.updateSettings({ agentWorkspaceId: fallback.id }).catch(console.error)
        }
      }
      toast.success('é¡¹ç®å·²å é¤', {
        description: `å·²å é¤ã${workspace.name}ãåå¶ç»å®èµæº`,
      })
    } catch (error) {
      console.error('[ä¾§è¾¹æ ] å é¤é¡¹ç®å¤±è´¥:', error)
      const msg = error instanceof Error ? error.message : 'å é¤é¡¹ç®å¤±è´¥'
      toast.error(msg)
    } finally {
      setDeletingWorkspaceId(null)
      setPendingDeleteWorkspaceId(null)
    }
  }, [
    pendingDeleteWorkspaceId,
    workspaces,
    canDeleteWorkspace,
    agentSessions,
    cleanupMapAtoms,
    setDraftSessionIds,
    setAgentMessagesCache,
    setAutomations,
    store,
    setTabs,
    setActiveTabId,
    syncActiveTabSideEffects,
    setWorkspaces,
    setAgentSessions,
    currentWorkspaceId,
    setCurrentWorkspaceId,
  ])
  const handleTogglePinAgent = React.useCallback(
    async (id) => {
      try {
        const original = store.get(agentSessionsAtom).find((s) => s.id === id)
        const updated = await window.electronAPI.togglePinAgentSession(id)
        setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
        if (updated.pinned) {
          const isRunning = store.get(agentSessionIndicatorMapAtom).get(id) === 'running'
          if (isRunning) {
            toast.success('å·²ç½®é¡¶', {
              description: 'å½å Agent æ­£å¨æ§è¡ä¸­ï¼ç§»åºå·¥ä½ä¸­åä¼æ¾ç¤ºå°ç½®é¡¶åºå',
            })
          } else if (original?.archived && !updated.archived) {
            toast.success('å·²ç½®é¡¶', { description: 'å·²èªå¨åæ¶å½æ¡£' })
          } else {
            toast.success('å·²ç½®é¡¶')
          }
        } else {
          toast.success('å·²åæ¶ç½®é¡¶')
        }
      } catch (error) {
        console.error('[ä¾§è¾¹æ ] åæ¢ Agent ä¼è¯ç½®é¡¶å¤±è´¥:', error)
      }
    },
    [store, setAgentSessions]
  )
  const handleToggleArchiveAgent = React.useCallback(
    async (id) => {
      try {
        const updated = await window.electronAPI.toggleArchiveAgentSession(id)
        setAgentSessions((prev) => replaceAgentSessionInFreshnessOrder(prev, updated))
        if (updated.archived) {
          const currentTabs = store.get(tabsAtom)
          const currentActiveTabId = store.get(activeTabIdAtom)
          const wasActive = currentActiveTabId === id
          const tabResult = closeTab(currentTabs, currentActiveTabId, id)
          setTabs(tabResult.tabs)
          setActiveTabId(tabResult.activeTabId)
          cleanupMapAtoms(id)
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
        toast.success(updated.archived ? 'å·²å½æ¡£' : 'å·²åæ¶å½æ¡£')
      } catch (error) {
        console.error('[ä¾§è¾¹æ ] åæ¢ Agent ä¼è¯å½æ¡£å¤±è´¥:', error)
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
  const agentProjectGroups = React.useMemo(() => {
    const sessionsByWorkspaceId = /* @__PURE__ */ new Map()
    for (const workspace of workspaces) {
      sessionsByWorkspaceId.set(workspace.id, [])
    }
    const defaultWsId = workspaces.find((ws) => ws.slug === 'default')?.id ?? workspaces[0]?.id
    const visibleHistory = sortAgentSessionsByUpdatedAtDesc(
      currentModeAgentSessions.filter(
        (session) => !session.archived && !session.pinned && !draftSessionIds.has(session.id)
      )
    )
    for (const session of visibleHistory) {
      const targetId =
        session.workspaceId && sessionsByWorkspaceId.has(session.workspaceId)
          ? session.workspaceId
          : defaultWsId
      if (!targetId) continue
      sessionsByWorkspaceId.get(targetId).push(session)
    }
    return workspaces.map((workspace) => ({
      workspace,
      sessions: sessionsByWorkspaceId.get(workspace.id) ?? [],
    }))
  }, [currentModeAgentSessions, draftSessionIds, workspaces])
  React.useEffect(() => {
    if (!activeSessionId) return
    const groupWithActive = agentProjectGroups.find((g) =>
      g.sessions.some((s) => s.id === activeSessionId)
    )
    if (!groupWithActive) return
    const wsId = groupWithActive.workspace.id
    setCollapsedWorkspaceIds((prev) => {
      if (!prev.has(wsId)) return prev
      const next = new Set(prev)
      next.delete(wsId)
      return next
    })
  }, [activeSessionId, agentProjectGroups, setCollapsedWorkspaceIds])
  const deleteDialog = /* @__PURE__ */ jsxDEV(
    AlertDialog,
    {
      open: pendingDeleteId !== null,
      onOpenChange: (open) => {
        if (!open) setPendingDeleteId(null)
      },
      children: /* @__PURE__ */ jsxDEV(
        AlertDialogContent,
        {
          onKeyDown: (e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleConfirmDelete()
            }
          },
          children: [
            /* @__PURE__ */ jsxDEV(
              AlertDialogHeader,
              {
                children: [
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogTitle,
                    { children: 'ç¡®è®¤å é¤å¯¹è¯' },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1347,
                      columnNumber: 11,
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogDescription,
                    { children: 'å é¤åå°æ æ³æ¢å¤ï¼ç¡®å®è¦å é¤è¿ä¸ªå¯¹è¯åï¼' },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1348,
                      columnNumber: 11,
                    },
                    this
                  ),
                ],
              },
              void 0,
              true,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 1346,
                columnNumber: 9,
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              AlertDialogFooter,
              {
                children: [
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogCancel,
                    { children: 'åæ¶' },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1351,
                      columnNumber: 11,
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogAction,
                    {
                      onClick: handleConfirmDelete,
                      className:
                        'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                      children: 'å é¤',
                    },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1352,
                      columnNumber: 11,
                    },
                    this
                  ),
                ],
              },
              void 0,
              true,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 1350,
                columnNumber: 9,
              },
              this
            ),
          ],
        },
        void 0,
        true,
        {
          fileName:
            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
          lineNumber: 1338,
          columnNumber: 7,
        },
        this
      ),
    },
    void 0,
    false,
    {
      fileName: 'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      lineNumber: 1332,
      columnNumber: 3,
    },
    this
  )
  const projectDeleteDialog = /* @__PURE__ */ jsxDEV(
    AlertDialog,
    {
      open: pendingDeleteWorkspaceId !== null,
      onOpenChange: (open) => {
        if (!open && !deletingWorkspaceId) setPendingDeleteWorkspaceId(null)
      },
      children: /* @__PURE__ */ jsxDEV(
        AlertDialogContent,
        {
          onCloseAutoFocus: (event) => event.preventDefault(),
          onKeyDown: (e) => {
            if (e.key === 'Enter' && !deletingWorkspaceId) {
              e.preventDefault()
              void handleConfirmDeleteWorkspace()
            }
          },
          children: [
            /* @__PURE__ */ jsxDEV(
              AlertDialogHeader,
              {
                children: [
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogTitle,
                    { children: 'ç¡®è®¤å é¤é¡¹ç®' },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1380,
                      columnNumber: 11,
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogDescription,
                    {
                      children: [
                        'å°å é¤ã',
                        pendingDeleteWorkspace?.name ?? 'è¯¥é¡¹ç®',
                        'ãåå¶ç»å®çææä¼è¯ãèªå¨ä»»å¡ãMCPãSkills ä¸å·¥ä½åºæä»¶ãå é¤åæ æ³æ¢å¤ã',
                      ],
                    },
                    void 0,
                    true,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1381,
                      columnNumber: 11,
                    },
                    this
                  ),
                ],
              },
              void 0,
              true,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 1379,
                columnNumber: 9,
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              AlertDialogFooter,
              {
                children: [
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogCancel,
                    { disabled: !!deletingWorkspaceId, children: 'åæ¶' },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1387,
                      columnNumber: 11,
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogAction,
                    {
                      disabled: !!deletingWorkspaceId,
                      onClick: () => void handleConfirmDeleteWorkspace(),
                      className:
                        'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                      children: deletingWorkspaceId ? 'å é¤ä¸­...' : 'å é¤é¡¹ç®',
                    },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1388,
                      columnNumber: 11,
                    },
                    this
                  ),
                ],
              },
              void 0,
              true,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 1386,
                columnNumber: 9,
              },
              this
            ),
          ],
        },
        void 0,
        true,
        {
          fileName:
            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
          lineNumber: 1370,
          columnNumber: 7,
        },
        this
      ),
    },
    void 0,
    false,
    {
      fileName: 'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      lineNumber: 1364,
      columnNumber: 3,
    },
    this
  )
  const batchDeleteDialog = /* @__PURE__ */ jsxDEV(
    AlertDialog,
    {
      open: batchDeleteConfirmOpen,
      onOpenChange: (open) => {
        if (!open) setBatchDeleteConfirmOpen(false)
      },
      children: /* @__PURE__ */ jsxDEV(
        AlertDialogContent,
        {
          children: [
            /* @__PURE__ */ jsxDEV(
              AlertDialogHeader,
              {
                children: [
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogTitle,
                    { children: ['ç¡®è®¤æ¹éå é¤ ', batchSelectedSessionIds.size, ' ä¸ªä¼è¯'] },
                    void 0,
                    true,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1410,
                      columnNumber: 11,
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogDescription,
                    {
                      children: [
                        'å é¤åå°æ æ³æ¢å¤ï¼ç¡®å®è¦å é¤éä¸­ç ',
                        batchSelectedSessionIds.size,
                        ' ä¸ªä¼è¯åï¼',
                      ],
                    },
                    void 0,
                    true,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1411,
                      columnNumber: 11,
                    },
                    this
                  ),
                ],
              },
              void 0,
              true,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 1409,
                columnNumber: 9,
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              AlertDialogFooter,
              {
                children: [
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogCancel,
                    { children: 'åæ¶' },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1416,
                      columnNumber: 11,
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    AlertDialogAction,
                    {
                      onClick: handleConfirmBatchDelete,
                      className:
                        'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                      children: 'å é¤',
                    },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1417,
                      columnNumber: 11,
                    },
                    this
                  ),
                ],
              },
              void 0,
              true,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 1415,
                columnNumber: 9,
              },
              this
            ),
          ],
        },
        void 0,
        true,
        {
          fileName:
            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
          lineNumber: 1408,
          columnNumber: 7,
        },
        this
      ),
    },
    void 0,
    false,
    {
      fileName: 'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      lineNumber: 1402,
      columnNumber: 3,
    },
    this
  )
  const renderRailContent = () => {
    if (topLevelMode === 'ta') {
      if (activeRailItem === 'sessions') {
        return /* @__PURE__ */ jsxDEV(
          SessionsRailContent,
          {
            activeSessionId,
            agentProjectGroups,
            agentIndicatorMap,
            sessionModelMap,
            channels,
            collapsedWorkspaceIds,
            setCollapsedWorkspaceIds,
            currentWorkspaceId,
            pinnedAgentSessions,
            handleRequestDelete,
            handleSelectAgentSession,
            handleAgentRename,
            handleTogglePinAgent,
            handleToggleArchiveAgent,
            workspaceNameMap,
            selectWorkspace,
            handleNewSessionInWorkspace,
            onRenameWorkspace: handleWorkspaceRename,
            onRequestDeleteWorkspace: handleRequestDeleteWorkspace,
            dragProjectId,
            projectDropIndicator,
            onProjectDragStart: handleProjectDragStart,
            onProjectDragOver: handleProjectDragOver,
            onProjectDragLeave: handleProjectDragLeave,
            onProjectDrop: handleProjectDrop,
            onProjectDragEnd: handleProjectDragEnd,
            batchSelectWorkspaceId,
            batchSelectedSessionIds,
            onEnterBatchSelect: handleEnterBatchSelect,
            onExitBatchSelect: handleExitBatchSelect,
            onToggleBatchSelect: handleToggleBatchSelect,
            onBatchUpdateSelected: setBatchSelectedSessionIds,
            onRequestBatchDelete: handleRequestBatchDelete,
            onConfirmBatchDelete: handleConfirmBatchDelete,
            onCreateProject: createProject,
          },
          void 0,
          false,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1440,
            columnNumber: 11,
          },
          this
        )
      }
      if (activeRailItem === 'skills') {
        return /* @__PURE__ */ jsxDEV(
          SkillsRailContent,
          { capabilities },
          void 0,
          false,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1480,
            columnNumber: 16,
          },
          this
        )
      }
      if (activeRailItem === 'kanban') {
        return /* @__PURE__ */ jsxDEV(
          KanbanRailContent,
          {},
          void 0,
          false,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1483,
            columnNumber: 16,
          },
          this
        )
      }
      if (activeRailItem === 'memory') {
        return null
      }
      return /* @__PURE__ */ jsxDEV(
        TASidebar,
        { activeRailItem },
        void 0,
        false,
        {
          fileName:
            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
          lineNumber: 1489,
          columnNumber: 14,
        },
        this
      )
    }
    switch (activeRailItem) {
      case 'skills':
        return /* @__PURE__ */ jsxDEV(
          SkillsRailContent,
          { capabilities },
          void 0,
          false,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1495,
            columnNumber: 16,
          },
          this
        )
      case 'draft':
        return /* @__PURE__ */ jsxDEV(
          DraftListPanel,
          {},
          void 0,
          false,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1497,
            columnNumber: 16,
          },
          this
        )
      case 'kanban':
        return /* @__PURE__ */ jsxDEV(
          KanbanRailContent,
          {},
          void 0,
          false,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1499,
            columnNumber: 16,
          },
          this
        )
      case 'memory':
      case 'automation':
        return null
      case 'sessions':
      default:
        return /* @__PURE__ */ jsxDEV(
          SessionsRailContent,
          {
            activeSessionId,
            agentProjectGroups,
            agentIndicatorMap,
            sessionModelMap,
            channels,
            collapsedWorkspaceIds,
            setCollapsedWorkspaceIds,
            currentWorkspaceId,
            pinnedAgentSessions,
            handleRequestDelete,
            handleSelectAgentSession,
            handleAgentRename,
            handleTogglePinAgent,
            handleToggleArchiveAgent,
            workspaceNameMap,
            selectWorkspace,
            handleNewSessionInWorkspace,
            onRenameWorkspace: handleWorkspaceRename,
            onRequestDeleteWorkspace: handleRequestDeleteWorkspace,
            dragProjectId,
            projectDropIndicator,
            onProjectDragStart: handleProjectDragStart,
            onProjectDragOver: handleProjectDragOver,
            onProjectDragLeave: handleProjectDragLeave,
            onProjectDrop: handleProjectDrop,
            onProjectDragEnd: handleProjectDragEnd,
            batchSelectWorkspaceId,
            batchSelectedSessionIds,
            onEnterBatchSelect: handleEnterBatchSelect,
            onExitBatchSelect: handleExitBatchSelect,
            onToggleBatchSelect: handleToggleBatchSelect,
            onBatchUpdateSelected: setBatchSelectedSessionIds,
            onRequestBatchDelete: handleRequestBatchDelete,
            onConfirmBatchDelete: handleConfirmBatchDelete,
            onCreateProject: createProject,
          },
          void 0,
          false,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1507,
            columnNumber: 11,
          },
          this
        )
    }
  }
  return /* @__PURE__ */ jsxDEV(
    'div',
    {
      className: cn(
        'nav-island-sidebar relative z-[1] h-full w-full flex flex-col overflow-hidden min-w-0'
      ),
      children: [
        activeRailItem === 'sessions'
          ? /* @__PURE__ */ jsxDEV(
              'div',
              {
                className: 'sidebar-inner',
                children: [
                  /* @__PURE__ */ jsxDEV(
                    'div',
                    {
                      className: 'sidebar-head titlebar-no-drag',
                      children: [
                        /* @__PURE__ */ jsxDEV(
                          'div',
                          {
                            className: 'sidebar-head-copy',
                            children: [
                              /* @__PURE__ */ jsxDEV(
                                'span',
                                { className: 'sidebar-section-kicker', children: 'WORKSPACE' },
                                void 0,
                                false,
                                {
                                  fileName:
                                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                  lineNumber: 1559,
                                  columnNumber: 15,
                                },
                                this
                              ),
                              /* @__PURE__ */ jsxDEV(
                                'h2',
                                { className: 'sidebar-head-title', children: 'ä¼è¯' },
                                void 0,
                                false,
                                {
                                  fileName:
                                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                  lineNumber: 1560,
                                  columnNumber: 15,
                                },
                                this
                              ),
                            ],
                          },
                          void 0,
                          true,
                          {
                            fileName:
                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                            lineNumber: 1558,
                            columnNumber: 13,
                          },
                          this
                        ),
                        /* @__PURE__ */ jsxDEV(
                          'div',
                          {
                            className: 'tool-cluster',
                            role: 'group',
                            'aria-label': 'ä¼è¯æä½',
                            children: [
                              /* @__PURE__ */ jsxDEV(
                                'button',
                                {
                                  type: 'button',
                                  className: 'tool-cluster-icon',
                                  onClick: () => setNavigationSidebarOpen(false),
                                  'aria-label': 'æå ä¾§æ ',
                                  title: 'æå ä¾§æ ',
                                  children: /* @__PURE__ */ jsxDEV(
                                    PanelLeftClose,
                                    { size: 14, strokeWidth: 1.75, 'aria-hidden': 'true' },
                                    void 0,
                                    false,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 1570,
                                      columnNumber: 17,
                                    },
                                    this
                                  ),
                                },
                                void 0,
                                false,
                                {
                                  fileName:
                                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                  lineNumber: 1563,
                                  columnNumber: 15,
                                },
                                this
                              ),
                              /* @__PURE__ */ jsxDEV(
                                'button',
                                {
                                  type: 'button',
                                  className: 'tool-cluster-accent',
                                  onClick: handleNewAgentSession,
                                  title: 'æ°å»ºä¼è¯',
                                  children: 'æ°ä¼è¯',
                                },
                                void 0,
                                false,
                                {
                                  fileName:
                                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                  lineNumber: 1572,
                                  columnNumber: 15,
                                },
                                this
                              ),
                            ],
                          },
                          void 0,
                          true,
                          {
                            fileName:
                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                            lineNumber: 1562,
                            columnNumber: 13,
                          },
                          this
                        ),
                      ],
                    },
                    void 0,
                    true,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1557,
                      columnNumber: 11,
                    },
                    this
                  ),
                  /* @__PURE__ */ jsxDEV(
                    SessionSearchInline,
                    {
                      listSlot: /* @__PURE__ */ jsxDEV(
                        'div',
                        {
                          className: 'flex min-h-0 flex-1 flex-col',
                          children: renderRailContent(),
                        },
                        activeRailItem,
                        false,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 1585,
                          columnNumber: 11,
                        },
                        this
                      ),
                      footerSlot:
                        mode === 'agent' && archivedAgentSessionCount > 0
                          ? /* @__PURE__ */ jsxDEV(
                              'footer',
                              {
                                className: 'sidebar-footer',
                                children: /* @__PURE__ */ jsxDEV(
                                  Popover,
                                  {
                                    children: [
                                      /* @__PURE__ */ jsxDEV(
                                        PopoverTrigger,
                                        {
                                          asChild: true,
                                          children: /* @__PURE__ */ jsxDEV(
                                            'button',
                                            {
                                              type: 'button',
                                              className: 'sidebar-footer-btn titlebar-no-drag',
                                              'aria-label': `å·²å½æ¡£ ${archivedAgentSessionCount}`,
                                              children: [
                                                /* @__PURE__ */ jsxDEV(
                                                  Archive,
                                                  {
                                                    size: 12,
                                                    strokeWidth: 1.75,
                                                    className: 'opacity-70',
                                                    'aria-hidden': true,
                                                  },
                                                  void 0,
                                                  false,
                                                  {
                                                    fileName:
                                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                    lineNumber: 1599,
                                                    columnNumber: 25,
                                                  },
                                                  this
                                                ),
                                                /* @__PURE__ */ jsxDEV(
                                                  'span',
                                                  { children: 'å·²å½æ¡£' },
                                                  void 0,
                                                  false,
                                                  {
                                                    fileName:
                                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                    lineNumber: 1600,
                                                    columnNumber: 25,
                                                  },
                                                  this
                                                ),
                                                /* @__PURE__ */ jsxDEV(
                                                  'span',
                                                  {
                                                    className: 'sidebar-footer-count',
                                                    children: archivedAgentSessionCount,
                                                  },
                                                  void 0,
                                                  false,
                                                  {
                                                    fileName:
                                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                    lineNumber: 1601,
                                                    columnNumber: 25,
                                                  },
                                                  this
                                                ),
                                              ],
                                            },
                                            void 0,
                                            true,
                                            {
                                              fileName:
                                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                              lineNumber: 1594,
                                              columnNumber: 23,
                                            },
                                            this
                                          ),
                                        },
                                        void 0,
                                        false,
                                        {
                                          fileName:
                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                          lineNumber: 1593,
                                          columnNumber: 21,
                                        },
                                        this
                                      ),
                                      /* @__PURE__ */ jsxDEV(
                                        PopoverContent,
                                        {
                                          side: 'top',
                                          align: 'start',
                                          sideOffset: 6,
                                          className: 'w-72 p-0 overflow-hidden',
                                          onOpenAutoFocus: (e) => e.preventDefault(),
                                          children: [
                                            /* @__PURE__ */ jsxDEV(
                                              'div',
                                              {
                                                className:
                                                  'flex items-center justify-between px-2.5 py-1.5 border-b border-border/40',
                                                children: /* @__PURE__ */ jsxDEV(
                                                  'span',
                                                  {
                                                    className:
                                                      'text-[11px] font-medium text-foreground/50 uppercase tracking-wide',
                                                    children: [
                                                      'å·²å½æ¡£ä¼è¯ Â· ',
                                                      archivedAgentSessionCount,
                                                    ],
                                                  },
                                                  void 0,
                                                  true,
                                                  {
                                                    fileName:
                                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                    lineNumber: 1612,
                                                    columnNumber: 25,
                                                  },
                                                  this
                                                ),
                                              },
                                              void 0,
                                              false,
                                              {
                                                fileName:
                                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                lineNumber: 1611,
                                                columnNumber: 23,
                                              },
                                              this
                                            ),
                                            /* @__PURE__ */ jsxDEV(
                                              'div',
                                              {
                                                className:
                                                  'max-h-[60vh] overflow-y-auto scrollbar-autohide p-1',
                                                children:
                                                  archivedAgentSessionsList.length === 0
                                                    ? /* @__PURE__ */ jsxDEV(
                                                        'div',
                                                        {
                                                          className:
                                                            'py-3 text-center text-[12px] text-foreground/40',
                                                          children: 'ææ å·²å½æ¡£ä¼è¯',
                                                        },
                                                        void 0,
                                                        false,
                                                        {
                                                          fileName:
                                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                          lineNumber: 1618,
                                                          columnNumber: 19,
                                                        },
                                                        this
                                                      )
                                                    : /* @__PURE__ */ jsxDEV(
                                                        'div',
                                                        {
                                                          className: 'flex flex-col gap-0.5',
                                                          children: archivedAgentSessionsList.map(
                                                            (session) =>
                                                              /* @__PURE__ */ jsxDEV(
                                                                AgentSessionItem,
                                                                {
                                                                  session,
                                                                  active:
                                                                    session.id === activeSessionId,
                                                                  indicatorStatus:
                                                                    agentIndicatorMap.get(
                                                                      session.id
                                                                    ) ?? 'idle',
                                                                  modelName: sessionModelMap.get(
                                                                    session.id
                                                                  )
                                                                    ? resolveModelDisplayName(
                                                                        sessionModelMap.get(
                                                                          session.id
                                                                        ),
                                                                        channels
                                                                      )
                                                                    : void 0,
                                                                  leftAccent: getSessionLeftAccent(
                                                                    agentIndicatorMap.get(
                                                                      session.id
                                                                    ) ?? 'idle',
                                                                    session.id === activeSessionId,
                                                                    session.manualWorking
                                                                  ),
                                                                  workspaceName: session.workspaceId
                                                                    ? workspaceNameMap.get(
                                                                        session.workspaceId
                                                                      )
                                                                    : void 0,
                                                                  onSelect:
                                                                    handleSelectAgentSession,
                                                                  onRequestDelete:
                                                                    handleRequestDelete,
                                                                  onRename: handleAgentRename,
                                                                  onTogglePin: handleTogglePinAgent,
                                                                  onToggleArchive:
                                                                    handleToggleArchiveAgent,
                                                                  disableMiniMap: true,
                                                                  surface: 'compact',
                                                                },
                                                                session.id,
                                                                false,
                                                                {
                                                                  fileName:
                                                                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                                  lineNumber: 1624,
                                                                  columnNumber: 21,
                                                                },
                                                                this
                                                              )
                                                          ),
                                                        },
                                                        void 0,
                                                        false,
                                                        {
                                                          fileName:
                                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                          lineNumber: 1622,
                                                          columnNumber: 19,
                                                        },
                                                        this
                                                      ),
                                              },
                                              void 0,
                                              false,
                                              {
                                                fileName:
                                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                lineNumber: 1616,
                                                columnNumber: 23,
                                              },
                                              this
                                            ),
                                          ],
                                        },
                                        void 0,
                                        true,
                                        {
                                          fileName:
                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                          lineNumber: 1604,
                                          columnNumber: 21,
                                        },
                                        this
                                      ),
                                    ],
                                  },
                                  void 0,
                                  true,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 1592,
                                    columnNumber: 19,
                                  },
                                  this
                                ),
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 1591,
                                columnNumber: 11,
                              },
                              this
                            )
                          : null,
                    },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1583,
                      columnNumber: 11,
                    },
                    this
                  ),
                ],
              },
              void 0,
              true,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 1556,
                columnNumber: 7,
              },
              this
            )
          : activeRailItem === 'draft'
            ? /* @__PURE__ */ jsxDEV(
                'div',
                {
                  className: 'sidebar-inner',
                  children: [
                    /* @__PURE__ */ jsxDEV(
                      'div',
                      {
                        className: 'sidebar-head titlebar-no-drag',
                        children: [
                          /* @__PURE__ */ jsxDEV(
                            'div',
                            {
                              className: 'sidebar-head-copy',
                              children: [
                                /* @__PURE__ */ jsxDEV(
                                  'span',
                                  { className: 'sidebar-section-kicker', children: 'DRAFTS' },
                                  void 0,
                                  false,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 1670,
                                    columnNumber: 15,
                                  },
                                  this
                                ),
                                /* @__PURE__ */ jsxDEV(
                                  'h2',
                                  { className: 'sidebar-head-title', children: 'èç¨¿' },
                                  void 0,
                                  false,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 1671,
                                    columnNumber: 15,
                                  },
                                  this
                                ),
                              ],
                            },
                            void 0,
                            true,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 1669,
                              columnNumber: 13,
                            },
                            this
                          ),
                          /* @__PURE__ */ jsxDEV(
                            'div',
                            {
                              className: 'tool-cluster',
                              role: 'group',
                              'aria-label': 'èç¨¿æä½',
                              children: [
                                /* @__PURE__ */ jsxDEV(
                                  'button',
                                  {
                                    type: 'button',
                                    className: 'tool-cluster-icon',
                                    onClick: () => setNavigationSidebarOpen(false),
                                    'aria-label': 'æå ä¾§æ ',
                                    title: 'æå ä¾§æ ',
                                    children: /* @__PURE__ */ jsxDEV(
                                      PanelLeftClose,
                                      { size: 14, strokeWidth: 1.75, 'aria-hidden': 'true' },
                                      void 0,
                                      false,
                                      {
                                        fileName:
                                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                        lineNumber: 1681,
                                        columnNumber: 17,
                                      },
                                      this
                                    ),
                                  },
                                  void 0,
                                  false,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 1674,
                                    columnNumber: 15,
                                  },
                                  this
                                ),
                                /* @__PURE__ */ jsxDEV(
                                  'button',
                                  {
                                    type: 'button',
                                    className: 'tool-cluster-accent',
                                    onClick: handleNewDraft,
                                    title: 'æ°å»ºèç¨¿',
                                    children: 'æ°èç¨¿',
                                  },
                                  void 0,
                                  false,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 1683,
                                    columnNumber: 15,
                                  },
                                  this
                                ),
                              ],
                            },
                            void 0,
                            true,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 1673,
                              columnNumber: 13,
                            },
                            this
                          ),
                        ],
                      },
                      void 0,
                      true,
                      {
                        fileName:
                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                        lineNumber: 1668,
                        columnNumber: 11,
                      },
                      this
                    ),
                    /* @__PURE__ */ jsxDEV(
                      'button',
                      {
                        type: 'button',
                        className: 'sidebar-search-trigger titlebar-no-drag',
                        onClick: () => setDraftSearchOpen(true),
                        'aria-label': 'æç´¢èç¨¿',
                        children: [
                          /* @__PURE__ */ jsxDEV(
                            Search,
                            { size: 14, strokeWidth: 1.5, 'aria-hidden': 'true' },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 1700,
                              columnNumber: 13,
                            },
                            this
                          ),
                          /* @__PURE__ */ jsxDEV(
                            'span',
                            { children: 'æç´¢èç¨¿' },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 1701,
                              columnNumber: 13,
                            },
                            this
                          ),
                          /* @__PURE__ */ jsxDEV(
                            'kbd',
                            { children: isMac ? 'â K' : 'Ctrl K' },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 1702,
                              columnNumber: 13,
                            },
                            this
                          ),
                        ],
                      },
                      void 0,
                      true,
                      {
                        fileName:
                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                        lineNumber: 1694,
                        columnNumber: 11,
                      },
                      this
                    ),
                    /* @__PURE__ */ jsxDEV(
                      'div',
                      { className: 'flex min-h-0 flex-1 flex-col', children: renderRailContent() },
                      activeRailItem,
                      false,
                      {
                        fileName:
                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                        lineNumber: 1705,
                        columnNumber: 11,
                      },
                      this
                    ),
                  ],
                },
                void 0,
                true,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 1667,
                  columnNumber: 7,
                },
                this
              )
            : /* ä¸ä¼è¯/èç¨¿ä¸è´ï¼sidebar-inner æä¾ä¸å¤å±æµ®å²ç insetï¼list-well ä¸åå·¦å³è´´è¾¹ */
              /* @__PURE__ */ jsxDEV(
                'div',
                { className: 'sidebar-inner', children: renderRailContent() },
                activeRailItem,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 1711,
                  columnNumber: 7,
                },
                this
              ),
        deleteDialog,
        projectDeleteDialog,
        batchDeleteDialog,
        /* @__PURE__ */ jsxDEV(
          DraftSearchDialog,
          {},
          void 0,
          false,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1721,
            columnNumber: 7,
          },
          this
        ),
      ],
    },
    void 0,
    true,
    {
      fileName: 'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      lineNumber: 1549,
      columnNumber: 5,
    },
    this
  )
}
_s(LeftSidebar, '4Y+Z+QQ+Dd54NZFD+PXE9DtZ+/Q=', false, function () {
  return [
    useAtom,
    useSetAtom,
    useSetAtom,
    useAtom,
    useAtomValue,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useAtom,
    useAtomValue,
    useAtomValue,
    useAtomValue,
    useAtomValue,
    useAtomValue,
    useAtomValue,
    useSetAtom,
    useAtom,
    useSetAtom,
    useSetAtom,
    useAtomValue,
    useAtom,
    useAtom,
    useAtom,
    useAtomValue,
    useAtomValue,
    useSetAtom,
    useAtomValue,
    useAtomValue,
    useAtomValue,
    useAtomValue,
    useSetAtom,
    useAtom,
    useWorkspaceActions,
    useAtomValue,
    useAtom,
    useAtom,
    useAtomValue,
    useOpenSession,
    useSyncActiveTabSideEffects,
    useStore,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
    useSetAtom,
  ]
})
_c3 = LeftSidebar
function SessionsRailContent({
  activeSessionId,
  agentProjectGroups,
  agentIndicatorMap,
  sessionModelMap,
  channels,
  collapsedWorkspaceIds,
  setCollapsedWorkspaceIds,
  currentWorkspaceId,
  pinnedAgentSessions,
  handleRequestDelete,
  handleSelectAgentSession,
  handleAgentRename,
  handleTogglePinAgent,
  handleToggleArchiveAgent,
  workspaceNameMap,
  selectWorkspace,
  handleNewSessionInWorkspace,
  onRenameWorkspace,
  onRequestDeleteWorkspace,
  dragProjectId,
  projectDropIndicator,
  onProjectDragStart,
  onProjectDragOver,
  onProjectDragLeave,
  onProjectDrop,
  onProjectDragEnd,
  batchSelectWorkspaceId,
  batchSelectedSessionIds,
  onEnterBatchSelect,
  onExitBatchSelect,
  onToggleBatchSelect,
  onBatchUpdateSelected,
  onRequestBatchDelete,
  onConfirmBatchDelete,
  onCreateProject,
}) {
  _s2()
  const store = useStore()
  const toggleCollapsed = React.useCallback(
    (workspaceId) => {
      setCollapsedWorkspaceIds((prev) => {
        const next = new Set(prev)
        if (next.has(workspaceId)) next.delete(workspaceId)
        else next.add(workspaceId)
        return next
      })
    },
    [setCollapsedWorkspaceIds]
  )
  const handleRenameWorkspace = onRenameWorkspace
  const handleRequestDeleteWorkspace = onRequestDeleteWorkspace
  const handleConfigureProject = React.useCallback(
    (workspaceId) => {
      selectWorkspace(workspaceId)
      store.set(activeRailItemAtom, 'skills')
    },
    [selectWorkspace, store]
  )
  const listRef = React.useRef(null)
  return /* @__PURE__ */ jsxDEV(
    'div',
    {
      className: 'app-spatial-session-well list-well session-well flex-1 min-h-0 titlebar-no-drag',
      children: [
        /* @__PURE__ */ jsxDEV(
          'div',
          {
            className: 'group-label shrink-0',
            children: [
              /* @__PURE__ */ jsxDEV(
                'span',
                { children: 'é¡¹ç®' },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 1833,
                  columnNumber: 9,
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                Tooltip,
                {
                  children: [
                    /* @__PURE__ */ jsxDEV(
                      TooltipTrigger,
                      {
                        asChild: true,
                        children: /* @__PURE__ */ jsxDEV(
                          'button',
                          {
                            type: 'button',
                            className: 'ghost-plus opacity-100',
                            onClick: () => void onCreateProject(),
                            'aria-label': 'æ°å»ºé¡¹ç®',
                            children: '+',
                          },
                          void 0,
                          false,
                          {
                            fileName:
                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                            lineNumber: 1836,
                            columnNumber: 13,
                          },
                          this
                        ),
                      },
                      void 0,
                      false,
                      {
                        fileName:
                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                        lineNumber: 1835,
                        columnNumber: 11,
                      },
                      this
                    ),
                    /* @__PURE__ */ jsxDEV(
                      TooltipContent,
                      { side: 'top', children: 'éæ©ç®å½æ°å»ºé¡¹ç®' },
                      void 0,
                      false,
                      {
                        fileName:
                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                        lineNumber: 1845,
                        columnNumber: 11,
                      },
                      this
                    ),
                  ],
                },
                void 0,
                true,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 1834,
                  columnNumber: 9,
                },
                this
              ),
            ],
          },
          void 0,
          true,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1832,
            columnNumber: 7,
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          'div',
          {
            ref: listRef,
            className: 'session-scroll scrollbar-autohide min-h-0 relative',
            children: [
              pinnedAgentSessions.length > 0 &&
                /* @__PURE__ */ jsxDEV(
                  'div',
                  {
                    className: 'session-group',
                    children: [
                      /* @__PURE__ */ jsxDEV(
                        'div',
                        {
                          className: 'group-label',
                          children: /* @__PURE__ */ jsxDEV(
                            'span',
                            { children: 'ç½®é¡¶' },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 1853,
                              columnNumber: 15,
                            },
                            this
                          ),
                        },
                        void 0,
                        false,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 1852,
                          columnNumber: 13,
                        },
                        this
                      ),
                      /* @__PURE__ */ jsxDEV(
                        'div',
                        {
                          className: 'flex flex-col',
                          children: pinnedAgentSessions.map((session) =>
                            /* @__PURE__ */ jsxDEV(
                              AgentSessionItem,
                              {
                                session,
                                active: session.id === activeSessionId,
                                indicatorStatus: agentIndicatorMap.get(session.id) ?? 'idle',
                                modelName: sessionModelMap.get(session.id)
                                  ? resolveModelDisplayName(
                                      sessionModelMap.get(session.id),
                                      channels
                                    )
                                  : void 0,
                                leftAccent: getSessionLeftAccent(
                                  agentIndicatorMap.get(session.id) ?? 'idle',
                                  session.id === activeSessionId,
                                  session.manualWorking
                                ),
                                workspaceName: session.workspaceId
                                  ? workspaceNameMap.get(session.workspaceId)
                                  : void 0,
                                onSelect: handleSelectAgentSession,
                                onRequestDelete: handleRequestDelete,
                                onRename: handleAgentRename,
                                onTogglePin: handleTogglePinAgent,
                                onToggleArchive: handleToggleArchiveAgent,
                                disableMiniMap: true,
                              },
                              session.id,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 1857,
                                columnNumber: 13,
                              },
                              this
                            )
                          ),
                        },
                        void 0,
                        false,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 1855,
                          columnNumber: 13,
                        },
                        this
                      ),
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 1851,
                    columnNumber: 9,
                  },
                  this
                ),
              agentProjectGroups.length === 0
                ? /* @__PURE__ */ jsxDEV(
                    'div',
                    {
                      className: 'px-2 py-2 text-[11px] text-foreground/30 text-center select-none',
                      children: 'ææ é¡¹ç®',
                    },
                    void 0,
                    false,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 1888,
                      columnNumber: 9,
                    },
                    this
                  )
                : null,
              agentProjectGroups.length > 0
                ? agentProjectGroups.map((group) =>
                    /* @__PURE__ */ jsxDEV(
                      AgentProjectGroupItem,
                      {
                        group,
                        currentWorkspaceId,
                        collapsed: collapsedWorkspaceIds.has(group.workspace.id),
                        activeSessionId,
                        agentIndicatorMap,
                        sessionModelMap,
                        channels,
                        workspaceNameMap,
                        onSelectProject: (id) => {
                          selectWorkspace(id)
                          toggleCollapsed(id)
                        },
                        onNewSession: handleNewSessionInWorkspace,
                        onRenameWorkspace: handleRenameWorkspace,
                        onRequestDeleteWorkspace: handleRequestDeleteWorkspace,
                        onConfigureProject: handleConfigureProject,
                        onSelectSession: handleSelectAgentSession,
                        handleRequestDelete,
                        handleAgentRename,
                        handleTogglePinAgent,
                        handleToggleArchiveAgent,
                        dragProjectId,
                        projectDropIndicator,
                        onProjectDragStart,
                        onProjectDragOver,
                        onProjectDragLeave,
                        onProjectDrop,
                        onProjectDragEnd,
                        batchSelectWorkspaceId,
                        batchSelectedSessionIds,
                        onEnterBatchSelect,
                        onExitBatchSelect,
                        onToggleBatchSelect,
                        onBatchUpdateSelected,
                        onRequestBatchDelete,
                        onConfirmBatchDelete,
                      },
                      group.workspace.id,
                      false,
                      {
                        fileName:
                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                        lineNumber: 1895,
                        columnNumber: 9,
                      },
                      this
                    )
                  )
                : null,
            ],
          },
          void 0,
          true,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 1848,
            columnNumber: 7,
          },
          this
        ),
      ],
    },
    void 0,
    true,
    {
      fileName: 'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      lineNumber: 1831,
      columnNumber: 5,
    },
    this
  )
}
_s2(SessionsRailContent, '+MKh1B8tw/YeftcoakFeOPMQtEs=', false, function () {
  return [useStore]
})
_c4 = SessionsRailContent
function SkillsRailContent({ capabilities }) {
  return /* @__PURE__ */ jsxDEV(
    PluginSidebarNav,
    { capabilities },
    void 0,
    false,
    {
      fileName: 'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      lineNumber: 1947,
      columnNumber: 10,
    },
    this
  )
}
_c5 = SkillsRailContent
const ConversationItem = _s3(
  React.memo(
    (_c6 = _s3(
      function ConversationItem2({
        conversation,
        active,
        streaming,
        showPinIcon,
        onSelect,
        onRequestDelete,
        onRename,
        onTogglePin,
        onToggleArchive,
      }) {
        _s3()
        const [editing, setEditing] = React.useState(false)
        const [editTitle, setEditTitle] = React.useState('')
        const [menuOpen, setMenuOpen] = React.useState(false)
        const inputRef = React.useRef(null)
        const justStartedEditing = React.useRef(false)
        const preview = useSessionMiniMapHover(300, menuOpen)
        const startEdit = () => {
          setEditTitle(conversation.title)
          setEditing(true)
          justStartedEditing.current = true
          setTimeout(() => {
            justStartedEditing.current = false
            inputRef.current?.focus()
            inputRef.current?.select()
          }, 300)
        }
        const saveTitle = async () => {
          if (justStartedEditing.current) return
          const trimmed = editTitle.trim()
          if (!trimmed || trimmed === conversation.title) {
            setEditing(false)
            return
          }
          await onRename(conversation.id, trimmed)
          setEditing(false)
        }
        const handleKeyDown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            saveTitle()
          } else if (e.key === 'Escape') {
            setEditing(false)
          }
        }
        const isPinned = !!conversation.pinned
        const menuItems = (MenuItem, MenuSeparator) =>
          /* @__PURE__ */ jsxDEV(
            Fragment,
            {
              children: [
                /* @__PURE__ */ jsxDEV(
                  MenuItem,
                  {
                    className: 'text-xs py-1 [&>svg]:size-3.5',
                    onSelect: () => onTogglePin(conversation.id),
                    children: [
                      isPinned
                        ? /* @__PURE__ */ jsxDEV(
                            PinOff,
                            { size: 14 },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2033,
                              columnNumber: 21,
                            },
                            this
                          )
                        : /* @__PURE__ */ jsxDEV(
                            Pin,
                            { size: 14 },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2033,
                              columnNumber: 44,
                            },
                            this
                          ),
                      isPinned ? 'åæ¶ç½®é¡¶' : 'ç½®é¡¶å¯¹è¯',
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2029,
                    columnNumber: 7,
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  MenuItem,
                  {
                    className: 'text-xs py-1 [&>svg]:size-3.5',
                    onSelect: () => startEdit(),
                    children: [
                      /* @__PURE__ */ jsxDEV(
                        Pencil,
                        { size: 14 },
                        void 0,
                        false,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 2037,
                          columnNumber: 9,
                        },
                        this
                      ),
                      'éå½å',
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2036,
                    columnNumber: 7,
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  MenuItem,
                  {
                    className: 'text-xs py-1 [&>svg]:size-3.5',
                    onSelect: () => onToggleArchive(conversation.id),
                    children: [
                      conversation.archived
                        ? /* @__PURE__ */ jsxDEV(
                            ArchiveRestore,
                            { size: 14 },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2044,
                              columnNumber: 34,
                            },
                            this
                          )
                        : /* @__PURE__ */ jsxDEV(
                            Archive,
                            { size: 14 },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2044,
                              columnNumber: 65,
                            },
                            this
                          ),
                      conversation.archived ? 'åæ¶å½æ¡£' : 'å½æ¡£',
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2040,
                    columnNumber: 7,
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  MenuSeparator,
                  { className: 'my-0.5' },
                  void 0,
                  false,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2047,
                    columnNumber: 7,
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  MenuItem,
                  {
                    className: 'text-xs py-1 [&>svg]:size-3.5 text-destructive',
                    onSelect: () => onRequestDelete(conversation.id),
                    children: [
                      /* @__PURE__ */ jsxDEV(
                        Trash2,
                        { size: 14 },
                        void 0,
                        false,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 2052,
                          columnNumber: 9,
                        },
                        this
                      ),
                      'å é¤å¯¹è¯',
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2048,
                    columnNumber: 7,
                  },
                  this
                ),
              ],
            },
            void 0,
            true,
            {
              fileName:
                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
              lineNumber: 2028,
              columnNumber: 3,
            },
            this
          )
        return /* @__PURE__ */ jsxDEV(
          ContextMenu,
          {
            children: [
              /* @__PURE__ */ jsxDEV(
                ContextMenuTrigger,
                {
                  asChild: true,
                  children: /* @__PURE__ */ jsxDEV(
                    'div',
                    {
                      ref: preview.setAnchorRef,
                      role: 'button',
                      tabIndex: 0,
                      'data-actions-open': menuOpen ? '' : void 0,
                      onClick: () => onSelect(conversation.id, conversation.title),
                      onMouseEnter: preview.handleMouseEnter,
                      onMouseLeave: preview.handleMouseLeave,
                      onDoubleClick: (e) => {
                        e.stopPropagation()
                        startEdit()
                      },
                      className: cn(
                        'session-list-row group relative w-full px-3 py-[7px] titlebar-no-drag text-left',
                        active ? 'session-list-item-active' : 'rounded-xl'
                      ),
                      children: [
                        streaming &&
                          /* @__PURE__ */ jsxDEV(
                            'span',
                            {
                              className: 'session-status-line tab-status-streaming',
                              'aria-hidden': 'true',
                            },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2080,
                              columnNumber: 11,
                            },
                            this
                          ),
                        /* @__PURE__ */ jsxDEV(
                          'div',
                          {
                            className: 'flex-1 min-w-0',
                            children: editing
                              ? /* @__PURE__ */ jsxDEV(
                                  'input',
                                  {
                                    ref: inputRef,
                                    value: editTitle,
                                    onChange: (e) => setEditTitle(e.target.value),
                                    onKeyDown: handleKeyDown,
                                    onBlur: saveTitle,
                                    onClick: (e) => e.stopPropagation(),
                                    className:
                                      'w-full bg-transparent text-[13px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0',
                                    maxLength: 100,
                                  },
                                  void 0,
                                  false,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 2084,
                                    columnNumber: 13,
                                  },
                                  this
                                )
                              : /* @__PURE__ */ jsxDEV(
                                  'div',
                                  {
                                    className: cn(
                                      'flex w-full min-w-0 max-w-full items-center gap-1.5 overflow-hidden pr-2 text-[13px] leading-5',
                                      active ? 'session-row-title' : 'text-foreground/80'
                                    ),
                                    children: [
                                      showPinIcon &&
                                        /* @__PURE__ */ jsxDEV(
                                          Pin,
                                          { size: 11, className: 'flex-shrink-0 text-primary/60' },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2102,
                                            columnNumber: 33,
                                          },
                                          this
                                        ),
                                      /* @__PURE__ */ jsxDEV(
                                        ChatsCircle,
                                        {
                                          size: 13,
                                          weight: 'regular',
                                          className: cn(
                                            'flex-shrink-0',
                                            active ? 'opacity-80' : 'opacity-45'
                                          ),
                                        },
                                        void 0,
                                        false,
                                        {
                                          fileName:
                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                          lineNumber: 2103,
                                          columnNumber: 17,
                                        },
                                        this
                                      ),
                                      /* @__PURE__ */ jsxDEV(
                                        'span',
                                        {
                                          className: 'session-row-title-text',
                                          title: conversation.title,
                                          children: conversation.title,
                                        },
                                        void 0,
                                        false,
                                        {
                                          fileName:
                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                          lineNumber: 2108,
                                          columnNumber: 17,
                                        },
                                        this
                                      ),
                                    ],
                                  },
                                  void 0,
                                  true,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 2095,
                                    columnNumber: 13,
                                  },
                                  this
                                ),
                          },
                          void 0,
                          false,
                          {
                            fileName:
                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                            lineNumber: 2082,
                            columnNumber: 11,
                          },
                          this
                        ),
                        !editing &&
                          /* @__PURE__ */ jsxDEV(
                            'div',
                            {
                              className: 'flex-shrink-0',
                              onClick: (e) => e.stopPropagation(),
                              children: /* @__PURE__ */ jsxDEV(
                                DropdownMenu,
                                {
                                  open: menuOpen,
                                  onOpenChange: setMenuOpen,
                                  children: [
                                    /* @__PURE__ */ jsxDEV(
                                      DropdownMenuTrigger,
                                      {
                                        asChild: true,
                                        children: /* @__PURE__ */ jsxDEV(
                                          'button',
                                          {
                                            className: cn(
                                              'p-1 rounded-md text-foreground/30 hover:bg-foreground/[0.08] hover:text-foreground/60 transition-colors',
                                              'opacity-0 pointer-events-none',
                                              'group-hover:opacity-100 group-hover:pointer-events-auto',
                                              'data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto'
                                            ),
                                            children: /* @__PURE__ */ jsxDEV(
                                              MoreVertical,
                                              { size: 14 },
                                              void 0,
                                              false,
                                              {
                                                fileName:
                                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                lineNumber: 2128,
                                                columnNumber: 21,
                                              },
                                              this
                                            ),
                                          },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2120,
                                            columnNumber: 19,
                                          },
                                          this
                                        ),
                                      },
                                      void 0,
                                      false,
                                      {
                                        fileName:
                                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                        lineNumber: 2119,
                                        columnNumber: 17,
                                      },
                                      this
                                    ),
                                    /* @__PURE__ */ jsxDEV(
                                      DropdownMenuContent,
                                      {
                                        align: 'start',
                                        className: 'w-40 z-[9999] min-w-0 p-0.5',
                                        children: menuItems(
                                          DropdownMenuItem,
                                          DropdownMenuSeparator
                                        ),
                                      },
                                      void 0,
                                      false,
                                      {
                                        fileName:
                                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                        lineNumber: 2131,
                                        columnNumber: 17,
                                      },
                                      this
                                    ),
                                  ],
                                },
                                void 0,
                                true,
                                {
                                  fileName:
                                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                  lineNumber: 2118,
                                  columnNumber: 15,
                                },
                                this
                              ),
                            },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2117,
                              columnNumber: 11,
                            },
                            this
                          ),
                      ],
                    },
                    void 0,
                    true,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 2061,
                      columnNumber: 9,
                    },
                    this
                  ),
                },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 2060,
                  columnNumber: 7,
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                ContextMenuContent,
                {
                  className: 'w-40 z-[9999] min-w-0 p-0.5',
                  children: menuItems(ContextMenuItem, ContextMenuSeparator),
                },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 2139,
                  columnNumber: 7,
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                SessionMiniMapPopover,
                {
                  target: {
                    type: 'agent',
                    // P3: chat å·²éå½¹ï¼æ­¤ç»ä»¶ä¸ºéçä»£ç 
                    sessionId: conversation.id,
                    title: conversation.title,
                  },
                  anchorRef: preview.anchorRef,
                  open: preview.isOpen,
                  isLeaving: preview.isLeaving,
                  onMouseEnter: preview.handlePanelMouseEnter,
                  onMouseLeave: preview.handlePanelMouseLeave,
                },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 2142,
                  columnNumber: 7,
                },
                this
              ),
            ],
          },
          void 0,
          true,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 2059,
            columnNumber: 5,
          },
          this
        )
      },
      'dgQcrRhTTBhI9dDDIDYSnMhlwvE=',
      false,
      function () {
        return [useSessionMiniMapHover]
      }
    ))
  ),
  'dgQcrRhTTBhI9dDDIDYSnMhlwvE=',
  false,
  function () {
    return [useSessionMiniMapHover]
  }
)
_c7 = ConversationItem
function formatSessionTime(updatedAt) {
  const date = new Date(updatedAt)
  const now = /* @__PURE__ */ new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 864e5
  const pad = (n) => n.toString().padStart(2, '0')
  if (updatedAt >= todayStart) {
    return `ä»å¤© ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  if (updatedAt >= yesterdayStart) {
    return `æ¨å¤© ${pad(date.getHours())}:${pad(date.getMinutes())}`
  }
  return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}
const AgentSessionItem = _s4(
  React.memo(
    (_c8 = _s4(
      function AgentSessionItem2({
        session,
        active,
        indicatorStatus,
        leftAccent,
        modelName,
        disableMiniMap,
        workspaceName,
        childClassName,
        surface = 'well',
        isBatchMode = false,
        isBatchSelected = false,
        onToggleBatchSelect,
        onSelect,
        onRequestDelete,
        onRename,
        onTogglePin,
        onToggleArchive,
      }) {
        _s4()
        const [editing, setEditing] = React.useState(false)
        const [editTitle, setEditTitle] = React.useState('')
        const [menuOpen, setMenuOpen] = React.useState(false)
        const inputRef = React.useRef(null)
        const justStartedEditing = React.useRef(false)
        const preview = useSessionMiniMapHover(300, disableMiniMap || menuOpen || isBatchMode)
        const startEdit = () => {
          setEditTitle(session.title)
          setEditing(true)
          justStartedEditing.current = true
          setTimeout(() => {
            justStartedEditing.current = false
            inputRef.current?.focus()
            inputRef.current?.select()
          }, 300)
        }
        const saveTitle = async () => {
          if (justStartedEditing.current) return
          const trimmed = editTitle.trim()
          if (!trimmed || trimmed === session.title) {
            setEditing(false)
            return
          }
          await onRename(session.id, trimmed)
          setEditing(false)
        }
        const handleKeyDown = (e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            saveTitle()
          } else if (e.key === 'Escape') {
            setEditing(false)
          }
        }
        const menuItems = (MenuItem, MenuSeparator) =>
          /* @__PURE__ */ jsxDEV(
            Fragment,
            {
              children: [
                /* @__PURE__ */ jsxDEV(
                  MenuItem,
                  {
                    className: 'text-xs py-1 [&>svg]:size-3.5',
                    onSelect: () => onTogglePin(session.id),
                    children: [
                      session.pinned
                        ? /* @__PURE__ */ jsxDEV(
                            PinOff,
                            { size: 14 },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2274,
                              columnNumber: 27,
                            },
                            this
                          )
                        : /* @__PURE__ */ jsxDEV(
                            Pin,
                            { size: 14 },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2274,
                              columnNumber: 50,
                            },
                            this
                          ),
                      session.pinned ? 'åæ¶ç½®é¡¶' : 'ç½®é¡¶ä¼è¯',
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2273,
                    columnNumber: 7,
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  MenuItem,
                  {
                    className: 'text-xs py-1 [&>svg]:size-3.5',
                    onSelect: () => startEdit(),
                    children: [
                      /* @__PURE__ */ jsxDEV(
                        Pencil,
                        { size: 14 },
                        void 0,
                        false,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 2278,
                          columnNumber: 9,
                        },
                        this
                      ),
                      'éå½å',
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2277,
                    columnNumber: 7,
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  MenuItem,
                  {
                    className: 'text-xs py-1 [&>svg]:size-3.5',
                    onSelect: () => onToggleArchive(session.id),
                    children: [
                      session.archived
                        ? /* @__PURE__ */ jsxDEV(
                            ArchiveRestore,
                            { size: 14 },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2285,
                              columnNumber: 29,
                            },
                            this
                          )
                        : /* @__PURE__ */ jsxDEV(
                            Archive,
                            { size: 14 },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2285,
                              columnNumber: 60,
                            },
                            this
                          ),
                      session.archived ? 'åæ¶å½æ¡£' : 'å½æ¡£',
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2281,
                    columnNumber: 7,
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  MenuSeparator,
                  { className: 'my-0.5' },
                  void 0,
                  false,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2288,
                    columnNumber: 7,
                  },
                  this
                ),
                /* @__PURE__ */ jsxDEV(
                  MenuItem,
                  {
                    className: 'text-xs py-1 [&>svg]:size-3.5 text-destructive',
                    onSelect: () => onRequestDelete(session.id),
                    children: [
                      /* @__PURE__ */ jsxDEV(
                        Trash2,
                        { size: 14 },
                        void 0,
                        false,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 2293,
                          columnNumber: 9,
                        },
                        this
                      ),
                      'å é¤ä¼è¯',
                    ],
                  },
                  void 0,
                  true,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2289,
                    columnNumber: 7,
                  },
                  this
                ),
              ],
            },
            void 0,
            true,
            {
              fileName:
                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
              lineNumber: 2272,
              columnNumber: 3,
            },
            this
          )
        const { selectionClassName, showRunningSweep, statusLineClass } =
          getAgentSessionVisualState({
            active,
            indicatorStatus,
            isBatchMode,
            isBatchSelected,
            leftAccent,
          })
        const hasIndicatorStatus =
          indicatorStatus === 'running' ||
          indicatorStatus === 'blocked' ||
          indicatorStatus === 'completed'
        const metaModelName = modelName?.trim() || 'æªéæ©æ¨¡å'
        const rowClassName = cn(
          'session-list-row group relative min-w-0 w-full max-w-full overflow-hidden titlebar-no-drag text-left',
          // session-row-shell å·²æ¯ flexï¼æ¹éæ¨¡å¼åªå æ è®°ä¸é´è·ï¼ä¸å !flex ç¡¬å
          isBatchMode && 'items-center gap-2',
          surface === 'well' && 'session-row-shell app-sidebar-session-row',
          surface === 'compact' && 'flex items-center gap-2 py-[7px] px-1',
          isBatchMode && 'session-list-row--batch',
          childClassName,
          selectionClassName
        )
        return /* @__PURE__ */ jsxDEV(
          ContextMenu,
          {
            children: [
              /* @__PURE__ */ jsxDEV(
                ContextMenuTrigger,
                {
                  asChild: true,
                  children: /* @__PURE__ */ jsxDEV(
                    'div',
                    {
                      ref: preview.setAnchorRef,
                      'data-session-list-id': session.id,
                      'data-actions-open': menuOpen ? '' : void 0,
                      role: 'button',
                      tabIndex: 0,
                      onClick: () => {
                        if (isBatchMode) {
                          onToggleBatchSelect?.(session.id)
                        } else {
                          onSelect(session.id, session.title)
                        }
                      },
                      onMouseEnter: preview.handleMouseEnter,
                      onMouseLeave: preview.handleMouseLeave,
                      onDoubleClick: (e) => {
                        e.stopPropagation()
                        startEdit()
                      },
                      className: rowClassName,
                      children: [
                        isBatchMode
                          ? /* @__PURE__ */ jsxDEV(
                              Fragment,
                              {
                                children: [
                                  /* @__PURE__ */ jsxDEV(
                                    'button',
                                    {
                                      type: 'button',
                                      onClick: (e) => {
                                        e.stopPropagation()
                                        onToggleBatchSelect?.(session.id)
                                      },
                                      className:
                                        'flex-shrink-0 w-[18px] flex items-center justify-center text-foreground/60 hover:text-foreground',
                                      'aria-label': isBatchSelected ? 'åæ¶éä¸­' : 'éä¸­',
                                      children: isBatchSelected
                                        ? /* @__PURE__ */ jsxDEV(
                                            CheckSquare,
                                            { className: 'size-3.5 text-primary' },
                                            void 0,
                                            false,
                                            {
                                              fileName:
                                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                              lineNumber: 2360,
                                              columnNumber: 15,
                                            },
                                            this
                                          )
                                        : /* @__PURE__ */ jsxDEV(
                                            Square,
                                            { className: 'size-3.5' },
                                            void 0,
                                            false,
                                            {
                                              fileName:
                                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                              lineNumber: 2362,
                                              columnNumber: 15,
                                            },
                                            this
                                          ),
                                    },
                                    void 0,
                                    false,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2350,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                  /* @__PURE__ */ jsxDEV(
                                    'div',
                                    {
                                      className:
                                        'flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden',
                                      children: [
                                        /* @__PURE__ */ jsxDEV(
                                          ChatsCircle,
                                          {
                                            size: 13,
                                            weight: 'regular',
                                            className: 'shrink-0 opacity-45',
                                          },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2366,
                                            columnNumber: 17,
                                          },
                                          this
                                        ),
                                        /* @__PURE__ */ jsxDEV(
                                          'span',
                                          {
                                            className:
                                              'session-row-title-text text-[12px] leading-[18px] text-foreground/80',
                                            children: session.title,
                                          },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2367,
                                            columnNumber: 17,
                                          },
                                          this
                                        ),
                                      ],
                                    },
                                    void 0,
                                    true,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2365,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                ],
                              },
                              void 0,
                              true,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2349,
                                columnNumber: 11,
                              },
                              this
                            )
                          : /* @__PURE__ */ jsxDEV(
                              Fragment,
                              {
                                children: [
                                  hasIndicatorStatus &&
                                    statusLineClass &&
                                    /* @__PURE__ */ jsxDEV(
                                      'span',
                                      {
                                        className: cn(
                                          'session-status-line agent-session-status-line',
                                          statusLineClass
                                        ),
                                        'aria-hidden': 'true',
                                      },
                                      void 0,
                                      false,
                                      {
                                        fileName:
                                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                        lineNumber: 2376,
                                        columnNumber: 13,
                                      },
                                      this
                                    ),
                                  showRunningSweep &&
                                    /* @__PURE__ */ jsxDEV(
                                      'span',
                                      {
                                        className: 'session-active-running-sweep',
                                        'aria-hidden': 'true',
                                      },
                                      void 0,
                                      false,
                                      {
                                        fileName:
                                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                        lineNumber: 2382,
                                        columnNumber: 13,
                                      },
                                      this
                                    ),
                                  /* @__PURE__ */ jsxDEV(
                                    'div',
                                    {
                                      className: 'min-w-0 flex-1 overflow-hidden',
                                      children: editing
                                        ? /* @__PURE__ */ jsxDEV(
                                            'input',
                                            {
                                              ref: inputRef,
                                              value: editTitle,
                                              onChange: (e) => setEditTitle(e.target.value),
                                              onKeyDown: handleKeyDown,
                                              onBlur: saveTitle,
                                              onClick: (e) => e.stopPropagation(),
                                              className:
                                                'w-full min-w-0 bg-transparent text-[12px] leading-5 text-foreground border-b border-primary/50 outline-none px-0 py-0',
                                              maxLength: 100,
                                            },
                                            void 0,
                                            false,
                                            {
                                              fileName:
                                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                              lineNumber: 2386,
                                              columnNumber: 15,
                                            },
                                            this
                                          )
                                        : /* @__PURE__ */ jsxDEV(
                                            'div',
                                            {
                                              className:
                                                'w-full min-w-0 max-w-full overflow-hidden',
                                              children: [
                                                /* @__PURE__ */ jsxDEV(
                                                  'div',
                                                  {
                                                    className: cn(
                                                      'session-row-actions-pad flex w-full min-w-0 max-w-full items-center gap-1.5 overflow-hidden pr-7 text-[12px] leading-[18px] transition-[padding] duration-150 group-hover:pr-4',
                                                      !active && 'text-foreground/80'
                                                    ),
                                                    children: [
                                                      /* @__PURE__ */ jsxDEV(
                                                        ChatsCircle,
                                                        {
                                                          size: 13,
                                                          weight: 'regular',
                                                          className: cn(
                                                            'flex-shrink-0',
                                                            active ? 'opacity-80' : 'opacity-45'
                                                          ),
                                                        },
                                                        void 0,
                                                        false,
                                                        {
                                                          fileName:
                                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                          lineNumber: 2404,
                                                          columnNumber: 23,
                                                        },
                                                        this
                                                      ),
                                                      /* @__PURE__ */ jsxDEV(
                                                        'span',
                                                        {
                                                          className: cn(
                                                            'session-row-title-text',
                                                            active && 'session-row-title'
                                                          ),
                                                          title: session.title,
                                                          children: session.title,
                                                        },
                                                        void 0,
                                                        false,
                                                        {
                                                          fileName:
                                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                          lineNumber: 2409,
                                                          columnNumber: 23,
                                                        },
                                                        this
                                                      ),
                                                    ],
                                                  },
                                                  void 0,
                                                  true,
                                                  {
                                                    fileName:
                                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                    lineNumber: 2398,
                                                    columnNumber: 21,
                                                  },
                                                  this
                                                ),
                                                /* @__PURE__ */ jsxDEV(
                                                  'div',
                                                  {
                                                    className: cn(
                                                      'app-sidebar-session-detail session-row-detail-pad mt-0.5 grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 overflow-hidden pl-5 pr-0 text-[9px] transition-[padding] duration-150 group-hover:pr-4',
                                                      active ? 'session-row-meta' : 'md-text-faint'
                                                    ),
                                                    children: [
                                                      /* @__PURE__ */ jsxDEV(
                                                        'span',
                                                        {
                                                          className: 'session-row-title-text',
                                                          title: metaModelName,
                                                          children: metaModelName,
                                                        },
                                                        void 0,
                                                        false,
                                                        {
                                                          fileName:
                                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                          lineNumber: 2425,
                                                          columnNumber: 23,
                                                        },
                                                        this
                                                      ),
                                                      /* @__PURE__ */ jsxDEV(
                                                        'span',
                                                        {
                                                          className: 'flex-shrink-0 tabular-nums',
                                                          children: formatSessionTime(
                                                            session.updatedAt
                                                          ),
                                                        },
                                                        void 0,
                                                        false,
                                                        {
                                                          fileName:
                                                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                          lineNumber: 2428,
                                                          columnNumber: 23,
                                                        },
                                                        this
                                                      ),
                                                    ],
                                                  },
                                                  void 0,
                                                  true,
                                                  {
                                                    fileName:
                                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                    lineNumber: 2419,
                                                    columnNumber: 21,
                                                  },
                                                  this
                                                ),
                                              ],
                                            },
                                            void 0,
                                            true,
                                            {
                                              fileName:
                                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                              lineNumber: 2397,
                                              columnNumber: 15,
                                            },
                                            this
                                          ),
                                    },
                                    void 0,
                                    false,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2384,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                ],
                              },
                              void 0,
                              true,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2373,
                                columnNumber: 11,
                              },
                              this
                            ),
                        !editing &&
                          !isBatchMode &&
                          /* @__PURE__ */ jsxDEV(
                            'div',
                            {
                              className: 'absolute right-1.5 top-1/2 -translate-y-1/2',
                              onClick: (e) => e.stopPropagation(),
                              children: /* @__PURE__ */ jsxDEV(
                                DropdownMenu,
                                {
                                  open: menuOpen,
                                  onOpenChange: setMenuOpen,
                                  children: [
                                    /* @__PURE__ */ jsxDEV(
                                      DropdownMenuTrigger,
                                      {
                                        asChild: true,
                                        children: /* @__PURE__ */ jsxDEV(
                                          'button',
                                          {
                                            className: cn(
                                              'p-1 rounded-md text-foreground/30 hover:bg-foreground/[0.08] hover:text-foreground/60 transition-colors',
                                              'opacity-0 pointer-events-none',
                                              'group-hover:opacity-100 group-hover:pointer-events-auto',
                                              'data-[state=open]:bg-foreground/[0.08] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto'
                                            ),
                                            children: /* @__PURE__ */ jsxDEV(
                                              MoreVertical,
                                              { size: 14 },
                                              void 0,
                                              false,
                                              {
                                                fileName:
                                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                                lineNumber: 2452,
                                                columnNumber: 21,
                                              },
                                              this
                                            ),
                                          },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2444,
                                            columnNumber: 19,
                                          },
                                          this
                                        ),
                                      },
                                      void 0,
                                      false,
                                      {
                                        fileName:
                                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                        lineNumber: 2443,
                                        columnNumber: 17,
                                      },
                                      this
                                    ),
                                    /* @__PURE__ */ jsxDEV(
                                      DropdownMenuContent,
                                      {
                                        align: 'start',
                                        className: 'w-40 z-[9999] min-w-0 p-0.5',
                                        children: menuItems(
                                          DropdownMenuItem,
                                          DropdownMenuSeparator
                                        ),
                                      },
                                      void 0,
                                      false,
                                      {
                                        fileName:
                                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                        lineNumber: 2455,
                                        columnNumber: 17,
                                      },
                                      this
                                    ),
                                  ],
                                },
                                void 0,
                                true,
                                {
                                  fileName:
                                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                  lineNumber: 2442,
                                  columnNumber: 15,
                                },
                                this
                              ),
                            },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2438,
                              columnNumber: 11,
                            },
                            this
                          ),
                      ],
                    },
                    void 0,
                    true,
                    {
                      fileName:
                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                      lineNumber: 2327,
                      columnNumber: 9,
                    },
                    this
                  ),
                },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 2326,
                  columnNumber: 7,
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                ContextMenuContent,
                {
                  className: 'w-40 z-[9999] min-w-0 p-0.5',
                  children: menuItems(ContextMenuItem, ContextMenuSeparator),
                },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 2463,
                  columnNumber: 7,
                },
                this
              ),
              !disableMiniMap &&
                /* @__PURE__ */ jsxDEV(
                  SessionMiniMapPopover,
                  {
                    target: {
                      type: 'agent',
                      sessionId: session.id,
                      title: session.title,
                      workspaceName,
                    },
                    anchorRef: preview.anchorRef,
                    open: preview.isOpen,
                    isLeaving: preview.isLeaving,
                    onMouseEnter: preview.handlePanelMouseEnter,
                    onMouseLeave: preview.handlePanelMouseLeave,
                  },
                  void 0,
                  false,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2467,
                    columnNumber: 7,
                  },
                  this
                ),
            ],
          },
          void 0,
          true,
          {
            fileName:
              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
            lineNumber: 2325,
            columnNumber: 5,
          },
          this
        )
      },
      'dgQcrRhTTBhI9dDDIDYSnMhlwvE=',
      false,
      function () {
        return [useSessionMiniMapHover]
      }
    ))
  ),
  'dgQcrRhTTBhI9dDDIDYSnMhlwvE=',
  false,
  function () {
    return [useSessionMiniMapHover]
  }
)
_c9 = AgentSessionItem
const AgentProjectGroupItem = _s5(
  React.memo(
    (_c0 = _s5(function AgentProjectGroupItem2({
      group,
      currentWorkspaceId,
      collapsed,
      activeSessionId,
      agentIndicatorMap,
      sessionModelMap,
      channels,
      workspaceNameMap,
      onSelectProject,
      onNewSession,
      onRenameWorkspace,
      onRequestDeleteWorkspace,
      onConfigureProject,
      onSelectSession,
      handleRequestDelete,
      handleAgentRename,
      handleTogglePinAgent,
      handleToggleArchiveAgent,
      dragProjectId,
      projectDropIndicator,
      onProjectDragStart,
      onProjectDragOver,
      onProjectDragLeave,
      onProjectDrop,
      onProjectDragEnd,
      batchSelectWorkspaceId,
      batchSelectedSessionIds,
      onEnterBatchSelect,
      onExitBatchSelect,
      onToggleBatchSelect,
      onBatchUpdateSelected,
      onRequestBatchDelete,
      onConfirmBatchDelete,
    }) {
      _s5()
      const isCurrent = group.workspace.id === currentWorkspaceId
      const [renaming, setRenaming] = React.useState(false)
      const [editName, setEditName] = React.useState('')
      const [menuOpen, setMenuOpen] = React.useState(false)
      const editRef = React.useRef(null)
      const justStartedRef = React.useRef(false)
      const handleStartRename = () => {
        setEditName(group.workspace.name)
        setRenaming(true)
        justStartedRef.current = true
        setTimeout(() => {
          justStartedRef.current = false
          editRef.current?.focus()
          editRef.current?.select()
        }, 300)
      }
      const handleCommitRename = async () => {
        if (justStartedRef.current) return
        const trimmed = editName.trim()
        if (!trimmed || trimmed === group.workspace.name) {
          setRenaming(false)
          return
        }
        await onRenameWorkspace(group.workspace.id, trimmed)
        setRenaming(false)
      }
      const handleRenameKeyDown = (e) => {
        if (e.key === 'Enter') {
          if (e.nativeEvent.isComposing) return
          e.preventDefault()
          void handleCommitRename()
        } else if (e.key === 'Escape') {
          setRenaming(false)
        }
      }
      const getStatus = (sessionId) => agentIndicatorMap.get(sessionId) ?? 'idle'
      const sortedSessions = React.useMemo(() => {
        const items = group.sessions.slice()
        items.sort((a, b) => {
          if (a.pinned && !b.pinned) return -1
          if (!a.pinned && b.pinned) return 1
          const pa = getStatus(a.id)
          const pb = getStatus(b.id)
          const paPriority = ACTIVE_SESSION_STATUS_PRIORITY[pa] ?? 99
          const pbPriority = ACTIVE_SESSION_STATUS_PRIORITY[pb] ?? 99
          if (paPriority !== pbPriority) return paPriority - pbPriority
          if (a.manualWorking && !b.manualWorking) return -1
          if (!a.manualWorking && b.manualWorking) return 1
          return b.updatedAt - a.updatedAt
        })
        return items
      }, [group.sessions])
      const hasActiveSession =
        !!activeSessionId && group.sessions.some((s) => s.id === activeSessionId)
      const isDragging = dragProjectId === group.workspace.id
      const isBatchMode = batchSelectWorkspaceId === group.workspace.id
      const batchSelectedCount = isBatchMode
        ? group.sessions.filter((s) => batchSelectedSessionIds.has(s.id)).length
        : 0
      const dropPosition =
        projectDropIndicator?.id === group.workspace.id ? projectDropIndicator.position : null
      const projectActionsActive = menuOpen
      return /* @__PURE__ */ jsxDEV(
        'section',
        {
          className: cn(
            'app-sidebar-project-block relative transition-opacity',
            isDragging && 'opacity-45'
          ),
          onDragOver: (e) => onProjectDragOver(e, group.workspace.id),
          onDragLeave: onProjectDragLeave,
          onDrop: (e) => onProjectDrop(e, group.workspace.id),
          onDragEnd: onProjectDragEnd,
          children: [
            dropPosition === 'before' &&
              /* @__PURE__ */ jsxDEV(
                'div',
                {
                  className: 'absolute -top-0.5 left-3 right-3 h-0.5 rounded-full bg-primary z-10',
                },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 2642,
                  columnNumber: 7,
                },
                this
              ),
            /* @__PURE__ */ jsxDEV(
              'div',
              {
                className: 'app-sidebar-project-heading group/project relative flex items-center',
                'data-actions-open': projectActionsActive ? '' : void 0,
                children: [
                  !isBatchMode &&
                    /* @__PURE__ */ jsxDEV(
                      'span',
                      {
                        draggable: true,
                        onDragStart: (e) => onProjectDragStart(e, group.workspace.id),
                        title: 'ææ½æåº',
                        className: cn(
                          'absolute -left-0.5 top-1/2 z-10 flex size-[18px] -translate-y-1/2 cursor-grab items-center justify-center text-foreground/20 opacity-0 transition-opacity group-hover/project:opacity-100 active:cursor-grabbing',
                          projectActionsActive && 'opacity-100'
                        ),
                        'aria-hidden': 'true',
                        children: /* @__PURE__ */ jsxDEV(
                          GripVertical,
                          { size: 12 },
                          void 0,
                          false,
                          {
                            fileName:
                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                            lineNumber: 2660,
                            columnNumber: 13,
                          },
                          this
                        ),
                      },
                      void 0,
                      false,
                      {
                        fileName:
                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                        lineNumber: 2650,
                        columnNumber: 9,
                      },
                      this
                    ),
                  renaming
                    ? /* @__PURE__ */ jsxDEV(
                        'div',
                        {
                          className: cn(
                            'app-sidebar-project-rename relative flex-1 min-w-0 flex items-center gap-1 px-1 py-1 rounded-md text-left titlebar-no-drag group-hover/project:pl-4 group-hover/project:pr-12',
                            isCurrent ? 'text-foreground' : 'text-foreground/65'
                          ),
                          children: [
                            /* @__PURE__ */ jsxDEV(
                              ChevronRight,
                              {
                                size: 12,
                                className: cn(
                                  'flex-shrink-0 text-foreground/40 transition-transform duration-150',
                                  !collapsed && 'rotate-90'
                                ),
                                'aria-hidden': true,
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2670,
                                columnNumber: 13,
                              },
                              this
                            ),
                            /* @__PURE__ */ jsxDEV(
                              'input',
                              {
                                ref: editRef,
                                value: editName,
                                onChange: (e) => setEditName(e.target.value),
                                onKeyDown: handleRenameKeyDown,
                                onBlur: () => void handleCommitRename(),
                                className:
                                  'flex-1 min-w-0 bg-transparent text-[13px] font-medium text-foreground border-b border-primary/50 outline-none px-0.5 leading-[18px]',
                                maxLength: 50,
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2678,
                                columnNumber: 13,
                              },
                              this
                            ),
                          ],
                        },
                        void 0,
                        true,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 2664,
                          columnNumber: 9,
                        },
                        this
                      )
                    : !isBatchMode &&
                      /* @__PURE__ */ jsxDEV(
                        'button',
                        {
                          type: 'button',
                          'aria-expanded': !collapsed,
                          onClick: () => {
                            if (hasActiveSession) return
                            onSelectProject(group.workspace.id)
                          },
                          className: cn(
                            'app-sidebar-project-button relative flex-1 min-w-0 flex items-center gap-1 text-left transition-[padding,color,background-color] titlebar-no-drag group-hover/project:pl-4 group-hover/project:pr-12',
                            isCurrent
                              ? 'text-foreground'
                              : 'text-foreground/65 hover:text-foreground/88'
                          ),
                          children: [
                            /* @__PURE__ */ jsxDEV(
                              ChevronRight,
                              {
                                size: 12,
                                className: cn(
                                  'flex-shrink-0 transition-transform duration-150',
                                  hasActiveSession ? 'text-foreground/25' : 'text-foreground/40',
                                  !collapsed && 'rotate-90'
                                ),
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2702,
                                columnNumber: 15,
                              },
                              this
                            ),
                            /* @__PURE__ */ jsxDEV(
                              'span',
                              {
                                className:
                                  'session-row-title-text text-[13px] font-medium leading-[18px]',
                                title: group.workspace.name,
                                children: group.workspace.name,
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2710,
                                columnNumber: 15,
                              },
                              this
                            ),
                            /* @__PURE__ */ jsxDEV(
                              'span',
                              {
                                className: 'app-sidebar-project-count',
                                children: group.sessions.length,
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2716,
                                columnNumber: 15,
                              },
                              this
                            ),
                          ],
                        },
                        void 0,
                        true,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 2690,
                          columnNumber: 9,
                        },
                        this
                      ),
                  !isBatchMode &&
                    /* @__PURE__ */ jsxDEV(
                      Tooltip,
                      {
                        children: [
                          /* @__PURE__ */ jsxDEV(
                            TooltipTrigger,
                            {
                              asChild: true,
                              children: /* @__PURE__ */ jsxDEV(
                                'button',
                                {
                                  type: 'button',
                                  'aria-label': `å¨ã${group.workspace.name}ãä¸­æ°å»ºä¼è¯`,
                                  onClick: (e) => {
                                    e.stopPropagation()
                                    onNewSession(group.workspace.id)
                                  },
                                  className: cn(
                                    'absolute right-7 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-foreground/30 opacity-0 transition-colors hover:bg-foreground/[0.055] hover:text-foreground/65 group-hover/project:opacity-100 titlebar-no-drag',
                                    projectActionsActive && 'opacity-100'
                                  ),
                                  children: /* @__PURE__ */ jsxDEV(
                                    Plus,
                                    { size: 13 },
                                    void 0,
                                    false,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2736,
                                      columnNumber: 17,
                                    },
                                    this
                                  ),
                                },
                                void 0,
                                false,
                                {
                                  fileName:
                                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                  lineNumber: 2724,
                                  columnNumber: 15,
                                },
                                this
                              ),
                            },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2723,
                              columnNumber: 13,
                            },
                            this
                          ),
                          /* @__PURE__ */ jsxDEV(
                            TooltipContent,
                            { side: 'top', children: 'å¨æ­¤é¡¹ç®ä¸­æ°å»ºä¼è¯' },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2739,
                              columnNumber: 13,
                            },
                            this
                          ),
                        ],
                      },
                      void 0,
                      true,
                      {
                        fileName:
                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                        lineNumber: 2722,
                        columnNumber: 9,
                      },
                      this
                    ),
                  isBatchMode
                    ? /* @__PURE__ */ jsxDEV(
                        'div',
                        {
                          className: 'flex flex-1 items-center gap-1 px-2 py-1',
                          children: [
                            /* @__PURE__ */ jsxDEV(
                              'span',
                              {
                                className: 'text-[12px] font-medium text-foreground/80 mr-1',
                                children: [
                                  'å·²é ',
                                  batchSelectedCount,
                                  ' / ',
                                  group.sessions.length,
                                ],
                              },
                              void 0,
                              true,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2745,
                                columnNumber: 13,
                              },
                              this
                            ),
                            /* @__PURE__ */ jsxDEV(
                              'button',
                              {
                                type: 'button',
                                onClick: () => {
                                  const allIds = group.sessions.map((s) => s.id)
                                  const allSelected = allIds.every((id) =>
                                    batchSelectedSessionIds.has(id)
                                  )
                                  if (allSelected) {
                                    onBatchUpdateSelected((prev) => {
                                      const next = new Set(prev)
                                      for (const id of allIds) next.delete(id)
                                      return next
                                    })
                                  } else {
                                    onBatchUpdateSelected((prev) => {
                                      const next = new Set(prev)
                                      for (const id of allIds) next.add(id)
                                      return next
                                    })
                                  }
                                },
                                className:
                                  'h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors',
                                children:
                                  group.sessions.length > 0 &&
                                  group.sessions.every((s) => batchSelectedSessionIds.has(s.id))
                                    ? 'åæ¶å¨é'
                                    : 'å¨é',
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2748,
                                columnNumber: 13,
                              },
                              this
                            ),
                            /* @__PURE__ */ jsxDEV(
                              'button',
                              {
                                type: 'button',
                                onClick: onRequestBatchDelete,
                                disabled: batchSelectedCount === 0,
                                className:
                                  'h-6 px-2 rounded-md text-[11px] text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-40 disabled:hover:bg-transparent transition-colors',
                                children: [
                                  'å é¤',
                                  batchSelectedCount > 0 ? ` ${batchSelectedCount}` : '',
                                ],
                              },
                              void 0,
                              true,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2774,
                                columnNumber: 13,
                              },
                              this
                            ),
                            /* @__PURE__ */ jsxDEV(
                              'button',
                              {
                                type: 'button',
                                onClick: onExitBatchSelect,
                                className:
                                  'h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground transition-colors ml-auto',
                                children: 'åæ¶',
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2782,
                                columnNumber: 13,
                              },
                              this
                            ),
                          ],
                        },
                        void 0,
                        true,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 2744,
                          columnNumber: 9,
                        },
                        this
                      )
                    : /* @__PURE__ */ jsxDEV(
                        DropdownMenu,
                        {
                          open: menuOpen,
                          onOpenChange: setMenuOpen,
                          children: [
                            /* @__PURE__ */ jsxDEV(
                              DropdownMenuTrigger,
                              {
                                asChild: true,
                                children: /* @__PURE__ */ jsxDEV(
                                  'button',
                                  {
                                    type: 'button',
                                    'aria-label': 'é¡¹ç®èå',
                                    className: cn(
                                      'absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-md text-foreground/30 opacity-0 transition-colors hover:bg-foreground/[0.055] hover:text-foreground/60 group-hover/project:opacity-100 titlebar-no-drag',
                                      'data-[state=open]:bg-foreground/[0.055] data-[state=open]:text-foreground/60 data-[state=open]:opacity-100',
                                      projectActionsActive && 'opacity-100'
                                    ),
                                    children: /* @__PURE__ */ jsxDEV(
                                      MoreVertical,
                                      { size: 13 },
                                      void 0,
                                      false,
                                      {
                                        fileName:
                                          'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                        lineNumber: 2802,
                                        columnNumber: 17,
                                      },
                                      this
                                    ),
                                  },
                                  void 0,
                                  false,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 2793,
                                    columnNumber: 15,
                                  },
                                  this
                                ),
                              },
                              void 0,
                              false,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2792,
                                columnNumber: 13,
                              },
                              this
                            ),
                            /* @__PURE__ */ jsxDEV(
                              DropdownMenuContent,
                              {
                                align: 'start',
                                className: 'w-44 z-[9999] min-w-0 p-0.5',
                                children: [
                                  /* @__PURE__ */ jsxDEV(
                                    DropdownMenuItem,
                                    {
                                      className: 'text-xs py-1 [&>svg]:size-3.5',
                                      onSelect: () => onSelectProject(group.workspace.id),
                                      children: [
                                        /* @__PURE__ */ jsxDEV(
                                          FolderOpen,
                                          { size: 14 },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2810,
                                            columnNumber: 17,
                                          },
                                          this
                                        ),
                                        'è®¾ä¸ºå½åé¡¹ç®',
                                      ],
                                    },
                                    void 0,
                                    true,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2806,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                  /* @__PURE__ */ jsxDEV(
                                    DropdownMenuItem,
                                    {
                                      className: 'text-xs py-1 [&>svg]:size-3.5',
                                      onSelect: handleStartRename,
                                      children: [
                                        /* @__PURE__ */ jsxDEV(
                                          Pencil,
                                          { size: 14 },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2817,
                                            columnNumber: 17,
                                          },
                                          this
                                        ),
                                        'éå½å',
                                      ],
                                    },
                                    void 0,
                                    true,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2813,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                  /* @__PURE__ */ jsxDEV(
                                    DropdownMenuItem,
                                    {
                                      className: 'text-xs py-1 [&>svg]:size-3.5',
                                      onSelect: () => onConfigureProject(group.workspace.id),
                                      children: [
                                        /* @__PURE__ */ jsxDEV(
                                          Settings,
                                          { size: 14 },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2824,
                                            columnNumber: 17,
                                          },
                                          this
                                        ),
                                        'éç½® MCP ä¸ Skills',
                                      ],
                                    },
                                    void 0,
                                    true,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2820,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                  /* @__PURE__ */ jsxDEV(
                                    DropdownMenuItem,
                                    {
                                      className: 'text-xs py-1 [&>svg]:size-3.5',
                                      onSelect: () => onEnterBatchSelect(group.workspace.id),
                                      children: [
                                        /* @__PURE__ */ jsxDEV(
                                          CheckSquare,
                                          { size: 14 },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2831,
                                            columnNumber: 17,
                                          },
                                          this
                                        ),
                                        'æ¹éå é¤ä¼è¯',
                                      ],
                                    },
                                    void 0,
                                    true,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2827,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                  /* @__PURE__ */ jsxDEV(
                                    DropdownMenuSeparator,
                                    { className: 'my-0.5' },
                                    void 0,
                                    false,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2834,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                  /* @__PURE__ */ jsxDEV(
                                    DropdownMenuItem,
                                    {
                                      className: cn(
                                        'text-xs py-1 [&>svg]:size-3.5',
                                        'text-destructive focus:text-destructive'
                                      ),
                                      onSelect: () => onRequestDeleteWorkspace(group.workspace.id),
                                      children: [
                                        /* @__PURE__ */ jsxDEV(
                                          Trash2,
                                          { size: 14 },
                                          void 0,
                                          false,
                                          {
                                            fileName:
                                              'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                            lineNumber: 2842,
                                            columnNumber: 17,
                                          },
                                          this
                                        ),
                                        'å é¤é¡¹ç®',
                                      ],
                                    },
                                    void 0,
                                    true,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2835,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                ],
                              },
                              void 0,
                              true,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2805,
                                columnNumber: 13,
                              },
                              this
                            ),
                          ],
                        },
                        void 0,
                        true,
                        {
                          fileName:
                            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                          lineNumber: 2791,
                          columnNumber: 9,
                        },
                        this
                      ),
                ],
              },
              void 0,
              true,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 2644,
                columnNumber: 7,
              },
              this
            ),
            /* @__PURE__ */ jsxDEV(
              'div',
              {
                className:
                  'mt-px grid min-w-0 transition-[grid-template-rows] duration-200 ease-in-out',
                style: { gridTemplateRows: collapsed ? '0fr' : '1fr' },
                children: /* @__PURE__ */ jsxDEV(
                  'div',
                  {
                    className: 'min-h-0 min-w-0 overflow-hidden',
                    children:
                      !collapsed && sortedSessions.length > 0
                        ? /* @__PURE__ */ jsxDEV(
                            'div',
                            {
                              className: 'flex min-w-0 flex-col',
                              children: sortedSessions.map((session) =>
                                /* @__PURE__ */ jsxDEV(
                                  AgentSessionItem,
                                  {
                                    session,
                                    active: session.id === activeSessionId,
                                    indicatorStatus: agentIndicatorMap.get(session.id) ?? 'idle',
                                    modelName: sessionModelMap.get(session.id)
                                      ? resolveModelDisplayName(
                                          sessionModelMap.get(session.id),
                                          channels
                                        )
                                      : void 0,
                                    leftAccent: getSessionLeftAccent(
                                      agentIndicatorMap.get(session.id) ?? 'idle',
                                      session.id === activeSessionId,
                                      session.manualWorking
                                    ),
                                    workspaceName: session.workspaceId
                                      ? workspaceNameMap.get(session.workspaceId)
                                      : void 0,
                                    isBatchMode,
                                    isBatchSelected: batchSelectedSessionIds.has(session.id),
                                    onToggleBatchSelect,
                                    onSelect: onSelectSession,
                                    onRequestDelete: handleRequestDelete,
                                    onRename: handleAgentRename,
                                    onTogglePin: handleTogglePinAgent,
                                    onToggleArchive: handleToggleArchiveAgent,
                                    disableMiniMap: true,
                                  },
                                  session.id,
                                  false,
                                  {
                                    fileName:
                                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                    lineNumber: 2862,
                                    columnNumber: 13,
                                  },
                                  this
                                )
                              ),
                            },
                            void 0,
                            false,
                            {
                              fileName:
                                'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                              lineNumber: 2860,
                              columnNumber: 11,
                            },
                            this
                          )
                        : !collapsed
                          ? /* @__PURE__ */ jsxDEV(
                              'div',
                              {
                                className:
                                  'flex items-center gap-1 px-1 py-0.5 text-[12px] text-foreground/22 select-none',
                                children: [
                                  /* @__PURE__ */ jsxDEV(
                                    'span',
                                    { className: 'flex-shrink-0 w-[18px]', 'aria-hidden': true },
                                    void 0,
                                    false,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2895,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                  /* @__PURE__ */ jsxDEV(
                                    'span',
                                    { children: 'ææ ä¼è¯' },
                                    void 0,
                                    false,
                                    {
                                      fileName:
                                        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                      lineNumber: 2896,
                                      columnNumber: 15,
                                    },
                                    this
                                  ),
                                ],
                              },
                              void 0,
                              true,
                              {
                                fileName:
                                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                                lineNumber: 2894,
                                columnNumber: 11,
                              },
                              this
                            )
                          : null,
                  },
                  void 0,
                  false,
                  {
                    fileName:
                      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                    lineNumber: 2858,
                    columnNumber: 9,
                  },
                  this
                ),
              },
              void 0,
              false,
              {
                fileName:
                  'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                lineNumber: 2850,
                columnNumber: 7,
              },
              this
            ),
            dropPosition === 'after' &&
              /* @__PURE__ */ jsxDEV(
                'div',
                {
                  className:
                    'absolute -bottom-0.5 left-3 right-3 h-0.5 rounded-full bg-primary z-10',
                },
                void 0,
                false,
                {
                  fileName:
                    'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
                  lineNumber: 2902,
                  columnNumber: 7,
                },
                this
              ),
          ],
        },
        void 0,
        true,
        {
          fileName:
            'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
          lineNumber: 2631,
          columnNumber: 5,
        },
        this
      )
    }, 'aaaeFRhwVgp8i+6ggXqmJQMkffw='))
  ),
  'aaaeFRhwVgp8i+6ggXqmJQMkffw='
)
_c1 = AgentProjectGroupItem
var _c, _c2, _c3, _c4, _c5, _c6, _c7, _c8, _c9, _c0, _c1
$RefreshReg$(_c, 'SidebarItem')
$RefreshReg$(_c2, 'SidebarTopControlsRow')
$RefreshReg$(_c3, 'LeftSidebar')
$RefreshReg$(_c4, 'SessionsRailContent')
$RefreshReg$(_c5, 'SkillsRailContent')
$RefreshReg$(_c6, 'ConversationItem$React.memo')
$RefreshReg$(_c7, 'ConversationItem')
$RefreshReg$(_c8, 'AgentSessionItem$React.memo')
$RefreshReg$(_c9, 'AgentSessionItem')
$RefreshReg$(_c0, 'AgentProjectGroupItem$React.memo')
$RefreshReg$(_c1, 'AgentProjectGroupItem')
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg
  window.$RefreshSig$ = prevRefreshSig
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh(
      'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
      currentExports
    )
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate(
        'F:/TAgent_General/apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx',
        currentExports,
        nextExports
      )
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage)
    })
  })
}

//# sourceMappingURL=data:application/json;base64,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Q0FBQ21VLFlBQ0gsdUJBQUMsU0FBSSxXQUFVLGtGQUNiO0FBQUEscUNBQUMsVUFBSyxXQUFVLDBCQUF5QixlQUFXLFFBQXBEO0FBQUE7QUFBQTtBQUFBO0FBQUEscUJBQW9EO0FBQUEsY0FDcEQsdUJBQUMsVUFBSyxvQkFBTjtBQUFBO0FBQUE7QUFBQTtBQUFBLHFCQUFVO0FBQUEsaUJBRlo7QUFBQTtBQUFBO0FBQUE7QUFBQSxtQkFHQSxJQUNFLFFBeENOO0FBQUE7QUFBQTtBQUFBO0FBQUEsbUJBeUNBO0FBQUE7QUFBQSxVQWpERjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFrREE7QUFBQSxRQUNDMkIsaUJBQWlCLFdBQ2hCLHVCQUFDLFNBQUksV0FBVSw0RUFBZjtBQUFBO0FBQUE7QUFBQTtBQUFBLGVBQXVGO0FBQUE7QUFBQTtBQUFBLElBL1EzRjtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFpUkE7QUFFSixHQUFDLGtDQUFDO0FBQUFNLE1BbmFJcEM7QUFBcUIsSUFBQXRhLElBQUFpQyxLQUFBbVMsS0FBQXVCLEtBQUFFLEtBQUFJLEtBQUEwQyxLQUFBVyxLQUFBZSxLQUFBRyxLQUFBa0M7QUFBQUMsYUFBQTNjLElBQUE7QUFBQTJjLGFBQUExYSxLQUFBO0FBQUEwYSxhQUFBdkksS0FBQTtBQUFBdUksYUFBQWhILEtBQUE7QUFBQWdILGFBQUE5RyxLQUFBO0FBQUE4RyxhQUFBMUcsS0FBQTtBQUFBMEcsYUFBQWhFLEtBQUE7QUFBQWdFLGFBQUFyRCxLQUFBO0FBQUFxRCxhQUFBdEMsS0FBQTtBQUFBc0MsYUFBQW5DLEtBQUE7QUFBQW1DLGFBQUFELEtBQUEiLCJuYW1lcyI6WyJ1c2VBdG9tIiwidXNlU2V0QXRvbSIsInVzZUF0b21WYWx1ZSIsInVzZVN0b3JlIiwiQ2hhdHNDaXJjbGUiLCJQaW4iLCJQaW5PZmYiLCJQbHVzIiwiVHJhc2gyIiwiUGVuY2lsIiwiQ2hldnJvblJpZ2h0IiwiU2VhcmNoIiwiQXJjaGl2ZSIsIkFyY2hpdmVSZXN0b3JlIiwiTW9yZVZlcnRpY2FsIiwiQ2hlY2siLCJDaGVja1NxdWFyZSIsIlNxdWFyZSIsIkZvbGRlck9wZW4iLCJIb3VyZ2xhc3MiLCJTZXR0aW5ncyIsIkdyaXBWZXJ0aWNhbCIsIlBhbmVsTGVmdENsb3NlIiwiUmVhY3QiLCJ0b2FzdCIsInJlc29sdmVBZ2VudFNlc3Npb25Nb2RlbElkIiwiQWxlcnREaWFsb2ciLCJBbGVydERpYWxvZ0FjdGlvbiIsIkFsZXJ0RGlhbG9nQ2FuY2VsIiwiQWxlcnREaWFsb2dDb250ZW50IiwiQWxlcnREaWFsb2dEZXNjcmlwdGlvbiIsIkFsZXJ0RGlhbG9nRm9vdGVyIiwiQWxlcnREaWFsb2dIZWFkZXIiLCJBbGVydERpYWxvZ1RpdGxlIiwiQ29udGV4dE1lbnUiLCJDb250ZXh0TWVudVRyaWdnZXIiLCJDb250ZXh0TWVudUNvbnRlbnQiLCJDb250ZXh0TWVudUl0ZW0iLCJDb250ZXh0TWVudVNlcGFyYXRvciIsIkRyb3Bkb3duTWVudSIsIkRyb3Bkb3duTWVudVRyaWdnZXIiLCJEcm9wZG93bk1lbnVDb250ZW50IiwiRHJvcGRvd25NZW51SXRlbSIsIkRyb3Bkb3duTWVudVNlcGFyYXRvciIsIlBvcG92ZXIiLCJQb3BvdmVyVHJpZ2dlciIsIlBvcG92ZXJDb250ZW50IiwiVG9vbHRpcCIsIlRvb2x0aXBUcmlnZ2VyIiwiVG9vbHRpcENvbnRlbnQiLCJTZXNzaW9uU2VhcmNoSW5saW5lIiwiRHJhZnRTZWFyY2hEaWFsb2ciLCJBQ1RJVkVfU0VTU0lPTl9TVEFUVVNFUyIsIlNldCIsIkFDVElWRV9TRVNTSU9OX1NUQVRVU19QUklPUklUWSIsImJsb2NrZWQiLCJydW5uaW5nIiwiY29tcGxldGVkIiwiaWRsZSIsImFjdGl2ZVZpZXdBdG9tIiwiYWdlbnRTZXNzaW9uc0F0b20iLCJhZ2VudFNES01lc3NhZ2VzQ2FjaGVBdG9tIiwiY3VycmVudEFnZW50U2Vzc2lvbklkQXRvbSIsImFnZW50U2Vzc2lvbkluZGljYXRvck1hcEF0b20iLCJ1bnZpZXdlZENvbXBsZXRlZFNlc3Npb25JZHNBdG9tIiwid29ya2luZ0RvbmVTZXNzaW9uSWRzQXRvbSIsImFnZW50Q2hhbm5lbElkQXRvbSIsImFnZW50TW9kZWxJZEF0b20iLCJhZ2VudFNlc3Npb25DaGFubmVsTWFwQXRvbSIsImFnZW50U2Vzc2lvbk1vZGVsTWFwQXRvbSIsImN1cnJlbnRBZ2VudFdvcmtzcGFjZUlkQXRvbSIsImFnZW50V29ya3NwYWNlc0F0b20iLCJ3b3Jrc3BhY2VDYXBhYmlsaXRpZXNWZXJzaW9uQXRvbSIsImFnZW50RGlmZlBhbmVsVGFiQXRvbSIsImFnZW50RGlmZlJlZnJlc2hWZXJzaW9uQXRvbSIsImFnZW50RGlmZlVuc2VlbkNoYW5nZXNBdG9tIiwiYWdlbnREaWZmVW5zZWVuRmlsZXNBdG9tIiwiYWdlbnREaWZmRGF0YUF0b20iLCJhZ2VudFN0cmVhbWluZ1N0YXRlc0F0b20iLCJsaXZlTWVzc2FnZXNNYXBBdG9tIiwiYWdlbnRTZXNzaW9uUGVuZGluZ0ZpbGVzQXRvbSIsImFnZW50U2Vzc2lvblN0cmVhbWluZ1N0YXRlQXRvbUZhbWlseSIsImFnZW50U2Vzc2lvbkRyYWZ0QXRvbUZhbWlseSIsImFnZW50U2Vzc2lvbkRyYWZ0SHRtbEF0b21GYW1pbHkiLCJhZ2VudFBlbmRpbmdGaWxlc0F0b21GYW1pbHkiLCJiYWNrZ3JvdW5kVGFza3NBdG9tRmFtaWx5Iiwic2Vzc2lvblBlcnNpc3RlZFBlcm1pc3Npb25Nb2RlQXRvbSIsInNlc3Npb25FeGlzdHNBdG9tIiwiY29udmVyc2F0aW9uc0F0b20iLCJhcHBNb2RlQXRvbSIsImFjdGl2ZVJhaWxJdGVtQXRvbSIsIm5hdmlnYXRpb25TaWRlYmFyT3BlbkF0b20iLCJ0b3BMZXZlbE1vZGVBdG9tIiwiY2hhbm5lbHNBdG9tIiwic2VsZWN0ZWRNb2RlbEF0b20iLCJkcmFmdFNlc3Npb25JZHNBdG9tIiwiZHJhZnRzQXRvbSIsImRyYWZ0U2VhcmNoT3BlbkF0b20iLCJoYXNFbnZpcm9ubWVudElzc3Vlc0F0b20iLCJwcmV2aWV3UGFuZWxPcGVuTWFwQXRvbSIsInByZXZpZXdGaWxlTWFwQXRvbSIsInNldHRpbmdzVGFiQXRvbSIsInNldHRpbmdzT3BlbkF0b20iLCJwcm9tcHRDb25maWdBdG9tIiwic2VsZWN0ZWRQcm9tcHRJZEF0b20iLCJjb252ZXJzYXRpb25Qcm9tcHRJZEF0b20iLCJ0YWJzQXRvbSIsImFjdGl2ZVRhYklkQXRvbSIsImFjdGl2ZVNlc3Npb25JZEF0b20iLCJjbG9zZVRhYiIsInVwZGF0ZVRhYlRpdGxlIiwic2Vzc2lvblZpZXdTdGF0ZU1hcEF0b20iLCJoYXNVcGRhdGVBdG9tIiwidXNlclByb2ZpbGVBdG9tIiwiUGx1Z2luU2lkZWJhck5hdiIsImNsZWFyUHJldmlld0NhY2hlRm9yU2Vzc2lvbiIsIkRyYWZ0TGlzdFBhbmVsIiwiS2FuYmFuUmFpbENvbnRlbnQiLCJTZXNzaW9uTWluaU1hcFBvcG92ZXIiLCJ1c2VTZXNzaW9uTWluaU1hcEhvdmVyIiwiVEFTaWRlYmFyIiwiYXV0b21hdGlvbnNBdG9tIiwidXNlT3BlblNlc3Npb24iLCJ1c2VTeW5jQWN0aXZlVGFiU2lkZUVmZmVjdHMiLCJ1c2VXb3Jrc3BhY2VBY3Rpb25zIiwicmVwbGFjZUFnZW50U2Vzc2lvbkluRnJlc2huZXNzT3JkZXIiLCJzb3J0QWdlbnRTZXNzaW9uc0J5VXBkYXRlZEF0RGVzYyIsImRldGVjdElzTWFjIiwiZ2V0QWdlbnRTZXNzaW9uVmlzdWFsU3RhdGUiLCJyZXNvbHZlTW9kZWxEaXNwbGF5TmFtZSIsImNuIiwiU2lkZWJhckl0ZW0iLCJpY29uIiwibGFiZWwiLCJhY3RpdmUiLCJzdWZmaXgiLCJvbkNsaWNrIiwiX2MiLCJJVEVNX1RPX1ZJRVciLCJwaW5uZWQiLCJncm91cEJ5RGF0ZSIsIml0ZW1zIiwibm93IiwiRGF0ZSIsInRvZGF5U3RhcnQiLCJnZXRGdWxsWWVhciIsImdldE1vbnRoIiwiZ2V0RGF0ZSIsImdldFRpbWUiLCJ5ZXN0ZXJkYXlTdGFydCIsInRvZGF5IiwieWVzdGVyZGF5IiwiZWFybGllciIsIml0ZW0iLCJ1cGRhdGVkQXQiLCJwdXNoIiwiZ3JvdXBzIiwibGVuZ3RoIiwiZ2V0U2Vzc2lvbkxlZnRBY2NlbnQiLCJpbmRpY2F0b3JTdGF0dXMiLCJtYW51YWxXb3JraW5nIiwiaXNBZ2VudFNlc3Npb25JblRvcExldmVsTW9kZSIsInNlc3Npb24iLCJ0b3BMZXZlbE1vZGUiLCJzb3VyY2VLYW5iYW5UYXNrSWQiLCJtb2RlIiwiU0lERUJBUl9UT1BfQ09OVFJPTF9DTEFTUyIsIlNpZGViYXJUb3BDb250cm9sc1JvdyIsImlzTWFjIiwiY2hpbGRyZW4iLCJfYzIiLCJMZWZ0U2lkZWJhciIsIndpZHRoIiwiX3dpZHRoIiwiYWN0aXZlUmFpbEl0ZW0iLCJfcyIsImFjdGl2ZVZpZXciLCJzZXRBY3RpdmVWaWV3Iiwic2V0U2V0dGluZ3NUYWIiLCJzZXRTZXR0aW5nc09wZW4iLCJfYWN0aXZlSXRlbSIsInNldEFjdGl2ZUl0ZW0iLCJ1c2VTdGF0ZSIsImNvbnZlcnNhdGlvbnMiLCJzZXRDb252ZXJzYXRpb25zIiwiZHJhZnRTZXNzaW9uSWRzIiwic2V0RHJhZnRTZXNzaW9uSWRzIiwic2V0QWdlbnRNZXNzYWdlc0NhY2hlIiwic2V0QXV0b21hdGlvbnMiLCJwZW5kaW5nRGVsZXRlSWQiLCJzZXRQZW5kaW5nRGVsZXRlSWQiLCJwZW5kaW5nRGVsZXRlV29ya3NwYWNlSWQiLCJzZXRQZW5kaW5nRGVsZXRlV29ya3NwYWNlSWQiLCJkZWxldGluZ1dvcmtzcGFjZUlkIiwic2V0RGVsZXRpbmdXb3Jrc3BhY2VJZCIsImNvbGxhcHNlZFdvcmtzcGFjZUlkcyIsInNldENvbGxhcHNlZFdvcmtzcGFjZUlkcyIsImRyYWdQcm9qZWN0SWQiLCJzZXREcmFnUHJvamVjdElkIiwicHJvamVjdERyb3BJbmRpY2F0b3IiLCJzZXRQcm9qZWN0RHJvcEluZGljYXRvciIsImJhdGNoU2VsZWN0V29ya3NwYWNlSWQiLCJzZXRCYXRjaFNlbGVjdFdvcmtzcGFjZUlkIiwiYmF0Y2hTZWxlY3RlZFNlc3Npb25JZHMiLCJzZXRCYXRjaFNlbGVjdGVkU2Vzc2lvbklkcyIsImJhdGNoRGVsZXRlQ29uZmlybU9wZW4iLCJzZXRCYXRjaERlbGV0ZUNvbmZpcm1PcGVuIiwidXNlclByb2ZpbGUiLCJzZXRVc2VyUHJvZmlsZSIsInNlbGVjdGVkTW9kZWwiLCJ1c2VNZW1vIiwiaGFzVXBkYXRlIiwiaGFzRW52aXJvbm1lbnRJc3N1ZXMiLCJwcm9tcHRDb25maWciLCJzZXRTZWxlY3RlZFByb21wdElkIiwiYWdlbnRTZXNzaW9ucyIsInNldEFnZW50U2Vzc2lvbnMiLCJzZXRTZXNzaW9uQ2hhbm5lbE1hcCIsInNldFNlc3Npb25Nb2RlbE1hcCIsInNlc3Npb25Nb2RlbE1hcCIsImN1cnJlbnRNb2RlQWdlbnRTZXNzaW9ucyIsImZpbHRlciIsImRyYWZ0cyIsInNldERyYWZ0cyIsImRyYWZ0U2VhcmNoT3BlbiIsInNldERyYWZ0U2VhcmNoT3BlbiIsImN1cnJlbnRBZ2VudFNlc3Npb25JZCIsInNldEN1cnJlbnRBZ2VudFNlc3Npb25JZCIsImFnZW50SW5kaWNhdG9yTWFwIiwidW52aWV3ZWRDb21wbGV0ZWRTZXNzaW9uSWRzIiwic2V0VW52aWV3ZWRDb21wbGV0ZWQiLCJhZ2VudENoYW5uZWxJZCIsImxlZ2FjeUdsb2JhbE1vZGVsSWQiLCJjaGFubmVscyIsImRlZmF1bHRNb2RlbEZvck5ld1Nlc3Npb24iLCJ1bmRlZmluZWQiLCJjaGFubmVsIiwiZmluZCIsImMiLCJpZCIsImVuYWJsZWQiLCJjdXJyZW50V29ya3NwYWNlSWQiLCJzZXRDdXJyZW50V29ya3NwYWNlSWQiLCJ3b3Jrc3BhY2VzIiwic2V0V29ya3NwYWNlcyIsInNlbGVjdFdvcmtzcGFjZSIsImNyZWF0ZVByb2plY3QiLCJjdXJyZW50V29ya3NwYWNlTmFtZSIsInciLCJuYW1lIiwiY2FwYWJpbGl0aWVzIiwic2V0Q2FwYWJpbGl0aWVzIiwiY2FwYWJpbGl0aWVzVmVyc2lvbiIsInRhYnMiLCJzZXRUYWJzIiwiYWN0aXZlVGFiSWQiLCJzZXRBY3RpdmVUYWJJZCIsImFjdGl2ZVNlc3Npb25JZCIsIm9wZW5TZXNzaW9uIiwic3luY0FjdGl2ZVRhYlNpZGVFZmZlY3RzIiwic3RvcmUiLCJzZXROYXZpZ2F0aW9uU2lkZWJhck9wZW4iLCJ1c2VFZmZlY3QiLCJyZXF1ZXN0QW5pbWF0aW9uRnJhbWUiLCJlbCIsImRvY3VtZW50IiwicXVlcnlTZWxlY3RvciIsInNjcm9sbEludG9WaWV3IiwiYmxvY2siLCJiZWhhdmlvciIsInNldENvbnZQcm9tcHRJZCIsInNldFByZXZpZXdQYW5lbE9wZW4iLCJzZXRQcmV2aWV3RmlsZSIsInNldERpZmZQYW5lbFRhYiIsInNldERpZmZSZWZyZXNoVmVyc2lvbiIsInNldERpZmZVbnNlZW4iLCJzZXREaWZmVW5zZWVuRmlsZXMiLCJzZXREaWZmRGF0YSIsInNldFdvcmtpbmdEb25lIiwic2V0U3RyZWFtaW5nU3RhdGVzIiwic2V0TGl2ZU1lc3NhZ2VzTWFwIiwic2V0U2Vzc2lvblBlbmRpbmdGaWxlcyIsInNldFNlc3Npb25WaWV3U3RhdGVNYXAiLCJjbGVhbnVwTWFwQXRvbXMiLCJ1c2VDYWxsYmFjayIsImRlbGV0ZUtleSIsInByZXYiLCJoYXMiLCJtYXAiLCJNYXAiLCJkZWxldGUiLCJzZXNzaW9uUGVuZGluZyIsImdldCIsImYiLCJwcmV2aWV3VXJsIiwic3RhcnRzV2l0aCIsIlVSTCIsInJldm9rZU9iamVjdFVSTCIsIndpbmRvdyIsIl9fcGVuZGluZ0FnZW50RmlsZURhdGEiLCJyZW1vdmUiLCJjdXJyZW50V29ya3NwYWNlU2x1ZyIsInNsdWciLCJ3b3Jrc3BhY2VOYW1lTWFwIiwic2V0IiwiZWxlY3Ryb25BUEkiLCJnZXRXb3Jrc3BhY2VDYXBhYmlsaXRpZXMiLCJ0aGVuIiwiY2F0Y2giLCJjb25zb2xlIiwiZXJyb3IiLCJwaW5uZWRBZ2VudFNlc3Npb25zIiwicyIsImFyY2hpdmVkIiwic29ydCIsImEiLCJiIiwiYXJjaGl2ZWRBZ2VudFNlc3Npb25Db3VudCIsImFyY2hpdmVkQWdlbnRTZXNzaW9uc0xpc3QiLCJsaXN0Q29udmVyc2F0aW9ucyIsImxpc3QiLCJnZXRVc2VyUHJvZmlsZSIsImxpc3RBZ2VudFNlc3Npb25zIiwic2Vzc2lvbnMiLCJuZXh0IiwiY2hhbm5lbElkIiwibW9kZWxJZCIsInJ1bkF1dG9BcmNoaXZlIiwiY291bnQiLCJsb2ciLCJoYW5kbGVGb2N1cyIsImFkZEV2ZW50TGlzdGVuZXIiLCJyZW1vdmVFdmVudExpc3RlbmVyIiwiaGFuZGxlSXRlbUNsaWNrIiwiaGFuZGxlUmVxdWVzdERlbGV0ZSIsImhhbmRsZUNvbmZpcm1EZWxldGUiLCJ0YWJUb0Nsb3NlIiwidCIsInNlc3Npb25JZCIsInRhYklkVG9DbG9zZSIsIndhc0FjdGl2ZSIsInRhYlJlc3VsdCIsIm5ld0FjdGl2ZVRhYiIsImRlbGV0ZUFnZW50U2Vzc2lvbiIsImRlbGV0ZUNvbnZlcnNhdGlvbiIsImhhbmRsZUVudGVyQmF0Y2hTZWxlY3QiLCJ3b3Jrc3BhY2VJZCIsImhhbmRsZUV4aXRCYXRjaFNlbGVjdCIsImhhbmRsZVRvZ2dsZUJhdGNoU2VsZWN0IiwiYWRkIiwiaGFuZGxlUmVxdWVzdEJhdGNoRGVsZXRlIiwic2l6ZSIsImhhbmRsZUNvbmZpcm1CYXRjaERlbGV0ZSIsImlkcyIsInRhYnNUb0Nsb3NlIiwiaW5jbHVkZXMiLCJjdXJyZW50VGFicyIsImN1cnJlbnRBY3RpdmUiLCJ0YWIiLCJyZXN1bHQiLCJzb21lIiwibmV3QWN0aXZlIiwiUHJvbWlzZSIsImFsbCIsImhhbmRsZU5ld0RyYWZ0IiwiZG9jIiwiZHJhZnQiLCJjcmVhdGUiLCJ0aXRsZSIsImhhbmRsZU5ld0FnZW50U2Vzc2lvbiIsInNlc3Npb25Nb2RlIiwibWV0YSIsImNyZWF0ZUFnZW50U2Vzc2lvbiIsImhhbmRsZU5ld1Nlc3Npb25JbldvcmtzcGFjZSIsImhhbmRsZVNlbGVjdEFnZW50U2Vzc2lvbiIsImhhbmRsZUFnZW50UmVuYW1lIiwibmV3VGl0bGUiLCJ1cGRhdGVkIiwidXBkYXRlQWdlbnRTZXNzaW9uVGl0bGUiLCJoYW5kbGVXb3Jrc3BhY2VSZW5hbWUiLCJuZXdOYW1lIiwidXBkYXRlQWdlbnRXb3Jrc3BhY2UiLCJtc2ciLCJFcnJvciIsIm1lc3NhZ2UiLCJjYW5EZWxldGVXb3Jrc3BhY2UiLCJ3b3Jrc3BhY2UiLCJwZW5kaW5nRGVsZXRlV29ya3NwYWNlIiwiaGFuZGxlUmVxdWVzdERlbGV0ZVdvcmtzcGFjZSIsImhhbmRsZVByb2plY3REcmFnU3RhcnQiLCJlIiwiZGF0YVRyYW5zZmVyIiwiZWZmZWN0QWxsb3dlZCIsInNldERhdGEiLCJoYW5kbGVQcm9qZWN0RHJhZ092ZXIiLCJwcmV2ZW50RGVmYXVsdCIsImRyb3BFZmZlY3QiLCJyZWN0IiwiY3VycmVudFRhcmdldCIsImdldEJvdW5kaW5nQ2xpZW50UmVjdCIsInJhdGlvIiwiY2xpZW50WSIsInRvcCIsImhlaWdodCIsInBvc2l0aW9uIiwiaGFuZGxlUHJvamVjdERyYWdMZWF2ZSIsImNvbnRhaW5zIiwicmVsYXRlZFRhcmdldCIsImhhbmRsZVByb2plY3REcm9wIiwidGFyZ2V0V29ya3NwYWNlSWQiLCJpbmRpY2F0b3IiLCJmcm9tSW5kZXgiLCJpbmRleE9mIiwidG9JbmRleCIsIm5ld0lkcyIsImluc2VydEF0Iiwic3BsaWNlIiwiYnlJZCIsInJlb3JkZXJlZCIsIkJvb2xlYW4iLCJzYXZlZCIsInJlb3JkZXJBZ2VudFdvcmtzcGFjZXMiLCJoYW5kbGVQcm9qZWN0RHJhZ0VuZCIsImhhbmRsZUNvbmZpcm1EZWxldGVXb3Jrc3BhY2UiLCJkZWxldGVkU2Vzc2lvbklkcyIsImRlbGV0ZUFnZW50V29ya3NwYWNlIiwiY2hhbmdlZCIsImF1dG9tYXRpb24iLCJjdXJyZW50QWN0aXZlVGFiSWQiLCJuZXh0VGFicyIsInR5cGUiLCJuZXh0QWN0aXZlVGFiSWQiLCJyZW1haW5pbmdXb3Jrc3BhY2VzIiwibGlzdEFnZW50V29ya3NwYWNlcyIsImZhbGxiYWNrIiwidXBkYXRlU2V0dGluZ3MiLCJhZ2VudFdvcmtzcGFjZUlkIiwic3VjY2VzcyIsImRlc2NyaXB0aW9uIiwiaGFuZGxlVG9nZ2xlUGluQWdlbnQiLCJvcmlnaW5hbCIsInRvZ2dsZVBpbkFnZW50U2Vzc2lvbiIsImlzUnVubmluZyIsImhhbmRsZVRvZ2dsZUFyY2hpdmVBZ2VudCIsInRvZ2dsZUFyY2hpdmVBZ2VudFNlc3Npb24iLCJhZ2VudFByb2plY3RHcm91cHMiLCJzZXNzaW9uc0J5V29ya3NwYWNlSWQiLCJkZWZhdWx0V3NJZCIsIndzIiwidmlzaWJsZUhpc3RvcnkiLCJ0YXJnZXRJZCIsImdyb3VwV2l0aEFjdGl2ZSIsImciLCJ3c0lkIiwiZGVsZXRlRGlhbG9nIiwib3BlbiIsImtleSIsInByb2plY3REZWxldGVEaWFsb2ciLCJldmVudCIsImJhdGNoRGVsZXRlRGlhbG9nIiwicmVuZGVyUmFpbENvbnRlbnQiLCJfYzMiLCJTZXNzaW9uc1JhaWxDb250ZW50Iiwib25SZW5hbWVXb3Jrc3BhY2UiLCJvblJlcXVlc3REZWxldGVXb3Jrc3BhY2UiLCJvblByb2plY3REcmFnU3RhcnQiLCJvblByb2plY3REcmFnT3ZlciIsIm9uUHJvamVjdERyYWdMZWF2ZSIsIm9uUHJvamVjdERyb3AiLCJvblByb2plY3REcmFnRW5kIiwib25FbnRlckJhdGNoU2VsZWN0Iiwib25FeGl0QmF0Y2hTZWxlY3QiLCJvblRvZ2dsZUJhdGNoU2VsZWN0Iiwib25CYXRjaFVwZGF0ZVNlbGVjdGVkIiwib25SZXF1ZXN0QmF0Y2hEZWxldGUiLCJvbkNvbmZpcm1CYXRjaERlbGV0ZSIsIm9uQ3JlYXRlUHJvamVjdCIsIl9zMiIsInRvZ2dsZUNvbGxhcHNlZCIsImhhbmRsZVJlbmFtZVdvcmtzcGFjZSIsImhhbmRsZUNvbmZpZ3VyZVByb2plY3QiLCJsaXN0UmVmIiwidXNlUmVmIiwiZ3JvdXAiLCJfYzQiLCJTa2lsbHNSYWlsQ29udGVudCIsIl9jNSIsIkNvbnZlcnNhdGlvbkl0ZW0iLCJfczMiLCJtZW1vIiwiX2M2IiwiY29udmVyc2F0aW9uIiwic3RyZWFtaW5nIiwic2hvd1Bpbkljb24iLCJvblNlbGVjdCIsIm9uUmVxdWVzdERlbGV0ZSIsIm9uUmVuYW1lIiwib25Ub2dnbGVQaW4iLCJvblRvZ2dsZUFyY2hpdmUiLCJlZGl0aW5nIiwic2V0RWRpdGluZyIsImVkaXRUaXRsZSIsInNldEVkaXRUaXRsZSIsIm1lbnVPcGVuIiwic2V0TWVudU9wZW4iLCJpbnB1dFJlZiIsImp1c3RTdGFydGVkRWRpdGluZyIsInByZXZpZXciLCJzdGFydEVkaXQiLCJjdXJyZW50Iiwic2V0VGltZW91dCIsImZvY3VzIiwic2VsZWN0Iiwic2F2ZVRpdGxlIiwidHJpbW1lZCIsInRyaW0iLCJoYW5kbGVLZXlEb3duIiwiaXNQaW5uZWQiLCJtZW51SXRlbXMiLCJNZW51SXRlbSIsIk1lbnVTZXBhcmF0b3IiLCJzZXRBbmNob3JSZWYiLCJoYW5kbGVNb3VzZUVudGVyIiwiaGFuZGxlTW91c2VMZWF2ZSIsInN0b3BQcm9wYWdhdGlvbiIsInRhcmdldCIsInZhbHVlIiwiYW5jaG9yUmVmIiwiaXNPcGVuIiwiaXNMZWF2aW5nIiwiaGFuZGxlUGFuZWxNb3VzZUVudGVyIiwiaGFuZGxlUGFuZWxNb3VzZUxlYXZlIiwiX2M3IiwiZm9ybWF0U2Vzc2lvblRpbWUiLCJkYXRlIiwicGFkIiwibiIsInRvU3RyaW5nIiwicGFkU3RhcnQiLCJnZXRIb3VycyIsImdldE1pbnV0ZXMiLCJBZ2VudFNlc3Npb25JdGVtIiwiX3M0IiwiX2M4IiwibGVmdEFjY2VudCIsIm1vZGVsTmFtZSIsImRpc2FibGVNaW5pTWFwIiwid29ya3NwYWNlTmFtZSIsImNoaWxkQ2xhc3NOYW1lIiwic3VyZmFjZSIsImlzQmF0Y2hNb2RlIiwiaXNCYXRjaFNlbGVjdGVkIiwic2VsZWN0aW9uQ2xhc3NOYW1lIiwic2hvd1J1bm5pbmdTd2VlcCIsInN0YXR1c0xpbmVDbGFzcyIsImhhc0luZGljYXRvclN0YXR1cyIsIm1ldGFNb2RlbE5hbWUiLCJyb3dDbGFzc05hbWUiLCJfYzkiLCJBZ2VudFByb2plY3RHcm91cEl0ZW0iLCJfczUiLCJfYzAiLCJjb2xsYXBzZWQiLCJvblNlbGVjdFByb2plY3QiLCJvbk5ld1Nlc3Npb24iLCJvbkNvbmZpZ3VyZVByb2plY3QiLCJvblNlbGVjdFNlc3Npb24iLCJpc0N1cnJlbnQiLCJyZW5hbWluZyIsInNldFJlbmFtaW5nIiwiZWRpdE5hbWUiLCJzZXRFZGl0TmFtZSIsImVkaXRSZWYiLCJqdXN0U3RhcnRlZFJlZiIsImhhbmRsZVN0YXJ0UmVuYW1lIiwiaGFuZGxlQ29tbWl0UmVuYW1lIiwiaGFuZGxlUmVuYW1lS2V5RG93biIsIm5hdGl2ZUV2ZW50IiwiaXNDb21wb3NpbmciLCJnZXRTdGF0dXMiLCJzb3J0ZWRTZXNzaW9ucyIsInNsaWNlIiwicGEiLCJwYiIsInBhUHJpb3JpdHkiLCJwYlByaW9yaXR5IiwiaGFzQWN0aXZlU2Vzc2lvbiIsImlzRHJhZ2dpbmciLCJiYXRjaFNlbGVjdGVkQ291bnQiLCJkcm9wUG9zaXRpb24iLCJwcm9qZWN0QWN0aW9uc0FjdGl2ZSIsImFsbElkcyIsImFsbFNlbGVjdGVkIiwiZXZlcnkiLCJncmlkVGVtcGxhdGVSb3dzIiwiX2MxIiwiJFJlZnJlc2hSZWckIl0sImlnbm9yZUxpc3QiOltdLCJzb3VyY2VzIjpbIkxlZnRTaWRlYmFyLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIExlZnRTaWRlYmFyIC0g5bem5L6n5Yqf6IO95Yy65YaF5a656Z2i5p2/XG4gKlxuICog5qC55o2uIGFjdGl2ZVJhaWxJdGVtIOaYvuekuuS4jeWQjOWKn+iDveWMuuWGheWuue+8mlxuICogLSBzZXNzaW9uczog5Lya6K+d5YiX6KGo77yIQ2hhdC9BZ2VudCDmqKHlvI/vvIlcbiAqIC0gZmlsZXM6IOW3peS9nOWMuuaWh+S7tuagkVxuICogLSBza2lsbHM6IOaPkuS7tueuoeeQhlxuICogLSBUQSDmqKHlvI/nmoTlkITnp43lip/og73pnaLmnb9cbiAqXG4gKiDkuI3lho3ljIXlkKvmqKHlvI/liIfmjaLlmajvvIjlt7Lnp7voh7MgRnVuY3Rpb25hbFJhaWzvvIlcbiAqL1xuXG5pbXBvcnQgeyB1c2VBdG9tLCB1c2VTZXRBdG9tLCB1c2VBdG9tVmFsdWUsIHVzZVN0b3JlIH0gZnJvbSAnam90YWknXG5pbXBvcnQgeyBDaGF0c0NpcmNsZSB9IGZyb20gJ0BwaG9zcGhvci1pY29ucy9yZWFjdCdcbmltcG9ydCB7XG4gIFBpbixcbiAgUGluT2ZmLFxuICBQbHVzLFxuICBUcmFzaDIsXG4gIFBlbmNpbCxcbiAgQ2hldnJvblJpZ2h0LFxuICBTZWFyY2gsXG4gIEFyY2hpdmUsXG4gIEFyY2hpdmVSZXN0b3JlLFxuICBNb3JlVmVydGljYWwsXG4gIENoZWNrLFxuICBDaGVja1NxdWFyZSxcbiAgU3F1YXJlLFxuICBGb2xkZXJPcGVuLFxuICBIb3VyZ2xhc3MsXG4gIFNldHRpbmdzLFxuICBHcmlwVmVydGljYWwsXG4gIFBhbmVsTGVmdENsb3NlLFxufSBmcm9tICdsdWNpZGUtcmVhY3QnXG5pbXBvcnQgKiBhcyBSZWFjdCBmcm9tICdyZWFjdCdcbmltcG9ydCB7IHRvYXN0IH0gZnJvbSAnc29ubmVyJ1xuXG5pbXBvcnQgeyByZXNvbHZlQWdlbnRTZXNzaW9uTW9kZWxJZCB9IGZyb20gJ0B0YWdlbnQvc2hhcmVkJ1xuaW1wb3J0IHR5cGUge1xuICBDb252ZXJzYXRpb25NZXRhLFxuICBBZ2VudFNlc3Npb25NZXRhLFxuICBXb3Jrc3BhY2VDYXBhYmlsaXRpZXMsXG4gIEFnZW50V29ya3NwYWNlLFxufSBmcm9tICdAdGFnZW50L3NoYXJlZCdcbmltcG9ydCB7XG4gIEFsZXJ0RGlhbG9nLFxuICBBbGVydERpYWxvZ0FjdGlvbixcbiAgQWxlcnREaWFsb2dDYW5jZWwsXG4gIEFsZXJ0RGlhbG9nQ29udGVudCxcbiAgQWxlcnREaWFsb2dEZXNjcmlwdGlvbixcbiAgQWxlcnREaWFsb2dGb290ZXIsXG4gIEFsZXJ0RGlhbG9nSGVhZGVyLFxuICBBbGVydERpYWxvZ1RpdGxlLFxuICBDb250ZXh0TWVudSxcbiAgQ29udGV4dE1lbnVUcmlnZ2VyLFxuICBDb250ZXh0TWVudUNvbnRlbnQsXG4gIENvbnRleHRNZW51SXRlbSxcbiAgQ29udGV4dE1lbnVTZXBhcmF0b3IsXG4gIERyb3Bkb3duTWVudSxcbiAgRHJvcGRvd25NZW51VHJpZ2dlcixcbiAgRHJvcGRvd25NZW51Q29udGVudCxcbiAgRHJvcGRvd25NZW51SXRlbSxcbiAgRHJvcGRvd25NZW51U2VwYXJhdG9yLFxuICBQb3BvdmVyLFxuICBQb3BvdmVyVHJpZ2dlcixcbiAgUG9wb3ZlckNvbnRlbnQsXG4gIFRvb2x0aXAsXG4gIFRvb2x0aXBUcmlnZ2VyLFxuICBUb29sdGlwQ29udGVudCxcbn0gZnJvbSAnQHRhZ2VudC91aSdcbmltcG9ydCB7IFNlc3Npb25TZWFyY2hJbmxpbmUgfSBmcm9tICcuL1Nlc3Npb25TZWFyY2hJbmxpbmUnXG5pbXBvcnQgeyBEcmFmdFNlYXJjaERpYWxvZyB9IGZyb20gJ0AvY29tcG9uZW50cy9kcmFmdC9EcmFmdFNlYXJjaERpYWxvZydcblxuaW1wb3J0IHR5cGUgeyBBY3RpdmVWaWV3IH0gZnJvbSAnQC9hdG9tcy9hY3RpdmUtdmlldydcbmltcG9ydCB0eXBlIHsgU2Vzc2lvbkluZGljYXRvclN0YXR1cyB9IGZyb20gJ0AvYXRvbXMvYWdlbnQtYXRvbXMnXG5cbi8vID09PT09IOmhueebruWIhue7hOexu+WeiyA9PT09PVxuaW50ZXJmYWNlIEFnZW50UHJvamVjdEdyb3VwIHtcbiAgd29ya3NwYWNlOiBBZ2VudFdvcmtzcGFjZVxuICBzZXNzaW9uczogQWdlbnRTZXNzaW9uTWV0YVtdXG59XG5cbi8qKiDmtLvot4PkvJror53nirbmgIHpm4blkIjvvIjov5DooYzkuK0v6Zi75aGeL+acquafpeeci+W3suWujOaIkO+8iSAqL1xuY29uc3QgQUNUSVZFX1NFU1NJT05fU1RBVFVTRVMgPSBuZXcgU2V0PFNlc3Npb25JbmRpY2F0b3JTdGF0dXM+KFsncnVubmluZycsICdibG9ja2VkJywgJ2NvbXBsZXRlZCddKVxuY29uc3QgQUNUSVZFX1NFU1NJT05fU1RBVFVTX1BSSU9SSVRZOiBSZWNvcmQ8U2Vzc2lvbkluZGljYXRvclN0YXR1cywgbnVtYmVyPiA9IHtcbiAgYmxvY2tlZDogMCxcbiAgcnVubmluZzogMSxcbiAgY29tcGxldGVkOiAyLFxuICBpZGxlOiAzLFxufVxuaW1wb3J0IHsgYWN0aXZlVmlld0F0b20gfSBmcm9tICdAL2F0b21zL2FjdGl2ZS12aWV3J1xuaW1wb3J0IHtcbiAgYWdlbnRTZXNzaW9uc0F0b20sXG4gIGFnZW50U0RLTWVzc2FnZXNDYWNoZUF0b20sXG4gIGN1cnJlbnRBZ2VudFNlc3Npb25JZEF0b20sXG4gIGFnZW50U2Vzc2lvbkluZGljYXRvck1hcEF0b20sXG4gIHVudmlld2VkQ29tcGxldGVkU2Vzc2lvbklkc0F0b20sXG4gIHdvcmtpbmdEb25lU2Vzc2lvbklkc0F0b20sXG4gIGFnZW50Q2hhbm5lbElkQXRvbSxcbiAgYWdlbnRNb2RlbElkQXRvbSxcbiAgYWdlbnRTZXNzaW9uQ2hhbm5lbE1hcEF0b20sXG4gIGFnZW50U2Vzc2lvbk1vZGVsTWFwQXRvbSxcbiAgY3VycmVudEFnZW50V29ya3NwYWNlSWRBdG9tLFxuICBhZ2VudFdvcmtzcGFjZXNBdG9tLFxuICB3b3Jrc3BhY2VDYXBhYmlsaXRpZXNWZXJzaW9uQXRvbSxcbiAgYWdlbnREaWZmUGFuZWxUYWJBdG9tLFxuICBhZ2VudERpZmZSZWZyZXNoVmVyc2lvbkF0b20sXG4gIGFnZW50RGlmZlVuc2VlbkNoYW5nZXNBdG9tLFxuICBhZ2VudERpZmZVbnNlZW5GaWxlc0F0b20sXG4gIGFnZW50RGlmZkRhdGFBdG9tLFxuICBhZ2VudFN0cmVhbWluZ1N0YXRlc0F0b20sXG4gIGxpdmVNZXNzYWdlc01hcEF0b20sXG4gIGFnZW50U2Vzc2lvblBlbmRpbmdGaWxlc0F0b20sXG4gIGFnZW50U2Vzc2lvblN0cmVhbWluZ1N0YXRlQXRvbUZhbWlseSxcbiAgYWdlbnRTZXNzaW9uRHJhZnRBdG9tRmFtaWx5LFxuICBhZ2VudFNlc3Npb25EcmFmdEh0bWxBdG9tRmFtaWx5LFxuICBhZ2VudFBlbmRpbmdGaWxlc0F0b21GYW1pbHksXG4gIGJhY2tncm91bmRUYXNrc0F0b21GYW1pbHksXG4gIHNlc3Npb25QZXJzaXN0ZWRQZXJtaXNzaW9uTW9kZUF0b20sXG4gIHNlc3Npb25FeGlzdHNBdG9tLFxuICBjb252ZXJzYXRpb25zQXRvbSxcbn0gZnJvbSAnQC9hdG9tcy9hZ2VudC1hdG9tcydcbmltcG9ydCB7XG4gIGFwcE1vZGVBdG9tLFxuICBhY3RpdmVSYWlsSXRlbUF0b20sXG4gIG5hdmlnYXRpb25TaWRlYmFyT3BlbkF0b20sXG4gIHR5cGUgQXBwTW9kZSxcbiAgdG9wTGV2ZWxNb2RlQXRvbSxcbiAgdHlwZSBSYWlsSXRlbSxcbiAgdHlwZSBUQVJhaWxJdGVtLFxufSBmcm9tICdAL2F0b21zL2FwcC1tb2RlJ1xuaW1wb3J0IHsgY2hhbm5lbHNBdG9tLCBzZWxlY3RlZE1vZGVsQXRvbSB9IGZyb20gJ0AvYXRvbXMvbW9kZWwtYXRvbXMnXG5pbXBvcnQgeyBkcmFmdFNlc3Npb25JZHNBdG9tIH0gZnJvbSAnQC9hdG9tcy9kcmFmdC1zZXNzaW9uLWF0b21zJ1xuaW1wb3J0IHsgZHJhZnRzQXRvbSwgZHJhZnRTZWFyY2hPcGVuQXRvbSB9IGZyb20gJ0AvYXRvbXMvZHJhZnQtYXRvbXMnXG5pbXBvcnQgeyBoYXNFbnZpcm9ubWVudElzc3Vlc0F0b20gfSBmcm9tICdAL2F0b21zL2Vudmlyb25tZW50J1xuaW1wb3J0IHsgcHJldmlld1BhbmVsT3Blbk1hcEF0b20sIHByZXZpZXdGaWxlTWFwQXRvbSB9IGZyb20gJ0AvYXRvbXMvcHJldmlldy1hdG9tcydcblxuaW1wb3J0IHsgc2V0dGluZ3NUYWJBdG9tLCBzZXR0aW5nc09wZW5BdG9tIH0gZnJvbSAnQC9hdG9tcy9zZXR0aW5ncy10YWInXG4vLyBzaWRlYmFyVmlld01vZGVBdG9tIOW3suS4jeWGjeS9v+eUqO+8muW9kuaho+S8muivneeUseW6lemDqCBQb3BvdmVyIOWxleekuu+8jOS4jeWGjeWIh+aNouaVtOmhteinhuWbvlxuaW1wb3J0IHtcbiAgcHJvbXB0Q29uZmlnQXRvbSxcbiAgc2VsZWN0ZWRQcm9tcHRJZEF0b20sXG4gIGNvbnZlcnNhdGlvblByb21wdElkQXRvbSxcbn0gZnJvbSAnQC9hdG9tcy9zeXN0ZW0tcHJvbXB0LWF0b21zJ1xuaW1wb3J0IHtcbiAgdGFic0F0b20sXG4gIGFjdGl2ZVRhYklkQXRvbSxcbiAgYWN0aXZlU2Vzc2lvbklkQXRvbSxcbiAgY2xvc2VUYWIsXG4gIHVwZGF0ZVRhYlRpdGxlLFxuICBzZXNzaW9uVmlld1N0YXRlTWFwQXRvbSxcbn0gZnJvbSAnQC9hdG9tcy90YWItYXRvbXMnXG5pbXBvcnQgeyBoYXNVcGRhdGVBdG9tIH0gZnJvbSAnQC9hdG9tcy91cGRhdGVyJ1xuaW1wb3J0IHsgdXNlclByb2ZpbGVBdG9tIH0gZnJvbSAnQC9hdG9tcy91c2VyLXByb2ZpbGUnXG5cbmltcG9ydCB7IFBsdWdpblNpZGViYXJOYXYgfSBmcm9tICdAL2NvbXBvbmVudHMvYWdlbnQvUGx1Z2luU2lkZWJhck5hdidcbmltcG9ydCB7IGNsZWFyUHJldmlld0NhY2hlRm9yU2Vzc2lvbiB9IGZyb20gJ0AvY29tcG9uZW50cy9kaWZmL0RpZmZUYWJDb250ZW50J1xuaW1wb3J0IHsgRHJhZnRMaXN0UGFuZWwgfSBmcm9tICdAL2NvbXBvbmVudHMvZHJhZnQvRHJhZnRMaXN0UGFuZWwnXG5pbXBvcnQgeyBLYW5iYW5SYWlsQ29udGVudCB9IGZyb20gJ0AvY29tcG9uZW50cy9rYW5iYW4vS2FuYmFuUmFpbENvbnRlbnQnXG5pbXBvcnQge1xuICBTZXNzaW9uTWluaU1hcFBvcG92ZXIsXG4gIHVzZVNlc3Npb25NaW5pTWFwSG92ZXIsXG4gIHR5cGUgU2Vzc2lvbk1pbmlNYXBUeXBlLFxufSBmcm9tICdAL2NvbXBvbmVudHMvc2Vzc2lvbi1wcmV2aWV3L1Nlc3Npb25NaW5pTWFwUG9wb3ZlcidcbmltcG9ydCB7IFRBU2lkZWJhciB9IGZyb20gJ0AvY29tcG9uZW50cy90YS9UQVNpZGViYXInXG5pbXBvcnQgeyBhdXRvbWF0aW9uc0F0b20gfSBmcm9tICdAL2F0b21zL2F1dG9tYXRpb24tYXRvbXMnXG5pbXBvcnQgeyB1c2VPcGVuU2Vzc2lvbiB9IGZyb20gJ0AvaG9va3MvdXNlT3BlblNlc3Npb24nXG5pbXBvcnQgeyB1c2VTeW5jQWN0aXZlVGFiU2lkZUVmZmVjdHMgfSBmcm9tICdAL2hvb2tzL3VzZVN5bmNBY3RpdmVUYWJTaWRlRWZmZWN0cydcbmltcG9ydCB7IHVzZVdvcmtzcGFjZUFjdGlvbnMgfSBmcm9tICdAL2hvb2tzL3VzZVdvcmtzcGFjZUFjdGlvbnMnXG5pbXBvcnQge1xuICByZXBsYWNlQWdlbnRTZXNzaW9uSW5GcmVzaG5lc3NPcmRlcixcbiAgc29ydEFnZW50U2Vzc2lvbnNCeVVwZGF0ZWRBdERlc2MsXG59IGZyb20gJ0AvbGliL2FnZW50LXNlc3Npb24tbGlzdCdcbmltcG9ydCB7IGRldGVjdElzTWFjIH0gZnJvbSAnQC9saWIvcGxhdGZvcm0nXG5cbmltcG9ydCB7XG4gIGdldEFnZW50U2Vzc2lvblZpc3VhbFN0YXRlLFxuICB0eXBlIFNlc3Npb25MZWZ0QWNjZW50LFxufSBmcm9tICdAL2xpYi9hZ2VudC1zZXNzaW9uLXZpc3VhbC1zdGF0ZSdcbmltcG9ydCB7IHJlc29sdmVNb2RlbERpc3BsYXlOYW1lIH0gZnJvbSAnQC9saWIvbW9kZWwtbG9nbydcbmltcG9ydCB7IGNuIH0gZnJvbSAnQC9saWIvdXRpbHMnXG5cbmludGVyZmFjZSBTaWRlYmFySXRlbVByb3BzIHtcbiAgaWNvbjogUmVhY3QuUmVhY3ROb2RlXG4gIGxhYmVsOiBzdHJpbmdcbiAgYWN0aXZlPzogYm9vbGVhblxuICAvKiog5Y+z5L6n6aKd5aSW5YWD57Sg77yI5aaC5bGV5byAL+aUtui1t+eureWktO+8iSAqL1xuICBzdWZmaXg/OiBSZWFjdC5SZWFjdE5vZGVcbiAgb25DbGljaz86ICgpID0+IHZvaWRcbn1cblxuZnVuY3Rpb24gU2lkZWJhckl0ZW0oe1xuICBpY29uLFxuICBsYWJlbCxcbiAgYWN0aXZlLFxuICBzdWZmaXgsXG4gIG9uQ2xpY2ssXG59OiBTaWRlYmFySXRlbVByb3BzKTogUmVhY3QuUmVhY3RFbGVtZW50IHtcbiAgcmV0dXJuIChcbiAgICA8YnV0dG9uXG4gICAgICBvbkNsaWNrPXtvbkNsaWNrfVxuICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgJ3ctZnVsbCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gcHgtMyBweS0yIHJvdW5kZWQtbWQgdGV4dC1bMTNweF0gdHJhbnNpdGlvbi1jb2xvcnMgZHVyYXRpb24tMTAwIHRpdGxlYmFyLW5vLWRyYWcnLFxuICAgICAgICBhY3RpdmVcbiAgICAgICAgICA/ICdiZy1wcmltYXJ5LzEwIHRleHQtZm9yZWdyb3VuZCBzaGFkb3ctWzBfMXB4XzJweF8wX3JnYmEoMCwwLDAsMC4wNSldJ1xuICAgICAgICAgIDogJ3RleHQtZm9yZWdyb3VuZC82MCBob3ZlcjpiZy1wcmltYXJ5LzUgaG92ZXI6dGV4dC1mb3JlZ3JvdW5kJ1xuICAgICAgKX1cbiAgICA+XG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGdhcC0zXCI+XG4gICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZsZXgtc2hyaW5rLTAgdy1bMThweF0gaC1bMThweF1cIj57aWNvbn08L3NwYW4+XG4gICAgICAgIDxzcGFuPntsYWJlbH08L3NwYW4+XG4gICAgICA8L2Rpdj5cbiAgICAgIHtzdWZmaXh9XG4gICAgPC9idXR0b24+XG4gIClcbn1cblxuZXhwb3J0IGludGVyZmFjZSBMZWZ0U2lkZWJhclByb3BzIHtcbiAgLyoqIOWPr+mAieWbuuWumuWuveW6pu+8jOm7mOiupOS9v+eUqCBDU1Mg5ZON5bqU5byP5a695bqmICovXG4gIHdpZHRoPzogbnVtYmVyXG4gIC8qKiDlvZPliY3mv4DmtLvnmoTlip/og73ljLogKi9cbiAgYWN0aXZlUmFpbEl0ZW0/OiBSYWlsSXRlbVxufVxuXG4vKiog5L6n6L655qCP5a+86Iiq6aG55qCH6K+GICovXG50eXBlIFNpZGViYXJJdGVtSWQgPSAncGlubmVkJyB8ICdhbGwtY2hhdHMnXG5cbi8qKiDlr7zoiKrpobnliLDop4blm77nmoTmmKDlsIQgKi9cbmNvbnN0IElURU1fVE9fVklFVzogUmVjb3JkPFNpZGViYXJJdGVtSWQsIEFjdGl2ZVZpZXc+ID0ge1xuICBwaW5uZWQ6ICdjb252ZXJzYXRpb25zJyxcbiAgJ2FsbC1jaGF0cyc6ICdjb252ZXJzYXRpb25zJyxcbn1cblxuLyoqIOaXpeacn+WIhue7hOagh+etviAqL1xudHlwZSBEYXRlR3JvdXAgPSAn5LuK5aSpJyB8ICfmmKjlpKknIHwgJ+abtOaXqSdcblxuLyoqIOaMiSB1cGRhdGVkQXQg5bCG6aG555uu5YiG5Li6IOS7iuWkqSAvIOaYqOWkqSAvIOabtOaXqSDkuInnu4QgKi9cbmZ1bmN0aW9uIGdyb3VwQnlEYXRlPFQgZXh0ZW5kcyB7IHVwZGF0ZWRBdDogbnVtYmVyIH0+KFxuICBpdGVtczogVFtdXG4pOiBBcnJheTx7IGxhYmVsOiBEYXRlR3JvdXA7IGl0ZW1zOiBUW10gfT4ge1xuICBjb25zdCBub3cgPSBuZXcgRGF0ZSgpXG4gIGNvbnN0IHRvZGF5U3RhcnQgPSBuZXcgRGF0ZShub3cuZ2V0RnVsbFllYXIoKSwgbm93LmdldE1vbnRoKCksIG5vdy5nZXREYXRlKCkpLmdldFRpbWUoKVxuICBjb25zdCB5ZXN0ZXJkYXlTdGFydCA9IHRvZGF5U3RhcnQgLSA4Nl80MDBfMDAwXG5cbiAgY29uc3QgdG9kYXk6IFRbXSA9IFtdXG4gIGNvbnN0IHllc3RlcmRheTogVFtdID0gW11cbiAgY29uc3QgZWFybGllcjogVFtdID0gW11cblxuICBmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcbiAgICBpZiAoaXRlbS51cGRhdGVkQXQgPj0gdG9kYXlTdGFydCkge1xuICAgICAgdG9kYXkucHVzaChpdGVtKVxuICAgIH0gZWxzZSBpZiAoaXRlbS51cGRhdGVkQXQgPj0geWVzdGVyZGF5U3RhcnQpIHtcbiAgICAgIHllc3RlcmRheS5wdXNoKGl0ZW0pXG4gICAgfSBlbHNlIHtcbiAgICAgIGVhcmxpZXIucHVzaChpdGVtKVxuICAgIH1cbiAgfVxuXG4gIGNvbnN0IGdyb3VwczogQXJyYXk8eyBsYWJlbDogRGF0ZUdyb3VwOyBpdGVtczogVFtdIH0+ID0gW11cbiAgaWYgKHRvZGF5Lmxlbmd0aCA+IDApIGdyb3Vwcy5wdXNoKHsgbGFiZWw6ICfku4rlpKknLCBpdGVtczogdG9kYXkgfSlcbiAgaWYgKHllc3RlcmRheS5sZW5ndGggPiAwKSBncm91cHMucHVzaCh7IGxhYmVsOiAn5pio5aSpJywgaXRlbXM6IHllc3RlcmRheSB9KVxuICBpZiAoZWFybGllci5sZW5ndGggPiAwKSBncm91cHMucHVzaCh7IGxhYmVsOiAn5pu05pepJywgaXRlbXM6IGVhcmxpZXIgfSlcbiAgcmV0dXJuIGdyb3Vwc1xufVxuXG5mdW5jdGlvbiBnZXRTZXNzaW9uTGVmdEFjY2VudChcbiAgaW5kaWNhdG9yU3RhdHVzOiBTZXNzaW9uSW5kaWNhdG9yU3RhdHVzLFxuICBhY3RpdmU6IGJvb2xlYW4sXG4gIG1hbnVhbFdvcmtpbmc/OiBib29sZWFuXG4pOiBTZXNzaW9uTGVmdEFjY2VudCB7XG4gIGlmIChpbmRpY2F0b3JTdGF0dXMgPT09ICdibG9ja2VkJykgcmV0dXJuICdvcmFuZ2UnXG4gIGlmIChpbmRpY2F0b3JTdGF0dXMgPT09ICdydW5uaW5nJykgcmV0dXJuICdibHVlJ1xuICBpZiAoaW5kaWNhdG9yU3RhdHVzID09PSAnY29tcGxldGVkJykgcmV0dXJuICdncmVlbidcbiAgaWYgKG1hbnVhbFdvcmtpbmcpIHJldHVybiAnYW1iZXInXG4gIGlmIChhY3RpdmUpIHJldHVybiAncHJpbWFyeSdcbiAgcmV0dXJuICdpZGxlJ1xufVxuXG5mdW5jdGlvbiBpc0FnZW50U2Vzc2lvbkluVG9wTGV2ZWxNb2RlKFxuICBzZXNzaW9uOiBBZ2VudFNlc3Npb25NZXRhLFxuICB0b3BMZXZlbE1vZGU6ICdnZW5lcmFsJyB8ICd0YSdcbik6IGJvb2xlYW4ge1xuICAvLyDlt6XkurrlrZDkvJror53vvIjnlLHnnIvmnb8gZGlzcGF0Y2hlciDliJvlu7rvvInkuI3lnKjkvqfmoI/liJfooajmmL7npLpcbiAgLy8g5Y6f5Zug77ya5a6D5Lus5piv55yL5p2/5Lu75Yqh55qE5omn6KGM5a655Zmo77yM6YCa6L+H44CM5Zui6Zif44CNVGFiIOW1jOWll+afpeeci++8jOmBv+WFjeaxoeafk+S4u+S8muivneWIl+ihqFxuICBpZiAoc2Vzc2lvbi5zb3VyY2VLYW5iYW5UYXNrSWQpIHJldHVybiBmYWxzZVxuICByZXR1cm4gKHNlc3Npb24ubW9kZSA/PyAnZ2VuZXJhbCcpID09PSB0b3BMZXZlbE1vZGVcbn1cblxuLyoqIOS4jiBSYWlsIOmmluS4quaMiemSru+8iHNpemUtMTDvvInpvZDlubPnmoTpobbmoI/mjqfku7bmoLflvI8gKi9cbmNvbnN0IFNJREVCQVJfVE9QX0NPTlRST0xfQ0xBU1MgPVxuICAnaC0xMCByb3VuZGVkLVsxMnB4XSBib3JkZXIgYm9yZGVyLWJvcmRlci80MCBiZy1wcmltYXJ5LzUgdGV4dC1bMTFweF0gdGV4dC1mb3JlZ3JvdW5kLzcwIHRyYW5zaXRpb24tY29sb3JzIGR1cmF0aW9uLTEwMCBob3Zlcjpib3JkZXItYm9yZGVyLzcwIGhvdmVyOmJnLXByaW1hcnkvMTAgdGl0bGViYXItbm8tZHJhZydcblxuLyoqIOS+p+agj+mhtuagj+ihjO+8muS4jiBSYWlsIOmmluihjOWFseeUqCBuYXYtaXNsYW5kLWJvZHktc3RhcnQgKyBuYXYtaXNsYW5kLWhlYWRlci1yb3cgKi9cbmZ1bmN0aW9uIFNpZGViYXJUb3BDb250cm9sc1Jvdyh7XG4gIGlzTWFjLFxuICBjaGlsZHJlbixcbn06IHtcbiAgaXNNYWM6IGJvb2xlYW5cbiAgY2hpbGRyZW46IFJlYWN0LlJlYWN0Tm9kZVxufSk6IFJlYWN0LlJlYWN0RWxlbWVudCB7XG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJyZWxhdGl2ZSBzaHJpbmstMCBweC0zIG5hdi1pc2xhbmQtYm9keS1zdGFydFwiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJuYXYtaXNsYW5kLWhlYWRlci1yb3cgZ2FwLTEuNVwiPntjaGlsZHJlbn08L2Rpdj5cbiAgICA8L2Rpdj5cbiAgKVxufVxuXG5leHBvcnQgZnVuY3Rpb24gTGVmdFNpZGViYXIoe1xuICB3aWR0aDogX3dpZHRoLFxuICBhY3RpdmVSYWlsSXRlbSA9ICdzZXNzaW9ucycsXG59OiBMZWZ0U2lkZWJhclByb3BzKTogUmVhY3QuUmVhY3RFbGVtZW50IHwgbnVsbCB7XG4gIC8vIOWuveW6pueUseWkluWxgiBOYXZTaWRlYmFySXNsYW5kIOaOp+WItu+8m193aWR0aCDku4Xkv53nlZkgQVBJIOWFvOWuuVxuICBjb25zdCBbYWN0aXZlVmlldywgc2V0QWN0aXZlVmlld10gPSB1c2VBdG9tKGFjdGl2ZVZpZXdBdG9tKVxuICBjb25zdCBzZXRTZXR0aW5nc1RhYiA9IHVzZVNldEF0b20oc2V0dGluZ3NUYWJBdG9tKVxuICBjb25zdCBzZXRTZXR0aW5nc09wZW4gPSB1c2VTZXRBdG9tKHNldHRpbmdzT3BlbkF0b20pXG4gIGNvbnN0IFtfYWN0aXZlSXRlbSwgc2V0QWN0aXZlSXRlbV0gPSBSZWFjdC51c2VTdGF0ZTxTaWRlYmFySXRlbUlkPignYWxsLWNoYXRzJylcbiAgY29uc3QgW2NvbnZlcnNhdGlvbnMsIHNldENvbnZlcnNhdGlvbnNdID0gdXNlQXRvbShjb252ZXJzYXRpb25zQXRvbSlcbiAgY29uc3QgZHJhZnRTZXNzaW9uSWRzID0gdXNlQXRvbVZhbHVlKGRyYWZ0U2Vzc2lvbklkc0F0b20pXG4gIGNvbnN0IHNldERyYWZ0U2Vzc2lvbklkcyA9IHVzZVNldEF0b20oZHJhZnRTZXNzaW9uSWRzQXRvbSlcbiAgY29uc3Qgc2V0QWdlbnRNZXNzYWdlc0NhY2hlID0gdXNlU2V0QXRvbShhZ2VudFNES01lc3NhZ2VzQ2FjaGVBdG9tKVxuICBjb25zdCBzZXRBdXRvbWF0aW9ucyA9IHVzZVNldEF0b20oYXV0b21hdGlvbnNBdG9tKVxuXG4gIC8qKiDlvoXliKDpmaTlr7nor50gSUTvvIzpnZ7nqbrml7bmmL7npLrnoa7orqTlvLnnqpcgKi9cbiAgY29uc3QgW3BlbmRpbmdEZWxldGVJZCwgc2V0UGVuZGluZ0RlbGV0ZUlkXSA9IFJlYWN0LnVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXG4gIC8qKiDlvoXliKDpmaTpobnnm64gSUTvvIzpnZ7nqbrml7bmmL7npLrpobnnm67liKDpmaTnoa7orqTlvLnnqpcgKi9cbiAgY29uc3QgW3BlbmRpbmdEZWxldGVXb3Jrc3BhY2VJZCwgc2V0UGVuZGluZ0RlbGV0ZVdvcmtzcGFjZUlkXSA9IFJlYWN0LnVzZVN0YXRlPHN0cmluZyB8IG51bGw+KFxuICAgIG51bGxcbiAgKVxuICBjb25zdCBbZGVsZXRpbmdXb3Jrc3BhY2VJZCwgc2V0RGVsZXRpbmdXb3Jrc3BhY2VJZF0gPSBSZWFjdC51c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICAvKiog5oqY5Y+g54q25oCB77ya55So5oi35omL5Yqo5oqY5Y+g55qE6aG555uuIElEIOmbhuWQiCAqL1xuICBjb25zdCBbY29sbGFwc2VkV29ya3NwYWNlSWRzLCBzZXRDb2xsYXBzZWRXb3Jrc3BhY2VJZHNdID0gUmVhY3QudXNlU3RhdGU8U2V0PHN0cmluZz4+KG5ldyBTZXQoKSlcbiAgLyoqIOaLluaLveaOkuW6j++8muato+WcqOaLluaLveeahOW3peS9nOWMuiBJRCAqL1xuICBjb25zdCBbZHJhZ1Byb2plY3RJZCwgc2V0RHJhZ1Byb2plY3RJZF0gPSBSZWFjdC51c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKVxuICAvKiog5ouW5ou95o6S5bqP77yaZHJvcCDmjIfnpLrlmajkvY3nva4geyBpZCwgcG9zaXRpb24gfSAqL1xuICBjb25zdCBbcHJvamVjdERyb3BJbmRpY2F0b3IsIHNldFByb2plY3REcm9wSW5kaWNhdG9yXSA9IFJlYWN0LnVzZVN0YXRlPHtcbiAgICBpZDogc3RyaW5nXG4gICAgcG9zaXRpb246ICdiZWZvcmUnIHwgJ2FmdGVyJ1xuICB9IHwgbnVsbD4obnVsbClcbiAgLyoqIOaJuemHj+WIoOmZpO+8muW9k+WJjeWcqOmAieaLqeaooeW8j+eahOW3peS9nOWMuiBJRO+8iG51bGwgPSDmnKrov5vlhaXpgInmi6nmqKHlvI/vvIkgKi9cbiAgY29uc3QgW2JhdGNoU2VsZWN0V29ya3NwYWNlSWQsIHNldEJhdGNoU2VsZWN0V29ya3NwYWNlSWRdID0gUmVhY3QudXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcbiAgLyoqIOaJuemHj+WIoOmZpO+8mumAieS4reeahOS8muivnSBJRCDpm4blkIggKi9cbiAgY29uc3QgW2JhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzLCBzZXRCYXRjaFNlbGVjdGVkU2Vzc2lvbklkc10gPSBSZWFjdC51c2VTdGF0ZTxTZXQ8c3RyaW5nPj4oXG4gICAgbmV3IFNldCgpXG4gIClcbiAgLyoqIOaJuemHj+WIoOmZpO+8muehruiupOW8ueeql+aYr+WQpuaJk+W8gCAqL1xuICBjb25zdCBbYmF0Y2hEZWxldGVDb25maXJtT3Blbiwgc2V0QmF0Y2hEZWxldGVDb25maXJtT3Blbl0gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW3VzZXJQcm9maWxlLCBzZXRVc2VyUHJvZmlsZV0gPSB1c2VBdG9tKHVzZXJQcm9maWxlQXRvbSlcbiAgY29uc3Qgc2VsZWN0ZWRNb2RlbCA9IHVzZUF0b21WYWx1ZShzZWxlY3RlZE1vZGVsQXRvbSlcbiAgY29uc3QgbW9kZSA9IHVzZUF0b21WYWx1ZShhcHBNb2RlQXRvbSlcbiAgY29uc3QgdG9wTGV2ZWxNb2RlID0gdXNlQXRvbVZhbHVlKHRvcExldmVsTW9kZUF0b20pXG4gIGNvbnN0IGlzTWFjID0gUmVhY3QudXNlTWVtbygoKSA9PiBkZXRlY3RJc01hYygpLCBbXSlcbiAgY29uc3QgaGFzVXBkYXRlID0gdXNlQXRvbVZhbHVlKGhhc1VwZGF0ZUF0b20pXG4gIGNvbnN0IGhhc0Vudmlyb25tZW50SXNzdWVzID0gdXNlQXRvbVZhbHVlKGhhc0Vudmlyb25tZW50SXNzdWVzQXRvbSlcbiAgY29uc3QgcHJvbXB0Q29uZmlnID0gdXNlQXRvbVZhbHVlKHByb21wdENvbmZpZ0F0b20pXG4gIGNvbnN0IHNldFNlbGVjdGVkUHJvbXB0SWQgPSB1c2VTZXRBdG9tKHNlbGVjdGVkUHJvbXB0SWRBdG9tKVxuXG4gIC8vIEFnZW50IOaooeW8j+eKtuaAgVxuICBjb25zdCBbYWdlbnRTZXNzaW9ucywgc2V0QWdlbnRTZXNzaW9uc10gPSB1c2VBdG9tKGFnZW50U2Vzc2lvbnNBdG9tKVxuICBjb25zdCBzZXRTZXNzaW9uQ2hhbm5lbE1hcCA9IHVzZVNldEF0b20oYWdlbnRTZXNzaW9uQ2hhbm5lbE1hcEF0b20pXG4gIGNvbnN0IHNldFNlc3Npb25Nb2RlbE1hcCA9IHVzZVNldEF0b20oYWdlbnRTZXNzaW9uTW9kZWxNYXBBdG9tKVxuICBjb25zdCBzZXNzaW9uTW9kZWxNYXAgPSB1c2VBdG9tVmFsdWUoYWdlbnRTZXNzaW9uTW9kZWxNYXBBdG9tKVxuICBjb25zdCBjdXJyZW50TW9kZUFnZW50U2Vzc2lvbnMgPSBSZWFjdC51c2VNZW1vKFxuICAgICgpID0+IGFnZW50U2Vzc2lvbnMuZmlsdGVyKChzZXNzaW9uKSA9PiBpc0FnZW50U2Vzc2lvbkluVG9wTGV2ZWxNb2RlKHNlc3Npb24sIHRvcExldmVsTW9kZSkpLFxuICAgIFthZ2VudFNlc3Npb25zLCB0b3BMZXZlbE1vZGVdXG4gIClcbiAgY29uc3QgW2RyYWZ0cywgc2V0RHJhZnRzXSA9IHVzZUF0b20oZHJhZnRzQXRvbSlcbiAgY29uc3QgW2RyYWZ0U2VhcmNoT3Blbiwgc2V0RHJhZnRTZWFyY2hPcGVuXSA9IHVzZUF0b20oZHJhZnRTZWFyY2hPcGVuQXRvbSlcbiAgY29uc3QgW2N1cnJlbnRBZ2VudFNlc3Npb25JZCwgc2V0Q3VycmVudEFnZW50U2Vzc2lvbklkXSA9IHVzZUF0b20oY3VycmVudEFnZW50U2Vzc2lvbklkQXRvbSlcbiAgY29uc3QgYWdlbnRJbmRpY2F0b3JNYXAgPSB1c2VBdG9tVmFsdWUoYWdlbnRTZXNzaW9uSW5kaWNhdG9yTWFwQXRvbSlcbiAgY29uc3QgdW52aWV3ZWRDb21wbGV0ZWRTZXNzaW9uSWRzID0gdXNlQXRvbVZhbHVlKHVudmlld2VkQ29tcGxldGVkU2Vzc2lvbklkc0F0b20pXG4gIGNvbnN0IHNldFVudmlld2VkQ29tcGxldGVkID0gdXNlU2V0QXRvbSh1bnZpZXdlZENvbXBsZXRlZFNlc3Npb25JZHNBdG9tKVxuICBjb25zdCBhZ2VudENoYW5uZWxJZCA9IHVzZUF0b21WYWx1ZShhZ2VudENoYW5uZWxJZEF0b20pXG4gIGNvbnN0IGxlZ2FjeUdsb2JhbE1vZGVsSWQgPSB1c2VBdG9tVmFsdWUoYWdlbnRNb2RlbElkQXRvbSlcbiAgY29uc3QgY2hhbm5lbHMgPSB1c2VBdG9tVmFsdWUoY2hhbm5lbHNBdG9tKVxuICBjb25zdCBkZWZhdWx0TW9kZWxGb3JOZXdTZXNzaW9uID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgaWYgKCFhZ2VudENoYW5uZWxJZCkgcmV0dXJuIHVuZGVmaW5lZFxuICAgIGNvbnN0IGNoYW5uZWwgPSBjaGFubmVscy5maW5kKChjKSA9PiBjLmlkID09PSBhZ2VudENoYW5uZWxJZCAmJiBjLmVuYWJsZWQpXG4gICAgcmV0dXJuIHJlc29sdmVBZ2VudFNlc3Npb25Nb2RlbElkKGNoYW5uZWwsIHVuZGVmaW5lZCwgbGVnYWN5R2xvYmFsTW9kZWxJZClcbiAgfSwgW2FnZW50Q2hhbm5lbElkLCBjaGFubmVscywgbGVnYWN5R2xvYmFsTW9kZWxJZF0pXG4gIGNvbnN0IGN1cnJlbnRXb3Jrc3BhY2VJZCA9IHVzZUF0b21WYWx1ZShjdXJyZW50QWdlbnRXb3Jrc3BhY2VJZEF0b20pXG4gIGNvbnN0IHNldEN1cnJlbnRXb3Jrc3BhY2VJZCA9IHVzZVNldEF0b20oY3VycmVudEFnZW50V29ya3NwYWNlSWRBdG9tKVxuICBjb25zdCBbd29ya3NwYWNlcywgc2V0V29ya3NwYWNlc10gPSB1c2VBdG9tKGFnZW50V29ya3NwYWNlc0F0b20pXG4gIGNvbnN0IHsgc2VsZWN0V29ya3NwYWNlLCBjcmVhdGVQcm9qZWN0IH0gPSB1c2VXb3Jrc3BhY2VBY3Rpb25zKClcblxuICAvKiog5b2T5YmN5bel5L2c5Yy65ZCN56ew77yI55So5LqO55uu5b2V5Yy66aG256uv5bel5L2c5Yy66YCJ5oup5oyJ6ZKu5pi+56S677yJICovXG4gIGNvbnN0IGN1cnJlbnRXb3Jrc3BhY2VOYW1lID0gUmVhY3QudXNlTWVtbyhcbiAgICAoKSA9PiB3b3Jrc3BhY2VzLmZpbmQoKHcpID0+IHcuaWQgPT09IGN1cnJlbnRXb3Jrc3BhY2VJZCk/Lm5hbWUgPz8gbnVsbCxcbiAgICBbd29ya3NwYWNlcywgY3VycmVudFdvcmtzcGFjZUlkXVxuICApXG5cbiAgLy8g5bel5L2c5Yy66IO95Yqb77yITUNQICsgU2tpbGwg6K6h5pWw77yJXG4gIGNvbnN0IFtjYXBhYmlsaXRpZXMsIHNldENhcGFiaWxpdGllc10gPSBSZWFjdC51c2VTdGF0ZTxXb3Jrc3BhY2VDYXBhYmlsaXRpZXMgfCBudWxsPihudWxsKVxuICBjb25zdCBjYXBhYmlsaXRpZXNWZXJzaW9uID0gdXNlQXRvbVZhbHVlKHdvcmtzcGFjZUNhcGFiaWxpdGllc1ZlcnNpb25BdG9tKVxuXG4gIC8vIFRhYiDnirbmgIFcbiAgY29uc3QgW3RhYnMsIHNldFRhYnNdID0gdXNlQXRvbSh0YWJzQXRvbSlcbiAgY29uc3QgW2FjdGl2ZVRhYklkLCBzZXRBY3RpdmVUYWJJZF0gPSB1c2VBdG9tKGFjdGl2ZVRhYklkQXRvbSlcbiAgLy8g5Lya6K+d6auY5Lqu5oyJXCLmv4DmtLsgVGFiIOaJgOWxnuS8muivnVwi5Yik5a6a77ya6aKE6KeIIFRhYiDmv4DmtLvml7blhbYgb3duZXIg5Lya6K+d5LuN5L+d5oyB6auY5LquXG4gIGNvbnN0IGFjdGl2ZVNlc3Npb25JZCA9IHVzZUF0b21WYWx1ZShhY3RpdmVTZXNzaW9uSWRBdG9tKVxuICBjb25zdCBvcGVuU2Vzc2lvbiA9IHVzZU9wZW5TZXNzaW9uKClcbiAgY29uc3Qgc3luY0FjdGl2ZVRhYlNpZGVFZmZlY3RzID0gdXNlU3luY0FjdGl2ZVRhYlNpZGVFZmZlY3RzKClcbiAgY29uc3Qgc3RvcmUgPSB1c2VTdG9yZSgpXG5cbiAgLy8g5b2S5qGj5Lya6K+d5bey5LuO5Li75YiX6KGo5YiG56a777yM55Sx5bqV6YOoIFBvcG92ZXIg54us56uL5bGV56S6XG4gIGNvbnN0IHNldE5hdmlnYXRpb25TaWRlYmFyT3BlbiA9IHVzZVNldEF0b20obmF2aWdhdGlvblNpZGViYXJPcGVuQXRvbSlcblxuICAvLyDpgInkuK3kvJror53lj5jljJbml7bvvIzoh6rliqjmu5rliqjkvqfmoI/kvb/lr7nlupTpobnlj6/op4FcbiAgUmVhY3QudXNlRWZmZWN0KCgpID0+IHtcbiAgICBpZiAoIWFjdGl2ZVNlc3Npb25JZCkgcmV0dXJuXG4gICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgIGNvbnN0IGVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgW2RhdGEtc2Vzc2lvbi1saXN0LWlkPVwiJHthY3RpdmVTZXNzaW9uSWR9XCJdYClcbiAgICAgIGVsPy5zY3JvbGxJbnRvVmlldyh7IGJsb2NrOiAnbmVhcmVzdCcsIGJlaGF2aW9yOiAnc21vb3RoJyB9KVxuICAgIH0pXG4gIH0sIFthY3RpdmVTZXNzaW9uSWRdKVxuXG4gIC8vIHBlci1jb252ZXJzYXRpb24vc2Vzc2lvbiBNYXAgYXRvbXPvvIjliKDpmaTml7bmuIXnkIbvvIlcbiAgY29uc3Qgc2V0Q29udlByb21wdElkID0gdXNlU2V0QXRvbShjb252ZXJzYXRpb25Qcm9tcHRJZEF0b20pXG4gIGNvbnN0IHNldFByZXZpZXdQYW5lbE9wZW4gPSB1c2VTZXRBdG9tKHByZXZpZXdQYW5lbE9wZW5NYXBBdG9tKVxuICBjb25zdCBzZXRQcmV2aWV3RmlsZSA9IHVzZVNldEF0b20ocHJldmlld0ZpbGVNYXBBdG9tKVxuICBjb25zdCBzZXREaWZmUGFuZWxUYWIgPSB1c2VTZXRBdG9tKGFnZW50RGlmZlBhbmVsVGFiQXRvbSlcbiAgY29uc3Qgc2V0RGlmZlJlZnJlc2hWZXJzaW9uID0gdXNlU2V0QXRvbShhZ2VudERpZmZSZWZyZXNoVmVyc2lvbkF0b20pXG4gIGNvbnN0IHNldERpZmZVbnNlZW4gPSB1c2VTZXRBdG9tKGFnZW50RGlmZlVuc2VlbkNoYW5nZXNBdG9tKVxuICBjb25zdCBzZXREaWZmVW5zZWVuRmlsZXMgPSB1c2VTZXRBdG9tKGFnZW50RGlmZlVuc2VlbkZpbGVzQXRvbSlcbiAgY29uc3Qgc2V0RGlmZkRhdGEgPSB1c2VTZXRBdG9tKGFnZW50RGlmZkRhdGFBdG9tKVxuICBjb25zdCBzZXRXb3JraW5nRG9uZSA9IHVzZVNldEF0b20od29ya2luZ0RvbmVTZXNzaW9uSWRzQXRvbSlcbiAgY29uc3Qgc2V0U3RyZWFtaW5nU3RhdGVzID0gdXNlU2V0QXRvbShhZ2VudFN0cmVhbWluZ1N0YXRlc0F0b20pXG4gIGNvbnN0IHNldExpdmVNZXNzYWdlc01hcCA9IHVzZVNldEF0b20obGl2ZU1lc3NhZ2VzTWFwQXRvbSlcbiAgY29uc3Qgc2V0U2Vzc2lvblBlbmRpbmdGaWxlcyA9IHVzZVNldEF0b20oYWdlbnRTZXNzaW9uUGVuZGluZ0ZpbGVzQXRvbSlcbiAgY29uc3Qgc2V0U2Vzc2lvblZpZXdTdGF0ZU1hcCA9IHVzZVNldEF0b20oc2Vzc2lvblZpZXdTdGF0ZU1hcEF0b20pXG5cbiAgLyoqIOa4heeQhiBwZXItY29udmVyc2F0aW9uL3Nlc3Npb24gTWFwIGF0b21zIOadoeebriAqL1xuICBjb25zdCBjbGVhbnVwTWFwQXRvbXMgPSBSZWFjdC51c2VDYWxsYmFjayhcbiAgICAoaWQ6IHN0cmluZykgPT4ge1xuICAgICAgY29uc3QgZGVsZXRlS2V5ID0gPFQsPihwcmV2OiBNYXA8c3RyaW5nLCBUPik6IE1hcDxzdHJpbmcsIFQ+ID0+IHtcbiAgICAgICAgaWYgKCFwcmV2LmhhcyhpZCkpIHJldHVybiBwcmV2XG4gICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAocHJldilcbiAgICAgICAgbWFwLmRlbGV0ZShpZClcbiAgICAgICAgcmV0dXJuIG1hcFxuICAgICAgfVxuICAgICAgc2V0Q29udlByb21wdElkKGRlbGV0ZUtleSlcbiAgICAgIHNldFByZXZpZXdQYW5lbE9wZW4oZGVsZXRlS2V5KVxuICAgICAgc2V0UHJldmlld0ZpbGUoZGVsZXRlS2V5KVxuICAgICAgc2V0RGlmZlBhbmVsVGFiKGRlbGV0ZUtleSlcbiAgICAgIHNldERpZmZSZWZyZXNoVmVyc2lvbihkZWxldGVLZXkpXG4gICAgICBzZXREaWZmVW5zZWVuKGRlbGV0ZUtleSlcbiAgICAgIHNldERpZmZVbnNlZW5GaWxlcyhkZWxldGVLZXkpXG4gICAgICBzZXREaWZmRGF0YShkZWxldGVLZXkpXG4gICAgICBzZXRTZXNzaW9uQ2hhbm5lbE1hcChkZWxldGVLZXkpXG4gICAgICBzZXRTZXNzaW9uTW9kZWxNYXAoZGVsZXRlS2V5KVxuICAgICAgLy8g6KeG5Zu+54q25oCB77yI6aKE6KeI5byA5YWzICsg5LiK5qyh6KeG5Zu+77yJ77ya5Yig6ZmkL+W9kuaho+aYr+e7iOaAge+8jOe7n+S4gOa4heeQhumBv+WFjeWtpOeri+adoeebrlxuICAgICAgc2V0U2Vzc2lvblZpZXdTdGF0ZU1hcChkZWxldGVLZXkpXG5cbiAgICAgIC8vIOmHjeWei+a1geW8j+aVsOaNru+8mnN0cmVhbWluZ1N0YXRlc++8iOe0r+enryBjb250ZW50ICsgdG9vbEFjdGl2aXRpZXPvvInkuI4gbGl2ZU1lc3NhZ2Vz77yIU0RLIOa2iOaBr+aVsOe7hO+8iVxuICAgICAgc2V0U3RyZWFtaW5nU3RhdGVzKGRlbGV0ZUtleSlcbiAgICAgIHNldExpdmVNZXNzYWdlc01hcChkZWxldGVLZXkpXG5cbiAgICAgIC8vIOW+heWPkemAgemZhOS7tu+8muWFiOmHiuaUviBibG9iIFVSTCDlkowgd2luZG93IOe8k+WtmOS4reeahCBiYXNlNjTvvIzlho3liKAgYmFzZSBtYXAgZW50cnnjgIJcbiAgICAgIC8vIOS4juaWh+Wtl+iNieeov+S4jeWQjO+8jOmZhOS7tua2ieWPiiBPYmplY3RVUkwg5ZKM5aSn5L2T56ev5LqM6L+b5Yi25pWw5o2u77yM5Yig6ZmkL+W9kuaho+aXtuS4jeS/neeVmeOAglxuICAgICAgY29uc3Qgc2Vzc2lvblBlbmRpbmcgPSBzdG9yZS5nZXQoYWdlbnRTZXNzaW9uUGVuZGluZ0ZpbGVzQXRvbSkuZ2V0KGlkKVxuICAgICAgaWYgKHNlc3Npb25QZW5kaW5nICYmIHNlc3Npb25QZW5kaW5nLmxlbmd0aCA+IDApIHtcbiAgICAgICAgZm9yIChjb25zdCBmIG9mIHNlc3Npb25QZW5kaW5nKSB7XG4gICAgICAgICAgaWYgKGYucHJldmlld1VybD8uc3RhcnRzV2l0aCgnYmxvYjonKSkgVVJMLnJldm9rZU9iamVjdFVSTChmLnByZXZpZXdVcmwpXG4gICAgICAgICAgd2luZG93Ll9fcGVuZGluZ0FnZW50RmlsZURhdGE/LmRlbGV0ZShmLmlkKVxuICAgICAgICB9XG4gICAgICAgIHNldFNlc3Npb25QZW5kaW5nRmlsZXMoZGVsZXRlS2V5KVxuICAgICAgfVxuXG4gICAgICAvLyBhdG9tRmFtaWx5IOWGhemDqOe8k+WtmO+8iEpvdGFpIOWvuSBzdHJpbmcga2V5IOW8uuW8leeUqCBNYXDvvIzkuI3mmL7lvI8gcmVtb3ZlIOawuOS4jemHiuaUvu+8ieOAglxuICAgICAgLy8g5Yig6ZmkL+W9kuaho+aYr+S8muivneeahOe7iOaAge+8jOi/nuWQjOiNieeov+S4gOi1t+a4heeQhu+8jOaXoOmcgOWDj+WFs+mXrSBUYWIg6YKj5qC35L+d55WZ5Y+v5oGi5aSN6L6T5YWl44CCXG4gICAgICBhZ2VudFNlc3Npb25TdHJlYW1pbmdTdGF0ZUF0b21GYW1pbHkucmVtb3ZlKGlkKVxuICAgICAgYWdlbnRTZXNzaW9uRHJhZnRBdG9tRmFtaWx5LnJlbW92ZShpZClcbiAgICAgIGFnZW50U2Vzc2lvbkRyYWZ0SHRtbEF0b21GYW1pbHkucmVtb3ZlKGlkKVxuICAgICAgYWdlbnRQZW5kaW5nRmlsZXNBdG9tRmFtaWx5LnJlbW92ZShpZClcbiAgICAgIGJhY2tncm91bmRUYXNrc0F0b21GYW1pbHkucmVtb3ZlKGlkKVxuICAgICAgc2Vzc2lvblBlcnNpc3RlZFBlcm1pc3Npb25Nb2RlQXRvbS5yZW1vdmUoaWQpXG4gICAgICBzZXNzaW9uRXhpc3RzQXRvbS5yZW1vdmUoaWQpXG5cbiAgICAgIGNsZWFyUHJldmlld0NhY2hlRm9yU2Vzc2lvbihpZClcbiAgICB9LFxuICAgIFtcbiAgICAgIHNldENvbnZQcm9tcHRJZCxcbiAgICAgIHNldFByZXZpZXdQYW5lbE9wZW4sXG4gICAgICBzZXRQcmV2aWV3RmlsZSxcbiAgICAgIHNldERpZmZQYW5lbFRhYixcbiAgICAgIHNldERpZmZSZWZyZXNoVmVyc2lvbixcbiAgICAgIHNldERpZmZVbnNlZW4sXG4gICAgICBzZXREaWZmVW5zZWVuRmlsZXMsXG4gICAgICBzZXREaWZmRGF0YSxcbiAgICAgIHNldFNlc3Npb25DaGFubmVsTWFwLFxuICAgICAgc2V0U2Vzc2lvbk1vZGVsTWFwLFxuICAgICAgc2V0U2Vzc2lvblZpZXdTdGF0ZU1hcCxcbiAgICAgIHNldFN0cmVhbWluZ1N0YXRlcyxcbiAgICAgIHNldExpdmVNZXNzYWdlc01hcCxcbiAgICAgIHNldFNlc3Npb25QZW5kaW5nRmlsZXMsXG4gICAgICBzdG9yZSxcbiAgICBdXG4gIClcblxuICBjb25zdCBjdXJyZW50V29ya3NwYWNlU2x1ZyA9IFJlYWN0LnVzZU1lbW8oKCkgPT4ge1xuICAgIGlmICghY3VycmVudFdvcmtzcGFjZUlkKSByZXR1cm4gbnVsbFxuICAgIHJldHVybiB3b3Jrc3BhY2VzLmZpbmQoKHcpID0+IHcuaWQgPT09IGN1cnJlbnRXb3Jrc3BhY2VJZCk/LnNsdWcgPz8gbnVsbFxuICB9LCBbY3VycmVudFdvcmtzcGFjZUlkLCB3b3Jrc3BhY2VzXSlcblxuICBjb25zdCB3b3Jrc3BhY2VOYW1lTWFwID0gUmVhY3QudXNlTWVtbygoKSA9PiB7XG4gICAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKVxuICAgIGZvciAoY29uc3QgdyBvZiB3b3Jrc3BhY2VzKSBtYXAuc2V0KHcuaWQsIHcubmFtZSlcbiAgICByZXR1cm4gbWFwXG4gIH0sIFt3b3Jrc3BhY2VzXSlcblxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIGlmICghY3VycmVudFdvcmtzcGFjZVNsdWcgfHwgbW9kZSAhPT0gJ2FnZW50Jykge1xuICAgICAgc2V0Q2FwYWJpbGl0aWVzKG51bGwpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgd2luZG93LmVsZWN0cm9uQVBJXG4gICAgICAuZ2V0V29ya3NwYWNlQ2FwYWJpbGl0aWVzKGN1cnJlbnRXb3Jrc3BhY2VTbHVnKVxuICAgICAgLnRoZW4oc2V0Q2FwYWJpbGl0aWVzKVxuICAgICAgLmNhdGNoKGNvbnNvbGUuZXJyb3IpXG4gIH0sIFtjdXJyZW50V29ya3NwYWNlU2x1ZywgbW9kZSwgYWN0aXZlVmlldywgY2FwYWJpbGl0aWVzVmVyc2lvbl0pXG5cbiAgLyoqIOe9rumhtuS8muivneWIl+ihqO+8iOmdnuW9kuaho+OAgemdnuiNieeov++8iSAqL1xuICBjb25zdCBwaW5uZWRBZ2VudFNlc3Npb25zID0gUmVhY3QudXNlTWVtbyhcbiAgICAoKSA9PlxuICAgICAgY3VycmVudE1vZGVBZ2VudFNlc3Npb25zXG4gICAgICAgIC5maWx0ZXIoKHMpID0+IHMucGlubmVkICYmICFzLmFyY2hpdmVkICYmICFkcmFmdFNlc3Npb25JZHMuaGFzKHMuaWQpKVxuICAgICAgICAuc29ydCgoYSwgYikgPT4gYi51cGRhdGVkQXQgLSBhLnVwZGF0ZWRBdCksXG4gICAgW2N1cnJlbnRNb2RlQWdlbnRTZXNzaW9ucywgZHJhZnRTZXNzaW9uSWRzXVxuICApXG5cbiAgLyoqXG4gICAqIOW3suW9kuahoyBBZ2VudCDkvJror53mlbDph4/vvIjlvZPliY3mqKHlvI/lhajpg6jlt6XkvZzljLrvvInjgIJcbiAgICog5Y+q6KaB5Lu75LiA5bel5L2c5Yy65pyJ5b2S5qGj5bCx5pi+56S65bqV5qCP5YWl5Y+j77yM5LiN6ZqP44CM5b2T5YmN6YCJ5Lit5bel5L2c5Yy644CN6ZqQ6JeP44CCXG4gICAqL1xuICBjb25zdCBhcmNoaXZlZEFnZW50U2Vzc2lvbkNvdW50ID0gUmVhY3QudXNlTWVtbyhcbiAgICAoKSA9PiBjdXJyZW50TW9kZUFnZW50U2Vzc2lvbnMuZmlsdGVyKChzKSA9PiBzLmFyY2hpdmVkICYmICFkcmFmdFNlc3Npb25JZHMuaGFzKHMuaWQpKS5sZW5ndGgsXG4gICAgW2N1cnJlbnRNb2RlQWdlbnRTZXNzaW9ucywgZHJhZnRTZXNzaW9uSWRzXVxuICApXG5cbiAgLyoqIOW9kuaho+S8muivneWIl+ihqO+8mui3qOW3peS9nOWMuuaxh+aAu++8jOaMiSB1cGRhdGVkQXQg5YCS5bqP77yI6KGM5YaF5LuN5bGV56S65bel5L2c5Yy65ZCN77yJICovXG4gIGNvbnN0IGFyY2hpdmVkQWdlbnRTZXNzaW9uc0xpc3QgPSBSZWFjdC51c2VNZW1vKFxuICAgICgpID0+XG4gICAgICBjdXJyZW50TW9kZUFnZW50U2Vzc2lvbnNcbiAgICAgICAgLmZpbHRlcigocykgPT4gcy5hcmNoaXZlZCAmJiAhZHJhZnRTZXNzaW9uSWRzLmhhcyhzLmlkKSlcbiAgICAgICAgLnNvcnQoKGEsIGIpID0+IGIudXBkYXRlZEF0IC0gYS51cGRhdGVkQXQpLFxuICAgIFtjdXJyZW50TW9kZUFnZW50U2Vzc2lvbnMsIGRyYWZ0U2Vzc2lvbklkc11cbiAgKVxuXG4gIC8vIOWIneWni+WKoOi9veWvueivneWIl+ihqCArIOeUqOaIt+aho+ahiCArIEFnZW50IOS8muivnVxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIHdpbmRvdy5lbGVjdHJvbkFQSVxuICAgICAgLmxpc3RDb252ZXJzYXRpb25zKClcbiAgICAgIC50aGVuKChsaXN0KSA9PiB7XG4gICAgICAgIHNldENvbnZlcnNhdGlvbnMobGlzdClcbiAgICAgIH0pXG4gICAgICAuY2F0Y2goY29uc29sZS5lcnJvcilcbiAgICB3aW5kb3cuZWxlY3Ryb25BUEkuZ2V0VXNlclByb2ZpbGUoKS50aGVuKHNldFVzZXJQcm9maWxlKS5jYXRjaChjb25zb2xlLmVycm9yKVxuICAgIHdpbmRvdy5lbGVjdHJvbkFQSVxuICAgICAgLmxpc3RBZ2VudFNlc3Npb25zKClcbiAgICAgIC50aGVuKChzZXNzaW9ucykgPT4ge1xuICAgICAgICBzZXRBZ2VudFNlc3Npb25zKHNlc3Npb25zKVxuICAgICAgICAvLyDku44gc2Vzc2lvbiBtZXRhZGF0YSDmgaLlpI0gcGVyLXNlc3Npb24g5rig6YGTL+aooeWei+mAieaLqVxuICAgICAgICBzZXRTZXNzaW9uQ2hhbm5lbE1hcCgocHJldikgPT4ge1xuICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHByZXYpXG4gICAgICAgICAgZm9yIChjb25zdCBzIG9mIHNlc3Npb25zKSB7XG4gICAgICAgICAgICBpZiAocy5jaGFubmVsSWQpIG5leHQuc2V0KHMuaWQsIHMuY2hhbm5lbElkKVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICB9KVxuICAgICAgICBzZXRTZXNzaW9uTW9kZWxNYXAoKHByZXYpID0+IHtcbiAgICAgICAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChwcmV2KVxuICAgICAgICAgIGZvciAoY29uc3QgcyBvZiBzZXNzaW9ucykge1xuICAgICAgICAgICAgaWYgKHMubW9kZWxJZCkgbmV4dC5zZXQocy5pZCwgcy5tb2RlbElkKVxuICAgICAgICAgIH1cbiAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICB9KVxuICAgICAgfSlcbiAgICAgIC5jYXRjaChjb25zb2xlLmVycm9yKVxuICB9LCBbc2V0Q29udmVyc2F0aW9ucywgc2V0VXNlclByb2ZpbGUsIHNldEFnZW50U2Vzc2lvbnMsIHNldFNlc3Npb25DaGFubmVsTWFwLCBzZXRTZXNzaW9uTW9kZWxNYXBdKVxuXG4gIC8vIOW6lOeUqOWQr+WKqOWQjuS4u+WKqOinpuWPkeS4gOasoeiHquWKqOW9kuaho++8jOehruS/nemVv+acn+acqua0u+WKqOeahOS8muivnei/m+WFpeW9kuaho+iAjOmdnumakOiXj+S4jeWPr+ingVxuICBSZWFjdC51c2VFZmZlY3QoKCkgPT4ge1xuICAgIHdpbmRvdy5lbGVjdHJvbkFQSVxuICAgICAgLnJ1bkF1dG9BcmNoaXZlKClcbiAgICAgIC50aGVuKChjb3VudCkgPT4ge1xuICAgICAgICBpZiAoY291bnQgPiAwKSB7XG4gICAgICAgICAgY29uc29sZS5sb2coYFvkvqfovrnmoI9dIOiHquWKqOW9kuaho+S6hiAke2NvdW50fSDkuKrov4fmnJ/kvJror51gKVxuICAgICAgICAgIC8vIOW9kuaho+WQjuWIt+aWsOWIl+ihqFxuICAgICAgICAgIHdpbmRvdy5lbGVjdHJvbkFQSS5saXN0QWdlbnRTZXNzaW9ucygpLnRoZW4oc2V0QWdlbnRTZXNzaW9ucykuY2F0Y2goY29uc29sZS5lcnJvcilcbiAgICAgICAgfVxuICAgICAgfSlcbiAgICAgIC5jYXRjaChjb25zb2xlLmVycm9yKVxuICB9LCBbc2V0QWdlbnRTZXNzaW9uc10pXG5cbiAgLy8g56qX5Y+j6IGa54Sm5pe26YeN5paw5ZCM5q2l5YiX6KGo77yM5L+u5aSN6ZW/5pe26Ze05ZCO5YmN5ZCO56uv5LiN5LiA6Ie0XG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaGFuZGxlRm9jdXMgPSAoKTogdm9pZCA9PiB7XG4gICAgICB3aW5kb3cuZWxlY3Ryb25BUEkubGlzdENvbnZlcnNhdGlvbnMoKS50aGVuKHNldENvbnZlcnNhdGlvbnMpLmNhdGNoKGNvbnNvbGUuZXJyb3IpXG4gICAgICB3aW5kb3cuZWxlY3Ryb25BUElcbiAgICAgICAgLmxpc3RBZ2VudFNlc3Npb25zKClcbiAgICAgICAgLnRoZW4oKHNlc3Npb25zKSA9PiB7XG4gICAgICAgICAgc2V0QWdlbnRTZXNzaW9ucyhzZXNzaW9ucylcbiAgICAgICAgICAvLyDlkIzmraXmgaLlpI0gcGVyLXNlc3Npb24g5rig6YGTL+aooeWei1xuICAgICAgICAgIHNldFNlc3Npb25DaGFubmVsTWFwKChwcmV2KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChwcmV2KVxuICAgICAgICAgICAgZm9yIChjb25zdCBzIG9mIHNlc3Npb25zKSB7XG4gICAgICAgICAgICAgIGlmIChzLmNoYW5uZWxJZCkgbmV4dC5zZXQocy5pZCwgcy5jaGFubmVsSWQpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICAgIH0pXG4gICAgICAgICAgc2V0U2Vzc2lvbk1vZGVsTWFwKChwcmV2KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBuZXh0ID0gbmV3IE1hcChwcmV2KVxuICAgICAgICAgICAgZm9yIChjb25zdCBzIG9mIHNlc3Npb25zKSB7XG4gICAgICAgICAgICAgIGlmIChzLm1vZGVsSWQpIG5leHQuc2V0KHMuaWQsIHMubW9kZWxJZClcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHJldHVybiBuZXh0XG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICAgICAgLmNhdGNoKGNvbnNvbGUuZXJyb3IpXG4gICAgfVxuICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKCdmb2N1cycsIGhhbmRsZUZvY3VzKVxuICAgIHJldHVybiAoKSA9PiB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignZm9jdXMnLCBoYW5kbGVGb2N1cylcbiAgfSwgW3NldENvbnZlcnNhdGlvbnMsIHNldEFnZW50U2Vzc2lvbnNdKVxuXG4gIC8qKiDlpITnkIblr7zoiKrpobnngrnlh7sgKi9cbiAgY29uc3QgaGFuZGxlSXRlbUNsaWNrID0gKGl0ZW06IFNpZGViYXJJdGVtSWQpOiB2b2lkID0+IHtcbiAgICBzZXRBY3RpdmVJdGVtKGl0ZW0pXG4gICAgc2V0QWN0aXZlVmlldyhJVEVNX1RPX1ZJRVdbaXRlbV0pXG4gIH1cblxuICAvKiog6K+35rGC5Yig6Zmk5Lya6K+d77yIQWdlbnQg5YWx55So77yM5by55Ye656Gu6K6k5qGG77yJICovXG4gIGNvbnN0IGhhbmRsZVJlcXVlc3REZWxldGUgPSBSZWFjdC51c2VDYWxsYmFjaygoaWQ6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgIHNldFBlbmRpbmdEZWxldGVJZChpZClcbiAgfSwgW10pXG5cbiAgLyoqIOehruiupOWIoOmZpOS8muivne+8iEFnZW50IC8g5Y6G5Y+yIENoYXQg5YWx55So77yJICovXG4gIGNvbnN0IGhhbmRsZUNvbmZpcm1EZWxldGUgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgaWYgKCFwZW5kaW5nRGVsZXRlSWQpIHJldHVyblxuXG4gICAgLy8g5YWz6Zet5a+55bqU55qE5qCH562+6aG177yac2V0VGFicyDkuI4gc2V0QWN0aXZlVGFiSWQg5oiQ57uE5pu05paw77yM5L6/5LqO6ZiF6K+777yMXG4gICAgLy8g5Lmf6YG/5YWN5bCG5p2l5Zyo5Lik6ICF5LmL6Ze05oSP5aSW5o+S5YWlIGF3YWl0IOWvvOiHtOi3qOa4suafk+eKtuaAgeS4jeS4gOiHtOOAglxuICAgIC8vIO+8iFJlYWN0IDE4IOWcqOWQjOS4gOS6i+S7tuWbnuiwg+S4reS8muiHquWKqOaJueWkhOeQhuWkmuasoSBzZXRTdGF0Ze+8jOaJgOS7peWNleasoea4suafk1xuICAgIC8vIOeahOS4gOiHtOaAp+eUsSBSZWFjdCDkv53or4HvvIzov5nph4zlj6rmmK/kv53mjIHku6PnoIHnu4Tnu4fmuIXmmbDjgILvvIlcbiAgICAvLyDms6jmhI/vvJpkcmFmdCB0YWIg55qEIGlkIOagvOW8j+S4uiBfX2RyYWZ0X186PGRyYWZ0SWQ+77yM6ZyA6KaB5LuOIHRhYnMg5YiX6KGo5p+l5om+XG4gICAgY29uc3QgdGFiVG9DbG9zZSA9IHRhYnMuZmluZCgodCkgPT4gdC5zZXNzaW9uSWQgPT09IHBlbmRpbmdEZWxldGVJZClcbiAgICBjb25zdCB0YWJJZFRvQ2xvc2UgPSB0YWJUb0Nsb3NlPy5pZCA/PyBwZW5kaW5nRGVsZXRlSWRcbiAgICBjb25zdCB3YXNBY3RpdmUgPSBhY3RpdmVUYWJJZCA9PT0gdGFiSWRUb0Nsb3NlXG4gICAgY29uc3QgdGFiUmVzdWx0ID0gY2xvc2VUYWIodGFicywgYWN0aXZlVGFiSWQsIHRhYklkVG9DbG9zZSlcbiAgICBzZXRUYWJzKHRhYlJlc3VsdC50YWJzKVxuICAgIHNldEFjdGl2ZVRhYklkKHRhYlJlc3VsdC5hY3RpdmVUYWJJZClcblxuICAgIC8vIOiLpeWFs+mXreeahOaYr+W9k+WJjea0u+i3g+agh+etvu+8jOWQjOatpeaWsOa/gOa0u+agh+etvueahOWJr+S9nOeUqO+8iGFwcE1vZGXjgIFcbiAgICAvLyBjdXJyZW50WHh4SWTjgIHku6Xlj4rlj7Pkvqfmlofku7bpnaLmnb/nrYkgcGVyLXRhYiDnirbmgIHvvInvvIzkv53mjIHkuI4gVGFiQmFyXG4gICAgLy8g5YWz6Zet6YC76L6R5LiA6Ie077yM6YG/5YWN5Yig6ZmkL+W9kuaho+W9k+WJjeS8muivneWQjuaWsOagh+etvueKtuaAgee8uuWkseOAglxuICAgIGlmICh3YXNBY3RpdmUpIHtcbiAgICAgIGNvbnN0IG5ld0FjdGl2ZVRhYiA9IHRhYlJlc3VsdC5hY3RpdmVUYWJJZFxuICAgICAgICA/ICh0YWJSZXN1bHQudGFicy5maW5kKCh0KSA9PiB0LmlkID09PSB0YWJSZXN1bHQuYWN0aXZlVGFiSWQpID8/IG51bGwpXG4gICAgICAgIDogbnVsbFxuICAgICAgc3luY0FjdGl2ZVRhYlNpZGVFZmZlY3RzKG5ld0FjdGl2ZVRhYilcbiAgICB9XG5cbiAgICAvLyDmuIXnkIYgZHJhZnQg5qCH6K6w77yI5aaC5pyJ77yJXG4gICAgc2V0RHJhZnRTZXNzaW9uSWRzKChwcmV2OiBTZXQ8c3RyaW5nPikgPT4ge1xuICAgICAgaWYgKCFwcmV2LmhhcyhwZW5kaW5nRGVsZXRlSWQpKSByZXR1cm4gcHJldlxuICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldilcbiAgICAgIG5leHQuZGVsZXRlKHBlbmRpbmdEZWxldGVJZClcbiAgICAgIHJldHVybiBuZXh0XG4gICAgfSlcblxuICAgIC8vIOa4heeQhiBwZXItY29udmVyc2F0aW9uL3Nlc3Npb24gTWFwIGF0b21zIOadoeebrlxuICAgIGNsZWFudXBNYXBBdG9tcyhwZW5kaW5nRGVsZXRlSWQpXG5cbiAgICAvLyDku44gV29ya2luZyBEb25lIOmbhuWQiOenu+mZpFxuICAgIHNldFdvcmtpbmdEb25lKChwcmV2KSA9PiB7XG4gICAgICBpZiAoIXByZXYuaGFzKHBlbmRpbmdEZWxldGVJZCkpIHJldHVybiBwcmV2XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChwcmV2KVxuICAgICAgbmV4dC5kZWxldGUocGVuZGluZ0RlbGV0ZUlkKVxuICAgICAgcmV0dXJuIG5leHRcbiAgICB9KVxuXG4gICAgaWYgKG1vZGUgPT09ICdhZ2VudCcpIHtcbiAgICAgIC8vIEFnZW50IOaooeW8j++8muWIoOmZpCBBZ2VudCDkvJror51cbiAgICAgIC8vIOazqOaEj++8muW9k+WJjeS8muivneaMh+mSiO+8iGN1cnJlbnRBZ2VudFNlc3Npb25JZO+8ieW3sueUseS4iumdoueahFxuICAgICAgLy8gc3luY0FjdGl2ZVRhYlNpZGVFZmZlY3RzIOWcqCB3YXNBY3RpdmUg5YiG5pSv5ZCM5q2l5Yiw5paw5r+A5rS75qCH562+77yMXG4gICAgICAvLyDov5nph4zkuI3opoHlho3mjInml6fpl63ljIXlgLzlvLrliLbnva4gbnVsbO+8jOWQpuWImeS8muimhuebluaWsCBzZXNzaW9uSWTvvIxcbiAgICAgIC8vIOWvvOiHtCBSaWdodFNpZGVQYW5lbCDmtojlpLHvvIjkvp3otZYgY3VycmVudEFnZW50U2Vzc2lvbklkQXRvbe+8ieOAglxuICAgICAgdHJ5IHtcbiAgICAgICAgYXdhaXQgd2luZG93LmVsZWN0cm9uQVBJLmRlbGV0ZUFnZW50U2Vzc2lvbihwZW5kaW5nRGVsZXRlSWQpXG4gICAgICAgIC8vIOWFqOmHj+WIt+aWsOehruS/neS4juWQjuerr+WQjOatpVxuICAgICAgICBjb25zdCBzZXNzaW9ucyA9IGF3YWl0IHdpbmRvdy5lbGVjdHJvbkFQSS5saXN0QWdlbnRTZXNzaW9ucygpXG4gICAgICAgIHNldEFnZW50U2Vzc2lvbnMoc2Vzc2lvbnMpXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdb5L6n6L655qCPXSDliKDpmaQgQWdlbnQg5Lya6K+d5aSx6LSlOicsIGVycm9yKVxuICAgICAgICAvLyDljbPkvb/lkI7nq6/miqXplJnvvIzkuZ/ku47mnKzlnLDliJfooajnp7vpmaTvvIjlj6/og73mmK/kvJror53lt7LkuI3lrZjlnKjvvIlcbiAgICAgICAgc2V0QWdlbnRTZXNzaW9ucygocHJldikgPT4gcHJldi5maWx0ZXIoKHMpID0+IHMuaWQgIT09IHBlbmRpbmdEZWxldGVJZCkpXG4gICAgICB9IGZpbmFsbHkge1xuICAgICAgICAvLyDmuIXnkIbor6XkvJror53nmoTmtojmga/nvJPlrZjvvIzpgb/lhY3lt7LliKDpmaTkvJror53nmoTmtojmga/mlbDnu4Tmu57nlZnlhoXlrZhcbiAgICAgICAgc2V0QWdlbnRNZXNzYWdlc0NhY2hlKChwcmV2KSA9PiB7XG4gICAgICAgICAgaWYgKCFwcmV2LmhhcyhwZW5kaW5nRGVsZXRlSWQpKSByZXR1cm4gcHJldlxuICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHByZXYpXG4gICAgICAgICAgbmV4dC5kZWxldGUocGVuZGluZ0RlbGV0ZUlkKVxuICAgICAgICAgIHJldHVybiBuZXh0XG4gICAgICAgIH0pXG4gICAgICAgIHNldFBlbmRpbmdEZWxldGVJZChudWxsKVxuICAgICAgfVxuICAgICAgcmV0dXJuXG4gICAgfVxuXG4gICAgdHJ5IHtcbiAgICAgIGF3YWl0IHdpbmRvdy5lbGVjdHJvbkFQSS5kZWxldGVDb252ZXJzYXRpb24ocGVuZGluZ0RlbGV0ZUlkKVxuICAgICAgLy8g5YWo6YeP5Yi35paw56Gu5L+d5LiO5ZCO56uv5ZCM5q2lXG4gICAgICBjb25zdCBjb252ZXJzYXRpb25zID0gYXdhaXQgd2luZG93LmVsZWN0cm9uQVBJLmxpc3RDb252ZXJzYXRpb25zKClcbiAgICAgIHNldENvbnZlcnNhdGlvbnMoY29udmVyc2F0aW9ucylcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW+S+p+i+ueagj10g5Yig6Zmk5a+56K+d5aSx6LSlOicsIGVycm9yKVxuICAgICAgLy8g5Y2z5L2/5ZCO56uv5oql6ZSZ77yM5Lmf5LuO5pys5Zyw5YiX6KGo56e76Zmk77yI5Y+v6IO95piv5a+56K+d5bey5LiN5a2Y5Zyo77yJXG4gICAgICBzZXRDb252ZXJzYXRpb25zKChwcmV2KSA9PiBwcmV2LmZpbHRlcigoYykgPT4gYy5pZCAhPT0gcGVuZGluZ0RlbGV0ZUlkKSlcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0UGVuZGluZ0RlbGV0ZUlkKG51bGwpXG4gICAgfVxuICB9XG5cbiAgLyoqIOi/m+WFpeaJuemHj+mAieaLqeaooeW8jyAqL1xuICBjb25zdCBoYW5kbGVFbnRlckJhdGNoU2VsZWN0ID0gUmVhY3QudXNlQ2FsbGJhY2soKHdvcmtzcGFjZUlkOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICBzZXRCYXRjaFNlbGVjdFdvcmtzcGFjZUlkKHdvcmtzcGFjZUlkKVxuICAgIHNldEJhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzKG5ldyBTZXQoKSlcbiAgfSwgW10pXG5cbiAgLyoqIOmAgOWHuuaJuemHj+mAieaLqeaooeW8jyAqL1xuICBjb25zdCBoYW5kbGVFeGl0QmF0Y2hTZWxlY3QgPSBSZWFjdC51c2VDYWxsYmFjaygoKTogdm9pZCA9PiB7XG4gICAgc2V0QmF0Y2hTZWxlY3RXb3Jrc3BhY2VJZChudWxsKVxuICAgIHNldEJhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzKG5ldyBTZXQoKSlcbiAgfSwgW10pXG5cbiAgLyoqIOWIh+aNouS8muivnemAieS4reeKtuaAgSAqL1xuICBjb25zdCBoYW5kbGVUb2dnbGVCYXRjaFNlbGVjdCA9IFJlYWN0LnVzZUNhbGxiYWNrKChzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgIHNldEJhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzKChwcmV2KSA9PiB7XG4gICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChwcmV2KVxuICAgICAgaWYgKG5leHQuaGFzKHNlc3Npb25JZCkpIG5leHQuZGVsZXRlKHNlc3Npb25JZClcbiAgICAgIGVsc2UgbmV4dC5hZGQoc2Vzc2lvbklkKVxuICAgICAgcmV0dXJuIG5leHRcbiAgICB9KVxuICB9LCBbXSlcblxuICAvKiog6K+35rGC5om56YeP5Yig6Zmk77yI5omT5byA56Gu6K6k5by556qX77yJICovXG4gIGNvbnN0IGhhbmRsZVJlcXVlc3RCYXRjaERlbGV0ZSA9IFJlYWN0LnVzZUNhbGxiYWNrKCgpOiB2b2lkID0+IHtcbiAgICBpZiAoYmF0Y2hTZWxlY3RlZFNlc3Npb25JZHMuc2l6ZSA9PT0gMCkgcmV0dXJuXG4gICAgc2V0QmF0Y2hEZWxldGVDb25maXJtT3Blbih0cnVlKVxuICB9LCBbYmF0Y2hTZWxlY3RlZFNlc3Npb25JZHMuc2l6ZV0pXG5cbiAgLyoqIOehruiupOaJuemHj+WIoOmZpCAqL1xuICBjb25zdCBoYW5kbGVDb25maXJtQmF0Y2hEZWxldGUgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgaWYgKGJhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzLnNpemUgPT09IDApIHJldHVyblxuICAgIGNvbnN0IGlkcyA9IFsuLi5iYXRjaFNlbGVjdGVkU2Vzc2lvbklkc11cblxuICAgIC8vIOWFs+mXreebuOWFsyB0YWLvvIjmibnph4/vvIlcbiAgICBjb25zdCB0YWJzVG9DbG9zZSA9IHRhYnMuZmlsdGVyKCh0KSA9PiBpZHMuaW5jbHVkZXModC5zZXNzaW9uSWQpKVxuICAgIGxldCBjdXJyZW50VGFicyA9IHRhYnNcbiAgICBsZXQgY3VycmVudEFjdGl2ZSA9IGFjdGl2ZVRhYklkXG4gICAgZm9yIChjb25zdCB0YWIgb2YgdGFic1RvQ2xvc2UpIHtcbiAgICAgIGNvbnN0IHJlc3VsdCA9IGNsb3NlVGFiKGN1cnJlbnRUYWJzLCBjdXJyZW50QWN0aXZlLCB0YWIuaWQpXG4gICAgICBjdXJyZW50VGFicyA9IHJlc3VsdC50YWJzXG4gICAgICBjdXJyZW50QWN0aXZlID0gcmVzdWx0LmFjdGl2ZVRhYklkXG4gICAgfVxuICAgIHNldFRhYnMoY3VycmVudFRhYnMpXG4gICAgc2V0QWN0aXZlVGFiSWQoY3VycmVudEFjdGl2ZSlcbiAgICBpZiAodGFic1RvQ2xvc2Uuc29tZSgodCkgPT4gdC5pZCA9PT0gYWN0aXZlVGFiSWQpKSB7XG4gICAgICBjb25zdCBuZXdBY3RpdmUgPSBjdXJyZW50QWN0aXZlXG4gICAgICAgID8gKGN1cnJlbnRUYWJzLmZpbmQoKHQpID0+IHQuaWQgPT09IGN1cnJlbnRBY3RpdmUpID8/IG51bGwpXG4gICAgICAgIDogbnVsbFxuICAgICAgc3luY0FjdGl2ZVRhYlNpZGVFZmZlY3RzKG5ld0FjdGl2ZSlcbiAgICB9XG5cbiAgICAvLyDmuIXnkIblkITnp40gYXRvbSDmnaHnm65cbiAgICBmb3IgKGNvbnN0IGlkIG9mIGlkcykge1xuICAgICAgc2V0RHJhZnRTZXNzaW9uSWRzKChwcmV2OiBTZXQ8c3RyaW5nPikgPT4ge1xuICAgICAgICBpZiAoIXByZXYuaGFzKGlkKSkgcmV0dXJuIHByZXZcbiAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldilcbiAgICAgICAgbmV4dC5kZWxldGUoaWQpXG4gICAgICAgIHJldHVybiBuZXh0XG4gICAgICB9KVxuICAgICAgY2xlYW51cE1hcEF0b21zKGlkKVxuICAgICAgc2V0V29ya2luZ0RvbmUoKHByZXYpID0+IHtcbiAgICAgICAgaWYgKCFwcmV2LmhhcyhpZCkpIHJldHVybiBwcmV2XG4gICAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHByZXYpXG4gICAgICAgIG5leHQuZGVsZXRlKGlkKVxuICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgfSlcbiAgICAgIHNldEFnZW50TWVzc2FnZXNDYWNoZSgocHJldikgPT4ge1xuICAgICAgICBpZiAoIXByZXYuaGFzKGlkKSkgcmV0dXJuIHByZXZcbiAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBNYXAocHJldilcbiAgICAgICAgbmV4dC5kZWxldGUoaWQpXG4gICAgICAgIHJldHVybiBuZXh0XG4gICAgICB9KVxuICAgIH1cblxuICAgIC8vIOiwgyBJUEMg5Yig6Zmk77yI6YCQ5Liq77yM5aSx6LSl55qE5LiN6Zi75pat5ZCO57ut77yJXG4gICAgaWYgKG1vZGUgPT09ICdhZ2VudCcpIHtcbiAgICAgIGF3YWl0IFByb21pc2UuYWxsKFxuICAgICAgICBpZHMubWFwKGFzeW5jIChpZCkgPT4ge1xuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBhd2FpdCB3aW5kb3cuZWxlY3Ryb25BUEkuZGVsZXRlQWdlbnRTZXNzaW9uKGlkKVxuICAgICAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBb5L6n6L655qCPXSDmibnph4/liKDpmaTkvJror50gJHtpZH0g5aSx6LSlOmAsIGVycm9yKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIClcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHNlc3Npb25zID0gYXdhaXQgd2luZG93LmVsZWN0cm9uQVBJLmxpc3RBZ2VudFNlc3Npb25zKClcbiAgICAgICAgc2V0QWdlbnRTZXNzaW9ucyhzZXNzaW9ucylcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1vkvqfovrnmoI9dIOaJuemHj+WIoOmZpOWQjuWIt+aWsOS8muivneWIl+ihqOWksei0pTonLCBlcnJvcilcbiAgICAgICAgc2V0QWdlbnRTZXNzaW9ucygocHJldikgPT4gcHJldi5maWx0ZXIoKHMpID0+ICFpZHMuaW5jbHVkZXMocy5pZCkpKVxuICAgICAgfVxuICAgIH1cblxuICAgIGhhbmRsZUV4aXRCYXRjaFNlbGVjdCgpXG4gICAgc2V0QmF0Y2hEZWxldGVDb25maXJtT3BlbihmYWxzZSlcbiAgfVxuXG4gIC8qKiDliJvlu7rmlrDojYnnqL8gKi9cbiAgY29uc3QgaGFuZGxlTmV3RHJhZnQgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IGRvYyA9IGF3YWl0IHdpbmRvdy5lbGVjdHJvbkFQSS5kcmFmdC5jcmVhdGUoeyB0aXRsZTogJ+acquWRveWQjeiNieeovycgfSlcbiAgICAgIHNldERyYWZ0cygocHJldikgPT4gW2RvYywgLi4ucHJldl0pXG4gICAgICBvcGVuU2Vzc2lvbignZHJhZnQnLCBkb2MuaWQsIGRvYy50aXRsZSlcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgY29uc29sZS5lcnJvcignW+S+p+i+ueagj10g5Yib5bu66I2J56i/5aSx6LSlOicsIGVycm9yKVxuICAgIH1cbiAgfVxuXG4gIC8qKiDliJvlu7rmlrAgQWdlbnQg5Lya6K+dICovXG4gIGNvbnN0IGhhbmRsZU5ld0FnZW50U2Vzc2lvbiA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICB0cnkge1xuICAgICAgLy8gVEEg5qih5byP5Yib5bu655qE5Lya6K+d5b+F6aG75bimIG1vZGU9J3RhJyDmoIforrDvvIzlkKbliJkgVGFiQmFyIOi/h+a7pOWQjuivpSB0YWIg5LiN5Lya5pi+56S6XG4gICAgICBjb25zdCBzZXNzaW9uTW9kZSA9IHRvcExldmVsTW9kZSA9PT0gJ3RhJyA/ICd0YScgOiAnZ2VuZXJhbCdcbiAgICAgIGNvbnN0IG1ldGEgPSBhd2FpdCB3aW5kb3cuZWxlY3Ryb25BUEkuY3JlYXRlQWdlbnRTZXNzaW9uKFxuICAgICAgICB1bmRlZmluZWQsXG4gICAgICAgIGFnZW50Q2hhbm5lbElkIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgY3VycmVudFdvcmtzcGFjZUlkIHx8IHVuZGVmaW5lZCxcbiAgICAgICAgc2Vzc2lvbk1vZGVcbiAgICAgIClcbiAgICAgIHNldEFnZW50U2Vzc2lvbnMoKHByZXYpID0+IFttZXRhLCAuLi5wcmV2XSlcbiAgICAgIC8vIOS7juWFqOWxgOm7mOiupOWAvOWIneWni+WMliBwZXItc2Vzc2lvbiDmuKDpgZMv5qih5Z6L6YWN572uXG4gICAgICBpZiAoYWdlbnRDaGFubmVsSWQpIHtcbiAgICAgICAgc2V0U2Vzc2lvbkNoYW5uZWxNYXAoKHByZXYpID0+IHtcbiAgICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHByZXYpXG4gICAgICAgICAgbWFwLnNldChtZXRhLmlkLCBhZ2VudENoYW5uZWxJZClcbiAgICAgICAgICByZXR1cm4gbWFwXG4gICAgICAgIH0pXG4gICAgICB9XG4gICAgICBpZiAoZGVmYXVsdE1vZGVsRm9yTmV3U2Vzc2lvbikge1xuICAgICAgICBzZXRTZXNzaW9uTW9kZWxNYXAoKHByZXYpID0+IHtcbiAgICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHByZXYpXG4gICAgICAgICAgbWFwLnNldChtZXRhLmlkLCBkZWZhdWx0TW9kZWxGb3JOZXdTZXNzaW9uKVxuICAgICAgICAgIHJldHVybiBtYXBcbiAgICAgICAgfSlcbiAgICAgIH1cbiAgICAgIC8vIOaJk+W8gOaWsOagh+etvumhtVxuICAgICAgb3BlblNlc3Npb24oJ2FnZW50JywgbWV0YS5pZCwgbWV0YS50aXRsZSwgc2Vzc2lvbk1vZGUpXG4gICAgICBzZXRBY3RpdmVWaWV3KCdjb252ZXJzYXRpb25zJylcbiAgICAgIHNldEFjdGl2ZUl0ZW0oJ2FsbC1jaGF0cycpXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1vkvqfovrnmoI9dIOWIm+W7uiBBZ2VudCDkvJror53lpLHotKU6JywgZXJyb3IpXG4gICAgfVxuICB9XG5cbiAgLyoqIOWcqOaMh+WumuW3peS9nOWMuuS4reaWsOW7uuS8muivne+8iOmhueebruWIhue7hCBQbHVzIOaMiemSruS9v+eUqO+8iSAqL1xuICBjb25zdCBoYW5kbGVOZXdTZXNzaW9uSW5Xb3Jrc3BhY2UgPSBSZWFjdC51c2VDYWxsYmFjayhcbiAgICBhc3luYyAod29ya3NwYWNlSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2Vzc2lvbk1vZGUgPSB0b3BMZXZlbE1vZGUgPT09ICd0YScgPyAndGEnIDogJ2dlbmVyYWwnXG4gICAgICAgIGNvbnN0IG1ldGEgPSBhd2FpdCB3aW5kb3cuZWxlY3Ryb25BUEkuY3JlYXRlQWdlbnRTZXNzaW9uKFxuICAgICAgICAgIHVuZGVmaW5lZCxcbiAgICAgICAgICBhZ2VudENoYW5uZWxJZCB8fCB1bmRlZmluZWQsXG4gICAgICAgICAgd29ya3NwYWNlSWQsXG4gICAgICAgICAgc2Vzc2lvbk1vZGVcbiAgICAgICAgKVxuICAgICAgICBzZXRBZ2VudFNlc3Npb25zKChwcmV2KSA9PiBbbWV0YSwgLi4ucHJldl0pXG4gICAgICAgIGlmIChhZ2VudENoYW5uZWxJZCkge1xuICAgICAgICAgIHNldFNlc3Npb25DaGFubmVsTWFwKChwcmV2KSA9PiB7XG4gICAgICAgICAgICBjb25zdCBtYXAgPSBuZXcgTWFwKHByZXYpXG4gICAgICAgICAgICBtYXAuc2V0KG1ldGEuaWQsIGFnZW50Q2hhbm5lbElkKVxuICAgICAgICAgICAgcmV0dXJuIG1hcFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgICAgaWYgKGRlZmF1bHRNb2RlbEZvck5ld1Nlc3Npb24pIHtcbiAgICAgICAgICBzZXRTZXNzaW9uTW9kZWxNYXAoKHByZXYpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IG1hcCA9IG5ldyBNYXAocHJldilcbiAgICAgICAgICAgIG1hcC5zZXQobWV0YS5pZCwgZGVmYXVsdE1vZGVsRm9yTmV3U2Vzc2lvbilcbiAgICAgICAgICAgIHJldHVybiBtYXBcbiAgICAgICAgICB9KVxuICAgICAgICB9XG4gICAgICAgIG9wZW5TZXNzaW9uKCdhZ2VudCcsIG1ldGEuaWQsIG1ldGEudGl0bGUsIHNlc3Npb25Nb2RlKVxuICAgICAgICBzZXRBY3RpdmVWaWV3KCdjb252ZXJzYXRpb25zJylcbiAgICAgICAgc2V0QWN0aXZlSXRlbSgnYWxsLWNoYXRzJylcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1vkvqfovrnmoI9dIOWcqOW3peS9nOWMuuS4reWIm+W7uiBBZ2VudCDkvJror53lpLHotKU6JywgZXJyb3IpXG4gICAgICB9XG4gICAgfSxcbiAgICBbXG4gICAgICBhZ2VudENoYW5uZWxJZCxcbiAgICAgIGRlZmF1bHRNb2RlbEZvck5ld1Nlc3Npb24sXG4gICAgICBvcGVuU2Vzc2lvbixcbiAgICAgIHNldEFjdGl2ZVZpZXcsXG4gICAgICBzZXRBY3RpdmVJdGVtLFxuICAgICAgc2V0QWdlbnRTZXNzaW9ucyxcbiAgICAgIHNldFNlc3Npb25DaGFubmVsTWFwLFxuICAgICAgc2V0U2Vzc2lvbk1vZGVsTWFwLFxuICAgICAgdG9wTGV2ZWxNb2RlLFxuICAgIF1cbiAgKVxuXG4gIC8qKiDpgInmi6kgQWdlbnQg5Lya6K+d77yI5omT5byA5oiW6IGa54Sm5qCH562+6aG177yJICovXG4gIGNvbnN0IGhhbmRsZVNlbGVjdEFnZW50U2Vzc2lvbiA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgIChpZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICBvcGVuU2Vzc2lvbignYWdlbnQnLCBpZCwgdGl0bGUpXG4gICAgICBzZXRBY3RpdmVWaWV3KCdjb252ZXJzYXRpb25zJylcbiAgICAgIHNldEFjdGl2ZUl0ZW0oJ2FsbC1jaGF0cycpXG4gICAgICAvLyDmuIXpmaTor6XkvJror53nmoRcIuW3suWujOaIkOacquafpeeci1wi5qCH6K6wXG4gICAgICBzZXRVbnZpZXdlZENvbXBsZXRlZCgocHJldjogU2V0PHN0cmluZz4pID0+IHtcbiAgICAgICAgaWYgKCFwcmV2LmhhcyhpZCkpIHJldHVybiBwcmV2XG4gICAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHByZXYpXG4gICAgICAgIG5leHQuZGVsZXRlKGlkKVxuICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgfSlcbiAgICB9LFxuICAgIFtvcGVuU2Vzc2lvbiwgc2V0QWN0aXZlVmlldywgc2V0VW52aWV3ZWRDb21wbGV0ZWRdXG4gIClcblxuICAvKiog6YeN5ZG95ZCNIEFnZW50IOS8muivneagh+mimCAqL1xuICBjb25zdCBoYW5kbGVBZ2VudFJlbmFtZSA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgIGFzeW5jIChpZDogc3RyaW5nLCBuZXdUaXRsZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgd2luZG93LmVsZWN0cm9uQVBJLnVwZGF0ZUFnZW50U2Vzc2lvblRpdGxlKGlkLCBuZXdUaXRsZSlcbiAgICAgICAgc2V0QWdlbnRTZXNzaW9ucygocHJldikgPT4gcmVwbGFjZUFnZW50U2Vzc2lvbkluRnJlc2huZXNzT3JkZXIocHJldiwgdXBkYXRlZCkpXG4gICAgICAgIC8vIOWQjOatpeabtOaWsOagh+etvumhteagh+mimFxuICAgICAgICBzZXRUYWJzKChwcmV2KSA9PiB1cGRhdGVUYWJUaXRsZShwcmV2LCBpZCwgbmV3VGl0bGUpKVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW+S+p+i+ueagj10g6YeN5ZG95ZCNIEFnZW50IOS8muivneWksei0pTonLCBlcnJvcilcbiAgICAgIH1cbiAgICB9LFxuICAgIFtzZXRBZ2VudFNlc3Npb25zLCBzZXRUYWJzXVxuICApXG5cbiAgLyoqIOmHjeWRveWQjeW3peS9nOWMuu+8iOmhueebru+8ieWQjeensCAqL1xuICBjb25zdCBoYW5kbGVXb3Jrc3BhY2VSZW5hbWUgPSBSZWFjdC51c2VDYWxsYmFjayhcbiAgICBhc3luYyAod29ya3NwYWNlSWQ6IHN0cmluZywgbmV3TmFtZTogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICB0cnkge1xuICAgICAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgd2luZG93LmVsZWN0cm9uQVBJLnVwZGF0ZUFnZW50V29ya3NwYWNlKHdvcmtzcGFjZUlkLCB7XG4gICAgICAgICAgbmFtZTogbmV3TmFtZSxcbiAgICAgICAgfSlcbiAgICAgICAgc2V0V29ya3NwYWNlcygocHJldikgPT4gcHJldi5tYXAoKHcpID0+ICh3LmlkID09PSB1cGRhdGVkLmlkID8gdXBkYXRlZCA6IHcpKSlcbiAgICAgIH0gY2F0Y2ggKGVycm9yKSB7XG4gICAgICAgIGNvbnNvbGUuZXJyb3IoJ1vkvqfovrnmoI9dIOmHjeWRveWQjeW3peS9nOWMuuWksei0pTonLCBlcnJvcilcbiAgICAgICAgY29uc3QgbXNnID0gZXJyb3IgaW5zdGFuY2VvZiBFcnJvciA/IGVycm9yLm1lc3NhZ2UgOiAn6YeN5ZG95ZCN5aSx6LSlJ1xuICAgICAgICB0b2FzdC5lcnJvcihtc2cpXG4gICAgICB9XG4gICAgfSxcbiAgICBbc2V0V29ya3NwYWNlc11cbiAgKVxuXG4gIGNvbnN0IGNhbkRlbGV0ZVdvcmtzcGFjZSA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgICh3b3Jrc3BhY2U6IEFnZW50V29ya3NwYWNlKTogYm9vbGVhbiA9PiB3b3Jrc3BhY2Uuc2x1ZyAhPT0gJ2RlZmF1bHQnICYmIHdvcmtzcGFjZXMubGVuZ3RoID4gMSxcbiAgICBbd29ya3NwYWNlcy5sZW5ndGhdXG4gIClcblxuICBjb25zdCBwZW5kaW5nRGVsZXRlV29ya3NwYWNlID0gUmVhY3QudXNlTWVtbyhcbiAgICAoKSA9PiB3b3Jrc3BhY2VzLmZpbmQoKHdvcmtzcGFjZSkgPT4gd29ya3NwYWNlLmlkID09PSBwZW5kaW5nRGVsZXRlV29ya3NwYWNlSWQpID8/IG51bGwsXG4gICAgW3BlbmRpbmdEZWxldGVXb3Jrc3BhY2VJZCwgd29ya3NwYWNlc11cbiAgKVxuXG4gIC8qKiDor7fmsYLliKDpmaTpobnnm67vvIjlvLnlh7rkuozmrKHnoa7orqTmoYbvvIkgKi9cbiAgY29uc3QgaGFuZGxlUmVxdWVzdERlbGV0ZVdvcmtzcGFjZSA9IFJlYWN0LnVzZUNhbGxiYWNrKCh3b3Jrc3BhY2VJZDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgc2V0UGVuZGluZ0RlbGV0ZVdvcmtzcGFjZUlkKHdvcmtzcGFjZUlkKVxuICB9LCBbXSlcblxuICAvKiog5byA5aeL5ouW5ou96aG555uu5o6S5bqPICovXG4gIGNvbnN0IGhhbmRsZVByb2plY3REcmFnU3RhcnQgPSBSZWFjdC51c2VDYWxsYmFjayhcbiAgICAoZTogUmVhY3QuRHJhZ0V2ZW50LCB3b3Jrc3BhY2VJZDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICBzZXREcmFnUHJvamVjdElkKHdvcmtzcGFjZUlkKVxuICAgICAgZS5kYXRhVHJhbnNmZXIuZWZmZWN0QWxsb3dlZCA9ICdtb3ZlJ1xuICAgICAgZS5kYXRhVHJhbnNmZXIuc2V0RGF0YSgndGV4dC9wbGFpbicsIHdvcmtzcGFjZUlkKVxuICAgIH0sXG4gICAgW11cbiAgKVxuXG4gIC8qKiDmoLnmja7pvKDmoIfkvY3nva7orqHnrpfpobnnm67mj5LlhaXngrkgKi9cbiAgY29uc3QgaGFuZGxlUHJvamVjdERyYWdPdmVyID0gUmVhY3QudXNlQ2FsbGJhY2soXG4gICAgKGU6IFJlYWN0LkRyYWdFdmVudCwgd29ya3NwYWNlSWQ6IHN0cmluZyk6IHZvaWQgPT4ge1xuICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICBlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ21vdmUnXG4gICAgICBpZiAoIWRyYWdQcm9qZWN0SWQgfHwgZHJhZ1Byb2plY3RJZCA9PT0gd29ya3NwYWNlSWQpIHtcbiAgICAgICAgc2V0UHJvamVjdERyb3BJbmRpY2F0b3IobnVsbClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG4gICAgICBjb25zdCByZWN0ID0gZS5jdXJyZW50VGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXG4gICAgICBjb25zdCByYXRpbyA9IChlLmNsaWVudFkgLSByZWN0LnRvcCkgLyByZWN0LmhlaWdodFxuICAgICAgY29uc3QgcG9zaXRpb246ICdiZWZvcmUnIHwgJ2FmdGVyJyA9IHJhdGlvIDwgMC41ID8gJ2JlZm9yZScgOiAnYWZ0ZXInXG4gICAgICBzZXRQcm9qZWN0RHJvcEluZGljYXRvcigocHJldikgPT5cbiAgICAgICAgcHJldj8uaWQgPT09IHdvcmtzcGFjZUlkICYmIHByZXYucG9zaXRpb24gPT09IHBvc2l0aW9uXG4gICAgICAgICAgPyBwcmV2XG4gICAgICAgICAgOiB7IGlkOiB3b3Jrc3BhY2VJZCwgcG9zaXRpb24gfVxuICAgICAgKVxuICAgIH0sXG4gICAgW2RyYWdQcm9qZWN0SWRdXG4gIClcblxuICBjb25zdCBoYW5kbGVQcm9qZWN0RHJhZ0xlYXZlID0gUmVhY3QudXNlQ2FsbGJhY2soKGU6IFJlYWN0LkRyYWdFdmVudCk6IHZvaWQgPT4ge1xuICAgIGlmICghZS5jdXJyZW50VGFyZ2V0LmNvbnRhaW5zKGUucmVsYXRlZFRhcmdldCBhcyBOb2RlKSkge1xuICAgICAgc2V0UHJvamVjdERyb3BJbmRpY2F0b3IobnVsbClcbiAgICB9XG4gIH0sIFtdKVxuXG4gIC8qKiDlrozmiJDpobnnm67mjpLluo/lubbmjIHkuYXljJYgKi9cbiAgY29uc3QgaGFuZGxlUHJvamVjdERyb3AgPSBSZWFjdC51c2VDYWxsYmFjayhcbiAgICBhc3luYyAoZTogUmVhY3QuRHJhZ0V2ZW50LCB0YXJnZXRXb3Jrc3BhY2VJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIGNvbnN0IGluZGljYXRvciA9IHByb2plY3REcm9wSW5kaWNhdG9yXG4gICAgICBpZiAoXG4gICAgICAgICFkcmFnUHJvamVjdElkIHx8XG4gICAgICAgIGRyYWdQcm9qZWN0SWQgPT09IHRhcmdldFdvcmtzcGFjZUlkIHx8XG4gICAgICAgICFpbmRpY2F0b3IgfHxcbiAgICAgICAgaW5kaWNhdG9yLmlkICE9PSB0YXJnZXRXb3Jrc3BhY2VJZFxuICAgICAgKSB7XG4gICAgICAgIHNldERyYWdQcm9qZWN0SWQobnVsbClcbiAgICAgICAgc2V0UHJvamVjdERyb3BJbmRpY2F0b3IobnVsbClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGlkcyA9IHdvcmtzcGFjZXMubWFwKCh3KSA9PiB3LmlkKVxuICAgICAgY29uc3QgZnJvbUluZGV4ID0gaWRzLmluZGV4T2YoZHJhZ1Byb2plY3RJZClcbiAgICAgIGNvbnN0IHRvSW5kZXggPSBpZHMuaW5kZXhPZih0YXJnZXRXb3Jrc3BhY2VJZClcbiAgICAgIGlmIChmcm9tSW5kZXggPT09IC0xIHx8IHRvSW5kZXggPT09IC0xKSB7XG4gICAgICAgIHNldERyYWdQcm9qZWN0SWQobnVsbClcbiAgICAgICAgc2V0UHJvamVjdERyb3BJbmRpY2F0b3IobnVsbClcbiAgICAgICAgcmV0dXJuXG4gICAgICB9XG5cbiAgICAgIC8vIOiuoeeul+aWsOmhuuW6j++8muenu+mZpOa6kOS9jee9ru+8jOaMiSBpbmRpY2F0b3Ig5o+S5YWl55uu5qCH5L2N572uXG4gICAgICBjb25zdCBuZXdJZHMgPSBpZHMuZmlsdGVyKChpZCkgPT4gaWQgIT09IGRyYWdQcm9qZWN0SWQpXG4gICAgICBsZXQgaW5zZXJ0QXQgPSBuZXdJZHMuaW5kZXhPZih0YXJnZXRXb3Jrc3BhY2VJZClcbiAgICAgIGlmIChpbnNlcnRBdCA9PT0gLTEpIGluc2VydEF0ID0gbmV3SWRzLmxlbmd0aFxuICAgICAgaWYgKGluZGljYXRvci5wb3NpdGlvbiA9PT0gJ2FmdGVyJykgaW5zZXJ0QXQgKz0gMVxuICAgICAgbmV3SWRzLnNwbGljZShpbnNlcnRBdCwgMCwgZHJhZ1Byb2plY3RJZClcblxuICAgICAgc2V0RHJhZ1Byb2plY3RJZChudWxsKVxuICAgICAgc2V0UHJvamVjdERyb3BJbmRpY2F0b3IobnVsbClcblxuICAgICAgLy8g5LmQ6KeC5pu05pawICsg5oyB5LmF5YyWXG4gICAgICBjb25zdCBieUlkID0gbmV3IE1hcCh3b3Jrc3BhY2VzLm1hcCgodykgPT4gW3cuaWQsIHddKSlcbiAgICAgIGNvbnN0IHJlb3JkZXJlZCA9IG5ld0lkcy5tYXAoKGlkKSA9PiBieUlkLmdldChpZCkhKS5maWx0ZXIoQm9vbGVhbilcbiAgICAgIHNldFdvcmtzcGFjZXMocmVvcmRlcmVkKVxuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgc2F2ZWQgPSBhd2FpdCB3aW5kb3cuZWxlY3Ryb25BUEkucmVvcmRlckFnZW50V29ya3NwYWNlcyhuZXdJZHMpXG4gICAgICAgIHNldFdvcmtzcGFjZXMoc2F2ZWQpXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdb5bel5L2c5Yy65o6S5bqPXSDmjIHkuYXljJblpLHotKU6JywgZXJyb3IpXG4gICAgICAgIC8vIOWbnua7mu+8mumHjeaWsOivu+WPllxuICAgICAgICAvLyDms6jvvJrov5nph4zkuI3kuLvliqggcmVmZXRjaO+8jOiuqeeUqOaIt+eci+WIsOWksei0peWQjuaJi+WKqOWIt+aWsFxuICAgICAgfVxuICAgIH0sXG4gICAgW2RyYWdQcm9qZWN0SWQsIHByb2plY3REcm9wSW5kaWNhdG9yLCB3b3Jrc3BhY2VzLCBzZXRXb3Jrc3BhY2VzXVxuICApXG5cbiAgY29uc3QgaGFuZGxlUHJvamVjdERyYWdFbmQgPSBSZWFjdC51c2VDYWxsYmFjaygoKTogdm9pZCA9PiB7XG4gICAgc2V0RHJhZ1Byb2plY3RJZChudWxsKVxuICAgIHNldFByb2plY3REcm9wSW5kaWNhdG9yKG51bGwpXG4gIH0sIFtdKVxuXG4gIC8qKiDnoa7orqTliKDpmaTpobnnm67lj4rlhbbnu5HlrprotYTmupAgKi9cbiAgY29uc3QgaGFuZGxlQ29uZmlybURlbGV0ZVdvcmtzcGFjZSA9IFJlYWN0LnVzZUNhbGxiYWNrKGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICBjb25zdCB3b3Jrc3BhY2VJZCA9IHBlbmRpbmdEZWxldGVXb3Jrc3BhY2VJZFxuICAgIGNvbnN0IHdvcmtzcGFjZSA9IHdvcmtzcGFjZXMuZmluZCgoaXRlbSkgPT4gaXRlbS5pZCA9PT0gd29ya3NwYWNlSWQpXG4gICAgaWYgKCF3b3Jrc3BhY2VJZCB8fCAhd29ya3NwYWNlKSByZXR1cm5cblxuICAgIGlmICghY2FuRGVsZXRlV29ya3NwYWNlKHdvcmtzcGFjZSkpIHtcbiAgICAgIHRvYXN0LmVycm9yKHdvcmtzcGFjZS5zbHVnID09PSAnZGVmYXVsdCcgPyAn6buY6K6k6aG555uu5LiN6IO95Yig6ZmkJyA6ICfoh7PlsJHpnIDopoHkv53nlZnkuIDkuKrpobnnm64nKVxuICAgICAgc2V0UGVuZGluZ0RlbGV0ZVdvcmtzcGFjZUlkKG51bGwpXG4gICAgICByZXR1cm5cbiAgICB9XG5cbiAgICBjb25zdCBkZWxldGVkU2Vzc2lvbklkcyA9IG5ldyBTZXQoXG4gICAgICBhZ2VudFNlc3Npb25zXG4gICAgICAgIC5maWx0ZXIoKHNlc3Npb24pID0+IHNlc3Npb24ud29ya3NwYWNlSWQgPT09IHdvcmtzcGFjZUlkKVxuICAgICAgICAubWFwKChzZXNzaW9uKSA9PiBzZXNzaW9uLmlkKVxuICAgIClcblxuICAgIHRyeSB7XG4gICAgICBzZXREZWxldGluZ1dvcmtzcGFjZUlkKHdvcmtzcGFjZUlkKVxuXG4gICAgICBhd2FpdCB3aW5kb3cuZWxlY3Ryb25BUEkuZGVsZXRlQWdlbnRXb3Jrc3BhY2Uod29ya3NwYWNlSWQpXG5cbiAgICAgIGZvciAoY29uc3Qgc2Vzc2lvbklkIG9mIGRlbGV0ZWRTZXNzaW9uSWRzKSB7XG4gICAgICAgIGNsZWFudXBNYXBBdG9tcyhzZXNzaW9uSWQpXG4gICAgICB9XG5cbiAgICAgIHNldERyYWZ0U2Vzc2lvbklkcygocHJldjogU2V0PHN0cmluZz4pID0+IHtcbiAgICAgICAgbGV0IGNoYW5nZWQgPSBmYWxzZVxuICAgICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChwcmV2KVxuICAgICAgICBmb3IgKGNvbnN0IHNlc3Npb25JZCBvZiBkZWxldGVkU2Vzc2lvbklkcykge1xuICAgICAgICAgIGlmIChuZXh0LmRlbGV0ZShzZXNzaW9uSWQpKSBjaGFuZ2VkID0gdHJ1ZVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjaGFuZ2VkID8gbmV4dCA6IHByZXZcbiAgICAgIH0pXG5cbiAgICAgIHNldEFnZW50TWVzc2FnZXNDYWNoZSgocHJldikgPT4ge1xuICAgICAgICBsZXQgY2hhbmdlZCA9IGZhbHNlXG4gICAgICAgIGNvbnN0IG5leHQgPSBuZXcgTWFwKHByZXYpXG4gICAgICAgIGZvciAoY29uc3Qgc2Vzc2lvbklkIG9mIGRlbGV0ZWRTZXNzaW9uSWRzKSB7XG4gICAgICAgICAgaWYgKG5leHQuZGVsZXRlKHNlc3Npb25JZCkpIGNoYW5nZWQgPSB0cnVlXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGNoYW5nZWQgPyBuZXh0IDogcHJldlxuICAgICAgfSlcbiAgICAgIHNldEF1dG9tYXRpb25zKChwcmV2KSA9PiBwcmV2LmZpbHRlcigoYXV0b21hdGlvbikgPT4gYXV0b21hdGlvbi53b3Jrc3BhY2VJZCAhPT0gd29ya3NwYWNlSWQpKVxuXG4gICAgICBjb25zdCBjdXJyZW50VGFicyA9IHN0b3JlLmdldCh0YWJzQXRvbSlcbiAgICAgIGNvbnN0IGN1cnJlbnRBY3RpdmVUYWJJZCA9IHN0b3JlLmdldChhY3RpdmVUYWJJZEF0b20pXG4gICAgICBjb25zdCBuZXh0VGFicyA9IGN1cnJlbnRUYWJzLmZpbHRlcihcbiAgICAgICAgKHRhYikgPT5cbiAgICAgICAgICAodGFiLnR5cGUgIT09ICdhZ2VudCcgJiYgdGFiLnR5cGUgIT09ICdwcmV2aWV3JykgfHwgIWRlbGV0ZWRTZXNzaW9uSWRzLmhhcyh0YWIuc2Vzc2lvbklkKVxuICAgICAgKVxuICAgICAgY29uc3QgbmV4dEFjdGl2ZVRhYklkID1cbiAgICAgICAgY3VycmVudEFjdGl2ZVRhYklkICYmIG5leHRUYWJzLnNvbWUoKHRhYikgPT4gdGFiLmlkID09PSBjdXJyZW50QWN0aXZlVGFiSWQpXG4gICAgICAgICAgPyBjdXJyZW50QWN0aXZlVGFiSWRcbiAgICAgICAgICA6IChuZXh0VGFic1swXT8uaWQgPz8gbnVsbClcblxuICAgICAgc2V0VGFicyhuZXh0VGFicylcbiAgICAgIHNldEFjdGl2ZVRhYklkKG5leHRBY3RpdmVUYWJJZClcbiAgICAgIHN5bmNBY3RpdmVUYWJTaWRlRWZmZWN0cyhcbiAgICAgICAgbmV4dEFjdGl2ZVRhYklkID8gKG5leHRUYWJzLmZpbmQoKHRhYikgPT4gdGFiLmlkID09PSBuZXh0QWN0aXZlVGFiSWQpID8/IG51bGwpIDogbnVsbFxuICAgICAgKVxuXG4gICAgICBjb25zdCBbcmVtYWluaW5nV29ya3NwYWNlcywgc2Vzc2lvbnNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICB3aW5kb3cuZWxlY3Ryb25BUEkubGlzdEFnZW50V29ya3NwYWNlcygpLFxuICAgICAgICB3aW5kb3cuZWxlY3Ryb25BUEkubGlzdEFnZW50U2Vzc2lvbnMoKSxcbiAgICAgIF0pXG5cbiAgICAgIHNldFdvcmtzcGFjZXMocmVtYWluaW5nV29ya3NwYWNlcylcbiAgICAgIHNldEFnZW50U2Vzc2lvbnMoc2Vzc2lvbnMpXG5cbiAgICAgIHNldENvbGxhcHNlZFdvcmtzcGFjZUlkcygocHJldikgPT4ge1xuICAgICAgICBpZiAoIXByZXYuaGFzKHdvcmtzcGFjZUlkKSkgcmV0dXJuIHByZXZcbiAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldilcbiAgICAgICAgbmV4dC5kZWxldGUod29ya3NwYWNlSWQpXG4gICAgICAgIHJldHVybiBuZXh0XG4gICAgICB9KVxuXG4gICAgICBpZiAod29ya3NwYWNlSWQgPT09IGN1cnJlbnRXb3Jrc3BhY2VJZCkge1xuICAgICAgICBjb25zdCBmYWxsYmFjayA9XG4gICAgICAgICAgcmVtYWluaW5nV29ya3NwYWNlcy5maW5kKChpdGVtKSA9PiBpdGVtLnNsdWcgPT09ICdkZWZhdWx0JykgPz9cbiAgICAgICAgICByZW1haW5pbmdXb3Jrc3BhY2VzWzBdID8/XG4gICAgICAgICAgbnVsbFxuICAgICAgICBzZXRDdXJyZW50V29ya3NwYWNlSWQoZmFsbGJhY2s/LmlkID8/IG51bGwpXG4gICAgICAgIGlmIChmYWxsYmFjaykge1xuICAgICAgICAgIHdpbmRvdy5lbGVjdHJvbkFQSS51cGRhdGVTZXR0aW5ncyh7IGFnZW50V29ya3NwYWNlSWQ6IGZhbGxiYWNrLmlkIH0pLmNhdGNoKGNvbnNvbGUuZXJyb3IpXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgdG9hc3Quc3VjY2Vzcygn6aG555uu5bey5Yig6ZmkJywge1xuICAgICAgICBkZXNjcmlwdGlvbjogYOW3suWIoOmZpOOAjCR7d29ya3NwYWNlLm5hbWV944CN5Y+K5YW257uR5a6a6LWE5rqQYCxcbiAgICAgIH0pXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ1vkvqfovrnmoI9dIOWIoOmZpOmhueebruWksei0pTonLCBlcnJvcilcbiAgICAgIGNvbnN0IG1zZyA9IGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogJ+WIoOmZpOmhueebruWksei0pSdcbiAgICAgIHRvYXN0LmVycm9yKG1zZylcbiAgICB9IGZpbmFsbHkge1xuICAgICAgc2V0RGVsZXRpbmdXb3Jrc3BhY2VJZChudWxsKVxuICAgICAgc2V0UGVuZGluZ0RlbGV0ZVdvcmtzcGFjZUlkKG51bGwpXG4gICAgfVxuICB9LCBbXG4gICAgcGVuZGluZ0RlbGV0ZVdvcmtzcGFjZUlkLFxuICAgIHdvcmtzcGFjZXMsXG4gICAgY2FuRGVsZXRlV29ya3NwYWNlLFxuICAgIGFnZW50U2Vzc2lvbnMsXG4gICAgY2xlYW51cE1hcEF0b21zLFxuICAgIHNldERyYWZ0U2Vzc2lvbklkcyxcbiAgICBzZXRBZ2VudE1lc3NhZ2VzQ2FjaGUsXG4gICAgc2V0QXV0b21hdGlvbnMsXG4gICAgc3RvcmUsXG4gICAgc2V0VGFicyxcbiAgICBzZXRBY3RpdmVUYWJJZCxcbiAgICBzeW5jQWN0aXZlVGFiU2lkZUVmZmVjdHMsXG4gICAgc2V0V29ya3NwYWNlcyxcbiAgICBzZXRBZ2VudFNlc3Npb25zLFxuICAgIGN1cnJlbnRXb3Jrc3BhY2VJZCxcbiAgICBzZXRDdXJyZW50V29ya3NwYWNlSWQsXG4gIF0pXG5cbiAgLyoqIOWIh+aNoiBBZ2VudCDkvJror53nva7pobbnirbmgIEgKi9cbiAgY29uc3QgaGFuZGxlVG9nZ2xlUGluQWdlbnQgPSBSZWFjdC51c2VDYWxsYmFjayhcbiAgICBhc3luYyAoaWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3Qgb3JpZ2luYWwgPSBzdG9yZS5nZXQoYWdlbnRTZXNzaW9uc0F0b20pLmZpbmQoKHMpID0+IHMuaWQgPT09IGlkKVxuICAgICAgICBjb25zdCB1cGRhdGVkID0gYXdhaXQgd2luZG93LmVsZWN0cm9uQVBJLnRvZ2dsZVBpbkFnZW50U2Vzc2lvbihpZClcbiAgICAgICAgc2V0QWdlbnRTZXNzaW9ucygocHJldikgPT4gcmVwbGFjZUFnZW50U2Vzc2lvbkluRnJlc2huZXNzT3JkZXIocHJldiwgdXBkYXRlZCkpXG4gICAgICAgIGlmICh1cGRhdGVkLnBpbm5lZCkge1xuICAgICAgICAgIGNvbnN0IGlzUnVubmluZyA9IHN0b3JlLmdldChhZ2VudFNlc3Npb25JbmRpY2F0b3JNYXBBdG9tKS5nZXQoaWQpID09PSAncnVubmluZydcbiAgICAgICAgICBpZiAoaXNSdW5uaW5nKSB7XG4gICAgICAgICAgICB0b2FzdC5zdWNjZXNzKCflt7Lnva7pobYnLCB7XG4gICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAn5b2T5YmNIEFnZW50IOato+WcqOaJp+ihjOS4re+8jOenu+WHuuW3peS9nOS4reWQjuS8muaYvuekuuWIsOe9rumhtuWMuuWfnycsXG4gICAgICAgICAgICB9KVxuICAgICAgICAgIH0gZWxzZSBpZiAob3JpZ2luYWw/LmFyY2hpdmVkICYmICF1cGRhdGVkLmFyY2hpdmVkKSB7XG4gICAgICAgICAgICB0b2FzdC5zdWNjZXNzKCflt7Lnva7pobYnLCB7IGRlc2NyaXB0aW9uOiAn5bey6Ieq5Yqo5Y+W5raI5b2S5qGjJyB9KVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICB0b2FzdC5zdWNjZXNzKCflt7Lnva7pobYnKVxuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICB0b2FzdC5zdWNjZXNzKCflt7Llj5bmtojnva7pobYnKVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdb5L6n6L655qCPXSDliIfmjaIgQWdlbnQg5Lya6K+d572u6aG25aSx6LSlOicsIGVycm9yKVxuICAgICAgfVxuICAgIH0sXG4gICAgW3N0b3JlLCBzZXRBZ2VudFNlc3Npb25zXVxuICApXG5cbiAgLyoqIOWIh+aNoiBBZ2VudCDkvJror53lvZLmoaPnirbmgIEgKi9cbiAgY29uc3QgaGFuZGxlVG9nZ2xlQXJjaGl2ZUFnZW50ID0gUmVhY3QudXNlQ2FsbGJhY2soXG4gICAgYXN5bmMgKGlkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNvbnN0IHVwZGF0ZWQgPSBhd2FpdCB3aW5kb3cuZWxlY3Ryb25BUEkudG9nZ2xlQXJjaGl2ZUFnZW50U2Vzc2lvbihpZClcbiAgICAgICAgc2V0QWdlbnRTZXNzaW9ucygocHJldikgPT4gcmVwbGFjZUFnZW50U2Vzc2lvbkluRnJlc2huZXNzT3JkZXIocHJldiwgdXBkYXRlZCkpXG4gICAgICAgIC8vIOW9kuaho+aXtuiHquWKqOWFs+mXreivpeS8muivneeahOagh+etvumhte+8jOW5tuWQjOatpeaWsOa/gOa0u+agh+etvueahOWJr+S9nOeUqO+8jFxuICAgICAgICAvLyDlkKbliJkgUmlnaHRTaWRlUGFuZWzvvIjkvp3otZYgY3VycmVudEFnZW50U2Vzc2lvbklkQXRvbe+8ieS8muWboOS4ulxuICAgICAgICAvLyDmjIfpkojooqvplJnor6/nva4gbnVsbCDogIzmtojlpLHjgIJcbiAgICAgICAgaWYgKHVwZGF0ZWQuYXJjaGl2ZWQpIHtcbiAgICAgICAgICBjb25zdCBjdXJyZW50VGFicyA9IHN0b3JlLmdldCh0YWJzQXRvbSlcbiAgICAgICAgICBjb25zdCBjdXJyZW50QWN0aXZlVGFiSWQgPSBzdG9yZS5nZXQoYWN0aXZlVGFiSWRBdG9tKVxuICAgICAgICAgIGNvbnN0IHdhc0FjdGl2ZSA9IGN1cnJlbnRBY3RpdmVUYWJJZCA9PT0gaWRcbiAgICAgICAgICBjb25zdCB0YWJSZXN1bHQgPSBjbG9zZVRhYihjdXJyZW50VGFicywgY3VycmVudEFjdGl2ZVRhYklkLCBpZClcbiAgICAgICAgICBzZXRUYWJzKHRhYlJlc3VsdC50YWJzKVxuICAgICAgICAgIHNldEFjdGl2ZVRhYklkKHRhYlJlc3VsdC5hY3RpdmVUYWJJZClcbiAgICAgICAgICBjbGVhbnVwTWFwQXRvbXMoaWQpXG4gICAgICAgICAgLy8g5LuOIFdvcmtpbmcgRG9uZSDpm4blkIjnp7vpmaRcbiAgICAgICAgICBzZXRXb3JraW5nRG9uZSgocHJldikgPT4ge1xuICAgICAgICAgICAgaWYgKCFwcmV2LmhhcyhpZCkpIHJldHVybiBwcmV2XG4gICAgICAgICAgICBjb25zdCBuZXh0ID0gbmV3IFNldChwcmV2KVxuICAgICAgICAgICAgbmV4dC5kZWxldGUoaWQpXG4gICAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICAgIH0pXG4gICAgICAgICAgaWYgKHdhc0FjdGl2ZSkge1xuICAgICAgICAgICAgY29uc3QgbmV3QWN0aXZlVGFiID0gdGFiUmVzdWx0LmFjdGl2ZVRhYklkXG4gICAgICAgICAgICAgID8gKHRhYlJlc3VsdC50YWJzLmZpbmQoKHQpID0+IHQuaWQgPT09IHRhYlJlc3VsdC5hY3RpdmVUYWJJZCkgPz8gbnVsbClcbiAgICAgICAgICAgICAgOiBudWxsXG4gICAgICAgICAgICBzeW5jQWN0aXZlVGFiU2lkZUVmZmVjdHMobmV3QWN0aXZlVGFiKVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgICB0b2FzdC5zdWNjZXNzKHVwZGF0ZWQuYXJjaGl2ZWQgPyAn5bey5b2S5qGjJyA6ICflt7Llj5bmtojlvZLmoaMnKVxuICAgICAgfSBjYXRjaCAoZXJyb3IpIHtcbiAgICAgICAgY29uc29sZS5lcnJvcignW+S+p+i+ueagj10g5YiH5o2iIEFnZW50IOS8muivneW9kuaho+Wksei0pTonLCBlcnJvcilcbiAgICAgIH1cbiAgICB9LFxuICAgIFtcbiAgICAgIHN0b3JlLFxuICAgICAgc2V0QWdlbnRTZXNzaW9ucyxcbiAgICAgIHNldFRhYnMsXG4gICAgICBzZXRBY3RpdmVUYWJJZCxcbiAgICAgIGNsZWFudXBNYXBBdG9tcyxcbiAgICAgIHNldFdvcmtpbmdEb25lLFxuICAgICAgc3luY0FjdGl2ZVRhYlNpZGVFZmZlY3RzLFxuICAgIF1cbiAgKVxuXG4gIC8vID09PT09IOmhueebruWIhue7hOaVsOaNruWxgiA9PT09PVxuICAvKiogQWdlbnQg5Lya6K+d5oyJ6aG555uu77yI5bel5L2c5Yy677yJ5YiG57uE77yM5bmz6ZO65bGV56S65omA5pyJ6aG555uu55qE5Lya6K+dICovXG4gIGNvbnN0IGFnZW50UHJvamVjdEdyb3VwcyA9IFJlYWN0LnVzZU1lbW88QWdlbnRQcm9qZWN0R3JvdXBbXT4oKCkgPT4ge1xuICAgIGNvbnN0IHNlc3Npb25zQnlXb3Jrc3BhY2VJZCA9IG5ldyBNYXA8c3RyaW5nLCBBZ2VudFNlc3Npb25NZXRhW10+KClcbiAgICBmb3IgKGNvbnN0IHdvcmtzcGFjZSBvZiB3b3Jrc3BhY2VzKSB7XG4gICAgICBzZXNzaW9uc0J5V29ya3NwYWNlSWQuc2V0KHdvcmtzcGFjZS5pZCwgW10pXG4gICAgfVxuICAgIGNvbnN0IGRlZmF1bHRXc0lkID0gd29ya3NwYWNlcy5maW5kKCh3cykgPT4gd3Muc2x1ZyA9PT0gJ2RlZmF1bHQnKT8uaWQgPz8gd29ya3NwYWNlc1swXT8uaWRcblxuICAgIGNvbnN0IHZpc2libGVIaXN0b3J5ID0gc29ydEFnZW50U2Vzc2lvbnNCeVVwZGF0ZWRBdERlc2MoXG4gICAgICBjdXJyZW50TW9kZUFnZW50U2Vzc2lvbnMuZmlsdGVyKFxuICAgICAgICAoc2Vzc2lvbikgPT4gIXNlc3Npb24uYXJjaGl2ZWQgJiYgIXNlc3Npb24ucGlubmVkICYmICFkcmFmdFNlc3Npb25JZHMuaGFzKHNlc3Npb24uaWQpXG4gICAgICApXG4gICAgKVxuXG4gICAgZm9yIChjb25zdCBzZXNzaW9uIG9mIHZpc2libGVIaXN0b3J5KSB7XG4gICAgICBjb25zdCB0YXJnZXRJZCA9XG4gICAgICAgIHNlc3Npb24ud29ya3NwYWNlSWQgJiYgc2Vzc2lvbnNCeVdvcmtzcGFjZUlkLmhhcyhzZXNzaW9uLndvcmtzcGFjZUlkKVxuICAgICAgICAgID8gc2Vzc2lvbi53b3Jrc3BhY2VJZFxuICAgICAgICAgIDogZGVmYXVsdFdzSWRcbiAgICAgIGlmICghdGFyZ2V0SWQpIGNvbnRpbnVlXG4gICAgICBzZXNzaW9uc0J5V29ya3NwYWNlSWQuZ2V0KHRhcmdldElkKSEucHVzaChzZXNzaW9uKVxuICAgIH1cblxuICAgIHJldHVybiB3b3Jrc3BhY2VzLm1hcCgod29ya3NwYWNlKSA9PiAoe1xuICAgICAgd29ya3NwYWNlLFxuICAgICAgc2Vzc2lvbnM6IHNlc3Npb25zQnlXb3Jrc3BhY2VJZC5nZXQod29ya3NwYWNlLmlkKSA/PyBbXSxcbiAgICB9KSlcbiAgfSwgW2N1cnJlbnRNb2RlQWdlbnRTZXNzaW9ucywgZHJhZnRTZXNzaW9uSWRzLCB3b3Jrc3BhY2VzXSlcblxuICAvLyDpgInkuK3kvJror53lj5jljJbml7bvvIzlpoLmnpzmlrDpgInkuK3nmoTkvJror53lnKjmn5DkuKrmipjlj6DnmoQgZ3JvdXAg6YeM77yM6Ieq5Yqo5bGV5byA6K+lIGdyb3VwXG4gIC8vIOmBv+WFjemhtuagjyB0YWIg5YiH5Yiw5oqY5Y+g5Lya6K+d5pe2IHNpZGViYXIg5om+5LiN5Yiw6YCJ5Lit6aG5XG4gIFJlYWN0LnVzZUVmZmVjdCgoKSA9PiB7XG4gICAgaWYgKCFhY3RpdmVTZXNzaW9uSWQpIHJldHVyblxuICAgIGNvbnN0IGdyb3VwV2l0aEFjdGl2ZSA9IGFnZW50UHJvamVjdEdyb3Vwcy5maW5kKChnKSA9PlxuICAgICAgZy5zZXNzaW9ucy5zb21lKChzKSA9PiBzLmlkID09PSBhY3RpdmVTZXNzaW9uSWQpXG4gICAgKVxuICAgIGlmICghZ3JvdXBXaXRoQWN0aXZlKSByZXR1cm5cbiAgICBjb25zdCB3c0lkID0gZ3JvdXBXaXRoQWN0aXZlLndvcmtzcGFjZS5pZFxuICAgIHNldENvbGxhcHNlZFdvcmtzcGFjZUlkcygocHJldikgPT4ge1xuICAgICAgaWYgKCFwcmV2Lmhhcyh3c0lkKSkgcmV0dXJuIHByZXZcbiAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHByZXYpXG4gICAgICBuZXh0LmRlbGV0ZSh3c0lkKVxuICAgICAgcmV0dXJuIG5leHRcbiAgICB9KVxuICB9LCBbYWN0aXZlU2Vzc2lvbklkLCBhZ2VudFByb2plY3RHcm91cHMsIHNldENvbGxhcHNlZFdvcmtzcGFjZUlkc10pXG5cbiAgLy8g5Yig6Zmk56Gu6K6k5by556qX77yIY29sbGFwc2VkL2V4cGFuZGVkIOWFseS6q++8iVxuICBjb25zdCBkZWxldGVEaWFsb2cgPSAoXG4gICAgPEFsZXJ0RGlhbG9nXG4gICAgICBvcGVuPXtwZW5kaW5nRGVsZXRlSWQgIT09IG51bGx9XG4gICAgICBvbk9wZW5DaGFuZ2U9eyhvcGVuKSA9PiB7XG4gICAgICAgIGlmICghb3Blbikgc2V0UGVuZGluZ0RlbGV0ZUlkKG51bGwpXG4gICAgICB9fVxuICAgID5cbiAgICAgIDxBbGVydERpYWxvZ0NvbnRlbnRcbiAgICAgICAgb25LZXlEb3duPXsoZSkgPT4ge1xuICAgICAgICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJykge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXG4gICAgICAgICAgICBoYW5kbGVDb25maXJtRGVsZXRlKClcbiAgICAgICAgICB9XG4gICAgICAgIH19XG4gICAgICA+XG4gICAgICAgIDxBbGVydERpYWxvZ0hlYWRlcj5cbiAgICAgICAgICA8QWxlcnREaWFsb2dUaXRsZT7noa7orqTliKDpmaTlr7nor508L0FsZXJ0RGlhbG9nVGl0bGU+XG4gICAgICAgICAgPEFsZXJ0RGlhbG9nRGVzY3JpcHRpb24+5Yig6Zmk5ZCO5bCG5peg5rOV5oGi5aSN77yM56Gu5a6a6KaB5Yig6Zmk6L+Z5Liq5a+56K+d5ZCX77yfPC9BbGVydERpYWxvZ0Rlc2NyaXB0aW9uPlxuICAgICAgICA8L0FsZXJ0RGlhbG9nSGVhZGVyPlxuICAgICAgICA8QWxlcnREaWFsb2dGb290ZXI+XG4gICAgICAgICAgPEFsZXJ0RGlhbG9nQ2FuY2VsPuWPlua2iDwvQWxlcnREaWFsb2dDYW5jZWw+XG4gICAgICAgICAgPEFsZXJ0RGlhbG9nQWN0aW9uXG4gICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVDb25maXJtRGVsZXRlfVxuICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctZGVzdHJ1Y3RpdmUgdGV4dC1kZXN0cnVjdGl2ZS1mb3JlZ3JvdW5kIGhvdmVyOmJnLWRlc3RydWN0aXZlLzkwXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICDliKDpmaRcbiAgICAgICAgICA8L0FsZXJ0RGlhbG9nQWN0aW9uPlxuICAgICAgICA8L0FsZXJ0RGlhbG9nRm9vdGVyPlxuICAgICAgPC9BbGVydERpYWxvZ0NvbnRlbnQ+XG4gICAgPC9BbGVydERpYWxvZz5cbiAgKVxuXG4gIGNvbnN0IHByb2plY3REZWxldGVEaWFsb2cgPSAoXG4gICAgPEFsZXJ0RGlhbG9nXG4gICAgICBvcGVuPXtwZW5kaW5nRGVsZXRlV29ya3NwYWNlSWQgIT09IG51bGx9XG4gICAgICBvbk9wZW5DaGFuZ2U9eyhvcGVuKSA9PiB7XG4gICAgICAgIGlmICghb3BlbiAmJiAhZGVsZXRpbmdXb3Jrc3BhY2VJZCkgc2V0UGVuZGluZ0RlbGV0ZVdvcmtzcGFjZUlkKG51bGwpXG4gICAgICB9fVxuICAgID5cbiAgICAgIDxBbGVydERpYWxvZ0NvbnRlbnRcbiAgICAgICAgb25DbG9zZUF1dG9Gb2N1cz17KGV2ZW50KSA9PiBldmVudC5wcmV2ZW50RGVmYXVsdCgpfVxuICAgICAgICBvbktleURvd249eyhlKSA9PiB7XG4gICAgICAgICAgaWYgKGUua2V5ID09PSAnRW50ZXInICYmICFkZWxldGluZ1dvcmtzcGFjZUlkKSB7XG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgICAgIHZvaWQgaGFuZGxlQ29uZmlybURlbGV0ZVdvcmtzcGFjZSgpXG4gICAgICAgICAgfVxuICAgICAgICB9fVxuICAgICAgPlxuICAgICAgICA8QWxlcnREaWFsb2dIZWFkZXI+XG4gICAgICAgICAgPEFsZXJ0RGlhbG9nVGl0bGU+56Gu6K6k5Yig6Zmk6aG555uuPC9BbGVydERpYWxvZ1RpdGxlPlxuICAgICAgICAgIDxBbGVydERpYWxvZ0Rlc2NyaXB0aW9uPlxuICAgICAgICAgICAg5bCG5Yig6Zmk44CMe3BlbmRpbmdEZWxldGVXb3Jrc3BhY2U/Lm5hbWUgPz8gJ+ivpemhueebrid9XG4gICAgICAgICAgICDjgI3lj4rlhbbnu5HlrprnmoTmiYDmnInkvJror53jgIHoh6rliqjku7vliqHjgIFNQ1DjgIFTa2lsbHMg5LiO5bel5L2c5Yy65paH5Lu244CC5Yig6Zmk5ZCO5peg5rOV5oGi5aSN44CCXG4gICAgICAgICAgPC9BbGVydERpYWxvZ0Rlc2NyaXB0aW9uPlxuICAgICAgICA8L0FsZXJ0RGlhbG9nSGVhZGVyPlxuICAgICAgICA8QWxlcnREaWFsb2dGb290ZXI+XG4gICAgICAgICAgPEFsZXJ0RGlhbG9nQ2FuY2VsIGRpc2FibGVkPXshIWRlbGV0aW5nV29ya3NwYWNlSWR9PuWPlua2iDwvQWxlcnREaWFsb2dDYW5jZWw+XG4gICAgICAgICAgPEFsZXJ0RGlhbG9nQWN0aW9uXG4gICAgICAgICAgICBkaXNhYmxlZD17ISFkZWxldGluZ1dvcmtzcGFjZUlkfVxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gdm9pZCBoYW5kbGVDb25maXJtRGVsZXRlV29ya3NwYWNlKCl9XG4gICAgICAgICAgICBjbGFzc05hbWU9XCJiZy1kZXN0cnVjdGl2ZSB0ZXh0LWRlc3RydWN0aXZlLWZvcmVncm91bmQgaG92ZXI6YmctZGVzdHJ1Y3RpdmUvOTBcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIHtkZWxldGluZ1dvcmtzcGFjZUlkID8gJ+WIoOmZpOS4rS4uLicgOiAn5Yig6Zmk6aG555uuJ31cbiAgICAgICAgICA8L0FsZXJ0RGlhbG9nQWN0aW9uPlxuICAgICAgICA8L0FsZXJ0RGlhbG9nRm9vdGVyPlxuICAgICAgPC9BbGVydERpYWxvZ0NvbnRlbnQ+XG4gICAgPC9BbGVydERpYWxvZz5cbiAgKVxuXG4gIC8vIOaJuemHj+WIoOmZpOehruiupOW8ueeql1xuICBjb25zdCBiYXRjaERlbGV0ZURpYWxvZyA9IChcbiAgICA8QWxlcnREaWFsb2dcbiAgICAgIG9wZW49e2JhdGNoRGVsZXRlQ29uZmlybU9wZW59XG4gICAgICBvbk9wZW5DaGFuZ2U9eyhvcGVuKSA9PiB7XG4gICAgICAgIGlmICghb3Blbikgc2V0QmF0Y2hEZWxldGVDb25maXJtT3BlbihmYWxzZSlcbiAgICAgIH19XG4gICAgPlxuICAgICAgPEFsZXJ0RGlhbG9nQ29udGVudD5cbiAgICAgICAgPEFsZXJ0RGlhbG9nSGVhZGVyPlxuICAgICAgICAgIDxBbGVydERpYWxvZ1RpdGxlPuehruiupOaJuemHj+WIoOmZpCB7YmF0Y2hTZWxlY3RlZFNlc3Npb25JZHMuc2l6ZX0g5Liq5Lya6K+dPC9BbGVydERpYWxvZ1RpdGxlPlxuICAgICAgICAgIDxBbGVydERpYWxvZ0Rlc2NyaXB0aW9uPlxuICAgICAgICAgICAg5Yig6Zmk5ZCO5bCG5peg5rOV5oGi5aSN77yM56Gu5a6a6KaB5Yig6Zmk6YCJ5Lit55qEIHtiYXRjaFNlbGVjdGVkU2Vzc2lvbklkcy5zaXplfSDkuKrkvJror53lkJfvvJ9cbiAgICAgICAgICA8L0FsZXJ0RGlhbG9nRGVzY3JpcHRpb24+XG4gICAgICAgIDwvQWxlcnREaWFsb2dIZWFkZXI+XG4gICAgICAgIDxBbGVydERpYWxvZ0Zvb3Rlcj5cbiAgICAgICAgICA8QWxlcnREaWFsb2dDYW5jZWw+5Y+W5raIPC9BbGVydERpYWxvZ0NhbmNlbD5cbiAgICAgICAgICA8QWxlcnREaWFsb2dBY3Rpb25cbiAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUNvbmZpcm1CYXRjaERlbGV0ZX1cbiAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLWRlc3RydWN0aXZlIHRleHQtZGVzdHJ1Y3RpdmUtZm9yZWdyb3VuZCBob3ZlcjpiZy1kZXN0cnVjdGl2ZS85MFwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAg5Yig6ZmkXG4gICAgICAgICAgPC9BbGVydERpYWxvZ0FjdGlvbj5cbiAgICAgICAgPC9BbGVydERpYWxvZ0Zvb3Rlcj5cbiAgICAgIDwvQWxlcnREaWFsb2dDb250ZW50PlxuICAgIDwvQWxlcnREaWFsb2c+XG4gIClcblxuICAvLyA9PT09PSDmipjlj6Av5bGV5byA77ya57uE5Lu25aeL57uI5oyC6L2977yM6YCa6L+H5aSW5bGCIHdpZHRoL29wYWNpdHkgdHJhbnNpdGlvbiDlrp7njrDliqjnlLsgPT09PT1cbiAgLy8g5YaF5a655aeL57uI5riy5p+T77yM5LuF5Zyo5oqY5Y+g5oCB6YCa6L+H5aSW5bGCIHBvaW50ZXItZXZlbnRzLW5vbmUg5bGP6JS95Lqk5LqSXG5cbiAgLy8gPT09PT0g5bGV5byA54q25oCB77ya5a6M5pW05L6n6L655qCPID09PT09XG4gIC8vIOagueaNriB0b3BMZXZlbE1vZGUgKyBhY3RpdmVSYWlsSXRlbSDmuLLmn5PkuI3lkIzlip/og73ljLrlhoXlrrlcbiAgY29uc3QgcmVuZGVyUmFpbENvbnRlbnQgPSAoKSA9PiB7XG4gICAgLy8gVEEg5qih5byP77ya5qC55o2uIGFjdGl2ZVJhaWxJdGVtIOa4suafk+OAgumAieS4reOAjuS8muivneOAj+i1sOmAmueUqCBTZXNzaW9uc1JhaWxDb250ZW50XG4gICAgLy8g77yI5pWw5o2u6KKrIGFnZW50UHJvamVjdEdyb3VwcyDmjIkgbW9kZT0ndGEnIOi/h+a7pO+8jOiHquWKqOaVsOaNrumalOemu++8ie+8m1xuICAgIC8vIOWFtuS7liA1IOS4quaooeWdl+i1sCBUQVNpZGViYXIg55qE5qaC6KeI6Z2i5p2/44CCXG4gICAgaWYgKHRvcExldmVsTW9kZSA9PT0gJ3RhJykge1xuICAgICAgaWYgKGFjdGl2ZVJhaWxJdGVtID09PSAnc2Vzc2lvbnMnKSB7XG4gICAgICAgIHJldHVybiAoXG4gICAgICAgICAgPFNlc3Npb25zUmFpbENvbnRlbnRcbiAgICAgICAgICAgIGFjdGl2ZVNlc3Npb25JZD17YWN0aXZlU2Vzc2lvbklkfVxuICAgICAgICAgICAgYWdlbnRQcm9qZWN0R3JvdXBzPXthZ2VudFByb2plY3RHcm91cHN9XG4gICAgICAgICAgICBhZ2VudEluZGljYXRvck1hcD17YWdlbnRJbmRpY2F0b3JNYXB9XG4gICAgICAgICAgICBzZXNzaW9uTW9kZWxNYXA9e3Nlc3Npb25Nb2RlbE1hcH1cbiAgICAgICAgICAgIGNoYW5uZWxzPXtjaGFubmVsc31cbiAgICAgICAgICAgIGNvbGxhcHNlZFdvcmtzcGFjZUlkcz17Y29sbGFwc2VkV29ya3NwYWNlSWRzfVxuICAgICAgICAgICAgc2V0Q29sbGFwc2VkV29ya3NwYWNlSWRzPXtzZXRDb2xsYXBzZWRXb3Jrc3BhY2VJZHN9XG4gICAgICAgICAgICBjdXJyZW50V29ya3NwYWNlSWQ9e2N1cnJlbnRXb3Jrc3BhY2VJZH1cbiAgICAgICAgICAgIHBpbm5lZEFnZW50U2Vzc2lvbnM9e3Bpbm5lZEFnZW50U2Vzc2lvbnN9XG4gICAgICAgICAgICBoYW5kbGVSZXF1ZXN0RGVsZXRlPXtoYW5kbGVSZXF1ZXN0RGVsZXRlfVxuICAgICAgICAgICAgaGFuZGxlU2VsZWN0QWdlbnRTZXNzaW9uPXtoYW5kbGVTZWxlY3RBZ2VudFNlc3Npb259XG4gICAgICAgICAgICBoYW5kbGVBZ2VudFJlbmFtZT17aGFuZGxlQWdlbnRSZW5hbWV9XG4gICAgICAgICAgICBoYW5kbGVUb2dnbGVQaW5BZ2VudD17aGFuZGxlVG9nZ2xlUGluQWdlbnR9XG4gICAgICAgICAgICBoYW5kbGVUb2dnbGVBcmNoaXZlQWdlbnQ9e2hhbmRsZVRvZ2dsZUFyY2hpdmVBZ2VudH1cbiAgICAgICAgICAgIHdvcmtzcGFjZU5hbWVNYXA9e3dvcmtzcGFjZU5hbWVNYXB9XG4gICAgICAgICAgICBzZWxlY3RXb3Jrc3BhY2U9e3NlbGVjdFdvcmtzcGFjZX1cbiAgICAgICAgICAgIGhhbmRsZU5ld1Nlc3Npb25JbldvcmtzcGFjZT17aGFuZGxlTmV3U2Vzc2lvbkluV29ya3NwYWNlfVxuICAgICAgICAgICAgb25SZW5hbWVXb3Jrc3BhY2U9e2hhbmRsZVdvcmtzcGFjZVJlbmFtZX1cbiAgICAgICAgICAgIG9uUmVxdWVzdERlbGV0ZVdvcmtzcGFjZT17aGFuZGxlUmVxdWVzdERlbGV0ZVdvcmtzcGFjZX1cbiAgICAgICAgICAgIGRyYWdQcm9qZWN0SWQ9e2RyYWdQcm9qZWN0SWR9XG4gICAgICAgICAgICBwcm9qZWN0RHJvcEluZGljYXRvcj17cHJvamVjdERyb3BJbmRpY2F0b3J9XG4gICAgICAgICAgICBvblByb2plY3REcmFnU3RhcnQ9e2hhbmRsZVByb2plY3REcmFnU3RhcnR9XG4gICAgICAgICAgICBvblByb2plY3REcmFnT3Zlcj17aGFuZGxlUHJvamVjdERyYWdPdmVyfVxuICAgICAgICAgICAgb25Qcm9qZWN0RHJhZ0xlYXZlPXtoYW5kbGVQcm9qZWN0RHJhZ0xlYXZlfVxuICAgICAgICAgICAgb25Qcm9qZWN0RHJvcD17aGFuZGxlUHJvamVjdERyb3B9XG4gICAgICAgICAgICBvblByb2plY3REcmFnRW5kPXtoYW5kbGVQcm9qZWN0RHJhZ0VuZH1cbiAgICAgICAgICAgIGJhdGNoU2VsZWN0V29ya3NwYWNlSWQ9e2JhdGNoU2VsZWN0V29ya3NwYWNlSWR9XG4gICAgICAgICAgICBiYXRjaFNlbGVjdGVkU2Vzc2lvbklkcz17YmF0Y2hTZWxlY3RlZFNlc3Npb25JZHN9XG4gICAgICAgICAgICBvbkVudGVyQmF0Y2hTZWxlY3Q9e2hhbmRsZUVudGVyQmF0Y2hTZWxlY3R9XG4gICAgICAgICAgICBvbkV4aXRCYXRjaFNlbGVjdD17aGFuZGxlRXhpdEJhdGNoU2VsZWN0fVxuICAgICAgICAgICAgb25Ub2dnbGVCYXRjaFNlbGVjdD17aGFuZGxlVG9nZ2xlQmF0Y2hTZWxlY3R9XG4gICAgICAgICAgICBvbkJhdGNoVXBkYXRlU2VsZWN0ZWQ9e3NldEJhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzfVxuICAgICAgICAgICAgb25SZXF1ZXN0QmF0Y2hEZWxldGU9e2hhbmRsZVJlcXVlc3RCYXRjaERlbGV0ZX1cbiAgICAgICAgICAgIG9uQ29uZmlybUJhdGNoRGVsZXRlPXtoYW5kbGVDb25maXJtQmF0Y2hEZWxldGV9XG4gICAgICAgICAgICBvbkNyZWF0ZVByb2plY3Q9e2NyZWF0ZVByb2plY3R9XG4gICAgICAgICAgLz5cbiAgICAgICAgKVxuICAgICAgfVxuICAgICAgaWYgKGFjdGl2ZVJhaWxJdGVtID09PSAnc2tpbGxzJykge1xuICAgICAgICByZXR1cm4gPFNraWxsc1JhaWxDb250ZW50IGNhcGFiaWxpdGllcz17Y2FwYWJpbGl0aWVzfSAvPlxuICAgICAgfVxuICAgICAgaWYgKGFjdGl2ZVJhaWxJdGVtID09PSAna2FuYmFuJykge1xuICAgICAgICByZXR1cm4gPEthbmJhblJhaWxDb250ZW50IC8+XG4gICAgICB9XG4gICAgICBpZiAoYWN0aXZlUmFpbEl0ZW0gPT09ICdtZW1vcnknKSB7XG4gICAgICAgIC8vIHJhaWwtb25see+8muS4jeWNoCBzaWRlYmFyXG4gICAgICAgIHJldHVybiBudWxsXG4gICAgICB9XG4gICAgICByZXR1cm4gPFRBU2lkZWJhciBhY3RpdmVSYWlsSXRlbT17YWN0aXZlUmFpbEl0ZW0gYXMgVEFSYWlsSXRlbX0gLz5cbiAgICB9XG5cbiAgICAvLyDpgJrnlKjmqKHlvI/moLnmja4gYWN0aXZlUmFpbEl0ZW0g5riy5p+TXG4gICAgc3dpdGNoIChhY3RpdmVSYWlsSXRlbSkge1xuICAgICAgY2FzZSAnc2tpbGxzJzpcbiAgICAgICAgcmV0dXJuIDxTa2lsbHNSYWlsQ29udGVudCBjYXBhYmlsaXRpZXM9e2NhcGFiaWxpdGllc30gLz5cbiAgICAgIGNhc2UgJ2RyYWZ0JzpcbiAgICAgICAgcmV0dXJuIDxEcmFmdExpc3RQYW5lbCAvPlxuICAgICAgY2FzZSAna2FuYmFuJzpcbiAgICAgICAgcmV0dXJuIDxLYW5iYW5SYWlsQ29udGVudCAvPlxuICAgICAgY2FzZSAnbWVtb3J5JzpcbiAgICAgIGNhc2UgJ2F1dG9tYXRpb24nOlxuICAgICAgICAvLyByYWlsLW9ubHnvvJrkuI3ljaAgc2lkZWJhcu+8iOWjs+WxguW3suaKmOWPoO+8ie+8m+WFnOW6lemBv+WFjeivr+a4suafk+aXp+WIl+ihqFxuICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgY2FzZSAnc2Vzc2lvbnMnOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICA8U2Vzc2lvbnNSYWlsQ29udGVudFxuICAgICAgICAgICAgYWN0aXZlU2Vzc2lvbklkPXthY3RpdmVTZXNzaW9uSWR9XG4gICAgICAgICAgICBhZ2VudFByb2plY3RHcm91cHM9e2FnZW50UHJvamVjdEdyb3Vwc31cbiAgICAgICAgICAgIGFnZW50SW5kaWNhdG9yTWFwPXthZ2VudEluZGljYXRvck1hcH1cbiAgICAgICAgICAgIHNlc3Npb25Nb2RlbE1hcD17c2Vzc2lvbk1vZGVsTWFwfVxuICAgICAgICAgICAgY2hhbm5lbHM9e2NoYW5uZWxzfVxuICAgICAgICAgICAgY29sbGFwc2VkV29ya3NwYWNlSWRzPXtjb2xsYXBzZWRXb3Jrc3BhY2VJZHN9XG4gICAgICAgICAgICBzZXRDb2xsYXBzZWRXb3Jrc3BhY2VJZHM9e3NldENvbGxhcHNlZFdvcmtzcGFjZUlkc31cbiAgICAgICAgICAgIGN1cnJlbnRXb3Jrc3BhY2VJZD17Y3VycmVudFdvcmtzcGFjZUlkfVxuICAgICAgICAgICAgcGlubmVkQWdlbnRTZXNzaW9ucz17cGlubmVkQWdlbnRTZXNzaW9uc31cbiAgICAgICAgICAgIGhhbmRsZVJlcXVlc3REZWxldGU9e2hhbmRsZVJlcXVlc3REZWxldGV9XG4gICAgICAgICAgICBoYW5kbGVTZWxlY3RBZ2VudFNlc3Npb249e2hhbmRsZVNlbGVjdEFnZW50U2Vzc2lvbn1cbiAgICAgICAgICAgIGhhbmRsZUFnZW50UmVuYW1lPXtoYW5kbGVBZ2VudFJlbmFtZX1cbiAgICAgICAgICAgIGhhbmRsZVRvZ2dsZVBpbkFnZW50PXtoYW5kbGVUb2dnbGVQaW5BZ2VudH1cbiAgICAgICAgICAgIGhhbmRsZVRvZ2dsZUFyY2hpdmVBZ2VudD17aGFuZGxlVG9nZ2xlQXJjaGl2ZUFnZW50fVxuICAgICAgICAgICAgd29ya3NwYWNlTmFtZU1hcD17d29ya3NwYWNlTmFtZU1hcH1cbiAgICAgICAgICAgIHNlbGVjdFdvcmtzcGFjZT17c2VsZWN0V29ya3NwYWNlfVxuICAgICAgICAgICAgaGFuZGxlTmV3U2Vzc2lvbkluV29ya3NwYWNlPXtoYW5kbGVOZXdTZXNzaW9uSW5Xb3Jrc3BhY2V9XG4gICAgICAgICAgICBvblJlbmFtZVdvcmtzcGFjZT17aGFuZGxlV29ya3NwYWNlUmVuYW1lfVxuICAgICAgICAgICAgb25SZXF1ZXN0RGVsZXRlV29ya3NwYWNlPXtoYW5kbGVSZXF1ZXN0RGVsZXRlV29ya3NwYWNlfVxuICAgICAgICAgICAgZHJhZ1Byb2plY3RJZD17ZHJhZ1Byb2plY3RJZH1cbiAgICAgICAgICAgIHByb2plY3REcm9wSW5kaWNhdG9yPXtwcm9qZWN0RHJvcEluZGljYXRvcn1cbiAgICAgICAgICAgIG9uUHJvamVjdERyYWdTdGFydD17aGFuZGxlUHJvamVjdERyYWdTdGFydH1cbiAgICAgICAgICAgIG9uUHJvamVjdERyYWdPdmVyPXtoYW5kbGVQcm9qZWN0RHJhZ092ZXJ9XG4gICAgICAgICAgICBvblByb2plY3REcmFnTGVhdmU9e2hhbmRsZVByb2plY3REcmFnTGVhdmV9XG4gICAgICAgICAgICBvblByb2plY3REcm9wPXtoYW5kbGVQcm9qZWN0RHJvcH1cbiAgICAgICAgICAgIG9uUHJvamVjdERyYWdFbmQ9e2hhbmRsZVByb2plY3REcmFnRW5kfVxuICAgICAgICAgICAgYmF0Y2hTZWxlY3RXb3Jrc3BhY2VJZD17YmF0Y2hTZWxlY3RXb3Jrc3BhY2VJZH1cbiAgICAgICAgICAgIGJhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzPXtiYXRjaFNlbGVjdGVkU2Vzc2lvbklkc31cbiAgICAgICAgICAgIG9uRW50ZXJCYXRjaFNlbGVjdD17aGFuZGxlRW50ZXJCYXRjaFNlbGVjdH1cbiAgICAgICAgICAgIG9uRXhpdEJhdGNoU2VsZWN0PXtoYW5kbGVFeGl0QmF0Y2hTZWxlY3R9XG4gICAgICAgICAgICBvblRvZ2dsZUJhdGNoU2VsZWN0PXtoYW5kbGVUb2dnbGVCYXRjaFNlbGVjdH1cbiAgICAgICAgICAgIG9uQmF0Y2hVcGRhdGVTZWxlY3RlZD17c2V0QmF0Y2hTZWxlY3RlZFNlc3Npb25JZHN9XG4gICAgICAgICAgICBvblJlcXVlc3RCYXRjaERlbGV0ZT17aGFuZGxlUmVxdWVzdEJhdGNoRGVsZXRlfVxuICAgICAgICAgICAgb25Db25maXJtQmF0Y2hEZWxldGU9e2hhbmRsZUNvbmZpcm1CYXRjaERlbGV0ZX1cbiAgICAgICAgICAgIG9uQ3JlYXRlUHJvamVjdD17Y3JlYXRlUHJvamVjdH1cbiAgICAgICAgICAvPlxuICAgICAgICApXG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2XG4gICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAnbmF2LWlzbGFuZC1zaWRlYmFyIHJlbGF0aXZlIHotWzFdIGgtZnVsbCB3LWZ1bGwgZmxleCBmbGV4LWNvbCBvdmVyZmxvdy1oaWRkZW4gbWluLXctMCdcbiAgICAgICl9XG4gICAgPlxuICAgICAgey8qIOS8muivnSAvIOiNieeov++8muWvuem9kCBnbGFzcy1zdHVkaW8gLnNpZGViYXItaW5uZXIg57uT5p6EICovfVxuICAgICAge2FjdGl2ZVJhaWxJdGVtID09PSAnc2Vzc2lvbnMnID8gKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNpZGViYXItaW5uZXJcIj5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNpZGViYXItaGVhZCB0aXRsZWJhci1uby1kcmFnXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInNpZGViYXItaGVhZC1jb3B5XCI+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInNpZGViYXItc2VjdGlvbi1raWNrZXJcIj5XT1JLU1BBQ0U8L3NwYW4+XG4gICAgICAgICAgICAgIDxoMiBjbGFzc05hbWU9XCJzaWRlYmFyLWhlYWQtdGl0bGVcIj7kvJror508L2gyPlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRvb2wtY2x1c3RlclwiIHJvbGU9XCJncm91cFwiIGFyaWEtbGFiZWw9XCLkvJror53mk43kvZxcIj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRvb2wtY2x1c3Rlci1pY29uXCJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXROYXZpZ2F0aW9uU2lkZWJhck9wZW4oZmFsc2UpfVxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9XCLmipjlj6DkvqfmoI9cIlxuICAgICAgICAgICAgICAgIHRpdGxlPVwi5oqY5Y+g5L6n5qCPXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxQYW5lbExlZnRDbG9zZSBzaXplPXsxNH0gc3Ryb2tlV2lkdGg9ezEuNzV9IGFyaWEtaGlkZGVuPVwidHJ1ZVwiIC8+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidG9vbC1jbHVzdGVyLWFjY2VudFwiXG4gICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlTmV3QWdlbnRTZXNzaW9ufVxuICAgICAgICAgICAgICAgIHRpdGxlPVwi5paw5bu65Lya6K+dXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIOaWsOS8muivnVxuICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgPFNlc3Npb25TZWFyY2hJbmxpbmVcbiAgICAgICAgICAgIGxpc3RTbG90PXtcbiAgICAgICAgICAgICAgPGRpdiBrZXk9e2FjdGl2ZVJhaWxJdGVtfSBjbGFzc05hbWU9XCJmbGV4IG1pbi1oLTAgZmxleC0xIGZsZXgtY29sXCI+XG4gICAgICAgICAgICAgICAge3JlbmRlclJhaWxDb250ZW50KCl9XG4gICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9vdGVyU2xvdD17XG4gICAgICAgICAgICAgIG1vZGUgPT09ICdhZ2VudCcgJiYgYXJjaGl2ZWRBZ2VudFNlc3Npb25Db3VudCA+IDAgPyAoXG4gICAgICAgICAgICAgICAgPGZvb3RlciBjbGFzc05hbWU9XCJzaWRlYmFyLWZvb3RlclwiPlxuICAgICAgICAgICAgICAgICAgPFBvcG92ZXI+XG4gICAgICAgICAgICAgICAgICAgIDxQb3BvdmVyVHJpZ2dlciBhc0NoaWxkPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwic2lkZWJhci1mb290ZXItYnRuIHRpdGxlYmFyLW5vLWRyYWdcIlxuICAgICAgICAgICAgICAgICAgICAgICAgYXJpYS1sYWJlbD17YOW3suW9kuahoyAke2FyY2hpdmVkQWdlbnRTZXNzaW9uQ291bnR9YH1cbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICA8QXJjaGl2ZSBzaXplPXsxMn0gc3Ryb2tlV2lkdGg9ezEuNzV9IGNsYXNzTmFtZT1cIm9wYWNpdHktNzBcIiBhcmlhLWhpZGRlbiAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+5bey5b2S5qGjPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic2lkZWJhci1mb290ZXItY291bnRcIj57YXJjaGl2ZWRBZ2VudFNlc3Npb25Db3VudH08L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgIDwvUG9wb3ZlclRyaWdnZXI+XG4gICAgICAgICAgICAgICAgICAgIDxQb3BvdmVyQ29udGVudFxuICAgICAgICAgICAgICAgICAgICAgIHNpZGU9XCJ0b3BcIlxuICAgICAgICAgICAgICAgICAgICAgIGFsaWduPVwic3RhcnRcIlxuICAgICAgICAgICAgICAgICAgICAgIHNpZGVPZmZzZXQ9ezZ9XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy03MiBwLTAgb3ZlcmZsb3ctaGlkZGVuXCJcbiAgICAgICAgICAgICAgICAgICAgICBvbk9wZW5BdXRvRm9jdXM9eyhlKSA9PiBlLnByZXZlbnREZWZhdWx0KCl9XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktYmV0d2VlbiBweC0yLjUgcHktMS41IGJvcmRlci1iIGJvcmRlci1ib3JkZXIvNDBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQtWzExcHhdIGZvbnQtbWVkaXVtIHRleHQtZm9yZWdyb3VuZC81MCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICDlt7LlvZLmoaPkvJror50gwrcge2FyY2hpdmVkQWdlbnRTZXNzaW9uQ291bnR9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYXgtaC1bNjB2aF0gb3ZlcmZsb3cteS1hdXRvIHNjcm9sbGJhci1hdXRvaGlkZSBwLTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgIHthcmNoaXZlZEFnZW50U2Vzc2lvbnNMaXN0Lmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJweS0zIHRleHQtY2VudGVyIHRleHQtWzEycHhdIHRleHQtZm9yZWdyb3VuZC80MFwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIOaaguaXoOW3suW9kuaho+S8muivnVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LWNvbCBnYXAtMC41XCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge2FyY2hpdmVkQWdlbnRTZXNzaW9uc0xpc3QubWFwKChzZXNzaW9uKSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8QWdlbnRTZXNzaW9uSXRlbVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBrZXk9e3Nlc3Npb24uaWR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb249e3Nlc3Npb259XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFjdGl2ZT17c2Vzc2lvbi5pZCA9PT0gYWN0aXZlU2Vzc2lvbklkfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbmRpY2F0b3JTdGF0dXM9e2FnZW50SW5kaWNhdG9yTWFwLmdldChzZXNzaW9uLmlkKSA/PyAnaWRsZSd9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG1vZGVsTmFtZT17XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbk1vZGVsTWFwLmdldChzZXNzaW9uLmlkKVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPyByZXNvbHZlTW9kZWxEaXNwbGF5TmFtZShcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXNzaW9uTW9kZWxNYXAuZ2V0KHNlc3Npb24uaWQpISxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjaGFubmVsc1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxlZnRBY2NlbnQ9e2dldFNlc3Npb25MZWZ0QWNjZW50KFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFnZW50SW5kaWNhdG9yTWFwLmdldChzZXNzaW9uLmlkKSA/PyAnaWRsZScsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc2Vzc2lvbi5pZCA9PT0gYWN0aXZlU2Vzc2lvbklkLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNlc3Npb24ubWFudWFsV29ya2luZ1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB3b3Jrc3BhY2VOYW1lPXtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLndvcmtzcGFjZUlkXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA/IHdvcmtzcGFjZU5hbWVNYXAuZ2V0KHNlc3Npb24ud29ya3NwYWNlSWQpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA6IHVuZGVmaW5lZFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uU2VsZWN0PXtoYW5kbGVTZWxlY3RBZ2VudFNlc3Npb259XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uUmVxdWVzdERlbGV0ZT17aGFuZGxlUmVxdWVzdERlbGV0ZX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25SZW5hbWU9e2hhbmRsZUFnZW50UmVuYW1lfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvblRvZ2dsZVBpbj17aGFuZGxlVG9nZ2xlUGluQWdlbnR9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uVG9nZ2xlQXJjaGl2ZT17aGFuZGxlVG9nZ2xlQXJjaGl2ZUFnZW50fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkaXNhYmxlTWluaU1hcFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdXJmYWNlPVwiY29tcGFjdFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICkpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgIDwvUG9wb3ZlckNvbnRlbnQ+XG4gICAgICAgICAgICAgICAgICA8L1BvcG92ZXI+XG4gICAgICAgICAgICAgICAgPC9mb290ZXI+XG4gICAgICAgICAgICAgICkgOiBudWxsXG4gICAgICAgICAgICB9XG4gICAgICAgICAgLz5cbiAgICAgICAgPC9kaXY+XG4gICAgICApIDogYWN0aXZlUmFpbEl0ZW0gPT09ICdkcmFmdCcgPyAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2lkZWJhci1pbm5lclwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2lkZWJhci1oZWFkIHRpdGxlYmFyLW5vLWRyYWdcIj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwic2lkZWJhci1oZWFkLWNvcHlcIj5cbiAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic2lkZWJhci1zZWN0aW9uLWtpY2tlclwiPkRSQUZUUzwvc3Bhbj5cbiAgICAgICAgICAgICAgPGgyIGNsYXNzTmFtZT1cInNpZGViYXItaGVhZC10aXRsZVwiPuiNieeovzwvaDI+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidG9vbC1jbHVzdGVyXCIgcm9sZT1cImdyb3VwXCIgYXJpYS1sYWJlbD1cIuiNieeov+aTjeS9nFwiPlxuICAgICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidG9vbC1jbHVzdGVyLWljb25cIlxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldE5hdmlnYXRpb25TaWRlYmFyT3BlbihmYWxzZSl9XG4gICAgICAgICAgICAgICAgYXJpYS1sYWJlbD1cIuaKmOWPoOS+p+agj1wiXG4gICAgICAgICAgICAgICAgdGl0bGU9XCLmipjlj6DkvqfmoI9cIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFBhbmVsTGVmdENsb3NlIHNpemU9ezE0fSBzdHJva2VXaWR0aD17MS43NX0gYXJpYS1oaWRkZW49XCJ0cnVlXCIgLz5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0b29sLWNsdXN0ZXItYWNjZW50XCJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVOZXdEcmFmdH1cbiAgICAgICAgICAgICAgICB0aXRsZT1cIuaWsOW7uuiNieeov1wiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICDmlrDojYnnqL9cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPVwic2lkZWJhci1zZWFyY2gtdHJpZ2dlciB0aXRsZWJhci1uby1kcmFnXCJcbiAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldERyYWZ0U2VhcmNoT3Blbih0cnVlKX1cbiAgICAgICAgICAgIGFyaWEtbGFiZWw9XCLmkJzntKLojYnnqL9cIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxTZWFyY2ggc2l6ZT17MTR9IHN0cm9rZVdpZHRoPXsxLjV9IGFyaWEtaGlkZGVuPVwidHJ1ZVwiIC8+XG4gICAgICAgICAgICA8c3Bhbj7mkJzntKLojYnnqL88L3NwYW4+XG4gICAgICAgICAgICA8a2JkPntpc01hYyA/ICfijJggSycgOiAnQ3RybCBLJ308L2tiZD5cbiAgICAgICAgICA8L2J1dHRvbj5cblxuICAgICAgICAgIDxkaXYga2V5PXthY3RpdmVSYWlsSXRlbX0gY2xhc3NOYW1lPVwiZmxleCBtaW4taC0wIGZsZXgtMSBmbGV4LWNvbFwiPlxuICAgICAgICAgICAge3JlbmRlclJhaWxDb250ZW50KCl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKSA6IChcbiAgICAgICAgLyog5LiO5Lya6K+dL+iNieeov+S4gOiHtO+8mnNpZGViYXItaW5uZXIg5o+Q5L6b5LiO5aSW5bGC5rWu5bKb55qEIGluc2V077yMbGlzdC13ZWxsIOS4jeWGjeW3puWPs+i0tOi+uSAqL1xuICAgICAgICA8ZGl2IGtleT17YWN0aXZlUmFpbEl0ZW19IGNsYXNzTmFtZT1cInNpZGViYXItaW5uZXJcIj5cbiAgICAgICAgICB7cmVuZGVyUmFpbENvbnRlbnQoKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICApfVxuXG4gICAgICB7Lyog5bey5b2S5qGj5YWl5Y+j5bey56e75YWlIHNpZGViYXItaW5uZXLvvIhzZXNzaW9uc++8iSAqL31cblxuICAgICAge2RlbGV0ZURpYWxvZ31cbiAgICAgIHtwcm9qZWN0RGVsZXRlRGlhbG9nfVxuICAgICAge2JhdGNoRGVsZXRlRGlhbG9nfVxuICAgICAgPERyYWZ0U2VhcmNoRGlhbG9nIC8+XG4gICAgPC9kaXY+XG4gIClcbn1cblxuLy8gPT09PT0g5Yqf6IO95Yy65YaF5a6557uE5Lu2ID09PT09XG5cbi8qKiDkvJror53lip/og73ljLrlhoXlrrnvvIjku4UgQWdlbnQg5Lya6K+d77yJICovXG5mdW5jdGlvbiBTZXNzaW9uc1JhaWxDb250ZW50KHtcbiAgYWN0aXZlU2Vzc2lvbklkLFxuICBhZ2VudFByb2plY3RHcm91cHMsXG4gIGFnZW50SW5kaWNhdG9yTWFwLFxuICBzZXNzaW9uTW9kZWxNYXAsXG4gIGNoYW5uZWxzLFxuICBjb2xsYXBzZWRXb3Jrc3BhY2VJZHMsXG4gIHNldENvbGxhcHNlZFdvcmtzcGFjZUlkcyxcbiAgY3VycmVudFdvcmtzcGFjZUlkLFxuICBwaW5uZWRBZ2VudFNlc3Npb25zLFxuICBoYW5kbGVSZXF1ZXN0RGVsZXRlLFxuICBoYW5kbGVTZWxlY3RBZ2VudFNlc3Npb24sXG4gIGhhbmRsZUFnZW50UmVuYW1lLFxuICBoYW5kbGVUb2dnbGVQaW5BZ2VudCxcbiAgaGFuZGxlVG9nZ2xlQXJjaGl2ZUFnZW50LFxuICB3b3Jrc3BhY2VOYW1lTWFwLFxuICBzZWxlY3RXb3Jrc3BhY2UsXG4gIGhhbmRsZU5ld1Nlc3Npb25JbldvcmtzcGFjZSxcbiAgb25SZW5hbWVXb3Jrc3BhY2UsXG4gIG9uUmVxdWVzdERlbGV0ZVdvcmtzcGFjZSxcbiAgZHJhZ1Byb2plY3RJZCxcbiAgcHJvamVjdERyb3BJbmRpY2F0b3IsXG4gIG9uUHJvamVjdERyYWdTdGFydCxcbiAgb25Qcm9qZWN0RHJhZ092ZXIsXG4gIG9uUHJvamVjdERyYWdMZWF2ZSxcbiAgb25Qcm9qZWN0RHJvcCxcbiAgb25Qcm9qZWN0RHJhZ0VuZCxcbiAgYmF0Y2hTZWxlY3RXb3Jrc3BhY2VJZCxcbiAgYmF0Y2hTZWxlY3RlZFNlc3Npb25JZHMsXG4gIG9uRW50ZXJCYXRjaFNlbGVjdCxcbiAgb25FeGl0QmF0Y2hTZWxlY3QsXG4gIG9uVG9nZ2xlQmF0Y2hTZWxlY3QsXG4gIG9uQmF0Y2hVcGRhdGVTZWxlY3RlZCxcbiAgb25SZXF1ZXN0QmF0Y2hEZWxldGUsXG4gIG9uQ29uZmlybUJhdGNoRGVsZXRlLFxuICBvbkNyZWF0ZVByb2plY3QsXG59OiB7XG4gIGFjdGl2ZVNlc3Npb25JZDogc3RyaW5nIHwgbnVsbFxuICBhZ2VudFByb2plY3RHcm91cHM6IEFnZW50UHJvamVjdEdyb3VwW11cbiAgYWdlbnRJbmRpY2F0b3JNYXA6IE1hcDxzdHJpbmcsIFNlc3Npb25JbmRpY2F0b3JTdGF0dXM+XG4gIHNlc3Npb25Nb2RlbE1hcDogTWFwPHN0cmluZywgc3RyaW5nPlxuICBjaGFubmVsczogaW1wb3J0KCdAdGFnZW50L3NoYXJlZCcpLkNoYW5uZWxbXVxuICBjb2xsYXBzZWRXb3Jrc3BhY2VJZHM6IFNldDxzdHJpbmc+XG4gIHNldENvbGxhcHNlZFdvcmtzcGFjZUlkczogUmVhY3QuRGlzcGF0Y2g8UmVhY3QuU2V0U3RhdGVBY3Rpb248U2V0PHN0cmluZz4+PlxuICBjdXJyZW50V29ya3NwYWNlSWQ6IHN0cmluZyB8IG51bGxcbiAgcGlubmVkQWdlbnRTZXNzaW9uczogQWdlbnRTZXNzaW9uTWV0YVtdXG4gIGhhbmRsZVJlcXVlc3REZWxldGU6IChpZDogc3RyaW5nKSA9PiB2b2lkXG4gIGhhbmRsZVNlbGVjdEFnZW50U2Vzc2lvbjogKGlkOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcpID0+IHZvaWRcbiAgaGFuZGxlQWdlbnRSZW5hbWU6IChpZDogc3RyaW5nLCBuZXdUaXRsZTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+XG4gIGhhbmRsZVRvZ2dsZVBpbkFnZW50OiAoaWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPlxuICBoYW5kbGVUb2dnbGVBcmNoaXZlQWdlbnQ6IChpZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+XG4gIHdvcmtzcGFjZU5hbWVNYXA6IE1hcDxzdHJpbmcsIHN0cmluZz5cbiAgc2VsZWN0V29ya3NwYWNlOiAoaWQ6IHN0cmluZykgPT4gdm9pZFxuICBoYW5kbGVOZXdTZXNzaW9uSW5Xb3Jrc3BhY2U6ICh3b3Jrc3BhY2VJZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+XG4gIG9uUmVuYW1lV29ya3NwYWNlOiAod29ya3NwYWNlSWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+XG4gIG9uUmVxdWVzdERlbGV0ZVdvcmtzcGFjZTogKHdvcmtzcGFjZUlkOiBzdHJpbmcpID0+IHZvaWRcbiAgZHJhZ1Byb2plY3RJZDogc3RyaW5nIHwgbnVsbFxuICBwcm9qZWN0RHJvcEluZGljYXRvcjogeyBpZDogc3RyaW5nOyBwb3NpdGlvbjogJ2JlZm9yZScgfCAnYWZ0ZXInIH0gfCBudWxsXG4gIG9uUHJvamVjdERyYWdTdGFydDogKGU6IFJlYWN0LkRyYWdFdmVudCwgd29ya3NwYWNlSWQ6IHN0cmluZykgPT4gdm9pZFxuICBvblByb2plY3REcmFnT3ZlcjogKGU6IFJlYWN0LkRyYWdFdmVudCwgd29ya3NwYWNlSWQ6IHN0cmluZykgPT4gdm9pZFxuICBvblByb2plY3REcmFnTGVhdmU6IChlOiBSZWFjdC5EcmFnRXZlbnQpID0+IHZvaWRcbiAgb25Qcm9qZWN0RHJvcDogKGU6IFJlYWN0LkRyYWdFdmVudCwgd29ya3NwYWNlSWQ6IHN0cmluZykgPT4gdm9pZFxuICBvblByb2plY3REcmFnRW5kOiAoKSA9PiB2b2lkXG4gIGJhdGNoU2VsZWN0V29ya3NwYWNlSWQ6IHN0cmluZyB8IG51bGxcbiAgYmF0Y2hTZWxlY3RlZFNlc3Npb25JZHM6IFNldDxzdHJpbmc+XG4gIG9uRW50ZXJCYXRjaFNlbGVjdDogKHdvcmtzcGFjZUlkOiBzdHJpbmcpID0+IHZvaWRcbiAgb25FeGl0QmF0Y2hTZWxlY3Q6ICgpID0+IHZvaWRcbiAgb25Ub2dnbGVCYXRjaFNlbGVjdDogKHNlc3Npb25JZDogc3RyaW5nKSA9PiB2b2lkXG4gIG9uQmF0Y2hVcGRhdGVTZWxlY3RlZDogUmVhY3QuRGlzcGF0Y2g8UmVhY3QuU2V0U3RhdGVBY3Rpb248U2V0PHN0cmluZz4+PlxuICBvblJlcXVlc3RCYXRjaERlbGV0ZTogKCkgPT4gdm9pZFxuICBvbkNvbmZpcm1CYXRjaERlbGV0ZTogKCkgPT4gUHJvbWlzZTx2b2lkPlxuICBvbkNyZWF0ZVByb2plY3Q6ICgpID0+IFByb21pc2U8QWdlbnRXb3Jrc3BhY2UgfCBudWxsPlxufSk6IFJlYWN0LlJlYWN0RWxlbWVudCB7XG4gIGNvbnN0IHN0b3JlID0gdXNlU3RvcmUoKVxuXG4gIGNvbnN0IHRvZ2dsZUNvbGxhcHNlZCA9IFJlYWN0LnVzZUNhbGxiYWNrKFxuICAgICh3b3Jrc3BhY2VJZDogc3RyaW5nKTogdm9pZCA9PiB7XG4gICAgICBzZXRDb2xsYXBzZWRXb3Jrc3BhY2VJZHMoKHByZXYpID0+IHtcbiAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldilcbiAgICAgICAgaWYgKG5leHQuaGFzKHdvcmtzcGFjZUlkKSkgbmV4dC5kZWxldGUod29ya3NwYWNlSWQpXG4gICAgICAgIGVsc2UgbmV4dC5hZGQod29ya3NwYWNlSWQpXG4gICAgICAgIHJldHVybiBuZXh0XG4gICAgICB9KVxuICAgIH0sXG4gICAgW3NldENvbGxhcHNlZFdvcmtzcGFjZUlkc11cbiAgKVxuXG4gIGNvbnN0IGhhbmRsZVJlbmFtZVdvcmtzcGFjZSA9IG9uUmVuYW1lV29ya3NwYWNlXG4gIGNvbnN0IGhhbmRsZVJlcXVlc3REZWxldGVXb3Jrc3BhY2UgPSBvblJlcXVlc3REZWxldGVXb3Jrc3BhY2VcblxuICBjb25zdCBoYW5kbGVDb25maWd1cmVQcm9qZWN0ID0gUmVhY3QudXNlQ2FsbGJhY2soXG4gICAgKHdvcmtzcGFjZUlkOiBzdHJpbmcpOiB2b2lkID0+IHtcbiAgICAgIHNlbGVjdFdvcmtzcGFjZSh3b3Jrc3BhY2VJZClcbiAgICAgIHN0b3JlLnNldChhY3RpdmVSYWlsSXRlbUF0b20sICdza2lsbHMnKVxuICAgIH0sXG4gICAgW3NlbGVjdFdvcmtzcGFjZSwgc3RvcmVdXG4gIClcblxuICBjb25zdCBsaXN0UmVmID0gUmVhY3QudXNlUmVmPEhUTUxEaXZFbGVtZW50PihudWxsKVxuXG5cbiAgcmV0dXJuIChcbiAgICA8ZGl2IGNsYXNzTmFtZT1cImFwcC1zcGF0aWFsLXNlc3Npb24td2VsbCBsaXN0LXdlbGwgc2Vzc2lvbi13ZWxsIGZsZXgtMSBtaW4taC0wIHRpdGxlYmFyLW5vLWRyYWdcIj5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JvdXAtbGFiZWwgc2hyaW5rLTBcIj5cbiAgICAgICAgPHNwYW4+6aG555uuPC9zcGFuPlxuICAgICAgICA8VG9vbHRpcD5cbiAgICAgICAgICA8VG9vbHRpcFRyaWdnZXIgYXNDaGlsZD5cbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImdob3N0LXBsdXMgb3BhY2l0eS0xMDBcIlxuICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB2b2lkIG9uQ3JlYXRlUHJvamVjdCgpfVxuICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwi5paw5bu66aG555uuXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgK1xuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgPC9Ub29sdGlwVHJpZ2dlcj5cbiAgICAgICAgICA8VG9vbHRpcENvbnRlbnQgc2lkZT1cInRvcFwiPumAieaLqeebruW9leaWsOW7uumhueebrjwvVG9vbHRpcENvbnRlbnQ+XG4gICAgICAgIDwvVG9vbHRpcD5cbiAgICAgIDwvZGl2PlxuICAgICAgPGRpdiByZWY9e2xpc3RSZWZ9IGNsYXNzTmFtZT1cInNlc3Npb24tc2Nyb2xsIHNjcm9sbGJhci1hdXRvaGlkZSBtaW4taC0wIHJlbGF0aXZlXCI+XG4gICAgICAgIHsvKiDnva7pobbliIbljLrvvIjljp/lnovvvJrkvY3kuo4gc2Vzc2lvbi13ZWxsIOacgOS4iuaWue+8iSAqL31cbiAgICAgICAge3Bpbm5lZEFnZW50U2Vzc2lvbnMubGVuZ3RoID4gMCAmJiAoXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJzZXNzaW9uLWdyb3VwXCI+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImdyb3VwLWxhYmVsXCI+XG4gICAgICAgICAgICAgIDxzcGFuPue9rumhtjwvc3Bhbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtY29sXCI+XG4gICAgICAgICAgICAgIHtwaW5uZWRBZ2VudFNlc3Npb25zLm1hcCgoc2Vzc2lvbikgPT4gKFxuICAgICAgICAgICAgICAgIDxBZ2VudFNlc3Npb25JdGVtXG4gICAgICAgICAgICAgICAgICBrZXk9e3Nlc3Npb24uaWR9XG4gICAgICAgICAgICAgICAgICBzZXNzaW9uPXtzZXNzaW9ufVxuICAgICAgICAgICAgICAgICAgYWN0aXZlPXtzZXNzaW9uLmlkID09PSBhY3RpdmVTZXNzaW9uSWR9XG4gICAgICAgICAgICAgICAgICBpbmRpY2F0b3JTdGF0dXM9e2FnZW50SW5kaWNhdG9yTWFwLmdldChzZXNzaW9uLmlkKSA/PyAnaWRsZSd9XG4gICAgICAgICAgICAgICAgICBtb2RlbE5hbWU9e1xuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uTW9kZWxNYXAuZ2V0KHNlc3Npb24uaWQpXG4gICAgICAgICAgICAgICAgICAgICAgPyByZXNvbHZlTW9kZWxEaXNwbGF5TmFtZShzZXNzaW9uTW9kZWxNYXAuZ2V0KHNlc3Npb24uaWQpISwgY2hhbm5lbHMpXG4gICAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGxlZnRBY2NlbnQ9e2dldFNlc3Npb25MZWZ0QWNjZW50KFxuICAgICAgICAgICAgICAgICAgICBhZ2VudEluZGljYXRvck1hcC5nZXQoc2Vzc2lvbi5pZCkgPz8gJ2lkbGUnLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLmlkID09PSBhY3RpdmVTZXNzaW9uSWQsXG4gICAgICAgICAgICAgICAgICAgIHNlc3Npb24ubWFudWFsV29ya2luZ1xuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgIHdvcmtzcGFjZU5hbWU9e1xuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLndvcmtzcGFjZUlkID8gd29ya3NwYWNlTmFtZU1hcC5nZXQoc2Vzc2lvbi53b3Jrc3BhY2VJZCkgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIG9uU2VsZWN0PXtoYW5kbGVTZWxlY3RBZ2VudFNlc3Npb259XG4gICAgICAgICAgICAgICAgICBvblJlcXVlc3REZWxldGU9e2hhbmRsZVJlcXVlc3REZWxldGV9XG4gICAgICAgICAgICAgICAgICBvblJlbmFtZT17aGFuZGxlQWdlbnRSZW5hbWV9XG4gICAgICAgICAgICAgICAgICBvblRvZ2dsZVBpbj17aGFuZGxlVG9nZ2xlUGluQWdlbnR9XG4gICAgICAgICAgICAgICAgICBvblRvZ2dsZUFyY2hpdmU9e2hhbmRsZVRvZ2dsZUFyY2hpdmVBZ2VudH1cbiAgICAgICAgICAgICAgICAgIGRpc2FibGVNaW5pTWFwXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKX1cblxuICAgICAgICB7YWdlbnRQcm9qZWN0R3JvdXBzLmxlbmd0aCA9PT0gMCA/IChcbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInB4LTIgcHktMiB0ZXh0LVsxMXB4XSB0ZXh0LWZvcmVncm91bmQvMzAgdGV4dC1jZW50ZXIgc2VsZWN0LW5vbmVcIj5cbiAgICAgICAgICAgIOaaguaXoOmhueebrlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApIDogbnVsbH1cblxuICAgICAgICB7YWdlbnRQcm9qZWN0R3JvdXBzLmxlbmd0aCA+IDBcbiAgICAgICAgICA/IGFnZW50UHJvamVjdEdyb3Vwcy5tYXAoKGdyb3VwKSA9PiAoXG4gICAgICAgICAgICAgIDxBZ2VudFByb2plY3RHcm91cEl0ZW1cbiAgICAgICAgICAgICAgICBrZXk9e2dyb3VwLndvcmtzcGFjZS5pZH1cbiAgICAgICAgICAgICAgICBncm91cD17Z3JvdXB9XG4gICAgICAgICAgICAgICAgY3VycmVudFdvcmtzcGFjZUlkPXtjdXJyZW50V29ya3NwYWNlSWR9XG4gICAgICAgICAgICAgICAgY29sbGFwc2VkPXtjb2xsYXBzZWRXb3Jrc3BhY2VJZHMuaGFzKGdyb3VwLndvcmtzcGFjZS5pZCl9XG4gICAgICAgICAgICAgICAgYWN0aXZlU2Vzc2lvbklkPXthY3RpdmVTZXNzaW9uSWR9XG4gICAgICAgICAgICAgICAgYWdlbnRJbmRpY2F0b3JNYXA9e2FnZW50SW5kaWNhdG9yTWFwfVxuICAgICAgICAgICAgICAgIHNlc3Npb25Nb2RlbE1hcD17c2Vzc2lvbk1vZGVsTWFwfVxuICAgICAgICAgICAgICAgIGNoYW5uZWxzPXtjaGFubmVsc31cbiAgICAgICAgICAgICAgICB3b3Jrc3BhY2VOYW1lTWFwPXt3b3Jrc3BhY2VOYW1lTWFwfVxuICAgICAgICAgICAgICAgIG9uU2VsZWN0UHJvamVjdD17KGlkKSA9PiB7XG4gICAgICAgICAgICAgICAgICBzZWxlY3RXb3Jrc3BhY2UoaWQpXG4gICAgICAgICAgICAgICAgICB0b2dnbGVDb2xsYXBzZWQoaWQpXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICBvbk5ld1Nlc3Npb249e2hhbmRsZU5ld1Nlc3Npb25JbldvcmtzcGFjZX1cbiAgICAgICAgICAgICAgICBvblJlbmFtZVdvcmtzcGFjZT17aGFuZGxlUmVuYW1lV29ya3NwYWNlfVxuICAgICAgICAgICAgICAgIG9uUmVxdWVzdERlbGV0ZVdvcmtzcGFjZT17aGFuZGxlUmVxdWVzdERlbGV0ZVdvcmtzcGFjZX1cbiAgICAgICAgICAgICAgICBvbkNvbmZpZ3VyZVByb2plY3Q9e2hhbmRsZUNvbmZpZ3VyZVByb2plY3R9XG4gICAgICAgICAgICAgICAgb25TZWxlY3RTZXNzaW9uPXtoYW5kbGVTZWxlY3RBZ2VudFNlc3Npb259XG4gICAgICAgICAgICAgICAgaGFuZGxlUmVxdWVzdERlbGV0ZT17aGFuZGxlUmVxdWVzdERlbGV0ZX1cbiAgICAgICAgICAgICAgICBoYW5kbGVBZ2VudFJlbmFtZT17aGFuZGxlQWdlbnRSZW5hbWV9XG4gICAgICAgICAgICAgICAgaGFuZGxlVG9nZ2xlUGluQWdlbnQ9e2hhbmRsZVRvZ2dsZVBpbkFnZW50fVxuICAgICAgICAgICAgICAgIGhhbmRsZVRvZ2dsZUFyY2hpdmVBZ2VudD17aGFuZGxlVG9nZ2xlQXJjaGl2ZUFnZW50fVxuICAgICAgICAgICAgICAgIGRyYWdQcm9qZWN0SWQ9e2RyYWdQcm9qZWN0SWR9XG4gICAgICAgICAgICAgICAgcHJvamVjdERyb3BJbmRpY2F0b3I9e3Byb2plY3REcm9wSW5kaWNhdG9yfVxuICAgICAgICAgICAgICAgIG9uUHJvamVjdERyYWdTdGFydD17b25Qcm9qZWN0RHJhZ1N0YXJ0fVxuICAgICAgICAgICAgICAgIG9uUHJvamVjdERyYWdPdmVyPXtvblByb2plY3REcmFnT3Zlcn1cbiAgICAgICAgICAgICAgICBvblByb2plY3REcmFnTGVhdmU9e29uUHJvamVjdERyYWdMZWF2ZX1cbiAgICAgICAgICAgICAgICBvblByb2plY3REcm9wPXtvblByb2plY3REcm9wfVxuICAgICAgICAgICAgICAgIG9uUHJvamVjdERyYWdFbmQ9e29uUHJvamVjdERyYWdFbmR9XG4gICAgICAgICAgICAgICAgYmF0Y2hTZWxlY3RXb3Jrc3BhY2VJZD17YmF0Y2hTZWxlY3RXb3Jrc3BhY2VJZH1cbiAgICAgICAgICAgICAgICBiYXRjaFNlbGVjdGVkU2Vzc2lvbklkcz17YmF0Y2hTZWxlY3RlZFNlc3Npb25JZHN9XG4gICAgICAgICAgICAgICAgb25FbnRlckJhdGNoU2VsZWN0PXtvbkVudGVyQmF0Y2hTZWxlY3R9XG4gICAgICAgICAgICAgICAgb25FeGl0QmF0Y2hTZWxlY3Q9e29uRXhpdEJhdGNoU2VsZWN0fVxuICAgICAgICAgICAgICAgIG9uVG9nZ2xlQmF0Y2hTZWxlY3Q9e29uVG9nZ2xlQmF0Y2hTZWxlY3R9XG4gICAgICAgICAgICAgICAgb25CYXRjaFVwZGF0ZVNlbGVjdGVkPXtvbkJhdGNoVXBkYXRlU2VsZWN0ZWR9XG4gICAgICAgICAgICAgICAgb25SZXF1ZXN0QmF0Y2hEZWxldGU9e29uUmVxdWVzdEJhdGNoRGVsZXRlfVxuICAgICAgICAgICAgICAgIG9uQ29uZmlybUJhdGNoRGVsZXRlPXtvbkNvbmZpcm1CYXRjaERlbGV0ZX1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICkpXG4gICAgICAgICAgOiBudWxsfVxuICAgICAgPC9kaXY+XG4gICAgPC9kaXY+XG4gIClcbn1cblxuLyoqIOaPkuS7tuWKn+iDveWMuuWGheWuuSDigJTigJQg57uf5LiA5o+S5Lu25YiX6KGoICovXG5mdW5jdGlvbiBTa2lsbHNSYWlsQ29udGVudCh7XG4gIGNhcGFiaWxpdGllcyxcbn06IHtcbiAgY2FwYWJpbGl0aWVzOiBXb3Jrc3BhY2VDYXBhYmlsaXRpZXMgfCBudWxsXG59KTogUmVhY3QuUmVhY3RFbGVtZW50IHtcbiAgcmV0dXJuIDxQbHVnaW5TaWRlYmFyTmF2IGNhcGFiaWxpdGllcz17Y2FwYWJpbGl0aWVzfSAvPlxufVxuXG4vLyA9PT09PSDlr7nor53liJfooajpobkgPT09PT1cblxuLy8gPT09PT0g5a+56K+d5YiX6KGo6aG5ID09PT09XG5cbmludGVyZmFjZSBDb252ZXJzYXRpb25JdGVtUHJvcHMge1xuICBjb252ZXJzYXRpb246IENvbnZlcnNhdGlvbk1ldGFcbiAgYWN0aXZlOiBib29sZWFuXG4gIHN0cmVhbWluZzogYm9vbGVhblxuICAvKiog5piv5ZCm5Zyo5qCH6aKY5peB5pi+56S6IFBpbiDlm77moIcgKi9cbiAgc2hvd1Bpbkljb246IGJvb2xlYW5cbiAgb25TZWxlY3Q6IChpZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nKSA9PiB2b2lkXG4gIG9uUmVxdWVzdERlbGV0ZTogKGlkOiBzdHJpbmcpID0+IHZvaWRcbiAgb25SZW5hbWU6IChpZDogc3RyaW5nLCBuZXdUaXRsZTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+XG4gIG9uVG9nZ2xlUGluOiAoaWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPlxuICBvblRvZ2dsZUFyY2hpdmU6IChpZDogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+XG59XG5cbmNvbnN0IENvbnZlcnNhdGlvbkl0ZW0gPSBSZWFjdC5tZW1vKGZ1bmN0aW9uIENvbnZlcnNhdGlvbkl0ZW0oe1xuICBjb252ZXJzYXRpb24sXG4gIGFjdGl2ZSxcbiAgc3RyZWFtaW5nLFxuICBzaG93UGluSWNvbixcbiAgb25TZWxlY3QsXG4gIG9uUmVxdWVzdERlbGV0ZSxcbiAgb25SZW5hbWUsXG4gIG9uVG9nZ2xlUGluLFxuICBvblRvZ2dsZUFyY2hpdmUsXG59OiBDb252ZXJzYXRpb25JdGVtUHJvcHMpOiBSZWFjdC5SZWFjdEVsZW1lbnQge1xuICBjb25zdCBbZWRpdGluZywgc2V0RWRpdGluZ10gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2VkaXRUaXRsZSwgc2V0RWRpdFRpdGxlXSA9IFJlYWN0LnVzZVN0YXRlKCcnKVxuICBjb25zdCBbbWVudU9wZW4sIHNldE1lbnVPcGVuXSA9IFJlYWN0LnVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBpbnB1dFJlZiA9IFJlYWN0LnVzZVJlZjxIVE1MSW5wdXRFbGVtZW50PihudWxsKVxuICBjb25zdCBqdXN0U3RhcnRlZEVkaXRpbmcgPSBSZWFjdC51c2VSZWYoZmFsc2UpXG4gIC8vIOiPnOWNleaJk+W8gOaXtuWFs+mXrei/t+S9oOWcsOWbvumihOiniO+8jOmBv+WFjemihOiniOmdouadv+ebluS9j+iPnOWNlemhueWvvOiHtOeCueS4jeWKqFxuICBjb25zdCBwcmV2aWV3ID0gdXNlU2Vzc2lvbk1pbmlNYXBIb3ZlcigzMDAsIG1lbnVPcGVuKVxuXG4gIC8qKiDov5vlhaXnvJbovpHmqKHlvI8gKi9cbiAgY29uc3Qgc3RhcnRFZGl0ID0gKCk6IHZvaWQgPT4ge1xuICAgIHNldEVkaXRUaXRsZShjb252ZXJzYXRpb24udGl0bGUpXG4gICAgc2V0RWRpdGluZyh0cnVlKVxuICAgIGp1c3RTdGFydGVkRWRpdGluZy5jdXJyZW50ID0gdHJ1ZVxuICAgIC8vIOW7tui/n+iBmueEpu+8jOetieW+hSBDb250ZXh0TWVudSDlrozlhajlhbPpl63lkI7lho0gZm9jdXNcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGp1c3RTdGFydGVkRWRpdGluZy5jdXJyZW50ID0gZmFsc2VcbiAgICAgIGlucHV0UmVmLmN1cnJlbnQ/LmZvY3VzKClcbiAgICAgIGlucHV0UmVmLmN1cnJlbnQ/LnNlbGVjdCgpXG4gICAgfSwgMzAwKVxuICB9XG5cbiAgLyoqIOS/neWtmOagh+mimCAqL1xuICBjb25zdCBzYXZlVGl0bGUgPSBhc3luYyAoKTogUHJvbWlzZTx2b2lkPiA9PiB7XG4gICAgLy8gQ29udGV4dE1lbnUg5YWz6Zet5a+86Ie055qEIGJsdXLvvIzlv73nlaVcbiAgICBpZiAoanVzdFN0YXJ0ZWRFZGl0aW5nLmN1cnJlbnQpIHJldHVyblxuICAgIGNvbnN0IHRyaW1tZWQgPSBlZGl0VGl0bGUudHJpbSgpXG4gICAgaWYgKCF0cmltbWVkIHx8IHRyaW1tZWQgPT09IGNvbnZlcnNhdGlvbi50aXRsZSkge1xuICAgICAgc2V0RWRpdGluZyhmYWxzZSlcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCBvblJlbmFtZShjb252ZXJzYXRpb24uaWQsIHRyaW1tZWQpXG4gICAgc2V0RWRpdGluZyhmYWxzZSlcbiAgfVxuXG4gIC8qKiDplK7nm5jkuovku7YgKi9cbiAgY29uc3QgaGFuZGxlS2V5RG93biA9IChlOiBSZWFjdC5LZXlib2FyZEV2ZW50KTogdm9pZCA9PiB7XG4gICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIHNhdmVUaXRsZSgpXG4gICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHtcbiAgICAgIHNldEVkaXRpbmcoZmFsc2UpXG4gICAgfVxuICB9XG5cbiAgY29uc3QgaXNQaW5uZWQgPSAhIWNvbnZlcnNhdGlvbi5waW5uZWRcblxuICBjb25zdCBtZW51SXRlbXMgPSAoXG4gICAgTWVudUl0ZW06IHR5cGVvZiBDb250ZXh0TWVudUl0ZW0gfCB0eXBlb2YgRHJvcGRvd25NZW51SXRlbSxcbiAgICBNZW51U2VwYXJhdG9yOiB0eXBlb2YgQ29udGV4dE1lbnVTZXBhcmF0b3IgfCB0eXBlb2YgRHJvcGRvd25NZW51U2VwYXJhdG9yXG4gICkgPT4gKFxuICAgIDw+XG4gICAgICA8TWVudUl0ZW1cbiAgICAgICAgY2xhc3NOYW1lPVwidGV4dC14cyBweS0xIFsmPnN2Z106c2l6ZS0zLjVcIlxuICAgICAgICBvblNlbGVjdD17KCkgPT4gb25Ub2dnbGVQaW4oY29udmVyc2F0aW9uLmlkKX1cbiAgICAgID5cbiAgICAgICAge2lzUGlubmVkID8gPFBpbk9mZiBzaXplPXsxNH0gLz4gOiA8UGluIHNpemU9ezE0fSAvPn1cbiAgICAgICAge2lzUGlubmVkID8gJ+WPlua2iOe9rumhticgOiAn572u6aG25a+56K+dJ31cbiAgICAgIDwvTWVudUl0ZW0+XG4gICAgICA8TWVudUl0ZW0gY2xhc3NOYW1lPVwidGV4dC14cyBweS0xIFsmPnN2Z106c2l6ZS0zLjVcIiBvblNlbGVjdD17KCkgPT4gc3RhcnRFZGl0KCl9PlxuICAgICAgICA8UGVuY2lsIHNpemU9ezE0fSAvPlxuICAgICAgICDph43lkb3lkI1cbiAgICAgIDwvTWVudUl0ZW0+XG4gICAgICA8TWVudUl0ZW1cbiAgICAgICAgY2xhc3NOYW1lPVwidGV4dC14cyBweS0xIFsmPnN2Z106c2l6ZS0zLjVcIlxuICAgICAgICBvblNlbGVjdD17KCkgPT4gb25Ub2dnbGVBcmNoaXZlKGNvbnZlcnNhdGlvbi5pZCl9XG4gICAgICA+XG4gICAgICAgIHtjb252ZXJzYXRpb24uYXJjaGl2ZWQgPyA8QXJjaGl2ZVJlc3RvcmUgc2l6ZT17MTR9IC8+IDogPEFyY2hpdmUgc2l6ZT17MTR9IC8+fVxuICAgICAgICB7Y29udmVyc2F0aW9uLmFyY2hpdmVkID8gJ+WPlua2iOW9kuahoycgOiAn5b2S5qGjJ31cbiAgICAgIDwvTWVudUl0ZW0+XG4gICAgICA8TWVudVNlcGFyYXRvciBjbGFzc05hbWU9XCJteS0wLjVcIiAvPlxuICAgICAgPE1lbnVJdGVtXG4gICAgICAgIGNsYXNzTmFtZT1cInRleHQteHMgcHktMSBbJj5zdmddOnNpemUtMy41IHRleHQtZGVzdHJ1Y3RpdmVcIlxuICAgICAgICBvblNlbGVjdD17KCkgPT4gb25SZXF1ZXN0RGVsZXRlKGNvbnZlcnNhdGlvbi5pZCl9XG4gICAgICA+XG4gICAgICAgIDxUcmFzaDIgc2l6ZT17MTR9IC8+XG4gICAgICAgIOWIoOmZpOWvueivnVxuICAgICAgPC9NZW51SXRlbT5cbiAgICA8Lz5cbiAgKVxuXG4gIHJldHVybiAoXG4gICAgPENvbnRleHRNZW51PlxuICAgICAgPENvbnRleHRNZW51VHJpZ2dlciBhc0NoaWxkPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgcmVmPXtwcmV2aWV3LnNldEFuY2hvclJlZn1cbiAgICAgICAgICByb2xlPVwiYnV0dG9uXCJcbiAgICAgICAgICB0YWJJbmRleD17MH1cbiAgICAgICAgICBkYXRhLWFjdGlvbnMtb3Blbj17bWVudU9wZW4gPyAnJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBvblNlbGVjdChjb252ZXJzYXRpb24uaWQsIGNvbnZlcnNhdGlvbi50aXRsZSl9XG4gICAgICAgICAgb25Nb3VzZUVudGVyPXtwcmV2aWV3LmhhbmRsZU1vdXNlRW50ZXJ9XG4gICAgICAgICAgb25Nb3VzZUxlYXZlPXtwcmV2aWV3LmhhbmRsZU1vdXNlTGVhdmV9XG4gICAgICAgICAgb25Eb3VibGVDbGljaz17KGUpID0+IHtcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICAgICAgICAgIHN0YXJ0RWRpdCgpXG4gICAgICAgICAgfX1cbiAgICAgICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgJ3Nlc3Npb24tbGlzdC1yb3cgZ3JvdXAgcmVsYXRpdmUgdy1mdWxsIHB4LTMgcHktWzdweF0gdGl0bGViYXItbm8tZHJhZyB0ZXh0LWxlZnQnLFxuICAgICAgICAgICAgYWN0aXZlID8gJ3Nlc3Npb24tbGlzdC1pdGVtLWFjdGl2ZScgOiAncm91bmRlZC14bCdcbiAgICAgICAgICApfVxuICAgICAgICA+XG4gICAgICAgICAgey8qIOa1geW8j+eKtuaAgeW6lemDqOaoquadoe+8iOS4jiBBZ2VudCDkvJror50gLyDmoIfnrb7pobXnu5/kuIDvvIkgKi99XG4gICAgICAgICAge3N0cmVhbWluZyAmJiAoXG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJzZXNzaW9uLXN0YXR1cy1saW5lIHRhYi1zdGF0dXMtc3RyZWFtaW5nXCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgLz5cbiAgICAgICAgICApfVxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIG1pbi13LTBcIj5cbiAgICAgICAgICAgIHtlZGl0aW5nID8gKFxuICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICByZWY9e2lucHV0UmVmfVxuICAgICAgICAgICAgICAgIHZhbHVlPXtlZGl0VGl0bGV9XG4gICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRFZGl0VGl0bGUoZS50YXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgIG9uS2V5RG93bj17aGFuZGxlS2V5RG93bn1cbiAgICAgICAgICAgICAgICBvbkJsdXI9e3NhdmVUaXRsZX1cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgYmctdHJhbnNwYXJlbnQgdGV4dC1bMTNweF0gbGVhZGluZy01IHRleHQtZm9yZWdyb3VuZCBib3JkZXItYiBib3JkZXItcHJpbWFyeS81MCBvdXRsaW5lLW5vbmUgcHgtMCBweS0wXCJcbiAgICAgICAgICAgICAgICBtYXhMZW5ndGg9ezEwMH1cbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgJ2ZsZXggdy1mdWxsIG1pbi13LTAgbWF4LXctZnVsbCBpdGVtcy1jZW50ZXIgZ2FwLTEuNSBvdmVyZmxvdy1oaWRkZW4gcHItMiB0ZXh0LVsxM3B4XSBsZWFkaW5nLTUnLFxuICAgICAgICAgICAgICAgICAgYWN0aXZlID8gJ3Nlc3Npb24tcm93LXRpdGxlJyA6ICd0ZXh0LWZvcmVncm91bmQvODAnXG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHsvKiDnva7pobbmoIforrAgKi99XG4gICAgICAgICAgICAgICAge3Nob3dQaW5JY29uICYmIDxQaW4gc2l6ZT17MTF9IGNsYXNzTmFtZT1cImZsZXgtc2hyaW5rLTAgdGV4dC1wcmltYXJ5LzYwXCIgLz59XG4gICAgICAgICAgICAgICAgPENoYXRzQ2lyY2xlXG4gICAgICAgICAgICAgICAgICBzaXplPXsxM31cbiAgICAgICAgICAgICAgICAgIHdlaWdodD1cInJlZ3VsYXJcIlxuICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbignZmxleC1zaHJpbmstMCcsIGFjdGl2ZSA/ICdvcGFjaXR5LTgwJyA6ICdvcGFjaXR5LTQ1Jyl9XG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJzZXNzaW9uLXJvdy10aXRsZS10ZXh0XCIgdGl0bGU9e2NvbnZlcnNhdGlvbi50aXRsZX0+XG4gICAgICAgICAgICAgICAgICB7Y29udmVyc2F0aW9uLnRpdGxlfVxuICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICApfVxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgey8qIOS4ieeCueiPnOWNleaMiemSru+8iGhvdmVyIOaXtuWPr+inge+8jOWni+e7iOWNoOS9jemBv+WFjei3s+WKqO+8iSAqL31cbiAgICAgICAgICB7IWVkaXRpbmcgJiYgKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LXNocmluay0wXCIgb25DbGljaz17KGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9PlxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51IG9wZW49e21lbnVPcGVufSBvbk9wZW5DaGFuZ2U9e3NldE1lbnVPcGVufT5cbiAgICAgICAgICAgICAgICA8RHJvcGRvd25NZW51VHJpZ2dlciBhc0NoaWxkPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgICAgICdwLTEgcm91bmRlZC1tZCB0ZXh0LWZvcmVncm91bmQvMzAgaG92ZXI6YmctZm9yZWdyb3VuZC9bMC4wOF0gaG92ZXI6dGV4dC1mb3JlZ3JvdW5kLzYwIHRyYW5zaXRpb24tY29sb3JzJyxcbiAgICAgICAgICAgICAgICAgICAgICAnb3BhY2l0eS0wIHBvaW50ZXItZXZlbnRzLW5vbmUnLFxuICAgICAgICAgICAgICAgICAgICAgICdncm91cC1ob3ZlcjpvcGFjaXR5LTEwMCBncm91cC1ob3Zlcjpwb2ludGVyLWV2ZW50cy1hdXRvJyxcbiAgICAgICAgICAgICAgICAgICAgICAnZGF0YS1bc3RhdGU9b3Blbl06YmctZm9yZWdyb3VuZC9bMC4wOF0gZGF0YS1bc3RhdGU9b3Blbl06dGV4dC1mb3JlZ3JvdW5kLzYwIGRhdGEtW3N0YXRlPW9wZW5dOm9wYWNpdHktMTAwIGRhdGEtW3N0YXRlPW9wZW5dOnBvaW50ZXItZXZlbnRzLWF1dG8nXG4gICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgIDxNb3JlVmVydGljYWwgc2l6ZT17MTR9IC8+XG4gICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L0Ryb3Bkb3duTWVudVRyaWdnZXI+XG4gICAgICAgICAgICAgICAgPERyb3Bkb3duTWVudUNvbnRlbnQgYWxpZ249XCJzdGFydFwiIGNsYXNzTmFtZT1cInctNDAgei1bOTk5OV0gbWluLXctMCBwLTAuNVwiPlxuICAgICAgICAgICAgICAgICAge21lbnVJdGVtcyhEcm9wZG93bk1lbnVJdGVtLCBEcm9wZG93bk1lbnVTZXBhcmF0b3IpfVxuICAgICAgICAgICAgICAgIDwvRHJvcGRvd25NZW51Q29udGVudD5cbiAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnU+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApfVxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvQ29udGV4dE1lbnVUcmlnZ2VyPlxuICAgICAgPENvbnRleHRNZW51Q29udGVudCBjbGFzc05hbWU9XCJ3LTQwIHotWzk5OTldIG1pbi13LTAgcC0wLjVcIj5cbiAgICAgICAge21lbnVJdGVtcyhDb250ZXh0TWVudUl0ZW0sIENvbnRleHRNZW51U2VwYXJhdG9yKX1cbiAgICAgIDwvQ29udGV4dE1lbnVDb250ZW50PlxuICAgICAgPFNlc3Npb25NaW5pTWFwUG9wb3ZlclxuICAgICAgICB0YXJnZXQ9e3tcbiAgICAgICAgICB0eXBlOiAnYWdlbnQnLCAvLyBQMzogY2hhdCDlt7LpgIDlvbnvvIzmraTnu4Tku7bkuLrpgZfnlZnku6PnoIFcbiAgICAgICAgICBzZXNzaW9uSWQ6IGNvbnZlcnNhdGlvbi5pZCxcbiAgICAgICAgICB0aXRsZTogY29udmVyc2F0aW9uLnRpdGxlLFxuICAgICAgICB9fVxuICAgICAgICBhbmNob3JSZWY9e3ByZXZpZXcuYW5jaG9yUmVmfVxuICAgICAgICBvcGVuPXtwcmV2aWV3LmlzT3Blbn1cbiAgICAgICAgaXNMZWF2aW5nPXtwcmV2aWV3LmlzTGVhdmluZ31cbiAgICAgICAgb25Nb3VzZUVudGVyPXtwcmV2aWV3LmhhbmRsZVBhbmVsTW91c2VFbnRlcn1cbiAgICAgICAgb25Nb3VzZUxlYXZlPXtwcmV2aWV3LmhhbmRsZVBhbmVsTW91c2VMZWF2ZX1cbiAgICAgIC8+XG4gICAgPC9Db250ZXh0TWVudT5cbiAgKVxufSlcblxuLy8gPT09PT0gQWdlbnQg5Lya6K+d5YiX6KGo6aG5ID09PT09XG5cbi8qKlxuICog5Lya6K+d6KGM5bqV6YOo54q25oCB5qiq5p2hIOKAlCDkuI7moIfnrb7pobUgVGFiQmFyIOeKtuaAgee6v+e7n+S4gFxuICogcnVubmluZyDihpIgdGFiLXN0YXR1cy1zdHJlYW1pbmcg5rWB5YWJ5Yqo55S7XG4gKiBjb21wbGV0ZWQgLyBibG9ja2VkIC8gcHJpbWFyeSDkuI4gVGFiIOiJsuS4gOiHtFxuICog5rOo5oSP77ya5LuF55So5LqO6Z2e6YCJ5Lit5Lya6K+d77yI5ZCO5Y+w5Lya6K+d77yJ55qE54q25oCB5oyH56S6XG4gKi9cbmludGVyZmFjZSBBZ2VudFNlc3Npb25JdGVtUHJvcHMge1xuICBzZXNzaW9uOiBBZ2VudFNlc3Npb25NZXRhXG4gIGFjdGl2ZTogYm9vbGVhblxuICBpbmRpY2F0b3JTdGF0dXM6IFNlc3Npb25JbmRpY2F0b3JTdGF0dXNcbiAgLyoqIOihjOW6lemDqOeKtuaAgeaoquadoeivreS5ie+8m2lkbGUgLyDmnKrkvKDliJnkuI3mmL7npLogKi9cbiAgbGVmdEFjY2VudD86IFNlc3Npb25MZWZ0QWNjZW50XG4gIC8qKiDkvJror53lvZPliY3mqKHlnovmmL7npLrlkI0gKi9cbiAgbW9kZWxOYW1lPzogc3RyaW5nXG4gIC8qKiDmmK/lkKbnpoHnlKjmgqzmta4gTWluaSDlnLDlm74gKi9cbiAgZGlzYWJsZU1pbmlNYXA/OiBib29sZWFuXG4gIC8qKiDlt6XkvZzljLrlkI3np7AgQmFkZ2XvvIjot6jlt6XkvZzljLrliJfooajml7bmmL7npLrvvIkgKi9cbiAgd29ya3NwYWNlTmFtZT86IHN0cmluZ1xuICAvKiog5a2Q6KGM5omp5bGV5qC35byPICovXG4gIGNoaWxkQ2xhc3NOYW1lPzogc3RyaW5nXG4gIC8qKiB3ZWxsPeS8muivneS6le+8iOW4pumYtOW9seaJv+i9veWjs++8ie+8m2NvbXBhY3Q95b2S5qGj5by55bGC562J57Sn5YeR5YiX6KGoICovXG4gIHN1cmZhY2U/OiAnd2VsbCcgfCAnY29tcGFjdCdcbiAgLyoqIOaJuemHj+mAieaLqeaooeW8j++8muaYr+WQpuWcqOmAieaLqeaooeW8jyAqL1xuICBpc0JhdGNoTW9kZT86IGJvb2xlYW5cbiAgLyoqIOaJuemHj+mAieaLqeaooeW8j++8muaYr+WQpuiiq+mAieS4rSAqL1xuICBpc0JhdGNoU2VsZWN0ZWQ/OiBib29sZWFuXG4gIC8qKiDmibnph4/pgInmi6nmqKHlvI/vvJrliIfmjaLpgInkuK0gKi9cbiAgb25Ub2dnbGVCYXRjaFNlbGVjdD86IChpZDogc3RyaW5nKSA9PiB2b2lkXG4gIG9uU2VsZWN0OiAoaWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZykgPT4gdm9pZFxuICBvblJlcXVlc3REZWxldGU6IChpZDogc3RyaW5nKSA9PiB2b2lkXG4gIG9uUmVuYW1lOiAoaWQ6IHN0cmluZywgbmV3VGl0bGU6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPlxuICBvblRvZ2dsZVBpbjogKGlkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD5cbiAgb25Ub2dnbGVBcmNoaXZlOiAoaWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPlxufVxuXG4vKiog5pe26Ze05pi+56S65qC85byP77ya5LuK5aSpIEhIOm1tIC8g5pio5aSpIEhIOm1tIC8gTU0vREQgKi9cbmZ1bmN0aW9uIGZvcm1hdFNlc3Npb25UaW1lKHVwZGF0ZWRBdDogbnVtYmVyKTogc3RyaW5nIHtcbiAgY29uc3QgZGF0ZSA9IG5ldyBEYXRlKHVwZGF0ZWRBdClcbiAgY29uc3Qgbm93ID0gbmV3IERhdGUoKVxuICBjb25zdCB0b2RheVN0YXJ0ID0gbmV3IERhdGUobm93LmdldEZ1bGxZZWFyKCksIG5vdy5nZXRNb250aCgpLCBub3cuZ2V0RGF0ZSgpKS5nZXRUaW1lKClcbiAgY29uc3QgeWVzdGVyZGF5U3RhcnQgPSB0b2RheVN0YXJ0IC0gODZfNDAwXzAwMFxuICBjb25zdCBwYWQgPSAobjogbnVtYmVyKTogc3RyaW5nID0+IG4udG9TdHJpbmcoKS5wYWRTdGFydCgyLCAnMCcpXG4gIGlmICh1cGRhdGVkQXQgPj0gdG9kYXlTdGFydCkge1xuICAgIHJldHVybiBg5LuK5aSpICR7cGFkKGRhdGUuZ2V0SG91cnMoKSl9OiR7cGFkKGRhdGUuZ2V0TWludXRlcygpKX1gXG4gIH1cbiAgaWYgKHVwZGF0ZWRBdCA+PSB5ZXN0ZXJkYXlTdGFydCkge1xuICAgIHJldHVybiBg5pio5aSpICR7cGFkKGRhdGUuZ2V0SG91cnMoKSl9OiR7cGFkKGRhdGUuZ2V0TWludXRlcygpKX1gXG4gIH1cbiAgcmV0dXJuIGAke3BhZChkYXRlLmdldE1vbnRoKCkgKyAxKX0vJHtwYWQoZGF0ZS5nZXREYXRlKCkpfSAke3BhZChkYXRlLmdldEhvdXJzKCkpfToke3BhZChkYXRlLmdldE1pbnV0ZXMoKSl9YFxufVxuXG5jb25zdCBBZ2VudFNlc3Npb25JdGVtID0gUmVhY3QubWVtbyhmdW5jdGlvbiBBZ2VudFNlc3Npb25JdGVtKHtcbiAgc2Vzc2lvbixcbiAgYWN0aXZlLFxuICBpbmRpY2F0b3JTdGF0dXMsXG4gIGxlZnRBY2NlbnQsXG4gIG1vZGVsTmFtZSxcbiAgZGlzYWJsZU1pbmlNYXAsXG4gIHdvcmtzcGFjZU5hbWUsXG4gIGNoaWxkQ2xhc3NOYW1lLFxuICBzdXJmYWNlID0gJ3dlbGwnLFxuICBpc0JhdGNoTW9kZSA9IGZhbHNlLFxuICBpc0JhdGNoU2VsZWN0ZWQgPSBmYWxzZSxcbiAgb25Ub2dnbGVCYXRjaFNlbGVjdCxcbiAgb25TZWxlY3QsXG4gIG9uUmVxdWVzdERlbGV0ZSxcbiAgb25SZW5hbWUsXG4gIG9uVG9nZ2xlUGluLFxuICBvblRvZ2dsZUFyY2hpdmUsXG59OiBBZ2VudFNlc3Npb25JdGVtUHJvcHMpOiBSZWFjdC5SZWFjdEVsZW1lbnQge1xuICBjb25zdCBbZWRpdGluZywgc2V0RWRpdGluZ10gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2VkaXRUaXRsZSwgc2V0RWRpdFRpdGxlXSA9IFJlYWN0LnVzZVN0YXRlKCcnKVxuICBjb25zdCBbbWVudU9wZW4sIHNldE1lbnVPcGVuXSA9IFJlYWN0LnVzZVN0YXRlKGZhbHNlKVxuICBjb25zdCBpbnB1dFJlZiA9IFJlYWN0LnVzZVJlZjxIVE1MSW5wdXRFbGVtZW50PihudWxsKVxuICBjb25zdCBqdXN0U3RhcnRlZEVkaXRpbmcgPSBSZWFjdC51c2VSZWYoZmFsc2UpXG4gIGNvbnN0IHByZXZpZXcgPSB1c2VTZXNzaW9uTWluaU1hcEhvdmVyKDMwMCwgZGlzYWJsZU1pbmlNYXAgfHwgbWVudU9wZW4gfHwgaXNCYXRjaE1vZGUpXG5cbiAgY29uc3Qgc3RhcnRFZGl0ID0gKCk6IHZvaWQgPT4ge1xuICAgIHNldEVkaXRUaXRsZShzZXNzaW9uLnRpdGxlKVxuICAgIHNldEVkaXRpbmcodHJ1ZSlcbiAgICBqdXN0U3RhcnRlZEVkaXRpbmcuY3VycmVudCA9IHRydWVcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgIGp1c3RTdGFydGVkRWRpdGluZy5jdXJyZW50ID0gZmFsc2VcbiAgICAgIGlucHV0UmVmLmN1cnJlbnQ/LmZvY3VzKClcbiAgICAgIGlucHV0UmVmLmN1cnJlbnQ/LnNlbGVjdCgpXG4gICAgfSwgMzAwKVxuICB9XG5cbiAgY29uc3Qgc2F2ZVRpdGxlID0gYXN5bmMgKCk6IFByb21pc2U8dm9pZD4gPT4ge1xuICAgIGlmIChqdXN0U3RhcnRlZEVkaXRpbmcuY3VycmVudCkgcmV0dXJuXG4gICAgY29uc3QgdHJpbW1lZCA9IGVkaXRUaXRsZS50cmltKClcbiAgICBpZiAoIXRyaW1tZWQgfHwgdHJpbW1lZCA9PT0gc2Vzc2lvbi50aXRsZSkge1xuICAgICAgc2V0RWRpdGluZyhmYWxzZSlcbiAgICAgIHJldHVyblxuICAgIH1cbiAgICBhd2FpdCBvblJlbmFtZShzZXNzaW9uLmlkLCB0cmltbWVkKVxuICAgIHNldEVkaXRpbmcoZmFsc2UpXG4gIH1cblxuICBjb25zdCBoYW5kbGVLZXlEb3duID0gKGU6IFJlYWN0LktleWJvYXJkRXZlbnQpOiB2b2lkID0+IHtcbiAgICBpZiAoZS5rZXkgPT09ICdFbnRlcicpIHtcbiAgICAgIGUucHJldmVudERlZmF1bHQoKVxuICAgICAgc2F2ZVRpdGxlKClcbiAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuICAgICAgc2V0RWRpdGluZyhmYWxzZSlcbiAgICB9XG4gIH1cblxuICBjb25zdCBtZW51SXRlbXMgPSAoXG4gICAgTWVudUl0ZW06IHR5cGVvZiBDb250ZXh0TWVudUl0ZW0gfCB0eXBlb2YgRHJvcGRvd25NZW51SXRlbSxcbiAgICBNZW51U2VwYXJhdG9yOiB0eXBlb2YgQ29udGV4dE1lbnVTZXBhcmF0b3IgfCB0eXBlb2YgRHJvcGRvd25NZW51U2VwYXJhdG9yXG4gICkgPT4gKFxuICAgIDw+XG4gICAgICA8TWVudUl0ZW0gY2xhc3NOYW1lPVwidGV4dC14cyBweS0xIFsmPnN2Z106c2l6ZS0zLjVcIiBvblNlbGVjdD17KCkgPT4gb25Ub2dnbGVQaW4oc2Vzc2lvbi5pZCl9PlxuICAgICAgICB7c2Vzc2lvbi5waW5uZWQgPyA8UGluT2ZmIHNpemU9ezE0fSAvPiA6IDxQaW4gc2l6ZT17MTR9IC8+fVxuICAgICAgICB7c2Vzc2lvbi5waW5uZWQgPyAn5Y+W5raI572u6aG2JyA6ICfnva7pobbkvJror50nfVxuICAgICAgPC9NZW51SXRlbT5cbiAgICAgIDxNZW51SXRlbSBjbGFzc05hbWU9XCJ0ZXh0LXhzIHB5LTEgWyY+c3ZnXTpzaXplLTMuNVwiIG9uU2VsZWN0PXsoKSA9PiBzdGFydEVkaXQoKX0+XG4gICAgICAgIDxQZW5jaWwgc2l6ZT17MTR9IC8+XG4gICAgICAgIOmHjeWRveWQjVxuICAgICAgPC9NZW51SXRlbT5cbiAgICAgIDxNZW51SXRlbVxuICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LXhzIHB5LTEgWyY+c3ZnXTpzaXplLTMuNVwiXG4gICAgICAgIG9uU2VsZWN0PXsoKSA9PiBvblRvZ2dsZUFyY2hpdmUoc2Vzc2lvbi5pZCl9XG4gICAgICA+XG4gICAgICAgIHtzZXNzaW9uLmFyY2hpdmVkID8gPEFyY2hpdmVSZXN0b3JlIHNpemU9ezE0fSAvPiA6IDxBcmNoaXZlIHNpemU9ezE0fSAvPn1cbiAgICAgICAge3Nlc3Npb24uYXJjaGl2ZWQgPyAn5Y+W5raI5b2S5qGjJyA6ICflvZLmoaMnfVxuICAgICAgPC9NZW51SXRlbT5cbiAgICAgIDxNZW51U2VwYXJhdG9yIGNsYXNzTmFtZT1cIm15LTAuNVwiIC8+XG4gICAgICA8TWVudUl0ZW1cbiAgICAgICAgY2xhc3NOYW1lPVwidGV4dC14cyBweS0xIFsmPnN2Z106c2l6ZS0zLjUgdGV4dC1kZXN0cnVjdGl2ZVwiXG4gICAgICAgIG9uU2VsZWN0PXsoKSA9PiBvblJlcXVlc3REZWxldGUoc2Vzc2lvbi5pZCl9XG4gICAgICA+XG4gICAgICAgIDxUcmFzaDIgc2l6ZT17MTR9IC8+XG4gICAgICAgIOWIoOmZpOS8muivnVxuICAgICAgPC9NZW51SXRlbT5cbiAgICA8Lz5cbiAgKVxuXG4gIGNvbnN0IHsgc2VsZWN0aW9uQ2xhc3NOYW1lLCBzaG93UnVubmluZ1N3ZWVwLCBzdGF0dXNMaW5lQ2xhc3MgfSA9IGdldEFnZW50U2Vzc2lvblZpc3VhbFN0YXRlKHtcbiAgICBhY3RpdmUsXG4gICAgaW5kaWNhdG9yU3RhdHVzLFxuICAgIGlzQmF0Y2hNb2RlLFxuICAgIGlzQmF0Y2hTZWxlY3RlZCxcbiAgICBsZWZ0QWNjZW50LFxuICB9KVxuXG4gIGNvbnN0IGhhc0luZGljYXRvclN0YXR1cyA9XG4gICAgaW5kaWNhdG9yU3RhdHVzID09PSAncnVubmluZycgfHxcbiAgICBpbmRpY2F0b3JTdGF0dXMgPT09ICdibG9ja2VkJyB8fFxuICAgIGluZGljYXRvclN0YXR1cyA9PT0gJ2NvbXBsZXRlZCdcbiAgY29uc3QgbWV0YU1vZGVsTmFtZSA9IG1vZGVsTmFtZT8udHJpbSgpIHx8ICfmnKrpgInmi6nmqKHlnosnXG5cbiAgY29uc3Qgcm93Q2xhc3NOYW1lID0gY24oXG4gICAgJ3Nlc3Npb24tbGlzdC1yb3cgZ3JvdXAgcmVsYXRpdmUgbWluLXctMCB3LWZ1bGwgbWF4LXctZnVsbCBvdmVyZmxvdy1oaWRkZW4gdGl0bGViYXItbm8tZHJhZyB0ZXh0LWxlZnQnLFxuICAgIC8vIHNlc3Npb24tcm93LXNoZWxsIOW3suaYryBmbGV477yb5om56YeP5qih5byP5Y+q5Yqg5qCH6K6w5LiO6Ze06Led77yM5LiN5YaNICFmbGV4IOehrOWImlxuICAgIGlzQmF0Y2hNb2RlICYmICdpdGVtcy1jZW50ZXIgZ2FwLTInLFxuICAgIHN1cmZhY2UgPT09ICd3ZWxsJyAmJiAnc2Vzc2lvbi1yb3ctc2hlbGwgYXBwLXNpZGViYXItc2Vzc2lvbi1yb3cnLFxuICAgIHN1cmZhY2UgPT09ICdjb21wYWN0JyAmJiAnZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTIgcHktWzdweF0gcHgtMScsXG4gICAgaXNCYXRjaE1vZGUgJiYgJ3Nlc3Npb24tbGlzdC1yb3ctLWJhdGNoJyxcbiAgICBjaGlsZENsYXNzTmFtZSxcbiAgICBzZWxlY3Rpb25DbGFzc05hbWVcbiAgKVxuXG4gIHJldHVybiAoXG4gICAgPENvbnRleHRNZW51PlxuICAgICAgPENvbnRleHRNZW51VHJpZ2dlciBhc0NoaWxkPlxuICAgICAgICA8ZGl2XG4gICAgICAgICAgcmVmPXtwcmV2aWV3LnNldEFuY2hvclJlZn1cbiAgICAgICAgICBkYXRhLXNlc3Npb24tbGlzdC1pZD17c2Vzc2lvbi5pZH1cbiAgICAgICAgICBkYXRhLWFjdGlvbnMtb3Blbj17bWVudU9wZW4gPyAnJyA6IHVuZGVmaW5lZH1cbiAgICAgICAgICByb2xlPVwiYnV0dG9uXCJcbiAgICAgICAgICB0YWJJbmRleD17MH1cbiAgICAgICAgICBvbkNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICBpZiAoaXNCYXRjaE1vZGUpIHtcbiAgICAgICAgICAgICAgb25Ub2dnbGVCYXRjaFNlbGVjdD8uKHNlc3Npb24uaWQpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBvblNlbGVjdChzZXNzaW9uLmlkLCBzZXNzaW9uLnRpdGxlKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH19XG4gICAgICAgICAgb25Nb3VzZUVudGVyPXtwcmV2aWV3LmhhbmRsZU1vdXNlRW50ZXJ9XG4gICAgICAgICAgb25Nb3VzZUxlYXZlPXtwcmV2aWV3LmhhbmRsZU1vdXNlTGVhdmV9XG4gICAgICAgICAgb25Eb3VibGVDbGljaz17KGUpID0+IHtcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICAgICAgICAgIHN0YXJ0RWRpdCgpXG4gICAgICAgICAgfX1cbiAgICAgICAgICBjbGFzc05hbWU9e3Jvd0NsYXNzTmFtZX1cbiAgICAgICAgPlxuICAgICAgICAgIHtpc0JhdGNoTW9kZSA/IChcbiAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKVxuICAgICAgICAgICAgICAgICAgb25Ub2dnbGVCYXRjaFNlbGVjdD8uKHNlc3Npb24uaWQpXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4LXNocmluay0wIHctWzE4cHhdIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtZm9yZWdyb3VuZC82MCBob3Zlcjp0ZXh0LWZvcmVncm91bmRcIlxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9e2lzQmF0Y2hTZWxlY3RlZCA/ICflj5bmtojpgInkuK0nIDogJ+mAieS4rSd9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICB7aXNCYXRjaFNlbGVjdGVkID8gKFxuICAgICAgICAgICAgICAgICAgPENoZWNrU3F1YXJlIGNsYXNzTmFtZT1cInNpemUtMy41IHRleHQtcHJpbWFyeVwiIC8+XG4gICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgIDxTcXVhcmUgY2xhc3NOYW1lPVwic2l6ZS0zLjVcIiAvPlxuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggbWluLXctMCBmbGV4LTEgaXRlbXMtY2VudGVyIGdhcC0xLjUgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgPENoYXRzQ2lyY2xlIHNpemU9ezEzfSB3ZWlnaHQ9XCJyZWd1bGFyXCIgY2xhc3NOYW1lPVwic2hyaW5rLTAgb3BhY2l0eS00NVwiIC8+XG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic2Vzc2lvbi1yb3ctdGl0bGUtdGV4dCB0ZXh0LVsxMnB4XSBsZWFkaW5nLVsxOHB4XSB0ZXh0LWZvcmVncm91bmQvODBcIj5cbiAgICAgICAgICAgICAgICAgIHtzZXNzaW9uLnRpdGxlfVxuICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICA8Lz5cbiAgICAgICAgICApIDogKFxuICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgey8qIOW6lemDqOeKtuaAgeaoquadoe+8muS7heeUqOS6jumdnumAieS4reS8muivne+8iOWQjuWPsOS8muivne+8ieeahOeKtuaAgeaMh+ekuiAqL31cbiAgICAgICAgICAgICAge2hhc0luZGljYXRvclN0YXR1cyAmJiBzdGF0dXNMaW5lQ2xhc3MgJiYgKFxuICAgICAgICAgICAgICAgIDxzcGFuXG4gICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NuKCdzZXNzaW9uLXN0YXR1cy1saW5lIGFnZW50LXNlc3Npb24tc3RhdHVzLWxpbmUnLCBzdGF0dXNMaW5lQ2xhc3MpfVxuICAgICAgICAgICAgICAgICAgYXJpYS1oaWRkZW49XCJ0cnVlXCJcbiAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICB7c2hvd1J1bm5pbmdTd2VlcCAmJiAoXG4gICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwic2Vzc2lvbi1hY3RpdmUtcnVubmluZy1zd2VlcFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIC8+XG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwibWluLXctMCBmbGV4LTEgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAge2VkaXRpbmcgPyAoXG4gICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgcmVmPXtpbnB1dFJlZn1cbiAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2VkaXRUaXRsZX1cbiAgICAgICAgICAgICAgICAgICAgb25DaGFuZ2U9eyhlKSA9PiBzZXRFZGl0VGl0bGUoZS50YXJnZXQudmFsdWUpfVxuICAgICAgICAgICAgICAgICAgICBvbktleURvd249e2hhbmRsZUtleURvd259XG4gICAgICAgICAgICAgICAgICAgIG9uQmx1cj17c2F2ZVRpdGxlfVxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy1mdWxsIG1pbi13LTAgYmctdHJhbnNwYXJlbnQgdGV4dC1bMTJweF0gbGVhZGluZy01IHRleHQtZm9yZWdyb3VuZCBib3JkZXItYiBib3JkZXItcHJpbWFyeS81MCBvdXRsaW5lLW5vbmUgcHgtMCBweS0wXCJcbiAgICAgICAgICAgICAgICAgICAgbWF4TGVuZ3RoPXsxMDB9XG4gICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctZnVsbCBtaW4tdy0wIG1heC13LWZ1bGwgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgICAgICAgJ3Nlc3Npb24tcm93LWFjdGlvbnMtcGFkIGZsZXggdy1mdWxsIG1pbi13LTAgbWF4LXctZnVsbCBpdGVtcy1jZW50ZXIgZ2FwLTEuNSBvdmVyZmxvdy1oaWRkZW4gcHItNyB0ZXh0LVsxMnB4XSBsZWFkaW5nLVsxOHB4XSB0cmFuc2l0aW9uLVtwYWRkaW5nXSBkdXJhdGlvbi0xNTAgZ3JvdXAtaG92ZXI6cHItNCcsXG4gICAgICAgICAgICAgICAgICAgICAgICAhYWN0aXZlICYmICd0ZXh0LWZvcmVncm91bmQvODAnXG4gICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgIDxDaGF0c0NpcmNsZVxuICAgICAgICAgICAgICAgICAgICAgICAgc2l6ZT17MTN9XG4gICAgICAgICAgICAgICAgICAgICAgICB3ZWlnaHQ9XCJyZWd1bGFyXCJcbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y24oJ2ZsZXgtc2hyaW5rLTAnLCBhY3RpdmUgPyAnb3BhY2l0eS04MCcgOiAnb3BhY2l0eS00NScpfVxuICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgPHNwYW5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAgICAgICAgICdzZXNzaW9uLXJvdy10aXRsZS10ZXh0JyxcbiAgICAgICAgICAgICAgICAgICAgICAgICAgYWN0aXZlICYmICdzZXNzaW9uLXJvdy10aXRsZSdcbiAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT17c2Vzc2lvbi50aXRsZX1cbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICB7c2Vzc2lvbi50aXRsZX1cbiAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgICAgICAgICAgICAgICAgICdhcHAtc2lkZWJhci1zZXNzaW9uLWRldGFpbCBzZXNzaW9uLXJvdy1kZXRhaWwtcGFkIG10LTAuNSBncmlkIG1pbi13LTAgbWF4LXctZnVsbCBncmlkLWNvbHMtW21pbm1heCgwLDFmcilfYXV0b10gaXRlbXMtY2VudGVyIGdhcC14LTIgb3ZlcmZsb3ctaGlkZGVuIHBsLTUgcHItMCB0ZXh0LVs5cHhdIHRyYW5zaXRpb24tW3BhZGRpbmddIGR1cmF0aW9uLTE1MCBncm91cC1ob3Zlcjpwci00JyxcbiAgICAgICAgICAgICAgICAgICAgICAgIGFjdGl2ZSA/ICdzZXNzaW9uLXJvdy1tZXRhJyA6ICdtZC10ZXh0LWZhaW50J1xuICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJzZXNzaW9uLXJvdy10aXRsZS10ZXh0XCIgdGl0bGU9e21ldGFNb2RlbE5hbWV9PlxuICAgICAgICAgICAgICAgICAgICAgICAge21ldGFNb2RlbE5hbWV9XG4gICAgICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZsZXgtc2hyaW5rLTAgdGFidWxhci1udW1zXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICB7Zm9ybWF0U2Vzc2lvblRpbWUoc2Vzc2lvbi51cGRhdGVkQXQpfVxuICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvPlxuICAgICAgICAgICl9XG4gICAgICAgICAgeyFlZGl0aW5nICYmICFpc0JhdGNoTW9kZSAmJiAoXG4gICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImFic29sdXRlIHJpZ2h0LTEuNSB0b3AtMS8yIC10cmFuc2xhdGUteS0xLzJcIlxuICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4gZS5zdG9wUHJvcGFnYXRpb24oKX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPERyb3Bkb3duTWVudSBvcGVuPXttZW51T3Blbn0gb25PcGVuQ2hhbmdlPXtzZXRNZW51T3Blbn0+XG4gICAgICAgICAgICAgICAgPERyb3Bkb3duTWVudVRyaWdnZXIgYXNDaGlsZD5cbiAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgICAgICAgICAgICAgICAncC0xIHJvdW5kZWQtbWQgdGV4dC1mb3JlZ3JvdW5kLzMwIGhvdmVyOmJnLWZvcmVncm91bmQvWzAuMDhdIGhvdmVyOnRleHQtZm9yZWdyb3VuZC82MCB0cmFuc2l0aW9uLWNvbG9ycycsXG4gICAgICAgICAgICAgICAgICAgICAgJ29wYWNpdHktMCBwb2ludGVyLWV2ZW50cy1ub25lJyxcbiAgICAgICAgICAgICAgICAgICAgICAnZ3JvdXAtaG92ZXI6b3BhY2l0eS0xMDAgZ3JvdXAtaG92ZXI6cG9pbnRlci1ldmVudHMtYXV0bycsXG4gICAgICAgICAgICAgICAgICAgICAgJ2RhdGEtW3N0YXRlPW9wZW5dOmJnLWZvcmVncm91bmQvWzAuMDhdIGRhdGEtW3N0YXRlPW9wZW5dOnRleHQtZm9yZWdyb3VuZC82MCBkYXRhLVtzdGF0ZT1vcGVuXTpvcGFjaXR5LTEwMCBkYXRhLVtzdGF0ZT1vcGVuXTpwb2ludGVyLWV2ZW50cy1hdXRvJ1xuICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICA8TW9yZVZlcnRpY2FsIHNpemU9ezE0fSAvPlxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVUcmlnZ2VyPlxuICAgICAgICAgICAgICAgIDxEcm9wZG93bk1lbnVDb250ZW50IGFsaWduPVwic3RhcnRcIiBjbGFzc05hbWU9XCJ3LTQwIHotWzk5OTldIG1pbi13LTAgcC0wLjVcIj5cbiAgICAgICAgICAgICAgICAgIHttZW51SXRlbXMoRHJvcGRvd25NZW51SXRlbSwgRHJvcGRvd25NZW51U2VwYXJhdG9yKX1cbiAgICAgICAgICAgICAgICA8L0Ryb3Bkb3duTWVudUNvbnRlbnQ+XG4gICAgICAgICAgICAgIDwvRHJvcGRvd25NZW51PlxuICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L0NvbnRleHRNZW51VHJpZ2dlcj5cbiAgICAgIDxDb250ZXh0TWVudUNvbnRlbnQgY2xhc3NOYW1lPVwidy00MCB6LVs5OTk5XSBtaW4tdy0wIHAtMC41XCI+XG4gICAgICAgIHttZW51SXRlbXMoQ29udGV4dE1lbnVJdGVtLCBDb250ZXh0TWVudVNlcGFyYXRvcil9XG4gICAgICA8L0NvbnRleHRNZW51Q29udGVudD5cbiAgICAgIHshZGlzYWJsZU1pbmlNYXAgJiYgKFxuICAgICAgICA8U2Vzc2lvbk1pbmlNYXBQb3BvdmVyXG4gICAgICAgICAgdGFyZ2V0PXt7XG4gICAgICAgICAgICB0eXBlOiAnYWdlbnQnLFxuICAgICAgICAgICAgc2Vzc2lvbklkOiBzZXNzaW9uLmlkLFxuICAgICAgICAgICAgdGl0bGU6IHNlc3Npb24udGl0bGUsXG4gICAgICAgICAgICB3b3Jrc3BhY2VOYW1lLFxuICAgICAgICAgIH19XG4gICAgICAgICAgYW5jaG9yUmVmPXtwcmV2aWV3LmFuY2hvclJlZn1cbiAgICAgICAgICBvcGVuPXtwcmV2aWV3LmlzT3Blbn1cbiAgICAgICAgICBpc0xlYXZpbmc9e3ByZXZpZXcuaXNMZWF2aW5nfVxuICAgICAgICAgIG9uTW91c2VFbnRlcj17cHJldmlldy5oYW5kbGVQYW5lbE1vdXNlRW50ZXJ9XG4gICAgICAgICAgb25Nb3VzZUxlYXZlPXtwcmV2aWV3LmhhbmRsZVBhbmVsTW91c2VMZWF2ZX1cbiAgICAgICAgLz5cbiAgICAgICl9XG4gICAgPC9Db250ZXh0TWVudT5cbiAgKVxufSlcblxuLy8gPT09PT0g6aG555uu5YiG57uE57uE5Lu2ID09PT09XG5cbmNvbnN0IEFnZW50UHJvamVjdEdyb3VwSXRlbSA9IFJlYWN0Lm1lbW8oZnVuY3Rpb24gQWdlbnRQcm9qZWN0R3JvdXBJdGVtKHtcbiAgZ3JvdXAsXG4gIGN1cnJlbnRXb3Jrc3BhY2VJZCxcbiAgY29sbGFwc2VkLFxuICBhY3RpdmVTZXNzaW9uSWQsXG4gIGFnZW50SW5kaWNhdG9yTWFwLFxuICBzZXNzaW9uTW9kZWxNYXAsXG4gIGNoYW5uZWxzLFxuICB3b3Jrc3BhY2VOYW1lTWFwLFxuICBvblNlbGVjdFByb2plY3QsXG4gIG9uTmV3U2Vzc2lvbixcbiAgb25SZW5hbWVXb3Jrc3BhY2UsXG4gIG9uUmVxdWVzdERlbGV0ZVdvcmtzcGFjZSxcbiAgb25Db25maWd1cmVQcm9qZWN0LFxuICBvblNlbGVjdFNlc3Npb24sXG4gIGhhbmRsZVJlcXVlc3REZWxldGUsXG4gIGhhbmRsZUFnZW50UmVuYW1lLFxuICBoYW5kbGVUb2dnbGVQaW5BZ2VudCxcbiAgaGFuZGxlVG9nZ2xlQXJjaGl2ZUFnZW50LFxuICBkcmFnUHJvamVjdElkLFxuICBwcm9qZWN0RHJvcEluZGljYXRvcixcbiAgb25Qcm9qZWN0RHJhZ1N0YXJ0LFxuICBvblByb2plY3REcmFnT3ZlcixcbiAgb25Qcm9qZWN0RHJhZ0xlYXZlLFxuICBvblByb2plY3REcm9wLFxuICBvblByb2plY3REcmFnRW5kLFxuICBiYXRjaFNlbGVjdFdvcmtzcGFjZUlkLFxuICBiYXRjaFNlbGVjdGVkU2Vzc2lvbklkcyxcbiAgb25FbnRlckJhdGNoU2VsZWN0LFxuICBvbkV4aXRCYXRjaFNlbGVjdCxcbiAgb25Ub2dnbGVCYXRjaFNlbGVjdCxcbiAgb25CYXRjaFVwZGF0ZVNlbGVjdGVkLFxuICBvblJlcXVlc3RCYXRjaERlbGV0ZSxcbiAgb25Db25maXJtQmF0Y2hEZWxldGUsXG59OiB7XG4gIGdyb3VwOiBBZ2VudFByb2plY3RHcm91cFxuICBjdXJyZW50V29ya3NwYWNlSWQ6IHN0cmluZyB8IG51bGxcbiAgY29sbGFwc2VkOiBib29sZWFuXG4gIGFjdGl2ZVNlc3Npb25JZDogc3RyaW5nIHwgbnVsbFxuICBhZ2VudEluZGljYXRvck1hcDogTWFwPHN0cmluZywgU2Vzc2lvbkluZGljYXRvclN0YXR1cz5cbiAgc2Vzc2lvbk1vZGVsTWFwOiBNYXA8c3RyaW5nLCBzdHJpbmc+XG4gIGNoYW5uZWxzOiBpbXBvcnQoJ0B0YWdlbnQvc2hhcmVkJykuQ2hhbm5lbFtdXG4gIHdvcmtzcGFjZU5hbWVNYXA6IE1hcDxzdHJpbmcsIHN0cmluZz5cbiAgb25TZWxlY3RQcm9qZWN0OiAoaWQ6IHN0cmluZykgPT4gdm9pZFxuICBvbk5ld1Nlc3Npb246ICh3b3Jrc3BhY2VJZDogc3RyaW5nKSA9PiB2b2lkXG4gIG9uUmVuYW1lV29ya3NwYWNlOiAoaWQ6IHN0cmluZywgbmFtZTogc3RyaW5nKSA9PiB2b2lkXG4gIG9uUmVxdWVzdERlbGV0ZVdvcmtzcGFjZTogKGlkOiBzdHJpbmcpID0+IHZvaWRcbiAgb25Db25maWd1cmVQcm9qZWN0OiAoaWQ6IHN0cmluZykgPT4gdm9pZFxuICBvblNlbGVjdFNlc3Npb246IChpZDogc3RyaW5nLCB0aXRsZTogc3RyaW5nKSA9PiB2b2lkXG4gIGhhbmRsZVJlcXVlc3REZWxldGU6IChpZDogc3RyaW5nKSA9PiB2b2lkXG4gIGhhbmRsZUFnZW50UmVuYW1lOiAoaWQ6IHN0cmluZywgbmV3VGl0bGU6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPlxuICBoYW5kbGVUb2dnbGVQaW5BZ2VudDogKGlkOiBzdHJpbmcpID0+IFByb21pc2U8dm9pZD5cbiAgaGFuZGxlVG9nZ2xlQXJjaGl2ZUFnZW50OiAoaWQ6IHN0cmluZykgPT4gUHJvbWlzZTx2b2lkPlxuICBkcmFnUHJvamVjdElkOiBzdHJpbmcgfCBudWxsXG4gIHByb2plY3REcm9wSW5kaWNhdG9yOiB7IGlkOiBzdHJpbmc7IHBvc2l0aW9uOiAnYmVmb3JlJyB8ICdhZnRlcicgfSB8IG51bGxcbiAgb25Qcm9qZWN0RHJhZ1N0YXJ0OiAoZTogUmVhY3QuRHJhZ0V2ZW50LCB3b3Jrc3BhY2VJZDogc3RyaW5nKSA9PiB2b2lkXG4gIG9uUHJvamVjdERyYWdPdmVyOiAoZTogUmVhY3QuRHJhZ0V2ZW50LCB3b3Jrc3BhY2VJZDogc3RyaW5nKSA9PiB2b2lkXG4gIG9uUHJvamVjdERyYWdMZWF2ZTogKGU6IFJlYWN0LkRyYWdFdmVudCkgPT4gdm9pZFxuICBvblByb2plY3REcm9wOiAoZTogUmVhY3QuRHJhZ0V2ZW50LCB3b3Jrc3BhY2VJZDogc3RyaW5nKSA9PiB2b2lkXG4gIG9uUHJvamVjdERyYWdFbmQ6ICgpID0+IHZvaWRcbiAgYmF0Y2hTZWxlY3RXb3Jrc3BhY2VJZDogc3RyaW5nIHwgbnVsbFxuICBiYXRjaFNlbGVjdGVkU2Vzc2lvbklkczogU2V0PHN0cmluZz5cbiAgb25FbnRlckJhdGNoU2VsZWN0OiAod29ya3NwYWNlSWQ6IHN0cmluZykgPT4gdm9pZFxuICBvbkV4aXRCYXRjaFNlbGVjdDogKCkgPT4gdm9pZFxuICBvblRvZ2dsZUJhdGNoU2VsZWN0OiAoc2Vzc2lvbklkOiBzdHJpbmcpID0+IHZvaWRcbiAgb25CYXRjaFVwZGF0ZVNlbGVjdGVkOiBSZWFjdC5EaXNwYXRjaDxSZWFjdC5TZXRTdGF0ZUFjdGlvbjxTZXQ8c3RyaW5nPj4+XG4gIG9uUmVxdWVzdEJhdGNoRGVsZXRlOiAoKSA9PiB2b2lkXG4gIG9uQ29uZmlybUJhdGNoRGVsZXRlOiAoKSA9PiBQcm9taXNlPHZvaWQ+XG59KTogUmVhY3QuUmVhY3RFbGVtZW50IHtcbiAgY29uc3QgaXNDdXJyZW50ID0gZ3JvdXAud29ya3NwYWNlLmlkID09PSBjdXJyZW50V29ya3NwYWNlSWRcbiAgY29uc3QgW3JlbmFtaW5nLCBzZXRSZW5hbWluZ10gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgW2VkaXROYW1lLCBzZXRFZGl0TmFtZV0gPSBSZWFjdC51c2VTdGF0ZSgnJylcbiAgLyoqIOS4ieeCueiPnOWNleaJk+W8gOaXtuS/neaMgeihjCBob3ZlciDluIPlsYDvvIzpgb/lhY3mk43kvZzmjInpkq7kuI7lhoXlrrnph43lj6AgKi9cbiAgY29uc3QgW21lbnVPcGVuLCBzZXRNZW51T3Blbl0gPSBSZWFjdC51c2VTdGF0ZShmYWxzZSlcbiAgY29uc3QgZWRpdFJlZiA9IFJlYWN0LnVzZVJlZjxIVE1MSW5wdXRFbGVtZW50PihudWxsKVxuICBjb25zdCBqdXN0U3RhcnRlZFJlZiA9IFJlYWN0LnVzZVJlZihmYWxzZSlcblxuICBjb25zdCBoYW5kbGVTdGFydFJlbmFtZSA9ICgpOiB2b2lkID0+IHtcbiAgICBzZXRFZGl0TmFtZShncm91cC53b3Jrc3BhY2UubmFtZSlcbiAgICBzZXRSZW5hbWluZyh0cnVlKVxuICAgIGp1c3RTdGFydGVkUmVmLmN1cnJlbnQgPSB0cnVlXG4gICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBqdXN0U3RhcnRlZFJlZi5jdXJyZW50ID0gZmFsc2VcbiAgICAgIGVkaXRSZWYuY3VycmVudD8uZm9jdXMoKVxuICAgICAgZWRpdFJlZi5jdXJyZW50Py5zZWxlY3QoKVxuICAgIH0sIDMwMClcbiAgfVxuXG4gIGNvbnN0IGhhbmRsZUNvbW1pdFJlbmFtZSA9IGFzeW5jICgpOiBQcm9taXNlPHZvaWQ+ID0+IHtcbiAgICBpZiAoanVzdFN0YXJ0ZWRSZWYuY3VycmVudCkgcmV0dXJuXG4gICAgY29uc3QgdHJpbW1lZCA9IGVkaXROYW1lLnRyaW0oKVxuICAgIGlmICghdHJpbW1lZCB8fCB0cmltbWVkID09PSBncm91cC53b3Jrc3BhY2UubmFtZSkge1xuICAgICAgc2V0UmVuYW1pbmcoZmFsc2UpXG4gICAgICByZXR1cm5cbiAgICB9XG4gICAgYXdhaXQgb25SZW5hbWVXb3Jrc3BhY2UoZ3JvdXAud29ya3NwYWNlLmlkLCB0cmltbWVkKVxuICAgIHNldFJlbmFtaW5nKGZhbHNlKVxuICB9XG5cbiAgY29uc3QgaGFuZGxlUmVuYW1lS2V5RG93biA9IChlOiBSZWFjdC5LZXlib2FyZEV2ZW50KTogdm9pZCA9PiB7XG4gICAgaWYgKGUua2V5ID09PSAnRW50ZXInKSB7XG4gICAgICBpZiAoZS5uYXRpdmVFdmVudC5pc0NvbXBvc2luZykgcmV0dXJuXG4gICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgIHZvaWQgaGFuZGxlQ29tbWl0UmVuYW1lKClcbiAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAnRXNjYXBlJykge1xuICAgICAgc2V0UmVuYW1pbmcoZmFsc2UpXG4gICAgfVxuICB9XG5cbiAgY29uc3QgZ2V0U3RhdHVzID0gKHNlc3Npb25JZDogc3RyaW5nKTogU2Vzc2lvbkluZGljYXRvclN0YXR1cyA9PlxuICAgIGFnZW50SW5kaWNhdG9yTWFwLmdldChzZXNzaW9uSWQpID8/ICdpZGxlJ1xuXG4gIC8vIOS8muivneaOkuW6j+S8mOWFiOe6p++8mue9rumhtiA+IOW3peS9nOS4rShydW5uaW5nL2Jsb2NrZWQv5Li75YqoKSA+IOacgOi/keabtOaWsFxuICBjb25zdCBzb3J0ZWRTZXNzaW9ucyA9IFJlYWN0LnVzZU1lbW8oKCkgPT4ge1xuICAgIGNvbnN0IGl0ZW1zID0gZ3JvdXAuc2Vzc2lvbnMuc2xpY2UoKVxuICAgIGl0ZW1zLnNvcnQoKGEsIGIpID0+IHtcbiAgICAgIGlmIChhLnBpbm5lZCAmJiAhYi5waW5uZWQpIHJldHVybiAtMVxuICAgICAgaWYgKCFhLnBpbm5lZCAmJiBiLnBpbm5lZCkgcmV0dXJuIDFcbiAgICAgIGNvbnN0IHBhID0gZ2V0U3RhdHVzKGEuaWQpXG4gICAgICBjb25zdCBwYiA9IGdldFN0YXR1cyhiLmlkKVxuICAgICAgY29uc3QgcGFQcmlvcml0eSA9IEFDVElWRV9TRVNTSU9OX1NUQVRVU19QUklPUklUWVtwYV0gPz8gOTlcbiAgICAgIGNvbnN0IHBiUHJpb3JpdHkgPSBBQ1RJVkVfU0VTU0lPTl9TVEFUVVNfUFJJT1JJVFlbcGJdID8/IDk5XG4gICAgICBpZiAocGFQcmlvcml0eSAhPT0gcGJQcmlvcml0eSkgcmV0dXJuIHBhUHJpb3JpdHkgLSBwYlByaW9yaXR5XG4gICAgICBpZiAoYS5tYW51YWxXb3JraW5nICYmICFiLm1hbnVhbFdvcmtpbmcpIHJldHVybiAtMVxuICAgICAgaWYgKCFhLm1hbnVhbFdvcmtpbmcgJiYgYi5tYW51YWxXb3JraW5nKSByZXR1cm4gMVxuICAgICAgcmV0dXJuIGIudXBkYXRlZEF0IC0gYS51cGRhdGVkQXRcbiAgICB9KVxuICAgIHJldHVybiBpdGVtc1xuICB9LCBbZ3JvdXAuc2Vzc2lvbnNdKVxuXG4gIC8vIOW9k+WJjSBncm91cCDmmK/lkKbljIXlkKvpgInkuK3kvJror53igJTigJTpgInkuK3ml7bpmpDol4/mipjlj6DmjInpkq7vvIzpgb/lhY3mipjlj6DlkI7pgInkuK3mgIHmtojlpLFcbiAgY29uc3QgaGFzQWN0aXZlU2Vzc2lvbiA9ICEhYWN0aXZlU2Vzc2lvbklkICYmIGdyb3VwLnNlc3Npb25zLnNvbWUoKHMpID0+IHMuaWQgPT09IGFjdGl2ZVNlc3Npb25JZClcblxuICBjb25zdCBpc0RyYWdnaW5nID0gZHJhZ1Byb2plY3RJZCA9PT0gZ3JvdXAud29ya3NwYWNlLmlkXG4gIGNvbnN0IGlzQmF0Y2hNb2RlID0gYmF0Y2hTZWxlY3RXb3Jrc3BhY2VJZCA9PT0gZ3JvdXAud29ya3NwYWNlLmlkXG4gIGNvbnN0IGJhdGNoU2VsZWN0ZWRDb3VudCA9IGlzQmF0Y2hNb2RlXG4gICAgPyBncm91cC5zZXNzaW9ucy5maWx0ZXIoKHMpID0+IGJhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzLmhhcyhzLmlkKSkubGVuZ3RoXG4gICAgOiAwXG4gIGNvbnN0IGRyb3BQb3NpdGlvbiA9XG4gICAgcHJvamVjdERyb3BJbmRpY2F0b3I/LmlkID09PSBncm91cC53b3Jrc3BhY2UuaWQgPyBwcm9qZWN0RHJvcEluZGljYXRvci5wb3NpdGlvbiA6IG51bGxcbiAgLy8g6I+c5Y2V5omT5byA5pe2562J5ZCMIGhvdmVy77ya5bem5Y+z6K6p5L2NICsg5omL5p+EL+WKoOWPty/kuInngrnkv53mjIHlj6/op4FcbiAgY29uc3QgcHJvamVjdEFjdGlvbnNBY3RpdmUgPSBtZW51T3BlblxuXG4gIHJldHVybiAoXG4gICAgPHNlY3Rpb25cbiAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICdhcHAtc2lkZWJhci1wcm9qZWN0LWJsb2NrIHJlbGF0aXZlIHRyYW5zaXRpb24tb3BhY2l0eScsXG4gICAgICAgIGlzRHJhZ2dpbmcgJiYgJ29wYWNpdHktNDUnXG4gICAgICApfVxuICAgICAgb25EcmFnT3Zlcj17KGUpID0+IG9uUHJvamVjdERyYWdPdmVyKGUsIGdyb3VwLndvcmtzcGFjZS5pZCl9XG4gICAgICBvbkRyYWdMZWF2ZT17b25Qcm9qZWN0RHJhZ0xlYXZlfVxuICAgICAgb25Ecm9wPXsoZSkgPT4gb25Qcm9qZWN0RHJvcChlLCBncm91cC53b3Jrc3BhY2UuaWQpfVxuICAgICAgb25EcmFnRW5kPXtvblByb2plY3REcmFnRW5kfVxuICAgID5cbiAgICAgIHtkcm9wUG9zaXRpb24gPT09ICdiZWZvcmUnICYmIChcbiAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJhYnNvbHV0ZSAtdG9wLTAuNSBsZWZ0LTMgcmlnaHQtMyBoLTAuNSByb3VuZGVkLWZ1bGwgYmctcHJpbWFyeSB6LTEwXCIgLz5cbiAgICAgICl9XG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzTmFtZT1cImFwcC1zaWRlYmFyLXByb2plY3QtaGVhZGluZyBncm91cC9wcm9qZWN0IHJlbGF0aXZlIGZsZXggaXRlbXMtY2VudGVyXCJcbiAgICAgICAgZGF0YS1hY3Rpb25zLW9wZW49e3Byb2plY3RBY3Rpb25zQWN0aXZlID8gJycgOiB1bmRlZmluZWR9XG4gICAgICA+XG4gICAgICAgIHsvKiDmi5bmi73miYvmn4TvvJpob3ZlciDmmL7npLrvvIxkcmFnZ2FibGUg6Kem5Y+R5o6S5bqP77yI6YCJ5oup5qih5byP5LiL6ZqQ6JeP77yJICovfVxuICAgICAgICB7IWlzQmF0Y2hNb2RlICYmIChcbiAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgZHJhZ2dhYmxlXG4gICAgICAgICAgICBvbkRyYWdTdGFydD17KGUpID0+IG9uUHJvamVjdERyYWdTdGFydChlLCBncm91cC53b3Jrc3BhY2UuaWQpfVxuICAgICAgICAgICAgdGl0bGU9XCLmi5bmi73mjpLluo9cIlxuICAgICAgICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgICAgICAgJ2Fic29sdXRlIC1sZWZ0LTAuNSB0b3AtMS8yIHotMTAgZmxleCBzaXplLVsxOHB4XSAtdHJhbnNsYXRlLXktMS8yIGN1cnNvci1ncmFiIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciB0ZXh0LWZvcmVncm91bmQvMjAgb3BhY2l0eS0wIHRyYW5zaXRpb24tb3BhY2l0eSBncm91cC1ob3Zlci9wcm9qZWN0Om9wYWNpdHktMTAwIGFjdGl2ZTpjdXJzb3ItZ3JhYmJpbmcnLFxuICAgICAgICAgICAgICBwcm9qZWN0QWN0aW9uc0FjdGl2ZSAmJiAnb3BhY2l0eS0xMDAnXG4gICAgICAgICAgICApfVxuICAgICAgICAgICAgYXJpYS1oaWRkZW49XCJ0cnVlXCJcbiAgICAgICAgICA+XG4gICAgICAgICAgICA8R3JpcFZlcnRpY2FsIHNpemU9ezEyfSAvPlxuICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgKX1cbiAgICAgICAge3JlbmFtaW5nID8gKFxuICAgICAgICAgIDxkaXZcbiAgICAgICAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICdhcHAtc2lkZWJhci1wcm9qZWN0LXJlbmFtZSByZWxhdGl2ZSBmbGV4LTEgbWluLXctMCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSBweC0xIHB5LTEgcm91bmRlZC1tZCB0ZXh0LWxlZnQgdGl0bGViYXItbm8tZHJhZyBncm91cC1ob3Zlci9wcm9qZWN0OnBsLTQgZ3JvdXAtaG92ZXIvcHJvamVjdDpwci0xMicsXG4gICAgICAgICAgICAgIGlzQ3VycmVudCA/ICd0ZXh0LWZvcmVncm91bmQnIDogJ3RleHQtZm9yZWdyb3VuZC82NSdcbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPlxuICAgICAgICAgICAgPENoZXZyb25SaWdodFxuICAgICAgICAgICAgICBzaXplPXsxMn1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgICAgICAgICAnZmxleC1zaHJpbmstMCB0ZXh0LWZvcmVncm91bmQvNDAgdHJhbnNpdGlvbi10cmFuc2Zvcm0gZHVyYXRpb24tMTUwJyxcbiAgICAgICAgICAgICAgICAhY29sbGFwc2VkICYmICdyb3RhdGUtOTAnXG4gICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgIGFyaWEtaGlkZGVuXG4gICAgICAgICAgICAvPlxuICAgICAgICAgICAgPGlucHV0XG4gICAgICAgICAgICAgIHJlZj17ZWRpdFJlZn1cbiAgICAgICAgICAgICAgdmFsdWU9e2VkaXROYW1lfVxuICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEVkaXROYW1lKGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgb25LZXlEb3duPXtoYW5kbGVSZW5hbWVLZXlEb3dufVxuICAgICAgICAgICAgICBvbkJsdXI9eygpID0+IHZvaWQgaGFuZGxlQ29tbWl0UmVuYW1lKCl9XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXgtMSBtaW4tdy0wIGJnLXRyYW5zcGFyZW50IHRleHQtWzEzcHhdIGZvbnQtbWVkaXVtIHRleHQtZm9yZWdyb3VuZCBib3JkZXItYiBib3JkZXItcHJpbWFyeS81MCBvdXRsaW5lLW5vbmUgcHgtMC41IGxlYWRpbmctWzE4cHhdXCJcbiAgICAgICAgICAgICAgbWF4TGVuZ3RoPXs1MH1cbiAgICAgICAgICAgIC8+XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICkgOiAoXG4gICAgICAgICAgIWlzQmF0Y2hNb2RlICYmIChcbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXG4gICAgICAgICAgICAgIGFyaWEtZXhwYW5kZWQ9eyFjb2xsYXBzZWR9XG4gICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoaGFzQWN0aXZlU2Vzc2lvbikgcmV0dXJuIC8vIOmAieS4reS8muivneaJgOWcqCBncm91cCDkuI3lk43lupTmipjlj6Dngrnlh7tcbiAgICAgICAgICAgICAgICBvblNlbGVjdFByb2plY3QoZ3JvdXAud29ya3NwYWNlLmlkKVxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICdhcHAtc2lkZWJhci1wcm9qZWN0LWJ1dHRvbiByZWxhdGl2ZSBmbGV4LTEgbWluLXctMCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMSB0ZXh0LWxlZnQgdHJhbnNpdGlvbi1bcGFkZGluZyxjb2xvcixiYWNrZ3JvdW5kLWNvbG9yXSB0aXRsZWJhci1uby1kcmFnIGdyb3VwLWhvdmVyL3Byb2plY3Q6cGwtNCBncm91cC1ob3Zlci9wcm9qZWN0OnByLTEyJyxcbiAgICAgICAgICAgICAgICBpc0N1cnJlbnQgPyAndGV4dC1mb3JlZ3JvdW5kJyA6ICd0ZXh0LWZvcmVncm91bmQvNjUgaG92ZXI6dGV4dC1mb3JlZ3JvdW5kLzg4J1xuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICA8Q2hldnJvblJpZ2h0XG4gICAgICAgICAgICAgICAgc2l6ZT17MTJ9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgICAgICAgICAgICdmbGV4LXNocmluay0wIHRyYW5zaXRpb24tdHJhbnNmb3JtIGR1cmF0aW9uLTE1MCcsXG4gICAgICAgICAgICAgICAgICBoYXNBY3RpdmVTZXNzaW9uID8gJ3RleHQtZm9yZWdyb3VuZC8yNScgOiAndGV4dC1mb3JlZ3JvdW5kLzQwJyxcbiAgICAgICAgICAgICAgICAgICFjb2xsYXBzZWQgJiYgJ3JvdGF0ZS05MCdcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICA8c3BhblxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInNlc3Npb24tcm93LXRpdGxlLXRleHQgdGV4dC1bMTNweF0gZm9udC1tZWRpdW0gbGVhZGluZy1bMThweF1cIlxuICAgICAgICAgICAgICAgIHRpdGxlPXtncm91cC53b3Jrc3BhY2UubmFtZX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIHtncm91cC53b3Jrc3BhY2UubmFtZX1cbiAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJhcHAtc2lkZWJhci1wcm9qZWN0LWNvdW50XCI+e2dyb3VwLnNlc3Npb25zLmxlbmd0aH08L3NwYW4+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICApXG4gICAgICAgICl9XG5cbiAgICAgICAgeyFpc0JhdGNoTW9kZSAmJiAoXG4gICAgICAgICAgPFRvb2x0aXA+XG4gICAgICAgICAgICA8VG9vbHRpcFRyaWdnZXIgYXNDaGlsZD5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgIGFyaWEtbGFiZWw9e2DlnKjjgIwke2dyb3VwLndvcmtzcGFjZS5uYW1lfeOAjeS4reaWsOW7uuS8muivnWB9XG4gICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKClcbiAgICAgICAgICAgICAgICAgIG9uTmV3U2Vzc2lvbihncm91cC53b3Jrc3BhY2UuaWQpXG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgJ2Fic29sdXRlIHJpZ2h0LTcgdG9wLTEvMiBmbGV4IHNpemUtNSAtdHJhbnNsYXRlLXktMS8yIGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciByb3VuZGVkLW1kIHRleHQtZm9yZWdyb3VuZC8zMCBvcGFjaXR5LTAgdHJhbnNpdGlvbi1jb2xvcnMgaG92ZXI6YmctZm9yZWdyb3VuZC9bMC4wNTVdIGhvdmVyOnRleHQtZm9yZWdyb3VuZC82NSBncm91cC1ob3Zlci9wcm9qZWN0Om9wYWNpdHktMTAwIHRpdGxlYmFyLW5vLWRyYWcnLFxuICAgICAgICAgICAgICAgICAgcHJvamVjdEFjdGlvbnNBY3RpdmUgJiYgJ29wYWNpdHktMTAwJ1xuICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8UGx1cyBzaXplPXsxM30gLz5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8L1Rvb2x0aXBUcmlnZ2VyPlxuICAgICAgICAgICAgPFRvb2x0aXBDb250ZW50IHNpZGU9XCJ0b3BcIj7lnKjmraTpobnnm67kuK3mlrDlu7rkvJror508L1Rvb2x0aXBDb250ZW50PlxuICAgICAgICAgIDwvVG9vbHRpcD5cbiAgICAgICAgKX1cblxuICAgICAgICB7aXNCYXRjaE1vZGUgPyAoXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGZsZXgtMSBpdGVtcy1jZW50ZXIgZ2FwLTEgcHgtMiBweS0xXCI+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LVsxMnB4XSBmb250LW1lZGl1bSB0ZXh0LWZvcmVncm91bmQvODAgbXItMVwiPlxuICAgICAgICAgICAgICDlt7LpgIkge2JhdGNoU2VsZWN0ZWRDb3VudH0gLyB7Z3JvdXAuc2Vzc2lvbnMubGVuZ3RofVxuICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGFsbElkcyA9IGdyb3VwLnNlc3Npb25zLm1hcCgocykgPT4gcy5pZClcbiAgICAgICAgICAgICAgICBjb25zdCBhbGxTZWxlY3RlZCA9IGFsbElkcy5ldmVyeSgoaWQpID0+IGJhdGNoU2VsZWN0ZWRTZXNzaW9uSWRzLmhhcyhpZCkpXG4gICAgICAgICAgICAgICAgaWYgKGFsbFNlbGVjdGVkKSB7XG4gICAgICAgICAgICAgICAgICBvbkJhdGNoVXBkYXRlU2VsZWN0ZWQoKHByZXYpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV4dCA9IG5ldyBTZXQocHJldilcbiAgICAgICAgICAgICAgICAgICAgZm9yIChjb25zdCBpZCBvZiBhbGxJZHMpIG5leHQuZGVsZXRlKGlkKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV4dFxuICAgICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgb25CYXRjaFVwZGF0ZVNlbGVjdGVkKChwcmV2KSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5leHQgPSBuZXcgU2V0KHByZXYpXG4gICAgICAgICAgICAgICAgICAgIGZvciAoY29uc3QgaWQgb2YgYWxsSWRzKSBuZXh0LmFkZChpZClcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG5leHRcbiAgICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICBjbGFzc05hbWU9XCJoLTYgcHgtMiByb3VuZGVkLW1kIHRleHQtWzExcHhdIHRleHQtbXV0ZWQtZm9yZWdyb3VuZCBob3ZlcjpiZy1mb3JlZ3JvdW5kL1swLjA1XSBob3Zlcjp0ZXh0LWZvcmVncm91bmQgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgPlxuICAgICAgICAgICAgICB7Z3JvdXAuc2Vzc2lvbnMubGVuZ3RoID4gMCAmJlxuICAgICAgICAgICAgICBncm91cC5zZXNzaW9ucy5ldmVyeSgocykgPT4gYmF0Y2hTZWxlY3RlZFNlc3Npb25JZHMuaGFzKHMuaWQpKVxuICAgICAgICAgICAgICAgID8gJ+WPlua2iOWFqOmAiSdcbiAgICAgICAgICAgICAgICA6ICflhajpgIknfVxuICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICBvbkNsaWNrPXtvblJlcXVlc3RCYXRjaERlbGV0ZX1cbiAgICAgICAgICAgICAgZGlzYWJsZWQ9e2JhdGNoU2VsZWN0ZWRDb3VudCA9PT0gMH1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiaC02IHB4LTIgcm91bmRlZC1tZCB0ZXh0LVsxMXB4XSB0ZXh0LXJlZC02MDAgZGFyazp0ZXh0LXJlZC00MDAgaG92ZXI6YmctcmVkLTUwMC8xMCBkaXNhYmxlZDpvcGFjaXR5LTQwIGRpc2FibGVkOmhvdmVyOmJnLXRyYW5zcGFyZW50IHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAg5Yig6Zmke2JhdGNoU2VsZWN0ZWRDb3VudCA+IDAgPyBgICR7YmF0Y2hTZWxlY3RlZENvdW50fWAgOiAnJ31cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgb25DbGljaz17b25FeGl0QmF0Y2hTZWxlY3R9XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImgtNiBweC0yIHJvdW5kZWQtbWQgdGV4dC1bMTFweF0gdGV4dC1tdXRlZC1mb3JlZ3JvdW5kIGhvdmVyOmJnLWZvcmVncm91bmQvWzAuMDVdIGhvdmVyOnRleHQtZm9yZWdyb3VuZCB0cmFuc2l0aW9uLWNvbG9ycyBtbC1hdXRvXCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAg5Y+W5raIXG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgKSA6IChcbiAgICAgICAgICA8RHJvcGRvd25NZW51IG9wZW49e21lbnVPcGVufSBvbk9wZW5DaGFuZ2U9e3NldE1lbnVPcGVufT5cbiAgICAgICAgICAgIDxEcm9wZG93bk1lbnVUcmlnZ2VyIGFzQ2hpbGQ+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICB0eXBlPVwiYnV0dG9uXCJcbiAgICAgICAgICAgICAgICBhcmlhLWxhYmVsPVwi6aG555uu6I+c5Y2VXCJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgJ2Fic29sdXRlIHJpZ2h0LTEuNSB0b3AtMS8yIGZsZXggc2l6ZS01IC10cmFuc2xhdGUteS0xLzIgaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHJvdW5kZWQtbWQgdGV4dC1mb3JlZ3JvdW5kLzMwIG9wYWNpdHktMCB0cmFuc2l0aW9uLWNvbG9ycyBob3ZlcjpiZy1mb3JlZ3JvdW5kL1swLjA1NV0gaG92ZXI6dGV4dC1mb3JlZ3JvdW5kLzYwIGdyb3VwLWhvdmVyL3Byb2plY3Q6b3BhY2l0eS0xMDAgdGl0bGViYXItbm8tZHJhZycsXG4gICAgICAgICAgICAgICAgICAnZGF0YS1bc3RhdGU9b3Blbl06YmctZm9yZWdyb3VuZC9bMC4wNTVdIGRhdGEtW3N0YXRlPW9wZW5dOnRleHQtZm9yZWdyb3VuZC82MCBkYXRhLVtzdGF0ZT1vcGVuXTpvcGFjaXR5LTEwMCcsXG4gICAgICAgICAgICAgICAgICBwcm9qZWN0QWN0aW9uc0FjdGl2ZSAmJiAnb3BhY2l0eS0xMDAnXG4gICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxNb3JlVmVydGljYWwgc2l6ZT17MTN9IC8+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVUcmlnZ2VyPlxuICAgICAgICAgICAgPERyb3Bkb3duTWVudUNvbnRlbnQgYWxpZ249XCJzdGFydFwiIGNsYXNzTmFtZT1cInctNDQgei1bOTk5OV0gbWluLXctMCBwLTAuNVwiPlxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51SXRlbVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQteHMgcHktMSBbJj5zdmddOnNpemUtMy41XCJcbiAgICAgICAgICAgICAgICBvblNlbGVjdD17KCkgPT4gb25TZWxlY3RQcm9qZWN0KGdyb3VwLndvcmtzcGFjZS5pZCl9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8Rm9sZGVyT3BlbiBzaXplPXsxNH0gLz5cbiAgICAgICAgICAgICAgICDorr7kuLrlvZPliY3pobnnm65cbiAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVJdGVtPlxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51SXRlbVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQteHMgcHktMSBbJj5zdmddOnNpemUtMy41XCJcbiAgICAgICAgICAgICAgICBvblNlbGVjdD17aGFuZGxlU3RhcnRSZW5hbWV9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8UGVuY2lsIHNpemU9ezE0fSAvPlxuICAgICAgICAgICAgICAgIOmHjeWRveWQjVxuICAgICAgICAgICAgICA8L0Ryb3Bkb3duTWVudUl0ZW0+XG4gICAgICAgICAgICAgIDxEcm9wZG93bk1lbnVJdGVtXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC14cyBweS0xIFsmPnN2Z106c2l6ZS0zLjVcIlxuICAgICAgICAgICAgICAgIG9uU2VsZWN0PXsoKSA9PiBvbkNvbmZpZ3VyZVByb2plY3QoZ3JvdXAud29ya3NwYWNlLmlkKX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxTZXR0aW5ncyBzaXplPXsxNH0gLz5cbiAgICAgICAgICAgICAgICDphY3nva4gTUNQIOS4jiBTa2lsbHNcbiAgICAgICAgICAgICAgPC9Ecm9wZG93bk1lbnVJdGVtPlxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51SXRlbVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQteHMgcHktMSBbJj5zdmddOnNpemUtMy41XCJcbiAgICAgICAgICAgICAgICBvblNlbGVjdD17KCkgPT4gb25FbnRlckJhdGNoU2VsZWN0KGdyb3VwLndvcmtzcGFjZS5pZCl9XG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8Q2hlY2tTcXVhcmUgc2l6ZT17MTR9IC8+XG4gICAgICAgICAgICAgICAg5om56YeP5Yig6Zmk5Lya6K+dXG4gICAgICAgICAgICAgIDwvRHJvcGRvd25NZW51SXRlbT5cbiAgICAgICAgICAgICAgPERyb3Bkb3duTWVudVNlcGFyYXRvciBjbGFzc05hbWU9XCJteS0wLjVcIiAvPlxuICAgICAgICAgICAgICA8RHJvcGRvd25NZW51SXRlbVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAndGV4dC14cyBweS0xIFsmPnN2Z106c2l6ZS0zLjUnLFxuICAgICAgICAgICAgICAgICAgJ3RleHQtZGVzdHJ1Y3RpdmUgZm9jdXM6dGV4dC1kZXN0cnVjdGl2ZSdcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgIG9uU2VsZWN0PXsoKSA9PiBvblJlcXVlc3REZWxldGVXb3Jrc3BhY2UoZ3JvdXAud29ya3NwYWNlLmlkKX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxUcmFzaDIgc2l6ZT17MTR9IC8+XG4gICAgICAgICAgICAgICAg5Yig6Zmk6aG555uuXG4gICAgICAgICAgICAgIDwvRHJvcGRvd25NZW51SXRlbT5cbiAgICAgICAgICAgIDwvRHJvcGRvd25NZW51Q29udGVudD5cbiAgICAgICAgICA8L0Ryb3Bkb3duTWVudT5cbiAgICAgICAgKX1cbiAgICAgIDwvZGl2PlxuXG4gICAgICA8ZGl2XG4gICAgICAgIGNsYXNzTmFtZT1cIm10LXB4IGdyaWQgbWluLXctMCB0cmFuc2l0aW9uLVtncmlkLXRlbXBsYXRlLXJvd3NdIGR1cmF0aW9uLTIwMCBlYXNlLWluLW91dFwiXG4gICAgICAgIHN0eWxlPXt7IGdyaWRUZW1wbGF0ZVJvd3M6IGNvbGxhcHNlZCA/ICcwZnInIDogJzFmcicgfX1cbiAgICAgID5cbiAgICAgICAgey8qXG4gICAgICAgICAqIOW/hemhuyBtaW4tdy0wICsgb3ZlcmZsb3ctaGlkZGVu77ya5bGV5byA5pe26IulIG92ZXJmbG93LXZpc2libGXvvIxcbiAgICAgICAgICog5a2Q6KGM5qCH6aKY5Lya5oyJ5YaF5a655pKR5a6977yM5YaN6KKr5L6n5qCP56WW5YWI56Gs6KOBIOKGkiDml6DnnIHnlaXlj7fjgIJcbiAgICAgICAgICovfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi1oLTAgbWluLXctMCBvdmVyZmxvdy1oaWRkZW5cIj5cbiAgICAgICAgICB7IWNvbGxhcHNlZCAmJiBzb3J0ZWRTZXNzaW9ucy5sZW5ndGggPiAwID8gKFxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IG1pbi13LTAgZmxleC1jb2xcIj5cbiAgICAgICAgICAgICAge3NvcnRlZFNlc3Npb25zLm1hcCgoc2Vzc2lvbikgPT4gKFxuICAgICAgICAgICAgICAgIDxBZ2VudFNlc3Npb25JdGVtXG4gICAgICAgICAgICAgICAgICBrZXk9e3Nlc3Npb24uaWR9XG4gICAgICAgICAgICAgICAgICBzZXNzaW9uPXtzZXNzaW9ufVxuICAgICAgICAgICAgICAgICAgYWN0aXZlPXtzZXNzaW9uLmlkID09PSBhY3RpdmVTZXNzaW9uSWR9XG4gICAgICAgICAgICAgICAgICBpbmRpY2F0b3JTdGF0dXM9e2FnZW50SW5kaWNhdG9yTWFwLmdldChzZXNzaW9uLmlkKSA/PyAnaWRsZSd9XG4gICAgICAgICAgICAgICAgICBtb2RlbE5hbWU9e1xuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uTW9kZWxNYXAuZ2V0KHNlc3Npb24uaWQpXG4gICAgICAgICAgICAgICAgICAgICAgPyByZXNvbHZlTW9kZWxEaXNwbGF5TmFtZShzZXNzaW9uTW9kZWxNYXAuZ2V0KHNlc3Npb24uaWQpISwgY2hhbm5lbHMpXG4gICAgICAgICAgICAgICAgICAgICAgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGxlZnRBY2NlbnQ9e2dldFNlc3Npb25MZWZ0QWNjZW50KFxuICAgICAgICAgICAgICAgICAgICBhZ2VudEluZGljYXRvck1hcC5nZXQoc2Vzc2lvbi5pZCkgPz8gJ2lkbGUnLFxuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLmlkID09PSBhY3RpdmVTZXNzaW9uSWQsXG4gICAgICAgICAgICAgICAgICAgIHNlc3Npb24ubWFudWFsV29ya2luZ1xuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgIHdvcmtzcGFjZU5hbWU9e1xuICAgICAgICAgICAgICAgICAgICBzZXNzaW9uLndvcmtzcGFjZUlkID8gd29ya3NwYWNlTmFtZU1hcC5nZXQoc2Vzc2lvbi53b3Jrc3BhY2VJZCkgOiB1bmRlZmluZWRcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlzQmF0Y2hNb2RlPXtpc0JhdGNoTW9kZX1cbiAgICAgICAgICAgICAgICAgIGlzQmF0Y2hTZWxlY3RlZD17YmF0Y2hTZWxlY3RlZFNlc3Npb25JZHMuaGFzKHNlc3Npb24uaWQpfVxuICAgICAgICAgICAgICAgICAgb25Ub2dnbGVCYXRjaFNlbGVjdD17b25Ub2dnbGVCYXRjaFNlbGVjdH1cbiAgICAgICAgICAgICAgICAgIG9uU2VsZWN0PXtvblNlbGVjdFNlc3Npb259XG4gICAgICAgICAgICAgICAgICBvblJlcXVlc3REZWxldGU9e2hhbmRsZVJlcXVlc3REZWxldGV9XG4gICAgICAgICAgICAgICAgICBvblJlbmFtZT17aGFuZGxlQWdlbnRSZW5hbWV9XG4gICAgICAgICAgICAgICAgICBvblRvZ2dsZVBpbj17aGFuZGxlVG9nZ2xlUGluQWdlbnR9XG4gICAgICAgICAgICAgICAgICBvblRvZ2dsZUFyY2hpdmU9e2hhbmRsZVRvZ2dsZUFyY2hpdmVBZ2VudH1cbiAgICAgICAgICAgICAgICAgIGRpc2FibGVNaW5pTWFwXG4gICAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgIHsvKiDnp7vpmaTmipjlj6Dmn6XnnIvmm7TlpJrmnLrliLbvvJrnjrDlnKjmiYDmnInkvJror53nm7TmjqXlsZXnpLogKi99XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApIDogIWNvbGxhcHNlZCA/IChcbiAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTEgcHgtMSBweS0wLjUgdGV4dC1bMTJweF0gdGV4dC1mb3JlZ3JvdW5kLzIyIHNlbGVjdC1ub25lXCI+XG4gICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cImZsZXgtc2hyaW5rLTAgdy1bMThweF1cIiBhcmlhLWhpZGRlbiAvPlxuICAgICAgICAgICAgICA8c3Bhbj7mmoLml6DkvJror508L3NwYW4+XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICApIDogbnVsbH1cbiAgICAgICAgPC9kaXY+XG4gICAgICA8L2Rpdj5cbiAgICAgIHtkcm9wUG9zaXRpb24gPT09ICdhZnRlcicgJiYgKFxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImFic29sdXRlIC1ib3R0b20tMC41IGxlZnQtMyByaWdodC0zIGgtMC41IHJvdW5kZWQtZnVsbCBiZy1wcmltYXJ5IHotMTBcIiAvPlxuICAgICAgKX1cbiAgICA8L3NlY3Rpb24+XG4gIClcbn0pXG4iXSwiZmlsZSI6IkY6L1RBZ2VudF9HZW5lcmFsL2FwcHMvZWxlY3Ryb24vc3JjL3JlbmRlcmVyL2NvbXBvbmVudHMvYXBwLXNoZWxsL0xlZnRTaWRlYmFyLnRzeCJ9

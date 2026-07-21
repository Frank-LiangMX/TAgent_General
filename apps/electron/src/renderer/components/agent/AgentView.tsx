/**
 * AgentView — Agent 模式主视图容器
 *
 * 职责：
 * - 加载当前 Agent 会话消息
 * - 发送/停止/压缩 Agent 消息
 * - 附件上传处理
 *
 * 注意：IPC 流式事件监听已提升到全局 useGlobalAgentListeners，
 * 本组件为纯展示 + 交互组件。
 *
 * 布局：AgentMessages | Composer（模型/权限在输入区）+ 可选右侧 Inspector
 * 会话状态条已移除：模型/权限/班组进度分别落在 Composer、Underlay、右轨班组入口。
 */

import {
  MAX_ATTACHMENT_SIZE,
  isAgentCompatibleProvider,
  resolveAgentSessionModelId,
} from '@tagent/shared'
import { useAtom, useAtomValue, useSetAtom, useStore } from 'jotai'
import {
  ArrowUp,
  Square,
  Settings,
  Paperclip,
  FolderPlus,
  Plus,
  MicIcon,
  X,
  Sparkles,
  MessageSquareText,
} from 'lucide-react'
import * as React from 'react'
import { unstable_batchedUpdates } from 'react-dom'
import { toast } from 'sonner'

import type {
  AgentSendInput,
  AgentPendingFile,
  FileDialogLargeFile,
  ModelOption,
  SDKMessage,
} from '@tagent/shared'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import { AgentMessages } from './AgentMessages'
import { AgentMessageQueue } from './AgentMessageQueue'
import { reconcilePersistedMessagesOnReload } from './reconcile-persisted-messages'
import { AgentModelSelector } from './AgentModelSelector'
import { AgentSwitchBanner } from './AgentSwitchBanner'
import { AskHeuristicDialog, type AskHeuristicChoice } from './AskHeuristicDialog'
import { AskUserBanner } from './AskUserBanner'
import { ComposerUnderlay } from './ComposerUnderlay'
import { ExitPlanModeBanner } from './ExitPlanModeBanner'
import { KsccInstallGuide } from './KsccInstallGuide'
import { PermissionBanner } from './PermissionBanner'
import { PlanModeDashedBorder } from './PlanModeDashedBorder'
import { TokenStatsPanel } from './TokenStatsPanel'

import { TaskProgressDock } from './TaskProgressDock'
import { NoProjectEmptyState } from './NoProjectEmptyState'

import {
  agentStreamingStatesAtom,
  agentSessionStreamingStateAtomFamily,
  agentChannelIdAtom,
  agentModelIdAtom,
  agentChannelIdsAtom,
  agentSessionChannelMapAtom,
  agentSessionModelMapAtom,
  currentAgentWorkspaceIdAtom,
  agentPendingPromptAtom,
  agentPendingFilesAtomFamily,
  agentWorkspacesAtom,
  agentStreamErrorsAtom,
  agentSessionDraftsAtom,
  agentSessionDraftAtomFamily,
  agentSessionDraftHtmlAtom,
  agentSessionDraftHtmlAtomFamily,
  agentSessionHasDraftAtomFamily,
  agentPromptSuggestionsAtom,
  agentMessageRefreshAtom,
  agentSDKMessagesCacheAtom,
  setSessionMessagesCache,
  agentDiffRefreshVersionAtom,
  agentSessionsAtom,
  agentAttachedDirectoriesMapAtom,
  agentAttachedFilesMapAtom,
  workspaceAttachedDirectoriesMapAtom,
  workspaceAttachedFilesMapAtom,
  liveMessagesMapAtom,
  stoppedByUserSessionsAtom,
  agentPlanModeSessionsAtom,
  agentPermissionModeMapAtom,
  agentDefaultPermissionModeAtom,
  sessionPersistedPermissionModeAtom,
  agentSessionPathMapAtom,
  allPendingAskUserRequestsAtom,
  allPendingExitPlanRequestsAtom,
  finalizeStreamingActivities,
  sessionTokenStatsAtom,
  agentSidePanelOpenAtom,
  agentMessageQueueAtomFamily,
} from '@/atoms/agent-atoms'
import { askMessagesMapAtom, askStreamingStatesAtom } from '@/atoms/ask-atoms'
import {
  btwOpenAtom,
  btwMessagesAtom,
  btwStreamingAtom,
  btwChannelIdAtom,
  btwModelIdAtom,
  btwSourceSessionIdAtom,
} from '@/atoms/btw-atoms'
import { channelsAtom } from '@/atoms/model-atoms'
import {
  currentComposerModeAtom,
  composerModeMapAtom,
  composerModeSyncedSessionsAtom,
} from '@/atoms/composer-atoms'
import { draftSessionIdsAtom } from '@/atoms/draft-session-atoms'
import {
  previewPanelOpenMapAtom,
  previewFileMapAtom,
  quotedSelectionMapAtom,
  currentQuotedSelectionAtom,
} from '@/atoms/preview-atoms'
import { settingsOpenAtom } from '@/atoms/settings-tab'
import { sendWithCmdEnterAtom } from '@/atoms/shortcut-atoms'
import {
  sessionBoardIdAtomFamily,
  sessionSourceKanbanTaskIdAtomFamily,
} from '@/atoms/kanban-atoms'
import { rightRailItemAtom } from '@/atoms/app-mode'
import {
  InputToolbarOverflow,
  type ToolbarItem,
} from '@/components/ai-elements/InputToolbarOverflow'
import { RichTextInput } from '@/components/ai-elements/rich-text-input'
import { QuotedSelectionChip } from '@/components/diff/QuotedSelectionChip'
import { openPreview } from '@/components/diff/preview-opener'
import { SessionFloatingLayout } from '@/components/layout/SessionFloatingLayout'
import { AttachmentPreviewItem } from '@/components/shared/AttachmentPreviewItem'
import { AgentSessionProvider } from '@/contexts/session-context'
import { useOpenSession } from '@/hooks/useOpenSession'
import { useDesignContextAugment } from '@/hooks/useDesignContextAugment'
import { detectUIIntent, isNewDesignRequest } from '@/lib/detect-ui-intent'
import { designSuggestionAtom, designEnabledAtom } from '@/atoms/design-preview-atoms'
import { DesignSuggestionBanner } from '@/components/design-preview/DesignSuggestionBanner'

import { isLikelyAgentIntent } from '@/lib/ask-heuristic'
import {
  createClipboardPendingFile,
  createClipboardTextDraft,
  makeUniqueAttachmentName,
} from '@/lib/clipboard-text-attachment'
import { fileToBase64, formatFileNames, getFileParentPath } from '@/lib/file-utils'
import {
  getActiveAccelerator,
  getAcceleratorDisplay,
  registerShortcut,
} from '@/lib/shortcut-registry'
import { cn } from '@/lib/utils'
import {
  createAgentQueuedMessage,
  removeQueuedMessage,
  restoreQueuedMessageToFront,
  moveQueuedMessage,
  buildQueuedMessageSendPayload,
  type QueueDropPlacement,
} from '@/lib/agent-message-queue'

/** 稳定的空 SDKMessage 数组引用，避免 ?? [] 每次创建新引用 */
const EMPTY_SDK_MESSAGES: SDKMessage[] = []
const LONG_TEXT_ATTACHMENT_THRESHOLD = 2000

interface SDKMessageRecord {
  type?: string
  parent_tool_use_id?: string | null
  isSynthetic?: boolean
  message?: {
    content?: unknown
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function getUserTextFromSDKMessage(message: SDKMessage): string | null {
  const sdkMessage = message as unknown as SDKMessageRecord
  if (sdkMessage.type !== 'user' || sdkMessage.parent_tool_use_id || sdkMessage.isSynthetic) {
    return null
  }

  const content = sdkMessage.message?.content
  if (!Array.isArray(content)) return null
  if (content.some((block) => isRecord(block) && block.type === 'tool_result')) return null

  const texts = content
    .filter((block) => isRecord(block) && block.type === 'text' && typeof block.text === 'string')
    .map((block) => (block as { text: string }).text)

  return texts.length > 0 ? texts.join('\n') : null
}

/** 输入增强合并按钮（附件/文件夹/语音） */
interface InputMorePopoverProps {
  onAttachFile: () => void
  onAttachFolder: () => void
  onSpeech: () => void
  /**
   * 禁用文件/文件夹附件（Ask 档位下）
   * - true: 附件/文件夹项灰掉但仍可见，语音项正常
   * - false: 全部正常
   */
  disableAttachments?: boolean
}

function InputMorePopover({
  onAttachFile,
  onAttachFolder,
  onSpeech,
  disableAttachments = false,
}: InputMorePopoverProps): React.ReactElement {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverTrigger asChild>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="agent-toolbar-icon-btn size-[36px] rounded-full text-foreground/60 hover:text-foreground"
            >
              <Plus className="size-5" />
            </Button>
          </TooltipTrigger>
        </PopoverTrigger>
        <TooltipContent side="bottom">
          <p>添加附件或语音</p>
        </TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="agent-toolbar-popover w-auto min-w-[160px] p-2"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            onClick={() => {
              if (!disableAttachments) {
                onAttachFile()
                setOpen(false)
              }
            }}
            disabled={disableAttachments}
            className="agent-toolbar-popover-item flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <Paperclip className="size-4 text-foreground/70" />
            <span className="text-xs">添加附件</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!disableAttachments) {
                onAttachFolder()
                setOpen(false)
              }
            }}
            disabled={disableAttachments}
            className="agent-toolbar-popover-item flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          >
            <FolderPlus className="size-4 text-foreground/70" />
            <span className="text-xs">添加文件夹</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSpeech()
              setOpen(false)
            }}
            className="agent-toolbar-popover-item flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <MicIcon className="size-4 text-foreground/70" />
            <span className="text-xs">语音输入</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export interface AgentViewProps {
  sessionId: string
  /** Classic full workspace or the single conversation surface embedded in AI Office. */
  surface?: 'classic' | 'office-dock'
}

export function AgentView({
  sessionId,
  surface = 'classic',
}: AgentViewProps): React.ReactElement {
  const isOfficeDock = surface === 'office-dock'
  const [ksccGuideOpen, setKsccGuideOpen] = React.useState(false)
  const [persistedSDKMessages, setPersistedSDKMessages] = React.useState<SDKMessage[]>([])
  const persistedSDKMessagesRef = React.useRef<SDKMessage[]>([])
  persistedSDKMessagesRef.current = persistedSDKMessages
  const setStreamingStates = useSetAtom(agentStreamingStatesAtom)
  // 按 sessionId 切片订阅：仅本 session 的 streaming state 变化才让 AgentView 重渲染。
  // 流式期间其他 session 的高频更新（每 token 一次）通过 base map atom 传播但派生
  // atom 输出引用未变，订阅者跳过通知。
  const streamState = useAtomValue(agentSessionStreamingStateAtomFamily(sessionId))
  const streaming = streamState?.running ?? false
  const stoppedByUserSessions = useAtomValue(stoppedByUserSessionsAtom)
  const sendWithCmdEnter = useAtomValue(sendWithCmdEnterAtom)
  const stoppedByUser = stoppedByUserSessions.has(sessionId)
  const liveMessagesMap = useAtomValue(liveMessagesMapAtom)
  const setLiveMessagesMap = useSetAtom(liveMessagesMapAtom)
  // 稳定化空数组引用，避免 ?? [] 每次创建新引用导致下游 useMemo 链不必要重算
  const liveMessages = liveMessagesMap.get(sessionId) ?? EMPTY_SDK_MESSAGES
  // Per-session 渠道/模型配置（优先读 session map，回退到全局默认值）
  const sessionChannelMap = useAtomValue(agentSessionChannelMapAtom)
  const sessionModelMap = useAtomValue(agentSessionModelMapAtom)
  const setSessionChannelMap = useSetAtom(agentSessionChannelMapAtom)
  const setSessionModelMap = useSetAtom(agentSessionModelMapAtom)
  const [defaultChannelId] = useAtom(agentChannelIdAtom)
  const legacyGlobalModelId = useAtomValue(agentModelIdAtom)
  const agentChannelIds = useAtomValue(agentChannelIdsAtom)
  const setAgentChannelIds = useSetAtom(agentChannelIdsAtom)
  const globalChannels = useAtomValue(channelsAtom)
  const setGlobalChannels = useSetAtom(channelsAtom)
  const agentChannelId = sessionChannelMap.get(sessionId) ?? defaultChannelId
  const agentChannel = React.useMemo(
    () =>
      agentChannelId ? globalChannels.find((c) => c.id === agentChannelId && c.enabled) : undefined,
    [agentChannelId, globalChannels]
  )
  const agentModelId = resolveAgentSessionModelId(
    agentChannel,
    sessionModelMap.get(sessionId),
    legacyGlobalModelId
  )
  // Agent 模式：Claude Agent SDK 仅支持 Anthropic 协议。
  // 在传给 ModelSelector 之前过滤掉非 Anthropic 兼容的渠道，
  // 与 ChannelForm / ChannelSettings 保持一致。
  const agentChannelIdsAgentSafe = React.useMemo(
    () =>
      agentChannelIds.filter((id) => {
        const ch = globalChannels.find((c) => c.id === id)
        return ch ? isAgentCompatibleProvider(ch.provider) : false
      }),
    [agentChannelIds, globalChannels]
  )
  const setSettingsOpen = useSetAtom(settingsOpenAtom)
  const setDraftSessionIds = useSetAtom(draftSessionIdsAtom)
  const globalWorkspaceId = useAtomValue(currentAgentWorkspaceIdAtom)
  const sessions = useAtomValue(agentSessionsAtom)
  // 从会话元数据派生 workspaceId：会话数据已加载时以自身为准，未加载时回退全局 atom
  const currentWorkspaceId = React.useMemo(() => {
    const meta = sessions.find((s) => s.id === sessionId)
    if (!meta) return globalWorkspaceId // 数据未加载，回退全局
    return meta.workspaceId ?? null // 数据已加载，以会话自身为准
  }, [sessions, sessionId, globalWorkspaceId])

  // ===== Kanban 班组入口（右栏伴生面板，不再整页切换） =====
  const isNestedWorker = useAtomValue(sessionSourceKanbanTaskIdAtomFamily(sessionId)) !== undefined
  const boardId = useAtomValue(sessionBoardIdAtomFamily(sessionId))
  const setRightRailItem = useSetAtom(rightRailItemAtom)
  const setSidePanelOpen = useSetAtom(agentSidePanelOpenAtom)
  const previousBoardIdRef = React.useRef<string | undefined>(undefined)
  const boardIdTrackingReadyRef = React.useRef(false)

  // 主会话「运行中」首次绑定看板时打开右轨班组面板。
  // 刷新/重挂载时 boardId 常走 undefined→有值，不能当首次绑定，否则每次都强制打开班组。
  React.useEffect(() => {
    const metaReady = sessions.some((s) => s.id === sessionId)
    if (!metaReady) return

    if (!boardIdTrackingReadyRef.current) {
      boardIdTrackingReadyRef.current = true
      previousBoardIdRef.current = boardId
      return
    }

    const previousBoardId = previousBoardIdRef.current
    if (surface === 'classic' && !isNestedWorker && !previousBoardId && boardId) {
      setRightRailItem('crew')
      setSidePanelOpen(true)
    }
    previousBoardIdRef.current = boardId
  }, [
    boardId,
    isNestedWorker,
    sessionId,
    sessions,
    setRightRailItem,
    setSidePanelOpen,
    surface,
  ])
  // ===== Kanban 集成结束 =====

  const [pendingPrompt, setPendingPrompt] = useAtom(agentPendingPromptAtom)
  const [pendingFiles, setPendingFiles] = useAtom(agentPendingFilesAtomFamily(sessionId))
  const workspaces = useAtomValue(agentWorkspacesAtom)
  // 保持 channelId 稳定：初始化前使用上次有效值，避免工具栏抖动
  const stableChannelIdRef = React.useRef(agentChannelId)
  if (agentChannelId) stableChannelIdRef.current = agentChannelId

  // 已有会话首次打开时，从持久化 session meta 初始化 per-session map（不写 settings）
  // 优先读 session meta 中已持久化的 channelId/modelId，避免组件重挂载时丢失用户选择
  React.useEffect(() => {
    if (!sessionId) return
    const meta = sessions.find((s) => s.id === sessionId)
    const persistedChannelId = meta?.channelId ?? defaultChannelId
    if (persistedChannelId) {
      setSessionChannelMap((prev) => {
        if (prev.has(sessionId)) return prev
        const map = new Map(prev)
        map.set(sessionId, persistedChannelId)
        return map
      })
    }
    const channelId = persistedChannelId
    const channel = channelId
      ? globalChannels.find((c) => c.id === channelId && c.enabled)
      : undefined
    const persistedModelId = meta?.modelId
    const resolvedModelId =
      persistedModelId ?? resolveAgentSessionModelId(channel, undefined, legacyGlobalModelId)
    if (resolvedModelId) {
      setSessionModelMap((prev) => {
        if (prev.has(sessionId)) return prev
        const map = new Map(prev)
        map.set(sessionId, resolvedModelId)
        return map
      })
    }
  }, [
    sessionId,
    defaultChannelId,
    legacyGlobalModelId,
    globalChannels,
    sessions,
    setSessionChannelMap,
    setSessionModelMap,
  ])

  // 从主进程拉取该会话的 Composer 档位（持久化到 AgentSessionMeta.lastComposerMode）
  // 并写入 composerModeMapAtom 作为本地缓存。syncSet 内幂等守卫。
  const setComposerModeMap = useSetAtom(composerModeMapAtom)
  const addComposerModeSynced = useSetAtom(composerModeSyncedSessionsAtom)
  React.useEffect(() => {
    if (!sessionId) return
    let cancelled = false
    void window.electronAPI
      .getComposerMode(sessionId)
      .then((mode) => {
        if (cancelled) return
        setComposerModeMap((prev) => {
          if (prev.has(sessionId)) return prev
          const next = new Map(prev)
          next.set(sessionId, mode)
          return next
        })
        addComposerModeSynced((prev) => {
          const next = new Set(prev)
          next.add(sessionId)
          return next
        })
      })
      .catch((err) => {
        console.warn('[AgentView] 拉取 Composer 档位失败:', err)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId, setComposerModeMap, addComposerModeSynced])

  const setAgentStreamErrors = useSetAtom(agentStreamErrorsAtom)
  const streamErrors = useAtomValue(agentStreamErrorsAtom)
  const _agentError = streamErrors.get(sessionId) ?? null
  const planModeSessions = useAtomValue(agentPlanModeSessionsAtom)
  const isPlanMode = planModeSessions.has(sessionId)
  const permissionModeMap = useAtomValue(agentPermissionModeMapAtom)
  const defaultPermissionMode = useAtomValue(agentDefaultPermissionModeAtom)
  const persistedPermissionMode = useAtomValue(sessionPersistedPermissionModeAtom(sessionId))
  const permissionMode =
    permissionModeMap.get(sessionId) ?? persistedPermissionMode ?? defaultPermissionMode
  const isPermissionPlanMode = permissionMode === 'plan'
  const store = useStore()
  const currentQuotedSelection = useAtomValue(currentQuotedSelectionAtom)
  const setQuotedSelectionMap = useSetAtom(quotedSelectionMapAtom)

  /** 移除当前引用选中文本 */
  const handleRemoveQuotedSelection = React.useCallback(() => {
    setQuotedSelectionMap((prev) => {
      const m = new Map(prev)
      m.delete(sessionId)
      return m
    })
  }, [sessionId, setQuotedSelectionMap])

  const setPreviewFileMap = useSetAtom(previewFileMapAtom)
  const suggestionsMap = useAtomValue(agentPromptSuggestionsAtom)
  const suggestion = suggestionsMap.get(sessionId) ?? null
  const setPromptSuggestions = useSetAtom(agentPromptSuggestionsAtom)
  const setAgentSessions = useSetAtom(agentSessionsAtom)
  const openSession = useOpenSession()
  const setAttachedDirsMap = useSetAtom(agentAttachedDirectoriesMapAtom)
  const attachedDirsMap = useAtomValue(agentAttachedDirectoriesMapAtom)
  const attachedDirs = attachedDirsMap.get(sessionId) ?? []
  const setAttachedFilesMap = useSetAtom(agentAttachedFilesMapAtom)
  const attachedFilesMap = useAtomValue(agentAttachedFilesMapAtom)
  const attachedFiles = attachedFilesMap.get(sessionId) ?? []
  const wsAttachedDirsMap = useAtomValue(workspaceAttachedDirectoriesMapAtom)
  const wsAttachedDirs = currentWorkspaceId ? (wsAttachedDirsMap.get(currentWorkspaceId) ?? []) : []
  const setWsAttachedFilesMap = useSetAtom(workspaceAttachedFilesMapAtom)
  const wsAttachedFilesMap = useAtomValue(workspaceAttachedFilesMapAtom)
  const wsAttachedFiles = currentWorkspaceId
    ? (wsAttachedFilesMap.get(currentWorkspaceId) ?? [])
    : []

  // ===== 消息排队队列状态（定义在 handleSend 之前，供其引用）=====
  const queuedMessages = useAtomValue(agentMessageQueueAtomFamily(sessionId))
  const setQueuedMessages = useSetAtom(agentMessageQueueAtomFamily(sessionId))
  const queuedMessagesRef = React.useRef(queuedMessages)
  queuedMessagesRef.current = queuedMessages

  // 性能优化（2026-07-05）：AgentView 不再订阅 inputContent / inputHtmlContent，
  // 改用 hasDraft（boolean）—— 只在 empty↔non-empty 切换时变化一次，打字时不触发 re-render。
  // 之前每次按键都让 AgentView re-render，3000+ 行组件树（含 AgentMessages / TokenStatsPanel /
  // 工具栏）全部 diff，24 轮长会话卡顿明显。
  // 真正的 inputContent 订阅移到 RichTextInputWrapper 内部，仅输入框自己 re-render。
  const hasDraft = useAtomValue(agentSessionHasDraftAtomFamily(sessionId))
  const setDraftsMap = useSetAtom(agentSessionDraftsAtom)
  const setInputContent = React.useCallback(
    (value: string) => {
      setDraftsMap((prev) => {
        const map = new Map(prev)
        if (value.trim() === '') {
          map.delete(sessionId)
        } else {
          map.set(sessionId, value)
        }
        return map
      })
    },
    [sessionId, setDraftsMap]
  )
  const setDraftHtmlMap = useSetAtom(agentSessionDraftHtmlAtom)
  const setInputHtmlContent = React.useCallback(
    (html: string) => {
      setDraftHtmlMap((prev) => {
        const map = new Map(prev)
        if (!html || html === '<p></p>') {
          map.delete(sessionId)
        } else {
          map.set(sessionId, html)
        }
        return map
      })
    },
    [sessionId, setDraftHtmlMap]
  )
  const sessionPathMap = useAtomValue(agentSessionPathMapAtom)
  const setSessionPathMap = useSetAtom(agentSessionPathMapAtom)
  const sessionPath = sessionPathMap.get(sessionId) ?? null
  const [workspaceFilesPath, setWorkspaceFilesPath] = React.useState<string | null>(null)
  const [isDragOver, setIsDragOver] = React.useState(false)

  // pendingFiles ref（供 addFilesAsAttachments 读取最新列表，避免闭包旧值）
  const pendingFilesRef = React.useRef(pendingFiles)
  React.useEffect(() => {
    pendingFilesRef.current = pendingFiles
  }, [pendingFiles])

  // 渠道已选但会话尚未绑定模型时，写入 per-session map（默认来自渠道配置，不持久化 settings）
  const hasAvailableModel = React.useMemo(() => {
    if (!agentChannelIds || agentChannelIds.length === 0) return false
    return globalChannels.some(
      (c) =>
        c.enabled &&
        agentChannelIds.includes(c.id) &&
        isAgentCompatibleProvider(c.provider) &&
        c.models.some((m) => m.enabled)
    )
  }, [globalChannels, agentChannelIds])

  // ===== 队列消息操作回调（依赖 hasAvailableModel / setInputContent）=====
  /** 构建引用选中文本块（XML） */
  const buildQuotedSelectionBlock = React.useCallback(
    (selection: NonNullable<typeof currentQuotedSelection>): string => {
      const safePath = selection.filePath
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
      const safeText = selection.text.replace(/<\/quoted_file>/gi, '</quoted_file_>')
      return `<quoted_file path="${safePath}">\n${safeText}\n</quoted_file>\n\n`
    },
    [currentQuotedSelection]
  )

  /** 撤回队列消息到输入框 */
  const recallQueuedMessage = React.useCallback(
    (messageId: string): void => {
      const message = queuedMessagesRef.current.find((m) => m.id === messageId)
      if (!message) return
      setQueuedMessages((prev) => removeQueuedMessage(prev, messageId))
      // 直接操作 drafts atom：追加到现有草稿
      store.set(agentSessionDraftsAtom, (prev) => {
        const map = new Map(prev)
        const recall = message.text.trim()
        if (!recall) return map
        const base = (map.get(sessionId) ?? '').trim()
        map.set(sessionId, base ? `${base}\n${recall}` : recall)
        return map
      })
    },
    [setQueuedMessages]
  )

  /** 移除队列消息（不撤回） */
  const removeQueuedMessageFromQueue = React.useCallback(
    (messageId: string): void => {
      setQueuedMessages((prev) => removeQueuedMessage(prev, messageId))
    },
    [setQueuedMessages]
  )

  /** 拖拽重排队列消息 */
  const moveQueuedMessageItem = React.useCallback(
    (sourceId: string, targetId: string, placement: QueueDropPlacement): void => {
      setQueuedMessages((prev) => moveQueuedMessage(prev, sourceId, targetId, placement))
    },
    [setQueuedMessages]
  )

  React.useEffect(() => {
    if (!agentChannelId) return

    const channel = globalChannels.find((c) => c.id === agentChannelId && c.enabled)
    const resolvedModelId = resolveAgentSessionModelId(channel, undefined, legacyGlobalModelId)
    if (!resolvedModelId) return

    setSessionModelMap((prev) => {
      if (prev.has(sessionId)) return prev
      const map = new Map(prev)
      map.set(sessionId, resolvedModelId)
      return map
    })
  }, [agentChannelId, sessionId, globalChannels, legacyGlobalModelId, setSessionModelMap])

  // 获取当前 session 的工作路径（文件浏览器需要）
  React.useEffect(() => {
    if (!currentWorkspaceId) {
      setSessionPathMap((prev) => {
        const map = new Map(prev)
        map.delete(sessionId)
        return map
      })
      return
    }

    window.electronAPI
      .getAgentSessionPath(currentWorkspaceId, sessionId)
      .then((path) => {
        if (path) {
          setSessionPathMap((prev) => {
            const map = new Map(prev)
            map.set(sessionId, path)
            return map
          })
        } else {
          setSessionPathMap((prev) => {
            const map = new Map(prev)
            map.delete(sessionId)
            return map
          })
        }
      })
      .catch(() => {
        setSessionPathMap((prev) => {
          const map = new Map(prev)
          map.delete(sessionId)
          return map
        })
      })
  }, [sessionId, currentWorkspaceId, setSessionPathMap])

  // 获取工作区共享文件目录路径（@ 引用时需要搜索）
  const workspaceSlug = workspaces.find((w) => w.id === currentWorkspaceId)?.slug ?? null
  React.useEffect(() => {
    if (!workspaceSlug) {
      setWorkspaceFilesPath(null)
      return
    }
    window.electronAPI
      .getWorkspaceFilesPath(workspaceSlug)
      .then(setWorkspaceFilesPath)
      .catch(() => setWorkspaceFilesPath(null))
  }, [workspaceSlug])

  // 获取工作区级附加文件（@ 引用和路径解析都需要）
  React.useEffect(() => {
    if (!workspaceSlug || !currentWorkspaceId) return
    window.electronAPI
      .getWorkspaceAttachedFiles(workspaceSlug)
      .then((files) => {
        setWsAttachedFilesMap((prev) => {
          const map = new Map(prev)
          map.set(currentWorkspaceId, files)
          return map
        })
      })
      .catch(console.error)
  }, [workspaceSlug, currentWorkspaceId, setWsAttachedFilesMap])

  // 工作区级目录（workspace shared files + 工作区级附加目录），@ 引用标记为工作区文件
  const currentWorkspace = workspaces.find((w) => w.id === currentWorkspaceId)
  const workspaceDirs = React.useMemo(() => {
    const dirs: string[] = []
    // 项目模式下 cwd 就是项目目录，无需附加 workspace-files/
    if (!currentWorkspace?.projectDirectory && workspaceFilesPath) dirs.push(workspaceFilesPath)
    for (const d of wsAttachedDirs) {
      if (!dirs.includes(d)) dirs.push(d)
    }
    return dirs
  }, [currentWorkspace?.projectDirectory, workspaceFilesPath, wsAttachedDirs])

  const attachedFileDirectories = React.useMemo(() => {
    const dirs: string[] = []
    for (const filePath of [...attachedFiles, ...wsAttachedFiles]) {
      const parent = getFileParentPath(filePath)
      if (parent && !dirs.includes(parent)) dirs.push(parent)
    }
    return dirs
  }, [attachedFiles, wsAttachedFiles])

  const workspaceMentionPaths = React.useMemo(() => {
    const paths = [...workspaceDirs]
    for (const filePath of wsAttachedFiles) {
      if (!paths.includes(filePath)) paths.push(filePath)
    }
    return paths
  }, [workspaceDirs, wsAttachedFiles])

  const sessionMentionPaths = React.useMemo(() => {
    const paths = [...attachedDirs]
    for (const filePath of attachedFiles) {
      if (!paths.includes(filePath)) paths.push(filePath)
    }
    return paths
  }, [attachedDirs, attachedFiles])

  // 合并会话级 + 工作区级附加目录，供消息区文件路径解析使用
  const allAttachedDirs = React.useMemo(() => {
    const dirs = [...attachedDirs]
    for (const d of workspaceDirs) {
      if (d && !dirs.includes(d)) dirs.push(d)
    }
    for (const filePath of [...attachedFiles, ...wsAttachedFiles]) {
      if (filePath && !dirs.includes(filePath)) dirs.push(filePath)
      const parent = getFileParentPath(filePath)
      if (parent && !dirs.includes(parent)) dirs.push(parent)
    }
    return dirs
  }, [attachedDirs, workspaceDirs, attachedFiles, wsAttachedFiles])

  // 监听消息刷新版本号
  const refreshMap = useAtomValue(agentMessageRefreshAtom)
  const refreshVersion = refreshMap.get(sessionId) ?? 0

  // 持久化消息缓存 setter — 仅写入，读取时用 store.get 同步取值避免订阅触发重渲染
  const setMessagesCache = useSetAtom(agentSDKMessagesCacheAtom)
  const appendOptimisticPersistedMessage = React.useCallback(
    (message: SDKMessage) => {
      // 切会话时优先命中内存缓存，因此乐观插入的用户消息也要同步写入缓存，
      // 否则“发送后立刻切走再切回”会短暂回退到旧消息数组。
      const next = [...persistedSDKMessagesRef.current, message]
      persistedSDKMessagesRef.current = next
      setPersistedSDKMessages(next)
      setMessagesCache((prev) => setSessionMessagesCache(prev, sessionId, next))
    },
    [sessionId, setMessagesCache]
  )

  const appendLiveUserMessage = React.useCallback(
    (message: SDKMessage): void => {
      store.set(liveMessagesMapAtom, (prev) => {
        const map = new Map(prev)
        const current = map.get(sessionId) ?? []
        map.set(sessionId, [...current, message])
        return map
      })
    },
    [sessionId, store]
  )

  const removeLiveUserMessage = React.useCallback(
    (messageId: string): void => {
      store.set(liveMessagesMapAtom, (prev) => {
        const map = new Map(prev)
        const current = (map.get(sessionId) ?? []).filter(
          (message) => (message as unknown as { uuid?: string }).uuid !== messageId
        )
        map.set(sessionId, current)
        return map
      })
    },
    [sessionId, store]
  )

  const createQueuedUserMessage = React.useCallback(
    (text: string, uuid: string, createdAt: number): SDKMessage =>
      ({
        type: 'user',
        uuid,
        message: { content: [{ type: 'text', text }] },
        parent_tool_use_id: null,
        _createdAt: createdAt,
        _optimistic: true,
      }) as unknown as SDKMessage,
    []
  )

  /** 当前 turn 已结束时，为队列消息启动一个新的 Agent 运行。 */
  const startQueuedMessageRun = React.useCallback(
    async (
      message: import('@/lib/agent-message-queue').AgentQueuedMessage,
      payload: ReturnType<typeof buildQueuedMessageSendPayload>
    ): Promise<void> => {
      if (!agentChannelId) return

      const startedAt = Date.now()
      const additionalDirectories = new Set(attachedDirs)
      for (const dir of attachedFileDirectories) additionalDirectories.add(dir)
      for (const dir of message.additionalDirectories ?? []) additionalDirectories.add(dir)

      store.set(stoppedByUserSessionsAtom, (prev: Set<string>) => {
        if (!prev.has(sessionId)) return prev
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })
      setAgentStreamErrors((prev) => {
        if (!prev.has(sessionId)) return prev
        const map = new Map(prev)
        map.delete(sessionId)
        return map
      })
      setStreamingStates((prev) => {
        const map = new Map(prev)
        const existing = prev.get(sessionId)
        map.set(sessionId, {
          running: true,
          content: '',
          toolActivities: [],
          model: agentModelId || undefined,
          startedAt,
          inputTokens: existing?.inputTokens,
          contextWindow: existing?.contextWindow,
        })
        return map
      })
      appendOptimisticPersistedMessage(
        createQueuedUserMessage(payload.rawText, message.id, startedAt)
      )

      try {
        await window.electronAPI.sendAgentMessage({
          sessionId,
          userMessage: payload.sdkText,
          channelId: agentChannelId,
          modelId: agentModelId || undefined,
          workspaceId: currentWorkspaceId || undefined,
          startedAt,
          permissionModeOverride: permissionMode,
          ...(additionalDirectories.size > 0 && {
            additionalDirectories: Array.from(additionalDirectories),
          }),
          ...(payload.mentions.mentionedSkills.length > 0 && {
            mentionedSkills: payload.mentions.mentionedSkills,
          }),
          ...(payload.mentions.mentionedMcpServers.length > 0 && {
            mentionedMcpServers: payload.mentions.mentionedMcpServers,
          }),
          ...(payload.mentions.mentionedSessionIds.length > 0 && {
            mentionedSessionIds: payload.mentions.mentionedSessionIds,
          }),
        })
      } catch (error) {
        setStreamingStates((prev) => {
          const current = prev.get(sessionId)
          if (!current) return prev
          const map = new Map(prev)
          map.set(sessionId, { ...current, running: false })
          return map
        })
        throw error
      }
    },
    [
      agentChannelId,
      agentModelId,
      appendOptimisticPersistedMessage,
      attachedDirs,
      attachedFileDirectories,
      createQueuedUserMessage,
      currentWorkspaceId,
      permissionMode,
      sessionId,
      setAgentStreamErrors,
      setStreamingStates,
      store,
    ]
  )

  /**
   * 发送一条队列消息：
   * - 当前仍有活跃通道：追加到通道；运行中时软中断，后台等待时直接注入。
   * - 当前 turn 已结束：启动新的 Agent 运行。
   */
  const sendQueuedMessage = React.useCallback(
    async (message: import('@/lib/agent-message-queue').AgentQueuedMessage): Promise<void> => {
      const quotedSelectionBlock = message.quotedSelection
        ? buildQuotedSelectionBlock(message.quotedSelection)
        : ''
      const payload = buildQueuedMessageSendPayload(message, quotedSelectionBlock)
      if (!payload.rawText || !agentChannelId || !hasAvailableModel) return

      const activeState = store.get(agentStreamingStatesAtom).get(sessionId)
      const isRunning = activeState?.running ?? false
      const isBackgroundWaiting = activeState?.backgroundWaiting ?? false
      if (!isRunning && !isBackgroundWaiting) {
        await startQueuedMessageRun(message, payload)
        return
      }

      const liveMessage = createQueuedUserMessage(payload.rawText, message.id, Date.now())
      appendLiveUserMessage(liveMessage)
      try {
        await window.electronAPI.queueAgentMessage({
          sessionId,
          userMessage: payload.sdkText,
          uuid: message.id,
          interrupt: isRunning,
        })
      } catch (error) {
        removeLiveUserMessage(message.id)
        throw error
      }
    },
    [
      agentChannelId,
      appendLiveUserMessage,
      buildQuotedSelectionBlock,
      createQueuedUserMessage,
      hasAvailableModel,
      removeLiveUserMessage,
      sessionId,
      startQueuedMessageRun,
      store,
    ]
  )

  const queuedSendInFlightRef = React.useRef(false)
  const sendingQueuedMessageIdsRef = React.useRef<Set<string>>(new Set())

  /** 用户点击“立即发送”：运行中软中断，已结束则直接启动下一轮。 */
  const sendQueuedMessageNow = React.useCallback(
    (messageId: string): void => {
      if (queuedSendInFlightRef.current || sendingQueuedMessageIdsRef.current.has(messageId)) return
      const message = queuedMessagesRef.current.find((item) => item.id === messageId)
      if (!message) return

      queuedSendInFlightRef.current = true
      sendingQueuedMessageIdsRef.current.add(messageId)
      setQueuedMessages((prev) => removeQueuedMessage(prev, messageId))
      sendQueuedMessage(message)
        .catch((error) => {
          console.error('[AgentView] 队列消息发送失败:', error)
          toast.error('队列消息发送失败', { description: String(error) })
          setQueuedMessages((prev) => restoreQueuedMessageToFront(prev, message))
        })
        .finally(() => {
          sendingQueuedMessageIdsRef.current.delete(messageId)
          queuedSendInFlightRef.current = false
        })
    },
    [sendQueuedMessage, setQueuedMessages]
  )

  // 消息是否已完成首次加载（用于 auto-send 等待）
  const [messagesLoaded, setMessagesLoaded] = React.useState(false)
  const loadingSessionIdRef = React.useRef<string | null>(null)

  // 加载当前会话消息
  React.useEffect(() => {
    // 只有切换会话时才进入 loading 态；同一会话在流式完成后的刷新要保留当前
    // persisted/live 消息，避免“助手气泡先消失、持久化消息再恢复”的空窗跳动。
    const isSessionSwitch = loadingSessionIdRef.current !== sessionId
    if (isSessionSwitch) {
      loadingSessionIdRef.current = sessionId
      // 命中缓存则立即填充，消除「先清空 → 等 IPC 全量读盘」的可见空窗；
      // IPC 返回后仍会以最新数据覆盖。未命中才回退到清空 + loading 态。
      // 注意：refreshVersion bump（流结束/出错/rewind）不是会话切换，
      // 走 else 分支保留当前消息，并在下方 IPC 覆盖时获得最新数据。
      const cached = store.get(agentSDKMessagesCacheAtom).get(sessionId)
      if (cached) {
        setPersistedSDKMessages(cached)
        setMessagesLoaded(true)
      } else {
        setPersistedSDKMessages([])
        setMessagesLoaded(false)
      }
    }
    let cancelled = false
    window.electronAPI
      .getAgentSessionSDKMessages(sessionId)
      .then((sdkMsgs) => {
        if (cancelled) return
        unstable_batchedUpdates(() => {
          const streamingState = store.get(agentStreamingStatesAtom).get(sessionId)
          // running / backgroundWaiting 期间保留尚未落盘的乐观用户气泡，避免被磁盘快照刷掉
          const preserveOptimistic = !!(
            streamingState?.running || streamingState?.backgroundWaiting
          )
          const reconciled = reconcilePersistedMessagesOnReload({
            diskMessages: sdkMsgs,
            localMessages: persistedSDKMessagesRef.current,
            preserveOptimistic,
          })
          persistedSDKMessagesRef.current = reconciled
          setPersistedSDKMessages(reconciled)
          // 写入缓存（含 LRU 淘汰，防止会话数增长导致内存无限膨胀）
          setMessagesCache((prev) => setSessionMessagesCache(prev, sessionId, reconciled))
          setMessagesLoaded(true)

          // 消息加载完成后，同步清除流式展示状态和实时消息，
          // 确保 React 在一次渲染中同时显示持久化消息并移除流式气泡/实时消息，
          // 避免「实时消息已清 → 持久化消息未到」的空档闪烁
          // 注意：保留 inputTokens/contextWindow 以维持上下文用量圆环显示
          setStreamingStates((prev) => {
            const state = prev.get(sessionId)
            if (!state || state.running || state.backgroundWaiting) return prev
            const map = new Map(prev)
            if (state.inputTokens !== undefined) {
              // 保留 usage 数据，仅清除流式展示字段
              map.set(sessionId, {
                running: false,
                content: '',
                toolActivities: [],
                inputTokens: state.inputTokens,
                outputTokens: state.outputTokens,
                cacheReadTokens: state.cacheReadTokens,
                cacheCreationTokens: state.cacheCreationTokens,
                contextWindow: state.contextWindow,
                model: state.model,
              })
            } else {
              map.delete(sessionId)
            }
            return map
          })
          setLiveMessagesMap((prev) => {
            if (!prev.has(sessionId)) return prev
            // 仍在运行/后台等待中，不清除实时消息（与 streamingStates 保护逻辑一致）
            const latestStreamingState = store.get(agentStreamingStatesAtom).get(sessionId)
            if (latestStreamingState?.running || latestStreamingState?.backgroundWaiting) {
              return prev
            }
            const map = new Map(prev)
            map.delete(sessionId)
            return map
          })
        })
      })
      .catch((error) => {
        if (cancelled) return
        console.error(error)
        setMessagesLoaded(true)
      })

    // 加载会话 Token 统计（底栏累计计费）与 Context 占用（最后一轮，非累计）
    window.electronAPI
      .getSessionTokenStats(sessionId)
      .then((stats) => {
        if (cancelled) return
        store.set(sessionTokenStatsAtom, (prev) => {
          const map = new Map(prev)
          map.set(sessionId, stats)
          return map
        })
      })
      .catch((error) => {
        console.warn('[AgentView] 加载 Token 统计失败:', error)
      })

    window.electronAPI
      .getSessionContextStatus(sessionId)
      .then((contextStatus) => {
        if (cancelled || !contextStatus) return
        setStreamingStates((prev) => {
          const state = prev.get(sessionId)
          if (state?.inputTokens !== undefined || state?.running) return prev
          if (contextStatus.inputTokens <= 0) return prev
          const map = new Map(prev)
          map.set(sessionId, {
            running: false,
            content: '',
            toolActivities: [],
            inputTokens: contextStatus.inputTokens,
            outputTokens: contextStatus.outputTokens,
            cacheReadTokens: contextStatus.cacheReadTokens,
            cacheCreationTokens: contextStatus.cacheCreationTokens,
            contextWindow: contextStatus.contextWindow,
            usageUpdatedAt: Date.now(),
          })
          return map
        })
      })
      .catch((error) => {
        console.warn('[AgentView] 加载 Context 占用失败:', error)
      })

    return () => {
      cancelled = true
    }
  }, [sessionId, refreshVersion, setStreamingStates, setLiveMessagesMap, setMessagesCache, store])

  // 从会话元数据初始化附加目录（仅冷启动水合，后续由 handleAttachFolder 等实时写入）
  React.useEffect(() => {
    const meta = sessions.find((s) => s.id === sessionId)
    const dirs = meta?.attachedDirectories ?? []
    setAttachedDirsMap((prev) => {
      const existing = prev.get(sessionId)
      if (existing != null) return prev
      const map = new Map(prev)
      if (dirs.length > 0) {
        map.set(sessionId, dirs)
      }
      return map
    })
  }, [sessionId, sessions, setAttachedDirsMap])

  // 从会话元数据初始化附加文件（仅冷启动水合，后续由 attachFile/detachFile 实时写入）
  React.useEffect(() => {
    const meta = sessions.find((s) => s.id === sessionId)
    const files = meta?.attachedFiles ?? []
    setAttachedFilesMap((prev) => {
      const existing = prev.get(sessionId)
      if (existing != null) return prev
      const map = new Map(prev)
      if (files.length > 0) {
        map.set(sessionId, files)
      }
      return map
    })
  }, [sessionId, sessions, setAttachedFilesMap])

  // 自动发送 pending prompt（从快速任务窗口或设置页触发）
  // 等待 messagesLoaded 确保消息加载完成后再插入乐观消息，避免被加载结果覆盖。
  // 使用 queueMicrotask 延迟发送：避免 setState → 重渲染 → cleanup 取消 timer 的竞态。
  React.useEffect(() => {
    if (!messagesLoaded) return
    if (!pendingPrompt) return
    if (pendingPrompt.sessionId !== sessionId) return
    if (streaming) return

    const resolvedChannelId = pendingPrompt.channelId ?? agentChannelId
    const resolvedModelId = pendingPrompt.modelId ?? agentModelId
    const resolvedWorkspaceId = pendingPrompt.workspaceId ?? currentWorkspaceId ?? undefined

    // 新会话需等渠道 / 模型就绪，避免 orchestrator 回退 DEFAULT_MODEL_ID 导致 SDK 异常退出
    if (!resolvedChannelId || !resolvedModelId) return

    // 快照当前上下文
    const snapshot = {
      message: pendingPrompt.message,
      channelId: resolvedChannelId,
      modelId: resolvedModelId,
      workspaceId: resolvedWorkspaceId,
      additionalDirectories: Array.from(
        new Set([
          ...attachedDirs,
          ...attachedFileDirectories,
          ...(pendingPrompt.additionalDirectories ?? []),
        ])
      ),
    }
    setPendingPrompt(null)

    queueMicrotask(() => {
      // 初始化流式状态（startedAt 由渲染进程生成，传递给主进程原样回传，确保竞态保护使用同一个值）
      const streamStartedAt = Date.now()
      setStreamingStates((prev) => {
        const map = new Map(prev)
        const existing = prev.get(sessionId)
        map.set(sessionId, {
          running: true,
          content: '',
          toolActivities: [],
          model: snapshot.modelId,
          startedAt: streamStartedAt,
          inputTokens: existing?.inputTokens,
          contextWindow: existing?.contextWindow,
        })
        return map
      })

      // 乐观更新：SDKMessage 格式（Phase 4）
      const tempUserSDKMsg: SDKMessage = {
        type: 'user',
        uuid: crypto.randomUUID(),
        message: {
          content: [{ type: 'text', text: snapshot.message }],
        },
        parent_tool_use_id: null,
        _createdAt: Date.now(),
        _optimistic: true,
      } as unknown as SDKMessage
      appendOptimisticPersistedMessage(tempUserSDKMsg)

      // 发送消息
      const input: AgentSendInput = {
        sessionId,
        userMessage: snapshot.message,
        channelId: snapshot.channelId,
        modelId: snapshot.modelId,
        workspaceId: snapshot.workspaceId,
        startedAt: streamStartedAt,
        permissionModeOverride: permissionMode,
        ...(snapshot.additionalDirectories &&
          snapshot.additionalDirectories.length > 0 && {
            additionalDirectories: snapshot.additionalDirectories,
          }),
      }
      window.electronAPI.sendAgentMessage(input).catch((error) => {
        console.error('[AgentView] 自动发送配置消息失败:', error)
        setStreamingStates((prev) => {
          const current = prev.get(sessionId)
          if (!current) return prev
          const map = new Map(prev)
          map.set(sessionId, { ...current, running: false })
          return map
        })
      })
    })
  }, [
    messagesLoaded,
    pendingPrompt,
    sessionId,
    agentChannelId,
    agentModelId,
    currentWorkspaceId,
    streaming,
    setPendingPrompt,
    setStreamingStates,
    permissionMode,
    attachedDirs,
    attachedFileDirectories,
  ])
  // ===== 附件处理 =====

  /** 为文件生成唯一文件名（避免粘贴多张图片时文件名重复导致覆盖） */
  const makeUniqueFilename = React.useCallback(
    (originalName: string, existingNames: string[]): string => {
      return makeUniqueAttachmentName(originalName, existingNames)
    },
    []
  )

  const attachSessionFile = React.useCallback(
    async (filePath: string): Promise<void> => {
      const updated = await window.electronAPI.attachFile({ sessionId, filePath })
      setAttachedFilesMap((prev) => {
        const map = new Map(prev)
        map.set(sessionId, updated)
        return map
      })
    },
    [sessionId, setAttachedFilesMap]
  )

  /** 将 File 对象列表添加为待发送附件 */
  const addFilesAsAttachments = React.useCallback(
    async (files: File[], sourcePaths?: Map<File, string>): Promise<void> => {
      // 收集已有的 pending 文件名，用于去重
      const usedNames: string[] = pendingFilesRef.current.map((f) => f.filename)

      const pathBackedFiles: string[] = []
      const rejectedLargeFiles: string[] = []

      for (const file of files) {
        try {
          if (file.size > MAX_ATTACHMENT_SIZE) {
            const sourcePath = sourcePaths?.get(file)
            if (!sourcePath) {
              rejectedLargeFiles.push(file.name)
              continue
            }
            await attachSessionFile(sourcePath)

            const previewUrl = file.type.startsWith('image/')
              ? URL.createObjectURL(file)
              : undefined
            const uniqueFilename = makeUniqueFilename(file.name, usedNames)
            usedNames.push(uniqueFilename)

            const pending: AgentPendingFile = {
              id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              filename: uniqueFilename,
              mediaType: file.type || 'application/octet-stream',
              size: file.size,
              previewUrl,
              sourcePath,
            }

            setPendingFiles((prev) => [...prev, pending])
            pathBackedFiles.push(uniqueFilename)
            continue
          }

          const base64 = await fileToBase64(file)
          const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
          const uniqueFilename = makeUniqueFilename(file.name, usedNames)
          usedNames.push(uniqueFilename)

          const pending: AgentPendingFile = {
            id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            filename: uniqueFilename,
            mediaType: file.type || 'application/octet-stream',
            size: file.size,
            previewUrl,
          }

          if (!window.__pendingAgentFileData) {
            window.__pendingAgentFileData = new Map<string, string>()
          }
          window.__pendingAgentFileData.set(pending.id, base64)

          setPendingFiles((prev) => [...prev, pending])
        } catch (error) {
          console.error('[AgentView] 添加附件失败:', error)
        }
      }

      if (pathBackedFiles.length > 0) {
        toast.success(`已将大文件作为附加文件引用：${formatFileNames(pathBackedFiles)}`)
      }
      if (rejectedLargeFiles.length > 0) {
        toast.error(
          `以下文件超过 100MB 且无法取得本地路径，已跳过：${formatFileNames(rejectedLargeFiles)}`
        )
      }
    },
    [attachSessionFile, makeUniqueFilename, setPendingFiles]
  )

  const addLargeDialogFilesAsReferences = React.useCallback(
    async (files: FileDialogLargeFile[]): Promise<void> => {
      if (files.length === 0) return
      const usedNames: string[] = pendingFilesRef.current.map((f) => f.filename)
      const added: string[] = []
      const rejected: string[] = []

      for (const file of files) {
        try {
          await attachSessionFile(file.path)
          const uniqueFilename = makeUniqueFilename(file.filename, usedNames)
          usedNames.push(uniqueFilename)

          const pending: AgentPendingFile = {
            id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            filename: uniqueFilename,
            mediaType: file.mediaType,
            size: file.size,
            sourcePath: file.path,
          }

          setPendingFiles((prev) => [...prev, pending])
          added.push(uniqueFilename)
        } catch (error) {
          console.error('[AgentView] 附加大文件失败:', error)
          rejected.push(file.filename)
        }
      }

      if (added.length > 0) {
        toast.success(`已将大文件作为附加文件引用：${formatFileNames(added)}`)
      }
      if (rejected.length > 0) {
        toast.error(`以下文件附加失败，已跳过：${formatFileNames(rejected)}`)
      }
    },
    [attachSessionFile, makeUniqueFilename, setPendingFiles]
  )

  /** 打开文件选择对话框 */
  const handleOpenFileDialog = React.useCallback(async (): Promise<void> => {
    try {
      const result = await window.electronAPI.openFileDialog()
      const largeFiles = result.largeFiles ?? []
      const skippedFiles = result.skippedFiles ?? []
      if (result.files.length === 0 && largeFiles.length === 0 && skippedFiles.length === 0) return

      const oversized: string[] = []

      for (const fileInfo of result.files) {
        if (fileInfo.size > MAX_ATTACHMENT_SIZE) {
          oversized.push(fileInfo.filename)
          continue
        }
        const previewUrl = fileInfo.mediaType.startsWith('image/')
          ? `data:${fileInfo.mediaType};base64,${fileInfo.data}`
          : undefined

        const pending: AgentPendingFile = {
          id: `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          filename: fileInfo.filename,
          mediaType: fileInfo.mediaType,
          size: fileInfo.size,
          previewUrl,
        }

        if (!window.__pendingAgentFileData) {
          window.__pendingAgentFileData = new Map<string, string>()
        }
        window.__pendingAgentFileData.set(pending.id, fileInfo.data)

        setPendingFiles((prev) => [...prev, pending])
      }

      if (oversized.length > 0) {
        toast.error(`以下文件超过 100MB 且无法取得本地路径，已跳过：${formatFileNames(oversized)}`)
      }
      await addLargeDialogFilesAsReferences(largeFiles)
      if (skippedFiles.length > 0) {
        toast.warning(
          `以下文件无法读取，已跳过：${formatFileNames(skippedFiles.map((f) => f.filename))}`
        )
      }
    } catch (error) {
      console.error('[AgentView] 文件选择对话框失败:', error)
    }
  }, [addLargeDialogFilesAsReferences, setPendingFiles])

  /** 附加文件夹（不复制，仅记录路径） */
  const handleAttachFolder = React.useCallback(async (): Promise<void> => {
    try {
      const result = await window.electronAPI.openFolderDialog()
      if (!result) return

      const updated = await window.electronAPI.attachDirectory({
        sessionId,
        directoryPath: result.path,
      })

      setAttachedDirsMap((prev) => {
        const map = new Map(prev)
        map.set(sessionId, updated)
        return map
      })

      toast.success(`已附加目录: ${result.name}`)
    } catch (error) {
      console.error('[AgentView] 附加文件夹失败:', error)
      toast.error('附加文件夹失败')
    }
  }, [sessionId, setAttachedDirsMap])

  /** 语音输入 */
  const handleSpeech = React.useCallback(async (): Promise<void> => {
    try {
      const settings = await window.electronAPI.getVoiceDictationSettings()
      if (!settings.enabled) {
        toast.info('请先在设置中打开语音输入开关')
        return
      }
      await window.electronAPI.toggleVoiceDictation()
    } catch (error) {
      console.error('[AgentView] 唤起语音输入失败:', error)
      toast.error('唤起语音输入失败')
    }
  }, [])

  /** 移除待发送文件 */
  const handleRemoveFile = React.useCallback(
    (id: string): void => {
      setPendingFiles((prev) => {
        const file = prev.find((f) => f.id === id)
        if (file?.previewUrl?.startsWith('blob:')) {
          URL.revokeObjectURL(file.previewUrl)
        }
        window.__pendingAgentFileData?.delete(id)
        return prev.filter((f) => f.id !== id)
      })
    },
    [setPendingFiles]
  )

  const openClipboardPreviewFile = React.useCallback(
    (filePath: string): void => {
      const parentPath = getFileParentPath(filePath)
      openPreview(store, sessionId, {
        filePath,
        previewOnly: true,
        readOnly: false,
        basePaths: parentPath ? [parentPath] : undefined,
      })
    },
    [sessionId, store]
  )

  /** 点击 clipboard 附件时，在当前会话的临时预览标签页中显示内容 */
  const handleClipboardPreview = React.useCallback(
    async (file: AgentPendingFile) => {
      if (file.sourcePath) {
        openClipboardPreviewFile(file.sourcePath)
        return
      }

      const base64 = window.__pendingAgentFileData?.get(file.id)
      if (!base64) return

      try {
        // atob 解码得到二进制字符串，需用 TextDecoder 正确还原 UTF-8 文本
        const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        const text = new TextDecoder('utf-8').decode(bytes)
        const tmpPath = await window.electronAPI.writeClipboardPreview(file.filename, text)
        setPendingFiles((prev) =>
          prev.map((item) =>
            item.id === file.id ? { ...item, sourcePath: tmpPath, isClipboardDraft: true } : item
          )
        )
        window.__pendingAgentFileData?.delete(file.id)
        openClipboardPreviewFile(tmpPath)
      } catch (error) {
        console.error('[AgentView] clipboard 预览写入失败:', error)
      }
    },
    [openClipboardPreviewFile, setPendingFiles]
  )

  const addClipboardTextDraft = React.useCallback(
    async (text: string): Promise<AgentPendingFile> => {
      const draft = createClipboardTextDraft(
        text,
        pendingFilesRef.current.map((f) => f.filename)
      )
      const tmpPath = await window.electronAPI.writeClipboardPreview(draft.filename, text)
      const pending = createClipboardPendingFile(
        draft,
        tmpPath,
        `pending-${Date.now()}-${Math.random().toString(36).slice(2)}`
      )
      setPendingFiles((prev) => {
        const next = [...prev, pending]
        pendingFilesRef.current = next
        return next
      })
      return pending
    },
    [setPendingFiles]
  )

  /** 粘贴文件处理 */
  const handlePasteFiles = React.useCallback(
    (files: File[]): void => {
      addFilesAsAttachments(files)
    },
    [addFilesAsAttachments]
  )

  /** 粘贴超长文本时转为待发送附件，避免把大段内容直接塞进输入框 */
  const handlePasteLongText = React.useCallback(
    (text: string): void => {
      addClipboardTextDraft(text)
        .then((file) => {
          toast.success('已将超长文本转为附件', {
            description: `${file.filename}，点击附件可预览编辑。`,
          })
        })
        .catch((error) => {
          console.error('[AgentView] 超长文本转附件失败:', error)
          toast.error('超长文本转附件失败')
        })
    },
    [addClipboardTextDraft]
  )

  /** 拖放处理 */
  const handleDragOver = React.useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = React.useCallback((e: React.DragEvent): void => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = React.useCallback(
    async (e: React.DragEvent): Promise<void> => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const droppedFiles = Array.from(e.dataTransfer.files)
      if (droppedFiles.length === 0) return

      // 通过 preload 的 webUtils.getPathForFile 获取真实路径
      const pathMap = new Map<string, File>()
      const paths: string[] = []
      for (const f of droppedFiles) {
        try {
          const p = window.electronAPI.getPathForFile(f)
          if (p) {
            paths.push(p)
            pathMap.set(p, f)
          }
        } catch {
          /* 无法获取路径时忽略 */
        }
      }

      if (paths.length > 0) {
        try {
          // 通过主进程检测目录 vs 文件
          const { directories, files: filePaths } = await window.electronAPI.checkPathsType(paths)

          // 拖拽的文件夹直接附加
          for (const dirPath of directories) {
            try {
              const updated = await window.electronAPI.attachDirectory({
                sessionId,
                directoryPath: dirPath,
              })
              setAttachedDirsMap((prev) => {
                const map = new Map(prev)
                map.set(sessionId, updated)
                return map
              })
              const dirName = dirPath.split('/').pop() || dirPath
              toast.success(`已附加目录: ${dirName}`)
            } catch (error) {
              console.error('[AgentView] 拖拽附加文件夹失败:', error)
            }
          }

          // 普通文件作为附件
          const regularFiles = filePaths.map((p) => pathMap.get(p)!).filter(Boolean)
          if (regularFiles.length > 0) {
            const fileSourcePaths = new Map<File, string>()
            for (const path of filePaths) {
              const file = pathMap.get(path)
              if (file) fileSourcePaths.set(file, path)
            }
            addFilesAsAttachments(regularFiles, fileSourcePaths)
          }
        } catch (error) {
          console.error('[AgentView] 路径检测失败，回退处理:', error)
          addFilesAsAttachments(droppedFiles)
        }
      } else {
        // 无路径信息：回退，所有项按普通文件处理
        addFilesAsAttachments(droppedFiles)
      }
    },
    [sessionId, addFilesAsAttachments, setAttachedDirsMap]
  )

  /** ModelSelector 选择回调 */
  const handleModelSelect = React.useCallback(
    (option: ModelOption): void => {
      // 跨渠道切换时提示上下文丢失
      const currentChannelId = sessionChannelMap.get(sessionId)
      if (currentChannelId && currentChannelId !== option.channelId) {
        const hasMessages = (store.get(askMessagesMapAtom).get(sessionId) ?? []).length > 0
        if (hasMessages) {
          toast.info('切换渠道后 Agent 将丢失之前的操作上下文，如需保留完整记忆请新建会话')
        }
      }

      // 仅更新当前会话的 per-session 配置，不影响其他会话
      setSessionChannelMap((prev) => {
        const map = new Map(prev)
        map.set(sessionId, option.channelId)
        return map
      })
      setSessionModelMap((prev) => {
        const map = new Map(prev)
        map.set(sessionId, option.modelId)
        return map
      })

      // 持久化到 session meta，防止组件重挂载丢失选择
      window.electronAPI
        .updateAgentSessionMeta(sessionId, { channelId: option.channelId, modelId: option.modelId })
        .catch(console.error)

      // 自动将选中的渠道加入 Agent 可用渠道白名单
      const updatedChannelIds = agentChannelIds.includes(option.channelId)
        ? agentChannelIds
        : [...agentChannelIds, option.channelId]
      if (updatedChannelIds !== agentChannelIds) {
        setAgentChannelIds(updatedChannelIds)
      }

      // 持久化白名单（不持久化全局默认渠道/模型，各会话独立）
      window.electronAPI
        .updateSettings({
          agentChannelIds: updatedChannelIds,
        })
        .catch(console.error)
    },
    [sessionId, setSessionChannelMap, setSessionModelMap, agentChannelIds, setAgentChannelIds]
  )

  // 渠道互斥：会话锁定到初始渠道类型（kscc 或外部）
  const lockedProvider = React.useMemo(() => {
    if (!agentChannelId) return undefined
    // 仅在会话已有消息时锁定渠道类型，新会话允许自由选择
    const sessionHasMessages = persistedSDKMessages.length > 0
    if (!sessionHasMessages) return undefined
    const ch = globalChannels.find((c) => c.id === agentChannelId)
    if (!ch) return undefined
    return ch.provider === 'kscc-internal' ? 'kscc-internal' : 'external'
  }, [agentChannelId, globalChannels, persistedSDKMessages.length])

  /** 构建 externalSelectedModel 给 ModelSelector */
  const externalSelectedModel = React.useMemo(() => {
    if (!agentChannelId || !agentModelId) return null
    return { channelId: agentChannelId, modelId: agentModelId }
  }, [agentChannelId, agentModelId])

  // Design Preview 上下文增强：在用户消息末尾附加当前画布的 HTML/CSS/框选信息
  const { augment: augmentWithDesignContext } = useDesignContextAugment()

  // Design Preview 语义检测：识别用户的 UI 设计意图
  const setDesignSuggestion = useSetAtom(designSuggestionAtom)
  const designEnabled = useAtomValue(designEnabledAtom)
  const draftText = useAtomValue(agentSessionDraftAtomFamily(sessionId))
  React.useEffect(() => {
    if (designEnabled) return
    if (!draftText || draftText.trim().length < 3) {
      setDesignSuggestion(null)
      return
    }
    const result = detectUIIntent(draftText)
    setDesignSuggestion(result.detected ? result : null)
  }, [draftText, designEnabled, setDesignSuggestion])

  /** 发送消息 */
  const handleSend = React.useCallback(
    async (submitOpts?: { shiftKey?: boolean; overrideText?: string }): Promise<void> => {
      // 决策 #15：Shift+Enter = 打断当前 turn 立即注入；纯 Enter = 排队等当前 turn 完成
      const wantsInterrupt = submitOpts?.shiftKey ?? false
      const overrideText = submitOpts?.overrideText
      // 性能优化：不从闭包读 inputContent（会让 handleSend 依赖 inputContent 每键重建），
      // 改用 store.get 实时读 atomFamily。handleSend 不再依赖 inputContent，引用稳定。
      const currentDraft = overrideText ?? store.get(agentSessionDraftAtomFamily(sessionId))
      const text = currentDraft.trim()

      // /btw 侧面提问检测
      if (text.startsWith('/btw ') || text === '/btw') {
        const btwQuestion = text.startsWith('/btw ') ? text.slice(5).trim() : ''
        if (!btwQuestion) {
          toast.info('请在 /btw 后输入问题', { description: '例如：/btw 什么是 PBR 材质？' })
          return
        }
        if (!agentChannelId || !hasAvailableModel) {
          toast.warning('请先配置 API 渠道')
          return
        }
        // 打开侧面提问面板
        store.set(btwOpenAtom, true)
        store.set(btwChannelIdAtom, agentChannelId)
        store.set(btwModelIdAtom, agentModelId || null)
        // 写入父会话 ID，主进程会拉主会话最近 20 轮作为 LLM history
        store.set(btwSourceSessionIdAtom, sessionId)
        // 自动发送第一条消息
        const userMsg = {
          id: crypto.randomUUID(),
          role: 'user' as const,
          content: btwQuestion,
          createdAt: Date.now(),
        }
        const assistantMsg = {
          id: crypto.randomUUID(),
          role: 'assistant' as const,
          content: '',
          createdAt: Date.now(),
          streaming: true,
        }
        store.set(btwMessagesAtom, [userMsg, assistantMsg])
        store.set(btwStreamingAtom, true)
        setInputContent('')
        setInputHtmlContent('')
        window.electronAPI
          .sendBtwMessage({
            channelId: agentChannelId,
            modelId: agentModelId || '',
            message: btwQuestion,
            messageId: assistantMsg.id,
            sourceSessionId: sessionId,
          })
          .catch((err) => {
            console.error('[AgentView] BTW 发送失败:', err)
            store.set(btwMessagesAtom, (prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, streaming: false, content: '发送失败' } : m
              )
            )
            store.set(btwStreamingAtom, false)
          })
        return
      }

      // ===== Ask 档位分支 =====
      // Composer 档位 = ask：路由到 ask-service，不写 SDK JSONL
      if (composerMode === 'ask') {
        if (!messagesLoaded || !text || !agentChannelId || !hasAvailableModel) return

        // Ask 模式暂不支持附件（P1 完善）
        if (pendingFilesRef.current.length > 0) {
          toast.info('Ask 档位暂不支持附件', {
            description: '请先移除附件，或切到 Agent 档位发送',
          })
          return
        }

        // 启发式检测：消息看起来需要 Agent 才能完成 → 弹确认框
        if (isLikelyAgentIntent(text)) {
          setHeuristicDialog({ open: true, pendingText: text })
          return
        }

        // 无启发式命中 → 直接走 Ask 发送
        void performAskSend(text)
        return
      }
      // ===== /Ask 档位分支 =====

      // 如果输入为空但有建议，使用建议内容
      const effectiveText = text || suggestion || ''
      const pendingFilesSnapshot = pendingFilesRef.current
      if (
        !messagesLoaded ||
        (!effectiveText && pendingFilesSnapshot.length === 0) ||
        !agentChannelId ||
        !hasAvailableModel
      )
        return
      const additionalDirectoriesForRun = new Set(attachedDirs)
      for (const dir of attachedFileDirectories) {
        additionalDirectoriesForRun.add(dir)
      }

      // Agent 正在输出：默认只加入渲染层队列，不进入消息流，也不打断当前 turn。
      if (streaming) {
        // 流式追加时不处理附件（仅支持纯文本）
        if (pendingFilesSnapshot.length > 0) {
          toast.info('Agent 运行中暂不支持追加发送附件', {
            description: '请等待完成后再发送附件，或先撤除附件仅发送文本',
          })
          return
        }

        const localUuid = crypto.randomUUID()
        const quotedSelection = store.get(quotedSelectionMapAtom).get(sessionId)
        if (quotedSelection) {
          store.set(quotedSelectionMapAtom, (prev) => {
            const map = new Map(prev)
            map.delete(sessionId)
            return map
          })
        }
        const queuedMessage = createAgentQueuedMessage(
          effectiveText,
          localUuid,
          Date.now(),
          quotedSelection
        )

        // 清空输入框（仅发送用户自己输入的内容，点推荐条时保留草稿）
        if (overrideText === undefined) {
          setInputContent('')
          setInputHtmlContent('')
        }
        setPromptSuggestions((prev) => {
          if (!prev.has(sessionId)) return prev
          const map = new Map(prev)
          map.delete(sessionId)
          return map
        })

        if (wantsInterrupt) {
          // 若上层显式要求立即发送，直接走活跃通道，不依赖队列 state 查找。
          void sendQueuedMessage(queuedMessage).catch((error) => {
            console.error('[AgentView] 立即发送失败:', error)
            toast.error('立即发送失败', { description: String(error) })
            setQueuedMessages((prev) => restoreQueuedMessageToFront(prev, queuedMessage))
          })
        } else {
          setQueuedMessages((prev) => [...prev, queuedMessage])
        }
        return
      }

      // 后台等待属于软空闲：通道仍在，但没有当前输出，直接注入且不软中断。
      if (streamState?.backgroundWaiting) {
        if (pendingFilesSnapshot.length > 0) {
          toast.info('Agent 后台等待时暂不支持追加发送附件', {
            description: '请先撤除附件仅发送文本，或停止当前会话后重新发送',
          })
          return
        }
        const quotedSelection = store.get(quotedSelectionMapAtom).get(sessionId)
        if (quotedSelection) {
          store.set(quotedSelectionMapAtom, (prev) => {
            const map = new Map(prev)
            map.delete(sessionId)
            return map
          })
        }
        const queuedMessage = createAgentQueuedMessage(
          effectiveText,
          crypto.randomUUID(),
          Date.now(),
          quotedSelection
        )
        if (overrideText === undefined) {
          setInputContent('')
          setInputHtmlContent('')
        }
        void sendQueuedMessage(queuedMessage).catch((error) => {
          console.error('[AgentView] 后台续发失败:', error)
          toast.error('追加消息失败', { description: String(error) })
          setQueuedMessages((prev) => restoreQueuedMessageToFront(prev, queuedMessage))
        })
        return
      }

      // 清除当前会话的错误消息
      setAgentStreamErrors((prev) => {
        if (!prev.has(sessionId)) return prev
        const map = new Map(prev)
        map.delete(sessionId)
        return map
      })

      // 清除当前会话的提示建议
      setPromptSuggestions((prev) => {
        if (!prev.has(sessionId)) return prev
        const map = new Map(prev)
        map.delete(sessionId)
        return map
      })

      // 1. 如果有 pending 文件，先保存到 session 目录
      let fileReferences = ''
      if (pendingFilesSnapshot.length > 0) {
        const workspace = workspaces.find((w) => w.id === currentWorkspaceId)
        if (!workspace) {
          toast.warning('暂时无法发送附件', {
            description:
              '当前 Agent 会话没有绑定有效工作区。请在顶部选择工作区，或新建 Agent 会话后重新上传。',
          })
          return
        }

        // 区分三类：
        // - 剪贴板临时草稿（isClipboardDraft）：sourcePath 指向 os.tmpdir，可能被系统清理，
        //   需读取最新内容（含预览面板 autosave 的编辑）拷贝进 session 目录持久化
        // - 侧面板真实文件（仅 sourcePath）：原地引用，不复制
        // - 新上传文件（无 sourcePath）：从内存数据保存到 session 目录
        const existingFiles = pendingFilesSnapshot.filter(
          (f) => f.sourcePath && !f.isClipboardDraft
        )
        const clipboardDrafts = pendingFilesSnapshot.filter(
          (f) => f.sourcePath && f.isClipboardDraft
        )
        const newFiles = pendingFilesSnapshot.filter((f) => !f.sourcePath)

        const allRefs: Array<{ filename: string; targetPath: string }> = []

        // 已有路径的文件直接引用
        for (const f of existingFiles) {
          const sourcePath = f.sourcePath!
          allRefs.push({ filename: f.filename, targetPath: sourcePath })
          const parentPath = getFileParentPath(sourcePath)
          if (parentPath) additionalDirectoriesForRun.add(parentPath)
        }

        // 剪贴板草稿：读取临时文件最新内容，转为待保存数据
        const draftFilesToSave: Array<{ filename: string; data: string }> = []
        const staleDraftFiles: string[] = []
        for (const f of clipboardDrafts) {
          const sourcePath = f.sourcePath!
          const parentPath = getFileParentPath(sourcePath)
          try {
            const read = await window.electronAPI.resolveAndReadFile(sourcePath, {
              sessionId,
              candidateBasePaths: parentPath ? [parentPath] : undefined,
            })
            if (!read) {
              staleDraftFiles.push(f.filename)
              continue
            }
            const data = await fileToBase64(
              new File([read.content], f.filename, { type: f.mediaType })
            )
            draftFilesToSave.push({ filename: f.filename, data })
          } catch (error) {
            console.error('[AgentView] 读取剪贴板草稿失败:', error)
            staleDraftFiles.push(f.filename)
          }
        }
        if (staleDraftFiles.length > 0) {
          toast.error('附件数据已失效', {
            description: `请移除后重新粘贴：${staleDraftFiles.join('、')}`,
          })
          return
        }

        // 新上传的文件 + 剪贴板草稿一并保存到 session 目录
        const inMemoryFilesToSave = newFiles.map((f) => ({
          filename: f.filename,
          data: window.__pendingAgentFileData?.get(f.id) || '',
        }))
        const missingDataFiles = inMemoryFilesToSave.filter((f) => !f.data).map((f) => f.filename)
        if (missingDataFiles.length > 0) {
          toast.error('附件数据已失效', {
            description: `请移除后重新添加文件：${missingDataFiles.join('、')}`,
          })
          return
        }

        const filesToSave = [...inMemoryFilesToSave, ...draftFilesToSave]
        if (filesToSave.length > 0) {
          try {
            const saved = await window.electronAPI.saveFilesToAgentSession({
              workspaceSlug: workspace.slug,
              sessionId,
              files: filesToSave,
            })
            allRefs.push(...saved)
          } catch (error) {
            console.error('[AgentView] 保存附件到 session 失败:', error)
            toast.error('附件保存失败', {
              description: '请确认当前工作区可用，或新建 Agent 会话后重新上传。',
            })
            return
          }
        }

        if (allRefs.length === 0) {
          toast.error('附件没有成功加入消息', {
            description: '请重新上传文件，或切换到有效工作区后再试。',
          })
          return
        }

        const refs = allRefs.map((f) => `- ${f.filename}: ${f.targetPath}`).join('\n')
        fileReferences += `<attached_files>\n${refs}\n</attached_files>\n\n`

        // 清理
        for (const f of pendingFilesSnapshot) {
          if (f.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(f.previewUrl)
          window.__pendingAgentFileData?.delete(f.id)
        }
        setPendingFiles([])
      }

      // 构建引用选中文本：内联 XML 拼入 prompt，对话框不展示（parseAttachedFiles 剥离）
      const quotedSelection = store.get(quotedSelectionMapAtom).get(sessionId)
      if (quotedSelection) {
        const capturedAt = quotedSelection.capturedAt
        // XML 转义：path 走完整实体编码（&, <, >, "），text 仅需防误闭合外层标签
        const safePath = quotedSelection.filePath
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
        const safeText = quotedSelection.text.replace(/<\/quoted_file>/gi, '</quoted_file_>')
        const quotedBlock = `<quoted_file path="${safePath}">\n${safeText}\n</quoted_file>\n\n`
        fileReferences = fileReferences + quotedBlock

        store.set(quotedSelectionMapAtom, (prev) => {
          const m = new Map(prev)
          const current = m.get(sessionId)
          if (current && current.capturedAt === capturedAt) m.delete(sessionId)
          return m
        })
      }

      // 2. 构建消息：displayText 给人看；wireText 给 Agent（末尾追加精简 design-context）
      const displayText = fileReferences + effectiveText
      const wireText = augmentWithDesignContext(displayText)

      // 清除打断状态（上一轮的打断标记不再显示）
      store.set(stoppedByUserSessionsAtom, (prev: Set<string>) => {
        if (!prev.has(sessionId)) return prev
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })

      // 取消 draft 标记，让会话出现在侧边栏
      setDraftSessionIds((prev: Set<string>) => {
        if (!prev.has(sessionId)) return prev
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })

      // 初始化流式状态（startedAt 由渲染进程生成，传递给主进程原样回传，确保竞态保护使用同一个值）
      const streamStartedAt = Date.now()
      setStreamingStates((prev) => {
        const map = new Map(prev)
        const existing = prev.get(sessionId)
        map.set(sessionId, {
          running: true,
          content: '',
          toolActivities: [],
          model: agentModelId || undefined,
          startedAt: streamStartedAt,
          inputTokens: existing?.inputTokens,
          contextWindow: existing?.contextWindow,
        })
        return map
      })

      // 乐观更新：气泡只显示用户原文，不含 design-context
      const tempUserSDKMsg: SDKMessage = {
        type: 'user',
        uuid: crypto.randomUUID(),
        message: {
          content: [{ type: 'text', text: displayText }],
        },
        parent_tool_use_id: null,
        _createdAt: Date.now(),
        _optimistic: true,
      } as unknown as SDKMessage
      appendOptimisticPersistedMessage(tempUserSDKMsg)

      const input: AgentSendInput = {
        sessionId,
        userMessage: wireText,
        channelId: agentChannelId,
        modelId: agentModelId || undefined,
        workspaceId: currentWorkspaceId || undefined,
        startedAt: streamStartedAt,
        permissionModeOverride: permissionMode,
        ...(additionalDirectoriesForRun.size > 0 && {
          additionalDirectories: Array.from(additionalDirectoriesForRun),
        }),
        // 解析用户消息中的 Skill/MCP/会话引用，传递结构化元数据给后端
        ...(() => {
          const skills = [...effectiveText.matchAll(/\/skill:(\S+)/g)]
            .map((m) => m[1])
            .filter(Boolean) as string[]
          const mcps = [...effectiveText.matchAll(/#mcp:(\S+)/g)]
            .map((m) => m[1])
            .filter(Boolean) as string[]
          const sessionIds = [...effectiveText.matchAll(/&session:(\S+)/g)]
            .map((m) => m[1])
            .filter(Boolean) as string[]
          return {
            ...(skills.length > 0 && { mentionedSkills: skills }),
            ...(mcps.length > 0 && { mentionedMcpServers: mcps }),
            ...(sessionIds.length > 0 && { mentionedSessionIds: sessionIds }),
          }
        })(),
      }

      if (overrideText === undefined) {
        setInputContent('')
        setInputHtmlContent('')
      }

      window.electronAPI.sendAgentMessage(input).catch((error) => {
        console.error('[AgentView] 发送消息失败:', error)
        setStreamingStates((prev) => {
          const current = prev.get(sessionId)
          if (!current) return prev
          const map = new Map(prev)
          map.set(sessionId, { ...current, running: false })
          return map
        })
      })
    },
    [
      // inputContent 不再订阅，handleSend 内部用 store.get 实时读，避免依赖 inputContent 每键重建
      attachedDirs,
      attachedFileDirectories,
      sessionId,
      agentChannelId,
      agentModelId,
      currentWorkspaceId,
      workspaces,
      streaming,
      streamState?.backgroundWaiting,
      suggestion,
      hasAvailableModel,
      store,
      setStreamingStates,
      setPendingFiles,
      setAgentStreamErrors,
      setPromptSuggestions,
      setInputContent,
      setLiveMessagesMap,
      permissionMode,
      messagesLoaded,
      sendQueuedMessage,
      setQueuedMessages,
      // Design Preview 上下文增强：augment 内部用 store.get 读最新 design state，
      // 引用变化时让 handleSend 重建以拿到新的 augment 函数
      augmentWithDesignContext,
    ]
  )

  /** 当前 turn 正常结束后，自动消费队首消息并启动下一轮。 */
  React.useEffect(() => {
    if (streaming || stoppedByUser) return
    if (!messagesLoaded || !agentChannelId || !hasAvailableModel) return
    const message = queuedMessages[0]
    if (!message) return
    sendQueuedMessageNow(message.id)
  }, [
    agentChannelId,
    hasAvailableModel,
    messagesLoaded,
    queuedMessages,
    sendQueuedMessageNow,
    stoppedByUser,
    streaming,
  ])

  /** 停止生成 */
  const handleStop = React.useCallback((): void => {
    setStreamingStates((prev) => {
      const current = prev.get(sessionId)
      if (!current || !current.running) return prev
      const map = new Map(prev)
      map.set(sessionId, {
        ...current,
        running: false,
        ...finalizeStreamingActivities(current.toolActivities),
      })
      return map
    })

    window.electronAPI.stopAgent(sessionId).catch(console.error)
  }, [sessionId, setStreamingStates])

  /** 手动发送 /compact 命令 */
  const handleCompact = React.useCallback((): void => {
    if (!agentChannelId || streaming) return

    const streamStartedAt = Date.now()
    const localUuid = crypto.randomUUID()

    // 1. 立即注入合成用户消息（/compact 气泡立刻可见，与普通发送路径一致）
    const syntheticMsg: import('@tagent/shared').SDKMessage = {
      type: 'user',
      uuid: localUuid,
      message: {
        content: [{ type: 'text', text: '/compact' }],
      },
      parent_tool_use_id: null,
      _createdAt: streamStartedAt,
    } as unknown as import('@tagent/shared').SDKMessage

    store.set(liveMessagesMapAtom, (prev) => {
      const map = new Map(prev)
      const current = map.get(sessionId) ?? []
      map.set(sessionId, [...current, syntheticMsg])
      return map
    })

    // 2. 初始化流式状态 + 乐观设 isCompacting=true（SDK compacting 事件之前就显示"正在压缩..."分隔符）
    setStreamingStates((prev) => {
      const map = new Map(prev)
      const current = prev.get(sessionId) ?? {
        running: true,
        content: '',
        toolActivities: [],
        model: agentModelId || undefined,
        startedAt: streamStartedAt,
      }
      map.set(sessionId, {
        ...current,
        running: true,
        startedAt: streamStartedAt,
        isCompacting: true,
        compactInFlight: true,
      })
      return map
    })

    window.electronAPI
      .sendAgentMessage({
        sessionId,
        userMessage: '/compact',
        channelId: agentChannelId,
        modelId: agentModelId || undefined,
        workspaceId: currentWorkspaceId || undefined,
        startedAt: streamStartedAt,
        permissionModeOverride: permissionMode,
      })
      .catch((error) => {
        console.error('[AgentView] /compact 发送失败:', error)
        // 回滚：移除合成用户消息 + 清除 isCompacting flag
        store.set(liveMessagesMapAtom, (prev) => {
          const map = new Map(prev)
          const current = (map.get(sessionId) ?? []).filter(
            (m) => (m as unknown as { uuid?: string }).uuid !== localUuid
          )
          map.set(sessionId, current)
          return map
        })
        setStreamingStates((prev) => {
          const map = new Map(prev)
          const current = prev.get(sessionId)
          if (!current) return prev
          map.set(sessionId, { ...current, isCompacting: false, compactInFlight: false })
          return map
        })
      })
  }, [
    sessionId,
    agentChannelId,
    agentModelId,
    currentWorkspaceId,
    streaming,
    setStreamingStates,
    store,
    permissionMode,
  ])

  /**
   * P1-3: 客户端压缩 (LLM compact_session tool 失败时的 fallback)
   * 走 command-registry 统一路由（agent.compact 命令），最终调 main 进程的 compactSession()
   */
  const handleClientCompact = React.useCallback(async (): Promise<void> => {
    if (!sessionId) return
    try {
      const result = (await window.electronAPI.runCommand({
        commandId: 'agent.compact',
        context: { sessionId },
      })) as {
        success: boolean
        droppedCount: number
        beforeCount: number
        afterCount: number
        message: string
      } | null
      if (!result) {
        toast.error('客户端压缩失败: 命令未注册')
        return
      }
      if (result.success) {
        toast.success(
          `客户端压缩: ${result.droppedCount} 条已压缩 (${result.beforeCount} -> ${result.afterCount})`
        )
      } else {
        toast.error(`客户端压缩失败: ${result.message}`)
      }
    } catch (error) {
      console.error('[AgentView] 客户端压缩失败:', error)
      toast.error('客户端压缩请求失败')
    }
  }, [sessionId])

  /** 重试：在当前会话中重新发送最后一条用户消息 */
  const handleRetry = React.useCallback((): void => {
    if (!agentChannelId || streaming) return

    // 找到最后一条用户消息
    const lastUserMessage = [...persistedSDKMessages]
      .reverse()
      .map(getUserTextFromSDKMessage)
      .find((text): text is string => text !== null)
    if (!lastUserMessage) return

    // 清除错误状态
    setAgentStreamErrors((prev) => {
      if (!prev.has(sessionId)) return prev
      const map = new Map(prev)
      map.delete(sessionId)
      return map
    })

    // 初始化流式状态（startedAt 由渲染进程生成，传递给主进程原样回传）
    const streamStartedAt = Date.now()
    setStreamingStates((prev) => {
      const map = new Map(prev)
      const existing = prev.get(sessionId)
      map.set(sessionId, {
        running: true,
        content: '',
        toolActivities: [],
        model: agentModelId || undefined,
        startedAt: streamStartedAt,
        inputTokens: existing?.inputTokens,
        contextWindow: existing?.contextWindow,
      })
      return map
    })

    window.electronAPI
      .sendAgentMessage({
        sessionId,
        userMessage: lastUserMessage,
        channelId: agentChannelId,
        modelId: agentModelId || undefined,
        workspaceId: currentWorkspaceId || undefined,
        startedAt: streamStartedAt,
        permissionModeOverride: permissionMode,
      })
      .catch(console.error)
  }, [
    persistedSDKMessages,
    sessionId,
    agentChannelId,
    agentModelId,
    currentWorkspaceId,
    streaming,
    setAgentStreamErrors,
    setStreamingStates,
    permissionMode,
  ])

  /** 在新对话继续：创建新会话 + 切换 tab + 使用 &session 引用旧会话 */
  const handleRetryInNewSession = React.useCallback(async (): Promise<void> => {
    if (!agentChannelId) return

    try {
      const meta = await window.electronAPI.createAgentSession(
        undefined,
        agentChannelId,
        currentWorkspaceId || undefined
      )
      setAgentSessions((prev) => [meta, ...prev])

      // 切换到新会话 tab
      openSession('agent', meta.id, meta.title)

      // 发送引用旧会话的默认提示词，并通过 mentionedSessionIds 触发结构化会话引用注入
      const prompt = `请读取 &session:${sessionId} 的历史，然后从上个会话停止的位置继续。`
      const streamStartedAt = Date.now()

      // 初始化新会话流式状态
      setStreamingStates((prev) => {
        const map = new Map(prev)
        map.set(meta.id, {
          running: true,
          content: '',
          toolActivities: [],
          model: agentModelId || undefined,
          startedAt: streamStartedAt,
        })
        return map
      })

      window.electronAPI
        .sendAgentMessage({
          sessionId: meta.id,
          userMessage: prompt,
          channelId: agentChannelId,
          modelId: agentModelId || undefined,
          workspaceId: currentWorkspaceId || undefined,
          mentionedSessionIds: [sessionId],
          startedAt: streamStartedAt,
          permissionModeOverride: permissionMode,
        })
        .catch(console.error)
    } catch (error) {
      console.error('[AgentView] 在新会话中重试失败:', error)
    }
  }, [
    sessionId,
    agentChannelId,
    agentModelId,
    currentWorkspaceId,
    openSession,
    setAgentSessions,
    setStreamingStates,
    permissionMode,
  ])

  /** 分叉会话：从指定消息处创建新会话并自动切换 */
  const handleFork = React.useCallback(
    async (upToMessageUuid: string): Promise<void> => {
      try {
        const meta = await window.electronAPI.forkAgentSession({
          sessionId,
          upToMessageUuid,
        })
        setAgentSessions((prev) => [meta, ...prev])

        // 切换到新会话 tab
        openSession('agent', meta.id, meta.title)

        toast.success('已创建分叉会话', {
          description: meta.title,
        })
      } catch (error) {
        console.error('[AgentView] 分叉会话失败:', error)
        const rawMsg = error instanceof Error ? error.message : '未知错误'
        // SDK 偶尔会因为 sidechain/消息归属问题抛 "not found in session"，
        // 这里给出更可操作的中文提示，而不是把 SDK 内部英文报错直接透传给用户
        const friendlyDesc = /not found in session/i.test(rawMsg)
          ? '该消息无法作为分叉起点（可能属于子代理执行过程或已被清理）。请选择主对话中的其他消息再试。'
          : rawMsg
        toast.error('分叉会话失败', {
          description: friendlyDesc,
        })
      }
    },
    [sessionId, openSession, setAgentSessions]
  )

  /** 快照回退：同一会话内回退到指定消息点，恢复文件 + 截断对话 */
  const [rewindTargetUuid, setRewindTargetUuid] = React.useState<string | null>(null)

  // ===== Ask 档位启发式对话框状态 =====
  const [heuristicDialog, setHeuristicDialog] = React.useState<{
    open: boolean
    pendingText: string
  }>({ open: false, pendingText: '' })

  /**
   * 实际执行 Ask 发送（无附件；附件场景在 handleSend 早返回）
   * 提到组件级 useCallback 以便 handleHeuristicChoice 直接调用
   */
  const performAskSend = React.useCallback(
    async (content: string): Promise<void> => {
      if (!agentChannelId) return

      // 清理输入
      setInputContent('')
      setInputHtmlContent('')
      setPromptSuggestions((prev) => {
        if (!prev.has(sessionId)) return prev
        const map = new Map(prev)
        map.delete(sessionId)
        return map
      })

      // 乐观插入 user message
      const askStartedAt = Date.now()
      const optimisticUserId = crypto.randomUUID()
      store.set(askMessagesMapAtom, (prev) => {
        const map = new Map(prev)
        const current = map.get(sessionId) ?? []
        const optimisticUser = {
          id: optimisticUserId,
          role: 'user' as const,
          content,
          createdAt: askStartedAt,
          channelId: agentChannelId,
          modelId: agentModelId ?? undefined,
        }
        map.set(sessionId, [...current, optimisticUser])
        return map
      })

      // 初始化 ask 流式状态
      store.set(askStreamingStatesAtom, (prev) => {
        const map = new Map(prev)
        map.set(sessionId, {
          running: true,
          messageId: null,
          content: '',
          reasoning: '',
          startedAt: askStartedAt,
        })
        return map
      })

      // 取消 draft 标记
      setDraftSessionIds((prev: Set<string>) => {
        if (!prev.has(sessionId)) return prev
        const next = new Set(prev)
        next.delete(sessionId)
        return next
      })

      // 真实发送
      window.electronAPI
        .sendAskMessage({
          agentSessionId: sessionId,
          content,
          channelId: agentChannelId,
          modelId: agentModelId || '',
          startedAt: askStartedAt,
        })
        .catch((error) => {
          console.error('[AgentView] Ask 发送失败:', error)
          store.set(askStreamingStatesAtom, (prev) => {
            const map = new Map(prev)
            const current = map.get(sessionId)
            if (current) {
              map.set(sessionId, { ...current, running: false })
            }
            return map
          })
          toast.error('Ask 发送失败', { description: String(error) })
        })
    },
    [
      sessionId,
      agentChannelId,
      agentModelId,
      store,
      setInputContent,
      setInputHtmlContent,
      setPromptSuggestions,
      setDraftSessionIds,
    ]
  )

  /**
   * 处理用户对启发式对话框的选择
   * - switch: 切到 Agent 档位并通过 sendAgentMessage 发送
   * - ask: 继续在 Ask 档位发送
   * - cancel: 关闭对话框，不发送
   */
  const handleHeuristicChoice = React.useCallback(
    async (choice: AskHeuristicChoice): Promise<void> => {
      const text = heuristicDialog.pendingText
      setHeuristicDialog({ open: false, pendingText: '' })

      if (choice === 'cancel') return

      if (choice === 'switch') {
        // 切到 Agent 档位（乐观更新 + IPC 落盘）
        store.set(composerModeMapAtom, (prev) => {
          const next = new Map(prev)
          next.set(sessionId, 'agent')
          return next
        })
        store.set(composerModeSyncedSessionsAtom, (prev) => {
          const next = new Set(prev)
          next.add(sessionId)
          return next
        })
        try {
          await window.electronAPI.setComposerMode(sessionId, 'agent')
        } catch (err) {
          console.warn('[AgentView] setComposerMode 失败:', err)
        }

        // 切到 Agent 后通过 sendAgentMessage 发送
        const streamStartedAt = Date.now()
        const input: AgentSendInput = {
          sessionId,
          userMessage: text,
          channelId: agentChannelId!,
          modelId: agentModelId || undefined,
          startedAt: streamStartedAt,
        }

        setInputContent('')
        setInputHtmlContent('')
        setPromptSuggestions((prev) => {
          if (!prev.has(sessionId)) return prev
          const map = new Map(prev)
          map.delete(sessionId)
          return map
        })

        window.electronAPI.sendAgentMessage(input).catch((error) => {
          console.error('[AgentView] 切换档位后 Agent 发送失败:', error)
          toast.error('Agent 发送失败', { description: String(error) })
        })
        return
      }

      // choice === 'ask'：继续在 Ask 档位发送
      if (!agentChannelId || !hasAvailableModel) return
      void performAskSend(text)
    },
    [
      heuristicDialog.pendingText,
      sessionId,
      agentChannelId,
      agentModelId,
      hasAvailableModel,
      store,
      setInputContent,
      setInputHtmlContent,
      setPromptSuggestions,
      performAskSend,
    ]
  )

  const handleRewindRequest = React.useCallback((assistantMessageUuid: string): void => {
    setRewindTargetUuid(assistantMessageUuid)
  }, [])

  const handleRewindConfirm = React.useCallback(async (): Promise<void> => {
    if (!rewindTargetUuid) return
    const targetUuid = rewindTargetUuid
    setRewindTargetUuid(null)

    try {
      const result = await window.electronAPI.rewindSession({
        sessionId,
        assistantMessageUuid: targetUuid,
      })

      // 刷新消息列表
      store.set(agentMessageRefreshAtom, (prev) => {
        const map = new Map(prev)
        map.set(sessionId, (prev.get(sessionId) ?? 0) + 1)
        return map
      })

      // 刷新预览面板的 diff（文件已被回退，当前显示的内容已过期）
      store.set(agentDiffRefreshVersionAtom, (prev) => {
        const m = new Map(prev)
        m.set(sessionId, (prev.get(sessionId) ?? 0) + 1)
        return m
      })

      if (result.fileRewind?.canRewind) {
        const fileCount = result.fileRewind.filesChanged?.length ?? 0
        toast.success('已回退到此处', {
          description: fileCount > 0 ? `${fileCount} 个文件已恢复` : '文件无变化',
        })
      } else if (result.fileRewind?.error) {
        toast.warning('已回退对话', {
          description: `文件恢复不可用：${result.fileRewind.error}`,
        })
      } else {
        toast.success('已回退到此处')
      }
    } catch (error) {
      console.error('[AgentView] 回退失败:', error)
      toast.error('回退失败', {
        description: error instanceof Error ? error.message : '未知错误',
      })
    }
  }, [rewindTargetUuid, sessionId, store])

  // 监听快捷键系统分发的 stop-generation 事件
  React.useEffect(() => {
    const handler = (): void => {
      if (streaming) handleStop()
    }
    window.addEventListener('tagent:stop-generation', handler)
    return () => window.removeEventListener('tagent:stop-generation', handler)
  }, [streaming, handleStop])

  // 监听快捷键系统分发的 focus-input 事件（Cmd+L）
  React.useEffect(() => {
    const handler = (): void => {
      const proseMirror = document.querySelector(
        '[data-input-mode="agent"] .ProseMirror'
      ) as HTMLElement | null
      proseMirror?.focus()
    }
    window.addEventListener('tagent:focus-input', handler)
    return () => window.removeEventListener('tagent:focus-input', handler)
  }, [])

  // 监听 kscc 安装引导请求（来自 preflight error recovery action）
  React.useEffect(() => {
    const handler = () => setKsccGuideOpen(true)
    window.addEventListener('tagent:kscc-install-request', handler)
    return () => window.removeEventListener('tagent:kscc-install-request', handler)
  }, [])

  // v2 design canvas: 监听"指着说话"事件，把文本追加到 chat input
  // 来源：design-preview/LayerTreePanel 的"把这部分告诉 Agent"按钮
  // 行为：读当前 draft + 拼接 + 写入 draft；可选聚焦 ProseMirror
  const setInputContentRef = React.useRef(setInputContent)
  setInputContentRef.current = setInputContent
  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ text: string; focus?: boolean }>).detail
      if (!detail || typeof detail.text !== 'string' || !detail.text) return
      // 读最新 draft（用 store.get 避免在 effect 依赖 draftText）
      const current = store.get(agentSessionDraftAtomFamily(sessionId)) ?? ''
      const next = current ? `${current}${detail.text}` : detail.text
      setInputContentRef.current(next)
      if (detail.focus !== false) {
        // 与 tagent:focus-input 同款做法
        requestAnimationFrame(() => {
          const proseMirror = document.querySelector(
            '[data-input-mode="agent"] .ProseMirror'
          ) as HTMLElement | null
          proseMirror?.focus()
          // 把光标移到末尾
          const sel = window.getSelection()
          if (sel && proseMirror) {
            const range = document.createRange()
            range.selectNodeContents(proseMirror)
            range.collapse(false)
            sel.removeAllRanges()
            sel.addRange(range)
          }
        })
      }
    }
    window.addEventListener('tagent:append-chat-input', handler as EventListener)
    return () => window.removeEventListener('tagent:append-chat-input', handler as EventListener)
  }, [sessionId, store])

  const allAskUserRequests = useAtomValue(allPendingAskUserRequestsAtom)
  const allExitPlanRequests = useAtomValue(allPendingExitPlanRequestsAtom)
  const hasBannerOverlay =
    (allAskUserRequests.get(sessionId)?.length ?? 0) > 0 ||
    (allExitPlanRequests.get(sessionId)?.length ?? 0) > 0

  // ===== 预览面板状态（toggle 快捷键，分屏布局在 MainArea） =====
  const setPreviewOpenMap = useSetAtom(previewPanelOpenMapAtom)

  const togglePreviewPanel = React.useCallback(() => {
    setPreviewOpenMap((prev) => {
      const m = new Map(prev)
      const current = m.get(sessionId) ?? false
      m.set(sessionId, !current)
      return m
    })
  }, [sessionId, setPreviewOpenMap])

  React.useEffect(() => {
    return registerShortcut('toggle-preview-panel', togglePreviewPanel)
  }, [togglePreviewPanel])

  const hasTextInput = hasDraft
  const canSend =
    messagesLoaded &&
    (hasTextInput || pendingFiles.length > 0 || !!suggestion) &&
    agentChannelId !== null &&
    hasAvailableModel &&
    (!streaming || hasTextInput)

  /** 当前 Composer 档位（per-session，从本地缓存读） */
  const composerMode = useAtomValue(currentComposerModeAtom)

  /**
   * 主工具栏：附件入口（Ask/Agent 档位切换暂隐藏，后续改造）
   * 推理 / 权限 / SubAgent / 显示 → focus 时 ComposerUnderlay
   */
  const inputToolbarItems = React.useMemo<ToolbarItem[]>(
    () => [
      {
        key: 'input-more',
        node: (
          <InputMorePopover
            onAttachFile={handleOpenFileDialog}
            onAttachFolder={handleAttachFolder}
            onSpeech={handleSpeech}
            disableAttachments={composerMode === 'ask'}
          />
        ),
      },
    ],
    [handleOpenFileDialog, handleAttachFolder, handleSpeech, composerMode]
  )

  /** 原型 is-composer-expanded：focus 展开 underlay */
  const [composerExpanded, setComposerExpanded] = React.useState(false)
  const composerClusterRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!composerExpanded) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (composerClusterRef.current?.contains(target)) return
      // Radix / 浮层 portaled 内容不收起
      if (
        target.closest(
          '[data-radix-popper-content-wrapper], [data-radix-menu-content], [role="dialog"], [data-sonner-toaster]'
        )
      ) {
        return
      }
      setComposerExpanded(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [composerExpanded])

  const inputTrailingNode = (
    <>
      <AgentModelSelector
        filterChannelIds={agentChannelIdsAgentSafe}
        lockedProvider={lockedProvider}
        externalSelectedModel={externalSelectedModel}
        onModelSelect={handleModelSelect}
        onInstallGuideOpen={() => setKsccGuideOpen(true)}
        hideLogo
        compact
      />
      {streaming && !hasTextInput ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-[36px] rounded-full text-destructive hover:!text-[hsl(0,75%,55%)] hover:!bg-[var(--stop-hover-bg)]"
              onClick={handleStop}
            >
              <Square className="size-[16px]" fill="currentColor" strokeWidth={0} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>停止 Agent ({getAcceleratorDisplay(getActiveAccelerator('stop-generation'))})</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'size-[36px] rounded-full',
            canSend
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'text-foreground/30 cursor-not-allowed'
          )}
          onClick={() => void handleSend()}
          disabled={!canSend}
        >
          <ArrowUp className="size-5" />
        </Button>
      )}
    </>
  )

  // 是否有项目模式的工作区
  const hasProject = workspaces.some((w) => w.projectDirectory)

  // 无项目时显示引导页（对齐 WelcomeEmptyState 浮岛布局）
  if (!hasProject) {
    return <NoProjectEmptyState />
  }

  return (
    <>
      <AgentSessionProvider sessionId={sessionId}>
        <div
          className={cn(
            'relative flex h-full min-w-0 flex-1 flex-col',
            surface === 'office-dock' && 'agent-view--office-dock'
          )}
          data-agent-surface={surface}
        >
          {/* 会话状态条已移除：模型/权限在 Composer，班组进度在右轨 */}

          <>
            <SessionFloatingLayout
              className={cn(isOfficeDock && 'office-conversation-layout')}
              bottom={
                <>
                  <PermissionBanner sessionId={sessionId} />
                  <AgentSwitchBanner />
                  {composerMode === 'ask' && !hasBannerOverlay && (
                    <div className="mx-4 mb-2 flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 px-1">
                      <MessageSquareText className="size-3.5" />
                      <span>Ask 档位：仅对话，不修改文件或执行命令</span>
                    </div>
                  )}
                  <AgentMessageQueue
                    items={queuedMessages}
                    canSendNow={messagesLoaded && !!agentChannelId && hasAvailableModel}
                    onSendNow={sendQueuedMessageNow}
                    onRecall={recallQueuedMessage}
                    onRemove={removeQueuedMessageFromQueue}
                    onMove={moveQueuedMessageItem}
                  />
                  {!hasBannerOverlay && !isNestedWorker && (
                    <div
                      ref={composerClusterRef}
                      className={cn(
                        'session-composer-cluster',
                        !isOfficeDock && composerExpanded && 'is-composer-expanded'
                      )}
                      onFocusCapture={(e) => {
                        if (isOfficeDock) return
                        const target = e.target
                        if (!(target instanceof Element)) return
                        // 只在编辑器本体获焦时展开 underlay。
                        // 工具栏/底栏控件获焦若也展开，margin 动画会挪走点击目标，吞掉 Popover/按钮交互。
                        if (
                          target.closest('.ProseMirror, .tiptap, [contenteditable="true"]')
                        ) {
                          setComposerExpanded(true)
                        }
                      }}
                    >
                    <div
                      className={cn(
                        'session-input-dock content-shell-chrome-bleed relative pb-0',
                        isOfficeDock && 'office-conversation-composer'
                      )}
                      data-input-mode="agent"
                    >
                      <div
                        className={cn(
                          'chat-input-glass transition-colors duration-200',
                          isOfficeDock ? 'office-conversation-input' : 'session-glass',
                          (isPlanMode || isPermissionPlanMode) && !isDragOver && 'plan-mode-border',
                          isDragOver &&
                            'border-[2px] border-dashed border-[#2ecc71] bg-[#2ecc71]/[0.03]'
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                      >
                        {(isPlanMode || isPermissionPlanMode) && !isDragOver && (
                          <PlanModeDashedBorder />
                        )}

                        {/* 无 Agent 渠道或无可用模型提示 */}
                        {(!agentChannelId || !hasAvailableModel) && (
                          <div className="flex items-center gap-2 px-4 py-2 text-sm text-amber-600 dark:text-amber-400">
                            <Settings size={14} />
                            <span>
                              {!agentChannelId
                                ? '请在设置中选择 Agent 供应商'
                                : '暂无可用模型，请在设置中启用 Agent 渠道并配置模型'}
                            </span>
                            <button
                              type="button"
                              className="text-xs underline underline-offset-2 hover:text-foreground transition-colors"
                              onClick={() => setSettingsOpen(true)}
                            >
                              前往设置
                            </button>
                          </div>
                        )}

                        {/* 待发送附件 + 引用选中文本 Chip */}
                        {(pendingFiles.length > 0 || currentQuotedSelection) && (
                          <div className="flex flex-wrap gap-2 px-3 pt-2.5 pb-1.5">
                            {pendingFiles.map((file) => (
                              <AttachmentPreviewItem
                                key={file.id}
                                filename={file.filename}
                                mediaType={file.mediaType}
                                previewUrl={file.previewUrl}
                                onRemove={() => handleRemoveFile(file.id)}
                                onClick={
                                  file.filename.startsWith('clipboard-')
                                    ? () => handleClipboardPreview(file)
                                    : undefined
                                }
                              />
                            ))}
                            {currentQuotedSelection && (
                              <QuotedSelectionChip
                                text={currentQuotedSelection.text}
                                filePath={currentQuotedSelection.filePath}
                                onRemove={handleRemoveQuotedSelection}
                              />
                            )}
                          </div>
                        )}

                        {/* Design Preview 建议横幅 */}
                        {!isOfficeDock && <DesignSuggestionBanner />}

                        {/* Agent 建议提示 */}
                        {suggestion && !streaming && (
                          <div className="px-3 pt-2.5 pb-1.5">
                            <button
                              type="button"
                              className="group flex items-start gap-2 w-full rounded-lg border border-dashed border-primary/30 bg-primary/[0.03] px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/[0.06]"
                              onClick={() => void handleSend({ overrideText: suggestion })}
                            >
                              <Sparkles className="size-4 shrink-0 mt-0.5 text-primary/60 group-hover:text-primary/80" />
                              <span className="flex-1 min-w-0 text-foreground/80 group-hover:text-foreground line-clamp-3">
                                {suggestion}
                              </span>
                              <X
                                className="size-3.5 shrink-0 mt-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPromptSuggestions((prev) => {
                                    if (!prev.has(sessionId)) return prev
                                    const map = new Map(prev)
                                    map.delete(sessionId)
                                    return map
                                  })
                                }}
                              />
                            </button>
                          </div>
                        )}

                        {/* 任务进度预览条：仅当前流式回合有进行中任务时显示 */}
                        <TaskProgressDock
                          allMessages={
                            liveMessages.length > 0
                              ? [...persistedSDKMessages, ...liveMessages]
                              : persistedSDKMessages
                          }
                          streaming={streaming}
                        />

                        <AgentRichTextInputBridge
                          onChange={setInputContent}
                          onHtmlChange={setInputHtmlContent}
                          onSubmit={handleSend}
                          onPasteFiles={handlePasteFiles}
                          onPasteLongText={handlePasteLongText}
                          longTextPasteThreshold={LONG_TEXT_ATTACHMENT_THRESHOLD}
                          placeholder={
                            agentChannelId && hasAvailableModel
                              ? composerMode === 'ask'
                                ? isOfficeDock
                                  ? '和总监讨论，不执行操作…'
                                  : 'Ask 档位：提问或讨论问题（不修改文件，不执行命令）'
                                : sendWithCmdEnter
                                  ? isOfficeDock
                                    ? '给总监发消息…（⌘/Ctrl+Enter 发送）'
                                    : '输入消息... (⌘/Ctrl+Enter 发送 · Enter 换行 · @ 文件 · / Skill · # MCP · & 会话)'
                                  : isOfficeDock
                                    ? '给总监发消息…'
                                    : '输入消息... (Enter 发送 · Shift+Enter 换行 · @ 文件 · / Skill · # MCP · & 会话)'
                              : !agentChannelId
                                ? '请先在设置中选择 Agent 供应商'
                                : '暂无可用模型，请先在设置中启用渠道'
                          }
                          disabled={!agentChannelId || !hasAvailableModel}
                          collapsible
                          enableMentions
                          workspacePath={sessionPath}
                          workspaceId={currentWorkspaceId}
                          workspaceSlug={workspaceSlug}
                          sessionId={sessionId}
                          attachedDirs={workspaceMentionPaths}
                          sessionAttachedDirs={sessionMentionPaths}
                          sendWithCmdEnter={sendWithCmdEnter}
                        />

                        {/* Footer 工具栏 — 容器变窄时尾部按钮自动折叠进「更多」Popover */}
                        <InputToolbarOverflow
                          items={inputToolbarItems}
                          trailing={inputTrailingNode}
                          className={cn(isOfficeDock && 'office-conversation-toolbar')}
                        />
                      </div>
                    </div>
                    {/* 原型 composer-underlay：仅 classic 壳 focus 展开 */}
                    {!isOfficeDock && (
                      <ComposerUnderlay
                        sessionId={sessionId}
                        askMode={composerMode === 'ask'}
                      />
                    )}
                    </div>
                  )}
                  <AskUserBanner sessionId={sessionId} />
                  <ExitPlanModeBanner sessionId={sessionId} />
                  {/*
                    原型 status-bar：absolute bottom:7，不占文档流。
                    放进 session-bottom-stack 末尾，由 CSS bottom:7 定位。
                  */}
                  {!isNestedWorker && surface === 'classic' && (
                    <TokenStatsPanel
                      isProcessing={streaming}
                      onCompact={handleCompact}
                      onClientCompact={handleClientCompact}
                    />
                  )}
                </>
              }
            >
              <AgentMessages
                sessionId={sessionId}
                sessionModelId={agentModelId || undefined}
                messagesLoaded={messagesLoaded}
                persistedSDKMessages={persistedSDKMessages}
                streaming={streaming}
                streamState={streamState}
                liveMessages={liveMessages}
                sessionPath={sessionPath}
                attachedDirs={allAttachedDirs}
                stoppedByUser={stoppedByUser}
                onRetry={handleRetry}
                onRetryInNewSession={handleRetryInNewSession}
                onFork={handleFork}
                onRewind={handleRewindRequest}
                onCompact={handleCompact}
                floatingInput
                showStickyUserMessage={!isOfficeDock}
                showMinimap={!isOfficeDock}
              />
            </SessionFloatingLayout>
          </>
        </div>
      </AgentSessionProvider>

      {/* 回退确认弹窗 */}
      <AlertDialog
        open={rewindTargetUuid !== null}
        onOpenChange={(v) => {
          if (!v) setRewindTargetUuid(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认回退</AlertDialogTitle>
            <AlertDialogDescription>
              回退将截断该消息之后的所有对话，并恢复文件到该时刻的状态。此操作不可撤销，确定要回退吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRewindConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              回退
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ask 档位启发式对话框：检测到动手意图关键词时弹出 */}
      <AskHeuristicDialog
        open={heuristicDialog.open}
        messagePreview={heuristicDialog.pendingText}
        onChoice={handleHeuristicChoice}
      />

      {/* kscc 内网渠道状态检测 */}
      <KsccInstallGuide
        open={ksccGuideOpen}
        onOpenChange={setKsccGuideOpen}
        onComplete={(installed) => {
          if (installed) {
            window.electronAPI.listChannels().then(setGlobalChannels).catch(console.error)
          }
        }}
      />
    </>
  )
}

/**
 * RichTextInput 与 jotai 状态的桥接组件 — 性能优化（2026-07-05）
 *
 * 之前 AgentView 直接订阅 inputContent / inputHtmlContent，每次按键都让整个 AgentView
 * （3000+ 行组件树，含 AgentMessages / TokenStatsPanel / 工具栏）re-render。
 * 改用 wrapper 后：
 * - AgentView 只订阅 hasDraft（boolean），仅 empty↔non-empty 切换时变化
 * - inputContent / inputHtmlContent 在 wrapper 内部订阅，仅输入框自己 re-render
 * - onChange / onHtmlChange 用 AgentView 传入的 setInputContent / setInputHtmlContent
 *   （useCallback 稳定引用，不触发 wrapper 重渲染）
 */
type RichTextInputProps = React.ComponentProps<typeof RichTextInput>
function AgentRichTextInputBridgeImpl(
  props: Omit<RichTextInputProps, 'value' | 'htmlValue'> & {
    sessionId: string
  }
): React.ReactElement {
  const { sessionId, ...rest } = props
  const value = useAtomValue(agentSessionDraftAtomFamily(sessionId))
  const htmlValue = useAtomValue(agentSessionDraftHtmlAtomFamily(sessionId))
  return <RichTextInput {...rest} value={value} htmlValue={htmlValue} />
}
const AgentRichTextInputBridge = React.memo(AgentRichTextInputBridgeImpl)

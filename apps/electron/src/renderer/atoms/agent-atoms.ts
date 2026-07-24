/**
 * Agent Atoms — Agent 模式的 Jotai 状态管理
 *
 * 管理 Agent 会话列表、当前会话、消息、流式状态等。
 * 模式照搬 chat-atoms.ts。
 */

import { TAGENT_DEFAULT_PERMISSION_MODE, resolveDisplayContextWindow } from '@tagent/shared'
import { atom, type createStore } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'

import type {
  AgentSessionMeta,
  AgentEvent,
  AgentWorkspace,
  AgentPendingFile,
  RetryAttempt,
  TAgentPermissionMode,
  PermissionRequest,
  AskUserRequest,
  ExitPlanModeRequest,
  ThinkingConfig,
  AgentEffort,
  SDKMessage,
  UnstagedChangesResult,
  ConversationMeta,
  AgentCallStats,
} from '@tagent/shared'

import type { AgentQueuedMessage } from '@/lib/agent-message-queue'
import { calculateDockBadgeCount, countPendingRequests } from '@/lib/dock-badge-count'

/** 活动状态 */
export type ActivityStatus = 'pending' | 'running' | 'completed' | 'error' | 'backgrounded'

/** 工具活动状态 */
export interface ToolActivity {
  toolUseId: string
  toolName: string
  input: Record<string, unknown>
  intent?: string
  displayName?: string
  result?: string
  isError?: boolean
  done: boolean
  parentToolUseId?: string
  elapsedSeconds?: number
  taskId?: string
  shellId?: string
  isBackground?: boolean
  /** MCP 工具返回的图片附件 */
  imageAttachments?: Array<{ localPath: string; filename: string; mediaType: string }>
}

/** 活动分组（Task 子代理） */
export interface ActivityGroup {
  parent: ToolActivity
  children: ToolActivity[]
}

/**
 * 将流式状态中未完成的 toolActivities 标记为终态。
 * 用于 complete、handleStop、STREAM_COMPLETE 等多个终态入口的兜底清理。
 * 当所有项已处于终态时返回原引用，避免不必要的 React 重渲染。
 */
export function finalizeStreamingActivities(toolActivities: ToolActivity[]): {
  toolActivities: ToolActivity[]
} {
  const hasUnfinishedTools = toolActivities.some((ta) => !ta.done)

  return {
    toolActivities: hasUnfinishedTools
      ? toolActivities.map((ta) => (ta.done ? ta : { ...ta, done: true }))
      : toolActivities,
  }
}

/** Agent 会话的流式状态 */
export interface AgentStreamState {
  running: boolean
  /** 当前流式 text 段累积内容（typing 打字机） */
  content: string
  /** 当前流式 thinking 段累积内容（extended / adaptive thinking） */
  thinkingContent?: string
  toolActivities: ToolActivity[]
  model?: string
  /** 当前输入 token 数（上下文使用量） */
  inputTokens?: number
  /** 输出 token 数 */
  outputTokens?: number
  /** 缓存读取 token 数 */
  cacheReadTokens?: number
  /** 缓存写入 token 数 */
  cacheCreationTokens?: number
  /** 费用（美元） */
  costUsd?: number
  /** 模型上下文窗口大小 */
  contextWindow?: number
  /** usage 数据最后更新时间（用于 Context 面板时效提示） */
  usageUpdatedAt?: number
  /** 当前 thinking block 的 token 估算值（SDK 实时估算，非计费值） */
  thinkingEstimatedTokens?: number
  /** 是否正在压缩上下文 */
  isCompacting?: boolean
  /**
   * 压缩流程是否进行中（含收尾窗口）。
   * 从用户点击压缩 / SDK compacting 事件开始 → 到整个 stream 结束（state 被删除）前一直为 true。
   * 用于抑制压缩分隔符切换期间 AgentRunningIndicator 的短暂闪烁。
   */
  compactInFlight?: boolean
  /** 流式开始时间戳（用于思考计时持久化） */
  startedAt?: number
  /** 后台任务等待态：turn 已轻量完成但通道仍开着，等待 task_notification 续轮 */
  backgroundWaiting?: boolean
  /** 重试状态（扩展版） */
  retrying?: {
    /** 当前第几次尝试 */
    currentAttempt: number
    /** 最大尝试次数 */
    maxAttempts: number
    /** 重试历史记录（按时间顺序） */
    history: RetryAttempt[]
    /** 是否已失败 */
    failed: boolean
  }
}

/** 从 ToolActivity 派生状态 */
export function getActivityStatus(activity: ToolActivity): ActivityStatus {
  if (activity.isBackground) return 'backgrounded'
  if (!activity.done) return 'running'
  if (activity.isError) return 'error'
  return 'completed'
}

/**
 * 合并同层 TodoWrite 活动：多次调用只保留最新 input，置底显示
 *
 * TodoWrite 每次调用都包含完整的 todo 列表，只需展示最新状态。
 */
function mergeTodoWrites(activities: ToolActivity[]): ToolActivity[] {
  const todoWrites: ToolActivity[] = []
  const others: ToolActivity[] = []

  for (const a of activities) {
    if (a.toolName === 'TodoWrite') {
      todoWrites.push(a)
    } else {
      others.push(a)
    }
  }

  if (todoWrites.length === 0) return activities

  const latest = todoWrites[todoWrites.length - 1]!
  const allDone = todoWrites.every((t) => t.done)

  const merged: ToolActivity = {
    ...latest,
    done: allDone,
    isError: allDone && todoWrites.some((t) => t.isError),
  }

  return [...others, merged]
}

/**
 * 将扁平活动列表按 parentToolUseId 分组
 *
 * 返回顶层项（ActivityGroup | ToolActivity），
 * Task 类型的工具作为 group.parent，其子活动嵌套在 children 中。
 * 每层内 TodoWrite 合并去重并置底。
 */
export function groupActivities(activities: ToolActivity[]): Array<ActivityGroup | ToolActivity> {
  // 过滤幽灵条目：tool_progress 创建的空 input 条目，完成后仍无内容
  const filtered = activities.filter((a) => {
    if (a.done && Object.keys(a.input).length === 0 && !a.result) return false
    return true
  })
  const processed = mergeTodoWrites(filtered)

  const parentIds = new Set<string>()
  for (const a of processed) {
    if (a.toolName === 'Task' || a.toolName === 'Agent') parentIds.add(a.toolUseId)
  }

  const childrenMap = new Map<string, ToolActivity[]>()
  const topLevel: Array<ActivityGroup | ToolActivity> = []

  for (const a of processed) {
    if (a.parentToolUseId && parentIds.has(a.parentToolUseId)) {
      const children = childrenMap.get(a.parentToolUseId) ?? []
      children.push(a)
      childrenMap.set(a.parentToolUseId, children)
    } else {
      topLevel.push(a)
    }
  }

  return topLevel.map((item) => {
    if ('toolUseId' in item && parentIds.has(item.toolUseId)) {
      const children = childrenMap.get(item.toolUseId) ?? []
      return { parent: item, children: mergeTodoWrites(children) } as ActivityGroup
    }
    return item
  })
}

/** 判断是否为 ActivityGroup */
export function isActivityGroup(item: ActivityGroup | ToolActivity): item is ActivityGroup {
  return 'parent' in item && 'children' in item
}

/** 待自动发送的 Agent 提示（从设置页 / 插件 AI 配置等入口触发） */
export interface AgentPendingPrompt {
  sessionId: string
  message: string
  additionalDirectories?: string[]
  /** 显式指定渠道，避免新会话 per-session map 尚未初始化时误用默认值 */
  channelId?: string
  /** 显式指定模型，避免在模型 auto-select 完成前用 DEFAULT_MODEL_ID 发送 */
  modelId?: string
  /** 显式指定工作区，避免会话元数据尚未同步时 workspaceId 为空 */
  workspaceId?: string
}

// ===== Atoms =====

export const agentSessionsAtom = atom<AgentSessionMeta[]>([])

/**
 * 派生 atom：仅返回 TA 模式会话（mode === 'ta'）。
 * 通用模式加载的所有会话（agentSessionsAtom）经过这个过滤后用于 TA 模式的会话列表。
 */
export const taSessionsAtom = atom<AgentSessionMeta[]>((get) => {
  return get(agentSessionsAtom).filter((s) => s.mode === 'ta')
})
export const agentWorkspacesAtom = atom<AgentWorkspace[]>([])
export const currentAgentWorkspaceIdAtom = atom<string | null>(null)
/** 全局默认渠道 ID（新会话继承用，从 settings.json 加载） */
export const agentChannelIdAtom = atom<string | null>(null)
/** 全局默认模型 ID（新会话继承用，从 settings.json 加载） */
export const agentModelIdAtom = atom<string | null>(null)
/** Agent 启用的渠道 ID 列表（多选，设置页 Switch 开关控制） */
export const agentChannelIdsAtom = atom<string[]>([])

/** Per-session 渠道 ID Map — sessionId → channelId */
export const agentSessionChannelMapAtom = atom<Map<string, string>>(new Map())
/** Per-session 模型 ID Map — sessionId → modelId */
export const agentSessionModelMapAtom = atom<Map<string, string>>(new Map())
export const currentAgentSessionIdAtom = atom<string | null>(null)
export const agentStreamingStatesAtom = atom<Map<string, AgentStreamState>>(new Map())

/** Agent 流式结束后是否保持过程组展开，默认收起以降低结果阅读干扰 */
export const agentProcessGroupsKeepExpandedAtom = atomWithStorage<boolean>(
  'tagent-agent-process-groups-keep-expanded',
  false
)

/**
 * 单个 session 的 streaming state 派生 atomFamily — 按 sessionId 切片订阅。
 *
 * 直接订阅 agentStreamingStatesAtom 会让任意 session 的流式更新都触发 AgentView
 * 整树重渲染（10–30fps）。本 family 让订阅者只在本 session 的 state 引用变化时
 * 重渲染——其他 session 的更新虽然让 base atom 变化，但派生 atom 输出引用未变，
 * jotai 自动跳过通知。
 */
export const agentSessionStreamingStateAtomFamily = atomFamily((sessionId: string) =>
  atom((get) => get(agentStreamingStatesAtom).get(sessionId))
)

/**
 * 实时 SDKMessage 累积 Map — Phase 2 新增
 *
 * 流式期间每条 SDKMessage 直接追加，供新 UI 渲染。
 * 流式完成后清空（持久化消息从 JSONL 加载）。
 */
export const liveMessagesMapAtom = atom<Map<string, SDKMessage[]>>(new Map())

export const agentPendingPromptAtom = atom<AgentPendingPrompt | null>(null)

/**
 * Agent 待发送文件列表 Map — 以 sessionId 为 key
 * 切换会话时保留各 session 自己的 pending files，与文字草稿语义一致
 */
export const agentSessionPendingFilesAtom = atom<Map<string, AgentPendingFile[]>>(new Map())

/**
 * 单个 session 的 pending files 派生 atom（读写）— 按 sessionId 切片
 * read：返回当前 session 的数组（空数组兜底）
 * write：接受新数组或 updater 函数，写回时空数组转为 delete，避免 Map 长期残留空 entry
 */
export const agentPendingFilesAtomFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => get(agentSessionPendingFilesAtom).get(sessionId) ?? [],
    (
      _get,
      set,
      update: AgentPendingFile[] | ((prev: AgentPendingFile[]) => AgentPendingFile[])
    ) => {
      set(agentSessionPendingFilesAtom, (prev) => {
        const current = prev.get(sessionId) ?? []
        const next = typeof update === 'function' ? update(current) : update
        const map = new Map(prev)
        if (next.length === 0) {
          map.delete(sessionId)
        } else {
          map.set(sessionId, next)
        }
        return map
      })
    }
  )
)

/** 工作区能力版本号 — 每次修改 MCP/Skills 后自增，触发侧边栏重新获取 */
export const workspaceCapabilitiesVersionAtom = atom(0)

/** 工作区文件版本号 — 文件变化时自增，触发文件浏览器重新加载 */
export const workspaceFilesVersionAtom = atom(0)

// ===== 侧面板 Atoms =====

/** 未记录过的会话：右栏默认展开 */
export const DEFAULT_AGENT_SIDE_PANEL_OPEN = true

const SIDE_PANEL_OPEN_BY_SESSION_KEY = 'tagent-agent-sidepanel-open-by-session'

function migrateSidePanelOpen(raw: unknown): boolean {
  return typeof raw === 'boolean' ? raw : DEFAULT_AGENT_SIDE_PANEL_OPEN
}

/** 按 sessionId 持久化的右栏开合 */
const agentSidePanelOpenBySessionStorageAtom = atomWithStorage<Record<string, boolean>>(
  SIDE_PANEL_OPEN_BY_SESSION_KEY,
  {}
)

const writeAgentSidePanelOpenBySessionAtom = atom(
  null,
  (_get, set, update: (prev: Map<string, boolean>) => Map<string, boolean>) => {
    const stored = _get(agentSidePanelOpenBySessionStorageAtom)
    const prev = new Map(
      Object.entries(stored).map(([k, v]) => [k, migrateSidePanelOpen(v)] as const)
    )
    const next = update(prev)
    const obj: Record<string, boolean> = {}
    next.forEach((value, key) => {
      obj[key] = value
    })
    set(agentSidePanelOpenBySessionStorageAtom, obj)
  }
)

/** 按 Agent sessionId 读写右栏开合 */
export const agentSidePanelOpenFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => {
      const stored = get(agentSidePanelOpenBySessionStorageAtom)
      return migrateSidePanelOpen(stored[sessionId])
    },
    (_get, set, open: boolean) => {
      set(writeAgentSidePanelOpenBySessionAtom, (prev) => {
        const map = new Map(prev)
        map.set(sessionId, open)
        return map
      })
    }
  )
)

/** jotai store（与 app-mode 同形，避免循环 import） */
type SidePanelChromeStore = ReturnType<typeof createStore>

/**
 * 为指定 Agent 会话设置右栏开合（不必是当前会话）。
 * UI 侧订阅当前会话请继续用 agentSidePanelOpenAtom。
 */
export function setAgentSidePanelOpenForSession(
  store: SidePanelChromeStore,
  sessionId: string,
  open: boolean
): void {
  if (!sessionId) return
  store.set(agentSidePanelOpenFamily(sessionId), open)
}

/** 读取指定会话的右栏是否打开 */
export function getAgentSidePanelOpenForSession(
  store: SidePanelChromeStore,
  sessionId: string
): boolean {
  if (!sessionId) return false
  return store.get(agentSidePanelOpenFamily(sessionId))
}

/**
 * 当前 Agent 会话的右栏开合（读写 facade，兼容旧调用点）。
 * 无当前会话时读 false；写入在无会话时 no-op。
 */
export const agentSidePanelOpenAtom = atom(
  (get) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return false
    return get(agentSidePanelOpenFamily(sessionId))
  },
  (get, set, open: boolean) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(agentSidePanelOpenFamily(sessionId), open)
  }
)

/** 右栏默认宽度（与 right-panel-width DEFAULT_RIGHT_PANEL_WIDTH 对齐，避免 atoms→components 依赖） */
export const DEFAULT_SIDE_PANEL_WIDTH = 380

const SIDE_PANEL_WIDTH_BY_SESSION_KEY = 'tagent-agent-sidepanel-width-by-session'
const LEGACY_SIDE_PANEL_WIDTH_KEY = 'tagent-agent-sidepanel-width'

/** 校验并规范化持久化的右栏宽度 */
export function migrateSidePanelWidth(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : DEFAULT_SIDE_PANEL_WIDTH
}

function readLegacySidePanelWidth(): number | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(LEGACY_SIDE_PANEL_WIDTH_KEY)
    if (raw == null) return undefined
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

/** 按 sessionId 持久化的右栏宽度 */
const agentSidePanelWidthBySessionStorageAtom = atomWithStorage<Record<string, number>>(
  SIDE_PANEL_WIDTH_BY_SESSION_KEY,
  {}
)

const writeAgentSidePanelWidthBySessionAtom = atom(
  null,
  (_get, set, update: (prev: Map<string, number>) => Map<string, number>) => {
    const stored = _get(agentSidePanelWidthBySessionStorageAtom)
    const prev = new Map(
      Object.entries(stored).map(([k, v]) => [k, migrateSidePanelWidth(v)] as const)
    )
    const next = update(prev)
    const obj: Record<string, number> = {}
    next.forEach((value, key) => {
      obj[key] = value
    })
    set(agentSidePanelWidthBySessionStorageAtom, obj)
  }
)

/** 按 Agent sessionId 读写右栏宽度；无 per-session 记录时 fallback 旧全局 key */
export const agentSidePanelWidthFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => {
      const stored = get(agentSidePanelWidthBySessionStorageAtom)
      if (Object.hasOwn(stored, sessionId)) {
        return migrateSidePanelWidth(stored[sessionId])
      }
      return readLegacySidePanelWidth() ?? DEFAULT_SIDE_PANEL_WIDTH
    },
    (_get, set, width: number) => {
      set(writeAgentSidePanelWidthBySessionAtom, (prev) => {
        const map = new Map(prev)
        map.set(sessionId, migrateSidePanelWidth(width))
        return map
      })
    }
  )
)

/**
 * 当前 Agent 会话的右栏宽度（读写 facade，兼容旧调用点）。
 * 无当前会话时读默认宽度；写入在无会话时 no-op。
 */
export const agentSidePanelWidthAtom = atom(
  (get) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return DEFAULT_SIDE_PANEL_WIDTH
    return get(agentSidePanelWidthFamily(sessionId))
  },
  (get, set, width: number) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(agentSidePanelWidthFamily(sessionId), width)
  }
)

/**
 * 展开态占位方式（按会话持久化）：
 * - float：浮在 main 上（可重叠）
 * - dock：真实占列，main 让宽、不重叠
 */
export type AgentSidePanelPlacement = 'float' | 'dock'

export const DEFAULT_SIDE_PANEL_PLACEMENT: AgentSidePanelPlacement = 'float'

const SIDE_PANEL_PLACEMENT_BY_SESSION_KEY = 'tagent-agent-sidepanel-placement-by-session'
const LEGACY_SIDE_PANEL_PLACEMENT_KEY = 'tagent-agent-sidepanel-placement'

/** 校验并规范化持久化的右栏占位方式 */
export function migrateSidePanelPlacement(raw: unknown): AgentSidePanelPlacement {
  return raw === 'float' || raw === 'dock' ? raw : DEFAULT_SIDE_PANEL_PLACEMENT
}

function readLegacySidePanelPlacement(): AgentSidePanelPlacement | undefined {
  if (typeof localStorage === 'undefined') return undefined
  try {
    const raw = localStorage.getItem(LEGACY_SIDE_PANEL_PLACEMENT_KEY)
    if (raw == null) return undefined
    const parsed: unknown = JSON.parse(raw)
    return parsed === 'float' || parsed === 'dock' ? parsed : undefined
  } catch {
    return undefined
  }
}

/** 按 sessionId 持久化的右栏占位方式 */
const agentSidePanelPlacementBySessionStorageAtom = atomWithStorage<
  Record<string, AgentSidePanelPlacement>
>(SIDE_PANEL_PLACEMENT_BY_SESSION_KEY, {})

const writeAgentSidePanelPlacementBySessionAtom = atom(
  null,
  (
    _get,
    set,
    update: (prev: Map<string, AgentSidePanelPlacement>) => Map<string, AgentSidePanelPlacement>
  ) => {
    const stored = _get(agentSidePanelPlacementBySessionStorageAtom)
    const prev = new Map(
      Object.entries(stored).map(([k, v]) => [k, migrateSidePanelPlacement(v)] as const)
    )
    const next = update(prev)
    const obj: Record<string, AgentSidePanelPlacement> = {}
    next.forEach((value, key) => {
      obj[key] = value
    })
    set(agentSidePanelPlacementBySessionStorageAtom, obj)
  }
)

/** 按 Agent sessionId 读写右栏占位；无 per-session 记录时 fallback 旧全局 key */
export const agentSidePanelPlacementFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => {
      const stored = get(agentSidePanelPlacementBySessionStorageAtom)
      if (Object.hasOwn(stored, sessionId)) {
        return migrateSidePanelPlacement(stored[sessionId])
      }
      return readLegacySidePanelPlacement() ?? DEFAULT_SIDE_PANEL_PLACEMENT
    },
    (_get, set, placement: AgentSidePanelPlacement) => {
      set(writeAgentSidePanelPlacementBySessionAtom, (prev) => {
        const map = new Map(prev)
        map.set(sessionId, migrateSidePanelPlacement(placement))
        return map
      })
    }
  )
)

/**
 * 当前 Agent 会话的右栏占位方式（读写 facade，兼容旧调用点）。
 * 无当前会话时读 'float'；写入在无会话时 no-op。
 */
export const agentSidePanelPlacementAtom = atom(
  (get) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return DEFAULT_SIDE_PANEL_PLACEMENT
    return get(agentSidePanelPlacementFamily(sessionId))
  },
  (get, set, placement: AgentSidePanelPlacement) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(agentSidePanelPlacementFamily(sessionId), placement)
  }
)

/**
 * @deprecated 已由 agentSidePanelOpenFamily + 持久化 Map 取代；
 * 保留空 Map 以免旧 import 崩掉。
 */
export const agentSidePanelOpenMapAtom = atom<Map<string, boolean>>(new Map())

/** 侧面板当前 Tab：'project' | 'activity' | 'changes'（per-session Map） */
export const agentDiffPanelTabAtom = atom<Map<string, 'project' | 'activity' | 'changes'>>(
  new Map()
)

/** Diff 视图模式：'split' | 'unified' */
export const agentDiffViewModeAtom = atom<'split' | 'unified'>('split')

/**
 * Diff 刷新版本号 — 按 session + filePath 隔离，Agent 写工具完成时只递增被改文件的版本号。
 *
 * 外层 Map：sessionId → 内层 Map：filePath → 版本号。
 * 同会话内 agent 改 A 文件只 bump A 的版本号，正在看 B 文件的预览不会跟着白屏刷新。
 * git 突变命令拿不到精确文件列表时，对该 session 下所有已记录文件兜底 bump（见 useGlobalAgentListeners）。
 *
 * 注意：bump 存入与 DiffTabContent 取值都必须先经 [[normalizePreviewPath]] 规范化，
 * 否则同一文件因路径写法（大小写/分隔符/相对绝对）不同会 bump 到取不到 = 漏刷。
 */
export const agentDiffRefreshVersionAtom = atom(new Map<string, Map<string, number>>())

/**
 * 规范化预览文件路径，作为 agentDiffRefreshVersionAtom 内层 Map 的 key。
 *
 * 统一为正斜杠 + 小写盘符（Windows 下 C:/... 与 c:/... 视作同一文件），
 * 避免 bump 与取值因路径写法不一致导致漏刷（漏刷比多刷更糟）。
 */
export function normalizePreviewPath(filePath: string): string {
  if (!filePath) return ''
  const forward = filePath.replace(/\\/g, '/')
  // Windows 盘符前缀小写：C:/ → c:/
  return forward.replace(/^([A-Za-z]:)/, (m) => m.toLowerCase())
}

/**
 * 取一个 session 下所有文件版本号的最大值，用作「该会话任意文件被改」的聚合信号。
 *
 * DiffChangesList 这类覆盖整会话改动的列表，只要任意文件被 bump 就需要重新拉取，
 * 用聚合最大值即可（单调递增，任意文件 bump 都会变大）。
 */
export function getSessionDiffRefreshVersion(
  versionMap: Map<string, Map<string, number>>,
  sessionId: string
): number {
  const inner = versionMap.get(sessionId)
  if (!inner || inner.size === 0) return 0
  let max = 0
  for (const v of inner.values()) {
    if (v > max) max = v
  }
  return max
}

/** 当前会话选中的 worktree 路径，null = 默认行为（显示 session 改动） */
export const agentSelectedWorktreeAtom = atom(new Map<string, string | null>())

/** 是否有未查看的代码改动 — 按 session 隔离 */
export const agentDiffUnseenChangesAtom = atom(new Map<string, boolean>())

/** Agent 本轮刚修改但用户尚未查看的文件路径 — 按 session 隔离，Map<sessionId, Set<filePath>> */
export const agentDiffUnseenFilesAtom = atom(new Map<string, Set<string>>())

/**
 * Diff 数据缓存 — 按 session 隔离，存放上一次 IPC 拉取到的未暂存改动结果。
 *
 * 让 DiffChangesList 切走再切回时能立即拿到旧数据渲染（SWR 模式），
 * 避免 mount 时空数组误命中"没有代码改动"分支造成 ~1s 闪烁。
 * 数据新鲜度由 [[agentDiffRefreshVersionAtom]] 触发的后台 fetch 维护，无 TTL。
 */
export const agentDiffDataAtom = atom(new Map<string, UnstagedChangesResult>())

/** 当前会话的侧面板是否打开（仅在有当前会话时为 true 可能） */
export const currentSessionSidePanelOpenAtom = atom<boolean>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return false
  return get(agentSidePanelOpenAtom)
})

/** 当前会话的工作路径 Map — sessionId → path */
export const agentSessionPathMapAtom = atom<Map<string, string>>(new Map())

/**
 * 文件浏览器自动定位信号：当 Agent 调用写入类工具（Write/Edit/MultiEdit/NotebookEdit）时，
 * 设置该 atom；FileBrowser 实例订阅后，若路径落在自身 rootPath 下则展开祖先 + 滚动 + 高亮。
 * `ts` 用于触发同路径的二次脉冲（atom 比对引用）。
 */
export interface FileBrowserAutoReveal {
  sessionId: string
  path: string
  ts: number
  /** 是否同时将文件设为选中态 */
  select?: boolean
}
export const fileBrowserAutoRevealAtom = atom<FileBrowserAutoReveal | null>(null)

/**
 * 最近被 Agent 修改的文件路径（per-session，path → 修改时间戳 ms）。
 * FileBrowser 据此在文件行左侧渲染竖条标记，60s 后自动消失，
 * 用于让用户在错过 0.8s 脉冲后仍能看到「最近修改」状态。
 */
export const recentlyModifiedPathsAtom = atom<Map<string, Map<string, number>>>(new Map())

/** 最近修改标记的存活时间（毫秒） */
export const RECENTLY_MODIFIED_TTL_MS = 60_000

// ===== 权限系统 Atoms =====

/** 新会话默认权限模式 */
export const agentDefaultPermissionModeAtom = atom<TAgentPermissionMode>(
  TAGENT_DEFAULT_PERMISSION_MODE
)

/** Per-session 权限模式 Map — sessionId → TAgentPermissionMode */
export const agentPermissionModeMapAtom = atom<Map<string, TAgentPermissionMode>>(new Map())

/**
 * 按 sessionId 派生该 session 的持久化权限模式。
 * 返回 `undefined`（session 不存在或未设置）或具体的 TAgentPermissionMode 字符串，
 * jotai 用 === 比较，只有值真正变化时才通知下游——避免流式中无关字段更新引发 re-render。
 */
export const sessionPersistedPermissionModeAtom = atomFamily((sessionId: string) =>
  atom((get) => {
    const sessions = get(agentSessionsAtom)
    return sessions.find((s) => s.id === sessionId)?.permissionMode
  })
)

/** 按 sessionId 派生该 session 是否存在于列表中（冷启动判断用） */
export const sessionExistsAtom = atomFamily((sessionId: string) =>
  atom((get) => {
    const sessions = get(agentSessionsAtom)
    return sessions.some((s) => s.id === sessionId)
  })
)

/** Agent 思考模式 */
export const agentThinkingAtom = atom<ThinkingConfig | undefined>(undefined)

/** Agent 推理深度 */
export const agentEffortAtom = atom<AgentEffort | undefined>(undefined)

/** Agent 最大预算（美元/次） */
export const agentMaxBudgetUsdAtom = atom<number | undefined>(undefined)

/** Agent 最大轮次 */
export const agentMaxTurnsAtom = atom<number | undefined>(undefined)

/** 待处理的权限请求 Map — 以 sessionId 为 key，切换会话时保留状态 */
export const allPendingPermissionRequestsAtom = atom<Map<string, readonly PermissionRequest[]>>(
  new Map()
)

type PermissionRequestsUpdate =
  | readonly PermissionRequest[]
  | ((prev: readonly PermissionRequest[]) => readonly PermissionRequest[])

/** 当前会话的权限请求队列（派生读写原子） */
export const pendingPermissionRequestsAtom = atom(
  (get): readonly PermissionRequest[] => {
    const currentId = get(currentAgentSessionIdAtom)
    if (!currentId) return []
    return get(allPendingPermissionRequestsAtom).get(currentId) ?? []
  },
  (get, set, update: PermissionRequestsUpdate) => {
    const currentId = get(currentAgentSessionIdAtom)
    if (!currentId) return
    set(allPendingPermissionRequestsAtom, (prev) => {
      const map = new Map(prev)
      const current = map.get(currentId) ?? []
      const newValue = typeof update === 'function' ? update(current) : update
      if (newValue.length === 0) map.delete(currentId)
      else map.set(currentId, newValue)
      return map
    })
  }
)

/** 待处理的 AskUser 请求 Map — 以 sessionId 为 key，切换会话时保留状态 */
export const allPendingAskUserRequestsAtom = atom<Map<string, readonly AskUserRequest[]>>(new Map())

/** AskUser 单题答案草稿 */
export interface AskUserQuestionDraft {
  selected: string[]
  customText: string
  showCustom: boolean
}

/** AskUser 请求级草稿 — 以 requestId 为 key，组件卸载后仍保留 */
export interface AskUserRequestDraft {
  activeTab: number
  focusedOptIdx: number
  answers: Map<number, AskUserQuestionDraft>
}

/** 待提交 AskUser 草稿 Map — 以 requestId 为 key，切换预览/会话时保留填写进度 */
export const askUserDraftsAtom = atom<Map<string, AskUserRequestDraft>>(new Map())

type AskUserRequestsUpdate =
  | readonly AskUserRequest[]
  | ((prev: readonly AskUserRequest[]) => readonly AskUserRequest[])

/** 当前会话的 AskUser 请求队列（派生读写原子） */
export const pendingAskUserRequestsAtom = atom(
  (get): readonly AskUserRequest[] => {
    const currentId = get(currentAgentSessionIdAtom)
    if (!currentId) return []
    return get(allPendingAskUserRequestsAtom).get(currentId) ?? []
  },
  (get, set, update: AskUserRequestsUpdate) => {
    const currentId = get(currentAgentSessionIdAtom)
    if (!currentId) return
    set(allPendingAskUserRequestsAtom, (prev) => {
      const map = new Map(prev)
      const current = map.get(currentId) ?? []
      const newValue = typeof update === 'function' ? update(current) : update
      if (newValue.length === 0) map.delete(currentId)
      else map.set(currentId, newValue)
      return map
    })
  }
)

/** 待处理的 ExitPlanMode 请求 Map — 以 sessionId 为 key */
export const allPendingExitPlanRequestsAtom = atom<Map<string, readonly ExitPlanModeRequest[]>>(
  new Map()
)

/** 当前处于 Plan 模式的会话 ID 集合 */
export const agentPlanModeSessionsAtom = atom<Set<string>>(new Set<string>())

export const currentAgentSessionAtom = atom<AgentSessionMeta | null>((get) => {
  const sessions = get(agentSessionsAtom)
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return null
  return sessions.find((s) => s.id === currentId) ?? null
})

export const agentStreamingAtom = atom<boolean>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return false
  return get(agentStreamingStatesAtom).get(currentId)?.running ?? false
})

export const agentStreamingContentAtom = atom<string>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return ''
  return get(agentStreamingStatesAtom).get(currentId)?.content ?? ''
})

export const agentToolActivitiesAtom = atom<ToolActivity[]>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return []
  return get(agentStreamingStatesAtom).get(currentId)?.toolActivities ?? []
})

export const agentStreamingModelAtom = atom<string | undefined>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return undefined
  return get(agentStreamingStatesAtom).get(currentId)?.model
})

export const agentRetryingAtom = atom<AgentStreamState['retrying'] | undefined>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return undefined
  return get(agentStreamingStatesAtom).get(currentId)?.retrying
})

export const agentStartedAtAtom = atom<number | undefined>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return undefined
  return get(agentStreamingStatesAtom).get(currentId)?.startedAt
})

export const agentRunningSessionIdsAtom = atom<Set<string>>((get) => {
  const states = get(agentStreamingStatesAtom)
  const ids = new Set<string>()
  for (const [id, state] of states) {
    if (state.running) ids.add(id)
  }
  return ids
})

/** 侧边栏会话指示点状态 */
export type SessionIndicatorStatus = 'idle' | 'running' | 'blocked' | 'completed'

/** 已完成但用户尚未查看的会话 ID 集合 */
export const unviewedCompletedSessionIdsAtom = atom<Set<string>>(new Set<string>())

/** Working 区域"已完成"组：后台完成后暂留，用户确认完成、重新运行或归档/删除时移除 */
export const workingDoneSessionIdsAtom = atom<Set<string>>(new Set<string>())

let lastIndicatorSignature = ''
let lastIndicatorMap = new Map<string, SessionIndicatorStatus>()

function getStableIndicatorMap(
  entries: Array<[string, SessionIndicatorStatus]>
): Map<string, SessionIndicatorStatus> {
  entries.sort(([a], [b]) => a.localeCompare(b))
  const signature = entries.map(([id, status]) => `${id}:${status}`).join('|')
  if (signature === lastIndicatorSignature) return lastIndicatorMap
  lastIndicatorSignature = signature
  lastIndicatorMap = new Map(entries)
  return lastIndicatorMap
}

/** Dock/Launcher 角标数量：未查看完成会话 + 待处理阻塞请求 */
export const dockBadgeCountAtom = atom<number>((get) => {
  return calculateDockBadgeCount({
    unviewedCompletedCount: get(unviewedCompletedSessionIdsAtom).size,
    pendingPermissionCount: countPendingRequests(get(allPendingPermissionRequestsAtom)),
    pendingAskUserCount: countPendingRequests(get(allPendingAskUserRequestsAtom)),
    pendingExitPlanCount: countPendingRequests(get(allPendingExitPlanRequestsAtom)),
  })
})

/**
 * 每个会话的指示点状态（只包含非 idle 的会话）
 * 优先级：blocked > running > completed > idle
 */
export const agentSessionIndicatorMapAtom = atom<Map<string, SessionIndicatorStatus>>((get) => {
  const streamStates = get(agentStreamingStatesAtom)
  const pendingPerms = get(allPendingPermissionRequestsAtom)
  const pendingAskUser = get(allPendingAskUserRequestsAtom)
  const pendingExitPlan = get(allPendingExitPlanRequestsAtom)
  const unviewedCompleted = get(unviewedCompletedSessionIdsAtom)

  const map = new Map<string, SessionIndicatorStatus>()

  for (const [id, state] of streamStates) {
    if (!state.running) continue
    const hasBlock =
      (pendingPerms.get(id)?.length ?? 0) > 0 ||
      (pendingAskUser.get(id)?.length ?? 0) > 0 ||
      (pendingExitPlan.get(id)?.length ?? 0) > 0
    map.set(id, hasBlock ? 'blocked' : 'running')
  }

  for (const id of unviewedCompleted) {
    if (!map.has(id)) {
      map.set(id, 'completed')
    }
  }

  return getStableIndicatorMap(Array.from(map.entries()))
})

/**
 * 处理 AgentEvent 并更新流式状态（纯函数）
 */
export function applyAgentEvent(prev: AgentStreamState, event: AgentEvent): AgentStreamState {
  switch (event.type) {
    case 'text_delta':
      // SubAgent partial 不累积到顶层 state.content：
      // SubAgent 文本走 liveMessagesMap 的 SDKAssistantMessage（含 parent_tool_use_id）单独渲染子气泡，
      // 若此处也累积会导致 SubAgent 输出串到主回复里。
      if (event.parentToolUseId) return prev
      // 顶层 Agent 文本：开始接收 - 清除重试状态（重试成功）
      // text 段开始意味着 thinking 段已结束，清空 thinkingContent 避免与落盘块重复渲染
      return {
        ...prev,
        content: prev.content + event.text,
        thinkingContent: '',
        retrying: undefined,
      }

    case 'text_complete':
      // SubAgent 完整文本走 liveMessagesMap 单独渲染，不覆盖顶层 state.content
      if (event.parentToolUseId) return prev
      // 顶层 Agent：用完整文本替换增量累积的文本（用于回放场景：只需 text_complete 即可重建文本状态）
      return { ...prev, content: event.text, thinkingContent: '' }

    case 'thinking_delta':
      if (event.parentToolUseId) return prev
      return {
        ...prev,
        thinkingContent: (prev.thinkingContent ?? '') + event.text,
        retrying: undefined,
      }

    case 'thinking_complete':
      if (event.parentToolUseId) return prev
      return { ...prev, thinkingContent: event.text }

    case 'tool_start': {
      const existing = prev.toolActivities.find((t) => t.toolUseId === event.toolUseId)
      if (existing) {
        return {
          ...prev,
          toolActivities: prev.toolActivities.map((t) =>
            t.toolUseId === event.toolUseId
              ? {
                  ...t,
                  input: event.input,
                  intent: event.intent || t.intent,
                  displayName: event.displayName || t.displayName,
                }
              : t
          ),
          // 开始工具调用 - 清除重试状态（重试成功）
          retrying: undefined,
        }
      }
      return {
        ...prev,
        // 新工具段开始：清空顶层流式文本，避免跨段累积导致打字机吞字/乱序
        ...(event.parentToolUseId ? {} : { content: '', thinkingContent: '' }),
        toolActivities: [
          ...prev.toolActivities,
          {
            toolUseId: event.toolUseId,
            toolName: event.toolName,
            input: event.input,
            intent: event.intent,
            displayName: event.displayName,
            done: false,
            parentToolUseId: event.parentToolUseId,
          },
        ],
        // 开始工具调用 - 清除重试状态（重试成功）
        retrying: undefined,
      }
    }

    case 'tool_result':
      return {
        ...prev,
        toolActivities: prev.toolActivities.map((t) =>
          t.toolUseId === event.toolUseId
            ? {
                ...t,
                result: event.result,
                isError: event.isError,
                done: true,
                imageAttachments: event.imageAttachments,
              }
            : t
        ),
      }

    case 'task_backgrounded':
      return {
        ...prev,
        toolActivities: prev.toolActivities.map((t) =>
          t.toolUseId === event.toolUseId
            ? { ...t, isBackground: true, taskId: event.taskId, done: true }
            : t
        ),
      }

    case 'task_progress':
      // 普通 tool 计时语义（仅当有真实 elapsedSeconds 时更新）
      if (event.elapsedSeconds != null) {
        return {
          ...prev,
          toolActivities: prev.toolActivities.map((t) =>
            t.toolUseId === event.toolUseId ? { ...t, elapsedSeconds: event.elapsedSeconds! } : t
          ),
        }
      }
      return prev

    case 'task_started': {
      // 查找匹配 toolUseId 的 ToolActivity，更新 intent 和 taskId
      let nextActivities = prev.toolActivities
      if (event.toolUseId) {
        if (prev.toolActivities.some((t) => t.toolUseId === event.toolUseId)) {
          nextActivities = prev.toolActivities.map((t) =>
            t.toolUseId === event.toolUseId
              ? { ...t, intent: event.description, taskId: event.taskId }
              : t
          )
        }
      }
      return { ...prev, toolActivities: nextActivities }
    }

    case 'shell_backgrounded':
      return {
        ...prev,
        toolActivities: prev.toolActivities.map((t) =>
          t.toolUseId === event.toolUseId
            ? { ...t, isBackground: true, shellId: event.shellId, done: true }
            : t
        ),
      }

    case 'shell_killed':
      return prev

    case 'run_resumed':
      return { ...prev, running: true, backgroundWaiting: false }

    case 'task_notification':
      return prev

    case 'thinking_tokens':
      return {
        ...prev,
        thinkingEstimatedTokens: event.estimatedTokens,
      }

    case 'tool_use_summary':
      // 工具使用摘要 — 目前不影响流式状态，仅用于 UI 展示
      return prev

    case 'complete': {
      // 成功完成 — 清除 retrying，设置 running: false
      // 注意：之前保持 running: true 等待 STREAM_COMPLETE IPC，但主进程发送 IPC 前有
      // recordSessionToMemory 等延迟操作，导致 UI 显示"运行中"时间过长。
      // 现在直接在这里设置 running: false，让 UI 立即响应完成状态。
      // STREAM_COMPLETE IPC 仍会处理其他清理工作（如 liveMessages 清理、会话列表刷新等）。
      // token 计数默认只信任流式 usage_update（单条模型调用 ≈ 当轮完整 prompt）。
      // result.usage 是整个 query 内多次 model call 的累计，直接覆盖会虚高（Proma #821）。
      // GLM 等兼容端点无流式 usage 时，才从 result.usage 兜底。
      const needResultFallback = !prev.inputTokens || prev.inputTokens <= 0
      return {
        ...prev,
        running: false,
        ...(event.usage
          ? {
              ...(event.usage.costUsd != null && { costUsd: event.usage.costUsd }),
              ...(event.usage.contextWindow != null && {
                contextWindow: resolveDisplayContextWindow(prev.model, event.usage.contextWindow),
              }),
              ...(event.usage.contextWindow != null && { usageUpdatedAt: Date.now() }),
              ...(needResultFallback &&
                event.usage.inputTokens != null && { inputTokens: event.usage.inputTokens }),
              ...(needResultFallback &&
                event.usage.outputTokens != null && { outputTokens: event.usage.outputTokens }),
              ...(needResultFallback &&
                event.usage.cacheReadTokens != null && {
                  cacheReadTokens: event.usage.cacheReadTokens,
                }),
              ...(needResultFallback &&
                event.usage.cacheCreationTokens != null && {
                  cacheCreationTokens: event.usage.cacheCreationTokens,
                }),
              ...(needResultFallback && { usageUpdatedAt: Date.now() }),
            }
          : {}),
        retrying: undefined,
        ...finalizeStreamingActivities(prev.toolActivities),
      }
    }

    case 'typed_error':
      // 处理类型化错误（TypedError）
      // 停止运行，清除重试状态
      return { ...prev, running: false, retrying: undefined }

    case 'error':
      // 改进：error 事件不再清除 retrying 状态
      // retrying 状态由专用事件控制
      return { ...prev, running: false }

    case 'usage_update':
      return {
        ...prev,
        ...(event.usage.inputTokens != null && { inputTokens: event.usage.inputTokens }),
        ...(event.usage.outputTokens != null && { outputTokens: event.usage.outputTokens }),
        ...(event.usage.cacheReadTokens != null && {
          cacheReadTokens: event.usage.cacheReadTokens,
        }),
        ...(event.usage.cacheCreationTokens != null && {
          cacheCreationTokens: event.usage.cacheCreationTokens,
        }),
        ...(event.usage.costUsd != null && { costUsd: event.usage.costUsd }),
        ...(event.usage.contextWindow &&
          !prev.contextWindow && {
            contextWindow: resolveDisplayContextWindow(prev.model, event.usage.contextWindow),
          }),
        usageUpdatedAt: Date.now(),
      }

    case 'compacting':
      return { ...prev, isCompacting: true, compactInFlight: true }

    case 'compact_complete':
      return { ...prev, isCompacting: false }

    case 'model_resolved':
      // 不用 SDK 返回的实际模型名覆盖，保持用户选择的 modelId
      // 以确保 resolveModelDisplayName 能匹配到渠道配置的显示名
      return prev

    case 'retrying':
      // 向后兼容：保留原有的简单 retrying 事件
      return {
        ...prev,
        retrying: prev.retrying ?? {
          currentAttempt: event.attempt,
          maxAttempts: event.maxAttempts,
          history: [],
          failed: false,
        },
      }

    case 'retry_attempt': {
      // 新增：记录详细的重试尝试
      const currentHistory = prev.retrying?.history ?? []
      return {
        ...prev,
        retrying: {
          currentAttempt: event.attemptData.attempt,
          maxAttempts: prev.retrying?.maxAttempts ?? 3,
          history: [...currentHistory, event.attemptData],
          failed: false,
        },
      }
    }

    case 'retry_cleared':
      // 新增：重试成功，清除状态
      return { ...prev, retrying: undefined }

    case 'retry_failed': {
      // 新增：重试失败，标记为 failed 但保留历史
      const finalHistory = prev.retrying?.history ?? []
      return {
        ...prev,
        running: false,
        retrying: {
          currentAttempt: event.finalAttempt.attempt,
          maxAttempts: prev.retrying?.maxAttempts ?? 3,
          history: [...finalHistory, event.finalAttempt],
          failed: true,
        },
      }
    }

    case 'permission_request':
      // 权限请求事件由 PermissionBanner 处理，不影响流式状态
      return prev

    case 'permission_resolved':
      // 权限解决事件由 PermissionBanner 处理，不影响流式状态
      return prev

    case 'ask_user_request':
      // AskUser 请求事件由 AskUserBanner 处理，不影响流式状态
      return prev

    case 'ask_user_resolved':
      // AskUser 解决事件由 AskUserBanner 处理，不影响流式状态
      return prev

    case 'prompt_suggestion':
      // 提示建议由全局监听器处理，不影响流式状态
      return prev

    default:
      return prev
  }
}

/** 上下文使用量状态 */
export interface AgentContextStatus {
  isCompacting: boolean
  inputTokens?: number
  outputTokens?: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  costUsd?: number
  contextWindow?: number
  usageUpdatedAt?: number
}

/** 当前会话的上下文使用量派生 atom */
export const agentContextStatusAtom = atom<AgentContextStatus>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return { isCompacting: false }
  const state = get(agentStreamingStatesAtom).get(currentId)
  return {
    isCompacting: state?.isCompacting ?? false,
    inputTokens: state?.inputTokens,
    outputTokens: state?.outputTokens,
    cacheReadTokens: state?.cacheReadTokens,
    cacheCreationTokens: state?.cacheCreationTokens,
    costUsd: state?.costUsd,
    contextWindow: state?.contextWindow,
    usageUpdatedAt: state?.usageUpdatedAt,
  }
})

// ============================================================================
// Token 统计与缓存命中率（P3 阶段）
// ============================================================================

/** 会话级别的累计 token 统计 */
export interface SessionTokenStats {
  /** 累计输入 token（含缓存读取） */
  totalInputTokens: number
  /** 累计输出 token */
  totalOutputTokens: number
  /** 累计缓存读取 token */
  totalCacheReadTokens: number
  /** 累计缓存写入 token */
  totalCacheCreationTokens: number
  /** 累计费用（美元） */
  totalCostUsd: number
  /** 累计 turn 数 */
  turnCount: number
  /** 最近一轮 Agent 调用明细 */
  lastCallStats?: AgentCallStats
}

/** 所有会话的累计 token 统计 Map — 以 sessionId 为 key */
export const sessionTokenStatsAtom = atom<Map<string, SessionTokenStats>>(new Map())

/** 当前会话的累计 token 统计（派生） */
export const currentSessionTokenStatsAtom = atom<SessionTokenStats>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) {
    return {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheCreationTokens: 0,
      totalCostUsd: 0,
      turnCount: 0,
    }
  }
  return (
    get(sessionTokenStatsAtom).get(currentId) ?? {
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheCreationTokens: 0,
      totalCostUsd: 0,
      turnCount: 0,
    }
  )
})

/** 缓存读取占比（派生）— totalCacheReadTokens / totalInputTokens（含跨会话 Prompt Cache） */
export const cacheHitRateAtom = atom<number | null>((get) => {
  const stats = get(currentSessionTokenStatsAtom)
  if (stats.totalInputTokens === 0) return null
  return stats.totalCacheReadTokens / stats.totalInputTokens
})

/** 成本明细（派生）— 按 input/output/cache 分解 */
export interface CostBreakdown {
  /** 输入成本（不含缓存） */
  inputCostUsd: number
  /** 输出成本 */
  outputCostUsd: number
  /** 缓存读取成本（节省的成本） */
  cacheReadCostUsd: number
  /** 缓存写入成本 */
  cacheCreationCostUsd: number
  /** 总成本 */
  totalCostUsd: number
}

/** 成本明细派生 atom */
export const costBreakdownAtom = atom<CostBreakdown>((get) => {
  const stats = get(currentSessionTokenStatsAtom)
  // TODO: 按模型定价计算实际成本，这里先用总成本作为占位
  // 目前 SDK 只返回 totalCostUsd，没有细分成本
  return {
    inputCostUsd: 0, // 待模型定价数据
    outputCostUsd: 0, // 待模型定价数据
    cacheReadCostUsd: 0, // 待模型定价数据
    cacheCreationCostUsd: 0, // 待模型定价数据
    totalCostUsd: stats.totalCostUsd,
  }
})

/**
 * Agent 流式错误消息 Map — 以 sessionId 为 key
 * 错误发生时写入，下次发送或手动关闭时清除
 */
export const agentStreamErrorsAtom = atom<Map<string, string>>(new Map())

/**
 * Agent 消息刷新版本 Map — 以 sessionId 为 key
 * 全局监听器在流式完成/错误时递增版本号，
 * AgentView 监听版本号变化来重新加载消息。
 */
export const agentMessageRefreshAtom = atom<Map<string, number>>(new Map())

/**
 * 持久化 SDKMessage 的内存缓存 Map — 以 sessionId 为 key
 * 用于消除「切换会话时先清空 → 等待 IPC 全量读盘」的可见空窗：
 * 命中缓存可立即填充消息区，IPC 返回后再覆盖为最新数据。
 *
 * 内存安全：缓存条目随会话数增长会无限膨胀（长会话的消息数组很大），
 * 因此通过 setSessionMessagesCache 做 LRU 淘汰，仅保留最近访问的
 * AGENT_MSG_CACHE_MAX 个会话；会话删除时也需主动剔除对应条目。
 */
export const AGENT_MSG_CACHE_MAX = 20
export const agentSDKMessagesCacheAtom = atom<Map<string, SDKMessage[]>>(new Map())

/**
 * 写入会话消息缓存并执行 LRU 淘汰。
 * 利用 JS Map 的插入顺序：删除已存在的 key 再重新 set，使其移到「最新」位置；
 * 超出上限时从头部（最旧）删除，直到回到上限内。返回新的 Map（不可变更新）。
 */
export function setSessionMessagesCache(
  prev: Map<string, SDKMessage[]>,
  sessionId: string,
  messages: SDKMessage[]
): Map<string, SDKMessage[]> {
  const next = new Map(prev)
  next.delete(sessionId)
  next.set(sessionId, messages)
  while (next.size > AGENT_MSG_CACHE_MAX) {
    const oldest = next.keys().next().value
    if (oldest === undefined) break
    next.delete(oldest)
  }
  return next
}

/** 当前 Agent 会话的错误消息（派生只读原子） */
export const currentAgentErrorAtom = atom<string | null>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return null
  return get(agentStreamErrorsAtom).get(currentId) ?? null
})

/**
 * Agent 会话输入框草稿 Map — 以 sessionId 为 key
 * 用于在切换会话时保留输入框内容
 */
export const agentSessionDraftsAtom = atom<Map<string, string>>(new Map())

/** 单个 session 的 markdown 草稿派生 atom — 按 sessionId 切片订阅 */
export const agentSessionDraftAtomFamily = atomFamily((sessionId: string) =>
  atom((get) => get(agentSessionDraftsAtom).get(sessionId) ?? '')
)

/**
 * Agent 会话输入框 HTML 草稿 Map — 以 sessionId 为 key
 * 保存 TipTap 编辑器的原始 HTML，用于切换会话时恢复 mention 等富文本节点
 */
export const agentSessionDraftHtmlAtom = atom<Map<string, string>>(new Map())

/** 单个 session 的 HTML 草稿派生 atom — 按 sessionId 切片订阅 */
export const agentSessionDraftHtmlAtomFamily = atomFamily((sessionId: string) =>
  atom((get) => get(agentSessionDraftHtmlAtom).get(sessionId) ?? '')
)

/**
 * 单个 session 是否有草稿文本（boolean 派生 atom）
 *
 * 性能优化（2026-07-05）：AgentView 之前订阅 inputContent（string），每次按键都 re-render
 * 整个 AgentView（3000+ 行组件树，含 AgentMessages / TokenStatsPanel / 工具栏）。
 * 改用 hasDraft（boolean）后，只在 empty↔non-empty 切换时变化一次，打字时不触发 re-render。
 * 真正的 inputContent 订阅移到 RichTextInputWrapper 内部，仅输入框自己 re-render。
 */
export const agentSessionHasDraftAtomFamily = atomFamily((sessionId: string) =>
  atom((get) => {
    const text = get(agentSessionDraftsAtom).get(sessionId) ?? ''
    return text.trim().length > 0
  })
)

/**
 * 会话附加目录 Map — 以 sessionId 为 key
 * 存储每个会话通过"附加文件夹"功能关联的外部目录路径列表。
 * 这些路径作为 SDK additionalDirectories 参数传递。
 */
export const agentAttachedDirectoriesMapAtom = atom<Map<string, string[]>>(new Map())

/**
 * 会话附加文件 Map — 以 sessionId 为 key
 * 存储每个会话通过"附加文件"功能关联的外部文件路径列表。
 */
export const agentAttachedFilesMapAtom = atom<Map<string, string[]>>(new Map())

/**
 * 工作区级附加目录列表（按 workspaceId 存储）
 *
 * 工作区内所有会话共享这些附加目录。
 */
export const workspaceAttachedDirectoriesMapAtom = atom<Map<string, string[]>>(new Map())

/**
 * 工作区级附加文件列表（按 workspaceId 存储）
 *
 * 工作区内所有会话共享这些附加文件。
 */
export const workspaceAttachedFilesMapAtom = atom<Map<string, string[]>>(new Map())

/** 当前 Agent 会话的草稿内容（派生读写原子） */
export const currentAgentSessionDraftAtom = atom(
  (get) => {
    const currentId = get(currentAgentSessionIdAtom)
    if (!currentId) return ''
    return get(agentSessionDraftsAtom).get(currentId) ?? ''
  },
  (get, set, newDraft: string) => {
    const currentId = get(currentAgentSessionIdAtom)
    if (!currentId) return
    set(agentSessionDraftsAtom, (prev) => {
      const map = new Map(prev)
      if (newDraft.trim() === '') {
        map.delete(currentId)
      } else {
        map.set(currentId, newDraft)
      }
      return map
    })
  }
)

// ===== 提示建议 Atoms =====

/** Agent 提示建议 Map — 以 sessionId 为 key，存储最近一条建议 */
export const agentPromptSuggestionsAtom = atom<Map<string, string>>(new Map())

/** 当前 Agent 会话的提示建议（派生只读原子） */
export const currentAgentSuggestionAtom = atom<string | null>((get) => {
  const currentId = get(currentAgentSessionIdAtom)
  if (!currentId) return null
  return get(agentPromptSuggestionsAtom).get(currentId) ?? null
})

// ===== 后台任务管理 =====

/**
 * 后台任务数据结构
 *
 * 用于 ActiveTasksBar 显示运行中的 Agent 任务和 Shell 任务。
 */
export interface BackgroundTask {
  /** 任务或 Shell ID */
  id: string
  /** 任务类型 */
  type: 'agent' | 'shell'
  /** 关联的工具调用 ID（用于滚动定位到实时工具调用） */
  toolUseId: string
  /** 任务开始时间戳 */
  startTime: number
  /** 已耗时（秒） */
  elapsedSeconds: number
  /** 任务意图/描述 */
  intent?: string
}

/**
 * 后台任务列表原子家族
 *
 * 按 sessionId 隔离，每个会话独立管理后台任务。
 * 任务完成后从列表中移除（只显示运行中任务）。
 */
export const backgroundTasksAtomFamily = atomFamily((_sessionId: string) =>
  atom<BackgroundTask[]>([])
)

// ===== 用户打断状态 =====

/** 被用户手动打断的会话集合（仅当前 streaming 周期有效，reload 后清除） */
export const stoppedByUserSessionsAtom = atom<Set<string>>(new Set<string>())

// ===== 初始化就绪状态 =====

/** AgentSettingsInitializer 是否已完成加载（渠道/工作区/设置全部就绪） */
export const agentSettingsReadyAtom = atom(false)

// ===== SubAgent 派发策略 =====

/** 主 Agent 派发 SubAgent 的积极性档位（用户控制） */
export type SubagentEagerness = 'never' | 'conservative' | 'balanced' | 'aggressive'

/**
 * 默认 conservative — 跟 TAgent 历史行为一致，最稳。
 *
 * 存储路径：跟其他 Agent 设置一样走 `AppSettings` (写到 `~/.tagent/settings.json`)，
 * 渲染端 AgentSettingsInitializer 启动时从主进程拉一次。
 * 主进程 orchestrator 在 buildSystemPrompt 时直接读 `getSettings().subagentEagerness`。
 *
 * 改档位后，Agent 主 prompt 会动态注入对应的派发策略段。
 */
export const subagentEagernessAtom = atom<SubagentEagerness>('conservative')

// ===== 从 chat-atoms 迁移的共享状态 =====

/** 对话列表（兼容旧会话数据） */
export const conversationsAtom = atom<ConversationMeta[]>([])

// ===== 文件活动追踪 =====

/** 会话级已读文件路径（sessionId → paths） */
export const sessionReadFilesAtom = atom<Map<string, string[]>>(new Map())

/** 会话级已改文件路径（sessionId → paths） */
export const sessionChangedFilesAtom = atom<Map<string, string[]>>(new Map())

// ===== 消息排队队列 =====

/**
 * Agent 运行中待发送消息队列 Map — 以 sessionId 为 key。
 * 队列只保存在渲染进程内存中，避免跨重启恢复时误把过期上下文继续发送。
 */
export const agentSessionMessageQueueAtom = atom<Map<string, AgentQueuedMessage[]>>(new Map())

/**
 * 单个 session 的队列派生 atom（读写）。
 * 空队列写回时删除 Map entry，避免长时间使用后残留空数组。
 */
export const agentMessageQueueAtomFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => get(agentSessionMessageQueueAtom).get(sessionId) ?? [],
    (
      _get,
      set,
      update: AgentQueuedMessage[] | ((prev: AgentQueuedMessage[]) => AgentQueuedMessage[])
    ) => {
      set(agentSessionMessageQueueAtom, (prev) => {
        const current = prev.get(sessionId) ?? []
        const next = typeof update === 'function' ? update(current) : update
        const map = new Map(prev)
        if (next.length === 0) {
          map.delete(sessionId)
        } else {
          map.set(sessionId, next)
        }
        return map
      })
    }
  )
)

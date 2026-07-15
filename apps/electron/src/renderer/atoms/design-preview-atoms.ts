/**
 * Design Preview Atoms — Design Preview 画布状态管理
 *
 * v2 设计：docs/plans/2026-07-14-design-canvas-v2.md
 * v1 已被本页完全替代，原设计文档保留为历史参考：
 * docs/plans/2026-07-13-design-preview-design.md
 *
 * 会话隔离：所有画布状态按 Agent 会话（sessionId）隔离。
 *
 * 核心能力：
 * - HTML/CSS 实时预览（设备框 + 缩放 + 平移）
 * - DOM 元素追踪：data-design-id、分层树、点选、框选
 * - "指着说话"：选中元素 → 预填 chat prompt（不自动发送）
 * - 版本快照：每版自动建快照，可回看、可换基线
 * - 外部导入：HTML / Figma ZIP / 截图 → 进画布
 */

import { atom } from 'jotai'
import { atomFamily, atomWithStorage } from 'jotai/utils'

import { currentAgentSessionIdAtom } from './agent-atoms'

/** 设备类型 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop'

/** 设备尺寸预设 */
export const DEVICE_PRESETS: Record<DeviceType, { width: number; height: number; label: string }> = {
  mobile: { width: 390, height: 844, label: 'Mobile' },
  tablet: { width: 768, height: 1024, label: 'Tablet' },
  desktop: { width: 1280, height: 800, label: 'Desktop' },
}

/** 框选区域（基于设备视口坐标） */
export interface SelectionRegion {
  x: number
  y: number
  width: number
  height: number
}

/** 画布视口偏移 */
export interface DesignViewport {
  panX: number
  panY: number
}

// ==================== v2: 元素追踪 / 分层 / 选中 ====================

/** 注入到 iframe 内 DOM 元素上的设计 id 命名空间 */
export const DESIGN_ID_ATTR = 'data-design-id' as const

/** 单个可识别元素的元数据（iframe 内部采集，postMessage 推回父窗口） */
export interface CanvasElement {
  /** 形如 d-1、d-2… */
  id: string
  /** tagName 大写 */
  tag: string
  /** 元素文本（去除空白后截断 80 字符） */
  text: string
  /** 元素的语义角色（button/input/img/heading/text/link/container/none） */
  role: CanvasElementRole
  /** 元素的 class 名（前 5 个） */
  className?: string
  /** CSS 选择器路径（如 div.page > form > button.login-btn:nth-child(2)） */
  selector?: string
  /** 父元素 id；根 body 元素 parentId 为 null */
  parentId: string | null
  /** 子元素 id 列表（按文档顺序） */
  childIds: string[]
  /** 元素在 iframe 视口内的 bounding rect（CSS px） */
  bounds: { x: number; y: number; width: number; height: number }
}

export type CanvasElementRole =
  | 'button'
  | 'input'
  | 'image'
  | 'heading'
  | 'text'
  | 'link'
  | 'container'
  | 'none'

/** iframe → 父窗口的 postMessage 协议 */
export type CanvasFrameMessage =
  | { type: 'layers:report'; layers: CanvasElement[] }
  | { type: 'element:clicked'; id: string | null; bounds: CanvasElement['bounds'] | null; additive: boolean }
  | { type: 'element:hovered'; id: string | null }
  | { type: 'element:rect-select'; rect: SelectionRegion; hits: string[] }
  | { type: 'iframe:ready' }
  /** 中键按下：任意模式都可从 iframe 内发起画布平移（screen 坐标跨帧一致） */
  | { type: 'pan:start'; screenX: number; screenY: number }
  | { type: 'pan:move'; screenX: number; screenY: number }
  | { type: 'pan:end' }

/** 父窗口 → iframe 的 postMessage 协议 */
export type CanvasFrameCommand =
  | { type: 'highlight:set'; ids: string[] }
  | { type: 'highlight:clear' }
  | { type: 'layers:rescan' }
  | { type: 'mode:set'; mode: 'select' | 'interact' | 'pan' }

/** 单个会话的 Design Preview 状态 */
export interface DesignSessionState {
  html: string | null
  css: string | null
  device: DeviceType
  zoom: number
  selection: SelectionRegion | null
  /** v2: 当前选中的元素 id 列表（来自 DOM 追踪） */
  selectedElementIds: string[]
  /** v2: 当前 iframe 内采集到的全部 layers（最近一次同步） */
  layers: CanvasElement[]
  /** v2: 鼠标 hover 的元素 id（仅高亮用，不入选中集） */
  hoveredElementId: string | null
  /** v2: 版本快照列表（按版本号升序） */
  snapshots: DesignSnapshot[]
  /** v2: 用户当前查看的历史快照 id；如果为 null 表示看最新 */
  activeSnapshotId: string | null
  enabled: boolean
  version: number
  viewport: DesignViewport
  /**
   * 放大模式（原 fullscreen）：画布放大覆盖主内容区，仍保留左侧导航浮岛。
   * UI 文案用「放大」，字段名保留 fullscreen 以兼容 localStorage。
   */
  fullscreen: boolean
  /** 沉浸全屏：隐藏 left rail / sidebar / tabs，只留会话 + 画布 */
  immersive: boolean
  /** 沉浸全屏下隐藏会话面板（纯画布） */
  immersiveHideChat: boolean
}

/** 单个版本快照 */
export interface DesignSnapshot {
  id: string
  version: number
  html: string
  css: string | null
  /** 触发该版本的用户消息摘要（best-effort） */
  triggerMessage?: string
  createdAt: number
}

/** 默认会话状态 */
const DEFAULT_SESSION_STATE: DesignSessionState = {
  html: null,
  css: null,
  device: 'desktop',
  zoom: 1.0,
  selection: null,
  selectedElementIds: [],
  layers: [],
  hoveredElementId: null,
  snapshots: [],
  activeSnapshotId: null,
  enabled: false,
  version: 0,
  viewport: { panX: 0, panY: 0 },
  fullscreen: false,
  immersive: false,
  immersiveHideChat: false,
}

// ==================== 持久化存储 ====================

/** localStorage key */
const DESIGN_SESSION_STORAGE_KEY = 'tagent-design-sessions'

/**
 * 把反序列化的对象补齐 v2 字段并把坏字段归零。
 * 这是 schema migration：localStorage 里的旧 v1 数据没有 selectedElementIds 等字段。
 * 不做这一步，第一次读老数据就会因为 .map is not a function 而 crash。
 */
function migrateSessionState(raw: unknown): DesignSessionState {
  const v = (raw ?? {}) as Partial<DesignSessionState> & Record<string, unknown>
  return {
    html: typeof v.html === 'string' ? v.html : null,
    css: typeof v.css === 'string' ? v.css : null,
    device:
      v.device === 'mobile' || v.device === 'tablet' || v.device === 'desktop' ? v.device : 'desktop',
    zoom: typeof v.zoom === 'number' ? v.zoom : 1.0,
    selection:
      v.selection && typeof v.selection === 'object' && 'x' in v.selection
        ? (v.selection as SelectionRegion)
        : null,
    selectedElementIds: Array.isArray(v.selectedElementIds)
      ? (v.selectedElementIds as string[])
      : [],
    layers: Array.isArray(v.layers) ? (v.layers as CanvasElement[]) : [],
    hoveredElementId:
      typeof v.hoveredElementId === 'string' || v.hoveredElementId === null
        ? (v.hoveredElementId as string | null)
        : null,
    snapshots: Array.isArray(v.snapshots) ? (v.snapshots as DesignSnapshot[]) : [],
    activeSnapshotId:
      typeof v.activeSnapshotId === 'string' || v.activeSnapshotId === null
        ? (v.activeSnapshotId as string | null)
        : null,
    enabled: typeof v.enabled === 'boolean' ? v.enabled : false,
    version: typeof v.version === 'number' ? v.version : 0,
    viewport:
      v.viewport && typeof v.viewport === 'object' && 'panX' in v.viewport
        ? (v.viewport as DesignViewport)
        : { panX: 0, panY: 0 },
    fullscreen: typeof v.fullscreen === 'boolean' ? v.fullscreen : false,
    immersive: typeof v.immersive === 'boolean' ? v.immersive : false,
    immersiveHideChat: typeof v.immersiveHideChat === 'boolean' ? v.immersiveHideChat : false,
  }
}

/**
 * 基础存储 atom：自动持久化到 localStorage。
 */
const designSessionStatesStorageAtom = atomWithStorage<
  Record<string, DesignSessionState>
>(DESIGN_SESSION_STORAGE_KEY, {})

/**
 * 写入会话状态 Map 并同步到 localStorage。
 */
export const writeSessionStatesAtom = atom(
  null,
  (_get, set, update: (prev: Map<string, DesignSessionState>) => Map<string, DesignSessionState>) => {
    const stored = _get(designSessionStatesStorageAtom)
    const prev = new Map(Object.entries(stored))
    const next = update(prev)
    const obj: Record<string, DesignSessionState> = {}
    next.forEach((value, key) => { obj[key] = value })
    set(designSessionStatesStorageAtom, obj)
  }
)

/**
 * 所有会话的 Design Preview 状态 Map（从 localStorage 恢复）
 */
export const designSessionStatesAtom = atom<Map<string, DesignSessionState>>(
  (get) => {
    const stored = get(designSessionStatesStorageAtom)
    const entries = Object.entries(stored).map(([k, v]) => [k, migrateSessionState(v)] as const)
    return new Map(entries)
  }
)

/** 按 sessionId 获取会话状态的 atomFamily */
export const designSessionStateFamily = atomFamily((sessionId: string) =>
  atom(
    (get) => get(designSessionStatesAtom).get(sessionId) ?? DEFAULT_SESSION_STATE,
    (_get, set, update: Partial<DesignSessionState> | ((prev: DesignSessionState) => DesignSessionState)) => {
      set(writeSessionStatesAtom, (prev) => {
        const current = prev.get(sessionId) ?? DEFAULT_SESSION_STATE
        const next = typeof update === 'function' ? update(current) : { ...current, ...update }
        const map = new Map(prev)
        map.set(sessionId, next)
        return map
      })
    }
  )
)

// ==================== 当前会话派生 Atom ====================

/** 当前会话的完整 Design Preview 状态 */
export const currentDesignSessionAtom = atom<DesignSessionState>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return DEFAULT_SESSION_STATE
  return get(designSessionStateFamily(sessionId))
})

// ==================== 字段级读写 Atom（自动路由到当前会话） ====================

/** 当前会话的 HTML 内容 */
export const designHtmlAtom = atom(
  (get) => get(currentDesignSessionAtom).html ?? null,
  (get, set, html: string | null) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { html } as Partial<DesignSessionState>)
  }
)

/** 当前会话的 CSS 内容 */
export const designCssAtom = atom(
  (get) => get(currentDesignSessionAtom).css ?? null,
  (get, set, css: string | null) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { css } as Partial<DesignSessionState>)
  }
)

/** 当前会话的设备类型 */
export const designDeviceAtom = atom(
  (get) => get(currentDesignSessionAtom).device,
  (get, set, device: DeviceType) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { device, selection: null } as Partial<DesignSessionState>)
  }
)

/** 当前会话的缩放比例 */
export const designZoomAtom = atom(
  (get) => get(currentDesignSessionAtom).zoom,
  (get, set, zoom: number) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    const clamped = Math.max(0.25, Math.min(2.0, zoom))
    set(designSessionStateFamily(sessionId), { zoom: clamped } as Partial<DesignSessionState>)
  }
)

/** 当前会话的框选区域 */
export const designSelectionAtom = atom(
  (get) => get(currentDesignSessionAtom).selection,
  (get, set, selection: SelectionRegion | null) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { selection } as Partial<DesignSessionState>)
  }
)

/** 当前会话的启用状态 */
export const designEnabledAtom = atom(
  (get) => get(currentDesignSessionAtom).enabled,
  (get, set, enabled: boolean) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { enabled } as Partial<DesignSessionState>)
  }
)

/** 当前会话的渲染版本号 */
export const designVersionAtom = atom(
  (get) => get(currentDesignSessionAtom).version,
  (get, set, version: number) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { version } as Partial<DesignSessionState>)
  }
)

/** 当前会话的画布视口 */
export const designViewportAtom = atom(
  (get) => {
    const state = get(currentDesignSessionAtom)
    return state?.viewport ?? { panX: 0, panY: 0 }
  },
  (get, set, viewport: DesignViewport) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { viewport } as Partial<DesignSessionState>)
  }
)

/** 放大模式（原 fullscreen）：画布放大覆盖主内容区，仍保留左侧导航 */
export const designFullscreenAtom = atom(
  (get) => {
    const state = get(currentDesignSessionAtom)
    return state?.fullscreen ?? false
  },
  (get, set, fullscreen: boolean) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { fullscreen } as Partial<DesignSessionState>)
  }
)

/** 沉浸全屏：隐藏壳层导航与标签，只显示会话 + 画布 */
export const designImmersiveAtom = atom(
  (get) => get(currentDesignSessionAtom).immersive ?? false,
  (get, set, immersive: boolean) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), {
      immersive,
      // 进入沉浸时默认显示会话；退出时清掉隐藏态
      ...(immersive ? { immersiveHideChat: false, fullscreen: false } : { immersiveHideChat: false }),
    } as Partial<DesignSessionState>)
  }
)

/** 沉浸全屏下是否隐藏会话（纯画布） */
export const designImmersiveHideChatAtom = atom(
  (get) => get(currentDesignSessionAtom).immersiveHideChat ?? false,
  (get, set, hide: boolean) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { immersiveHideChat: hide } as Partial<DesignSessionState>)
  }
)

/** 派生 atom：完整 Design Canvas 状态 */
export const designCanvasStateAtom = atom<DesignSessionState>((get) => get(currentDesignSessionAtom))

// ==================== v2 字段级读写 Atom ====================

/** 当前选中的元素 id 列表（支持直接赋值或 updater 回调） */
export const selectedElementIdsAtom = atom(
  (get) => get(currentDesignSessionAtom).selectedElementIds ?? [],
  (get, set, ids: string[] | ((prev: string[]) => string[])) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    const prev = get(designSessionStateFamily(sessionId)).selectedElementIds ?? []
    const next = typeof ids === 'function' ? ids(prev) : ids
    set(designSessionStateFamily(sessionId), { selectedElementIds: next } as Partial<DesignSessionState>)
  }
)

/** 当前 iframe 内采集到的 layers */
export const canvasLayersAtom = atom(
  (get) => get(currentDesignSessionAtom).layers ?? [],
  (get, set, layers: CanvasElement[]) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { layers } as Partial<DesignSessionState>)
  }
)

/** hover 中的元素 id */
export const hoveredElementIdAtom = atom(
  (get) => get(currentDesignSessionAtom).hoveredElementId ?? null,
  (get, set, id: string | null) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { hoveredElementId: id } as Partial<DesignSessionState>)
  }
)

/** 版本快照列表 */
export const designSnapshotsAtom = atom(
  (get) => get(currentDesignSessionAtom).snapshots ?? [],
  (get, set, snapshots: DesignSnapshot[]) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { snapshots } as Partial<DesignSessionState>)
  }
)

/** 用户当前查看的快照 id（null = 看最新） */
export const activeSnapshotIdAtom = atom(
  (get) => get(currentDesignSessionAtom).activeSnapshotId ?? null,
  (get, set, id: string | null) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    set(designSessionStateFamily(sessionId), { activeSnapshotId: id } as Partial<DesignSessionState>)
  }
)

/** 每会话最多保留的快照数（环形） */
const MAX_SNAPSHOTS_PER_SESSION = 50

/**
 * appendSnapshotAtom — 命令式建快照（v2.1）
 *
 * 与旧 useVersionSnapshotWatcher 的关键差异：
 *  - 显式命令式触发，不再依赖 effect 嗅探（避免 HMR/重渲染抖动导致清空）
 *  - 内部去重：与最后一个快照内容一致就跳过
 *  - 50 上限滚动丢弃最早的
 *
 * 调用方在 setDesignHtmlAtom / setDesignCssAtom / promoteSnapshotToCurrent 中调用。
 */
export const appendSnapshotAtom = atom(
  null,
  (
    get,
    set,
    payload: { html: string; css: string | null; trigger?: string },
  ) => {
    const sessionId = get(currentAgentSessionIdAtom)
    if (!sessionId) return
    const cur = get(designSnapshotsAtom)
    const last = cur[cur.length - 1]
    if (last && last.html === payload.html && (last.css ?? null) === payload.css) {
      return
    }
    const snapshot: DesignSnapshot = {
      id: 'snap-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8),
      version: cur.length + 1,
      html: payload.html,
      css: payload.css,
      triggerMessage: payload.trigger,
      createdAt: Date.now(),
    }
    const next = [...cur, snapshot]
    const trimmed =
      next.length > MAX_SNAPSHOTS_PER_SESSION
        ? next.slice(next.length - MAX_SNAPSHOTS_PER_SESSION)
        : next
    set(designSnapshotsAtom, trimmed)
  },
)

// ==================== 写入操作（基于当前会话） ====================

/**
 * 设置 HTML 内容（Agent 生成后调用）
 *
 * v2.1 行为：写入后自动 append snapshot（去重由 appendSnapshotAtom 内部做）。
 */
export const setDesignHtmlAtom = atom(null, (get, set, payload: { html: string; css?: string }) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return
  set(designSessionStateFamily(sessionId), (prev) => ({
    ...prev,
    html: payload.html,
    css: payload.css !== undefined ? payload.css : prev.css,
    selection: null,
    version: prev.version + 1,
  }))
  // 自动追加快照：appendSnapshotAtom 内部会去重、与最后一个快照一致就跳过
  const css = payload.css ?? get(designCssAtom)
  set(appendSnapshotAtom, { html: payload.html, css: css ?? null })
})

/** 切换设备类型 */
export const setDesignDeviceAtom = atom(null, (get, set, device: DeviceType) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return
  set(designSessionStateFamily(sessionId), { device, selection: null } as Partial<DesignSessionState>)
})

/** 设置缩放 */
export const setDesignZoomAtom = atom(null, (get, set, zoom: number) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return
  const clamped = Math.max(0.25, Math.min(2.0, zoom))
  set(designSessionStateFamily(sessionId), { zoom: clamped } as Partial<DesignSessionState>)
})

/** 设置框选区域 */
export const setDesignSelectionAtom = atom(null, (get, set, region: SelectionRegion | null) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return
  set(designSessionStateFamily(sessionId), { selection: region } as Partial<DesignSessionState>)
})

/** 清空当前会话的 Design Canvas */
export const clearDesignCanvasAtom = atom(null, (get, set) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return
  set(designSessionStateFamily(sessionId), DEFAULT_SESSION_STATE)
})

/** 启用/禁用 Design 模式 */
export const toggleDesignEnabledAtom = atom(null, (get, set, enabled?: boolean) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return
  const current = get(designSessionStateFamily(sessionId))
  set(designSessionStateFamily(sessionId), { enabled: enabled ?? !current.enabled } as Partial<DesignSessionState>)
})

/** 强制刷新画布 */
export const refreshDesignCanvasAtom = atom(null, (get, set) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return
  const current = get(designSessionStateFamily(sessionId))
  set(designSessionStateFamily(sessionId), { version: current.version + 1 } as Partial<DesignSessionState>)
})

/** 重置视口 */
export const resetDesignViewportAtom = atom(null, (get, set) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return
  set(designSessionStateFamily(sessionId), { viewport: { panX: 0, panY: 0 } } as Partial<DesignSessionState>)
})

// ==================== 全局（不绑定会话） ====================

export interface DesignSuggestion {
  confidence: 'high' | 'medium' | 'low'
  matchedKeywords: string[]
  label: string
}

export const designSuggestionAtom = atom<DesignSuggestion | null>(null)

export type DesignCanvasTool = 'pan' | 'select' | 'interact'

/** 默认进入画布为交互模式（可点击原型）；选择 / 平移需手动切换 */
export const designActiveToolAtom = atom<DesignCanvasTool>('interact')

// ==================== 预留扩展字段 ====================

export interface CanvasShape {
  id: string
  type: string
  name: string
  bounds: { x: number; y: number; width: number; height: number }
  _future?: Record<string, unknown>
}

export interface DesignDocument {
  id: string
  title: string
  objects: Record<string, CanvasShape>
  _future?: Record<string, unknown>
}

export interface DesignToken {
  name: string
  kind: 'color' | 'typography' | 'spacing'
  value: unknown
}

export interface DesignSystem {
  tokens: Record<string, DesignToken>
  components: Record<string, unknown>
  _future?: Record<string, unknown>
}

export interface DesignContextForAgent {
  designModeEnabled: boolean
  htmlSummary?: string
  device: DeviceType
  userSelection?: {
    region: SelectionRegion
    screenshot?: string
    elementText?: string
    elementTag?: string
    /** v2.2: CSS 选择器路径 */
    selector?: string
    /** v2.2: 选中的元素结构化列表 */
    elements?: Array<{
      id: string
      tag: string
      text: string
      role: string
      className?: string
      selector?: string
      bounds: { x: number; y: number; width: number; height: number }
    }>
  }
  _future?: {
    surfaces?: unknown[]
    designSystem?: DesignSystem
    document?: DesignDocument
  }
}
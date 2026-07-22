/**
 * Preview Atoms — 内联预览/Diff 面板状态管理
 *
 * 每个 Agent 会话拥有独立的预览面板状态（选中文件、开关）。
 */

import { atom } from 'jotai'
import { atomWithStorage } from 'jotai/utils'

import { currentAgentSessionIdAtom } from './agent-atoms'

// ===== 类型定义 =====

/** 预览载体：本地文件或网页（含 CSV live dashboard） */
export type PreviewKind = 'file' | 'url'

/** 当前预览的文件或 URL 信息 */
export interface PreviewFile {
  /** 预览类型；有 url 且无 filePath 时默认为 url */
  kind?: PreviewKind
  /** 本地文件路径（file 模式必填） */
  filePath?: string
  /** 网页 URL（url 模式必填，CSV live dashboard 走 http://127.0.0.1:…） */
  url?: string
  /** 展示标题（url 模式常用，如 CSV 看板名） */
  title?: string
  /** CSV cache session id（url 模式可选，用于 ensure / reload） */
  csvSessionId?: string
  /** 每次 openCsvDashboard 成功递增；URL 不变时也强制 webview reload */
  reloadNonce?: number
  dirPath?: string
  gitRoot?: string
  /** true = 纯文件预览（不显示 diff 控件），false/undefined = diff 模式 */
  previewOnly?: boolean
  /** true = 预览只读，不允许从预览面板写回临时/源文件 */
  readOnly?: boolean
  /** 候选基础目录（用于相对路径解析） */
  basePaths?: string[]
  /** 文件是否落在当前会话的 diff scope 内（与 getUnstagedChanges 的 candidates 对齐） */
  inDiffScope?: boolean
  /** 基准 ref（如 "origin/main"），用于 worktree vs main 模式的 diff 对比 */
  baseRef?: string
}

/** 解析预览类型（兼容旧数据：仅有 filePath 视为 file） */
export function getPreviewKind(file: PreviewFile): PreviewKind {
  if (file.kind) return file.kind
  if (file.url && !file.filePath) return 'url'
  return 'file'
}

export function isUrlPreview(file: PreviewFile): boolean {
  return getPreviewKind(file) === 'url'
}

function basenameFromPath(filePath: string): string {
  return filePath.split(/[\\/]/).filter(Boolean).pop() || filePath
}

/** 预览面板 / Tab 顶栏展示名 */
export function getPreviewDisplayTitle(file: PreviewFile): string {
  if (file.title?.trim()) return file.title.trim()
  if (file.filePath) return basenameFromPath(file.filePath)
  if (file.url) {
    try {
      const parsed = new URL(file.url)
      return parsed.hostname + (parsed.pathname === '/' ? '' : parsed.pathname)
    } catch {
      return '网页预览'
    }
  }
  return '预览'
}

// ===== Atoms =====

/** 每会话预览面板开关 */
export const previewPanelOpenMapAtom = atom<Map<string, boolean>>(new Map())

/** 每会话当前预览的文件（null 时显示 DiffChangesList） */
export const previewFileMapAtom = atom<Map<string, PreviewFile | null>>(new Map())

/** 分栏比例（对话占比），持久化 */
export const previewSplitRatioAtom = atomWithStorage<number>('tagent-preview-split-ratio', 0.5)

/**
 * 预览默认展开方式，持久化。
 * - 'tab'   = 以预览标签页形式打开（默认）
 * - 'split' = 在主区域右侧分屏展开（可同时看到 Agent 输出与文件内容）
 */
export type PreviewModePreference = 'tab' | 'split'
export const previewModePreferenceAtom = atomWithStorage<PreviewModePreference>(
  'tagent-preview-mode-pref',
  'tab',
  undefined,
  { getOnInit: true }
)

/** 自动预览开关，持久化（默认关闭以减轻设备性能负担，老用户保留已设置的偏好） */
export const autoPreviewEnabledAtom = atomWithStorage<boolean>('tagent-auto-preview-enabled', false)

/** 当前会话的预览面板是否打开（derived） */
export const currentSessionPreviewOpenAtom = atom<boolean>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return false
  return get(previewPanelOpenMapAtom).get(sessionId) ?? false
})

// ===== 引用选中文本（Quoted Selection）=====

/** 从预览面板中选中的文本引用 */
export interface QuotedSelection {
  /** 选中的文本内容 */
  text: string
  /** 来源文件路径 */
  filePath: string
  /** 起始行号（1-based，代码文件可计算，markdown 等无法计算时为 undefined） */
  startLine?: number
  /** 结束行号（1-based） */
  endLine?: number
  /** 捕获时间戳 */
  capturedAt: number
}

/** 每会话的引用选中文本 Map（每次新选中覆盖旧值） */
export const quotedSelectionMapAtom = atom<Map<string, QuotedSelection>>(new Map())

/** 当前会话的引用选中文本（派生） */
export const currentQuotedSelectionAtom = atom<QuotedSelection | null>((get) => {
  const sessionId = get(currentAgentSessionIdAtom)
  if (!sessionId) return null
  return get(quotedSelectionMapAtom).get(sessionId) ?? null
})

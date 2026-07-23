/**
 * CSV 看板 AI 内存 Tab（ephemeral views）
 *
 * 仅进程内存，不落盘 dashboard.html / meta.json。
 * 退出 TAgent 或 live server 停止后自然清空。
 */

/** 单个内存 Tab */
export interface EphemeralView {
  id: string
  label: string
  /** 已渲染的 view 内容 HTML（sections） */
  sectionsHtml: string
  /** 可选：侧栏 filter_panel HTML */
  filterHtml?: string
  updatedAt: string
}

const store = new Map<string, EphemeralView[]>()

function tabList(sessionId: string): EphemeralView[] {
  const id = sessionId.trim()
  if (!id) return []
  let list = store.get(id)
  if (!list) {
    list = []
    store.set(id, list)
  }
  return list
}

/** 列出 session 的全部内存 Tab */
export function listLiveTabs(sessionId: string): EphemeralView[] {
  return [...tabList(sessionId)]
}

/** upsert：同 id 替换，否则追加 */
export function upsertLiveTab(
  sessionId: string,
  tab: Omit<EphemeralView, 'updatedAt'>
): EphemeralView {
  const list = tabList(sessionId)
  const now = new Date().toISOString()
  const entry: EphemeralView = { ...tab, updatedAt: now }
  const idx = list.findIndex((t) => t.id === tab.id)
  if (idx >= 0) list[idx] = entry
  else list.push(entry)
  return entry
}

/** 按 id 删除单个 Tab */
export function removeLiveTab(sessionId: string, tabId: string): boolean {
  const list = tabList(sessionId)
  const idx = list.findIndex((t) => t.id === tabId)
  if (idx < 0) return false
  list.splice(idx, 1)
  return true
}

/** 清空 session 的全部内存 Tab */
export function clearLiveTabs(sessionId: string): number {
  const list = tabList(sessionId)
  const n = list.length
  list.length = 0
  return n
}

/** 测试/进程清理用 */
export function resetLiveTabsStore(): void {
  store.clear()
}

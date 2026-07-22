/**
 * 统一打开 CSV 看板（分屏 / Tab 预览壳）
 *
 * 身份 = Agent 会话 + csvSessionId / filePath；
 * URL = ensureLiveServer 派生，不写死 localhost 端口。
 * 成功后写入 previewFileMapAtom（url 模式），与会话分屏预览同一入口。
 */

import type { useStore } from 'jotai'

import { openUrlPreview } from '@/components/diff/preview-opener'
import { browserSessionStateFamily } from '@/atoms/browser-panel-atoms'

type JotaiStore = ReturnType<typeof useStore>

export interface OpenCsvDashboardOpts {
  /** CSV cache session id（工具 session_id） */
  csvSessionId: string
  filePath?: string | null
  title?: string | null
  /** 可选提示 URL；仍会 ensure 刷新 */
  url?: string | null
  /** 打开后默认激活的 view id（对应 HTML #view-{id}） */
  activeView?: string | null
}

/** 去掉 hash，用于判断 live 端口是否相同 */
export function csvDashboardBaseUrl(url: string): string {
  try {
    const parsed = new URL(url)
    parsed.hash = ''
    return parsed.href
  } catch {
    return url.split('#')[0] ?? url
  }
}

/** 从 #view-xxx hash 解析 view id */
export function csvDashboardViewFromUrl(url: string): string | null {
  try {
    const hash = new URL(url).hash
    const m = hash.match(/^#view-(.+)$/)
    return m?.[1] ? decodeURIComponent(m[1]!) : null
  } catch {
    const m = url.match(/#view-(.+)$/)
    return m?.[1] ? decodeURIComponent(m[1]!) : null
  }
}

function appendActiveViewHash(url: string, activeView?: string | null): string {
  const viewId = activeView?.trim()
  if (!viewId) return csvDashboardBaseUrl(url)
  const base = csvDashboardBaseUrl(url)
  return `${base}#view-${encodeURIComponent(viewId)}`
}

function toFileUrl(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  if (normalized.startsWith('/')) return `file://${normalized}`
  return `file:///${normalized}`
}

function mergeOpenOpts(
  prev: OpenCsvDashboardOpts,
  next: OpenCsvDashboardOpts
): OpenCsvDashboardOpts {
  return {
    csvSessionId: next.csvSessionId.trim() || prev.csvSessionId,
    filePath: next.filePath ?? prev.filePath,
    title: next.title?.trim() ? next.title : prev.title,
    url: next.url ?? prev.url,
    activeView: next.activeView?.trim() ? next.activeView : prev.activeView,
  }
}

/** 同 csvSessionId 飞行中再次 open 时合并 opts，跑完当前 ensure 后再执行一次 */
const inflightOpens = new Map<string, Promise<{ ok: boolean; error?: string }>>()
const pendingMerge = new Map<string, OpenCsvDashboardOpts>()

async function executeOpenCsvDashboard(
  store: JotaiStore,
  agentSessionId: string,
  opts: OpenCsvDashboardOpts
): Promise<{ ok: boolean; error?: string }> {
  const csvSessionId = opts.csvSessionId.trim()
  if (!agentSessionId || !csvSessionId) {
    return { ok: false, error: '缺少 agentSessionId 或 csvSessionId' }
  }

  let url: string | null = opts.url ?? null
  let resolvedCsvId = csvSessionId

  try {
    const result = await window.electronAPI.csv.ensureLiveServer(csvSessionId)
    if (result.ok && result.url) {
      url = result.url
      if (result.sessionId) resolvedCsvId = result.sessionId
    } else if (opts.filePath) {
      url = toFileUrl(opts.filePath)
      console.warn('[CSV Dashboard] live 启动失败，回退 file://', result.error)
    } else {
      return { ok: false, error: result.error || 'CSV live 服务启动失败' }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (opts.filePath) {
      url = toFileUrl(opts.filePath)
    } else {
      return { ok: false, error: msg }
    }
  }

  const nextUrl = appendActiveViewHash(url ?? '', opts.activeView)
  const displayTitle = opts.title?.trim() ? opts.title.trim() : 'CSV 数据看板'

  const prevBrowser = store.get(browserSessionStateFamily(agentSessionId))
  const reloadNonce = (prevBrowser.reloadNonce ?? 0) + 1

  // 主路径：分屏 / Tab 统一预览壳
  openUrlPreview(store, agentSessionId, {
    url: nextUrl,
    title: displayTitle,
    csvSessionId: resolvedCsvId,
    filePath: opts.filePath ?? null,
    reloadNonce,
  })

  // 同步 browser 状态，供右栏 UniversalPreviewPanel 与 WebPreviewFrame 恢复
  store.set(browserSessionStateFamily(agentSessionId), {
    url: nextUrl,
    csvSessionId: resolvedCsvId,
    filePath: opts.filePath ?? null,
    title: displayTitle,
    reloadNonce,
  })

  return { ok: true }
}

/**
 * 打开（或重新打开）CSV 看板到指定 Agent 会话的分屏预览。
 * 飞行中同 csvSessionId 的多次调用会合并，避免连续 ensure + webview abort。
 */
export function openCsvDashboard(
  store: JotaiStore,
  agentSessionId: string,
  opts: OpenCsvDashboardOpts
): Promise<{ ok: boolean; error?: string }> {
  const csvSessionId = opts.csvSessionId.trim()
  if (!agentSessionId || !csvSessionId) {
    return Promise.resolve({ ok: false, error: '缺少 agentSessionId 或 csvSessionId' })
  }

  const key = `${agentSessionId}:${csvSessionId}`
  const running = inflightOpens.get(key)
  if (running) {
    pendingMerge.set(key, mergeOpenOpts(pendingMerge.get(key) ?? opts, opts))
    return running
  }

  const run = (async (): Promise<{ ok: boolean; error?: string }> => {
    let current = opts
    while (true) {
      const result = await executeOpenCsvDashboard(store, agentSessionId, current)
      const merged = pendingMerge.get(key)
      if (merged) {
        pendingMerge.delete(key)
        current = merged
        continue
      }
      return result
    }
  })()

  inflightOpens.set(key, run)
  void run.finally(() => {
    inflightOpens.delete(key)
    pendingMerge.delete(key)
  })
  return run
}

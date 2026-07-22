/**
 * CSV 看板 Live Query 本地服务
 *
 * 在 127.0.0.1 随机（或 sticky）端口启动只读 HTTP，供 dashboard.html 分页/筛选百万行数据，
 * 避免把全表嵌进 HTML。
 *
 * 刷新/主进程重启后：渲染进程凭持久化的 sessionId 调用 ensureCsvLiveServer，
 * 从 live.json 尝试复用端口并重新起服。
 */

import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import * as fs from 'fs'
import * as path from 'path'
import {
  getCsvCacheRoot,
  getCsvDbPath,
  getFacetValues,
  readCsvCacheMeta,
  runCsvQuery,
  type CsvFilter,
} from './csv-shared'
import {
  clearLiveTabs,
  listLiveTabs,
  removeLiveTab,
  upsertLiveTab,
} from './csv-live-tabs'

interface LiveServerEntry {
  server: Server
  port: number
  sessionId: string
  lastAccess: number
}

interface LiveMetaFile {
  port: number
  updatedAt: string
}

const servers = new Map<string, LiveServerEntry>()
const IDLE_MS = 30 * 60 * 1000

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
  })
  res.end(text)
}

function sendText(res: ServerResponse, status: number, body: string, contentType: string): void {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  })
  res.end(body)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
    req.on('error', reject)
  })
}

function parseFilters(raw: unknown): CsvFilter[] {
  if (!raw) return []
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? (parsed as CsvFilter[]) : []
    } catch {
      return []
    }
  }
  if (Array.isArray(raw)) return raw as CsvFilter[]
  return []
}

function getDashboardDir(sessionId: string): string {
  return path.join(getCsvCacheRoot(), `${sessionId}-dashboard`)
}

function getDashboardHtmlPath(sessionId: string): string {
  return path.join(getDashboardDir(sessionId), 'dashboard.html')
}

function getLiveMetaPath(sessionId: string): string {
  return path.join(getDashboardDir(sessionId), 'live.json')
}

function readLiveMeta(sessionId: string): LiveMetaFile | null {
  const p = getLiveMetaPath(sessionId)
  if (!fs.existsSync(p)) return null
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as LiveMetaFile
    if (typeof raw.port === 'number' && raw.port > 0) return raw
  } catch {
    /* ignore */
  }
  return null
}

function writeLiveMeta(sessionId: string, port: number): void {
  const dir = getDashboardDir(sessionId)
  fs.mkdirSync(dir, { recursive: true })
  const meta: LiveMetaFile = { port, updatedAt: new Date().toISOString() }
  fs.writeFileSync(getLiveMetaPath(sessionId), JSON.stringify(meta, null, 2), 'utf-8')
}

async function handleRequest(
  sessionId: string,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  const entry = servers.get(sessionId)
  if (entry) entry.lastAccess = Date.now()

  const url = new URL(req.url || '/', `http://127.0.0.1`)
  const pathname = url.pathname

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    })
    res.end()
    return
  }

  try {
    if (pathname === '/api/meta' && req.method === 'GET') {
      const meta = readCsvCacheMeta(sessionId)
      if (!meta) {
        sendJson(res, 404, { error: 'meta not found' })
        return
      }
      sendJson(res, 200, meta)
      return
    }

    if (pathname === '/api/facets' && req.method === 'GET') {
      const columns = (url.searchParams.get('columns') || '')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
      const limit = parseInt(url.searchParams.get('limit') || '50', 10) || 50
      const facets: Record<string, { values: string[]; truncated: boolean }> = {}
      for (const col of columns) {
        const f = getFacetValues(sessionId, col, limit)
        facets[col] = { values: f.values, truncated: f.truncated }
      }
      sendJson(res, 200, { facets })
      return
    }

    if (pathname === '/api/rows' && (req.method === 'GET' || req.method === 'POST')) {
      let filters: CsvFilter[] = []
      let select: string | undefined
      let sort: string | undefined
      let sort_dir: string | undefined
      let limit = 50
      let offset = 0

      if (req.method === 'POST') {
        const body = await readBody(req)
        const json = body ? JSON.parse(body) : {}
        filters = parseFilters(json.filters)
        select = json.select as string | undefined
        sort = json.sort as string | undefined
        sort_dir = json.sort_dir as string | undefined
        limit = parseInt(String(json.limit ?? 50), 10) || 50
        offset = parseInt(String(json.offset ?? 0), 10) || 0
      } else {
        filters = parseFilters(url.searchParams.get('filters'))
        select = url.searchParams.get('select') || undefined
        sort = url.searchParams.get('sort') || undefined
        sort_dir = url.searchParams.get('sort_dir') || undefined
        limit = parseInt(url.searchParams.get('limit') || '50', 10) || 50
        offset = parseInt(url.searchParams.get('offset') || '0', 10) || 0
      }

      if (!fs.existsSync(getCsvDbPath(sessionId))) {
        sendJson(res, 404, { error: 'db not found' })
        return
      }

      const result = runCsvQuery(sessionId, {
        filters,
        select,
        sort,
        sort_dir,
        limit,
        offset,
      })
      sendJson(res, 200, result)
      return
    }

    // AI 内存 Tab API（不落盘）
    if (pathname === '/api/live-tabs') {
      if (req.method === 'GET') {
        sendJson(res, 200, { tabs: listLiveTabs(sessionId) })
        return
      }
      if (req.method === 'DELETE') {
        const cleared = clearLiveTabs(sessionId)
        sendJson(res, 200, { ok: true, cleared })
        return
      }
      if (req.method === 'POST' || req.method === 'PUT') {
        const body = await readBody(req)
        const json = body ? JSON.parse(body) : {}
        const id = String(json.id ?? json.tab_id ?? '').trim()
        const label = String(json.label ?? json.tab_label ?? id).trim()
        const sectionsHtml = String(json.sectionsHtml ?? json.sections_html ?? '')
        if (!id || !sectionsHtml) {
          sendJson(res, 400, { error: 'id 与 sectionsHtml 必填' })
          return
        }
        const tab = upsertLiveTab(sessionId, {
          id,
          label,
          sectionsHtml,
          filterHtml: json.filterHtml ?? json.filter_html ? String(json.filterHtml ?? json.filter_html) : undefined,
        })
        sendJson(res, 200, { ok: true, tab })
        return
      }
    }

    const liveTabDeleteMatch = /^\/api\/live-tabs\/([^/]+)$/.exec(pathname)
    if (liveTabDeleteMatch && req.method === 'DELETE') {
      const tabId = decodeURIComponent(liveTabDeleteMatch[1]!)
      const removed = removeLiveTab(sessionId, tabId)
      sendJson(res, removed ? 200 : 404, removed ? { ok: true, id: tabId } : { error: 'tab not found' })
      return
    }

    if (pathname === '/api/agg' && (req.method === 'GET' || req.method === 'POST')) {
      let groupby: string | undefined
      let agg: string | undefined
      let filters: CsvFilter[] = []
      let sort: string | undefined
      let sort_dir: string | undefined
      let limit = 100

      if (req.method === 'POST') {
        const body = await readBody(req)
        const json = body ? JSON.parse(body) : {}
        groupby = json.groupby as string | undefined
        agg = json.agg as string | undefined
        filters = parseFilters(json.filters)
        sort = json.sort as string | undefined
        sort_dir = json.sort_dir as string | undefined
        limit = parseInt(String(json.limit ?? 100), 10) || 100
      } else {
        groupby = url.searchParams.get('groupby') || undefined
        agg = url.searchParams.get('agg') || undefined
        filters = parseFilters(url.searchParams.get('filters'))
        sort = url.searchParams.get('sort') || undefined
        sort_dir = url.searchParams.get('sort_dir') || undefined
        limit = parseInt(url.searchParams.get('limit') || '100', 10) || 100
      }

      const result = runCsvQuery(sessionId, {
        groupby,
        agg,
        filters,
        sort,
        sort_dir,
        limit,
      })
      sendJson(res, 200, result)
      return
    }

    // 静态 HTML
    if (pathname === '/' || pathname === '/dashboard.html' || pathname === '/index.html') {
      const htmlPath = getDashboardHtmlPath(sessionId)
      if (!fs.existsSync(htmlPath)) {
        sendText(res, 404, 'dashboard.html not found', 'text/plain; charset=utf-8')
        return
      }
      const html = fs.readFileSync(htmlPath, 'utf-8')
      sendText(res, 200, html, 'text/html; charset=utf-8')
      return
    }

    sendJson(res, 404, { error: `unknown path: ${pathname}` })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[CSV LiveServer]', sessionId, msg)
    sendJson(res, 500, { error: msg })
  }
}

/** 优先绑定 preferred 端口；占用时回退随机端口 */
function listenPort(server: Server, preferred?: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryListen = (port: number, allowFallback: boolean): void => {
      const onError = (err: NodeJS.ErrnoException): void => {
        server.off('error', onError)
        if (allowFallback && err.code === 'EADDRINUSE') {
          tryListen(0, false)
          return
        }
        reject(err)
      }
      server.once('error', onError)
      server.listen(port, '127.0.0.1', () => {
        server.off('error', onError)
        const addr = server.address()
        if (addr && typeof addr === 'object') {
          resolve(addr.port)
        } else {
          reject(new Error('无法获取监听端口'))
        }
      })
    }
    const preferredPort = preferred && preferred > 0 ? preferred : 0
    tryListen(preferredPort, preferredPort > 0)
  })
}

export interface EnsureCsvLiveServerResult {
  ok: boolean
  port: number
  url: string
  sessionId?: string
  error?: string
}

/** 确保 session 对应的 live server 在跑，返回 baseUrl */
export async function ensureCsvLiveServer(sessionId: string): Promise<EnsureCsvLiveServerResult> {
  if (!sessionId.trim()) {
    return { ok: false, port: 0, url: '', error: 'sessionId 为空' }
  }

  const htmlPath = getDashboardHtmlPath(sessionId)
  if (!fs.existsSync(htmlPath)) {
    return {
      ok: false,
      port: 0,
      url: '',
      sessionId,
      error: `dashboard.html 不存在: ${htmlPath}`,
    }
  }

  const existing = servers.get(sessionId)
  if (existing) {
    existing.lastAccess = Date.now()
    writeLiveMeta(sessionId, existing.port)
    return {
      ok: true,
      port: existing.port,
      url: `http://127.0.0.1:${existing.port}/`,
      sessionId,
    }
  }

  const preferred = readLiveMeta(sessionId)?.port
  const server = createServer((req, res) => {
    void handleRequest(sessionId, req, res)
  })

  try {
    const port = await listenPort(server, preferred)
    servers.set(sessionId, { server, port, sessionId, lastAccess: Date.now() })
    writeLiveMeta(sessionId, port)
    console.log(`[CSV LiveServer] session=${sessionId} → http://127.0.0.1:${port}/`)
    return { ok: true, port, url: `http://127.0.0.1:${port}/`, sessionId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[CSV LiveServer] 启动失败 session=${sessionId}:`, msg)
    try {
      server.close()
    } catch {
      /* ignore */
    }
    return { ok: false, port: 0, url: '', sessionId, error: msg }
  }
}

export function stopCsvLiveServer(sessionId: string): void {
  const entry = servers.get(sessionId)
  if (!entry) return
  entry.server.close()
  servers.delete(sessionId)
  clearLiveTabs(sessionId)
}

export function getCsvLiveServerUrl(sessionId: string): string | null {
  const entry = servers.get(sessionId)
  return entry ? `http://127.0.0.1:${entry.port}/` : null
}

/**
 * 旧版只持久化了 URL、没有 sessionId 时：按端口从 live.json 反查 session。
 */
export function findSessionIdByLiveUrl(url: string): string | null {
  try {
    const u = new URL(url)
    if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return null
    const port = parseInt(u.port, 10)
    if (!port) return null
    const root = getCsvCacheRoot()
    if (!fs.existsSync(root)) return null
    for (const name of fs.readdirSync(root)) {
      if (!name.endsWith('-dashboard')) continue
      const meta = readLiveMeta(name.replace(/-dashboard$/, ''))
      if (meta?.port === port) return name.replace(/-dashboard$/, '')
    }
  } catch {
    /* ignore */
  }
  return null
}

/** 闲置清理（可由定时器调用） */
export function cleanupIdleCsvLiveServers(): void {
  const now = Date.now()
  for (const [id, entry] of servers) {
    if (now - entry.lastAccess > IDLE_MS) {
      entry.server.close()
      servers.delete(id)
      console.log(`[CSV LiveServer] 闲置关闭 session=${id}`)
    }
  }
}

setInterval(() => cleanupIdleCsvLiveServers(), 5 * 60 * 1000).unref?.()

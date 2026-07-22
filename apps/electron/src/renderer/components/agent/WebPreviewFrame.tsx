/**
 * WebPreviewFrame — 共用 webview 预览内核
 *
 * 供分屏 PreviewPanel、右栏 UniversalPreviewPanel、BrowserPanel 复用。
 * 含 CSV live ensure、ERR_ABORTED 恢复、reloadNonce 强制刷新等逻辑。
 */

import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import { useStore } from 'jotai'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCw,
  FileCode,
  X,
} from 'lucide-react'

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { cn } from '@/lib/utils'
import {
  csvDashboardBaseUrl,
  csvDashboardViewFromUrl,
  openCsvDashboard,
} from '@/lib/open-csv-dashboard'

type DevWebviewTag = HTMLElement & {
  canGoBack(): boolean
  canGoForward(): boolean
  getURL(): string
  goBack(): void
  goForward(): void
  reload(): void
  reloadIgnoringCache(): void
  loadURL(url: string): void
  executeJavaScript(code: string): Promise<unknown>
}

type WebviewNavigateEvent = Event & {
  url: string
}

type WebviewFailLoadEvent = Event & {
  errorCode: number
  errorDescription: string
  isMainFrame: boolean
}

type WebviewTitleEvent = Event & {
  title: string
}

function formatAddressInput(url: string): string {
  try {
    if (url.startsWith('file://')) {
      const parts = url.split('/')
      return parts[parts.length - 1] || url
    }
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.host}${path}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

function isLocalLiveUrl(url: string | null | undefined): boolean {
  if (!url) return false
  try {
    const u = new URL(url)
    return u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')
  } catch {
    return false
  }
}

export interface WebPreviewFrameProps {
  /** 当前 Agent 会话（用于写回 per-session 状态） */
  agentSessionId?: string | null
  /** 初始 URL（会话状态中的缓存值） */
  initialUrl?: string | null
  /** CSV cache session id */
  csvSessionId?: string | null
  filePath?: string | null
  title?: string | null
  /** openCsvDashboard 成功时递增，同 URL 也强制刷新 webview */
  reloadNonce?: number
  /** 是否显示导航工具栏（分屏 PreviewPanel 自带顶栏时可关闭） */
  showToolbar?: boolean
  onCollapse?: () => void
  className?: string
}

export function WebPreviewFrame({
  agentSessionId,
  initialUrl,
  csvSessionId,
  filePath,
  title,
  reloadNonce,
  showToolbar = true,
  onCollapse,
  className,
}: WebPreviewFrameProps): ReactElement {
  const store = useStore()
  const webviewRef = useRef<DevWebviewTag | null>(null)
  const liveFailRetryRef = useRef(false)
  const abortRetryRef = useRef(false)
  const lastReloadNonceRef = useRef<number | undefined>(undefined)
  const webviewSrcRef = useRef<string | null>(null)
  const loadFinishedRef = useRef(false)
  const pendingReloadRef = useRef(false)
  const pendingViewIdRef = useRef<string | null>(null)
  const restoredKeyRef = useRef<string | null>(null)

  const needsLiveRestore = Boolean(csvSessionId) || isLocalLiveUrl(initialUrl)

  const [activeUrl, setActiveUrl] = useState<string | null>(() => initialUrl ?? null)
  const [draftUrl, setDraftUrl] = useState(() => (initialUrl ? formatAddressInput(initialUrl) : ''))
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageTitle, setPageTitle] = useState(title ?? '')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)
  const [restoringLive, setRestoringLive] = useState(false)

  useEffect(() => {
    if (!needsLiveRestore || !agentSessionId || !csvSessionId) {
      restoredKeyRef.current = null
      if (initialUrl && !needsLiveRestore) {
        setActiveUrl(initialUrl)
        setDraftUrl(formatAddressInput(initialUrl))
        if (title) setPageTitle(title)
      } else if (!initialUrl && !csvSessionId) {
        setActiveUrl(null)
        webviewSrcRef.current = null
        setDraftUrl('')
        setPageTitle('')
        setLoadError(null)
        setLoading(false)
      }
      return
    }

    const restoreKey = `${agentSessionId}:${csvSessionId}`
    if (restoredKeyRef.current === restoreKey) return
    restoredKeyRef.current = restoreKey

    let cancelled = false
    setRestoringLive(true)
    void openCsvDashboard(store, agentSessionId, {
      csvSessionId,
      filePath,
      title,
      url: initialUrl,
    })
      .then((r) => {
        if (cancelled) return
        if (!r.ok) {
          setLoadError(r.error || '恢复看板失败')
          if (initialUrl) {
            setActiveUrl(initialUrl)
            setDraftUrl(formatAddressInput(initialUrl))
          }
        }
      })
      .finally(() => {
        if (!cancelled) setRestoringLive(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentSessionId, csvSessionId, needsLiveRestore, filePath, title, store])

  const lastExternalUrlRef = useRef<string | null>(initialUrl ?? null)

  const activateViewInWebview = (viewId: string): void => {
    const webview = webviewRef.current
    if (!webview) return
    try {
      void webview.executeJavaScript(
        `typeof activateView === 'function' && activateView(${JSON.stringify(viewId)})`
      )
    } catch {
      /* webview 未就绪 */
    }
  }

  const flushPendingReload = (): void => {
    if (!pendingReloadRef.current) return
    pendingReloadRef.current = false
    webviewRef.current?.reloadIgnoringCache()
  }

  useEffect(() => {
    if (restoringLive) return
    if (initialUrl) {
      const prevExternal = lastExternalUrlRef.current
      const baseChanged =
        !prevExternal || csvDashboardBaseUrl(prevExternal) !== csvDashboardBaseUrl(initialUrl)
      const viewId = csvDashboardViewFromUrl(initialUrl)

      lastExternalUrlRef.current = initialUrl
      setDraftUrl(formatAddressInput(initialUrl))
      if (title) setPageTitle(title)
      setLoadError(null)

      if (baseChanged) {
        loadFinishedRef.current = false
        abortRetryRef.current = false
        webviewSrcRef.current = csvDashboardBaseUrl(initialUrl)
        setActiveUrl(webviewSrcRef.current)
        setLoading(true)
        pendingViewIdRef.current = viewId
        return
      }

      setActiveUrl((prev) => prev ?? csvDashboardBaseUrl(initialUrl))
      if (viewId) {
        pendingViewIdRef.current = viewId
        if (loadFinishedRef.current) {
          activateViewInWebview(viewId)
          pendingViewIdRef.current = null
        }
      }
      return
    }
    if (!csvSessionId) {
      lastExternalUrlRef.current = null
      webviewSrcRef.current = null
      setActiveUrl(null)
      setDraftUrl('')
      setPageTitle('')
      setLoadError(null)
      setLoading(false)
    }
  }, [initialUrl, restoringLive, title, csvSessionId])

  useEffect(() => {
    if (reloadNonce === undefined) return
    if (lastReloadNonceRef.current === undefined) {
      lastReloadNonceRef.current = reloadNonce
      return
    }
    if (lastReloadNonceRef.current === reloadNonce || !activeUrl) return
    lastReloadNonceRef.current = reloadNonce
    if (loadFinishedRef.current) {
      loadFinishedRef.current = false
      webviewRef.current?.reloadIgnoringCache()
    } else {
      pendingReloadRef.current = true
    }
  }, [reloadNonce, activeUrl])

  useEffect(() => {
    const webview = webviewRef.current
    if (!activeUrl || !webview) return

    const syncNavigationState = (): void => {
      try {
        setCanGoBack(webview.canGoBack())
        setCanGoForward(webview.canGoForward())
        const currentUrl = webview.getURL()
        if (currentUrl) {
          setDraftUrl(formatAddressInput(currentUrl))
          const base = csvDashboardBaseUrl(currentUrl)
          setActiveUrl((prev) => (prev === base ? prev : base))
          webviewSrcRef.current = base
        }
      } catch {
        /* webview may not be attached yet */
      }
    }

    const handleStartLoading = (): void => {
      loadFinishedRef.current = false
      setLoading(true)
      setLoadError(null)
      armLoadingTimeout()
    }
    const handleStopLoading = (): void => {
      setLoading(false)
      clearLoadingTimeout()
      liveFailRetryRef.current = false
      abortRetryRef.current = false
      loadFinishedRef.current = true
      syncNavigationState()
      const pendingView = pendingViewIdRef.current
      if (pendingView) {
        activateViewInWebview(pendingView)
        pendingViewIdRef.current = null
      }
      if (pendingReloadRef.current) {
        loadFinishedRef.current = false
        flushPendingReload()
      }
    }
    const handleNavigate: EventListener = (event): void => {
      const navEvent = event as WebviewNavigateEvent
      if (!navEvent.url) return
      setDraftUrl(formatAddressInput(navEvent.url))
      const base = csvDashboardBaseUrl(navEvent.url)
      setActiveUrl((prev) => (prev === base ? prev : base))
      webviewSrcRef.current = base
      setLoadError(null)
      armLoadingTimeout()
      syncNavigationState()
    }
    const handleFailLoad: EventListener = (event): void => {
      const failEvent = event as WebviewFailLoadEvent
      if (!failEvent.isMainFrame) return

      if (failEvent.errorCode === -3) {
        if (!abortRetryRef.current && webviewRef.current) {
          abortRetryRef.current = true
          window.setTimeout(() => {
            const wv = webviewRef.current
            if (!wv) return
            try {
              const current = wv.getURL()
              if (!current || current === 'about:blank') {
                const target = webviewSrcRef.current ?? activeUrl
                if (target) wv.loadURL(target)
              } else {
                wv.reloadIgnoringCache()
              }
            } catch {
              /* ignore */
            }
          }, 80)
        }
        return
      }

      setLoading(false)
      clearLoadingTimeout()
      if (!liveFailRetryRef.current && agentSessionId && csvSessionId) {
        liveFailRetryRef.current = true
        void openCsvDashboard(store, agentSessionId, {
          csvSessionId,
          filePath,
          title,
        }).then((r) => {
          if (!r.ok) {
            setLoadError(`加载失败: ${failEvent.errorDescription} (${failEvent.errorCode})`)
          }
        })
        return
      }
      setLoadError(`加载失败: ${failEvent.errorDescription} (${failEvent.errorCode})`)
    }
    const handleTitleUpdate: EventListener = (event): void => {
      const titleEvent = event as unknown as WebviewTitleEvent
      setPageTitle(titleEvent.title || '')
    }

    const LOAD_TIMEOUT_MS = 10_000
    let loadTimeoutId: ReturnType<typeof setTimeout> | null = null
    const armLoadingTimeout = (): void => {
      clearLoadingTimeout()
      loadTimeoutId = setTimeout(() => {
        setLoading(false)
        setLoadError('加载超时（>10s），请刷新或从消息卡片重新打开')
      }, LOAD_TIMEOUT_MS)
    }
    const clearLoadingTimeout = (): void => {
      if (loadTimeoutId !== null) {
        clearTimeout(loadTimeoutId)
        loadTimeoutId = null
      }
    }

    armLoadingTimeout()

    webview.addEventListener('did-start-loading', handleStartLoading)
    webview.addEventListener('did-stop-loading', handleStopLoading)
    webview.addEventListener('did-navigate', handleNavigate)
    webview.addEventListener('did-fail-load', handleFailLoad)
    webview.addEventListener('page-title-updated', handleTitleUpdate as EventListener)

    return () => {
      clearLoadingTimeout()
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
      webview.removeEventListener('did-navigate', handleNavigate)
      webview.removeEventListener('did-fail-load', handleFailLoad)
      webview.removeEventListener('page-title-updated', handleTitleUpdate as EventListener)
    }
  }, [activeUrl, agentSessionId, csvSessionId, filePath, title, store])

  const handleNavigateBack = (): void => {
    webviewRef.current?.goBack()
  }
  const handleNavigateForward = (): void => {
    webviewRef.current?.goForward()
  }
  const handleReload = (): void => {
    setLoadError(null)
    if (agentSessionId && csvSessionId) {
      void openCsvDashboard(store, agentSessionId, {
        csvSessionId,
        filePath,
        title,
      }).then((r) => {
        if (!r.ok) webviewRef.current?.reloadIgnoringCache()
      })
      return
    }
    webviewRef.current?.reloadIgnoringCache()
  }
  const handleOpenExternal = (): void => {
    if (activeUrl) window.electronAPI.openExternal(activeUrl)
  }

  const handleUrlSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!draftUrl.trim()) return
    let url = draftUrl.trim()

    if (/^[A-Za-z]:[/\\]|^[/~]/.test(url)) {
      try {
        const { pathToFileURL } = require('url')
        url = pathToFileURL(url).href
      } catch {
        url = 'file://' + url
      }
    } else if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) {
      url = 'https://' + url
    }

    try {
      new URL(url)
      setActiveUrl(url)
      setDraftUrl(formatAddressInput(url))
      setLoading(true)
      setLoadError(null)
    } catch {
      setLoadError('无效的 URL 或文件路径')
    }
  }

  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const droppedPath = (file as unknown as { path?: string }).path || file.name
    if (file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      const url = 'file:///' + droppedPath.replace(/\\/g, '/')
      setActiveUrl(url)
      setDraftUrl(formatAddressInput(url))
      setLoading(true)
      setLoadError(null)
    } else {
      setLoadError('只支持 HTML 文件')
    }
  }

  const emptyHint = restoringLive
    ? '正在恢复 CSV 看板…'
    : csvSessionId
      ? '看板未加载，请点击刷新或从消息卡片打开'
      : '输入网址或拖入 HTML 文件预览'

  return (
    <div
      className={cn('web-preview-frame flex h-full w-full flex-col bg-transparent', className)}
      onDragOver={showToolbar ? (e) => e.preventDefault() : undefined}
      onDrop={showToolbar ? handleDrop : undefined}
    >
      {showToolbar && (
        <div className="flex items-center gap-1 px-2 h-10 shrink-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleNavigateBack}
                disabled={!canGoBack}
              >
                <ArrowLeft size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">后退</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleNavigateForward}
                disabled={!canGoForward}
              >
                <ArrowRight size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">前进</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleReload}
                disabled={(!activeUrl && !csvSessionId) || restoringLive}
              >
                {loading || restoringLive ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RefreshCw size={14} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">刷新</TooltipContent>
          </Tooltip>

          <form onSubmit={handleUrlSubmit} className="flex-1 min-w-0">
            <div className="relative flex items-center">
              <Globe2 size={12} className="absolute left-2 text-muted-foreground" />
              <input
                type="text"
                value={draftUrl}
                onChange={(e) => setDraftUrl(e.target.value)}
                placeholder="输入网址或拖入 HTML 文件..."
                className={cn(
                  'w-full h-7 pl-7 pr-2 text-xs rounded-md border border-input bg-background',
                  'focus:outline-none focus:ring-1 focus:ring-ring',
                  'placeholder:text-muted-foreground/60'
                )}
              />
            </div>
          </form>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={handleOpenExternal}
                disabled={!activeUrl}
              >
                <ExternalLink size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">在浏览器中打开</TooltipContent>
          </Tooltip>

          {onCollapse && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="size-7" onClick={onCollapse}>
                  <X size={14} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">关闭</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      {showToolbar && pageTitle && (
        <div className="px-3 h-6 flex items-center text-xs text-muted-foreground border-b border-border shrink-0 truncate">
          {pageTitle}
        </div>
      )}

      {loadError && (
        <div className="px-3 py-2 text-xs text-red-500 bg-red-500/10 border-b border-border shrink-0">
          {loadError}
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden bg-transparent">
        {activeUrl ? (
          <webview
            ref={webviewRef as React.RefObject<HTMLElement>}
            src={activeUrl}
            // eslint-disable-next-line react/no-unknown-property
            webpreferences="contextIsolation=yes,nodeIntegration=no,webSecurity=no,allowRunningInsecureContent=no"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4 text-sm text-muted-foreground">
            <FileCode size={32} className="mb-2 opacity-40" />
            <p>{emptyHint}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * WpsBrowserPanel — WPS 文档预览面板
 *
 * 参考 Kun 的 DevBrowserPanel，在右侧面板内嵌入 <webview> 预览 WPS 文档。
 * 支持地址栏输入、前进/后退/刷新、新标签页打开等功能。
 */

import type { ReactElement } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Globe2,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'

import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'
import { cn } from '@/lib/utils'

type DevWebviewTag = HTMLElement & {
  canGoBack(): boolean
  canGoForward(): boolean
  getURL(): string
  goBack(): void
  goForward(): void
  reload(): void
  reloadIgnoringCache(): void
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

const WPS_PREVIEW_DOMAINS = ['365.kdocs.cn', 'kdocs.cn', 'wps.cn', 'open.wps.cn']

function isWpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return WPS_PREVIEW_DOMAINS.some((d) => parsed.hostname.endsWith(d))
  } catch {
    return false
  }
}

function formatAddressInput(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname === '/' ? '' : parsed.pathname
    return `${parsed.host}${path}${parsed.search}${parsed.hash}`
  } catch {
    return url
  }
}

interface WpsBrowserPanelProps {
  /** 初始 URL（可选，Agent 传入的分享链接） */
  initialUrl?: string | null
  /** 面板宽度 */
  width?: number
  /** 关闭面板回调 */
  onCollapse?: () => void
}

export function WpsBrowserPanel({
  initialUrl,
  width = 400,
  onCollapse,
}: WpsBrowserPanelProps): ReactElement {
  const webviewRef = useRef<DevWebviewTag | null>(null)
  const [activeUrl, setActiveUrl] = useState<string | null>(initialUrl ?? null)
  const [draftUrl, setDraftUrl] = useState(() =>
    initialUrl ? formatAddressInput(initialUrl) : ''
  )
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [pageTitle, setPageTitle] = useState('')
  const [canGoBack, setCanGoBack] = useState(false)
  const [canGoForward, setCanGoForward] = useState(false)

  // 初始化 URL 变化
  useEffect(() => {
    if (initialUrl && initialUrl !== activeUrl) {
      setActiveUrl(initialUrl)
      setDraftUrl(formatAddressInput(initialUrl))
      setPageTitle('')
      setLoading(true)
      setLoadError(null)
    }
  }, [initialUrl])

  // webview 事件绑定
  useEffect(() => {
    const webview = webviewRef.current
    if (!activeUrl || !webview) return

    const syncNavigationState = (): void => {
      try {
        setCanGoBack(webview.canGoBack())
        setCanGoForward(webview.canGoForward())
        const currentUrl = webview.getURL()
        if (currentUrl) {
          setActiveUrl(currentUrl)
          setDraftUrl(formatAddressInput(currentUrl))
        }
      } catch {
        /* webview may not be attached yet */
      }
    }

    const handleStartLoading = (): void => {
      setLoading(true)
      setLoadError(null)
    }
    const handleStopLoading = (): void => {
      setLoading(false)
      syncNavigationState()
    }
    const handleNavigate: EventListener = (event): void => {
      const navEvent = event as WebviewNavigateEvent
      if (!navEvent.url) return
      setActiveUrl(navEvent.url)
      setDraftUrl(formatAddressInput(navEvent.url))
      setLoadError(null)
      syncNavigationState()
    }
    const handleFailLoad: EventListener = (event): void => {
      const failEvent = event as WebviewFailLoadEvent
      if (!failEvent.isMainFrame || failEvent.errorCode === -3) return
      setLoading(false)
      setLoadError(`加载失败: ${failEvent.errorDescription} (${failEvent.errorCode})`)
    }
    const handleTitleUpdate: EventListener = (event): void => {
      const titleEvent = event as WebviewTitleEvent
      setPageTitle(titleEvent.title || '')
    }

    webview.addEventListener('did-start-loading', handleStartLoading)
    webview.addEventListener('did-stop-loading', handleStopLoading)
    webview.addEventListener('did-navigate', handleNavigate)
    webview.addEventListener('did-fail-load', handleFailLoad)
    webview.addEventListener('page-title-updated', handleTitleUpdate)

    return () => {
      webview.removeEventListener('did-start-loading', handleStartLoading)
      webview.removeEventListener('did-stop-loading', handleStopLoading)
      webview.removeEventListener('did-navigate', handleNavigate)
      webview.removeEventListener('did-fail-load', handleFailLoad)
      webview.removeEventListener('page-title-updated', handleTitleUpdate)
    }
  }, [activeUrl])

  const handleNavigateBack = (): void => {
    webviewRef.current?.goBack()
  }
  const handleNavigateForward = (): void => {
    webviewRef.current?.goForward()
  }
  const handleReload = (): void => {
    setLoadError(null)
    webviewRef.current?.reloadIgnoringCache()
  }
  const handleOpenExternal = (): void => {
    if (activeUrl) window.electronAPI.openExternal(activeUrl)
  }

  const handleUrlSubmit = (e: React.FormEvent): void => {
    e.preventDefault()
    if (!draftUrl.trim()) return
    let url = draftUrl.trim()
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url
    }
    try {
      new URL(url) // validate
      setActiveUrl(url)
      setDraftUrl(formatAddressInput(url))
      setLoading(true)
      setLoadError(null)
    } catch {
      setLoadError('无效的 URL')
    }
  }

  return (
    <div
      className="flex flex-col h-full bg-background"
      style={{ width }}
    >
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-1 px-2 h-10 border-b border-border shrink-0">
        {/* 返回 */}
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

        {/* 前进 */}
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

        {/* 刷新 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              onClick={handleReload}
              disabled={!activeUrl}
            >
              {loading ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RefreshCw size={14} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">刷新</TooltipContent>
        </Tooltip>

        {/* 地址栏 */}
        <form onSubmit={handleUrlSubmit} className="flex-1 min-w-0">
          <div className="relative flex items-center">
            <Globe2 size={12} className="absolute left-2 text-muted-foreground" />
            <input
              type="text"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="输入网址或 WPS 分享链接..."
              className={cn(
                'w-full h-7 pl-7 pr-2 text-xs rounded-md border border-input bg-background',
                'focus:outline-none focus:ring-1 focus:ring-ring',
                'placeholder:text-muted-foreground/60'
              )}
            />
          </div>
        </form>

        {/* 外部打开 */}
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

        {/* 关闭面板 */}
        {onCollapse && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={onCollapse}
              >
                <X size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">关闭</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* 页面标题 */}
      {pageTitle && (
        <div className="px-3 h-6 flex items-center text-xs text-muted-foreground border-b border-border shrink-0 truncate">
          {pageTitle}
        </div>
      )}

      {/* 错误提示 */}
      {loadError && (
        <div className="px-3 py-2 text-xs text-red-500 bg-red-500/10 border-b border-border shrink-0">
          {loadError}
        </div>
      )}

      {/* webview 区域 */}
      <div className="flex-1 min-h-0 relative bg-white dark:bg-neutral-900">
        {activeUrl ? (
          <webview
            ref={webviewRef as React.RefObject<HTMLElement>}
            src={activeUrl}
            partition="persist:wps-browser"
            webpreferences="contextIsolation=yes,nodeIntegration=no,sandbox=yes"
            className="absolute inset-0 w-full h-full"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm">
            <Globe2 size={32} className="mb-2 opacity-40" />
            <p>输入 WPS 分享链接或网址预览文档</p>
          </div>
        )}
      </div>
    </div>
  )
}

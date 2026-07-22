/**
 * BrowserPanel — 通用网页预览面板
 *
 * 参考 Kun 的 DevBrowserPanel，在右侧面板内嵌入 <webview> 预览任意网页。
 * 支持：
 * - 远程 URL（https://）
 * - 本地 HTML 文件（file:// 或拖拽）
 * - 前进/后退/刷新/外部打开
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
  FileCode,
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

function formatAddressInput(url: string): string {
  try {
    // file:// 协议显示文件名
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

interface BrowserPanelProps {
  /** 初始 URL（可选，外部传入） */
  initialUrl?: string | null
  /** 关闭面板回调 */
  onCollapse?: () => void
}

export function BrowserPanel({ initialUrl, onCollapse }: BrowserPanelProps): ReactElement {
  const webviewRef = useRef<DevWebviewTag | null>(null)
  const [activeUrl, setActiveUrl] = useState<string | null>(initialUrl ?? null)
  const [draftUrl, setDraftUrl] = useState(() => (initialUrl ? formatAddressInput(initialUrl) : ''))
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

    // 本地文件路径（Windows: C:/... 或 Linux/Mac: /...）
    if (/^[A-Za-z]:[/\\]|^[/~]/.test(url)) {
      try {
        // 需要 file:// 协议
        const { pathToFileURL } = require('url')
        url = pathToFileURL(url).href
      } catch {
        url = 'file://' + url
      }
    } else if (!/^https?:\/\//i.test(url) && !/^file:\/\//i.test(url)) {
      url = 'https://' + url
    }

    try {
      new URL(url) // validate
      setActiveUrl(url)
      setDraftUrl(formatAddressInput(url))
      setLoading(true)
      setLoadError(null)
    } catch {
      setLoadError('无效的 URL 或文件路径')
    }
  }

  // 文件拖拽支持
  const handleDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (!file) return
    const filePath = (file as unknown as { path?: string }).path || file.name
    if (file.type === 'text/html' || file.name.endsWith('.html') || file.name.endsWith('.htm')) {
      const url = 'file:///' + filePath.replace(/\\/g, '/')
      setActiveUrl(url)
      setDraftUrl(formatAddressInput(url))
      setLoading(true)
      setLoadError(null)
    } else {
      setLoadError('只支持 HTML 文件')
    }
  }

  return (
    <div
      // 透明底：跟随 inspector 玻璃面板；宽度由外层 island 统一管理
      className="browser-panel-root flex h-full w-full flex-col bg-transparent"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* 顶部工具栏 */}
      <div className="flex items-center gap-1 px-2 h-10 shrink-0">
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
              {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
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
              placeholder="输入网址或拖入 HTML 文件..."
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
              <Button variant="ghost" size="icon" className="size-7" onClick={onCollapse}>
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

      {/* webview 区域：透明底，贴合 inspector 圆角玻璃，不自带直角实色板 */}
      <div className="browser-panel-stage relative min-h-0 flex-1 overflow-hidden bg-transparent">
        {activeUrl ? (
          <webview
            ref={webviewRef as React.RefObject<HTMLElement>}
            src={activeUrl}
            // eslint-disable-next-line react/no-unknown-property
            partition="persist:browser-preview"
            // eslint-disable-next-line react/no-unknown-property
            webpreferences="contextIsolation=yes,nodeIntegration=no"
            className="absolute inset-0 h-full w-full"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center px-4 text-sm text-muted-foreground">
            <FileCode size={32} className="mb-2 opacity-40" />
            <p>输入网址或拖入 HTML 文件预览</p>
          </div>
        )}
      </div>
    </div>
  )
}

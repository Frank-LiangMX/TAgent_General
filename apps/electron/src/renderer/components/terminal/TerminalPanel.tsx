/**
 * TerminalPanel — 内置终端面板（xterm.js UI + 多 tab + 主题热跟随）
 *
 * 移植自 F:\Kun，耦合点改造：
 *  - API 桥：window.kunGui.* → window.electronAPI.terminal.*
 *  - i18n：useTranslation('common') → 硬编码中文
 *  - 主题检测：data-theme 属性 → <html>.dark class（TAgent 用 .dark 标深色）
 *  - 设置同步：去掉 rendererRuntimeClient.getSettings()，固定 native 配色跟主题走
 *  - ds-* token → TAgent token（bg-card / text-foreground / border / text-muted-foreground 等）
 *  - 布局：从底部抽屉改为 rail 主区填充（去掉 onCollapse/height/border-t）
 */

import type { ReactElement } from 'react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  Plus,
  RotateCw,
  TerminalSquare,
  X,
  PencilLine,
  PanelRightClose,
  PanelsTopLeft,
} from 'lucide-react'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tagent/ui'
import '@xterm/xterm/css/xterm.css'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { useStore } from 'jotai'
import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
  resolveTerminalTheme as resolveTerminalThemeFromSettings,
  TERMINAL_PRESET_DARK,
  TERMINAL_PRESET_LIGHT,
  TERMINAL_DEFAULT_ANSI_COLORS,
  TERMINAL_NATIVE_LIGHT_ANSI_COLORS,
  type TerminalColorSettings,
  type TerminalTheme,
} from '@tagent/shared'
import { terminalSessionIdForWorkspace, terminalWorkspaceSessionKey } from './terminal-session'
import {
  terminalTabsStateFamily,
  type TerminalTab,
  type TerminalTabState,
} from '@/atoms/terminal-atoms'

type Props = {
  className?: string
  /** 工作区根目录，作为 shell cwd + sessionId 命名空间；空则用主进程 home */
  workspaceRoot: string
}

// TerminalTab / TerminalTabState 类型从 @/atoms/terminal-atoms 引入（atom 文件为权威源）

// 等宽字体栈，跟编辑器一致，平台兜底（mac Menlo / win Consolas）
const TERMINAL_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
const TERMINAL_FONT_SIZE = 13
const TERMINAL_SCROLLBACK = 5000
const FIT_DEBOUNCE_MS = 80
const INITIAL_TAB_ID = 'main'
const MAX_RENDERER_TABS = 8

function initialTerminalTabState(): TerminalTabState {
  return {
    tabs: [{ id: INITIAL_TAB_ID, index: 1 }],
    activeTabId: INITIAL_TAB_ID,
  }
}

/** TAgent 用 <html>.dark class 标深色（非 data-theme 属性） */
function resolveThemeMode(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

/**
 * 从 TAgent 主题 CSS 变量读出实际颜色，组装终端配色。
 *
 * tokens.css 里 --background / --foreground / --primary 等是 `H S% L%` 三元组，
 * getComputedStyle 拿到形如 "218 8% 93%"。
 *
 * 关键：xterm.js v6 的颜色解析只认 `#hex` 和 `rgb()/rgba()`，不认 `hsl()/hsla()`，
 * 直接喂 hsl 会走 canvas 兜底解析失败，落回 xterm 默认黑/白，导致终端底色不跟主题。
 * 因此这里把读到的 HSL 三元组先转成 hex（selectionBackground 用 rgba 带透明），
 * 再组装 TerminalColorSettings 喂给 xterm。
 *
 * 读取失败（变量未定义 / 格式异常）时回退到内置深/浅预设（已是 hex），避免终端白屏。
 */

/** 匹配 CSS 变量里的 HSL 三元组："218 8% 93%" / "217 19.5% 62%" 等 */
const HSL_TRIPLE_RE = /(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/

/** 把 RGB 三通道（0-255）格式化成 `#rrggbb` 小写 hex */
function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.round(Math.max(0, Math.min(255, n)))
    return clamped.toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * HSL 三元组 → hex `#rrggbb`（标准算法）。
 * @param h 色相 0-360
 * @param s 饱和度 0-100（百分比）
 * @param l 亮度 0-100（百分比）
 */
function hslTripleToHex(h: number, s: number, l: number): string {
  const sNorm = s / 100
  const lNorm = l / 100
  // 灰度快捷：饱和度为 0 时三通道相等
  if (sNorm === 0) {
    const v = Math.round(lNorm * 255)
    return rgbToHex(v, v, v)
  }
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm // chroma
  const hp = h / 60 // 色相落在 0-6 区间
  const x = c * (1 - Math.abs((hp % 2) - 1))
  let r1 = 0
  let g1 = 0
  let b1 = 0
  if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0]
  else if (hp < 2) [r1, g1, b1] = [x, c, 0]
  else if (hp < 3) [r1, g1, b1] = [0, c, x]
  else if (hp < 4) [r1, g1, b1] = [0, x, c]
  else if (hp < 5) [r1, g1, b1] = [x, 0, c]
  else if (hp < 6) [r1, g1, b1] = [c, 0, x]
  const m = lNorm - c / 2 // 匹配亮度
  return rgbToHex((r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255)
}

/** 把 hex `#rrggbb` 解析回 RGB 三通道（0-255），用于拼 rgba 选区色 */
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex)
  if (!m) return null
  // 正则有匹配时三组捕获必存在，TS 严格模式把 RegExpExecArray 元素判为 string | undefined，这里显式取空串兜底
  return [parseInt(m[1] ?? '', 16), parseInt(m[2] ?? '', 16), parseInt(m[3] ?? '', 16)]
}

/**
 * 从 CSS 变量原始值（形如 "218 8% 93%"）解析 HSL 并转 hex。
 * 解析失败（空 / 格式异常）返回 null，由调用方走 fallback。
 */
function hslVarToHex(raw: string): string | null {
  const m = HSL_TRIPLE_RE.exec(raw.trim())
  if (!m) return null
  return hslTripleToHex(Number(m[1]), Number(m[2]), Number(m[3]))
}

function readThemeColorsFromCSS(): TerminalColorSettings {
  const mode = resolveThemeMode()
  const root = document.documentElement
  const styles = getComputedStyle(root)
  // 变量值形如 "218 8% 93%"，转成 hex 喂给 xterm（xterm 不认 hsl）
  const primaryRaw = styles.getPropertyValue('--primary')
  const primaryFgRaw = styles.getPropertyValue('--primary-foreground')
  const bgRaw = styles.getPropertyValue('--background')
  const fgRaw = styles.getPropertyValue('--foreground')
  const primary = hslVarToHex(primaryRaw)
  const primaryFg = hslVarToHex(primaryFgRaw)
  const background = hslVarToHex(bgRaw)
  const foreground = hslVarToHex(fgRaw)
  // 选区用 primary 25% 透明度；primary 缺失时退回 foreground 半透明。
  // xterm 认 rgba()，用 hex 解析出的 RGB 三通道拼 rgba。
  const foregroundRgb = foreground ? hexToRgb(foreground) : null
  const primaryRgb = primary ? hexToRgb(primary) : null
  const selectionBackground = primaryRgb
    ? `rgba(${primaryRgb[0]}, ${primaryRgb[1]}, ${primaryRgb[2]}, 0.25)`
    : foregroundRgb
      ? `rgba(${foregroundRgb[0]}, ${foregroundRgb[1]}, ${foregroundRgb[2]}, 0.25)`
      : null
  const ansi = mode === 'light' ? TERMINAL_NATIVE_LIGHT_ANSI_COLORS : TERMINAL_DEFAULT_ANSI_COLORS
  const preset = mode === 'light' ? TERMINAL_PRESET_LIGHT : TERMINAL_PRESET_DARK
  return {
    colorMode: 'native',
    // 底色=主题 --background（跟会话页信息流底色一致），前景=--foreground。
    // 试过透明（#00000000）会落黑（xterm canvas 默认黑底没真透），改用实色 --background。
    background: background ?? primary ?? preset.background,
    foreground: foreground ?? primaryFg ?? preset.foreground,
    cursor: foreground ?? primaryFg ?? preset.cursor,
    selectionBackground: selectionBackground ?? preset.selectionBackground,
    ...ansi,
  }
}

/** 渲染层组装终端 theme：从主题 CSS 变量读色 + 按当前深/浅模式构建 xterm theme */
function resolveTerminalTheme(): TerminalTheme {
  const colors = readThemeColorsFromCSS()
  const mode = resolveThemeMode()
  return resolveTerminalThemeFromSettings(colors, mode)
}

export function TerminalPanel({ className = '', workspaceRoot }: Props): ReactElement {
  const terminalBodyRef = useRef<HTMLDivElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitRef = useRef<FitAddon | null>(null)
  // 防 unmount/重连后的过期异步
  const aliveRef = useRef(true)
  const attachTokenRef = useRef(0)
  const [error, setError] = useState<string | null>(null)
  const [exited, setExited] = useState(false)
  const store = useStore()
  const workspaceKey = terminalWorkspaceSessionKey(workspaceRoot)
  // 挂载时从 atom 读当前 workspaceKey 的持久化 tabs 状态初始化 useState。
  // 关键：atom 里存的是空 tabs（[]）就用空初始化，不补 initial tab —— 空态持久化。
  // atom 值为 null（该 workspaceKey 从未写入过）才用 initialTerminalTabState() 初始化，
  // 并同步写回 atom，之后切走再切回读到的就是真实状态（含空态）。
  const [tabs, setTabs] = useState<TerminalTab[]>(() => {
    const persisted = store.get(terminalTabsStateFamily(workspaceKey))
    if (persisted) return persisted.tabs
    const initial = initialTerminalTabState()
    store.set(terminalTabsStateFamily(workspaceKey), initial)
    return initial.tabs
  })
  const [activeTabId, setActiveTabId] = useState(() => {
    const persisted = store.get(terminalTabsStateFamily(workspaceKey))
    if (persisted) {
      // 持久化状态里 activeTabId 可能指向已不存在的 tab（比如关空后 activeTabId='' ）
      // 兜底：activeTabId 不在 tabs 里时回退到第一个 tab 或空串，跟空态语义一致
      return persisted.tabs.some((tab) => tab.id === persisted.activeTabId)
        ? persisted.activeTabId
        : (persisted.tabs[0]?.id ?? '')
    }
    const initial = initialTerminalTabState()
    // 注意：上面 tabs 的 useState 初始化已经把 initial 写进 atom 了，这里不重复写
    return initial.activeTabId
  })
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [terminalBackground, setTerminalBackground] = useState<string | null>(null)
  const renameInputRef = useRef<HTMLInputElement | null>(null)
  const tabButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  // 选中滑动玻璃片（active plate）：复用会话 TabBar 的 app-workspace-tab-active-plate，
  // 选中 tab 底下滑过来的玻璃背景。tab-item-selected 本身透明，背景全靠 plate 提供。
  const tabListRef = useRef<HTMLDivElement | null>(null)
  const activePlateRef = useRef<HTMLSpanElement | null>(null)
  const workspaceKeyRef = useRef(workspaceKey)
  const tabsRef = useRef(tabs)
  const activeTabIdRef = useRef(activeTabId)
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? tabs[0]

  tabsRef.current = tabs
  activeTabIdRef.current = activeTabId

  // 把当前 tabs / activeTabId 同步写回 atom，跨组件卸载/重挂持久化（含空态）。
  // 在所有改 tabs 的调用点（setTabs / setActiveTabId）之后调用，保持 atom 跟 state 一致。
  const persistTabsState = useCallback(
    (nextTabs: TerminalTab[], nextActiveTabId: string) => {
      store.set(terminalTabsStateFamily(workspaceKey), {
        tabs: nextTabs,
        activeTabId: nextActiveTabId,
      })
    },
    [store, workspaceKey]
  )

  const resolvePanelTheme = useCallback((): TerminalTheme => {
    // 配色从 TAgent 主题 CSS 变量实时读取，深浅自动跟随，对齐会话信息流底色/文字色
    return resolveTerminalTheme()
  }, [])

  // 应用配色到活动 xterm 实例（不重连）
  useEffect(() => {
    const term = termRef.current
    if (!containerRef.current) return
    const theme = resolvePanelTheme()
    setTerminalBackground(theme.background)
    if (!term) return
    term.options.theme = theme
  }, [resolvePanelTheme])

  const getTabTitle = useCallback((tab: TerminalTab): string => {
    return tab.title?.trim() || `终端 ${tab.index}`
  }, [])

  // 更新选中玻璃片位置：根据当前 activeTabId 找到对应 tab DOM，
  // 设 plate 的 width / --app-tab-plate-x / opacity；找不到则隐藏 plate。
  // 逻辑照搬 tabs/TabBar.tsx 的 updateActivePlate。
  const updateActivePlate = useCallback(() => {
    const list = tabListRef.current
    const plate = activePlateRef.current
    if (!list || !plate || !activeTabId) {
      if (plate) plate.style.opacity = '0'
      return
    }

    const activeTab = list.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeTabId)}"]`)
    if (!activeTab) {
      plate.style.opacity = '0'
      return
    }

    plate.style.width = `${activeTab.offsetWidth}px`
    plate.style.setProperty('--app-tab-plate-x', `${activeTab.offsetLeft}px`)
    plate.style.opacity = '1'
  }, [activeTabId])

  // 触发 plate 定位：activeTabId / tabs 变化时同步定位（layoutEffect 避免闪烁），
  // 并用 ResizeObserver 监听 tab-list 容器尺寸变化（窗口 resize 时 plate 位置重算）。
  useLayoutEffect(() => {
    const list = tabListRef.current
    if (!list) return

    const activeTab = activeTabId
      ? list.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(activeTabId)}"]`)
      : null
    const resizeObserver = new ResizeObserver(updateActivePlate)
    resizeObserver.observe(list)
    if (activeTab) resizeObserver.observe(activeTab)
    const frameId = requestAnimationFrame(updateActivePlate)

    return () => {
      cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
    }
  }, [activeTabId, tabs, updateActivePlate])

  // workspace 切换：把当前（旧 workspaceKey 的）tabs 状态写回旧 key 的 atom，
  // 再从新 workspaceKey 的 atom 读持久化状态恢复。空态（[]）也持久化，不补 initial tab。
  useLayoutEffect(() => {
    const previousKey = workspaceKeyRef.current
    if (previousKey === workspaceKey) return
    // 旧 workspaceKey 的状态还在 state 里（refs 同步），写回它的 atom 持久化
    store.set(terminalTabsStateFamily(previousKey), {
      tabs: tabsRef.current,
      activeTabId: activeTabIdRef.current,
    })
    // 读新 workspaceKey 的 atom；没写过（null）用 initialTerminalTabState 初始化并写入
    const persisted = store.get(terminalTabsStateFamily(workspaceKey))
    const next: TerminalTabState = persisted ?? initialTerminalTabState()
    if (!persisted) {
      store.set(terminalTabsStateFamily(workspaceKey), next)
    }
    // activeTabId 兜底：不在 tabs 里时回退到首个 tab 或空串（空态时为 ''）
    const nextActiveId = next.tabs.some((tab) => tab.id === next.activeTabId)
      ? next.activeTabId
      : (next.tabs[0]?.id ?? '')
    workspaceKeyRef.current = workspaceKey
    // 关键：next.tabs.length === 0 时原样用空数组，不补 initialTerminalTabState().tabs
    setTabs(next.tabs)
    setActiveTabId(nextActiveId)
    // 同步最终状态（含 activeTabId 兜底修正）到新 workspaceKey 的 atom
    store.set(terminalTabsStateFamily(workspaceKey), {
      tabs: next.tabs,
      activeTabId: nextActiveId,
    })
    setRenamingTabId(null)
    setRenameValue('')
  }, [store, workspaceKey])

  const disposeRenderer = useCallback(() => {
    const term = termRef.current
    const disposer = (term as (Terminal & { __dispose?: () => void }) | null)?.__dispose
    disposer?.()
    term?.dispose()
    termRef.current = null
    fitRef.current = null
    const container = containerRef.current
    if (container) container.replaceChildren()
  }, [])

  // （重）建 xterm 实例并接到常驻 PTY 会话。卸载时只拆 xterm 渲染器；
  // 主进程 PTY 保持存活，切 tab/折叠面板保留 shell 状态，重连时重放环形缓冲。
  const sessionIdForTab = useCallback(
    (tabId: string): string => terminalSessionIdForWorkspace(workspaceRoot, tabId),
    [workspaceRoot]
  )

  const attachTerminal = useCallback(
    async (tabId: string) => {
      const sessionId = sessionIdForTab(tabId)
      const attachToken = ++attachTokenRef.current
      const isCurrentAttach = (): boolean =>
        aliveRef.current && attachTokenRef.current === attachToken
      const container = containerRef.current
      if (!container || !isCurrentAttach()) return
      container.replaceChildren()
      setError(null)
      setExited(false)

      const cols = fitRef.current?.proposeDimensions()?.cols ?? TERMINAL_DEFAULT_COLS
      const rows = fitRef.current?.proposeDimensions()?.rows ?? TERMINAL_DEFAULT_ROWS

      const theme = resolvePanelTheme()
      setTerminalBackground(theme.background)

      const term = new Terminal({
        fontFamily: TERMINAL_FONT_FAMILY,
        fontSize: TERMINAL_FONT_SIZE,
        cursorBlink: true,
        scrollback: TERMINAL_SCROLLBACK,
        allowProposedApi: true,
        theme,
        cols,
        rows,
      })
      const fit = new FitAddon()
      term.loadAddon(fit)
      term.loadAddon(new WebLinksAddon())
      term.open(container)
      termRef.current = term
      fitRef.current = fit
      // 容器可能还在 settle（懒 Suspense），首帧 fit 推到下一帧确保 clientWidth 正确
      requestAnimationFrame(() => {
        if (!isCurrentAttach()) return
        try {
          fit.fit()
        } catch {
          /* 忽略，直到元素有可测尺寸 */
        }
      })

      // PTY 输出 → xterm
      const offData = window.electronAPI.terminal.onData((payload) => {
        if (payload.sessionId !== sessionId) return
        term.write(payload.data)
      })
      const offExit = window.electronAPI.terminal.onExit((payload) => {
        if (payload.sessionId !== sessionId) return
        setExited(true)
      })

      // xterm 输入 → PTY
      const disposable = term.onData((data) => {
        void window.electronAPI.terminal.write({ sessionId, data })
      })

      // 列/行跟面板宽度同步
      let resizeTimer: ReturnType<typeof setTimeout> | null = null
      const triggerFit = (): void => {
        if (resizeTimer) clearTimeout(resizeTimer)
        resizeTimer = setTimeout(() => {
          if (!isCurrentAttach()) return
          try {
            fit.fit()
          } catch {
            /* 忽略 */
          }
        }, FIT_DEBOUNCE_MS)
      }
      const resizeObserver = new ResizeObserver(triggerFit)
      resizeObserver.observe(container)
      const onDimensionChange = (dim: { cols: number; rows: number }): void => {
        void window.electronAPI.terminal.resize({ sessionId, cols: dim.cols, rows: dim.rows })
      }
      const fitDisposable = term.onResize(onDimensionChange)

      // 创建（或重连）PTY 会话。重连时主进程先重放环形缓冲再推新输出
      try {
        const result = await window.electronAPI.terminal.create({
          sessionId,
          cwd: workspaceRoot || undefined,
          cols,
          rows,
        })
        if (!isCurrentAttach()) return
        if (!result.ok) {
          setError(result.message)
          return
        }
        // 成功（重）连后同步最新 fit，使 PTY 匹配可见网格
        const dims = fit.proposeDimensions()
        if (dims) {
          void window.electronAPI.terminal.resize({
            sessionId,
            cols: dims.cols,
            rows: dims.rows,
          })
        }
        setExited(false)
      } catch (e) {
        if (!isCurrentAttach()) return
        setError(e instanceof Error ? e.message : String(e))
      }

      // 拆卸函数挂到实例上
      ;(term as Terminal & { __dispose?: () => void }).__dispose = () => {
        offData()
        offExit()
        disposable.dispose()
        fitDisposable.dispose()
        resizeObserver.disconnect()
        if (resizeTimer) clearTimeout(resizeTimer)
      }
    },
    [resolvePanelTheme, sessionIdForTab, workspaceRoot]
  )

  useEffect(() => {
    aliveRef.current = true
    if (activeTab) void attachTerminal(activeTab.id)
    return () => {
      aliveRef.current = false
      attachTokenRef.current += 1
      disposeRenderer()
    }
  }, [activeTab, attachTerminal, disposeRenderer])

  // 跟随 app 深/浅主题切换（TAgent 用 <html>.dark class）
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const term = termRef.current
      if (!containerRef.current) return
      // 深/浅切换时 CSS 变量值变化，重读重组 theme，终端底色/前景实时跟随
      const theme = resolvePanelTheme()
      setTerminalBackground(theme.background)
      if (!term) return
      term.options.theme = theme
    })
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    })
    return () => observer.disconnect()
  }, [resolvePanelTheme])

  useEffect(() => {
    if (!renamingTabId) return
    requestAnimationFrame(() => {
      renameInputRef.current?.focus()
      renameInputRef.current?.select()
    })
  }, [renamingTabId])

  const handleNewTab = useCallback(() => {
    if (tabs.length >= MAX_RENDERER_TABS) return
    const nextIndex = tabs.length + 1
    const tab: TerminalTab = {
      id: `tab-${Date.now().toString(36)}-${nextIndex}`,
      index: nextIndex,
    }
    const nextTabs = [...tabs, tab]
    setTabs(nextTabs)
    setActiveTabId(tab.id)
    persistTabsState(nextTabs, tab.id)
  }, [persistTabsState, tabs.length])

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const closingIndex = tabs.findIndex((tab) => tab.id === tabId)
      if (closingIndex === -1) return
      void window.electronAPI.terminal.dispose(sessionIdForTab(tabId))
      const nextTabs = tabs.filter((tab) => tab.id !== tabId)
      let nextActiveId = activeTabId
      if (activeTabId === tabId) {
        const nextTab = tabs[closingIndex + 1] ?? tabs[closingIndex - 1] ?? null
        nextActiveId = nextTab && nextTab.id !== tabId ? nextTab.id : ''
      }
      setTabs(nextTabs)
      setActiveTabId(nextActiveId)
      // 关空后 nextTabs 为 []，空态持久化：原样写 []，不补 initial tab
      persistTabsState(nextTabs, nextActiveId)
    },
    [activeTabId, persistTabsState, sessionIdForTab, tabs]
  )

  // 切换活跃 tab（点击 / 右键选中 / 菜单打开）：同步 activeTabId 到 atom 持久化
  const selectTab = useCallback(
    (tabId: string) => {
      setActiveTabId(tabId)
      persistTabsState(tabsRef.current, tabId)
    },
    [persistTabsState]
  )

  const startRenameTab = useCallback(
    (tabId: string) => {
      const tab = tabs.find((item) => item.id === tabId)
      if (!tab) return
      setRenamingTabId(tabId)
      setRenameValue(getTabTitle(tab))
    },
    [getTabTitle, tabs]
  )

  const commitRenameTab = useCallback(() => {
    if (!renamingTabId) return
    const nextTitle = renameValue.trim()
    const nextTabs = tabs.map((tab) =>
      tab.id === renamingTabId ? { ...tab, title: nextTitle || undefined } : tab
    )
    setTabs(nextTabs)
    persistTabsState(nextTabs, activeTabId)
    setRenamingTabId(null)
    setRenameValue('')
  }, [activeTabId, persistTabsState, renameValue, renamingTabId, tabs])

  const cancelRenameTab = useCallback(() => {
    setRenamingTabId(null)
    setRenameValue('')
  }, [])

  const handleCloseOtherTabs = useCallback(
    (tabId: string) => {
      const keptTab = tabs.find((tab) => tab.id === tabId)
      if (!keptTab) return
      for (const tab of tabs) {
        if (tab.id !== tabId) void window.electronAPI.terminal.dispose(sessionIdForTab(tab.id))
      }
      setTabs([keptTab])
      setActiveTabId(tabId)
      persistTabsState([keptTab], tabId)
      if (renamingTabId && renamingTabId !== tabId) cancelRenameTab()
    },
    [cancelRenameTab, persistTabsState, renamingTabId, sessionIdForTab, tabs]
  )

  const handleCloseAllTabs = useCallback(() => {
    for (const tab of tabs) {
      void window.electronAPI.terminal.dispose(sessionIdForTab(tab.id))
    }
    cancelRenameTab()
    // 关闭全部：重置回单个 main tab（跟「关空」区别——这是「一键重来」语义），
    // 持久化重置后的状态，切走再切回仍是这 1 个 tab
    const next = initialTerminalTabState()
    setTabs(next.tabs)
    setActiveTabId(next.activeTabId)
    persistTabsState(next.tabs, next.activeTabId)
  }, [cancelRenameTab, persistTabsState, sessionIdForTab, tabs])

  const handleRestart = useCallback(async () => {
    if (!activeTab) return
    // 拆旧 shell 再重连，spawn 一个新的
    try {
      await window.electronAPI.terminal.dispose(sessionIdForTab(activeTab.id))
    } catch {
      /* 忽略 */
    }
    setError(null)
    setExited(false)
    disposeRenderer()
    aliveRef.current = true
    void attachTerminal(activeTab.id)
  }, [activeTab, attachTerminal, disposeRenderer, sessionIdForTab])

  return (
    <aside
      className={`titlebar-no-drag flex h-full w-full min-h-0 min-w-0 flex-col overflow-hidden bg-transparent text-foreground ${className}`}
    >
      {/* 顶部 tab 栏：复用会话 TabBar 的 app-workspace-tab-strip / app-workspace-tab* 视觉，
          让终端 tab 栏位置、留白、底线、拖拽语义与会话 TabBar 完全一致。
          - strip 层可拖窗（titlebar-drag-region 覆盖层），tab 按钮与右侧操作区不拖（titlebar-no-drag）
          - 只搬视觉：不引入会话特有的拖拽重排 / hover 预览 / 中键关闭 / 流式状态点
          - 保留终端交互：点击切 tab、右键菜单、重命名、新建/关闭/重启
          - 右键菜单换成 @tagent/ui 的 ContextMenu：每个 tab 各自一个 ContextMenuTrigger，
            strip 外层再包一个 ContextMenu 兜底空白处右键弹当前活跃 tab 的菜单 */}
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            className="app-workspace-tab-strip content-shell-chrome-bleed relative flex shrink-0 items-center"
            data-session-transition-enter="tab"
          >
            {/* 拖拽区覆盖层：tab 栏空白处可拖动窗口（与 TabBar 同构） */}
            <div
              className="absolute inset-0 z-[1] titlebar-drag-region pointer-events-none"
              aria-hidden
            />

            <div
              ref={tabListRef}
              className="app-workspace-tab-list relative z-[2] flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scrollbar-none"
              role="tablist"
              aria-label="内置终端"
            >
              {/* 选中滑动玻璃片：绝对定位在 tab 底下，靠 JS 设位置/宽度，复用会话 TabBar 同款 class */}
              <span ref={activePlateRef} className="app-workspace-tab-active-plate" aria-hidden />
              {tabs.map((tab) => {
                const active = tab.id === activeTabId
                return (
                  <div
                    key={tab.id}
                    className="app-workspace-tab-shell relative z-[1] h-8 titlebar-no-drag"
                    data-tab-id={tab.id}
                    data-active={active || undefined}
                  >
                    {renamingTabId === tab.id ? (
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={commitRenameTab}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            commitRenameTab()
                          }
                          if (event.key === 'Escape') {
                            event.preventDefault()
                            cancelRenameTab()
                          }
                        }}
                        // 重命名输入框：不沿用 app-workspace-tab（会强制 10px/muted/透明底），
                        // 自撑 shell 全宽，圆角/边框/字号可读，titlebar-no-drag 不阻断拖窗语义
                        className="relative flex h-8 w-full items-center rounded-[var(--app-shell-tab-radius,11px)] border border-border bg-background px-2.5 text-[12px] text-foreground outline-none focus:border-primary titlebar-no-drag"
                        aria-label="重命名终端标签"
                      />
                    ) : (
                      <ContextMenu
                        onOpenChange={(open) => {
                          // 右键打开菜单时把对应 tab 设为活跃（双保险：onPointerDownCapture 已先选中）
                          if (open) selectTab(tab.id)
                        }}
                      >
                        <ContextMenuTrigger asChild>
                          <button
                            type="button"
                            role="tab"
                            ref={(node) => {
                              tabButtonRefs.current[tab.id] = node
                            }}
                            aria-selected={active}
                            data-active={active || undefined}
                            onClick={() => selectTab(tab.id)}
                            // 右键按下即选中 tab（防 xterm 抢焦点，不等 Radix onContextMenu 松开触发）
                            onPointerDownCapture={(event) => {
                              if (event.button === 2) selectTab(tab.id)
                            }}
                            className={
                              'app-workspace-tab relative flex h-8 w-full items-center gap-1.5 pl-2.5 pr-6 select-none cursor-pointer ' +
                              (active
                                ? 'tab-item-selected'
                                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50')
                            }
                          >
                            <span className="app-workspace-tab__content flex min-w-0 flex-1 items-center gap-1.5 text-left">
                              <TerminalSquare
                                className="app-workspace-tab__icon"
                                size={14}
                                strokeWidth={1.75}
                                aria-hidden
                              />
                              <span className="app-workspace-tab__title">{getTabTitle(tab)}</span>
                            </span>
                          </button>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-40 z-[9999] min-w-0 p-0.5">
                          <ContextMenuItem
                            className="text-xs py-1 [&>svg]:size-3.5"
                            onSelect={() => startRenameTab(tab.id)}
                          >
                            <PencilLine /> 重命名标签
                          </ContextMenuItem>
                          <ContextMenuSeparator className="my-0.5" />
                          <ContextMenuItem
                            className="text-xs py-1 [&>svg]:size-3.5"
                            disabled={tabs.length <= 1}
                            onSelect={() => handleCloseOtherTabs(tab.id)}
                          >
                            <PanelRightClose /> 关闭其他标签
                          </ContextMenuItem>
                          <ContextMenuItem
                            className="text-xs py-1 [&>svg]:size-3.5 text-destructive"
                            onSelect={handleCloseAllTabs}
                          >
                            <PanelsTopLeft /> 关闭全部标签
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    )}

                    {renamingTabId !== tab.id ? (
                      <button
                        type="button"
                        className="app-workspace-tab-close"
                        aria-label="关闭标签"
                        tabIndex={active ? 0 : -1}
                        onClick={(event) => {
                          event.stopPropagation()
                          handleCloseTab(tab.id)
                        }}
                      >
                        <X aria-hidden />
                      </button>
                    ) : null}
                  </div>
                )
              })}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleNewTab}
                    disabled={tabs.length >= MAX_RENDERER_TABS}
                    className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 titlebar-no-drag"
                    aria-label="新建终端标签"
                  >
                    <Plus className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>新建终端标签</TooltipContent>
              </Tooltip>
            </div>

            <div className="relative z-[2] flex min-w-0 shrink-0 items-center justify-end gap-1 ml-3 titlebar-no-drag">
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => void handleRestart()}
                    className="rounded-full p-1.5 text-muted-foreground transition hover:bg-foreground/[0.06] hover:text-foreground"
                    aria-label="重启终端"
                  >
                    <RotateCw className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>重启终端</TooltipContent>
              </Tooltip>
            </div>
            {/* 空白区域右键兜底菜单：右键 strip 空白处弹当前活跃 tab 的菜单
                （tab 本身各有内层 ContextMenu，右键 tab 时内层拦截，不会冒泡到外层） */}
            {activeTab ? (
              <ContextMenuContent className="w-40 z-[9999] min-w-0 p-0.5">
                <ContextMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5"
                  onSelect={() => startRenameTab(activeTab.id)}
                >
                  <PencilLine /> 重命名标签
                </ContextMenuItem>
                <ContextMenuSeparator className="my-0.5" />
                <ContextMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5"
                  disabled={tabs.length <= 1}
                  onSelect={() => handleCloseOtherTabs(activeTab.id)}
                >
                  <PanelRightClose /> 关闭其他标签
                </ContextMenuItem>
                <ContextMenuItem
                  className="text-xs py-1 [&>svg]:size-3.5 text-destructive"
                  onSelect={handleCloseAllTabs}
                >
                  <PanelsTopLeft /> 关闭全部标签
                </ContextMenuItem>
              </ContextMenuContent>
            ) : null}
          </div>
        </ContextMenuTrigger>
      </ContextMenu>

      {/* 终端主体：实色 xterm 区。
          四周对齐 band（跟 left rail 同范围），不贴窗口边：
          - 顶部：由上方 tab 栏 app-workspace-tab-strip 的 margin-top 对齐 band top，这里不重复
          - 底部：margin-bottom = --shell-band-inset-bottom(24px)，终端无 token bar，
            直接对齐 band bottom（不像会话 composer 要减 status-bottom / token-h）
          - 右侧：margin-right = --app-shell-session-gutter(16px)，跟 TabBar/composer 右侧对齐量一致
          - 左侧：贴 aside 左缘（即 left rail 右缘），不加 margin
          aside 透明，terminalBody 缩进后底部/右侧露出主区背景（scene），视觉上实色块
          四周对齐 band，与 left rail 等高同范围。 */}
      <div
        ref={terminalBodyRef}
        className="relative min-h-0 flex-1 overflow-hidden rounded-xl bg-card px-5 py-4"
        style={{
          marginBottom: 'var(--shell-band-inset-bottom, 24px)',
          marginRight: 'var(--app-shell-session-gutter, 16px)',
          ...(terminalBackground ? { backgroundColor: terminalBackground } : {}),
        }}
      >
        {tabs.length === 0 ? (
          // 空态：所有终端 tab 已关闭，提示新建
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div>
              <div className="text-[13px] font-semibold text-foreground">没有打开的终端</div>
              <div className="mt-2 text-[12px] text-muted-foreground">所有终端标签已关闭</div>
              <button
                type="button"
                onClick={handleNewTab}
                className="mt-4 rounded-full bg-foreground/10 px-3 py-1.5 text-[12px] font-semibold text-foreground transition hover:bg-foreground/20"
              >
                新建终端
              </button>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="h-full w-full" key={activeTab?.id} />
        )}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
            <div>
              <div className="text-[13px] font-semibold text-red-500 dark:text-red-400">
                终端不可用
              </div>
              <div className="mt-2 max-w-sm text-[12px] leading-5 text-muted-foreground">
                {error}
              </div>
              <button
                type="button"
                onClick={() => void handleRestart()}
                className="mt-4 rounded-full bg-foreground/10 px-3 py-1.5 text-[12px] font-semibold text-foreground transition hover:bg-foreground/20"
              >
                重启终端
              </button>
            </div>
          </div>
        ) : null}
        {exited && !error ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
            <button
              type="button"
              onClick={() => void handleRestart()}
              className="pointer-events-auto rounded-full bg-foreground/10 px-3 py-1.5 text-[12px] font-semibold text-foreground shadow-lg backdrop-blur transition hover:bg-foreground/20"
            >
              终端已退出，点击重启
            </button>
          </div>
        ) : null}
      </div>
    </aside>
  )
}

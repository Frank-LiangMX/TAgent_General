import { existsSync } from 'fs'
import { join } from 'path'

import { Tray, Menu, app, nativeImage, nativeTheme, BrowserWindow, type NativeImage } from 'electron'

import { requestApplicationQuit } from './lib/app-shutdown'
import { isAgentSessionActive } from './lib/agent-service'
import { listAgentSessions } from './lib/agent-session-manager'
import { listAgentWorkspaces } from './lib/agent-workspace-manager'
import { createTrayMenuModel, type TrayRecentSessionItem } from './lib/tray-menu-model'
import { getThemeIconPath, resolveLogoKey } from './lib/theme-icon-resolver'
import { getSettings } from './lib/settings-service'
import type { ThemeMode, ThemeStyle } from '../types'

let tray: Tray | null = null

export interface TrayActions {
  showMainWindow: () => void
  openAgentSession: (sessionId: string, title: string) => void
  createAgentSession: () => void
}

/**
 * 获取托盘图标路径
 *
 * - macOS: 使用 iconTemplate.png（单色模板，跟随菜单栏明暗自动反色）
 * - Windows/Linux: 使用当前主题对应的彩色图标
 */
function getTrayIconPath(): string {
  // dev: __dirname/resources（build:resources 拷贝产物）
  // prod: process.resourcesPath（electron-builder extraResources 产物）
  const resourcesDir = app.isPackaged ? process.resourcesPath : join(__dirname, 'resources')

  // macOS 保持单色 template 图标（符合菜单栏设计规范）
  if (process.platform === 'darwin') {
    return join(resourcesDir, 'iconTemplate.png')
  }

  // Windows/Linux 用当前主题对应的彩色图标
  const settings = getSettings()
  const key = resolveLogoKey(
    settings.themeMode,
    settings.themeStyle,
    nativeTheme.shouldUseDarkColors
  )
  return getThemeIconPath(key)
}

/**
 * 加载托盘图标并缩放到 16×16（Windows/Linux 用）
 *
 * 1254×1254 的主题图标直接交给系统会在托盘里模糊，需显式 resize 保证清晰。
 * 失败时返回 null，调用方 fallback 到原图。
 */
/**
 * 加载托盘图标并缩放到 16×16（Windows/Linux 用）
 *
 * 1254×1254 的主题图标直接交给系统会在托盘里模糊，需显式 resize 保证清晰。
 * 失败时返回 null，调用方 fallback 到原图。
 */
function loadTrayIconImage(iconPath: string): NativeImage | null {
  if (!existsSync(iconPath)) return null
  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) return null
  return image.resize({ width: 16, height: 16, quality: 'best' })
}

/** 将主窗口隐藏到托盘（Windows/Linux 同时从任务栏移除） */
export function hideWindowToTray(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (process.platform !== 'darwin') {
    win.setSkipTaskbar(true)
  }
  win.hide()
}

/** 从托盘恢复主窗口前，还原任务栏图标 */
export function prepareWindowFromTray(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (process.platform !== 'darwin') {
    win.setSkipTaskbar(false)
  }
}

/** 显示主窗口 */
function showMainWindow(): void {
  const windows = BrowserWindow.getAllWindows()
  if (windows.length === 0) return
  const mainWindow = windows[0]!
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

function getDefaultTrayActions(): TrayActions {
  return {
    showMainWindow,
    openAgentSession: () => showMainWindow(),
    createAgentSession: () => showMainWindow(),
  }
}

function createRecentSessionMenuItem(
  item: TrayRecentSessionItem,
  actions: TrayActions
): Electron.MenuItemConstructorOptions {
  return {
    label: item.title,
    sublabel: item.subtitle,
    click: () => actions.openAgentSession(item.id, item.title),
  }
}

function buildTrayMenu(actions: TrayActions): Menu {
  const sessions = listAgentSessions()
  const runningSessionIds = new Set(
    sessions.filter((session) => isAgentSessionActive(session.id)).map((session) => session.id)
  )
  const model = createTrayMenuModel(sessions, listAgentWorkspaces(), runningSessionIds)
  const runningItems = model.runningSessions.map((item) =>
    createRecentSessionMenuItem(item, actions)
  )
  const recentItems = model.recentSessions.map((item) => createRecentSessionMenuItem(item, actions))
  const moreItems = model.moreSessions.map((item) => createRecentSessionMenuItem(item, actions))

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(runningItems.length > 0
      ? [{ label: '运行中', enabled: false }, ...runningItems, { type: 'separator' as const }]
      : []),
    { label: '最近', enabled: false },
    ...(recentItems.length > 0 ? recentItems : [{ label: '暂无最近会话', enabled: false }]),
    ...(moreItems.length > 0
      ? [
          {
            label: '更多',
            submenu: moreItems,
          },
        ]
      : []),
    { type: 'separator' },
    {
      label: '新建 Agent 会话',
      click: () => actions.createAgentSession(),
    },
    { type: 'separator' },
    {
      label: '打开 TAgent',
      click: () => actions.showMainWindow(),
    },
    { type: 'separator' },
    {
      label: '退出 TAgent',
      click: () => {
        requestApplicationQuit()
      },
    },
  ]

  return Menu.buildFromTemplate(template)
}

function updateTrayMenu(actions: TrayActions): Menu | null {
  if (!tray) return null
  const contextMenu = buildTrayMenu(actions)
  tray.setContextMenu(contextMenu)
  return contextMenu
}

/**
 * 创建系统托盘图标和菜单
 */
export function createTray(actionsInput?: Partial<TrayActions>): Tray | null {
  const iconPath = getTrayIconPath()
  const actions = { ...getDefaultTrayActions(), ...actionsInput }

  if (!existsSync(iconPath)) {
    console.warn('Tray icon not found at:', iconPath)
    return null
  }

  try {
    // macOS 用 iconTemplate.png；Windows/Linux 用主题彩色图标（已 resize 到 16×16）
    const isMac = process.platform === 'darwin'
    const image = isMac ? nativeImage.createFromPath(iconPath) : loadTrayIconImage(iconPath)

    if (!image || image.isEmpty()) {
      console.warn('Tray icon image is empty:', iconPath)
      return null
    }

    // macOS: 标记为 Template 图像
    // Template 图像必须是单色的，使用 alpha 通道定义形状
    // 系统会自动根据菜单栏主题填充颜色
    if (isMac) {
      image.setTemplateImage(true)
    }

    tray = new Tray(image)

    // 设置 tooltip
    tray.setToolTip('TAgent')

    updateTrayMenu(actions)

    // 左键单击：显示主窗口（零延迟唤起）
    tray.on('click', () => {
      actions.showMainWindow()
    })

    // 右键：刷新菜单（Windows/Linux 自动弹出，macOS 需 click 时 popUp）
    tray.on('right-click', () => {
      updateTrayMenu(actions)
    })

    console.log('System tray created')
    return tray
  } catch (error) {
    console.error('Failed to create system tray:', error)
    return null
  }
}

/**
 * 更新托盘图标以匹配当前主题
 *
 * - macOS: 直接 return，保持 iconTemplate.png 单色模板（由系统处理明暗）
 * - Windows/Linux: 切换到对应主题的彩色图标（resize 到 16×16 保证清晰）
 *
 * 在主题设置变化或系统明暗变化时由 ipc.ts 调用。
 */
export function updateTrayIcon(
  mode: ThemeMode,
  style: ThemeStyle | undefined,
  systemIsDark: boolean
): void {
  if (!tray || tray.isDestroyed()) return
  // macOS 托盘保持单色 template，不跟随应用主题
  if (process.platform === 'darwin') return

  const key = resolveLogoKey(mode, style, systemIsDark)
  const iconPath = getThemeIconPath(key)
  const image = loadTrayIconImage(iconPath)
  if (!image) {
    console.warn('[托盘] 主题图标加载失败:', iconPath)
    return
  }

  tray.setImage(image)
}

/**
 * 销毁系统托盘
 */
export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

/**
 * 获取当前托盘实例
 */
export function getTray(): Tray | null {
  return tray
}

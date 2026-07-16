import { existsSync } from 'fs'
import { join } from 'path'

import {
  Tray,
  Menu,
  app,
  nativeImage,
  nativeTheme,
  BrowserWindow,
  type NativeImage,
} from 'electron'

import type { ThemeMode, ThemeStyle } from '../types'
import { requestApplicationQuit } from './lib/app-shutdown'
import { isAgentSessionActive } from './lib/agent-service'
import { listAgentSessions } from './lib/agent-session-manager'
import { listAgentWorkspaces } from './lib/agent-workspace-manager'
import { createTrayMenuModel, type TrayRecentSessionItem } from './lib/tray-menu-model'
import {
  getThemeIconCandidatePaths,
  getThemeIconPath,
  resolveLogoKey,
} from './lib/theme-icon-resolver'
import { getSettings } from './lib/settings-service'

let tray: Tray | null = null

export interface TrayActions {
  showMainWindow: () => void
  openAgentSession: (sessionId: string, title: string) => void
  createAgentSession: () => void
}

function getTrayIconPath(): string {
  const resourcesDir = app.isPackaged ? process.resourcesPath : join(__dirname, 'resources')

  if (process.platform === 'darwin') {
    return join(resourcesDir, 'iconTemplate.png')
  }

  const settings = getSettings()
  const key = resolveLogoKey(
    settings.themeMode,
    settings.themeStyle,
    nativeTheme.shouldUseDarkColors
  )
  return getThemeIconPath(key)
}

function loadTrayIconImage(iconPath: string): NativeImage | null {
  if (!existsSync(iconPath)) return null
  const image = nativeImage.createFromPath(iconPath)
  if (image.isEmpty()) return null
  return image.resize({ width: 16, height: 16, quality: 'best' })
}

export function hideWindowToTray(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (process.platform !== 'darwin') {
    win.setSkipTaskbar(true)
  }
  win.hide()
}

export function prepareWindowFromTray(win: BrowserWindow): void {
  if (win.isDestroyed()) return
  if (process.platform !== 'darwin') {
    win.setSkipTaskbar(false)
  }
}

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

export function createTray(actionsInput?: Partial<TrayActions>): Tray | null {
  const iconPath = getTrayIconPath()
  const actions = { ...getDefaultTrayActions(), ...actionsInput }

  if (!existsSync(iconPath)) {
    console.warn('Tray icon not found at:', iconPath)
    return null
  }

  try {
    const isMac = process.platform === 'darwin'
    const image = isMac ? nativeImage.createFromPath(iconPath) : loadTrayIconImage(iconPath)

    if (!image || image.isEmpty()) {
      console.warn('Tray icon image is empty:', iconPath)
      return null
    }

    if (isMac) {
      image.setTemplateImage(true)
    }

    tray = new Tray(image)
    tray.setToolTip('TAgent')

    updateTrayMenu(actions)

    tray.on('click', () => {
      actions.showMainWindow()
    })

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

export function updateTrayIcon(
  mode: ThemeMode,
  style: ThemeStyle | undefined,
  systemIsDark: boolean
): void {
  if (!tray || tray.isDestroyed()) return
  if (process.platform === 'darwin') return

  const key = resolveLogoKey(mode, style, systemIsDark)
  const iconPath = getThemeIconPath(key)
  const image = iconPath ? loadTrayIconImage(iconPath) : null
  if (!image) {
    console.warn('[托盘] 主题图标缺失，已检查路径:', getThemeIconCandidatePaths(key))
    return
  }

  tray.setImage(image)
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}

export function getTray(): Tray | null {
  return tray
}

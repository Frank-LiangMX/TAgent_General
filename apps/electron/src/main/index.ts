import { existsSync } from 'fs'
import { join } from 'path'

import { setTAgentVersion } from '@tagent/core'
import { getMacTrafficLightPosition } from '@tagent/shared'
import { app, BrowserWindow, dialog, Menu, protocol, screen, shell } from 'electron'

import { TRAY_IPC_CHANNELS, WINDOW_CLOSE_IPC_CHANNELS } from '../types'
import { registerIpcHandlers } from './ipc'
import { killOrphanedClaudeSubprocesses } from './lib/agent-service'
import { startAutoArchiveScheduler } from './lib/auto-archive-scheduler'
import {
  clearForceExitFallback,
  requestApplicationQuit,
  runApplicationShutdown,
  scheduleForceExitFallback,
} from './lib/app-shutdown'
import { upgradeDefaultSkillsInWorkspaces } from './lib/agent-workspace-manager'
import { getIsQuitting, setQuitting } from './lib/app-lifecycle'
import { registerBridge, startAllBridges } from './lib/bridge-registry'
import { startChatToolsWatcher } from './lib/tool-config-watcher'
import { seedDefaultSkills } from './lib/config-paths'
import { dingtalkBridgeManager } from './lib/dingtalk-bridge-manager'
import { getDingTalkMultiBotConfig } from './lib/dingtalk-config'
import { feishuBridgeManager } from './lib/feishu-bridge-manager'
import { getFeishuMultiBotConfig } from './lib/feishu-config'
import { syncFeishuSyncSleepBlocker } from './lib/feishu-sleep-blocker'
import { registerGlobalShortcut } from './lib/global-shortcut-service'
import { handleTAgentFileRequest } from './lib/local-file-protocol'
import { ensureKsccRipgrep } from './lib/ensure-kscc-ripgrep'
import {
  createQuickTaskWindow,
  toggleQuickTaskWindow,
} from './lib/quick-task-window'
import { initializeRuntime } from './lib/runtime-init'
import { getSettings, updateSettings } from './lib/settings-service'
import { initAutoUpdater } from './lib/updater/auto-updater'
import {
  createVoiceDictationWindow,
  toggleVoiceDictationWindow,
  shouldSuppressVoiceDictationActivate,
} from './lib/voice-dictation-window'
import { wechatBridge } from './lib/wechat-bridge'
import { getWeChatConfig } from './lib/wechat-config'
import { startWorkspaceWatcher } from './lib/workspace-watcher'
import { wpsBridge } from './lib/wps-bridge'
import { getDecryptedWpsSecretKey, getWpsConfig } from './lib/wps-config'
import { createApplicationMenu } from './menu'
import { createTray, destroyTray, getTray } from './tray'

// Dev 与正式版使用独立的 userData 目录，避免共享 Chromium SingletonLock 导致 dev 启动被静默退出
// 必须在任何会读取 userData 路径的模块加载之前执行
const isDevBuild = !app.isPackaged
if (isDevBuild) {
  app.setPath('userData', join(app.getPath('appData'), '@tagent/electron-dev'))
}

// 开发模式：electronmon 重启 / 终端 SIGTERM 时真正退出，避免 Dock 残留多个 Electron
if (isDevBuild) {
  const gracefulDevExit = (): void => {
    if (!getIsQuitting()) {
      setQuitting()
      app.quit()
    }
  }
  process.on('SIGTERM', gracefulDevExit)
  process.on('SIGINT', gracefulDevExit)
}

// 单实例锁：防止重复启动同一个版本（dev/prod 因 userData 已隔离，互不影响）
//
// 失败的常见原因：用户升级新版本时旧版进程仍在后台运行（macOS 关闭窗口 = hide
// 不退出）。原先此处直接 process.exit(0)，没有任何用户可见反馈——如果旧进程
// 卡在启动期，second-instance 也唤不起窗口，用户表现就是"双击应用没反应"。
// 改为：留下 stderr 排查线索后正常退出，让 Electron 触发已存在实例的
// second-instance 事件，由主实例负责显示窗口。
if (!app.requestSingleInstanceLock()) {
  console.warn(
    '[启动] 已有 TAgent 进程持有单实例锁，本次启动将退出。\n' +
      '  如果窗口未出现，可能旧进程已卡死。请运行 `bun run dev-stop` 后重试。'
  )
  app.quit()
} else {
  // 主流程：正常启动（单实例锁已获取）
  registerProtocolsAndHandlers()
}

function registerProtocolsAndHandlers(): void {
  // 注册自定义协议方案为"特权"（必须在 app ready 之前）
  // 用于内联预览本地文件（renderer 用 iframe 加载 tagent-file:// 资源）
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'tagent-file',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ])

  // Windows: 禁用 LCD 次像素抗锯齿（ClearType），改用灰度 AA。
  // ClearType 是为浅色背景+深色文字设计的，在深色代码块背景下会产生彩色边缘，导致文字模糊。
  if (process.platform === 'win32') {
    app.commandLine.appendSwitch('disable-lcd-text')
  }

  // macOS 文件关联：在 app ready 之前注册 open-file 事件
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    handleMigrationFileOpen(filePath)
  })

  // Windows 文件关联：当用户双击文件时，新实例的参数会通过 second-instance 传给已有实例
  app.on('second-instance', (_event, argv) => {
    showAndFocusMainWindow()
    const fileArg = argv.find(
      (arg) => arg.endsWith('.tagent-backup') || arg.endsWith('.tagent-share')
    )
    if (fileArg) {
      handleMigrationFileOpen(fileArg)
    }
  })
}

// 处理 EPIPE 错误：当 stdout/stderr 管道被关闭时（如 electronmon 重启），忽略写入错误
// 这在开发环境热重载时经常发生，不影响应用功能
process.stdout?.on?.('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return
  throw err
})
process.stderr?.on?.('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') return
  throw err
})

// 清理本地环境中的 ANTHROPIC_* 变量，防止干扰应用的认证流程
// Electron 桌面应用通过渠道系统管理 API Key，不应受终端环境变量影响
// 注意：此操作必须在 initializeRuntime()（loadShellEnv）之前执行
for (const key of Object.keys(process.env)) {
  if (key.startsWith('ANTHROPIC_')) {
    delete process.env[key]
  }
}

const MIGRATION_IPC_OPEN = 'migration:open-import-file'

/** 检查文件路径是否为迁移文件，如果是则通知渲染进程打开导入流程 */
function handleMigrationFileOpen(filePath: string): void {
  if (filePath.endsWith('.tagent-backup') || filePath.endsWith('.tagent-share')) {
    sendToMainWindow(MIGRATION_IPC_OPEN, { filePath })
  }
}

// ===== Bridge 注册（新增 Bridge 只需在此添加一个 registerBridge 调用） =====

registerBridge({
  name: '飞书 BridgeManager',
  shouldAutoStart: () => {
    const config = getFeishuMultiBotConfig()
    return config.bots.some((b) => b.enabled && b.appId && b.appSecret)
  },
  start: () => feishuBridgeManager.startAll(),
  stop: () => feishuBridgeManager.stopAll(),
})

registerBridge({
  name: '钉钉 BridgeManager',
  shouldAutoStart: () => {
    const config = getDingTalkMultiBotConfig()
    return config.bots.some((b) => b.enabled && b.clientId && b.clientSecret)
  },
  start: () => dingtalkBridgeManager.startAll(),
  stop: () => dingtalkBridgeManager.stopAll(),
})

registerBridge({
  name: '微信 Bridge',
  shouldAutoStart: () => {
    const config = getWeChatConfig()
    return !!(config.enabled && config.credentials)
  },
  start: () => wechatBridge.start(),
  stop: () => wechatBridge.stop(),
})

registerBridge({
  name: 'WPS 协作 Bridge',
  shouldAutoStart: () => {
    const config = getWpsConfig()
    return !!(config.enabled && config.appId && getDecryptedWpsSecretKey())
  },
  start: () => wpsBridge.start(),
  stop: () => wpsBridge.stop(),
})

let mainWindow: BrowserWindow | null = null

/** 获取主窗口实例（供其他模块使用） */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}

function installWindowsZoomInFallback(win: BrowserWindow): void {
  if (process.platform !== 'win32') return

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || !input.control || input.alt || input.meta) return

    // Windows 下主键盘的 Ctrl++ 常会以 Ctrl+= 上报；小键盘加号也需要兜底。
    const key = input.key.toLowerCase()
    if (!['=', '+', 'numadd', 'add'].includes(key)) return

    event.preventDefault()
    const currentZoomLevel = win.webContents.getZoomLevel()
    win.webContents.setZoomLevel(Math.min(currentZoomLevel + 0.5, 9))
  })
}

/**
 * 检查窗口是否在可用显示器范围内
 * 处理外接显示器断开后窗口位于不可见区域的情况
 */
function ensureWindowOnScreen(win: BrowserWindow): void {
  const bounds = win.getBounds()
  const displays = screen.getAllDisplays()
  // 检查窗口中心点是否在任一显示器范围内
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const isOnScreen = displays.some((display) => {
    const { x, y, width, height } = display.workArea
    return centerX >= x && centerX <= x + width && centerY >= y && centerY <= y + height
  })
  if (!isOnScreen) {
    // 窗口不在任何屏幕内，移动到主显示器居中位置
    const primary = screen.getPrimaryDisplay()
    const { x, y, width, height } = primary.workArea
    win.setBounds({
      x: x + Math.round((width - bounds.width) / 2),
      y: y + Math.round((height - bounds.height) / 2),
      width: bounds.width,
      height: bounds.height,
    })
    console.log('[窗口] 窗口已重新定位到主显示器')
  }
}

/** 显示并聚焦主窗口，确保窗口在可见区域；若窗口已销毁则重新创建 */
function showAndFocusMainWindow(): void {
  if (process.platform === 'darwin') {
    if (app.dock) app.dock.show()
    app.show()
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
    return
  }
  ensureWindowOnScreen(mainWindow)
  if (mainWindow.isMinimized()) {
    mainWindow.restore()
  }
  mainWindow.show()
  mainWindow.focus()
}

/**
 * Get the appropriate app icon path for the current platform
 */
function getIconPath(): string {
  // resources 在 build:resources 阶段被复制到 dist/ 下，与 main.cjs 同级
  const resourcesDir = join(__dirname, 'resources')

  if (process.platform === 'darwin') {
    return join(resourcesDir, 'icon.icns')
  } else if (process.platform === 'win32') {
    return join(resourcesDir, 'icon.ico')
  } else {
    return join(resourcesDir, 'icon.png')
  }
}

function saveMainWindowState(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const isMaximized = mainWindow.isMaximized()
  // 最大化时用恢复尺寸（unmaximize 后的尺寸），避免记录最大化的全屏 bounds
  const bounds = isMaximized ? mainWindow.getNormalBounds() : mainWindow.getBounds()
  updateSettings({
    mainWindowState: {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized,
    },
  })
}

function createWindow(): void {
  const iconPath = getIconPath()
  const iconExists = existsSync(iconPath)

  if (!iconExists) {
    console.warn('App icon not found at:', iconPath)
  }

  const isMac = process.platform === 'darwin'
  const isWindows = process.platform === 'win32'

  const titleBarOptions = isMac
    ? {
        titleBarStyle: 'hiddenInset' as const,
        /* 与 @tagent/shared layout：shell p-2 + rail 内边距，整组按钮落在 60px Rail 内 */
        trafficLightPosition: getMacTrafficLightPosition(),
        vibrancy: 'under-window' as const,
        visualEffectState: 'followWindow' as const,
      }
    : isWindows
      ? { titleBarStyle: 'hidden' as const }
      : {}

  const savedState = getSettings().mainWindowState
  const initialBounds = savedState
    ? { width: savedState.width, height: savedState.height, x: savedState.x, y: savedState.y }
    : { width: 1400, height: 900 }

  mainWindow = new BrowserWindow({
    ...initialBounds,
    minWidth: 800,
    minHeight: 600,
    icon: iconExists ? iconPath : undefined,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    ...titleBarOptions,
  })
  installWindowsZoomInFallback(mainWindow)

  // Load the renderer
  const isDev = !app.isPackaged
  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, 'renderer', 'index.html'))
  }

  // 窗口就绪后，按保存的状态决定是否最大化
  mainWindow.once('ready-to-show', () => {
    if (savedState?.isMaximized ?? true) {
      mainWindow?.maximize()
    }
    if (process.platform === 'darwin' && app.dock) {
      app.dock.show()
    }
    mainWindow?.show()
  })

  // 持久化窗口大小和位置（防抖 500ms，避免频繁写入）
  let windowStateSaveTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleWindowStateSave = (): void => {
    if (windowStateSaveTimer) clearTimeout(windowStateSaveTimer)
    windowStateSaveTimer = setTimeout(() => {
      windowStateSaveTimer = null
      saveMainWindowState()
    }, 500)
  }
  mainWindow.on('resize', scheduleWindowStateSave)
  mainWindow.on('move', scheduleWindowStateSave)

  // 拦截页面内导航，外部链接用系统浏览器打开，防止 Electron 窗口被覆盖
  mainWindow.webContents.on('will-navigate', (event, url) => {
    // 允许开发模式下的 Vite HMR 热重载（同时支持 localhost 和 127.0.0.1）
    if (isDev && (url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')))
      return
    event.preventDefault()
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })

  // 拦截 window.open / target="_blank" 链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })

  // macOS: 点击关闭按钮时隐藏窗口+应用，而不是退出（正式版）
  // 开发模式：关窗即退出，避免 electronmon 热重载后 Dock 残留多个 Electron
  if (process.platform === 'darwin') {
    mainWindow.on('close', (event) => {
      if (!getIsQuitting()) {
        // 隐藏前先刷新挂起的窗口状态保存
        if (windowStateSaveTimer) {
          clearTimeout(windowStateSaveTimer)
          windowStateSaveTimer = null
        }
        saveMainWindowState()

        if (!app.isPackaged) {
          setQuitting()
          return
        }

        event.preventDefault()
        mainWindow?.hide()
        app.hide()
      }
    })
  }

  // Windows: 点击关闭按钮时根据用户选择隐藏到托盘或退出
  if (process.platform === 'win32') {
    mainWindow.on('close', (event) => {
      if (!getIsQuitting()) {
        // 隐藏前先刷新挂起的窗口状态保存
        if (windowStateSaveTimer) {
          clearTimeout(windowStateSaveTimer)
          windowStateSaveTimer = null
        }
        saveMainWindowState()

        // 开发模式：关窗即退出，避免 electronmon 热重载后任务管理器残留 Electron
        if (!app.isPackaged) {
          setQuitting()
          return
        }

        event.preventDefault()

        // 检查用户是否已保存关闭行为偏好
        const settings = getSettings()
        console.info('[WindowClose] closeAction:', settings.closeAction)
        if (settings.closeAction === 'quit') {
          requestApplicationQuit()
        } else if (settings.closeAction === 'minimize-to-tray') {
          mainWindow?.hide()
        } else {
          // 未保存偏好，发送 IPC 让渲染进程弹出确认对话框
          console.info('[WindowClose] 发送 close-request IPC')
          mainWindow?.webContents.send(WINDOW_CLOSE_IPC_CHANNELS.REQUEST)
        }
      }
    })
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function sendToMainWindow(channel: string, data?: unknown): void {
  showAndFocusMainWindow()

  const win = mainWindow
  if (!win || win.isDestroyed()) return

  const send = (): void => {
    if (!win.isDestroyed()) {
      win.webContents.send(channel, data)
    }
  }

  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', send)
  } else {
    send()
  }
}

app.whenReady().then(bootstrap).catch(handleBootstrapFailure)

/**
 * 启动主流程。所有非关键步骤用 safeRun / safeAwait 隔离，
 * 单点失败不应阻止窗口和托盘的创建（用户至少要能看到界面）。
 */
async function bootstrap(): Promise<void> {
  // 初始化 TAgent 版本号（供 User-Agent 等全局标识使用）
  setTAgentVersion(app.getVersion())

  // 注册自定义协议 tagent-file:// 用于内联预览本地文件。
  // 协议只接受主进程签发的 opaque token，不解析 renderer 提供的绝对路径。
  protocol.handle('tagent-file', handleTAgentFileRequest)

  // 初始化运行时环境（Shell 环境 + Bun + Git 检测）
  // 必须在其他初始化之前执行，确保环境变量正确加载
  await safeAwait('initializeRuntime', () => initializeRuntime())

  // 确保 kscc CLI 的 ripgrep 二进制就位（仅 Windows）
  // kscc 包不带 ripgrep，缺失会导致 Grep/Glob 工具报 ENOENT；
  // 这里从系统 PATH 找 rg.exe 复制到 kscc vendor 目录，让所有用户开箱即用
  safeRun('ensureKsccRipgrep', ensureKsccRipgrep)

  // 同步默认 Skills 模板到 ~/.tagent/default-skills/
  safeRun('seedDefaultSkills', seedDefaultSkills)

  // 升级所有工作区中版本过旧的默认 Skills
  safeRun('upgradeDefaultSkillsInWorkspaces', upgradeDefaultSkillsInWorkspaces)

  // Create application menu
  const menu = createApplicationMenu()
  Menu.setApplicationMenu(menu)

  // Register IPC handlers
  registerIpcHandlers()
  safeRun('startAutoArchiveScheduler', startAutoArchiveScheduler)

  // Set dock icon on macOS
  // 确保 Dock 图标可见（dev 模式下通过 spawn 启动时可能不会自动显示）
  // 如果用户有保存的图标偏好则使用，否则用默认图标
  if (process.platform === 'darwin' && app.dock) {
    await app.dock.show()
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resolveAppIconPath, setMacDockIcon } = require('./ipc')
    const settings = getSettings()
    const variantId = settings.appIconVariant
    const dockIconPath = resolveAppIconPath(variantId ?? 'default')
    if (dockIconPath && existsSync(dockIconPath)) {
      setMacDockIcon(dockIconPath)
    }
  }

  // Create main window (will be shown when ready)
  createWindow()

  // Create system tray icon
  createTray({
    showMainWindow: showAndFocusMainWindow,
    openAgentSession: (sessionId, title) => {
      sendToMainWindow(TRAY_IPC_CHANNELS.OPEN_AGENT_SESSION, { sessionId, title })
    },
    createAgentSession: () => {
      sendToMainWindow(TRAY_IPC_CHANNELS.CREATE_SESSION, { mode: 'agent' })
    },
  })

  // 启动工作区文件监听（Agent MCP/Skills + 文件浏览器自动刷新）
  if (mainWindow) {
    safeRun('startWorkspaceWatcher', () => startWorkspaceWatcher(mainWindow!))
  }

  // 启动 Chat 工具配置文件监听（Agent 创建工具后自动通知渲染进程）
  safeRun('startChatToolsWatcher', startChatToolsWatcher)

  // 初始化记忆自进化服务
  safeRun('initializeMemoryServices', () => {
    const { memoryLayerService } = require('./lib/memory-layer-service')
    const { reflectService } = require('./lib/reflect-service')
    const { scheduledCleanupService } = require('./lib/scheduled-cleanup-service')
    memoryLayerService.initialize()
    reflectService.initialize()
    scheduledCleanupService.initialize()
  })

  // 生产环境下初始化自动更新
  if (app.isPackaged && mainWindow) {
    safeRun('initAutoUpdater', () => initAutoUpdater(mainWindow!))
  }

  // 启动定时任务调度器（30s tick，启动时恢复已过期任务）
  await safeAwait('startAutomationScheduler', async () => {
    const { startScheduler } = await import('./lib/automation-scheduler')
    startScheduler()
  })

  // 预创建快速任务窗口（隐藏状态，首次唤起秒开）
  safeRun('createQuickTaskWindow', createQuickTaskWindow)
  if (getSettings().voiceDictation?.enabled === true) {
    safeRun('createVoiceDictationWindow', createVoiceDictationWindow)
  }

  // 飞书实时同步开启时，默认阻止系统自动休眠，保证远程群内继续可用。
  safeRun('syncFeishuSyncSleepBlocker', () => syncFeishuSyncSleepBlocker(getSettings()))

  // 注册全局快捷键
  safeRun('registerGlobalShortcut:quick-task', () =>
    registerGlobalShortcut('quick-task', toggleQuickTaskWindow)
  )
  safeRun('registerGlobalShortcut:show-main-window', () =>
    registerGlobalShortcut('show-main-window', showAndFocusMainWindow)
  )
  safeRun('registerGlobalShortcut:voice-dictation', () =>
    registerGlobalShortcut('voice-dictation', () => {
      toggleVoiceDictationWindow({ targetIsTAgent: mainWindow?.isFocused() === true })
    })
  )

  // 启动所有已注册的 Bridge（飞书/钉钉/微信等）
  await safeAwait('startAllBridges', () => startAllBridges())

  app.on('activate', () => {
    if (shouldSuppressVoiceDictationActivate()) {
      return
    }

    // 直接检查 mainWindow 引用，避免 getAllWindows() 包含 DevTools 等其他窗口导致误判
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
    } else {
      // 窗口已存在但可能被隐藏（macOS 关闭按钮 = hide），重新显示
      showAndFocusMainWindow()
    }
  })
}

/** 同步启动钩子隔离：单点失败仅记录日志，不阻断启动链。 */
function safeRun(name: string, fn: () => void): void {
  try {
    fn()
  } catch (err) {
    console.error(`[启动] ${name} 失败（已隔离）:`, err)
  }
}

/** 异步启动钩子隔离：同 safeRun，但适用于返回 Promise 的钩子。 */
async function safeAwait(name: string, fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn()
  } catch (err) {
    console.error(`[启动] ${name} 失败（已隔离）:`, err)
  }
}

/**
 * whenReady 顶层兜底：理论上 bootstrap 内的 safeRun/safeAwait 已经把所有可预期
 * 异常隔离掉了，能走到这里说明出了 bootstrap 本身控制流的意外（极端情况），
 * 此时仍尝试创建一个降级窗口，让用户至少能看到界面、复制日志、提交反馈。
 */
function handleBootstrapFailure(err: unknown): void {
  console.error('[启动] bootstrap 致命错误，进入降级模式:', err)

  try {
    const message = err instanceof Error ? (err.stack ?? err.message) : String(err)
    dialog.showErrorBox(
      'TAgent 启动遇到错误',
      `部分功能可能不可用：\n\n${message}\n\n` +
        `日志位置：${app.getPath('logs')}\n\n` +
        `常见原因与排查：\n` +
        `1. 旧版 TAgent 进程未退出（终端运行 killall TAgent 后重试）\n` +
        `2. ~/.tagent/ 配置损坏（重命名 ~/.tagent 后重启）\n` +
        `3. 系统 Keychain 无法解密保存的凭证（删除 ~/.tagent/feishu.json 等后重新登录）\n\n` +
        `如需协助请到 GitHub Issues 反馈。`
    )
  } catch {
    /* dialog 也失败，无能为力 */
  }

  try {
    registerIpcHandlers()
    createWindow()
  } catch (fallbackErr) {
    console.error('[启动] 降级窗口创建也失败:', fallbackErr)
  }
}

app.on('window-all-closed', () => {
  // 非 macOS：关闭所有窗口时退出应用
  // macOS：保持应用运行（可通过 tray 或 Dock 重新打开）
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  scheduleForceExitFallback()
  runApplicationShutdown()
  // Clean up system tray before quitting
  destroyTray()
})

// 二次兜底：清扫 Agent 子进程；成功退出则取消强退定时器
app.on('will-quit', () => {
  killOrphanedClaudeSubprocesses()
})

app.on('quit', () => {
  clearForceExitFallback()
})

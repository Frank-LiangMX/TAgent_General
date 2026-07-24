/**
 * 内置终端主进程 PTY 生命周期管理
 *
 * 主进程持有真实资源（node-pty 伪终端），通过 terminal:data 流式推输出到渲染层，
 * terminal:exit 上报退出。node-pty 懒加载，缺失/编译失败时禁用终端而非崩溃启动。
 *
 * 跨平台说明：
 *  - macOS / Linux：node-pty 用 forkpty；$SHELL 环境变量选 shell（mac 兜底 /bin/zsh，linux 兜底 /bin/bash）。
 *  - Windows：node-pty 用 ConPTY（useConpty: true）；优先 PowerShell 7 (pwsh.exe)，再 Windows PowerShell，再 cmd.exe。
 *  - useConpty 在非 Windows 是 no-op，所以一律传。
 */

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { BrowserWindow, IpcMain, WebContents } from 'electron'
import type { IPty } from 'node-pty'
import {
  TERMINAL_DEFAULT_COLS,
  TERMINAL_DEFAULT_ROWS,
  TERMINAL_MAX_COLS,
  TERMINAL_MAX_ROWS,
  TERMINAL_MAX_CWD_LENGTH,
  TERMINAL_MAX_DATA_WRITE_BYTES,
  TERMINAL_MAX_SESSIONS,
  TERMINAL_MAX_SESSION_ID_LENGTH,
  TERMINAL_RING_BUFFER_BYTES,
  TERMINAL_IPC_CHANNELS,
  type TerminalColorMode,
  type TerminalCreatePayload,
  type TerminalCreateResult,
  type TerminalResizePayload,
  type TerminalWritePayload,
} from '@tagent/shared'

type TerminalSession = {
  pty: IPty
  sender: WebContents
  /** 最近 ~64KB 输出，面板重连时重放 */
  ringBuffer: string
  exited: boolean
}

let nodePty: typeof import('node-pty') | null | undefined

/** 懒加载 node-pty；失败时返回 null，面板显示"终端不可用"而非崩主进程 */
async function loadNodePty(): Promise<typeof import('node-pty') | null> {
  if (nodePty !== undefined) return nodePty
  try {
    // 动态 import 使主 bundle 在当前平台缺原生预编译时也能编译通过；
    // 失败在面板里友好提示，不硬崩。
    nodePty = await import('node-pty')
  } catch (error) {
    console.warn('[terminal] node-pty 加载失败，内置终端已禁用:', error)
    nodePty = null
  }
  return nodePty
}

/**
 * 选当前平台默认 shell。
 *
 * macOS：尊重 $SHELL（OS 为用户默认终端设置），回退 zsh（Catalina 起系统默认）。
 * Linux：尊重 $SHELL，回退 bash（事实标准）。
 * Windows：装了 PowerShell 7 用 pwsh.exe，否则 Windows PowerShell，否则 COMSPEC（通常 cmd.exe）。
 */
function resolveDefaultShell(): { file: string; args: string[] } {
  if (process.platform === 'win32') {
    const programFiles = process.env.PROGRAMFILES ?? 'C:\\Program Files'
    const systemRoot = process.env.SystemRoot ?? process.env.WINDIR ?? 'C:\\Windows'
    const pwsh7 = join(programFiles, 'PowerShell', '7', 'pwsh.exe')
    if (existsSync(pwsh7)) return { file: pwsh7, args: ['-NoLogo'] }
    const windowsPwsh = join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    if (existsSync(windowsPwsh)) return { file: windowsPwsh, args: ['-NoLogo'] }
    return { file: process.env.COMSPEC ?? 'cmd.exe', args: [] }
  }
  const fallback = process.platform === 'darwin' ? '/bin/zsh' : '/bin/bash'
  return { file: process.env.SHELL || fallback, args: [] }
}

/** locale 字符串是否要求 UTF-8 编码（大小写不敏感匹配常见拼写） */
function isUtf8Locale(value: string | undefined): value is string {
  if (!value) return false
  return /utf-?8/i.test(value)
}

/**
 * 为子 shell 解析 UTF-8 locale。
 *
 * POSIX 字符编码类别优先级：LC_ALL > LC_CTYPE > LANG。
 * LC_ALL 覆盖一切，然后类别专属 LC_CTYPE，然后兜底 LANG。
 */
function resolveLocale(): string {
  if (isUtf8Locale(process.env.LC_ALL)) return process.env.LC_ALL
  if (isUtf8Locale(process.env.LC_CTYPE)) return process.env.LC_CTYPE
  if (isUtf8Locale(process.env.LANG)) return process.env.LANG
  if (process.platform === 'darwin') return 'en_US.UTF-8'
  if (process.platform === 'win32') return 'C.UTF-8'
  return 'en_US.UTF-8'
}

function buildShellEnv(colorMode: TerminalColorMode): NodeJS.ProcessEnv {
  // xterm-256color 与 xterm.js 声明一致，让 ls/git 等发色程序输出转义码。
  // LANG/LC_ALL 确保子 shell 用 UTF-8 locale，CJK 输出（echo/git log/cat）不乱码。
  // 从 Finder/Dock 启动的 Electron 不继承登录 shell 的 locale。
  const locale = resolveLocale()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    TERM: 'xterm-256color',
    LANG: locale,
    LC_ALL: locale,
  }
  // none（单色）模式故意不广告 truecolor：COLORTERM 会让工具发 24 位
  // (ESC[38;2;R;G;Bm) 序列绕过 xterm 调色板，破坏单色主题。去掉后发色程序
  // 回退到 16 色 ANSI 调色板，单色主题映射到前景色。xterm theme 还中和
  // 256 色（16-255）范围，使 8 位色序列也保持单色。继承的 COLORTERM 同理剥离。
  if (colorMode === 'none') {
    delete env.COLORTERM
  } else {
    env.COLORTERM = 'truecolor'
  }
  return env
}

function pushToRingBuffer(session: TerminalSession, chunk: string): void {
  session.ringBuffer += chunk
  if (session.ringBuffer.length > TERMINAL_RING_BUFFER_BYTES) {
    session.ringBuffer = session.ringBuffer.slice(-TERMINAL_RING_BUFFER_BYTES)
  }
}

function sendToSender(sender: WebContents, channel: string, payload: unknown): void {
  if (sender.isDestroyed()) return
  sender.send(channel, payload)
}

// ===== 内联入参校验（TAgent IPC 不强制 zod，简单防御性校验） =====

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeCreatePayload(args: unknown): TerminalCreatePayload | null {
  if (!isStringRecord(args)) return null
  const sessionId = args.sessionId
  if (typeof sessionId !== 'string' || !sessionId.trim()) return null
  if (sessionId.length > TERMINAL_MAX_SESSION_ID_LENGTH) return null
  const cwd = typeof args.cwd === 'string' ? args.cwd : undefined
  if (cwd && cwd.length > TERMINAL_MAX_CWD_LENGTH) return null
  const cols = typeof args.cols === 'number' ? args.cols : undefined
  const rows = typeof args.rows === 'number' ? args.rows : undefined
  return { sessionId, cwd, cols, rows }
}

function normalizeWritePayload(args: unknown): TerminalWritePayload | null {
  if (!isStringRecord(args)) return null
  const sessionId = args.sessionId
  const data = args.data
  if (typeof sessionId !== 'string' || !sessionId.trim()) return null
  if (typeof data !== 'string') return null
  if (data.length > TERMINAL_MAX_DATA_WRITE_BYTES) return null
  return { sessionId, data }
}

function normalizeResizePayload(args: unknown): TerminalResizePayload | null {
  if (!isStringRecord(args)) return null
  const sessionId = args.sessionId
  if (typeof sessionId !== 'string' || !sessionId.trim()) return null
  const cols = args.cols
  const rows = args.rows
  if (typeof cols !== 'number' || typeof rows !== 'number') return null
  if (!Number.isFinite(cols) || !Number.isFinite(rows)) return null
  if (cols < 1 || rows < 1 || cols > TERMINAL_MAX_COLS || rows > TERMINAL_MAX_ROWS) return null
  return { sessionId, cols, rows }
}

function normalizeSessionId(args: unknown): string | null {
  if (typeof args !== 'string' || !args.trim()) return null
  if (args.length > TERMINAL_MAX_SESSION_ID_LENGTH) return null
  return args
}

export interface RegisterTerminalPtyIpcOptions {
  ipcMain: IpcMain
  getMainWindow: () => BrowserWindow | null
  /** 主进程错误日志回调 */
  logError: (category: string, message: string, detail?: unknown) => void
  /**
   * 解析当前终端配色模式，用于调子 shell env（如 none 模式去 COLORTERM）。
   * 未提供时默认 'native'。
   */
  getTerminalColorMode?: () => TerminalColorMode | Promise<TerminalColorMode>
}

export function registerTerminalPtyIpc(options: RegisterTerminalPtyIpcOptions): void {
  const { ipcMain, getMainWindow, logError, getTerminalColorMode } = options
  const sessions = new Map<string, TerminalSession>()

  const disposeSession = (sessionId: string, killedByClient: boolean): boolean => {
    const session = sessions.get(sessionId)
    if (!session) return false
    try {
      session.pty.kill()
    } catch (error) {
      logError('terminal', 'Failed to kill PTY process', {
        sessionId,
        message: error instanceof Error ? error.message : String(error),
      })
    }
    sessions.delete(sessionId)
    if (!killedByClient && !session.sender.isDestroyed()) {
      sendToSender(session.sender, TERMINAL_IPC_CHANNELS.EXIT, { sessionId, exitCode: null })
    }
    return true
  }

  const disposeForSender = (sender: WebContents): void => {
    for (const [sessionId, session] of sessions) {
      if (session.sender === sender) disposeSession(sessionId, true)
    }
  }

  // 渲染窗口关闭时拆掉它持有的 PTY。监听主窗口 webContents 覆盖单窗口常规场景。
  const attachSenderCleanup = (sender: WebContents): void => {
    if (sender.isDestroyed()) {
      disposeForSender(sender)
      return
    }
    sender.once('destroyed', () => disposeForSender(sender))
  }

  ipcMain.handle(
    TERMINAL_IPC_CHANNELS.CREATE,
    async (event, args: unknown): Promise<TerminalCreateResult> => {
      const request = normalizeCreatePayload(args)
      if (!request) {
        return { ok: false, message: '无效的终端创建请求' }
      }

      // 重连已有会话：重放环形缓冲，使重新打开面板显示最近输出而非空白
      const existing = sessions.get(request.sessionId)
      if (existing && !existing.exited) {
        if (existing.ringBuffer) {
          sendToSender(event.sender, TERMINAL_IPC_CHANNELS.DATA, {
            sessionId: request.sessionId,
            data: existing.ringBuffer,
          })
        }
        // 窗口可能被重建，重绑到当前 sender
        existing.sender = event.sender
        attachSenderCleanup(event.sender)
        return { ok: true, sessionId: request.sessionId, replayed: true }
      }
      if (existing && existing.exited) {
        disposeSession(request.sessionId, true)
      }

      if (sessions.size >= TERMINAL_MAX_SESSIONS) {
        return {
          ok: false,
          message: `终端会话过多（上限 ${TERMINAL_MAX_SESSIONS}）`,
        }
      }

      const ptyModule = await loadNodePty()
      if (!ptyModule) {
        return {
          ok: false,
          message: '当前系统不可用终端后端（node-pty）',
        }
      }

      const { file, args: shellArgs } = resolveDefaultShell()
      const cols = request.cols ?? TERMINAL_DEFAULT_COLS
      const rows = request.rows ?? TERMINAL_DEFAULT_ROWS
      const cwd = request.cwd && request.cwd.trim() ? request.cwd.trim() : homedir()
      let colorMode: TerminalColorMode = 'native'
      try {
        colorMode = (await getTerminalColorMode?.()) ?? 'native'
      } catch (error) {
        logError('terminal', 'Failed to resolve terminal color mode', {
          sessionId: request.sessionId,
          message: error instanceof Error ? error.message : String(error),
        })
      }

      try {
        const pty = ptyModule.spawn(file, shellArgs, {
          name: 'xterm-256color',
          cols,
          rows,
          cwd,
          env: buildShellEnv(colorMode),
          // Windows 用 ConPTY，其他平台忽略
          useConpty: true,
        })

        const session: TerminalSession = {
          pty,
          sender: event.sender,
          ringBuffer: '',
          exited: false,
        }
        sessions.set(request.sessionId, session)
        attachSenderCleanup(event.sender)

        pty.onData((data) => {
          if (session.exited) return
          pushToRingBuffer(session, data)
          sendToSender(session.sender, TERMINAL_IPC_CHANNELS.DATA, {
            sessionId: request.sessionId,
            data,
          })
        })

        pty.onExit(({ exitCode }) => {
          session.exited = true
          sendToSender(session.sender, TERMINAL_IPC_CHANNELS.EXIT, {
            sessionId: request.sessionId,
            exitCode,
          })
          // 短暂保留条目让慢重连仍能重放；下次 create 会拆掉。完整清理也在 app 退出时做。
        })

        return { ok: true, sessionId: request.sessionId }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        logError('terminal', 'Failed to spawn PTY', { sessionId: request.sessionId, message })
        return { ok: false, message }
      }
    }
  )

  ipcMain.handle(TERMINAL_IPC_CHANNELS.WRITE, async (_event, args: unknown): Promise<boolean> => {
    const request = normalizeWritePayload(args)
    if (!request) return false
    const session = sessions.get(request.sessionId)
    if (!session || session.exited) return false
    try {
      session.pty.write(request.data)
      return true
    } catch (error) {
      logError('terminal', 'Failed to write to PTY', {
        sessionId: request.sessionId,
        message: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  })

  ipcMain.handle(TERMINAL_IPC_CHANNELS.RESIZE, async (_event, args: unknown): Promise<boolean> => {
    const request = normalizeResizePayload(args)
    if (!request) return false
    const session = sessions.get(request.sessionId)
    if (!session || session.exited) return false
    try {
      session.pty.resize(request.cols, request.rows)
      return true
    } catch (error) {
      logError('terminal', 'Failed to resize PTY', {
        sessionId: request.sessionId,
        message: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  })

  ipcMain.handle(
    TERMINAL_IPC_CHANNELS.DISPOSE,
    async (_event, sessionId: unknown): Promise<boolean> => {
      const normalized = normalizeSessionId(sessionId)
      if (!normalized) return false
      return disposeSession(normalized, true)
    }
  )

  // app 整体退出时拆掉所有 PTY，避免孤儿 shell 存活。这里懒 import electron
  // 保持模块对测试无副作用。
  void import('electron').then(({ app }) => {
    app.on('before-quit', () => {
      for (const sessionId of Array.from(sessions.keys())) {
        disposeSession(sessionId, true)
      }
    })
  })

  // 主窗口被重建（如 macOS 重新激活）时，拆掉绑在已销毁窗口上的过期会话
  const mainWindow = getMainWindow()
  if (mainWindow && !mainWindow.isDestroyed()) {
    attachSenderCleanup(mainWindow.webContents)
  }
}

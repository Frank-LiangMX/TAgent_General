/**
 * TA MCP Server Installer
 *
 * 负责在用户机器上创建 venv + 安装 ta-agent-mcp 包。
 *
 * 设计：
 * - 单例 + 状态机 (idle / running / success / failed / cancelled)
 * - spawn 包装：流式 stdout/stderr、可取消、超时
 * - 离线优先（wheelhouse），失败 fallback 在线
 * - 全局共享 venv：~/.tagent[-dev]/ta/venv/
 */

import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { app } from 'electron'

import { getConfigDir } from './config-paths'

/** 安装阶段 */
export type InstallPhase =
  | 'creating_venv'
  | 'checking_wheels'
  | 'upgrading_pip'
  | 'installing'
  | 'verifying'
  | 'done'

/** 单条日志 */
export interface InstallLogChunk {
  phase: InstallPhase | 'system'
  stream: 'stdout' | 'stderr' | 'system'
  text: string
  ts: number
}

/** 安装器状态 */
export type InstallerState = 'idle' | 'running' | 'success' | 'failed' | 'cancelled'

/** 单步超时 */
const STEP_TIMEOUT = {
  creating_venv: 60_000,
  upgrading_pip: 120_000,
  installing: 600_000,
  verifying: 30_000,
}

/** 离线 wheelhouse 子目录 */
function platformArchDir(): string {
  return `${process.platform}-${process.arch}`
}

/** venv 目录 */
function venvDir(): string {
  return join(getConfigDir(), 'ta', 'venv')
}

/** 跨平台 venv python 路径 */
function venvPythonPath(): string {
  const dir = venvDir()
  return process.platform === 'win32' ? join(dir, 'Scripts', 'python.exe') : join(dir, 'bin', 'python')
}

/** wheelhouse 目录（dev 走仓库根；packaged 走 process.resourcesPath） */
function resolveWheelhouse(): string {
  const base = app.isPackaged ? process.resourcesPath : app.getAppPath()
  return join(base, 'ta-agent-mcp-wheels', platformArchDir())
}

class TAMcpInstaller {
  private proc: ChildProcess | null = null
  private cancelled = false
  private state: InstallerState = 'idle'

  getState(): InstallerState {
    return this.state
  }

  /**
   * 安装入口
   *
   * @param onLog 接收流式日志
   * @param options.forceOnline 强制在线安装（跳过 wheelhouse）
   */
  async install(
    onLog: (chunk: InstallLogChunk) => void,
    options: { forceOnline?: boolean } = {}
  ): Promise<{ success: boolean; error?: string; phase?: InstallPhase }> {
    if (this.state === 'running') {
      return { success: false, error: '已有安装任务在运行' }
    }
    this.state = 'running'
    this.cancelled = false

    const ts = () => Date.now()
    const log = (phase: InstallLogChunk['phase'], stream: InstallLogChunk['stream'], text: string) =>
      onLog({ phase, stream, text, ts: ts() })

    try {
      // 0. 清理旧的（可能损坏的）venv，确保干净状态
      const venv = venvDir()
      if (existsSync(venv)) {
        log('creating_venv', 'system', `检测到旧 venv，开始清理: ${venv}`)
        try {
          rmSync(venv, { recursive: true, force: true })
        } catch (e) {
          log('creating_venv', 'stderr', `清理旧 venv 失败: ${String(e)}`)
        }
      }

      // 1. 创建 venv
      log('creating_venv', 'system', '正在创建 Python 虚拟环境...')
      const sysPython = await this.findSystemPython()
      if (!sysPython) {
        throw new Error('未找到系统 Python（需要 Python 3.10+）。请先安装 Python 并确保 python 在 PATH 中。')
      }
      log('creating_venv', 'system', `使用 Python: ${sysPython}`)
      await this.runStream(
        [sysPython, '-m', 'venv', venv],
        (s, t) => log('creating_venv', s, t),
        STEP_TIMEOUT.creating_venv
      )
      log('creating_venv', 'system', 'venv 创建完成')

      // 2. 决定 install source
      const wheelhouse = resolveWheelhouse()
      const hasWheelhouse = !options.forceOnline && existsSync(wheelhouse)
      if (hasWheelhouse) {
        log('checking_wheels', 'system', `使用离线 wheelhouse: ${wheelhouse}`)
      } else {
        log('checking_wheels', 'system', '使用在线 PyPI')
      }

      // 3. 升级 pip
      log('upgrading_pip', 'system', '升级 venv pip...')
      await this.runStream(
        [venvPythonPath(), '-m', 'pip', 'install', '--upgrade', 'pip', '--disable-pip-version-check', '--no-input'],
        (s, t) => log('upgrading_pip', s, t),
        STEP_TIMEOUT.upgrading_pip
      )

      // 4. 装 ta-agent-mcp
      log('installing', 'system', '安装 ta-agent-mcp（这可能需要 1-2 分钟）...')
      const installArgs = hasWheelhouse
        ? [
            '-m',
            'pip',
            'install',
            '--no-index',
            '--find-links',
            wheelhouse,
            'ta-agent-mcp',
            '--disable-pip-version-check',
            '--no-input',
          ]
        : ['-m', 'pip', 'install', 'ta-agent-mcp', '--disable-pip-version-check', '--no-input']

      try {
        await this.runStream(
          [venvPythonPath(), ...installArgs],
          (s, t) => log('installing', s, t),
          STEP_TIMEOUT.installing
        )
      } catch (e) {
        // 离线失败时自动 fallback 在线
        if (hasWheelhouse) {
          log('installing', 'system', `离线安装失败，自动切换在线 PyPI: ${String(e)}`)
          await this.runStream(
            [
              venvPythonPath(),
              '-m',
              'pip',
              'install',
              'ta-agent-mcp',
              '--disable-pip-version-check',
              '--no-input',
            ],
            (s, t) => log('installing', s, t),
            STEP_TIMEOUT.installing
          )
        } else {
          throw e
        }
      }

      // 5. 验证
      log('verifying', 'system', '验证安装...')
      const verifyOut = await this.runStream(
        [venvPythonPath(), '-c', 'import ta_agent_mcp; print(ta_agent_mcp.__file__)'],
        (s, t) => log('verifying', s, t),
        STEP_TIMEOUT.verifying
      )
      log('verifying', 'system', `ta_agent_mcp 已安装到: ${verifyOut.trim()}`)

      this.state = 'success'
      log('done', 'system', '安装完成')
      return { success: true }
    } catch (e) {
      if (this.cancelled) {
        this.state = 'cancelled'
        log('done', 'system', '安装已取消')
        return { success: false, error: '已取消', phase: 'installing' }
      }
      this.state = 'failed'
      const msg = e instanceof Error ? e.message : String(e)
      log('done', 'stderr', `安装失败: ${msg}`)
      return { success: false, error: msg }
    }
  }

  /** 取消当前安装 */
  cancel(): void {
    if (this.state !== 'running' || !this.proc) return
    this.cancelled = true
    try {
      this.proc.kill('SIGTERM')
    } catch {
      /* 忽略 */
    }
    // 3s 后强制 kill
    setTimeout(() => {
      try {
        this.proc?.kill('SIGKILL')
      } catch {
        /* 忽略 */
      }
    }, 3000)
  }

  /** 找系统 python（优先 python，再 python3） */
  private async findSystemPython(): Promise<string | null> {
    for (const cmd of ['python', 'python3']) {
      try {
        const out = await this.runStream(
          [cmd, '-c', 'import sys; print(sys.executable)'],
          () => {},
          5_000
        )
        const path = out.trim()
        if (path) return path
      } catch {
        // 继续尝试下一个
      }
    }
    return null
  }

  /**
   * spawn 包装：流式输出，可取消，超时
   *
   * @returns 累积的 stdout 文本
   */
  private runStream(
    cmd: string[],
    onChunk: (stream: 'stdout' | 'stderr', text: string) => void,
    timeoutMs: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Windows 或路径含空格时用 shell + 双引号
      const useShell = process.platform === 'win32' || cmd.some((c) => /\s/.test(c))
      const command = useShell ? cmd.map((c) => (/[\s"]/.test(c) ? `"${c.replace(/"/g, '\\"')}"` : c)).join(' ') : cmd[0]!
      const args = useShell ? [] : cmd.slice(1)

      let stdoutBuf = ''
      let stderrTail = ''

      try {
        this.proc = spawn(command, args, {
          shell: useShell,
          cwd: venvDir(),
          env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' },
          windowsHide: true,
        })
      } catch (e) {
        reject(e)
        return
      }

      const proc = this.proc
      const timer = setTimeout(() => {
        try {
          proc.kill('SIGTERM')
        } catch {
          /* 忽略 */
        }
        setTimeout(() => {
          try {
            proc.kill('SIGKILL')
          } catch {
            /* 忽略 */
          }
        }, 1000)
        reject(new Error(`超时 (${Math.round(timeoutMs / 1000)}s)`))
      }, timeoutMs)

      proc.stdout?.on('data', (d: Buffer) => {
        const text = d.toString('utf-8')
        stdoutBuf += text
        onChunk('stdout', text)
      })

      proc.stderr?.on('data', (d: Buffer) => {
        const text = d.toString('utf-8')
        stderrTail = (stderrTail + text).slice(-2000) // 保留最近 2KB
        onChunk('stderr', text)
      })

      proc.on('error', (e) => {
        clearTimeout(timer)
        if (this.cancelled) reject(new Error('已取消'))
        else reject(e)
      })

      proc.on('close', (code) => {
        clearTimeout(timer)
        this.proc = null
        if (this.cancelled) {
          reject(new Error('已取消'))
          return
        }
        if (code === 0) {
          resolve(stdoutBuf)
        } else {
          // 优先返回 stderr 末尾
          reject(new Error(`exit ${code}: ${stderrTail.trim().split('\n').pop() || 'unknown'}`))
        }
      })
    })
  }
}

export const taMcpInstaller = new TAMcpInstaller()

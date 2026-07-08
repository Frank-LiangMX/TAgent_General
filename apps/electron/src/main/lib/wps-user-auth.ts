/**
 * WPS 用户 OAuth 登录管理
 *
 * 通过 WPS365 CLI 的 auth login 命令实现 Delegated OAuth 授权码流程。
 * CLI 负责处理浏览器打开、回调接收、code 换取 token 的全流程。
 * 登录完成后，CLI 将 token 存储在系统钥匙串，TAgent 通过 auth token 命令提取并加密存储。
 */

import { getWpsConfig, resolveSecretKey, updateWpsUserAuth, clearWpsUserAuth } from './wps-config'
import { decryptText } from './wps-config'
import { getCliPath, ensureCliInstalled } from './wps-cli-tools'
import { execFile } from 'node:child_process'
import { promisify } from 'util'
import { createServer } from 'node:net'

const execFileAsync = promisify(execFile)

/**
 * 释放指定端口：检测到占用则杀掉对应进程
 * 解决 WPS CLI OAuth 回调端口（18365）残留导致登录失败的问题
 */
async function freePort(port: number): Promise<void> {
  try {
    // 尝试连接，成功说明有进程在监听
    await new Promise<void>((resolve, reject) => {
      const server = createServer()
      server.once('error', (err: NodeJS.ErrnoException) => {
        if (err.code === 'EADDRINUSE') reject(err)
        else resolve() // 其他错误忽略
      })
      server.once('listening', () => {
        server.close() // 端口空闲，关闭测试服务器
        resolve()
      })
      server.listen(port, '127.0.0.1')
    })
    // 端口空闲
    return
  } catch {
    // 端口被占用，尝试杀进程
  }

  try {
    if (process.platform === 'win32') {
      const { execFileSync } = await import('child_process')
      const result = execFileSync('netstat', ['-ano'], { encoding: 'utf-8' })
      const lines = result.split('\n')
      for (const line of lines) {
        if (line.includes(`:${port} `)) {
          const parts = line.trim().split(/\s+/)
          const pid = parts[parts.length - 1]
          if (pid && pid !== '0') {
            try { execFileSync('taskkill', ['/PID', pid, '/F'], { stdio: 'ignore' }) } catch { /* 忽略 */ }
          }
        }
      }
    } else {
      const { execFileSync } = await import('child_process')
      try {
        const pid = execFileSync('lsof', ['-ti', `:${port}`], { encoding: 'utf-8' }).trim()
        if (pid) execFileSync('kill', ['-9', pid], { stdio: 'ignore' })
      } catch { /* 忽略 */ }
    }
  } catch { /* 杀进程失败不影响主流程，CLI 会报端口占用 */ }
}

/** 登录状态类型 */
export type WpsLoginStateType = 'idle' | 'starting' | 'authorizing' | 'done' | 'error'

/** 用户信息 */
interface UserInfo {
  name: string
  email: string
}

class WpsUserAuthManager {
  private state: WpsLoginStateType = 'idle'
  private errorMessage = ''
  private userInfo: UserInfo | null = null
  private listeners = new Set<() => void>()

  getState(): WpsLoginStateType {
    return this.state
  }

  getUserInfo(): UserInfo | null {
    return this.userInfo
  }

  getErrorMessage(): string {
    return this.errorMessage
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener()
    }
  }

  onStateChange(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * 获取已登录的用户信息（从存储读取）
   */
  getStoredUserAuth(): { loggedIn: boolean; loading?: boolean; userName?: string; userEmail?: string; expiresAt?: number; errorMessage?: string } {
    // 如果有正在进行的登录，返回 loading 状态
    if (this.state === 'starting' || this.state === 'authorizing') {
      return { loggedIn: false, loading: true }
    }
    if (this.state === 'error') {
      return { loggedIn: false, loading: false, errorMessage: this.errorMessage }
    }
    const config = getWpsConfig()
    if (config.userAccessToken && config.userTokenExpiresAt) {
      const expired = config.userTokenExpiresAt <= Date.now()
      return {
        loggedIn: !expired,
        userName: config.userName,
        userEmail: config.userEmail,
        expiresAt: config.userTokenExpiresAt,
      }
    }
    return { loggedIn: false }
  }

  /**
   * 启动用户 OAuth 登录（使用 WPS CLI auth login 命令）
   *
   * CLI 自动处理：
   * 1. 在 18365 端口启动回调服务器
   * 2. 打开浏览器到 OAuth 授权页
   * 3. 接收回调 → 换 token → 存储到系统钥匙串
   */
  async login(): Promise<void> {
    const config = getWpsConfig()
    if (!config.appId) {
      this.state = 'error'
      this.errorMessage = '请先在设置页配置 App ID'
      this.notify()
      return
    }

    const secretKey = resolveSecretKey()
    if (!secretKey) {
      this.state = 'error'
      this.errorMessage = 'Secret Key 不可用，请检查配置或环境变量'
      this.notify()
      return
    }

    this.state = 'starting'
    this.errorMessage = ''
    this.notify()

    try {
      // 释放 OAuth 回调端口（18365），防止上次残留进程占用
      await freePort(18365)

      // 确保 CLI 已安装
      await ensureCliInstalled()
      const cliPath = await getCliPath()

      // 使用 CLI auth login 命令处理 OAuth 流程
      // CLI 会启动本地回调服务、打开浏览器、换 token、存储到钥匙串
      const scopes = [
        'kso.user_base.read',
        'kso.contact.read',
        'kso.calendar.readwrite',
        'kso.dbsheet.readwrite',
        'kso.airsheet.readwrite',
        'kso.airpage.readwrite',
        'kso.coop_files.readwrite',
        'kso.chat.readwrite',
      ].join(',')

      const env = {
        ...process.env,
        WPS365_CLIENT_ID: config.appId,
        WPS365_CLIENT_SECRET: secretKey,
        WPS365_QUIET: '1',
        WPS365_OUTPUT: 'json',
      }

      this.state = 'authorizing'
      this.notify()

      // 执行 auth login（阻塞直到 OAuth 完成或超时）
      await execFileAsync(cliPath, ['auth', 'login', '--scopes', scopes], {
        env,
        timeout: 5 * 60 * 1000, // 5 分钟超时
      })

      // 登录完成，提取 token
      const tokenResult = await execFileAsync(cliPath, ['auth', 'token'], {
        env,
        timeout: 30_000,
      })
      const tokenStdout = tokenResult.stdout.trim()
      let accessToken = ''

      // auth token 可能输出纯文本（token 字符串），也可能是 JSON
      try {
        const parsed = JSON.parse(tokenStdout)
        accessToken = parsed.access_token || parsed.token || parsed
      } catch {
        // 纯文本格式，直接作为 token
        accessToken = tokenStdout
      }

      if (!accessToken) {
        throw new Error('获取 access_token 失败')
      }

      // 获取用户信息
      const userInfo = await this.fetchUserInfo(
        accessToken,
        config.apiUrl || 'https://openapi.wps.cn'
      )

      // 加密存储到 wps.json
      updateWpsUserAuth({
        accessToken,
        expiresAt: Date.now() + 2 * 3600 * 1000, // 默认 2 小时
        userName: userInfo.name,
        userEmail: userInfo.email,
      })

      this.userInfo = userInfo
      this.state = 'done'
      this.notify()

      // 3 秒后重置状态
      setTimeout(() => {
        if (this.state === 'done') {
          this.state = 'idle'
          this.notify()
        }
      }, 3000)
    } catch (error) {
      this.state = 'error'
      this.errorMessage = error instanceof Error ? error.message : String(error)
      this.notify()
    }
  }

  /**
   * 获取当前登录用户信息
   */
  private async fetchUserInfo(accessToken: string, apiUrl: string): Promise<UserInfo> {
    try {
      const response = await fetch(`${apiUrl}/v7/users/current`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) {
        const data = await response.json() as { data?: { name?: string; email?: string }; name?: string; email?: string }
        const userData = data.data || data
        return {
          name: userData.name || '用户',
          email: userData.email || '',
        }
      }
    } catch {
      // 获取用户信息失败不影响登录
    }
    return { name: '用户', email: '' }
  }

  /**
   * 登出：清除用户 token
   */
  logout(): void {
    clearWpsUserAuth()
    this.userInfo = null
    this.state = 'idle'
    this.errorMessage = ''
    this.notify()
  }

  /**
   * 获取有效的用户 access token
   * 如果 token 不存在或已过期返回 null
   */
  getValidAccessToken(): string | null {
    const config = getWpsConfig()
    if (!config.userAccessToken || !config.userTokenExpiresAt) return null
    if (config.userTokenExpiresAt < Date.now() + 5 * 60 * 1000) return null
    return decryptText(config.userAccessToken) || null
  }

  /**
   * 主动检查当前 token 是否仍有效
   *
   * 调用 WPS API 验证 access token。如果发现 token 已失效
   *（例如被其他设备登录踢掉），自动清除登录状态。
   *
   * @returns true = token 仍有效，false = 已失效（已被清除）
   */
  async checkLoginStatus(): Promise<boolean> {
    const config = getWpsConfig()
    if (!config.userAccessToken) return false

    const accessToken = decryptText(config.userAccessToken)
    if (!accessToken) return false

    const apiUrl = config.apiUrl || 'https://openapi.wps.cn'

    try {
      const response = await fetch(`${apiUrl}/v7/users/current`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (response.ok) return true

      // 401/403 = token 已失效（被其他设备踢掉或 refresh_token 过期）
      if (response.status === 401 || response.status === 403) {
        this.logout()
        return false
      }

      // 其他服务端错误（500 等），不改变状态防误踢
      return true
    } catch {
      // 网络错误（断网等），不改变状态防误踢
      return true
    }
  }
}

export const wpsUserAuthManager = new WpsUserAuthManager()

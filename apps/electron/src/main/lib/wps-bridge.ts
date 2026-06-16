/**
 * WPS 协作 Bridge
 *
 * MVP:
 * - 本地 HTTP 回调服务（challenge + 消息事件）
 * - 事件签名验证 / AES 解密
 * - 文本消息路由到 Agent
 * - 通过 WPS API 回发文本
 */

import { createServer } from 'node:http'

import { WPS_IPC_CHANNELS } from '@tagent/shared'
import { BrowserWindow } from 'electron'

import { BridgeCommandHandler } from './bridge-command-handler'
import { decryptEventData, generateKso1AuthHeader, verifyEventSignature } from './wps-crypto'
import { getDecryptedWpsEncryptKey, getDecryptedWpsSecretKey, getWpsConfig, updateWpsDefaultWorkspace } from './wps-config'
import { parseWpsMessage } from './wps-message-parser'
import { wpsOAuthTokenManager } from './wps-oauth'

import type { Server, IncomingMessage, ServerResponse } from 'node:http'
import type { WpsBridgeState, WpsTestResult } from '@tagent/shared'

const MAX_BODY_SIZE = 2 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 20_000
const DEDUP_MAX = 200

class WpsBridge {
  private server: Server | null = null
  private state: WpsBridgeState = { status: 'disconnected' }
  private recentMessageIds = new Set<string>()

  private commandHandler = new BridgeCommandHandler({
    platformName: 'WPS协作',
    adapter: {
      sendText: async (chatId: string, text: string) => {
        await this.sendTextMessage(chatId, text)
      },
    },
    getDefaultWorkspaceId: () => getWpsConfig().defaultWorkspaceId,
    onWorkspaceSwitched: (workspaceId) => updateWpsDefaultWorkspace(workspaceId),
  })

  getStatus(): WpsBridgeState {
    return { ...this.state }
  }

  async start(): Promise<void> {
    if (this.server) return
    const config = getWpsConfig()
    const secretKey = getDecryptedWpsSecretKey()
    if (!config.enabled) throw new Error('WPS 集成未启用')
    if (!config.appId || !secretKey) throw new Error('请先填写 WPS App ID 与 Secret Key')

    this.updateStatus({ status: 'connecting', errorMessage: undefined })
    this.commandHandler.subscribe()

    this.server = createServer((req, res) => {
      void this.handleRequest(req, res).catch((error) => {
        console.error('[WPS Bridge] 处理回调失败:', error)
        this.writeJson(res, 500, { code: -1, msg: 'internal error' })
      })
    })

    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error): void => reject(error)
        this.server!.once('error', onError)
        this.server!.listen(config.callbackPort, '127.0.0.1', () => {
          this.server?.off('error', onError)
          resolve()
        })
      })
    } catch (error) {
      this.commandHandler.unsubscribe()
      this.server = null
      const message = error instanceof Error ? error.message : String(error)
      this.updateStatus({ status: 'error', errorMessage: message })
      throw error
    }

    this.updateStatus({
      status: 'connected',
      connectedAt: Date.now(),
      callbackUrl: `http://127.0.0.1:${config.callbackPort}${config.callbackPath}`,
    })
    console.log(`[WPS Bridge] 回调服务已启动: ${this.state.callbackUrl}`)
  }

  stop(): void {
    this.commandHandler.unsubscribe()
    wpsOAuthTokenManager.clear()
    this.recentMessageIds.clear()
    if (this.server) {
      this.server.close()
      this.server = null
    }
    this.updateStatus({ status: 'disconnected', errorMessage: undefined, callbackUrl: undefined })
    console.log('[WPS Bridge] 已停止')
  }

  async testConnection(appId: string, secretKey: string, apiUrl: string): Promise<WpsTestResult> {
    try {
      await wpsOAuthTokenManager.getAccessToken(appId, secretKey, apiUrl, true)
      return { success: true, message: '连接成功' }
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const config = getWpsConfig()
    const secretKey = getDecryptedWpsSecretKey()
    const encryptKey = getDecryptedWpsEncryptKey() || secretKey
    const requestUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? '127.0.0.1'}`)

    if (requestUrl.pathname !== config.callbackPath) {
      this.writeJson(res, 404, { code: -1, msg: 'not found' })
      return
    }

    if (req.method === 'GET') {
      const challenge = requestUrl.searchParams.get('challenge')
      this.writeJson(res, 200, challenge ? { challenge } : { code: 0, msg: 'ok' })
      return
    }

    if (req.method !== 'POST') {
      res.statusCode = 405
      res.end('Method Not Allowed')
      return
    }

    const body = await this.readBody(req)
    const parsed = JSON.parse(body.toString('utf-8')) as Record<string, unknown>

    const challenge = typeof parsed.challenge === 'string' ? parsed.challenge : ''
    if (challenge) {
      this.writeJson(res, 200, { challenge })
      return
    }

    this.writeJson(res, 200, { code: 0, msg: 'success' })

    const topic = this.readString(parsed.topic)
    if (topic !== 'kso.app_chat.message') return

    const signature = this.readString(parsed.signature)
    const nonce = this.readString(parsed.nonce)
    const encryptedData = this.readString(parsed.encrypted_data)
    const time = this.readNumber(parsed.time)
    if (signature && nonce && encryptedData && time > 0) {
      if (!verifyEventSignature(config.appId, secretKey, topic, nonce, time, encryptedData, signature)) {
        console.warn('[WPS Bridge] 事件签名校验失败，已忽略')
        return
      }
    }

    const eventData = encryptedData
      ? JSON.parse(decryptEventData(encryptKey, encryptedData, nonce)) as Record<string, unknown>
      : (parsed.data as Record<string, unknown> | undefined)
    if (!eventData) return

    const message = parseWpsMessage(eventData)
    if (!message.text.trim()) return
    if (message.chatType === 'group' && !message.isAtBot) return

    if (message.messageId) {
      if (this.recentMessageIds.has(message.messageId)) {
        console.log('[WPS Bridge] 跳过重复消息:', message.messageId)
        return
      }
      this.addToDedup(message.messageId)
    }

    await this.commandHandler.handleIncomingMessage(message.chatId, message.text)
  }

  private addToDedup(messageId: string): void {
    this.recentMessageIds.add(messageId)
    if (this.recentMessageIds.size > DEDUP_MAX) {
      const first = this.recentMessageIds.values().next().value as string
      this.recentMessageIds.delete(first)
    }
  }

  private async sendTextMessage(chatId: string, text: string): Promise<void> {
    const config = getWpsConfig()
    const appId = config.appId
    const secretKey = getDecryptedWpsSecretKey()
    const apiUrl = config.apiUrl
    if (!appId || !secretKey) return

    const token = await wpsOAuthTokenManager.getAccessToken(appId, secretKey, apiUrl)
    const payload = {
      type: 'text',
      receiver: { receiver_id: chatId, type: 'chat' },
      content: { text: { content: text, type: 'plain' } },
    }
    const body = JSON.stringify(payload)
    const path = '/v7/messages/create'
    const date = new Date().toUTCString()
    const signature = generateKso1AuthHeader(appId, 'POST', path, 'application/json', date, body, secretKey)

    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'X-Kso-Date': date,
        'X-Kso-Authorization': signature,
      },
      body,
    })
    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`WPS 回发失败: HTTP ${response.status} ${errText.slice(0, 200)}`)
    }
  }

  private readString(value: unknown): string {
    return typeof value === 'string' ? value : ''
  }

  private readNumber(value: unknown): number {
    return typeof value === 'number' ? value : 0
  }

  private async readBody(req: IncomingMessage): Promise<Buffer> {
    return await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      let total = 0
      const timeout = setTimeout(() => {
        req.destroy()
        reject(new Error('request timeout'))
      }, REQUEST_TIMEOUT_MS)

      req.on('data', (chunk: Buffer) => {
        total += chunk.length
        if (total > MAX_BODY_SIZE) {
          clearTimeout(timeout)
          req.destroy()
          reject(new Error('request too large'))
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => {
        clearTimeout(timeout)
        resolve(Buffer.concat(chunks))
      })
      req.on('error', (error) => {
        clearTimeout(timeout)
        reject(error)
      })
    })
  }

  private writeJson(res: ServerResponse, status: number, payload: Record<string, unknown>): void {
    if (res.writableEnded) return
    res.statusCode = status
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(JSON.stringify(payload))
  }

  private updateStatus(partial: Partial<WpsBridgeState>): void {
    this.state = { ...this.state, ...partial }
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send(WPS_IPC_CHANNELS.STATUS_CHANGED, this.state)
      }
    }
  }
}

export const wpsBridge = new WpsBridge()

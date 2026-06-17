/**
 * WPS OAuth Access Token 管理（缓存 + 并发去重）
 */

import { createHash } from 'node:crypto'

interface TokenCache {
  token: string
  expiresAt: number
}

function cacheKey(appId: string, secretKey: string): string {
  return createHash('sha256').update(`${appId}:${secretKey}`).digest('hex').slice(0, 32)
}

class WpsOAuthTokenManager {
  private cache = new Map<string, TokenCache>()
  private requesting = new Map<string, Promise<string>>()

  async getAccessToken(
    appId: string,
    secretKey: string,
    apiUrl: string,
    forceRefresh = false
  ): Promise<string> {
    const key = cacheKey(appId, secretKey)
    if (!forceRefresh) {
      const cached = this.cache.get(key)
      if (cached && Date.now() < cached.expiresAt) return cached.token
    }

    const inflight = this.requesting.get(key)
    if (inflight) return inflight

    const promise = this.fetchToken(appId, secretKey, apiUrl, key)
    this.requesting.set(key, promise)
    try {
      return await promise
    } finally {
      this.requesting.delete(key)
    }
  }

  clear(): void {
    this.cache.clear()
  }

  private async fetchToken(
    appId: string,
    secretKey: string,
    apiUrl: string,
    key: string
  ): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: appId,
      client_secret: secretKey,
    })

    const response = await fetch(`${apiUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`获取 WPS AccessToken 失败: HTTP ${response.status} ${errText.slice(0, 200)}`)
    }

    const data = (await response.json()) as { access_token?: string; expires_in?: number }
    if (!data.access_token) throw new Error('WPS AccessToken 响应缺少 access_token')

    const ttl = data.expires_in ?? 7200
    this.cache.set(key, {
      token: data.access_token,
      expiresAt: Date.now() + Math.max(60, ttl - 300) * 1000,
    })
    return data.access_token
  }
}

export const wpsOAuthTokenManager = new WpsOAuthTokenManager()

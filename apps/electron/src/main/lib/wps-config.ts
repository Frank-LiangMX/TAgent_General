/**
 * WPS 协作配置管理
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

import { safeStorage } from 'electron'

import type { WpsConfig, WpsConfigInput } from '@tagent/shared'
import { getWpsConfigPath } from './config-paths'

/** 内置 App ID（环境变量注入，源码不包含明文密钥） */
const BUILTIN_APP_ID = process.env.TAGENT_WPS_APP_ID ?? ''
/** 内置 Secret Key 明文（环境变量注入，不写入配置文件） */
const BUILTIN_SECRET_KEY = process.env.TAGENT_WPS_SECRET_KEY ?? ''

const DEFAULT_CONFIG: WpsConfig = {
  enabled: false,
  appId: BUILTIN_APP_ID,
  secretKey: '', // secretKey 不写进 DEFAULT_CONFIG，由 getWpsConfig 动态合并
  encryptKey: '',
  apiUrl: 'https://openapi.wps.cn',
  callbackPort: 19086,
  callbackPath: '/open/receive',
}

function encryptText(plainText: string): string {
  if (!plainText) return ''
  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[WPS配置] safeStorage 不可用，将以明文存储')
    return plainText
  }
  return safeStorage.encryptString(plainText).toString('base64')
}

function decryptText(encryptedText: string): string {
  if (!encryptedText) return ''
  if (!safeStorage.isEncryptionAvailable()) return encryptedText
  try {
    return safeStorage.decryptString(Buffer.from(encryptedText, 'base64'))
  } catch (error) {
    console.error('[WPS配置] 解密失败:', error)
    throw new Error('解密 WPS 密钥失败')
  }
}

export { encryptText, decryptText }

export function getWpsConfig(): WpsConfig {
  const configPath = getWpsConfigPath()
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG }
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WpsConfig>
    const config = { ...DEFAULT_CONFIG, ...parsed }
    // secretKey 永远不存明文到文件；用户没填时从环境变量 fallback
    if (!config.secretKey) {
      config.secretKey = BUILTIN_SECRET_KEY
    }
    return config
  } catch (error) {
    console.error('[WPS配置] 读取失败:', error)
    return { ...DEFAULT_CONFIG, secretKey: BUILTIN_SECRET_KEY }
  }
}

export function saveWpsConfig(input: WpsConfigInput): WpsConfig {
  const existing = getWpsConfig()
  const next: WpsConfig = {
    ...existing,
    enabled: input.enabled,
    appId: input.appId.trim(),
    apiUrl: input.apiUrl.trim() || DEFAULT_CONFIG.apiUrl,
    callbackPort: Number.isFinite(input.callbackPort)
      ? input.callbackPort
      : DEFAULT_CONFIG.callbackPort,
    callbackPath: input.callbackPath.trim() || DEFAULT_CONFIG.callbackPath,
    defaultWorkspaceId: input.defaultWorkspaceId,
    // 用户填写了新的 secretKey 时才加密存储；空则清空，运行时从环境变量 fallback
    secretKey: input.secretKey ? encryptText(input.secretKey) : '',
    encryptKey:
      input.encryptKey === ''
        ? ''
        : input.encryptKey
          ? encryptText(input.encryptKey)
          : (existing.encryptKey ?? ''),
  }
  writeFileSync(getWpsConfigPath(), JSON.stringify(next, null, 2), 'utf-8')
  return next
}

export function getDecryptedWpsSecretKey(): string {
  return decryptText(getWpsConfig().secretKey)
}

export function getDecryptedWpsEncryptKey(): string {
  const config = getWpsConfig()
  return config.encryptKey ? decryptText(config.encryptKey) : ''
}

/** 工作区切换后持久化默认工作区 */
export function updateWpsDefaultWorkspace(workspaceId: string): void {
  const existing = getWpsConfig()
  const next: WpsConfig = { ...existing, defaultWorkspaceId: workspaceId }
  writeFileSync(getWpsConfigPath(), JSON.stringify(next, null, 2), 'utf-8')
}

/** 更新用户 OAuth 认证信息 */
export function updateWpsUserAuth(params: {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  userName?: string
  userEmail?: string
}): void {
  const existing = getWpsConfig()
  const next: WpsConfig = {
    ...existing,
    userAccessToken: encryptText(params.accessToken),
    userRefreshToken: params.refreshToken ? encryptText(params.refreshToken) : existing.userRefreshToken,
    userTokenExpiresAt: params.expiresAt,
    userName: params.userName,
    userEmail: params.userEmail,
  }
  writeFileSync(getWpsConfigPath(), JSON.stringify(next, null, 2), 'utf-8')
}

/** 清除用户 OAuth 认证信息 */
export function clearWpsUserAuth(): void {
  const existing = getWpsConfig()
  const next: WpsConfig = {
    ...existing,
    userAccessToken: undefined,
    userRefreshToken: undefined,
    userTokenExpiresAt: undefined,
    userName: undefined,
    userEmail: undefined,
  }
  writeFileSync(getWpsConfigPath(), JSON.stringify(next, null, 2), 'utf-8')
}

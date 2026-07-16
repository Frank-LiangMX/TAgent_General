/**
 * WPS 协作配置管理
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

import { safeStorage } from 'electron'

import type { WpsConfig, WpsConfigInput } from '@tagent/shared'
import { getWpsConfigPath } from './config-paths'

/** 内置 App ID（直接硬编码，公开标识符无泄露风险） */
const BUILTIN_APP_ID = 'AK20260708DASRKI'

/**
 * 内置 Secret Key — AES-128-ECB 混淆
 * 密文直接写死在代码里，运行时解码。
 * grep 搜源码看不到明文，解密只需固定 key。
 */
const BUILTIN_SECRET_ENC = 'edb8d30e135ba0eab88b0274dac1d23b9ac790b1dad375f7f51a74b5b53f40fe'
const BUILTIN_SECRET_KEY_DECODE_KEY = 'tagent-wps-2024'

function decodeBuiltinSecret(): string {
  try {
    const key = Buffer.from(BUILTIN_SECRET_KEY_DECODE_KEY.padEnd(16).slice(0, 16))
    const decipher = createDecipheriv('aes-128-ecb', key, null)
    let dec = decipher.update(BUILTIN_SECRET_ENC, 'hex', 'hex')
    dec += decipher.final('hex')
    return dec
  } catch {
    return ''
  }
}

/** 内置 Secret Key（运行时解密） */
const BUILTIN_SECRET_KEY = decodeBuiltinSecret()

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
    // 注意：secretKey 不在此处 fallback 到 BUILTIN_SECRET_KEY！
    // secretKey 的语义是 safeStorage 加密后的 base64，而 BUILTIN_SECRET_KEY
    // 是原始明文，不能写进 secretKey 字段。调用方请用 resolveSecretKey()。
    return config
  } catch (error) {
    console.error('[WPS配置] 读取失败:', error)
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * 解析当前的 Secret Key（明文）
 *
 * 优先级：用户填写的加密 secretKey → 内置混淆密钥
 */
export function resolveSecretKey(): string {
  const config = getWpsConfig()
  if (config.secretKey) {
    try {
      const decrypted = decryptText(config.secretKey)
      if (decrypted) return decrypted
    } catch {
      // 解密失败，fallback 到内置
    }
  }
  return BUILTIN_SECRET_KEY
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
    // 用户填写了新的 secretKey 时才加密存储；空则清空，运行时从内置 fallback
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
  return resolveSecretKey()
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
    userRefreshToken: params.refreshToken
      ? encryptText(params.refreshToken)
      : existing.userRefreshToken,
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

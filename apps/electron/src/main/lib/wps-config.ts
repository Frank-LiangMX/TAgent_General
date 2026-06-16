/**
 * WPS 协作配置管理
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'

import { safeStorage } from 'electron'

import { getWpsConfigPath } from './config-paths'

import type { WpsConfig, WpsConfigInput } from '@tagent/shared'

const DEFAULT_CONFIG: WpsConfig = {
  enabled: false,
  appId: '',
  secretKey: '',
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

export function getWpsConfig(): WpsConfig {
  const configPath = getWpsConfigPath()
  if (!existsSync(configPath)) return { ...DEFAULT_CONFIG }
  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<WpsConfig>
    return { ...DEFAULT_CONFIG, ...parsed }
  } catch (error) {
    console.error('[WPS配置] 读取失败:', error)
    return { ...DEFAULT_CONFIG }
  }
}

export function saveWpsConfig(input: WpsConfigInput): WpsConfig {
  const existing = getWpsConfig()
  const next: WpsConfig = {
    ...existing,
    enabled: input.enabled,
    appId: input.appId.trim(),
    apiUrl: input.apiUrl.trim() || DEFAULT_CONFIG.apiUrl,
    callbackPort: Number.isFinite(input.callbackPort) ? input.callbackPort : DEFAULT_CONFIG.callbackPort,
    callbackPath: input.callbackPath.trim() || DEFAULT_CONFIG.callbackPath,
    defaultWorkspaceId: input.defaultWorkspaceId,
    secretKey: input.secretKey ? encryptText(input.secretKey) : existing.secretKey,
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

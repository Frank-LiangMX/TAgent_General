/**
 * WPS 协作集成相关类型定义
 */

/** WPS Bridge 连接状态 */
export type WpsBridgeStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

/** WPS Bridge 状态详情 */
export interface WpsBridgeState {
  status: WpsBridgeStatus
  connectedAt?: number
  errorMessage?: string
  /** 本地监听地址（用于在开放平台配置回调） */
  callbackUrl?: string
}

/** WPS 配置（持久化到 ~/.tagent/wps.json） */
export interface WpsConfig {
  enabled: boolean
  appId: string
  /** safeStorage 加密后的 base64 */
  secretKey: string
  /** safeStorage 加密后的 base64，可选 */
  encryptKey?: string
  apiUrl: string
  callbackPort: number
  callbackPath: string
  defaultWorkspaceId?: string
}

/** WPS 配置保存输入（明文） */
export interface WpsConfigInput {
  enabled: boolean
  appId: string
  /** 明文 secretKey；空字符串表示不修改 */
  secretKey: string
  /** 明文 encryptKey；空字符串表示清空 */
  encryptKey?: string
  apiUrl: string
  callbackPort: number
  callbackPath: string
  defaultWorkspaceId?: string
}

/** WPS 连接测试结果 */
export interface WpsTestResult {
  success: boolean
  message: string
}

export const WPS_IPC_CHANNELS = {
  GET_CONFIG: 'wps:get-config',
  GET_DECRYPTED_SECRET: 'wps:get-decrypted-secret',
  SAVE_CONFIG: 'wps:save-config',
  TEST_CONNECTION: 'wps:test-connection',
  START_BRIDGE: 'wps:start-bridge',
  STOP_BRIDGE: 'wps:stop-bridge',
  GET_STATUS: 'wps:get-status',
  STATUS_CHANGED: 'wps:status-changed',
} as const

/**
 * kscc 内网渠道配置加载器
 *
 * 内置默认值（探测 URL、安装命令等），无需配置文件即可正常工作。
 * ~/.tagent/kscc-config.json 作为可选覆盖机制，高级用户可自定义。
 *
 * 配置存在时合并覆盖默认值；不存在时全部走内置默认。
 */

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import type { ChannelModel } from '@tagent/shared'

import { getConfigDir } from './config-paths'

/** kscc 配置文件结构 */
export interface KsccConfig {
  /** 内网探测 URL（HEAD 请求判断是否在公司内网） */
  probeUrl: string
  /** 内部 npm registry 地址 */
  npmRegistry: string
  /** 内部 kscc 包名 */
  ksccPackage: string
  /** Node.js 最低版本要求 */
  nodeJsMinVersion: string
  /** bun 固定版本 */
  bunVersion: string
  /** 平台特定的安装命令 */
  installScript: Record<'zhuhai' | 'windows' | 'macos' | 'linux', string>
  /** 默认模型列表（fetchKsccModels 失败时使用） */
  defaultModels: ChannelModel[]
  /** 珠海一键脚本的外部链接（可选） */
  zhuhaiInstallLink?: string
  /** Git 下载链接（可选） */
  gitDownloadLink?: string
  /** Node.js 下载链接（可选） */
  nodeJsDownloadLink?: string
}

// ===== 内置默认值 =====

const KSCC_PROBE_URL = 'http://120.92.138.34'
const KSCC_NPM_REGISTRY = 'http://npmhub.ksyun.com'
const KSCC_PACKAGE = '@seasun/kscc'
const KSCC_BUN_VERSION = '1.3.14'
const KSCC_NODE_MIN_VERSION = '18.20.8'

const KSCC_DEFAULT_MODELS: ChannelModel[] = [
  { id: 'glm-5.1', name: 'GLM-5.1', enabled: true },
  { id: 'glm-5.2', name: 'GLM-5.2 (1M)', enabled: true },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', enabled: true },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', enabled: true },
  { id: 'mimo-v2.5', name: 'MiMo V2.5 (1M)', enabled: true },
  { id: 'mimo-v2.5-pro', name: 'MiMo V2.5 Pro (1M)', enabled: true },
]

const KSCC_INSTALL_SCRIPTS: Record<'zhuhai' | 'windows' | 'macos' | 'linux', string> = {
  zhuhai: `powershell.exe -nop -ep Bypass -c "iwr 'http://jx3mhelpertray.xsj.kingsoft.net/Software/Develop/KSCC/InstallKscc.ps1' -OutFile $env:TEMP\\InstallKscc.ps1; Set-ExecutionPolicy -Scope Process Bypass -Force; & $env:TEMP\\InstallKscc.ps1"`,
  windows: `npm i -g bun@${KSCC_BUN_VERSION} ${KSCC_PACKAGE} --registry=${KSCC_NPM_REGISTRY}`,
  macos: `npm i -g bun@${KSCC_BUN_VERSION} ${KSCC_PACKAGE} --registry=${KSCC_NPM_REGISTRY}`,
  linux: `npm i -g bun@${KSCC_BUN_VERSION} ${KSCC_PACKAGE} --registry=${KSCC_NPM_REGISTRY}`,
}

const DEFAULTS: KsccConfig = {
  probeUrl: KSCC_PROBE_URL,
  npmRegistry: KSCC_NPM_REGISTRY,
  ksccPackage: KSCC_PACKAGE,
  nodeJsMinVersion: KSCC_NODE_MIN_VERSION,
  bunVersion: KSCC_BUN_VERSION,
  installScript: KSCC_INSTALL_SCRIPTS,
  defaultModels: KSCC_DEFAULT_MODELS,
  gitDownloadLink: 'https://git-scm.com/',
  nodeJsDownloadLink: 'https://nodejs.org/',
}

// ===== 合并逻辑 =====

let _config: KsccConfig | undefined = undefined

/** 从文件读取用户覆盖配置 */
function loadUserOverride(): Partial<KsccConfig> | null {
  const configPath = join(getConfigDir(), 'kscc-config.json')
  if (!existsSync(configPath)) return null

  try {
    const raw = readFileSync(configPath, 'utf-8')
    return JSON.parse(raw) as Partial<KsccConfig>
  } catch (e) {
    console.warn('[kscc-config] 读取用户配置失败，使用内置默认值:', e)
    return null
  }
}

/** 获取合并后的配置（内置默认 + 用户覆盖），带懒加载缓存 */
function getMergedConfig(): KsccConfig {
  if (_config === undefined) {
    const override = loadUserOverride()
    if (override) {
      _config = {
        ...DEFAULTS,
        ...override,
        installScript: { ...DEFAULTS.installScript, ...override.installScript },
        defaultModels: override.defaultModels ?? DEFAULTS.defaultModels,
      }
      console.log('[kscc-config] 已合并用户覆盖配置')
    } else {
      _config = { ...DEFAULTS }
    }
  }
  return _config
}

/** 获取 kscc 配置（总是有效，无需前置条件） */
export function getKsccConfig(): KsccConfig {
  return getMergedConfig()
}

/** 获取内网探测 URL */
export function getProbeUrl(): string {
  return getMergedConfig().probeUrl
}

/** 获取内部 npm registry */
export function getNpmRegistry(): string {
  return getMergedConfig().npmRegistry
}

/** 获取 kscc 包名 */
export function getKsccPackage(): string {
  return getMergedConfig().ksccPackage
}

/** 获取 Node.js 最低版本 */
export function getNodeJsMinVersion(): string {
  return getMergedConfig().nodeJsMinVersion
}

/** 获取 bun 固定版本 */
export function getBunVersion(): string {
  return getMergedConfig().bunVersion
}

/** 获取指定平台的安装命令 */
export function getInstallScript(platform: string): string {
  const config = getMergedConfig()
  const key = platform as keyof KsccConfig['installScript']
  return config.installScript[key] ?? ''
}

/** 获取默认模型列表 */
export function getDefaultModels(): ChannelModel[] {
  return getMergedConfig().defaultModels
}

/** 重置缓存（用于刷新检测） */
export function resetKsccConfigCache(): void {
  _config = undefined
}

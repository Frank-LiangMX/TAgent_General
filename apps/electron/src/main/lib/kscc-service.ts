/**
 * kscc 内网渠道检测与安装引导服务
 *
 * 只检测 kscc CLI 是否可用，不检测内网。
 * 装了 kscc 就能用，没装就引导安装。
 */

import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import type { ChannelModel } from '@tagent/shared'

import {
  getKsccConfig,
  getKsccPackage,
  getInstallScript,
  getDefaultModels,
  getNodeJsMinVersion,
  resetKsccConfigCache,
} from './kscc-config'

// ===== kscc CLI 检测 =====

/** 检测 kscc CLI 是否可用 */
export function isKsccInstalled(): { installed: boolean; path?: string; version?: string } {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const path = execFileSync(cmd, ['kscc'], { encoding: 'utf-8', timeout: 3000 })
      .trim()
      .split('\n')[0]
    return { installed: true, path }
  } catch {
    return { installed: false }
  }
}

// ===== 模型列表 =====

/** 读取 kscc 内置模型列表 */
export async function fetchKsccModels(): Promise<ChannelModel[]> {
  const ksccPackage = getKsccPackage()
  if (!ksccPackage) return []

  try {
    const m = require(require.resolve(`${ksccPackage}/src/util.js`, { paths: [homedir()] }))
    const models = await m.initAndGetModels()
    return models.map((r: { value: string; label: string }) => ({
      id: r.value,
      name: r.label,
      enabled: true,
    }))
  } catch {
    return []
  }
}

/** fallback 模型列表 */
export function getDefaultKsccModels(): ChannelModel[] {
  return getDefaultModels()
}

// ===== 聚合状态 =====

/** 获取 kscc 状态 */
export async function getKsccStatus(): Promise<{
  installed: boolean
  models: ChannelModel[]
}> {
  const ksccResult = isKsccInstalled()
  const installed = ksccResult.installed

  let models: ChannelModel[] = []
  if (installed) {
    models = await fetchKsccModels()
    if (models.length === 0) {
      models = getDefaultKsccModels()
    }
  }

  return { installed, models }
}

// ===== 安装就绪检测 =====

/** 检测 Node.js 环境 */
function detectNodeJs(): { installed: boolean; version?: string; meetsMinimum: boolean } {
  const minVersion = getNodeJsMinVersion()
  try {
    const raw = execFileSync('node', ['--version'], { encoding: 'utf-8', timeout: 3000 }).trim()
    const version = raw.startsWith('v') ? raw.slice(1) : raw
    const meetsMinimum = compareVersions(version, minVersion) >= 0
    return { installed: true, version, meetsMinimum }
  } catch {
    return { installed: false, meetsMinimum: false }
  }
}

/** 检测 Git 环境 */
function detectGit(): { installed: boolean; version?: string } {
  try {
    const raw = execFileSync('git', ['--version'], { encoding: 'utf-8', timeout: 3000 }).trim()
    const version = raw.replace('git version ', '')
    return { installed: true, version }
  } catch {
    return { installed: false }
  }
}

/** 简单语义版本比较 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number)
  const partsB = b.split('.').map(Number)
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const pa = partsA[i] ?? 0
    const pb = partsB[i] ?? 0
    if (pa > pb) return 1
    if (pa < pb) return -1
  }
  return 0
}

/** 检测 kscc 安装就绪状态 */
export async function checkKsccInstallReadiness() {
  resetKsccConfigCache()

  const config = getKsccConfig()
  const nodeJs = detectNodeJs()
  const git = detectGit()
  const kscc = isKsccInstalled()
  const platform = process.platform

  const installSteps = buildInstallSteps(platform, nodeJs, git, kscc, config)

  return {
    nodeJs,
    git,
    kscc,
    platform,
    installSteps,
  }
}

// ===== 安装步骤 =====

export interface KsccInstallStep {
  id: string
  label: string
  command?: string
  link?: string
  optional?: boolean
  done?: boolean
}

function buildInstallSteps(
  platform: NodeJS.Platform,
  nodeJs: { installed: boolean; version?: string; meetsMinimum: boolean },
  git: { installed: boolean; version?: string },
  kscc: { installed: boolean; path?: string; version?: string },
  config: import('./kscc-config').KsccConfig,
): KsccInstallStep[] {
  const steps: KsccInstallStep[] = []

  // 珠海一键脚本（仅 Windows）
  if (platform === 'win32') {
    const zhuhaiScript = getInstallScript('zhuhai')
    if (zhuhaiScript) {
      steps.push({
        id: 'zhuhai-install',
        label: '（珠海办公）打开 PowerShell 并执行一键安装脚本',
        command: zhuhaiScript,
        done: kscc.installed,
      })
    }
  }

  // Git（可选）
  steps.push({
    id: 'git',
    label: '安装 Git',
    link: config.gitDownloadLink ?? 'https://git-scm.com/',
    done: git.installed,
    optional: true,
  })

  // Node.js
  steps.push({
    id: 'nodejs',
    label: `安装 Node.js LTS（>= ${getNodeJsMinVersion()}）`,
    command: platform === 'win32' ? 'winget install OpenJS.NodeJS.LTS' : undefined,
    link: config.nodeJsDownloadLink ?? 'https://nodejs.org/',
    done: nodeJs.installed && nodeJs.meetsMinimum,
    optional: nodeJs.installed && nodeJs.meetsMinimum,
  })

  // kscc CLI 安装
  const platformKey = platform === 'win32' ? 'windows' : platform === 'darwin' ? 'macos' : 'linux'
  const ksccInstallCmd = getInstallScript(platformKey)
  steps.push({
    id: 'kscc-install',
    label: '安装 kscc CLI',
    command: ksccInstallCmd || undefined,
    done: kscc.installed,
  })

  steps.push({ id: 'restart', label: '安装完成后点击"重新检测"', done: kscc.installed })

  return steps
}

// ===== 缓存管理 =====

/** 清除所有缓存 */
export function clearKsccCache(): void {
  resetKsccConfigCache()
}

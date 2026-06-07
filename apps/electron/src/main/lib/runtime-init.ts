/**
 * 运行时初始化协调器
 *
 * 负责协调所有运行时初始化逻辑，包括：
 * 1. Shell 环境加载（macOS）
 * 2. Node.js 运行时检测
 * 3. Bun 运行时检测
 * 4. Git 运行时检测
 * 5. Shell 环境检测（Windows - Git Bash / WSL）
 */

import { detectBunRuntime } from './bun-finder'
import { detectGitBash } from './git-bash-detector'
import { detectGitRuntime } from './git-detector'
import { detectNodeRuntime } from './node-detector'
import { loadShellEnv } from './shell-env'
import { detectWsl } from './wsl-detector'

import type { RuntimeStatus, RuntimeInitOptions, ShellEnvironmentStatus } from '@tagent/shared'

/** 运行时状态缓存 */
let runtimeStatusCache: RuntimeStatus | null = null

/** 初始化标志 */
let isInitialized = false

/**
 * 初始化运行时环境
 *
 * 按顺序执行：
 * 1. loadShellEnv() - 加载 Shell 环境（仅 macOS 打包环境）
 * 2. detectNodeRuntime() - 检测 Node.js 运行时
 * 3. detectBunRuntime() - 检测 Bun 运行时
 * 4. detectGitRuntime() - 检测 Git 运行时
 * 5. detectShellEnvironment() - 检测 Shell 环境（仅 Windows）
 *
 * @param options - 初始化选项
 * @returns 运行时状态
 */
export async function initializeRuntime(options: RuntimeInitOptions = {}): Promise<RuntimeStatus> {
  const startTime = Date.now()
  console.log('[运行时初始化] 开始初始化运行时环境...')

  // 1. 加载 Shell 环境
  let envLoaded = false

  if (!options.skipEnvLoad) {
    try {
      const shellEnvResult = await loadShellEnv()
      envLoaded = shellEnvResult.success
    } catch (error) {
      console.error('[运行时初始化] Shell 环境加载失败:', error)
      envLoaded = false
    }
  }

  // 2. 检测 Node.js 运行时
  const nodeStatus = options.skipNodeDetection
    ? {
        available: false,
        path: null,
        version: null,
        error: '已跳过 Node.js 检测',
      }
    : await detectNodeRuntime()

  // 3. 检测 Bun 运行时
  const bunStatus = options.skipBunDetection
    ? {
        available: false,
        path: null,
        version: null,
        source: null,
        error: '已跳过 Bun 检测',
      }
    : await detectBunRuntime()

  // 4. 检测 Git 运行时
  const gitStatus = options.skipGitDetection
    ? {
        available: false,
        version: null,
        path: null,
        error: '已跳过 Git 检测',
      }
    : await detectGitRuntime()

  // 5. 检测 Shell 环境（仅 Windows 平台）
  let shellEnvironmentStatus: ShellEnvironmentStatus | undefined

  if (process.platform === 'win32' && !options.skipShellDetection) {
    try {
      const gitBashStatus = await detectGitBash()
      const wslStatus = await detectWsl()

      // 推荐策略：优先 Git Bash > WSL 2 > WSL 1
      let recommended: 'git-bash' | 'wsl' | null = null
      if (gitBashStatus.available) {
        recommended = 'git-bash'
      } else if (wslStatus.available) {
        recommended = 'wsl'
      }

      shellEnvironmentStatus = {
        gitBash: gitBashStatus,
        wsl: wslStatus,
        recommended,
      }

      console.log('[运行时初始化] Shell 环境检测完成:', {
        gitBash: gitBashStatus.available ? `✅ ${gitBashStatus.version}` : `❌ ${gitBashStatus.error}`,
        wsl: wslStatus.available
          ? `✅ WSL ${wslStatus.version} (${wslStatus.defaultDistro})`
          : `❌ ${wslStatus.error}`,
        recommended: recommended || '⚠️ 无可用环境',
      })
    } catch (error) {
      console.error('[运行时初始化] Shell 环境检测失败:', error)
    }
  }

  // 构建运行时状态
  const runtimeStatus: RuntimeStatus = {
    node: nodeStatus,
    bun: bunStatus,
    git: gitStatus,
    shell: shellEnvironmentStatus,
    envLoaded,
    initializedAt: Date.now(),
  }

  // 缓存状态
  runtimeStatusCache = runtimeStatus
  isInitialized = true

  const duration = Date.now() - startTime
  console.log(`[运行时初始化] 初始化完成 (耗时 ${duration}ms)`)
  console.log('[运行时初始化] 状态:', {
    node: nodeStatus.available ? `✅ ${nodeStatus.version}` : `❌ ${nodeStatus.error}`,
    bun: bunStatus.available ? `✅ ${bunStatus.version} (${bunStatus.source})` : `❌ ${bunStatus.error}`,
    git: gitStatus.available ? `✅ ${gitStatus.version}` : `❌ ${gitStatus.error}`,
    shell: shellEnvironmentStatus
      ? `${shellEnvironmentStatus.recommended ? '✅' : '⚠️'} ${shellEnvironmentStatus.recommended || '无可用环境'}`
      : '⏭️ 跳过（非 Windows）',
    envLoaded: envLoaded ? '✅' : '⚠️ 未加载或不需要',
  })

  // P0-2 启动时验证所有 enabled 渠道的 model 名字
  // 防止 9120caac 那类 model 名误配导致所有会话 400 (2013)
  // 注意: 此步骤网络不可用时会失败但不阻塞启动
  if (!options.skipChannelValidation) {
    void validateAllEnabledChannels().catch((err) => {
      console.warn('[运行时初始化] 渠道验证失败（不阻塞启动）:', err)
    })
  }

  return runtimeStatus
}

/**
 * P0-2: 启动时验证所有 enabled 渠道的 model 名
 *
 * 遍历 channels.json, 对每个 enabled 渠道调 validateChannelModel。
 * 失败的结果写到 console + 状态文件,不抛异常(避免阻塞启动)。
 */
async function validateAllEnabledChannels(): Promise<void> {
  try {
    const { listChannels, decryptApiKey, validateChannelModel } = await import('./channel-manager')
    const channels = listChannels().filter((c) => c.enabled)
    if (channels.length === 0) {
      console.log('[渠道验证] 没有 enabled 渠道,跳过')
      return
    }
    console.log(`[渠道验证] 启动验证 ${channels.length} 个 enabled 渠道...`)
    const results = await Promise.allSettled(
      channels.map(async (c) => {
        const modelId = c.models.find((m) => m.enabled)?.id ?? c.models[0]?.id
        if (!modelId) {
          return { channelId: c.id, name: c.name, status: 'no-model' as const }
        }
        const apiKey = decryptApiKey(c.id)
        const result = await validateChannelModel({
          baseUrl: c.baseUrl,
          apiKey,
          model: modelId,
          provider: c.provider,
        })
        return { channelId: c.id, name: c.name, model: modelId, result }
      }),
    )
    let pass = 0
    let fail = 0
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const v = r.value
        if (v.status === 'no-model') {
          console.warn(`[渠道验证] ⚠️ 渠道「${v.name}」没有配置 model`)
          fail++
        } else if (v.result.success) {
          console.log(`[渠道验证] ✅ ${v.name} (${v.model}): ${v.result.message}`)
          pass++
        } else {
          console.warn(`[渠道验证] ❌ ${v.name} (${v.model}): ${v.result.message}`)
          fail++
        }
      } else {
        console.warn(`[渠道验证] ❌ 验证异常:`, r.reason)
        fail++
      }
    }
    console.log(`[渠道验证] 启动完成: ${pass} 通过, ${fail} 失败`)
  } catch (err) {
    console.warn('[渠道验证] 启动时验证异常（不阻塞）:', err)
  }
}

/**
 * 获取当前运行时状态
 *
 * @returns 运行时状态，如果未初始化返回 null
 */
export function getRuntimeStatus(): RuntimeStatus | null {
  return runtimeStatusCache
}

/**
 * 检查运行时是否已初始化
 *
 * @returns 是否已初始化
 */
export function isRuntimeInitialized(): boolean {
  return isInitialized
}

/**
 * 重新初始化运行时
 *
 * @param options - 初始化选项
 * @returns 新的运行时状态
 */
export async function reinitializeRuntime(options: RuntimeInitOptions = {}): Promise<RuntimeStatus> {
  isInitialized = false
  runtimeStatusCache = null
  return initializeRuntime(options)
}

// 重新导出子模块的函数，方便外部使用
export { getGitRepoStatus } from './git-detector'
export { detectNodeRuntime } from './node-detector'
export { detectBunRuntime } from './bun-finder'
export { loadShellEnv } from './shell-env'

# kscc 内网渠道集成设计文档

> **状态**：Draft v0.1
> **日期**：2026-06-25
> **目标**：在公司内网环境下将 kscc（公司内部 Claude Code CLI）作为 TAgent 内置 provider 接入，用户选择 kscc 渠道后 Agent 模式走 kscc 子进程使用公司免费模型
> **关联**：[`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md)、[`2026-06-16-upstream-upgrade-plan.md`](2026-06-16-upstream-upgrade-plan.md)
> **分支建议**：`feature/kscc-internal-provider`

---

## 0. Handoff 摘要

**你要做什么**：在 TAgent 的渠道系统中新增 kscc 内网渠道。用户在内网环境下可以切换到 kscc 渠道，Agent 模式 spawn kscc CLI 子进程而非 SDK 自带的 claude.exe，使用公司内部免费的国产模型（GLM、Kimi、MiMo）。

**核心参考**：

- kscc 是 Owtffssent Claude Code CLI 的公司内部定制版（`@seasun/kscc` v1.0.21），协议与原生 CLI 完全一致
- kscc 代理地址 `http://120.92.138.34`，内网可达，认证由 kscc CLI 自行处理（读 `~/.claude/` 配置）
- kscc 内置模型列表通过 `initAndGetModels()` 读取：glm-5、glm-5.1、glm-5.2(1M)、kimi-k2.5、kimi-k2.6、mimo-v2.5(1M)、mimo-v2.5-pro(1M)
- kscc CLI 支持 `--permission-prompt-tool`、`streamInput`、`ExitPlanMode`、thinking/budget、effort、mcpServers 等 TAgent 所需的核心特性（feature 检测已确认）
- 不支持 `toolUseConcurrency` 和 `context-1m` beta（TAgent 当前硬编码 `toolUseConcurrency: 1`，不影响正确性）

**不要做的事**：

- 不要改动任何现有外部渠道的 CRUD / API Key / baseUrl / 模型列表逻辑
- 不要在外网环境下暴露或自动启用 kscc 渠道
- 不要在 TAgent 侧存储或管理 kscc 的认证信息
- 不要改动 Chat 模式的 SSE 适配器逻辑
- 不要改动 MCP 注入、TA 工具注入、权限系统、IM 桥接、定时任务、资产库等独立于渠道的模块

---

## 1. 背景与目标

### 1.1 现状

TAgent 通过 Claude Agent SDK spawn 原生 `claude.exe` 子进程驱动 Agent 模式。用户需要自备 API Key（Anthropic/DeepSeek/Kimi 等），按 token 计费。公司内部部署了 kscc——基于 Claude Code CLI 定制的内部工具，接入了公司代理，提供免费的国产模型。

### 1.2 目标

- 内网用户可以零成本使用 Agent 模式
- 定时任务（每日资产扫描、入库催办等）可以大量跑，不产生费用
- kscc 渠道集成后，TAgent 的所有定制特性（权限审批、MCP 注入、IM 桥接、定时任务、资产库、插件商店）全部保留
- 外网用户体验零影响

---

## 2. 约束

1. **外部渠道零改动**：用户自建渠道的 API Key 加密存储、模型拉取、连接测试逻辑一行不改
2. **kscc 仅内网可用**：不在内网时渠道灰显或禁用，不会误触
3. **kscc 自管认证**：TAgent 不存 kscc 的 API Key，认证完全由 kscc CLI 自行处理

---

## 3. 技术方案

### 3.1 Provider 类型扩展

文件：`packages/shared/src/types/channel.ts`

```ts
export type ProviderType =
  | ...  // 现有 16 种
  | 'kscc-internal'

export const PROVIDER_DEFAULT_URLS: Record<ProviderType, string> = {
  ...existing,
  'kscc-internal': 'http://120.92.138.34',
}

export const PROVIDER_LABELS: Record<ProviderType, string> = {
  ...existing,
  'kscc-internal': 'kscc 内网（公司免费）',
}

// kscc 走 Anthropic /v1/messages 协议，加入 AGENT_COMPATIBLE_PROVIDERS
export const AGENT_COMPATIBLE_PROVIDERS: ReadonlySet<ProviderType> = new Set<ProviderType>([
  ...existing,
  'kscc-internal',
])
```

### 3.2 内网与 kscc 检测

新建文件：`apps/electron/src/main/lib/kscc-service.ts`

```ts
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ChannelModel } from '@tagent/shared'

const KSCC_PROBE_URL = 'http://120.92.138.34'
const KSCC_PROBE_TIMEOUT = 3000

/** 探测内网连通性 */
export async function isIntranet(): Promise<boolean> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), KSCC_PROBE_TIMEOUT)
    const res = await fetch(KSCC_PROBE_URL, { signal: controller.signal, method: 'HEAD' })
    clearTimeout(timer)
    return res.status < 500
  } catch {
    return false
  }
}

/** 检测 kscc CLI 是否可用 */
export function isKsccInstalled(): boolean {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    const result = execFileSync(cmd, ['kscc'], { encoding: 'utf-8', timeout: 3000 })
    return result.trim().length > 0
  } catch {
    return false
  }
}

/** 读取 kscc 内置模型列表 */
export async function fetchKsccModels(): Promise<ChannelModel[]> {
  try {
    const m = require(require.resolve('@seasun/kscc/src/util.js', { paths: [homedir()] }))
    const models = await m.initAndGetModels()
    return models.map((r: any) => ({
      id: r.value,
      name: r.label,
      enabled: true,
    }))
  } catch {
    return []
  }
}

/** 聚合状态（30 秒缓存） */
let cache: { intranet: boolean; installed: boolean; models: ChannelModel[]; ts: number } | null = null

export async function getKsccStatus(): Promise<{
  intranet: boolean
  installed: boolean
  models: ChannelModel[]
}> {
  const now = Date.now()
  if (cache && now - cache.ts < 30_000) {
    return { intranet: cache.intranet, installed: cache.installed, models: cache.models }
  }
  const intranet = await isIntranet()
  const installed = intranet ? isKsccInstalled() : false
  let models: ChannelModel[] = []
  if (intranet && installed) {
    models = await fetchKsccModels()
  }
  cache = { intranet, installed, models, ts: now }
  return { intranet, installed, models }
}

/** fallback 模型列表（fetchKsccModels 失败时使用） */
export const DEFAULT_KSCC_MODELS: ChannelModel[] = [
  { id: 'glm-5.1', name: 'GLM-5.1', enabled: true },
  { id: 'glm-5.2', name: 'GLM-5.2 (1M)', enabled: true },
  { id: 'kimi-k2.5', name: 'Kimi K2.5', enabled: true },
  { id: 'kimi-k2.6', name: 'Kimi K2.6', enabled: true },
  { id: 'mimo-v2.5', name: 'MiMo V2.5 (1M)', enabled: true },
  { id: 'mimo-v2.5-pro', name: 'MiMo V2.5 Pro (1M)', enabled: true },
]
```

### 3.3 渠道自动创建与状态同步

文件：`apps/electron/src/main/lib/channel-manager.ts`，在 `listChannels()` 末尾追加（异步，不阻塞首次返回）：

```ts
// --- kscc 内网渠道生命周期 ---
;(async () => {
  const status = await getKsccStatus()
  const config = readConfig()
  const existing = config.channels.find(c => c.provider === 'kscc-internal')

  if (!status.intranet || !status.installed) {
    if (existing?.enabled) {
      existing.enabled = false
      existing.updatedAt = Date.now()
      writeConfig(config)
    }
    return
  }

  const models = status.models.length > 0 ? status.models : DEFAULT_KSCC_MODELS

  if (!existing) {
    config.channels.push({
      id: randomUUID(),
      name: 'kscc 内网',
      provider: 'kscc-internal',
      baseUrl: 'http://120.92.138.34',
      apiKey: '',
      models,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    writeConfig(config)
  } else if (!existing.enabled) {
    existing.enabled = true
    existing.models = models
    existing.updatedAt = Date.now()
    writeConfig(config)
  } else if (status.models.length > 0) {
    existing.models = status.models
    existing.updatedAt = Date.now()
    writeConfig(config)
  }
})()
```

### 3.4 SDK CLI 路径替换

文件：`apps/electron/src/main/lib/agent-orchestrator.ts`，`sendMessage()` 中构建 `cliPath` 的位置：

```ts
// 现有
let cliPath = resolveSDKCliPath()

// 新增：kscc 渠道使用 kscc CLI
if (channel.provider === 'kscc-internal') {
  try {
    const cmd = process.platform === 'win32' ? 'where' : 'which'
    cliPath = execFileSync(cmd, ['kscc'], { encoding: 'utf-8', timeout: 3000 })
      .trim().split('\n')[0]
    console.log(`[Agent 编排] 使用 kscc CLI: ${cliPath}`)
  } catch {
    reportPreflightError({
      code: 'kscc_not_found',
      title: 'kscc 未找到',
      message: '已选择 kscc 内网渠道但未检测到 kscc 命令，请运行 npm i -g @seasun/kscc',
      actions: [
        { key: 'i', label: '安装 kscc', action: 'open_external', payload: 'http://npmhub.ksyun.com/@seasun/kscc' },
        { key: 's', label: '切换渠道', action: 'open_channel_settings' },
      ],
      canRetry: false,
    })
    return
  }
}

// 后续 queryOptions 中使用 cliPath 替代原来的 resolveSDKCliPath() 返回值
const queryOptions: ClaudeAgentQueryOptions = {
  ...existing,
  sdkCliPath: cliPath,
}
```

### 3.5 认证逻辑隔离

文件：`apps/electron/src/main/lib/agent-orchestrator.ts`

**`buildSdkEnv()` 新增分支**（在现有 provider 分支之前）：

```ts
if (provider === 'kscc-internal') {
  // kscc 自行处理认证，不注入任何 ANTHROPIC_* 凭证
  // 保留 CLAUDE_CONFIG_DIR 隔离、MAX_OUTPUT_TOKENS、公共配置
  return sdkEnv
}
```

**`sendMessage()` 中 process.env 同步注入**（同理）：

```ts
delete process.env.ANTHROPIC_API_KEY
delete process.env.ANTHROPIC_AUTH_TOKEN
delete process.env.ANTHROPIC_BASE_URL
delete process.env.ANTHROPIC_CUSTOM_HEADERS

if (channel.provider !== 'kscc-internal') {
  // 现有的 kimi-coding / xiaomi / 其他 provider 注入逻辑
  ...
}
```

### 3.6 模型路由

文件：`apps/electron/src/main/lib/agent-model-routing.ts`

```ts
export function resolveAgentModelRouting(input: {
  modelId: string
  provider: ProviderType
}): AgentModelRouting {
  if (input.provider === 'kscc-internal') {
    // kscc 下子 Agent 用最轻量的模型
    if (input.modelId.includes('mimo-v2.5')) {
      return { subagentModel: input.modelId.includes('pro') ? 'mimo-v2.5-pro' : 'mimo-v2.5' }
    }
    if (input.modelId.includes('kimi-k2')) {
      return { subagentModel: 'glm-5.1' }
    }
    return { subagentModel: 'glm-5.1' }
  }
  // ... 现有逻辑
}
```

### 3.7 系统提示词

文件：`apps/electron/src/main/lib/agent-prompt-builder.ts`，`buildSystemPrompt()` 的 SubAgent 策略区块新增 kscc 分支：

```
当 provider 为 kscc-internal 时，注入：

你当前通过 kscc 内网渠道运行，可用模型：<模型列表>。
子 Agent 统一使用 <subagentModel>，不要在 SubAgent 调用中指定 model 参数。
kscc 下的模型不支持 extended thinking，不要设置 thinking 参数。
```

### 3.8 UI 渲染

文件：`apps/electron/src/renderer/components/agent/AgentModelSelector.tsx`

- 渠道状态通过 IPC 调用 `kscc-service.getKsccStatus()` 获取
- 内网 + 已安装：正常显示，标注"公司免费"
- 不在内网：灰显渠道，tooltip "当前不在公司内网"
- 未安装 kscc：灰显渠道，tooltip "请先安装 kscc"

`ModelOption` 扩展：

```ts
interface ModelOption {
  ...existing
  disabled?: boolean
  disabledReason?: string
}
```

---

## 4. 文件改动清单

| 文件 | 改动 |
|---|---|
| `packages/shared/src/types/channel.ts` | +ProviderType, +PROVIDER_DEFAULT_URLS, +PROVIDER_LABELS, +AGENT_COMPATIBLE_PROVIDERS |
| `packages/shared/src/types/chat.ts` | ModelOption 加 disabled/disabledReason |
| `apps/electron/src/main/lib/kscc-service.ts` | **新建** |
| `apps/electron/src/main/lib/channel-manager.ts` | listChannels() 加 kscc 渠道生命周期 |
| `apps/electron/src/main/lib/agent-orchestrator.ts` | sendMessage 加 kscc CLI 路径; buildSdkEnv 加 kscc 分支; process.env 注入加 kscc 跳过 |
| `apps/electron/src/main/lib/agent-model-routing.ts` | +kscc 路由规则 |
| `apps/electron/src/main/lib/agent-prompt-builder.ts` | +kscc SubAgent 策略 |
| `apps/electron/src/renderer/components/agent/AgentModelSelector.tsx` | kscc 渠道灰显 + 状态提示 |

---

## 5. 不改动的部分

- 用户自建渠道的 CRUD 逻辑
- 外部渠道的 API Key 加密/解密/存储
- Chat 模式的 SSE 适配器（AnthropicAdapter / OpenAIAdapter / GoogleAdapter）
- MCP 注入、TA 工具注入、记忆工具注入
- 权限系统（canUseTool）
- IM 桥接、定时任务、资产库
- 会话管理、JSONL 持久化、客户端压缩
- 插件商店

---

## 6. 验证清单

1. 外网环境下 kscc 渠道灰显、不影响其他渠道的选择和使用
2. 内网环境下 kscc 渠道自动创建、模型列表正确填充
3. 切换到 kscc 渠道后 Agent 模式正常 spawn kscc 子进程、工具调用、流式输出
4. kscc 渠道下 process.env 中无任何 ANTHROPIC_* 凭证残留
5. 切回外部渠道后认证信息正确恢复
6. 退出内网后 kscc 渠道自动禁用
7. kscc 未安装时选择 kscc 渠道给出明确错误提示和安装指引

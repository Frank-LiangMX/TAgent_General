# AI 渠道测速功能设计文档

> 创建日期：2026-06-26
> 状态：规划中
> 分支：feature/draft-restructure

## 1. 背景与动机

用户在使用 TAgent 时，经常需要在多个 AI 渠道/模型之间切换。不同渠道因网络路径、代理质量、供应商负载等因素，响应速度差异很大。当前 `testChannel` 功能仅检测连通性（能通/不能通），不提供延迟数据。

本功能参考 VPN 应用中的节点测速模式，让用户自选模型并发测速，在渠道列表中以色块显示延迟等级，帮助用户快速选择最快的模型。

## 2. 核心设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 测什么 | 复用 `validateXxxModel()` 的 POST 请求 + 加计时 | 与现有验证逻辑一致，用户已熟悉"测试模型"语义 |
| 粒度 | 用户自选模型（每渠道可多选已启用模型） | 不同模型延迟差异大，用户需要按模型决策 |
| 触发时机 | 手动触发（设置页测速按钮） | 自动测速 v1 过早，用户可能不需要 |
| 结果持久化 | Session-only（Jotai atom，不写文件） | 延迟数据易过期，存文件弊大于利 |
| UI 位置 | 渠道列表行内延迟 pill badge | 最直觉，类似 VPN 节点列表 |
| 结果键 | `{channelId}:{modelId}` | 精确到模型级别 |

## 3. 延迟阈值

| 等级 | TTFB 范围 | 颜色 | 含义 |
|------|-----------|------|------|
| 快 | < 800ms | 绿 `emerald-600` / dark: `emerald-400` | 同区域/优质代理 |
| 中 | 800–2000ms | 黄 `amber-500` / dark: `amber-400` | 跨区/一般代理 |
| 慢 | > 2000ms | 红 `red-500` / dark: `red-400` | 拥堵/远端 |
| 失败 | 不可达 | 红 + "超时" | 连接失败 |

阈值依据：
- **< 800ms**：国内 API 端点或优质代理通常在 200-600ms TTFB 范围
- **800–2000ms**：跨境无代理直连 Anthropic/OpenAI 通常 1-2s TTFB
- **> 2000ms**：严重拥堵或远端节点

## 4. 用户体验流程

### 4.1 触发测速

1. 用户进入设置页 → 渠道配置
2. 点击工具栏中的"测速"按钮（圆形按钮，Gauge 图标，Tooltip "测速"）
3. 弹出 Popover，按渠道分组列出所有已启用渠道下的已启用模型，带 Checkbox
4. 用户勾选要测速的模型（默认全选）
5. 点击"开始测速"按钮

### 4.2 Popover 布局

```
┌─────────────────────────────┐
│ 选择要测速的模型     [全选] │
├─────────────────────────────┤
│ ☑ Anthropic - 官方渠道      │
│   ☑ claude-sonnet-4-6       │
│   ☑ claude-opus-4-7         │
│ ☑ DeepSeek                  │
│   ☑ deepseek-v4-pro         │
│ ☐ OpenAI                    │
│   ☐ gpt-4.1                 │
├─────────────────────────────┤
│              [开始测速 (4)]  │
└─────────────────────────────┘
```

- Popover 宽度：`w-auto min-w-[260px]`
- 标题：`text-xs font-medium text-foreground/80`
- 选项：`text-xs`，Checkbox + 模型名
- 渠道分组：渠道名加粗，下方缩进排列模型
- "全选"按钮切换全选/取消全选
- "开始测速"按钮显示已选数量，0 个时 disabled

### 4.3 测速进行中

- Popover 内显示进度："已完成 2/4"
- 渠道列表中，正在测速的渠道行右侧显示脉冲点动画
- 已完成的模型在 Popover 内和渠道列表中实时显示延迟 pill

### 4.4 测速结果展示

渠道列表中，每个渠道的描述行下方展示其已启用模型的延迟 pill：

```
┌─────────────────────────────────────────────┐
│ 🟢 Anthropic 官方                           │
│ Anthropic · 2 个模型已启用 · 可用于 Agent    │
│   [287ms] [1.3s]                            │ ← 模型延迟标签
│                                    [开关]   │
├─────────────────────────────────────────────┤
│ 🟡 DeepSeek                                  │
│ DeepSeek · 1 个模型已启用                    │
│   [超时]                                     │
│                                    [开关]   │
└─────────────────────────────────────────────┘
```

延迟 pill 样式：
- `text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full`
- 绿：`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400`
- 黄：`bg-amber-500/10 text-amber-500 dark:text-amber-400`
- 红：`bg-red-500/10 text-red-500 dark:text-red-400`
- TTFB < 1000ms → `XXXms`，>= 1000ms → `X.Xs`

## 5. 技术实现

### 5.1 类型定义

**文件**: `packages/shared/src/types/channel.ts`

```typescript
/** 单个模型的测速结果 */
export interface ModelSpeedTestResult {
  channelId: string
  modelId: string
  success: boolean
  ttfbMs: number | null
  totalTimeMs: number | null
  message: string
}

/** 批量测速输入：用户选择的模型列表 */
export interface SpeedTestInput {
  items: Array<{ channelId: string; modelId: string }>
}

/** 批量测速结果 */
export interface SpeedTestBatchResult {
  /** key 格式 "{channelId}:{modelId}" */
  results: Record<string, ModelSpeedTestResult>
}
```

在 `CHANNEL_IPC_CHANNELS` 中新增：

```typescript
SPEED_TEST: 'channel:speed-test',
```

### 5.2 主进程测速逻辑

**文件**: `apps/electron/src/main/lib/channel-manager.ts`

#### `speedTestModels(input: SpeedTestInput): Promise<SpeedTestBatchResult>`

入口函数：
- 读取配置获取渠道列表
- 按渠道分组，对同一渠道的模型共享解密后的 API Key（避免重复解密）
- 所有模型并发执行测速（`Promise.allSettled`）
- 收集结果到 `Record<string, ModelSpeedTestResult>`

#### `speedTestOneModel(channel, modelId, apiKey): Promise<ModelSpeedTestResult>`

单模型测速核心：
- 获取代理 → 记录 `t0 = performance.now()` → 调用 provider 对应的测速函数
- 测速函数返回带有 `__ttfbMs` / `__totalMs` 内部计时字段的 `ChannelTestResult`
- 将计时字段映射为 `ModelSpeedTestResult`

#### 三个 provider 特定测速函数

`speedTestAnthropicModel()` / `speedTestOpenAIModel()` / `speedTestGoogleModel()`：

- **复用** `validateAnthropicModel` / `validateOpenAIModel` / `validateGoogleModel` 的 URL、headers、body 构建逻辑
- **新增** 计时：`const ttfbStart = performance.now()` → `await fetchFn(...)` → `const ttfbMs = Math.round(performance.now() - ttfbStart)`
- **新增** 超时：`signal: AbortSignal.timeout(10_000)` — 10 秒超时
- **新增** 读完 body：`await response.text().catch(() => '')` → `const totalMs = Math.round(performance.now() - t0)`
- 返回 `ChannelTestResult & { __ttfbMs: number; __totalMs: number }`

**计时语义**：
- TTFB = 从 `fetchFn()` 调用到 `response` 对象返回的时间（HTTP headers 到达时刻）
- `totalTimeMs` = 从函数入口到读完 response body 的时间
- 对 POST 请求（Anthropic/OpenAI/Google validate 模式）：TTFB 包含网络往返 + 服务端排队，不含模型推理（因为 `max_tokens: 1`）
- 对 GET 请求（现有 testXxx 逻辑）：本功能不使用 GET 测试，统一用 POST validate 模式

**超时处理**：
- `AbortSignal.timeout(10_000)` 由 Node.js 运行时原生支持（Node 18+ / Bun 均支持）
- 超时抛出错误被外层 catch 捕获，返回 `success: false, ttfbMs: null`

### 5.3 IPC 通信

**文件**: `apps/electron/src/main/ipc.ts`

```typescript
ipcMain.handle(
  CHANNEL_IPC_CHANNELS.SPEED_TEST,
  async (_, input: SpeedTestInput): Promise<SpeedTestBatchResult> => {
    return speedTestModels(input)
  }
)
```

**文件**: `apps/electron/src/preload/index.ts`

类型声明：
```typescript
speedTestModels: (input: SpeedTestInput) => Promise<SpeedTestBatchResult>
```

实现：
```typescript
speedTestModels: (input: SpeedTestInput) => {
  return ipcRenderer.invoke(CHANNEL_IPC_CHANNELS.SPEED_TEST, input)
},
```

### 5.4 Jotai 状态管理

**文件**: `apps/electron/src/renderer/atoms/model-atoms.ts`

```typescript
import type { ModelSpeedTestResult } from '@tagent/shared'

/** 测速结果缓存（session-only，不持久化），key 为 "{channelId}:{modelId}" */
export const speedTestResultsAtom = atom<Record<string, ModelSpeedTestResult>>({})

/** 测速是否正在进行 */
export const speedTestRunningAtom = atom(false)
```

### 5.5 UI 组件

#### `SpeedTestBadge.tsx`（新建）

**文件**: `apps/electron/src/renderer/components/settings/SpeedTestBadge.tsx`

功能：延迟指示 pill badge

渲染逻辑：
```
success + ttfbMs < 800   → 绿底绿字 "XXXms"
success + ttfbMs < 2000  → 黄底黄字 "XXXms" 或 "X.Xs"
success + ttfbMs >= 2000 → 红底红字 "X.Xs"
!success                  → 红底红字 "超时"
```

#### `SpeedTestPopover.tsx`（新建）

**文件**: `apps/electron/src/renderer/components/settings/SpeedTestPopover.tsx`

功能：测速触发 UI — Popover 内让用户勾选模型，触发测速，显示结果

组件结构：
- 触发按钮：`size-[36px] rounded-full variant="ghost"` + Gauge 图标
- Popover 内容：
  - 标题行：`text-xs font-medium text-foreground/80` + 全选按钮
  - 渠道分组列表（Checkbox + 模型名，缩进排列）
  - 底部操作行：开始测速按钮 + 进度提示

状态管理：
- 内部维护选中状态（`Set<string>`，key 为 `{channelId}:{modelId}`）
- 调用 `window.electronAPI.speedTestModels(input)` 触发测速
- 写入 `speedTestResultsAtom` 和 `speedTestRunningAtom`

#### `ChannelSettings.tsx`（修改）

1. 引入 `speedTestResultsAtom`, `speedTestRunningAtom`
2. SettingsSection action 区域集成 `SpeedTestPopover`
3. 将测速结果按渠道过滤后传给 `ChannelRow`
4. ChannelRow 描述行下方展示模型延迟标签行

#### `ChannelRow`（修改）

1. Props 扩展：增加 `speedTestResults?: Record<string, ModelSpeedTestResult>`
2. 描述行下方新增延迟标签行：遍历已启用模型，有测速结果的显示 SpeedTestBadge
3. 测速进行中且无结果时显示脉冲点动画

## 6. 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `packages/shared/src/types/channel.ts` | 修改 | 新增 `ModelSpeedTestResult`, `SpeedTestInput`, `SpeedTestBatchResult`, `SPEED_TEST` 常量 |
| `apps/electron/src/main/lib/channel-manager.ts` | 修改 | 新增 `speedTestModels()`, `speedTestOneModel()`, 3 个 `speedTest*Model()` 函数 |
| `apps/electron/src/main/ipc.ts` | 修改 | 注册 `SPEED_TEST` handler，增加 import |
| `apps/electron/src/preload/index.ts` | 修改 | 类型声明 + 实现桥接 |
| `apps/electron/src/renderer/atoms/model-atoms.ts` | 修改 | 新增 `speedTestResultsAtom`, `speedTestRunningAtom` |
| `apps/electron/src/renderer/components/settings/SpeedTestBadge.tsx` | 新建 | 延迟 pill badge 组件 |
| `apps/electron/src/renderer/components/settings/SpeedTestPopover.tsx` | 新建 | 模型选择 + 触发测速的 Popover |
| `apps/electron/src/renderer/components/settings/ChannelSettings.tsx` | 修改 | 集成 SpeedTestPopover，传递结果给 ChannelRow |

## 7. 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| 并发请求触发 rate limit | `max_tokens: 1` 消耗几乎为零 token，rate limit 通常按 token 计而非请求数 |
| 同渠道多模型重复解密 API Key | 按渠道分组共享解密结果，避免同一渠道多次调用 `decryptKey()` |
| 超时后连接未释放 | `AbortSignal.timeout()` 会自动 abort 底层请求，连接被释放 |
| 延迟数据随时间失效 | Session-only 存储，关闭应用自动清除，用户可随时重新测速 |
| Popover 中模型列表过长 | 已禁用的渠道和模型不显示，列表通常 < 20 项；可考虑加 max-height + scroll |

## 8. 验证方案

1. **类型检查**: `bun run typecheck` 全部通过
2. **手动测试**: 启动 `bun run dev`，进入设置页渠道配置
   - 点击测速按钮 → Popover 弹出
   - 勾选部分模型 → 点击"开始测速"
   - 观察进度和延迟 pill 逐个出现
   - 验证颜色分级：绿/黄/红
   - 超时场景（断网或无效 key）→ 红色"超时"
   - 0 个已选模型 → "开始测速" disabled
   - 关闭 Popover 后重新打开 → 已有结果保留
3. **边界测试**:
   - 跨渠道多模型并发 → 全部并发，互不阻塞
   - 同渠道多模型 → 共享解密 key，不重复解密
   - 10 秒超时 → 返回 `ttfbMs: null`
   - kscc-internal 渠道 → 正常测速
4. **单元测试**（BDD 风格）: 在 `channel-manager.test.ts` 中新增 `describe('speedTestModels')` 块

---

## 9. 输出速度测速（tok/s）扩展

> 追加日期：2026-07-01
> 动机：TTFB 只测首字延迟，不测模型推理速度。用户遇到"长输出卡顿"时 TTFB 正常但整体耗时几分钟，无法判断是网络慢还是模型慢。

### 9.1 两个维度互补

| 指标 | 含义 | 数据来源 | 现有方案 |
|------|------|----------|----------|
| **TTFB** | 首字多久出现（网络 + 排队） | POST `max_tokens:1` | 已设计（第 1-8 节） |
| **tok/s** | 模型生成多快（推理能力） | `result.usage.output_tokens / _durationMs` | **本章新增** |

实测数据（会话 bb9e65d1）：
- glm-5.2：~15 tok/s（3432 token / 228.8s）
- Claude Sonnet：~60-80 tok/s（业界基准）
- 同样 3000 token 输出，glm-5.2 要 3.8 分钟，Claude 只要 40 秒

### 9.2 输出速度等级

| 等级 | tok/s 范围 | 颜色 | 含义 |
|------|-----------|------|------|
| 快 | > 60 tok/s | 绿 `emerald-600` / `emerald-400` | Claude / GPT-4o 级别 |
| 中 | 30–60 tok/s | 黄 `amber-500` / `amber-400` | 主流模型 |
| 慢 | < 30 tok/s | 红 `red-500` / `red-400` | glm-5.2 等慢模型 |
| 无数据 | 未采集 | 灰 `muted-foreground` | 首次使用 |

阈值依据：
- Claude Sonnet 4.x：60-80 tok/s
- GPT-4o：50-70 tok/s
- DeepSeek V3：40-60 tok/s
- glm-5.2 实测：15 tok/s（本会话数据，2026-07-01）

### 9.3 实现方案：被动采集优先

**方案 A（推荐）：被动采集**

不额外发测速请求，从用户实际使用中采集 `result.usage`：

```
duration_s = result._durationMs / 1000
tok_per_sec = result.usage.output_tokens / duration_s
```

数据源：`agent-orchestrator.ts` 的 `persistSDKMessages`（第 1139 行）已持久化 result 消息含 `usage` 和 `_durationMs`。

**采集点**：在 orchestrator 消费 result 消息时，按 `{channelId}:{modelId}` 更新统计。

优势：
- 不额外消耗 token
- 反映真实使用场景（含上下文长度影响）
- 数据随使用自然积累

劣势：
- 首次使用无数据（需 fallback 到主动测速或显示"无数据"）

**方案 B（补充）：主动测速**

扩展现有 TTFB 测速，对用户选中的模型额外发一轮 `max_tokens:100` 请求：

```typescript
// 速度测速请求体（与 TTFB 测速共用 URL/headers，只改 max_tokens）
{
  ...validateBody,
  max_tokens: 100,  // 而非 1
}
// 计时
const ttfbStart = performance.now()
const resp = await fetchFn(...)
const ttfbMs = performance.now() - ttfbStart
await resp.text()
const totalMs = performance.now() - t0
// 纯生成速度 = 100 / ((totalMs - ttfbMs) / 1000)
const outputTokPerSec = 100 / ((totalMs - ttfbMs) / 1000)
```

优势：首次使用即有数据
劣势：消耗 ~100 token/模型（成本极低，可接受）

### 9.4 类型扩展

`packages/shared/src/types/channel.ts`：

```typescript
export interface ModelSpeedTestResult {
  channelId: string
  modelId: string
  success: boolean
  ttfbMs: number | null                  // 已有：首字延迟
  totalTimeMs: number | null              // 已有：总耗时
  outputTokPerSec: number | null          // 新增：输出速度（主动测速）
  message: string
}

/** 被动采集的模型统计（持久化） */
export interface ModelRuntimeStats {
  tokPerSecAvg: number                    // 滑动平均
  tokPerSecSamples: number                // 采样次数
  lastTtfbMs: number | null              // 最近一次 TTFB（来自实际请求）
  lastUpdated: number                    // timestamp
}
```

### 9.5 被动采集实现

**采集点**：`agent-orchestrator.ts` 消费 result 消息处（约第 2400 行附近，`msg.type === 'result'` 分支）。

```typescript
// 伪代码
if (msg.type === 'result' && msg.usage?.output_tokens && msg._durationMs) {
  const tokPerSec = msg.usage.output_tokens / (msg._durationMs / 1000)
  const key = `${channelId}:${modelId}`
  updateModelRuntimeStats(key, tokPerSec)
}
```

**存储**：`settings.json` 的 `modelStats` 字段（持久化，跨会话积累）。

```typescript
// settings.json
{
  modelStats: {
    "kscc:glm-5.2": {
      tokPerSecAvg: 15.2,
      tokPerSecSamples: 5,
      lastTtfbMs: 1733,
      lastUpdated: 1782906240000
    }
  }
}
```

**滑动平均**：新样本与旧平均按 `0.3 * new + 0.7 * old` 加权，避免单次异常拉偏。

### 9.6 UI 展示升级

渠道列表延迟 pill 升级为双指标：

```
[287ms · 65 tok/s]   ← TTFB + 输出速度，两者都有
[1.3s · 慢]          ← 只有 TTFB，tok/s 标红
[287ms · —]          ← 只有 TTFB，tok/s 未采集
```

- TTFB 部分用 ms/s 展示（已有逻辑）
- tok/s 部分用数字 + "tok/s"，无数据时显示 "—"
- pill 整体颜色取 TTFB 和 tok/s 较慢者

**Popover 内**：测速结果区每个模型显示两行：
```
claude-sonnet-4-6   [287ms · 65 tok/s]
glm-5.2             [1.7s · 15 tok/s]
```

### 9.7 实施优先级

1. **P1 被动采集**（零成本）：在 orchestrator 加采集点，写 settings.json，UI 先显示 tok/s
2. **P2 主动测速**：TTFB 测速落地后，扩展为双轮（`max_tokens:1` + `max_tokens:100`）
3. **P3 UI 双指标**：pill 展示 TTFB + tok/s

### 9.8 验证方案

1. 发几轮真实请求，确认 `settings.json` 的 `modelStats` 被更新
2. 滑动平均正确（手动算 vs 存储）
3. 渠道列表 pill 显示 tok/s
4. 无数据时显示 "—" 而非 0
5. 主动测速可选开关，默认关（避免额外消耗）

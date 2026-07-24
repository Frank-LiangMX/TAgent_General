# Xfast 模式设计文档

> **状态**：Proposed
> **日期**：2026-07-24
> **目标**：为 TAgent 引入 Xfast 模式，通过智能模型调度，高峰期自动选最快模型，提升用户响应体验。
> **关联**：
> - `docs/plans/2026-07-24-kscc-bare-vs-resume-benchmark.md`（bare vs resume 实测）
> - `docs/plans/2026-07-24-xfast-mode-benchmark.md`（Xfast 量化数据）
> - `docs/plans/2026-07-18-agent-runtime-dual-core-pi-migration.md`（Pi 迁移路线）
> **分支建议**：`feature/xfast-mode`

---

## 0. Handoff 摘要

**你要做什么**：实现 Xfast 模式，让用户在高峰期获得更快响应，代价是略高的 token 消耗。

**已验证的结论**：
1. bare 比 resume 快 3-5 倍（CLI 注入差异）
2. 圆桌模式（竞争调度）在高峰期更快（避免排队）
3. 圆桌模式 token 消耗略高（1.2-1.5×/轮）
4. 锁定机制有缺陷（无法适应实时变化）

**核心机制**：首轮竞争 + 心跳检测 + 定期刷新

---

## 1. 背景与问题

### 1.1 现状

用户在 kscc 渠道使用 TAgent Agent 模式：
- 默认指定模型（如 glm-5.2）
- 高峰期模型排队，响应慢
- 用户宁可等待，也不选"弱"模型（心理）

### 1.2 用户观察

> "很多人不用 kscc 的原因就是太慢。并且这些人看到模型池，永远只会用最强的模型，哪怕是简单任务。"

### 1.3 核心矛盾

```
用户心理：选最强的 → 但最强的排队 → 太慢 → 不用
真实需求：快速响应，任务完成
```

### 1.4 解决方案

**Xfast 模式**：黑盒调度，用户不知道用了什么模型，只知道"更快"。

```
用户看到：
🚀 Xfast 模式
⚡ 高峰期响应更快
💰 token 消耗略高

用户不知道：
├── 系统会根据实时负载选模型
├── 简单任务可能走 kimi（快）
├── 复杂任务可能走 glm-5.2（准）
└── 高峰期自动避开排队模型
```

---

## 2. 决策

### 2.1 模型池

| 模型 | 定位 | 预期速度 |
|------|------|---------|
| glm-5.2 | 最强，复杂任务 | 基准（2.7s） |
| glm-5.1 | 强，复杂任务 | 略快于 5.2 |
| kimi-2.6 | 中等，简单任务 | 约 6s |
| kimi-2.5 | 中等，简单任务 | 约 8.5s |
| mimo-2.5-pro | 中等，简单任务 | 约 6s |
| mimo-2.5 | 中等，简单任务 | 约 6s |

### 2.2 调度策略：混合方案

```
┌─────────────────────────────────────────────────┐
│ Xfast 调度流程                                    │
├─────────────────────────────────────────────────┤
│ 1. 首轮：完整竞争（3 模型）                       │
│    → 选最快模型，记录性能                          │
│                                                   │
│ 2. 心跳：每 5 分钟测延迟（极低 token）             │
│    → 如果当前模型延迟突增，触发刷新                 │
│                                                   │
│ 3. 刷新：每 10 轮重新竞争（3× token）             │
│    → 适应实时变化                                  │
│                                                   │
│ 4. 选择逻辑：                                     │
│    ├─ 心跳显示延迟突增 → 立即重新竞争              │
│    ├─ 10 轮到了 → 重新竞争                        │
│    └─ 否则 → 锁定当前模型                         │
└─────────────────────────────────────────────────┘
```

### 2.3 token 消耗预期

| 场景 | 平均 token 消耗 | 说明 |
|------|----------------|------|
| 首轮 | 3× | 竞争开销 |
| 锁定轮 | 1× | 无竞争 |
| 刷新轮 | 3× | 重新竞争 |
| **10 轮平均** | **1.2-1.5×** | 可接受 |

### 2.4 速度预期

| 场景 | Xfast | 指定模型 | 差异 |
|------|-------|---------|------|
| glm 不排队 | 2.7s | 2.7s | 持平 |
| glm 排队 10s | 8.5s（kimi 赢） | 12.7s | **快 4.2s** |
| glm 排队 30s | 8.5s（kimi 赢） | 32.7s | **快 24.2s** |

**核心价值：高峰期响应更快。**

---

## 3. 存储设计

### 3.1 性能历史文件

**路径**：`~/.tagent/model-performance.json`

**结构**：
```typescript
interface ModelPerformance {
  [modelId: string]: {
    [timeSlot: string]: {  // "09:00-09:30"
      avgLatencyMs: number
      samples: number
      lastUpdated: string  // ISO timestamp
    }
  }
}
```

**示例**：
```json
{
  "glm-5.2": {
    "09:00-09:30": {"avgLatencyMs": 2700, "samples": 15, "lastUpdated": "2026-07-24T09:30:00Z"},
    "09:30-10:00": {"avgLatencyMs": 8500, "samples": 23, "lastUpdated": "2026-07-24T10:00:00Z"}
  },
  "kimi-2.5": {
    "09:00-09:30": {"avgLatencyMs": 8200, "samples": 12, "lastUpdated": "2026-07-24T09:30:00Z"},
    "09:30-10:00": {"avgLatencyMs": 6100, "samples": 18, "lastUpdated": "2026-07-24T10:00:00Z"}
  }
}
```

### 3.2 路径函数

在 `config-paths.ts` 新增：
```typescript
export function getModelPerformancePath(): string {
  return join(getConfigDir(), 'model-performance.json')
}
```

---

## 4. 实现设计

### 4.1 新建文件

| 文件 | 职责 |
|------|------|
| `apps/electron/src/main/lib/xfast-router.ts` | Xfast 调度逻辑（竞争、心跳、刷新） |
| `apps/electron/src/main/lib/model-performance-service.ts` | 性能历史读写 |
| `packages/shared/src/types/xfast.ts` | Xfast 相关类型定义 |

### 4.2 核心函数

**xfast-router.ts**：
```typescript
// Xfast 调度入口
export async function xfastRoute(prompt: string, options: XfastOptions): Promise<XfastResult>

// 竞争调度（多模型同时调用）
async function competitiveRoute(prompt: string, models: string[]): Promise<XfastResult>

// 心跳检测（极短请求测延迟）
async function heartbeatCheck(models: string[]): Promise<ModelLatency[]>

// 选择模型（基于历史数据预测）
function selectModelByHistory(history: ModelPerformance, timeSlot: string): string
```

**model-performance-service.ts**：
```typescript
// 读取性能历史
export async function getModelPerformance(): Promise<ModelPerformance>

// 记录性能数据
export async function recordModelPerformance(modelId: string, latencyMs: number): Promise<void>

// 获取当前时间段
export function getCurrentTimeSlot(): string  // "09:00-09:30"
```

### 4.3 调度流程

```typescript
export async function xfastRoute(prompt: string, options: XfastOptions): Promise<XfastResult> {
  const { modelPool, lastModel, roundsSinceRefresh } = options

  // 1. 心跳检测（每 5 分钟）
  if (shouldHeartbeat()) {
    const latencies = await heartbeatCheck(modelPool)
    if (latencies.find(l => l.model === lastModel && l.latency > THRESHOLD)) {
      // 当前模型延迟突增，触发刷新
      return await competitiveRoute(prompt, modelPool)
    }
  }

  // 2. 定期刷新（每 10 轮）
  if (roundsSinceRefresh >= 10) {
    return await competitiveRoute(prompt, modelPool)
  }

  // 3. 锁定当前模型
  if (lastModel) {
    return await singleRoute(prompt, lastModel)
  }

  // 4. 首轮竞争
  return await competitiveRoute(prompt, modelPool)
}
```

### 4.4 竞争调度

```typescript
async function competitiveRoute(prompt: string, models: string[]): Promise<XfastResult> {
  const startTime = Date.now()

  // 并行调用所有模型（bare 模式）
  const results = await Promise.race(
    models.map(async model => {
      const result = await ksccBare(model, prompt)
      return { model, result, latency: Date.now() - startTime }
    })
  )

  // 记录性能
  await recordModelPerformance(results.model, results.latency)

  // 记录其他模型的延迟（如果它们也返回了）
  // ...

  return {
    model: results.model,
    result: results.result,
    latency: results.latency,
    isCompetitive: true
  }
}
```

---

## 5. 用户界面

### 5.1 设置页

```
┌─────────────────────────────────────────────┐
│  模式选择                                    │
│                                             │
│  ○ 标准模式（默认）                          │
│     指定模型，稳定可靠                       │
│                                             │
│  ● 🚀 Xfast 模式                            │
│     ⚡ 高峰期响应更快                        │
│     💰 token 消耗略高（约 1.2-1.5×）         │
│     ✨ 智能优化，无需配置                     │
└─────────────────────────────────────────────┘
```

### 5.2 对话界面

```
┌─────────────────────────────────────────────┐
│  模型：🚀 Xfast（自动选择）                   │
│  当前：glm-5.2                               │
│  延迟：2.7s                                  │
│  [切换到标准模式]                             │
└─────────────────────────────────────────────┘
```

### 5.3 营销话术

**要说**：
```
🚀 Xfast 模式
⚡ 高峰期响应更快
💰 token 消耗略高
✨ 智能优化，无需配置
```

**不要说**：
- "用了 kimi/mimo"（用户抗拒）
- "砍掉了 CLI 注入"（技术细节）
- "圆桌竞争"（用户不理解）

---

## 6. 验收标准

### 6.1 功能验收

- [ ] 设置页可切换 Xfast 模式
- [ ] Xfast 模式下，系统自动选模型（不显示给用户）
- [ ] 首轮竞争正常工作（多模型同时调用）
- [ ] 心跳检测正常工作（每 5 分钟）
- [ ] 定期刷新正常工作（每 10 轮）
- [ ] 性能历史正常记录（`model-performance.json`）

### 6.2 性能验收

- [ ] 高峰期（模拟）Xfast 比指定模型更快
- [ ] 非高峰期 Xfast 与指定模型持平
- [ ] token 消耗平均不超过 1.5×/轮

### 6.3 体验验收

- [ ] 用户无需配置，开启即用
- [ ] 对话界面显示当前使用的模型（可选）
- [ ] 用户可随时切换回标准模式

---

## 7. 测试策略

### 7.1 单元测试

- `xfast-router.ts`：竞争调度、心跳检测、模型选择逻辑
- `model-performance-service.ts`：性能历史读写、时间段计算

### 7.2 集成测试

- 模拟高峰期（延迟注入），验证 Xfast 自动选更快模型
- 模拟模型恢复，验证 Xfast 自动切回

### 7.3 手工测试

- 真实高峰期（多人同时使用），验证响应时间提升
- 收集用户反馈

---

## 8. 开放问题

1. **模型池配置**：硬编码还是可配置？
   - 建议：可配置（`settings.json` 的 `xfast.modelPool`）

2. **竞争模型数量**：全池竞争还是选 3 个？
   - 建议：选 3 个（减少 token 消耗）

3. **心跳间隔**：5 分钟是否合适？
   - 建议：可配置，默认 5 分钟

4. **刷新间隔**：10 轮是否合适？
   - 建议：可配置，默认 10 轮

5. **任务复杂度路由**：是否需要？
   - 建议：2.0 不做，先验证竞争调度
   - 后续可加入：简单任务直接走 kimi，复杂走 glm

6. **用户教育**：如何让用户理解 Xfast？
   - 建议：黑盒，只说"更快"，不说机制

---

## 9. 里程碑

| 里程碑 | 内容 | 退出标准 |
|--------|------|----------|
| M1 | 本文评审通过 | 方向锁定 |
| M2 | 性能存储 + 路径函数 | `model-performance.json` 可读写 |
| M3 | 竞争调度核心 | 多模型竞争，最快返回 |
| M4 | 心跳 + 刷新 | 实时适应变化 |
| M5 | 设置页 + UI | 用户可切换模式 |
| M6 | 集成测试 + 手工测试 | 功能验收通过 |
| M7 | 文档 + 发布 | 用户可使用 Xfast |

---

## 10. 附录：2.0 材质精简决策

### 10.1 决策内容

**保留**：
- ✅ 所有 13 个 ThemeStyle（default, ocean, forest, slate, orange, neumorph, purple）
- ✅ 默认材质（ThemeStyle 自带的颜色系统）
- ✅ light/dark/system 模式

**删除**：
- ❌ AdvancedMaterialMode（glass, frosted, soft）
- ❌ `[data-material]` 相关样式
- ❌ 设置页中的高级材质选择器

### 10.2 影响范围

| 区域 | 引用量 | 清理难度 |
|------|--------|---------|
| settings.ts 类型 | ~10 处 | 低 |
| AppearanceSettings.tsx | ~50 处 | 中 |
| glass.css | ~50 行 | 低 |
| 其他组件 | ~300 处 | 中-高 |
| **总计** | **436 处** | - |

### 10.3 清理工作包

| ID | 工作包 | 说明 |
|----|--------|------|
| C-1 | 删除类型定义 | `settings.ts` 中的 `AdvancedMaterialMode` 等 |
| C-2 | 删除设置 UI | `AppearanceSettings.tsx` 中的材质选择器 |
| C-3 | 删除 CSS | `glass.css` 中的 `[data-material]` 样式 |
| C-4 | 清理组件引用 | 删除各组件中的 `[data-material]` 判断 |
| C-5 | 验证 | typecheck + 视觉抽查 |

### 10.4 估计工作量

- **时间**：1-2 天
- **风险**：低（纯删除，不改逻辑）

---

## 12. 附录：MoA 借鉴设计（内部优化方向）

> 来源：`F:\hermes-agent` 的 Mixture of Agents 实现

### 12.1 MoA 是什么

**不是**传统 ML MoE（门控网络），**而是** Agent 层面的多模型协作：

```
用户问题
    ↓
┌─────────────────────────────────────┐
│ 参考模型 1 (GPT-5.5)    → 建议 A   │  ← 并行运行
│ 参考模型 2 (DeepSeek)   → 建议 B   │
│ 参考模型 3 (Claude)     → 建议 C   │
└─────────────────────────────────────┘
    ↓ 拼接为"私有指导"
┌─────────────────────────────────────┐
│ 聚合器 (Claude Opus)                │  ← 综合所有建议
│ → 最终决策 + 工具调用               │
└─────────────────────────────────────┘
```

### 12.2 基准测试结果

| 配置 | HermesBench 得分 |
|------|-----------------|
| 单一 Opus | 0.7607 |
| 单一 GPT-5.5 | 0.7412 |
| **MoA (Opus 聚合 + GPT-5.5 参考)** | **0.8202** |

**MoA 提升约 6 个百分点**。

### 12.3 与 Xfast 的关系

| 维度 | Xfast（竞争） | MoA（协作） |
|------|--------------|------------|
| **机制** | 多模型竞争，最快的赢 | 多模型建议，聚合器综合 |
| **速度** | 最快模型的速度 | 最慢参考模型的速度（并行） |
| **质量** | 取决于最快模型 | 所有模型视角，质量更高 |
| **token 消耗** | 约 3× | 约 N×（所有参考模型） |
| **适用场景** | 高峰期快速响应 | 需要高质量决策 |

**核心差异**：
- **Xfast**：用 token 换**速度**
- **MoA**：用 token 换**质量**

### 12.4 可借鉴的设计

#### (a) Fanout 策略（控制成本）

```yaml
fanout: user_turn      # 每用户轮次只运行一次参考模型（最便宜）
fanout: per_iteration  # 每次工具迭代都刷新参考
fanout: every_n:5      # 每 5 次工具迭代刷新一次
```

**借鉴**：Xfast 可以用类似策略控制竞争频率（首轮竞争 + 定期刷新）。

#### (b) Prompt Cache 保护

MoA 不破坏主对话的 prompt cache：
- 参考输出附加到消息末尾（不修改已有消息）
- Anthropic 缓存控制正确传播

**借鉴**：Xfast 竞争结果也应该保护 cache。

#### (c) 追踪持久化

MoA 保存完整 JSONL 追踪：每个模型看到的输入和产生的输出。

**借鉴**：Xfast 可以记录竞争过程，用于优化性能预测。

#### (d) 降级策略

某个参考模型失败不会中止轮次，失败信息被包含在上下文中继续。

**借鉴**：Xfast 竞争时某个模型失败，其他模型继续。

### 12.5 Xfast 内部优化方向

**不暴露给用户**，作为内部机制：

```
用户看到的：
├── 标准模式（默认）
└── 🚀 Xfast 模式（更快）

内部实现：
├── 简单任务 → Xfast 竞争（快）
├── 复杂任务 → Xfast 内部用 MoA（准）
└── 任务路由：自动判断，用户无感
```

**实现路径**：
1. 2.0：先实现 Xfast 竞争模式
2. 后续：在 Xfast 内部集成 MoA（复杂任务自动触发）

---

## 13. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-24 | 初稿：背景、决策、存储、实现、验收 |
| 2026-07-24 | 补充 §10：2.0 材质精简决策（保留主题，删除高级材质） |
| 2026-07-24 | 补充 §12：MoA 借鉴设计（内部优化方向，不暴露给用户） |

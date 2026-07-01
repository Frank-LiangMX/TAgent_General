# kscc 渠道首字延迟 / 长时间无输出根因分析

**日期**：2026-07-01
**类型**：根因分析 + 修复方向
**状态**：已定位根因，待修复
**相关会话**：`bb9e65d1-094c-4f34-8c84-03d2e2df7c8d`

## 1. 问题现象

用户反馈：kscc 渠道（glm-5.1 / mimo-v2.5 模型）偶发"长时间进行中、无输出"，首字延迟可达 7-8 分钟，期间 UI 只显示"进行中"，没有任何中间状态，体感像 Agent 卡住。

## 2. 根因结论

**不是流式输出问题，是 SDK 卡在 API 重试/网络等待，且 stderr 信号被吞没。**

- `includePartialMessages: false` → `true` 改流式**不能解决**此问题
- 7-8 分钟卡顿时模型根本没生成 token，没有 `content_block_delta` 可发
- SDK 卡住时的关键状态信号全在 stderr，但 stderr 只打到主进程控制台，UI 完全看不到

## 3. 真实数据复盘（bb9e65d1 会话）

### 3.1 时间线（19:37 那轮请求）

| 时间 | 事件 | 累计等待 |
|------|------|----------|
| 19:37:12 | 用户发消息 | 0 |
| 19:44:42 | 用户发"哦" | 7.5 分钟（0 输出） |
| 19:47:20 | 用户发"一直不输出" | 10 分钟（0 输出） |
| 19:50:21 | assistant 终于响应 | 13 分钟 |
| 19:50:21 | result success（dur=180450ms） | 13 分钟（SDK 只记 3 分钟） |

**关键矛盾**：用户体感等待 13 分钟，SDK `result.duration_ms` 只记 180 秒——中间 10 分钟是黑盒。

### 3.2 会话规模数据

```
会话文件: 4040 行 / 24M
Messages 历史: 362,675 tokens
当前轮 input: 250,994 tokens
最大单轮 input: 2,318,206 tokens（第 3391 行，远超 glm-5.1 的 200k 窗口）
Read 工具 result 累计: 1,573,912 tokens（1.5M！）
```

### 3.3 auto-compact 触发情况

```
compact_boundary 消息数: 6 次（最后一次在第 2488 行）
status=compacting 消息数: 0 次   ← 异常
autoCompactThreshold: 991,000（99%）
当前 totalTokens: 392,626（38%，远未到阈值）
```

**发现**：
1. SDK 端 auto-compact 阈值是 99.1 万 token（99%），当前会话 39 万（38%），**没到阈值所以没触发**
2. 第 2488 行那次 compact 把 input 从 ~150 万降到 7 万，效果明显
3. 但之后 input 一路涨到 230 万（第 3391 行），**没再次触发 compact**——说明 SDK auto-compact 在阈值判断上有盲区，或单轮涨幅过大导致直接 API 报错而非 compact
4. `status=compacting` 消息 0 次——SDK 压缩时没推送 UI 可见的状态

## 4. 为什么流式 / partial / thinking 都救不了

| 方案 | 能救 7-8 分钟卡顿吗 | 原因 |
|------|---------------------|------|
| `includePartialMessages: true` | ❌ | 卡顿时模型没生成 token，没 delta 可发 |
| `tool_progress` 推 UI | ❌ | 卡顿时没执行工具 |
| thinking 显示 | ❌ | thinking 期间 SDK 也不发消息 |
| **stderr 推 UI** | ✅ | API 重试/超时/限流日志全在 stderr |

## 5. kscc 实测数据（简单场景）

为排除"kscc 本身慢"，跑了最小 prompt 测试：

```bash
kscc -p "说一个字：好" --output-format=stream-json \
  --include-partial-messages --verbose \
  --dangerously-skip-permissions --model glm-5.1
```

**结果**：
- `ttft_ms: 1733`（首 token 1.7 秒）
- `duration_ms: 2096`（总耗时 2 秒）
- stderr：空

**结论**：简单场景首字很快，7-8 分钟卡顿是偶发，不是必然慢。卡顿只在**大 context + API 异常**时出现。

## 6. 现有代码的盲区

### 6.1 stderr 被吞（核心问题）

`apps/electron/src/main/lib/agent-orchestrator.ts:2202-2204`：

```typescript
onStderr: (data: string) => {
  stderrChunks.push(data)
  console.error(`[Agent SDK stderr] ${data}`)  // 只打到主进程控制台
}
```

SDK 卡住时 stderr 会有这些关键信号，但 UI 完全看不到：
- `Retrying after error...` — API 重试
- `overloaded` / `529` / `502` — 后端过载
- `fetch failed` / `socket hang up` — 网络问题
- `Rate limit exceeded` — 限流

### 6.2 auto-compact 配置未显式传入

`apps/electron/src/main/lib/adapters/claude-agent-adapter.ts` 的 `sdkOptions`（773 行附近）**未传** `autoCompactEnabled` / `autoCompactWindow`，依赖 CLI 默认 + `settingSources: ['user', 'project']`。

会话数据显示 `isAutoCompactEnabled: true` / `autoCompactThreshold: 991000`，说明默认开启。但：
- 阈值 99% 太高，会话常在 30-40% 就开始卡（因为单轮涨幅大）
- `status=compacting` 消息 0 次——SDK 压缩时 UI 无感知

### 6.3 大 context 单轮涨幅未预警

会话从 34 万（第 3771 行）涨到 230 万（第 3391 行），单轮涨幅近 7 倍。这种涨幅下：
- API 上传耗时长
- 容易触发 overload 重试
- auto-compact 阈值判断跟不上

UI 没有"单轮 input 涨幅过大"的预警。

## 7. 修复方向

### 7.1 P0：stderr 实时推到 UI（核心修复）

**改动范围**：2-3 个文件，1-2 小时

1. `agent-orchestrator.ts:2202` 的 `onStderr` 回调里，通过 `eventBus` 推一个 `agent:stderr` 事件
2. IPC 通道加 `AGENT_IPC_CHANNELS.STDERR_LOG`（或复用现有 stream event）
3. UI 加"SDK 日志"小窗（折叠态，有内容时高亮），展示最近 N 条 stderr
4. 过滤敏感信息（API key 等）

**效果**：用户能看到"API 繁忙，正在重试（第 3 次）"，而不是干等。

### 7.2 P1：auto-compact 主动配置

**改动范围**：1 个文件，30 分钟

`claude-agent-adapter.ts:773` 附近显式传入：

```typescript
autoCompactEnabled: true,
autoCompactWindow: 0.7,  // 70% 触发，比默认 99% 早
```

**效果**：在会话还没卡死前就触发压缩，避免涨到 230 万 token。

### 7.3 P2：单轮涨幅预警

**改动范围**：`ContextUsageBadge` / `ContextUsagePanel`

当单轮 input 涨幅超过 context window 的 50% 时，UI 高亮提示"本轮 input 涨幅过大，建议 /compact"。

### 7.4 P3（可选）：partial 流式

只在 P0-P2 都做完后考虑。且只对"模型已生成但等整条消息才显示"的秒级场景有效，对分钟级卡顿无效。

## 8. 验证方法

修复后，复现"7-8 分钟卡顿"场景：

1. 跑一个长会话（input > 20 万 token）
2. 发一个会触发 API overload 的请求
3. 观察 UI 是否显示 stderr 重试日志
4. 观察 auto-compact 是否在 70% 触发

## 9. 相关文件

- `apps/electron/src/main/lib/agent-orchestrator.ts:2202` — stderr 回调（核心修复点）
- `apps/electron/src/main/lib/agent-orchestrator.ts:837-883` — compact_session 工具注入
- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts:773` — includePartialMessages / autoCompact 配置
- `apps/electron/src/main/lib/agent-session-compactor.ts` — 客户端压缩兜底
- `apps/electron/src/renderer/components/agent/ContextUsageBadge.tsx` — context 圆环 UI
- `apps/electron/src/renderer/components/agent/SDKMessageRenderer.tsx:493` — 渲染性能注释（流式相关）
- `docs/plans/2026-06-13-context-compaction-architecture.md` — 压缩架构设计文档

## 10. 给用户的即时建议

在修复落地前，遇到卡顿时：

1. **打开主进程控制台**（`bun run dev` 的终端，或打包版的日志文件），找 `[Agent SDK stderr]` 开头的日志
2. **手动 `/compact`**——当前会话已 39 万 token，建议先压一下
3. **新开会话**处理新主题，避免单会话无限增长

## 10.5 修正：partial 流式对部分场景有效（2026-07-01 21:35 更新）

**背景**：用户反馈同一会话 21:31 又出现长时间首字延迟。数据分析后发现，这次和 19:37 那轮根因不同，**partial 流式对这次有效**。

### 两轮对比

| 维度 | 19:37 那轮 | 21:31 那轮 |
|------|-----------|-----------|
| 用户感知等待 | 13 分钟 | 3.8 分钟 |
| SDK dur | 180 秒（3 分钟） | 229 秒（3.8 分钟） |
| **dur vs 等待** | 差 10 分钟黑盒 | 几乎一致 |
| cache_read | 384（几乎没命中） | 2,773,824（命中 277 万） |
| output_tokens | 1,285 | 3,432 |
| 生成速度 | — | 15 tok/s（3432÷228.8s ≈ dur） |
| 根因 | API 重试/网络黑盒 | 模型实打实在生成 |
| partial 能救吗 | ❌ 黑盒期没生成 | ✅ 能逐字显示 |
| stderr 能救吗 | ✅ 重试日志在 stderr | ⚠️ 可能没有 |

### 判断方法

看 `result._durationMs` 和用户感知等待是否一致：

- **dur << 等待**（如 3 分钟 vs 13 分钟）→ API 重试黑盒 → **stderr 有用，partial 无用**
- **dur ≈ 等待**（如 3.8 分钟 vs 3.8 分钟）→ 模型在生成 → **partial 有用，stderr 可能无用**

### 修正后的方案优先级

| 优先级 | 方案 | 适用场景 | 工作量 |
|--------|------|----------|--------|
| **P0a** | stderr 推 UI | API 重试黑盒（19:37 型） | 2-3 文件，1-2 小时 |
| **P0b** | partial 流式 | 模型在生成但没流式（21:31 型） | 4 处改动，半天 |
| P1 | autoCompactWindow 0.7 | 预防 context 涨爆 | 30 分钟 |
| P2 | 单轮涨幅预警 | 预防 input 暴涨 | — |

**P0a 和 P0b 互补，都要做**。只做 partial 救不了 19:37 那种 API 重试；只做 stderr 救不了 21:31 这种模型在生成但没流式。

### 21:31 那轮的额外发现

- **cache_read 命中 277 万 token**——说明之前轮次已建立缓存，但 input 40 万仍要上传
- **output 3432 token 按 15 tok/s 生成**——glm-5.2 输出速度比 Claude 慢（Claude ~60 tok/s）
- 3.8 分钟里模型没闲着，纯生成时间

**推论**：glm-5.2 的 15 tok/s 输出速度下，长输出（3000+ token）必然要几分钟。partial 流式能把这几分钟从"干等"变成"逐字看"，体感提升巨大。

---

## 12. 最终结论（2026-07-01 21:35 修正）

**两种卡顿场景，两个方案，都要做**：

1. **stderr 推 UI（P0a）**——救 API 重试黑盒（dur << 等待的场景）
2. **partial 流式（P0b）**——救模型在生成但没流式（dur ≈ 等待的场景）

判断用哪种：对比 `result._durationMs` 和用户感知等待时间。

**之前的"partial 是伪命题"结论作废**——那只对 API 重试黑盒场景成立，对模型在生成场景 partial 有效。

## 13. 业界长会话卡顿解决方案对比

> 用户反馈：用户惯性在单会话对话，但并非真需要全部历史发给模型。业界如何解决？

### 13.1 方案总览

| 方案 | 代表产品 | TAgent 现状 | 工作量 | 推荐度 |
|------|----------|-------------|--------|--------|
| A 自动 compact | Claude Code 80% | 99% 阈值过高 | 30 分钟 | ⭐⭐⭐⭐⭐ |
| B SubAgent 委派 | Claude Code Task 工具 | 已有但 Agent 不主动用 | 3 小时 | ⭐⭐⭐⭐⭐ |
| C 渐进式 compact | Cursor 渐进摘要 | 依赖用户主动 | 半天 | ⭐⭐⭐⭐ |
| D fork 分代会话 | ChatGPT 自动开新 | forkSession 已暴露 | 半天 | ⭐⭐⭐⭐ |
| E 检索增强 RAG | Cursor codebase index | 无 | 2 周+ | ⭐⭐（过度设计） |

### 13.2 方案 A：降 auto-compact 阈值（P1，立竿见影）

**现状**：`autoCompactThreshold: 991,000`（99%），会话常在 30-40% 就开始卡（因单轮涨幅大）。

**业界**：Claude Code 默认 ~80%（`context-window.ts:75` 注释提到 ~77.5%）。

**改动**：`claude-agent-adapter.ts:773` 附近显式传入：
```typescript
autoCompactEnabled: true,
autoCompactWindow: 0.7,  // 70% 触发
```

**风险**：阈值低了可能频繁压缩，打断长任务。建议 70% 而非 50%。

### 13.3 方案 B：SubAgent 主动委派（P2，改变 Agent 行为）

**用户原话**："SubAgent 既然存在，Agent 自然要学会去使用，不能什么都在主线程完成的。"

**现状问题**：
- 主 Agent 习惯自己干所有事（Read/Edit/Bash 全在主会话）
- SubAgent（Task 工具）很少被主动调用
- 工具结果全堆在主会话 context，越滚越大

**业界**：Claude Code 的 Task 工具会主动把独立子任务委派给子 Agent，子 Agent 用全新 context 完成后只返回摘要，不污染主会话。

**改进方向**：

1. **system prompt 引导**（`agent-prompt-builder.ts`）：
   - 遇到独立子任务（如"搜索 X"、"分析 Y 文件"、"实现 Z 功能"）时，主动用 Task 工具委派
   - 主会话只做协调和决策，不做具体执行
   - 参考本工程 CLAUDE.md 的 SubAgent 派发策略（已有完整规范）

2. **长会话检测提示**：
   - 主会话 context > 15 万 token 时，UI 提示"建议用 SubAgent 处理后续独立子任务"
   - 或在 Agent 系统提示里注入"当前会话已较长，优先用 SubAgent 处理独立任务"

3. **SubAgent 结果隔离**：
   - 子 Agent 完成后只返回文本摘要，不返回完整工具结果
   - SDK 默认 `forwardSubagentText: false`，已天然隔离

**关键**：不是让用户手动调 SubAgent，而是让 Agent 自己学会用。这是 prompt engineering 问题，不是架构问题。

### 13.4 方案 C：渐进式 compact（P2，预防涨爆）

**现状**：只有 99% 自动 compact 和用户手动 `/compact`，中间无预警。

**业界**：Cursor 在 30% 就开始摘要最旧消息，渐进压缩。

**改动**：

| context 占比 | 行为 |
|--------------|------|
| < 50% | 正常 |
| 50% | UI 黄色提示"建议 compact" |
| 70% | 自动 compact（SDK 触发） |
| 90% | 红色警告 + 拦截发送，强制 compact 或 fork |

**实现**：
- 50% 提示：`ContextUsageBadge` 加黄色态 + toast
- 70% 自动：`autoCompactWindow: 0.7`
- 90% 拦截：`agent-orchestrator.ts` 发送前检查 context 占比，超 90% 时返回提示而非发请求

### 13.5 方案 D：fork 分代会话（P3，优雅开新）

**现状**：`forkSession` SDK 选项已暴露（`claude-agent-adapter.ts:815`）但未用。

**业界**：ChatGPT 自动起标题开新会话；Claude Code `--fork-session` 从某点分叉。

**改动**：
- UI 加"基于当前会话开新话题"按钮
- 点击后 fork 当前会话（继承历史摘要，但新 sdkSessionId）
- 老会话变只读归档，新会话从摘要继续

**适用**：用户想换主题但不想丢上下文时。

### 13.6 方案 E：RAG 检索增强（不推荐）

把老消息存向量库，按当前问题检索相关片段。

**不推荐原因**：
- 工作量大（2 周+）
- 对桌面应用过重
- SubAgent 方案已能解决 80% 场景
- 用户场景是"惯性长会话"而非"需要检索历史"，RAG 解决的是另一个问题

### 13.7 推荐实施顺序

**短期（本周）**：
1. P0a stderr 推 UI（救 API 重试黑盒）
2. P0b partial 流式（救模型在生成没流式）
3. P1 降 `autoCompactWindow` 到 0.7（方案 A，防涨爆）

**中期（下周）**：
4. P2 SubAgent 引导（方案 B，改 prompt + 长会话提示）
5. P2 渐进式 compact（方案 C，50%/70%/90% 三级）
6. 测速文档 tok/s 被动采集（见 `2026-06-26-speed-test-design.md` 第 9 节）

**长期**：
7. P3 fork 按钮（方案 D）
8. P3 主动 tok/s 测速

### 13.8 核心洞察

用户说"可能就是惯性一直在一个会话对话"——这是真实需求，不应强迫用户开新会话。

**正确思路**：
- 不惩罚长会话用户，而是让长会话"自动瘦身"
- Agent 主动用 SubAgent，减少主会话堆积
- compact 阈值提前，预防而非救火
- tok/s 数据让用户预判"这次要等几分钟"

**错误思路**：
- 强制限制会话长度
- 让用户手动管理 context
- 加 RAG 等重型基础设施

TAgent 已有的 SubAgent + compact + fork 能力足以覆盖，缺的是**触发机制和 Agent 行为引导**。

## 11. 模型切换时的 context 压缩问题（待定）

**状态**：待定，后续讨论

### 11.1 问题

同渠道内切换模型时（如 kscc 渠道 glm-5.2 ↔ glm-5.1），两个模型的 contextWindow 差异巨大：

| 模型 | contextWindow | 来源 |
|------|---------------|------|
| glm-5.2 | 1,000,000（1M） | `context-window.ts:23` `supports1MContext` |
| glm-5.1 | 128,000（128K） | `context-window.ts:56` fallback |
| mimo-v2.5-pro | 1,000,000（1M） | 同 1M 档 |

**大→小切换（高危）**：glm-5.2 → glm-5.1 时，若当前会话 context 已超 128K（如本会话 39 万 token），切换后第一轮请求必然 `prompt_too_long` 报错。

**当前代码行为**（`agent-orchestrator.ts:1401-1411`）：同渠道切模型**不清** `sdkSessionId`，SDK 尝试 resume 旧 session，触发：
1. `prompt_too_long` 错误（context 超窗口）
2. thinking signature 不兼容错误（有自动恢复，但多一轮 API 调用）

### 11.2 待讨论的开放问题

1. **触发时机**：切换瞬间自动压缩？还是 UI 提示用户手动 `/compact`？还是检测超阈值时拦截切换？
2. **判断标准**：比较当前 `totalTokens` 与目标模型 `contextWindow`，超多少需要压？（如超 70%？超 100%？）
3. **压缩目标**：压到目标窗口的多少？（50%？70%？）用 SDK `/compact` 还是客户端 `compact_session`？
4. **小→大切换**：是否需要处理？（容量够，但 thinking signature 仍可能不兼容）
5. **UI 提示**：ContextUsageBadge / 模型选择器是否要在切换时预警"当前 context 超目标模型窗口，建议先压缩"？
6. **SDK 内部阈值不一致**：`context-window.ts:75` 注释提到 SDK 内部压缩阈值可能按 200K 运行，UI 显示 1M，切换后更乱——是否需要对齐？

### 11.3 相关代码位置

- `apps/electron/src/main/lib/agent-orchestrator.ts:1401-1411` — 渠道切换清 sdkSessionId，模型切换不清
- `apps/electron/src/main/lib/agent-orchestrator.ts:2453-2475` — thinking signature 不兼容自动恢复
- `packages/shared/src/utils/context-window.ts:22-23,56` — glm-5.2 / glm-5.1 容量判定
- `packages/shared/src/utils/context-window.ts:75` — SDK 内部阈值与 UI 显示不一致的注释
- `apps/electron/src/renderer/components/agent/AgentModelSelector.tsx:288-295` — 模型切换入口

### 11.4 暂行建议（修复落地前）

- 切模型前先 `/compact`，把 context 压到 10 万以内
- 不要在长会话中途频繁切换模型
- 大→小切换前尤其要压缩，否则第一轮必报错

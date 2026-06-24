# Context 压缩机制说明（SDK 原生 vs TAgent 兜底）

> **状态**：✅ Implemented（2026-06-14 三策略全部落地：drop_old_tool_results / keep_last_n / summarize）
> **日期**：2026-06-13（2026-06-24 状态字段更新）
> **关联设计**：[`2026-06-05-tagent-fusion-design.md`](2026-06-05-tagent-fusion-design.md) §8.4、[`2026-06-13-context-usage-breakdown-design.md`](2026-06-13-context-usage-breakdown-design.md)
> **路径**：`docs/plans/2026-06-13-context-compaction-architecture.md`

---

## 0. 摘要

TAgent Agent 会话的 context 压缩是 **双层结构**：

1. **主路径（Claude Agent SDK 原生）**：自动 compact + 用户 `/compact`，由 CLI 子进程用 LLM 摘要历史。
2. **兜底路径（TAgent 自研）**：`agent-session-compactor` 直接改写本地 JSONL，不调 LLM。

二者职责不同，**不可互相替代**。UI 上「手动压缩」走原生；「客户端压缩」仅作 SDK 失败或兼容端点场景的备胎。

---

## 1. 机制对照表

| 机制                        | SDK 原生？ | 入口                                | 实现位置                        | 是否调 LLM          |
| --------------------------- | ---------- | ----------------------------------- | ------------------------------- | ------------------- |
| 自动压缩                    | ✅         | context 接近上限                    | SDK/CLI 内部                    | ✅ 摘要             |
| 手动 `/compact`             | ✅         | `ContextUsageBadge` → 发 `/compact` | `AgentView` + orchestrator 透传 | ✅ 摘要             |
| `compact_boundary` 事件     | ✅（事件） | 流式消息                            | `useGlobalAgentListeners` → UI  | —                   |
| `compact_session` 工具      | ❌         | Agent 调 MCP `tagent-compactor`     | `agent-orchestrator` 注入       | 否（删块）          |
| 客户端压缩按钮              | ❌         | Popover「客户端压缩」               | IPC → `compactSession()`        | 否（删块）          |
| `buildContextPrompt` 截历史 | ❌         | 无 `resume` 的首条 prompt           | `agent-orchestrator`            | 否（拼接最近 N 条） |

---

## 2. SDK 原生压缩（主路径）

### 2.1 自动压缩

Claude Agent SDK（与 Claude Code 同源）在 context 接近窗口预算时 **自动触发 compact**：

- SDK 类型：`SDKStatusMessage`（`status: 'compacting'`）、`SDKCompactBoundaryMessage`（`subtype: 'compact_boundary'`）
- `compact_metadata` 含 `trigger: 'manual' | 'auto'`、`pre_tokens`、`post_tokens` 等
- 行为：用模型将较早对话 **总结为摘要**，保留近期细节；不是简单删除 JSONL 行

TAgent 侧：

- `useGlobalAgentListeners`：`compacting` → `compact_complete`
- `agent-atoms`：`isCompacting` / `compactInFlight` 驱动 UI
- `AgentMessages`：压缩中分隔符；`compact_boundary` 持久化展示

**配置**：SDK 支持 `autoCompactEnabled`、`autoCompactWindow`（见 `sdk.d.ts`）。当前 `claude-agent-adapter.ts` **未显式传入**，实际行为依赖 CLI 默认 + `settingSources: ['user', 'project']`（`~/.claude`、项目 `.claude` 配置）。

### 2.2 手动 `/compact`

用户点击「手动压缩」→ `AgentView.handleCompact` 发送 `userMessage: '/compact'`。

Orchestrator 识别后 **原样透传**，不包 `buildContextPrompt`：

```typescript
const isCompactCommand = userMessage.trim() === '/compact'
const finalPrompt = isCompactCommand ? '/compact' : /* ... */
```

与 Claude Code 终端 `/compact` **同一机制**。

### 2.3 UI 预警阈值

`ContextUsageBadge` 使用 `COMPACT_THRESHOLD_RATIO = 0.775`（SDK 约在 ~77.5% 窗口触发 auto-compact 的经验值）：

- 警告：压缩阈值 × 80%
- 危险：占 `contextWindow` 的 90%（P2-1 Nudges toast）

圆环数字来自 `assistant.message.usage` / `result.usage` 的 **汇总 token**，与 SDK 内部分项预算接近但不完全等同；分项见 [`context-usage-breakdown-design.md`](2026-06-13-context-usage-breakdown-design.md)（`getContextUsage()`）。

---

## 3. TAgent 客户端压缩（兜底）

### 3.1 动机

fusion 设计 §8.4：TAgent 支持 **任意兼容端点**，SDK 服务端 compact 可能失败；需要不依赖 LLM 的本地兜底（9120caac 类问题中的历史体积治理）。

### 3.2 实现

| 组件         | 文件                                                                                 |
| ------------ | ------------------------------------------------------------------------------------ |
| 压缩逻辑     | `apps/electron/src/main/lib/agent-session-compactor.ts`                              |
| MCP 工具注入 | `agent-orchestrator.injectCompactSessionTool()` → `tagent-compactor:compact_session` |
| IPC          | `AGENT_IPC_CHANNELS.COMPACT_SESSION`                                                 |
| UI           | `ContextUsageBadge`「客户端压缩」、`AgentView.handleClientCompact`                   |

**策略**：

| strategy                | 行为                                                                  | 状态             |
| ----------------------- | --------------------------------------------------------------------- | ---------------- |
| `drop_old_tool_results` | 删除仅含 tool_use / tool_result 的消息块，保留含文本的 user/assistant | ✅               |
| `keep_last_n`           | 仅保留最近 N 条 user/assistant                                        | ✅               |
| `summarize`             | 用便宜模型总结老消息                                                  | ✅               |

### 3.3 与 SDK 的状态边界（重要）

客户端压缩 **只改写** `~/.tagent/agent-sessions/{id}.jsonl`（TAgent 持久化镜像）。

- **不**调用 SDK control API
- **不**保证与活跃 `resume` 会话中 CLI 子进程的 in-memory context 同步

**风险**：会话仍有活跃 Query 时改 JSONL，可能出现磁盘与 SDK 内存不一致。

**建议使用场景**：

- SDK compact 已失败或端点不支持
- 当前无活跃 Agent 轮次，或用户接受 **新开会话 / 结束当前轮次后** 再压
- 紧急释放 JSONL 体积（运维向）

UI 应在后续迭代中补充简短说明（待办）。

---

## 4. 非压缩：`buildContextPrompt`

当 **没有** `sdkSessionId`、无法 `resume` 时，orchestrator 将最近 N 条历史拼入首条 user prompt（`buildContextPrompt` + `computeMaxContextMessages`）。

- **不是** compact
- **不**修改 SDK 会话状态
- 目的：冷启动 / 丢 resume 时的 **记忆回填**

与 §8.4 P0-1 动态预算相关；`systemTokens` / `toolsTokens` 仍为粗估常量，非实测分项。

---

## 5. 数据流（简图）

```
                    ┌─────────────────────────────┐
                    │   Claude Agent SDK (CLI)    │
                    │  auto-compact / /compact    │
                    │  → LLM 摘要 + compact_boundary │
                    └──────────────┬──────────────┘
                                   │ SDKMessage 流
                                   ▼
                    ┌─────────────────────────────┐
                    │  agent-orchestrator 持久化   │
                    │  ~/.tagent/agent-sessions/   │
                    └──────────────┬──────────────┘
                                   │
         用户「客户端压缩」──────────┼────────── Agent 调 compact_session
                                   ▼
                    ┌─────────────────────────────┐
                    │  agent-session-compactor    │
                    │  直接改写 JSONL（无 LLM）    │
                    └─────────────────────────────┘
```

---

## 6. 评估结论

### 6.1 合理之处

- 主压缩依赖 SDK 原生，与 Claude Code 对齐。
- 监听并展示 `compact_boundary`，用户可感知压缩分界。
- 兼容端点场景保留无 LLM 兜底，符合 fusion trade-off。
- 手动 / 客户端两个按钮语义分离清晰。

### 6.2 待改进（按优先级）

| 优先级 | 项                              | 说明                                                |
| ------ | ------------------------------- | --------------------------------------------------- |
| P1     | 客户端压缩提示                  | 活跃会话时 toast 警告「建议结束当前轮次或新开会话」 |
| P2     | 设置页暴露 `autoCompactEnabled` | 与 SDK 选项对齐，减少依赖 `~/.claude` 黑盒          |
| P2     | 接入 `getContextUsage()`        | 见 context-usage-breakdown 设计；压缩决策更可解释   |
| P3     | 实现 `summarize` 策略           | 客户端兜底的信息保留优于纯删块                      |
| P3     | `compact_session` 与 SDK 协调   | 压完后可选通知用户刷新 resume 或 fork 新会话        |

### 6.3 与 Claude Code 对比

| 维度                  | Claude Code | TAgent（当前）                        |
| --------------------- | ----------- | ------------------------------------- |
| Auto-compact          | ✅          | ✅（SDK 默认，未在 adapter 显式配置） |
| 手动 `/compact`       | ✅          | ✅                                    |
| `/context` 分项       | ✅ CLI      | ❌ 未接 `getContextUsage()`（规划中） |
| compact 失败 fallback | 官方链路内  | ✅ 自研 JSONL compactor               |
| 任意兼容端点          | ❌          | ✅（代价是自管 fallback）             |

---

## 7. 关键代码索引

| 用途            | 路径                                                                                                       |
| --------------- | ---------------------------------------------------------------------------------------------------------- |
| 手动 `/compact` | `apps/electron/src/renderer/components/agent/AgentView.tsx` — `handleCompact`                              |
| 客户端压缩      | `AgentView.tsx` — `handleClientCompact`；`agent-session-compactor.ts`                                      |
| `/compact` 透传 | `apps/electron/src/main/lib/agent-orchestrator.ts`                                                         |
| SDK 选项构建    | `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`                                              |
| 压缩 UI 状态    | `apps/electron/src/renderer/atoms/agent-atoms.ts`；`ContextUsageBadge.tsx`                                 |
| 单测            | `apps/electron/src/main/lib/agent-session-compactor.test.ts`                                               |
| SDK 类型        | `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts` — `SDKCompactBoundaryMessage`、`autoCompactEnabled` |

---

## 8. 文档维护

- Context 分项 UI：[`2026-06-13-context-usage-breakdown-design.md`](2026-06-13-context-usage-breakdown-design.md)
- 原始改进清单：fusion 设计 §8.4.2（P0～P2）
- 实施后更新 `.context/PROGRESS.md` 中 P1-3 状态（当前代码已实现 compactor，进度文档可能滞后）

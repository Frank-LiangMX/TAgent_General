# GLM Agent 调用数异常诊断报告

> **状态**：已修复（移除 getContextUsage 调用链）  
> **日期**：2026-07-16  
> **范围**：TAgent Desktop dev 环境、普通 Agent 对话、GLM-5.1、调用统计与 Coding Plan 额度显示  
> **相关设计**：[`2026-07-15-agent-request-budget-and-upstream-parity-design.md`](../plans/2026-07-15-agent-request-budget-and-upstream-parity-design.md)

## 1. 执行摘要

用户先后观察到两组异常：

- 一句普通身份询问后，GLM Coding Plan 的 Agent 调用数从 243 增至 422，增加 179；同一轮 TAgent Token 栏只显示约 5 次。
- 最新 dev 会话中，调用数从 27 增至 126。第一句“你好”后只增加约 2，第二句“你是谁”后增加约 99。

对最新 dev 会话的应用层 JSONL、Claude Agent SDK 原始 JSONL、进程启动链和相关源码进行交叉检查后，可以确认：

1. 两条用户消息各产生 **1 条完整 assistant 回复和 1 个成功 result**。
2. 两个 result 的 `num_turns` 都是 **1**。
3. 会话没有工具调用、看板任务、SubAgent、应用层重试或 Nudge 即时模型审查。
4. 当前证据**不支持“第二句话实际执行了约 99 次前台主 Agent 请求”**。
5. 第二句话存在约 **36.28 秒 SDK 本地队列等待**，但出队后只观察到一次约 14 秒的模型响应。这是独立的延迟问题，不等于 36 次或 99 次请求。
6. SDK 原始会话中存在 **4 条重复 `ai-title` 元数据记录**。这些记录值得继续调查，但仅凭 transcript 不能证明它们分别对应真实 Provider 请求；数量上也无法解释约 99 的增量。
7. TAgent 当前“总调用数”的统计口径把互相重叠的维度相加。一次正常请求可能同时计入 `modelCalls = 1` 和 `queryAttempts = 1`，从而显示为 2。这与第一句“你好”后的本地显示吻合，但它不是 Provider 原始请求数。
8. 如果 27 → 126 来自 GLM Coding Plan 后台，该数字更可能是 Provider 的额度/折算口径，而不是原始 HTTP 请求数。额度倍率、价格折算和可能的延迟入账仍需要受控 A/B 才能定论。

因此，截至本报告：**已证明普通对话的应用层主 Agent 没有执行上百个 turn，但尚未完全解释 GLM 后台约 99 的额度增量，也不能宣布问题已经彻底解决。**

## 2. 调查边界

- 只读取最新 dev 会话、SDK transcript、运行进程信息和仓库源码。
- 未修改 `~/.tagent-dev/` 下的任何用户数据。
- 未触发新的在线 GLM 请求，避免继续消耗用户额度。
- 未启动看板、SubAgent、Reflection 或额外 A/B 任务。
- 区分“已观察事实”“源码推断”和“待验证假设”，不把额度增量反推成 HTTP 请求数。

## 3. 启动入口与仓库身份纠正

### 3.1 正确启动入口

用户实际运行的是当前仓库中的 dev 脚本：

```text
F:\TAgent-streaming-setting\scripts\dev
```

最初根据 Electron 命令行里出现的另一个目录误判了源码仓库。进一步检查完整父进程链后确认：顶层 `concurrently` 进程来自当前工作区，随后启动当前项目的 dev 脚本。

### 3.2 为什么进程参数出现另一个目录

当前工作区的 `node_modules` 是一个 Junction，目标是共享依赖目录。因此 Electron、electronmon 等二进制的绝对路径会显示共享依赖所在位置。

这只说明“依赖从哪里加载”，不能说明“运行的是哪个源码仓库”。源码身份必须结合顶层启动目录、父进程链和实际入口脚本判断。

### 3.3 dev 数据目录

该启动方式使用独立 dev 数据根目录：

```text
~/.tagent-dev/
```

本次最新会话来自：

```text
~/.tagent-dev/agent-sessions/
~/.tagent-dev/sdk-config/projects/
```

## 4. 诊断过程

### 4.1 定位最新会话

从 `~/.tagent-dev/agent-sessions.json` 找到默认工作区中最近更新、标题为“你好”的会话：

| 字段 | 值 |
| --- | --- |
| TAgent session | `b4a63f19-6f3b-4428-a742-51068c10518c` |
| SDK session | `5acf6124-0ca2-498f-9759-1187fe4ced9d` |
| Workspace | 默认工作区 |
| Model | `glm-5.1` |
| 用户消息 | “你好” / “你是谁” |

这些标识只用于本地复核，不代表 Provider 请求 ID。

### 4.2 检查应用层会话 JSONL

应用层会话文件共 6 条核心记录：

1. user：“你好”
2. assistant：问候回复
3. result：成功，`num_turns = 1`
4. user：“你是谁”
5. assistant：身份回复
6. result：成功，`num_turns = 1`

两轮共同特征：

- 没有 `tool_use`、SubAgent 消息、看板 Worker 记录或应用层重试结果。
- 输入规模接近，均约 3.95 万 token。
- 记录的模型成本接近，均约 0.199 美元量级。

第二轮没有表现出相对第一轮几十倍的前台模型工作量。

### 4.3 检查 SDK 原始 JSONL

SDK 原始 transcript 共 19 行：

| 类型 | 数量 |
| --- | ---: |
| `queue-operation` | 4 |
| `user` | 2 |
| `assistant` | 2 |
| `attachment` | 2 |
| `file-history-snapshot` | 2 |
| `last-prompt` | 2 |
| `ai-title` | 4 |
| `mode` | 1 |

关键时间线使用 SDK 中的 UTC 时间：

| 事件 | 时间 |
| --- | --- |
| 第一条消息入队 | 2026-07-15 16:04:12.101Z |
| 第一条消息出队 | 2026-07-15 16:04:12.147Z |
| 第一条 user 写入 | 2026-07-15 16:04:12.160Z |
| 第一条 assistant 写入 | 2026-07-15 16:04:22.800Z |
| 第二条消息入队 | 2026-07-15 16:04:35.881Z |
| 第二条消息出队 | 2026-07-15 16:05:12.161Z |
| 第二条 user 写入 | 2026-07-15 16:05:12.165Z |
| 第二条 assistant 写入 | 2026-07-15 16:05:26.263Z |

第二条消息从入队到出队等待约 36.280 秒，出队后约 14.1 秒得到回复。应用层记录的第二轮总耗时约 55 秒，主要由本地排队构成，而不是由 99 个连续可见模型 turn 构成。

### 4.4 检查重复标题记录

SDK transcript 内有 4 条内容相同的 `ai-title`：

```json
{"type":"ai-title","aiTitle":"你好问候","sessionId":"5acf6124-0ca2-498f-9759-1187fe4ced9d"}
```

目前只能确认：

- SDK transcript 确实重复写入了标题元数据。
- TAgent 应用层自身的标题 Provider 请求已在当前 Phase 1 工作区改为本地生成，但 SDK 仍可能维护自己的标题元数据。
- transcript 元数据条数不等价于网络请求条数。
- 即使把 4 条全部假设成独立请求，也不足以解释约 99 的增量。

后续必须在 SDK 的真实请求边界记录 `purpose`、时间戳和请求序号，才能判断 `ai-title` 是否对应隐藏的 Provider 流量。

### 4.5 排查 TAgent 自有扩展

#### Nudge

当前 `onTurnStart` 路径只做本地证据检查，不直接执行 LLM review。旧的 `runLLMReview` 实现仍存在于代码中，但不是本次普通第二轮消息的即时调用路径。

#### Reflection 与 Memory Consolidation

Reflection/记忆整理属于后台或空闲期能力，不应作为每个前台 turn 的同步固定请求。本次会话没有证据显示它在第二句期间同步执行约 99 次。

#### 看板与 SubAgent

看板 MCP 和 SubAgent 定义可以被注册进主 Agent 上下文，但“注册 schema”不等于“启动 Worker”。本次会话没有真实 tool use，因此没有触发看板 Worker 或 SubAgent。

#### 流式输出

partial/stream event 是同一请求的本地增量事件，不应按 token 或 chunk 计算为独立 Provider 请求。本次完整 assistant 记录每轮只有一条。

### 4.6 检查统计口径

当前 Token 统计面板曾采用如下求和思路：

```text
totalCallCount =
  modelCalls
  + subagentCalls
  + queryAttempts
  + contextUsageRequests
  + titleRequests
  + retryAttempts
  + nudgeReviewCalls
  + reflectServiceCalls
```

该公式混合了不同维度。一次正常请求通常同时贡献一个 Query attempt 和一个 assistant/model turn。因此，普通问候显示 2 很可能只是：

```text
modelCalls 1 + queryAttempts 1 = UI 显示 2
```

这证明本地数字存在语义重叠，但不能单独解释 Provider 后台 27 → 126。

### 4.7 核对 GLM Coding Plan 口径

GLM 官方文档说明：

- 编码 Agent 的一次用户指令可能在复杂工具循环中调用模型约 15–20 次；这是典型编码场景描述，不代表一句简单问候必然调用这么多次。
- Coding Plan 额度会根据模型和 API 价格换算。
- GLM-5.1/GLM-5-Turbo 等高阶模型存在时段倍率；当前规则下非高峰为 2 倍、高峰为 3 倍。

参考：

- [GLM Coding Plan 概览](https://docs.bigmodel.cn/cn/coding-plan/overview)
- [GLM Coding Plan FAQ](https://docs.bigmodel.cn/cn/coding-plan/faq)

本次会话发生在北京时间约 00:04，属于非高峰区间。2 倍倍率是相关因素，但仅靠 2 倍仍不足以从一个已观察主 turn 推导出约 99。

“第一句的主要额度在第二句之后才集中显示”是一个可能解释，但官方材料和本地 transcript 尚未直接证明延迟入账，所以必须标注为待验证假设。

## 5. 证据分级

### 5.1 已确认事实

- dev 启动入口来自 `F:\TAgent-streaming-setting\scripts\dev`。
- 共享 `node_modules` 的物理目标不代表源码仓库身份。
- 最新会话只有两条 user、两条完整 assistant 和两个成功 result。
- 两轮 `num_turns` 都是 1。
- 本次会话没有工具、看板 Worker、SubAgent 或应用层重试。
- 第二条消息在 SDK 本地输入队列等待约 36.28 秒。
- SDK transcript 有 4 条重复 `ai-title` 元数据。
- 本地调用统计存在重叠维度求和问题。

### 5.2 可以排除或基本排除

| 假设 | 结论 | 依据 |
| --- | --- | --- |
| 第二句执行了约 99 个可见主 Agent turn | 排除 | `num_turns = 1`，只有一条完整 assistant |
| 第二句触发了看板 Worker | 排除 | 无看板 tool use/Worker 记录 |
| 第二句触发了 SubAgent | 排除 | 无 SubAgent 消息或工具事件 |
| 流式 chunk 每个都被当作一次完整模型调用 | 排除 | 每轮只持久化一条完整 assistant |
| Nudge 在第二轮同步执行了大量 LLM review | 基本排除 | 当前 turn-start 路径为本地检查，且无对应事件 |
| 约 36 秒延迟等于约 36 次模型请求 | 排除 | 延迟发生在 dequeue 之前 |

### 5.3 尚未证实

| 假设 | 当前状态 | 需要的证据 |
| --- | --- | --- |
| 4 条 `ai-title` 分别触发了真实 Provider 请求 | 未证实 | SDK 请求边界日志/网络侧请求序号 |
| SDK 0.3.185 存在额外非必要流量 | 未证实 | 与目标 SDK 版本、同配置 A/B |
| GLM 后台存在延迟或批量入账 | 未证实 | 每次请求后按固定时间间隔记录后台计数 |
| 27 → 126 是价格/模型倍率折算而不是请求数 | 高概率但未定论 | Provider 对该字段的精确定义或账单明细 |
| 本地 UI 的 126 来自后台统计字段泄漏 | 取决于数字来源 | Token 面板分项截图或 `call_stats` 事件快照 |

## 6. 当前结论

### 6.1 是否已经解决调用次数过多

不能回答“已经完全解决”。当前 Phase 1 工作区已经移除或收敛了一批确定的附加请求来源，包括应用层标题模型请求和自动 Context Usage 轮询；但最新实测中的 GLM 后台约 99 增量仍缺少一一对应的请求证据。

目前能严谨确认的是：

- TAgent 应用层主 Agent 在该样本中每条消息只完成一个 turn。
- 已知的看板、SubAgent、Nudge、Reflection 不能解释这次同步增长。
- 本地“调用总数”不是可靠的 Provider 请求总数。
- Provider 后台数字也不能未经验证直接称为原始 HTTP 请求数。

### 6.2 底层是否已经与上游一致

前台 Query 的总体结构来自同一套 Claude Agent SDK 适配思路，但不能表述成“完全一致”：

- TAgent 仍包含看板、SubAgent、Memory、Nudge/Reflection、统计和 UI 扩展。
- 当前声明/安装的 SDK 版本仍需要与目标上游基线分阶段核对。
- SDK 自身的标题元数据和非必要流量行为尚未完全查清。
- 当前工作区包含未提交的 Phase 1 收敛改动，不能把它当作已经发布的稳定结论。

更准确的说法是：**该实测样本的前台主 Query 行为已经表现为每条普通消息一个 turn，但整个 SDK/辅助流量/统计链路尚未证明完全等价。**

### 6.3 为什么第一句显示 2

若数字来自 TAgent Token 栏，最直接的解释是：

```text
1 次 Query attempt + 1 个 model turn = 显示 2
```

这属于统计口径错误，不代表两次独立 Provider HTTP 请求。

若数字来自 GLM Coding Plan 后台，则必须使用 Provider 的额度定义解释，不能套用 TAgent 的本地公式。

## 7. 下一步验证方案

任何会继续消耗 GLM 额度的在线测试，都应先获得用户明确授权。

### 7.1 先确定数字来源

对每次异常记录：

```text
数字来自：TAgent Token 栏 / GLM Coding Plan 后台
测试前数值：
发送后立即数值：
30 秒后数值：
2 分钟后数值：
5 分钟后数值：
```

若来自 TAgent，还应记录面板中的每个分项，而不是只记录求和结果。

### 7.2 增加请求边界可观测性

建议后续实现按用途分类的只读诊断事件：

| 字段 | 说明 |
| --- | --- |
| `requestId` | TAgent 生成的单调序号，不依赖 Provider |
| `sessionId` | 当前会话 |
| `purpose` | foreground/title/context/memory/reflection/subagent/kanban |
| `queryAttempt` | 外层 Query 尝试序号 |
| `modelTurn` | SDK result/assistant 推导的 turn |
| `sdkRetry` | SDK 暴露的 API retry |
| `startedAt` / `finishedAt` | 请求边界时间 |
| `providerRequestId` | Provider 返回时记录；没有则留空 |

不得再把这些维度直接相加成未经定义的“总调用数”。

### 7.3 受控 A/B

在用户授权额度后，固定同一模型、Provider、时段、空白工作区和提示词“你是谁”。每组只发一条消息，等待至少 5 分钟再读取最终额度。

建议顺序：

1. 当前 SDK + Phase 1 收敛改动。
2. 目标 SDK 版本 + 同样收敛改动。
3. 上游基线的同模型配置。

每组同时保存应用 JSONL、SDK JSONL、本地请求边界日志和 Provider 后台时间序列。

### 7.4 独立处理 36 秒排队

SDK 持久输入通道的第二条消息发生了明显 dequeue 延迟。应单独检查：

- 上一轮 terminal result 后输入通道是否及时释放。
- 队列轮询是否存在固定周期或超时。
- iterator 结束、resume 和 channel 生命周期是否互相等待。
- dev 热重载是否残留旧 listener。

该问题影响交互延迟，但在获得新证据前不得把它计入模型调用次数。

## 8. 防回归约束

普通问候或身份询问在没有真实工具调用时，应满足：

- `num_turns = 1`。
- 标题 Provider 请求 = 0。
- 自动 Context Usage 请求 = 0。
- Nudge/Reflection 同步请求 = 0。
- 看板 Worker = 0。
- SubAgent = 0。
- 应用层 Query attempt = 1。
- UI 分别展示 Query attempt、model turn、retry 和附加请求，不显示伪总数。
- Provider 额度变化只作为外部观测值记录，不反推成本地 HTTP 请求数。

## 9. 报告限制

- 本次没有 Provider 服务端请求明细，无法从本地 transcript 还原所有隐藏网络流量。
- 本次没有保存 27、29、126 等节点的带时间戳后台截图，因此延迟入账只是待验证假设。
- `ai-title` 是 transcript 元数据；没有请求边界日志时，不能确定其网络含义。
- 工作区处于开发分支且存在未提交改动，本报告描述的是该时间点的调查状态，不代表已发布版本。

---

## 10. 修复方案（2026-07-16）

### 根因

v1.1.0 引入的 `getContextUsage` 调用链形成循环：

```
getContextUsage() → adapter.getContextUsage() → query.getContextUsage()  ← Provider 调用
  → refreshContextUsageInBackground() → adapter.refreshContextUsage() → query.getContextUsage()  ← 又一次
    → IPC 通知 CONTEXT_USAGE_UPDATED → 渲染进程 bump nonce
      → useContextUsageBreakdown 重新调用 getContextUsage()  ← 循环
```

每次 `refreshContextUsageInBackground` 完成后发 IPC 通知，触发渲染进程重新调用 `getContextUsage`，形成循环。虽然 `contextUsageRefreshing` Set 防并发，但 `.finally()` 清除 guard 后下一轮又可以进入。

### 修复

移除整个 `getContextUsage` 调用链（对齐 Proma，Proma 无此功能）：

**删除的文件（10 个）：**
- `context-usage-cache.ts` + test
- `context-usage-mapper.ts` + test
- `useContextUsageBreakdown.ts`
- `context-usage-atoms.ts`
- `ContextUsagePanel.tsx`
- `ContextUsageCategoryGroup.tsx`
- `ContextUsageCategoryRow.tsx`
- `ContextUsageSegmentBar.tsx`
- `claude-agent-adapter.request-budget.test.ts`
- `background-llm-calls.ts`

**修改的文件（12 个）：**
- `claude-agent-adapter.ts` — 移除 `getContextUsage()` + `refreshContextUsage()` 方法
- `agent-orchestrator.ts` — 移除 `getContextUsage()` + `refreshContextUsageInBackground()` + `getContextUsageCached()`
- `agent-service.ts` — 移除 `getAgentContextUsage()` + `getAgentContextUsageCached()`
- `ipc.ts` — 移除两个 IPC handler
- `preload/index.ts` — 移除 `getContextUsage` + `getContextUsageCached` + `onContextUsageUpdated`
- `useGlobalAgentListeners.ts` — 移除 nonce bump + scheduleContextUsageRefresh + onContextUsageUpdated 监听
- `ContextUsageBadge.tsx` — 改为直接使用流式 usage 数据，新增简洁 popover
- `agent-session-manager.ts` — 移除 `clearContextUsageCache` 调用
- `automation-scheduler.ts` — 移除 context usage 阈值检查
- `packages/shared/src/types/agent.ts` — 移除三个 IPC channel 常量

**净效果：** -1745 行代码，彻底消除 `query.getContextUsage()` 的 Provider API 调用循环。

### 影响

- **Agent 行为不变**：消息收发、工具调用、流式响应完全不受影响
- **Context 圆环仍显示**：改用流式 usage 数据（`input_tokens / contextWindow`），与 Proma 一致
- **压缩按钮仍可用**：独立于 `getContextUsage`
- **丢失的能力**：按类别查看 context 占用明细（系统提示 / 工具 / 消息各自的 token 占比）

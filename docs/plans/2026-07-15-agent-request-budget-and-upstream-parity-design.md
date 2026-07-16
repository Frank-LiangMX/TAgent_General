# Agent 请求预算与上游行为对齐设计

> **Status**: Accepted — 维护者已授权实施 Phase 1  
> **Date**: 2026-07-15  
> **Scope**: TAgent Desktop 普通 Agent 对话、SDK 适配层、请求统计  
> **Related**: [`2026-06-13-context-usage-breakdown-design.md`](2026-06-13-context-usage-breakdown-design.md)、[`2026-06-13-context-compaction-architecture.md`](2026-06-13-context-compaction-architecture.md)、[`../decisions/0006-idle-memory-consolidation-and-reflection-reliability.md`](../decisions/0006-idle-memory-consolidation-and-reflection-reliability.md)

---

## 1. 摘要

普通对话必须满足“前台零辅助请求”约束：除完成用户任务所需的前台 Agent 模型请求外，不得因为标题、Context Usage、Nudge、Reflection、看板观察器、SubAgent 注册或流式 UI 自动增加 Provider 请求。

本设计以更新后的上游基线提交 `324d28a0` 为行为参考。该基线声明并锁定 Claude Agent SDK `0.3.201`；TAgent 当前声明并安装 `0.3.185`。基线工作区更新后若尚未重新安装依赖，`node_modules` 中的旧版本不作为版本事实来源。

本次对齐不删除看板、SubAgent、流式输出或长期记忆。它只收回普通对话链路上的自动副作用，并建立可验证的请求预算与统计口径。

核心决策：

1. 移除自动标题模型请求，标题改为本地确定性生成。
2. 移除每条 `assistant` 和最终 `result` 后的自动 `getContextUsage()`。
3. Context Usage 保留为显式 UI 能力；SDK 原生压缩和用户显式压缩入口保留。
4. 看板与 SubAgent 保留，但未发生真实工具调用时不得产生独立前台请求。
5. 记忆系统继续遵守 ADR-0006：前台本地采集，空闲批量整理；不得恢复逐 turn 辅助 LLM。
6. SDK `0.3.201` 对齐独立成阶段，避免与副作用移除混在一次实验中而无法归因。
7. 调用统计不再把不同维度相加成一个“总调用次数”。

---

## 2. 问题陈述

用户观测到 GLM Coding Plan 在一句普通问题后，额度计数从 243 增至 422，增量 179；同一轮 TAgent 底栏仅显示 5 次。该问题包含两个独立风险：

- **实际请求或额度消耗异常**：普通对话产生了远高于预期的外部消耗。
- **本地统计失真**：底栏数字不能解释 Provider 后台的额度变化。

GLM Coding Plan 官方说明，一次用户 Prompt 在编码 Agent 中通常可能触发约 15–20 次模型调用，且部分高阶模型存在额度倍率。因此 Provider 后台的“额度增量”不能直接等同于 HTTP 请求数。但一句不触发工具的身份询问出现 179 的增量，仍必须按异常处理。

外部参考：

- [GLM Coding Plan 常见问题](https://docs.bigmodel.cn/cn/coding-plan/faq)
- [GLM Coding Plan 的 Claude Code 配置](https://docs.bigmodel.cn/cn/coding-plan/tool/claude)
- [Claude Agent SDK Changelog](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md)

---

## 3. 已确认事实

### 3.1 SDK 版本基线

| 项目 | 依赖声明 | 锁文件 | 当前安装目录 | 设计采用的事实 |
| --- | ---: | ---: | ---: | ---: |
| 更新后的上游基线 | 0.3.201 | 0.3.201 | 更新后可能残留旧版本 | **0.3.201** |
| TAgent | 0.3.185 | 0.3.185 | 0.3.185 | **0.3.185** |

依赖声明和锁文件决定下一次可复现安装。仅检查未重新安装的 `node_modules` 会得出错误结论。

### 3.2 普通 Query 主体大体继承上游

两边均使用：

- 单个 SDK `query()` 驱动前台 Agent；
- 持久化输入通道；
- `promptSuggestions: false`；
- terminal result 后主动结束 iterator；
- `toolUseConcurrency: 1`；
- resume、权限回调、内置 Agent 定义和 MCP 注入。

因此不需要整体替换 TAgent 的适配层。应按副作用逐项对齐。

### 3.3 TAgent 独有的自动 Context 轮询

TAgent 当前在以下时机调用 `query.getContextUsage()`：

- 每收到一条完整 `assistant` 消息后；
- 收到最终 `result` 后。

若一轮产生 5 条完整 assistant 消息，则会额外发起约 6 次 SDK control 请求。更新后的上游基线没有这条自动轮询。

目前只能确认这是额外 control 请求及明显的行为偏差；在完成 Provider 侧 A/B 之前，不把“单次 `getContextUsage()` 会折算为多少 GLM 额度”写成既定事实。

### 3.4 标题生成是确定的额外 Provider 请求

两边当前都存在自动标题模型请求。TAgent 还会在请求失败后退回用户消息首行。

维护者已明确决定：TAgent 不再为标题调用模型。既然本地兜底已经能形成可用标题，就不应先付出一次 Provider 请求再降级。

### 3.5 流式 partial 不是独立 Provider 请求

ADR-0006 已确认：`includePartialMessages: true` 增加的是本地 SDK yield、IPC 和渲染事件，不会把每个 token 变成一次 Provider 请求。

必须继续保持：

- partial 不触发标题、记忆、Context、重试或持久化；
- 完整消息是唯一的持久化和 turn 完成依据；
- 是否启用流式输出不改变请求预算。

### 3.6 记忆系统不是普通 turn 的即时线性消耗源

ADR-0006 和当前记忆文档已经规定：

- Nudge 前台只做本地证据采集；
- L4 前台只做本地写入和 dirty 标记；
- Reflection 合并到空闲批量整理时，不另起固定时钟请求；
- legacy Reflection 只在对应 feature flag 关闭时保留。

本次不得回退这些收敛成果。Reflection 或空闲整理应单独计入后台预算，不与当前用户 turn 混为一谈。

### 3.7 看板和 SubAgent 是按需能力

看板在普通 Query 中注册 MCP 工具，SubAgent 注册 Agent 定义。这些注册会增加 prompt/tool schema 体积，但不会在没有真实 tool use 时自行启动 Worker 或 SubAgent。

保留约束：

- 注册行为不得直接调用 Provider；
- 真实看板 Worker和 SubAgent 请求必须有明确事件与独立计数；
- 普通问候不得触发看板任务、Worker 会话或 SubAgent。

### 3.8 当前调用统计不是 Provider 请求统计

当前实现用非 replay 的完整 `assistant` 消息累计 `modelCalls` / `subagentCalls`。这代表“模型响应消息数”，不等于 Provider HTTP 请求数。

工作区中的统计草案还尝试把以下值直接相加：

- assistant 响应；
- query 尝试；
- Context control 请求；
- 标题请求；
- 外层重试；
- Nudge / Reflection 请求。

这些字段存在包含或重叠关系，不能求和为一个权威总数。

---

## 4. 目标与非目标

### 4.1 目标

1. 普通对话相对上游基线不产生隐式前台辅助请求。
2. GLM Coding Plan 使用官方建议的认证、Base URL、超时和非必要流量开关。
3. 标题、Context、记忆、看板和 SubAgent 的请求用途可区分。
4. 用户看到的数字有明确单位，不再用一个错误的“调用总数”掩盖问题。
5. 能通过同问题、同模型、同时段的 A/B 测试定位额度差异。

### 4.2 非目标

- 不删除看板、SubAgent、流式输出或长期记忆。
- 不修改 L0-L5 memory schema。
- 不修改 Provider / Channel / Skill 公共 interface。
- 不保证所有 Agent 任务只调用一次模型；工具循环和真正的 SubAgent 本来就需要多 turn。
- 不把 GLM 后台额度增量强行解释成原始 HTTP 请求数。

---

## 5. 请求预算模型

### 5.1 普通前台 turn

未触发工具、SubAgent、看板、压缩和用户显式 Context 查询时：

| 请求用途 | 预算 |
| --- | ---: |
| 前台 Agent 模型请求 | 由 SDK 完成任务所需的最小 turn 数决定 |
| 标题模型请求 | **0** |
| Context Usage control 请求 | **0** |
| Nudge / keyFacts / Reflection | **0** |
| 看板 Worker | **0** |
| SubAgent | **0** |

### 5.2 显式或后台能力

| 能力 | 允许增加请求的条件 | 统计归属 |
| --- | --- | --- |
| Context Usage | 用户主动打开或刷新分项面板 | `context_control` |
| SDK `/compact` | 用户显式执行或 SDK 自身达到自动压缩条件 | `compaction` |
| 客户端压缩 | 用户显式执行；本地策略不得调用 LLM | `local_only` |
| 看板 Worker | 真实 `kanban_*` tool use 创建或驱动任务 | `kanban_worker` |
| SubAgent | 真实 Agent/SubAgent tool use | `subagent` |
| Memory Consolidation | ADR-0006 的空闲、证据和预算条件全部满足 | `memory_consolidation` |
| Legacy Reflection | 仅 legacy flag 路径；不得归入当前前台 turn | `reflection_legacy` |

---

## 6. 设计决策

### D1：标题改为本地确定性生成

自动标题取第一条非空文本行，合并多余空白并截断到既有最大长度。若没有文本则保留默认标题。

保留会话标题字段、`onTitleUpdated` 事件、用户手动重命名和现有 IPC contract；移除 Provider title request、`fetchTitle`、标题请求重试及其普通 turn 计数。

### D2：Adapter 事件循环必须无 Context 副作用

从 SDK message 迭代器中删除：

- assistant 后 `getContextUsage()`；
- result 后 `getContextUsage()`；
- 由上述轮询触发的主动客户端压缩。

保留：

- `getContextUsage(sessionId)` 显式方法；
- Context 映射与缓存；
- UI 显式打开时的 stale-while-revalidate；
- SDK `result.usage` / `modelUsage.contextWindow` 的正常读取；
- SDK 原生 auto-compact、`/compact` 和本地手动压缩。

当 Query 已结束，分项面板展示最后缓存或汇总 usage，并说明分项暂不可刷新；不得为了保持面板“永远最新”而在每个模型 turn 后轮询。

### D3：高 Context 只提示，不自动发起辅助 control 请求

普通 turn 的阈值判断优先使用正常 assistant/result 已携带的 usage。接近阈值时可以更新 UI 警告，但不得自动调用 `getContextUsage()` 来获得更精细分项。

压缩策略继续遵守现有双层设计：SDK 原生压缩为主路径；用户显式本地压缩为兼容端点兜底；不在未知时机静默改写活跃会话 JSONL。

### D4：SDK 升级与副作用移除分阶段

最终目标与上游声明版本 `0.3.201` 对齐，但不在同一个实验里同时改变所有变量。

建议顺序：

1. 在 `0.3.185` 上移除自动 Context 和标题请求，建立请求测试。
2. 记录 GLM A/B 结果。
3. 单独升级到 `0.3.201`，重新运行同一组测试。
4. 对照上游 `0.3.201` 基线确认差异。

这样可以区分“SDK 版本行为”与“TAgent 额外副作用”。依赖升级 PR 必须同时更新主包、所有平台 optional package 和锁文件。

### D5：GLM Coding Plan 使用官方环境约束

`zhipu-coding` 至少应对齐官方 Claude Code 配置：

```text
ANTHROPIC_AUTH_TOKEN=<key>
ANTHROPIC_BASE_URL=https://open.bigmodel.cn/api/anthropic
API_TIMEOUT_MS=3000000
CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1
```

TAgent 当前 SDK env 与 `process.env` 的认证分支必须一致，不能一边设置 Bearer、另一边落入 API key 默认分支。

### D6：调用统计按维度展示，不计算伪总数

| 指标 | 来源 | 含义 |
| --- | --- | --- |
| `modelTurns` | `result.num_turns`，缺失时用完整 assistant 事件降级 | Agent 模型 turn 数 |
| `observedApiRequests` | SDK `system/status=requesting`（需验证 0.3.201 完整性） | SDK 暴露的已观测 API 请求 |
| `sdkApiRetries` | `system/api_retry` | SDK 内部重试 |
| `queryAttempts` | orchestrator 外层循环 | TAgent 外层 Query 尝试 |
| `subagentTurns` | 带父 tool use / Agent 归属的消息 | SubAgent turn |
| `explicitContextRequests` | 显式 `getContextUsage` 调用点 | Context control 请求 |
| `backgroundRequests` | 带 purpose 的后台服务 | 记忆/legacy Reflection 等 |

UI 不显示把这些值相加后的“调用 N”。推荐分别显示“模型 turn”“已观测 API 请求”“重试”和“附加请求”。若 SDK 不能完整发出 `status=requesting`，UI 必须标记“已观测”而不是“实际总请求”。

### D7：扩展能力保持旁路

看板进度广播、SubAgent 事件聚合、PostToolUse 检查、Nudge 本地证据采集、Context 缓存读取和流式 delta 合帧，只能观察或响应真实事件，不能因为普通消息完成而自动派生前台请求。

---

## 7. 实施分期

### Phase 0：文档与测量保护

- 本文评审通过后再开始代码修改。
- 固化普通对话“零辅助请求”测试夹具。
- 为后台调用增加稳定 purpose 标签。
- 明确 `status=requesting` 在 SDK 0.3.185 / 0.3.201、流式开关两种状态下的覆盖范围。

### Phase 1：移除确定的前台辅助请求

- 标题改为本地生成。
- 删除 assistant/result 后自动 Context 轮询。
- 删除依赖该轮询的主动本地压缩。
- 保留显式 Context 和手动压缩入口。
- 修正 GLM env 与 process env 分支。

### Phase 2：统计口径修复

- 接入 `num_turns`、`api_retry` 和可用的 `status=requesting`。
- 删除重叠字段求和。
- 前台、显式 control、后台服务按 purpose 分组。
- 不把额度倍率反推为 HTTP 请求数。

### Phase 3：SDK 0.3.201 对齐

- 更新主包、平台 optional package 与锁文件。
- 对照 SDK Changelog 检查 0.3.186–0.3.201 行为变化。
- 重点回归后台 Agent 权限、stdin 生命周期、resume、terminal result、Windows 子进程退出和流式 partial。

### Phase 4：GLM 实测与发布门禁

- 在用户明确授权消耗测试额度后运行 A/B。
- 记录时间段、模型、问题、SDK 版本、流式开关、工具事件、重试和后台请求。
- UI 截图与日志随 PR 提交。

---

## 8. A/B 矩阵

使用同一 GLM 模型、同一账号、尽量相同时间段和新建空工作区。测试问题固定为“你是谁”。

| 组 | SDK | 自动 Context | 标题模型请求 | 目的 |
| --- | ---: | --- | --- | --- |
| A | 0.3.185 | 开 | 开 | 复现当前行为 |
| B | 0.3.185 | 关 | 关 | 识别 TAgent 副作用贡献 |
| C | 0.3.201 | 关 | 关 | 识别 SDK 版本贡献 |
| D | 上游 0.3.201 基线 | 无 | 现状记录 | 外部行为对照 |

每组记录 SDK `status=requesting`、`api_retry`、`result.num_turns`、完整 assistant/SubAgent 消息数、显式 Context、标题、记忆、看板 Worker、SubAgent 后台请求，以及 GLM 后台测试前后额度与适用倍率。

严禁在未获用户明确授权时运行会消耗 Coding Plan 额度的实测。

---

## 9. 验收场景

```gherkin
Feature: 普通 Agent 对话请求预算

  Scenario: 普通问候不产生辅助请求
    Given 一个已有会话且 Context 面板关闭
    And 未触发工具、看板或 SubAgent
    When 用户发送“你是谁”
    Then 标题 Provider 请求数为 0
    And Context control 请求数为 0
    And 前台记忆请求数为 0
    And 看板 Worker 请求数为 0
    And SubAgent 请求数为 0

  Scenario: 新会话标题本地生成
    Given 会话标题是默认值
    When 用户发送第一条非空消息
    Then 标题取第一条非空文本并截断到最大长度
    And onTitleUpdated 被触发一次
    And Provider 请求数不因标题增加

  Scenario: partial 事件不产生辅助请求
    Given 流式输出产生 1000 个 stream_event
    When 完整 turn 结束
    Then Context、标题、记忆请求均不因 partial 增加

  Scenario: 用户显式打开 Context 面板
    Given 当前 Query 仍支持 getContextUsage
    When 用户主动打开或刷新 Context 分项
    Then 只产生一次 explicitContextRequests
    And 该请求不计入模型 turn

  Scenario: SDK 内部重试可见
    Given SDK 发出 api_retry
    When 轮次结束
    Then sdkApiRetries 增加
    And TAgent 外层 queryAttempts 不被伪造为同一重试

  Scenario: 看板和 SubAgent 按需工作
    Given 普通对话没有对应 tool use
    Then 不启动 Worker 或 SubAgent
    When 后续发生真实看板或 Agent tool use
    Then 请求归入对应 purpose
```

---

## 10. 测试与门禁

代码实施 PR 至少包含：

- 本地标题函数单元测试：空文本、多行、空白归一、中文/英文、截断。
- Adapter 测试：assistant/result 不调用 `getContextUsage()`。
- 显式 Context 测试：用户入口仍只调用一次并正确降级。
- partial 回归：大量 stream event 不增加辅助请求。
- 统计测试：`num_turns`、`api_retry`、外层 retry 不重复求和。
- 看板/SubAgent 未触发场景请求数为 0。
- GLM env 单测：Bearer、Base URL、timeout、nonessential traffic 开关一致。
- `bun test`、`bun run typecheck`、格式与 lint 全部通过。

调用预算属于核心逻辑，相关计数、分类和“不调用”断言要求 100% 分支覆盖。

---

## 11. 风险与恢复

| 风险 | 缓解 |
| --- | --- |
| 移除自动 Context 后分项缓存不够新 | 使用正常 usage 更新汇总；分项明确为显式刷新/最后缓存 |
| 不再主动本地压缩导致兼容端点接近上限 | 保留 SDK auto-compact、警告和用户显式本地压缩 |
| 本地标题质量低于模型标题 | 保留手动重命名；优先保证零额外请求 |
| SDK 0.3.201 改变权限或后台任务行为 | 独立阶段升级；对后台 Agent、resume、终止和 Windows 进程做专项回归 |
| `requesting` 事件不是完整 HTTP 遥测 | 标记为“已观测”；以 A/B 和 Provider 后台交叉验证 |
| GLM 额度存在倍率 | 同模型、同时段比较；记录倍率，不将额度增量直接称为请求数 |

回滚时可以回退 SDK 版本，但不恢复标题模型请求和逐 assistant Context 轮询；不删除 Context UI、看板、SubAgent 或记忆数据；不修改用户数据与已发布 tag。

---

## 12. 评审问题

实施前需要维护者确认：

1. 是否接受本地标题“第一条非空文本、最多 20 字符”的规则？
2. Context 分项是否接受“显式刷新 + 最后缓存”，不再保证每个模型 turn 后实时刷新？
3. SDK 升级是否按独立 PR 执行，以保留 A/B 归因能力？
4. `status=requesting` 若在流式关闭时不完整，UI 是否接受“已观测 API 请求”措辞？
5. GLM 在线 A/B 可使用多少测试额度、在哪个时间段执行？

维护者已授权实施 Phase 1；SDK 升级与在线额度 A/B 仍需按独立阶段执行。

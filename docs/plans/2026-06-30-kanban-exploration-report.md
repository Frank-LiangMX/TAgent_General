# 看板 + 多 Agent 协同探索报告（Phase A Spike）

> **状态**：Exploration Report v1.0 — Phase A 探索期，不构成正式 Epic 启动承诺
> **日期**：2026-06-30
> **分支**：`feature/kanban-exploration`（探索分支，独立于主线）
> **关联**：
> - 主设计：[`2026-06-30-task-kanban-orchestration-design.md`](2026-06-30-task-kanban-orchestration-design.md)
> - 执行层参考：[`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md) §0–§3
> - 上游对齐：PR #16 已合 `main`（`feature/upstream-v0.13.4-alignment`）
> - 当前状态：[`PROGRESS.md`](../PROGRESS.md)
>
> **并行工人**：本探索分支同时启动三路工人
> - Worker S — `kanban-db.ts` + `kanban-dispatcher.ts`（Phase A 内核 spike）
> - Worker A — `kanban-worker-service.ts` + `kanban-agent-tools.ts`（headless 桥接 + MCP schema）
> - Worker B（本文）— 探索报告 + 设计文档与 PROGRESS 追踪更新

---

## §1 探索目标与范围

### 1.1 Phase A 要验证什么

| 验证项 | 期望结果 | 不验证 |
| --- | --- | --- |
| **看板内核可用** | SQLite (`~/.tagent[-dev]/kanban.db`) 建表、CRUD、WAL 模式 | 看板 UI |
| **依赖 DAG 解析** | `B 依赖 A`，A 完成后 B 由 `pending` 提升到 `ready` | 任务编辑 UI |
| **调度循环闭环** | 30s tick 扫 `ready` 任务 → 派工 → 工人完成 → `done` | IM 推送 |
| **并发上限** | `maxConcurrent=3`，5 个 ready 只跑 3 个 | 角色库 UI |
| **跨重启恢复** | running 任务重启后标记为 `interrupted`，可 re-queue 或 fail | blackboard 富 UI |
| **headless 工人桥接** | `triggeredBy: 'kanban'` 通过 `runRegisteredHeadlessAgent` 拉起子会话 | SubAgent 体系改造 |
| **bypassPermissions** | 工人无人值守写操作不阻塞（参考 automation-scheduler） | 权限分级 |

### 1.2 探索期的「不做」

- **不做 IM 卡片**（Phase C）：仅控制台日志验证状态流转
- **不做 MCP 注入 orchestrator**：Worker A 只交付 schema + handler 骨架，不接线 `agent-orchestrator.ts`
- **不做角色库 UI**：测试用硬编码 `roleId`，设置页留给 Phase B
- **不做 decomposer**：手工 mock 任务树写入数据库
- **不做 TA 模式接入**：v1 仅 `general` 模式

### 1.3 成功判据（Phase A 收口）

```
脚本场景：mock WorkerRunner 记录执行顺序
  → createBoard("验证看板")
  → createTask(A) / createTask(B, dependsOn=A) / createTask(C, dependsOn=B)
  → startKanbanDispatcher()
  → 等待 60s（2 个 tick）
  → 三个任务 status 全为 'done'
  → 执行顺序数组 = [A, B, C]
  → runningConcurrent 峰值 ≤ maxConcurrent
```

满足以上即视为 Phase A 探索通过，可进入 Phase B 决策。

---

## §2 现有基础设施盘点

### 2.1 `agent-headless-runner-registry.ts`（已就绪，直接复用）

**路径**：`apps/electron/src/main/lib/agent-headless-runner-registry.ts`

| 导出 | 用途 | Kanban 复用方式 |
| --- | --- | --- |
| `setHeadlessAgentRunner(runner)` | 在 `agent-service.ts:319` 启动时注入 `runAgentHeadless` | 已就绪，无需改动 |
| `runRegisteredHeadlessAgent(input, callbacks)` | 工人执行的统一入口 | `kanban-worker-service.ts` 直接调用 |
| `setAgentStopper(stopper)` | 注入会话停止函数 | 调度器停止任务时调用 |
| `stopRegisteredAgent(sessionId)` | 停止指定会话 | 任务 `cancelled` 状态触发 |

**关键发现**：
- 注册表本身**与 `agent-service.ts` 解耦**，避免循环依赖（注释明确说明）。Kanban 走相同路径，零侵入。
- `HeadlessAgentRunCallbacks` 已含 `onError / onComplete / onTitleUpdated / source`，Kanban 任务完成回调直接映射 `completeTask(task.id)` / `failTask(task.id, err)`。
- `AgentExternalRunSource` 当前为 `'feishu' | 'dingtalk' | 'wechat' | 'bridge'`（`packages/shared/src/types/agent.ts:729`）—— **缺 `'kanban'`**。Phase A 探索期可直接用 `'bridge'` 兜底；Phase B 正式接入时建议扩展联合类型。

### 2.2 `automation-scheduler.ts`（headless 先例，模式直接借鉴）

**路径**：`apps/electron/src/main/lib/automation-scheduler.ts`

| 设计要点 | automation 实现 | Kanban 借鉴方式 |
| --- | --- | --- |
| **tick 周期** | `TICK_INTERVAL_MS = 30_000` | 同样 30s，可用更短（10s）因任务可能短小 |
| **重入保护** | `runningAutomations = new Set<string>()` | `runningTasks = new Set<string>()`，按 `taskId` 入队 |
| **超时保护** | `RUN_TIMEOUT_MS = 2h`，超时强制 `failed` | Kanban 任务超时阈值需按角色 tier 区分（heavy 4h / light 30min） |
| **防休眠** | `powerSaveBlocker.start('prevent-app-suspension')` | 长跑看板必须复用，避免系统休眠打断 tick |
| **bypassPermissions** | `permissionModeOverride: 'bypassPermissions'` | 工人默认 bypass；Verifier 任务可降级 auto |
| **防递归** | prompt 注入 `automationContext` 警告别再创建定时任务 | 工人 prompt 注入 `kanbanContext` 警告别再 `kanban_create_board`（`delegationDepth >= 1` 不注入工具即可） |
| **session 模式** | `daily` / `reuse` 二选一 | Kanban 工人**始终新建子会话**（不复用），避免跨任务污染 |
| **失败退避** | 连续失败达上限自动暂停 | Kanban 任务级独立失败，不暂停整个 board |
| **启动恢复** | 过期 `nextRunAt` 顺延到下个完整间隔 | Kanban 启动时把 `running` 任务标 `interrupted`，由 dispatcher 重新派工 |
| **广播变更** | `broadcastChanged()` 通过 `BrowserWindow.getAllWindows()` 发 IPC | Kanban 用 `KANBAN_IPC_CHANNELS.CHANGED` 同模式 |
| **来源会话忙时跳过** | `isAgentSessionActive(sourceSessionId)` 跳过本轮 | Kanban 工人不依赖来源会话状态，但 board.parentSessionId 忙时可延迟通知 |

**关键发现**：
- `runAgentHeadless(input, callbacks)`（`agent-service.ts:207`）已对接 `orchestrator.sendMessage`，并自动注册主窗口 `webContents` 让事件同步推送到桌面 UI。**Kanban 工人子会话会自动出现在侧栏**，无需额外接线。
- `triggeredBy: string` 字段（`agent.ts:1045`）已是开放字符串，可直接传 `'kanban'`，**无需类型变更**。

### 2.3 Bridge 通知（已有，Phase C 复用）

| Bridge | 现状 | Kanban 复用 |
| --- | --- | --- |
| `feishu-bridge-manager.ts` | 已合入 main，Automation M3 已实测发送卡片 | Phase C 首选通知渠道 |
| `wechat-bridge.ts` | MVP 文本链路 | Phase C 需补富文本/卡片 |
| `wps-bridge.ts` | MVP 文本链路 | Phase C 需补富文本/卡片 |
| `dingtalk-bridge` | 未实现 | Phase D 可选 |
| `bridge-command-handler.ts` | 入站消息路由 | Phase C 入站「暂停 / 继续 / 改需求」命令解析 |

**关键发现**：
- `packages/shared` 的 `NotificationConfig` 已预留 `wechat/wps` 字段，但 `automation-notification-service.ts` 目前仅实现 `system + feishu`。Kanban Phase C 需要补 `wechat/wps` 发送逻辑，**这部分可与 Automation M4 共用**。

### 2.4 SQLite 基础设施（已就绪）

| 模块 | 路径 | Kanban 参考 |
| --- | --- | --- |
| `better-sqlite3` 依赖 | 已安装并打包（`electron-builder.yml` 已包含 `node_modules/better-sqlite3/**/*`） | 直接用 |
| esbuild 配置 | `--external:better-sqlite3` 已配置 | 直接用 |
| SQLite 服务参考 | `memory-layer-service.ts` / `asset-store-service.ts` | WAL 模式 + FTS5（如需搜任务） |
| 数据库路径辅助 | `getConfigDir()`（`config-paths.ts`） | `~/.tagent[-dev]/kanban.db` |

---

## §3 Phase A/B/C 风险与依赖矩阵

### 3.1 依赖矩阵

| Phase | 依赖项 | 现状 | 风险等级 |
| --- | --- | --- | --- |
| **A** | `agent-headless-runner-registry.ts` | ✅ 已就绪 | 🟢 低 |
| **A** | `better-sqlite3` + esbuild external | ✅ 已配置 | 🟢 低 |
| **A** | `runAgentHeadless(input, callbacks)` | ✅ 已就绪 | 🟢 低 |
| **A** | `triggeredBy: 'kanban'` 字符串字段 | ✅ 已是 `string` | 🟢 低 |
| **A** | `AgentExternalRunSource` 扩展 `'kanban'` | ❌ 当前缺 | 🟡 中（可暂用 `'bridge'` 兜底） |
| **B** | Phase A 通过 | ⏳ 探索中 | 🟡 中 |
| **B** | `builtin-mcp/` 注册框架 | ✅ 已有（MCP 设置页集成） | 🟢 低 |
| **B** | `agent-orchestrator.ts` 工具注入接口 | ✅ 已有（`injectTATools` 先例） | 🟢 低 |
| **B** | `agent-role-profiles.ts` 持久化 | ❌ 新建（参考 `channels.json` 模式） | 🟡 中 |
| **B** | `kanban-decomposer.ts` LLM 调用 | ❌ 新建 | 🟠 高（拆解质量影响整体可用性） |
| **C** | Phase B 通过 | ⏳ | 🟠 高 |
| **C** | `feishu-bridge` 卡片发送 | ✅ 已有 | 🟢 低 |
| **C** | `wechat/wps-bridge` 富文本/卡片 | ❌ 仅 MVP 文本 | 🟠 高 |
| **C** | `KanbanBoardView.tsx` UI 组件 | ❌ 新建 | 🟡 中 |
| **C** | 入站命令解析（暂停/继续） | ❌ 新建（参考 `bridge-command-handler.ts`） | 🟡 中 |

### 3.2 风险矩阵

| 风险 | Phase | 应对 |
| --- | --- | --- |
| **SQLite 文件锁冲突**（多进程/多窗口） | A | WAL 模式 + 单例 connection；与 `memory-layer-service` 同模式 |
| **dispatcher tick 漂移**（系统休眠） | A | `powerSaveBlocker`（借鉴 automation）；任务执行期间启动 blocker |
| **工人递归创建看板** | A/B | 子会话不注入 `kanban_*` 工具（`delegationDepth >= 1` 不注入） |
| **跨重启 running 任务丢失** | A | 启动时扫描 `status='running'` → 标 `interrupted` → re-queue 或 fail |
| **工人失败风暴**（同一任务反复失败） | A | 单任务最大重试次数（默认 3）；超限自动 `failed` |
| **IM 刷屏** | C | 仅里程碑事件推送（`board_created` / `task_done` / `board_completed`）；`task_started` 合并 heartbeat |
| **kscc 并发过高** | B/C | `maxConcurrent` 默认 3；`heavy` 档角色限 2 并发 |
| **跨渠道污染**（父会话 kscc、子任务外部 API） | B | 看板内任务**强制继承 board.channelId**，dispatcher 派工时校验 |
| **decomposer 拆解质量差** | B | Phase B 验收门槛：3 任务依赖链正确；Phase D 加 Verifier 验收 |
| **TA 模式误接入** | A/B | v1 强制 `mode === 'general'`；TA 会话不能创建看板 |
| **MCP 工具与现有 SubAgent 体系冲突** | B | 不删 SubAgent；Kanban 走子会话，SubAgent 仍干小活（设计 §2.3） |

### 3.3 跨 Phase 边界（明确不做的）

| 边界 | 理由 |
| --- | --- |
| Phase A 不做 MCP 工具注入 | 内核稳定性优先；MCP 注入会引入 orchestrator 耦合 |
| Phase B 不做 IM 卡片 | 工具链先成型，通知后置 |
| Phase C 不做角色库 UI | 设置页改动放到 Phase B 一起做 |
| Phase D 不阻塞发布 | Verifier / blackboard / 自动分档均为增强 |

---

## §4 kscc 多模型分工建议

### 4.1 kscc 档位现状

参考 [`2026-06-25-kscc-internal-provider-design.md`](2026-06-25-kscc-internal-provider-design.md)：

| 档位 | 代表模型 | 适用场景 | 成本 |
| --- | --- | --- | --- |
| **重档（heavy）** | `glm-5.2` | 复杂推理、长上下文、代码生成 | 高 |
| **中档（medium）** | `glm-5.1` | 常规开发、文档撰写、测试用例 | 中 |
| **轻档（light）** | `mimo-v2.5-pro` 等 | 搜索、读取、简单归类、短回答 | 低 |

### 4.2 角色到档位的映射建议

| 角色 | 推荐档位 | 理由 |
| --- | --- | --- |
| **主 Agent（分解器）** | heavy（`glm-5.2`） | 需理解整体目标、拆解任务树、建依赖关系；上下文长、推理深 |
| **产品经理角色** | medium（`glm-5.1`） | 需求分析、PRD 撰写；语言任务为主，少代码 |
| **后端开发角色** | heavy（`glm-5.2`） | 代码生成、架构决策；推理深度要求高 |
| **前端开发角色** | heavy（`glm-5.2`） | 同上，UI 逻辑复杂 |
| **测试角色** | medium（`glm-5.1`） | 测试用例生成、回归验证；模式化任务多 |
| **文档角色** | medium（`glm-5.1`） | 文档撰写、API 描述；语言任务 |
| **搜索/调研角色** | light（`mimo-v2.5-pro`） | GitHub 搜索、issue 归类、链接提取；短输出 |
| **Verifier 角色**（Phase D） | heavy（`glm-5.2`） | 需判断工人产出是否达标；推理深度要求高 |
| **通知摘要角色** | light（`mimo-v2.5-pro`） | 把工人 `resultSummary` 浓缩成 IM 卡片文案；短输出 |

### 4.3 路由实现建议

| 路由层级 | 实现位置 | 字段 |
| --- | --- | --- |
| **角色默认档位** | `AgentRoleProfile.modelId`（设计 §3.3） | 用户可在角色库 UI 覆盖 |
| **任务级覆盖** | `KanbanTask.modelId`（设计 §3.1） | 主 Agent 拆解时可指定 |
| **看板级默认** | `KanbanBoard.channelId`（设计 §3.2） | 整板继承，避免跨渠道 |
| **tier 提示** | `AgentRoleProfile.tier: 'heavy' \| 'medium' \| 'light'` | 供调度器并发控制（heavy 限 2 并发） |

### 4.4 成本控制策略

- **降档触发**：单任务 token 超过阈值（如 50K）时，下次同类任务自动降一档试跑
- **heavy 限额**：`maxConcurrentHeavy = 2`，避免 kscc 内网配额耗尽
- **light 兜底**：所有 `kanban_list` / `kanban_show` 工具调用走 light 档（这些是元信息查询，不需要重模型）
- **外部 API fallback**：kscc 不可用时降级到用户配置的外部 API（按成本敏感度排序：DeepSeek > 智谱 > Anthropic）

### 4.5 Phase A 探索期模型绑定

Phase A 不接角色库，测试时硬编码：

```typescript
// 探索期 mock
const testRoles = {
  heavy: { modelId: 'glm-5.2', permissionMode: 'bypassPermissions' },
  medium: { modelId: 'glm-5.1', permissionMode: 'bypassPermissions' },
  light: { modelId: 'mimo-v2.5-pro', permissionMode: 'bypassPermissions' },
}
```

Phase B 接入角色库后切换为 `resolveRole(task.roleId).modelId`。

---

## §5 手工 E2E 验证清单

### 5.1 桌面端（Phase A 必做）

| # | 场景 | 步骤 | 期望 |
| --- | --- | --- | --- |
| 1 | **依赖链顺序执行** | 创建看板 + 任务 A、B（依赖 A）、C（依赖 B）→ 启动 dispatcher | 60s 内全 `done`，执行顺序 [A, B, C] |
| 2 | **并发上限** | 创建 5 个无依赖 ready 任务，`maxConcurrent=3` | 同时 running ≤ 3，剩余 2 等 slot 释放 |
| 3 | **任务失败** | mock WorkerRunner 抛错 | 任务 `failed` + `error` 字段写入；其他任务不受影响 |
| 4 | **超时保护** | mock WorkerRunner 永不回调 | 超时后 `failed`，error 含「执行超时」 |
| 5 | **跨重启恢复** | 任务 running 中关闭应用 → 重启 | 启动后任务标 `interrupted`，dispatcher re-queue 或按策略 fail |
| 6 | **依赖解除** | 任务 A `cancelled` → 依赖 A 的 B | B 自动 `ready`（依赖链断裂允许执行）或 `blocked`（按策略二选一，Phase A 选 ready） |
| 7 | **子会话可见** | 任意任务 running | 桌面侧栏出现子会话项，标题含任务名 |
| 8 | **bypassPermissions 生效** | 工人需写文件 | 不弹权限框，直接写入 |
| 9 | **防递归** | 工人 prompt 含「创建看板」 | 工人不调用 `kanban_*` 工具（Phase A 未注入即可验证） |

### 5.2 桌面端（Phase B 追加）

| # | 场景 | 步骤 | 期望 |
| --- | --- | --- | --- |
| 10 | **MCP 工具注入** | 主 Agent 说「拆 3 条线做 X」 | 看板出现 3 任务，依赖关系合理 |
| 11 | **角色库 CRUD** | 设置页新增「后端开发」角色并绑 `glm-5.2` | 任务派工时使用该角色模型 |
| 12 | **任务级 modelId 覆盖** | 主 Agent 拆解时指定某任务用 `mimo-v2.5-pro` | 该任务子会话实际用轻档 |
| 13 | **decomposer 拆解质量** | 输入「做一个用户登录模块」 | 至少拆出 3 个合理子任务（前端/后端/测试） |

### 5.3 IM mock（Phase C 必做）

| # | 场景 | 步骤 | 期望 |
| --- | --- | --- | --- |
| 14 | **飞书创建看板** | 飞书机器人收到「做完 X 需求」 | 主 Agent 创建看板 → 飞书收到 `board_created` 卡片 |
| 15 | **task_started 通知** | dispatcher 派工 | 飞书收到「任务 X 进行中」卡片（合并 heartbeat，5min 一次） |
| 16 | **task_done 通知** | 工人完成 | 飞书收到「任务 X 完成」卡片 + 摘要 |
| 17 | **task_blocked 通知** | 工人 `kanban_block` | 飞书收到「任务 X 等待确认」+ 阻塞原因 |
| 18 | **board_completed 通知** | 所有任务 done | 飞书收到汇总卡片 + 桌面 deep link |
| 19 | **入站命令「暂停」** | 飞书回复「暂停」 | dispatcher 停止派新任务，running 任务完成后停 |
| 20 | **入站命令「继续」** | 飞书回复「继续」 | dispatcher 恢复 tick |
| 21 | **微信 mock**（可选） | 微信发需求 | 同 14-18，至少 1 条卡片实测通过 |
| 22 | **WPS mock**（可选） | WPS 发需求 | 同 14-18，至少 1 条卡片实测通过 |

### 5.4 失败与边界

| # | 场景 | 期望 |
| --- | --- | --- |
| 23 | **kscc 不可用** | 工人失败 → 任务 `failed`，error 含「kscc CLI 不可用」；不影响其他渠道任务 |
| 24 | **跨渠道污染尝试** | 父会话 kscc、任务指定外部 API modelId | dispatcher 拒绝派工，任务 `blocked` + 原因 |
| 25 | **TA 模式尝试创建看板** | TA 会话调用 `kanban_create_board` | 工具不注入，Agent 收到「TA 模式不支持看板」提示 |
| 26 | **递归看板尝试** | 工人子会话调用 `kanban_create_board` | 工具不注入（`delegationDepth >= 1`） |
| 27 | **超大板（50 任务）** | 创建 50 任务看板 | dispatcher 稳定 tick，SQLite 查询 < 50ms |

---

## §6 下一步决策点

### 6.1 Phase A 通过后是否继续 Phase B

**判定标准**（全部满足 → 继续 Phase B）：

- [ ] §5.1 桌面端 9 个场景全部通过
- [ ] 单测覆盖 ≥ 80%（依赖 DAG、并发上限、状态机、跨重启恢复）
- [ ] `bun run typecheck` 4 包全通过
- [ ] Worker A 交付的 `kanban-worker-service.ts` 桥接跑通（工人能拉起子会话）
- [ ] Worker A 交付的 `kanban-agent-tools.ts` schema 定义完整（5 个工具 JSON Schema）

**若任一不满足**：
- 内核稳定性问题 → 留在 `feature/kanban-exploration` 修复，不合 main
- 桥接问题 → 评估是否需要先做 `AgentExternalRunSource` 扩展（加 `'kanban'` 联合成员）

### 6.2 是否先做完整 Collaboration MCP（7 工具）

**结论：不先做。**

| 维度 | 先做 Collaboration | 直接做 Kanban |
| --- | --- | --- |
| 工作量 | 7 工具 + 阻塞冒泡 + UI = 2-3 周 | Phase A 1-1.5 周 + Phase B 1.5-2 周 |
| 必要性 | Kanban 工人**不需要** `delegate_agent`（dispatcher 直接派工） | Kanban 是任务大脑，Collaboration 是执行层 |
| 风险 | Proma 路线与最终架构偏离（设计 §0.3 已降级 Collaboration） | 直接对齐终态架构 |
| 复用 | Collaboration 的 `agent-collaboration-tools.ts` spawn 逻辑 → Kanban 工人复用 | Kanban 工人走 `runRegisteredHeadlessAgent`，**不依赖** Collaboration MCP |

**理由**：
1. 设计文档 [`2026-06-30-task-kanban-orchestration-design.md`](2026-06-30-task-kanban-orchestration-design.md) §0.3 已明确「Collaboration 降级为执行层（工人）」，Kanban 是任务大脑。
2. Kanban 工人通过 `runRegisteredHeadlessAgent`（已就绪）拉起子会话，**不需要** Collaboration 的 `delegate_agent` MCP 工具。
3. Proma Collaboration 的 7 工具中，Kanban 只需要 borrow `spawn 子会话 + complete 回流` 的逻辑，**这部分由 `kanban-worker-service.ts`（Worker A）直接实现**，不需要先做完整 MCP。
4. Phase B 的 `kanban-agent-tools.ts` 是**面向主 Agent**的工具集（`kanban_create` / `kanban_list` / `kanban_complete` 等），与 Collaboration 的 `delegate_agent` 是不同维度。

**留待 Phase D 评估**：
- 是否需要 `continue_delegation`（工人多次追加上下文）→ Kanban 任务 `blocked` 状态可承担类似角色
- 是否需要 `wait_for_delegations` → dispatcher tick 已覆盖等待语义
- 是否需要阻塞事件冒泡（`answer_delegation_question`）→ Kanban `task_blocked` + IM 回复「继续」可承担

### 6.3 IM 优先级

| 渠道 | Phase C 优先级 | 理由 |
| --- | --- | --- |
| **飞书** | P0（必做） | Bridge 已通，Automation M3 已实测卡片发送 |
| **微信** | P1（建议做） | 用户主场景；目前仅 MVP 文本，需补富文本 |
| **WPS** | P2（可选） | 用户主场景；同微信，需补富文本 |
| **钉钉** | P3（不做） | 未实现，Phase D 评估 |

### 6.4 与 Automation M4 的协同

| 协同点 | 建议 |
| --- | --- |
| **wechat/wps 卡片发送** | Kanban Phase C 与 Automation M4 共用同一发送层（`bridge-notification-service.ts`） |
| **失败重试** | Automation M4 可定时扫 Kanban `failed` 任务，按策略重试 |
| **custom cron** | Automation M4 的 custom cron 可触发「定时检查 stale 看板」 |
| **资源隔离** | 两者都走 `runRegisteredHeadlessAgent`，需共享 `maxConcurrent` 全局上限避免 kscc 配额耗尽 |

### 6.5 探索期不引入正式分支

- **当前**：`feature/kanban-exploration` 探索分支，三路工人并行 spike
- **Phase A 通过后**：评估是否合入 `main` 作为 Phase A 验收基线，或保留探索分支继续 Phase B
- **Phase B 启动时**：新开 `feature/task-kanban-orchestration` 正式分支（设计 §0 建议分支名）
- **不合入 main 的情况**：Phase A 发现架构性问题（如 SQLite 文件锁不可控、dispatcher tick 漂移无法修复）→ 重新评估设计

---

## 附录 A：探索分支交付物清单

| 工人 | 交付物 | 状态 |
| --- | --- | --- |
| Worker S | `packages/shared/src/types/kanban.ts` | ⏳ 进行中 |
| Worker S | `apps/electron/src/main/lib/kanban-db.ts` | ⏳ 进行中 |
| Worker S | `apps/electron/src/main/lib/kanban-dispatcher.ts` | ⏳ 进行中 |
| Worker S | `kanban-db.test.ts` + `kanban-dispatcher.test.ts` | ⏳ 进行中 |
| Worker A | `apps/electron/src/main/lib/kanban-worker-service.ts` | ⏳ 进行中 |
| Worker A | `apps/electron/src/main/lib/kanban-agent-tools.ts` | ⏳ 进行中 |
| Worker A | `kanban-worker-service.test.ts` | ⏳ 进行中 |
| Worker B（本文） | `docs/plans/2026-06-30-kanban-exploration-report.md` | ✅ 本文 |
| Worker B | `docs/plans/2026-06-30-task-kanban-orchestration-design.md` 更新 | ✅ §0.2/§0.4/Last updated |
| Worker B | `docs/PROGRESS.md` 更新 | ✅ 当前状态 + 进行中表格 |

## 附录 B：参考路径速查

| 内容 | 路径 |
| --- | --- |
| Kanban 主设计 | `docs/plans/2026-06-30-task-kanban-orchestration-design.md` |
| Collaboration 执行层参考 | `docs/plans/2026-06-24-collaboration-design.md` |
| headless 注册表 | `apps/electron/src/main/lib/agent-headless-runner-registry.ts` |
| headless 先例（automation） | `apps/electron/src/main/lib/automation-scheduler.ts` |
| headless 实现 | `apps/electron/src/main/lib/agent-service.ts:207` `runAgentHeadless` |
| Agent 编排 | `apps/electron/src/main/lib/agent-orchestrator.ts` |
| 模型路由 | `apps/electron/src/main/lib/agent-model-routing.ts` |
| Bridge 入站 | `apps/electron/src/main/lib/bridge-command-handler.ts` |
| 飞书 Bridge | `apps/electron/src/main/lib/feishu-bridge-manager.ts` |
| 通知服务参考 | `apps/electron/src/main/lib/automation-notification-service.ts` |
| SQLite 参考 | `apps/electron/src/main/lib/memory-layer-service.ts` |
| 配置目录辅助 | `apps/electron/src/main/lib/config-paths.ts` |
| AgentExternalRunSource 类型 | `packages/shared/src/types/agent.ts:729` |
| AgentSendInput.triggeredBy | `packages/shared/src/types/agent.ts:1045` |

---

**最后更新**：2026-06-30 — Phase A 探索期初稿，Worker S/A 交付后据实修订 §1.3 成功判据与 §6.1 决策清单。

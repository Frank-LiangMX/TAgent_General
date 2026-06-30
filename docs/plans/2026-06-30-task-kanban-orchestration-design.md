# TAgent 任务看板编排（Kanban Orchestration）系统设计

> **状态**：Draft v1.1 — **Phase A 探索中**（上游 v0.13.4 已合 main，PR #16；探索分支 `feature/kanban-exploration`）
> **日期**：2026-06-30
> **决策拍板**：2026-06-30 — 采用 **Hermes 式 Kanban + 调度器** 作为长任务多 Agent 的主线，而非仅移植 Proma 轻量 Collaboration
> **前置条件**：~~`feature/upstream-v0.13.4-alignment` 全部验收并合入 `main` 后再开新分支~~ ✅ 已合 main（PR #16）；Phase A 探索在 `feature/kanban-exploration` 进行
> **建议分支**：`feature/task-kanban-orchestration`（Phase A 通过后正式开分支）
> **关联文档**：  
> - [`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md) — Proma 路线（执行层参考，非最终架构）  
> - [`2026-06-24-automation-design.md`](2026-06-24-automation-design.md) — 定时任务（与看板互补）  
> - [`2026-06-25-kscc-internal-provider-design.md`](2026-06-25-kscc-internal-provider-design.md) — 内网多模型档位  
> - [`2026-06-30-upstream-alignment-tracker.md`](2026-06-30-upstream-alignment-tracker.md) — 当前进行中主线  
> - Hermes 参考：[`Kanban 文档`](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban) / 本地 `F:\hermes-agent`（若存在）

---

## 0. 新会话 Handoff（必读）

### 0.1 这是什么

TAgent 的**长任务多 Agent 编排**能力：用户从**桌面 / 微信 / WPS / 飞书**下达目标 → 主 Agent 拆任务 → **任务持久化在看板数据库** → **调度器循环派工** → 每条任务由 **Collaboration 子会话（headless Agent）** 执行 → **IM 推送结构化进度**。

### 0.2 现在能不能做

**可以开始 Phase A 探索。** 上游 v0.13.4 对齐已合入 `main`（PR #16，`feature/upstream-v0.13.4-alignment`），探索工作在独立分支 `feature/kanban-exploration` 上进行。Phase A 通过后再开正式分支 `feature/task-kanban-orchestration`。

| 上游项 | 与本项目关系 |
| --- | --- |
| P1-3 Proma Collaboration 移植 | 本设计**吸收其执行层**（子会话 + MCP），但**不以 Proma 轻量方案为终态** |
| P1-4 headless runner + Stop hook | **已就绪** — `agent-headless-runner-registry.ts` + `runAgentHeadless` 已合 main，看板工人直接复用 |
| P1-2 automation MCP | 已有，看板长跑任务可复用 bypass 权限思路 |
| Bridge 自愈 P1-1 | 已有，IM 长任务通知依赖 Bridge 稳定 |

> 探索期具体验证范围、风险矩阵、E2E 清单见 [`2026-06-30-kanban-exploration-report.md`](2026-06-30-kanban-exploration-report.md)。

### 0.3 与 Proma / Hermes 的关系（一句话）

| 方案 | 角色 |
| --- | --- |
| **Proma Collaboration** | borrow **子会话执行 + MCP 工具形态** |
| **Hermes Kanban** | borrow **SQLite 看板 + 调度器 + 任务依赖** |
| **TAgent 差异化** | **桌面 + kscc/外网双渠道 + 微信/WPS/飞书 IM + 可扩展角色库** |

### 0.4 开新会话时第一句话建议

```
请先读 docs/plans/2026-06-30-kanban-exploration-report.md 了解 Phase A 探索范围与验收清单，
再读 docs/plans/2026-06-30-task-kanban-orchestration-design.md §0 和 §9 里程碑，
确认上游 v0.13.4 已合 main（PR #16），然后从 Phase A 开始实现。
```

---

## 1. 背景与产品目标

### 1.1 用户场景

1. 用户在 **微信 / WPS** 发：「把这个大需求做完」  
2. 主 Agent 拆成 N 条工作线（产品、开发、测试、文档… — **角色数量不限**）  
3. 用户可走开；Agent **后台循环**执行，IM 推送进度卡片  
4. 桌面侧栏可看板 + 子会话详情；用户可在 IM 回复「继续 / 停 / 改需求」  
5. 内网 kscc：**多档免费模型**按角色绑定；外网 API：按成本降档  

### 1.2 为什么不用「纯 Proma Collaboration」

Proma Collaboration = 主 Agent 在**对话内** `delegate_agent` + `wait_for_delegations`，状态主要在内存 Map + 会话 meta。

| 需求 | Proma Collaboration | Kanban 方案 |
| --- | --- | --- |
| 跑几小时 / 跨重启 | 弱 | 强（SQLite 持久化） |
| 50+ 任务 + 依赖 | 弱 | 强 |
| 人走开自动推进 | 需大量补丁 | 调度器原生 |
| IM 结构化进度 | 需自建数据源 | 看板状态 → 通知 |
| 验收门禁 | 靠 Agent 自觉 | Verifier 任务类型 |

**结论**：Collaboration 作为**工人（执行单元）**保留；**Kanban 作为任务大脑**。

### 1.3 三层架构（核心概念）

```
┌─────────────────────────────────────────────────────────┐
│  IM 层（已有 Bridge）                                     │
│  微信 / WPS / 飞书 / 钉钉 — 下单、通知、审批、简单回复      │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  编排层（本设计新建）                                      │
│  主 Agent 分解 → Kanban DB → Dispatcher 调度循环          │
└───────────────────────────┬─────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────┐
│  执行层（borrow Proma Collaboration + headless）          │
│  每个「进行中」任务 → 一个 Agent 子会话 headless 执行       │
└─────────────────────────────────────────────────────────┘
```

**IM ≠ Kanban**：IM 是人和系统的窗口；Kanban 是 Agent 之间的工单系统。详见本文 §2.4。

---

## 2. 概念对照

### 2.1 与 Hermes 的差异

| 维度 | Hermes Kanban | TAgent 本设计 |
| --- | --- | --- |
| 任务存储 | `~/.hermes/kanban.db` | `~/.tagent/kanban.db`（或 `~/.tagent-dev/`） |
| 工人 | 独立 OS 进程 + profile | **headless Agent 子会话**（Collaboration） |
| 人类入口 | Telegram 等 | **微信/WPS/飞书 + 桌面**（已有 Bridge） |
| 角色 | YAML profile | **设置页角色库**（数量不限） |
| 模型 | 多 provider | **kscc 内网 + 外部 API**，按角色绑档 |

### 2.2 与 OpenClaw 的差异

OpenClaw 是独立 Gateway 编排平台；TAgent 是**桌面 App 内置**看板，不另装 Gateway。

### 2.3 与现有 SubAgent 的关系

| | SDK SubAgent（已有） | Collaboration 子会话 | Kanban 任务 |
| --- | --- | --- | --- |
| 可见性 | 不可见 | 侧栏可见 | 看板 + 侧栏 |
| 触发 | SDK 自动 | 调度器 / MCP | Dispatcher |
| 持久化 | 无 | 会话 meta | **SQLite 行** |
| 去留 | **保留**，干小活 | 看板工人的载体 | 新增 |

**不删除 SubAgent。** 小探索仍走 SDK SubAgent；看板任务走子会话。

### 2.4 IM vs Kanban（给后续读者）

| | IM | Kanban |
| --- | --- | --- |
| 类比 | 微信工作群 | Jira / 飞书多维表格 |
| 存什么 | 聊天消息 | 任务卡片、状态、依赖 |
| 谁消费 | 人类 | 调度器 + Agent 工具 |
| TAgent 现状 | ✅ Bridge 已通 | ❌ 未建 |

---

## 3. 数据模型

### 3.1 看板任务 `KanbanTask`

存储：`~/.tagent/kanban.db`（SQLite，WAL 模式）

```typescript
export type KanbanTaskStatus =
  | 'pending'      // 待办（依赖未满足）
  | 'ready'        // 可领取
  | 'running'      // 执行中
  | 'blocked'      // 等待输入/权限/外部
  | 'review'       // 待验收（Verifier）
  | 'done'         // 完成
  | 'failed'       // 失败
  | 'cancelled'    // 取消

export interface KanbanTask {
  id: string                    // t_xxxx
  boardId: string               // 所属看板（通常 = 父会话 ID 或 rootGoalId）
  parentTaskId?: string         // 父任务（分解树）
  title: string
  body: string                  // 给工人的 prompt
  status: KanbanTaskStatus
  roleId?: string               // 绑定角色库 ID（见 §3.3）
  assigneeSessionId?: string    // 执行子会话 ID
  channelId: string             // 继承根任务，不跨渠道
  modelId?: string              // 可由 roleId 解析
  priority: number
  createdAt: number
  updatedAt: number
  startedAt?: number
  finishedAt?: number
  error?: string
  resultSummary?: string        // 工人完成后摘要
  blockedReason?: string
  metadata?: Record<string, unknown>  // blackboard 共享上下文 JSON
}
```

### 3.2 看板 `KanbanBoard`

```typescript
export interface KanbanBoard {
  id: string
  rootGoal: string              // 用户原始目标
  parentSessionId: string       // 发起会话
  originChatId?: string         // IM 来源（Bridge 绑定，用于推通知）
  originBridge?: 'wechat' | 'wps' | 'feishu' | 'dingtalk' | 'desktop'
  status: 'active' | 'completed' | 'cancelled'
  createdAt: number
  updatedAt: number
}
```

### 3.3 角色库 `AgentRoleProfile`（设置页，数量不限）

存储：`~/.tagent/agent-roles.json`

```typescript
export interface AgentRoleProfile {
  id: string                    // role_pm, role_dev, ...
  name: string                  // 产品经理 / 后端开发 / 测试 / …
  description: string           // 给主 Agent 和调度器看的说明
  systemPromptSnippet: string   // 注入工人子会话
  channelId?: string            // 默认继承 board；可选覆盖
  modelId: string               // glm-5.2 / glm-5.1 / mimo-v2.5 / claude-...
  permissionMode: 'auto' | 'bypassPermissions'
  tier?: 'heavy' | 'medium' | 'light'  // 可选，供路由提示
  enabled: boolean
}
```

**不是固定 3 个角色。** 默认可提供模板（产品/开发/测试），用户可无限新增。

### 3.4 任务依赖

```typescript
export interface KanbanTaskLink {
  fromTaskId: string
  toTaskId: string
  type: 'blocks' | 'relates'
}
```

`to` 被 `from` 阻塞：`from` 非 `done` 时 `to` 保持 `pending`。

---

## 4. 模块清单

```
apps/electron/src/main/lib/
├── kanban-db.ts                      # SQLite CRUD + 迁移
├── kanban-dispatcher.ts              # tick 循环：ready → running → 派工
├── kanban-decomposer.ts              # 大目标 → 任务树（LLM，可选独立模块）
├── kanban-agent-tools.ts             # MCP: kanban_* 工具集
├── kanban-notification-service.ts    # 状态变更 → IM 卡片
├── agent-collaboration-tools.ts      # borrow Proma：spawn 工人子会话
├── agent-collaboration-utils.ts
├── agent-headless-runner-registry.ts # borrow Proma：解循环依赖
└── agent-role-profiles.ts            # 角色库读写

apps/electron/src/renderer/
├── components/kanban/
│   ├── KanbanBoardView.tsx           # 看板 UI（Phase C）
│   └── KanbanTaskCard.tsx
└── components/settings/
    └── AgentRoleSettings.tsx         # 角色库配置（Phase B）

packages/shared/src/types/
├── kanban.ts
└── agent-role.ts
```

---

## 5. 核心流程

### 5.1 创建长跑任务

```
用户（IM 或桌面）→ 主 Agent 收到 rootGoal
  → kanban_create_board(rootGoal, parentSessionId, originChatId?)
  → decomposer 生成任务树写入 kanban.db
  → IM 推送：「已创建看板，共 N 个任务」
  → dispatcher 开始 tick
```

### 5.2 调度循环（Dispatcher）

伪代码：

```typescript
// 每 5–10s tick，与 automation-scheduler 类似，抗休眠
async function kanbanDispatcherTick() {
  const readyTasks = listTasks({ status: 'ready' }).slice(0, maxConcurrent)
  for (const task of readyTasks) {
    if (runningCount >= maxConcurrent) break
    const role = resolveRole(task.roleId)
    const session = createAgentSession(..., {
      parentSessionId: board.parentSessionId,
      sourceKanbanTaskId: task.id,
      delegationRole: mapRoleToDelegationRole(role),
    })
    markTaskRunning(task.id, session.id)
    runRegisteredHeadlessAgent({ sessionId, userMessage: task.body, modelId: role.modelId, ... })
      .then(() => completeTask(task.id))
      .catch((e) => failTask(task.id, e))
    notifyIm(board, { type: 'task_started', task })
  }
  promotePendingToReady()  // 依赖满足 → pending → ready
  if (boardAllDone(board)) notifyIm(board, { type: 'board_completed' })
}
```

### 5.3 MCP 工具集（主 Agent / 工人）

| 工具 | 调用方 | 作用 |
| --- | --- | --- |
| `kanban_create` | 主 Agent | 创建子任务 |
| `kanban_list` | 主/调度 | 列出任务 |
| `kanban_show` | 工人 | 当前任务详情 |
| `kanban_complete` | 工人 | 标记完成 + 摘要 |
| `kanban_block` | 工人 | 阻塞（缺信息） |
| `kanban_comment` | 任意 | blackboard 注释 |
| `kanban_link` | 主 Agent | 建依赖 |
| `kanban_unblock` | 主/用户 | 解除阻塞 |

工人 spawn 时注入 env `TAGENT_KANBAN_TASK_ID=t_xxxx`（对标 Hermes `HERMES_KANBAN_TASK`）。

### 5.4 IM 进度通知

复用 Bridge 发送能力 + 扩展 `kanban-notification-service.ts`：

| 事件 | 推送渠道 | 内容示例 |
| --- | --- | --- |
| `board_created` | 来源 IM | 「已开始，共 8 个任务」 |
| `task_started` | 同上 | 「开发模块 A · 进行中」 |
| `task_done` | 同上 | 「开发模块 A · 完成」 |
| `task_blocked` | 同上 | 「测试 · 等待你确认 xxx」 |
| `board_completed` | 同上 | 汇总 + 桌面 deep link |

**注意**：`packages/shared` 的 `NotificationConfig` 已预留 wechat/wps 字段；Automation 通知目前仅实现 system + feishu。本 Phase 需补齐 wechat/wps 发送。

频率控制：里程碑推送，禁止每 tool call 一条（防刷屏）。

---

## 6. 与现有模块集成

| 现有模块 | 集成方式 |
| --- | --- |
| `bridge-command-handler.ts` | 入站消息可触发「创建看板」；会话 meta 存 `originChatId` |
| `automation-scheduler.ts` | 独立；看板是事件驱动。未来可「定时扫 stale 任务」 |
| `agent-model-routing.ts` | 工人 modelId 由角色库解析；kscc 内网按 tier 绑档 |
| `agent-orchestrator.ts` | headless 路径 `triggeredBy: 'kanban'` |
| `feishu-bridge-manager.ts` | 首版通知参考 `automation-notification-service.ts` |
| `wechat-bridge.ts` / `wps-bridge.ts` | Phase C 进度卡片 |

### 6.1 模式隔离

- v1 **仅 general 模式**可创建看板  
- TA 模式暂不接入（避免工具/MCP 污染）  
- 子工人会话 **禁止**再创建看板或 Collaboration（`delegationDepth >= 1` 不注入）

### 6.2 渠道隔离

- 看板内所有任务 **继承 board.channelId**  
- **禁止**父会话 kscc、子任务外部 API 混用（v1）

---

## 7. 实施里程碑（上游完成后执行）

### Phase A — 看板内核（必做，无 UI）

**目标**：SQLite + dispatcher + headless 工人闭环

| 交付 | DoD |
| --- | --- |
| `kanban-db.ts` | 建表、CRUD、依赖解析 |
| `kanban-dispatcher.ts` | tick 派工，maxConcurrent 可配置（默认 5） |
| `agent-headless-runner-registry.ts` | 从 Proma 移植并接线 |
| 单测 | 依赖阻塞/解除、状态机、并发上限 |

**验收**：脚本/mock 创建 3 个任务（B 依赖 A）→ 自动顺序执行 → 全 done。

**估时**：1–1.5 周

---

### Phase B — MCP 工具 + 角色库

| 交付 | DoD |
| --- | --- |
| `kanban-agent-tools.ts` | 上表工具注入 orchestrator |
| `agent-role-profiles.ts` + 设置页 | 用户可 CRUD 角色，**不限数量** |
| `kanban-decomposer.ts` | 主 Agent 或独立 LLM 调用分解目标 |
| Proma collaboration 执行层 | 移植 `agent-collaboration-tools.ts` 中 spawn/complete 逻辑，改为 kanban 驱动 |

**验收**：桌面主 Agent 说「拆 3 条线做 X」→ 看板 3 任务 → 并行/依赖正确 → 子会话可见。

**估时**：1.5–2 周

---

### Phase C — IM 进度 + 桌面看板 UI

| 交付 | DoD |
| --- | --- |
| `kanban-notification-service.ts` | 飞书 + 微信 + WPS 至少各测通 1 次 |
| `KanbanBoardView.tsx` | 待办/进行中/完成列 |
| 侧栏 | 子会话 GitBranch + 关联任务 ID |
| IM 回复 | 「暂停」「继续」映射 `kanban_unblock` / stop |

**验收**：从微信下单 → 收 3+ 条进度卡片 → 桌面看板状态一致。

**估时**：1–1.5 周

---

### Phase D — 增强（可选）

- Verifier 验收任务类型（Hermes swarm 的 verifier/synthesizer）  
- 与 Automation 互通（定时检查 failed 任务重试）  
- 看板 blackboard 跨任务共享上下文  
- LLM 自动分档（role + tier 推荐）

**估时**：1–2 周

---

## 8. 上游对齐阶段如何处理 P1-3

当前 tracker 中 P1-3 写的是「Proma Collaboration 移植」。**与本设计关系**：

| 上游 P1-3 项 | 建议 |
| --- | --- |
| `agent-headless-runner-registry.ts` | **仍做** — Phase A 硬依赖 |
| `agent-collaboration-tools.ts` 全量 9 工具 | **可缩减** — 上游对齐只做 registry + 最小 spawn；完整 MCP 并入 Phase B |
| Collaboration 侧栏 UI | **可延后** — 随 Phase C 与看板 UI 一起做 |
| Proma `builtin-mcp/registry` | **不整包搬** — TAgent 继续 orchestrator 直接注入 |

**上游对齐完成后**，本 Epic **新分支**开发，不要挤在 `feature/upstream-v0.13.4-alignment` 里。

---

## 9. 风险与边界

| 风险 | 应对 |
| --- | --- |
| 范围膨胀 | 严格 Phase A→B→C，Phase D 不阻塞发布 |
| IM 刷屏 | 仅里程碑事件推送；合并「进行中」heartbeat 为 5min 可选 |
| kscc 并发过高 | maxConcurrent + heavy 档限 2 |
| 跨重启 | SQLite WAL；running → interrupted 标记，重启后 re-queue 或 fail |
| 与 Automation 混淆 | 命名空间：`kanban_*` vs `automation_*`；文档隔离 |

---

## 10. 测试要求

### 10.1 单测（80% gate）

- 任务依赖 DAG  
- pending → ready 提升  
- dispatcher 并发上限  
- 角色库 model 解析  
- 通知 trigger 条件  

### 10.2 集成

- 3 任务并行 + 1 依赖链  
- headless 工人 complete → 看板 done  
- IM mock 收卡片  

### 10.3 手工 E2E

- 微信发需求 → 看板 → 收完成通知  
- 桌面看板与子会话一致  
- kscc 三档角色各跑一条线  

---

## 11. 完成定义（Epic DoD）

- [ ] SQLite 看板 + dispatcher 生产可用  
- [ ] 角色库不限数量，设置页可配  
- [ ] 主 Agent 可分解长跑任务并自动循环完成  
- [ ] 至少 2 个 IM 渠道（含微信或 WPS）进度推送实测通过  
- [ ] 桌面看板 UI + 子会话可见  
- [ ] `bun run typecheck` + 核心单测 ≥80%  
- [ ] `docs/PROGRESS.md` + CHANGELOG 更新  

---

## 12. 参考路径

| 参考 | 路径 |
| --- | --- |
| Proma Collaboration | `F:\Proma\apps\electron\src\main\lib\agent-collaboration-tools.ts` |
| Proma headless registry | `F:\Proma\apps\electron\src\main\lib\agent-headless-runner-registry.ts` |
| Hermes Kanban 文档 | https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban |
| TAgent Automation 调度 | `apps/electron/src/main/lib/automation-scheduler.ts` |
| TAgent Bridge | `apps/electron/src/main/lib/bridge-command-handler.ts` |
| TAgent kscc 模型路由 | `apps/electron/src/main/lib/agent-model-routing.ts` |

---

## 13. 文档维护

| 事件 | 动作 |
| --- | --- |
| 上游对齐完成 | 更新本文 §0.2 为「可开始 Phase A」 |
| Phase 完成 | 更新 §7 表格状态 + PROGRESS.md |
| 设计变更 | 递增版本号，禁止 silent 改 scope |

**最后更新**：2026-06-30 — Phase A 探索期，上游 v0.13.4 已合 main（PR #16）；探索范围与验收清单见 [`2026-06-30-kanban-exploration-report.md`](2026-06-30-kanban-exploration-report.md)。

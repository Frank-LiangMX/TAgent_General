# TAgent 多 Agent 协作 v1 产品方案

> **状态**：Draft v1.0 — 产品 + 实现合一（可开工）
> **日期**：2026-06-30
> **前置**：上游 v0.13.4 已合 `main`；探索分支 `feature/kanban-exploration` 已有 Phase A 草稿
> **关联**：
> - 工程细节：[`2026-06-30-task-kanban-orchestration-design.md`](2026-06-30-task-kanban-orchestration-design.md)
> - 草稿上游：[`2026-06-25-draft-restructure-design.md`](2026-06-25-draft-restructure-design.md)
> - 探索报告：[`2026-06-30-kanban-exploration-report.md`](2026-06-30-kanban-exploration-report.md)

---

## 0. 一句话

**草稿想清楚 → 主会话拆单 → SQLite 看板调度 → 每条任务一个 kscc/渠道子会话；UI 在主会话内「对话 + 团队」Tab，侧栏不堆工人；长任务靠托盘后台，不另装 Gateway。**

---

## 1. 定位（和市面方案的差异）

| 维度 | 市面常见（OpenClaw / Octomux） | TAgent v1 |
| --- | --- | --- |
| 编排 | 独立 Gateway / Web 总控 | **Electron 主进程**（orchestrator + dispatcher） |
| 工人 | OS 进程 / worktree CLI | **App 内 Agent 子会话**（headless） |
| 模型 | 用户各配 endpoint | **渠道体系**（kscc 内网优先，继承 board.channelId） |
| 入口 | 纯 IM / 纯 CLI | **草稿 + 主会话 + IM**（Bridge 已有） |
| 短活 | 另起一套 | **仍用 SDK SubAgent**（不进看板） |

**不做**：OpenClaw 式独立 Gateway、Proma 全套 `delegate_agent` MCP（9 工具）、侧栏平铺 N 个工人会话。

---

## 2. 架构

```
┌─────────────────────────────────────────────────────────┐
│ 入口层                                                   │
│  草稿升级 │ 主会话拆单 │ IM 一句话（Phase C）            │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 编排层（新建）                                           │
│  kanban.db（SQLite）+ kanban-dispatcher（30s tick）       │
│  kanban-agent-tools（主 Agent MCP，Phase B）             │
└───────────────────────────┬─────────────────────────────┘
                            ▼
┌─────────────────────────────────────────────────────────┐
│ 执行层（已有 + 小扩展）                                   │
│  kanban-worker-service → runRegisteredHeadlessAgent       │
│  1 task = 1 子会话（sourceKanbanTaskId / parentBoardId） │
└─────────────────────────────────────────────────────────┘
```

### 2.1 与草稿的关系

```
Draft R-1, R-2, R-3
    │ 用户点「交给 Agent」
    ▼
主会话 + 自动建 board（R-n → task 1:1，可选依赖）
    │ dispatcher 派工
    ▼
子会话工人执行
    │ 完成
    ▼
回写 draft 块 status: done / verified
```

草稿 = **想**；看板 = **干**。

### 2.2 与 SubAgent / Automation 的边界

| 能力 | 用途 | 进看板？ |
| --- | --- | --- |
| **SubAgent** | 几分钟小调研 | ❌ |
| **后台 bash/Task** | 同会话内续轮 | ❌ |
| **Automation** | cron 定时单 prompt | ❌ |
| **Kanban** | 多任务、有依赖、>30min、要跟踪 | ✅ |

---

## 3. 触发（何时建看板）

### 3.1 v1 入口（按优先级）

1. **草稿升级** — `upgradeToAgentAtom` 成功后，若草稿含 ≥2 个 `RequirementBlock`，自动 `createBoard` + 按 R-n 建 task。
2. **主会话 MCP** — 用户说「拆成 N 条线做」→ `kanban_create_board` + `kanban_add_task`（Phase B）。
3. **IM** — Bridge 收到长跑意图 → 建主会话 + board（Phase C）。

### 3.2 建板条件（满足 ≥2 条）

- 预计 >30 分钟 或 ≥2 个可独立子任务
- 存在依赖或并行
- 用户可能走开，需要进度跟踪

否则走单会话 / SubAgent。

### 3.3 写入数据

- `AgentSessionMeta` 增加 `boardId?: string`（主会话）
- 子会话已有 `parentBoardId` / `sourceKanbanTaskId`（探索分支草稿）

---

## 4. 编排

### 4.1 调度器（`kanban-dispatcher.ts`）

| 项 | 默认值 |
| --- | --- |
| tick | 30s（与 Automation 一致） |
| maxConcurrent | 3（kscc 保守） |
| 单任务超时 | 2h（可配置） |
| 失败重试 | 3 次 → `failed` |

**状态机**：`pending → ready → running → done | failed | blocked`

**依赖**：`task_links` 表，`depends_on` 满足后 `resolveReadyTasks()` 提升 ready。

**派工**：

```typescript
// 伪代码
for (task of db.listReady().slice(0, maxConcurrent - running.size)) {
  db.updateStatus(task.id, 'running')
  runKanbanTaskHeadless(task, boardContext, dbUpdater)
    .then(() => { db.done(task.id); dispatchTick() })
    .catch((e) => { db.fail(task.id, e); dispatchTick() })
}
```

### 4.2 工人（`kanban-worker-service.ts`）

- `createAgentSession`（新子会话，不复用）
- `runRegisteredHeadlessAgent({ triggeredBy: 'kanban', permissionModeOverride: 'bypassPermissions', ... })`
- **继承** `board.channelId`，禁止跨渠道
- 工人 prompt 前缀：禁止再建看板 / automation
- 工人子会话 **不注入** `kanban_*` / automation MCP（`delegationDepth >= 1`）

### 4.3 角色与模型（Phase B 后期）

- `agent-role-profiles.json`：角色名 → `modelId` + 描述
- 例：`架构师 → glm-5.2`，`实现 → glm-5.1`，`文档 → mimo-v2.5-pro`
- task.roleId 解析 model，写入 `AgentSendInput.modelId`

### 4.4 启动恢复

App 启动时：`status = running` → 标 `interrupted` → 重新 `ready` 或 `failed`（可配置）。

### 4.5 长任务与「伪 Gateway」— 托盘后台模式（Phase B+）

**不装 OpenClaw Gateway**。仅扩展 Electron 生命周期：

| 用户操作 | 行为 |
| --- | --- |
| 关主窗口 | 最小化到托盘，**主进程 + dispatcher 继续** |
| 托盘「退出 TAgent」 | 停止 dispatcher，running 任务标 interrupted |
| 设置「长任务后台运行」开关 | 默认开 |

实现点：

- `app.on('window-all-closed')` 不 `app.quit()`（Windows/macOS 托盘）
- 托盘菜单：进行中看板数、暂停全部、退出
- `powerSaveBlocker` 在有 running 看板任务时开启（Automation 已有先例）

---

## 5. UI 交互

### 5.1 原则

- **侧栏**：只显示主会话 + 看板摘要一行（`2/5 进行中`），不平铺工人
- **主会话内二级 Tab**：对话 + 团队（核心）
- **IM**：仅里程碑 4 类通知（Phase C）

### 5.2 主会话二级 Tab

```
┌─ 主会话「登录重构」────────────────────────────┐
│  [ 对话 ]  [ 团队 · 2/5 ]                        │
├────────────────────────────────────────────────┤
│  Tab 内容                                       │
└────────────────────────────────────────────────┘
```

| Tab | 内容 |
| --- | --- |
| **对话** | 现有 AgentView；拆单结果摘要卡片 + 「打开团队」 |
| **团队** | Master-Detail（见下） |

**显示条件**：`sessionMeta.boardId` 存在时显示「团队」Tab；普通会话不变。

### 5.3 团队 Tab（Master-Detail）

```
┌──────────────┬──────────────────────────────────┐
│ 前端    ● run │  （选中工人的完整 AgentView）      │
│ 单测    ⚠ blk │                                  │
│ 联调    ○ pend│                                  │
│ 环境    ✓ done│                                  │
└──────────────┴──────────────────────────────────┘
```

**左栏卡片字段**：标题、状态、模型/角色、一行摘要、阻塞原因。

**交互**：

- 点左栏项 → 右侧加载该 `assigneeSessionId` 的 AgentView（嵌套，非新顶栏 Tab）
- `blocked` 卡片 → 「填写解除原因」→ 调 `kanban_unblock`
- 顶栏：暂停看板 / 取消看板

**完成工人**：左栏保留在「完成」分组，默认折叠；侧栏摘要数字更新。

### 5.4 侧栏

```
项目 A
  💬 登录重构 · 团队 2/5        ← 主会话一行 + badge
  💬 其他普通会话
```

可选：点击主会话展开工人（默认 **关闭**，与团队 Tab 二选一即可）。

### 5.5 IM 通知（Phase C）

| 事件 | 文案示例 |
| --- | --- |
| board_created | 「已开始，共 5 个任务」 |
| task_done | 「前端页面 · 完成」+ 一句摘要 |
| task_blocked | 「单元测试 · 等你确认：…」 |
| board_completed | 「全部完成」+ deep link |

禁止每个 tool call 一条。

---

## 6. MCP 工具（主 Agent，Phase B）

| 工具 | 作用 |
| --- | --- |
| `kanban_create_board` | 建板 |
| `kanban_add_task` | 加任务 + 可选 dependsOn |
| `kanban_list_tasks` | 列表 |
| `kanban_block` | 工人阻塞 |
| `kanban_comment` | blackboard（Phase D 可完善） |

注入条件：`mode === 'general'` 且 `triggeredBy !== 'kanban'` 且非工人子会话。

---

## 7. 分阶段交付

### Phase A — 编排内核（1 周）

**DoD**：mock/真实 worker 跑通 A→B→C 依赖链；`bun test` 绿。

- 合入探索分支：`kanban-db` + `kanban-dispatcher` + 单测
- `kanban-worker-service` 接线 dispatcher
- 主进程 bootstrap：`configureKanbanDispatcher` + `startKanbanDispatcher`

### Phase B — 产品闭环（1.5 周）

**DoD**：草稿升级 → 团队 Tab 可见进度 → 点工人看详情。

- 草稿 `upgradeToAgent` → 自动建板 + task
- `AgentSessionMeta.boardId`
- 主会话 **对话 + 团队** Tab（Master-Detail）
- orchestrator 注入 `kanban-agent-tools`
- 托盘后台模式（关窗不停调度）
- IPC：`KANBAN_CHANGED` 刷新 UI

### Phase C — IM + 打磨（1 周）

**DoD**：微信/飞书收 4 类里程碑；blocked 可从 IM 回复解除。

- `kanban-notification-service.ts`
- Bridge 入站「暂停/继续」
- 角色库设置页（可选，可 Phase D）

### Phase D — 增强（不阻塞发布）

- Verifier 任务类型、`kanban_comment` blackboard、decomposer LLM 自动拆单

---

## 8. 文件清单（新增/改）

```
packages/shared/src/types/kanban.ts          ✅ 探索分支已有
packages/shared/src/constants/kanban-ipc.ts  待建

apps/electron/src/main/lib/
  kanban-db.ts                               ✅
  kanban-dispatcher.ts                       ✅
  kanban-worker-service.ts                   ✅
  kanban-agent-tools.ts                      ✅
  kanban-notification-service.ts             Phase C
  kanban-bootstrap.ts                        启动注册 dispatcher + 恢复

apps/electron/src/renderer/components/kanban/
  SessionTeamTab.tsx                         团队 Tab（Master-Detail）
  KanbanTaskListItem.tsx                     左栏卡片
  KanbanBoardSummary.tsx                     对话 Tab 内摘要卡片

apps/electron/src/renderer/atoms/kanban-atoms.ts
```

---

## 9. 默认决策（已拍板，可改）

| # | 决策 | v1 默认 |
| --- | --- | --- |
| 1 | 第一触发入口 | **草稿升级** + 主会话 MCP |
| 2 | 侧栏 | **只看板摘要一行**，工人不进侧栏 |
| 3 | 工人详情 | **主会话「团队」Tab Master-Detail** |
| 4 | R-n 与 task | **1:1 映射** |
| 5 | blocked 处理 | **团队 Tab 卡片上解除** + IM（Phase C） |
| 6 | 并行上限 | **3** |
| 7 | 长任务后台 | **托盘模式**，非 Gateway |
| 8 | Collaboration MCP | **不做**，工人走 headless 子会话 |

---

## 10. 验收场景（E2E）

1. 草稿 3 个 R-n → 交给 Agent → 主会话出现团队 Tab `0/3`
2. 调度器派工 → 左栏 3 项状态变化 → 右侧点「前端」看完整对话
3. 依赖链：B 等 A 完成才开始
4. 关主窗口 → 托盘仍在 → 任务继续 → 完成通知（系统通知 Phase B，IM Phase C）
5. 重启 App → interrupted 任务 re-queue → 继续跑完

---

## 11. 参考开源（只借鉴，不引入）

| 借鉴点 | 来源 |
| --- | --- |
| SQLite + dispatcher + kanban_* 工具 | [Hermes Kanban](https://hermes-agent.nousresearch.com/docs/user-guide/features/kanban) |
| 看板 UI / 实时刷新 | [agent-kanban](https://github.com/saltbo/agent-kanban) |
| REVIEW 门禁（可选 Phase D） | [Kagan](https://github.com/kagan-sh/kagan) |

---

**最后更新**：2026-06-30 — v1 产品方案，整合触发/编排/UI/托盘后台，明确不做 Gateway。

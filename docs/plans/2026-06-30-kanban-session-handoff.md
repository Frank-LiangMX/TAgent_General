# Kanban v1 探索 — 会话交接文档（2026-06-30）

> **读者**：明天在公司继续开发的 Agent / 维护者  
> **分支**：`feature/kanban-exploration`（**未合 main**）  
> **设计权威**：[`2026-06-30-kanban-v1-product-design.md`](2026-06-30-kanban-v1-product-design.md)  
> **工程 Epic**：[`2026-06-30-task-kanban-orchestration-design.md`](2026-06-30-task-kanban-orchestration-design.md)

---

## 1. 今天完成了什么

### 1.1 产品方案（总监层）

- 产出 **Kanban v1 产品方案**：主会话内 **对话 | 团队** Tab、Master-Detail、侧栏仅摘要；**不用 OpenClaw Gateway**；长任务靠 **托盘后台**（Phase B+）。
- 明确 **不做** Proma 式 `delegate_agent` / Collaboration MCP（v1 范围外）。

### 1.2 代码（kscc glm-5.2 工人 + 本地补丁）

| 提交 | 内容 |
|------|------|
| `e393ad0` | 探索报告 + tracker |
| `1c88b98` | headless worker 桥接 + agent tools 骨架 |
| `8c8bd23` | Phase A 内核：`kanban-db` + `kanban-dispatcher` |
| `b37e5c3` | **团队 Tab UI** + IPC demo seed + preload/atoms |
| *待 push* | Windows dev 启动修复 + `better-sqlite3` Electron 重建 + kanban DB 容错 |

**已实现可验证能力**：

- Agent 会话二级 Tab：**对话 | 团队**
- **「加载看板演示」** → 4 条 mock 任务（done / running / blocked / ready）
- 团队 Tab：左任务列表 + 右详情 / 嵌套 AgentView（running）/ 解除阻塞 UI
- IPC：`kanban:seed-demo` / `list-tasks` / `pause-board` / `unblock-task` 等
- Dispatcher：**mock runner**（不派真 LLM）

**尚未实现（Phase B 及以后）**：

- 草稿升级 → 自动建板
- orchestrator 注入 `kanban_*` MCP 工具
- 真实 headless worker 跑任务
- 托盘后台模式
- IM 里程碑通知

### 1.3 开发环境修复（Windows）

| 问题 | 原因 | 修复 |
|------|------|------|
| `Start-TAgent-Dev.bat` 闪退 | 双击 cmd 无 `bun` PATH | `scripts/dev/dev-launcher-env.bat` 注入 `%APPDATA%\npm` + `~/.bun/bin` |
| Electron 起不来 | `node_modules/electron/dist` 缺失 | `scripts/dev/ensure-electron.ps1` 从 npmmirror 下载 |
| 看板 seed 失败 | `better-sqlite3` 按 Bun ABI 编译，Electron 不匹配 | `bun run rebuild:native` + `ensure-native-modules.ps1` + `postinstall` |

---

## 2. 明天到公司怎么启动

```bat
git fetch origin
git checkout feature/kanban-exploration
git pull

REM 推荐：双击
scripts\dev\Start-TAgent-Dev.bat
```

首次启动会依次：

1. `[0/4]` 确保 Electron 二进制（~130MB，仅首次）
2. `[1/4]` 确保 `better-sqlite3` 与 Electron ABI 一致（有 stamp 则跳过）
3. `[2/4]` 清理 5173 端口
4. `[3/4]` sync resources
5. `[4/4]` `bun run dev`

**若看板仍报 DB 错误**，手动：

```bat
cd apps\electron
bun run rebuild:native
```

然后重启 dev。终端应出现：

```text
[看板] 数据库已就绪: ...\.tagent-dev\kanban.db
[看板] 子系统已初始化（demo 模式 runner）
```

停止 dev：`scripts\dev\Stop-TAgent-Dev.bat`

---

## 3. 看板 UI 测试清单

1. 顶部切 **Agent** 模式，新建会话
2. 工具栏选 **AI 渠道**（如 kscc）
3. 点 **「加载看板演示」** → toast 成功 → 自动切 **团队** Tab
4. 左侧 4 条任务，进度 **1/4**
5. 点 **搭建项目脚手架**（running）→ 右侧嵌套工人 Agent（无二级 Tab）
6. 点 **设计数据库 Schema**（blocked）→ **解除阻塞**
7. 切回 **对话** Tab → 看板摘要卡片 → **打开团队**
8. 顶栏 **暂停/继续**、**刷新** 图标

详细步骤见本文 §3；设计边界见 [`2026-06-30-kanban-v1-product-design.md`](2026-06-30-kanban-v1-product-design.md)。

---

## 4. 关键文件索引

```
apps/electron/src/main/lib/
  kanban-db.ts              # SQLite CRUD
  kanban-dispatcher.ts      # 调度 tick（mock runner）
  kanban-bootstrap.ts       # 启动 init
  kanban-ipc.ts             # IPC + seedDemoKanban
  kanban-worker-service.ts  # headless 桥（Phase B）
  kanban-agent-tools.ts     # MCP 工具骨架

apps/electron/src/renderer/
  components/kanban/SessionTeamTab.tsx
  components/kanban/KanbanTaskListItem.tsx
  components/kanban/KanbanBoardSummary.tsx
  atoms/kanban-atoms.ts
  components/agent/AgentView.tsx   # 对话|团队 Tab 集成

packages/shared/src/types/kanban-ipc.ts

scripts/dev/
  Start-TAgent-Dev.bat
  Stop-TAgent-Dev.bat
  dev-launcher-env.bat
  ensure-electron.ps1
  ensure-native-modules.ps1
```

---

## 5. 编排分工（Cursor 总监 + kscc）

| 任务档位 | kscc 模型 | 用途 |
|----------|-----------|------|
| 高消耗 / 核心 slice | **glm-5.2** | IPC+UI 闭环、大 refactor |
| 中等开发 | **glm-5.1** | 补组件、修 bug、类型/测试 |
| 轻量 | mimo 等 | 文档、探索 |

**注意**：Windows 上给 kscc 的中文 prompt 用 `--append-system-prompt-file`（UTF-8 文件），不要直接塞命令行，否则乱码。

---

## 6. 明天建议优先级

### P0 — 验证闭环

- [ ] 公司机器 pull 后跑通 §3 测试清单
- [ ] 确认 `[看板] 数据库已就绪` 日志

### P1 — Phase B 入口（产品化第一步）

- [ ] 草稿 **升级到 Agent** 时可选创建看板（替代纯 demo seed）
- [ ] orchestrator 注入 `kanban_create_board` / `kanban_create_task` 等工具
- [ ] `kanban-worker-service` 替换 mock runner → 真实 `runRegisteredHeadlessAgent`

### P2 — 质量

- [ ] `kanban-db` / `kanban-ipc` 集成测试（当前有部分 vitest 因 native/hoist 失败，需单独标记）
- [ ] PR 合入前：`bun run typecheck` + 截图

### 不做（v1）

- Collaboration MCP `delegate_agent`
- OpenClaw Gateway

---

## 7. 已知风险

| 风险 | 说明 |
|------|------|
| `better-sqlite3` ABI | 每次 Electron 大版本升级后需 `bun run rebuild:native`；已加 `postinstall` |
| 演示非真实调度 | seed 直接写库，dispatcher mock 不跑 LLM |
| `.kanban-explore/` | 本地 kscc prompt/日志，**未入库** |
| 分支未合 main | 公司需显式 checkout `feature/kanban-exploration` |

---

## 8. 相关文档

- [`2026-06-30-kanban-v1-product-design.md`](2026-06-30-kanban-v1-product-design.md) — v1 产品方案
- [`2026-06-30-kanban-exploration-report.md`](2026-06-30-kanban-exploration-report.md) — Phase A 探索报告
- [`2026-06-30-task-kanban-orchestration-design.md`](2026-06-30-task-kanban-orchestration-design.md) — 工程 Epic
- [`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md) — 协作子会话（**非 v1**）

---

*最后更新：2026-06-30 夜 — 会话交接*

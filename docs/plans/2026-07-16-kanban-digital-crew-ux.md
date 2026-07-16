# 看板数字员工轻量拟人化与面板整合

> **状态**：P0 实施中（文档 + 派发话术 + 员工卡跨材质）  
> **日期**：2026-07-16  
> **前置**：PR #24 / `feature/kanban-roles-and-worker-skills`（默认角色 / 工号 / worker Skills）  
> **非目标**：瞬知 / 马维斯式虚拟办公室（远期可选，独立入口）

---

## 1. 背景与目标

### 1.1 痛点

1. **隐喻错位**：看板像 Jira 任务墙，不像「主 Agent 带队派活」  
2. **UI 脱节**：任务卡用 `bg-card + border + shadow-sm`，绕开全局三材质（MD / 高透玻璃 / 轻拟态）  
3. **双入口重复**：`KanbanMainView`（左栏看板页）与 `SessionTeamTab`（会话团队整页）结构近似、维护成本高  
4. **入口过时**：会话内「团队」整页诞生于 RightRail 之前；现有 Design Preview 右栏范式可承接「班组墙」

### 1.2 目标体验（普通模式）

> 主 Agent = 队长；worker = 数字员工。  
> 用户感知：**文字点将 + 材质感知的员工卡**，不是项目管理工具，也不是像素办公室。

| 要像 | 不要像 |
|------|--------|
| 点名派活、工牌、在岗态 | Jira 小票、冷冰冰 status 列 |
| 跨 MD / glass / soft 三材质一致结构 | 强制 soft / 写死 blur 阴影 |
| 右栏班组墙（可选） | 默认嵌整页办公室 / 像素小人 |

### 1.3 远期（不在本波）

- 瞬知式干净工位 / 腾讯马维斯气质的虚拟办公室  
- **独立入口或沉浸层**，状态仍映射自 `KanbanTask`；不塞进主对话默认路径

---

## 2. 信息架构

```
主区对话（队长席）
  └─ 派发话术：点将 / 安排同事 / 交卷汇总

右栏（伴生面板，对齐 Design Preview）
  └─ 班组墙：本会话 board 的员工卡队列
       └─ 点任务 → 摘要；有工人会话 → 打开会话（不嵌 AgentView）

左栏「看板」页（全局）
  └─ 同一套 KanbanBoardView / 员工卡
       └─ 额外：角色库、未绑会话的看板浏览
```

### 2.1 入口优化

| 入口 | 现状 | 目标 |
|------|------|------|
| 左栏 FunctionalRail → 看板 | `KanbanMainView` 独立实现 | 挂载共享 `KanbanBoardView`（page 模式） |
| 会话顶栏「团队」整页 | `SessionTeamTab` Master-Detail + 嵌套 AgentView | **降级**：默认打开右栏班组；或仅保留「打开班组」快捷 |
| 右栏 | 无看板项 | 新增 `team` / `crew` 图标；有 `meta.boardId` 时可用 |
| 嵌套工人会话 | Team 右栏嵌 `AgentView` | **禁止**进窄右栏；改为打开顶层/会话 Tab |

### 2.2 共享组件

```
KanbanWorkerCard          # 数字员工卡（原 KanbanTaskListItem 升级）
KanbanBoardToolbar        # 进度 / 暂停 / 刷新 / 并发
KanbanStatusGroups        # 分组常量 + 人态文案
KanbanBoardView           # 模式：page | session-rail
  props: boardId, surface, detailMode
```

---

## 3. 数字员工卡（跨材质）

### 3.1 结构（三材质共用）

```
[头像+工号角标]  角色名 01          [在岗态]
                 当前任务标题一行
                 忙碌时：工作汇报一行（progress）
                 耗时 · 模型（弱信息）
```

### 3.2 材质规则（硬约束）

- **禁止**写死 `backdrop-blur` / 双层 rgba 拟态阴影 / 固定 purple 渐变  
- **表面**：`session-list-row` / 运行中或选中用 `session-list-item-active`（或等价 token 表面类）  
- **按压**：`.ui-pressable`  
- **角色色**：按 `roleId` 语义 tint（透明度叠在 surface 上），三档都可读  
- **验收**：同一组件在 `data-material` = 默认 / `glass` / `soft` 下各抽一眼

### 3.3 人态文案（映射 status）

| status | 人态文案 |
|--------|----------|
| pending | 排队中 |
| ready | 待命 |
| running | 忙碌 |
| blocked | 求助中 |
| review | 待验收 |
| done | 已交卷 |
| failed | 需复盘 |
| cancelled | 已撤岗 |

分组标题可用「班组」语气（如「忙碌中」），技术 status 仍存 DB。

### 3.4 工号

沿用 `buildKanbanRoleInstanceLabels`：同板同 `roleId` ≥2 时显示 `角色名 01`。

---

## 4. 派发话术（主 Agent）

更新 `KANBAN_ORCHESTRATION_GUIDE`：

1. 拆任务时 **必带 roleId**，优先点名角色显示名  
2. 建板后回复模板偏向：  
   - 「我安排了 N 位同事：…」  
   - 「他们已开工；可在右侧班组面板看进度，完成后我会汇总。」  
3. 少对用户说：`kanban` / `boardId` / `worker` / `roleId`  
4. 技术字段仍走工具参数，不进用户可见叙述

---

## 5. 实施分期

| 阶段 | 内容 | 验收 |
|------|------|------|
| **P0** | 本文档 + 派发话术 + `KanbanWorkerCard` 跨材质改造 | 三材质抽查；派发回复有点将感 |
| **P1** | 抽 `KanbanBoardToolbar` / 分组常量；MainView 与 Team 共用 | 两处工具栏无复制逻辑 |
| **P2** | 右栏班组面板入口；有 boardId 时角标 | 会话中可不进整页团队也能盯进度 |
| **P3** | 会话「团队」整页降级 / 嵌套 AgentView 改为开会话 | 无窄栏嵌套聊天 |

本波优先 **P0**，P1 能顺手抽则抽；P2/P3 可随后 PR。

---

## 6. Prompt Cache / 架构约束

- 派发话术改的是 `KANBAN_ORCHESTRATION_GUIDE` 稳定段 → 影响新会话 prefix；属产品能力变更，可接受  
- **不**往 system prompt 注入动态员工列表（动态走 user / 工具结果）  
- Worker Skills 已由 `board.workspaceId` + SDK plugin 解决，本波不重复造发现机制  
- 办公室拟人化不引入新 Core Tool；若未来做，走独立面板 / 插件阶梯

---

## 7. 相关文件

| 文件 | 角色 |
|------|------|
| `apps/electron/src/renderer/components/kanban/KanbanTaskListItem.tsx` | → 升级为员工卡 |
| `apps/electron/src/renderer/components/kanban/KanbanMainView.tsx` | page 表面 |
| `apps/electron/src/renderer/components/kanban/SessionTeamTab.tsx` | 过渡；P3 降级 |
| `apps/electron/src/main/lib/agent-prompt-builder.ts` | 派发话术 |
| `apps/electron/src/renderer/lib/kanban-role-labels.ts` | 工号 |
| `packages/ui/DESIGN.md` / `glass.css` | 材质表面规范 |
| `docs/plans/2026-06-30-kanban-v1-product-design.md` | 原 Team Tab 设计（本波演进） |

---

## 8. 决策记录

| 决策 | 选择 |
|------|------|
| 普通模式拟人化强度 | 文字 + 员工卡，不上办公室场景 |
| 材质 | 三档都要好看，不强制 soft |
| 办公室（瞬知/马维斯风） | 远期可选，独立入口 |
| 右栏 vs 团队整页 | 右栏班组为伴生主路径；整页逐步降级 |
| 工人对话 | 不嵌右栏 AgentView，打开会话 |

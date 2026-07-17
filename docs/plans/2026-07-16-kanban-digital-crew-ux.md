# 看板数字员工轻量拟人化与面板整合

> **状态**：角色统计体系 + 档案卡落地（2026-07-16）
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
  └─ 班组墙：本会话 board 的员工卡队列（工人会话用 parentBoardId 回退）
       └─ 点任务 → 底部摘要 +「查看详情」弹窗（不切换主区会话）

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

## 4. 数字员工统计体系

### 4.1 数据模型

现有字段已足够：
- `startedAt` / `finishedAt` → 单次工作时长
- `status === 'running'` → 当前在岗
- `roleId` → 按角色聚合
- `createdAt` → 日/周/月时间窗口

**新增类型**（`kanban.ts`）：

```typescript
interface PeriodStats {
  taskCount: number
  totalDurationMs: number
  avgDurationMs: number
}

interface RoleWorkStats {
  roleId: string
  totalTasks: number        // done + failed
  totalDurationMs: number
  failedCount: number
  avgDurationMs: number
  windows: { day: PeriodStats; week: PeriodStats; month: PeriodStats }
}

interface KanbanCrewStats {
  byRole: RoleWorkStats[]
  totalTasks: number
  totalDurationMs: number
  activeCount: number        // 当前在岗人数
}
```

### 4.2 统计服务（主进程）

`kanban-crew-stats.ts`：主进程启动时扫描全量 `kanban.db` 计算一次（异步），缓存于内存。任务状态变更时 invalidate。

IPC：`kanban:getCrewStats` → `KanbanCrewStats`

### 4.3 角色库 Tab（统计面板）

`RoleStatsCard` 组件：顶部三个数字（累计上岗 / 累计工时 / 平均工时）+ 日/周/月 SegmentedTabs 切换 + 进度条。

`RoleCard`（列表卡片）：顶部角色色条 + 角色头像 + 累计上岗徽章 + 均时 + 失败计数。

### 4.4 角色档案弹窗（拟人化）

左侧：统计面板 + 基本信息。右侧：角色配置（displayName / systemPrompt / 模型池 / 权限 / 并发上限）。

---

## 5. 数字员工卡（增强）

### 5.1 Running 任务卡

- 头像放大（size-10），工号角标左下角
- 同 roleId ≥2 running 时头像右上角紫色徽章「×N」
- 角色名 + 状态徽章 + 任务标题 + **实时计时**（每秒刷新）
- 底部进度条

### 5.2 Idle / 终态卡

- Idle（无 running/终态）：显示「待机中」
- done：结果摘要高亮（绿色）
- failed：红色错误提示
- blocked：橙色求助原因

### 5.3 同岗计数

`KanbanCrewTaskList` 计算 `sameRoleActiveCountMap`：每个 running task 的同 roleId running 总数，传给 `KanbanTaskListItem` 渲染「×N」角标。

### 5.4 AI Office worker 真值绑定（2026-07-17）

办公室角色不再使用固定花名册或数组下标模拟 worker，而是由当前看板任务直接投影：

- `task.id`：场景实体稳定 ID，任务消失时同步销毁实体，禁止幽灵员工
- `roleId`：角色身份、工号展示名和角色色
- `assigneeSessionId`：真实 worker 子会话及形象 seed；未领取时使用 `roleId + task.id` 临时 seed，并明确显示「尚未领取 worker 会话」
- `task.status`：基础状态真值，映射为待命 / 忙碌 / 求助 / 验收 / 已交卷 / 需复盘 / 已撤岗
- `kanban.onTaskProgress`：运行中细状态真值，根据进度文本和最近工具细分为分析、执行、验收

场景最多容纳 6 个可见 worker，按活跃状态优先排序，超出数量显示计数。状态同时通过角色姿态、状态标签和场景区域表达：执行 / 分析 / 验收位于工位，待命位于等候区，求助与终态进入独立区域。点击角色打开其 `taskId` 对应的既有任务详情，不新增第二套任务详情状态。

状态变化不能直接改坐标。场景层使用轻量迁移状态机：`sourceState → walking → targetState`，沿现有办公室导航图移动，抵达后才切换目标动画；任务排序变化时保留 worker 原工位，避免全员换座。AI Office 的空间迁移属于核心状态表达，不继承系统 `prefers-reduced-motion`；若未来提供精简动效，必须使用产品内显式开关，并只削减装饰性动作。

角色渲染默认使用仓库内 Chibi Spine 4.2 骨骼资源，状态之间设置 0.24s mix。交卷和撤岗属于一次性动作，结束后排队进入稳定 idle；其他需要持续表达的状态才允许 loop。程序绘制角色只作为 Spine 加载失败时的降级，不作为默认视觉方案。

角色比例必须由场景实体尺寸推导：Chibi setup bounds 高 682.5px，目标场景高度 102px，因此 Spine scale 约为 0.149；该高度与约 101px 的桌面显示宽度同量级。阴影、点击热区和头顶标签锚点需要随角色比例一起校准，禁止复用参考项目写死的 `0.3`。

角色头顶信息遵循低密度原则：常驻层只显示姓名和状态点，并以角色完整视觉高度为稳定锚点留出 14px 安全间距。任务标题、进度、工具和 worker 会话属于按需详情，只在点击角色后的信息卡中展示，禁止把完整 `currentTask` 常驻在角色形象或相邻角色之上。

交卷是业务终态，不是角色生命终态。worker 完成交付反馈后继续保持 `taskStatus=done`，场景层单独进入环境生活循环：错峰等待、沿导航路径前往茶水间 / 窗边 / 打印机 / 植物角 / 空地、短暂停留并播放对应动作，再选择下一项活动。活动种类和延迟由 worker 的稳定形象 seed 与循环次数确定，既能避免全员同步，也不会因 React 或 Kanban 刷新而随机跳变。环境行为不得回写看板状态，也不受系统动画偏好影响。

---

## 6. 实施分期（更新）

| 阶段 | 内容 | 验收 |
|------|------|------|
| **D+1** | 统计类型 + 主进程统计服务 + IPC | typecheck |
| **D+2** | `RoleStatsCard` + 角色库接入统计 | 角色卡片有上岗次数徽章 |
| **D+3** | 角色档案弹窗拟人化 | 弹窗左侧有统计、右侧有配置 |
| **D+4** | 员工卡 running 实时计时 + 同岗角标 | 运行中任务卡显示计时 + ×N 徽章 |

---

## 6. Prompt Cache / 架构约束

- 派发话术改的是 `KANBAN_ORCHESTRATION_GUIDE` 稳定段 → 影响新会话 prefix；属产品能力变更，可接受  
- **不**往 system prompt 注入动态员工列表（动态走 user / 工具结果）  
- Worker Skills 已由 `board.workspaceId` + SDK plugin 解决，本波不重复造发现机制  
- 办公室拟人化不引入新 Core Tool；若未来做，走独立面板 / 插件阶梯

---

## 8. 相关文件

| 文件 | 角色 |
|------|------|
| `packages/shared/src/types/kanban.ts` | `RoleWorkStats` / `KanbanCrewStats` / `PeriodStats` 类型 |
| `apps/electron/src/main/lib/kanban-crew-stats.ts` | 统计服务（缓存 + 增量更新） |
| `apps/electron/src/main/lib/kanban-ipc.ts` | `GET_CREW_STATS` IPC handler |
| `apps/electron/src/preload/index.ts` | `getCrewStats` 暴露 |
| `apps/electron/src/renderer/components/kanban/RoleStatsCard.tsx` | 统计面板（PeriodStats） |
| `apps/electron/src/renderer/components/kanban/RoleCard.tsx` | 角色卡片（加色条 + 上岗徽章） |
| `apps/electron/src/renderer/components/kanban/RoleDetailDialog.tsx` | 角色档案弹窗（拟人化布局） |
| `apps/electron/src/renderer/components/settings/AgentRoleSettings.tsx` | 接入统计 + 新组件 |
| `apps/electron/src/renderer/components/kanban/KanbanTaskListItem.tsx` | running 实时计时 + 同岗计数 + 待机中文案 |
| `apps/electron/src/renderer/components/kanban/KanbanCrewTaskList.tsx` | `sameRoleActiveCountMap` 计算 |

---

## 8. 决策记录

| 决策 | 选择 |
|------|------|
| 普通模式拟人化强度 | 文字 + 员工卡，不上办公室场景 |
| 材质 | 三档都要好看，不强制 soft |
| 办公室（瞬知/马维斯风） | 作为右栏班组墙视图；必须直接消费 Kanban worker 真值，禁止固定角色模拟 |
| 右栏 vs 团队整页 | 右栏班组为伴生主路径；整页逐步降级 |
| 工人对话 | 不嵌右栏 AgentView，打开会话 |

> 后续方向：右栏 AI Office 保留为经典工作台的轻量班组概览；全屏、按会话切换的沉浸式 Office 设计见 [2026-07-17-ai-office-session-presentation-design.md](./2026-07-17-ai-office-session-presentation-design.md)。该设计不替代现有 TAgent 经典工作台，也不新增第三种顶层业务模式。

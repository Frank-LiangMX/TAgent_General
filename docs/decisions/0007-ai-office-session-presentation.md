# ADR-0007: AI Office 作为会话展示模式

> **Status**: Implemented（Phase 1–7）
> **Date**: 2026-07-17  
> **Deciders**: TAgent 产品与桌面端维护者

## Context

AI Office 原先只存在于 Kanban 右侧班组面板中。它能表达 worker 状态，但空间狭窄，也无法表达“尚未创建看板、用户正与主 Agent 沟通”的会话阶段。与此同时，经典 TAgent 工作台仍是代码、Diff、工具活动和长文本工作的高效主界面，不能被沉浸式场景替代。

若把 Office 实现成新的顶层业务模式或新的 Agent 页面，很容易产生两套会话运行时、两份消息状态和额外的模式隔离问题。

## Decision

1. AI Office 定义为每个主会话的可选展示模式：`classic | office`，不新增顶层能力模式。
2. `classic` 永远是新会话和未知持久化值的默认值；用户按会话显式选择 Office。
3. 展示偏好保存在 renderer 独立的版本化 localStorage atom 中，不修改共享 `AgentSessionMeta`、同步 schema 或 Provider / Channel / Skill 接口。
4. Office 复用同一个 `AgentView(sessionId)` 作为悬浮沟通窗；切换展示只会卸载一种展示并挂载另一种，不创建会话、不创建看板、不重发消息。
5. Office 场景是现有主会话与 Kanban 数据的只读投影。主 Agent 总监状态来自真实 streaming / tool / indicator 信号；没有看板时只显示总监，不生成虚假 worker。
6. 经典展示不静态加载 Pixi Office 场景；全屏 Office 和右栏 Office 均按需加载。
7. Office 展示使用独立的沉浸壳层，不挂载经典 Functional Rail、左侧会话栏、标签栏和右侧伴生面板；主会话通过顶部横向房间条切换，切回经典展示后原有面板状态保持不变。
8. worker actor 使用 `assigneeSessionId` 作为稳定身份，任务只作为可替换的 assignment；未领取任务不生成角色。
9. Office 业务状态、角色语义状态与 Pixi / Spine 动画状态分层；交接由可中断的单通道队列串行化，完成后进入低频环境行为。
10. 动效偏好由 TAgent 产品设置控制：精简动效保留空间连续性并加速必要移动，只关闭装饰性行为；系统 reduced-motion 只约束普通 UI 过渡。
11. Office 的主表面始终是 Canvas；会话沟通、任务详情和后续功能通过场景浮层呈现。完整文件、Diff 等高密度能力通过明确入口返回经典工作台。
12. Office 导航把现有 Workspace 投影为“楼层”，把其中同一顶层能力模式的主 Agent Session 投影为“办公室”。楼层与办公室创建必须复用既有 Workspace / Session 链路，不增加 Office 专用业务实体。
13. Office 是独立交互外壳但不是独立主题。所有 HUD、导航和沟通窗消费统一 Material 3 / Surface token；默认材质保持不透明 Material 表面，仅在用户全局选择高级材质时跟随变化。
14. Office 沟通窗复用同一 `AgentView` 运行时，但通过 `office-dock` surface 使用专用紧凑消息与 Composer 编排，避免把经典会话布局直接压缩到窄窗。

## Consequences

### Positive

- 一个会话仍只有一套 Agent 运行时和一份消息真值。
- 经典工作流保持默认、零强制动画，并避免承担 Pixi 首屏成本。
- 无看板会话也有完整的 Office 入口；有看板时按真实 worker 会话渐进召集、交接和验收。
- worker 换任务不会换脸或创建新员工，同时避免未领取任务形成幽灵角色。
- 高频 progress 合并到动画帧，隐藏页面暂停 ticker，场景加载和资源失败均有明确恢复入口。
- 展示偏好与 general / TA 能力模式正交，不破坏模式隔离。
- Office 获得完整可视面积，房间切换不再受 sidebar 和标签页布局约束。
- 工作区与会话在 Office 中获得稳定的“楼层 / 办公室”空间导航，同时不复制数据模型。
- 默认材质与经典界面一致，Office 不再隐式改变用户的全局视觉偏好。

### Negative

- renderer 本地偏好暂不跨设备同步；若未来需要同步，必须另行评审 schema。
- 在经典与 Office 之间切换会重新挂载展示组件，局部滚动位置不会自动共享。
- Office 不直接展示经典侧栏中的全部功能；这些能力需要场景浮层或返回经典工作台。
- 同一套会话组件需要维护 classic 与紧凑 office-dock 两种布局约束。
- 当前办公室地图只有 6 个工位；保留总监后最多同时显示 5 名 worker，更多员工以摘要表示。

### Neutral

- Kanban、worker session、任务状态和权限模型均不变。
- 右栏 Office 继续存在，作为经典模式中的轻量班组视图。
- actor identity、handoff timeline 和空间编排均属于 renderer 投影，不扩张或回写业务真值。

## Alternatives Considered

### Option A: 用 Office 替换经典工作台

会牺牲高密度生产力体验，也无法满足不需要沉浸动画的用户。Rejected。

### Option B: 新增第三个顶层业务模式

会让 Office 与 general / TA 的 Provider、Memory、Skill 和权限边界耦合，并诱发重复运行时。Rejected。

### Option C: 只有创建看板后才能进入 Office

无法表达主 Agent 的持续身份，也把“办公室”错误等同于“看板”。Rejected。

## References

- 设计文档：`docs/plans/2026-07-17-ai-office-session-presentation-design.md`
- 融合架构：`docs/decisions/0001-fusion-architecture.md`
- 材质架构：`docs/decisions/0005-material-surface-token-architecture.md`

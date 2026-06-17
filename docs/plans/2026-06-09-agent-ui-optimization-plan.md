# TAgent Agent 页面高级优化建议

> **状态**：Draft v0.3，Header 首版已拍板，继续逐条评审中  
> **日期**：2026-06-09  
> **作者**：Codex（与用户共同评审）  
> **路径**：`F:\TAgent_General\docs\plans\2026-06-09-agent-ui-optimization-plan.md`

---

## 1. 目标

对 TAgent 的 Agent 会话页面做一轮产品级 UI/UX 优化规划，目标不是换肤，而是提升高频工作台的专业感、可扫描性和掌控感。

本建议覆盖：

- Agent 会话主区
- 会话 Header
- 消息流与工具执行过程
- 底部输入区与工具栏
- 右侧文件 / 变更面板
- 通用模式与 TA 模式下的空状态
- 左侧会话列表与任务状态呈现

不在本文范围内：

- Provider / Channel / API Key 逻辑改动
- Agent SDK 行为改动
- Memory schema 改动
- TA 工具 contract 改动
- 大规模主题系统重做

---

## 2. 设计判断

**Reading this as：桌面 Agent 工作台，面向高频开发 / TA 工作流用户，应采用安静、清晰、可扫描、有专业工具感的界面语言。**

因此本轮优化遵循：

- 信息密度要比普通 Chat 产品高，但不能像后台 dashboard 一样拥挤。
- 重要状态要显性化，例如运行中、阻塞、已完成、排队、上下文使用量。
- 结果优先，过程可展开。工具调用不能喧宾夺主。
- 通用模式与 TA 模式视觉共享，但数据和入口语义保持隔离。
- 空状态应引导用户开始工作，而不是自动显示旧会话或草稿状态。

---

## 3. 当前页面观察

基于以下文件阅读得到：

| 区域         | 关键文件                                                             | 当前观察                                                                                   |
| ------------ | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Agent 主视图 | `apps/electron/src/renderer/components/agent/AgentView.tsx`          | 功能完整，但底部输入区承载了大量工具入口，层级可继续优化                                   |
| Header       | `apps/electron/src/renderer/components/agent/AgentHeader.tsx`        | 首版已调整为轻量状态栏，不再显示会话标题 / 工作区                                          |
| 消息流       | `apps/electron/src/renderer/components/agent/AgentMessages.tsx`      | 已支持 SDK message、流式、重试、compact、minimap，信息能力较强                             |
| 工具过程     | `apps/electron/src/renderer/components/agent/ProcessBlockGroup.tsx`  | 已有过程分组和自动折叠，是 timeline 化的好基础                                             |
| 右侧面板     | `apps/electron/src/renderer/components/agent/SidePanel.tsx`          | 文件 / changes 能力强，但还可以升级为会话工作台                                            |
| 左侧列表     | `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`    | 首版已明确竖条语义：active / running / blocked / completed，不再把 manual working 当作蓝条 |
| Rail         | `apps/electron/src/renderer/components/app-shell/FunctionalRail.tsx` | 折叠态会话列表已按通用 / TA 模式过滤，功能按钮保持两种模式一致                             |

---

## 4. 优化原则

### 4.1 结果优先

用户进入 Agent 页面后，最想知道三件事：

1. 当前 Agent 在做什么。
2. 结果是什么。
3. 如果卡住，下一步怎么处理。

工具调用、日志、重试、上下文细节都应可见，但默认不抢结果阅读空间。

### 4.2 状态外显

Agent 产品的高级感来自“系统透明”。运行中、排队、阻塞、后台完成、上下文接近上限，都应在固定位置有轻量提示。

### 4.3 模式隔离

所有与会话相关的视觉入口都要遵守：

- 通用模式只显示 `mode` 缺省 / `general` 的会话。
- TA 模式只显示 `mode === 'ta'` 的会话。
- Chat 仅属于通用模式。

### 4.4 控件分层

底部输入区的按钮不应全部同权重。高频操作露出，低频设置折叠，状态类控件显示摘要。

---

## 5. 建议清单（待逐条评审）

| #   | 建议                        | 优先级 | 状态                       | 预估     |
| --- | --------------------------- | ------ | -------------------------- | -------- |
| 1   | Header 升级为会话状态栏     | P1     | 首版已确认                 | 0.5-1 天 |
| 2   | 输入区工具栏分层            | P1     | 待评审                     | 1-2 天   |
| 3   | 执行过程 timeline 化        | P1     | 待评审                     | 2-3 天   |
| 4   | 右侧面板升级为会话工作台    | P2     | 待评审                     | 2-4 天   |
| 5   | 空状态按通用 / TA 场景定制  | P1     | 首版已确认                 | 0.5-1 天 |
| 6   | 左侧会话列表任务队列化      | P2     | 竖条语义已确认，分组待评审 | 1-2 天   |
| 7   | 减少圆形 icon button 同质化 | P2     | 待评审                     | 0.5-1 天 |
| 8   | 固定运行状态条              | P1     | 待评审                     | 1 天     |

---

## 6. 建议 1：Header 升级为会话状态栏

### 问题

当前 Header 主要承担标题编辑和右侧面板开关，顶部空间的信息价值偏低。

### 建议

将 Header 从“会话标题编辑区”改为轻量状态栏，不再重复显示会话标题。

当前试做方案：

- Header 不显示具体会话标题。
- Header 不显示工作区。
- 具体会话名由顶部 Tab 卡和左侧会话列表承载。
- Header 只保留轻量 status chips：
  - 当前模型
  - 权限模式
  - 会话运行状态：idle / running / blocked / completed
  - 最近工具名（运行时）

顶部 Tab 卡对应调整：

- 草稿：`StickyNote` 图标 + `草稿`
- Agent 会话：`MessageSquare` 图标 + 会话名
- Chat 对话：`MessageSquare` 图标 + 对话名
- 不显示工作区 badge
- 下方横条承担 active / running / blocked / completed 状态

### 验收标准

- Header 高度保持轻量，不显著压缩消息区。
- 状态 chip 不超过一行，窄宽度下自动截断。
- TA 模式不显示通用工作区控件。
- 运行中状态无需打开侧栏即可识别。
- Header 不提供会话重命名入口；重命名仍在左侧会话列表完成。
- 顶部 Tab 卡不显示工作区。
- Tab 状态不再使用整块描边，统一使用下方横条。

### 影响文件

- `apps/electron/src/renderer/components/agent/AgentHeader.tsx`
- `apps/electron/src/renderer/components/tabs/TabBar.tsx`
- `apps/electron/src/renderer/components/tabs/TabBarItem.tsx`
- `apps/electron/src/renderer/atoms/agent-atoms.ts`
- `apps/electron/src/renderer/atoms/app-mode.ts`

### 已讨论结论（2026-06-09）

| 点                            | 结论                                                                    |
| ----------------------------- | ----------------------------------------------------------------------- |
| Header 是否显示会话标题       | 不显示。会话标题由顶部 Tab 卡和左侧列表承载                             |
| Header 是否显示工作区         | 不显示，避免信息重复                                                    |
| Header 是否保留“会话”文字     | 不保留，入口语义放到顶部 Tab 卡                                         |
| Header 当前形态               | 单行状态 chips：模型 / 权限 / 状态                                      |
| 顶部 Tab 卡是否显示“会话”文字 | 不显示。Agent / Chat tab 使用 `MessageSquare` 图标 + 会话名             |
| 顶部 Tab 卡是否显示工作区     | 不显示                                                                  |
| 顶部 Tab 卡状态表达           | 不使用整块描边；使用底部横条表达 active / running / blocked / completed |
| 后续可微调                    | 状态 chip 可前置为 `状态 / 模型 / 权限`；运行中可显示耗时               |

### 当前首版规则（2026-06-09）

Header 只承载当前会话的轻量运行环境，不承载可编辑标题：

- 模型 chip：展示当前 Agent 模型。
- 权限 chip：展示当前 permission mode。
- 状态 chip：展示 idle / running / blocked / completed；running 时可追加最近运行工具名。
- 右侧只保留必要的文件面板入口。

顶部 Tab 卡承载会话定位：

- 草稿 tab：`StickyNote` 图标 + `草稿`。
- Agent / Chat tab：`MessageSquare` 图标 + 会话标题。
- 不显示 `会话` / `对话` 文本前缀。
- 不显示 workspace badge。
- 底部横条语义：
  - active idle：主题色。
  - running：蓝色，并允许轻量状态动画。
  - blocked：橙色。
  - completed：绿色。

---

## 7. 建议 2：输入区工具栏分层

### 问题

当前输入区底部聚合了模型、权限、思考、SubAgent、语音、附件、目录、上下文、显示选项等入口。功能完整，但视觉上同权重，学习成本偏高。

### 建议

将工具栏分为三段：

| 区域             | 内容                           | 展示方式                 |
| ---------------- | ------------------------------ | ------------------------ |
| 左侧：运行策略   | 模型、权限、思考、SubAgent     | pill / segmented summary |
| 中间：输入增强   | 附件、文件夹、语音、引用       | icon button              |
| 右侧：状态与提交 | context、显示选项、发送 / 停止 | 状态 badge + 主操作      |

低频项进入 `更多` Popover，但 Popover trigger 需要展示当前启用状态。

### 验收标准

- 用户不需要识别一排等权重图标。
- 发送 / 停止按钮仍是视觉主操作。
- context 使用量始终可见。
- 窄宽度下折叠逻辑稳定，无按钮跳动。

### 影响文件

- `apps/electron/src/renderer/components/agent/AgentView.tsx`
- `apps/electron/src/renderer/components/ai-elements/InputToolbarOverflow.tsx`
- `apps/electron/src/renderer/components/agent/PermissionModeSelector.tsx`
- `apps/electron/src/renderer/components/agent/ContextUsageBadge.tsx`

---

## 8. 建议 3：执行过程 timeline 化

### 问题

工具调用和 thinking 过程已经能折叠，但仍以“内容块”心智呈现。长任务下，用户需要更快知道过程结构，而不是逐块读日志。

### 建议

把一次 assistant turn 的中间过程渲染为 timeline：

- 每个 tool_use 是一个节点。
- thinking / text 过程作为节点说明。
- tool_result 合并到对应节点。
- 默认展示摘要：工具数量、耗时、最终状态。
- 点击展开显示完整输入 / 输出。

### 验收标准

- 流式时 timeline 能实时追加节点。
- 完成后默认收起过程，结果文本保持显眼。
- 错误节点颜色与成功 / 运行中状态区分。
- 支持 `processGroupsKeepExpanded` 设置。

### 影响文件

- `apps/electron/src/renderer/components/agent/ProcessBlockGroup.tsx`
- `apps/electron/src/renderer/components/agent/SDKMessageRenderer.tsx`
- `apps/electron/src/renderer/components/agent/tool-result-renderers/`

---

## 9. 建议 4：右侧面板升级为会话工作台

### 问题

右侧面板现在主要是文件与变更视图。对 Agent 会话来说，它还可以承载更多“当前任务上下文”。

### 建议

右侧面板拆成 4 个 Tab：

| Tab     | 内容                                            |
| ------- | ----------------------------------------------- |
| Files   | 文件树、附加目录、文件预览入口                  |
| Changes | diff、未暂存变化、回退相关入口                  |
| Context | 当前附加目录 / 文件、引用、token 状态、会话路径 |
| Tasks   | 后台任务、阻塞请求、最近工具活动                |

### 验收标准

- Files / Changes 保持现有能力。
- Context 不允许编辑 memory schema，只展示会话上下文。
- Tasks 只展示当前 session 相关状态。
- 不增加第三个进程或独立服务。

### 影响文件

- `apps/electron/src/renderer/components/agent/SidePanel.tsx`
- `apps/electron/src/renderer/components/diff/`
- `apps/electron/src/renderer/atoms/agent-atoms.ts`

---

## 10. 建议 5：空状态按通用 / TA 场景定制

### 问题

通用 Agent、TA Agent、Chat 的空状态不应完全共享。不同模式下用户要开始的任务不同。

### 建议

通用 Agent 空状态：

- 新建 Agent 会话
- 选择 / 创建工作区
- 附加文件夹
- 引用已有会话

TA Agent 空状态：

- 检查资产命名
- 分析 FBX
- 扫描贴图批次
- 打开资产库
- 检查目录结构

Chat 空状态：

- 开始新对话
- 切换模型
- 选择系统提示

### 验收标准

- 空状态不自动打开旧会话。
- 空状态不显示草稿 tab。
- TA 模式 action 不创建通用会话。
- 每个 action 都能落到真实入口，不能是装饰按钮。
- 当前模式没有打开会话时，主区显示引导页，而不是继续显示上一次会话内容。
- 欢迎页入口语义不使用 `草稿`；草稿只属于 Scratch tab。
- Rail 折叠态会话列表必须按当前顶层模式过滤。
- Rail 折叠态在 TA / 通用模式下的添加和搜索按钮保持一致。

### 影响文件

- `apps/electron/src/renderer/components/welcome/WelcomeView.tsx`
- `apps/electron/src/renderer/components/welcome/WelcomeEmptyState.tsx`
- `apps/electron/src/renderer/hooks/useCreateSession.ts`
- `apps/electron/src/renderer/components/tabs/MainArea.tsx`
- `apps/electron/src/renderer/components/tabs/TabBar.tsx`
- `apps/electron/src/renderer/atoms/tab-atoms.ts`
- `apps/electron/src/renderer/components/app-shell/AppShell.tsx`
- `apps/electron/src/renderer/components/app-shell/FunctionalRail.tsx`

---

## 11. 建议 6：左侧会话列表任务队列化

### 问题

Agent 会话不只是聊天历史，更像任务队列。当前列表已经有状态色条，但状态分组还可以更明显。

### 建议

Agent 模式下按任务状态优先分组：

1. Blocked
2. Running
3. Working
4. Completed
5. Recent

Chat 模式继续按日期分组。

当前首版先不改变分组，仅收敛列表左侧竖条语义：

| 状态来源                       | 竖条颜色   | 显示条件                          |
| ------------------------------ | ---------- | --------------------------------- |
| 当前选中会话且无更高优先级状态 | 主题色     | `active === true`                 |
| 后台真实运行中                 | 蓝色       | `indicatorStatus === 'running'`   |
| 阻塞 / 需要用户处理            | 橙色       | `indicatorStatus === 'blocked'`   |
| 已完成                         | 绿色       | `indicatorStatus === 'completed'` |
| 手动 working / manualWorking   | 不显示竖条 | 避免和真实 running 混淆           |
| 未选中 idle 会话               | 不显示竖条 | 避免无当前会话时误出现蓝条        |

竖条视觉规则：

- 竖条不贴最左边界，左侧保留 4px 左右留白。
- 竖条高度短于列表项高度，上下保留留白。
- 有竖条时标题文本增加左侧间距，避免文字和状态条靠得太近。
- Chat 日期列表不复用 Agent 竖条语义，避免跨模式混淆。

### 验收标准

- Running / Blocked 永远优先可见。
- TA / 通用模式仍严格隔离。
- 已归档会话不进入主列表。
- 手动 working 与后台 running 不混淆。
- 没有当前选中 Agent 会话时，不出现 active 竖条。
- 蓝色竖条只代表真实运行中，不代表手动 working。
- 竖条与列表边界、文字之间都有稳定间距。

### 影响文件

- `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx`
- `apps/electron/src/renderer/components/app-shell/FunctionalRail.tsx`
- `apps/electron/src/renderer/atoms/working-atoms.ts`

---

## 12. 建议 7：减少圆形 icon button 同质化

### 问题

Agent 输入区和 Header 中大量按钮都是同尺寸圆形 ghost icon。整齐但层级不够清晰，功能之间难以区分主次。

### 建议

制定按钮形态规则：

| 类型     | 形态                        |
| -------- | --------------------------- |
| 主操作   | 圆形 / 高对比 icon          |
| 状态类   | pill badge                  |
| 设置类   | low-contrast icon + popover |
| 危险操作 | 语义色 + 二次确认           |
| 模式切换 | segmented control           |

### 验收标准

- 同一区域不出现 6 个以上同权重圆形 icon。
- 所有 icon-only 按钮有 tooltip / aria-label。
- 不引入新的图标库，沿用现有 `lucide-react`。

### 影响文件

- `apps/electron/src/renderer/components/agent/AgentView.tsx`
- `apps/electron/src/renderer/components/agent/AgentHeader.tsx`
- `apps/electron/src/renderer/components/ui/button.tsx`

---

## 13. 建议 8：固定运行状态条

### 问题

用户在 Agent 运行中需要持续知道“它正在做什么”。当前状态分散在消息流、工具块、输入区停止按钮、会话列表指示点里。

### 建议

在消息区顶部或输入区上方增加一条固定状态条：

```text
正在执行 check_naming · 12s · 2 个工具完成 · Enter 排队 / Shift+Enter 打断
```

状态条只在 running / blocked / queued 时出现。

### 验收标准

- 状态条不遮挡消息内容。
- 能表达排队与打断机制。
- blocked 时给出明确恢复入口。
- 后台运行时切回会话能恢复状态。

### 影响文件

- `apps/electron/src/renderer/components/agent/AgentView.tsx`
- `apps/electron/src/renderer/components/agent/ActiveTasksBar.tsx`
- `apps/electron/src/renderer/components/agent/BackgroundTasksPanel.tsx`
- `apps/electron/src/renderer/atoms/agent-atoms.ts`

---

## 14. 建议实施顺序

推荐按以下顺序逐条推进：

1. **空状态按通用 / TA 场景定制**  
   首版已确认。当前模式没有打开会话时显示引导页，不再显示旧会话或草稿入口。

2. **Header 升级为会话状态栏**  
   首版已确认。Header 不再承载会话标题 / 工作区，顶部 Tab 承载会话定位，状态由 chip 和 Tab 底部横条表达。

3. **固定运行状态条**  
   与消息排队 / Shift+Enter 打断决策直接相关，能补齐可感知性。

4. **输入区工具栏分层**  
   影响交互较多，需要单独验收。

5. **执行过程 timeline 化**  
   价值高，但涉及消息渲染路径，需测试覆盖。

6. **左侧会话列表任务队列化**  
   竖条语义首版已确认；状态分组仍待评审。完整任务队列化适合在运行状态条后做。

7. **右侧面板升级为会话工作台**  
   最大块，建议最后做。

8. **按钮形态规则统一**  
   可以穿插在每个任务中逐步收敛。

---

## 15. 风险与缓解

| 风险                 | 影响                | 缓解                                                |
| -------------------- | ------------------- | --------------------------------------------------- |
| 视觉信息过载         | 页面更乱            | 先做状态摘要，不增加大卡片                          |
| 消息流改动引入回归   | 影响 Agent 核心体验 | `ProcessBlockGroup` / `SDKMessageRenderer` 增加单测 |
| TA / 通用模式混数据  | P0 体验问题         | 所有会话入口统一检查 `mode`                         |
| 输入区重排破坏快捷键 | 高频操作受损        | 保留现有快捷键，新增手动验证清单                    |
| 右侧面板范围膨胀     | 工期失控            | 分 Tab 渐进实现，Files / Changes 先不重写           |

---

## 16. 验证清单草案

每个建议落地后至少验证：

- 通用模式新建 Agent 会话正常。
- TA 模式新建 Agent 会话正常，通用模式不可见。
- 折叠 / 展开 LeftSidebar 后会话列表仍按模式过滤。
- Rail 折叠态在通用 / TA 模式下都显示添加和搜索按钮。
- Rail 折叠态只显示当前顶层模式的会话。
- 运行中发送 Enter 排队，Shift+Enter 打断。
- 无打开会话时显示空状态，不显示旧会话内容。
- 无打开会话时不出现 active 会话竖条。
- 左侧 Agent 列表蓝色竖条只出现在真实 running 会话上。
- 顶部 Tab 不显示工作区 badge，不使用整块描边。
- 文件面板打开 / 关闭正常。
- context 使用量显示正常。
- `bun run typecheck` 通过。
- UI 改动需要截图或人工验收记录。

---

## 17. 待拍板问题

1. Header 状态 chip 是否改为 `状态 / 模型 / 权限` 顺序，还是保持当前 `模型 / 权限 / 状态`？
2. Header running 状态是否显示耗时，还是只显示最近工具名？
3. 输入区工具栏是否接受从圆形 icon 迁移到 pill / segmented 混合形态？
4. Timeline 是否默认收起工具过程，还是保留当前“运行中展开、完成后自动收起”策略？
5. 右侧面板是否纳入 Context / Tasks 两个新 Tab？
6. TA 空状态快捷动作第一批放哪 3 个？
7. 左侧 Agent 会话列表是否从日期分组改为任务状态分组？

# TAgent 前端流畅度诊断报告

> **状态**：已诊断，逐条对齐中（不落代码，全部对完再开长任务统一改）
> **日期**：2026-07-23
> **来源**：4 个 explorer 并行调研（React 渲染 / 长列表滚动 / CSS 动画玻璃 / 编辑器启动打包）+ F:\Kun 长会话调研
> **范围**：TAgent renderer 前端流畅度（apps/electron/src/renderer + packages/ui + packages/core 高亮服务）

---

## ⚠️ 2.0 重构筛选原则（2026-07-23 用户定调）

用户托底：2.0 是近期的（当前 1.7.0，2.0 紧随）；2.0 考虑把 Claude Agent SDK 黑盒换成自研 PI Agent（自研 loop+外围）；**会话页是 proma 的底，2.0 要重写**。1.7.0 已把很多外围自研重构，会话页主区仍是 proma 遗产。

**用户筛选原则**：可能受 2.0 重构影响、风险大、工作量大的——**都不做**。

据此分三类：
- **✅ 2.0 资产（建议做）**：共享基础设施层，与会话页重写无关，2.0 复用 → P0-3 / P0-4 / P0-5 / P1-3 / P2-3 / P1-4
- **✅ 轻量止血（过渡可做，2.0 扔不可惜）**：落在会话页但改动极小 → P0-1（已对齐）/ P1-5
- **❌ 不做（受 2.0 重写影响 / 风险大 / 工作量大）**：会话页深度改造，2.0 扔白做 → P1-1 / P1-2 / P1-6 / P2-1 / P2-2

**长会话卡问题**：留到 2.0 自研会话页时按 F:\Kun 思路（流式 live 分离 + 历史折叠）一次做对，不在 1.x proma 底上过渡。

---

## 0. 一句话结论

流畅度瓶颈不在某一处，而是**三条主线叠加**：① 流式输出时每帧重建 Markdown（最大卡顿源）；② 全项目零虚拟化，长列表全量挂 DOM；③ glass 材质 blur 30–56px + 列表项带 blur，滚动掉帧。外加打包层零代码分割，首屏背了整套看板 / 记忆 d3 / TA 面板。

---

## 1. 三条核心瓶颈（带证据）

### 瓶颈 A：流式期间每帧重建 Markdown

- `apps/electron/src/renderer/components/ai-elements/message.tsx:32-38` —— `MessageResponse` 每次渲染新建 `handleOpenExternal`，而 `BaseMessageResponse` 的 memo 比较器**显式检查 `onOpenExternal` 引用**（`packages/ui/src/components/message/index.tsx:367-370`）→ 所有历史 text 块的 `react-markdown` 组件表每 token 重建。**这是流式卡顿最大单点。**
- `apps/electron/src/renderer/components/agent/SDKMessageRenderer.tsx:615` `AssistantTurnRenderer` + `ContentBlock.tsx:713` **未 memo**，函数体内 `enrichedBlocks`/`childBlocksMap`/`renderItems` 无 `useMemo` → live turn 每 token 全量重算。
- `apps/electron/src/renderer/components/agent/AgentMessages.tsx:699,738,754` —— `allSDKMessages`/`allGroups`/`buildHistoricalTaskSubjects` 每 token 全量重建（注释 `:751` 自认「O(T×M) 雪崩」），长会话越流越卡。

### 瓶颈 B：长列表全量渲染，无虚拟化

- 全项目 grep `@tanstack/react-virtual` / `react-window` **0 命中**。
- 消息列表 `AgentMessages.tsx:935` `mergedTimeline.map` 全量挂 DOM，单条 assistant 消息含 Markdown+Shiki+Mermaid+KaTeX 时 **500–1500 节点**。
- 会话列表 `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx:1870`（项目分组 `.map`）可达上千行全量渲染，`:2859` 注释「主动移除折叠查看更多」。
- 流式滚动跟随靠 `use-stick-to-bottom`，内容持续增高时每帧重算 stick，长会话仍卡。
- 图片 `<img>` 全部**无 `loading="lazy"`**（`packages/ui/src/components/message/index.tsx:555`）。

### 瓶颈 C：玻璃效果过度 + 打包零分割

- glass 材质 blur：modal 52px、popover **56px**、chip 30px（`packages/ui/styles/glass.css:154-165`）。全仓玻璃类 **222 处 / 42 文件**。
- `[data-material='glass'] .session-list-item-active` 带 30px blur + 4 层阴影 + 2 伪元素（`glass.css:692`）—— 侧栏已覆盖禁用，但 `SessionSearchInline`/`AgentMessageQueue`/`KanbanRailContent`/`DraftListPanel` 等**滚动列表的选中项未被覆盖**，每条选中都 blur。
- 多个 popover **自身是 `overflow-y-auto` 滚动容器又带 backdrop-blur**（`AgentMessageQueue.tsx:55`、`FileMentionList.tsx:307`）→ Chromium 每帧重算模糊。
- `.right-panel-shadow-frame` 三层 `drop-shadow` filter（模糊 64–76px）+ `transition: filter`（`apps/electron/src/renderer/styles/globals.css:5160`）→ filter 动画是已知掉帧陷阱。
- `apps/electron/vite.config.ts:6-29` **零 manualChunks / 零代码分割**；`apps/electron/src/renderer/components/tabs/MainArea.tsx:36-45` 顶层静态 import 看板 / 记忆(d3-force) / 技能 / 自动化 / TA 全套面板 → 全进首屏 chunk。Shiki 预加载 **18 语言 + 4 主题**（`packages/core/src/highlight/shiki-service.ts:21`，实际只用 2 主题）。
- 输入卡顿残留：每键 `htmlToMarkdown` 全量转换 + 两个 `new Map` 拷贝（`rich-text-input.tsx:494`），无防抖。atomFamily 拆分已彻底，不是整树 re-render 问题了。

---

## 2. 优化清单总表

| 级别 | 改动 | 证据 | 预期收益 | 改动量 | 对齐状态 |
|---|---|---|---|---|---|
| **P0-1** | `MessageResponse` 用模块级常量稳定 `onOpenExternal` | `ai-elements/message.tsx:32` | 流式卡顿最大单点，历史块不再每帧重建 Markdown | 极小 | ⏸ 暂不需要·待定（治流式非切会话痛点，留 2.0；方案备查 §3） |
| **P0-2** | ~~滚动列表选中项 blur 改实色 tint~~ | `glass.css:692` + 8 个未覆盖列表 | 滚动列表掉帧 | 小（CSS） | ❌ 撤销（对齐后判定不做，见 §3 P0-2） |
| **P0-3** | ~~Shiki 瘦身：2 主题 + 按需语言~~ | `shiki-service.ts:21` | 首条带代码消息渲染 + bundle | 小 | ⏸ 暂不需要·待定（治启动/代码渲染，非切会话痛点，留 2.0；方案定稿备查 §3） |
| **P0-4** | ~~vite manualChunks + 视图懒加载 + TA 入口隐藏~~ | `vite.config.ts`、`MainArea.tsx:36` | 首屏 chunk 瘦身 | 中 | ⏸ 暂不需要·待定（治启动非切会话痛点，留 2.0；TA 隐藏方案定稿备查 §3） |
| **P0-5** | ~~飞书 5s 轮询加开关~~ | `main.tsx:667` | 不用飞书也省每 5s IPC | 极小 | ⏸ 暂不需要·待定（非切会话痛点，留 2.0） |
| **P1-1** | ~~`AssistantTurnRenderer`/`ContentBlock` 加 `memo` + `useMemo`~~ | `SDKMessageRenderer.tsx:615`、`ContentBlock.tsx:713` | live turn 流式打字跟手度 | 中 | ⏸ 暂不需要·待定（会话页深度改造，2.0 扔白做） |
| **P1-2** | ~~流式 append-only 增量~~ | `AgentMessages.tsx:699` | 长会话雪崩缓解 | 中 | ⏸ 暂不需要·待定（会话页深度改造，2.0 扔白做） |
| **P1-3** | ~~玻璃 blur 上限 + transition 收敛~~ | `glass.css:154`、21 文件 | GPU 合成压力 | 中（CSS） | ⏸ 暂不需要·待定（非切会话痛点，留 2.0） |
| **P1-4** | ~~图片懒加载~~ | `message/index.tsx:555` | 多图消息滚动 | 极小 | ⏸ 暂不需要·待定（非切会话痛点，留 2.0） |
| **P1-5** | ~~会话页滚动 blur 拖影~~ | `agent-thread.css:844`、`AgentMessages.tsx:559` | 滚动残影 | 小 | ⏸ 暂不需要·待定（非切会话切换痛点，留 2.0） |
| **P1-6** | ~~借鉴 F:\Kun：流式 live 分离 + 历史折叠~~ | `AgentMessages.tsx:699` | 长会话越流越卡 + DOM 过多 | 中 | ⏸ 暂不需要·待定（会话页深度改造，2.0 扔白做；调研留 §3 备 2.0 自研会话页用） |
| **P2-1** | ~~消息列表虚拟化~~ | `AgentMessages.tsx:935` | 长会话 DOM 线性增长根治 | 大 | ⏸ 暂不需要·待定（2.0 扔白做） |
| **P2-2** | ~~会话列表窗口化 / 分组懒挂载~~ | `LeftSidebar.tsx:1870` | 上千会话侧栏 | 中大 | ⏸ 暂不需要·待定（非痛点，留 2.0） |
| **P2-3** | ~~TipTap table/task-list 只在 DraftEditor 懒加载~~ | `rich-text-input.tsx:16` | 首屏 TipTap 体积 | 中 | ⏸ 暂不需要·待定（治启动不治会话卡，留 2.0） |
| **P1-7** | ⭐ 切会话分批挂载：先挂最近 N 条，空闲帧递增挂剩余 | `AgentMessages.tsx:935` | **切长会话动画卡顿（用户唯一真痛点）** | 小（~20 行，纯渲染层） | ✅ 实施中（过渡止痛，2.0 扔不可惜） |

**🎯 最终聚焦（2026-07-23）**：聊完全部后，用户唯一真痛点 = **切长会话时动画卡顿**（短会话不卡）。其余条目要么治不到此痛点、要么 2.0 扔白做。**只实施 P1-7**，其余统一标「暂不需要·待定」留 2.0。P1-7 落在会话页（proma 底），但改动极小极局部（纯渲染层 slice + 分批，不碰数据流/memo/group），属过渡止痛——2.0 自研会话页时按 F:\Kun 思路重写，这 ~20 行扔掉不可惜。

---

## 3. 各条详细分析

### P0-1 稳定 `MessageResponse` 的 `onOpenExternal`（已对齐）

**问题链**（两层叠加，都因同一个函数引用每帧新建）：

1. 应用层 `ai-elements/message.tsx:33` 每次渲染新建 `handleOpenExternal`
2. 底层 `message/index.tsx:367` memo 比较器检查 `onOpenExternal === onOpenExternal` → 永远不等 → `BaseMessageResponse` 每次进函数体
3. 底层 `:292` 的 `components` useMemo 依赖 `[onOpenExternal]` → 每帧重建 `<Markdown>` 组件表 → react-markdown 把每个节点当新组件重新渲染

结果：流式期间**每条已完成的历史消息**跟着 live turn 每帧重跑 Markdown 解析。会话越长、代码块越多，越卡。

**改法**（函数提到模块级，引用稳定）：

```tsx
// 改前 message.tsx:32-38
export const MessageResponse = function MessageResponse(props: MessageResponseProps) {
  const handleOpenExternal = (url: string) => {
    window.electronAPI.openExternal(url)
  }
  return <BaseMessageResponse {...props} onOpenExternal={handleOpenExternal} />
}

// 改后
// 模块级常量：调用时才访问 window.electronAPI，引用稳定，
// 让 BaseMessageResponse 的 memo 比较器命中，避免流式期间每帧重建 react-markdown 组件表
const openExternal = (url: string) => {
  window.electronAPI.openExternal(url)
}

export const MessageResponse = function MessageResponse(props: MessageResponseProps) {
  return <BaseMessageResponse {...props} onOpenExternal={openExternal} />
}
```

**收益边界（必须说清）**：

- ✅ 让 `BaseMessageResponse` 这层 memo 命中，省掉「每条历史消息的 react-markdown 重新解析」——很大一块。
- ❌ **不解决** `AssistantTurnRenderer`/`ContentBlock` 没加 memo 的问题：父级每帧重渲染时，父级函数体里的 `enrichedBlocks`/`childBlocksMap` 等重算**照跑**。
- 所以**单做这条**：长会话流式明显改善（Markdown 不再每帧重建），但父级重算要等 P1-1 才彻底消掉。**P0-1 与 P1-1 必须配合才完整**；少了 P0-1，P1-1 也救不回 Markdown。

**缺点 / 边界（已对齐确认）**：

1. 失去「按实例定制」灵活性：模块级常量是全局单例。当前所有调用点都是无差别 `window.electronAPI.openExternal(url)`，这个灵活性用不到。用不到的灵活性换现在的性能，划算——但这是一笔取舍。
2. `window.electronAPI` 不存在时会抛错：**原有行为，非新风险**（原代码也是点击时才访问，无可选链）。模块级箭头函数体延迟到调用才执行，崩溃时机和条件与原来一致（都是「点击链接时」）。如要彻底安全可顺手加 `window.electronAPI?.openExternal?.(url)`，属额外加固，不算这条的代价。

**逐字打字机不阉割（已对齐确认）**：

打字机由 `useSmoothStream`（`packages/ui/src/hooks/useSmoothStream.ts:67`）独立驱动：后端推 token → `content` 变 → `:144` effect 算 delta → `Intl.Segmenter` 拆字符入队（`:157`）→ rAF 循环（`:91`）每帧取 `queue.length/8` 字符 `setDisplayedContent`（`:126`）→ `displayedContent` 传给 live 那条 `<MessageResponse>{streamingText}</MessageResponse>` 的 `children`（`AgentMessages.tsx:223`）。

本条只稳定 `onOpenExternal`，**不动 `children`**。live turn `children` 每帧都新，memo 比较器 `children === children` 该过还是过，照常重渲染、照常逐字吐字。只有 `children` 不变的历史块跳过重渲染——而历史块本就不该吐字。**因此逐字效果不阉割，反而更顺**（历史块不再每帧占用主线程解析 Markdown，rAF 吐字更跟手）。

**验证方法**：React DevTools Profiler，流式期间应只有 live 那条 `MessageResponse` 每帧 commit（带新 `children`），历史 `MessageResponse` 静默不动。

**附带**：同文件 `UserMessageContent`（`:45-47`）新建了 `handleOpenExternal` 但没传给底层（死代码），顺手删。`MessageAttachments`（`:57-63`）有同类「每次新建回调」问题，**本条先不动**，单独评估底层 memo 比较器后决定。

---

### P0-2 滚动列表选中项 blur 改实色 tint（❌ 对齐后撤销，不做）

**对齐结论（2026-07-23）**：经与用户对齐，**此条撤销不做**。

理由：
1. 用户判断这不是重点——sidebar 列表就那么点内容，盯着小列表优化是抓错重点，真正卡的是**会话页信息流**（瓶颈 A/B），不是这些小列表。
2. 改这个要牺牲 glass 主题的玻璃质感（选中态从玻璃变实色），用户明确反对"为流畅砍效果"——"为了流畅命令行最流畅"。
3. 调研中发现一个原本以为是"零损失"的点（glass 选中项背景近不透明、blur 看不见 = 白烧 GPU）经核实**不成立**：实色背景透明度 ~0.96 但玻璃层 `--surface-opacity-chip: 0.14` 叠在上面，blur 是真看得见的质感，砍了有真损失。

**保留原文备查**：

**问题**：`packages/ui/styles/glass.css:692-742` `[data-material='glass'] .session-list-item-active` 带 30px backdrop-blur + 4 层阴影 + `::before` 径向渐变 + `::after` mask 描边。`.app-nav-sidebar` 下已被 `apps/electron/src/renderer/components/app-shell/app-shell.css:1288-1306` 覆盖禁用（`backdrop-filter: none`），但下列滚动列表的选中项**未被覆盖**：

- `apps/electron/src/renderer/components/app-shell/LeftSidebar.tsx` → `SessionSearchInline.tsx:439,477`（搜索结果滚动列表 `overflow-y-auto`）
- `apps/electron/src/renderer/components/agent/AgentMessageQueue.tsx:95`
- `apps/electron/src/renderer/components/kanban/KanbanRailContent.tsx:111`
- `apps/electron/src/renderer/components/draft/DraftListPanel.tsx:172`
- `apps/electron/src/renderer/components/plugin/PluginNavSlideList.tsx:50`
- `apps/electron/src/renderer/components/automation/AutomationRailList.tsx:157`
- `apps/electron/src/renderer/components/kanban/KanbanSwitcherDialog.tsx:109`
- `apps/electron/src/renderer/components/agent/AgentModelSelector.tsx:327`

glass 材质下这些列表的选中项会带 30px backdrop-blur + 多层阴影 + 2 伪元素，在滚动列表里是掉帧源。

**改法候选**（待对齐选哪个）：

- 方案 A：把 `apps/electron/src/renderer/styles/globals.css:796-799` 的全局禁 blur 规则上提，移除 `[data-material='glass'] .session-list-item-active` 的 blur 分支，glass 材质下选中态统一用半透明实色 tint（复用 frosted 的 `--session-glass-strong` 实色），删 `::before/::after`。
- 方案 B：保留 glass 分支，但把上述 8 个滚动列表逐一加禁 blur 覆盖（治标，新增列表还会漏）。

**收益**：滚动列表掉帧根治（实色无 blur 合成成本）。**风险**：glass 材质下选中态视觉变「实色」而非「玻璃」，需视觉抽查确认可接受（侧栏已是实色，参照即可）。

---

### P0-3 Shiki 瘦身：2 主题 + 按需语言（✅ 已对齐定稿）

**问题**：`packages/core/src/highlight/shiki-service.ts:21-43` `DEFAULT_LANGS` 18 个、`DEFAULT_THEMES` 4 个一次性 `createHighlighter` 全量加载。首次触发（打开含代码块的会话）主线程同步加载 18 语言 4 主题。

**改法（定稿，2026-07-23）**：

- **主题**：`DEFAULT_THEMES` 4 → **2**（`github-light` + `github-dark`）。`CodeBlock.tsx:41-42` 写死只用这 2 套，`one-light`/`one-dark-pro` 从未被使用 → 直接删，**纯赚零损失**。
- **预载语言**：18 → **12**，按用户实际使用画像（TAgent 本身 + UE5 C++ + 前端 + Python）：
  - 预载：`typescript`、`tsx`、`javascript`、`json`、`markdown`、`shellscript`、`c`、`cpp`、`csharp`、`html`、`css`、`python`
  - 临时加载（真遇到才 `loadLanguage`）：`java`、`go`、`rust`、`sql`、`yaml`、`toml`
- 临时加载走已有 `resolveAndLoadLanguage` 机制（`shiki-service.ts:230-246` 已存在按需加载，仅缩小默认列表）。

**收益**：Shiki 初始化体积（18→12 语言、4→2 主题）显著下降，首条带代码消息渲染延迟下降 + bundle 体积下降。

**风险/代价**：临时加载的 6 种语言首次出现时短暂未高亮（素颜几百毫秒），已有 `onHighlighterReady` 兜底（`CodeBlock.tsx:233`）。**用户明确容忍**：单块重内容加载可蒙版覆盖、5 秒内出结果都接受（见项目记忆 loading-tolerance），此素颜远在容忍内，无需蒙版。

**用户使用画像依据**：TAgent 自身 TS/TSX/前端（html/css）+ UE5（c/cpp/csharp）+ Python（多处用）+ 日常 shell/json/markdown。java/go/rust/sql/yaml/toml 偶尔出现 → 临时。

---

### P0-4 vite manualChunks + MainArea 视图 React.lazy + TA 入口隐藏

**问题**：

- `apps/electron/vite.config.ts:6-29` `build` 配置只有 `outDir` + `emptyOutDir`，**无 `rollupOptions.output.manualChunks`，无任何 chunk 划分**。
- `apps/electron/src/renderer/components/tabs/MainArea.tsx:36-45` 顶层静态 import 全部主区视图：`KanbanMainView`、`MemoryMonitorPanel`（→ 静态 import `MemoryGraph` → `d3-force` + `d3-scale`）、`SkillsMainView`、`AutomationMainView`、`AssetLibraryPanel`/`TAConfigPanel`/`PipelinePanel`/`ReviewQueuePanel`（TA 全套）、`WelcomeView`。这些只在对应 rail 选中时渲染，但 **import 顶层 → 全进首屏 chunk**。用户首屏通常只进 Agent 会话，却预载了看板/记忆 d3/技能/自动化/TA 全套。
- `apps/electron/src/renderer/App.tsx:9-13` `SettingsDialog`/`OnboardingView`/`TutorialBanner`/`EnvironmentCheckDialog`/`FeedbackDialog` 顶层静态 import。

**拆三块实施**：

#### 块一：TA 模式入口隐藏（✅ 方案定稿，2026-07-23）

用户决定：TA 模式大量未开发，2.0 再做。**只藏入口、不删任何代码**，TA 全套原样留 2.0 用。藏了入口后 TA 视图自然不加载，与懒加载合并省事。G/TA 切换按钮组整个不显示（只留 G 没意义）。

**最小改动（2 文件 3 处 + 1 开关，风险极低，不动业务逻辑）**：

1. **新增开关** `app-mode.ts`（约 `:30` 后）：
   ```ts
   /** TA 模式入口是否开放（2.0 前隐藏，UI 与回退共用此开关） */
   export const taModeEntryEnabledAtom = atom<boolean>(false)
   ```
   不持久化，硬编码 `false`，2.0 翻 `true` 即恢复入口+回退。

2. **持久化回退** `app-mode.ts:37` `topLevelModeAtom` getter 加 sanitize（覆盖所有读点：MainArea/FunctionalRail/LeftSidebar/AppShell/tab-atoms/activeRailItemAtom）：
   ```ts
   (get) => {
     const stored = get(topLevelModeStorageAtom)
     if (stored === 'ta' && !get(taModeEntryEnabledAtom)) return 'general' // 入口隐藏期强制回退
     return stored
   },
   ```
   防老用户（localStorage 存了 `'ta'`）打开应用卡在 TA 视图出不来。一处覆盖全部，零闪烁。

3. **藏 Rail 按钮组** `FunctionalRail.tsx:382-430` 的 `{modeButtons.map(...)}` 整块用 `{taModeEntryEnabled && (...)}` 包住（读 `useAtomValue(taModeEntryEnabledAtom)`）。**注意**：只藏 modeButtons 这组，**保留同 island（`app-rail-island--system`）里的 Office 全局模式切换**（`:433+`）。

**可选收尾**：`useGlobalAgentListeners.ts:1514-1541` 的 TA 意图 toast「前往 TA 模式」action，开关关时不弹/去 action（回退已兜底切不动，但点了无反应体验差）。可后做。

**不动的**：TA 主进程服务（ta-mcp-service/ta-intent-service/ta-tools/asset-store/pipeline-service）、switch-mode-tool（死代码，无执行体、未在 MCP 注册）、TA 业务代码——全留着 2.0 用。主进程 ModeManager 不写 renderer localStorage，事件推 `'ta'` 会被 atom getter 归一。

**收益**：TA 四件套（Asset/Pipeline/Review/TAConfig）+ TA 视图不渲染、不进首屏；老用户自动回通用；2.0 翻一个开关全恢复。

#### 块二：MainArea 视图懒加载（待对齐清单）

`MainArea.tsx:36-45` 顶层静态 import 的视图改 `React.lazy`。配合块一（TA 隐藏后 TA 视图本来就不渲染），进一步把看板/记忆 d3/技能/自动化移出首屏 chunk，点 rail 才加载。

- **用现成 `tabSwitching` 蒙版机制**（`MainArea.tsx:238-248`）做 Suspense fallback：点 rail 首次切换先蒙版覆盖，5 秒内出（契合用户 loading-tolerance）。
- **不懒加载**：会话页主路径（GeneralMainArea / TabContent）——首屏主线，懒了更慢。
- **待对齐**：哪些视图 lazy、Suspense 蒙版接法。

#### 块三：vite manualChunks（待对齐粒度）

**诚实说**：Electron 本地加载、不走网络，manualChunks 的"缓存收益"在桌面应用近乎为零。真正价值是**依附块二**：lazy 视图拆出后，让被多个视图共用的重型库（d3/react-markdown/tiptap）单独成块，避免重复打进每个 lazy chunk。

- **倾向粗粒度**：只拆真正大且独立的（d3 一定拆——只 MemoryGraph 用），其余让 Vite 默认。chunk 多反碎、难管。
- **待对齐**：拆哪些 vendor。

**整体收益**：首屏 chunk 大幅瘦身（d3、看板、TA 面板、技能、自动化移出首屏），冷启动更快。**风险**：块一极低；块二/三中（manualChunks 配置不当可能切碎 chunk，但 Electron 本地无网络往返影响）。

---

### P0-5 飞书 5s 轮询加「已配置才启动」开关

**问题**：`apps/electron/src/renderer/main.tsx:667` `FeishuInitializer` `setInterval(reportPresence, 5000)` 挂载即跑，常驻不关（组件永不卸载）。即使用户未配飞书，只要主窗口活着就每 5 秒发一次 IPC `reportFeishuPresence`。

**改法**：仅在飞书已配置/启用时启动轮询（读飞书配置 atom / settings 判断），未配置时不挂 interval。

**收益**：不用飞书的用户省常驻 CPU/IPC。**风险**：低。需确认飞书配置的读取时机与启用判定字段。

---

### P1-1 `AssistantTurnRenderer`/`ContentBlock` 加 memo + useMemo（已对齐，用户痛点待定）

**对齐结论（2026-07-23，修正前期判断）**：

前期判断"历史 turn 每帧重算 enrichedBlocks"**不准确**。核实 `areMessageGroupPropsEqual`（`SDKMessageRenderer.tsx:1614-1667`）：`MessageGroupRenderer` 这层 memo **已生效**，流式时非 live 组返回 true 跳过 re-render → 历史 turn 的 `AssistantTurnRenderer` 函数体根本不执行，**历史 turn 不重算**。

真正受影响的只有 **live turn**（正在流式打字那条）：
- live turn 因 `streamingText` 每帧变（`:1622` `prev.streamingText !== next.streamingText` → memo 不过），**每帧重渲染**
- 每帧重跑 `enrichedBlocks`/`agentToolIds`/`childBlocksMap`/`topLevelBlocks`（`:642-691`，遍历整个 turn 所有消息块）
- live turn 越长（输出越多），每帧重算成本越高

**收益（修正）**：流式打字跟手度改善（中等），**不是长会话卡顿的解药**（长会话卡是 DOM 全量挂载，见 P2-1）。

**关键风险（必须先处理）**：`:694-702` 流式时 `mergeStreamingContentIntoBlocks` **就地 mutate** `topLevelBlocks`（`topLevelBlocks.length = 0; topLevelBlocks.push(...merged)`）。若把 `topLevelBlocks` 包 useMemo 缓存引用，流式时这个 mutate 会破坏 memo 语义、引入 bug。**加 memo 前必须先把流式 merge 改成不可变更新（返回新数组而非就地改）**，是有依赖关系的两步，不能无脑加。

**做不做取决于用户痛点**（待用户反馈）：
- 痛点是流式打字时卡 → 做这条
- 痛点是长会话越用越卡 → 这条没用，跳过看 P1-2/P2-1

用户已选**稳妥路线**：P1-1 + P1-2 先做，P2-1 虚拟化暂缓。

---

**保留原文备查**：

**问题**：

- `SDKMessageRenderer.tsx:615` `AssistantTurnRenderer` 未 memo，函数体无 `useMemo`：`enrichedBlocks`（`:642`，遍历所有 assistant 消息 + `normalizeThinkTagsInContentBlocks`）、`agentToolIds`/`childBlocksMap`/`topLevelBlocks`（`:670-700`）、`renderItems`、`processItems`/`answerItems` filter（`:792-799`）、`textContent` join（`:802-805`）、`mainlineAssistants` filter（`:807`）每次 render 全跑。流式期间 live 组每 token 重渲染都重算。
- `ContentBlock.tsx:713` `ContentBlock` 未 memo，每个 text/tool_use/thinking 块渲染入口，`MessageResponse`（markdown）走它。流式期间父组重渲染时所有历史 ContentBlock 重新执行函数体。

**改法**：

- 两个组件加 `React.memo`，配合 `MessageGroupRenderer` 已有的 stable-id 比较器（`SDKMessageRenderer.tsx:1614-1667`），历史 turn 流式期间完全跳过重渲染。
- 函数体重计算包 `useMemo`（依赖 turn 消息 stable id / block 引用），live turn 的重算降为「每 token O(1 增量)」而非全量。

**收益**：流式渲染核心优化，历史 turn 跳过 + live turn 增量。**风险**：中。memo 比较器与 props 引用需仔细处理（`SDKMessageRenderer.tsx:767-772` 传的内联 `isStreaming`/`dimmed` 布尔 OK，但 `basePaths` 内联数组 `AgentMessages.tsx:973-979` 当前侥幸不比，加 memo 后需注意）。**与 P0-1 配合才完整**。

---

### P1-2 流式 append-only 增量

**问题**：`AgentMessages.tsx:699-734` `allSDKMessages` 每 token 重建数组 + `stampStableKey` 遍历，连带 `allGroups`（`:738` `groupIntoTurns` O(M)）、`liveGroupSet`（`:759`）、`minimapItems`（`:768`）、`mergedTimeline`（`:857` 含 sort）每 token 全量重算。`liveMessagesMapAtom` 每来一条消息 `map.set(sessionId, [...current, payload.message])`（`useGlobalAgentListeners.ts:856`）产生新数组引用。

**改法**：流式期间 `allSDKMessages`/`allGroups` 改 append-only 增量而非每 token 全量重建；历史部分冻结引用，仅 live 部分增量更新。`buildHistoricalTaskSubjects`（`SDKMessageRenderer.tsx:487` O(M) 扫全量）同样改增量。

**收益**：长会话 O(T×M) 雪崩缓解，会话越长收益越大。**风险**：中高。增量更新逻辑复杂，需保证 group/stable key 一致性，回归测试成本高。**待对齐**：是否与 P2-1 虚拟化合并设计（虚拟化本身可降低重算频率）。

---

### P1-3 玻璃 blur 上限 + transition 收敛 + popover 不滚动

**问题**：

- glass 材质 blur 全部 >12px（`glass.css:154-165`，最高 56px），Electron 高风险档。
- `session-glass-surface session-glass-popover` 同节点双声明（`FileMentionList.tsx:43,296,307`、`WorktreeSelector.tsx:119`、`MentionList.tsx:71,80`、`TabPreviewPanel.tsx:87`、`SessionMiniMapPopover.tsx:458`、`SettingsSearch.tsx:140`）冗余。
- `TabSwitcher.tsx:332-334` overlay + surface + modal 三层 blur 嵌套。
- `transition: all` 命中 21 个文件（`appearance-overrides.css:750,822,961`、`ai-office.css:131,168`、`globals.css:6302` 等），把 box-shadow/filter/background 渐变纳入插值，hover 易掉帧。
- 触发 layout 的 transition：`transition: width`（`globals.css:5150,5174`、`app-shell.css:598,628,2224`、`appearance-overrides.css:738`）、`transition: left`（`globals.css:5376,6475`）、`transition: margin-*`（`app-shell.css:270,2422`）、`transition: gap`（`app-shell.css:463`）、`transition: filter`（`globals.css:5162`）。
- `will-change` 挂 layout 属性常驻：`globals.css:998,1027,274,5997,5151,5175`。
- neoNav 扫光 `transition: left 0.8s`（`glass.css:1066`）长 layout 动画。
- popover 自身 `overflow-y-auto` + backdrop-blur：`AgentMessageQueue.tsx:55`、`FileMentionList.tsx:307`、`WorktreeSelector.tsx:119`。

**改法**：

- glass 材质 blur 上限压到 20–24px（modal/popover 不超过 28px），与 neoNav 写死 20px 对齐。
- `session-glass-surface session-glass-popover` 同节点用法二选一（留 popover 删 surface）。
- `transition: all` 全量替换为具体属性（transform/opacity/background-color）。
- layout 属性动画（width/left/margin）改 `transform: translate3d/scaleX`，`will-change` 收敛为 `transform, opacity`。
- `.right-panel-shadow-frame` 三层 drop-shadow filter 拆成单个 `box-shadow`，`transition: filter` 改 `none` 或仅过渡 opacity。
- popover 容器不滚动，内部独立滚动区无 blur。
- neoNav 扫光动画删除或改 transform。

**收益**：GPU 合成压力、滚动/开合掉帧。**风险**：中高。CSS 大面积调整，需逐主题（ocean/forest/slate + light/dark）视觉回归。**待对齐**：blur 上限具体数值、哪些 layout 动画值得改（侧栏 width 过渡已有 `data-right-resizing` 关闭机制缓解）。

---

### P1-4 图片懒加载

**问题**：`packages/ui/src/components/message/index.tsx:555-569` 和 `SDKMessageRenderer.tsx:1097-1102` 的 `<img>` 无 `loading="lazy"`、无 `decoding="async"`、无缩略图（直接用原图 `src` CSS 缩放）。

**改法**：`<img>` 加 `loading="lazy" decoding="async"`。

**收益**：多图消息首屏 + 滚动。**风险**：极低。

---

### P1-5 会话页滚动 blur 拖影（ghosting）

**问题（用户反馈"拖高光拖影"，2026-07-23）**：会话页滚动时玻璃元素拖出残影。

**根因（代码注释自述，`apps/electron/src/renderer/styles/agent-thread.css:839-851`）**："滚动时 backdrop-filter 导致 GPU 合成滞后，拖出残影（ghosting）"。会话页里带玻璃模糊的元素（进度条 `agent-turn-process`、标题条 `agent-turn-title`、工具详情卡 `agent-tool-detail`、运行中徽章 `agent-running-badge`、`agent-sticky-jump`），滚动时模糊跟不上滚，拖出影子。

**已有一版缓解（`AgentMessages.tsx:559-577`）**：滚动时给 scrollEl 加 `is-scrolling` class（150ms 防抖移除），`agent-thread.css:844-851` 把上述 5 类元素的 `backdrop-filter: none !important` 临时关掉。**但只罩了这 5 类**，若还有其他玻璃元素未被纳入名单，滚动时仍拖影；停滚 150ms 恢复时也可能闪一下。

**改法**：扩大 `is-scrolling` 禁用名单，把会话页内所有带 backdrop-blur 的元素纳入（grep `backdrop-filter` 在 agent-thread 相关组件里的使用点逐一确认）。停滚恢复的 150ms 可调或改用 opacity 渐变过渡避免硬切闪烁。

**收益**：滚动残影消除。**风险**：低。滚动时禁 blur 无视觉损失（滚动时本就看不清 blur），停滚恢复需测有无闪烁。**待确认**：用户拖影是**滚动时**出现（手在滚就有、停了就没 → blur 拖影，按此条处理）还是**静止拖鼠标选文字**也有（→ 另一类问题，文字选择渲染）。用户此轮未最终确认，留待下次。

---

### P1-6 借鉴 F:\Kun：流式 live 分离 + 历史折叠（⭐ 长会话稳妥解药）

**背景（2026-07-23）**：用户要求参考 F:\Kun 的长会话做法。调研 F:\Kun `src/renderer/src/components/chat/` 后发现一套**不依赖虚拟化**的长会话方案，正好替代已暂缓的 P1-2 / P2-1，且规避了虚拟化"乱跳"风险。

**F:\Kun 核心机制（证据）**：

1. **流式 live 文本与历史数组分离**（`chat-projection-reducer.ts:110-138, 187`）
   - 流式 token 不写进已存 `blocks` 数组，而是 append 到独立 `liveAssistant`/`liveReasoning` 字符串
   - turn 结束后 `flushLiveProjection` 才把 live 落盘成 block（不可变追加 `[...baseBlocks, block]`，`:203,216`；已存在 block 用浅替换 `blocks[index]={...current,...patch}`，`:174-183`）
   - **关键**：流式期间 `blocks` 数组引用全程稳定 → 所有历史 bubble 的 memo 引用比较全部命中 → **历史消息零重渲染**，只有最新 turn 那个 bubble 在工作
   - `seq floor` 去重（`:128-130` `delta.seq <= liveDeltaSeqFloor` 跳过）防 SSE 乱序/重复

2. **历史折叠分页**（`MessageTimeline.tsx:86-87, 367-370, 563`、`use-timeline-scroll.ts`）
   - `TURN_PAGE_SIZE = 18`、`AUTO_COLLAPSE_THRESHOLD = 24`：超 24 turn 自动折叠，只渲染最近 18 个
   - `visibleTurns = turns.slice(hiddenTurnCount)`，只 map 可见部分
   - 顶部「显示更早 N 条」按钮按需 `loadEarlierTurns`（`use-timeline-scroll.ts:100`）
   - **流式期间强制折叠回最新一页**（`use-timeline-scroll.ts:198-209`，注释「Expanding all history during SSE streaming can repaint long conversations」）→ 流式不重绘整个长会话
   - **prepend 滚动快照恢复**（`:211-225`）：加载更早消息先记 `scrollHeight/scrollTop`，rAF 内补 `addedHeight` 偏移，视口不跳

3. **打字机 rAF + backlog 除法器**（`StreamdownAssistant.tsx:18-36, 90-110`）
   - `nextVisibleLength` 每帧推进 `backlog/8`，上限 +32 字符/帧 → burst 200 字摊到 25 帧均匀打出
   - markdown 每帧只解析「已推进那段」子串，非每 token 解析全量
   - 流式时 key 固定 `'live'`（不拆树），结束切 `static:${length}` 整段重挂清脏 DOM（`:257`）

4. **代码高亮 LRU + inflight 去重 + fallback 先行**（`code-highlighting.ts:291-324`、`StreamdownCode.tsx:219-230, 447-453`）
   - 同步 `renderFallbackCodeHtml` 占位先上屏，异步 Shiki 高亮回填 → 高亮不阻塞渲染
   - `inflightHighlights` 同 key 复用 promise，`readHighlightCache` LRU 命中直接返回
   - memo 比较器用 `extractText(children)` 全文相等才跳过 → settled 代码块不重高亮

5. **滚动 rAF 节流 + layout effect 锁贴底**（`use-timeline-scroll.ts:79, 113-155`）
   - user turn 提交用 `useLayoutEffect` 在 paint 前置 `stickToBottomRef=true`，避免视口闪跳（issue #603）
   - 流式 delta 走 rAF 避免每 delta 一次 forced reflow
   - 滚到顶 `scrollTop <= 120px` 触发加载更早

**对 TAgent 的映射与改法**：

- **live 分离**（替代 P1-2）：当前 `AgentMessages.tsx:699` 流式时 `[...persisted, ...live]` 每 token 新数组引用 → 下游全量重算。改为：流式期间 `liveMessages` 不拼进 `allSDKMessages` 主数组，而是独立取 live 文本走 `useSmoothStream`（TAgent 已有，`useSmoothStream.ts`），让 `allSDKMessages` 在流式期间**保持引用稳定**。turn 结束落盘时才追加。这样 `allGroups`/`historicalTaskSubjects`/`minimapItems` 的 useMemo 依赖引用不变 → 流式时不重算。
  - **注意**：TAgent 的 `useSmoothStream` 已是 rAF 打字机，等价 F:\Kun 的招 3，可复用。关键是让历史数组引用稳定，而非每 token 重建。
- **历史折叠**（替代 P2-1，无乱跳）：`AgentMessages.tsx:935` `mergedTimeline.map` 改为 `slice(hiddenTurnCount)`，超阈值（如 24 turn）默认只渲染最近 18 个，顶部加「显示更早 N 条」按钮。加 `prepend` 滚动快照恢复避免视口跳。
  - **比 P2-1 虚拟化优势**：不用 ResizeObserver 测高、不用估算位置、不会乱跳；缺点是老消息折叠后需手动展开（但可接受，且展开有滚动快照保护）。

**收益（重估）**：长会话越流越卡 + DOM 过多，**同时解决 P1-2 和 P2-1 两个痛点**。流式时历史消息真正零成本（live 分离），长会话 DOM 量级从 O(总轮数) 降到 O(可见页)。

**风险（重估，比 P1-2/P2-1 都低）**：
- live 分离：核心是"流式时不重建历史数组引用"，不动去重逻辑（去重在 turn 结束落盘时跑，原样保留），比 P1-2 的"增量重建"安全。
- 历史折叠：是纯渲染层 `slice` + 按钮，数据层不变，比 P2-1 虚拟化的动态测高简单。
- 仍需注意：① TAgent 的 group/stable key 机制（`getGroupId`、`areMessageGroupPropsEqual`）要在 live 分离后仍保持历史 group 引用稳定，否则 P1-1 的 memo 会失效——**P1-6 与 P1-1 需联动确认 group 引用**。② 折叠展开的 prepend 快照恢复需测滚动不跳。③ 流式强制折叠的阈值需测对短会话无副作用。

**这是目前长会话问题的最佳稳妥方案**，建议列为优先项（在 P0-1/P1-1 之后、首屏打包之前）。**待用户确认是否采纳 F:\Kun 思路**。

---

### ⚠️ P1-6 决定（2026-07-23，2.0 重构筛选后）：不做

用户托底：会话页是 proma 的底，2.0 要重写。P1-6 落在 proma 会话页上做深度改造（live 分离改数据流 + 历史折叠改渲染），属"受 2.0 重构影响 + 工作量中"——按用户原则**不做**。

**长会话卡问题留到 2.0**：2.0 自研会话页时，直接照 F:\Kun 这套（流式 live 分离 + 历史折叠）一次做对——F:\Kun 本就是自研 loop + 自研会话页方案，2.0 时机契合。1.x 不在 proma 底上过渡，省得 2.0 扔白做。

上文 F:\Kun 机制调研（§3 P1-6 详细分析）**作为 2.0 自研会话页的设计参考保留**，不删。

---


---

### P2-1 消息列表虚拟化

**问题**：`AgentMessages.tsx:935` `mergedTimeline.map` 全量渲染，长会话（几百轮）DOM 线性增长，单条 500–1500 节点。

**改法**：引入 `@tanstack/react-virtual` 窗口化，只渲染可见区 + 缓冲 turn，配合 `MessageGroupRenderer` 的 stable id 比较器（`SDKMessageRenderer.tsx:1614`，已为动态高度留口）+ ResizeObserver 测高。

**收益**：长会话 DOM 线性增长根治，是长会话体验关键。**风险**：大。动态高度（消息含代码/图片，高度随内容变）+ 流式时高度持续增长 + 自动滚动跟随（`use-stick-to-bottom`）+ 折叠/展开交互，虚拟化需精细处理。**待对齐**：测高策略、与 `use-stick-to-bottom` 的兼容、流式时 sticky 行为。

---

### P2-2 会话列表窗口化

**问题**：`LeftSidebar.tsx:1870` 项目分组 `.map` + `:1832` 置顶，全工作区累加可达上千行全量渲染，每行含 ContextMenu/DropdownMenu/MiniMap hover 监听。

**改法**：窗口化或至少按项目分组懒挂载（折叠组不渲染子项）。

**收益**：上千会话侧栏。**风险**：中大。分组折叠 + 虚拟化的交互需处理。**待对齐**：是否恢复「折叠查看更多」（`:2859` 曾主动移除）或上虚拟化。

---

### P2-3 TipTap 编辑器懒加载

**问题**：`rich-text-input.tsx:16-22`（Agent 输入框）、`DraftEditor.tsx:8-11`（草稿）、`MarkdownRichEditor.tsx`（diff）三处独立 `useEditor` 各自静态 import 全套 TipTap + prosemirror。table/task-list 扩展只 DraftEditor 用却被打进首屏。`vite.config` 无 manualChunks 导致全进首屏。

**改法**：把 table/task-list 扩展从输入框路径剥离；DraftEditor 整体可懒加载（草稿是独立 rail 入口）；依赖 P0-4 的 manualChunks 合并 TipTap chunk。

**收益**：首屏 TipTap 体积下降 + 输入框初始化更快。**风险**：中。需确认三处编辑器扩展差异，避免懒加载导致草稿首次打开延迟。**待对齐**：与 P0-4 是否合并实施。

---

### P1-7 切会话分批挂载（⭐ 唯一实施项，2026-07-23）

**背景**：聊完全部优化后，用户确认**唯一真痛点 = 切长会话时动画卡顿**（短会话不卡）。其余条目要么治不到此痛点、要么 2.0 扔白做，全部不做。只做 P1-7。

**根因（explorer 调研确认，2026-07-23）**：切到长会话时，`useDeferredValue`（`MainArea.tsx:167`）追上的那一帧，`AgentMessages.tsx:935` `mergedTimeline.map` **一次性把几百条历史消息全挂 DOM**，主线程被 React render + commit（几百节点 layout/paint）+ 同帧全量重算的 useMemo（`allSDKMessages`/`groupIntoTurns`/`buildHistoricalTaskSubjects`/`minimapItems` O(G²)/`mergedTimeline` sort）占满，TabBar 指示器滑动动画（`app-shell.css:1995-1997` transform 260ms）+ 蒙版/spinner 动画拿不到下一帧合成 → 掉帧卡顿。

- 现有 `tabSwitching` 蒙版（`MainArea.tsx:238-248`）+ `useDeferredValue` **已生效**（盖住内容、推迟渲染），但只推迟一帧，那一帧仍全量挂，蒙版自身动画也卡。
- 短会话不卡：历史少，一帧挂得完。
- 切会话链路：点 TabBar → 等 350ms 指示器动画 → `setActiveTabId` → MainArea `deferredActiveTabId` 追上 → `TabContent` → `AgentView`（缓存命中 `AgentView.tsx:1022-1025` 同步填 `persistedSDKMessages`）→ `AgentMessages` `mergedTimeline.map` 全挂。

**改法（最小，~20 行，纯渲染层，不碰数据流/memo/group）**：

在 `apps/electron/src/renderer/components/agent/AgentMessages.tsx` 内：
1. 加 `visibleCount` state（初始全量，仅切会话时收缩）。
2. 利用已有 `prevSessionIdRef`（`AgentMessages.tsx:606`）检测会话切换：切会话时设 `visibleCount = INITIAL_N`（如 20）。
3. `mergedTimeline.map`（`:935`）改为 `mergedTimeline.slice(0, visibleCount).map`。
4. 用 `requestIdleCallback`（fallback `requestAnimationFrame`）递增 `visibleCount` 直至 `mergedTimeline.length`，剩余历史在空闲帧渐进挂载。
5. 切会话瞬间只挂最近 N 条，主线程快速让出 → 指示器/蒙版动画丝滑；剩余历史空闲帧补齐。

**收益**：直击用户唯一痛点——切长会话动画不再卡。短会话无变化（本就不卡）。

**风险（低，但需测）**：
1. **滚动位置恢复**：`ScrollPositionManager`（`AgentMessages.tsx:923`）恢复滚动位置，分批挂载时下方消息还没挂、高度不够，需确认恢复逻辑不被破坏（可能需等全挂完再恢复，或恢复时只滚到已挂区）。
2. **向下滚到未挂区空窗**：用户往下滚到 `visibleCount` 之外时，那部分还没挂，会空白 → 需保证"滚到边界触发递增挂载"或"idle 快速补齐到滚到位置"，不能让用户看到空白。
3. **流式时**：流式输出在最新消息（已在初始 N 条内），分批不影响流式；但需确认流式追加时 `visibleCount` 逻辑不干扰。

**2.0 归属**：落在会话页（proma 底），属过渡止痛。2.0 自研会话页按 F:\Kun 思路重写（F:\Kun 用历史折叠，见 §3 P1-6 调研），这 ~20 行扔掉不可惜。**破例做此一条**，因其改动极小、极局部、直击痛点、风险可控。

**验证**：切到一条几百轮的长会话，观察指示器滑动 + 蒙版是否丝滑无掉帧；向下滚到历史深处无空白；滚动位置恢复正常。

---

## 4. 逐条对齐进度（含 2.0 重构筛选，2026-07-23）

| 条目 | 2.0 归属 | 状态 | 备注 |
|---|---|---|---|
| **P1-7** | 过渡止痛 | ⭐ **实施中** | 切会话分批挂载，~20 行纯渲染层，直击唯一痛点（切长会话动画卡）。详见 §3 P1-7 |
| P0-1 | 轻量止血 | ⏸ 暂不需要·待定 | 治流式非切会话痛点，留 2.0（备查 §3） |
| P0-2 | — | ❌ 撤销 | 小列表非重点 + 砍 blur 有真视觉损失 |
| P0-3 | 2.0 资产 | ⏸ 暂不需要·待定 | 治启动非切会话痛点，留 2.0（方案备查 §3） |
| P0-4 | 2.0 资产 | ⏸ 暂不需要·待定 | 治启动非切会话痛点，留 2.0（TA 隐藏方案备查 §3） |
| P0-5 | 2.0 资产 | ⏸ 暂不需要·待定 | 非切会话痛点，留 2.0 |
| P1-1 | 会话页深度 | ⏸ 暂不需要·待定 | 2.0 扔白做 + 非切会话痛点 |
| P1-2 | 会话页深度 | ⏸ 暂不需要·待定 | 2.0 扔白做 + 非切会话痛点 |
| P1-3 | 2.0 资产 | ⏸ 暂不需要·待定 | 非切会话痛点，留 2.0 |
| P1-4 | 2.0 资产 | ⏸ 暂不需要·待定 | 非切会话痛点，留 2.0 |
| P1-5 | 轻量止血 | ⏸ 暂不需要·待定 | 滚动拖影非切会话切换痛点，留 2.0 |
| P1-6 | 会话页深度 | ⏸ 暂不需要·待定 | 2.0 扔白做。调研留 §3 备 2.0 自研会话页用 |
| P2-1 | 会话页深度 | ⏸ 暂不需要·待定 | 2.0 扔白做 |
| P2-2 | — | ⏸ 暂不需要·待定 | 非痛点，留 2.0 |
| P2-3 | 2.0 资产 | ⏸ 暂不需要·待定 | 治启动非切会话痛点，留 2.0 |

**聚焦结论**：用户唯一真痛点 = 切长会话动画卡（短会话不卡）。**只实施 P1-7**，其余统一「暂不需要·待定」留 2.0。会话页深度改造（P1-1/P1-2/P1-6/P2-1）留 2.0 自研会话页按 F:\Kun 思路一次做对（§3 P1-6 调研备查）。

---

## 5. 执行计划

**最终决定（2026-07-23）**：只实施 **P1-7 切会话分批挂载**。

**当前阶段**：P1-7 已对齐定稿（§3），可直接开长任务实施。
- 改 `apps/electron/src/renderer/components/agent/AgentMessages.tsx`：加 `visibleCount` + 切会话收缩到 N + `requestIdleCallback` 递增挂 + `mergedTimeline.slice(0, visibleCount).map`。
- 实施后跑 `bun run typecheck` + 实测切长会话动画是否丝滑 + 向下滚无空白 + 滚动位置恢复。
- **不自动 commit**（等用户确认）。

**其余条目**：全部不做，方案/调研留文档备 2.0 用。
- 2.0 自研会话页时：按 F:\Kun 思路（流式 live 分离 + 历史折叠，§3 P1-6）一次做对长会话；顺带可做 Shiki 瘦身/打包/玻璃等 2.0 资产项。

**未决项**：无（P1-7 改法明确，待实施）。

---

> 注：本文档前期按"2.0 资产 / 轻量止血"分批规划了 P0-3/P0-4/P0-5/P1-3/P1-4/P1-5 等多条实施项（方案/调研均留存于 §3 备查）。最终经用户确认唯一真痛点为"切长会话动画卡"，**全部收口为不做，只保留 P1-7 实施**。上述条目的 §3 详细分析作为 2.0 重构时的设计参考保留，不再单独实施。2.0 自研会话页时按 F:\Kun 思路（§3 P1-6）一次做对长会话，并顺带可做 Shiki 瘦身/打包/玻璃等 2.0 资产项。

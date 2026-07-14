# TAgent 画布 v2 — 设计文档

> 日期：2026-07-14
> 替代：`docs/plans/2026-07-13-design-preview-design.md`（不再维护，仅作历史参考）
> 作者：Proma Agent 与 Frank Danny 协作产出
> 状态：v1 待 Frank 验收

## 0. 为什么是 v2

TAgent 已有的 `design-preview/`（2026-07-13 设计）功能是 MVP，能跑 HTML/CSS 预览，但**完全没有**：

1. 元素分层（layers panel）
2. 元素点选 / 框选
3. 选中的元素→对话上下文的"指着说话"链路
4. 版本快照与回放
5. 外部设计稿导入

这五项缺一不可，否则"用户不知道怎么告诉 agent 改哪里"、"看不到 agent 在干什么"、"方向错了停不下来"三个痛点都解不掉。本设计把这五项补齐。

> **重要架构决策**：画布不重做成 Kun 的节点树画布。TAgent 这边画布的**主体是 agent 生成的 HTML/CSS**，画布是查看 + 评审界面，不是创作界面。这是用户明确要求的方向。

## 1. 目标与边界

### 1.1 用户视角的产出

```
┌─────────────────────────────────────────────────────────────┐
│ 左侧栏 Layers  │  画布（Live HTML/CSS）    │ 右侧 chat（不变）│
│                │                          │                  │
│ ▾ Page         │  ┌──────────────────┐    │ 用户: 帮我做登录 │
│   ▾ Hero       │  │  渲染 HTML        │    │ Agent: ... 画布 │
│     Logo       │  │  *点击任意元素高亮│    │       实时刷新  │
│     Title      │  │  *框选多个元素    │    │                  │
│   ▾ Form       │  └──────────────────┘    │                  │
│     Email      │                          │                  │
│     Password   │  [版本时间线 v1 v2 v3●]   │                  │
│     Submit ●选中│                          │                  │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 范围（in scope）

- 五项核心能力（分层 / 点选 / 框选 / 指着说话 / 版本快照 / 外部导入）
- 与现有 `AppShell` + `AgentView` 的接入
- `useDesignContext` 的扩展（注入元素级上下文）
- `CLAUDE.md` / `AGENTS.md` / `design-preview/README.md` 索引同步
- 删除 `.kun-canvas/` 占位 JSON（误导项）

### 1.3 范围外（out of scope）

- 不做 Kun 的节点树画布（SVG/Figma 风格无限画布 + shape store + undo store）
- 不做 Code ↔ Design 的双向桥（设计稿→代码组件的反向实现）
- 不做 Design System 持久化（`.kun-canvas/design-system.json` 真接入）
- 不重写 Agent 主对话流（AgentView / Claude Agent SDK 协议层）

## 2. 架构关键事实（必读）

### 2.1 现有 HtmlRenderer 用 iframe + srcDoc

```ts
// apps/electron/src/renderer/components/design-preview/HtmlRenderer.tsx
const IFRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms' as const
<iframe srcDoc={srcDoc} sandbox={IFRAME_SANDBOX} ... />
```

**含义**：

- iframe 内部 DOM **与父窗口隔离**，React 拿不到 refs。
- 所有点选 / 框选 / 分层**必须在 iframe 内部完成**，通过 `iframe.contentDocument` 读 DOM、`postMessage` 把事件发回父窗口。
- `srcDoc` 每次 `version` 变化会**重写整个文档**，之前注入的 `data-design-id` 全部失效，必须**每次重写后重新注入**。
- `allow-same-origin` 是必须的，否则 `postMessage` 父窗口收不到消息（不同 origin 不能读 `contentWindow`）。

### 2.2 现有 useDesignContext 只到 SelectionRegion

```ts
// 当前 ctx.userSelection = { region: {x,y,w,h} }  ← 只有矩形
```

**v2 扩展**：增加 `selectedElements: { id, tag, text, role, bounds, parentId }[]`，由 iframe postMessage 推送。

### 2.3 现有 design-preview 子系统不持久化

所有状态都在 jotai atoms（localStorage 仅保存会话状态）。**v2 的版本快照也走内存**，不落盘 `.kun-canvas/`。

## 3. 模块拆分与文件清单

```
apps/electron/src/renderer/components/design-preview/
├── DesignPreviewPanel.tsx     [已有] 不动
├── DesignCanvas.tsx           [改]  加 iframe 通信、选中高亮、接收 postMessage
├── DeviceFrame.tsx            [已有] 不动
├── HtmlRenderer.tsx           [改]  重写为"iframe + 注入脚本"模式
├── CanvasOverlay.tsx          [已有] 不动（点阵/缩放）
├── SelectionOverlay.tsx       [改]  接收 elements 列表绘制多元素高亮
├── ControlBar.tsx             [已有] 不动
├── DesignDock.tsx             [已有] 不动
├── DesignSuggestionBanner.tsx [已有] 不动
├── LayerTreePanel.tsx         [新增]  左侧分层树
├── VersionTimeline.tsx        [新增]  底部版本时间线
├── ImportDropZone.tsx         [新增]  顶部导入按钮 + 拖拽
└── README.md                  [新增]  唯一入口说明

apps/electron/src/renderer/atoms/
└── design-preview-atoms.ts    [改]  加 selection/elements/version-snapshot atoms

apps/electron/src/renderer/hooks/
├── useDesignContext.ts        [改]  扩展 selectedElements
├── useSelectionScreenshot.ts  [已有] 不动
└── useCanvasSelection.ts      [新增]  收 postMessage、维护选中态

apps/electron/src/renderer/lib/
├── html-element-id.ts         [新增]  design-id 注入策略（保留还是重生成）
├── html-snapshot.ts           [新增]  快照压缩/差异
└── import-html.ts             [新增]  HTML/Figma ZIP/截图导入

apps/electron/src/renderer/components/app-shell/
└── RightSidePanel.tsx         [改]  Layers 折叠侧栏
```

## 4. 五大能力的实现要点

### 4.1 元素分层（LayerTreePanel）

**注入策略**：每次 `srcDoc` 重写 → 在 iframe 内部执行一段**注入脚本**，遍历 DOM 给每个有意义的元素（`body *` 中非空节点）打 `data-design-id="d-1"`, `d-2`, `d-3`...

- 跳过 `script` / `style` / `meta` / `link` / `br` / `hr` 等无意义节点
- 跳过 `display:none` 的子树
- id 重新分配（每次 version 变化重置计数器）
- 父子关系用 DOM 树天然结构

**面板渲染**：父窗口定时从 iframe 拉 `layers` 列表（也可 postMessage 推送）→ React 渲染树形。选中节点时 iframe 高亮对应元素，layer 也高亮对应行。

**通信协议**：

```ts
// iframe → 父窗口
type LayerNodeMessage = {
  type: 'layers:report'
  layers: Array<{
    id: string
    tag: string
    text?: string
    role?: string
    parentId: string | null
    childIds: string[]
    bounds: { x: number; y: number; width: number; height: number }
  }>
}

// 父窗口 → iframe
type LayerCommandMessage =
  | { type: 'layers:highlight'; id: string }
  | { type: 'layers:clear' }
```

### 4.2 点选 / 框选

**点选**：iframe 内 `click` → 找出 `e.target` 的 `data-design-id` → postMessage `element:clicked`。

**框选**：父窗口在 `CanvasOverlay` 上拖拽矩形 → 计算矩形与各 `bounds` 的相交 → 多选 → 同步高亮 iframe 内部元素。

**视觉高亮**：iframe 内由注入脚本监听 `postMessage`，对选中元素加 `outline: 2px solid #3b82f6; outline-offset: -2px`。

### 4.3 指着说话（核心痛点）

**触发**：用户在 chat input 焦点外任意时刻选中元素 → LayerTreePanel 顶部出现 "把这部分告诉 Agent" 按钮。

**Prompt 生成**：

```ts
// 单选
buildPrompt(['d-3']) → "把『登录按钮』改成圆角、hover 高亮"

// 多选
buildPrompt(['d-3', 'd-4', 'd-5']) → "把表单区（包含邮箱输入、密码输入、登录按钮）整体改成上下间距 24px"
```

**注入位置**：点击按钮 → chat input 文字追加到末尾，光标停在末尾。**不自动发送**，等用户确认。

**元素描述生成**：

| 元素类型 | 描述策略 |
|---|---|
| `<button>` | 文本内容 + "按钮" |
| `<h1>`-`<h6>` | 文本 + "标题" |
| `<input>` | placeholder + "输入框" |
| `<img>` | alt + "图片" |
| `<a>` | 文本 + "链接" |
| 其他 | 文本前 30 字 + tag 名 |

**回退**：如果选中的元素没有可读文本，prompt 退化为"把 id=d-3 的元素改成..."。

### 4.4 版本快照

**触发**：`setDesignHtmlAtom` 写入时**自动**建快照（含 html/css/触发消息/时间）。每个会话上限 50 个，超出滚动丢弃最早的。

**存储**：jotai atom + localStorage（同 designSessionStatesAtom 的模式）。

**时间线 UI**：

```
[ v1 ] [ v2 ] [ v3●当前 ] [ v4 ] [ v5 ]
       ┗━ 来自"加点阴影"
                          ┗━ "再加个注册入口"
```

- 点任意版本 → 画布切到那版的 html/css（不修改当前选中）
- "从这版继续"按钮 → 把那版 html/css 设为**当前**，然后开启新一轮 prompt "从 v3 继续..."
- 时间线可隐藏（不影响画布主区）

**与对话的桥**：每次新版出现时，从 agent context 取最后一条 userMessage 作为该版本的"触发说明"，存进快照。

### 4.5 外部导入

**入口**：画布顶部 ImportDropZone + 拖拽整个文件到画布区域。

**支持格式**：

| 格式 | 处理 |
|---|---|
| `.html` | 直接 `<input type="file">` 读 → 灌入 designHtmlAtom + designCssAtom（提取 `<style>`） |
| `.zip`（Figma 导出） | 用 `fflate` 解压 → 找主 HTML（启发式：最外层 HTML 或包含 `<body>` 的文件） |
| `.png`/`.jpg`（截图） | 转 base64 → 触发 agent prompt "看着这张图复刻" → agent 输出 HTML → 灌入画布 |
| 其他 | 显示错误 toast |

**权限**：不需要主进程，文件读取在 renderer 端用 FileReader API。

**校验**：HTML 大小 > 500KB 警告，> 2MB 拒绝（避免 iframe 卡死）。

## 5. 接入点与兼容性

### 5.1 与 AppShell 的接入

当前 `AppShell.tsx` 渲染 `DesignPreviewPanel` 时没有左侧栏。需要：

- 在 `DesignPreviewPanel` 内部加 `LayerTreePanel`（左侧 240px 宽，可折叠）
- 不改 AppShell，保持左右分栏布局不动

### 5.2 与 AgentView 的接入

- 当前 `useDesignContext` 返回的 `ctx` 直接喂给 `AgentView`
- v2 在 `ctx.userSelection` 增加 `selectedElements`，Agent 看到的是结构化的元素描述
- Chat input 的"预填"通过 ref 注入：v2 需要新增一个 `chatInputRefAtom` 或通过 context 传，避免直接依赖 AgentView 内部组件

### 5.3 与现有 SelectionOverlay 的关系

当前 `SelectionOverlay` 画单个矩形（框选一个区域）。v2 改名为 `MultiElementHighlight`（或保留名+扩展 props），接收 `elements: Array<{bounds, id}>` 渲染多个高亮。

## 6. CLAUDE.md / AGENTS.md 索引

```markdown
## 画布（Design Preview）

TAgent 的画布子系统统一在：
- 入口：apps/electron/src/renderer/components/design-preview/
- 状态：apps/electron/src/renderer/atoms/design-preview-atoms.ts
- 架构文档：docs/plans/2026-07-14-design-canvas-v2.md
- 子目录 README：apps/electron/src/renderer/components/design-preview/README.md

Agent 接到"画布"/"设计预览"/"Design Preview"/"UI 原型"/"指着元素说话"等任务时：
1. 必读 docs/plans/2026-07-14-design-canvas-v2.md（架构 + 边界）
2. 必读 design-preview/README.md（模块清单）
3. 禁止新建画布相关目录；禁止改 .kun-canvas/（已删除占位）
4. 参考 F:/Kun 的设计模式时：只读 docs/DESIGN_MODE.md 与 src/renderer/src/design/，
   不抄代码，仅借鉴交互范式
```

## 7. 删除项

- `F:/TAgent_General/.kun-canvas/code-thr_ra7cyr78/canvas.json`（空 __root__ 占位）
- `F:/TAgent_General/.kun-canvas/code-thr_ra7cyr78/design-system.json`（空 tokens 占位）

理由：schema 与当前实现脱节，0 代码引用，CLAUDE.md 已写明禁改/禁建。

## 8. 任务分解（4 步 + 文档同步）

| 步 | 任务 | 关键文件 | 验收 |
|---|---|---|---|
| **0** | 写本文档 + README + CLAUDE.md 同步 | docs/plans/2026-07-14-design-canvas-v2.md, design-preview/README.md, CLAUDE.md | 用户过一眼 |
| **1** | DOM 注入 + 点选 + 框选 + Layers | HtmlRenderer.tsx, LayerTreePanel.tsx, useCanvasSelection.ts, SelectionOverlay.tsx | 点元素高亮、框选多元素、Layers 同步 |
| **2** | 指着说话 | useDesignContext.ts (扩展), LayerTreePanel 加按钮, 注入 chat input | 选中 → chat input 出现预填文本 |
| **3** | 版本快照与回放/换基线 | design-preview-atoms.ts (扩展), VersionTimeline.tsx | 时间线出现、可回看、"从这版继续" |
| **4** | 外部导入 | ImportDropZone.tsx, import-html.ts | 拖 HTML 文件 → 进画布能交互；截图 → agent 复刻 |
| **同步** | 文档 + 占位清理 | CLAUDE.md, AGENTS.md, README.md, .kun-canvas/* 删除 | grep "画布"在 CLAUDE.md 命中；.kun-canvas 不存在 |

每步的验收都是 Frank 在本地起 dev 验证；Proma Agent 只保证 typecheck 绿 + 写完验证清单。

## 9. 风险与边界条件

### 9.1 iframe sandbox 限制

- `allow-same-origin` 是必须的，否则 postMessage 不可达。这是已知 trade-off：iframe 内容能访问父 origin 的 storage，但**没有 parent DOM 访问**（已被 sandbox 阻止脚本访问 `parent.document`）。
- 我们注入的脚本**显式不发起任何网络请求**（audit 通过 review），不收集任何用户数据。

### 9.2 Figma ZIP 导入启发式不可靠

- Figma 导出 HTML zip 中哪个是"主文件"没有标准答案。第一版用"包含 `<body>` 且 size 最大"启发式。
- 失败时给用户看"解压出的所有 HTML 文件列表"，让用户手动选一个。

### 9.3 版本快照不持久化

- 不落盘意味着关掉 TAgent 后历史丢失。
- 第一版接受这个限制。第二版考虑序列化到工作区 `.tagent/design-history/<sessionId>.json`。

### 9.4 多 agent 并发

- 如果 agent 在画快照中途又改了一次，可能丢失中间版本。
- 第一版接受（设计 agent 是顺序流，不并发）。
- 如果用户开了看板多 Agent 并发，画布可能跳变——第二版加版本锁。

## 10. 验收清单（交付前）

- [ ] `bun run typecheck` 全绿
- [ ] `bun run lint` 全绿（design-preview/ 与新文件）
- [ ] `bun run check:prototypes` 不报新错
- [ ] 4 步各自有手测路径（在验证清单中详述）
- [ ] CLAUDE.md / AGENTS.md / design-preview/README.md 三处索引一致
- [ ] `.kun-canvas/` 已删除
- [ ] `docs/plans/2026-07-13-design-preview-design.md` 顶部加废弃声明
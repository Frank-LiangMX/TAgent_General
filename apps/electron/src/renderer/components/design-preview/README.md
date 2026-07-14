# Design Preview（画布子系统 v2）

> TAgent 中**唯一**的画布实现位置。任何"画布 / 设计预览 / UI 原型 / 指着元素说话"等需求都从这里出发。
>
> 架构文档：[`docs/plans/2026-07-14-design-canvas-v2.md`](../../../../docs/plans/2026-07-14-design-canvas-v2.md)
> v1 文档（已废弃）：[`docs/plans/2026-07-13-design-preview-design.md`](../../../../docs/plans/2026-07-13-design-preview-design.md)（保留作历史参考，**不要按它实现**）

## 这是什么

agent 生成 UI 原型 → 画布实时渲染 → 用户能分层、点选、框选、指着元素说"改这里" → 版本快照可回看可换基线 → 外部 HTML/截图能导入让 agent 接手改。

用户**不在画布上自己画**，画布是**观看 + 评审 + 反馈**的界面。

## 模块清单

```
components/design-preview/
├── DesignPreviewPanel.tsx   右栏入口
├── DesignCanvas.tsx         主画布容器（v2：含 layers 栏 + 版本时间线 + 工具栏）
├── LayerTreePanel.tsx       v2 新增：左侧分层树 + "告诉 Agent" 按钮
├── VersionTimeline.tsx      v2 新增：底部版本时间线 + "从这版继续"
├── ImportDropZone.tsx       v2 新增：顶部导入按钮（HTML/截图）
├── HtmlRenderer.tsx         iframe + 注入追踪脚本
├── CanvasOverlay.tsx        点阵网格（保留 v1 行为）
├── SelectionOverlay.tsx     v1 旧组件，v2 仍存在但 v2 不再使用（保留向后兼容）
├── DeviceFrame.tsx          Mobile/Tablet/Desktop 设备框
├── ControlBar.tsx           设备切换 + 缩放控制
├── DesignDock.tsx           右下浮动 dock
├── DesignSuggestionBanner.tsx 智能建议 banner
└── (没了)

lib/
├── canvas-frame-bridge.ts    v2：iframe 内部 DOM 追踪 + postMessage 桥
├── element-descriptor.ts     v2：把 CanvasElement[] 转成自然语言描述
├── chat-input-bridge.ts      v2：dispatchAppendChatInput（事件名 tagent:append-chat-input）
├── import-html.ts            v2：HTML / 截图 / ZIP 导入解析
└── html-element-id.ts        v2 预留（暂未启用）

hooks/
├── useCanvasSelection.ts     v2：bridge 生命周期 + 选中态
├── useVersionSnapshot.ts     v2：自动建快照 + 切换 viewing / promote 基线
├── useDesignContext.ts       v1：拼 <design-context> 文本
├── useDesignContextAugment.ts v1：把 context 追加到 userMessage
└── useSelectionScreenshot.ts 截图工具

atoms/
└── design-preview-atoms.ts   所有画布状态（v1+v2 字段共存）
```

## v2 引入的新概念（Agent 必读）

| 概念 | 来源 | 怎么用 |
|---|---|---|
| `data-design-id` | iframe 内注入脚本自动加 | 不要在 agent 生成的 HTML 里手写，会被覆盖 |
| `CanvasElement` / `CanvasElementRole` | `lib/canvas-frame-bridge.ts` | 分层树 / 描述生成的源数据 |
| `DesignSnapshot` | atoms 顶层 type | 版本快照；每会话最多 50 个，滚动丢弃 |
| `viewingDesignStateAtom` | `hooks/useVersionSnapshot.ts` | 派生 atom；当前画布实际显示的 html/css（看最新 vs 看历史） |
| `dispatchAppendChatInput(text)` | `lib/chat-input-bridge.ts` | 跨组件追加文本到 chat input；不自动发送 |
| 事件 `tagent:append-chat-input` | `lib/chat-input-bridge.ts` | 由 `dispatchAppendChatInput` 派发；AgentView 监听（见 components/agent/AgentView.tsx） |

## 绝对不要

- ❌ 新建 `apps/electron/src/renderer/canvas/`、`whiteboard/`、`board/` 等画布相关目录
- ❌ 新建或恢复 `.kun-canvas/`（已删除；schema 与当前实现脱节）
- ❌ 把 iframe DOM 操作逻辑写到父窗口组件（DOM 隔离，必须在 iframe 内部做）
- ❌ 用 `getElementById` / `querySelector` 跨 iframe 边界（无效，会被 sandbox 拦）
- ❌ 改 `useDesignContext.ts` 的 `userSelection.region` schema（保持 v1 兼容；元素级 context 走新加的 `selectedElements`）
- ❌ 给 agent 生成的 HTML 主动加 `data-design-id`（注入脚本会盖）

## 怎么验证

```bash
# 1. typecheck（必跑）
bun run typecheck

# 2. lint
bun run lint

# 3. 起 dev
bun run dev
# 右栏切到 Eye 图标 → Design Preview
```

手测路径见 `docs/plans/2026-07-14-design-canvas-v2.md` §10 验证清单。

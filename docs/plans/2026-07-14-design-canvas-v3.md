# TAgent 画布 v3 — 迁移 Kun 画布引擎

> 日期：2026-07-14
> 替代：`docs/plans/2026-07-14-design-canvas-v2.md`（HTML/iframe 路线）
> 策略：迁移 Kun 的节点树画布核心 → TAgent，轻量改造适配

## 为什么迁

| 对比 | v2 HTML 路线 | v3 节点树路线 |
|---|---|---|
| 元素寻址 | agent 只能整段重写 HTML，无法精确改一个元素 | agent 输出 shape ops，精确定位到单个形状 |
| 图层 | DOM 逆向反推，信息有限 | 第一类对象（名字/类型/填充/描边/圆角） |
| 选中反馈 | 蓝框覆盖 | 节点属性可直接编辑 |
| 设计 → 代码 | 无，agent 自己重新生成 | 有 design-system 沉淀，可对接 code agent |

## 迁入清单

```
apps/electron/src/renderer/design/          ← 新目录
├── canvas-types.ts          数据模型
├── canvas-shape-store.ts    节点树 store（zustand → 可接 jotai）
├── canvas-selection-store.ts 选中态
├── canvas-undo-store.ts     undo/redo
├── canvas-viewport-store.ts 视口/缩放/平移
├── shape-ops.ts             agent 输出协议 + schema
├── shape-ops/               执行器
│   ├── schema.ts
│   ├── executor.ts
│   └── context.ts
├── apply-shape-ops.ts       批量执行 ops
├── canvas-snapshot.ts       版本快照
├── canvas-layer-tree.ts     分层树逻辑
├── canvas-renderer.tsx      从 CanvasDocument → SVG 渲染
└── design-system-types.ts   设计系统类型（预留）
```

## 保留不改的

```
apps/electron/src/renderer/components/design-preview/
├── LayerTreePanel.tsx       分层树 UI（改接新 store）
├── VersionTimeline.tsx      版本时间线（接 canvas-snapshot）
├── DesignDock.tsx           模式切换/缩放（数据源不变）
├── ElementHighlightOverlay  选中高亮覆盖（接 selection store）
├── ImportDropZone.tsx       外部导入（HtmlRenderer 去掉后要改）
└── (其他 ui 组件微调)
```

## 要改造的

| 组件 | 改什么 |
|---|---|
| `DesignCanvas.tsx` | 核心替换：iframe + HtmlRenderer → SVG CanvasDocument 渲染 |
| `design-preview-atoms.ts` | 精简：去掉 iframe/bridge postMessage 相关，加 CanvasDocument 的 jotai wrapper |
| `useDesignContext.ts` | 从传 HTML 改成传 shape tree/选中元素结构化信息 |
| 与 AgentView 的对接 | agent 输出从 HTML → shape ops（prompt 工程） |

## 你的需求覆盖

| 需求 | 实现方式 |
|---|---|
| 实时看 agent 画 | CanvasDocument 每次 applyShapeOps 后自动重渲染 |
| 点元素 → 告诉 agent 改 | selection store + code-canvas-outbound → chat input 注入 |
| 元素分层 | canvas-layer-tree → LayerTreePanel |
| 版本快照回放 | canvas-snapshot → VersionTimeline |
| 外部导入 HTML/截图 | ImportDropZone → 解析 → 生成 shape ops 插入 document |
| 交互模式 | 保留 v2 interact 模式不变（node tree 不影响） |

## 阶段

1. 迁核心引擎文件（canvas-types, stores, shape-ops, renderer）
2. 写 jotai wrapper（让 Kun 的 zustand stores 兼容）
3. 替换 DesignCanvas（iframe → SVG CanvasDocument）
4. 适配留存组件（LayerTreePanel 等接新数据）
5. 打通 agent → shape ops 链路

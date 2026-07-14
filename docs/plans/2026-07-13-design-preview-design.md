# TAgent Design Preview 设计文档

> **⚠️ 已废弃 / DEPRECATED**
>
> 本文档是 v1 MVP 设计稿，已被 v2 完全替代。
> **新设计与实现请参考：`docs/plans/2026-07-14-design-canvas-v2.md`**
> 本文档保留仅作历史参考；不要按 v1 实施新功能，也不要基于 v1 修 bug。
>
> v2 关键差异：分层树 / 点选 / 框选 / 指着说话 / 版本快照 / 外部导入 五大能力
> 详见 v2 §1。

> **状态**：Draft v0.1  
> **日期**：2026-07-13  
> **作者**：Proma Agent（与用户 Frank Danny 共同设计）  
> **路径**：`docs/plans/2026-07-13-design-preview-design.md`

---

## 1. 目标

为 TAgent 通用模式新增 **Design Preview 功能**，实现：

1. **AI 生成结果即时预览**：Agent 生成的 HTML/CSS 原型直接在画布中渲染
2. **框选反馈**：用户框选画布中的 UI 元素，框选信息注入 Agent 上下文
3. **语义触发**：Agent 语义检测到 UI 设计意图时，提示用户是否开启 Design 模式
4. **轻量集成**：作为 rightRail 一个入口，不打断现有 Agent 对话流程

---

## 2. 设计来源

### 2.1 用户场景

用户在 TAgent 中进行前端 UI 原型设计时：

```
用户：帮我做一个登录页面
Agent：生成 HTML/CSS 代码
用户：这个按钮颜色不对，往下挪一点
        ↑
        这里用户很难描述是哪个按钮、当前位置、目标位置
```

现有方案的痛点：
- 用户需要切换到浏览器查看生成结果
- 无法准确描述需要修改的 UI 元素
- AI 生成和反馈循环效率低

### 2.2 参考项目分析

| 项目 | 定位 | 适用场景 |
|------|------|---------|
| **Kun Design 模式** | 完整设计工具 | 专业设计师做完整设计系统 → 代码 |
| **OpenPencil/skills** | AI 操作 .fig 文件 | 外部设计文件理解，不支持交互画布 |
| **glass-studio 原型** | 静态 UI 原型展示 | 主题/材质切换预览 |

### 2.3 Kun Design 完整流程（参考）

```
Planning → Generation → System → Review → Code → Handoff
   ↓           ↓           ↓        ↓        ↓        ↓
 定义方向    生成屏幕    提取Token   AI评审   绑定代码   导出文档
```

**结论**：Kun 的完整流程对当前场景过重，但框选 → Agent 感知机制值得借鉴。

---

## 3. 架构设计

### 3.1 核心定位

| 特性 | Kun Design | TAgent Design Preview |
|------|------------|---------------------|
| 模式切换 | 强绑定独立模式 | **语义触发按需开启** |
| 入口 | 独立 Tab | **rightRail 一个按钮** |
| 用户手动画布 | ✅ 需要 | ❌ 不需要 |
| 完整图层管理 | ✅ 需要 | ❌ 不需要 |
| ShapeOp 系统 | ✅ 完整 | ❌ 不需要 |
| 设计系统 Token | ✅ 需要 | ❌ 不需要 |
| 代码绑定 | ✅ 需要 | ❌ 不需要 |
| 工作流引擎 | ✅ 6 阶段 | ❌ 不需要 |
| **核心功能** | 设计工具 | **预览 + 框选 + 反馈** |

### 3.2 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│  TAgent (通用 Agent)                                             │
│                                                                  │
│  ┌─────────────────────┬───────────────────────────────────┐  │
│  │  Agent 对话           │  Design Preview (rightRail)        │  │
│  │                      │                                    │  │
│  │  用户: "登录按钮     │  ┌────────────────────────────┐   │  │
│  │   颜色改成蓝色"      │  │                            │   │  │
│  │                      │  │   iframe 渲染区           │   │  │
│  │  [框选信息注入]      │  │   (HTML/CSS Preview)      │   │  │
│  │   "用户框选了        │  │                            │   │  │
│  │    登录按钮"         │  │   [设备框架]              │   │  │
│  │                      │  │                            │   │  │
│  │  Agent 理解了        │  └────────────────────────────┘   │  │
│  │  用户的意图          │                                    │  │
│  └──────────────────────┴────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 数据流

```
1. Agent 生成 HTML/CSS
         ↓
2. HTML 存储到 Design Canvas State
         ↓
3. iframe 渲染内容
         ↓
4. 用户框选元素
         ↓
5. 提取框选信息（坐标、截图、元素描述）
         ↓
6. 注入 Agent 对话上下文
         ↓
7. Agent 收到包含框选信息的请求
```

---

## 4. 模块设计

### 4.1 目录结构

```
src/renderer/
├── atoms/
│   └── design-preview-atoms.ts      # 状态定义
├── components/
│   └── design-preview/
│       ├── DesignPreviewPanel.tsx   # rightRail 面板
│       ├── DesignCanvas.tsx         # 主画布组件
│       ├── HtmlRenderer.tsx         # iframe HTML 渲染
│       ├── SelectionOverlay.tsx     # 框选覆盖层
│       ├── DeviceFrame.tsx          # 设备框架
│       └── ControlBar.tsx           # 工具栏
├── hooks/
│   └── useDesignContext.ts          # 生成 Agent 上下文
└── tools/
    └── design-tools.ts               # Design 操作工具类型
```

### 4.2 类型定义（预留扩展）

```typescript
// ==================== 核心类型（MVP） ====================

/** 设备类型 */
export type DeviceType = 'mobile' | 'tablet' | 'desktop'

/** 设备尺寸 */
export const DEVICE_PRESETS: Record<DeviceType, { width: number; height: number }> = {
  mobile: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 }
}

/** 框选区域 */
export interface SelectionRegion {
  x: number
  y: number
  width: number
  height: number
}

/** Design Canvas 状态（MVP 版本） */
export interface DesignCanvasState {
  /** 当前 HTML 内容 */
  html: string | null
  /** 当前 CSS 内容 */
  css: string | null
  /** 设备类型 */
  device: DeviceType
  /** 用户框选的区域 */
  selection: SelectionRegion | null
  /** 是否启用 Design 模式 */
  enabled: boolean
  /** 缩放比例 */
  zoom: number
}

// ==================== 预留扩展字段（未来版本） ====================

/** 预留：完整画布文档（未来对标 Kun CanvasDocument） */
export interface DesignDocument {
  id: string
  title: string
  objects: Record<string, CanvasShape>
  operationJournal: Operation[]
  // 预留字段
  _future?: Record<string, unknown>
}

/** 预留：画布对象（未来对标 Kun CanvasShape） */
export interface CanvasShape {
  id: string
  type: string
  name: string
  bounds: { x: number; y: number; width: number; height: number }
  // 预留字段
  _future?: Record<string, unknown>
}

/** 预留：操作日志（未来对标 Kun OperationJournal） */
export interface Operation {
  id: string
  type: string
  timestamp: number
  // 预留字段
  _future?: Record<string, unknown>
}

/** 预留：设计系统（未来对标 Kun DesignSystem） */
export interface DesignSystem {
  tokens: Record<string, DesignToken>
  components: Record<string, DesignComponent>
  // 预留字段
  _future?: Record<string, unknown>
}

export interface DesignToken {
  name: string
  kind: 'color' | 'typography' | 'spacing'
  value: unknown
}

export interface DesignComponent {
  name: string
  slots: unknown[]
}
```

### 4.3 Agent 上下文格式

```typescript
/** 注入 Agent 的 Design 上下文 */
export interface DesignContextForAgent {
  /** 当前是否启用 Design 模式 */
  designModeEnabled: boolean
  /** 当前 HTML 内容摘要 */
  htmlSummary?: string
  /** 当前设备类型 */
  device: DeviceType
  /** 用户框选信息（核心） */
  userSelection?: {
    region: SelectionRegion
    /** 框选区域截图（base64） */
    screenshot: string
    /** 元素文本内容（如果能提取到） */
    elementText?: string
    /** 元素标签（如果能提取到） */
    elementTag?: string
  }
  /** 预留：完整 Surface 信息（未来版本） */
  _future?: {
    surfaces?: unknown[]
    designSystem?: DesignSystem
  }
}
```

---

## 5. 实现步骤

### 5.1 Phase 1：基础渲染（MVP）

```
目标：实现 HTML/CSS 预览能力

步骤：
1. 新增 design-preview-atoms.ts 状态定义
2. 新增 DesignPreviewPanel.tsx 作为 rightRail 入口
3. 新增 HtmlRenderer.tsx 实现 iframe 渲染
4. 新增 DeviceFrame.tsx 实现设备外壳
5. 新增 ControlBar.tsx 实现缩放、设备切换
6. 实现 Agent HTML 输出 → Design Canvas 状态 → iframe 渲染的流程
```

**验收标准**：
- [ ] Agent 生成 HTML 后，画布能渲染显示
- [ ] 能切换 Mobile/Tablet/Desktop 设备预览
- [ ] 能缩放画布

### 5.2 Phase 2：框选反馈

```
目标：用户框选画布元素，信息注入 Agent

步骤：
1. 新增 SelectionOverlay.tsx 实现框选覆盖层
2. 实现鼠标拖拽绘制框
3. 提取框选区域的坐标和截图
4. 实现 useDesignContext hook 生成 Agent 上下文
5. 框选信息通过 hook 注入到 Agent 对话
```

**验收标准**：
- [ ] 用户能在画布上拖拽框选区域
- [ ] 框选信息包含坐标和截图
- [ ] Agent 能收到框选上下文

### 5.3 Phase 3：语义触发

```
目标：Agent 语义检测 UI 设计意图，提示用户开启

步骤：
1. 在 Agent 对话流程中检测 UI 关键词
2. 检测到时在对话中插入提示
3. 用户确认后开启 Design 模式
```

**关键词示例**：
- "按钮"、"输入框"、"颜色"、"布局"、"间距"
- "登录"、"注册"、"主页"、"导航"
- "太靠上"、"往右移"、"改大一点"

**验收标准**：
- [ ] Agent 检测到 UI 相关请求时提示开启 Design
- [ ] 用户可以开启或忽略提示
- [ ] 开启后画布正确渲染

### 5.4 Phase 4（未来）：能力扩展

```
预留能力（根据需求开启）：

1. 多屏幕管理
   - Screen Frame 支持
   - 多屏幕切换预览

2. 原型交互
   - 屏幕间链接
   - 点击跳转

3. 设计系统基础
   - Token 提取
   - 颜色/字体预览

4. Kun 能力对接
   - CanvasDocument 格式支持
   - ShapeOp 操作协议
```

---

## 6. Kun 对照表

### 6.1 功能对比

| Kun 功能 | TAgent MVP | 未来扩展 |
|----------|-----------|----------|
| **画布渲染** |
| iframe HTML 渲染 | ✅ | - |
| 原生 SVG 画布 | ❌ | 可扩展 |
| **选择操作** |
| 点击选中元素 | ✅ | - |
| 框选区域 | ✅ | - |
| Marquee 多选 | ❌ | 未来 |
| **元素管理** |
| 图层列表 | ❌ | 未来 |
| 拖拽移动 | ❌ | 未来 |
| 缩放旋转 | ❌ | 未来 |
| **设备预览** |
| 设备框架 | ✅ | - |
| 响应式切换 | ✅ | - |
| **设计系统** |
| Token 定义 | ❌ | 未来 |
| 组件库 | ❌ | 未来 |
| **原型交互** |
| 屏幕链接 | ❌ | 未来 |
| 过渡动画 | ❌ | 未来 |
| **代码联动** |
| 代码绑定 | ❌ | 未来 |
| Roundtrip | ❌ | 未来 |

### 6.2 架构对比

| 方面 | Kun | TAgent Design Preview |
|------|-----|---------------------|
| 模式 | 独立 Design 模式 | rightRail 面板 |
| 触发 | 手动切换 | 语义检测 + 手动 |
| 复杂度 | 高（400+ 文件） | 低（MVP 5-7 文件） |
| Agent | 独立 Design Agent | 主 Agent 上下文注入 |
| 工作流 | 6 阶段引擎 | 无 |

### 6.3 数据流对比

```
Kun:
用户框选 → selection-store → DesignAgentManager → buildDesignAgentActions() → prompt 构建 → Design Agent

TAgent MVP:
用户框选 → selection-overlay → useDesignContext() → DesignContextForAgent → 注入主 Agent 上下文
```

---

## 7. 技术实现要点

### 7.1 iframe 渲染安全

```typescript
// HtmlRenderer.tsx
<iframe
  srcDoc={buildHtmlDocument(html, css)}
  sandbox="allow-scripts"  // 禁止访问父窗口
  style={{ width: deviceWidth, height: deviceHeight, transform: `scale(${zoom})` }}
/>

function buildHtmlDocument(html: string, css: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>${css}</style>
      </head>
      <body>${html}</body>
    </html>
  `
}
```

### 7.2 框选覆盖层

```typescript
// SelectionOverlay.tsx
// 使用绝对定位的透明 div 覆盖 iframe
// 监听 mousedown/mousemove/mouseup 实现框选
// 框选完成后调用截图 API 提取选区图像
```

### 7.3 上下文注入

```typescript
// useDesignContext.ts
export function useDesignContext(): DesignContextForAgent {
  const [state] = useAtom(designCanvasAtom)
  
  return {
    designModeEnabled: state.enabled,
    htmlSummary: state.html ? summarizeHtml(state.html) : undefined,
    device: state.device,
    userSelection: state.selection ? {
      region: state.selection,
      screenshot: captureSelection(state.selection),
    } : undefined
  }
}
```

---

## 8. 后续开发方向

### 8.1 短期（根据需求）

| 方向 | 说明 | 优先级 |
|------|------|--------|
| 多屏幕管理 | 支持多个 HTML 页面切换 | P1 |
| 原型链接 | 屏幕间点击跳转 | P2 |
| 历史记录 | 回溯之前的生成结果 | P2 |

### 8.2 中期（根据需求）

| 方向 | 说明 | 优先级 |
|------|------|--------|
| Token 预览 | 从 HTML 提取并展示颜色/字体 | P2 |
| Kun 文档格式 | 支持导入 Kun CanvasDocument | P3 |
| ShapeOp 基础 | 底层操作协议预留 | P3 |

### 8.3 长期（探索性）

| 方向 | 说明 | 优先级 |
|------|------|--------|
| Kun 完整集成 | 接入 Kun Design Agent | P4 |
| Figma 导入 | 支持 .fig 文件导入 | P4 |
| 设计→代码闭环 | 设计稿绑定源码，实现 roundtrip | P4 |

---

## 9. 风险与备选

| 风险 | 缓解措施 |
|------|----------|
| iframe 安全限制导致样式/脚本失效 | 使用 `sandbox="allow-scripts"` 并控制注入内容 |
| 框选截图性能问题 | 按需截图，不实时更新 |
| 语义检测误触发 | 提供明确的开启/关闭选项 |

---

## 10. 验收 Checklist

### MVP 验收

- [ ] rightRail 有 Design 入口按钮
- [ ] Agent 生成 HTML 后画布正确渲染
- [ ] 支持 Mobile/Tablet/Desktop 切换
- [ ] 支持缩放
- [ ] 用户能框选区域
- [ ] 框选信息能注入 Agent 上下文
- [ ] Agent 能理解框选信息并作出响应

### 代码规范

- [ ] 状态管理使用 Jotai
- [ ] 中文注释优先
- [ ] 组件化，可测试
- [ ] 类型定义完整

---

## 11. 参考资料

- Kun Design 源码：`F:\Kun\src\renderer\src\design\`
- Kun Canvas 选区：`F:\Kun\src\renderer\src\design\canvas\canvas-selection-store.ts`
- Kun Agent 上下文：`F:\Kun\src\renderer\src\design\agent-actions\design-agent-actions.ts`
- glass-studio 原型：`F:\TAgent_General\prototypes\glass-studio\`
- ui-prototype：`F:\TAgent_General\prototypes\ui-prototype\`

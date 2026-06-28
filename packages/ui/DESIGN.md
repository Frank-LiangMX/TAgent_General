# TAgent Design System

> 本文件是 `@tagent/ui` 包的设计规范。**写任何 UI 代码前必读本文件。**
>
> 修改 token：编辑 `packages/ui/src/tokens/*.ts` → `bun run --filter @tagent/ui tokens:generate` → globals.css + tailwind.config.js 自动同步。

---

## 核心原则

1. **改一处全局生效**：所有视觉 token（颜色/圆角/阴影/间距/字号/动效）定义在 `packages/ui/src/tokens/`，通过生成器同步到 CSS 变量和 Tailwind 配置。改 token 一处，全局自动更新。
2. **组件从 `@tagent/ui` import**：`import { Button } from '@tagent/ui'`。不要从 `@/components/ui/xxx` 新增 import（兼容期保留旧路径，但新代码必须用 `@tagent/ui`）。
3. **禁止硬编码视觉值**：颜色（`#fff` / `rgb(...)`）、圆角（`rounded-[14px]`）、阴影、间距。必须用 token 类或 Tailwind 语义类。
4. **新组件放 packages/ui**：`packages/ui/src/components/`，不放 `apps/electron/src/renderer/components/ui/`。

---

## Token 清单

### 圆角 Token（`packages/ui/src/tokens/radius.ts`）

| Token 名 | CSS 变量 | 值 | 用途 |
|---|---|---|---|
| `glass-input` | `--radius-glass-input` | 24px | `.chat-input-glass` 聊天输入框 |
| `glass-sidebar` | `--radius-glass-sidebar` | 10px | `.session-glass-sidebar` 侧栏 |
| `glass-rail` | `--radius-glass-rail` | 12px | `.session-glass-rail` 导航栏 |
| `glass-chip` | `--radius-glass-chip` | 6px | `.session-glass-chip` 芯片 |
| `glass-modal` | `--radius-glass-modal` | 20px | `.session-glass-modal` 模态框 |
| `glass-modal-lg` | `--radius-glass-modal-lg` | 24px | `.session-glass-modal-lg` 大模态框 |
| `glass-popover` | `--radius-glass-popover` | 14px | `.session-glass-popover` 弹出层 |
| `glass-sticky` | `--radius-glass-sticky` | 12px | `.session-glass-sticky` 吸顶元素 |
| `glass-tooltip` | `--radius-glass-tooltip` | 16px | `.session-glass-tooltip` Tooltip |

**Tailwind 类映射**：`rounded-glass-tooltip` → `border-radius: var(--radius-glass-tooltip)`

### 颜色 Token（`packages/ui/src/tokens/colors.ts`）

颜色 token 当前阶段只定义 Tailwind 映射（指向现有 CSS 变量），CSS 变量定义在 `apps/electron/src/renderer/styles/globals.css` 的 `:root` 和 `.theme-*` 块。

| Tailwind 类 | CSS 变量 | 用途 |
|---|---|---|
| `bg-background` / `text-foreground` | `--background` / `--foreground` | 主背景/前景 |
| `bg-primary` / `text-primary-foreground` | `--primary` / `--primary-foreground` | 主色/主色文字 |
| `bg-muted` / `text-muted-foreground` | `--muted` / `--muted-foreground` | 次要背景/文字 |
| `bg-accent` / `text-accent-foreground` | `--accent` / `--accent-foreground` | 强调色 |
| `bg-destructive` | `--destructive` | 危险色 |
| `bg-card` / `text-card-foreground` | `--card` / `--card-foreground` | 卡片 |
| `bg-popover` / `text-popover-foreground` | `--popover` / `--popover-foreground` | 弹出层 |
| `bg-dialog` | `--dialog` | 对话框 |
| `bg-tooltip` / `text-tooltip-foreground` | `--tooltip` / `--tooltip-foreground` | Tooltip |
| `border-border` / `border-input` | `--border` / `--input` | 边框/输入框边框 |

**完整列表见 `packages/ui/src/tokens/colors.ts` 的 `tailwindColorTokens`。**

### 阴影 / 间距 / 字号 / 动效 Token

当前阶段留空，使用 Tailwind 默认 scale（`shadow-sm/md/lg` / `p-2/p-4` / `text-sm/base/lg` / `animate-in/out`）。后续如需统一自定义，在对应 token 源文件添加，生成器会自动产出。

---

## 组件清单（29 个）

所有组件从 `@tagent/ui` import：

```tsx
import { Button, Dialog, Tooltip, Popover } from '@tagent/ui'
```

### 表单输入（6 个）
| 组件 | 用途 |
|---|---|
| `Button` | 按钮，支持 variant（default/outline/ghost/destructive/link）+ size |
| `Input` | 单行输入框 |
| `SearchInput` | 统一搜索框（`rounded-glass-rail` · 图标 + 输入 + 可选清空/加载/尾部插槽） |
| `Textarea` | 多行输入框 |
| `Switch` | 开关 |
| `Slider` | 滑块 |
| `Label` | 表单标签 |

### 浮层（6 个）
| 组件 | 用途 |
|---|---|
| `Tooltip` + `TooltipTrigger` + `TooltipContent` | hover 提示，跟随主题 |
| `Popover` + `PopoverTrigger` + `PopoverContent` | 点击弹出，含交互 |
| `Dialog` + `DialogTrigger` + `DialogContent` | 模态对话框 |
| `AlertDialog` | 确认对话框 |
| `Sheet` | 侧滑抽屉 |
| `DropdownMenu` | 右键/下拉菜单 |

### 反馈（5 个）
| 组件 | 用途 |
|---|---|
| `Alert` + `AlertTitle` + `AlertDescription` | 内联警示信息 |
| `Badge` | 徽章/标签 |
| `Spinner` | 加载旋转图标 |
| `LoadingIndicator` | 加载指示器 |
| `Toaster`（薄包装在 `@/components/ui/sonner`） | toast 通知容器，theme 自动注入 |

### 导航（4 个）
| 组件 | 用途 |
|---|---|
| `Tabs` + `TabsList` + `TabsTrigger` + `TabsContent` | 标签页（Radix 标准） |
| `SegmentedTabs` + `SegmentedTabsItem` | 横向分段 Tab（插件页 MCP/Skill 同款滑动指示器） |
| `ScrollArea` | 自定义滚动区域 |
| `ContextMenu` | 右键菜单 |

### 选择（2 个）
| 组件 | 用途 |
|---|---|
| `Select` + `SelectTrigger` + `SelectContent` + `SelectItem` | 下拉选择 |
| `Command` | 命令面板（基于 cmdk） |

### 布局 / 其他（5 个）
| 组件 | 用途 |
|---|---|
| `Separator` | 分隔线 |
| `Collapsible` + `CollapsibleTrigger` + `CollapsibleContent` | 折叠面板 |
| `ScrollProgressContainer` | 滚动进度容器 |
| `ThreePetalSpiral` | 三瓣螺旋加载动画 |
| `ImageLightbox` | 图片灯箱预览 |

### 富内容（2 个，独立导出）
| 组件 | 用途 |
|---|---|
| `CodeBlock` | 代码块（Shiki 高亮） |
| `MermaidBlock` | Mermaid 图表 |

### Hook（1 个）
| Hook | 用途 |
|---|---|
| `useSmoothStream` | 流式文本平滑输出 |

---

## 使用规范

### 必须做

```tsx
// ✅ 从 @tagent/ui import
import { Button, Dialog, DialogContent } from '@tagent/ui'

// ✅ 颜色用 token 类
<div className="bg-background text-foreground border border-border">

// ✅ 圆角用 token 类（glass 系列）
<div className="rounded-glass-tooltip">

// ✅ Tooltip 标准用法
<Tooltip>
  <TooltipTrigger asChild>
    <Button>Hover</Button>
  </TooltipTrigger>
  <TooltipContent>提示文案</TooltipContent>
</Tooltip>

// ✅ 搜索框统一用 SearchInput（variant: default | muted | glass | plain；size: sm | md | lg）
import { SearchInput } from '@tagent/ui'

<SearchInput placeholder="搜索…" />
<SearchInput variant="glass" size="sm" value={q} onChange={…} />
<SearchInput variant="plain" trailing={<kbd>⌘K</kbd>} onClear={() => setQ('')} />

// ✅ 横向分段 Tab 统一用 SegmentedTabs
import { SegmentedTabs, SegmentedTabsItem } from '@tagent/ui'

<SegmentedTabs value={tab} onValueChange={setTab}>
  <SegmentedTabsItem value="mcp" className="gap-1">MCP</SegmentedTabsItem>
  <SegmentedTabsItem value="skill" className="gap-1">Skill</SegmentedTabsItem>
</SegmentedTabs>
```

### 禁止做

```tsx
// ❌ 硬编码颜色
<div className="bg-[#fff] text-[rgb(0,0,0)]">

// ❌ 硬编码圆角
<div className="rounded-[14px]">

// ❌ 从 @/components/ui 新增 import（兼容期保留旧路径，但新代码禁用）
import { Button } from '@/components/ui/button'

// ❌ 新组件放 apps/electron/src/renderer/components/ui/
//    应放 packages/ui/src/components/
```

---

## 新增组件流程

1. 在 `packages/ui/src/components/` 新建 `xxx.tsx`
2. 在 `packages/ui/src/index.ts` 加 `export * from './components/xxx'`
3. 更新本文件 `## 组件清单`
4. `bun run typecheck` 通过
5. `bun run dev` 视觉抽查
6. 业务代码用 `import { Xxx } from '@tagent/ui'`

---

## Token 修改流程

1. 编辑 `packages/ui/src/tokens/*.ts`（如改 `radius.ts` 的 `glass-tooltip` 值）
2. 运行 `bun run --filter @tagent/ui tokens:generate`（或 `bun run dev` 会自动跑 predev 钩子）
3. 生成器自动更新 `__generated__/tokens.css` 和 `__generated__/tailwind-theme.js`
4. globals.css 和 tailwind.config.js 通过 @import / import 自动同步
5. 全局所有用到该 token 的地方自动更新

**不需要**手动改 globals.css 或 tailwind.config.js。

---

## 主题切换

### 主题命名约定

`.theme-{name}-{light|dark}` class，应用到 `<html>` 元素。

现有 6 主题（× light/dark = 12 个变体）+ 默认 light/dark：
- 默认 `:root`（light）/ `.dark`（dark）
- `.theme-ocean-light/dark`（晴空碧海 / 苍穹暮色）
- `.theme-forest-light/dark`（森息晨光 / 森息夜语）
- `.theme-slate-light/dark`（云朵舞者）
- `.theme-orange-light/dark`
- `.theme-purple-light/dark`（莫兰迪夜）

### 主题切换实现

- 状态管理：`apps/electron/src/renderer/atoms/theme.ts`（jotai atoms）
- DOM 操作：`applyThemeToDOM()` 在 `<html>` 上 toggle `dark` + `theme-{style}` class
- localStorage 缓存：`tagent-theme-mode` / `tagent-theme-style`

### 颜色 token 与主题的关系

当前阶段（阶段 1）：颜色 CSS 变量仍定义在 `globals.css` 的 `:root` 和 `.theme-*` 块。Tailwind 颜色类通过 `hsl(var(--xxx))` 引用，切换主题时 CSS 变量自动变化。

阶段 5（可选优化，主线稳后做）：把颜色变量迁入 `packages/ui/src/tokens/colors.ts`，生成器产出完整 CSS 变量文件。

---

## session-glass-* 类

定义在 `packages/ui/styles/glass.css`，被 `globals.css` `@import`。这些是毛玻璃浮层样式，圆角引用 `--radius-glass-*` token。

修改圆角：改 `packages/ui/src/tokens/radius.ts` → 跑生成器 → 全局自动更新。

修改其他视觉属性（backdrop-filter / background / box-shadow）：直接改 `glass.css`。

---

## 兼容期说明

`apps/electron/src/renderer/components/ui/*.tsx` 现在是 re-export 存根（`export * from '@tagent/ui'`），保留是为了兼容现有 30+ 处业务代码的 `from '@/components/ui/xxx'` import。

新代码必须用 `from '@tagent/ui'`。后续可选优化：全量替换业务 import 路径后删除存根。

**例外**：`apps/electron/src/renderer/components/ui/sonner.tsx` 是薄包装（读 jotai theme atom 注入给纯展示 `Toaster`），不是 re-export。业务代码仍用 `from '@/components/ui/sonner'` 拿薄包装版。

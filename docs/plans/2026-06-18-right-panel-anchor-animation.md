# 右侧文件浮岛 — 锚点展开交互（2026-06-18）

> **状态**：✅ Implemented（2026-06-18 落地，commit `d73d0a1a`）
> **关联 commit**：`d73d0a1a` feat(desktop): anchor right panel with scale expand/collapse animation

## 背景与目标

用户希望右侧文件浮岛的 **展开/折叠按钮固定在同一个位置**，打开时面板从按钮处「长出来」，关闭时收回到按钮，参考 [react-bits](https://github.com/DavidHDev/react-bits) / Motion 的 shared-layout 思路（非其文档 Sidebar 的 translateX 抽屉）。

## 改动前状态（记录）

### 布局

- 三列 flex：`NavIsland (p-2 pr-0)` | `主区 (p-2)` | `RightNavIsland (p-2 pl-0)`（仅 Agent 会话且面板打开时第三列挂载）
- 右浮岛关闭时第三列 **整列卸载**，主区瞬间变宽
- 底板 `content-base-inset-right` 随开关跳变；曾用 `right` 300ms 过渡导致关闭时底板短暂贴窗口边（已改为仅 `left` 过渡）

### 开关位置（问题根源）

| 状态 | 按钮位置 | 组件 |
|------|----------|------|
| 关闭 | 主区 `AgentHeader` 右上 | `PanelRight` |
| 打开 | 右浮岛 `DiffPanelTabBar` 右侧 | `PanelRightClose` |

两处按钮 → 跳变 + 关闭时整列 `animate-preview-slide-out` 滑出，观感「低级」。

### 动画

- 关闭：`preview-slide-out`（250ms 向右滑出），期间保持 flex 占位与底板 inset
- 打开：无入场动画，第三列直接挂载
- 右侧渐隐：已按用户要求移除（仅保留左侧 Nav 底板渐隐）

### 快捷键

- `toggle-right-panel`（⌘⇧B / Ctrl+Shift+B）注册在 `AgentHeader`

## 本版方案（锚点列）

### 核心思路

- Agent 模式下 **右缘始终保留一列锚点带**（36px），按钮永远在 **主区与浮岛接缝**
- **关闭**：列宽缩至 36px，仅显示圆形按钮；面板内容 `opacity: 0`
- **打开**：列宽 `260ms` 展开至用户宽度，内容延迟显现
- **不再**整列卸载 / 滑出；底板 inset 随列宽平滑变化（无 `right` CSS 过渡）

### 文件

| 文件 | 职责 |
|------|------|
| `RightPanelToggle.tsx` | 统一 36px 圆钮 + 快捷键 |
| `AppShell.tsx` | 锚点列宽度动画、inset 计算 |
| `AgentHeader.tsx` | 移除重复打开钮 |
| `DiffPanelTabBar.tsx` | 移除重复关闭钮 |
| `globals.css` | `.right-panel-anchor-shell` 展开/内容渐显 |

### 未做（后续可选）

- 引入 `motion` + `layoutId` 做按钮与面板外壳形变（react-bits Pro 常用方案）
- 展开后文件树 Animated List 错峰入场

## 改动后状态（本版已实现）

### 布局

- 三列 flex：`NavIsland (p-2 pr-0)` | `主区 (p-2)` | **锚点列 (p-2 pl-0)**（Agent 会话时第三列 **常驻**）
- 关闭：列宽 36px，仅接缝处圆钮；展开：列宽平滑增至用户设定宽度（260ms）
- 底板 `content-base-inset-right` 随锚点列宽变化，无 `right` CSS 过渡、无整列卸载

### 开关

- **唯一入口**：`RightPanelToggle` @ 主区与浮岛接缝，`pt-[34px]` 与 TabBar 行对齐
- `AgentHeader` / `DiffPanelTabBar` 已移除重复按钮
- 快捷键 `toggle-right-panel` 注册在 `RightPanelToggle`

### 动画

- `.right-panel-anchor-shell`：width 260ms
- `.right-panel-anchor-body`：关闭立即隐，展开延迟 80ms 渐显
- 已移除 `preview-slide-out` 与 `rightPanelClosing` 占位逻辑

### 遗留

- `RightNavIsland.tsx` 暂未删除（旧实现，已无引用）

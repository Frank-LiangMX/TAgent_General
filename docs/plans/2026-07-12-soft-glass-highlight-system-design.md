# 轻拟态全局高光系统设计

## 1. 背景

### 1.1 问题

在将 TAgent 的 UI 对齐 glass-studio 设计原型时，发现一个系统性问题：

**设计原型中所有带框的元素（浮岛、输入框、pill、消息气泡、session-well 等）在轻拟态材质下都有一圈白色高光边缘（顶部 + 右侧），但生产代码中这些高光效果缺失或不一致。**

### 1.2 根因分析

| 层面 | 设计原型 | 生产代码 |
|------|---------|---------|
| 变量定义 | `--inset-hi`, `--rim`, `--elev-dark`, `--elev-light` 在 themes.css 中统一定义 | 无对应变量，各组件硬编码颜色值 |
| 高光实现 | `box-shadow: 0 1px 0 var(--inset-hi) inset` 统一使用变量 | 部分组件有 `box-shadow` 但值不统一 |
| 材质切换 | `data-material="soft/liquid"` 属性切换，只改变量值 | 已从 `theme-neumorph-*` 迁移到 `data-material`，但变量层未补全 |
| `::after` 渐变边框 | mask-composite 实现全周渐变高光 | 部分组件有 `::after` 但被其他样式覆盖 |

### 1.3 已完成的迁移

- 材质选择从 `html.theme-neumorph-*` 类名迁移到 `[data-material="soft"]` 属性
- `AdvancedMaterialMode` 类型从 `'neumorph'` 改为 `'soft'`
- 删除了 session-list/session-well/rail 的 neumorph 覆盖
- 会话列表 hover/active 态已对齐设计原型
- FunctionRail 图标已替换为设计原型 SVG

## 2. 设计目标

### 2.1 核心原则

1. **变量驱动**：所有视觉效果（高光、阴影、边框）通过 CSS 变量控制
2. **材质平行**：soft / liquid / frosted / glass 四种材质平行切换，只改变量值
3. **全局一致**：所有带框元素自动获得高光，无需逐个组件设置
4. **主题正交**：颜色主题（mist/ocean/moss/dusk）× 明暗模式 × 材质风格 三个维度独立

### 2.2 目标效果

轻拟态材质下，所有带框元素：
- **顶部边缘**：白色半透明高光（`--inset-hi`）
- **右侧边缘**：白色半透明高光（`--inset-hi` 减弱版）
- **底部边缘**：深色半透明阴影（`--inset-lo`）
- **外部阴影**：环境光投影（`--ambient-shadow`）

## 3. 架构设计

### 3.1 CSS 变量层级

```
:root / .dark                     → 基础变量（颜色 token）
[data-theme="mist"][data-mode="light"] → 主题变量（颜色值）
[data-material="soft"]            → 材质变量（高光/阴影/边框）
[data-material="soft"].dark       → 暗色材质变量
```

### 3.2 核心变量定义

```css
/* 浮岛/卡片通用高光变量 */
[data-material="soft"] {
  /* 边缘高光 */
  --inset-hi: rgba(255, 255, 255, 0.45);        /* 顶部/左侧高光 */
  --inset-hi-strong: rgba(255, 255, 255, 0.55);  /* 强高光（active 态） */
  --inset-hi-soft: rgba(255, 255, 255, 0.32);    /* 弱高光 */

  /* 边框 */
  --rim: rgba(255, 255, 255, 0.45);              /* 主边框 */
  --rim-soft: rgba(255, 255, 255, 0.35);         /* 弱边框 */

  /* 阴影 */
  --elev-dark: rgba(145, 158, 175, 0.22);        /* 暗侧投影 */
  --elev-light: rgba(255, 255, 255, 0.5);        /* 亮侧投影 */
  --ambient-shadow: rgba(145, 158, 175, 0.16);   /* 环境光投影 */

  /* 玻璃材质 */
  --glass: rgba(230, 235, 242, 0.45);            /* 基础玻璃 */
  --glass-soft: rgba(236, 240, 246, 0.4);        /* 弱玻璃 */
  --glass-strong: rgba(242, 245, 249, 0.72);     /* 强玻璃 */

  /* 分隔线 */
  --divider: rgba(47, 58, 72, 0.12);
}
```

### 3.3 全局高光实现方案

#### 方案 A：`::after` 伪元素 + mask-composite（推荐）

利用 CSS mask-composite 创建 1px 渐变边框高光：

```css
/* 所有需要高光的容器元素 */
[data-material="soft"] .glass-panel {
  position: relative;
  isolation: isolate;
}

[data-material="soft"] .glass-panel::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  padding: 1px;
  background: linear-gradient(
    to right,
    var(--inset-hi) 0%,
    var(--inset-hi) 30%,
    transparent 100%
  ),
  linear-gradient(
    to bottom,
    var(--inset-hi) 0%,
    var(--inset-hi) 30%,
    transparent 100%
  );
}
```

**优点**：不影响元素自身的 `box-shadow`
**缺点**：需要元素有 `position: relative` 和 `isolation: isolate`

#### 方案 B：统一 `box-shadow` 变量

在基础样式中统一使用变量：

```css
[data-material="soft"] .glass-panel {
  box-shadow:
    0 1px 0 var(--inset-hi) inset,
    -1px 0 0 var(--inset-hi-soft) inset,
    0 -1px 0 var(--inset-lo, transparent) inset,
    0 10px 24px var(--ambient-shadow);
}
```

**优点**：简单直接
**缺点**：需要每个组件显式设置，无法自动覆盖

### 3.4 推荐方案

**采用方案 A（`::after` 伪元素）作为全局高光层**，理由：

1. 设计原型本身就是用 `::after` + mask-composite 实现的
2. 不影响组件自身的 `box-shadow`（阴影和高光分离）
3. 一次设置，所有 `.glass-panel` 元素自动获得高光
4. 通过 CSS 变量控制，材质切换只改变量值

### 3.5 需要添加高光的元素清单

| 元素 | 选择器 | 当前状态 |
|------|--------|---------|
| 左侧浮岛 | `.nav-island-glass` | 需要高光 |
| Session Well | `.session-well` | 已有部分高光 |
| Settings Card | `.settings-card` | 缺失 |
| Settings Glass | `.settings-glass` | 缺失 |
| Chat Input | `.chat-input-glass` | 缺失 |
| Content Glass | `.content-glass` | 缺失 |
| Popover | `.session-glass-popover` | 缺失 |
| Pill / Tag | `.pill` | 缺失 |
| Tab | `.tab` | 缺失 |
| Tool Cluster | `.tool-cluster button` | 缺失 |
| Message Bubble | `.msg-user` | 缺失 |
| Process Group | `.process-group` | 缺失 |
| Think Block | `.think-block` | 缺失 |
| Rail Button | `.rail-island-btn` | 已有 |
| Search Shell | `.settings-search-shell` | 缺失 |
| Switch | `.ui-switch` | 缺失 |
| Dialog Shell | `.neumorph-dialog-shell` | 缺失 |
| Footer Bar | `.neumorph-footer-bar` | 缺失 |

## 4. 实施计划

### Phase 1：变量层补全（1 天）

1. 在 `[data-material="soft"]` 和 `[data-material="soft"].dark` 下定义完整的高光变量
2. 为 liquid / frosted / glass 材质定义对应变量值
3. 在 `:root` / `.dark` 下定义默认变量值（向后兼容）

### Phase 2：全局高光层（1 天）

1. 定义 `.glass-panel` 基类和 `::after` 高光规则
2. 为需要高光的元素添加 `.glass-panel` 类（或通过属性选择器自动匹配）
3. 确保 `::after` 不与现有伪元素冲突

### Phase 3：组件适配（2 天）

1. 逐个组件验证高光效果
2. 处理特殊情况（如已有 `::after` 的元素）
3. 确保 dark 模式下的高光强度正确

### Phase 4：材质切换验证（1 天）

1. 验证四种材质切换时高光效果正确
2. 验证颜色主题切换时高光效果正确
3. 验证明暗模式切换时高光效果正确

## 5. 风险与注意事项

1. **`::after` 冲突**：部分组件已有 `::after` 伪元素，需要避免冲突
2. **`isolation: isolate`**：`::after` 高光需要元素有 `position: relative` 和 `isolation: isolate`
3. **性能**：大量 `::after` 伪元素可能影响渲染性能，需要测试
4. **向后兼容**：非材质模式（默认模式）不应受影响

## 6. 参考

- 设计原型：`glass-studio/tagent.css` 第 1425-1438 行（`.glass-island`）
- 设计原型：`glass-studio/themes.css` 第 490-530 行（`--inset-hi` 等变量定义）
- 当前实现：`apps/electron/src/renderer/styles/globals.css`（材质变量层）

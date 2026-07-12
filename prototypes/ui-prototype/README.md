# TAgent UI Prototype

基于 glass-studio 视觉设计，使用 TAgent 变量命名体系的 UI 原型。

> 位于统一原型目录：`prototypes/ui-prototype/`（样式引用 `../glass-studio/`）。

## 目录结构

```
prototypes/ui-prototype/
├── index.html          # 主原型页面
└── styles/
    ├── tokens.css      # 半径、间距、动效 Token
    ├── themes.css      # 主题变量 (Ocean/Forest/Slate × Light/Dark)
    ├── materials.css   # 材质变量 (Soft/Liquid)
    ├── glass.css       # 玻璃效果
    └── components.css  # UI 组件样式
```

## 切换方式

通过 `data-*` 属性切换：

| 属性 | 值 | 说明 |
|------|-----|------|
| `data-theme` | `ocean` / `forest` / `slate` | 主题色板 |
| `data-mode` | `light` / `dark` | 浅色/深色 |
| `data-material` | `soft` / `liquid` | 材质风格 |

## 变量命名 (TAgent 风格)

使用 TAgent 原有变量名：

```css
--background      /* 背景色 */
--foreground      /* 前景色 */
--muted           /* 次要背景 */
--border          /* 边框色 */
--primary         /* 主色调 */
--accent          /* 强调色 */
--card            /* 卡片背景 */
--glass-*         /* 玻璃效果变量 */
```

## 预览

直接在浏览器打开 `index.html` 即可。

右上角有切换面板，可实时切换主题/模式/材质。

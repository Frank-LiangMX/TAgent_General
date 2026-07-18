# TAgent 前端原型（统一目录）

> 所有**静态前端原型**放在本目录，不再使用根下的 `glass-studio/`、`ui-prototype/`、`demo/`。  
> 生产应用代码在 `apps/electron` 与 `packages/ui`，与本目录无关。

## 子目录

| 路径 | 说明 | 如何打开 |
|------|------|----------|
| [`glass-studio/`](./glass-studio/) | 主设计原型：材质切换、多页面壳（会话/看板/设置等） | 浏览器打开 `glass-studio/index.html` 或 `tagent.html`；或根目录 `../index.html` 工作台入口 |
| [`ui-prototype/`](./ui-prototype/) | 对齐 glass-studio 视觉、TAgent 变量命名的 UI 原型 | `ui-prototype/index.html`（样式引用 `../glass-studio/`） |
| [`liquid-glass-demo/`](./liquid-glass-demo/) | Liquid Glass 光学/滤镜参数演示 | `liquid-glass-demo/index.html` |
| [`style-showcase/`](./style-showcase/) | 风格对照：glassmorphism / neumorphism / production glass | `style-showcase/index.html` |
| [`layout-direction-study/`](./layout-direction-study/) | AppShell 布局基调对照：一体机身 / 语义浮层 / 横向工作集 | `layout-direction-study/index.html`，顶部可切换三种方向与 Win / Mac 窗口控件 |
| [`references/`](./references/) | 未接入主线逻辑的参考实现、镜像页面、旧版 renderer 备份 | 仅供查阅，不参与产品构建 |

## 本地预览

```bash
# 仓库根目录
cd prototypes/style-showcase
python -m http.server 8765
# 浏览器打开 http://localhost:8765
```

多数页面也可直接双击 `index.html`（注意部分需相对路径的静态服务）。

## 与生产 UI 的关系

- **规范**：`packages/ui/DESIGN.md`
- **材质架构**：`docs/decisions/0005-material-surface-token-architecture.md`
- **Liquid Glass 外部参考（Agent）**：`docs/ui/liquid-glass-ui-reference-for-agents.md`
- 原型只作视觉与交互参考；落地必须走 `@tagent/ui` token 与 `data-material` 表，禁止把 demo CSS 整段贴进生产壳层。

## 历史路径

| 旧路径 | 新路径 |
|--------|--------|
| `glass-studio/` | `prototypes/glass-studio/` |
| `ui-prototype/` | `prototypes/ui-prototype/` |
| `demo/liquid-glass-demo/` | `prototypes/liquid-glass-demo/` |
| `demo/style-showcase/` | `prototypes/style-showcase/` |

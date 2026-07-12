# TAgent UI 视觉参考（Liquid Glass / 高透玻璃）

> **受众**：后续所有编码 Agent（Claude Code / Cursor / Codex / Grok 等）  
> **目的**：做 UI / 材质 / 侧栏 / 浮层时，知道**看哪里、学什么、禁止什么**，避免凭感觉拧 CSS。  
> **权威入口**：[Free Frontend · CSS Liquid Glass](https://freefrontend.com/css-liquid-glass/)  
> **工程规范**：`packages/ui/DESIGN.md` · ADR-0005 · `docs/plans/2026-07-12-material-surface-token-architecture.md`

---

## 1. Agent 开工必读（30 秒）

1. 先读 **`packages/ui/DESIGN.md`**（token、组件 import、材质双轴）。
2. 再读本文 **§3–§5**（外部参考怎么用、和 TAgent 材质如何映射、硬约束）。
3. 改视觉时：**只改 surface token 表或既有表面类**，不要在业务组件里堆 `backdrop-blur` / 硬编码阴影。
4. 外部 demo **是灵感与技法目录，不是可直接粘贴的生产实现**。

| 轴 | 权威 | 不要做 |
|----|------|--------|
| 颜色 / hue | 主题 token（`colors.ts` / globals theme） | 为 glass 再造一套色板 |
| 圆角 | `--radius-glass-*` | `rounded-[14px]` |
| 材质光学 | `packages/ui/styles/glass.css` 的 `[data-material]` 表 | 类级补丁盖不全三种材质 |
| 布局壳层 | `globals.css` 的 shell / plate / nav-island | 改 glass 时顺手搞坏 soft |

---

## 2. 外部参考总入口

### 2.1 主链接（必须收藏）

**https://freefrontend.com/css-liquid-glass/**

- 汇总大量 **Liquid Glass / 液态玻璃 / 折射玻璃** 前端 demo（CodePen 等）。
- 技术关键词反复出现：`backdrop-filter`、`SVG filters`、`feDisplacementMap`、`feTurbulence`、`feSpecularLighting`、`feGaussianBlur`、偶见 **WebGL / R3F / GLSL**、**GSAP**。
- 页面 FAQ 强调：原生 CSS + SVG 可保留 DOM 语义与可访问性；位移滤镜开销大，需控制范围与降级。

### 2.2 打开 demo 时 Agent 应提取什么

对每一个参考，**先分类再吸收**，不要整段复制：

| 提取项 | 问自己 |
|--------|--------|
| 技法栈 | 纯 CSS？CSS+SVG？WebGL？有 JS 拖拽/动画吗？ |
| 分层 | 底层场景 / 磨砂层 / 边高光层 / 文字内容层 是否分离？ |
| 阴影语言 | 大而软的环境 drop？细 inset 边光？还是拟态双 elev？ |
| 填充 | 半透白 / 几乎透明 / 渐变 tint 多厚？ |
| 性能 | 全屏滤镜还是小控件？Electron 能否扛住？ |
| 可读性 | 文字是否在独立层？对比是否够？ |

---

## 3. 参考技法 → TAgent 落地映射

### 3.1 推荐吸收（与当前架构兼容）

| 参考里常见做法 | TAgent 对应 |
|----------------|-------------|
| `backdrop-filter: blur() saturate()` | `glass.css` 的 `--surface-blur*` / `--surface-saturate` |
| 半透明填充 + 细 rim | `--surface-bg*` / `--surface-rim` / `--surface-rim-width` |
| 大而软的单向环境阴影 | `--surface-shadow*`（**glass 用环境影，不是 soft 粘土双 elev**） |
| 顶缘 inset 高光 | 轻 `inset 0 1px 0 …` 或伪元素，**克制** |
| 内容与滤镜分层（warp / content） | 宿主 + `::before` 光学层；**文字 `z-index` 在上**；`isolation: isolate` |
| `@supports` / 渐进增强 | frosted 基线始终可用；glass 为增强 |
| `prefers-reduced-motion` | 动效滤镜可关；静态 blur 可保留 |

### 3.2 谨慎 / 局部试点

| 参考做法 | 约束 |
|----------|------|
| `feDisplacementMap` / `feTurbulence` 折射 | **仅小面积控件**（按钮、chip、单卡）；禁止铺满侧栏/主底板 |
| `filter: url(#…)` 与 `backdrop-filter` 同节点 | Chromium 上易合成失败 → 看起来像实心板；**滤镜只挂在无文字的光学层** |
| GSAP / 拖拽惯性菜单 | 产品未要求前不要引入依赖；可当动效灵感 |
| 多色 chroma 边 / 虹彩 | 与「简洁高级」冲突；边框保持中性白/灰 |

### 3.3 默认禁止（全应用壳层）

| 参考做法 | 原因 |
|----------|------|
| 全屏 WebGL / R3F 玻璃 | 包体、功耗、无障碍、Electron 成本 |
| 把 demo 的 `box-shadow` 原样贴到 `nav-island` | 易变成「实心浮板」；且可能用 `!important` 盖掉 soft |
| 为 glass 重写布局（挖空底板导致侧栏与主区隔断） | 生产布局依赖 plate 延伸做 chrome 连贯；**先理解 inset，再改光学** |
| 中途大面积 `git checkout` 清掉别人修好的 CSS | **破坏性操作，必须先征得用户同意** |

---

## 4. 与 TAgent 三材质的对照（Agent 决策表）

| 用户可见 | `data-material` | 视觉身份 | 阴影语言（原则） |
|----------|-----------------|----------|------------------|
| 默认（高级关） | `frosted` | 实色 MD 面板 | 轻 elevation / 可无 blur |
| 高级 · 高透玻璃 | `glass` | 半透 + blur，采底层 | **软环境 drop + 细边光**；禁止 soft 粘土双边 elev 当默认 |
| 高级 · 轻拟态 | `soft` | 近实色 + 内外高光 | **soft 专属 inset + 外阴影**；glass 改动不得提高优先级盖掉 soft |

**铁律**：改 glass 的选择器时，检查 specificity 是否高于 soft 的既有规则。  
反例：`html:not([data-material='glass']) .nav-island…` 比 soft 的 `[data-material=soft] .nav-island…` 更具体 → soft 阴影被盖掉。

权威实现：

- Token 表：`packages/ui/styles/glass.css`
- 壳 / 浮岛 / 底板：`apps/electron/src/renderer/styles/globals.css`
- ADR：`docs/decisions/0005-material-surface-token-architecture.md`

---

## 5. 布局壳层：侧栏 × 主区（血泪备忘）

生产布局（`AppShell`）与纯 demo 不同：

```
shell（外壳 wash）
├── NavIsland（z 高，rail + sidebar 同一浮岛）
├── 缝（padding）
└── content-main-shell
    └── content-base-plate（可 left 负 inset 伸进浮岛下方）
```

| 现象 | 更可能的原因 | 不要先做 |
|------|----------------|----------|
| 「侧栏边缘实心」 | 主底板伸进缝里 / 左侧不透明 fade，不是 island 的 box-shadow | 别先把 soft 阴影改没 |
| 「侧栏和主区隔断」 | 错误地把 plate 的 left/right 置 0 挖断延伸 | 别为了透感拆布局 |
| rail 选中正常、外缘不对 | 浮岛内部 OK，问题在 plate / 缝 / 外轮廓 | 别重写 list 选中态 |

**正确顺序**：DevTools 点选缝里那一层 → 看 Computed 的 `background` / `box-shadow` 胜出选择器 → 只改那一层。

参考站 demo 通常是**独立浮在花纹背景上的单卡片**，没有「plate 伸进侧栏」这层生产约束。

---

## 6. 页面上的 demo 类型索引（怎么用）

以下分类对应 [freefrontend.com/css-liquid-glass](https://freefrontend.com/css-liquid-glass/) 上的常见条目（名称随站更新，以页面为准）。**用途 = 灵感，不是依赖清单。**

### 6.1 CSS + SVG 折射（优先学习分层与滤镜原语）

- **Liquid Glass Effect**（backdrop + SVG 位移，强调「不是只有 blur」）
- **Apple Liquid Glass Effect**（`feTurbulence` + `feSpecularLighting` 等）
- **CSS Liquid Glass Effect**（`feDisplacementMap` + 拖拽等）
- **WWDC 风格 / 静态 distortion 按钮**（边缘条 + 静态滤镜）
- **带 Tweakpane 的可调 displacement**（理解 blur/scale/通道参数）

**TAgent 用法**：学「warp 层 vs 文字层」「位移参数」「性能边界」；小控件可试点，壳层默认仍用 blur + 半透 + 软影。

### 6.2 控件级液态交互

- **Liquid Toggle Switch**（GSAP + SVG）
- **Slider Button with Liquid Glass**
- **Theme Switcher / Menu with GSAP**

**TAgent 用法**：动效节奏与反馈灵感；默认不引入 GSAP，除非单独立项。

### 6.3 WebGL / Shader

- **Liquid Glass Shader**
- **React Three Fiber Apple Liquid Glass**

**TAgent 用法**：仅作「折射长什么样」的视觉参考；**不要**默认进 Electron 主壳。

### 6.4 整页 / 锁屏概念

- **Apple Liquid Glass UI / iPhone 概念**

**TAgent 用法**：层次、景深、鼠标视差灵感；桌面 App 以可读与性能优先。

---

## 7. FAQ（来自参考站，译成工程话）

| 问题 | 结论（给 Agent） |
|------|------------------|
| 为何用 CSS/SVG 而不是 WebGL？ | 保留真实 DOM、选择、无障碍；WebGL 是像素层。 |
| `feDisplacementMap` 干什么？ | 按位移图扭曲像素，配合 blur 更像折射。 |
| 性能？ | blur + 位移很吃 GPU；限制节点尺寸、能不用全屏就不用。 |
| 文字糊/难读？ | 内容层隔离 + 足够底衬对比；尊重 `prefers-reduced-motion`。 |
| 不支持时？ | 降级为 frosted 实色或静态半透，不依赖滤镜。 |

---

## 8. PR / 改动检查清单（UI 相关）

- [ ] 是否只动了 **一种材质** 的 surface 表或明确 scoped 的选择器？
- [ ] soft 的 nav-island / 阴影规则是否仍生效？（对比 `[data-material=soft]` specificity）
- [ ] 是否新增硬编码 `blur(Npx)` / `rgba` 阴影到业务组件？
- [ ] 是否理解 `content-base-inset-left` 再改 plate？
- [ ] 是否引入了全屏 SVG/WebGL 滤镜？
- [ ] 是否在用户未授权时执行了 `git checkout` / `restore` / `reset` 覆盖未提交 CSS？
- [ ] 视觉是否在 **glass + soft + frosted** 三种下都看过侧栏/主区接缝？

---

## 9. 相关工程文档

| 文档 | 内容 |
|------|------|
| [packages/ui/DESIGN.md](../../packages/ui/DESIGN.md) | 设计系统、token、组件 |
| [docs/decisions/0005-material-surface-token-architecture.md](../decisions/0005-material-surface-token-architecture.md) | 材质 ADR |
| [docs/plans/2026-07-12-material-surface-token-architecture.md](../plans/2026-07-12-material-surface-token-architecture.md) | Surface token 设计 |
| [docs/plans/2026-07-12-material-md-surface-system.md](../plans/2026-07-12-material-md-surface-system.md) | MD 表面阶梯 |
| [docs/plans/2026-07-12-soft-glass-highlight-system-design.md](../plans/2026-07-12-soft-glass-highlight-system-design.md) | soft 高光（已被 token 架构吸收） |
| [prototypes/](../../prototypes/README.md) | 站内静态原型统一目录（glass-studio / liquid-glass-demo / style-showcase / ui-prototype） |

---

## 10. 维护约定

- 参考站链接长期有效时：**只更新本文件的 demo 分类与约束**，不必 fork 每一个 CodePen。
- 若 TAgent 正式采用某类 SVG 折射：在 `glass.css` 增加 **可选、scoped** 光学层，并在本文件 §3.2 改为「已落地」+ 性能备注。
- **品牌**：全文与实现永远用 **TAgent**，不用 Proma。

---

**一句话给 Agent**：  
[Free Frontend Liquid Glass](https://freefrontend.com/css-liquid-glass/) 用来建立「真玻璃长什么样」的语感；TAgent 用 **frosted 基线 + glass/soft 光学表** 落地；改侧栏/主区前先分清 **浮岛阴影 vs 主底板延伸**，且 **绝不能用破坏性 git 覆盖未确认的本地修好 CSS**。

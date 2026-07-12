# 材质 Surface Token 架构：基线倒转 + 双轴正交

> **状态**: In Progress（PR-1 ~ PR-3 主路径已落地；PR-4 生成器可选）  
> **日期**: 2026-07-12  
> **作者**: Agent + 产品确认  
> **关联**:
>
> - ADR: `docs/decisions/0005-material-surface-token-architecture.md`
> - 既有 soft 高光设计: `docs/plans/2026-07-12-soft-glass-highlight-system-design.md`（本文件 **吸收并扩展** 其变量驱动原则；**修正**「基线 = 高透玻璃」的历史实现）
> - UI 规范: `packages/ui/DESIGN.md`
> - 运行时: `apps/electron/src/renderer/atoms/advanced-material.ts`、`theme.ts`
> - 样式: `packages/ui/styles/glass.css`、`apps/electron/src/renderer/styles/globals.css`

---

## 0. TL;DR

当前产品意图与设置默认值已对齐，**样式层基线写反了**：

| 层 | 现状 | 应有 |
|----|------|------|
| 设置默认 | 高级材质关 → `frosted` | 保持 |
| CSS 基类 | 高透 Liquid Glass（blur 24–28 + 折射伪元素） | **扁平 MD · 实色不透明** |
| 高级材质 | 补丁式覆盖不全 | glass / soft 作为**增强层** |

**一句话决策**：

> **CSS 基线 = frosted（默认）**；**高级材质（glass / soft）只改 surface token**；  
> **主题色只改 hue 语义色，不改 blur / 阴影语言**；  
> **所有表面类只消费 token，禁止写死 blur/高光/拟态阴影**。

---

## 1. 背景与问题

### 1.1 产品意图（已确认）

| 用户可见状态 | 内部 `data-material` | 视觉语言 |
|--------------|----------------------|----------|
| 默认（高级材质 **关**） | `frosted` | 扁平 Material Design · **实色不透明**（blur=0, opacity=1） |
| 高级材质开 → 高透玻璃 | `glass` | 高透 / 强 blur / 折射高光 |
| 高级材质开 → 轻拟态 | `soft` | 近不透明 + 内外高光阴影（拟态） |

设置层已正确：

```ts
DEFAULT_ADVANCED_MATERIAL_ENABLED = false  // → 强制 frosted
DEFAULT_ADVANCED_MATERIAL_ON_MODE = 'glass' // 打开后默认高透
```

### 1.2 根因：补丁式 frosted，基线是高级玻璃

```
现状流水线（错误）:
  .session-glass 等基类 = 高透玻璃
        ↓
  [data-material="frosted"] 补丁压扁（覆盖不全）
  html.material-frosted 第二套补丁（与 data-material 双轨）

应有流水线:
  基类只读 surface token（默认值 = frosted）
        ↓
  [data-material="glass|soft"] 只改 token 表
```

**补丁永远盖不全**：任何新类、业务硬编码、或忘记写 frosted 覆盖的选择器，默认就会一直像「高级高透」。

### 1.3 脱节清单（审计快照 2026-07-12）

#### A. 完全无材质分支（永远高透/高光）

| 类 / 位置 | 问题 |
|-----------|------|
| `.settings-card` | 写死 blur + 白边高光，无 frosted / soft |
| `.session-glass-toast` | 写死 blur(24) + 多层 inset，无材质分支 |
| `.ui-segmented-tabs` / indicator | 写死玻璃指示器 |

#### B. 基类高透，靠 frosted 覆盖（覆盖缺口即穿帮）

| 类 | 基线 |
|----|------|
| `.session-glass` / `.chat-input-glass` | blur 28 + 双伪元素折射 |
| `.session-glass-surface` / modal / popover | blur 24–28 + 强高光 |
| `.session-glass-tooltip` | 玻璃 + 伪元素 |
| 侧栏 `.session-glass-sidebar` 等 | 浮岛玻璃 |

#### C. 双轨选择器

| 轨 | 选择器 | 位置 |
|----|--------|------|
| 轨 1 | `[data-material="frosted"]` | `packages/ui/styles/glass.css` |
| 轨 2 | `html.material-frosted` | `apps/electron/src/renderer/styles/globals.css` |

`applyAdvancedMaterialToDOM` 同时设置两者，但组件覆盖不全时行为不一致；且 frosted 在 glass.css 里常设 `backdrop-filter: none`（纯扁），globals 又定义 `--material-blur-surface: 16px`（轻磨砂）——**意图打架**。

#### D. 主题选择器硬盖材质语言

如 `.theme-ocean-light .shell-bg`、部分 mode-slider / badge 写死渐变与阴影，不读 surface token。

#### E. 与 soft 高光设计文档的关系

`2026-07-12-soft-glass-highlight-system-design.md` 正确提出了 soft 下变量驱动高光，但未纠正「基线 = 高透」；本架构将其纳入 **soft 材质的 surface token 表**，并推广到 frosted / glass。

---

## 2. 目标与非目标

### 2.1 目标

1. **默认视觉** = 扁平 MD · 实色不透明（frosted），无需依赖「后补覆盖」才正确  
2. **高级材质** = glass / soft，切换只改 surface token，全表面类自动跟随  
3. **主题色正交** = 换 ocean/forest 等只改 `--primary` 等 hue，不改 blur/阴影语言  
4. **单一材质开关** = 以 `html[data-material]` 为唯一权威；废弃业务对 `material-frosted` class 的新依赖  
5. **组件/样式类只消费 token** = 禁止新增写死 `backdrop-filter: blur(Npx)` / 拟态 rgba 阴影  
6. **可渐进迁移** = 分 PR 落地，不要求一次改完 globals 全部历史类

### 2.2 非目标（本阶段不做）

- 不引入第四种用户可见材质（`liquid` 若残留仅作内部/废弃路径）  
- 不重做主题色盘数值（ocean 等 hue 保持；仅剥离材质相关硬编码）  
- 不强制 Button 圆角全部改 glass token（可后续统一）  
- 不改品牌色 / TAgent brand 系统  
- 不把 soft 做成「必须全页重绘」的主题（仍是材质轴，不是 themeStyle）

---

## 3. 架构总览

### 3.1 双轴正交

```
┌─────────────────────────────────────────────────────────────┐
│  轴 A：材质 data-material                                   │
│  frosted（默认）| glass | soft                              │
│  → 只写 surface token（blur / opacity / rim / elev / shine）│
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────┼────────────────────────────────┐
│  轴 B：主题色 themeMode + themeStyle + .dark                │
│  → 只写语义色 --primary / --background / --card …           │
└────────────────────────────┬────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────┐
│  表面样式类 / 组件                                           │
│  session-glass* / settings-card / toast / panel-glass …     │
│  只读 var(--surface-*) + hsl(var(--card)) 等                 │
└─────────────────────────────────────────────────────────────┘
```

**禁止**：`.theme-ocean-light .session-glass { backdrop-filter: … }`  
**允许**：`.theme-ocean-light { --shell-blob: … }`（纯色装饰，不改材质语言）

### 3.2 层级与文件职责

| 层级 | 职责 | 权威位置 |
|------|------|----------|
| L0 Token 源 | 圆角 / 动效 / 语义色 | `packages/ui/src/tokens/*` → `tokens:generate` |
| L1 Surface token 表 | 三种材质的表面变量 | **新建** `packages/ui/src/tokens/surface.ts`（或先写在 `glass.css` + `globals` 的 `[data-material]` 块，阶段 2 再迁入生成器） |
| L2 表面样式类 | 消费 surface + 语义色 | `packages/ui/styles/glass.css`、`search.css`、`segmented-tabs.css` |
| L3 业务壳层 | shell / panel / nav 等 | `apps/electron/.../globals.css`（逐步对齐 L2 约定） |
| L4 运行时 | 写 DOM 属性 | `advanced-material.ts`、`theme.ts` |
| L5 组件 | className 组合 | `@tagent/ui` + renderer 业务组件 |

### 3.3 DOM 契约

```html
<html
  class="dark theme-ocean-dark"   <!-- 主题轴：.dark + 可选 .theme-* -->
  data-material="frosted"         <!-- 材质轴：唯一权威 -->
>
```

| 属性/类 | 谁写 | 含义 |
|---------|------|------|
| `data-material` | `applyAdvancedMaterialToDOM` | `frosted` \| `glass` \| `soft` |
| `.dark` | `applyThemeToDOM` | 明暗 |
| `.theme-{style}` | `applyThemeToDOM` | 特殊色盘（ocean 等） |
| `.material-frosted` | **过渡期保留**，与 `data-material=frosted` 同步 | 兼容旧选择器；**新代码禁止再依赖** |

首屏防闪：建议在 `index.html` 或最早脚本里默认 `data-material="frosted"`，避免异步 settings 加载前闪高透。

---

## 4. Surface Token 规范

### 4.1 变量命名

统一前缀 `--surface-`（表面语言）与既有 soft 文档中的语义对齐：

| Token | 用途 |
|-------|------|
| `--surface-blur` | backdrop-filter 主 blur（px，可 `0px`） |
| `--surface-blur-elevated` | 浮层（modal/popover）略强 blur |
| `--surface-blur-chip` | 小芯片 / 指示器 |
| `--surface-saturate` | backdrop saturate |
| `--surface-opacity` | 表面底不透明度（配合 `hsl(var(--card) / …)`） |
| `--surface-opacity-elevated` | 浮层底不透明度 |
| `--surface-bg` | 可选：整段 background 简写；优先组合语义色 |
| `--surface-rim` | 边框色 |
| `--surface-inset-hi` | 顶/内侧高光 |
| `--surface-inset-lo` | 底内侧暗边（拟态用） |
| `--surface-elev-dark` | 外阴影暗侧 |
| `--surface-elev-light` | 外阴影亮侧 |
| `--surface-ambient` | 环境阴影 |
| `--surface-shine-opacity` | 折射/高光伪元素总开关（`0` = 关闭） |
| `--surface-shadow` | 组合后的 `box-shadow` 简写（推荐类直接用） |

兼容映射（迁移期）：

| 旧变量 | 新变量 |
|--------|--------|
| `--session-glass-strong` | 由 `--surface-opacity` + `--card` 推导或保留别名 |
| `--session-rim` / `--session-inset-hi` | → `--surface-rim` / `--surface-inset-hi` |
| soft 文档 `--inset-hi` / `--rim` / `--elev-*` | soft 材质表内赋值到 `--surface-*`，旧名作 alias |
| `--material-blur-surface` 等 | 并入 `--surface-blur*` 后删除 |

### 4.2 三材质赋值表（目标观感）

数值为实现起点，落地时可微调；**比例关系**不可颠倒。

#### frosted（默认 · 扁平 MD + 轻磨砂）

| Token | Light 建议 | Dark 建议 | 说明 |
|-------|------------|-----------|------|
| blur | `10px` | `10px` | **有**轻磨砂，不是 `none` |
| blur-elevated | `12px` | `12px` | 浮层略强 |
| opacity | `0.92`–`0.96` | `0.90`–`0.94` | 近实色，弱透视 |
| shine-opacity | `0` | `0` | **无折射伪元素** |
| shadow | 极轻 elevation（1 层 0–4px） | 略深仍克制 | MD elevation 感 |
| rim | `hsl(var(--border) / 0.5)` | 同语义 | 跟主题色边框 |

#### glass（高级 · 高透）

| Token | 建议 | 说明 |
|-------|------|------|
| blur | `24px`–`28px` | 现状基类水平 |
| opacity | `0.38`–`0.58` | 高透 |
| shine-opacity | `0.45`–`0.62` | 开折射 `::before/::after` |
| shadow | 多层悬浮 + inset 高光 | 现状 Liquid 语言 |

#### soft（高级 · 轻拟态）

| Token | 建议 | 说明 |
|-------|------|------|
| blur | `0px` | 不靠毛玻璃 |
| opacity | `1` 或 `0.98` | 近不透明 |
| shine-opacity | 边光用 inset/elev，**不用**玻璃折射团雾 | 对齐 soft 高光设计文档 |
| shadow | `inset-hi` + `elev-dark/light` 双色 | 拟态凸起 |

### 4.3 CSS 写法契约

**正确（类只消费 token）：**

```css
.session-glass,
.chat-input-glass {
  -webkit-backdrop-filter: blur(var(--surface-blur)) saturate(var(--surface-saturate));
  backdrop-filter: blur(var(--surface-blur)) saturate(var(--surface-saturate));
  background: hsl(var(--card) / var(--surface-opacity));
  border: 1px solid var(--surface-rim);
  box-shadow: var(--surface-shadow);
}

.session-glass::before,
.session-glass::after {
  opacity: var(--surface-shine-opacity);
  /* shine-opacity: 0 时不可见，无需 display:none 双轨 */
}
```

**错误（禁止新增）：**

```css
.session-glass {
  backdrop-filter: blur(28px); /* 写死 */
}
[data-material="frosted"] .settings-card {
  /* 若基线已 frosted，不应再靠成吨补丁 */
}
```

材质表只写一次：

```css
:root,
[data-material="frosted"] {
  --surface-blur: 10px;
  --surface-opacity: 0.94;
  --surface-shine-opacity: 0;
  /* ... */
}

[data-material="glass"] { /* 高透表 */ }
[data-material="soft"]  { /* 拟态表 */ }

.dark[data-material="frosted"] { /* dark 微调 */ }
```

`:root` 与 frosted **同值**，保证 `data-material` 未注入前也不闪高透。

---

## 5. 样式类清单（必须 token 化）

### 5.1 `@tagent/ui`（`packages/ui/styles/`）

| 类 | 优先级 | 备注 |
|----|--------|------|
| `.session-glass` / `.chat-input-glass` | P0 | 输入与置顶条 |
| `.session-glass-surface` / modal / popover / tooltip | P0 | 浮层 |
| `.session-glass-sidebar` / rail / chip | P0 | 侧栏浮岛 |
| `.session-list-item-active` | P0 | 已有 soft/frosted 分支 → 改 token |
| `.settings-card` | P0 | 当前无材质分支 |
| `.session-glass-toast` | P0 | 当前无材质分支 |
| `.ui-segmented-tabs*` | P1 | segmented-tabs.css |
| search 相关 glass 变体 | P1 | search.css |

### 5.2 业务壳（`globals.css`，渐进）

| 类 | 优先级 | 备注 |
|----|--------|------|
| `.panel-glass` / `.rail-glass` / `.nav-island-glass` | P1 | 主布局 |
| `.shell-glass` | P1 | 外壳光斑保留主题色，表面不写死 glass |
| `.content-glass` / content-main-shell 变体 | P1 | 主内容画布 |
| `.button-glass` / `.btw-*-glass` 等 | P2 | 统一 surface 或降级为语义色实心 |
| `html.material-frosted …` 大段覆盖 | P1 | **迁移后删除**，逻辑并入 surface 表 |

### 5.3 组件侧

| 组件 | 要求 |
|------|------|
| Dialog / Popover / Dropdown / Tooltip | 继续挂 surface 类，不内联 blur |
| Settings* 原语 | 容器用 `settings-card` |
| Toaster | `session-glass-toast` |
| 业务新 UI | 禁止新增裸 `backdrop-blur-xl` 等 Tailwind 硬玻璃，除非临时且注明迁移 |

---

## 6. 运行时与设置（保持语义，小改契约）

### 6.1 保持不变

- `advancedMaterialEnabled === false` → mode = `frosted`  
- `enabled === true` → mode = `onMode`（`glass` | `soft`）  
- 持久化字段：`advancedMaterialEnabled` / `advancedMaterialOnMode`  
- 兼容旧 `advancedMaterialMode` / neumorph themeStyle 迁移逻辑

### 6.2 需要加强

1. **首屏默认**：HTML 模板或 bootstrap 设 `data-material="frosted"`  
2. **文档化**：`material-frosted` class 仅兼容；新 CSS 用 `[data-material]`  
3. **开发断言（可选）**：dev 模式检测 `backdrop-filter` 硬编码类未挂 surface 的 warn（非必须）

### 6.3 与主题初始化顺序

`main.tsx` 已有：

```ts
applyThemeToDOM(...)
applyAdvancedMaterialToDOM(advancedMaterialMode)
```

保持；确保两者都幂等。材质不得依赖 theme class 是否已应用才能正确（token 表自包含 dark 变体）。

---

## 7. 迁移计划（PR 拆分）

### PR-1：契约 + 默认 frosted 基线（核心，阻塞）

**范围** `packages/ui` + 最小 globals：

1. 在 `glass.css`（或 surface 专用 css）定义 `:root` / `[data-material]` surface 表  
2. 改写 `.session-glass*` / surface / tooltip / sidebar 为消费 token  
3. 删除「基类高透 + frosted 大补丁」中的重复规则  
4. 补 `.settings-card`、`.session-glass-toast` 走 token  
5. 更新 `packages/ui/DESIGN.md` 材质章节  
6. 视觉验收：默认 frosted 扁平轻磨砂；开 glass 高透；开 soft 拟态  

**测试**：无自动化像素测试时，用手工 checklist（§9）；可加 unit 测 surface 类存在 / token 生成若引入 ts。

### PR-2：segmented + search + list-item 收口

- `segmented-tabs.css`、`search.css`  
- `session-list-item-active` 去掉 soft 专用硬编码渐变，改 token  

### PR-3：globals 壳层对齐 + 删除 material-frosted 双轨

1. `.panel-glass` / `.nav-island-glass` / `.shell-glass` 等改 surface  
2. 删除或缩成 alias 的 `html.material-frosted` 大段  
3. 清理主题选择器里改 blur/阴影的规则  

### PR-4（可选）：token 生成器接入

- `packages/ui/src/tokens/surface.ts` + generate → `tokens.css`  
- 与 colors/radius 同一工作流  

### 回滚策略

- 每 PR 独立可 revert  
- 保留 `data-material` 三值语义，不改用户 settings schema（除非加新字段，本设计 **不加**）

---

## 8. 与现有文档/代码的对照

| 文档/代码 | 关系 |
|-----------|------|
| `DESIGN.md` 主题切换段 | 实现后更新：基线 frosted；颜色仍语义 token |
| `soft-glass-highlight-system-design.md` | soft 高光 = soft 表的 surface 赋值；全局推广变量驱动 |
| `advanced-material.ts` | 语义正确；补首屏默认与文档 |
| `colors.ts` | 不混入 surface；只 hue |
| `radius.ts` | 继续服务玻璃圆角；与材质轴正交 |

---

## 9. 验收清单

### 9.1 默认（高级材质关）

- [ ] 主输入框：近实色 + 轻 blur，**无**明显折射彩虹边  
- [ ] 侧栏选中态：扁平 primary tint，无厚重玻璃浮岛  
- [ ] 设置页 `settings-card`：与默认语言一致，不是高透卡片  
- [ ] Toast：不是强玻璃悬浮（可轻 elevation）  
- [ ] 首屏加载：无「先高透再变扁」闪烁  

### 9.2 高级 · glass

- [ ] 输入框 / 浮层：高透 + 强 blur + 折射感恢复  
- [ ] 侧栏 / toast / settings-card **同步**变高透（无漏网）  

### 9.3 高级 · soft

- [ ] 表面近不透明，可见顶/侧高光与软阴影  
- [ ] 无大面积 backdrop 磨砂「发糊」  
- [ ] 与 soft 高光设计文档观感一致  

### 9.4 主题正交

- [ ] 切换 ocean / forest / dark：只变色，blur 语言随材质轴不变  
- [ ] 同一材质下换主题，无某主题「突然变高透」  

### 9.5 工程约束

- [ ] 新增 UI 走 `@tagent/ui` + surface 类  
- [ ] PR 描述注明是否影响 system prompt / toolset（本改动 **否**，纯 UI）  
- [ ] 覆盖率：纯 CSS 为主时说明测试策略；有 TS 导出 surface 时补测  

---

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| 倒转基线导致「高级 glass 看起来像旧默认」用户不适应 | 设置里高级材质说明文案；changelog 写清默认变扁平 |
| globals 历史类过多一次改崩 | 严格按 PR-1→3 渐进；先 ui 包后业务壳 |
| 双轨删除后旧选择器失效 | 过渡期保留 `material-frosted` class 同步；删覆盖前 grep 引用 |
| 轻磨砂性能（全屏 blur） | frosted blur 控制在 ~10px；glass 才 24+ |
| soft 与 frosted 对比度不足 | 验收清单强制三种模式并排对比 |

---

## 11. 开放问题（实现前可默认）

| # | 问题 | 默认决策 |
|---|------|----------|
| 1 | frosted 输入框要不要完全不透明？ | **否**，opacity ~0.94 + blur 10，保留「轻磨砂」 |
| 2 | `liquid` 材质是否保留？ | **废弃用户路径**；CSS 残留可删或 alias 到 glass |
| 3 | surface 是否进 tokens:generate？ | PR-1 先 CSS 表；PR-4 再生成器 |
| 4 | 业务 Tailwind `backdrop-blur-md` 存量？ | PR-3 grep 清理；新代码 ESLint 可选 warn |

---

## 12. 实施入口（给编码 Agent）

开工顺序：

1. 读本设计 + ADR-0005  
2. 读 `packages/ui/DESIGN.md`、`glass.css` 现状  
3. 按 **§7 PR-1** 开 `feature/material-surface-token-baseline`  
4. 改完跑 `bun run typecheck`；UI 三材质手工 §9  
5. PR 描述关联本文件与 ADR，勾选视觉 checklist  

**不要**在未读本文件的情况下继续堆 `[data-material="frosted"]` 补丁。

---

## 13. 变更记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-07-12 | v1.0 | 初稿：基线倒转 + surface token + 迁移 PR 拆分 |
| 2026-07-12 | v1.1 | **PR-1 落地**：`glass.css` surface token 表 + 基线 frosted；settings-card / toast 走 token；`index.html` 首屏 `data-material`；`applyAdvancedMaterialToDOM` 写 localStorage；globals `:root` session 默认改为 frosted；主题块剥离 `--session-glass-*` 材质变量；`material-frosted` 不再强制 session-glass `::after` |
| 2026-07-12 | v1.2 | **PR-2 落地**：`segmented-tabs.css` / `search.css` 材质分支；`nav-island-glass--float` 基线改 surface token；`html.material-frosted` 壳层改读 `--surface-*` |
| 2026-07-12 | v1.3 | **PR-3 落地**：`panel/rail/nav/content-glass` 基类 surface token；`btw-glass` / `btw-panel` / `btw-input` 基线 frosted；收敛 `material-frosted` 重复覆盖；主题 content 覆盖仅 glass 生效 |

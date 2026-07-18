# TAgent Spatial UI、主题与材质组件架构设计

> 状态：Accepted，实施中（Phase 1 已完成；Phase 2 实现完成）
> 日期：2026-07-18
> 目标分支：`feature/ui-polish`
> 原型入口：`prototypes/layout-direction-study/index.html`
> 关联规范：`packages/ui/DESIGN.md`
> 关联 ADR：`docs/decisions/0005-material-surface-token-architecture.md`
> 关联画布设计：`docs/plans/2026-07-14-design-canvas-v2.md`

## 0. 摘要

本设计定义 TAgent Desktop 下一阶段 UI 重构的目标架构，覆盖以下三个相互关联的大模块：

1. 将已确认的 Spatial 布局原型迁移到生产 AppShell。
2. 将主题、明暗模式与材质拆分为正交的视觉轴。
3. 为 Switch、Slider 等控件建立材质感知的内部渲染器，而不是继续依赖业务 CSS 覆盖。

迁移的核心不是“把原型样式复制进生产代码”，而是重建清晰的职责边界：

```text
应用状态与业务功能
        ↓
AppShell 布局状态模型
        ↓
@tagent/ui 语义组件 API
        ↓
主题语义 Token × 材质光学 Token × 组件材质 Renderer
        ↓
最终 DOM / CSS / 动效
```

业务组件继续负责会话、Agent、TA、画布、Office、文件、旁注等能力；AppShell 只负责空间关系；`@tagent/ui` 只负责组件语义和视觉实现；主题不再修改材质参数；材质不再修改业务颜色和功能结构。

本项目采用分阶段迁移。任何阶段都必须保持 `main` 可发布，并保留当前用户数据、模式状态、会话状态和设置兼容性。

---

## 1. 背景与问题

### 1.1 当前布局问题

历史 UI 经过多轮局部调整后，Rail、Sidebar、Main、Inspector 与业务页面之间存在以下问题：

- 多个区域各自创建白色或玻璃底板，层级重复。
- Sidebar、Rail、Main 通过局部 `z-index`、负 margin 或额外壳层建立关系。
- AppShell、`globals.css` 和业务组件同时修改同一表面的背景、圆角和阴影。
- 折叠和全屏状态由多个布尔值分别控制，容易出现硬切或显隐不同步。
- Sidebar 与 Rail 的空间关系不明确，Tooltip 可能被相邻区域遮挡。
- 全局 Rail 与部分场景 Dock 职责重叠。
- 输入框、Token 状态和高级工具不是一个稳定的布局单元。

### 1.2 当前主题与材质问题

现有架构已经建立主题与材质双轴，但仍存在未完成的历史耦合：

- `ThemeStyle` 使用 `ocean-light`、`ocean-dark` 等值把调色板与明暗模式绑定。
- `themeMode = special` 才应用特殊主题，系统明暗与调色板不能完全独立组合。
- 部分 Glass 阴影和高光仍包含固定色相或固定 `rgba`，导致不同主题下出现同一组紫色或灰蓝散射。
- `packages/ui/styles/glass.css` 已有 Surface Token，但部分业务 CSS 仍按主题和材质写具体覆盖。
- `globals.css` 仍保留旧轻拟态和 frosted 补丁，形成双重权威。

### 1.3 当前控件问题

现有 `Switch` 已尝试同时支持 frosted、glass、soft：

- frosted 使用标准实体胶囊。
- glass 使用 SVG Filter、液态层和 GSAP。
- soft 使用轻拟态阴影。

但目前所有材质结构都会同时进入 DOM，再由 CSS 显隐；Glass 动画依赖也会随组件常驻。若 Slider、Checkbox、Segmented Control 继续复制该模式，组件会迅速膨胀，测试与可访问性难以统一。

---

## 2. 目标与非目标

### 2.1 目标

1. 建立规整、无语义重叠的 Spatial AppShell。
2. 保留当前页面中的全部功能，不因重构删除入口或改变数据契约。
3. 让 Rail 成为唯一全局一级导航，不新增重复的全局 Dock。
4. 让 Sidebar 成为当前 Rail 项目的内容面板，并支持后续的空间连续动效。
5. 让 Main 保持内容优先，不再成为第三张厚重白色卡片。
6. 让 Inspector 成为独立的检查器平面，不与 Main 叠压。
7. 支持 standard、focus、canvas、office 四类稳定场景。
8. 保证 Windows 右上角和 macOS 左上角窗口控制区自然、安全。
9. 将主题、明暗、材质拆成正交轴，避免手写 36 套组合 CSS。
10. 允许部分控件根据材质替换内部视觉结构，同时保持统一 API 和语义。
11. 将材质和组件逻辑集中在 `@tagent/ui`，业务代码不判断材质。
12. 建立分阶段迁移、自动化测试、视觉回归与清理策略。

### 2.2 非目标

- 不重写 Agent 消息流、Provider、MCP、Skill 或模式切换协议。
- 不修改通用模式与 TA 模式的数据隔离原则。
- 不重建画布子系统，不新增第二套 Canvas 目录。
- 不重写 Office 会话和文档能力。
- 不在本阶段完成 Sidebar 液态回收的最终物理效果。
- 不让所有组件都拥有三套材质 Renderer。
- 不通过主题改变页面布局、组件尺寸或交互语义。
- 不将原型 CSS 整段复制到 `apps/electron` 或 `packages/ui`。

---

## 3. 设计原则

### 3.1 单一布局权威

AppShell 是全局空间关系的唯一权威。业务组件不得使用负 margin、fixed 定位或高 `z-index` 改变 Rail、Sidebar、Main、Inspector 的主布局关系。

### 3.2 三个稳定主平面

主布局只包含三个并列区域：

1. Navigation：分体 Rail 与可展开 Sidebar。
2. Workspace：Main 工作区。
3. Inspector：右侧检查器和折叠入口。

叠加只用于真正临时的内容：Tooltip、Popover、Dialog、Toast、Composer 高级工具、画布 Overlay。

### 3.3 主题与材质正交

主题只决定色彩语义；材质只决定光学表现；明暗模式只负责对比补偿。禁止主题选择器写死 blur、透明度、拟态阴影或玻璃边缘。

### 3.4 业务 API 不感知材质

业务代码只使用 `@tagent/ui` 组件：

```tsx
<Switch checked={enabled} onCheckedChange={setEnabled} />
```

业务代码禁止出现：

```tsx
{material === 'glass' ? <LiquidSwitch /> : <SoftSwitch />}
```

### 3.5 视觉实现可以变化，语义必须稳定

材质可以改变组件内部结构、边缘、阴影和动效，但不能改变：

- 受控与非受控状态模型。
- 键盘行为。
- ARIA 角色和状态。
- 表单提交语义。
- 外部占位尺寸。
- 最小点击区域。
- Focus、Disabled、Error 等状态含义。

### 3.6 功能优先于视觉材质

编辑器、表格、代码区、画布控制点和窗口按钮必须优先保证清晰与操作稳定。材质不能牺牲可读性、命中区域和平台习惯。

### 3.7 渐进披露

默认界面只显示高频操作。输入框聚焦、面板展开或场景切换时，才显示低频选项。隐藏不等于删除，所有功能必须可以通过明确入口到达。

---

## 4. 目标分层架构

### 4.1 五层职责

| 层 | 责任 | 禁止事项 |
|---|---|---|
| 业务状态层 | 会话、Agent、模式、画布、Office、设置 | 写材质 CSS |
| Shell 状态层 | 推导主区域显隐、宽度和场景 | 重复保存业务状态 |
| 语义组件层 | Button、Switch、Slider、Panel 等统一 API | 读取业务 Atom |
| 主题与材质层 | Semantic Token、Surface Token、Material Renderer | 改业务逻辑 |
| 临时浮层层 | Tooltip、Popover、Dialog、Overlay | 参与主布局计算 |

### 4.2 依赖方向

```text
apps/electron 业务组件
        ↓
apps/electron AppShell 布局编排
        ↓
@tagent/ui 组件与 Provider
        ↓
@tagent/ui tokens / styles
```

`packages/ui` 禁止反向 import Electron 侧 Atom。Electron 将解析后的主题与材质通过 Provider 和 DOM 属性传入 UI 包。

---

## 5. Spatial AppShell 结构

### 5.1 标准态

```text
┌────────────────────────────────────────────────────────────────────┐
│ 环境弥散背景                                                       │
│                                                                    │
│  ┌ Rail A ┐  ┌ Sidebar ┐  Main Workspace            ┌ Inspector ┐ │
│  │        │  │         │                            │           │ │
│  │        │  │         │                            │           │ │
│  └────────┘  │         │                            │           │ │
│  ┌ Rail B ┐  │         │                            │           │ │
│  │        │  └─────────┘                            └───────────┘ │
│  └────────┘                                                        │
└────────────────────────────────────────────────────────────────────┘
```

Rail 为上下两个视觉胶囊，但在语义上仍是同一个一级导航。Sidebar 与 Rail 属于同一个 Navigation Cluster，但不是同一张连续白色卡片。

### 5.2 主区域规则

- Main 不增加厚重白色底板。
- Workspace 只保留一个语义内容平面。
- Sidebar 与 Inspector 使用 Panel Surface Role。
- Rail 使用 Navigation Surface Role。
- Composer 使用 Interactive Elevated Surface Role。
- 所有主区域使用同一顶线、底线和间距网格。
- 主区域之间禁止负 margin 和互相覆盖。

### 5.3 Rail 分组

上胶囊承载：

- 草稿、插件等常驻入口。
- 通用模式或 TA 模式下的业务入口。

下胶囊承载：

- 通用 / TA 模式切换。
- Office 入口。
- 设置、用户头像、更新和环境状态。

入口顺序可以重新排布，但不得删除现有功能。

### 5.4 Sidebar 语义

- Sidebar 是当前 Rail 项目的内容面板。
- 折叠后不生成独立 Sidebar Peek 或第二个浮岛入口。
- 再次点击当前 Rail 项目时展开 Sidebar。
- 点击另一个 Rail 项目时，Sidebar 内容交叉淡化并保持面板连续。
- Sidebar 内部的滚动、筛选和选择状态在折叠后应被保留。

### 5.5 Inspector 语义

- Inspector 不属于左 Rail，因此可保留自己的折叠 Rail 或 Peek。
- Inspector 是 Workspace 的并列平面，不覆盖 Main。
- 文件、旁注、浏览器、Design、班组等入口全部保留。
- 宽度拖拽必须保持现有状态与最小/最大限制。

---

## 6. Shell 状态模型

### 6.1 不建立重复业务状态

Shell 不重新保存 `globalOfficeMode`、`designImmersive`、`activeRailItem` 等信息，而是通过纯函数推导布局：

```ts
type ShellScene = 'standard' | 'focus' | 'canvas' | 'office'
type PanelPresence = 'hidden' | 'collapsed' | 'open'

interface ShellLayout {
  scene: ShellScene
  navigation: PanelPresence
  sidebar: PanelPresence
  inspector: PanelPresence
  composer: 'default' | 'expanded' | 'dock'
}
```

建议新增纯函数：

```ts
deriveShellLayout(input): ShellLayout
```

该函数读取现有 Atom 的快照并返回单一布局结果。React 组件只消费结果，不再各自重复判断同一组布尔条件。

### 6.2 四种场景

| 场景 | Rail | Sidebar | Main | Inspector | Composer |
|---|---|---|---|---|---|
| standard | 显示 | 根据 Rail 项目 | 主工作区 | 可展开 | 默认/聚焦展开 |
| focus | 显示 | 折叠 | 主工作区放大 | 折叠 | 跟随内容 |
| canvas | 可折叠或隐藏 | 隐藏 | 画布主场景 | 画布自己的 Layers/Inspector | 画布会话 Dock |
| office | 场景入口保留或退出后恢复 | 隐藏 | Office 沉浸场景 | Office 自有工具 | Office 会话 Dock |

### 6.3 Presence 与状态保留

需要退出动画的区域不能在状态变化时立刻 unmount。统一使用 Presence 包装：

- `open`：可见、可交互。
- `closing`：保留 DOM，播放退出动画，不接收新焦点。
- `closed`：隐藏或卸载。

Sidebar 内容若包含滚动位置和筛选状态，优先保持挂载并使用 `inert`、`aria-hidden` 与 `pointer-events` 控制交互，而不是每次折叠销毁。

---

## 7. 主题、明暗与材质三轴

### 7.1 目标类型

```ts
type AppearanceMode = 'light' | 'dark' | 'system'

type ThemePalette =
  | 'default'
  | 'ocean'
  | 'forest'
  | 'slate'
  | 'orange'
  | 'purple'

type MaterialMode = 'frosted' | 'glass' | 'soft'
```

最终 DOM 目标：

```html
<html class="dark" data-theme-palette="ocean" data-material="glass">
```

### 7.2 三轴职责

| 轴 | 决定 | 不决定 |
|---|---|---|
| Appearance | 明暗、对比修正、系统跟随 | 品牌色、blur、圆角 |
| Palette | primary、semantic color、环境弥散色 | 透明度、阴影结构 |
| Material | blur、透明度、边缘、高光、阴影、press | 业务色、功能状态 |

### 7.3 调色板显示名

内部 key 为兼容现有设置保持不变，设置 UI 可使用更清晰的显示名：

| Key | 显示名 | 视觉方向 |
|---|---|---|
| default | Mist 云雾 | 冷静雾蓝 |
| ocean | Tide 潮汐 | 青绿与深海蓝 |
| forest | Moss 苔庭 | 灰绿与冷青 |
| slate | Dusk 暮砂 | 烟灰与淡砂 |
| orange | Ember 微烬 | 琥珀与淡珊瑚 |
| purple | Iris 鸢尾 | 灰紫与冷蓝 |

大面积表面保持近中性。Palette 主要进入选中、Focus、状态、环境光和少量高光，禁止整页重染色。

### 7.4 36 种组合不是 36 套 CSS

代码只维护：

- 6 套 Palette Semantic Token。
- 3 套 Material Optical Token。
- 2 套 Appearance 对比补偿。
- 少量 `dark × glass`、`dark × soft` 交叉补偿。

禁止增加：

```css
.theme-ocean-dark[data-material='glass'] .sidebar { ... }
.theme-forest-dark[data-material='soft'] .switch { ... }
```

允许增加：

```css
[data-material='glass'] { ... }
.dark[data-material='glass'] { ... }
[data-theme-palette='ocean'] { ... }
```

### 7.5 场景可读性补偿

Canvas 和 Office 背景可能比普通 Workspace 更复杂。它们不新增第四个用户材质轴，而是通过 Surface Role 的可读性 Token 调整：

- `--surface-legibility-fill`
- `--surface-legibility-rim`
- `--surface-legibility-scrim`

复杂背景上的 Tooltip、Popover 和 Composer 必须提高填充度，不能为了“更透”牺牲文字对比度。

---

## 8. Surface Role

组件不直接读取 `--surface-bg` 后自行猜测层级，而是使用明确角色：

| Role | 使用区域 | 相对层级 |
|---|---|---|
| `scene` | 窗口环境弥散背景 | 0 |
| `workspace` | Main 内容场 | 10 |
| `navigation` | Rail 胶囊 | 10 |
| `panel` | Sidebar | 10 |
| `panel-elevated` | Inspector | 10 |
| `well` | 列表分组与内容井 | 组件内部 |
| `control` | Search、Chip、普通输入 | 组件内部 |
| `interactive-elevated` | Composer、浮动工具条 | 20 |
| `overlay` | Tooltip、Popover、Menu | 100 |
| `modal` | Dialog、Sheet | 1000 |

每个 Role 在三种材质下读取不同光学 Token，但保持同一语义层级。

---

## 9. 材质感知组件架构

### 9.1 三类组件

| 类别 | 策略 | 示例 |
|---|---|---|
| Token Adapted | 同一 DOM，只替换 Token | Button、Input、Card、Panel、Tooltip |
| Renderer Adapted | 同一 API 与 Root，内部替换视觉 Renderer | Switch、Slider、Checkbox、Segmented Control、Progress |
| Material Immune | 保持稳定清晰实现 | 编辑器、表格、代码区、画布控制点、窗口按钮 |

只在材质确实改变内部结构或运动机制时使用 Renderer。禁止为了视觉微差异给所有组件建立三套文件。

### 9.2 MaterialProvider

`@tagent/ui` 新增独立 Provider：

```tsx
<MaterialProvider value={resolvedMaterialMode}>
  <AppShell />
</MaterialProvider>
```

Provider 负责 React 结构选择；`html[data-material]` 继续负责 CSS Token、首屏防闪和非 React 元素。

```text
advancedMaterialModeAtom
        │
        ├── MaterialProvider → React Renderer
        └── html[data-material] → CSS Surface Token
```

`packages/ui` 不直接 import Electron Atom。

### 9.3 Material Override

基础组件可以提供受限的覆盖能力：

```ts
type MaterialOverride = 'inherit' | 'frosted' | 'glass' | 'soft'
```

默认必须是 `inherit`。业务页面不能把它当作随意的局部主题 API。允许显式覆盖的场景只有：

- 设置页的材质预览。
- 无障碍或性能回退。
- 复杂画布背景上强制使用 frosted 的关键控件。
- 视觉测试夹具。

### 9.4 Switch 目标结构

```text
switch/
├── Switch.tsx
├── SwitchRoot.tsx
├── FrostedSwitchVisual.tsx
├── GlassSwitchVisual.tsx
├── SoftSwitchVisual.tsx
├── switch.css
└── Switch.test.tsx
```

Root 始终是同一个 Radix Switch，负责：

- checked、disabled、name、value。
- pointer、Space、Enter。
- `aria-checked` 与 Focus。
- 外部尺寸和 44 × 44px 命中区域。

Visual 只负责：

- 轨道、滑块、液滴、折射、高光。
- 材质特有的 press 与 transition。
- 深色模式光学补偿。

三种 Switch 方向：

| 材质 | 结构 | 运动 |
|---|---|---|
| frosted | 实体胶囊轨道 + 圆形 Thumb | 160–200ms 位移 |
| glass | 透明轨道 + 液滴指示 + 折射边缘 | 拉伸、融合、轻回弹 |
| soft | 内凹轨道 + 浮起 Thumb | 按下下沉、释放抬起 |

切换材质时 Root 不 remount，只替换内部 Visual。当前焦点、状态和表单值必须保持。

### 9.5 高成本 Renderer

Glass Renderer 如果需要 SVG Filter、GSAP 或其他高成本能力，应满足：

- 仅在 glass 启用时加载。
- 组件卸载或材质切换时完整清理 Timeline 和 RAF。
- `prefers-reduced-motion` 下不运行 goo、bounce 或持续动画。
- `prefers-reduced-transparency` 或高对比模式下回退 frosted Visual。
- 不阻塞点击，不延迟受控状态提交。

### 9.6 其他 Renderer 组件优先级

| 优先级 | 组件 | 原因 |
|---|---|---|
| P0 | Switch | 已有三种结构，适合建立模式 |
| P1 | Slider | Thumb、Track 与反馈高度依赖材质 |
| P1 | Segmented Control | 选中指示器在 glass/soft 中结构不同 |
| P2 | Checkbox / Radio | 差异可以较轻，先评估 Token 是否足够 |
| P2 | Progress | Glass 可使用流体填充，需性能评估 |
| 不做 | Button / Input | 默认使用 Token 即可 |

---

## 10. 输入区与渐进披露

### 10.1 Composer 是一个布局单元

输入框、Token 状态和高级选项必须位于同一个 Composer 容器：

```text
Composer
├── Input Surface
├── Primary Actions
├── Expanded Options Tray
└── Token / Context Status
```

Token 状态栏跟随 Composer 的宽度、位置与展开动画，不再独立吸底。

### 10.2 状态

| 状态 | 显示内容 |
|---|---|
| idle | 输入、发送、一个高频附件入口 |
| focused | 展开高级工具层与模式信息 |
| composing | 保持高级层，显示输入反馈 |
| running | 显示停止、队列、Token/Context 状态 |
| error | 在 Composer 内给出恢复入口 |

现有模型选择、权限、附件、语音、Composer Mode、Ask Mode、停止、重试等功能不得删除，只重新分组。

---

## 11. 动效架构

### 11.1 动效职责

动效只表达：

- 状态变化。
- 空间来源和去向。
- 层级进入与退出。
- 操作反馈。

禁止无原因的循环漂浮、全屏光效和多个区域同时大幅移动。

### 11.2 动效 Token

建议统一：

```text
--motion-duration-instant
--motion-duration-fast
--motion-duration-control
--motion-duration-panel
--motion-duration-scene
--motion-ease-enter
--motion-ease-exit
--motion-ease-spatial
--motion-spring-soft
```

### 11.3 性能约束

- 普通交互使用 transform 与 opacity。
- Layout 变化使用 FLIP、clip 或共享元素快照，避免逐帧修改 React state。
- 动画必须可中断，重复点击以最新状态为准。
- 动画期间不阻塞用户输入。
- 退出动画比进入动画短约 20%–35%。
- 微交互建议 150–260ms，面板与场景建议 220–420ms。
- 所有动效支持 `prefers-reduced-motion`。

### 11.4 Sidebar 回收

最终方向保留为：Sidebar 从当前 Rail 项目流出并回收。该效果在 Shell 稳定后实现，不作为前四阶段的阻塞项。

生产实现不能直接动画 `left/top/width/height`。优先采用：

- 共享元素快照。
- FLIP Transform。
- clip-path 或遮罩。
- 单独的 Morph Overlay。

Sidebar 的业务 DOM 不参与液态变形，避免文本重排和滚动状态损失。

### 11.5 材质切换

Material Renderer 切换时使用同尺寸交叉淡化：

- 旧 Visual 120–160ms 淡出。
- 新 Visual 160–220ms 淡入。
- Root 不 remount。
- 不动画组件宽高。
- 不在过渡过程中改变业务值。

---

## 12. 平台窗口控制区

### 12.1 Windows

- 右上角保留最小化、最大化、关闭区域。
- Inspector 和顶部浮层不能进入窗口按钮安全区。
- 可拖拽区域不得覆盖交互控件。

### 12.2 macOS

- 左上角保留 Traffic Lights 安全区。
- Rail 上胶囊首个按钮需要避开系统控制区。
- AppShell 顶部对齐不能因为 macOS 留白而显得断裂。

### 12.3 平台不改变信息架构

Win 与 Mac 只改变安全区、窗口控制位置和局部圆角，不改变 Rail 功能顺序、Sidebar 内容和主交互路径。

---

## 13. Canvas 与 Office

### 13.1 Canvas

- 继续使用 `apps/electron/src/renderer/components/design-preview/` 唯一实现。
- 不创建新 `canvas/`、`whiteboard/` 或 `board/` 目录。
- Canvas 全屏只改变 AppShell Presence，不复制 MainArea。
- Layers、版本时间线、选中与“指着说话”能力保持原架构。
- 画布自己的 Dock 是场景工具，不是全局一级导航，因此不与 Rail 重复。

### 13.2 Office

- 继续使用现有 `OfficeImmersiveShell`。
- Office 会话 Dock 是场景内交互，不替代全局 Rail。
- 退出 Office 后恢复进入前的 Rail、Sidebar、Inspector 和会话状态。
- WindowControls 在 Office 场景仍遵守平台安全区。

---

## 14. 功能保留清单

### 14.1 通用模式 Rail

- 会话。
- 草稿。
- 插件 / Skills。
- 看板。
- 自动任务。
- 记忆。

### 14.2 TA 模式 Rail

- 会话。
- 看板。
- 资产库。
- 审核。
- 流水线。
- 记忆。
- TA 配置。

### 14.3 常驻功能

- 通用 / TA 切换。
- Office。
- 设置与用户入口。
- 更新状态与安装。
- 环境异常状态。
- 全局 Tooltip 与快捷提示。

### 14.4 Inspector

- 文件。
- Btw 旁注。
- 浏览器预览。
- Design Preview。
- Crew / 班组。
- 折叠、展开与宽度拖拽。

### 14.5 Agent 与 Composer

- 模型选择。
- 权限模式。
- Composer Mode。
- Ask Mode。
- 附件与文件。
- 语音。
- 发送、停止、重试和队列。
- Token / Context 状态。
- 画布上下文注入。

任何入口重排必须在 PR 描述中给出旧位置与新位置的映射。

---

## 15. 目标文件结构

### 15.1 UI 包

```text
packages/ui/src/
├── material/
│   ├── MaterialProvider.tsx
│   ├── material-context.ts
│   ├── material-types.ts
│   └── resolve-material.ts
├── components/
│   ├── switch/
│   │   ├── Switch.tsx
│   │   ├── SwitchRoot.tsx
│   │   ├── FrostedSwitchVisual.tsx
│   │   ├── GlassSwitchVisual.tsx
│   │   └── SoftSwitchVisual.tsx
│   └── ...
├── tokens/
│   ├── colors.ts
│   ├── radius.ts
│   ├── motion.ts
│   └── surface-role.ts
└── index.ts

packages/ui/styles/
├── md-surface.css
├── material-tokens.css
├── surface-roles.css
├── pressable.css
└── components/
    ├── switch.css
    └── ...
```

实际迁移可以保留 `glass.css` 文件名作为兼容入口，但最终 Material Token 不应全部长期堆在一个超大文件中。

### 15.2 Electron Shell

```text
apps/electron/src/renderer/components/app-shell/
├── AppShell.tsx
├── shell-layout.ts
├── useAppShellLayout.ts
├── ShellPresence.tsx
├── NavIsland.tsx
├── FunctionalRail.tsx
├── LeftSidebar.tsx
├── RightSidePanel.tsx
├── RightPanelRail.tsx
├── app-shell.css
└── *.test.ts(x)
```

`app-shell.css` 只负责 Scene、主平面、Presence 和平台安全区，不定义 Switch、Button、Card 等组件视觉。

---

## 16. 设置与兼容迁移

### 16.1 现有数据

必须兼容：

- `tagent-theme-mode`
- `tagent-theme-style`
- `tagent-material-mode`
- `themeMode`
- `themeStyle`
- `advancedMaterialEnabled`
- `advancedMaterialOnMode`
- `advancedMaterialMode`

### 16.2 Legacy 映射

示例：

```text
themeMode=special + themeStyle=ocean-dark
    ↓
appearance=dark + palette=ocean

themeStyle=neumorph-light
    ↓
appearance=light + palette=default + material=soft
```

迁移函数必须：

- 幂等。
- 不覆盖用户已经写入的新值。
- 对未知值回退 default + frosted。
- 记录恢复策略，不吞错。
- 保留一段兼容读取期。

### 16.3 设置 UI

设置页面拆成三个独立区域：

1. 外观：跟随系统 / 浅色 / 深色。
2. 色彩：六个 Palette 预览。
3. 材质：磨砂 / 高透玻璃 / 轻拟态。

材质预览使用缩小版 AppShell，至少显示 Rail、Sidebar、Main 和 Switch，不能只显示三个色块。

---

## 17. 迁移阶段与 PR 划分

### Phase 0：设计冻结与基线

- 冻结当前 Spatial 原型作为视觉参考。
- 建立功能映射清单。
- 截取 Win/Mac、标准态、折叠态、Canvas、Office 基线。
- 不修改生产结构。

验收：设计方向与功能清单由维护者确认。

### Phase 1：主题与材质基础设施

- [x] 增加独立类型与解析函数。
- [x] 增加 MaterialProvider，并接入四类 Renderer 窗口根节点。
- [x] 建立 Surface Role 与 Motion Token。
- [x] 保留现有视觉，不开始大面积换肤。
- [x] 增加 Legacy 设置迁移测试。

验收：2026-07-18 完成。`@tagent/ui` 与 Electron 类型检查通过；Material、Surface Role 与 Legacy 设置定向测试共 61 项通过。

### Phase 2：AppShell 几何结构

- [x] 重构 Rail、Sidebar、Main、Inspector 的并列布局。
- [x] 移除负 margin 与主平面覆盖。
- [x] 建立 ShellLayout 纯函数与 Presence。
- [x] 保留现有业务子组件。

实现验收：2026-07-18 完成。新增 standard / focus / canvas / office 单一布局推导、Rail 二次点击折叠、Sidebar 与 Inspector 保留挂载、隐藏区域 inert，以及 28 项 Phase 2 定向测试；Electron 类型检查和 Renderer 构建通过。Win/Mac 与真实内容的视觉烟测并入 Phase 3 联调。

### Phase 3：Spatial 表面与图标

- [x] 接入环境弥散背景和 Surface Role。
- [x] 实现分体 Rail 胶囊与独立 Sidebar lens。
- [x] 统一 Rail 图标系统，移除手写 SVG 与混用图标。
- [x] 调整 Rail / Session 选择态、Hover、Focus 和 Tooltip 层级。

实现进度：2026-07-18 已完成首个生产可见版；Win dev 真实窗口烟测通过，Renderer 构建、Electron 类型检查与 29 项 AppShell 定向测试通过。三种材质视觉矩阵与 macOS 安全区仍需后续设备联调，完整液态 Sidebar morph 延后细化。

### Phase 4：材质感知组件

- 先以 Switch 建立 Root + Renderer 模式。
- 再迁移 Slider 和 Segmented Control。
- 增加材质切换、键盘、Focus、Disabled 和清理测试。
- 评估 Glass Renderer 的延迟加载。

验收：材质切换不丢焦点、不改变业务状态、不产生布局跳动。

### Phase 5：Composer 渐进披露

- 将输入框、工具层和 Token 状态合并为一个布局单元。
- 保留全部 Agent 功能。
- 实现 focus 展开和状态切换动画。

验收：发送、停止、附件、权限、模式、语音、Token 状态全部通过。

### Phase 6：Canvas 与 Office 场景

- 接入 Canvas 与 Office 的 Shell Presence。
- 处理进入、退出和状态恢复。
- 验证场景 Dock 与 Rail 不重复。
- 验证窗口控制安全区。

验收：全屏场景无死路，退出后恢复原布局和会话。

### Phase 7：高级动效

- 实现 Sidebar 与 Rail 的空间连续转场。
- 优化 Inspector、Composer 与场景转场。
- 加入 reduced-motion 与动画中断策略。

验收：60fps 目标、输入不阻塞、快速重复点击状态正确。

### Phase 8：旧样式清理

- 删除已无调用的 legacy theme/material 覆盖。
- 收敛 `globals.css`。
- 移除重复 Material DOM 与无用依赖。
- 更新 DESIGN.md、ADR、CHANGELOG 和组件清单。

验收：全仓搜索无已废弃选择器，视觉回归通过。

---

## 18. 测试策略

### 18.1 单元测试

- `deriveShellLayout` 全状态组合。
- Legacy Theme/Material 迁移。
- `resolveMaterial` 回退。
- Switch Root 状态与 Renderer 切换。
- `getNavClusterWidth` 或其替代布局函数。
- Presence 退出延迟和中断。

### 18.2 组件测试

Switch 必须覆盖：

- 三种材质。
- light / dark。
- checked / unchecked。
- disabled。
- keyboard Space / Enter。
- Focus 保留。
- 运行中切换材质。
- reduced-motion。
- unmount 清理动画。

### 18.3 Shell 功能测试

- 通用与 TA 模式全部 Rail 项目。
- Sidebar 折叠、恢复、切换项目。
- Inspector 五类入口和 resize。
- standard、focus、canvas、office。
- Win/Mac 窗口控制区。
- 主题、明暗、材质切换。
- Composer 全功能。

### 18.4 视觉回归

不对 36 × 4 × 2 的全笛卡尔积全部人工截图，而是分层覆盖：

1. Token 测试覆盖全部 36 种主题/材质组合。
2. 核心截图覆盖 default/ocean/forest/purple。
3. 每种材质至少覆盖 light 和 dark。
4. 每个 Shell 场景至少覆盖 default-frosted 与 default-glass。
5. Switch、Slider、Segmented Control 建立材质 Story/Fixture 全矩阵。

### 18.5 无障碍

- 正文对比度至少 4.5:1。
- 大图标和大型文字至少 3:1。
- Focus Ring 在所有主题和材质下可见。
- 图标按钮具备 `aria-label`。
- Tab 顺序与视觉顺序一致。
- Sidebar 折叠后内容不进入 Tab 顺序。
- Reduced Motion 与 Reduced Transparency 有明确回退。

### 18.6 性能

- 交互反馈在 100ms 内出现。
- 主动动画每帧主线程预算目标小于 16ms。
- Material 切换不引发主布局 CLS。
- Glass 高成本代码按需加载或证明常驻成本可接受。
- 长列表滚动不受 backdrop-filter 与阴影数量明显影响。

### 18.7 每阶段命令

```bash
bun run typecheck
bun test
bun run build
```

UI PR 必须附带截图和手工验证清单。

---

## 19. 风险与恢复策略

### 19.1 大范围 CSS 回归

风险：旧业务选择器比新 Token 选择器优先级更高。

策略：

- 每个阶段只迁移一类 Surface 或组件。
- 建立废弃选择器清单。
- 禁止通过 `!important` 解决新旧冲突。
- 最终阶段删除旧权威，而不是永久双轨。

### 19.2 条件卸载导致状态丢失

风险：Sidebar、Inspector 或 Composer 在动画前被卸载。

策略：统一 Presence；测试滚动位置、Focus、输入草稿和面板宽度恢复。

### 19.3 Glass 性能

风险：多个 backdrop-filter、SVG Filter 和大阴影降低帧率。

策略：

- 大区域限制真实 Glass 数量。
- Main Workspace 不使用高成本玻璃。
- 高成本控件按需加载。
- 低性能或 reduced-transparency 回退 frosted。

### 19.4 主题与材质组合不可读

风险：浅色 Glass 消失、深色 Glass 文字对比不足。

策略：只在 Appearance × Material 层做对比补偿，使用自动对比测试和代表性截图。

### 19.5 功能入口丢失

风险：视觉重排时误删低频功能。

策略：维护第 14 节清单；每个 PR 写出旧位置、新位置和验证结果。

### 19.6 设置迁移失败

风险：用户升级后主题或材质重置。

策略：迁移函数幂等；读取 legacy；写入失败时继续使用当前会话值并记录日志；默认安全回退 frosted。

---

## 20. 完成定义

只有同时满足以下条件，迁移才算完成：

- AppShell 主平面没有负 margin 与无语义覆盖。
- Rail、Sidebar、Main、Inspector 的职责清晰且全部对齐。
- 所有现有功能入口均可到达。
- standard、focus、canvas、office 状态可预测且可恢复。
- Win/Mac 窗口控制区均自然安全。
- Palette、Appearance、Material 可以独立切换。
- 业务代码不判断材质。
- 至少 Switch、Slider、Segmented Control 完成材质策略评估。
- Renderer 切换不丢状态、焦点和无障碍语义。
- `globals.css` 不再是主题材质补丁集合。
- UI 视觉值集中到 `@tagent/ui` Token 或组件实现。
- Reduced Motion、Reduced Transparency、light、dark 均完成验证。
- TypeScript 类型检查、测试、构建和 UI 手工验收全部通过。
- DESIGN.md、ADR、组件清单和迁移说明同步完成。

---

## 21. 实施前需要确认的决策

以下决策在 Phase 1 开始前由维护者确认：

1. 是否正式采用 Phosphor 作为 TAgent Shell 的唯一图标族。
2. Palette 存储是否在本轮升级为独立字段，或先保留 `themeStyle` 兼容适配层。
3. Glass Switch 是否继续使用 GSAP，或改为 CSS/WAAPI 并减少运行时依赖。
4. Sidebar 折叠后是否长期保留挂载以保存滚动状态。
5. Focus 场景是否作为用户可显式切换的持久状态，还是仅由具体功能临时进入。

这些决策不影响 Phase 0 文档与基线工作，但会影响 Phase 1、Phase 3 和 Phase 4 的具体实现。

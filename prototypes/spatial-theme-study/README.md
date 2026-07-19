# Spatial Theme Study — TAgent 多主题视觉原型

> **这是生产迁移前的视觉签字原型**，不是产品 UI。仅用于在六套主题 / 明暗 / 材质 / 平台下
> 审定 Spatial Lens 的视觉系统；**不要把本目录的 CSS/JS 直接贴进生产壳层**。
> 生产落地必须走 `@tagent/ui` token 与 `data-material` 表（见根 `CLAUDE.md`「UI 库使用规范」）。

## v4.1 长会话导航补全（2026-07-19）

- 顶栏补回同一条连续状态读数：模型、审批模式、活动状态、协作人数与进度；它与标签页共享基线，但不再伪装成四个并列胶囊。
- “上一轮”定位器贴近正文上缘，仅在用户消息越过阅读区后出现；正文仍是背景层，不增加新的顶栏或浮岛容器。
- 原生滚动条从 680px 正文列移除。右侧独立消息导航由两部分组成：消息刻度负责跳转与可见段反馈，窄滑块负责拖拽/键盘滚动进度，两者不占正文宽度。
- 悬停或聚焦刻度会展开玻璃预览层，可搜索并跳转全部消息；`?minimap=1` 可强制展开用于视觉检查。Canvas / Office 全屏场景自动隐藏该导航。

## v4 修订（2026-07-19：浅色加强 Scene 矿物光 + 深色收敛边缘光）

解决两个问题：A. 浅色背景太弱、三材质都像白色；B. 深色 chassis/sidebar/inspector/composer/active 边缘光太强（一圈银白）。

- **Scene 矿物光加强**（不改 ink/accent/glass-rgb、不改 pos）：六主题浅色 `scene-base` 略降到 L≈0.92-0.94（不再贴死近白瓷，给一层极淡底色），A 矿物主光 0.42-0.46、B 补光 0.26-0.30、C 塑形 0.13-0.14；深色 base 略降到更饱和近中性深灰，A 0.44-0.48、B 0.28-0.32、C 0.15-0.16。强度仍 A>B>C。
- **模型 = 约 65% 近中性空间 + A/B 可辨矿物光**（不是整窗单色滤镜）：渐变羽化终点 68%→72%，`.ambient-field` 收紧为 `inset:-8%` / `blur(28px)` / `opacity:0.92`。三材质不再都像白色。
- **深色边缘收敛**：新增 chassis role token `--role-chassis-rim` / `--role-chassis-shadow`，`styles.css` 不再硬编码 `.prototype-shell` 的 `.4/.5` 光学边；dark 外框 rim 最终收至约 `.06`、顶 inset `.04`。三材质 dark 大面边缘稳定在约 `.05-.09`：frosted/soft/glass 分别降低 rim 与顶高光，soft 大面顶光收至 `.05-.06`，glass 的 search/underlay/switch 也有独立暗态压光。A/B 折射仍保留，层级由 fill、blur 与环境影表达，不再依靠银白描边。
- 不改文字对比、不改 accent；main/workspace 继续 transparent；不重构布局/控件。v3 配色冻结为 `theme-tokens-v3-neutral-scene.css`（背景偏白的 v3 中性 Scene 对照，**不被 index.html 引用**，手动换 link 可在浏览器并排比对）。

## v3 修订（2026-07-19：回到「近中性空间 + 两束有色光」的克制模型）

v2 把六套浅色的 `scene-base` 染成带 hue 的中灰（L 0.85-0.89）+ A 光强度 0.5，整窗虽然可辨，
但读起来像「六层低饱和滤镜」——每套都在底色上铺了一层淡彩，缺少真正的中性呼吸空间。
v3 收回去，重新确立视觉模型：

1. **70% 近中性空间 + 仅 A/B 两束有色光 + C 近中性塑形光**。主题身份只靠 A/B，不再靠 base 染色。
2. **base 是近白瓷**：浅色 `scene-base` 提到 L≈0.958-0.965、chroma 极低（六套几乎同款近白，
   不承载主题身份）；`glass` L≈0.982-0.985、接近无色白瓷。中性空间让 A/B 的有色光被「读」出来。
3. **A 主光（左上）** strength 0.30-0.36；**B 补光**（多数右下，forest/purple 用右上）0.18-0.24；
   **C 塑形**（底部近中性）0.10-0.14，必须读不出第三种颜色。强度严格 A>B>C。
4. **渐变羽化终点 72% → 68%**：光斑收得更紧，近白 base 的中性空间更主导。
5. **frosted saturation 1.14/1.1 → 1.06**：不把场景色抽进玻璃，玻璃保持近无色白瓷折射；
   opacity/blur 保持 v2（blur 22px + opacity 0.66，scene 经面板折射可见）。
6. active 仍是中性玻璃板；accent 只给 CTA/focus/关键进度。禁止蓝紫粉、薄荷绿、日落橙、整窗同色滤镜。
7. 深色同结构：base 近中性深灰 L≈0.18-0.23、glass 近中性深玻璃不整页染 hue；
   A/B 用对应浅色的低明度低 chroma 版本且 A>B；C 中性塑形。default/slate/ocean 优先可读，purple 禁霓虹紫。

**上一版对照**：v2 配色已冻结为 `theme-tokens-v2.css`，对照页 `palette-v2.html`
（引用 v2 token，可与 `index.html` 当前 v4 并排打开比对）；v3 配色冻结为 `theme-tokens-v3-neutral-scene.css`（背景偏白的中性 Scene 对照）。`index.html` 始终引用最新 `theme-tokens.css`。

## v3.1 材质辨识度修复（2026-07-19：三材质肉眼可辨）

v3 三材质在默认浅色下几乎同质（都靠近白瓷 fill + 单向外影），本轮只修材质辨识度，
不改布局 / 字号 / 六主题 scene token 的 rgb / 位置 / 强度 / 尺寸。

- **shadow 合法性**：弃用 `rgb(... / var(--inset-dark-strength))` 在 frosted/glass 值为 0 的
  脆弱写法，改完整 shadow token `--material-inset-edge`（frosted/glass = `0 0 0 transparent`
  透明 no-op，soft = 真实 `inset 0 -1px 0` 下缘暗），role shadow 第三段统一引用它。
- **soft 哑光软瓷**：opacity 0.90 / chip 0.86（dark 0.92 / 0.88）、blur 2~3；大表面
  rail/sidebar/inspector/composer 改克制的近距接触影（y8~16 / blur18~28）+ 窄顶高光 + 下缘暗，
  不再远飘白卡；search / composer-underlay / tab active / session active 内凹对比明显增强；
  普通控件不浮起。dark 同结构、对比受控。
- **glass 高透光学片**：opacity 0.08 / chip 0.11（dark 0.07 / 0.10）、blur 大面 48 / chip 30
  （dark 42 / 28）、rim 0.38（dark 0.28）、highlight 0.55（dark 0.18）、shadow 0.07（dark 0.34）；
  大表面单一环境影、不带 soft 厚度 inset；active 局部密度 ~0.22，仍是玻璃不是白卡。
- **纯光学折射层**：新增 `--material-optical-wash`（颜色只引用 `--scene-a/b-rgb` /
  `--optical-highlight-rgb` / `--ink-rgb`，无新色），以无文字 `::before` 应用到
  rail-island / sidebar / inspector / composer，`z-index:-1` 落在 fill 上、内容下，不盖文字。
  frosted 接近 none，soft 仅极弱瓷釉高光，glass 拾取 A/B 光 + 顶高光。无 SVG filter / WebGL / 彩色 rim。
- **frosted**：保持中位磨砂身份，只同步 shadow 合法性，光学参数与 scene 不动。
- 切换无白闪（wash 是 ≤0.10 alpha 光学层，非白色填充），`prefers-reduced-motion` 继续生效。

## v2 修订（2026-07-19：六套浅色在整窗可辨）

> v2 保留为上一版基线，详见上方「上一版对照」。核心做法（v3 在此基础上回调 base 与光强）：

1. **frosted 是白漆不是玻璃**：旧 `--glass-blur:0` + `--glass-opacity:0.92`，blur 为 0、92% 不透明，
   浮岛把 scene 完全盖死。→ 改真磨砂：`blur:22px` + `opacity:0.66`（dark 0.84），scene 经面板折射可见。
2. **scene 被洗白**：六套浅色 `--scene-base` 全近白（L 218-234），且最大的 A 光在每套里都是近白、
   strength 0.5，主导光没色相；`.ambient-field` 的 `inset:-28%` + `blur:36px` + `opacity:0.86` 又把
   B/C 色温晕开。→ A 改成主题主色调 key 光、base 降一点亮度带 hue、B/C 冷暖对位；
   ambient-field 收紧为 `inset:-6%` + `blur:24px` + `opacity:0.9`。
3. **role 倍率**：配合新低透明度，active 板（list/tab/message-user/composer）倍率上调保可读，
   rest 浮岛/抽屉半透折射 scene；active 仍走中性玻璃，不染 accent。

## 它和 `layout-direction-study/` 的关系

- `layout-direction-study/` 探究的是**布局基调**（Instrument / Spatial / Editorial 三方向），原样保留不动。
- 本原型锁定其中胜出的 **Spatial Lens** 作为唯一布局基调，专注**多主题视觉系统**实验：
  Scene 身份、四层 token、中性 active、材质表、六主题冷暖。

## 打开方式

```bash
cd prototypes/spatial-theme-study
python -m http.server 8765
# 浏览器打开 http://localhost:8765/            ← v3 当前版
#        及 http://localhost:8765/palette-v2.html ← v2 对照版
```

也可直接双击 `index.html`（无本地服务依赖，仅 Phosphor 图标走 CDN）。

## 文件结构

| 文件 | 作用 |
|------|------|
| `index.html` | Spatial 壳 + 实验工具条（shell 外）。`data-theme/mode/material` 在 `<body>`，`data-platform/spatial-state-*` 在壳上。引用最新 `theme-tokens.css`。 |
| `theme-tokens.css` | **唯一裸颜色源（v4）**。四层 token + 材质表 + Surface Role token（含 chassis role）+ 平台语义色。 |
| `theme-tokens-v3-neutral-scene.css` | v3 配色快照（背景偏白的 v3 中性 Scene 对照），供对照，不被 index.html 引用，不随 v4 演进。 |
| `theme-tokens-v2.css` | v2 配色快照，供对照，不随 v3/v4 演进（`clear` 已机械重命名为 `glass`，光学值冻结不变）。 |
| `palette-v2.html` | v2 对照页，引用 `theme-tokens-v2.css`，其余结构与 `index.html` 一致。 |
| `styles.css` | 组件样式，**只消费 `var(--role-*)` / `var(--ink*)` / `var(--accent)` / `var(--scene-*)`**，无裸颜色。 |
| `prototype.js` | 交互（sidebar morph / composer / 场景全屏 / rail tooltip / 上一轮定位器 / 消息刻度与滚动滑块）+ 主题切换 + localStorage + URL query + selftest。 |

## 实验轴

| 轴 | 取值 | 说明 |
|----|------|------|
| `theme` | `default` / `ocean` / `forest` / `slate` / `orange` / `purple` | DOM `data-theme`，与生产 `.theme-xxx` 命名对齐，便于迁移。 |
| `mode` | `light` / `dark` | 浅色 base 极淡底色 L≈0.92-0.94、A 左上矿物主光 0.42-0.46；深色 base 更饱和近中性深灰、A/B 矿物光 0.44-0.48 / 0.28-0.32 且 A>B。 |
| `material` | `frosted` / `soft` / `glass` | 三材质对照（详见下方「三材质对照」）。`frosted` 基准（中高不透明、轻 blur、单向轻影）/ `soft` 软瓷轻拟态（near-opaque、内凹井 + 内凹选择态）/ `glass` 高透光学（低 fill、高 blur、细 rim、单一环境 drop）。主题 hue 与材质正交，只改光学参数不改 hue。历史 `clear` 已重命名为 `glass`，URL/localStorage 旧 `clear` 自动迁移为 `glass`。 |
| `platform` | `windows` / `mac` | Win 三键 / Mac 交通灯。 |

### URL query

```
?theme=ocean&mode=dark&material=glass&platform=mac   # 直达某组合（material 取 frosted/soft/glass；旧 clear 自动迁移为 glass）
?clean=1                                              # 隐藏实验工具条，舞台 padding 收紧，方便截图
?selftest=1                                           # 跑浏览器内自检，结果写 body.dataset.selftest
?motion=reduced                                       # 强制 reduced-motion（selftest/morph 用）
?scroll=0.72&minimap=1                                # 长会话滚到 72%，并展开消息导航预览
```

支持 localStorage 记忆（`tagent-spatial-theme-*`）。

## 三材质对照

材质轴与主题 hue 严格正交：材质只改 blur / 透明度 / 饱和 / rim / shadow / 高光 / inset-edge / 光学折射层，
不改 hue（hue 由 `--glass-rgb` 承载）。组件只消费 `--role-*`，三材质差异由 role token 分表覆盖，
少量结构差异（soft 内凹井 / 按压 inset）用 `[data-material='soft']` 选择器兜底。

| `data-material` | 工具条 | 视觉身份 | 阴影语言 |
|------------------|--------|----------|----------|
| `frosted` | 磨砂 | 基准：中高不透明（0.66）、轻 blur（22px）、单向轻影，克制不牛奶玻璃 | 外软影 + 顶高光，active = 中性密度板 |
| `soft` | 软瓷 | 软瓷轻拟态：near-opaque（0.90 / chip 0.86）、blur 2~3，近距接触影 + 窄顶高光 + 下缘暗 | search/composer-underlay 为 inset 井；tab/session active 内凹选择态；按钮按压 raised→inset；switch 内凹瓷轨 + 抬升拇指；避免左右对称肥皂阴影、避免每个控件浮起 |
| `glass` | 高透 | 高透光学玻璃：低 fill（0.08 / chip 0.11）、高 blur（大面 48px / chip 30px）、轻 saturation、细中性 rim、单一环境 drop | active = 局部密度提高而非白卡；无文字 `::before` 光学折射层（`--material-optical-wash`）在 fill 上、内容下，不对文字施加 filter；不用彩色边缘/霓虹/大面积 SVG displacement；switch 透明光学轨 + 亮 rim 拇指 |

新增独立 role token：`--role-composer-underlay-*`（不复用 control）、`--role-search-*`、
`--role-switch-*`、`--role-press-inset`；`--role-status-*` 保持透明。`--material-inset-edge`
（frosted/glass = `0 0 0 transparent` 透明 no-op，soft = 真实下缘暗）与 `--material-optical-wash`
（纯光学折射/高光层）使三材质共用一套 role shadow 结构。

workspace header 的「自动审批」重构为 material-aware switch（轨道 + 拇指 + 文案，点击切换、
`aria-checked`）；composer 内同位置改为「权限」菜单入口，保留能力入口、不再重复同一状态。

材质切换 transition 240~360ms（`background-color` / `backdrop-filter` / `border-color` / `box-shadow`），
无白闪；`prefers-reduced-motion` 下由全局规则禁用位移与复杂过渡。

## 主题映射

base / glass 六套都近白瓷、不承载身份；主题身份来自 **A 主光**（左上有色光），accent 只给 CTA/focus。

| `data-theme` | 名称 | A 主光（身份） | accent | 禁止 |
|--------------|------|----------------|--------|------|
| `default` | 矿物瓷光 Porcelain Daylight | 冷蓝灰 | 石墨蓝灰 #48566C | 亮矿蓝 |
| `ocean` | 青瓷水光 Mineral Water | 青冷 | 深青瓷 #306068 | 亮 teal |
| `forest` | 茶烟橄榄 Tea Olive | 茶绿 | 深茶绿 #44644E | — |
| `slate` | 玄武暖灰 Warm Basalt | 暖天光 | 铜锈棕 #946044 | — |
| `orange` | 琥珀干光 Dry Amber | 琥珀窗光 | 金褐 #A07038 | 日落橙红渐变 |
| `purple` | 鸢尾烟光 Iris Smoke | 鸢尾雾（低 chroma） | 深鸢尾灰 #5C5476（chroma≤0.08） | magenta/pink/cyan 对撞 |

> 深色 accent 为对应浅色 accent 的提亮版（深底可读）；purple 全链路低 chroma，禁霓虹紫。

## 视觉策略要点

- **A. 约 65% 近中性空间 + A/B 可辨矿物光**：`scene-base` 极淡底色（浅色 L≈0.92-0.94、深色更饱和近中性深灰）、`glass` 近无色白瓷，都不承载主题身份；身份只靠 A（左上矿物主光 0.42-0.46）+ B（对位矿物补光 0.26-0.30），C 是底部近中性塑形光 0.13-0.14，读不出第三种颜色。强度 A>B>C，羽化终点 72%。`.ambient-field` `inset:-8%` / `blur(28px)` / `opacity:0.92`。不是整窗单色滤镜。
- **A2. frosted 是真磨砂玻璃**：blur 22px + opacity ≈0.66，scene 经面板折射可见；saturation 1.06
  不把场景色抽进玻璃，主题色由 A/B 光在整窗浮现（不再靠 46×22 的 swatch chip 硬撑辨识）。
  active 板倍率更高保可读，仍走中性玻璃、不染 accent。
- **B. 四层 token**：Scene / Chassis-Material / Ink / Accent-State。
- **C. Surface Role token** 覆盖 chassis/rail/sidebar/workspace/inspector/tab/list/message-agent/message-user/composer/status/control/tooltip/switch，组件只消费 token（chassis 走 `--role-chassis-rim` / `--role-chassis-shadow`，`styles.css` 无硬编码光学边）。白色光学高光也经 `--optical-highlight-rgb` / `--role-*-rim`。
- **D. 去掉**：AI 紫粉/冰青粉 chroma edge、蓝紫头像渐变、用户消息 accent 气泡、active 的 accent-soft+accent-border 套装、全界面同一亮蓝。active 态一律**中性玻璃板**，accent 只留给 CTA / focus / 关键进度。
- **E. 半径层级**：chassis 28 > drawer 22 > tool 16 > control 11。动效 180-320ms，仅 transform/opacity/filter，支持 `prefers-reduced-motion`。

## selftest

`?selftest=1` 会在加载后校验：6 主题 token 注入、2 模式、3 材质（frosted/soft/glass）、平台切换（Mac/Win 控件显隐）、sidebar morph 关闭/打开、composer 聚焦展开/收回、canvas 进入/退出往返、inspector 显隐、material-aware switch 点击切换。结果写入 `body.dataset.selftest`（`passed`/`failed`）与右下角横幅；失败项记于 `body.dataset.selftestFailures`。

## 自检命令（实现者用）

```bash
# 裸颜色应只出现在 theme-tokens.css（hex 注释 + rgb 三元组）
rg -n "#[0-9a-fA-F]{3,8}\b|rgb\(\s*\d+\s" prototypes/spatial-theme-study/styles.css   # 期望空
rg -n "#[0-9a-fA-F]{3,8}" prototypes/spatial-theme-study/theme-tokens.css             # 集中在此
# 旧 data-material=clear 只允许出现在 JS 迁移逻辑 / README 迁移说明中
rg -n "data-material=['\"]clear['\"]" prototypes/spatial-theme-study                 # 期望空（已全重命名为 glass）
rg -n "clear" prototypes/spatial-theme-study/prototype.js                            # 仅 normalizeMaterial 迁移分支
rg -n "inset-dark-strength" prototypes/spatial-theme-study -g '*.css'                  # 期望空（CSS 已退役，改用 --material-inset-edge；README 说明除外）
node --check prototypes/spatial-theme-study/prototype.js                            # JS 语法
```

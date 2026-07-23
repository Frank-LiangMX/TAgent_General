# TAgent Assistant Presence 交互设计

> 状态：In Progress。本文定义抽象 Agent 形象在欢迎页之外的复用方式，以及统一的状态与动作语言。

当前已完成 Composer Compact 基线：角色在输入框左侧常驻，并接入 `standby`、`input`、`thinking`、`acting`、`needs-input`、`success`、`error`。待确认横幅替换 Composer 时，角色迁移到横幅上方；点击会触发形变反馈、播报当前状态，并把焦点交给输入框或待处理控件。运行状态详情 Popover、语音 `listening` 与工具 Trace 留待后续迭代。

## 1. 目标

角色不是独立的装饰物，而是 Agent 状态的空间化表达：用户应当能从它的形态、节奏和位置判断 Agent 是否空闲、正在理解、执行工具、等待确认或已经完成。

设计采用“一个身份、一个常驻锚点、三种尺度”。欢迎页外，角色的固定位置是 Composer 输入区；不在标题区、消息区和工具卡里重复放置完整角色：

| 尺度 | 建议尺寸 | 使用位置 | 职责 |
| --- | --- | --- | --- |
| Hero | 112–144px | 欢迎页 | 建立人格、响应指针与点击 |
| Compact | 40–48px | Composer 左侧角色槽 | 接收输入、表达持续状态，并提供与当前状态匹配的点击行为 |
| Trace | 12–20px | 工具步骤、权限卡、完成提示 | 只保留光点、环或局部材质，不显示完整脸部 |

同一页面原则上只出现一个 Hero 或 Compact 实例；Trace 可以随任务步骤出现，但必须低于内容层级。

## 2. 状态语言

| 状态 | 运动 | 光学 | 交互含义 |
| --- | --- | --- | --- |
| `standby` | 极慢呼吸、视线居中 | 降低环境光 | 窗口失焦或长时间无操作 |
| `idle` | 呼吸、注视指针 | 低亮度环境光 | 等待输入 |
| `input` | 朝输入区轻微偏转，不逐字跳动 | 核心随焦点渐亮 | 用户正在输入或编辑草稿 |
| `acknowledge` | 压缩、上浮、回弹、眨眼 | 单圈扩散、粒子外呼吸 | 已收到点击或输入 |
| `listening` | 轻微纵向伸缩 | 外环随输入音量变化 | 正在接收语音 |
| `thinking` | 位置稳定、内部缓慢流动 | 核心亮度周期变化 | 正在推理，不暗示具体进度 |
| `acting` | 粒子形成方向性轨道 | 主色沿轨道移动 | 正在执行工具或修改文件 |
| `needs-input` | 停止漂浮并朝操作区偏转 | 暖色单次脉冲 | 等待权限、选择或补充信息 |
| `success` | 轻微展开后回稳 | 一次柔和 bloom | 当前动作完成 |
| `error` | 短促收缩，不左右抖动 | 暖色边缘脉冲 | 动作失败；错误原因仍由文字说明 |

所有状态只读取应用内“动画效果”设置，不读取操作系统、浏览器或远程会话的 `prefers-reduced-motion`。默认“丰富”保留完整状态动作；“较少”保留呼吸、表情、点击反馈、颜色与亮度变化，移除大范围位移、轨道及粒子爆发。

## 3. 页面接入

### 3.1 欢迎页

- 保留 Hero 形态。
- 指针靠近时注视；点击或键盘激活触发 `acknowledge`。
- 当前阶段点击只表达“我在”，不打开面板，避免给没有业务结果的动作附加错误预期。

#### 欢迎页到新会话的共享形象过渡

- 仅在欢迎页“新建会话”链路启用；打开已有会话不播放，避免高频导航拖慢使用节奏。
- 创建开始时复制 Hero 当前渲染帧为无交互浮层；欢迎页信息卡按行交替向左右移动 64px 并淡出。会话创建与 190ms 离场并行，`beforeOpen` 等待离场完成后才切换视图，防止快速创建截断动画。
- 新会话 Composer 挂载后，以两端中心点计算位移和缩放，让形象先轻微上浮，再在 360ms 内落到输入框左上角的 Compact 锚点。顶部标签栏从上方进入，右上上下文 Rail 从右侧进入，Composer 从底部进入；三者使用同一无回弹缓动并以 40–90ms 错峰启动，形成一条连续视线轨迹。
- Compact 在过渡到达前保持隐藏，到达后与浮层进行 100ms 交叉淡化，避免同屏出现两个角色或目标位置闪烁。所有目标元素在首帧前由过渡属性隐藏，动画接管后再显现，禁止挂载闪烁。
- 过渡只修改 `transform` 和 `opacity`，不创建第二个 Pixi renderer，也不使用 Pixi Filter；创建失败、目标超时或导航中断时必须清理浮层并恢复目标可见性。
- 应用内选择“较少”动效时取消共享形象的空间位移，欢迎卡片、标签栏、Rail、Composer 与形象均只做 120–140ms 淡入淡出；预填草稿的输入框聚焦延后到过渡完成，避免落点在途中发生布局变化。

### 3.2 Composer 常驻助手

- 在输入框左侧设置 48px 左右的角色槽，角色可以轻微跨越输入框上边缘，但不能遮挡正文、附件或工具栏。
- 输入框为角色的固定“家”：会话滚动、工具调用和结果渲染期间位置不变，只改变状态。
- 用户聚焦输入框或出现草稿时进入 `input`；发送瞬间先触发 `acknowledge`，随后根据 session 生命周期进入 `thinking` 或 `acting`。
- 窄宽度与 AI Office Dock 中，角色槽缩小到 40px 并收进输入框 Footer，禁止用负边距挤出可视区域。
- 不监听每个按键驱动动画；只订阅 focus、草稿空/非空和提交事件，避免输入性能回退。

### 3.3 点击语义

常驻角色点击必须有业务结果，不再只是装饰反馈：

| 当前状态 | 点击结果 |
| --- | --- |
| `standby` / `idle` / `input` | 聚焦输入框；若已有焦点则只触发回应动画 |
| `thinking` / `acting` | 打开轻量状态 Popover，显示当前步骤和“停止”操作 |
| `needs-input` | 聚焦或滚动到当前权限卡、询问卡或 Agent 弹窗 |
| `error` | 展开最近错误并提供重试入口；错误原因仍由文字显示 |
| `success` | 滚动到最新完成结果；短暂状态结束后恢复输入语义 |

### 3.4 输入框与语音

- 普通文本输入由 Compact 角色表达 `input`，不出现第二个角色。
- 启用语音后，Compact 进入 `listening`；音量只影响外环厚度与亮度，不让角色大幅缩放。
- 用户提交时，Trace 向会话状态区收束，表达输入已交给 Agent。

### 3.5 Agent 弹窗与权限确认

- 普通应用弹窗（设置、删除、回退确认）不使用角色；只有 Agent 主动发起的权限请求、追问和计划确认才与角色联动。
- Agent 弹窗打开时，Composer 里的 Compact 降低亮度，弹窗标题区接续显示同一角色；视觉上是角色移动到弹窗，而不是复制出第二个角色。
- 权限卡或内联追问不遮挡 Composer 时，角色留在原位，视线偏向对应操作区并触发一次暖色脉冲。
- 工具步骤使用 Trace，不在每条工具卡中放脸。
- 禁止用角色颜色替代错误、警告或权限语义。

### 3.6 错误、完成与待机

- 失败时做一次短促收缩和暖色边缘脉冲，持续约 1 秒；之后保留低强度注意态，直到用户重试、继续输入或切换会话。
- 完成时做一次展开与柔和 bloom，持续约 900ms；随后回到 `input`（输入框有焦点/草稿）或 `idle`。
- 窗口失焦或长时间无操作时进入 `standby`，降低帧率与粒子数量；恢复焦点后平滑回到真实 session 状态。

### 3.7 完成、后台与系统通知

- 当前窗口可见：Composer Compact 触发 `success`，不额外弹 toast，除非任务本身已有完成通知。
- 当前窗口不可见：沿用系统通知或任务栏徽标；角色只作为通知图形的一部分，不创建悬浮桌宠。

## 4. 点击反馈

完整动画约 520ms，可被连续点击打断并从头响应：

1. 0–100ms：横向轻微展开、纵向压缩，快速确认按下。
2. 100–360ms：上浮并回弹；眼睛短暂收缩；粒子向外扩散。
3. 0–520ms：光晕增强，一圈细环向外消散。
4. 360–520ms：回到当前业务状态，而不是固定回到 `idle`。

点击目标使用原生 `button` 语义，命中区不小于 44×44px，支持 Enter/Space 与可见焦点环。

### 4.1 独立动作库与低频待机调度

- `standby` / `input` 状态每隔 8.5–19.5 秒随机播放一个短动作，并避免连续重复：左右张望、纵向伸展、侧身探头、短暂打盹、视线追逐粒子、快速抖身。
- 欢迎页 Hero 的外层活动区覆盖问候卡片上方整行，但不使用无缘由的随机跳点。常态移动表现为泡泡沿小幅、长时曲线连续漂游；每经过 2–3 段漂游，远处偶尔生成一颗带尾迹亮粒子，角色先转眼发现目标、短暂停顿，再沿两段弧线追逐并在触及时令粒子散去。位移幅度按容器宽度自适应，Compact 不启用跨区域移动。
- 追逐之外低概率播放“卡片滚动”小剧场：角色先向下看并落到问候卡片上沿，把自身当作球线性滚到另一侧；滚动角度只施加于 Pixi 角色根节点。问候卡片在场景语义上是竖直立面，接触高度必须根据卡片真实 DOM 上沿和角色底部切线测量，滚动与趴下都沿这条边运动，不能用固定百分比把角色压进卡片正面。角色接近卡片时原本表示水平地面的椭圆投影必须淡出，接触、滚动与晕眩期间不在卡片正面绘制地面阴影。结束后立即归正角色角度，在卡片上播放身体失衡与环形眼神动作，并提示“等等，地面在转…”，约 1.45 秒后恢复并重新飘起。滚动与疲劳共用卡片接触高度，但使用互斥的动作时序。
- 待机动作只叠加在状态姿态上，不修改业务状态；进入 `thinking`、`acting`、`needs-input`、`success` 或 `error` 时立即中断待机动作。
- 所有独立动作只改变 Pixi 图层的位移、旋转、缩放、眼神、光环和粒子参数，不增加 Filter，也不触发布局重排。
- 应用内选择“较少”动效后移除大范围位移、旋转与缩放，保留低频呼吸、眨眼、点击反馈、亮度和语义色变化。

### 4.2 连续点击剧情

在 2.8 秒窗口内连续点击时，角色按次数推进而不是重复同一个回弹：

1. 点头：“嗯？”
2. 压缩上跳：“又点我呀？”
3. 左右摇晃：“有点痒…”
4. 受惊弹起：“等等，慢一点！”
5. 晕眩转动：“要没力气了…”
6. 史莱姆般下沉并软趴：“我累了～”。形变不再整体压成椭圆：上半部保持胶体厚度，左右肩部不对称鼓起，底部形成宽而圆润的接触面，竖向眼睛仍清楚可见；欢迎页 Hero 同时移动到问候卡片上沿并提高绘制层级，让胶体底部真实覆盖卡片边缘，而不是被卡片裁成帽檐。

疲劳姿态保持约 4.2 秒；期间再次点击只显示”让我躺一会儿…”气泡，不播放点击触发的大动作，也不会重置恢复计时。趴下后的软体轮廓仍持续低频黏弹流动：上缘缓慢呼吸、两侧交替鼓起、眼睛偶尔眨动，而底部接触点保持固定。随后从卡片边缘重新聚拢、撑起、上跳并播放粒子恢复动作，提示”呼……缓过来了”。点击链超时或恢复结束后从第一句重新开始。欢迎页使用角色自带气泡，Composer 复用现有状态气泡和 `aria-live` 播报，避免同屏出现两个气泡。

### 4.3 表情渲染系统

角色面部表情由 `AssistantExpression` 枚举驱动，通过 Pixi Graphics 图元组合实现眉、嘴、腮红，不依赖 Filter。纯函数 `resolveAssistantExpression(presenceState, activeGesture, powerUp)` 综合状态、手势和蓄力决定当前表情，renderer 每帧调用它。

**默认行为：只显示双眼**

`standby`、`input`、`thinking`、`acting` 四个基础状态默认只显示中性双眼（`neutral`），眉毛、嘴巴、腮红全部隐藏（`showDecorations: false`）。`neutral` 和 `focused` 显式设置 `showDecorations: false`，不依赖阈值偶然隐藏。

**表情 → 状态映射**（仅必要状态显示附加表情）：

| 状态 | 表情 | showDecorations | 视觉特征 |
| --- | --- | --- | --- |
| `standby` / `input` / `thinking` / `acting` | neutral | false | 只有中性双眼，无眉/嘴/腮红 |
| `needs-input` | confused | true | 单眉微挑（不对称），眼略大，嘴微张偏移 |
| `success` | happy | true | 眉微抬，嘴角上扬，淡腮红 |
| `error` | sad | true | 眉下垂，嘴角下撇，眼略收 |

**手势/瞬态 → 表情映射**（手势优先于常规状态，动作结束立即回中性双眼）：

| 手势/瞬态 | 表情 | showDecorations | 说明 |
| --- | --- | --- | --- |
| `tired` / `doze` | tired | true | 眼极窄下垂，眉下垂，嘴下撇 |
| `dizzy` | dizzy | true | 眼半闭但比 tired 大，眉上扬外挑，嘴微张上翘，与 tired 视觉明显不同 |
| `recover` / `tap` | happy | true | 短暂开心表情 |
| 蓄力阶段（powerUp=true） | powered | true | 眼窄聚焦，眉微挑，嘴角微翘，专注变强 |
| 其他手势（glance/stretch/peek/orbit/shimmy） | neutral | false | 无附加表情 |

**图元实现**：
- **眼睛**：`roundRect`，高度 × `eyeHeightMultiplier`，宽度 × `eyeWidthMultiplier`（tired 0.38× 最窄，delight 1.18× 最宽）
- **眉毛**：两条 `bezierCurveTo` 弧线，`eyebrowAngle` 控制倾斜（正 = 怒，负 = 悲），`eyebrowYOffset` 控制上下位移；`showDecorations: false` 时 `graphics.clear()` 清空
- **嘴巴**：单条 `bezierCurveTo` 曲线，`mouthCurve` 控制弧度（正 = 微笑，负 = 撇嘴），`mouthWidth` 控制宽度；`showDecorations: false` 时 `graphics.clear()` 清空
- **腮红**：两个 `ellipse`，`cheekAlpha > 0` 时显示（happy 0.22，delight 0.32）；`showDecorations: false` 时 `graphics.clear()` 清空

所有面部特征随视线 `gazeX/gazeY` 同步偏移；疲劳趴下时表情 alpha 衰减至 40%。

### 4.4 卫星粒子生命周期

欢迎页 rich 模式下，追逐流程结束后粒子不消失，成为角色的卫星：

1. **追逐**：角色沿两段弧线追逐目标粒子（现有逻辑）。
2. **捕获**：触及时粒子散去的视觉效果保持，但同时调用 `addSatellite(colorIndex)` 将粒子转为卫星。
3. **卫星轨道**：每颗卫星有独立的 `orbitRadius`、`orbitSpeed`、`orbitDirection`（±1）、`inclination`（倾斜角）、`phase`，沿倾斜椭圆轨道公转。
4. **蓄力**：第 5 颗卫星加入后，renderer 通过 `onSatelliteCountChange` 回调通知 React 真实数量，同时触发 `stretch` 手势并进入绿色蓄力模式——body 外发光变绿并脉冲放大，卫星亮度增强。`greenMode` 与 `stretch` 同帧激活，stretch 动作（960ms）在吸收开始前完整可见。
5. **吸收**：蓄力持续 `stretch` 动作时长 + 1.2 秒后自动触发 `startAbsorption()`——卫星在 800ms 内向角色收缩（orbitRadius × ease-in 缩小），同时淡出。
6. **清零**：吸收完成后 `clearSatellites()` 销毁所有卫星图元，通过 `onSatelliteCountChange(0)` 回调重置 React 计数，`greenMode` 清除，重新开始追逐循环。循环可无限重复。

**reduced 模式**：禁用追逐、卫星和蓄力，`satelliteField.visible = false`。

### 4.5 运行轨道粒子生命周期

`thinking` / `acting` 时围绕角色的短生命周期粒子，独立于卫星系统。纯函数 `getAssistantRunOrbitProfile(state, reducedMotion)` 生成 profile，renderer 消费。

**Profile 配置**：

| 状态 | count | baseSpeed | orbitRadius | trailLength | lifespan | respawnDelay |
| --- | --- | --- | --- | --- | --- | --- |
| thinking (rich) | 2 | 1.2 | 32 | 5 | 2200ms | 200ms |
| acting (rich) | 3 | 2.4 | 28 | 6 | 1800ms | 150ms |
| thinking/acting (reduced) | 1 | 0.6 | 34 | 2 | 1600ms | 300ms |
| 非 running | 0 | — | — | — | — | — |

**生命周期**：

1. **生成**：进入 `thinking` 或 `acting` 时，`spawnRunOrbitParticles()` 按 profile.count 异步生成粒子（`import('pixi.js')`）。reduced 模式仍生成（count=1），绝不直接 return。
2. **轨道**：每颗粒子有独立 `orbitRadius`、`orbitSpeed`、`orbitDirection`（±1）、`inclination`、`phase`，沿倾斜椭圆轨道公转。拖尾按 profile.trailLength 采样，间隔 50ms，alpha 衰减 clamp≥0。
3. **淡入淡出**：300ms 淡入；生命周期末段 `1 - pow(progress, 2)` 淡出。
4. **长任务补足**：粒子消亡后若 presence 仍 `thinking`/`acting` 且 `runOrbitActive`，按 profile.respawnDelay 延迟后补足到 profile.count。`pendingSpawnCount` / `nextRespawnAt` 防止重复发射。
5. **thinking↔acting 切换**：旧粒子标记 `converging=true` + `convergeStartedAt=now`，按新 profile 生成新粒子。总活跃数不超过 `RUN_ORBIT_MAX`。
6. **收束（converge）**：离开 `thinking`/`acting` 到 `success`/`error`/`standby`/`input` 时，所有粒子标记 `converging=true`。使用独立 `convergeStartedAt`（非 bornAt）计算进度，`profile.convergeDuration`(300ms) 内轨道半径收缩 + alpha 淡出后 destroy。拖尾同步清除。
7. **销毁**：`destroyRunOrbitParticles()` 显式销毁全部图元、clear trail layer、`runOrbitActive=false`、清 pending/generation。`runOrbitGeneration` 递增使异步 import resolve 后的 stale 回调失效。
8. **reducedMotion 切换**：rich↔reduced 时若当前 running，重建对应 profile。

**独立性**：运行轨道粒子不调用 `addSatellite` / `onSatelliteCountChange`，不修改卫星计数。

### 4.6 地面阴影系统

地面阴影使用世界坐标 DOM portal 实现，独立于角色 host 的 CSS transform，锚定在 stage 容器底部。

**核心架构**：
- shadow 元素通过 `createPortal` 挂载到 stage DOM，使用 `ref` 直接写入 style，不触发 React 重渲染
- portal 初始 style：`opacity: 0`、`left: 50%`、`top: groundY`，由 `syncShadow()` 覆盖实际值
- `syncShadow()` 每帧读取 host 和 stage 的 `getBoundingClientRect()` 各一次，计算真实视觉位置后直接写 shadow style

**坐标系统**：
- `groundY = stageHeight - 8px`（stage 底部内缩常量，与 CSS anchor 一致）
- 身体底部锚点比例 `BODY_BOTTOM_RATIO` 由 Pixi 坐标推导：`(DESIGN_SIZE/2 + BODY_CORE_RADIUS) / DESIGN_SIZE`，其中 `BODY_CORE_RADIUS = BODY_RADIUS - 8`（核心质量层半径，非膜层半径）
- 角色身体底部 Y = `(hostRect.top - stageRect.top) + hostRect.height × BODY_BOTTOM_RATIO`（从 getBoundingClientRect 读取，反映 CSS transform 中间态）
- `signedDistanceToGround = groundY - bodyBottomWorldY`（正值 = 在地面上方，零/负 = 接地）
- 默认 stage 168 / host 144 居中几何下，初始 distance ≈ 45px >= WORLD_SHADOW_FADE_THRESHOLD(40)，确保悬空时阴影 alpha=0

**阴影行为**：
- `distance <= 0`：完全接地，alpha = 1，宽度 28px，接触压宽 +6px
- `0 < distance < 40px`：sqrt proximity 衰减 `alpha = sqrt(1 - d/40)`，宽度从 28 线性收缩到 20
- `distance >= 40px`（WORLD_SHADOW_FADE_THRESHOLD）：alpha = 0，完全不可见
- **卡片接触隐藏**：`cardContact`（滚动/疲劳趴下）时 alpha 强制为 0，包括 `distance <= 0`
- **reducedMotion**：应用内设置（非系统 prefers-reduced-motion），接地时 alpha = 0.35 静态反馈，离地即隐藏

**rAF 同步策略**：
- **Rich 模式**：roamPose / contactOffset / roamDuration / grounded / stageRect 变化时立即 sync 一次，然后启动 rAF 循环持续 `roamDuration + 100ms`（上限 6500ms），每帧 sync 一次，超时后 cancel；X/Y 淡化跟随实际 CSS transition，稳定后无 layout thrash
- **Reduced 模式**：仅做一次立即 sync，无 rAF 循环
- **ResizeObserver**：stage 尺寸变化时触发 `setStageRect` + `syncShadow()`
- **单帧开销**：每帧只读一次 host + stage `getBoundingClientRect()` + 写一次 shadow style，不触发 React state 更新

**清理**：ResizeObserver disconnect、rAF cancelAnimationFrame，全部在 useEffect cleanup 中完成。portal 元素由 React 自动卸载。

## 5. 技术结构建议

- 将 `AssistantPresence` 演进为可复用组件：`size`、`presenceState`、`style`、`interactive`、`onActivate`。
- 使用纯函数 `resolveAssistantPresenceState` 统一按以下优先级派生状态：`error > needs-input > acting/thinking > acknowledge/success 瞬态 > input > idle/standby`。需要跨入口共享状态时再提升为 atom family，业务组件不得各自拼接动画条件。
- Composer 只订阅布尔型 focus/hasDraft 与 session 状态，禁止重新引入逐字符导致整个 `AgentView` 重渲染的问题。
- 同屏多个实例时共享时间源和主题调色板；Compact/Trace 优先使用轻量 Canvas/SVG，避免创建多个完整 Pixi Application。
- 角色只表达状态，不保存业务事实；权限、错误和完成信息仍以现有 session/tool 数据为真源。

## 6. 分阶段实施

1. 欢迎页点击反馈与键盘可达（本轮）。
2. 提取统一 `presenceState`，在 Composer 左侧加入 Compact 常驻形态（已完成基线）。
3. 接入 input / thinking / acting / error / success / standby 状态与状态点击行为（已完成基线）。
4. 接入 Agent 弹窗迁移、语音 listening 与权限卡视线联动。
5. 使用一段时间后评估是否保留 Hero、Compact、Trace 三种尺度，或进一步收敛。

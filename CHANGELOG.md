# Changelog

All notable changes to TAgent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **每会话 AI Office 展示模式** — 经典 TAgent 工作台保持默认；主会话可独立切换到全屏办公室，保留会话导航并用可收起悬浮窗复用同一套 Agent 对话运行时；没有看板时也会显示由真实会话状态驱动的主 Agent 总监，不生成虚假 worker
- **AI Office 沉浸式房间壳层** — Office 模式锁定全窗口 Canvas，不挂载经典 sidebar、标签栏和右侧栏；主会话以会话名组成顶部横向房间条，文字沟通与任务详情继续作为场景浮层呈现
- **AI Office 楼层与办公室导航** — 现有 Workspace 在 Office 中作为楼层、其中的顶层 Agent 会话作为办公室；顶部增加楼层菜单、办公室数量、新建楼层、新建办公室和空楼层入口，创建与切换继续复用统一 Workspace / Session 链路
- **AI Office 稳定员工与协作编排** — worker 以真实子会话作为稳定 actor、任务作为可替换 assignment；新员工从入口到总监处 briefing 后再去工位，review / delivery / rework 均沿路径连续移动，并通过单通道交接队列避免多人重叠
- **AI Office 状态与恢复控制** — 增加可访问员工名单、语义状态标签、任务详情入口、看板手动刷新、场景重试 / 返回经典工作台，以及按会话恢复摄像机和沟通窗布局
- **Windows Portable 免安装包** — 正式发布同时产出 `TAgent.Setup.*.exe`（NSIS，可自动更新）与 `TAgent.Portable.*.exe`（单文件免安装）；关于页标注 Portable，并说明无法应用内更新、需到 Releases 下载新 Portable 包手动替换
- **AI Office 虚拟办公室面板** — 班组面板新增办公室视图，用 Pixi.js 2D 渲染虚拟办公室；worker 角色由看板任务动态创建，支持状态姿态、状态区域、滚轮缩放、拖拽移动、双击重置和点击打开任务详情
- **Kanban worker → Office 真值映射** — `task.id` / `roleId` / `assigneeSessionId` 分别绑定场景实体、角色身份与真实 worker 会话/形象 seed；任务状态和实时 progress 映射为待命 / 分析 / 忙碌 / 验收 / 求助 / 已交卷 / 需复盘 / 已撤岗，不再生成固定花名册或默认工作中的幽灵员工
- **Pixi.js / Spine 动画运行时** — 使用 `pixi.js@^8.18.1` 和 `@esotericsoftware/spine-pixi-v8@~4.2.0`；恢复 Chibi Spine 骨骼资源加载与 0.24s 动画混合，矢量角色仅作为资源失败降级

- **空闲批量记忆整理调度器** — `idle-memory-consolidation-scheduler.ts`：60s tick 周期，general/ta 串行执行，真实前台活跃检测，rollout flag 控制（`TAGENT_IDLE_MEMORY_CONSOLIDATION`，dev 默认 on、packaged 默认 off）
- **记忆证据暂存层** — `memory-evidence-sink.ts`（ADR-0006 Phase 1）：前台本地写入 Nudge 候选和 session 证据到 `pending_evidence.jsonl`，标记 dirty，不调用辅助 LLM
- **空闲批量整理核心** — `memory-consolidation-service.ts`（ADR-0006 Phase 2）：单次 Provider 请求完成 keyFacts + memoryCandidates + insights + contradictions，persisted-local-replay、全局 lease 单并发、按 ID 精确消费、batchId 确定性派生
- **空闲整理状态可观测** — `consolidation_state.json` 记录 lastAttemptTime / lastOutcome / cursor / inputCounts / outputCounts / requestsUsedToday 等结构化状态

### Changed

- **AI Office 材质与沟通窗** — Office HUD、导航和会话浮窗改为消费统一 Material 3 / Surface token，默认不再强制玻璃模糊；窄窗使用专用紧凑消息、过程卡、输入框与工具栏编排，而不是压缩经典会话布局
- **AI Office 按需加载** — 全屏 Office 与经典模式右栏 Office 都只在用户主动进入时加载 Pixi 场景，经典路径不承担办公室运行时成本
- **AI Office 状态动画** — worker 状态变化改为 `当前状态 → walking 路径迁移 → 目标状态`；稳定保留工位，交卷使用一次性 `just-right` 动作后回到安静完成姿势，不再瞬移或无限举手跳
- **AI Office 角色比例** — Spine 角色按 682.5px setup bounds 推导到约 102px 场景高度（scale ≈ 0.15），并同步缩小阴影和点击热区，使角色与 101px 桌面宽度匹配
- **AI Office 交卷后生活循环** — 已完成 worker 不再长期站在交付区；在保持看板 `done` 真值的同时，错峰前往茶水间、窗边、打印机、植物角或空地摸鱼，沿导航路径移动、停留并循环选择下一项活动
- **AI Office 动效策略** — 办公室空间迁移和交卷后生活循环不再受系统 `prefers-reduced-motion` 影响，避免 Windows 动画设置关闭时所有角色被永久固定在状态区域
- **AI Office 产品动效档位** — 设置页提供“完整 / 精简”动效；精简模式保留必要行走和交接连续性、提高路径速度并关闭低频装饰行为，普通界面过渡仍尊重系统 reduced-motion
- **AI Office 角色工牌** — 移除角色头顶常驻的完整任务描述，只保留带状态点的紧凑姓名工牌，并使用角色完整视觉高度作为稳定锚点，避免文字遮住角色形象
- **AI Office 总监与活动边界** — 总监固定使用专业形象、深蓝身份色和更克制的动作节奏；角色漫游目标统一限制在可行走地面，修复员工停在右侧墙体的问题
- **前台记忆写入改为本地证据收集** — `recordSessionToMemory` 不再触发 `backfillKeyFacts` LLM 调用；改为写 L4 + `memoryEvidenceSink.writeSessionEvidence()` + dirty 标记，辅助 LLM 整理统一在空闲窗口执行
- **Nudge 候选写入改为本地暂存** — `onTurnStart` 检测到候选后写入 `memory-evidence-sink`（`writeNudgeEvidence`），不再在前台发起 auxiliary LLM call
- **Reflection 合并到空闲批量整理** — 当 `TAGENT_IDLE_MEMORY_CONSOLIDATION=1` 时，insights/contradictions 由 `MemoryConsolidationService` 的一次批量请求产出，不再独立调用 LLM；legacy Reflection 调度仅在 flag 关闭时保留

### Fixed

- **Reflection never-trigger 诊断** — `lastOutcome` 包含 `skipped_clean` / `skipped_insufficient_evidence` 等精确跳过原因，不再无法区分未调度与数据不足
- **本地 apply/consume 失败后重复付费请求** — executor 成功后立即持久化 `pendingApplication` record；apply 或 consume 失败时保留 pending，下次 run 以 `requestsUsed=0` 本地重放，不再重复发起 Provider 请求

---

## [1.6.1] - 2026-07-16

### Added

- **看板默认角色 / 工号 / worker Skills** — 默认角色补齐、同板同角色编号、worker 挂载 workspace Skills
- **数字员工轻量拟人化** — 点将话术 + 跨材质工牌卡（人态文案：待命/忙碌/已交卷等）
- **右栏班组墙** — `KanbanCrewPanel` 伴生面板；员工队列与任务摘要，不切主区会话
- **角色统计与档案** — `kanban-crew-stats` + `RoleStatsCard` / `RoleDetailDialog`（上岗次数、工时、日/周/月）
- **流式输出设置** — 可开关流式渲染
- **单次 Agent 通话统计** — 展示本轮调用相关统计

### Changed

- **SessionTeamTab 降级** — 班组主路径改到右栏；输入框不再常驻附加目录 chip

### Fixed

- **GLM Agent 调用数异常** — 移除 `getContextUsage` 调用链，消除循环触发；Context 圆环改用流式 usage（详见 `docs/reports/2026-07-16-glm-agent-call-count-diagnosis.md`）
- **运行中计时胶囊错位** — 胶囊改回 assistant turn 内 footer，与完成态左对齐
- **任务进度条常驻** — `TaskProgressDock` 仅当前流式回合有 `in_progress` 任务时显示
- **打包任务栏图标** — 跟随主题材质

### Chore

- **release preflight** — 发布脚本校验 package 版本、`RELEASE_NOTES.md` 标题、typecheck、eslint

---

## [1.4.0] - 2026-07-02

### Added

- **看板多 Agent 协作系统（B1–B10）** — 完整的看板编排内核与 UI 全链路，支持多 board 并发、per-board 并发隔离、DAG 依赖解析、事件驱动重派。包含 `kanban-db`（better-sqlite3 + WAL 三表结构）、`kanban-dispatcher`（30s tick + per-board 模型轮询避免降智）、`kanban-worker-service`（强制 bypassPermissions + 防递归 prompt + powerSaveBlocker 防休眠）、6 个 `kanban_*` Agent 工具（create_board / list_boards / add_task / list_tasks / block / comment）、8 个看板 UI 组件（KanbanMainView / BoardSummary / CreateBoardDialog / CreateTaskDialog / RailContent / SwitcherDialog / TaskDetailDialog / TaskListItem / SessionTeamTab）
- **角色库系统** — `agent-role-service` + `AgentRoleSettings` UI，支持 modelPool / maxConcurrentPerModel / fallbackToChannelDefault 配置；dispatcher 按 role.modelPool 分配模型，避免同模型过度并发降智
- **看板完成事件回流** — `onBoardCompleted` 回调：worker 完成后检测 board 全部任务终态时触发，`requireSummary=true` 时自动注入主会话汇总消息
- **任务进度 Dock** — `TaskProgressDock` 组件，看板任务执行状态实时展示
- **上游 v0.13.4 对齐** — bridge 自愈机制、headless registry、后台任务唤醒、qwen-anthropic provider 适配（PR #16）
- **P2 预览路由 + automation skill** — 上游对齐的预览路由与自动化 skill 注入
- **automation agent MCP 工具** — 自动化 Agent 的 MCP 工具桥接
- **Context 分项 stale-while-revalidate** — Context 各分项独立缓存与刷新，避免整体失效
- **Superpowers 全套 14 个 skill 收录** — frontmatter 对齐 Claude Code
- **auto-check PostToolUse 钩子机制** — 工具调用后自动检查 + Agent 行为设置面板
- **消息布局瘦身 + 全局按钮圆角统一 + 过渡动画** — UI 视觉一致性优化
- **会话列表选中蒙版定位 + TA 图标 + Badge Tooltip** — 侧栏交互修复
- **设计文档** — kanban 探索报告、v1 产品设计、session handoff、agent 主动增强设计、kscc 流式与卡顿分析等 4+ 份

### Changed

- **CI 配置** — better-sqlite3 ABI 兼容修复（Node 24 + Electron ABI 分离）、`--ignore-scripts` 跳过 postinstall、`npm rebuild better-sqlite3` 重新编译、手动触发 Electron 二进制下载
- **`.prettierignore`** — 排除 `__generated__/` 自动生成目录
- **vitest.config.ts** — 本地 skip better-sqlite3 native module 测试，CI 跑全量

### Fixed

- **P0 上游稳定性对齐 Proma v0.13.3** — 一系列稳定性修复
- **kanban-dispatcher 测试 CI 超时** — B1-B10 引入 `assignModelForTask` 后，测试未传 `getAvailableModels` 回调导致任务卡在 ready；补上 mock + `maxConcurrentPerModel: 5` 解除单模型并发上限限制
- **ask-service.test.ts mock 不生效** — `vi.spyOn(cp, 'getConfigDir')` 不影响模块内部直接调用的 `getConfigDir`，改用 `vi.mock('./config-paths')` 替换整个模块的 `getAgentSessionAskMessagesPath`
- **format:check 31 个文件需 prettier 格式化** — 开发期未跑 format:write 导致 CI 失败

### Removed

- (none)

---

## [1.3.1] - 2026-06-29

### Added

- **kscc 渠道 ripgrep 自动补齐** — kscc CLI 不自带 ripgrep，Windows 下 Grep/Glob 工具会报 `ENOENT rg.exe`。TAgent 启动时自动检测 kscc vendor 目录，缺失则从系统 PATH 复制 `rg.exe` 过去，所有用户开箱即用（需系统已装 ripgrep，如 `winget install BurntSushi.ripgrep.MSVC`）

### Fixed

- **kscc 渠道 Bash 工具不可用** — `buildSdkEnv` 在 kscc 渠道 early return 跳过了 Windows shell 配置，导致 kscc 子进程拿不到 `CLAUDE_CODE_SHELL`，退化用 cmd.exe 跑 Unix 命令全部失败。改为将 shell 检测移到认证分支之前，所有渠道都先配 shell
- **dev 启动脚本闪退** — `Start-TAgent-Dev.bat` / `Stop-TAgent-Dev.bat` 因 UTF-8 无 BOM 编码导致中文被 cmd 当命令执行而闪退；同时移除了会误杀 kscc 等 CLI agent 的旧 `dev.bat` / `dev-stop.bat` / `dev-kill-all.ps1`（旧脚本无差别 `Stop-Process bun`）

---

## [1.3.0] - 2026-06-29

### Added

- **插件市场 / 已安装页重构** — 整合包优先的市场浏览、已安装卡片视图、侧栏玻璃滑动导航、整合包分组去重
- **插件详情与配置** — 市场/已安装详情页、插件配置对话框、整合包详情
- **`@tagent/ui` 共享 UI 包** — 基础组件（Button、Dialog、SegmentedTabs 等）、design tokens、glass 样式迁入 `packages/ui`，Electron 渲染层改用共享组件
- **插件商店共享层** — `plugin-store-catalog`、`plugin-store-bundles` 及分组/导航测试

### Changed

- **侧栏会话列表** — 移除工作区下拉，改为按项目分组的手风琴平铺；统一选中/非选中 `pl-7` 缩进与竖条位置
- **工作中 / 置顶状态** — 琥珀色竖条 + Timer；Pin 图标与滑动指示器层绘制逻辑统一
- **项目折叠动画** — 文件夹展开/收起图标区分（`FolderOpen` / `FolderClosed`），200ms 轻量过渡
- **Agent 默认标题** — 支持「新 Agent 会话」「TA 会话」及用户首行 fallback
- **Context / 模型选择** — 渠道默认模型、Context 底栏、Mention 弹窗滚动条等配套优化

### Removed

- 旧能力详情页 `CapabilityDetailView`、侧栏 `SkillsPanel`（由新插件市场/已安装页替代）

### Fixed

- `useOpenSession` stale closure 导致重复开 tab
- `openTab` 将已有 tab 移到末尾
- 折叠项目后滑动指示器错乱（折叠时隐藏活跃会话指示器）

---

## [1.2.0] - 2026-06-26

> 详见 GitHub Release [v1.2.0](https://github.com/Frank-LiangMX/TAgent_General/releases/tag/v1.2.0)。以下为 v1.2.0 之前累积、尚未单独归档于本文件的条目。

### Added

- **Automation v1（M1–M3）** — 定时任务系统：30s tick 调度内核、daily/reuse 会话策略、侧栏列表 + 主区编辑器、运行历史、系统 / 飞书运行通知（PR #15）
- **Context Usage 改进** — badge 与面板数据统一、缓存优先刷新、自定义滚动条
- **工作区文件页** — OS 拖放复制 / 附加、顶栏窗口拖拽修复

- **Ask 档位 Composer** — Agent 输入区 Ask 档位（轻量对话，权限边界 + 引导切换 Agent），替代独立 Chat 模式
- **ComposerModeSelector** — 输入区档位切换器（Ask/Agent），对标 Cursor Ask/Agent
- **AgentSwitchBanner** — Ask 模式下引导升级到 Agent 的横幅（自 AgentRecommendBanner 改造）
- **suggest_agent_switch 工具** — Ask 模式专用工具，引导用户切换到 Agent 档位
- **Ask 消息存储** — `{sessionId}.ask.jsonl` 与 SDK JSONL 并列，不污染 Agent resume
- **时间线合并渲染** — AgentMessages 混合展示 SDK 消息与 Ask 消息
- Project governance scaffolding (this changelog, AGENTS.md, CONTRIBUTING.md, etc.)
- Design docs:
  - `docs/plans/2026-06-05-tagent-fusion-design.md` — TAgent Desktop (13 sections)
  - `docs/plans/2026-06-05-tagent-server-design.md` — TAgent Server (12 sections)
- Architecture Decision Records:
  - `docs/decisions/0001-fusion-architecture.md` — Fusion of Proma + ta_agent
- Pre-commit hooks (ruff + mypy for Python, eslint + prettier for TypeScript)
- CI workflows (ci.yml, release.yml)
- Conventional Commits + 80% coverage gate
- **`/btw` side question** — quick aside that doesn't enter main conversation history (no tool access, reuses main session's channel/model). Floating right-side panel with frosted glass background, `scrollbar-thin`, `rounded-[17px]` matching the main input design. Triggered either by typing `/btw <question>` in the Agent input or by clicking the "旁注" button that appears next to the input during AI streaming / 8s post-stream.
- **`/btw` context sharing** — by-the-way questions now have full visibility into the main conversation (matching Claude Code native semantics). On send, the main session's last 20 user/assistant turns are converted from `SDKMessage[]` to `ChatMessage[]` and injected as LLM history. Tool-use blocks are downgraded to `[调用工具 X]` text; tool-result blocks are skipped. Lets users ask "刚才那个文件名是啥" and get a contextually correct answer.
- **`/btw` fork to new session** — `↗` button in the panel header forks the side Q&A into a new Agent session. New session inherits the parent conversation context (via `&session:` reference) plus the btw transcript, so users can continue with full tool access.

- Release helper CLI for checking release status, dispatching the GitHub Actions release workflow, watching completion, and listing uploaded assets.

### Changed

- Claude Agent SDK 升级至 **0.3.185**（写风暴 / 断连修复，PR #13）
- `/btw` panel UI refined: resized to a floating card (`top-[10vh] bottom-[10vh]`), frosted glass (`bg-background/70 backdrop-blur-xl`), custom thin scrollbar, no longer overlaps window control buttons.

### Removed

- (none yet)

### Deprecated

- (none yet)

### Removed

- (none yet)

### Removed

- **独立 Chat 模式 UI** — `ChatView`、`components/chat/` 目录、`appMode: 'chat'`、`TabType: 'chat'`（历史对话可导出）
- **Chat 发送路径 IPC** — `CHAT_IPC_CHANNELS.SEND_MESSAGE`、`STOP_GENERATION`、`GENERATE_TITLE`（附件 API 保留）
- **Chat 监听器** — `useGlobalChatListeners.ts`（已删除）

### Fixed

- GitHub Release workflow now packages desktop artifacts without letting electron-builder publish in parallel, uploads updater metadata, and prepares optional wheelhouse resources before packaging.
- Release CI now pins Windows/Python runner tooling and writes Linux renderer output inside the Linux app package directory.
- Linux release renderer builds now resolve shared HTML inputs through the real source tree instead of symlinked paths.
- Linux packaging no longer uses deprecated or invalid electron-builder options that fail schema validation.
- Linux deb packaging now includes required homepage metadata and flat artifact file names.
- Linux release packaging now builds x64 artifacts only, matching the release workflow matrix.
- Linux release packaging now uses the main Electron app configuration instead of a separate `apps/electron-linux` package.
- Release installs now use the checked-in frozen Bun lockfile with official registry settings instead of rewriting dependencies during CI.

### Security

- (none yet)

---

## How to update this file

When you make a PR that affects users, add an entry under `[Unreleased]` in the appropriate subsection:

- **Added** — new features
- **Changed** — changes in existing functionality
- **Deprecated** — soon-to-be-removed features
- **Removed** — now-removed features
- **Fixed** — bug fixes
- **Security** — vulnerability fixes

The release script (`scripts/release.py ship X.Y.Z`) will:

1. Move `[Unreleased]` entries to a new `[X.Y.Z]` section with today's date
2. Reset `[Unreleased]` to empty
3. Commit + tag + push

**Do not manually edit versioned sections** — let the release script handle it.

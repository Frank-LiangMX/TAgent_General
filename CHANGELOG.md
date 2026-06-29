# Changelog

All notable changes to TAgent will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- (none yet)

### Changed

- (none yet)

### Fixed

- (none yet)

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

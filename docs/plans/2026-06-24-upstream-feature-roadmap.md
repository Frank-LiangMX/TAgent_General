# TAgent 上游特性对齐路线图（v0.13.4 基线）

> **状态**：活跃 — 2026-06-30 对照 `F:\Proma` 扫描校准  
> **日期**：2026-06-24（初版）/ 2026-06-30（基线升至 v0.13.4）  
> **基线**：本地 `@tagent/electron@1.3.1` → 上游 `@proma/electron@0.13.4`（SDK 0.3.185）  
> **借鉴清单**：[`2026-06-24-proma-upstream-borrow-list.md`](2026-06-24-proma-upstream-borrow-list.md)（逐项状态，优先读此）  
> **适用范围**：TAgent Desktop（`apps/electron`）  
> **关联文档**：[`2026-06-16-upstream-upgrade-plan.md`](2026-06-16-upstream-upgrade-plan.md)（v0.10.34 基线旧规划）、[`2026-06-16-upstream-upgrade-issues.md`](2026-06-16-upstream-upgrade-issues.md)（Issue A~E）、[`2026-06-24-p0-stability-patches.md`](2026-06-24-p0-stability-patches.md)（P0 PR 模板）、[`2026-06-24-automation-design.md`](2026-06-24-automation-design.md)（Automation 设计）、[`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md)（协作子会话设计）

---

## 0. 新 Agent 接手必读（Handoff）

**本文要做的事**：基于对上游 Proma 仓库 `2026-06-23` 版本的全面 commit / release-notes 调研，输出一份从本地 `TAgent_General` 视角出发、按 P0~P3 优先级排序的**总特性需求清单**，并给出 5 阶段实施路线。

**核心结论（2026-06-30 更新）**：Automation M1–M3、SDK 主包 0.3.185、once/maxRuns 已对齐。**仍缺三块**：(1) **#913 adapter 终止语义**（每会话 2s drain）、(2) **协作子会话**（0%）、(3) **Bridge 自愈 + 后台任务唤醒**。v0.13.4 仅新增 **#915 双界面** 与 **#920 侧栏排序**（后者 TAgent 已有等价实现）。

**不要做的事**：

- 不要无差别 cherry-pick 上游 PR（每个 PR 都要经过品牌约束 / 模式隔离 / 本地优先三重检查）。
- 不要直接复制上游 `@proma/*` 包名引用，必须保留 `@tagent/*` 作用域。
- 不要破坏 `~/.tagent/` 数据目录（不能强制迁移到 `~/.proma`）。

---

## 1. 背景

### 1.1 调研范围

| 维度 | 数值 |
|---|---|
| 上游最近 commit | 2026-06-24（仍在活跃更新） |
| 上游 Stars / Fork | 1330★ / 181 fork |
| 上游总 commit 数 | 1000+ |
| 本地落后 commit 数 | 约 80（2026-06-18 → 2026-06-24） |
| 上游发布版本 | v0.7.1 → v0.13.3 共 18 个版本 |
| 本地文件数（electron/src） | 480 |
| 上游文件数（electron/src） | 421 |
| 本地主进程 lib 数 | 127 |
| 上游主进程 lib 数 | 119 |

### 1.2 本地已同步的部分（v0.10.34 基线以来已落地）

以下内容**已经合并到本地** `TAgent_General`，无需重复实现：

- ✅ Tier 1+2 品牌清理（全清 "proma" 标识 → "tagent"）
- ✅ Ask 档位统一 Composer（替代 Chat 模式）
- ✅ Context Usage Breakdown（SDK `getContextUsage` 接入）
- ✅ 双层压缩（`compact_session` + 客户端压缩）
- ✅ `/btw` 旁注面板（浮动右栏 + 上下文共享 + fork to session）
- ✅ WPS 协作 Bridge MVP（文本链路）
- ✅ Right Panel Anchor Animation（2026-06-18 最新）
- ✅ Context Island 视觉（右上岛 + scale 动画）
- ✅ TA MCP Server 一键安装 + Agent 拦截
- ✅ 飞书 / 钉钉 / 微信 / WPS 四大 Bridge 主链路
- ✅ ESLint 9 升级 + 305 单元测试

### 1.3 本地缺失 / 未完全对齐的关键能力（2026-06-30）

| 能力 | 严重程度 | TAgent | 上游 Proma v0.13.4 |
| --- | --- | --- | --- |
| #913 adapter iterator 终止 | 🔴 严重 | ❌ `promptSuggestions: true` | ✅ #913 已修 |
| 协作子会话 / Agent 委派 | 🔴 严重 | 0% | ✅ collaboration-tools |
| Automation Agent MCP 工具 | 🟠 高 | M1–M3 ✅，无 agent-tools | ✅ |
| Bridge 长连接自愈 | 🟠 高 | 仅 start/stop | ✅ recover + 健康检查 |
| 后台任务唤醒 idle Agent | 🟠 高 | ❌ | ✅ Stop hook |
| classic/modern 双界面 (#915) | 🟡 中 | ❌ | ✅ v0.13.4 |
| 预览 Tab/分屏偏好 | 🟡 中 | 部分 | ✅ |
| 1M 上下文 + qwen-anthropic | 🟡 中 | ~60% | ✅ |
| Monitor / Nowledge Mem | 🟡 中 | ❌ | ✅ |
| **PostToolUse auto-check 钩子** | — | ✅ **TAgent 独有** | ❌ |

---

## 2. 总特性需求清单（37 大类 / ~130 项）

> 全部特性分四档：**P0 必做** / **P1 强烈建议** / **P2 体验增强** / **P3 锦上添花**  
> 标识：**🆕** 上游新增能力 / **🔧** 上游修复 / **🎨** 视觉 / **📦** 已有但需更新版本

### 2.1 🔴 P0 — 稳定性 / 基础能力

#### 2.1.1 Claude Agent SDK 升级 `0.3.153 → 0.3.185` 🆕

- 消除每会话 2 秒 drain timeout（`Query.cleanup()` iterator 终止语义）
- 适配 `iterator.return()` → `cleanup()` 链路
- 关闭 `promptSuggestions` 配置项
- **影响文件**：`apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`
- **关联 PR 模板**：[`2026-06-24-p0-stability-patches.md`](2026-06-24-p0-stability-patches.md)

#### 2.1.2 并发会话同步写风暴修复（#910）🔧

- 修复 `existingSdkSessionId` / `capturedSdkSessionId` 误用
- 仅在 `session_id` 真正变化时持久化一次
- 缓存 `capturedSdkSessionId` 作为对比基准
- 长会话越用越卡的多 Agent 并发场景

#### 2.1.3 长任务断连后保留 `sdkSessionId`（#903）🔧

- 终止分支不再清除 `sdkSessionId`
- 扩展 `TRANSIENT_NETWORK_PATTERN`：`ECONNABORTED` / `connection closed` / `AbortError` / `timed out`
- 冷启动兜底升级：强指令要求先读取完整 JSONL 历史
- 避免 ~50K token `buildContextPrompt` 重传

#### 2.1.4 输入框 / 推荐消息 bug 修复 🔧

- 推荐条发送后保留输入栏草稿（#904）
- 有序列表 Shift+Enter 续项（#908）
- 附件 chip 点击预览（#906）
- 移除 auto preview toggle（#909）
- 预览面板切换保留 AskUserQuestion 草稿（#912）
- 轻量主题代码选区对比度优化（#911）

---

### 2.2 🟠 P1 — 自动化系统（本地完全缺失）

> **背景**：上游 v0.12.0 起的核心特性，对应 Proma 「proactive Agent」愿景。本地 `docs/plans/2026-06-16-upstream-upgrade-issues.md` Issue B/C/D/E 已规划但未实现。  
> **完整设计**：[`2026-06-24-automation-design.md`](2026-06-24-automation-design.md)

#### 2.2.1 Automation 调度内核 🆕

- `main/lib/automation-scheduler.ts`（30s tick 后台调度）
- `main/lib/automation-manager.ts`（CRUD + 启停 + 手动运行）
- `main/lib/automation-notification-service.ts`
- `main/lib/automation-notification-format.ts`
- 失败自动退避 + 连续失败自动暂停（可配置阈值）
- 运行历史 `lastRun` / `nextRun` / `failureCount` / `lastError`
- 持久化：`~/.tagent[-dev]/automations.json`

#### 2.2.2 Automation UI 🆕

- `renderer/components/automation/AutomationFormView.tsx`
- `renderer/components/automation/AutomationsListView.tsx`
- 全屏管理视图，按「启用中 / 已暂停」分组
- hover 浮出「立即运行一次 / 删除」
- IPC 通道全套：`AUTOMATION_LIST` / `AUTOMATION_CREATE` / `AUTOMATION_UPDATE` / `AUTOMATION_DELETE` / `AUTOMATION_RUN_NOW` / `AUTOMATION_TOGGLE`

#### 2.2.3 调度能力扩展 🆕

- `interval` 固定间隔（分钟）
- `daily` 每天定点
- `weekly` 每周定点
- `monthly` 每月定点（短月策略：2/4/6/9/11 月落月末）
- `once` 一次性调度（通过 `scheduledAt` 绝对时间戳，#914）
- `maxRuns` 运行次数上限（成功 + 失败累计，达到上限自动停用，#914）
- UI 适配：「仅运行一次」下拉、运行次数上限输入、「已完成」分组

#### 2.2.4 自然语言创建定时任务 🆕

- Agent 通过结构化输出协议自动创建
- 意图识别三级 fallback：DeepSeek + Anthropic + 关键词启发式
- MCP 工具暴露给 Agent

#### 2.2.5 上下文安全阀（自动化场景）🆕

- 调度执行前检查会话上下文占用率
- 默认阈值 70%（可配置）
- 超阈值自动新建子会话，记录切换原因
- 不影响普通手动会话策略

#### 2.2.6 自动化结果通知 🆕

- 飞书通知（飞书 Bridge 自愈 #751）
- Markdown 富文本编辑器（#758）
- 编辑器升级为 Markdown 富文本，编辑时可看渲染效果

---

### 2.3 🟠 P1 — 协作子会话 / 后台 Runner

> **完整设计**：[`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md)

#### 2.3.1 Collaboration 子会话体系 🆕

- `main/lib/agent-collaboration-tools.ts`（MCP 工具）
- `main/lib/agent-collaboration-utils.ts`（共享上下文处理）
- `main/lib/agent-headless-runner-registry.ts`（后台 runner 注册）
- blocked event bubbling、continue delegation、GitBranch icon（#901）
- 自动任务会话归类到专属虚拟项目组（#898）
- 后台任务 / Monitor 完成时自动唤醒 idle Agent（#745）

#### 2.3.2 Monitor 长任务监听器 🆕

- 主进程 Monitor 服务
- 与协作子会话打通：Monitor 完成 → 唤醒父会话
- 用户可视化查看运行中的长任务
- 与 CI / Git / Webhook 集成（可选）

---

### 2.4 🟠 P1 — 上下文管理增强

#### 2.4.1 1M 上下文能力统一 🆕

- `inferContextWindow` 抽到 `packages/shared/src/utils/context-window.ts` 单一事实源
- 支持 `claude-fable-5` / `MiniMax-M3` / `Opus 4.8` / `qwen-anthropic` / `glm-5-2-1m` 多款 1M 模型
- 设置页 / 连通性测试 / 上下文进度显示统一口径
- 关键映射逻辑单测覆盖
- **对应 Issue A**

#### 2.4.2 上下文占用显示精度 🔧

- OpenAI 兼容渠道上下文占用量重复计数修复（#807）
- 上下文占用量显示不准 + 时效提示（45d430a）

---

### 2.5 🟡 P2 — UI / 视觉

#### 2.5.1 界面风格扩展 🎨

- classic / modern 双界面风格（#915，最新）
- 主面板与右侧面板阴影统一（#899）
- 侧边栏默认宽度扩到 300px
- 移除主面板阴影 + CRT 终端主题细节优化（#859）

#### 2.5.2 主题与样式 🎨

- Terminal 主题下 Read 行号叠影修复（#860）
- 移除 backdrop-blur 修复 UI jank（#873）
- 移除文件面板打开按钮的呼吸灯提示（#858）
- 侧边栏滚动区域改用全局细滚动条

#### 2.5.3 侧边栏 / 列表 🎨

- 当前选中会话强制在项目折叠列表中显示（#768）
- 三点菜单工作区重命名（#742）
- Agent 项目下选中的会话项补上背景色
- 三点菜单关闭动画期间浮层漂移修复
- Ctrl+Tab 切换器 badge 加图标（#663）

#### 2.5.4 预览分屏偏好 🎨

- 标签页 / 分屏模式偏好持久化
- 原子化存储 `getOnInit` 修复重启后偏好失效（#857）
- 在 session tab 中预览文件（#646）
- vs-main diff 切换
- **对应 Issue E**

---

### 2.6 🟡 P2 — 模型 / 渠道扩展

#### 2.6.1 新增 1M 上下文模型 🆕

- `claude-fable-5` 1M 上下文
- `MiniMax-M3` 1M 上下文（`d4d4025`）
- `Opus 4.8` 1M 上下文（#624）
- `qwen-anthropic` 渠道（Qwen3.7 1M 上下文，#872）
- `glm-5-2-1m` 1M 上下文（#797）
- `kimi-coding` 自定义 UA（#675）

#### 2.6.2 渠道协议扩展 🆕

- 通用 `anthropic-compatible` 第三方协议（#670）
- Anthropic 协议供应商 URL 规范化逻辑收敛
- 恢复渠道 Logo 的 URL 品牌识别（32b273e）

#### 2.6.3 Claude Agent SDK 升级 📦

- `Upgrade Claude Agent SDK`（#884）
- 适配 `getContextUsage` 上下文 API（已在本地 `f1470412` 接入）

---

### 2.7 🟡 P2 — Markdown / 编辑器 / 渲染

#### 2.7.1 渲染能力 🆕

- LaTeX `\(...\)` / `\[...\]` 原生分隔符（#765）
- Markdown frontmatter 元数据块渲染（#868）
- Agent think tag 渲染（#638）
- Mermaid 规范化 CRLF 行尾

#### 2.7.2 聊天输入体验 🔧

- 模型选择器移至输入框工具栏最左侧（#887）
- 斜杠命令补全弹出后按 Enter 误发送修复（#876）
- Shift+Enter 恢复硬换行（#875）
- chat attachment cleanup on unmount（#883）

#### 2.7.3 Mention 提及能力 🆕

- `/`、`#`、`&` 补全面板标题栏与快捷键提示（#900）
- 修复文件选择器不消失
- 非空格前缀无法触发 mention 修复

#### 2.7.4 附件 / 媒体 🆕

- 悬浮岛 UI 统一
- Canvas 图片编辑（裁剪 / 旋转 / 矩形 / 画笔）
- Chat / Agent 全覆盖（#831）
- 编辑预览高分屏模糊修复（#890）

---

### 2.8 🟡 P2 — 飞书 / Bridge / 远程协作

#### 2.8.1 飞书 Bridge 增强 🆕

- 引导长内容优先用飞书文档交付（#631）
- 2 人群免 @ 续聊（user_count 判定，#669）
- Bridge 自愈 / 长连接自愈（#751）
- 飞书消息 `card-renderer-v2` 升级
- `feishu-presence.ts` 飞书在线状态（本地已有）

#### 2.8.2 Chat 侧边栏对齐 Agent 🎨

- Chat 侧边栏对齐 Agent 布局（#766）
- Chat 流式 MessageHeader 稳定化（#655）
- Chat 文件面板"当前会话"背景色补齐

---

### 2.9 🟡 P2 — 体验与杂项

#### 2.9.1 Session / Tab 增强 🆕

- 删除 / 归档 Agent 会话时释放重型 per-session 状态（#636）
- 后台任务完成时自动唤醒 idle Agent（#745）
- 工作会话状态跨重启持久化（#651）
- 启动时清理过期的附加目录（#652）
- 关闭 tab 时正确清除 completedButUnconfirmed 持久化标记

#### 2.9.2 Skills 系统 🆕

- 设置页 built-in 分组 + PROMA 标签（#723）
- `proma-built-in` 前缀避免碰撞（#764）
- SKILL.md 重复 frontmatter 修复（#892）
- `parseSkillFrontmatter` BOM 兼容（#783）
- `config-paths.ts` 的 `parseSkillVersion` 增加 BOM 处理

#### 2.9.3 Nowledge Mem 本地记忆卡片 🆕

- Chat 工具新增 Nowledge Mem 本地记忆卡片（#897）
- `builtin-mcp/memory.ts` 上游有，本地缺失

#### 2.9.4 教程 / 引导 🆕

- 教程加载失败时显示错误状态而非永久"加载中"（#799）
- 切换到 tutorial-v2.md 新标签预览（#785）

#### 2.9.5 macOS 专属 🔧

- `app.dock.show()` 确保启动时 Dock 图标可见（#aa458e2）
- Dock 指示点 + 自定义图标加载修复（#54c8473）

#### 2.9.6 Windows 专属 🔧

- 修复 Windows 长路径下 Edit / Write 工具行 +N/-M 统计不显示（#677）
- 修复 Windows 下文件改动面板同一文件重复显示
- 修复 WSL 中文编码乱码（#657、#668）
- 修复 Windows 下 gitroot 重复检测
- 关闭窗口最小化到托盘

#### 2.9.7 Worktree 多仓管理 🆕

- multi-repo worktree config 和 WorktreeSelector 升级（#650）
- Changes tab 支持 worktree + vs-main diff（#649）
- 修复 worktree 文件改动面板找不到 / 报错（#796）

#### 2.9.8 性能优化 🆕

- `git-diff` spawnSync 改异步 spawn，避免 IPC 阻塞（#1486a68）
- 移除 backdrop-blur 修复 UI jank（#873）

---

### 2.10 🟢 P3 — 锦上添花

#### 2.10.1 浮动 `/btw` 旁注面板（本地已实现）

- 浮动右栏、frosted glass、共享 20 轮上下文（本地已实现）
- 进一步可加：fork 到新 session（本地已实现）

#### 2.10.2 截图 / 图像灯箱 🆕

- image-lightbox 悬浮岛 + Canvas 编辑（#831）

#### 2.10.3 Release helper 🆕

- GitHub Release workflow 增强（#6）
- frozen bun lockfile（#12）
- Linux release metadata（#10、#11）

#### 2.10.4 代码搜索体验 🆕

- 复用 `SessionMiniMapPopover` 替代搜索弹窗自实现的预览卡片（#800）
- 修复会话引用大文件读取（#787）
- 上下文占用量显示精度（#793）

#### 2.10.5 教程与 onboarding 🆕

- 教程加载失败时显示错误状态而非永久"加载中"（#799）
- 切换到 tutorial-v2.md 新标签预览（#785）

---

## 3. 统计与分布

| 类别 | 大类数 | 项数 | 你的实现进度 |
|---|---|---|---|
| **P0 稳定性** | 2 | ~6 | **未做**（落后 6 天） |
| **P1 自动化系统** | 6 | ~20 | **完全缺失**（0%） |
| **P1 协作子会话** | 2 | ~5 | **完全缺失**（0%） |
| **P1 上下文管理** | 2 | ~5 | **部分有**（50%） |
| **P2 UI / 视觉** | 4 | ~25 | **部分有**（40%） |
| **P2 模型 / 渠道** | 3 | ~15 | **未做**（0%） |
| **P2 编辑器 / 渲染** | 4 | ~15 | **部分有**（30%） |
| **P2 飞书 / Bridge** | 2 | ~8 | **已有基础**（60%） |
| **P2 体验杂项** | 8 | ~25 | **零散有**（50%） |
| **P3 锦上添花** | 4 | ~6 | **基本有**（80%） |
| **合计** | **37** | **~130** | **约 35%** |

---

## 4. 五阶段实施路线图

### 阶段 1（第 1 周）：P0 稳定性

**目标**：消除稳定性缺口，对齐 SDK 0.3.185

**交付物**：

- Claude Agent SDK `0.3.153 → 0.3.185` 升级
- `claude-agent-adapter.ts` 适配 `Query.cleanup()` iterator 终止语义
- 合并 #910（写风暴修复）
- 合并 #903（断连保留 `sdkSessionId`）
- 合并 6 个 UI 输入 / 推荐 / 附件 bug 修复

**风险**：低（单文件改动 + 上游已验证）
**收益**：高（消除每会话 2s drain timeout + 长任务断连不丢上下文）

**详细 PR 模板**：[`2026-06-24-p0-stability-patches.md`](2026-06-24-p0-stability-patches.md)

---

### 阶段 2（第 2-3 周）：Automation 系统

**目标**：实现完整的定时任务系统，对应 Issue B/C/D/E

**交付物**：

- Automation 调度内核（30s tick + 持久化 + 失败退避）
- Automation 管理 UI（列表 + 编辑器 + Markdown 富文本）
- 调度类型：`interval` / `daily` / `weekly` / `monthly` / `once` + `maxRuns`
- 自然语言创建任务（DeepSeek + Anthropic + 关键词三级 fallback）
- 上下文安全阀（70% 阈值自动切新会话）
- 飞书通知集成

**风险**：中（持久化迁移、UI 跨模式隔离）
**收益**：高（解锁「proactive Agent」愿景，对应上游 v0.12.0 起的核心特性）

**详细设计**：[`2026-06-24-automation-design.md`](2026-06-24-automation-design.md)

---

### 阶段 3（第 4-5 周）：上下文 + 协作

**目标**：补齐上下文能力统一与协作子会话

**交付物**：

- `inferContextWindow` 抽到 `packages/shared`（对应 Issue A）
- 多款 1M 模型支持（`claude-fable-5` / `MiniMax-M3` / `Opus 4.8` / `qwen3.7` / `glm-5-2-1m`）
- Collaboration 子会话体系（MCP 工具 + 后台 Runner）
- Monitor 长任务监听
- Nowledge Mem 记忆卡片

**风险**：中（MCP 工具契约变更、后台 Runner 资源管理）
**收益**：高

**详细设计**：[`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md)

---

### 阶段 4（第 6-8 周）：UI / 模型 / 编辑器

**目标**：视觉一致性 + 模型扩展 + 编辑器增强

**交付物**：

- classic / modern 双界面风格（#915）
- 新增 1M 模型（5 款）
- `anthropic-compatible` 通用协议
- LaTeX 原生分隔符 + Markdown frontmatter + think tag 渲染
- 视觉一致性（阴影、滚动条、侧边栏宽度 300px）

**风险**：低（视觉相关改动，可渐进）
**收益**：中

---

### 阶段 5（持续）：体验打磨

**目标**：平台特定修复 + 长尾问题

**交付物**：

- Windows / macOS 平台特定修复
- 飞书 Bridge 自愈 / 文档交付引导
- Worktree 多仓管理
- SKILL.md BOM / frontmatter 健壮性
- GitHub Release helper 完善

**风险**：低
**收益**：低（按需）

---

## 5. 风险与应对

| 风险 | 应对 |
|---|---|
| 上游 PR 与 TAgent 双模式冲突 | 通用化前先看是否影响 TA 模式 / general 模式 |
| 持久化文件破坏已有数据 | 版本化索引；只追加迁移；失败时只读降级 |
| 自动化任务导致资源泄漏 | 后台 Runner 生命周期管理；超时与并发上限；退出清理 |
| 跨模式状态串线 | 明确 atom / service 命名空间；新增测试覆盖模式切换 |
| 后台调度静默失败 | 每次运行写入结构化历史；UI 暴露最近错误 |
| UI 大改影响现有交互 | 先功能后样式；新增功能默认保守开关 |

---

## 6. 关键决策记录

| 决策 | 选择 | 原因 |
|---|---|---|
| 是否直接 cherry-pick | ❌ 不直接 | 品牌约束 / 模式隔离 / 本地优先三重检查 |
| 是否保留 `@proma/*` 引用 | ❌ 全部改 `@tagent/*` | 本地品牌约束 |
| 是否迁移 `~/.proma` 数据 | ❌ 保留 `~/.tagent` | 本地优先存储 |
| 是否引入新数据库 | ❌ 全部 JSON / JSONL | CLAUDE.md 已规定 |
| Automation 是否影响 TA 模式 | ❌ 默认不影响 | 双模式隔离 |

详见 [`docs/decisions/0003-upstream-roadmap.md`](../decisions/0003-upstream-roadmap.md)（待写）。

---

## 7. PR 验收清单（每个特性都按此）

- [ ] 功能点与里程碑目标一致
- [ ] 已补测试且通过（`bun test`）
- [ ] 类型检查通过（`bun run typecheck`）
- [ ] 未破坏 general / ta 隔离
- [ ] 文档已更新（至少 `docs/PROGRESS.md`）
- [ ] 品牌一致（`@tagent/*` / `TAgent` / `~/.tagent`）
- [ ] 提供回滚说明（feature flag 或降级路径）
- [ ] 上游 PR 已记录到本文对应章节

---

## 8. 完成定义（Definition of Done）

满足以下条件视为本轮路线图完成：

- P0 + P1 全部落地并通过测试
- 至少完成 1 轮真实任务演练（自动化任务创建 → 执行 → 结果检查）
- 文档与代码状态一致
- 未引入跨模式回归问题
- 启动时间 / 内存占用无明显回退（< 10%）

---

## 9. 时间估算

| 阶段 | 工作量 | 风险 |
|---|---|---|
| 阶段 1 P0 稳定性 | 1-2 天 | 低 |
| 阶段 2 Automation | 5-7 天 | 中 |
| 阶段 3 协作 + 上下文 | 4-5 天 | 中 |
| 阶段 4 UI / 模型 | 5-7 天 | 低 |
| 阶段 5 体验打磨 | 持续 | 低 |
| **总计（核心 P0+P1）** | **10-14 天** | - |

---

## 10. 相关文档

- [`2026-06-05-tagent-fusion-design.md`](2026-06-05-tagent-fusion-design.md) — 主设计
- [`2026-06-16-upstream-upgrade-plan.md`](2026-06-16-upstream-upgrade-plan.md) — v0.10.34 基线旧规划
- [`2026-06-16-upstream-upgrade-issues.md`](2026-06-16-upstream-upgrade-issues.md) — Issue A~E
- [`2026-06-24-p0-stability-patches.md`](2026-06-24-p0-stability-patches.md) — P0 PR 模板
- [`2026-06-24-automation-design.md`](2026-06-24-automation-design.md) — Automation 设计
- [`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md) — 协作子会话设计
- 上游 release notes：https://github.com/proma-ai/Proma/tree/main/release-notes
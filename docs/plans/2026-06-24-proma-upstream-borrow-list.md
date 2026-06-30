# Proma v0.11.1 → v0.13.4 新增特性借鉴清单

> **状态**：参考清单，2026-06-30 对照 `F:\Proma` 全量扫描校准
> **日期**：2026-06-24（初版）/ 2026-06-30（校准）
> **背景**：TAgent fork 自 Proma v0.10.25。本文梳理 Proma v0.11.1 ~ v0.13.4 相对 TAgent 的缺口与已对齐项。
> **对比基准**：`F:\Proma` → `@proma/electron@0.13.4`，SDK `0.3.185`（扫描日 2026-06-30）
> **参考来源**：`F:/Proma/release-notes/v0.11.1.md` ~ `v0.13.3.md` + commit `f1e2eef1`（#915）、`e4ff27ca`（#920）
> **关联**：[`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md)、[`docs/PROGRESS.md`](../PROGRESS.md)

---

## 0. 如何使用本文档

每个推进到的模块时回来查：

- **已落地**：TAgent 已有同等能力，跳过
- **部分对齐**：有实现但与 Proma 不等价，需 diff 确认
- **候选借鉴**：TAgent 缺，值得新增
- **TAgent 独有**：Proma 无，保留不删
- **不适用**：架构/需求不同，不做

成本估计：低 = 半天内；中 = 1–3 天；高 = 一周以上。

---

## 1. 已落地（不用再做）

| 特性 | 来源 | TAgent 状态 |
| --- | --- | --- |
| Automation 调度内核 M1–M3 | v0.12.0 ~ v0.13.3 | ✅ `automation-scheduler` / `automation-manager` / 通知（PR #15） |
| once + maxRuns 调度 | v0.13.3 #914 | ✅ 类型 + UI + `automation-schedule.ts` |
| monthly 调度 | v0.12.23 | ✅ |
| SDK 0.3.185 主包升级 | v0.13.3 | ✅ `apps/electron/package.json` |
| 上游 JSON 解析失败自动重试 | v0.12.26 | ✅ `MALFORMED_RESPONSE_PATTERN` in `error-patterns.ts` |
| SKILL.md BOM 处理 | v0.12.23 | ✅ `config-paths.ts` / `agent-workspace-manager.ts` |
| LaTeX `\(...\)` / `\[...\]` 渲染 | v0.12.0 | ✅ `packages/shared/src/utils/markdown-latex.ts` |
| Context Usage 分项面板 P0–P2 | v0.12.x | ✅ 见 context-usage-breakdown-design |
| TA 模式 / 资产库 / 审核 / 流水线 | TAgent 独有 | ✅ |
| 记忆 5 层 + 自进化 | TAgent 独有 | ✅ |
| 飞书/钉钉/微信/WPS Bridge | v0.10.x 起 | ✅ 文本链路 |
| 插件市场 / 已安装页 | v0.12.26 思路 | ✅ 2026-06-27 重构 |
| kscc 内网渠道 | TAgent 独有 | ✅ |
| 草稿模式 + Chat 清理 | TAgent 独有 | ✅ |
| 侧栏 #920 会话排序 | v0.13.4 | ✅ `LeftSidebar` `currentSession` 仅在超窗时补入 |
| **PostToolUse auto-check 钩子** | **TAgent 独有** | ✅ `hooks/post-tool-use.ts` + `AgentBehaviorSettings`（Proma 无） |
| **Superpowers 14 skill** | **TAgent 独有** | ✅ 2026-06-30 合入 |

---

## 2. 部分对齐 / 待确认（P0 稳定性，优先 diff）

### 2.0 #913 SDK iterator 终止语义 — ❌ 未对齐（最高优先）

**来源**：v0.13.3 #913

**问题**：SDK 0.3.185 把会话清理挪进 `Query.cleanup()`，只在 `iterator.return()` 时触发。TAgent adapter 仍 `promptSuggestions: true`，且 terminal result 后未主动 `break`，orchestrator 只能靠 **2s drain timeout** 兜底——每会话白白多等 2 秒。

**Proma 做法**：
1. `promptSuggestions: false`
2. 收到 terminal result 后 `break` for-await → 触发 `iterator.return()` → `cleanup()`

**TAgent 落地**：`apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`（对照 `F:\Proma` 同文件）

**成本**：低（半天） | **风险**：低

---

### 2.1 #910 并发会话同步写风暴 — ⚠️ 待确认

**来源**：v0.13.3 #910

**问题**：`onSessionId` 每条 SDK 消息都回调，若守卫失效会每条消息全量读写 `agent-sessions.json`，多会话并发时主进程卡死。

**Proma 做法**：用 **`capturedSdkSessionId`**（非 stale 的 `existingSdkSessionId`）比较，仅真正变化时 `updateAgentSessionMeta`。

**TAgent 现状**：用 `existingSdkSessionId` 比较并在写入后同步更新——新会话场景可能已规避，但未与 Proma 逐行对齐。

**成本**：低 | **风险**：低

---

### 2.2 #903 长任务断连保留 sdkSessionId — ⚠️ 待确认

**来源**：v0.13.3 #903

**问题**：网络断连时若清除 `sdkSessionId`，下一轮只能 ~50K 冷启动，丢失完整 JSONL 历史。

**Proma 做法**：终止分支默认不清 session；扩展 `TRANSIENT_NETWORK_PATTERN`；仅 thinking-signature 跨模型不兼容时主动清除。

**TAgent 落地**：`agent-orchestrator.ts` 终止分支 + `error-patterns.ts`

**成本**：低 | **风险**：低

---

### 2.3 SDK 平台 optional 子包版本 — ❌

**问题**：主包 `0.3.185`，但 `@anthropic-ai/claude-agent-sdk-win32-x64` 等仍 `0.3.153`。

**成本**：低（改 package.json + lock） | **风险**：低

---

### 2.4 Context Usage 显示精度 — 待评估

**来源**：v0.12.23

**问题**：OpenAI 兼容渠道 `prompt_tokens` 含 cache 时可能双重计数；`result.usage` 是累计值非当前上下文；GLM 等无流式 usage 渠道需 result 兜底。

**TAgent 落地**：`context-usage-cache.ts`、`useGlobalAgentListeners.ts` 对照 Proma

**成本**：低–中 | **风险**：低

---

## 3. 候选借鉴：核心能力（中等成本）

### 3.1 协作子会话 / Agent 委派 — ❌ 0%

**来源**：v0.12.x #888、#901

**做什么**：主 Agent 可通过内置 MCP 工具创建**子会话**（委派），在后台跑子任务，完成后把结果回灌父会话。支持 blocked 事件冒泡、继续委派、GitBranch 图标标识。

**Proma 关键文件**（`F:\Proma`）：
- `agent-collaboration-tools.ts`（~920 行）
- `agent-collaboration-utils.ts`
- `agent-headless-runner-registry.ts`

**TAgent**：仅有设计文档 [`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md)，代码 0%。

**成本**：高（1–2 周） | **风险**：中 | **价值**：极高

---

### 3.2 Automation M4 — 部分（M1–M3 ✅）

**来源**：v0.12.0 ~ v0.13.3

**已做**：30s tick 调度、daily/reuse 会话、失败退避、管理 UI、飞书通知、once/maxRuns/monthly。

**仍缺**：

| 子项 | 说明 |
| --- | --- |
| `automation-agent-tools.ts` | Agent 对话内 list/create/update/delete 定时任务的 MCP 工具 |
| 自然语言创建 | 「每 5 分钟检查 PR」→ 自动建 Automation |
| custom cron | 自定义 cron 表达式 |
| TipTap 富文本编辑器 | 任务 prompt 编辑器升级 |

**参考**：`F:\Proma/apps/electron/src/main/lib/automation-agent-tools.ts`

**成本**：中（3–5 天） | **依赖**：M1–M3 已完成

---

### 3.3 后台任务完成唤醒 idle Agent — ❌

**来源**：v0.12.0

**做什么**：Agent 用 `run_in_background` 跑 shell 任务时，主轮次已结束；任务完成后应**自动唤醒** Agent 继续处理结果，无需用户再发消息。底层靠 SDK Stop hook + headless runner 保持通道。

**成本**：中（1–2 天） | **依赖**：3.1 headless runner 或独立实现

---

### 3.4 Bridge 长连接自愈 — ❌

**来源**：v0.12.0

**做什么**：飞书/钉钉/微信 Bridge 在息屏、解锁、网络抖动后可能僵死。Proma `bridge-registry.ts` 在 `powerMonitor` unlock / resume 时 `recoverAllBridges()`，并定时健康检查。

**TAgent 现状**：`bridge-registry.ts` 仅 `startAllBridges` / `stopAllBridges`，无 recover。

**成本**：中（1–2 天） | **价值**：高（远程连通是 TAgent 核心）

---

### 3.5 Issue A — 1M 上下文统一 — ~60%

**做什么**：同一模型在设置页、连通性测试、Context 圆环显示一致的窗口大小；支持多款 1M 模型。

**TAgent**：`packages/shared/src/utils/context-window.ts` 已有；orchestrator 内仍有重复 `supports1MContext`；缺 `qwen-anthropic` 等渠道。

**成本**：中 | **关联**：[`2026-06-16-upstream-upgrade-issues.md`](2026-06-16-upstream-upgrade-issues.md) Issue A

---

### 3.6 定时任务跨运行记忆 — 未做

**来源**：v0.12.23

**做什么**：引导 Agent 在定时任务 prompt 里维护 `.context/automation/<slug>/notes.md`，跨次运行积累状态。

**成本**：低（skill + 路径约定） | **依赖**：3.2

---

## 4. 候选借鉴：UI / 体验

### 4.1 #915 classic / modern 双界面 — ❌（v0.13.4 新增）

**做什么**：外观设置可选两种界面风格——**classic**（偏传统侧栏/Tab 密度）与 **modern**（当前默认玻璃态）。通过 `interfaceVariantAtom` + `data-interface-variant` CSS 分叉，影响 TabBar、侧栏、右栏、ModeSwitcher 等。

**Proma 涉及**：`theme.ts`、`AppearanceSettings.tsx`、`globals.css`（+138 行）、17 文件。

**成本**：中（2–3 天） | **风险**：中（全局 CSS）

---

### 4.2 预览侧边分屏偏好 — 部分

**做什么**：用户可选预览打开方式——**新 Tab** 或 **右侧分屏**；消息内文件路径 chip 也走同一偏好。

**Proma**：`previewModePreferenceAtom` + `useOpenPreview` 统一路由。

**TAgent**：有 `previewSplitRatioAtom`，无 Tab/分屏偏好与统一 opener。

**成本**：中（2–3 天）

---

### 4.3 qwen-anthropic 渠道 — ❌

**做什么**：通义千问 DashScope Anthropic 兼容端点，支持 Qwen3.7 1M 上下文。

**成本**：低–中（provider 类型 + ChannelForm + adapter 路由）

---

### 4.4 Nowledge Mem 记忆卡片 — ❌

**做什么**：设置页引导用户安装 Nowledge Mem MCP，本地记忆卡片与 Chat 工具集成。

**成本**：低–中 | **价值**：中（可选）

---

### 4.5 外部 MCP type 自动推断 — 待核对

**来源**：v0.12.23

**做什么**：`mcp.json` 无 `type` 时按 `command`→stdio、`url`→http 推断，避免静默跳过。

**成本**：低

---

### 4.6 工作区重命名 + 删除二次确认 — 待核对

**成本**：低 | **价值**：中

---

### 4.7 v0.13.3 输入/预览小修 — 待评估

| PR | 做什么 | TAgent |
| --- | --- | --- |
| #904 | 点推荐条发送后保留输入框草稿 | 待评估 |
| #908 | 有序列表 Shift+Enter 续项 | 待评估 |
| #906 | 已发送附件 chip 点击预览 | 待评估 |
| #909 | 移除 auto preview toggle | 待评估 |
| #911 | 浅色主题代码选区对比度 | 待评估 |
| #912 | 预览切换保留 AskUserQuestion 草稿 | 待评估 |

TAgent 输入组件结构已与 Proma 分叉，需逐项手动验证是否已有等价行为。

---

## 5. 不适用（TAgent 架构不同，不做）

| 特性 | 不做原因 |
| --- | --- |
| Chat 侧边栏对齐 Agent | TAgent 已退役 Chat 主路径 |
| 「旧屏微光」CRT 终端主题 | TAgent 自有主题体系 |
| Proma 深色主题精修（远山暮霭等） | 同上 |
| 侧边栏视觉权重 v0.11.1 方案 | TAgent 手风琴布局已分叉 |

---

## 6. 优先级建议（2026-06-30）

### 第一梯队 — P0 稳定性

1. **§2.0 #913 adapter** — 消除每会话 2s，单文件
2. **§2.1 #910 / §2.2 #903** — orchestrator diff 确认
3. **§2.3 SDK 平台子包** — package.json 对齐

### 第二梯队 — 核心能力

4. **§3.1 协作子会话** — 最大功能缺口
5. **§3.4 Bridge 自愈** — 远程连通稳定性
6. **§3.3 后台任务唤醒** — proactive 基础
7. **§3.2 Automation M4** — MCP 工具 + NL 创建

### 第三梯队 — 体验 / 渠道

8. **§3.5 Issue A** — 1M 上下文 + qwen-anthropic
9. **§4.1 #915 双界面**
10. **§4.2 预览分屏偏好**
11. **§2.4 Context Usage 精度**

### 第四梯队 — 视情况

12. §4.4 Nowledge Mem、§4.6 项目重命名、§4.7 小修、§4.3 全局视觉（高成本，单独评估）

---

## 7. 参考文件索引

### F:\Proma 实现位置

```
F:/Proma/apps/electron/src/main/lib/
├── adapters/claude-agent-adapter.ts   # #913
├── agent-orchestrator.ts              # #910 #903
├── agent-collaboration-tools.ts       # 协作委派（TAgent 无）
├── agent-collaboration-utils.ts
├── agent-headless-runner-registry.ts
├── automation-scheduler.ts
├── automation-manager.ts
├── automation-agent-tools.ts          # M4（TAgent 无）
├── bridge-registry.ts                 # 自愈（TAgent 无 recover）
└── automation-notification-*.ts

F:/Proma/apps/electron/src/renderer/atoms/theme.ts          # #915 interfaceVariant
F:/Proma/apps/electron/src/renderer/atoms/preview-atoms.ts  # previewModePreference
```

### Release notes

```
F:/Proma/release-notes/v0.12.0.md
F:/Proma/release-notes/v0.12.23.md
F:/Proma/release-notes/v0.12.26.md
F:/Proma/release-notes/v0.13.3.md
```

### TAgent 关联文档

- [`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md)
- [`2026-06-24-p0-stability-patches.md`](2026-06-24-p0-stability-patches.md)
- [`2026-06-24-collaboration-design.md`](2026-06-24-collaboration-design.md)
- [`2026-06-24-automation-design.md`](2026-06-24-automation-design.md)
- [`2026-06-29-agent-hooks-design.md`](2026-06-29-agent-hooks-design.md)（TAgent 独有）
- [`docs/PROGRESS.md`](../PROGRESS.md)

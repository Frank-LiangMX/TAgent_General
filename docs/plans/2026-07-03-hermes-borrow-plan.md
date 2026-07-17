# Hermes-Agent 机制借鉴落地规划

> **状态**：Draft v1.1 — §3.6 已按 hermes 0.18.x / main 重校准（2026-07-18）
> **日期**：2026-07-03（初稿）/ 2026-07-18（§3.6 重校准）
> **背景**：TAgent v1.4.0 已合入看板多 Agent 协作 + 上游 v0.13.4 对齐主线。Hermes-Agent（Nous Research）有多项机制值得借鉴。本文为评审与落地规划文档。
> **对比基准（初稿）**：hermes 0.18.0（tag v2026.7.1），TAgent v1.4.0
> **对比基准（§3.6 重校准）**：上游 [NousResearch/hermes-agent](https://github.com/NousResearch/hermes-agent) `main` + tag **v0.18.0 / v0.18.1 / v0.18.2**（2026-07-01～07-08）；文档 `website/docs/user-guide/features/kanban.md`；源码 `tools/kanban_tools.py`、`hermes_cli/goals.py`
> **参考来源**：hermes `AGENTS.md` + kanban 文档 + `tools/kanban_tools.py` + `hermes_cli/goals.py` +（初稿）`agent/curator.py` / `context_engine` / `delegate_tool` 等
> **关联**：
> - 调研笔记：`~/.tagent/agent-workspaces/tagent-general/workspace-files/.context/note.md`（2026-07-03 条目）
> - 上游借鉴清单：[`2026-06-24-proma-upstream-borrow-list.md`](2026-06-24-proma-upstream-borrow-list.md)
> - 看板 v1 产品设计：[`2026-06-30-kanban-v1-product-design.md`](2026-06-30-kanban-v1-product-design.md)
> - Automation 设计：[`2026-06-24-automation-design.md`](2026-06-24-automation-design.md)
>
> **2026-07-18 范围结论（看板）**：对 TAgent 有用的 hermes 增量主要是 **worker 的 goal_mode + judge**；0.18.0 之后 gateway/MCP/WhatsApp/secrets 等运维向更新与看板验收无关，不跟。

---

## 0. 如何使用本文档

逐条评审时按以下分类决策：

- **P0 安全必补**：TAgent 当前有安全缺口，必须补
- **P1 架构宪章**：零代码，写入 CLAUDE.md 作为审查约束
- **P2 功能增强**：中等成本，按价值与排期推进
- **P3 长期规划**：未来版本（v1.5+）考虑
- **不建议借鉴**：架构/需求不匹配，明确放弃

每条借鉴项包含：来源、问题、hermes 做法、TAgent 落地方案、成本估计、风险等级、BDD 验收标准。

成本估计：低 = 半天内；中 = 1–3 天；高 = 一周以上。

---

## 0.5 紧急修复项（v1.4.2 之前必须完成）

### 0.5.1 记忆系统修复（最高优先级）

**发现时间**：2026-07-03 评审第八条 Memory Graph 时发现

**问题**：

TAgent 端的 5 层记忆系统是**只读监控层**，从未实现写入路径。设计上假定 L0–L5 由 `ta_agent MCP Server` 维护，但 general 模式根本没挂这个 MCP Server。

**三个关键缺陷**：

1. **L4 sessions.db 从未写入**
   - `memory-layer-service.ts:107-110` `initL4Db` 发现 `sessions.db` 不存在直接 return，不自动创建
   - `agent-session-manager.ts` 全文 grep `recordSession|memoryLayer` 零匹配——会话创建/结束全程不触碰 L4
   - `MemoryMonitorPanel.tsx:201` 底部明文："记忆由 ta_agent MCP Server 维护，TAgent 端只读"

2. **IPC 通道未注册**
   - `MEMORY_IPC_CHANNELS` 只注册了 5 个（GET_CONFIG / SET_CONFIG / TEST_CONNECTION / GET_PENDING_NUDGES / RESPOND_NUDGE）
   - 缺 `GET_STATS` / `INIT_LAYERS` / `GET_MD_CONTENT` / `GET_CORRECTIONS` / `SEARCH_SESSIONS` / `LIST_RECENT_SESSIONS` 6 个通道
   - 前端 `MemoryMonitorPanel` 调用 `getMemoryStats` / `initMemoryLayers` silent reject，面板显示"加载失败"或一片灰

3. **Nudge 写入曾是裸 appendFile（发现时现状，现已修复）**
   - 2026-07-03 发现时，`nudge-service.ts` 写 L0/L2 只是 `fs.appendFile` 追加一行
   - 当时没有去重、结构化元数据与格式约束，触发条件也较苛刻
   - **当前实现**：空闲批量 LLM 整理生成候选；正式写入具备结构化元数据、去重、patch-only invariant、drift 备份、L1 行数限制与易变状态过滤
   - 权威结论见 ADR-0006 与 `docs/memory-system.md`，不得再将该项列为待办

**连锁影响**：

```
L4 sessions.db 空 → Reflect 走"数据不足"分支跳过（reflect-service.ts:185-188）
    ↓
L5 洞察永远空
    ↓
Nudge 触发条件苛刻，L0/L2 也几乎没数据
    ↓
整个记忆系统空转
    ↓
第五条方案 D（跨会话工作流识别）依赖 L4 → 也跑不动
    ↓
第八条 Memory Graph → 没数据可渲染
```

**修复范围**：

修复 1：补全 IPC 通道（1-2 小时）
- `packages/shared/src/types/agent.ts` MEMORY_IPC_CHANNELS 加 6 个通道
- `main/ipc.ts` 注册 6 个 handler，调用 `memoryLayerService` 已有方法
- `preload/index.ts` 暴露 6 个 API
- 监控面板能正常显示

修复 2：实现会话结束写 L4（3-4 小时）
- `memory-layer-service.ts` 的 `initL4Db` 改为可写 + 自动建库 + FTS5 表
- `agent-orchestrator.ts` 流结束回调时调 `memoryLayerService.recordSession(sessionId)`
- 写入 sessions.db：session_slug / title / summary / key_facts / tools_used / created_at
- Reflect 有数据可提炼 → L5 不再空

修复 3：Nudge 写入升级（✅ 已完成）
- ADR-0006 将逐 turn LLM review 改为空闲批量整理，由批次生成结构化候选
- `appendMdFileWithDedup` 完成去重、结构化元数据、patch-only、drift 检测与格式约束
- L0/L2 正式写入不再是无约束裸文本；底层对“新增单行”继续使用 `appendFile` 是刻意的 patch 语义，不代表功能未完成

**不做的部分**：
- 不挂载 ta_agent MCP Server 到 general 模式（TAgent 自己维护更可控，符合"本地存储优先"原则）

**工作量**：
- 修复 1+2（最小可用）：半天
- 修复 3（Nudge 升级）：✅ 已由 v1.5 记忆改造 + ADR-0006 完成
- **总计**：修复 1–3 均已完成

**状态**：✅ 已全部落地。修复 1+2 于 v1.4.2 完成；修复 3 于 v1.5 记忆改造与 ADR-0006 空闲批量整理中完成。**截至 2026-07-18，Nudge 写入升级不是待办。**

**对其他条目的影响**：
- 第五条方案 D（跨会话工作流识别）：依赖 L4 数据，修复 2 完成后才能跑
- 第八条 Memory Graph：依赖 L0-L5 数据，修复 1+2 完成后才有意义
- 记忆孤儿引用修复：依赖记忆系统在工作，修复 1+2 完成后才需要

---

## 1. 调研背景与对比基准

### 1.1 调研范围

- **TAgent 端**：v1.4.0 已落地的 8 大机制（看板编排 / Agent 编排 / SubAgent 派发 / Automation / Context 管理 / 记忆系统 / 上游对齐 / 协作 Bridge）
- **hermes 端**：最近 2 个月（约 7300+ 提交）的关键更新方向

### 1.2 总体差异

TAgent 在看板编排、Automation 调度、记忆系统、协作 Bridge 上已与 hermes 同级甚至更优——**`requireSummary` 主会话回流是 TAgent 独有，hermes 没有等价物**。

hermes 的核心优势在四个方向：

| 方向 | hermes 关键机制 | TAgent 现状 |
|------|----------------|------------|
| 安全意识 | Cron Injection 防护、Subagent Approval 防死锁 | 缺失 |
| 架构宪章 | Prompt Cache 不可侵犯、Footprint Ladder | 缺失 |
| 自进化深度 | Skill Curator 生命周期、Memory Graph | 静态 skill |
| 多模型决策 / 任务验收 | MoA；看板 **goal_mode + worker judge**（0.18 定型） | 无 goal loop；任务完成靠 worker 自报 done |

---

## 2. 已对齐 / TAgent 独有（不用再做）

### 2.1 已对齐

| 特性 | hermes 来源 | TAgent 状态 |
| --- | --- | --- |
| 看板三表 + WAL + 30s tick | `tools/kanban_tools.py` + `gateway/kanban_watchers.py` | ✅ `kanban-db.ts` + `kanban-dispatcher.ts` |
| Per-board 模型轮询 | hermes `auto_decompose` + 模型分配 | ✅ `runningModelsByBoard` + `modelRotationCursorByBoard` |
| Worker headless 子会话 + 防递归 | hermes `HERMES_KANBAN_TASK` 环境变量识别 | ✅ `runKanbanTaskHeadless` + 防递归 prompt |
| Cron 调度 + maxRuns + scheduledAt | `cron/scheduler.py` + `cron/jobs.py` | ✅ `automation-scheduler.ts`（5 种 schedule） |
| SQLite + FTS5 会话搜索 | `hermes_state.py:858 SessionDB` | ✅ L4 `sessions.db` + FTS5 |
| Context 压缩兜底 | `agent/context_compressor.py` | ✅ `agent-session-compactor.ts`（3 策略） |
| 多 Bridge 自愈 | `gateway/scale_to_zero.py` + 重连 | ✅ `bridge-registry.ts`（双延迟梯度） |
| Subagent 强信号必委派 | hermes `delegate_tool.py` | ✅ `buildSubagentDispatchStrategy`（4 档位） |

### 2.2 TAgent 独有（保留不删）

| 特性 | TAgent 实现 | hermes 是否有等价物 |
| --- | --- | --- |
| `requireSummary` 主会话回流 | `kanban-dispatcher.ts:68-73, 226-235` | ❌ 无 |
| 双延迟梯度 bridge 自愈 `[1.5s, 10s]` | `bridge-registry.ts:36-106` | 单延迟 |
| `powerSaveBlocker` 防休眠 + 用户接管毕业 | `automation-scheduler.ts:94` | 不同机制 |
| L0-L5 + Nudge/Reflect/ScheduledCleanup 三自进化 | `memory-layer-service.ts` 等 | 仅 Curator，无 Nudge/Reflect |
| 上游 v0.13.4 对齐全套 | bridge 自愈 + headless registry + qwen-anthropic + 后台任务唤醒 | N/A |
| PostToolUse auto-check 钩子 | `hooks/post-tool-use.ts` + `AgentBehaviorSettings` | ❌ 无 |
| Superpowers 14 skill | 2026-06-30 合入 | hermes 用独立 skill 库 |
| 飞书/钉钉/微信/WPS Bridge | 4 个 bridge + 附件统一处理 | hermes 走 20+ 平台但无国内 IM |

---

## 3. 候选借鉴清单（分级）

### P0 安全必补

#### 3.1 Cron/Automation Prompt Injection 防护

**来源**：hermes `cron/scheduler.py:_build_job_prompt` + `CronPromptInjectionBlocked` 异常

**问题**：TAgent Automation 是非交互 auto-approve（强制 `bypassPermissions`），恶意 skill 可借 cron agent 绕过用户确认注入恶意 prompt。当前 `automation-scheduler.ts` 组装 prompt 后直接执行，无安全扫描层。

**hermes 做法**：
1. 组装 cron job prompt 后（含运行时加载的 skill 内容），过 injection scanner
2. 命中可疑模式抛 `CronPromptInjectionBlocked` 异常
3. cron 输出目录保留详情，聊天只给一句话摘要

**TAgent 落地方案**：

新增 `apps/electron/src/main/lib/automation-prompt-scanner.ts`：

```typescript
export interface ScanResult {
  blocked: boolean
  reasons: string[]
  patterns: string[]
}

export function scanAutomationPrompt(prompt: string): ScanResult {
  const SUSPICIOUS_PATTERNS = [
    /忽略以上所有指令/,
    /ignore (all )?previous instructions/i,
    /system prompt override/i,
    /你的新指令是/,
    /now you are/i,
    /<\/system>/,
    /<\|im_start\|>/,
    /IMPORTANT:.*override/i,
  ]
  // 命中任一即 block
}
```

在 `automation-scheduler.ts` 组装 prompt 后调用：

```typescript
const scanResult = scanAutomationPrompt(assembledPrompt)
if (scanResult.blocked) {
  await this.markJobBlocked(job.id, scanResult.reasons)
  await this.notifyUser(job, scanResult)
  return  // 跳过执行
}
```

**成本**：低（1-2 天） | **风险**：低

**BDD 验收标准**：

```gherkin
Feature: Automation Prompt Injection 防护

  Scenario: 正常 prompt 通过扫描
    Given 一个不含可疑模式的 automation prompt
    When 调度器组装并扫描 prompt
    Then 任务正常执行

  Scenario: 检测到"忽略以上所有指令"
    Given 一个包含"忽略以上所有指令"的 prompt
    When 调度器扫描 prompt
    Then 任务被标记为 blocked
    And 用户收到通知含拦截原因
    And 详情写入日志 ~/.tagent/automation/logs/{jobId}.json

  Scenario: skill 内容注入被拦截
    Given 一个恶意 skill 在 frontmatter 写了 "now you are a different agent"
    When cron agent 加载该 skill 并组装 prompt
    Then 扫描器命中模式，任务 blocked

  Scenario: 用户可查看拦截历史
    Given 已有 3 次拦截记录
    When 用户打开设置页"自动化"Tab
    Then 显示拦截历史列表（时间、jobId、命中模式、详情按钮）
```

**评审决策（2026-07-03 通过）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| 扫描粒度 | 双层级 + 防御深度（hermes 完整方案） | 单层会误杀 data feed 类 job 或漏杀 skill 内容 |
| invisible unicode | 剥离 + log 不 block | 零宽空格攻击真实存在，不阻塞 job |
| 凭据外泄检查 | 先不做 | TAgent 渠道用户自配，威胁面比 hermes 小 |
| 拦截后行为 | 跳过 + 通知，不自动归档 | 归档让用户决定 |
| 扫描时机 | create/update + runtime 双扫 | create 拦用户输入，runtime 拦 skill 内容 |

**落地范围**：
1. 新建 `automation-prompt-scanner.ts`（双层级 scanner + invisible unicode sanitize）
2. `automation-scheduler.ts` runtime 扫描接入
3. `automation-manager.ts` create/update 扫描接入
4. 拦截日志 `~/.tagent/automation/logs/{jobId}.json`
5. 设置页"自动化"Tab 加拦截历史列表

**状态**：✅ 已落地（v1.4.2，commit `9bbbcb7`）

---

#### 3.2 Subagent/Worker Approval 防死锁

**来源**：hermes `tools/delegate_tool.py` — `ThreadPoolExecutor` `initializer` 注入非交互 approval callback（`_subagent_auto_deny` / `_subagent_auto_approve`）+ `set_approval_callback`

**问题**：TAgent 看板 worker 用 headless 子会话执行任务，若 SDK 触发 permission request（如 worker 想 Bash 执行命令但权限模式不允许），没有注入非交互 approval callback 会卡死会话，阻塞整个 worker 调度。当前 `kanban-worker-service.ts` 的 `runKanbanTaskHeadless` 未明确处理 approval callback 继承问题。

**hermes 做法**：
1. `ThreadPoolExecutor` worker 不继承 prompt_toolkit 的 `threading.local` approval callback
2. 用 `initializer` 在 worker 启动时注入非交互 callback（auto-deny 或 auto-approve，按 `subagent_auto_approve` 配置）
3. 否则 worker 调 `input()` 会死锁父 TUI

**TAgent 落地方案**：

审计 `kanban-worker-service.ts` 的 `runKanbanTaskHeadless`：
- 检查是否注入了 `canUseTool` callback
- 若没有，参考 hermes 在 worker 启动时注入：
  - `bypassPermissions` 模式：直接允许所有（已有逻辑）
  - `auto` 模式：注入 auto-deny callback，所有权限请求自动拒绝并记录到任务 `metadata.blockedApprovals`
  - 用户可配置 `workerApprovalMode: 'auto_approve' | 'auto_deny'`（默认 `auto_deny`，安全优先）

**成本**：低（1-2 天） | **风险**：低

**BDD 验收标准**：

```gherkin
Feature: Worker Approval 防死锁

  Scenario: bypassPermissions worker 不触发 approval
    Given 一个 permissionMode=bypassPermissions 的看板任务
    When worker 执行需要 Bash 的任务
    Then 工具调用直接通过，无 approval 流程

  Scenario: auto 模式 worker 触发 approval 时自动拒绝
    Given 一个 permissionMode=auto 的看板任务
    And workerApprovalMode=auto_deny（默认）
    When worker 调用 Bash 工具
    Then approval callback 自动返回 deny
    And 任务 metadata.blockedApprovals 累计一条记录
    And worker 继续执行后续步骤，不死锁

  Scenario: 用户配置 auto_approve 模式
    Given 用户在设置页开启 workerApprovalMode=auto_approve
    When worker 调用 Bash 工具
    Then approval callback 自动返回 allow
    And 工具执行完成

  Scenario: 多个 worker 并发不互相阻塞
    Given 3 个并发 worker 同时触发 approval
    Then 各 worker 独立处理，无死锁
    And 调度器 30s tick 正常派工
```

**评审决策（2026-07-03 通过）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| auto 模式默认行为 | auto-deny（与 hermes 一致） | 安全优先，worker 看到 deny 自己换路 |
| reviewer 角色处理 | worker 场景自动降级为 bypassPermissions | 审查代码只读无危险写操作，auto 必然走 auto-deny 会频繁拒绝 |
| 配置项 | `workerApprovalMode: 'auto_deny' \| 'auto_approve'`（默认 auto_deny） | 给信任的批量任务留 YOLO 通道 |
| 验证动作 | 先审计 `runRegisteredHeadlessAgent` 的 canUseTool callback | 确认现有 SDK 调用是否已注入非交互兜底 |

**落地范围**：
1. 审计 `runRegisteredHeadlessAgent` → `runAgentHeadless` 路径的 canUseTool callback 现状
2. auto 模式注入 auto-deny callback（记录到 `task.metadata.blockedApprovals`）
3. reviewer 角色在 worker 场景自动降级 bypassPermissions（`resolvePermissionMode` 加角色类型判断）
4. 设置页加 `workerApprovalMode` 配置项

**状态**：✅ 已落地（v1.4.2，commit `9bbbcb7`）

---

### P1 架构宪章（零代码）

#### 3.3 Prompt Cache 不可侵犯宪章

**来源**：hermes `AGENTS.md:18-22` + `agent/prompt_caching.py`

**问题**：TAgent 用 Claude Agent SDK，cache 命中直接影响成本与延迟（cache miss 翻倍成本）。当前 CLAUDE.md 没有把 prompt cache 列为审查约束，新 PR 可能无意中破坏 cache prefix。

**hermes 做法**：
1. AGENTS.md 顶层第 18-22 行写"prompt cache 不可侵犯"原则
2. 长会话每轮复用 cached prefix，任何中途改上下文/换 toolset/重建 system prompt 都会失效缓存并翻倍成本
3. 唯一例外是 context compression
4. 所有 PR 审查以此为镜

**TAgent 落地方案**：

在 `CLAUDE.md` 加"Prompt Cache 不可侵犯"段落：

```markdown
## Prompt Cache 不可侵犯

**核心约束**：长会话每轮复用 cached prefix，cache 命中直接影响成本与延迟。

**禁止行为**（除非论证无 cache 影响）：
- 中途切换 toolset（增删工具）
- 重建 system prompt（顺序调整、内容追加）
- 中途注入新的 system message
- 翻转消息顺序

**唯一例外**：context compression（compact_session）

**PR 审查 checklist**：
- [ ] 改动是否影响 system prompt 组装顺序？
- [ ] 改动是否动态增删工具？
- [ ] 改动是否插入新消息到会话中部？
- 若任一为是：在 PR 描述中论证 cache 影响与替代方案
```

**成本**：零代码（纯文档） | **风险**：无

**BDD 验收标准**：

```gherkin
Feature: Prompt Cache 宪章

  Scenario: 新 PR 影响 cache 时需论证
    Given 一个修改了 system prompt 组装顺序的 PR
    When 提交者填写 PR 描述
    Then 必须包含 "Cache 影响" 段落
    And 说明替代方案或论证无影响

  Scenario: compact_session 是唯一例外
    Given 一个 context 压缩操作
    When 触发 compact_session
    Then 不受宪章约束，正常执行

  Scenario: CLAUDE.md 文档更新
    Given 宪章已写入 CLAUDE.md
    When 新 Agent 进入项目
    Then 第一句话 checklist 包含 prompt cache 约束
```

**评审决策（2026-07-03 通过）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| 定位调整 | 不是"教 TAgent 打 cache_control"（SDK 已自动管），是"约束 PR 不破坏 SDK 已享受的 cache" | TAgent 是 SDK 上层，cache 机制由 SDK 黑盒管理 |
| 落地方式 | 纯文档 + PR 模板 checklist | 零代码 |
| PR 模板 | 加 cache 影响 checklist 项 | 否则宪章只是文档没人执行 |
| 可选优化（buildSubagentDispatchStrategy 移到末尾） | 不做 | 收益有限，Anthropic cache 自动断点已能处理 |

**explorer 验证结论（2026-07-03）**：

TAgent 现状接近最优，cache 命中风险等级 = **低**：

- ✅ 主拼装顺序稳定（`buildSystemPrompt` :455-836 用 `sections[]` 固定顺序 push）
- ✅ 工具列表不进 system prompt（走 SDK `mcpServers` + `agents` 独立字段）
- ✅ SOUL.md / skills 不进 system prompt（skills 走 SDK plugin 机制自动发现）
- ✅ 动态内容隔离到 user message（时间/MCP 状态/mentions 走 `<workspace_state>` XML 块）
- ✅ 无中途注入 system message

仅 4 个风险点，全是用户主动操作（permissionMode 切换 / mode 切换 / SOUL.md 编辑 / eagerness 档位变更），cache 失效合理，无需修复。

**偏差澄清**：原描述"SOUL.md / skills 不进 system prompt"与现状不符——SOUL.md 实际进 system prompt（`agent-prompt-builder.ts:462-466`），skills 才走 SDK plugin 不进。宪章文档已据此修正描述。

**落地范围**：
1. CLAUDE.md 加"Prompt Cache 不可侵犯"段落
2. Agent Onboarding Checklist 加一条
3. `.github/pull_request_template.md` 加 cache 影响 checklist 项

**状态**：✅ 已落地（v1.4.2）

---

#### 3.4 Footprint Ladder 能力阶梯

**来源**：hermes `AGENTS.md:182-211`

**问题**：TAgent 的工具新增缺少明确的 footprint 决策树，新功能可能在 core tool 层直接堆砌，导致核心膨胀。

**hermes 做法**：6 级阶梯，core tool 是最后手段：
1. 扩展已有代码
2. CLI 命令 + skill
3. service-gated tool（带 `check_fn`）
4. plugin
5. MCP server catalog
6. 新 core tool（最后手段）

并规定：3+ 同类 PR 必须设计 ABC + orchestrator。

**TAgent 落地方案**：

在 `CLAUDE.md` 加"能力新增决策树"段落，适配 TAgent 架构：

```markdown
## 能力新增 Footprint Ladder

新增能力按以下阶梯选择（从轻到重）：

1. **扩展已有代码**：能改现有 service / atom 就改，不新建
2. **Skill**：写到 `~/.tagent/agent-workspaces/{ws}/skills/`，用 SKILL.md 描述
3. **MCP Server**：通过 workspace `mcp.json` 配置，按需加载
4. **Service-gated Tool**：带权限检查的工具（`check_fn`），走 IPC 通道
5. **Plugin**：独立包，按需加载（未来规划）
6. **Core Tool**：最后手段，需 PR 评审 + 架构论证

**强制规则**：3+ 同类 PR 必须设计 ABC（Abstract Base Class）+ orchestrator，避免核心膨胀。
```

**成本**：零代码（纯文档） | **风险**：无

**BDD 验收标准**：

```gherkin
Feature: Footprint Ladder 决策

  Scenario: 新增能力首选扩展已有代码
    Given 一个新需求"给看板任务加优先级排序"
    When 评审落地方式
    Then 首选方案是扩展 kanban-dispatcher.ts
    And 不新建 KanbanPriorityService

  Scenario: 3+ 同类 PR 触发 ABC 设计
    Given 已有 3 个 PR 都在加新的看板工具
    When 第 4 个 PR 提交
    Then 必须先设计 KanbanTool ABC + orchestrator
    And 否则 PR 阻塞

  Scenario: Core Tool 是最后手段
    Given 一个提案"新增 core IPC 通道"
    When 评审 footprint
    Then 必须论证前 5 级阶梯为何不适用
```

**评审决策（2026-07-03 通过，含关键修订）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| 第 2 级落地形式 | Skill + 命令注册表 + 未来 Cmd+K 面板（**非 slash command**） | TAgent 是桌面原生应用，无 CLI 基因，不背 hermes slash command 包袱 |
| 触发字符 `~` | **放弃** | CLI 思维，桌面应用不需要符号触发 |
| Slash command 文本语法 | **不引入** | 与现有 `/` = TipTap Mention skill 触发冲突，且非桌面原生方案 |
| 命令路由三类 | desktop / agent / model（沿用 hermes） | 统一架构，UI 按钮 + 未来 Cmd+K 都从 catalog 读 |
| 硬规则 | 3+ 同类 PR 必须设计 ABC + orchestrator | 防止 core 膨胀 |

**关键发现（验证过程中厘清）**：

1. **TAgent `/` 已被 TipTap Mention 占用**（`mention-suggestions.tsx:151` `char: '/'`），是 skill 触发字符。`/skill:{slug}` 是 skill 入口，不是 slash command。
2. **hermes-desktop 用 slash command 是 CLI 基因延续**，TAgent 是桌面原生应用，受众不同，不需要继承这个包袱。
3. **桌面应用命令入口的事实标准是 Cmd+K**（VS Code / Linear / Raycast / Notion 全用），不是符号触发。

**落地范围**：

v1.4.2 补丁（轻量，1-2 天）：
1. CLAUDE.md 加 Footprint Ladder 文档（5 级，第 2 级 = Skill + 命令注册表）
2. 新建 `command-registry.ts`（统一注册表，纯逻辑，无 UI）
3. 迁移现有 `/compact` 按钮走 registry（UI 按钮保留，逻辑统一）
4. Agent Onboarding Checklist 加 Footprint Ladder 约束

v1.6（独立 UI 功能，1-2 周）：
5. Cmd+K 全局命令面板 UI（接 registry，模糊搜索 + 键盘导航）
6. 逐步迁移常用命令到 catalog（`reset`、`settings`、`new`、`fast`、`usage` 等的 UI 按钮 + 快捷键）

**状态**：✅ 已落地（v1.4.2 轻量部分，command-registry 已建；v1.6 完整 UI 待做）

---

### P2 功能增强（中等成本）

#### 3.5 Skill Curator 自进化

**来源**：hermes `agent/curator.py` + `agent/background_review.py`

**问题**：TAgent 当前只有 Superpowers 静态 skill 集 + auto-check 钩子，没有 skill 的生命周期管理与自我改进。Skill 用久了会过时、重复、低效，无人维护。

**hermes 做法**：
1. inactivity-triggered 后台 aux-model fork 自动审查 skill
2. 生命周期状态：`draft → active → stale → archived`
3. 只归档不删除（pinned skill 跳过自动转换）
4. 空闲超 `interval_hours`（默认 7 天）才跑，无需 cron daemon
5. aux-model 评估 skill 使用频率 + 有效性，决定状态转换

**TAgent 落地方案**：

新增 `apps/electron/src/main/lib/skill-curator-service.ts`：

```typescript
export interface SkillCuratorState {
  lastRunAt: number
  skillStates: Record<string, {
    status: 'draft' | 'active' | 'stale' | 'archived'
    pinned: boolean
    lastUsedAt: number
    useCount: number
    lastReviewedAt: number
  }>
}
```

复用 TAgent 已有的 `scheduled-cleanup-service.ts`（每周日 04:00）顺带跑 Curator：
1. 扫描 `~/.tagent/agent-workspaces/{ws}/skills/` 所有 skill
2. 读 `metadata.json` 获取使用统计（需在 skill 调用时埋点）
3. aux-model fork 评估：使用频率 < 阈值 / 重复度 > 阈值 / 有效性低 → 状态转换
4. 写 `.curator_state.json` 持久化
5. `archived` 状态 skill 移到 `skills/.archived/`，不删除

UI：在设置页"Skills"Tab 加生命周期状态徽章 + 手动 pin/unpin 按钮。

**成本**：中等（3-5 天） | **风险**：中（需 skill 调用埋点 + aux-model 评估逻辑）

**BDD 验收标准**：

```gherkin
Feature: Skill Curator 自进化

  Scenario: 新 skill 默认 draft 状态
    Given 用户安装一个新 skill
    When Curator 首次扫描
    Then skill 状态为 draft
    And lastUsedAt 为 null

  Scenario: draft skill 使用超 5 次转 active
    Given 一个 draft 状态的 skill
    When 用户调用该 skill 5 次
    And 下次 Curator 运行
    Then skill 状态转为 active

  Scenario: 30 天未使用的 active skill 转 stale
    Given 一个 active 状态的 skill
    And lastUsedAt 距今 35 天
    When Curator 运行
    Then skill 状态转为 stale
    And UI 显示"建议归档"徽章

  Scenario: pinned skill 跳过自动转换
    Given 一个 pinned active skill
    And lastUsedAt 距今 60 天
    When Curator 运行
    Then skill 状态保持 active
    And 不归档

  Scenario: 用户手动归档
    Given 一个 stale 状态的 skill
    When 用户点击"归档"按钮
    Then skill 移到 skills/.archived/
    And 状态为 archived

  Scenario: 复用 ScheduledCleanup 时段
    Given 每周日 04:00 ScheduledCleanup 触发
    When Cleanup 完成
    Then Curator 自动接力运行
    And 不需要单独 cron
```

**评审决策（2026-07-03 通过，重大修订）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| 核心方向 | **抛弃原 Curator，改为"记忆驱动 skill 自创推荐系统"** | TAgent 没有 agent 自创 skill 失控问题，Curator 无治理对象；TAgent 5 层记忆 + Nudge 比 hermes 更适合做"主动识别重复工作流" |
| 抛弃 `tagent-coach` skill | ✅ 抛弃，识别逻辑内置到 Nudge/Reflect | 内置必然执行，skill 靠模型判断可能漏触发 |
| `skill-creator` 处置 | **移到默认预置**（不依赖用户安装） | 固化建议触发时 agent 必然能调到，避免"用户确认但无 skill-creator"尴尬 |
| `skill-creator` 形态 | **保持 skill 形态，不内置成 core tool** | 符合 Footprint Ladder 第 2 级；保持灵活性（用户可编辑/禁用） |
| hermes `skill_manage` core tool | **不引入** | TAgent skill-creator + Write 工具已覆盖，且 hermes 的 approval gate 不符合桌面应用对话式确认 |
| provenance | ✅ 引入 `created_by` frontmatter 字段 | 区分 official / market / user / agent，为未来统计打基础 |
| usage tracking | ✅ 引入 `.usage.json` 埋点 | 可观测性基础设施 |
| Curator 兜底 | **不做** | Nudge + Reflect 主动识别 + 用户确认已够，agent 自创 skill 数量可控 |

**关键发现（验证过程中厘清）**：

1. **hermes 有完整记忆系统**（`agent/memory_manager.py` + `memory_provider.py` ABC + 7 个插件后端 Honcho/Hindsight/Mem0/OpenViking/Holographic/RetainDB），不是"没有记忆"。但 hermes 记忆是"黑盒后端"，TAgent 是"5 层结构化"——TAgent 更适合做"跨会话工作流识别"。
2. **TAgent 已有 `tagent-coach` + `skill-creator` 双 skill 协作**——`tagent-coach` 识别"该固化"，`skill-creator` 教"怎么写"。问题在于 `tagent-coach` 只看单会话对话信号，跨会话工作流识别缺失。
3. **TAgent `skill-creator` 已覆盖 hermes `skill_manage` 的 create/edit/patch/delete/write_file 能力**——通过 Write + Edit 工具实现，符合 Footprint Ladder 第 2 级，不需要 dedicated core tool。

**落地范围（最终版，2026-07-03 修订为"润物细无声"方案）**：

**核心原则**：完全静默，不打扰用户当前对话。借鉴 hermes Curator 的"inactivity-triggered 后台静默运行"思想，所有识别与提示都异步、被动。

**阶段一：静默识别系统**（v1.5，2-3 天）

1. **抛弃 `tagent-coach` skill**（从默认预置移除）
2. **Reflect 服务加双重识别**（每日 03:00 跑，已有调度）：
   - 跨会话工作流识别：从 L4 提炼重复 ≥3 次的工作流
   - 挫败信号汇总：扫描 L4 当日对话，识别"不对/怎么又/再说一遍"等信号
3. **识别结果写入 `~/.tagent/skill-suggestions.json`**（候选列表）：
   ```json
   {
     "candidates": [
       {
         "type": "repeated_workflow" | "frustration_signal",
         "pattern": "每周一早上跑 speed-test",
         "occurrences": 3,
         "sessionIds": ["abc", "def", "ghi"],
         "firstSeenAt": 1730000000,
         "lastSeenAt": 1730000000,
         "suggestedSkillName": "weekly-speed-test",
         "suggestedDescription": "..."
       }
     ],
     "lastUpdatedAt": 1730000000
   }
   ```
4. **不主动弹 Toast**——用户下次打开设置页"Skills"Tab 时，看到"3 个建议固化"红点，被动感知
5. **`skill-creator` 移到默认预置**（不依赖用户安装）
6. **用户点开候选 → 确认 → 调 skill-creator 创建 SKILL.md**（仅这一步是同步交互）

**阶段二：补埋点 + provenance + 上下文控制**（v1.5，1-2 天，与阶段一并行）

7. **frontmatter 加 `created_by` 字段**（official / market / user / agent）
8. **skill 调用埋点** `~/.tagent/agent-workspaces/{ws}/skills/.usage.json`
9. **设置页 Skills Tab 显示** useCount / lastUsedAt / createdBy + "建议固化"区域
10. **description 长度软规则**：500 字符（超长警告但不强制截断）
11. **skill 数量软上限**：30 个/工作区（超过时 Reflect 提示"考虑归档低使用 skill"）

**阶段三：可选优化**（v1.6+，按需）

12. **aux-model description 精简**：agent 自创 skill 后，aux-model 跑一次 description 精简
13. **tool_search 机制**：skill 数量 > 50 时启用，agent 先 search 再加载

**不打扰清单（明确不做）**：

| 不做项 | 理由 |
|--------|------|
| 对话内 Nudge 弹 Toast 提示固化 | 打断用户当前对话，违背"润物细无声" |
| 挫败信号实时检测 | 实时检测必然导致实时提示，烦 |
| Curator 状态机 draft/active/stale/archived | 用户确认才创建，不会失控 |
| hermes `skill_manage` core tool | skill-creator + Write/Edit 已覆盖 |
| approval gate（stage 待审核） | 桌面应用走对话式确认 |
| Curator 兜底（aux-model fork 归档） | 用户确认才创建，无失控 |
| provenance foreground/background 双源 | 无 curator fork，只需单字段 `created_by` |

**上下文占用控制**：

| 机制 | 来源 | 落地 |
|------|------|------|
| Progressive Disclosure 三层（metadata / body / references） | hermes `skills_tool.py:8-12` | SDK 已自动管，无需新增 |
| Tier 1 总量控制 | description 长度 × skill 数量 | 500 字符 × 30 skill = 15K 字符 ≈ 3.75K token |
| description 长度软规则 | 借鉴 hermes MAX_DESCRIPTION_LENGTH=1024 | 收紧到 500（中文比英文省字符） |
| skill 数量软上限 | TAgent 独创 | 30 个/工作区，Reflect 提示 |
| tool_search（skill > 50 时） | hermes 已有 | v1.6+ 考虑 |

**与 hermes 的最终对比**：

| 维度 | hermes | TAgent 最终方案 |
|------|--------|----------------|
| 识别时机 | Curator inactivity-triggered（7 天 + 空闲 2h） | Reflect 每日 03:00（已有调度） |
| 识别方式 | aux-model fork 评估 | L4 跨会话历史 + 挫败信号汇总（无 aux-model） |
| 提示方式 | 静默（只更新状态） | 静默（写入 skill-suggestions.json） |
| 用户感知 | 看 skill 列表看到状态变化 | 看设置页"建议固化"红点 |
| 治理对象 | agent 自创 skill（生命周期转换） | 重复工作流（固化建议） |
| skill 创建 | `skill_manage` core tool | skill-creator skill（Write/Edit） |
| 上下文控制 | Progressive Disclosure + tool_search | Progressive Disclosure + description 限制 + 数量软上限 |

**状态**：✅ 评审通过，待排期（v1.5，3-5 天）

---

**最终修订（2026-07-03 方案 D 完整自动闭环）**：

用户背景：用户不专业 + 没耐心 + 讨厌骚扰 + 开发周期无历史包袱。重新评估后采用**完全自动闭环**——agent 静默自动创建 + 静态规则自动治理 + 用户零介入。

| 决策点 | 修订后方案 | 修订理由 |
|--------|-----------|---------|
| 创建入口 | **引入 `skill_manage` core tool**（agent 静默创建） | 用户零介入必需，skill-creator + 用户确认不符合"零介入" |
| 状态机 | **做**（draft/active/stale/archived） | 防止自动创建导致 skill 堆积成"一坨" |
| Curator 治理 | **做（静态规则版，不用 aux-model fork）** | 复用 ScheduledCleanup 时段，省 token 成本 |
| provenance | **foreground/background 双源** | Curator 只管 background（agent 自创），不越权 foreground（用户写的） |
| approval gate | 不引入 | hermes 默认也关，agent 静默创建不需要 stage |
| Footprint Ladder | 突破第 6 级（core tool） | skill_manage 是合理 core tool（像 memory 工具），不算膨胀 |
| 抛弃 `skill-creator` skill | ✅ 抛弃 | 被 skill_manage core tool 取代 |
| 抛弃 `tagent-coach` skill | ✅ 抛弃 | 识别逻辑内置到 Reflect |

**完整闭环**：

```
用户白天使用 TAgent 干活（用户零介入，无感知）
    ↓
每次工具调用 → L4 sessions.db 记录（已有）
    ↓
当日 03:00 Reflect 跑全量扫描（已有调度）
    ↓ OR
次日 app 启动时后台异步扫描昨日新增
    ↓
工具调用序列模式匹配（层次 A，不读消息内容）
    ↓ 门槛：重复 ≥5 次 + 相似度 > 0.8 + 排除已存在同类 skill
达门槛 → 自动调 skill_manage core tool 创建（静默，用户零介入）
    ↓
新 skill 标 background + draft 状态
    ↓
skill 调用自动埋点（.usage.json）
    ↓
ScheduledCleanup 每周日 04:00 静态状态机治理（复用已有调度）：
  - draft + 使用 ≥5 次 → active
  - active + 30 天没用 → stale
  - stale + 90 天没用 → archived（移到 .archived/，不删可恢复）
  - background 才管，foreground 跳过
  - pinned 跳过
    ↓
archived skill 移走，不进 Tier 1，上下文减负
    ↓
用户看 skill 列表时被动发现"哦，多了几个 skill / 某些标灰了"
```

**识别时机（最终选定）**：时机 4（启动时 + Reflect 兜底）

- app 启动时后台异步扫描昨日新增会话 → 用户早上打开就看到昨天的固化结果
- Reflect 每日 03:00 兜底全量扫描 → 保证不漏
- 不在对话进行中实时识别 → 不增加对话延迟

**识别方式（最终选定）**：层次 A（工具调用序列模式匹配）

- 只看工具调用序列相似度，不读消息内容
- 简单、省 token、隐私好
- 如果误判多，v1.6 升级到层次 B（消息 + 工具调用联合识别）

**skill 目录结构（最终选定）**：出路 3（分层全局 + 工作区）

```
~/.tagent/
├── skills/                          ← 全局共享（新增）
│   ├── brandkit/                    ← Superpowers 14（默认全局）
│   ├── docx/, pdf/, pptx/, xlsx/   ← 办公套件（默认全局）
│   └── speed-test/                  ← 自动固化结果（默认全局，跨工作区复用）
│
└── agent-workspaces/{ws}/skills/    ← 工作区专属（保留）
    └── blender-ta/                  ← TA 工作区专属
```

- 全局 skill 跨工作区复用，工作区 skill 项目隔离
- 自动固化结果默认放全局（跨工作区复用价值最大）
- 加载时合并全局 + 当前工作区
- 迁移：现有 `default/skills/` 下的通用 skill 迁到 `~/.tagent/skills/`

**加载机制（确认已有）**：

TAgent 用 Claude Agent SDK 的 plugin 机制（`agent-orchestrator.ts:2222`），SDK 自动管 Progressive Disclosure 三层：
- Tier 1：metadata（name + description）始终在 system prompt（25 skill × ~400 字符 ≈ 10K 字符 ≈ 2.5K token）
- Tier 2：SKILL.md body，skill 触发时 SDK 自动加载
- Tier 3：references / templates / assets，agent 主动调 Read 工具按需加载

**新 skill 加载时机**：当前对话不立即用，下次 `query()` 自然加载（符合 SDK 设计）。自动固化目的是下次类似任务复用，不是当前对话立即用，延迟可接受。

**description 长度限制（最终选定）**：B 宽松 1024

- 兼容现有 25 个 skill（实测 7 个超 500 字符，最长 1209）
- 与 hermes `MAX_DESCRIPTION_LENGTH=1024` 对齐
- pushy 风格需要列举触发场景，500 太紧
- 软规则：>1024 警告但不截断
- 硬规则：>2000 强制截断（防极端）
- 25 skill × 1024 字符 ≈ 4K token，占比 system prompt 10-20%，可接受

**完整改动清单（方案 D 最终版）**：

新建文件（4 个）：
1. `apps/electron/src/main/lib/skill-manage-tool.ts` — skill_manage core tool 实现（create/edit/patch/delete，agent 静默调用）
2. `apps/electron/src/main/lib/skill-usage-tracker.ts` — 埋点读写 + 并发安全
3. `apps/electron/src/main/lib/skill-curator-service.ts` — 静态状态机治理（复用 ScheduledCleanup）
4. `~/.tagent/skill-suggestions.json`（运行时生成）— 未达门槛的候选存储

改动文件（7 个）：
1. `agent-orchestrator.ts` — 注册 skill_manage core tool + skill 调用埋点 hook + 加载合并全局 + 工作区 skill
2. `agent-workspace-manager.ts` — skill 列表合并 usage + provenance + 状态 + 全局目录扫描
3. `reflect-service.ts` — 加 `identifyRepeatedWorkflows()` + 门槛判断 + 自动调 skill_manage
4. `scheduled-cleanup-service.ts` — 顺带跑 Curator 静态状态机
5. `agent-prompt-builder.ts` — system prompt 提示 skill_manage 工具用法
6. SKILL.md frontmatter 解析 — 加 `provenance` + `status` + `pinned` 字段
7. 设置页 Skills Tab — 加状态徽章 + provenance 徽章 + 全局/工作区分区显示

抛弃文件（2 个）：
1. `~/.tagent/agent-workspaces/default/skills/tagent-coach/` — 移除（识别逻辑内置到 Reflect）
2. `~/.tagent/agent-workspaces/default/skills/skill-creator/` — 移除（被 skill_manage core tool 取代）

迁移（一次性）：
- 现有 `default/skills/` 下的通用 skill（brandkit / docx / pdf / pptx / xlsx / brainstorming / executing-plans / find-skills / writing-plans 等）迁到 `~/.tagent/skills/`
- 工作区专属 skill 保留原位

**工作量与排期（修订）**：

| 阶段 | 工作量 | 内容 |
|------|--------|------|
| 阶段一：core tool + 埋点 + provenance | 2-3 天 | skill_manage core tool + .usage.json + 双源 provenance |
| 阶段二：自动识别 + 创建 | 2 天 | Reflect 识别 + 门槛判断 + 自动调 skill_manage + 启动时扫描 |
| 阶段三：治理 + UI + 分层目录迁移 | 3 天 | Curator 静态状态机 + 设置页状态徽章 + 全局/工作区分区 + 迁移现有 skill |

**总工作量**：7-8 天 | **排期**：v1.5 主线

**与 hermes 的最终差异（方案 D）**：

| 维度 | hermes | TAgent 方案 D |
|------|--------|---------------|
| skill 目录 | 全局单目录 | 分层（全局 + 工作区） |
| 创建入口 | `skill_manage` core tool | `skill_manage` core tool（借鉴） |
| provenance | foreground/background 双源 | foreground/background 双源（借鉴） |
| 状态机 | draft/active/stale/archived | draft/active/stale/archived（借鉴） |
| 治理触发 | inactivity-triggered（7 天 + 空闲 2h） | 复用 ScheduledCleanup（周日 04:00） |
| 治理方式 | aux-model fork 评估 | 静态规则（省 token） |
| 识别时机 | 无（被动等用户调 skill_manage） | Reflect 03:00 + 启动时扫描（主动识别） |
| 识别方式 | 无 | 工具调用序列模式匹配（层次 A） |
| 用户介入 | 0（完全静默） | 0（完全静默） |
| 加载机制 | 自实现三层（skills_list/skill_view） | SDK 自带三层（plugins） |
| description 限制 | 1024 字符 | 1024 字符（对齐） |
| 用户感知 | 看 skill 列表状态变化 | 看设置页状态徽章 + 全局/工作区分区 |

**核心差异**：hermes 是"被动等 agent 调 skill_manage + Curator 事后治理"，TAgent 方案 D 是"Reflect 主动识别重复工作流 + agent 静默自动创建 + 静态规则治理"——TAgent 更前置（事前识别），hermes 更后置（事后治理）。

**状态**：✅ 评审通过，待排期（v1.5，7-8 天）

---

#### 3.6 看板 goal_mode + worker judge（2026-07-18 重校准）

**来源**：hermes Kanban `goal_mode` + 辅助模型 `judge_goal`（`/goal` 同源 Ralph 式引擎）  
**上游现状（2026-07-18）**：行为在 **v0.18.0 Judgment Release** 定型；0.18.1/0.18.2 与其后 main 增量主要是 gateway/MCP/渠道运维，**与 goal/judge 关系很小**。对 TAgent 有用的就是 **worker 的 goal + judge**，其余不跟。

**问题（TAgent 现状）**：

- 看板任务完成路径是 worker 会话 `onComplete` → `markTaskDone` → **直接 `done`**，没有客观验收。
- worker **整包不注入** kanban 工具（`triggeredBy === 'kanban'` 防递归），无法走 `kanban_complete`。
- 状态机已有 `review`，主路径几乎未用。
- `requireSummary` 是 **board 全部终态后** 主会话主观汇总，**不是**任务级验收。

**hermes 现行做法（对齐文档 + 源码，勿只记「complete 前拦一下」）**：

| 层 | 行为 |
|----|------|
| **默认任务** | worker 一枪：干活 → `kanban_complete` / `kanban_block` → 退出 |
| **`goal_mode=True` / `--goal`** | **goal loop**：同 session 多轮；**每轮后** aux judge 用卡片 **title+body** 当验收标准；未达标且仍有 **`goal_max_turns`（默认 20）** 则继续；预算尽 → **block 给人**（非静默成功） |
| **`kanban_complete` 闸门** | 第二道保险：`goal_mode` 且 judge 可达时，complete 前再 judge；`verdict != done` → **tool_error**，任务不终态 |
| **fail-open** | judge 不可达时 **先探测再强制**（`_goal_judge_available`）；不可达则不楔死 worker |
| **拒绝后** | tool_error 提示：补证据重试 / 建 continuation children / 或 block |
| **验收文本** | hermes 默认 **title + body**，无独立 criteria 字段 |
| **`judge_goal` API** | 现返回 **4 元组** `(verdict, reason, parse_failed, wait_directive)`；verdict ∈ `done \| continue \| wait \| skipped` |

**已知上游坑（实现时勿抄）**：

- complete 闸门处曾按 **3 元组** 解包 4 返回值 → `ValueError` 被 fail-open 吃掉 → gate **实际上拒不了**（issues [#59762](https://github.com/NousResearch/hermes-agent/issues/59762)、[#61490](https://github.com/NousResearch/hermes-agent/issues/61490)）。
- TAgent 的 `judgeGoal()` 契约必须固定清晰（建议 `{ verdict, reason }` 或完整 4 字段 struct），**禁止模糊解包**。

**与 hermes 0.18.x 之后更新的关系**：

| 跟 | 不跟 |
|----|------|
| goal loop、complete 闸门、fail-open、worker 工具协议 | gateway multiplex、MCP 生命周期、WhatsApp、secrets、cron 运维、MoA、桌面 Projects、scale-to-zero |
| 可选：完成时带 verification 证据字符串（提高 judge 质量） | multi-board / tenant / auto_decompose 等 hermes 产品形态 |

**TAgent 落地方案（更新后）**：

```text
默认任务：
  worker 干活 → kanban_complete →（无 goalMode）→ done

goalMode 任务：
  同 session 多轮
    → 每轮/阶段结束 judgeGoal(criteria, output)
    → continue：注入续跑提示
    → done：允许结案
    → turns 耗尽：blocked + 原因给人
  worker 调 kanban_complete
    → 再过一道 complete 闸门 judge
    → pass → done；fail → tool_error，状态不终态
  judge 不可达 → fail-open
```

**任务字段（建议）**：

| 字段 | 说明 |
|------|------|
| `goalMode?: boolean` | 是否进入 goal loop + complete 闸门 |
| `acceptanceCriteria?: string` | **独立验收标准**（TAgent 改进；空则 fallback `title + body`） |
| `goalMaxTurns?: number` | 默认 20，耗尽 → blocked |
| `judgeModel?: string` | 便宜 aux 模型；缺省走设置 |
| `metadata.judgeResult?` | 最近一次裁决 |
| `metadata.failureCount?` | complete/judge 连续失败计数（二期） |

**与 `requireSummary` 互补（不变）**：

- **goal + judge**：任务级客观验收  
- **requireSummary**：board 级主观汇总  

**评审决策（2026-07-03 通过 + 2026-07-18 修订）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| 对齐范围 | **只对齐 worker goal + judge** | 其余 hermes 0.18 后更新与 TAgent 无关 |
| 完整形态 | **goal loop（每轮 judge）+ complete 闸门** | 仅 complete 闸门 ≠ hermes 现行 goal_mode |
| complete 位置 | **`kanban_complete` 工具内**，非 dispatcher 轮询 | 与 hermes 一致；证据在调用参数 |
| worker 工具 | **白名单**注入 complete / block / comment（+ 可选 heartbeat） | 当前整包禁用 kanban MCP 则无法 complete；**禁止** create_board / add_task |
| 失败后 | **tool_error + 不终态**；worker 可重试 / 拆子任务 / block | 勿一失败立刻永久 blocked |
| fail-open | **judge 不可达则放行** | 避免 kscc/无渠道楔死 |
| 验收标准字段 | **独立 `acceptanceCriteria`** | 比 hermes 仅 title+body 清晰 |
| `review` 状态 | **可选用**（类型已有） | 可选：complete 后先 review 再 judge→done；MVP 可跳过 |
| heartbeat / failure_limit | **二期** | 现有 worker 超时 abort 可先顶；完整 goal 不依赖 |
| `kanban_link` / tenant | **不做** | parentTaskId / boardId 已够 |
| MoA / GoalContract / wait PID | **不做（v1）** | 进阶；非 TAgent 主路径 |

**TAgent 现状约束（落地必改）**：

1. `agent-orchestrator`：`triggeredBy === 'kanban'` 时改为 **白名单** 注入，而非整包跳过。  
2. `kanban-worker-service`：prompt 要求 goal 任务结束必须 `kanban_complete`；会话自然结束时 **兜底策略** 需显式（建议：非 goal 仍 mark done；goal 未 complete → 日志 + blocked 或 fail-open 可配置，MVP 可兜底 done + warn）。  
3. Judge 走 **独立 aux 调用**（可抄 `nudge-llm-review.ts`），**不改主会话 system prompt**（保 Prompt Cache）。

**落地分期**：

| 阶段 | 工期 | 内容 |
|------|------|------|
| **A — complete 闸门 + 白名单** | 2–3 天 | 字段 + `kanban-judge-service` + `kanban_complete` + worker 白名单 + 单测 |
| **B — goal loop** | 2–3 天 | 同 session 多轮 / 每轮 judge / `goalMaxTurns` 耗尽 blocked + 续跑注入 |
| **C — UI / 可选加固** | 1 天 | 建任务 goal 开关 + criteria、卡片徽章/judge 结果；可选 heartbeat、failure_limit |

**总成本**：约 **5–7 天**（完整 A+B+C）；仅验证假完成拦截可先做 A（~2–3 天），但产品叙事「goal_mode」应对齐 A+B。

**BDD 验收标准（更新）**：

```gherkin
Feature: 看板 goal_mode + worker judge

  Scenario: 非 goal 任务保持一枪完成
    Given goalMode 未开启
    When worker 调用 kanban_complete 且提供 summary
    Then 任务标 done
    And 不调用 judge

  Scenario: complete 闸门通过
    Given goalMode=true 且 acceptanceCriteria 已填
    And judge 可达
    When worker 调用 kanban_complete 且产出满足标准
    Then judge verdict=done
    And 任务标 done

  Scenario: complete 闸门拒绝
    Given goalMode=true 且 acceptanceCriteria 已填
    When worker 调用 kanban_complete 但产出不满足标准
    Then 返回 tool_error
    And 任务不进入 done
    And metadata 记录 judge 原因

  Scenario: judge 不可达 fail-open
    Given goalMode=true
    And 无可用 aux 渠道
    When worker 调用 kanban_complete
    Then 允许 done
    And 日志标记 fail-open

  Scenario: goal loop 多轮续跑
    Given goalMode=true 且 goalMaxTurns=5
    When 中途 judge 返回 continue
    Then worker 同 session 继续
    And 不标 done

  Scenario: turn 预算耗尽
    Given goalMode=true 且 turns 已用尽
    When 最后一次 judge 仍非 done
    Then 任务 blocked
    And 原因可见给人

  Scenario: worker 不能建板
    Given kanban 子会话
    Then 不注入 kanban_create_board / kanban_add_task
    And 注入 kanban_complete

  Scenario: 与 requireSummary 互补
    Given board 全部任务 done 且 requireSummary=true
    When board 完成
    Then 仍触发主会话汇总
```

**主要落点文件**：

```
packages/shared/src/types/kanban.ts
apps/electron/src/main/lib/kanban-judge-service.ts   # 新建
apps/electron/src/main/lib/kanban-agent-tools.ts     # kanban_complete + 白名单表
apps/electron/src/main/lib/kanban-worker-service.ts  # prompt + 完成策略
apps/electron/src/main/lib/agent-orchestrator.ts     # 子会话注入策略
apps/electron/src/main/lib/kanban-dispatcher.ts      # 二期 heartbeat / failure
renderer kanban UI                                  # 阶段 C
```

**状态**：✅ 评审通过（2026-07-03）+ ✅ 上游重校准（2026-07-18）— **待排期实现**（建议分支 `feature/kanban-goal-mode-judge`）

---

#### 3.7 Context 压缩插件化

**来源**：hermes `agent/context_engine.py` + `agent/context_compressor.py` + `plugins/context_engine/`

**问题**：TAgent 当前 `agent-session-compactor.ts` 是单一实现（3 策略写死），不可第三方扩展。压缩中收到用户消息会丢失（无 queue 机制）。

**hermes 做法**：
1. ABC 基类定义 `should_compress` / `compress` / `on_session_end` 生命周期
2. 默认 `compressor` 实现，第三方（如 LCM）可插件替换
3. `protect_first_n=3` + `protect_last_n=6` 保护首尾
4. 压缩用辅助 client（不污染主 prompt cache）
5. `on_session_end` 仅真实会话边界触发（CLI 退出/reset/gateway 过期），非每轮
6. queue interrupts during in-flight compression

**TAgent 落地方案**：

抽象 `ContextEngine` 接口：

```typescript
export interface ContextEngine {
  should_compress(context: ContextSnapshot): boolean
  compress(messages: SDKMessage[]): Promise<CompressResult>
  on_session_end(sessionId: string): Promise<void>
}

export class DefaultContextEngine implements ContextEngine {
  // 现有 agent-session-compactor.ts 的 3 策略
}

export class LCMContextEngine implements ContextEngine {
  // 未来扩展：LCM 算法压缩
}
```

补"压缩中收到用户消息先排队"：

```typescript
class AgentOrchestrator {
  private compressionQueue: Map<sessionId, SDKMessage[]> = new Map()
  private isCompressing: Set<sessionId> = new Set()

  async handleMessage(sessionId: string, message: SDKMessage) {
    if (this.isCompressing.has(sessionId)) {
      // 压缩中，排队
      this.compressionQueue.get(sessionId)?.push(message)
      return
    }
    // 正常处理
  }

  async compress(sessionId: string) {
    this.isCompressing.add(sessionId)
    try {
      await this.contextEngine.compress(...)
    } finally {
      this.isCompressing.delete(sessionId)
      // 处理排队的消息
      const queued = this.compressionQueue.get(sessionId)
      if (queued?.length) {
        this.compressionQueue.delete(sessionId)
        queued.forEach(msg => this.handleMessage(sessionId, msg))
      }
    }
  }
}
```

**成本**：中等（3-5 天） | **风险**：中（影响主路径，需充分测试）

**BDD 验收标准**：

```gherkin
Feature: Context 压缩插件化

  Scenario: 默认 ContextEngine 正常工作
    Given 一个会话触发 compact_session
    When 使用 DefaultContextEngine
    Then 3 策略可用（drop_old_tool_results / keep_last_n / summarize）

  Scenario: 第三方 ContextEngine 可替换
    Given 用户配置 contextEngine="lcm"
    When 触发压缩
    Then 使用 LCMContextEngine 实例
    And 默认 engine 不被加载

  Scenario: 压缩中收到用户消息排队
    Given 一个会话正在压缩
    When 用户发送新消息
    Then 消息进入 compressionQueue
    And 不丢失
    And 压缩完成后按顺序处理

  Scenario: protect_first_n 保护首条消息
    Given 一个会话有 20 条消息
    When 触发 drop_old_tool_results 压缩
    Then 前 3 条消息保留
    And 不被丢弃

  Scenario: 压缩用辅助 client
    Given 主会话使用 glm-5.2
    When 触发压缩
    Then 压缩调用辅助 client（如 glm-flash）
    And 主 prompt cache 不被污染
```

**评审决策（2026-07-03 通过，大幅精简）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| ABC 基类插件化 | **不做** | TAgent 用 Claude Agent SDK，压缩主路径由 SDK 黑盒管理，TAgent 不能替换 SDK 压缩引擎 |
| queue interrupts | **不做** | SDK 主路径管不到，兜底路径是 agent 主动调不涉及并发 |
| protect_first_n / protect_last_n | **做**（仅兜底路径） | agent 主动调 compact_session 兜底时不误删首尾 |
| summarize 策略 | **不做**（等 v1.6） | 兜底路径触发频率低（SDK compaction 通常成功），summarize 锦上添花，v1.6 再说 |
| on_session_end hook | **不做** | SDK 已管 |

**关键发现（验证过程中厘清）**：

TAgent 压缩是**双层架构**：
1. **主路径**：Claude Agent SDK 服务端 compaction（自动，TAgent 黑盒）
2. **兜底路径**：SDK 失败时（9120caac 那类），agent 主动调 `compact_session` MCP 工具（通过 `sdk.createSdkMcpServer('tagent-compactor')` 注入）

TAgent 完全无法介入 SDK 主路径的压缩——何时压、压什么都由 SDK 决定。只有 agent 主动调 compact_session 兜底时，TAgent 才有控制权。

**兜底路径触发频率**：低（SDK compaction 通常成功，只有异常才失败）

**真实价值**：第七条从"改造压缩系统"降级为"完善兜底 compact_session 工具"——边际改进。

**落地范围**（精简版，0.5 天）：

`agent-session-compactor.ts` 的 `drop_old_tool_results` / `keep_last_n` 加首尾保护：
```typescript
const PROTECT_FIRST_N = 3  // 首 3 条不丢（system + 上下文）
const PROTECT_LAST_N = 6   // 尾 6 条不丢（最近交互）

function planDropOldToolResults(messages: SDKMessage[]) {
  const middle = messages.slice(PROTECT_FIRST_N, -PROTECT_LAST_N)
  // 只在 middle 区域丢 tool_use/tool_result
}
```

**收益**：agent 主动调 compact_session 兜底时，不误删首尾关键消息（system / 项目背景 / 最近交互）。

**不做的部分**：
- ABC 基类插件化（不能替换 SDK 压缩引擎）
- queue interrupts（SDK 主路径管不到）
- summarize 策略（v1.6 再说）
- on_session_end hook（SDK 已管）

**状态**：✅ 已落地（v1.4.2，commit `edaf944`，protect_first_n/last_n）

---

### P3 长期规划

#### 3.8 Memory Graph 可视化

**来源**：hermes `agent/learning_graph.py` + `agent/learning_graph_render.py`

**问题**：TAgent 5 层 memory 是平铺文件，缺少关系视角与时间线，用户对 agent 进化的感知弱。

**hermes 做法**：把 MEMORY.md / USER.md / skill 节点 + 关系边渲染成 radial timeline 星图，三端（CLI/TUI/Desktop）统一编辑删除。

**TAgent 落地方案**：
- 基于 L0-L5 + SQLite FTS5 构建 graph（节点 = memory chunk / skill / user fact，边 = 引用关系 / 时间线）
- 渲染层用 reagraph 或 D3 star map
- 入口在设置页"记忆"Tab 加"Memory Graph"视图
- 节点支持点击钻取详情、编辑、删除

**成本**：高（1-2 周） | **风险**：中 | **版本**：v1.5+

**BDD 验收标准**：

```gherkin
Feature: Memory Graph 可视化

  Scenario: 打开 Memory Graph 视图
    Given 用户进入设置页"记忆"Tab
    When 点击"Memory Graph"子视图
    Then 显示 radial timeline 星图
    And 节点按时间线排列

  Scenario: 节点类型区分
    Given graph 已渲染
    Then L0 用户画像节点用圆形
    And L2 事实节点用方形
    And skill 节点用菱形
    And L5 洞察节点用六边形

  Scenario: 点击节点钻取详情
    Given 一个 L2 事实节点
    When 用户点击
    Then 右侧弹出详情面板
    And 显示完整内容 + 来源会话 + 创建时间

  Scenario: 编辑节点
    Given 一个 L0 用户画像节点
    When 用户点击"编辑"
    Then 弹出编辑器
    And 保存后同步更新 L0_user.md
```

**评审决策（2026-07-03 通过，分两阶段做）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| 是否做 Memory Graph | **做**（分两阶段） | 重度场景（开发大模块 / 分析系统 / 整理知识库）有价值，用户能感知积累和演化 |
| 渲染库 | **reagraph**（React + WebGL） | 性能好，节点多时流畅；React 友好 |
| 前置依赖 | **记忆系统修复（0.5.1）+ 孤儿引用修复** | 没数据 Graph 没意义；孤儿引用导致节点点击死链 |
| 节点类型 | L0/L1/L2/L4/L5 五类 | 覆盖 5 层记忆 |
| 边类型 | source 引用 + 时间线 + 主题关联 | 三类边表达关系网络 |
| 渲染方式 | radial timeline（径向时间线） | 同时表达关系 + 时间维度 |

**节点数据来源**：

| 层 | 节点类型 | 示例 |
|----|---------|------|
| L0 | 用户画像节点 | "用户：Frank Danny，偏好 Bun" |
| L1 | 项目画像节点 | "项目：TAgent，Electron + TS" |
| L2 | 稳定事实节点 | "用户喜欢 Bun" / "项目用 Jotai" |
| L4 | 会话节点 | "会话 abc：分析 hermes 借鉴" |
| L5 | 洞察节点 | "看板 judge gate 比主观汇总更客观" |

**边类型**：

| 边类型 | 来源 | 示例 |
|--------|------|------|
| 引用关系 | L2/L5 的 source 字段 | L2 事实 → L4 会话（来源） |
| 时间线 | 所有节点的 createdAt | 时间排序径向辐射 |
| 主题关联 | L4 的 key_facts + tools_used | 同主题会话互联 |

**落地范围**：

阶段一：基础 radial timeline（v1.5，3-4 天，依赖记忆修复完成）
1. 新建 `apps/electron/src/renderer/components/memory/MemoryGraph.tsx` — reagraph 渲染
2. 新建 IPC 通道 `GET_MEMORY_GRAPH` — 返回节点 + 边数据
3. `memory-layer-service.ts` 加 `buildGraphData()` — 从 L0-L5 构建节点边
4. 设置页"记忆"Tab 加 "Memory Graph" 子视图入口
5. 节点点击钻取详情面板（内容 + 来源 + 时间 + 引用次数）
6. 时间范围筛选（如"最近 30 天"）

阶段二：增强功能（v1.6，2-3 天）
7. 编辑/删除节点
8. 关系边过滤（只看引用 / 只看主题）
9. 主题聚类（同主题节点聚簇显示）
10. 导出（PNG / SVG）

**前置依赖**：

1. **记忆系统修复（0.5.1）**：v1.4.2 之前完成修复 1+2，让 L0-L5 有数据
2. **记忆孤儿引用修复**：v1.5 与 Graph 阶段一并行，避免节点点击死链
   - L2/L3/L5 标记 sourceDeletedAt（不删内容，保留有价值事实）
   - L4 sessions.db 删除已删会话记录
   - 子会话分级处理（借鉴 hermes：看板 worker 级联删 / 普通分支保留）

**工作量与排期**：

| 项 | 工作量 | 排期 |
|----|--------|------|
| 前置：记忆系统修复 1+2 | 半天 | v1.4.2（紧急） |
| 前置：孤儿引用修复 | 1 天 | v1.5 与 Graph 阶段一并行 |
| 阶段一：基础 radial timeline | 3-4 天 | v1.5 |
| 阶段二：增强功能 | 2-3 天 | v1.6 |
| **总计** | 6-8 天 | - |

**状态**：✅ 评审通过，待排期（v1.5 阶段一 + v1.6 阶段二，前置依赖记忆系统修复）

---

#### 3.9 Per-channel model overrides

**来源**：hermes `feat(gateway): per-channel model and system prompt overrides`

**问题**：TAgent 渠道是全局的，同一后端不同聊天上下文不能切换模型/人设。

**hermes 做法**：`ChannelOverride` + YAML `discord.channel_overrides` bridge，优先级 session > channel > global。

**TAgent 落地方案**：
- channel 配置加 `model_overrides?: Record<string, { model: string; systemPrompt?: string }>` 字段
- 渠道选择时按 chatId 优先级查找：session > channel > global
- UI 在渠道编辑页加"模型覆盖"区域

**成本**：中等（2-3 天） | **风险**：低 | **版本**：v1.5

**评审决策（2026-07-03 通过，不做）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| hermes channel_overrides 机制 | **不做** | TAgent 不是 IM gateway，无多 chat 场景；已有会话级模型选择覆盖大部分需求 |
| 渠道级 defaultModelId 轻量替代 | **不做** | 边际价值低，用户已习惯会话内选模型 |

**关键发现**：

TAgent 已有会话级模型选择（`agentModelId` + `AgentModelSelector`），用户每个会话可手动选模型 + 会话内切换。hermes channel_overrides 是为 IM gateway 多 chat 多用户场景设计，TAgent 桌面应用单用户单会话，场景不匹配。

**状态**：✅ 评审通过，不做

---

#### 3.10 MoA（Mixture-of-Agents）

**来源**：hermes `agent/moa_loop.py` — `_RefAccounting` slots + opt-in trace persistence

**问题**：TAgent 没有多模型顾问机制，高价值决策场景只能单模型判断。

**hermes 做法**：
1. 多个 reference model 并行生成建议
2. aggregator model 汇总输出最终答案
3. cost 按各自模型计价（非聚合模型）
4. opt-in trace 持久化到 JSONL

**TAgent 落地方案**：
- 在 Provider 层加 MoA 适配器
- 高价值场景（如代码审查、架构决策）opt-in 启用
- trace 持久化到 `~/.tagent/moa-traces/`

**成本**：高（1-2 周） | **风险**：中 | **版本**：v1.6+

**评审决策（2026-07-03 通过，不做完整 MoA）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| MoA runtime | **不做** | 成本高（1-2 周）、场景窄（仅高价值决策）、与现有机制重叠（看板多 worker + SubAgent 派发） |
| trace 持久化 | **不做** | 依赖 MoA runtime，runtime 不做就不需要 |
| goal_mode 升级为多模型投票 | **等 v1.6** | 先看 goal_mode 单 judge 效果，不够再加多模型投票（+0.5 天） |

**关键发现**：

TAgent 已有的多模型协作机制部分覆盖 MoA 场景：

| TAgent 现有机制 | 如何用多模型 | 与 MoA 差异 |
|----------------|------------|-----------|
| 看板多 worker | 不同任务派不同模型 worker | 任务级并行，不是建议聚合 |
| SubAgent 派发 | 主会话派 SubAgent 用不同模型 | 调研/审查委派，不是同题多答 |
| goal_mode judge gate | aux-model 验收 worker 输出 | 单 judge，不是多 reference 聚合 |

MoA 是"同题多答 + 聚合"，TAgent 现有机制是"不同任务分派不同模型"——部分重叠。

**替代方案（文档说明，零代码）**：

在 CLAUDE.md 加"多模型交叉验证指南"段落，教用户用现有机制实现：
- 代码审查：派多个 reviewer SubAgent（不同模型）
- 架构决策：看板建多 worker 任务（不同模型各出一版）
- goal_mode：v1.6 评估是否升级为多模型投票

**状态**：✅ 评审通过，不做完整 MoA，文档说明替代方案

---

#### 3.11 Multi-gateway 单 dispatcher 姿态

**评审决策（2026-07-03 通过，不做）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| 单 dispatcher 姿态 | **不做** | TAgent 单实例桌面应用，无 multi-gateway 并发场景 |
| 文件 singleton lock | **不做** | 单实例下无意义 |
| 多 profile 隔离 | **不做** | 未来 v2.0+ 远期规划，现在不需要 |

**关键发现**：

hermes 是 IM gateway 架构，多实例并发时会有 WAL `-shm` 读写竞争，需要单 dispatcher 姿态。TAgent 是单实例桌面应用，主进程跑看板 dispatcher，没有多 gateway 并发场景，问题完全不存在。

**状态**：✅ 评审通过，不做

---

#### 3.12 Verification Evidence 持久化

**来源**：hermes `agent/verification_evidence.py` — `VerificationEvidence` dataclass + `_equivalent_needles` 命令等价匹配

**问题**：TAgent 有 verification_stop / verify_hooks 但没有把验证证据持久化为可检索库，agent 不能记住自己验证过什么。

**hermes 做法**：把"值得记录的命令结果"分类后存 SQLite，带 retention cutoff，subsequence 匹配做命令等价归一。

**TAgent 落地方案**：
- 先复用 L4 会话日志，按需单独建表
- `verification_evidence` 表：命令、结果、分类、时间戳、retention
- `_equivalent_needles` 做命令等价匹配（如 `bun test` == `bun run test`）

**成本**：中等（3-5 天） | **风险**：低 | **版本**：v1.6+

**评审决策（2026-07-03 通过，等 v1.6 评估）**：

| 决策点 | 选定方案 | 理由 |
|--------|---------|------|
| Verification Evidence 持久化 | **等 v1.6 评估** | TAgent 已有 auto-check PostToolUse 钩子 + L4 会话日志，先看是否够用 |
| 独立 verification_evidence 表 | **等 v1.6** | 先复用 L4，不够再单独建表 |
| 命令等价匹配 `_equivalent_needles` | **等 v1.6** | 依赖独立表，表不做就不需要 |

**关键发现**：

TAgent 已有的验证机制：
- ✅ PostToolUse auto-check 钩子（`hooks/post-tool-use.ts`）—— 工具执行后自动跑 typecheck/lint
- ✅ L4 sessions.db（修复后）—— 会话级记录所有工具调用 + 结果
- ✅ verification_stop（CLAUDE.md 提及）—— 验证失败时停止

hermes 的 Verification Evidence 是把这些验证结果**额外**存独立表 + 命令等价匹配。TAgent 已有 L4 记录 + auto-check 钩子，覆盖大部分场景：
- L4 已记录命令 + 结果（可检索）
- auto-check 钩子已自动验证（typecheck/lint）
- 缺的只是"命令等价匹配"（如 `bun test` == `bun run test`）

**先看 L4 修复后是否够用**，不够再加独立表。

**落地范围**（v1.6 评估后决定）：
1. 评估 L4 修复后能否满足"agent 记住验证过什么"需求
2. 评估 auto-check 钩子是否需要扩展（如加命令等价匹配）
3. 不够再建独立 `verification_evidence` 表

**状态**：✅ 评审通过，等 v1.6 评估

---

## 4. 不建议借鉴

| 特性 | 原因 |
| --- | --- |
| **Scale-to-zero / Relay** | TAgent 桌面端 Electron，无 serverless 场景 |
| **ACP Adapter** | TAgent 已有完整 IPC 架构 |
| **20+ 消息平台** | 飞书/钉钉/微信/WPS 已覆盖国内主流 |
| **TUI (Ink/React)** | TAgent 已有 Electron 桌面 UI |
| **Modal/Daytona 终端后端** | TAgent 不需要 serverless 终端 |
| **xAI Grok OAuth** | TAgent 渠道体系已支持多 Provider |
| **Google Vertex AI** | 已有 Google provider 适配器 |

---

## 5. 排期建议

### 5.1 立即推进（v1.4.2 补丁）

| 项 | 优先级 | 成本 | 价值 |
| --- | --- | --- | --- |
| **0.5.1 记忆系统修复 1+2** | **最高** | 半天 | 核心功能空转 bug，其他项前置依赖 |
| 3.1 Cron Prompt Injection 防护 | P0 | 低 | 安全必补 |
| 3.2 Worker Approval 防死锁 | P0 | 低 | 稳定性 |
| 3.3 Prompt Cache 宪章 | P1 | 零 | 架构约束 |
| 3.4 Footprint Ladder 文档 + command-registry | P1 | 低 | 架构约束 |
| 3.7 Context 压缩兜底 protect | P1 | 半天 | 防误删关键消息 |

**总成本**：3-5 天 | **建议**：作为 v1.4.2 稳定性补丁发布，**记忆系统修复最优先**

### 5.2 近期推进（v1.5）

| 项 | 优先级 | 成本 | 价值 |
| --- | --- | --- | --- |
| 3.5 Skill 自进化（方案 D 完整闭环） | P2 | ✅ 已完成并合入 main | 自进化深度 |
| 3.6 看板 goal_mode + worker judge | P2 | 🚧 开发中（分支 `feature/kanban-goal-mode-judge`） | 看板产品化；仅对齐 worker goal/judge |
| 3.8 Memory Graph 阶段一 | P3 | ✅ 已完成 | 重度场景 UX |
| Nudge 写入升级 | P2 | ✅ 已完成（ADR-0006） | 记忆质量 |
| 孤儿引用修复（前置 Memory Graph） | P1 | ✅ 已完成（commit `0017fde`） | bug 修复 |

**当前剩余**：本节仅 `3.6 看板 goal_mode + worker judge` 仍在开发；其余列项均已完成。

### 5.3 长期规划（v1.6+）

| 项 | 优先级 | 成本 | 价值 |
| --- | --- | --- | --- |
| 3.8 Memory Graph 可视化 | P3 | 高 | UX 提升 |
| 3.10 MoA | P3 | 高 | 多模型决策 |
| 3.12 Verification Evidence | P3 | 中 | 验证可追溯 |

**总成本**：3-5 周 | **建议**：按用户反馈排期

---

## 6. 风险与依赖

### 6.1 风险

| 风险 | 影响项 | 缓解措施 |
| --- | --- | --- |
| hermes 设计与 TAgent 架构差异 | 所有项 | 每条借鉴前先 diff TAgent 现有实现 |
| 辅助模型成本 | 3.5 / 3.6 / 3.7 | 默认便宜模型（glm-flash / haiku），opt-in |
| 主路径影响 | 3.7 Context 插件化 | 充分测试 + 灰度发布 |
| Skill 调用埋点缺失 | 3.5 Curator | 需先补埋点（1-2 天） |

### 6.2 依赖

- **3.1 Cron Injection** 无外部依赖
- **3.2 Worker Approval** 需先审计 `kanban-worker-service.ts` 现有 approval 处理
- **3.5 Skill Curator** 依赖 skill 调用埋点（需新增）
- **3.6 goal_mode** 依赖便宜模型渠道配置（用户需自行配置）
- **3.7 Context 插件化** 依赖现有 `agent-session-compactor.ts` 重构
- **3.8 Memory Graph** 依赖 L0-L5 数据完整 + reagraph 库

---

## 7. 评审 checklist

逐条评审时确认：

- [ ] 问题是否成立（TAgent 是否真的缺这个能力）
- [ ] hermes 做法是否理解正确
- [ ] TAgent 落地方案是否与现有架构契合
- [ ] 成本估计是否合理
- [ ] BDD 验收标准是否可测
- [ ] 优先级是否合适（P0/P1/P2/P3）
- [ ] 是否有不建议借鉴项被误纳入

---

## 8. 下一步

1. 用户逐条评审本文档
2. 评审通过的项进入 `docs/PROGRESS.md` 待办
3. 按 5.1 / 5.2 / 5.3 排期推进
4. 每项落地后更新本文档状态（候选 → 已落地）

---

**文档状态**：Draft v1.0，等待用户逐条评审。

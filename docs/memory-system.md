# TAgent 记忆系统

> 记忆系统是 TAgent 的核心机制之一。本文档记录 5 层结构 + 4 个自进化机制的**实现现状**（不是设计意图，设计见 `docs/plans/2026-06-05-tagent-fusion-design.md` §6.5；空闲批量整理架构见 ADR-0006）。

## 设计原则

**LLM 永远不主动写记忆文件**。所有记忆写入由 Nudge 系统 + Reflect 服务控制，避免 LLM 乱写污染记忆。

前台路径只做确定性的本地工作（写 L4、写证据、标记 dirty），辅助 LLM 整理统一在空闲窗口执行（ADR-0006 Phase 2）。前台从不调用辅助 LLM，流式输出中的 partial delta 不会触发任何记忆操作。

SDK auto-memory（Claude Agent SDK 内置）通过双防线屏蔽：
1. **system prompt 反向指令**（`agent-prompt-builder.ts` 的 `MEMORY_MANAGEMENT_RULES`）禁止 LLM 用 Write 工具写记忆 .md 文件
2. **`autoMemoryDirectory` 重定向**（`memory-layer-service.ts` 的 `getDiscardedMemoryDir`）到 `/tmp/tagent-discarded-memory/` 废目录兜底——万一 LLM 不听话也不污染 `~/.tagent/memory/`

## 5 层结构（schema 不变）

> 运行状态 v2（`consolidation_state.json`、`pending_evidence.jsonl`、`dirty_state.json`、`consolidation_lease.json`）**不属于** L0-L5 schema。本节描述的是用户可感知的记忆层级，不是实现层的状态文件。不产生新的 sidecar 文件。

| 层 | 文件 | 内容 | 写入触发 | 自动化 |
|---|---|---|---|---|
| **L0** 用户画像 | `L0_user.md` | 用户偏好（"不要 emoji" / "保持简洁"） | Nudge 候选 → 空闲批量整理 → stage queue → 用户确认 | 半自动 |
| **L1** 项目画像 | `L1_project.md` | 项目模板（同一 workspace 多次会话） | 同上 | 半自动 |
| **L2** 稳定事实 | `L2_facts.md` | 稳定事实（"我叫 Frank" / "我用 Mac"） | 同上 | 半自动 |
| **L3** 纠错记录 | `corrections.jsonl` + `rules.json` | 纠错（"不是 X，是 Y"）+ 矛盾洞察 | Nudge `correction` 证据暂存 → 空闲批量整理 → stage queue；contradictions 由 `reflectService.applyConsolidationInsights` 纯本地写入 | Nudge 候选半自动 + Contradictions 全自动 |
| **L4** 历史会话 | `sessions.db`（SQLite + FTS5） | 会话元数据（title/summary/keyFacts/toolsUsed） | `recordSession` 每次会话流结束（本地 L4 写入 + evidence 写入 + dirty 标记）；keyFacts 由空闲批量整理提取 | 全自动 |
| **L5** 提炼洞察 | `L5_insights.md` | 高阶洞察（抽象结论） | 空闲批量整理（一次 LLM 请求返回 insights + contradictions，纯本地写入） | 全自动 |

### L0-L2 写入格式（结构化元数据）

```
- [2026-07-06] 我叫frank <!-- hit:3 last_ref:2026-07-06 src:abc12345 -->
```

- `hit` — 引用次数（去重写入时累加）
- `last_ref` — 最后引用日期（YYYY-MM-DD）
- `src` — 来源会话 ID 前 8 位

元数据用 HTML 注释，markdown 渲染器忽略，人类仍可读。**去重写入**：pattern 已存在则更新 `hit` + `last_ref`，不重复写。供 LRU / Self-Repair 使用。

## 4 个自进化机制

### 1. Nudge（warm-up 阈值检测，本地证据收集）

每次 Agent turn 开始时触发（`onTurnStart`），使用 warm-up 指数触发阈值序列（1→2→4→8→10→10...），新会话早提取、老会话省成本。检测 4 种模式：

| 模式 | 触发条件 | 目标层 | 处理方式 |
|---|---|---|---|
| `behavior_repeat` | 同一偏好表述 ≥5 次（"不要 emoji"等） | L0 | 证据暂存 → 空闲批量整理 → stage queue |
| `fact_repeat` | 事实表述 ≥3 次（"我叫 X" / "我喜欢 X"） | L2 | 证据暂存 → 空闲批量整理 → stage queue |
| `correction` | 显式纠正（"不是 X，是 Y"） | L3 | 证据暂存 → 空闲批量整理 → stage queue |
| `project_repeat` | 同一 workspace ≥2 个会话（跨 session） | L1 | 证据暂存 → 空闲批量整理 → stage queue |

**冷却**（按 sessionId 隔离）：
- L0 = 10 turn
- L1 = 20 turn
- L2 = 10 turn
- L3 = 30 turn

**跨 session 去重**（`project_repeat` 专用）：检测前查 L1_project.md（已存为模板）+ `nudges/rejected.jsonl`（已拒绝）的 workspace slug，已处理过的不再触发。

**证据收集**：Nudge 达到阈值时**不调用 LLM**，将候选写入 `memory-evidence-sink` 的 `pending_evidence.jsonl`（`writeNudgeEvidence`），由后续空闲 `MemoryConsolidationService` 批量处理。Nudge 在前台从不发起辅助 LLM 调用，`onTurnStart` 同步返回空数组。

### 2. Reflect + 空闲批量整理（idle consolidation）

Reflection 不再是一个独立的固定时钟 LLM 调用。当 `TAGENT_IDLE_MEMORY_CONSOLIDATION` flag 启用时，Reflection 合并到空闲批量整理（`MemoryConsolidationService`）的 insights 阶段，不另起请求。Legacy 独立 Reflection 调度仅在 flag 关闭时保留。

#### 空闲批量整理架构（ADR-0006 Phase 2）

**调度器**（`idle-memory-consolidation-scheduler.ts`）：
- 60s 扫描间隔（`setTimeout` 递归，不是 `setInterval`，防止扫描重叠）——这是调度器的轮询周期，实际触发整理还需满足 10 分钟静默窗口 + 30 分钟 debounce 等条件
- 首次 tick 延迟 60s，不抢占启动
- general 与 ta **串行**执行（`runIfEligible('general')` → `runIfEligible('ta')`）
- 真实前台活跃检测（`hasActiveAgentSessions()`）+ 全局 lease 文件确保单并发

**整理服务**（`memory-consolidation-service.ts`）：

进入空闲处理的条件（按顺序检查）：
1. 存在 pending application → 重放（跳过 dirty/evidence/budget，遵守前台/退避/lease）
2. dirty 标记存在且有 pending evidence
3. 证据有有效内容（标题/摘要/pattern 非空）
4. 无前台活跃 Agent
5. 最新证据 age ≥ 10 分钟静默窗口
6. 最新证据 age ≥ 30 分钟 debounce
7. 不在失败退避期（30 分钟）
8. 全局 lease 可获取（跨模式共享，5 分钟过期）
9. 当日预算未用完（默认 1 次/活跃日/模式，最大 2 次含重试）

**一次批量请求**向 LLM 提交自上次成功游标之后的增量证据，返回结构化结果：

```json
{
  "sessionKeyFacts": [{ "sessionId": "...", "facts": ["..."] }],
  "memoryCandidates": [{ "targetLayer": "L0|L1|L2|L3", "content": "...", "confidence": 0.0, "evidenceIds": ["..."] }],
  "insights": [{ "content": "...", "confidence": 0.0, "evidenceIds": ["..."] }],
  "contradictions": [{ "existingId": "...", "content": "...", "evidenceIds": ["..."] }]
}
```

同一次请求完成四件事：
1. 批量回填多个 L4 会话的 keyFacts
2. 生成需要门控的 L0-L3 候选
3. 生成或更新 L5 洞察（替代独立 Reflection LLM 调用）
4. 检查与已有事实、纠错和洞察的矛盾

**持久化顺序**：Provider 输出在本地 apply 之前先持久化（`pendingApplication` record），apply/consume 失败时保留 pending，下次 run 以 `requestsUsed=0` 本地重放，不再发起 Provider 请求。

**Anti-echo**：insights 与现有 L5 关键词重叠 ≥50% 则过滤。置信度（confidence）和证据引用（evidenceIds）从 LLM 输出保留并传递到写入层。

**Budget 默认值**：

| 参数 | 默认值 | 目的 |
| --- | ---: | --- |
| 首次空闲静默窗口 | 10 分钟 | 避免用户短暂停顿时抢占渠道 |
| 批处理 debounce | 30 分钟 | 合并连续多个 turn/会话 |
| 常规整理预算 | 1 次/活跃日/模式 | 让按次计费成本接近无记忆基线 |
| 最大请求数 | 2 次/日/模式（含 1 次重试） | 防止坏渠道循环消耗额度 |
| 失败退避 | 30 分钟 | 重试间隔 |
| 并发度 | 全局 1（跨模式 lease 文件） | 不与前台 Agent 并发争抢 |
| 批大小 | 最多 100 条 evidence / 40k 字符 | 防止 prompt 过长 |

**Rollout**：`TAGENT_IDLE_MEMORY_CONSOLIDATION=1` 强制开启，`=0` 强制关闭；未设置时 dev 默认开启、packaged 默认关闭。Phase 4 Memory Monitor / 手动 UI 仍待实现。

**Legacy Reflection**：当 flag 关闭时，`reflect-service.ts` 保留原有每日 03:00 + 启动时 >36h 调度，独立 LLM 调用。flag 开启后此路径不执行。

### 3. Scheduled Cleanup（每周日 04:00 + 启动时 >8 天）

- **L4 归档**：>30 天移 archive，>90 天标 old
- **L3 压缩**：raw >1000 条保留最近 500 条
- **FTS5 重建索引**
- **LRU 标记**：>90 天未更新的文件标 stale

### 4. Self-Repair（每月 1 日 04:00 + 启动时 >35 天）

- **L3 命中率统计**：最近 30 天 correction 按 pattern 分组，<2 次的写到 `stale_corrections.json`（不删原数据）
- **L5 反向引用验证**：每条 L5 提取关键词检查 L2/L4 是否还有相关内容，原始引用都删除 → archive 到 `L5_archive.md`
- **L0 跨模式一致性**：对比 general / TA 模式 L0，差异 >5 条 → 报告建议合并
- **月度报告**：写到 `~/.tagent[-dev]/logs/reflect/monthly-{date}-{mode}.log`
- **定时器**：`setInterval` 每 6 小时检查是否到月初（避免 `setTimeout` 32 位溢出——delay 超 2^31-1 会被当成 1ms 立即触发）

## 数据流

```
用户发消息
  ↓
agent-orchestrator.sendMessage()
  ↓
[1] Nudge 检测（onTurnStart）
  ↓ warm-up 阈值检测（1→2→4→8→10→10...）
  ↓ 检测到候选 → writeNudgeEvidence → pending_evidence.jsonl
  ↓ sink.markModeDirty() → dirty_state.json
  ↓ 同步返回空数组（不弹 toast）
  ↓
[2] SDK query（LLM 对话）
  ↓ system prompt 含 MEMORY_MANAGEMENT_RULES 禁止 LLM 写记忆
  ↓ autoMemoryDirectory 重定向到 /tmp/ 废目录兜底
  ↓
[3] 会话流结束 → completeRun → recordSession
  ↓ 本地写入 L4 sessions.db（keyFacts 暂空）
  ↓ memoryEvidenceSink.writeSessionEvidence() → pending_evidence.jsonl
  ↓ sink.markModeDirty() → dirty_state.json
  ↓
  ↓（前台结束，不做任何 LLM 调用）
  ↓
[4] 空闲窗口 → idle-memory-consolidation-scheduler 每 60s 扫描
  ↓ hasActiveForeground() = false
  ↓ runIfEligible('general') → runIfEligible('ta')（串行）
  ↓
[5] MemoryConsolidationService
  ↓ 检查 dirty + evidence + silence + debounce + lease + budget
  ↓ consumePendingEvidence → 读取增量证据
  ↓ executeConsolidation → 一次 Provider 请求 → BatchOutput
  ↓ 持久化 pendingApplication（在 apply 之前）
  ↓ applyBatchOutput:
  ↓   sessionKeyFacts → UPDATE L4 key_facts（幂等）
  ↓   memoryCandidates → enqueueStage → stage queue（ID 由 batchId+序号稳定生成）
  ↓   insights + contradictions → reflectService.applyConsolidationInsights（纯本地，anti-echo）
  ↓     contradictions → corrections.jsonl（L3，带 evidenceIds + existingId provenance）
  ↓ consumeProcessedEvidence → 按 ID 精确删除已处理条目（temp+rename 原子替换）
  ↓ 推进 cursor，记录 outcome（success/failed/skipped_*）
  ↓
[每日] Scheduled Cleanup → L4 归档 + L3 压缩 + FTS5 重建
[每月] Self-Repair → L3 命中率 + L5 反向引用 + L0 跨模式 + 月度报告
```

## 跨模式隔离

- 通用模式：`~/.tagent[-dev]/memory/`
- TA 模式：`~/.tagent[-dev]/ta/memory/`
- 两套完全独立，L0 默认不共享（可选开关）
- L4 FTS5 全文搜索跨模式可见（设计要求）
- 空闲整理 general 与 ta 串行执行，全局 lease 确保任意时刻最多一个 batch

## 关键文件

| 文件 | 职责 |
|---|---|
| `apps/electron/src/main/lib/nudge-service.ts` | Nudge 检测 + 候选生成（4 模式 + 冷却 + 跨 session 去重 + 结构化元数据） |
| `apps/electron/src/main/lib/memory-evidence-sink.ts` | 证据暂存层（ADR-0006 Phase 1）：前台本地写入 Nudge 候选 + session 证据到 `pending_evidence.jsonl`，标记 dirty，不调用 LLM |
| `apps/electron/src/main/lib/memory-consolidation-service.ts` | 空闲批量整理核心（ADR-0006 Phase 2）：单次 LLM 请求完成 keyFacts + candidates + insights + contradictions，幂等写入，持久化本地重放（apply/consume 失败后以零请求重放） |
| `apps/electron/src/main/lib/idle-memory-consolidation-scheduler.ts` | 空闲调度器（ADR-0006 Phase 2）：60s 扫描间隔（`setTimeout` 递归），general/ta 串行，前台活跃检测，rollout flag `TAGENT_IDLE_MEMORY_CONSOLIDATION` 控制 |
| `apps/electron/src/main/lib/reflect-service.ts` | Legacy Reflect（flag 关闭时独立 LLM 调用）+ applyConsolidationInsights（flag 开启时纯本地写入 L5） |
| `apps/electron/src/main/lib/scheduled-cleanup-service.ts` | 每周清理（L4 归档 / L3 压缩 / FTS5 重建） |
| `apps/electron/src/main/lib/self-repair-service.ts` | 每月 Self-Repair（L3 命中率 / L5 反向引用 / L0 跨模式） |
| `apps/electron/src/main/lib/memory-layer-service.ts` | L0-L5 文件读写 + L4 SQLite + FTS5 + SDK auto-memory 废目录 |
| `apps/electron/src/main/lib/agent-prompt-builder.ts` | `MEMORY_MANAGEMENT_RULES` 反向指令（禁止 LLM 写记忆） |
| `apps/electron/src/main/lib/agent-orchestrator.ts` | Nudge 检测入口 + recordSession + evidence 写入触发（不再触发 backfillKeyFacts） |
| `apps/electron/src/renderer/components/memory/NudgeToast.tsx` | toast UI（玻璃卡片 + 记住/不记按钮） |
| `apps/electron/src/renderer/components/memory/MemoryMonitorPanel.tsx` | 记忆页面（6 层时间线卡片 + 左栏会话搜索） |
| `apps/electron/src/renderer/components/memory/MemoryRailContent.tsx` | 左栏（FTS5 会话搜索 + 联动主区） |

## 实现状态

| 机制 | 状态 |
|---|---|
| L0-L5 写入 | ✅ 全部落地 |
| Nudge（4 模式 + 冷却 + 跨 session 去重 + 结构化元数据 + 证据暂存） | ✅ |
| 证据暂存层（`MemoryEvidenceSink`） | ✅ Phase 1 |
| 空闲批量整理（`MemoryConsolidationService` + `IdleConsolidationScheduler`） | ✅ Phase 2（dev 默认开启） |
| Reflection 合并到批量整理 + legacy 路径保留 | ✅ Phase 3 |
| 持久化本地重放（persisted-local-replay） | ✅ |
| 批量写入幂等性 + 按 ID 精确消费 | ✅ |
| ActivityAt 时间定义 + 增量游标 | ✅ |
| Phase 4：Memory Monitor UI（每模式状态/输入输出/预算/跳过原因 + 手动入口） | ⏳ 待实现 |
| Scheduled Cleanup（L4 归档 + L3 压缩 + FTS5 重建 + LRU） | ✅ |
| Self-Repair（4 子任务 + 月度报告） | ✅ |

**未做的**（非核心，v1.6+ 可选）：
- Phase 4 Memory Monitor UI + 手动"立即整理"入口
- L0 双视图（global_view + peer_view，当前只有单视图）
- Memory Graph 可视化（`docs/plans/2026-07-03-hermes-borrow-plan.md` §3.8）
- Skill Curator 自进化（`docs/plans/2026-07-03-hermes-borrow-plan.md` §3.5）
- L0 跨模式"共享"开关 UI（设计 §6.5.8，当前两套完全独立）

## 关联文档

- `docs/plans/2026-06-05-tagent-fusion-design.md` §6.5 — 设计意图（1160 行设计细节）
- `docs/decisions/0006-idle-memory-consolidation-and-reflection-reliability.md` — 空闲批量整理 + Reflection 可靠性 ADR
- `docs/plans/2026-07-03-hermes-borrow-plan.md` §5.2 — v1.5 主线（Nudge 写入升级 / Memory Graph / Skill Curator）
- `docs/plans/2026-07-05-agent-stability-issues-diagnosis.md` §8 — Nudge toast 不弹根因修复记录
- `packages/ui/DESIGN.md` — `session-glass-toast` 玻璃类样式规范

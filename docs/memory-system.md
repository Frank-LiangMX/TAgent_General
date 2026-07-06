# TAgent 记忆系统

> 记忆系统是 TAgent 的核心机制之一。本文档记录 5 层结构 + 4 个自进化机制的**实现现状**（不是设计意图，设计见 `docs/plans/2026-06-05-tagent-fusion-design.md` §6.5）。

## 设计原则

**LLM 永远不主动写记忆文件**。所有记忆写入由 Nudge 系统 + Reflect 服务控制，避免 LLM 乱写污染记忆。

SDK auto-memory（Claude Agent SDK 内置）通过双防线屏蔽：
1. **system prompt 反向指令**（`agent-prompt-builder.ts` 的 `MEMORY_MANAGEMENT_RULES`）禁止 LLM 用 Write 工具写记忆 .md 文件
2. **`autoMemoryDirectory` 重定向**（`memory-layer-service.ts` 的 `getDiscardedMemoryDir`）到 `/tmp/tagent-discarded-memory/` 废目录兜底——万一 LLM 不听话也不污染 `~/.tagent/memory/`

## 5 层结构

| 层 | 文件 | 内容 | 写入触发 | 自动化 |
|---|---|---|---|---|
| **L0** 用户画像 | `L0_user.md` | 用户偏好（"不要 emoji" / "保持简洁"） | Nudge `behavior_repeat` + 用户确认 | 半自动 |
| **L1** 项目画像 | `L1_project.md` | 项目模板（同一 workspace 多次会话） | Nudge `project_repeat` + 用户确认 | 半自动 |
| **L2** 稳定事实 | `L2_facts.md` | 稳定事实（"我叫 Frank" / "我用 Mac"） | Nudge `fact_repeat` + 用户确认 | 半自动 |
| **L3** 纠错记录 | `corrections.jsonl` + `rules.json` | 纠错（"不是 X，是 Y"）+ 矛盾洞察 | Nudge `correction` 自动 accept + Reflect `contradiction_check` | 全自动 |
| **L4** 历史会话 | `sessions.db`（SQLite + FTS5） | 会话元数据（title/summary/keyFacts/toolsUsed） | `recordSession` 每次会话流结束自动 | 全自动 |
| **L5** 提炼洞察 | `L5_insights.md` | 高阶洞察（抽象结论） | Reflect LLM 每日提炼 | 全自动 |

### L0-L2 写入格式（结构化元数据）

```
- [2026-07-06] 我叫frank <!-- hit:3 last_ref:2026-07-06 src:abc12345 -->
```

- `hit` — 引用次数（去重写入时累加）
- `last_ref` — 最后引用日期（YYYY-MM-DD）
- `src` — 来源会话 ID 前 8 位

元数据用 HTML 注释，markdown 渲染器忽略，人类仍可读。**去重写入**：pattern 已存在则更新 `hit` + `last_ref`，不重复写。供 LRU / Self-Repair 使用。

## 4 个自进化机制

### 1. Nudge（每 1 turn 检测）

每次 LLM 调用前触发（`agent-orchestrator.ts` 的 `sendMessage` 内），检测 4 种模式：

| 模式 | 触发条件 | 目标层 | 询问方式 |
|---|---|---|---|
| `behavior_repeat` | 同一偏好表述 ≥2 次（"不要 emoji"等） | L0 | toast 询问 |
| `fact_repeat` | 事实表述 ≥1 次（"我叫 X" / "我喜欢 X"） | L2 | toast 询问 |
| `correction` | 显式纠正（"不是 X，是 Y"） | L3 | **自动写，不问** |
| `project_repeat` | 同一 workspace ≥2 个会话（跨 session） | L1 | toast 询问 |

**冷却**（按 sessionId 隔离）：
- L0 = 5 turn
- L1 = 10 turn
- L2 = 3 turn
- L3 = 20 turn

**跨 session 去重**（`project_repeat` 专用）：检测前查 L1_project.md（已存为模板）+ `nudges/rejected.jsonl`（已拒绝）的 workspace slug，已处理过的不再触发。

**toast**：右上角玻璃卡片（24px 圆角，`session-glass-toast` 类），"记住"/"不记"按钮，5s 自动消失。`correction` 类型自动调 `accept`。

### 2. Reflect（每日 03:00 + 启动时 >36h）

从 L2_facts + L4_sessions 提炼洞察写入 L5：

- **LLM 提炼**：复用主会话默认渠道（`settings.agentChannelId` / `agentModelId`），prompt 要求抽象结论（不是事实复述）+ 跨 session 共性 + JSON 输出
- **anti_echo_filter**：与现有 L5 关键词重叠 ≥50% 则过滤
- **contradiction_check**：与现有 L5 矛盾的洞察写入 L3 corrections（不写 L5）
- **fallback**：kscc 渠道（CLI 不支持 SSE）/ LLM 失败 → 回退规则版关键词计数，保证 Reflect 不阻塞

**L4 keyFacts 回填**：会话流结束后 fire-and-forget 调 LLM 提炼 1-3 个 keyFacts，UPDATE L4 sessions.db 的 `key_facts` 字段。LLM 不可用时静默跳过，keyFacts 保持空数组。

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
  ↓ 检测到候选 → IPC 推送到主窗口 → toast 询问
  ↓ 用户点"记住" → writeToLayer → 结构化写入 L0/L1/L2（带 hit/last_ref/src 元数据）
  ↓ correction 类型 → 自动 accept → 写 L3
  ↓
[2] SDK query（LLM 对话）
  ↓ system prompt 含 MEMORY_MANAGEMENT_RULES 禁止 LLM 写记忆
  ↓ autoMemoryDirectory 重定向到 /tmp/ 废目录兜底
  ↓
[3] 会话流结束 → recordSession → L4 sessions.db（keyFacts 暂空）
  ↓
[4] fire-and-forget backfillKeyFacts → LLM 提炼 → UPDATE L4 key_facts
  ↓
[每日 03:00] Reflect → LLM 提炼 L2/L4 → L5_insights（含 anti_echo + contradiction_check）
[每周日 04:00] Scheduled Cleanup → L4 归档 + L3 压缩 + FTS5 重建
[每月 1 日] Self-Repair → L3 命中率 + L5 反向引用 + L0 跨模式 + 月度报告
```

## 跨模式隔离

- 通用模式：`~/.tagent[-dev]/memory/`
- TA 模式：`~/.tagent[-dev]/ta/memory/`
- 两套完全独立，L0 默认不共享（可选开关）
- L4 FTS5 全文搜索跨模式可见（设计要求）

## 关键文件

| 文件 | 职责 |
|---|---|
| `apps/electron/src/main/lib/nudge-service.ts` | Nudge 检测 + 候选生成 + 写入 L0-L3 |
| `apps/electron/src/main/lib/reflect-service.ts` | Reflect LLM 提炼 + keyFacts 回填 |
| `apps/electron/src/main/lib/scheduled-cleanup-service.ts` | 每周清理（L4 归档 / L3 压缩 / FTS5 重建） |
| `apps/electron/src/main/lib/self-repair-service.ts` | 每月 Self-Repair（L3 命中率 / L5 反向引用 / L0 跨模式） |
| `apps/electron/src/main/lib/memory-layer-service.ts` | L0-L5 文件读写 + L4 SQLite + FTS5 + SDK auto-memory 废目录 |
| `apps/electron/src/main/lib/agent-prompt-builder.ts` | `MEMORY_MANAGEMENT_RULES` 反向指令（禁止 LLM 写记忆） |
| `apps/electron/src/main/lib/agent-orchestrator.ts` | Nudge 检测入口 + recordSession + keyFacts 回填触发 |
| `apps/electron/src/renderer/components/memory/NudgeToast.tsx` | toast UI（玻璃卡片 + 记住/不记按钮） |
| `apps/electron/src/renderer/components/memory/MemoryMonitorPanel.tsx` | 记忆页面（6 层时间线卡片 + 左栏会话搜索） |
| `apps/electron/src/renderer/components/memory/MemoryRailContent.tsx` | 左栏（FTS5 会话搜索 + 联动主区） |

## 实现状态

| 机制 | 状态 |
|---|---|
| L0-L5 写入 | ✅ 全部落地 |
| Nudge（4 模式 + 冷却 + 跨 session 去重 + 结构化元数据） | ✅ |
| Reflect（LLM 提炼 + anti_echo + contradiction_check + keyFacts 回填） | ✅ |
| Scheduled Cleanup（L4 归档 + L3 压缩 + FTS5 重建 + LRU） | ✅ |
| Self-Repair（4 子任务 + 月度报告） | ✅ |

**未做的**（非核心，v1.6+ 可选）：
- L0 双视图（global_view + peer_view，当前只有单视图）
- Memory Graph 可视化（`docs/plans/2026-07-03-hermes-borrow-plan.md` §3.8）
- Skill Curator 自进化（`docs/plans/2026-07-03-hermes-borrow-plan.md` §3.5）
- L0 跨模式"共享"开关 UI（设计 §6.5.8，当前两套完全独立）

## 关联文档

- `docs/plans/2026-06-05-tagent-fusion-design.md` §6.5 — 设计意图（1160 行设计细节）
- `docs/plans/2026-07-03-hermes-borrow-plan.md` §5.2 — v1.5 主线（Nudge 写入升级 / Memory Graph / Skill Curator）
- `docs/plans/2026-07-05-agent-stability-issues-diagnosis.md` §8 — Nudge toast 不弹根因修复记录
- `packages/ui/DESIGN.md` — `session-glass-toast` 玻璃类样式规范

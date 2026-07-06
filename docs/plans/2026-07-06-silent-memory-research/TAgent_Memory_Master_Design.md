# TAgent 记忆系统改造总设计

> 本文档是 TAgent 记忆系统改造的**唯一权威设计文档**，整合了层级结构、文件清单、初始化、流程、膨胀控制、自进化、清理机制所有内容。
>
> **创建时间**：2026-07-06
> **基于源码事实**：当前 L0-L5 六层定义齐全，但实际只有 L4 在工作（71 条会话）
> **痛点来源**：Nudge 修好后 toast 频繁弹窗，打扰用户工作流
> **核心目标**：静默记忆 + 不破坏 Prompt Cache + 可控膨胀

---

## 一、改造后的层级结构：仍是 L0-L5 六层

**结论**：保持 L0-L5 六层不变，但重新定义每层职责 + 引入 L1 索引角色 + 新增 stage 队列文件。

### 1.1 改造前后对比

| 层 | 改造前职责 | 改造后职责 | 变化 |
|---|---|---|---|
| **L0** 用户画像 | `L0_user.md` 用户偏好 | 同前 + 带 `source_msgs` 追溯 | 加追溯字段 |
| **L1** 项目画像 | `L1_project.md` 项目模板 | **合并索引角色**：项目画像 + L1 索引（≤30 行硬约束） | 合并角色 |
| **L2** 稳定事实 | `L2_facts.md` 稳定事实 | 同前 + 带 `source_msgs` 追溯 | 加追溯字段 |
| **L3** 纠错记录 | `corrections.jsonl` + `rules.json` | 同前 | 不变 |
| **L4** 历史会话 | `sessions.db`（SQLite + FTS5） | 同前 + `msg_id` 索引 + **会话合并 + 分级存储**（详见 §七） | 加 msg_id + 合并 |
| **L5** 提炼洞察 | `L5_insights.md` 高阶洞察 | 同前 | 不变 |

### 1.2 新增文件（不在层级内）

| 文件 | 用途 |
|---|---|
| `pending_approval.jsonl` | stage 队列：background nudge 写入暂存，等用户审批 |
| `nudges/drift_backup/` | drift 检测失败时的 `.bak` 备份目录 |
| `nudges/rejected.jsonl` | 已有，用户拒绝记录 |
| `nudges/deferred.jsonl` | 已有，用户延后记录 |
| `sessions_archive.db` | L4 归档库（>30 天移过来） |
| `L5_archive.md` | L5 孤儿洞察 archive |
| `corrections_archive.jsonl` | L3 压缩 archive |

### 1.3 为什么不引入 L1.5 / Mermaid 符号层

TencentDB 有 L1.5 任务切换判定 + Mermaid node_id 符号化（节省 61% token），但：
- TAgent 是对话型 Agent，不是长任务 Agent
- 长任务工具日志 offload 在 TAgent 场景回本困难
- 复杂度高，v1.5 不引入，未来 v2.0 评估

---

## 二、记忆文件清单（改造后完整版）

### 2.1 通用模式（`~/.tagent[-dev]/memory/`）

| 文件 | 格式 | 创建时机 | 内容 |
|---|---|---|---|
| `L0_user.md` | Markdown | **session 1 启动时** eager 创建 | 用户偏好（"不要 emoji" / "保持简洁"） |
| `L1_project.md` | Markdown | **session 1 启动时** eager 创建 | 项目画像 + L1 索引（≤30 行） |
| `L2_facts.md` | Markdown | **session 1 启动时** eager 创建 | 稳定事实（"我叫 Frank"） |
| `corrections.jsonl` | JSONL | **首次纠正时** lazy 创建 | 纠错记录 |
| `rules.json` | JSON | **首次 Reflect 提炼规则时** lazy 创建 | 纠错规则 |
| `sessions.db` | SQLite + FTS5 | **app 启动时** eager 创建 | L4 活跃会话（详见 §七） |
| `sessions_archive.db` | SQLite | **首次归档时** lazy 创建 | L4 归档库（>30 天） |
| `L5_insights.md` | Markdown | **首次 Reflect 提炼时** lazy 创建 | L5 高阶洞察 |
| `L5_archive.md` | Markdown | **首次 L5 反向引用 archive 时** lazy 创建 | L5 孤儿洞察 |
| `corrections_archive.jsonl` | JSONL | **首次 L3 压缩时** lazy 创建 | L3 旧条目 |
| `pending_approval.jsonl` | JSONL | **首次 stage 写入时** lazy 创建 | stage 待审批队列 |
| `nudges/rejected.jsonl` | JSONL | **首次拒绝时** lazy 创建 | 用户拒绝记录 |
| `nudges/deferred.jsonl` | JSONL | **首次延后时** lazy 创建 | 用户延后记录 |
| `nudges/drift_backup/` | 目录 | **首次 drift 失败时** lazy 创建 | `.bak` 备份 |
| `cleanup_state.json` | JSON | 已有 | Scheduled Cleanup 状态 |
| `reflect_state.json` | JSON | 已有 | Reflect 状态 |
| `self_repair_state.json` | JSON | 已有 | Self-Repair 状态 |

### 2.2 TA 模式（`~/.tagent[-dev]/ta/memory/`）

完全独立的一套，结构与通用模式相同。

### 2.3 SDK auto-memory 废目录（`/tmp/tagent-discarded-memory/`）

LLM 不听话主动写记忆时的兜底废目录，不污染 `~/.tagent[-dev]/memory/`。

---

## 三、初始化时机

### 3.1 三档初始化策略

| 时机 | 创建什么 | 现状 | 改造后 |
|---|---|---|---|
| **App 启动时**（`MemoryLayerService.initialize`） | 目录 + L4 SQLite + 状态文件 | ✅ 已实现 | 不变 |
| **Session 1 启动时** | L0/L1/L2 md 空文件（带 header） | ❌ 未实现 | **新增 eager 创建** |
| **首次写入时**（lazy） | L3/L5/pending_approval/nudges 子目录 | ✅ 已实现 | 不变 |

### 3.2 为什么 L0/L1/L2 要 eager 创建

**现状问题**：L0/L1/L2 从未创建，原因是 Nudge toast 路径从未跑通 → writeToLayer 从未触发 → 文件不存在。

**改造后**：session 1 启动时 eager 创建空文件（带 header），保证：
1. Frozen snapshot 注入时文件存在，不会因 `fs.existsSync` 返回 false 跳过注入
2. 记忆页面 `getStats` 不再返回 `{exists: false}`，UI 不显示空状态
3. 用户可以手动编辑空文件初始化偏好（不依赖 Nudge）

### 3.3 eager 创建的实现

**改动文件**：`memory-layer-service.ts` 的 `initialize()` 方法

```typescript
initialize(options?) {
  // 1. 创建目录（已有）
  // 2. 初始化 L4 SQLite（已有）
  // 3. 新增：创建 L0/L1/L2 空文件（带 header）
  this.ensureLayerFiles('general')
  this.ensureLayerFiles('ta')
  // 4. 新增：创建 nudges 子目录
  this.ensureNudgesDir('general')
  this.ensureNudgesDir('ta')
}

private ensureLayerFiles(mode: MemoryMode) {
  const dir = getMemoryDir(mode)
  const files = [
    { name: 'L0_user.md', header: '# User Profile\n\n> 用户画像（半自动写入）\n' },
    { name: 'L1_project.md', header: '# Project Profile & Index\n\n> 项目画像 + 索引层（≤30 行）\n' },
    { name: 'L2_facts.md', header: '# Facts\n\n> 稳定事实（半自动写入）\n' },
  ]
  for (const { name, header } of files) {
    const filePath = path.join(dir, name)
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, header, 'utf-8')
    }
  }
}
```

### 3.4 初始化时间线

```
App 首次启动
  ↓
MemoryLayerService.initialize()
  ↓
创建 ~/.tagent[-dev]/memory/ 目录
  ↓
创建 L4 sessions.db（schema + FTS5 + 触发器）
  ↓
【新增】创建 L0_user.md / L1_project.md / L2_facts.md（带 header）
  ↓
【新增】创建 nudges/ 子目录
  ↓
创建状态文件
  ↓
App 启动完成

用户开第一个 session
  ↓
Frozen snapshot 注入 L0/L1/L2 内容到 system prompt（此时是空内容）
  ↓
用户对话 → 每 10 轮触发 fork review
  ↓
fork review 判断"值得记" → 进 stage 队列
  ↓
用户审批 → patch 写入 L0/L1/L2
  ↓
写入成功，但 system prompt 不变（Frozen snapshot）
  ↓
下一 session 启动 → 重新注入 L0/L1/L2（此时有内容）
```

---

## 四、端到端流程（改造后）

### 4.1 完整流程

```
用户发消息 → Agent 正常回复（记忆系统后台悄悄干活）
  ↓
turn 计数器 +1
  ↓
检查是否触发 review（warm-up 序列：1→2→4→8→10→10...）
  ↓
未触发 → 正常对话
触发 ↓
spawn 后台 fork agent（_persist_disabled=True, skip_memory=True）
  ↓
fork agent 重放本 session 对话 + 喂 review prompt
  ↓
LLM 自主判断：
  ├─ "Nothing to save" → 退出，什么都不做 ✅ 合法退出
  └─ "值得记" → 输出记忆候选（带 source_message_ids）
                  ↓
              进入写入门控
                  ↓
              ┌─ foreground origin（用户主动） → allow → 立即写盘
              ├─ background origin（fork agent）→ stage → 进 pending_approval.jsonl
              └─ drift 检测失败              → blocked → 拒绝 + .bak 备份
                  ↓
              [allow 路径] / [stage 路径等用户审批后]
                  ↓
              两阶段去重：
                  ├─ 阶段 1：FTS5 BM25 召回 top-K 候选
                  └─ 阶段 2：LLM 批量判定 store/update/merge/skip
                  ↓
              禁易变状态白名单校验（时间戳/PID/SessionID/绝对路径）
                  ↓
              校验通过 → patch-only 写入（add/replace/remove）
                  ↓
              写入 L0/L1/L2 对应文件（带 source_msgs 标签）
                  ↓
              【Frozen Snapshot】写盘成功，不改 system prompt
                  ↓
              下一 session 启动 → 重新注入 L0/L1/L2（含新记忆）

═══════════════════════════════════════════
【并行：L4 链路】（详见 §七）
═══════════════════════════════════════════
用户每发消息 + Agent 回复
  ↓
会话合并（同主题 30 分钟内合并为一条）
  ↓
recordSession → L4 sessions.db（msg_id 索引）
  ↓
会话流结束 → fire-and-forget backfillKeyFacts
  ↓
LLM 提炼 keyFacts → UPDATE L4 key_facts 字段

═══════════════════════════════════════════
【并行：定时任务】
═══════════════════════════════════════════
每日 03:00 Reflect → LLM 提炼 L2/L4 → L5_insights.md
每周日 04:00 Scheduled Cleanup → L4 归档 + L3 压缩 + FTS5 重建 + L1 ROI 清理 + pending reject
每月 1 日 Self-Repair → L3 命中率 + L5 反向引用 + L0 跨模式 + PersonaTrigger
```

### 4.2 关键环节的兜底机制

| 环节 | 兜底 | 失败后果 |
|---|---|---|
| fork agent 超时 | 60s 超时 force-settle | 不阻塞主对话 |
| 两阶段去重 LLM 失败 | 降级为 FTS5 去重 + 默认 store | 写入不卡 |
| 召回超时 | 5s 超时跳过注入 | 不阻塞对话 |
| drift 检测失败 | blocked + `.bak` 备份 | 不覆盖外部修改 |
| L1 膨胀 | ROI 清理 + ≤30 行硬约束 | 自动 GC |
| 记忆文件被删 | PersonaTrigger 自修复 | 自动重建 |
| L4 膨胀 | 30 天归档 + 90 天标 old | 详见 §七 |

### 4.3 验收场景（10 个）

| # | 场景 | 预期行为 |
|---|---|---|
| 1 | App 首次启动 | L0/L1/L2 md 文件创建（带 header） |
| 2 | 用户说"我叫 Frank" | 当轮不弹窗，10 轮后 fork review 判断是否值得记 |
| 3 | fork 判断"值得记" | 进 pending_approval.jsonl，不打扰用户 |
| 4 | 用户打开记忆页面 | 看到"待审批 1 条" |
| 5 | 用户点"接受" | 写入 L2_facts.md，带 source_msgs 标签 |
| 6 | 用户再开新 session | system prompt 注入"我叫 Frank" |
| 7 | 用户纠正矛盾 | drift 检测 → 弹窗（唯一弹窗场景） |
| 8 | 用户手动改 L0_user.md | 下次 Agent 写入时 drift 检测 + backup |
| 9 | Reflect 每日 03:00 触发 | L5_insights.md 生成 |
| 10 | 记忆文件被误删 | PersonaTrigger 自修复重建 |

---

## 五、改造前后对比

### 5.1 文件层面

| 维度 | 改造前 | 改造后 |
|---|---|---|
| L0/L1/L2 创建时机 | lazy（从未创建） | eager（session 1 启动时） |
| L0/L1/L2 内容追溯 | 无 source_msgs | 带 source_message_ids |
| L1 角色 | 项目画像 | 项目画像 + 索引层（≤30 行） |
| L4 msg_id 索引 | 无 | 有（追溯链底层） |
| L4 会话合并 | 无（每用户消息一条） | 有（同主题 30 分钟内合并） |
| L4 分级存储 | 单库 | 活跃库 + 归档库 |
| stage 队列 | 无 | pending_approval.jsonl |
| drift 备份 | 无 | nudges/drift_backup/ |

### 5.2 流程层面

| 维度 | 改造前 | 改造后 |
|---|---|---|
| 检测频率 | 每 1 turn | 每 10 轮 user turn（warm-up 1→2→4→8→10） |
| 检测方式 | pattern 硬编码 + LLM 推测 | 后台 fork agent + LLM 自主判断 |
| 写入决策 | 三档置信度（自创） | 写入门控三态（Hermes 借鉴） |
| 用户感知 | 频繁 toast 弹窗 | 全静默 + stage 待审批 |
| Prompt Cache | 标签升级破坏 cache | Frozen snapshot 保 cache |
| 写入方式 | 整文件 overwrite | patch-only（add/replace/remove） |
| 去重 | 硬编码冲突对子 | 两阶段去重（FTS5 + LLM） |
| 追溯 | 无 | source_message_ids 全链追溯 |

### 5.3 风险点

| 风险 | 严重度 | 缓解 |
|---|---|---|
| Frozen snapshot 导致记忆不及时 | ⚠️ 中 | drift 检测兜底关键修正即时刷新 |
| stage 队列堆积 | ⚠️ 中 | UI 提示 + 30 天未审批自动 reject |
| L1 ≤30 行约束被 LLM 突破 | ⚠️ 中 | ROI 清理 + 工具层校验 |
| fork agent 污染真实 session DB | 🔴 高 | `_persist_disabled=True` + `skip_memory=True` |
| 两阶段去重 LLM 判定失败 | ⚠️ 中 | 降级 FTS5 去重 + 默认 store |
| L4 一天大量会话 | 🔴 高 | 会话合并 + 分级存储（详见 §七） |

---

## 六、膨胀控制 + 自进化 + 清理机制

### 6.1 每层膨胀风险评估

| 层 | 膨胀风险 | 增长来源 | 上限 | 清理机制 |
|---|---|---|---|---|
| **L0** 用户画像 | ⚠️ 中 | 用户偏好追加 | 软约束 | ROI 清理 + drift 合并 |
| **L1** 项目画像 + 索引 | 🔴 高 | 项目模板 + 索引指针 | **≤30 行硬约束** | ROI 清理 + 存在性编码 |
| **L2** 稳定事实 | ⚠️ 中 | fact_repeat 累积 | 软约束 | LRU + 反向引用验证 |
| **L3** 纠错记录 | 🔴 高 | append-only | raw >1000 条触发 | 压缩保留最近 500 条 |
| **L4** 历史会话 | 🔴 高 | 每会话一条 | 无硬上限 | **会话合并 + 30 天归档 + 90 天标 old**（§七） |
| **L5** 提炼洞察 | ⚠️ 中 | 每日 Reflect 追加 | 软约束 | anti_echo + 反向引用 |
| **pending_approval** | ⚠️ 中 | stage 队列累积 | 无硬上限 | 30 天未审批自动 reject |

### 6.2 自进化机制（5 个）

| 机制 | 频率 | 借鉴来源 | 防止膨胀 |
|---|---|---|---|
| **写入时自进化** | 每次写入 | TencentDB 两阶段去重 + GenericAgent 禁易变 + Hermes drift | 重复记忆 / 错误记忆 / 外部篡改 |
| **Nudge 自进化** | 每 10 轮 | Hermes Turn-based Nudge | 无意义记忆（"Nothing to save" 过滤） |
| **Reflect 自进化** | 每日 03:00 | 已有 + 增强 L5 反向引用 | L5 重复（anti_echo）+ L5 矛盾（→ L3） |
| **Scheduled Cleanup** | 每周日 04:00 | 已有 + 新增 L1 ROI + pending reject | L4 + L3 + L1 + pending 膨胀 |
| **Self-Repair** | 每月 1 日 | 已有 + 新增 PersonaTrigger + L1 幽灵指针 | L3 stale + L5 孤儿 + L0 分裂 + 文件丢失 |

### 6.3 清理机制矩阵（按层 × 时机）

| 层 | 写入时 | 每日 | 每周 | 每月 |
|---|---|---|---|---|
| **L0** | 两阶段去重 + drift | - | ROI 清理 | 跨模式一致性 |
| **L1** | ≤30 行硬约束 + patch-only | - | **ROI 清理**（新增） | **索引完整性**（新增） |
| **L2** | 两阶段去重 + drift | - | LRU 标记 | 反向引用验证 |
| **L3** | appendCorrection | - | raw >1000 → 500 | 命中率统计 + stale |
| **L4** | recordSession + **会话合并**（新增） | backfillKeyFacts | **30 天归档 + 90 天 old** | - |
| **L5** | - | anti_echo + contradiction_check | - | 反向引用 archive |
| **pending** | stage 入队 | - | **30 天自动 reject**（新增） | - |

### 6.4 关键膨胀兜底详解

#### 6.4.1 L1 ≤30 行硬约束（借鉴 GenericAgent）

**问题**：L1 是索引层，无约束会无限膨胀。

**机制**：
- **硬约束**：≤30 行（工具层校验，超限拒绝写入）
- **软约束**：<1k tokens（期望值）
- **存在性编码**：只放反直觉触发词（2-4 字），禁写机制/方法/步骤
- **判定法**：假设用户说出这个词能否想到查 SOP？能→删，不能→留

**清理**：每周 ROI 清理，ROI 低 → 标 stale → Self-Repair 时 archive

#### 6.4.2 L3 压缩（已有）

**机制**：raw >1000 条 → 保留最近 500 条，旧条目 archive 到 `corrections_archive.jsonl`

#### 6.4.3 L4 归档（已有 + 增强，详见 §七）

**机制**：
- 会话合并（同主题 30 分钟内合并为一条）
- >30 天 → 移到 `sessions_archive.db`
- >90 天 → 标 old（FTS5 搜索降权）

#### 6.4.4 pending_approval 自动 reject（新增）

**机制**：30 天未审批 → 自动 reject，记录到 `nudges/rejected.jsonl`（带 reason: "auto_rejected_30d"）

#### 6.4.5 L5 anti_echo + 反向引用（已有 + 增强）

**机制**：
- **anti_echo_filter**：与现有 L5 关键词重叠 ≥50% 则过滤
- **反向引用验证**：每条 L5 提取关键词检查 L2/L4 是否还有相关内容
  - 原始引用都删除 → archive 到 `L5_archive.md`
  - 保留可追溯性（archive 不删）

---

## 七、L4 会话存储策略（解决"一天大量会话"）

### 7.1 现状问题

**当前行为**（源码事实）：
- `agent-orchestrator.ts:1449` 每个 user turn 触发一次 `recordSession`
- 实测 71 条会话中，每条 title 都是"项目根目录:..."这种任务开头
- 说明你用的是看板派发子任务模式，每个 worker 子任务都写一条 L4
- **一天可以轻松几十条会话**

**问题**：
1. **存储膨胀**：一天 50 条会话，一年 18000 条，L4 单库会非常臃肿
2. **检索质量下降**：FTS5 全文搜索在大量短会话中召回质量降低
3. **Reflect 提炼困难**：每日 Reflect 要从几十条会话中提炼 keyFacts，LLM 成本高
4. **记忆页面 UX 差**：用户看到 71 条会话列表，找不到关键对话

### 7.2 改造后策略：会话合并 + 分级存储

#### 7.2.1 会话合并（同主题 30 分钟内合并为一条）

**机制**：

```
用户发消息 → recordSession 检查
  ↓
是否同主题（同 workspace_slug + 同 mode + 时间间隔 <30 分钟）？
  ├─ 是 → UPDATE 现有会话：追加 messages + 更新 ended_at + 合并 toolsUsed
  └─ 否 → INSERT 新会话
```

**合并条件**（4 个全部满足）：
1. 同 `workspace_slug`（同工作区）
2. 同 `mode`（同 general / ta）
3. 同 `session_slug` 前缀（同会话家族）
4. `created_at` 与上一条间隔 <30 分钟

**效果**：
- 一天原本 50 条 → 合并为 5-10 条主题会话
- 每条会话包含多轮对话（messages 字段）
- title 取首条用户消息前 100 字
- summary 取最后一条 assistant 文本前 500 字
- toolsUsed 合并所有 turn 的工具去重

#### 7.2.2 分级存储（活跃库 + 归档库）

**机制**：

```
sessions.db（活跃库）
  ↓ >30 天
sessions_archive.db（归档库）
  ↓ >180 天
可选删除（默认保留）
```

**分级**：

| 级别 | 库 | 时机 | 行为 |
|---|---|---|---|
| **活跃** | `sessions.db` | 0-30 天 | 全功能（FTS5 搜索 + 完整字段） |
| **归档** | `sessions_archive.db` | 30-180 天 | 只读 + 降权搜索（FTS5 命中权重 ×0.5） |
| **冷归档** | `sessions_archive.db` 标 old | >180 天 | 仅按需召回（不参与默认搜索） |

**优势**：
- 活跃库保持小（30 天内会话，假设一天 10 条 = 300 条），FTS5 搜索快
- 归档库只读，不污染活跃搜索结果
- 冷归档标 old，默认不召回，需要时显式查询

#### 7.2.3 L4 schema 增强

**现有 schema**（已实现）：
```sql
CREATE TABLE sessions (
  id, session_slug, title, summary, key_facts, tools_used,
  mode, workspace_slug, created_at, ended_at
)
```

**改造后 schema**（新增 4 个字段）：
```sql
ALTER TABLE sessions ADD COLUMN message_count INTEGER DEFAULT 0;
ALTER TABLE sessions ADD COLUMN msg_ids TEXT DEFAULT '[]';       -- JSON array of msg_id
ALTER TABLE sessions ADD COLUMN parent_session_id TEXT;          -- 会话合并的父会话
ALTER TABLE sessions ADD COLUMN is_archived INTEGER DEFAULT 0;   -- 0=活跃, 1=归档
ALTER TABLE sessions ADD COLUMN is_old INTEGER DEFAULT 0;        -- 0=正常, 1=冷归档
```

**新字段说明**：
- `message_count`：会话内消息数（合并后 >1）
- `msg_ids`：消息 id 数组（追溯链底层，source_message_ids 指向这里）
- `parent_session_id`：合并会话的父会话 id（可追溯合并历史）
- `is_archived`：是否已归档到 `sessions_archive.db`
- `is_old`：是否冷归档（>180 天）

#### 7.2.4 会话合并实现

**改动文件**：`memory-layer-service.ts` 的 `recordSession` 方法

```typescript
async recordSession(params: RecordSessionParams): Promise<void> {
  const db = this.getL4Db(params.mode)
  
  // 1. 检查是否可合并
  const lastSession = db.prepare(
    `SELECT * FROM sessions 
     WHERE workspace_slug = ? AND mode = ? 
     ORDER BY created_at DESC LIMIT 1`
  ).get(params.workspaceSlug, params.mode) as SessionRow | undefined

  const canMerge = lastSession 
    && lastSession.workspace_slug === params.workspaceSlug
    && lastSession.mode === params.mode
    && (params.startedAt - lastSession.ended_at) < 30 * 60 * 1000  // 30 分钟
    && lastSession.is_archived === 0

  if (canMerge) {
    // 2. 合并：UPDATE 现有会话
    db.prepare(`
      UPDATE sessions SET
        message_count = message_count + 1,
        msg_ids = json_array_append(msg_ids, ?),
        ended_at = ?,
        summary = ?,
        tools_used = ?
      WHERE id = ?
    `).run(
      JSON.stringify(params.msgId),
      params.startedAt,
      params.summary,
      JSON.stringify([...new Set([...JSON.parse(lastSession.tools_used), ...params.toolsUsed])]),
      lastSession.id
    )
  } else {
    // 3. 新建：INSERT
    db.prepare(`
      INSERT INTO sessions (session_slug, title, summary, key_facts, tools_used,
        mode, workspace_slug, created_at, ended_at, message_count, msg_ids)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, json_array(?))
    `).run(...)
  }
}
```

#### 7.2.5 归档实现

**改动文件**：`scheduled-cleanup-service.ts` 的 `archiveL4Sessions` 方法

```typescript
private async archiveL4Sessions(mode: MemoryMode): Promise<number> {
  const activeDb = this.getActiveDb(mode)
  const archiveDb = this.getArchiveDb(mode)  // 自动创建 sessions_archive.db
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000
  
  // 1. >30 天：移到归档库
  const toArchive = activeDb.prepare(
    'SELECT * FROM sessions WHERE created_at < ? AND is_archived = 0'
  ).all(thirtyDaysAgo)
  
  for (const row of toArchive) {
    archiveDb.prepare('INSERT INTO sessions SELECT * FROM sessions VALUES (...)').run(row)
    activeDb.prepare('UPDATE sessions SET is_archived = 1 WHERE id = ?').run(row.id)
    // 不删除活跃库记录，只标记 is_archived，便于跨库查询
  }
  
  // 2. >180 天：标 old（在归档库里）
  archiveDb.prepare(
    'UPDATE sessions SET is_old = 1 WHERE created_at < ? AND is_old = 0'
  ).run(ninetyDaysAgo)
  
  return toArchive.length
}
```

#### 7.2.6 跨库查询

**机制**：FTS5 搜索时优先查活跃库，归档库降权

```typescript
async searchSessions(query: string, mode: MemoryMode): Promise<Session[]> {
  const activeResults = this.searchActiveDb(query, mode)        // 权重 1.0
  const archiveResults = this.searchArchiveDb(query, mode)     // 权重 0.5（is_old=1 不查）
  
  // RRF 融合
  return this.rrfFuse(activeResults, archiveResults)
}
```

### 7.3 一天大量会话的实际效果

**假设场景**：一天 50 个 worker 子任务

| 维度 | 改造前 | 改造后 |
|---|---|---|
| L4 新增会话数 | 50 条 | 5-10 条（30 分钟内同主题合并） |
| 一年 L4 总数 | 18000 条 | 1800-3600 条 |
| FTS5 搜索速度 | 慢（18000 条） | 快（活跃库 ~300 条） |
| Reflect 提炼成本 | 高（每天 50 条） | 低（每天 5-10 条） |
| 记忆页面 UX | 71 条列表找不到 | 5-10 条主题会话 |
| 归档后活跃库大小 | 全部 18000 条 | 30 天内 ~300 条 |

### 7.4 特殊场景处理

| 场景 | 处理 |
|---|---|
| 看板派发 50 个 worker | 30 分钟内合并为 1 条主题会话（同 workspace） |
| 用户连续对话 100 轮 | 合并为 1 条会话（message_count=100） |
| 用户跨工作区切换 | 不合并（workspace_slug 不同） |
| 用户跨模式切换 | 不合并（mode 不同） |
| 用户 1 小时后再回来 | 不合并（间隔 >30 分钟），新建会话 |
| 归档库搜索 | 降权（×0.5）+ is_old 不参与默认搜索 |

---

## 八、回答核心问题

### Q1: 改造后记忆系统是不是还是 L0-L5？

**是**，仍是 L0-L5 六层，但每层职责有调整：
- L0/L2 加 `source_msgs` 追溯字段
- L1 合并索引角色（项目画像 + ≤30 行索引）
- L4 加 `msg_id` 索引 + **会话合并 + 分级存储**
- L3/L5 不变

新增 7 个非层级文件：`pending_approval.jsonl`、`nudges/drift_backup/`、`sessions_archive.db`、`L5_archive.md`、`corrections_archive.jsonl`（详见 §二）。

### Q2: 记忆文件有哪些？

完整清单见 §二，每模式 16 个文件/目录（含归档库 7 个新增）。

### Q3: 什么时候初始化？

三档策略（详见 §三）：
- **App 启动**：目录 + L4 SQLite + 状态文件（已有）
- **Session 1 启动**：L0/L1/L2 md 空文件（**新增 eager 创建**）
- **首次写入**：L3/L5/pending_approval/nudges 子目录（lazy，已有）

### Q4: 能不能跑通记忆流程？

**能**，端到端流程见 §四，10 个验收场景见 §4.3。

### Q5: 会不会无限膨胀？

**不会**，每层都有兜底（详见 §六）：
- L1 ≤30 行硬约束 + ROI 清理
- L3 raw >1000 → 500
- L4 会话合并 + 30 天归档 + 90 天标 old
- L5 anti_echo + 反向引用 archive
- pending 30 天自动 reject

### Q6: 是否有自进化？

**有 5 个自进化机制**（详见 §6.2）：
- 写入时自进化（两阶段去重 + drift + patch-only）
- Nudge 自进化（每 10 轮 fork review）
- Reflect 自进化（每日 03:00）
- Scheduled Cleanup（每周日 04:00）
- Self-Repair（每月 1 日）

### Q7: 是否有自己清理的机制？

**有四档清理时机**（详见 §6.3）：
- 实时清理（写入时）
- 每日清理（Reflect）
- 每周清理（Scheduled Cleanup）
- 每月清理（Self-Repair）

### Q8: 一天大量会话怎么办？

**会话合并 + 分级存储**（详见 §七）：
- 同主题 30 分钟内合并为一条（50 条 → 5-10 条）
- >30 天移归档库（活跃库保持小）
- >180 天标 old（默认不召回）
- FTS5 跨库搜索 + 降权融合

---

## 八、Memory Graph 可视化（借鉴 hermes Learning Graph）

### 8.1 来源与定位

**来源**：hermes `agent/learning_graph.py` + `agent/learning_graph_render.py`

**定位**：
- **不是膨胀控制机制**（不防止无限增长）
- **是可视化 + 交互层**（让用户感知记忆积累和演化）
- **依赖前置**：L0/L1/L2 eager 创建（§三）→ 数据填充 → Memory Graph 渲染

**优先级**：P3（中，3-4 天）

### 8.2 与 hermes 源码对齐（修正用户文档 §3.8 偏差）

用户文档 §3.8 对 hermes 的描述存在事实性偏差，本设计以源码为准：

| 维度 | 用户文档 §3.8 主张 | hermes 源码事实 | 本设计采纳 |
|---|---|---|---|
| 节点类型 | L0(圆) / L2(方) / skill(菱) / L5(六边) | **2 种**：memory(菱) + skill(圆) | 2 种（对齐 hermes） |
| 分层维度 | 按 L0-L5 认知层级 | 按 **时间**（recency ring） | 按时间（radial timeline） |
| 渲染库 | reagraph | **d3-force + Canvas** | d3-force + Canvas |
| 形状映射 | skill=菱形 | **skill=圆形，memory=菱形** | skill=圆，memory=菱 |
| 方形/六边形 | 用了 | `Shape` 声明但 `NODE_SHAPE` 没用（死代码） | 不用 |

### 8.3 节点模型

**两种节点**（对齐 hermes 源码 `learning_graph.py:283-307`）：

| 节点 kind | 形状 | 数据来源 | 切分方式 |
|---|---|---|---|
| `memory` | 菱形 | L0_user.md / L2_facts.md / L5_insights.md | 按 `\n§\n` 切片，每段一个节点 |
| `skill` | 圆形 | `~/.tagent/agent-workspaces/{ws}/skills/` | 已学到（非 base + use_count > 0 或 created_by=agent） |

**memory 节点 id 格式**：`memory:<source>:<index>`（如 `memory:L2_facts:3`）

**skill 节点 id 格式**：`skill:<skill_name>`

**memory 节点 source 字段**（区分来源）：
- `L0` → `L0_user.md` 切片
- `L2` → `L2_facts.md` 切片
- `L5` → `L5_insights.md` 切片

**节点元数据**：
```typescript
interface GraphNode {
  id: string
  kind: 'memory' | 'skill'
  shape: 'diamond' | 'circle'
  source: 'L0' | 'L2' | 'L5' | 'skill'
  title: string         // 切片首行 / skill 名
  content: string       // 切片正文 / SKILL.md 描述
  timestamp: number     // 最后使用时间（ring 排列依据）
  useCount?: number     // skill 专用
}
```

### 8.4 边模型

**两类边**（对齐 hermes 源码 `learning_graph.py:268-272`）：

| 边类型 | 起点 | 终点 | 计算方式 | 限制 |
|---|---|---|---|---|
| `skill-skill` | skill | skill | SKILL.md frontmatter `related_skills` 字段 | 两端节点都存在，无向去重 |
| `memory-skill` | memory | skill | 词法重合度（token 交集 + skill 名子串 +6 分） | 每条 memory 取 top-4 skill |

**memory-skill 词法重合算法**（借鉴 hermes，针对中文优化）：
- memory 卡片正文 + 标题 tokenize（中文按字，英文按 ≥3 字符）
- skill 名作为子串出现 +6 分
- 按 token 重合数打分
- 取每条 memory 的 top-4 skill 连边

**⚠️ 中文场景优化**（hermes 反模式）：
- hermes 纯词法重合对中文/同义词几乎失效
- TAgent 应**加 embedding 或 LLM 抽关键词**（v1.6+ 评估）

### 8.5 渲染

**渲染方式**：d3-force + Canvas（不用 reagraph，对齐 hermes 桌面端 `apps/desktop/src/app/starmap/`）

**形式**：radial timeline 星图（径向时间线）
- **时间从内圈（最旧）→ 外圈（最新）**
- ring 按 day/week/month 桶分组（自适应时间粒度）
- 节点 hover 高亮、点击选中、右键菜单、双击重置视图
- 时间轴 scrubber 0→1 播放/拖动（cubic ease + 反向二分查找恢复）
- 空格键切换播放
- 滚轮缩放、拖拽平移

**性能优化**（借鉴 hermes 反模式教训）：
- 缓存 offscreen 层 + 仅每帧重绘"核心 scramble"动画
- 30fps 节流
- 窗口失焦冻结（不用 `visibilitychange` + `hasFocus` 暂停）
- **额外**：用 IntersectionObserver + 完全静态层缓存（hermes 没做，TAgent 改进）

**三端统一方式**（借鉴 hermes）：
- 共享同一个数据装配器（`learning_graph.ts`）
- 共享同一个语义样式器（输出 `[text, style, alpha, hex?]` 串）
- 桌面端 Canvas + CLI/TUI 各自映射调色板
- **不引入 ABC Provider 接口**（hermes 也没做，简单优先）

### 8.6 交互能力

| 操作 | 行为 |
|---|---|
| hover 节点 | 高亮 + 显示 tooltip |
| 点击节点 | 选中 + 右侧详情面板 |
| 右键节点 | 菜单：编辑 / 删除 / 钻取 |
| 双击节点 | 智能缩放重置视图 |
| 时间轴 scrubber | 0→1 播放（cubic ease） |
| 空格键 | 切换播放/暂停 |
| 滚轮 | 缩放 |
| 拖拽 | 平移视图 |

**编辑/删除**：
- skill 删除 = **归档**到 `.archive/`（可恢复，借鉴 hermes `curator restore`）
- memory 删除 = **重写 md 文件**（真删，但 drift 检测会 backup）
- 编辑走 inline 编辑器或外部 `$EDITOR`

### 8.7 触发与存储

**触发**（借鉴 hermes 按需装配）：
- **完全按需，无定时，无缓存**
- 每次打开 Memory Graph 视图时重新扫盘装配
- 数据源：`~/.tagent[-dev]/memory/*.md` + `~/.tagent[-dev]/agent-workspaces/{ws}/skills/`

**存储**：
- **无独立存储**（对齐 hermes）
- graph 不落盘，只是 md 文件 + skill 目录的实时视图
- 状态变更（pin / archive / use_count）由 Nudge 系统和 skill 系统负责

**性能**（hermes 反模式）：
- hermes 按需扫盘在大规模 skill 下会慢（数百个 skill 感知延迟）
- TAgent 应考虑 **增量缓存 + 文件 watcher**（v1.6+ 优化）

### 8.8 入口设计

**入口位置**：设置页"记忆"Tab 加 "Memory Graph" 子视图

**前置条件**：
- L0/L1/L2 eager 创建已完成（§三）
- 至少有 1 条记忆写入（否则空状态提示"等待记忆积累"）
- 孤儿引用修复已完成（前置 P1，1 天，详见 `hermes-borrow-plan.md`）

### 8.9 TAgent 节点 id 稳定性改进（hermes 反模式）

**hermes 问题**：memory id 用 `memory:<source>:<index>`，index 是装配时位置，用户在编辑期间若别处改了 md 文件，`learning_mutations._memory_local_index` 会抛 "stale" 错。

**TAgent 改进**：用 **内容 hash** 而非位置 index

```typescript
// hermes 方式（易失效）
id: `memory:L2_facts:3`

// TAgent 改进（内容 hash，稳定）
id: `memory:L2_facts:${contentHash.slice(0, 8)}`
```

**优势**：用户编辑 md 文件不会导致 id 失效，graph 不会因 stale 报错。

### 8.10 实施计划

| 步骤 | 工期 | 改动 |
|---|---|---|
| 1. 数据装配器 | 1 天 | 新增 `apps/electron/src/main/lib/learning-graph-service.ts` |
| 2. 渲染组件 | 1.5 天 | 新增 `apps/electron/src/renderer/components/memory/MemoryGraph.tsx`（d3-force + Canvas） |
| 3. 交互能力 | 0.5 天 | hover / 点击 / 右键 / scrubber / 播放 |
| 4. 编辑/删除 | 0.5 天 | inline 编辑 + skill 归档 + memory drift backup |
| 5. 入口接入 | 0.5 天 | 设置页"记忆"Tab 加 "Memory Graph" 子视图 |
| **合计** | **3-4 天** | |

**新增文件**：
- `apps/electron/src/main/lib/learning-graph-service.ts` — 数据装配器
- `apps/electron/src/renderer/components/memory/MemoryGraph.tsx` — 渲染组件
- `apps/electron/src/renderer/components/memory/MemoryGraphPanel.tsx` — 详情/编辑面板

**依赖**：
- `d3-force` npm 包（轻量，不用 reagraph）
- L0/L1/L2 eager 创建（§三 P1）
- 孤儿引用修复（前置 P1）

### 8.11 与主流程的关系

**Memory Graph 不参与记忆写入/清理流程**，纯可视化层：
- 读：从 L0/L2/L5 md 文件 + skill 目录读
- 写：通过 drift 检测 + patch-only 写入（复用 §四 写入门控）
- 不影响 Prompt Cache（不在 system prompt 链路上）
- 不影响膨胀控制（不主动写入）

---

## 九、关联文档

- `TAgent_Memory_System_Files_and_Paths_Audit.md` — 现有文件梳理
- `Why_Markdown_for_Memory.md` — 存储载体论证
- `docs/memory-system.md` — 当前实现现状
- `docs/plans/2026-07-03-hermes-borrow-plan.md` §5.2 — v1.5 主线规划
- `TAgent_Memory_Refactor_Plan.md` — 改造计划（4 Phase 工期，可作为实施参考）

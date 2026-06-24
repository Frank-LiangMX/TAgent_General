# ADR-0003: 上游特性对齐策略（v0.13.3 基线）

> **Status**: Accepted  
> **Date**: 2026-06-24  
> **Deciders**: Frank Danny

## Context

TAgent 自 2026-06-18 以来未再同步上游 `proma-ai/Proma` 仓库。截至 2026-06-24，上游已累积约 80 个 commit、3 个新版本（v0.12.0 → v0.13.3）。

本次调研识别出三类关键缺口：

1. **稳定性**：Claude Agent SDK 仍为 0.3.153，落后上游 0.3.185，触发每会话 2s drain timeout
2. **主动 Agent 能力**：Automation 调度系统、协作子会话、Monitor 长任务在本地完全缺失（0%）
3. **上下文管理**：1M 上下文能力未统一到 `packages/shared`，多处口径不一致

如果不做系统性规划，会出现：

- 散乱的 cherry-pick 导致品牌约束破坏（`@proma/*` 残留）
- Automation 等大特性落地时与现有 general/ta 模式隔离冲突
- 跨阶段重复劳动，缺乏里程碑节奏

## Decision

我们采用**「调研 → 路线图 → 分阶段执行」**的三层结构：

### 第一层：调研与清单

发布 [`docs/plans/2026-06-24-upstream-feature-roadmap.md`](../plans/2026-06-24-upstream-feature-roadmap.md) 作为**单一事实源**：

- 列出 37 大类 / ~130 项上游特性
- 按 P0（必做）/ P1（强烈建议）/ P2（体验增强）/ P3（锦上添花）分级
- 每个特性标注本地实现进度（百分比）
- 给出 5 阶段实施路线图

### 第二层：核心特性的设计文档

为本地完全缺失的两个核心特性撰写独立设计文档：

- [`docs/plans/2026-06-24-automation-design.md`](../plans/2026-06-24-automation-design.md) — Automation 调度系统
- [`docs/plans/2026-06-24-collaboration-design.md`](../plans/2026-06-24-collaboration-design.md) — 协作子会话

### 第三层：P0 立即可执行的 PR 模板

[`docs/plans/2026-06-24-p0-stability-patches.md`](../plans/2026-06-24-p0-stability-patches.md) 提供 4 个可立即开工的 PR：

- PR-1：SDK `0.3.153 → 0.3.185` 升级
- PR-2：并发写风暴修复（#910）
- PR-3：长任务断连保留 `sdkSessionId`（#903）
- PR-4：输入框 / 推荐消息 / 附件 6 个 UI bug 修复合集

预计 1-2 天可完成。

### 关键策略约束

1. **不直接 cherry-pick**：每个 PR 必须经过品牌约束 / 模式隔离 / 本地优先三重检查
2. **保留 `@tagent/*` 作用域**：所有 `package.json` 引用、`~/.tagent/` 数据目录不变
3. **分阶段独立 PR**：每个里程碑可单独验证、单独回滚
4. **本地优先存储**：Automation / Delegation 历史全部用 JSON 持久化，不引入新数据库
5. **模式隔离**：Automation 与 Collaboration 默认只支持 general 模式；不影响 TA 模式

## Consequences

### Positive

- 单一事实源（路线图）让新 Agent 接手时一目了然
- 设计文档提前规避与 TAgent 模式的冲突
- P0 立即可执行，1-2 天可消除稳定性缺口
- 5 阶段路线图避免大爆炸式合并
- 品牌约束显式化，避免 cherry-pick 引入 `@proma/*`

### Negative

- 文档维护成本上升：每完成一个里程碑需要更新 PROGRESS.md
- 「不直接 cherry-pick」导致部分代码需要重写，工作量略增
- Automation / Collaboration 系统从零开始，工作量较大（5-7 天）

### Neutral

- 上游 v0.13.4 仍在持续更新，本路线图可能在 1-2 周后再次过时
- 部分 P2 / P3 特性可能与本地 TAgent 品牌定位无关（如 `qa-image-lightbox` Canvas 编辑器）

## Alternatives Considered

### Option A: 直接 fork 上游并定期 merge

- Pros: 工作量小，跟随上游同步
- Cons: 品牌约束难维护，模式隔离会被破坏，引入大量与 TAgent 无关的代码
- **拒绝**：违背 CLAUDE.md 「TAgent 品牌约束」核心原则

### Option B: 只 cherry-pick 稳定性修复，不做系统性规划

- Pros: 快速、低风险
- Cons: Automation / Collaboration 等大特性永远落不了地
- **拒绝**：错失「proactive Agent」愿景

### Option C: 等上游稳定后再统一升级

- Pros: 风险最低
- Cons: 永远在追，落后的 commit 永远积压
- **拒绝**：上游持续更新，永远「等不到稳定」

### Option D: 重写而非参考上游

- Pros: 完全自主
- Cons: 重复造轮子，浪费上游已验证的设计
- **拒绝**：上游 v0.12.0 ~ v0.13.3 已有大量验证，参考优于重写

## References

- [`docs/plans/2026-06-24-upstream-feature-roadmap.md`](../plans/2026-06-24-upstream-feature-roadmap.md) — 总路线图
- [`docs/plans/2026-06-24-p0-stability-patches.md`](../plans/2026-06-24-p0-stability-patches.md) — P0 PR 模板
- [`docs/plans/2026-06-24-automation-design.md`](../plans/2026-06-24-automation-design.md) — Automation 设计
- [`docs/plans/2026-06-24-collaboration-design.md`](../plans/2026-06-24-collaboration-design.md) — Collaboration 设计
- [`docs/plans/2026-06-16-upstream-upgrade-plan.md`](../plans/2026-06-16-upstream-upgrade-plan.md) — 旧版 v0.10.34 基线规划
- [`docs/plans/2026-06-16-upstream-upgrade-issues.md`](../plans/2026-06-16-upstream-upgrade-issues.md) — Issue A~E
- 上游仓库：https://github.com/proma-ai/Proma
- 上游 release notes：https://github.com/proma-ai/Proma/tree/main/release-notes
- [`CLAUDE.md`](../../CLAUDE.md) — 项目核心约束

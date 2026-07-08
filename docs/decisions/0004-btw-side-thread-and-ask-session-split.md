# ADR-0004: BTW 改为临时 Side Thread，Ask 从 Agent 会话中拆出

> **Status**: Proposed
> **Date**: 2026-07-08
> **Deciders**: 产品方向已确认，工程方案待继续落地

## Context

当前 TAgent 里有两类本质不同、但历史上被挤在一起的能力：

1. Agent 会话里的 `btw` 侧问
2. Ask 轻量对话模式

历史上，项目为了统一入口，把 Ask 放进 Agent 会话内部，作为 composer mode 使用；与此同时，`btw` 又走了一条轻量 provider/SSE 特例链路。

这带来了三个问题：

- `btw` 不属于 Agent runtime，天然丢失 `kscc-internal` 一类渠道能力
- Ask 与 Agent 在同一会话里切换，但底层运行时和存储并不完全统一
- 用户会把 BTW 误解成长期分支，把 Ask 误解成 Agent 会话内部天然互通的另一档

而用户刚刚确认的真实需求是：

- 主 Agent 任务正在进行
- 不想打断它
- 但想即时问一句“你刚才为什么这么做”“这个我没看懂”

这说明 BTW 的核心职责不是长期分支，而是：

**运行中主任务的临时伴随解释通道**

## Decision

我们决定：

1. **BTW 的产品语义改为“临时 side thread”，用于运行中 Agent 任务的即时解释，不承担长期会话分支职责。**
2. **BTW 的底层继续复用 Agent runtime / fork 能力实现，以自然继承 `kscc`、Claude Code SDK、权限和会话能力。**
3. **主任务运行中允许发起 BTW，但默认不打断主任务。**
4. **BTW 默认不作为正式常驻历史保留；只有用户显式选择“转为正式分支”时，才升级为真正 fork 会话。**
5. **Ask 从 Agent 会话内部模式中拆出，回归独立会话类型。**
6. **ADR-0002 中“Ask 统一 composer 并承接侧问”这部分方向由本 ADR 替代。**

详细设计见：

- `docs/plans/2026-07-08-btw-fork-and-ask-split-design.md`

## Consequences

### Positive

- BTW 可以自然支持 `kscc`
- BTW 与 Agent runtime 的渠道、权限、上下文能力来源统一
- BTW / Fork / Ask 三者边界清晰
- 用户在任务进行中可以即时理解当前现场，而不需要打断主任务

### Negative

- 需要继续收紧 BTW 的生命周期和隐藏策略，避免它被当成正式会话使用
- Ask 从 Agent 内部拆出后，现有 UI 和历史心智需要迁移
- 需要对已有混合实现做兼容或过渡说明

### Neutral

- BTW 底层可以使用 fork，但产品语义上不再等同于“长期 fork 会话”
- Ask 仍然可以保留，只是不再承担 BTW 的职责

## Alternatives Considered

### Option A: 保持 BTW 为 provider/SSE 特例，只补 `kscc` 兼容

- Pros: 短期改动小
- Cons: 继续维持双底座，长期会反复出问题

### Option B: 把 BTW 定义成长期正式 fork

- Pros: 概念简单，工程上好复用已有 fork 能力
- Cons: 不符合真实使用场景；用户的需求是“即时解释”，不是“长期并行发展”

### Option C: 保留 Ask/Agent 同会话切换，只优化文案

- Pros: 迁移成本小
- Cons: 无法解决运行时和心智模型错位

## References

- `docs/decisions/0002-ask-mode-composer.md`
- `docs/plans/2026-07-08-btw-fork-and-ask-split-design.md`
- `apps/electron/src/main/lib/btw-service.ts`

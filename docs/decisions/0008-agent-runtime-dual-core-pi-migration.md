# ADR-0008: Agent Runtime 双核过渡与向 Pi 迁移

> **Status**: Proposed  
> **Date**: 2026-07-18  
> **Deciders**: 产品负责人确认方向；工程按设计文档分阶段实施  

## Context

TAgent Agent 模式当前单一依赖 `@anthropic-ai/claude-agent-sdk`：主进程通过 SDK spawn CLI 子进程（外网为 SDK 自带 claude binary，内网 `kscc-internal` 为系统 `kscc`）。该路径能承接完整 Agent（工具、MCP、权限回调、流式 partial、resume），但也带来：

1. **运行时臃肿**：能力与 Claude Code 平台强绑定，而不仅是「模型补全」。  
2. **黑盒难自管**：context 计量/压缩、auto-memory 等策略不可精细产品化（历史问题包括 `getContextUsage` 副作用、SDK compaction 与客户端兜底双轨）。  
3. **定位错位**：公司 kscc 的核心业务价值是**内网免费模型额度与推广**，不是必须使用 Claude Code 产品形态。  
4. **上游趋势**：基座同源的 Proma 已引入 Pi runtime（`@earendil-works/pi-*`）双轨，动机包含不透明、效率与供应商锁定风险；长期更可能收敛到 Pi。  
5. **产品实际状态**：TAgent 外围（记忆、看板、TA、kscc 渠道、画布、Automation、IM、UI 体系等）已大幅自研或重写；与 Proma 的强耦合主要剩 **Agent Runtime 底层**。继续以 Claude Agent SDK 为唯一内核，等于用「最后一层基座」绑架已独立的产品身份。

同时，2026-07-18 试探表明：

- 公司网关 `BASE_API` **拒绝**非官方客户端直连（`ClientForbidden`），token 不足以绕过。  
- `kscc -p --bare` **可以**作为轻量补全入口，并输出 thinking / 事件流，但默认仍可能走内置 tool；流式粒度弱于当前 SDK partial。  
- 因此 **bare 泵尚不适合直接替换生产 kscc 路径**。

需要在「架构主权」与「内网稳定性」之间做可逆、分阶段的决策。

## Decision

我们决定：

1. **目标内核**为 **Pi agent loop**（自管 tool、context、权限策略、模型路由）；TAgent 外围（记忆、看板、权限 UI、IPC 等）继续复用，不因换核重做产品壳。  
2. **kscc 定位**为可选的**公司额度与推广通道**，不是 Agent 内核的一部分。  
3. **短期（阶段 1）采用双核**：  
   - 外部 / 自备 Key 渠道 → **Pi runtime**  
   - `kscc-internal` → **保持现状**（Claude Agent SDK + 完整 kscc Agent）  
4. **中期（阶段 2）**在独立分支验证 **Pi + `kscc -p --bare` 模型泵**（或未来公司 HTTP 白名单直连）；**默认不进入生产主路径**，直至门禁通过。  
5. **长期（阶段 3）**门禁通过后 kscc 切到 Pi 通道，并具备条件时移除 Claude Agent SDK 依赖。  
6. **双核期纪律**：新 Agent 能力默认只加 Pi；Claude/kscc 路径仅修 bug 与兼容，避免双核永久化。  
7. **禁止**为调用额度而伪造官方客户端指纹或逆向绕过 `ClientForbidden`。  
8. **与 Proma 分道**：走 Pi 内核后，TAgent 以**自研产品**独立演进；**不再**将「对齐 Proma Agent Runtime」作为默认义务。Proma 仅可作只读参考。外围已自研的事实应写入产品叙事，避免团队仍按「Proma 下游」做排期。

详细设计、门禁、调研摘要与工作包见：

- `docs/plans/2026-07-18-agent-runtime-dual-core-pi-migration.md`

## Consequences

### Positive

- 内网推广与现网体验在阶段 1 **不受 bare 不确定性冲击**。  
- 外网可先兑现 **自管内核**（context/tool/多 Provider）收益。  
- 与「只要额度、不要 Claude Code 平台」的长期叙事一致，且路径可逆。  
- 门禁机制降低「一次切全 Pi 翻车」的概率。  
- **产品身份清晰**：内核自管后，TAgent 不再心理上依赖 Proma 发版节奏，排期与架构决策回到本产品。

### Negative

- 阶段 1–2 存在 **双 runtime 维护税**（适配器、打包、测试矩阵）。  
- 两路径能力可能短暂不一致，需文档与 UI 管理预期。  
- bare 泵若长期不达标，可能延后「删 SDK」；需接受双核持续更久的成本。  
- **失去「免费跟 Proma Runtime」的同步红利**；Claude/SDK 相关修复需自行判断是否还要做。  
- 贡献者若仍按 Proma 习惯提「上游对齐」PR，需要用本文与设计文档纠正预期。

### Neutral

- 消息层继续优先 **SDKMessage 兼容协议**，降低渲染/持久化分叉。  
- 若公司后续开放 HTTP 客户端白名单，kscc 通道可从 CLI 泵升级为真 SSE，门禁可重测后替换实现，**不改变「Pi 为内核」决策**。  
- 与 Proma 的历史融合关系（ADR-0001）仍成立作为**溯源**；本 ADR 更新的是 **Runtime 之后的演进策略**，不是否定融合史。

## Alternatives Considered

### Option A: 维持单核 Claude Agent SDK

- Pros: 改动最小、kscc 最稳。  
- Cons: 黑盒与臃肿不缓解；与上游 Pi 方向背离；自管 context 目标难达成。

### Option B: 立即全量 Pi + kscc bare 泵

- Pros: 架构一步统一。  
- Cons: bare 流式/零工具/稳定性未验证；内网主战场风险过高。

### Option C: 永久双核（外 Pi / 内 Claude）无终点

- Pros: 看似稳妥。  
- Cons: 新功能双份、债务锁定；与「Pi 内核」目标矛盾。

### Option D: 短期双核 → 分支验证 bare → 门禁后全 Pi（本 ADR）

- Pros: 平衡推广稳定与架构演进；用验证替代赌博；同时完成与 Proma Runtime 脱钩的准备。  
- Cons: 需要明确门禁与纪律，否则退化为 Option C。

### Option E: 继续以「Proma 下游」身份锁步 Claude SDK / 其双 runtime

- Pros: 可短期复用上游提交。  
- Cons: 外围已自研，锁步收益递减；产品节奏被外部仓库绑架；与 kscc 额度定位、自管 context 目标不一致。

## References

- 设计文档：`docs/plans/2026-07-18-agent-runtime-dual-core-pi-migration.md`  
- kscc 渠道：`docs/plans/2026-06-25-kscc-internal-provider-design.md`  
- Context 压缩：`docs/plans/2026-06-13-context-compaction-architecture.md`  
- 融合架构：`docs/decisions/0001-fusion-architecture.md`  
- 上游参考（只读）：`F:\Proma` Pi / Claude 双 runtime 适配层  

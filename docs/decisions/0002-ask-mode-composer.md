# ADR-0002: Ask 档位统一 Composer（替代独立 Chat 模式）

> **Status**: Implemented  
> **Date**: 2026-06-13  
> **Implemented**: 2026-06-14  
> **Deciders**: 产品方向（用户确认）+ 工程实施待办

## Context

TAgent 长期维护 **Chat 模式** 与 **Agent 模式** 两套 UI、两套会话存储（`conversations/*` vs `agent-sessions/*`）和全局 `appMode` 互斥切换。Chat 入口分散（欢迎页、设置、快捷键），与 Rail「会话」图标语义冲突，且相对网页端 Chat 产品缺乏独占价值。

同时 Agent 场景需要 **轻量问答**（解释上下文、短问短答、不触发工具权限），已有 `/btw` 侧面提问与 `btw-service` 实现了类似能力，但与主 Composer 割裂。

## Decision

1. **以 Agent 会话为唯一主会话模型**；不再将 Chat 作为与 Agent 平级的顶层 `appMode`。
2. 在 **Agent 输入区** 增加 Composer 档位：`agent`（默认）与 `ask`（轻量对话），交互对标 Cursor Ask / Agent 切换。
3. **Ask 后端** 复用 `@tagent/core` Provider 流式与 `chat-service` 编排经验，但绑定 `agentSessionId`，消息存入独立 `ask.jsonl`，不写入 SDK JSONL。
4. Ask 请求注入 **权限边界契约**（系统提示）；通过白名单工具 `suggest_agent_switch` 引导用户切回 Agent 档位（同会话、预填 prompt），而非新建 Chat 会话。
5. **渐进退役** 独立 Chat UI 与 `conversations/*` 主路径；旧数据只读或导出，不自动删除用户文件。

详细实施见 [`plans/2026-06-13-ask-mode-unification-design.md`](plans/2026-06-13-ask-mode-unification-design.md)。

## Consequences

### Positive

- 单一主界面、单侧栏、单 Tab 类型，降低导航与对齐成本。
- Ask 与 Agent 共享会话上下文与时间线，符合「先问再做」工作流。
- 明确能力边界，减少模型幻觉执行文件/命令。
- 可复用现有 `suggest_agent_mode` 与 `AgentRecommendBanner` 逻辑。

### Negative

- 需合并时间线渲染（SDK 消息 + Ask 消息）。
- 迁移期需维护 Chat 只读或兼容代码直至 P3 删除。
- 全渠道 Ask 与 Agent 渠道能力不一致需在 UI 说明。

### Neutral

- `packages/core` Provider 适配器保留；`chat-service` 可能拆分为共享流式内核 + `ask-service`。
- `/btw` 与 Ask 关系需在 P2 收敛（合并或 deprecate）。

## Alternatives Considered

### Option A: 保留双模式，仅优化侧栏 Chip 切换

- Pros: 改动小。
- Cons: 仍双列表、双存储、`appMode` 心智负担不变；未解决「Chat 无独占价值」问题。

### Option B: 完全删除 Chat 栈，Ask 不复用 chat-service

- Pros: 代码删得多。
- Cons: 重复实现流式、工具、附件；工期更长。

### Option C: Ask 写入 SDK 会话（无工具）

- Pros: 单一 JSONL。
- Cons: SDK 消息 schema 与 Provider 混用复杂；污染 Agent resume 上下文。

## References

- [`plans/2026-06-13-ask-mode-unification-design.md`](plans/2026-06-13-ask-mode-unification-design.md)
- `apps/electron/src/main/lib/btw-service.ts`
- `apps/electron/src/main/lib/chat-tools/agent-recommend-tool.ts`
- `apps/electron/src/renderer/components/chat/AgentRecommendBanner.tsx`

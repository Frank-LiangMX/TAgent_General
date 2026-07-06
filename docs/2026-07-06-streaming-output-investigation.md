# Agent 流式输出透传 — 排查记录

**日期**：2026-07-06
**目标**：让 kscc 渠道 Agent 输出逐字打字机效果，不再"卡很久后一次性吐出"

## 问题描述

Agent 在 kscc 渠道输出大段文字时，UI 一直显示"运行中"，过很久才一次性吐出完整回复。用户体验差，误判为卡死。

## 根因诊断

**SDK `includePartialMessages` 选项没启用**。

SDK 内部逐 token 流式生成，但默认只在 assistant turn 完成后才 yield 完整 `SDKAssistantMessage`。启用 `includePartialMessages: true` 后，SDK 会额外 yield `SDKPartialAssistantMessage`（type: `'stream_event'`），含 `BetaRawContentBlockDeltaEvent`（`text_delta` / `thinking_delta`）。

## 排查过程

### 1. SDK 类型分析

- `@anthropic-ai/claude-agent-sdk@0.3.185` 的 `Options` 类型有 `includePartialMessages?: boolean`（sdk.d.ts:1543）
- SDK 内部把选项转成 CLI 参数 `--include-partial-messages`（sdk.mjs: `Jo)V.push("--include-partial-messages")`）
- `SDKPartialAssistantMessage` 类型：`{ type: 'stream_event', event: BetaRawMessageStreamEvent, uuid, session_id, parent_tool_use_id }`

### 2. kscc CLI 验证

```bash
kscc --help | grep partial
# --include-partial-messages  Include partial message chunks as they arrive
```

直接跑 kscc 验证输出：

```bash
kscc -p "写一首关于秋天的短诗" --output-format stream-json --include-partial-messages
```

输出确认有大量 `stream_event`，含 `content_block_delta` + `text_delta`。

### 3. SDK 测试

写测试脚本直接用 SDK query kscc：

```js
const q = query({ prompt: '说三个字', options: { includePartialMessages: true, ... } })
for await (const msg of q) { console.log(msg.type) }
// 输出：system, system, stream_event ×85, assistant ×2, result
```

确认 SDK yield 了 85 条 stream_event。

### 4. Adapter 层问题发现

发现 `claude-agent-adapter.ts:798` 硬编码了 `includePartialMessages: false`，orchestrator 的设置被覆盖。

**修复**：
- `ClaudeAgentQueryOptions` interface 加 `includePartialMessages?: boolean` 字段
- adapter 改为 `includePartialMessages: options.includePartialMessages ?? false`

### 5. Orchestrator 层改动

- queryOptions 加 `includePartialMessages: true`
- SDK 消息循环识别 `msg.type === 'stream_event'`，提取 `text_delta`，emit `{kind:'stream_text_delta', text, parentToolUseId}`
- `stream_event` 类型 `continue` 跳过持久化和 shouldEmit 过滤

### 6. Shared 类型改动

`AgentStreamPayload` union 加新 kind：

```ts
| { kind: 'stream_text_delta'; text: string; parentToolUseId?: string }
```

### 7. 渲染层改动

`useGlobalAgentListeners.ts` 的 `payloadToLegacyEvents` 加分支：

```ts
if (payload.kind === 'stream_text_delta') {
  return [{ type: 'text_delta', text: payload.text, parentToolUseId: payload.parentToolUseId }]
}
```

### 8. SubAgent 污染修复

`applyAgentEvent` 的 `text_delta` 和 `text_complete` case 加 SubAgent 守卫：

```ts
if (event.parentToolUseId) return prev  // SubAgent 文本不累积到顶层 state.content
```

### 9. useSmoothStream 问题

字符入队正确，但 `renderLoop` 没启动。

**根因**：`renderLoop` 只在 `isStreaming` 变化时启动（useEffect 依赖 `[isStreaming, renderLoop]`）。如果 `isStreaming` 一直是 `true`，`renderLoop` 只启动一次，后续 content 变化时不会重新启动。

**修复**：在 content useEffect 里入队字符后，主动启动 `renderLoop`：

```ts
if (!rafRef.current) {
  rafRef.current = requestAnimationFrame(renderLoop)
}
```

同时把 content useEffect 移到 `renderLoop` 定义之后，避免 TDZ 错误。

### 10. Vite HMR 重复注册

发现每个 stream_text_delta 被收到 2-3 次。根因是 Vite HMR 重新执行 hook 但不触发 cleanup，导致 IPC listener 累积注册。

**修复**：用 `React.useRef(false)` 在 useEffect 内防止重复注册。

## 当前状态

| 层级 | 状态 | 说明 |
|------|------|------|
| kscc CLI | ✅ | 支持 `--include-partial-messages`，输出 stream_event |
| SDK | ✅ | yield 85 条 stream_event |
| Adapter | ✅ | `includePartialMessages` 透传到 SDK |
| Orchestrator | ✅ | stream_event → text_delta → stream_text_delta emit |
| Shared 类型 | ✅ | `AgentStreamPayload` 加 `stream_text_delta` kind |
| 渲染层 IPC | ✅ | stream_text_delta → text_delta AgentEvent |
| state.content | ✅ | applyAgentEvent 累积（有 SubAgent 守卫） |
| useSmoothStream | ⚠️ | 入队 + renderLoop 启动修复已写，待验证 |
| 调试代码 | ✅ | 已清理 |

## 改动文件清单

1. `apps/electron/src/main/lib/agent-orchestrator.ts` — queryOptions + stream_event 处理
2. `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts` — interface + sdkOptions
3. `packages/shared/src/types/agent.ts` — AgentStreamPayload 加 kind
4. `apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts` — payloadToLegacyEvents + HMR 防重复
5. `apps/electron/src/renderer/atoms/agent-atoms.ts` — SubAgent 守卫
6. `packages/ui/src/hooks/useSmoothStream.ts` — renderLoop 启动修复

## 待验证

刷新页面后发消息，确认：
1. UI 是否出现逐字打字机效果
2. 是否有渲染错误（TDZ、重复注册等）
3. SubAgent（code-reviewer / explorer）输出是否正常（不污染主气泡）

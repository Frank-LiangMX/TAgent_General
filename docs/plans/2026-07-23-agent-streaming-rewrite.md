# Agent 流式消息渲染重写方案

> **状态**：Draft v1.0
> **日期**：2026-07-23
> **分支**：`refactor/agent-streaming-rewrite`
> **前置**：滚动拖影修复已合入 `fix/assistant-motion-preference`
> **关联**：
> - 当前实现：`apps/electron/src/renderer/components/agent/SDKMessageRenderer.tsx`
> - 过程卡组件：`apps/electron/src/renderer/components/agent/ProcessBlockGroup.tsx`
> - 滚动容器：`packages/ui/src/components/conversation/index.tsx`

---

## 0. 一句话

**用状态机替代 SDKMessageRenderer 的 800 行 if/else，用 react-virtuoso 替换 stick-to-bottom 实现虚拟化滚动和自动跟随，参考 Vercel AI SDK 的工具调用 4 态模型重建流式渲染管线。**

---

## 1. 现状问题

### 1.1 架构债务

| 问题 | 影响 |
|------|------|
| `SDKMessageRenderer.tsx` 800+ 行，嵌套 if/else 处理所有消息类型 | 难以维护，新增消息类型需要理解全貌 |
| 工具调用没有明确状态生命周期 | 只有"运行中"和"完成"，缺少"输入流式"、"待确认"、"错误"等中间态 |
| 过程卡折叠依赖 3 秒倒计时 + 声音延迟 | 体感不够即时，用户等 3 秒才看到收起 |
| `use-stick-to-bottom` 不支持虚拟化 | 长对话 100+ 条消息时 DOM 节点爆炸，滚动卡顿 |
| 每个过程卡/模型名/工具详情都有 `backdrop-filter: blur()` | GPU 合成负载高，滚动时拖影（已临时修复） |

### 1.2 性能瓶颈

```
当前渲染路径：
SDK Message 流
  → SDKMessageRenderer (800 行解析)
    → ProcessBlockGroup (折叠/展开/倒计时)
      → agent-turn-process (backdrop-filter: blur(8-12px))
        → 多层 blur 叠加 → GPU 合成滞后 → 拖影
```

---

## 2. 目标架构

### 2.1 核心设计

```
SDK Message 流
  → StreamingMessageParser (状态机，纯函数)
    → MessagePart[] (text | tool-call | thinking | step-start | step-end)
      → MessagePartRenderer (按 part 类型分派渲染)
        → ToolCallCard (4 态：input-streaming / input-available / output-available / output-error)
        → ThinkingBlock (可折叠)
        → TextPart (Markdown 渲染)
        → StepGroup (可折叠的过程组)
  → react-virtuoso (虚拟化 + followOutput)
```

### 2.2 工具调用 4 态模型

参考 Vercel AI SDK 的设计：

| 状态 | 含义 | UI 表现 |
|------|------|---------|
| `input-streaming` | 工具参数正在生成（部分 JSON） | Spinner + 参数预览 |
| `input-available` | 参数完整，等待执行 | 待确认卡片（需用户批准时）或自动执行 |
| `output-available` | 工具执行成功 | 结果卡片（可折叠详情） |
| `output-error` | 工具执行失败 | 错误卡片 + 重试按钮 |

### 2.3 过程组分组

用 `step-start` / `step-end` 标记替代当前的"连续工具调用自动分组"逻辑：

```
step-start
  tool-call: Read(file.ts)     → input-streaming → output-available
  tool-call: Grep(pattern)     → input-streaming → output-available
step-end                        → 自动折叠为 "2 次工具调用"
text: "我已读完文件..."
step-start
  tool-call: Edit(file.ts)     → input-streaming → input-available (待确认)
step-end
```

---

## 3. 实现计划

### Phase 1：引入 react-virtuoso（改动最小，效果最明显）

**目标**：替换 `use-stick-to-bottom`，获得虚拟化 + 自动跟随

**改动范围**：
- `packages/ui/src/components/conversation/index.tsx` — 重写 `ConversationContent`
- `apps/electron/src/renderer/components/agent/AgentMessages.tsx` — 适配新滚动 API
- `apps/electron/src/renderer/components/layout/SessionFloatingLayout.tsx` — 适配新滚动容器

**关键设计**：
```tsx
// 新 ConversationContent
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

function ConversationContent({ items, renderItem, followOutput }) {
  return (
    <Virtuoso
      ref={virtuosoRef}
      data={items}
      itemContent={(index, item) => renderItem(item)}
      followOutput={followOutput}  // true = 自动跟随底部
      overscan={200}               // 预渲染 200px
      computeItemKey={(index) => item.id}
    />
  )
}
```

**收益**：
- 长对话只渲染可见区域 + 200px 预渲染，DOM 节点数大幅减少
- `followOutput` 内置自动跟随，用户上滚时自动停止
- 不再需要 `SessionFloatingLayout` 的手动钉底逻辑

**预估改动量**：~300 行

---

### Phase 2：流式消息状态机

**目标**：替代 `SDKMessageRenderer.tsx` 的 800 行解析逻辑

**改动范围**：
- 新建 `apps/electron/src/renderer/lib/streaming-message-parser.ts`
- 重写 `apps/electron/src/renderer/components/agent/SDKMessageRenderer.tsx`

**状态机设计**：
```typescript
// 输入：SDKMessage[]
// 输出：MessagePart[]

interface MessagePart {
  type: 'text' | 'tool-call' | 'thinking' | 'step-start' | 'step-end' | 'error'
  id: string
}

interface ToolCallPart extends MessagePart {
  type: 'tool-call'
  toolName: string
  toolUseId: string
  state: 'input-streaming' | 'input-available' | 'output-available' | 'output-error'
  input?: unknown          // 部分或完整参数
  output?: unknown         // 执行结果
  errorText?: string       // 错误信息
  isPendingApproval?: boolean
}

// 纯函数，无副作用
function parseSDKMessagesToParts(messages: SDKMessage[]): MessagePart[] {
  // 1. 按 parent_tool_use_id 分组
  // 2. 识别 step 边界（连续工具调用之间）
  // 3. 提取 text/thinking 内容
  // 4. 为每个工具调用确定 4 态中的哪一个
  return parts
}
```

**收益**：
- 解析逻辑变成纯函数，可独立测试
- 工具调用有明确的 4 态生命周期
- 新增消息类型只需扩展 `MessagePart` 联合类型

**预估改动量**：~400 行新代码 + 重写 SDKMessageRenderer

---

### Phase 3：组件重写

**目标**：按 part 类型分派渲染，每个组件职责单一

**新组件清单**：

| 组件 | 职责 | 对应旧组件 |
|------|------|-----------|
| `ToolCallCard` | 工具调用卡片（4 态） | `ProcessBlockGroup` |
| `ThinkingBlock` | 思考块（可折叠） | `agent-thinking-*` |
| `StepGroup` | 过程组（可折叠） | `agent-turn-process` |
| `TextPart` | Markdown 文本 | `MessageResponse` |
| `ErrorCard` | 错误展示 | 内联错误逻辑 |

**关键改动**：
- 工具调用卡片不再依赖 `backdrop-filter`，改用半透明实色背景
- 过程组折叠改为即时（不再 3 秒倒计时），用 `step-end` 作为折叠触发点
- 流式中只展开当前 step，之前的自动折叠

**预估改动量**：~600 行

---

### Phase 4：清理与迁移

- 删除旧的 `SDKMessageRenderer.tsx` 中不再需要的逻辑
- 删除 `ProcessBlockGroup.tsx` 的倒计时/声音相关代码
- 删除 `SessionFloatingLayout.tsx` 的手动钉底逻辑（react-virtuoso 接管）
- 更新 CLAUDE.md 架构文档

---

## 4. 参考项目

| 项目 | 参考点 |
|------|--------|
| [Vercel AI SDK](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-with-tool-calling) | 工具调用 4 态模型、`useChat` 流式管理 |
| [assistant-ui](https://github.com/assistant-ui/assistant-ui) | Runtime Adapter 模式、可组合组件原语 |
| [react-virtuoso](https://github.com/petyosi/react-virtuoso) | 虚拟化滚动、`followOutput` 自动跟随 |
| [LobeChat](https://github.com/lobehub/lobe-chat) | 多 Provider 流式处理、Zustand 状态管理 |

---

## 5. 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| react-virtuoso 与现有 StickToBottom 逻辑不兼容 | Phase 1 先做最小替换，保留旧逻辑做 fallback |
| 状态机解析遗漏某些 SDK 消息类型 | 写完整的单元测试覆盖所有 SDKMessage type |
| 流式中 Markdown 渲染不完整（未闭合的代码块） | 使用 streaming-aware markdown parser 或兜底处理 |
| 旧组件的 CSS 样式迁移不完整 | Phase 3 逐个组件迁移，保留旧 class 做兼容 |

---

## 6. 验收标准

- [ ] 长对话（100+ 条消息）滚动流畅，无卡顿
- [ ] 工具调用有 4 个明确视觉状态
- [ ] 过程组折叠即时，无 3 秒倒计时
- [ ] 流式中只展开当前 step，之前的自动折叠
- [ ] `backdrop-filter` 仅保留在滚动容器外的元素（composer、scroll button）
- [ ] 所有现有功能正常（重试、分叉、回退、压缩等）

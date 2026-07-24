# Assistant 回复行为优化

> **状态**：Proposed
> **日期**：2026-07-24
> **目标**：借鉴 Kun 的设计，优化 assistant 回复行为，与 Proma 分道扬镳
> **关联**：
> - `docs/plans/2026-07-24-2.0-refactor-overview.md`（2.0 重构总览）
> - `F:\Kun\src\renderer\src\components\chat\MessageTimeline.tsx`（Kun 实现）

---

## 1. 背景

### 1.1 现状

当前 TAgent 的 assistant 回复行为与 Proma 一样：
- 思考块可折叠
- 工具调用内嵌在消息流中
- 流式打字机效果
- 最终答案和工具混合显示

### 1.2 问题

1. **视觉干扰**：工具调用内嵌在消息流中，干扰阅读
2. **信息混乱**：最终答案和工具混合，不易区分
3. **与 Proma 相同**：没有独立设计，体现不出 TAgent 的特色

### 1.3 目标

- 与 Proma 分道扬镳，体现 TAgent 的独立性
- 优化 assistant 回复行为，提升用户体验
- 借鉴 Kun 的设计，但不照搬

---

## 2. 决策

### 2.1 Kun 的设计

**核心理念**：推理过程折叠，最终答案独立

```
助手回复：
├── 折叠区（processBlocks）
│   ├── 🧠 思考过程（reasoning）
│   ├── 🔧 工具调用 1（running/success/error）
│   └── 🔧 工具调用 2
└── 最终答案气泡（只有最后一个 assistant block）
```

**代码逻辑**：
```typescript
splitThink(text) → { think, content }

deriveTurnSections(turn) → {
  processBlocks: ChatBlock[],      // 思考 + 工具
  assistantContentBlocks: ChatBlock[],  // 最终答案
}
```

### 2.2 TAgent 的设计

**借鉴 Kun，但不照搬**：

```
助手回复：
├── 折叠区（默认折叠）
│   ├── 🧠 思考过程（reasoning）
│   ├── 🔧 工具调用 1（带状态）
│   │   ├── running：Loader2 旋转动画
│   │   ├── success：Check 绿色
│   │   └── error：CircleAlert 红色
│   └── 🔧 工具调用 2
└── 最终答案气泡（Markdown 渲染）
```

**与 Kun 的差异**：
- Kun 使用 Streamdown 库，TAgent 使用 react-markdown
- Kun 支持文件引用链接，TAgent 暂不支持
- Kun 有审批网关，TAgent 暂不需要

---

## 3. 实现设计

### 3.1 消息结构

```typescript
interface AssistantReply {
  processBlocks: ProcessBlock[]      // 思考 + 工具（折叠区）
  answerBlocks: AnswerBlock[]        // 最终答案（独立显示）
}

interface ProcessBlock {
  kind: 'reasoning' | 'tool_call' | 'tool_result'
  id: string
  content: string
  status?: 'running' | 'success' | 'error'
}

interface AnswerBlock {
  kind: 'text' | 'code' | 'markdown'
  content: string
}
```

### 3.2 拆分逻辑

```typescript
function splitAssistantReply(blocks: ChatBlock[]): AssistantReply {
  const processBlocks: ProcessBlock[] = []
  const answerBlocks: AnswerBlock[] = []
  
  for (const block of blocks) {
    if (block.kind === 'reasoning') {
      processBlocks.push({ kind: 'reasoning', ... })
    } else if (block.kind === 'tool_call') {
      processBlocks.push({ kind: 'tool_call', ... })
    } else if (block.kind === 'tool_result') {
      processBlocks.push({ kind: 'tool_result', ... })
    } else if (block.kind === 'assistant') {
      // 最后一个 assistant block 显示为答案
      answerBlocks.push({ kind: 'text', content: block.text })
    }
  }
  
  return { processBlocks, answerBlocks }
}
```

### 3.3 渲染组件

```typescript
function AssistantReplyRenderer({ reply }: { reply: AssistantReply }) {
  return (
    <div className="assistant-reply">
      {/* 折叠区 */}
      <CollapsibleSection title="执行过程" defaultCollapsed={true}>
        {reply.processBlocks.map(block => (
          <ProcessBlockRenderer key={block.id} block={block} />
        ))}
      </CollapsibleSection>
      
      {/* 最终答案 */}
      <div className="answer-bubble">
        <MarkdownRenderer content={reply.answerBlocks} />
      </div>
    </div>
  )
}
```

---

## 4. 工作量

| 改动 | 工作量 | 说明 |
|------|--------|------|
| 拆分逻辑 | 0.5 天 | splitAssistantReply 函数 |
| 折叠区组件 | 0.5 天 | CollapsibleSection + ProcessBlockRenderer |
| 最终答案组件 | 0.5 天 | AnswerBubble + MarkdownRenderer |
| 集成测试 | 0.5 天 | 验证各种场景 |
| **总计** | **2 天** | |

---

## 5. 验收标准

- [ ] 思考过程默认折叠，点击展开
- [ ] 工具调用默认折叠，带状态指示（running/success/error）
- [ ] 最终答案独立显示，不和工具混合
- [ ] 流式输出正常（打字机效果）
- [ ] 长会话不卡顿

---

## 6. 变更记录

| 日期 | 变更 |
|------|------|
| 2026-07-24 | 初稿：背景、决策、实现、验收 |

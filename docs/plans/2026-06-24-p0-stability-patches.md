# TAgent P0 稳定性 PR 模板（SDK 0.3.185 升级 + 三个修复）

> **状态**：Ready to Execute  
> **日期**：2026-06-24  
> **目标**：对齐上游 `@anthropic-ai/claude-agent-sdk@0.3.185`，合并 #910/#913/#903 三个稳定性修复  
> **关联**：[`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md) §2.1 P0  
> **上游基线**：`proma-ai/Proma` 2026-06-23 main 分支

---

## 0. Handoff 摘要

**你要做的事**：把上游 Proma 在 2026-06-19~23 之间合并的 3 个稳定性修复 + 1 个 SDK 升级移植到 TAgent。这 4 个 PR 都是单文件或小范围改动，预计 1-2 天可完成。

**优先级**：🔴 P0 — 必须做，越早越好。每会话 2s drain timeout + 长任务断连丢上下文是用户可感知的问题。

**不要做的事**：

- 不要升级 `@anthropic-ai/claude-agent-sdk` 之外的任何依赖
- 不要重构 `claude-agent-adapter.ts` 的非相关代码
- 不要修改任何 UI 文件（这 4 个 PR 全部是主进程 + 数据层）

---

## PR-1：Claude Agent SDK 升级 `0.3.153 → 0.3.185`

### 建议标题

`chore(deps): bump @anthropic-ai/claude-agent-sdk from 0.3.153 to 0.3.185`

### 目标

消除每会话 2 秒 drain timeout，修复 SDK iterator 终止语义。

### 改动点

**`apps/electron/package.json`**：

```diff
   "dependencies": {
-    "@anthropic-ai/claude-agent-sdk": "0.3.153",
+    "@anthropic-ai/claude-agent-sdk": "0.3.185",
     "@anthropic-ai/sdk": "^0.93.0",
```

**`apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`**：

参考上游 PR #913 的关键变更：

```typescript
// 1. 关闭 promptSuggestions（避免每条 result 后续到达"假结尾"消息）
const query = new Query({
  prompt,
  options: {
    // ... 其他 options
    promptSuggestions: false,  // 🆕 新增
  },
});

// 2. 适配 iterator 终止语义
for await (const message of query) {
  // 处理消息
  if (isTerminalResult(message)) {
    // 🆕 SDK 0.3.185：主动 break 触发 iterator.return() → cleanup()
    break;
  }
}
// for-await 循环退出后 iterator 自动调用 return()
```

### 验收标准

- [ ] 编译通过（`bun run typecheck`）
- [ ] 现有测试通过（`bun test`）
- [ ] 手动验证：启动一个会话、发送消息、等待结束 → 日志中不再出现 "drain timeout: 2000ms"
- [ ] 不影响 `toolTokenEstimator` / `permissionService` 等现有适配器调用

### 风险

低。SDK 升级经过上游 v0.13.0~v0.13.3 三个版本验证。

### 回滚

修改 `package.json` 版本号 → `bun install` → 重启应用。

### 关联上游 PR

- proma-ai/Proma #913：SDK 0.3.185 iterator 终止语义适配
- proma-ai/Proma #884：Upgrade Claude Agent SDK

---

## PR-2：并发会话同步写风暴修复（#910）

### 建议标题

`fix(agent): only persist sdkSessionId when session_id actually changes (#910)`

### 背景

当多 Agent 会话并行时，`onSessionId` 回调每条 SDK 消息都会触发同步 fsync。SDK v2 后每条消息都包含 `session_id` 字段，导致每次都触发"开始 → 接收 → 同步写 → 更新 → 同步写 → 返回"的完整流程。

会话越长、操作越多，同步 fsync 风暴越严重。在 dev 模式下由于日志写入，被放大数倍无法察觉；线上则会导致 UI 卡顿、整体渲染延迟。

### 目标

只在 `session_id` 真正变化时持久化一次。

### 改动点

**`apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`**：

```typescript
// 🆕 修复前（错误写法）
let existingSdkSessionId: string | undefined;
function onSessionId(sessionId: string) {
  // ❌ 每条消息都触发
  if (existingSdkSessionId !== sessionId) {
    existingSdkSessionId = sessionId;
    persistSdkSessionId(sessionId);  // 同步 fsync
  }
}

// 🆕 修复后（正确写法）
let capturedSdkSessionId: string | undefined;  // 🆕 改为 captured
function onSessionId(sessionId: string) {
  // ✅ 仅在真正变化时持久化
  if (capturedSdkSessionId !== sessionId) {
    capturedSdkSessionId = sessionId;
    persistSdkSessionId(sessionId);
  }
}
```

**关键改动**：

- 把 `existingSdkSessionId` 改名为 `capturedSdkSessionId`（避免歧义）
- 实际捕获的 id 与历史 id 比较
- 新会话 `existingSdkSessionId` 为 `undefined`，第一次进入必然触发一次

### 验收标准

- [ ] 现有测试通过
- [ ] 新增单测：模拟 100 条 SDK 消息连续到达，验证 `persistSdkSessionId` 只被调用 1 次（当 `session_id` 不变时）
- [ ] 手动验证：长会话（>100 消息）不再出现明显卡顿

### 风险

低。仅变量名 + 一次持久化调用优化。

### 回滚

变量名改回 `existingSdkSessionId`。

### 关联上游 PR

- proma-ai/Proma #910：并发会话同步写风暴修复

---

## PR-3：长任务断连后保留 `sdkSessionId`（#903）

### 建议标题

`fix(agent): preserve sdkSessionId on transient network errors to avoid context loss`

### 背景

Agent 长任务（数十分钟）过程中网络抖动后恢复时：

- 修复前：终止分支会清除 `sdkSessionId`，导致 resume 时 JSONL 指针丢失
- 触发 ~50K token 的 `buildContextPrompt` 全量重传
- 用户执行 "Interrupt + Continue" 也无法恢复，只能新建会话手动重发

### 目标

终止分支不再清除 `sdkSessionId`；扩展 `TRANSIENT_NETWORK_PATTERN` 覆盖更多断连模式。

### 改动点

**`apps/electron/src/main/lib/adapters/claude-agent-adapter.ts`**：

```typescript
// 🆕 修复前
function shouldClearSession(error: AgentError): boolean {
  // ❌ 网络错误也清除
  return !error.isUserAbort;
}

// 🆕 修复后
const TRANSIENT_NETWORK_PATTERN = /ECONNABORTED|connection closed|AbortError|timed out|ENETUNREACH|ETIMEDOUT/i;

function shouldClearSession(error: AgentError): boolean {
  // ✅ 网络错误不认为是 session 失效
  if (TRANSIENT_NETWORK_PATTERN.test(error.message)) {
    return false;
  }
  // 用户主动 abort / 5xx / 未知错误 都不清
  return false;  // 默认不清
}

// 强指令要求：先读 JSONL 历史再决定
async function resumeSession(sdkSessionId: string) {
  const jsonlPath = await findJsonlForSession(sdkSessionId);
  if (!jsonlPath) {
    throw new Error(`Cannot resume session ${sdkSessionId}: JSONL not found`);
  }
  const history = await readJsonlHistory(jsonlPath);
  // 用历史指针恢复，不再重传 buildContextPrompt
  return history;
}
```

**关键改动**：

1. `shouldClearSession` 默认返回 `false`（不再因为网络错误清除 session）
2. 扩展 `TRANSIENT_NETWORK_PATTERN` 正则
3. `resumeSession` 路径改为先读 JSONL 历史指针

### 验收标准

- [ ] 现有测试通过
- [ ] 新增单测：网络错误（ECONNABORTED）场景下 `sdkSessionId` 被保留
- [ ] 新增单测：5xx 场景下 `sdkSessionId` 被保留
- [ ] 手动验证：长任务断网 → 重连 → Continue 不再触发 "session not found"

### 风险

低-中。session 指针错误可能导致 thinking-signature 不匹配，但比现在全量重传好得多。

### 回滚

恢复 `shouldClearSession` 旧逻辑 + 移除 JSONL 预读步骤。

### 关联上游 PR

- proma-ai/Proma #903：长任务断连后保留 sdkSessionId

---

## PR-4：输入框 / 推荐消息 / 附件 chip bug 修复合集

### 建议标题

`fix(agent): preserve input draft, ordered list shift+enter, attachment preview, etc.`

### 改动点汇总

本 PR 合并上游 6 个小修复，均为单文件改动：

| 编号 | 文件 | 改动 |
|---|---|---|
| #904 | `AgentInputBar.tsx` | 推荐条发送后保留输入栏草稿 |
| #908 | `RichTextInput.tsx` | 有序列表 Shift+Enter 续项修复 |
| #906 | `FileChip.tsx` | 附件 chip 支持点击预览 |
| #909 | `AgentPreviewToggle.tsx` | 移除 auto preview toggle |
| #912 | `PreviewPanel.tsx` | 预览面板切换保留 AskUserQuestion 草稿 |
| #911 | `globals.css` | 轻量主题代码选区对比度优化 |

#### #904 推荐消息保留草稿

```typescript
// 🆕 修复前
function handleSend() {
  setInputContent('');  // ❌ 覆盖草稿
  sendMessage(currentContent);
}

// 🆕 修复后
function handleSend(overrideText?: string) {
  const finalText = overrideText ?? inputContent;
  sendMessage(finalText);
  if (!overrideText) {
    setInputContent('');  // ✅ 仅在无 override 时清空
  }
}
```

#### #908 有序列表 Shift+Enter

```typescript
// Tiptap OrderedList extension 配置
OrderedList.configure({
  // 🆕 启用 Shift+Enter 续项
  keepAttributes: true,
  keepMarks: true,
  // ... 关键配置：允许 Shift+Enter 插入新列表项
});
```

#### #906 附件 chip 预览

```typescript
function AttachmentChip({ attachment }: Props) {
  return (
    <Chip
      onClick={() => onPreview(attachment)}  // 🆕 新增点击预览
      hoverable
    >
      {attachment.name}
    </Chip>
  );
}
```

### 验收标准

- [ ] 推荐消息发送后，输入框草稿保留
- [ ] 有序列表 Shift+Enter 正确续项
- [ ] 附件 chip 点击打开预览面板
- [ ] 切换预览面板后 AskUserQuestion 草稿保留
- [ ] 轻量主题代码选区对比度足够
- [ ] 现有所有 UI 测试通过
- [ ] 手动回归 Ask / Agent 两档位

### 风险

极低。每个改动都是单文件、单功能点。

### 回滚

单文件 revert 即可。

---

## 执行顺序与时间安排

```
Day 1（上午）：
  - PR-1 SDK 升级（1-2 小时）
  - PR-2 写风暴修复（30 分钟）

Day 1（下午）：
  - PR-3 断连保留 sdkSessionId（2-3 小时）
  - 跑完整测试套件验证

Day 2：
  - PR-4 6 个 UI bug 修复合集（2-3 小时）
  - 手动回归 Ask / Agent 双模式
  - 更新 CHANGELOG + PROGRESS.md
```

---

## 通用 PR 模板（4 个 PR 共用）

```markdown
## 变更说明

[Brief description of what this PR does]

## 关联上游

- proma-ai/Proma #[PR number]

## 改动文件

- [file list]

## 验收标准

- [ ] 类型检查通过（`bun run typecheck`）
- [ ] 单元测试通过（`bun test`）
- [ ] 现有所有测试无回退
- [ ] 手动验证：[scenario]

## 风险与回滚

- 风险：[low/medium/high]
- 回滚：[具体步骤]

## 品牌检查

- [ ] 未引入 `@proma/*` 引用
- [ ] 数据路径仍为 `~/.tagent[-dev]/`
- [ ] 未破坏 general / ta 模式隔离
```

---

## 验证脚本

```bash
# 类型检查
bun run typecheck

# 跑测试
bun test apps/electron/src/main/lib/adapters/
bun test apps/electron/src/main/lib/

# 手动验证清单
# 1. 启动应用 → 新建会话
# 2. 发送长消息 → 等待流式完成 → 确认无 "drain timeout" 日志
# 3. 触发网络断开 → 恢复 → 验证 sdkSessionId 保留
# 4. 点击推荐消息 → 验证输入框草稿保留
# 5. 附件 chip 点击 → 验证预览面板打开
```

---

## 相关文档

- [`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md) §2.1 P0 总览
- [`2026-06-13-context-usage-breakdown-design.md`](2026-06-13-context-usage-breakdown-design.md) — 已完成的 context usage 接入
- [`CLAUDE.md`](../../../CLAUDE.md) — 项目级约束
- [`docs/PROGRESS.md`](../../PROGRESS.md) — 进度追踪
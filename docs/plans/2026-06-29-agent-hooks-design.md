# Agent Hooks 机制设计

> **状态**：规划中（未启动）— SDK 调研已完成
> **日期**：2026-06-29
> **背景**：vibe coding 场景下，Agent 改一步用户验证一步的开环问题
> **关联**：调研自 [obra/superpowers](https://github.com/obra/superpowers) 的 hooks 机制

## 0. SDK 调研结论（2026-06-29 已验证）

通过阅读 `@anthropic-ai/claude-agent-sdk@0.3.185` 类型定义 + 编写验证脚本（类型检查通过），确认以下关键事实：

### 0.1 SDK 原生支持 JS 回调式 hooks（非 shell）

`sdk.d.ts:766` `HookCallbackMatcher` + `sdk.d.ts:1433` query options 的 `hooks` 字段：

```typescript
hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>

interface HookCallbackMatcher {
  matcher?: string           // 工具名匹配，如 "Write|Edit"
  hooks: HookCallback[]       // JS 函数数组
  timeout?: number            // 秒
}

type HookCallback = (input: HookInput, toolUseID: string | undefined, options: {...}) => Promise<HookJSONOutput>
```

**意义**：不用走 `settings.json` + `type:"command"` 执行 shell，可以直接传 JS 函数进 query options。host 进程内执行，**无 shell 注入风险**。

### 0.2 PostToolUse 回灌机制确认

`sdk.d.ts:2120` `PostToolUseHookInput`：

```typescript
{
  hook_event_name: 'PostToolUse'
  tool_name: string           // 能拿到工具名
  tool_input: unknown         // 能拿到工具参数（含 file_path）
  tool_response: unknown     // 能拿到工具执行结果
  tool_use_id: string
  duration_ms?: number
}
```

`sdk.d.ts:2132` `PostToolUseHookSpecificOutput`：

```typescript
{
  hookEventName: 'PostToolUse'
  additionalContext?: string       // 追加上下文给 Agent（核心回灌通道）
  updatedToolOutput?: unknown      // 替换工具输出本身（更强）
}
```

**意义**：在 PostToolUse 回调里跑 typecheck，把错误通过 `additionalContext` 回灌，Agent 下一轮就能看到——闭环可行。

### 0.3 对原方案的影响（工作量重估）

| 路线 | 原评估 | 调研后重估 | 变化原因 |
|------|--------|----------|---------|
| A. settings.json shell hook | 4.5 天 | 不再推荐 | shell 执行有安全风险，且配置复杂 |
| **B. host 侧 JS 回调** | 8-10 天 | **4-5 天** | SDK 原生支持，不用造消息注入机制 |

**结论**：走路线 B。SDK 帮你做了消息注入，host 只需注册回调 + 跑验证命令 + 返回 additionalContext。

### 0.4 运行时验证（2026-06-29 已完成真 SDK 集成测试）

通过 `scripts/test-hooks-sdk-integration.ts` 用 suifeng 渠道（glm-5.1）跑真 SDK 集成测试，确认：

- [x] **hook 是否真的在工具调用后被触发** → ✅ Agent 调 Write 后 `[HOOK #1] PostToolUse 触发`，`tool_name: Write`
- [x] **additionalContext 是否真的回灌** → ✅ `additionalContext 回灌 134 字符`，内容含完整 typecheck 错误
- [x] **typecheck 是否真跑了** → ✅ `exit=2` + 精确错误 `TS2322: Type 'string' is not assignable to type 'number'`
- [x] **monorepo 包定位** → ✅ `resolveTypecheckCwd` 正确定位到文件所属包目录跑 typecheck

**遗留问题**：Agent 收到 additionalContext 后未主动修复（glm-5.1 模型遵循度问题）。

原因分析：
1. `additionalContext` 是 SDK 内部注入给模型的上下文，不作为独立 SDKMessage 出现在流里（这是预期行为）
2. glm-5.1 对"看到 typecheck 错误必须修复"的指令遵循度不如 Claude 系模型
3. 当前 prompt 未明确强化"看到 [auto-typecheck] 错误必须修复"的指令

**下一步优化**（未做）：在系统提示词里加规则，如"若工具执行后收到 [auto-typecheck] 错误回灌，必须在同一会话内修复后再继续"。但 hook 机制本身已完全跑通，闭环成立。

### 0.5 prompt 强化 + 死循环防护（2026-06-29 已实现）

针对 0.4 发现的"Agent 收到回灌不修复"问题，完成两项加固：

**1. 系统提示词强化**（`agent-prompt-builder.ts`）

新增 `HOOK_AUTO_VERIFICATION_RULES` section，注入到每个 query 的 systemPrompt：
- 看到 `[auto-typecheck]` 回灌**必须立即修复**，不是信息性提示
- 修复后系统自动重新验证，直到不再收到回灌（表示通过）
- 死循环时（连续 3 次失败）系统会停止，此时应向用户说明
- 找不到 typecheck 脚本可忽略

**2. 死循环防护**（`hooks/post-tool-use.ts`）

`triggerStateMap` 记录每个文件的连续失败次数：
- 成功（exit=0）→ 清零计数
- 失败 → 计数 +1
- 达 `MAX_CONSECUTIVE_FAILURES=3` → `halted=true`，后续触发直接回灌"已停止"提示，不再跑 typecheck
- 进程级状态（Map），会话结束随进程退出销毁

**逻辑测试验证**（`scripts/test-hooks-logic.ts` 测试 5）：
- 第 1-3 次失败：正常回灌错误，计数 1/3 → 2/3 → 3/3
- 第 3 次标记"已停止"
- 第 4 次及之后：直接回灌"已停止自动验证"提示，不再跑 typecheck ✅

**未做**：~~真 SDK 集成重测~~ → **已完成（2026-06-29）**

重跑 `scripts/test-hooks-sdk-integration.ts`（注入 prompt 规则 + 死循环防护），闭环完全跑通：

```
[MSG #8]  Agent 用 Write 创建 bad.ts（含类型错误 const x: number = "not_a_number"）
  ↓
[HOOK #1] PostToolUse 触发 → typecheck 失败 (第 1/3 次) → 回灌错误
  ↓
[MSG #10] Agent: "收到了类型检查错误。我来修复这个文件"
  ↓
[MSG #11] Agent 用 Edit 修复 bad.ts（"not_a_number" → 42）
  ↓
[HOOK #2] PostToolUse 触发 → typecheck 通过 → 不回灌（成功信号）
  ↓
[MSG #13] Agent: "文件已修复...类型检查通过"
  ↓
[MSG #14] result: success
```

**关键验证点**：
- ✅ Agent 收到 [auto-typecheck] 回灌后主动修复（之前不修复的问题已解决）
- ✅ 修复后 typecheck 自动重跑，通过后不再回灌（避免 context 污染）
- ✅ Agent 自己确认"类型检查通过"并停止（闭环正确终止）
- ✅ 死循环防护未误触发（1 次失败后即修复成功，计数清零）

**注**：最终判断脚本显示"部分成功"是因为检测逻辑要求 `[auto-typecheck]` 字面出现在 SDKMessage 流——但 additionalContext 是 SDK 内部注入模型的上下文，不作为独立消息出现。Agent 的实际行为（修复 + 通过）已证明回灌生效。

## MVP 完成度总结

| 层 | 状态 |
|----|------|
| hook 机制（触发 + 回灌） | ✅ 真 SDK 验证通过 |
| monorepo 包定位 | ✅ 逻辑测试通过 |
| prompt 强化（Agent 主动修复） | ✅ 真 SDK 验证通过 |
| 死循环防护（连续 3 次停止） | ✅ 逻辑测试通过 |
| 完整闭环（改→查→修→过） | ✅ 真 SDK 验证通过 |
| 工作区级开关（config + IPC + preload） | ✅ 逻辑测试 + 构建通过 |
| 全局开关（settings + UI） | ✅ 已改为全局，构建通过 |
| 类型检查 | ✅ 全绿（shared/core/ui/electron） |

### 工作区级开关（2026-06-29 已实现）

**已改为全局配置**（2026-06-29 修正）：原工作区级开关方案经评估冗余——hook 内部 `resolveTypecheckCwd` 已能智能跳过非 TS 项目，工作区级开关价值低。改为全局 settings.json 配置，符合"通用能力"认知。

**配置链路（全局）**：
- `HooksConfig` 类型在 `@tagent/shared`（`{ autoTypecheck?: boolean }`）
- `AppSettings` 加 `hooks?: HooksConfig` 字段（`types/settings.ts`）
- 复用现成 `settings-service.ts` 的 `getSettings` / `updateSettings`（合并写入）
- `agent-orchestrator.ts` queryOptions：`...(appSettings.hooks?.autoTypecheck !== false && { hooks: buildPostToolUseHooks() })`——默认开启
- 设置 UI：`GeneralSettings.tsx` 加 Switch 开关，复用 `window.electronAPI.updateSettings({ hooks: { autoTypecheck } })`

**回滚项**：
- 删 `agent-workspace-manager.ts` 的 `getWorkspaceHooksConfig` / `updateWorkspaceHooksConfig`
- 删 `WorkspaceConfig.hooks` 字段 + 解析逻辑
- 删 IPC 通道 `GET_WORKSPACE_HOOKS` / `UPDATE_WORKSPACE_HOOKS` + handler
- 删 preload 的 `getWorkspaceHooks` / `updateWorkspaceHooks`
- 删测试脚本 `scripts/test-hooks-workspace-config.ts`

**验证**：
- 类型检查全绿（shared/core/ui/electron）
- 主进程 + preload 构建通过
- UI 开关接入 GeneralSettings，读写 settings.json 的 hooks 字段

**应用内实测**（待用户在 dev 跑）：
1. `bun run dev` 启动
2. 设置 → 通用 → "改代码后自动类型检查" 开关
3. 在 TS 项目工作区让 Agent Edit 一个 .tsx 引入类型错误
4. 观察：开关开 → Agent 自动看到 typecheck 错误并修复；开关关 → hook 不触发

### 应用内实测结果（2026-06-29 已完成）

用户在真实 TAgent 应用内跑了 `scripts/hook-demo/`（含 4 个故意类型错误的 .ts 文件），让 Agent 修复。完整闭环在应用内验证通过：

```
① 思考：查看 hook-demo 目录 + 读取 hook-demo.ts
  ↓
思考：发现 4 个类型错误
  ↓
4 次 Edit（并行修 4 处）
  ↓
第 1 个 Edit 后立即触发 auto-typecheck ← hook 真触发
  ↓
typecheck 报"还有 3 个错误"（其余 3 处此刻还没改完）
  ↓
Agent 继续完成剩余 Edit
  ↓
总结：4 个错误全修好，VALID_CONSTANT 未动 ✅
```

截图证据："执行过程：7 次工具调用，6 条消息" + auto-typecheck 反馈框 + 4 个 Edit 卡片 + VALID_CONSTANT 标为不变量。

**结论**：hooks MVP 在真实 TAgent 应用内端到端验证通过——全局开关生效、hook 真触发、typecheck 真跑、错误真回灌、Agent 真响应、正确代码真保留。

### 已知优化项（不阻塞 MVP）

**并行 Edit 的过时反馈问题**：Agent 并行改多处时，第 1 个 Edit 后 typecheck 立即跑，报"还有 N 个错误"——但这些错误对应的代码 Agent 马上就要改了，反馈对 Agent 是过时的。

当前缓解：5s 去重窗口避免后续 Edit 重复跑 typecheck（省了 N-1 次浪费）。

可选优化（后续）：
1. **防抖模式**：Edit 后等 1-2s 无新 Edit 再跑（聚合并行 Edit）
2. **PostToolBatch 事件**：SDK 原生有此事件类型，工具批量执行完才触发（更准但要改 hook matcher 类型）

## 1. 痛点

当前 TAgent 的 vibe coding 是**开环模式**：

```
Agent 改完文件 → 告诉用户"改完了"
                → 用户心里没底 → 手动问"typecheck 跑了吗"
                → Agent 去跑 → 报错 → 用户看错误 → 催 Agent 修
                → 修完 → 用户又问"这次过了吗" → ...
```

**用户被迫充当"监工"**，每个工具调用后都要主动推动验证。这违背了 Agent 的初衷——用户应该是"审稿人"，只在关键节点介入。

具体表现：
- IPC 通道改动涉及 4 个文件（type / main / preload / renderer），改完没人自动检查一致性
- .tsx 改完不会自动 typecheck，错误要等用户催才跑
- 一组文件改完不会自动 lint
- 配置文件改完不会自动校验合法性

## 2. hooks 机制是什么

**在 Agent 生命周期的特定事件点，自动执行预配置动作，Agent 无法绕过。**

| 事件 | 触发时机 | 能力 | TAgent 现状 |
|------|---------|------|------------|
| SessionStart | 会话开始 | 注入上下文 | ✅ `agent-prompt-builder.ts` 已覆盖 |
| PreToolUse | 工具调用前 | 可阻断 | ✅ `canUseTool` 已覆盖（allow/deny/ask） |
| PostToolUse | 工具调用后 | 自动后处理 | ❌ **缺失（核心要补的）** |
| UserPromptSubmit | 用户提交 prompt | 改写 prompt | ❌ 缺失 |
| Stop | Agent 准备停止 | 完成前验证 | ❌ 缺失 |

**关键区别**：
- prompt / SKILL.md 里的 "You MUST..." = 软约束，Agent 可无视
- hook = 确定性代码，Agent 无法绕过

## 3. 现状调研（TAgent 架构）

### 3.1 SDK 原生支持 hooks

`agent-orchestrator.ts:245-248` 的 terminal_reason 白名单注释：

```
- hook_stopped / stop_hook_prevented：hook 层面的暂停，host 可继续注入消息
```

**说明 Claude Agent SDK 0.2.120+ 原生有 hook 机制**，不需要从零造事件分发层。

### 3.2 canUseTool = PreToolUse

`agent-permission-service.ts`：
- `PermissionResult` 类型匹配 SDK 0.2.120（behavior: allow/deny）
- `canUseTool` 回调签名：`(toolName, input, options) => Promise<PermissionResult>`
- 已有完整的权限队列、会话级白名单、用户确认 UI

**PreToolUse 的拦截能力已经完备**，不是这次要做的。

### 3.3 PostToolUse 的插入点

`agent-orchestrator.ts:2348` 的手动事件循环：

```typescript
while (true) {
  // ... Promise.race 拿到 SDKMessage
  if (msg.type === 'assistant') {
    // 处理 tool_use（工具开始）← PreToolUse 在这之前已由 canUseTool 处理
  }
  // msg.type === 'user' 且含 tool_result ← 这里是工具执行完成的位置
  //    ↑ PostToolUse 钩子应在此处触发
}
```

**插入点明确**：在 `tool_result` 消息出现时，根据工具类型和参数触发对应的后处理钩子。

## 4. 分阶段方案

### 第一步：PostToolUse 特化钩子（高 ROI / 低风险）

**不做通用 shell 执行**，只内置几个固定钩子：

| 钩子 | 触发条件 | 动作 | 回灌方式 |
|------|---------|------|---------|
| auto-typecheck | Edit/Write 命中 `*.ts`/`*.tsx` | 跑 `bun run typecheck` | 错误作为 tool_result 注入 Agent 上下文 |
| auto-lint | Edit/Write 命中 `*.ts`/`*.tsx` | 跑 `bun run lint`（如有） | warning/error 注入 |
| config-validate | Edit/Write 命中 `*.json` 配置 | JSON 合法性 + schema 校验 | 错误注入 |

**为什么特化而非通用**：
- 避开"执行任意 shell"的安全风险（桌面应用用户可能误装恶意 hook）
- 不需要用户配置，开箱即用
- 覆盖 vibe coding 80% 的验证痛点
- 不需要 GUI 配置界面

**体感变化**：
```
Agent 改完 .tsx → typecheck 自动跑 → 错误自动回灌 → Agent 自己修 → 再跑 → 通过
                                                                    ↑
                                              用户完全不参与，只在最后看结果
```

### 第二步：UserPromptSubmit + Stop 钩子（中 ROI / 中成本）

- UserPromptSubmit：自动注入项目规范（如"改 IPC 要同步 4 处"）
- Stop：完成前自动跑验证清单（typecheck + lint + 测试）

### 第三步：通用 hooks + 配置（低 ROI / 高风险，暂不做）

开放用户自定义 hook，配 GUI 配置界面。桌面应用做这个安全风险高，短期不建议。

## 5. 第一步技术设计

### 5.1 钩子注册

在 `agent-orchestrator.ts` 的事件循环里，`tool_result` 分支增加钩子分发：

```typescript
// 伪代码
if (isToolResultMessage(msg)) {
  const toolUse = findCorrespondingToolUse(msg, accumulatedMessages)
  const hooks = getActivePostToolUseHooks(workspaceSlug)
  for (const hook of hooks) {
    if (hook.matches(toolUse)) {
      const result = await hook.run(toolUse)
      if (result.hasOutput) {
        // 作为追加的 tool_result 注入 Agent 上下文
        injectHookResultIntoContext(sessionId, result)
      }
    }
  }
}
```

### 5.2 钩子接口

```typescript
interface PostToolUseHook {
  id: string
  name: string
  /** 判断是否匹配该工具调用 */
  matches(toolUse: { name: string; input: Record<string, unknown> }): boolean
  /** 执行后处理，返回需回灌的输出 */
  run(toolUse: { name: string; input: Record<string, unknown> }): Promise<HookResult>
}

interface HookResult {
  hasOutput: boolean
  output?: string  // 回灌给 Agent 的内容（如 typecheck 错误）
  isError?: boolean
}
```

### 5.3 内置钩子实现位置

- `main/lib/hooks/post-tool-use/` 新目录
- `auto-typecheck.ts` / `auto-lint.ts` / `config-validate.ts` 各一个文件
- `main/lib/hooks/registry.ts` 注册表，按工作区读取启用状态

### 5.4 启用控制

工作区级配置（`config.json` 扩展）：

```json
{
  "hooks": {
    "postToolUse": {
      "auto-typecheck": { "enabled": true },
      "auto-lint": { "enabled": false },
      "config-validate": { "enabled": true }
    }
  }
}
```

默认全开（vibe coding 场景下用户期望自动验证）。

### 5.5 安全约束

- **只跑白名单命令**：`bun run typecheck` / `bun run lint`，不接受任意命令
- **超时保护**：单钩子执行上限 30s，超时丢弃
- **cwd 限制**：只能在当前工作区 cwd 执行
- **输出截断**：回灌内容上限 10KB，防止 context 爆炸

## 6. 风险与未决问题

| 风险 | 缓解 |
|------|------|
| typecheck 慢（大项目 10s+）影响 Agent 响应 | 异步执行 + 只在 Edit/Write 后触发，不阻塞主流程 |
| 错误回灌污染 context | 截断 + 只回灌 error，不回灌成功输出 |
| 钩子触发死循环（typecheck 报错→Agent 修→又报错） | 限制连续触发次数（如同一文件 3 次后暂停） |
| 跨平台 shell 差异 | 用 Bun API（`Bun.spawn`）而非 shell 字符串 |

**未决问题**：
1. 钩子输出回灌用 tool_result 还是 user message？（tool_result 更自然，但 SDK 对注入的 tool_result 有校验）
2. 多个钩子并行还是串行？（建议串行，避免 context 污染）
3. 是否需要 UI 显示"钩子正在执行"的状态？（建议需要，否则用户不知道为什么 Agent 卡住）

## 7. 与 Superpowers 的关系

Superpowers 的核心价值 = 强制性工作流 + hooks 机制。

TAgent 借鉴路径：
- **不原样移植 Superpowers 的 14 个 skill**（依赖 Claude Code hooks + CLI 开发场景，TAgent 不匹配）
- **借鉴 hooks 机制本身**，做成 TAgent 原生的 PostToolUse 特化钩子
- **可选**：把 Superpowers 的方法论 skill（brainstorming / systematic-debugging / verification-before-completion）改写成 TAgent 风格的建议性 SKILL.md，配合 hooks 形成闭环

## 8. 下一步

- [ ] 确认 SDK 0.2.120 的 hooks 配置接口（是 settings.json 还是 query options）
- [ ] 原型验证：在事件循环里插一个 console.log，确认 tool_result 能被捕获
- [ ] 实现 auto-typecheck 钩子作为 MVP
- [ ] 内测：用 TAgent 改 TAgent 自己的代码，体感对比

## 9. 不做的

- **不做通用 hook 执行**（安全风险，桌面应用不合适）
- **不做第三方 hook 市场**（短期无价值）
- **不做 Superpowers 原样移植**（场景不匹配）

# Agent 模式稳定性问题诊断报告

> **状态**:已诊断,待修复
> **日期**:2026-07-05
> **来源**:看板 `b_mr7k89qt9d529a3d` 4 个并行排查任务结果汇总
> **范围**:TAgent Agent 模式 + kscc 内网渠道

---

## 0. 问题清单

| # | 问题 | 优先级 | 修复难度 | 状态 |
|---|------|-------|---------|------|
| 1 | 发送延迟很长才有反应 | P1 | 中(短期优化) / 高(长期架构) | 待修复 |
| 2 | context 爆了会话直接终止,连 context 工具都用不了 | P0 | 中 | 待修复 |
| 3 | resume sessionId 错乱导致消息再也发送不了 | P0 | 低 | 待修复 |
| 4 | kscc 报错无法反映到 UI,TAgent 背锅 | P0 | 低(短期) / 中(长期) | 待修复 |

**优先修复顺序**:3 > 2 > 4 > 1(P0 先做容易的,再做架构级的)

---

## 1. 问题 3:resume sessionId 错乱

### 根因(按概率排序)

**根因 1(高概率):`isSessionNotFoundError` 模式匹配过窄**

- `agent-orchestrator.ts:253-256` 只匹配单一英文模式 `/No conversation found.*with session/i`
- kscc 渠道(内网 CLI 子进程)错误信息格式与 Anthropic 官方 SDK 不一致,可能输出中文、`session_id invalid`、`Session expired`、stderr 带 kscc 包装错误等,**均不匹配**
- 未识别时进入正常 result 处理路径,`agent-orchestrator.ts:2733-2735` 注释明确说明:"SDK 先分配新 session ID 再立即 result 错误,错误 result 会被当成正常完成处理,sdkSessionId 被覆盖成无效值"
- `onSessionId` 回调(`agent-orchestrator.ts:2339-2350`)已把"新分配但失效"的 sdkSessionId 写入 `agent-sessions.json`
- 下轮发消息 resume 这个无效 sdkSessionId → 又失效 → 又不匹配 → 又覆盖 → **死循环,消息再也发送不了**

**根因 2(中概率):onSessionId 在 resume 失效场景下盲目信任 SDK 新分配的 session ID**

- 只要 sdkSessionId 与 capturedSdkSessionId 不同就写入磁盘,不区分"正常新会话"与"resume 失效后 SDK 临时分配的 session"
- 即使 `isSessionNotFoundError` 匹配成功,`prepareResumeFallbackRecovery` 会清空 sdkSessionId(line 1064),但**清空时机晚于 onSessionId 写入**——若中途打断或清空失败(catch 块只 warn),磁盘上残留无效 sdkSessionId

**根因 3(低概率,可排除):updateAgentSessionMeta 非原子读-改-写**

- `agent-session-manager.ts:423-474` read→modify→write 三步,但**全同步**(`readFileSync`/`writeFileSync`/`renameSync`),Node.js 单线程下不会被打断
- 仅在跨 await 边界时存在理论竞态,实际不会导致 sdkSessionId 串号(按 id 查找合并)
- **此根因基本可排除**

### 复现路径

1. 通过 kscc 渠道发起会话,让 SDK 生成 sdkSessionId 并持久化
2. 手动删除 `~/.tagent/sdk-config/projects/<hash>/<sid>.jsonl`(模拟 SDK session 过期/被清理)
3. 再次发消息:SDK resume 失效,错误信息若不匹配 `/No conversation found.*with session/i`,sdkSessionId 被覆盖成无效值
4. 此后该会话所有消息都失败,无法发送

### 修复方案

**P0 - 扩展 session-not-found 错误识别**(`agent-orchestrator.ts:253-256`)

```typescript
function isSessionNotFoundError(errorMessage: string, stderr?: string): boolean {
  const patterns = [
    /No conversation found.*with session/i,
    /session[_ ]?id.*(not found|invalid|expired|unknown)/i,
    /session.*not.*found/i,
    /会话.*(不存在|已失效|已过期)/,
    /resume.*fail/i,
  ]
  const text = `${errorMessage}\n${stderr ?? ''}`
  return patterns.some((p) => p.test(text))
}
```

**P1 - 错误恢复兜底:result 错误时回滚 sdkSessionId**(`agent-orchestrator.ts:2737-2770`)

result 错误(subtype 以 `error` 开头)且本轮 capturedSdkSessionId 与 existingSdkSessionId 不同时,**不信任新 sdkSessionId**,主动回滚:

```typescript
if (resultErrorMsg.subtype.startsWith('error') && 
    capturedSdkSessionId !== existingSdkSessionId) {
  updateAgentSessionMeta(sessionId, { sdkSessionId: existingSdkSessionId })
  capturedSdkSessionId = existingSdkSessionId
}
```

**P2 - 数据校验:读取 sdkSessionId 时校验 JSONL 存在**(`agent-orchestrator.ts:1466-1467`)

```typescript
const sessionMeta = getAgentSessionMeta(sessionId)
let existingSdkSessionId = sessionMeta?.sdkSessionId
if (existingSdkSessionId && !findSdkSessionJsonl(existingSdkSessionId)) {
  console.warn(`[Agent 编排] sdkSessionId 的 JSONL 不存在,清空: ${existingSdkSessionId}`)
  updateAgentSessionMeta(sessionId, { sdkSessionId: undefined })
  existingSdkSessionId = undefined
}
```

复用已有的 `findSdkSessionJsonl`(`agent-session-manager.ts:1135`)。

**P3 - 增加错误兜底:未知错误也自动回退到新会话**

将 `prepareResumeFallbackRecovery`(`agent-orchestrator.ts:1048`)作为所有 SDK 错误的最终兜底,而非仅限 session-not-found / thinking signature。当 SDK 抛错且 resume 关系存在时,自动清除 sdkSessionId 切换到上下文回填模式。

### 关键代码位置

- 错误识别:`apps/electron/src/main/lib/agent-orchestrator.ts:253-256`
- onSessionId 写入:`apps/electron/src/main/lib/agent-orchestrator.ts:2339-2350`
- 持久化(同步安全):`apps/electron/src/main/lib/agent-session-manager.ts:423-474`、`safe-file.ts:22-40`
- 读取 sdkSessionId:`apps/electron/src/main/lib/agent-orchestrator.ts:1466-1467`
- session-not-found 恢复:`apps/electron/src/main/lib/agent-orchestrator.ts:1013-1072`、`2572-2590`、`2744-2770`、`2911-2929`
- 渠道切换清空:`apps/electron/src/main/lib/agent-orchestrator.ts:1471-1482`
- resumeSessionId 传递:`apps/electron/src/main/lib/agent-orchestrator.ts:2294`
- JSONL 查找工具:`apps/electron/src/main/lib/agent-session-manager.ts:1135-1160`

**核心结论**:P0+P1 即可解决 90% 的"消息再也发送不了"问题,P2 作为防御性校验,P3 作为最终兜底。

---

## 2. 问题 2:context 爆了会话终止 + 兜底压缩失效

### 根因

**根因 A:SDK 自动 compaction 在 kscc 渠道下基本失效**

- TAgent 走 kscc 内网渠道,每条消息 spawn 一次 kscc 子进程,SDK 通过 `resumeSessionId` 读 JSONL 拼历史 prompt
- SDK 内置的 compaction(77.5% 阈值)依赖**同一长连接 query 的连续上下文**
- kscc 渠道每次 spawn 新进程,SDK 端的"自动压缩窗口"根本建立不起来——历史都从 JSONL 重新拼,根本没有"累积到 77.5%"的连续 query 状态可压缩

**根因 B:`prompt_too_long` 错误被识别为"不可重试"**

- `agent-orchestrator.ts:208-214` 的 `AUTO_RETRYABLE_ERROR_CODES` 集合只含 `rate_limited / provider_error / service_error / service_unavailable / network_error`,**没有 `prompt_too_long`**
- SDK 抛 prompt_too_long → 走 `agent-orchestrator.ts:2639` "不可重试 → 终止"分支,直接把错误持久化进 JSONL 后关闭 query

**根因 C:`isAutoRetryableCatchError`(`agent-orchestrator.ts:222-245`)对 context 类错误识别不完整**

- 只识别 `context_management` 字符串、502/529/overloaded、网络错误
- `prompt_too_long` 字符串走 catch 路径时**也不会触发重试或压缩**

### 兜底 `compact_session` 失效原因

`agent-orchestrator.ts:786-826` 把 `compact_session` 注册为 **SDK MCP 工具**,完全依赖 LLM 主动调用。问题:

- **LLM 看不到 token 数**:kscc 渠道下 `getContextUsage()` 依赖 `activeQueries.get(sessionId)`(`claude-agent-adapter.ts:601-607`),而 kscc 子进程内 query 短命,缓存基本空。LLM 没有"快爆了"的信号
- **system prompt 提示不可靠**:`agent-prompt-builder.ts:270` 只在 SubAgent 派发策略段写"看到 prompt_too_long 错误 → 立即调 compact_session",但**错误已经发生时已经太晚**——错误一抛就被 orchestrator 截获进入终止流程,LLM 根本没机会调工具
- **TAgent 主进程从不主动触发** `compactSession()`:没有"检测到 context > 80% → 自动调兜底压缩"的代码路径,把"救命"完全外包给 LLM

### 会话终止 + context 工具失效链路

```
SDK 抛 prompt_too_long
  ↓ agent-orchestrator.ts:2564 / 3020 识别为 prompt_too_long
  ↓ isAutoRetryableTypedError → false (不在白名单)
  ↓ agent-orchestrator.ts:2639 "不可重试 → 终止"
  ↓ 写错误 SDKMessage 到 JSONL + emit error 事件
  ↓ activeQueries.delete(sessionId) (claude-agent-adapter.ts:663)
  ↓ React 收到 error,会话进入"已错误"终态
  ↓ 用户点 ContextUsageBadge → getContextUsage
  ↓ query.getContextUsage 不存在 → adapter 返回 NO_ACTIVE_QUERY
  ↓ ContextUsageBadge 显示空 / loading 永转 (依赖 streamPreview, 但已无流)
```

"context 都用不了"是因为 `ContextUsageBadge` 的 `getContextUsage` 依赖活跃 query,会话终止后 query 销毁,只剩 `getContextUsageCached`(`agent-orchestrator.ts:3451`)的陈旧缓存,UI 看起来就是"废了"。

### 修复方案

**短期(止血)**

**(a) 把 `prompt_too_long` 改为可恢复错误,触发自动兜底压缩** —— `agent-orchestrator.ts:208-214` 把 `prompt_too_long` 加入"特殊可重试"集合,在 `2639` 终止前插入:

```ts
if (typedError.code === 'prompt_too_long' && canAutoRetry(attempt)) {
  await compactSession(sessionId, { strategy: 'drop_old_tool_results' })  // 主动调,不等 LLM
  existingSdkSessionId = undefined  // 清掉 resume,避免再读已爆的 JSONL
  shouldRetryFromError = true
  break
}
```

**(b) 错误降级**:`agent-orchestrator.ts:3030-3034` 把 `errorContent` 从"上下文过长 → 请开启新会话"改为"已自动压缩上下文,请重试上一条消息";压缩失败再降级为"开启新会话"提示。会话状态保持 `idle` 而非 `error`,UI 不进入终态。

**(c) 主动兜底**:在 `agent-orchestrator.ts` 流式消息处理中,检测 `usage.input_tokens / contextWindow > 0.85` 时主动 fire-and-forget 调 `compactSession()`,不等 LLM。已有 `cacheContextUsageFromQuery`(`claude-agent-adapter.ts:601`)拿 usage 的入口,加一个阈值检查即可。

**长期(根治)**

- **context 预算管理**:每条 user 消息前算 token 占用,> 70% 主动压缩、> 85% 拒绝新输入并提示。`agent-tool-token-estimator.ts` 已有估算能力,接到 `sendMessage` 入口即可
- **多级 fallback**:SDK 自动 compaction(kscc 渠道失效)→ TAgent 主动 `drop_old_tool_results` → `keep_last_n` → summarize(需补实现,`agent-session-compactor.ts:253` 当前返回"未实现")→ 极端时静默截断老消息
- **ContextUsageBadge 不依赖活跃 query**:把 `getContextUsageCached` 作为 UI 主路径,流式 usage 仅作刷新触发器,会话终止后仍能展示最后一份缓存,不再"也跟着废"

### 关键代码位置

- `apps/electron/src/main/lib/agent-orchestrator.ts:208-214` — `AUTO_RETRYABLE_ERROR_CODES` 白名单(缺 prompt_too_long)
- `apps/electron/src/main/lib/agent-orchestrator.ts:786-826` — `injectCompactSessionTool`(MCP 工具,依赖 LLM 主动调)
- `apps/electron/src/main/lib/agent-orchestrator.ts:2564, 3020-3034` — prompt_too_long 错误识别 + 终止处理
- `apps/electron/src/main/lib/agent-orchestrator.ts:2639` — 不可重试 → 终止分支
- `apps/electron/src/main/lib/agent-orchestrator.ts:3392-3418, 3451` — `getContextUsage` / `getContextUsageCached`(依赖活跃 query)
- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts:601-607` — `cacheContextUsageFromQuery`(拿 usage 的入口)
- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts:663` — `activeQueries.delete` 终止后 query 销毁
- `apps/electron/src/main/lib/agent-session-compactor.ts:198-283` — `compactSession` 主入口(可被主进程直接调,不必经 MCP)
- `apps/electron/src/main/lib/agent-session-compactor.ts:253-259` — summarize 策略未实现
- `apps/electron/src/renderer/components/agent/ContextUsageBadge.tsx:29-34` — 阈值常量(0.775/0.8/0.9)
- `apps/electron/src/renderer/hooks/useContextUsageBreakdown.ts:44-60` — UI 依赖 `getContextUsage` 拉取
- `apps/electron/src/main/lib/agent-prompt-builder.ts:270` — system prompt 中的"看到 prompt_too_long → 调 compact_session"提示(失效,因 LLM 拿不到错误后的执行权)

---

## 3. 问题 4:kscc 报错无法反映到 UI

### 错误冒泡链路图

```
kscc stderr → adapter.spawnClaudeCodeProcess (875-885, 转发到 onStderr 回调) [保留]
   → orchestrator.onStderr (2335-2337, 推入 stderrChunks[]) [仅 console.error 打印]
   → catch 块 (2877-3085):
       extractApiError(stderr) [简化: 只识别 3 种 API error 模式, kscc 自身错误不识别]
       ↓ 识别失败
       userFacingError = friendlyErrorMessage(error.message) [包装: SDK 抛的"exited with code 1"泛化文案]
       ↓ 仅当 /exited with code 1/i 时,补 800 字符 stderr hint (2997-3002) [简化]
       errMsg SDKMessage { _errorCode:'unknown_error', _errorTitle:'执行错误' } [吞掉: 没塞 _errorDetails!]
   → appendSDKMessages → JSONL [保留, 但缺详情字段]
   → callbacks.onError(userFacingError) → failRun → IPC STREAM_ERROR { sessionId, error: string } [简化: 只推字符串]
   → useGlobalAgentListeners (1302-1312) → agentStreamErrorsAtom.set [保留]
   → AgentView.tsx:638 _agentError = streamErrors.get(sessionId) [吞掉: 变量名带下划线前缀, 实际未渲染]
   → UI 仅靠 SDKMessageRenderer 渲染 JSONL errMsg [简化: _errorDetails 缺失, "查看诊断详情"按钮不出现]
```

### 关键丢失位置(4 处)

1. **`agent-orchestrator.ts:3043-3054`** — catch 块的 errMsg **没塞 `_errorDetails`**,而 preflight (1213) 和 typed_error (2655) 路径都塞了。这是 kscc stderr 丢失的最大元凶:SDK 抛异常(子进程非零退出/spawn ENOENT/stream-json 解析失败)走 catch 路径,UI 拿不到任何原始 stderr/stack
2. **`agent-orchestrator.ts:163-200`** — `extractApiError` 只识别 `API error: NNN {json}` / `NNN {json}` / `NNN: text` 三种模式,kscc 自身错误(ripgrep ENOENT / 配置 401 / Claude Code CLI panic / kscc 内部 stack trace)全部识别失败,降级为 `unknown_error`
3. **`agent-orchestrator.ts:2997-3002`** — 仅在 error.message 命中 `/exited with code 1/i` 时才补 800 字符 stderr hint。SDK 抛 `typed_error` 事件不走 catch,这段兜底不生效
4. **`AgentView.tsx:638`** — `_agentError` 变量以下划线前缀命名但**实际未在 UI 渲染**。STREAM_ERROR IPC 通道推过来的字符串被存到 atom 后被丢弃,UI 只信 JSONL 渲染。IPC payload 也只有 `{sessionId, error: string}` 一个字段

### 修复方案

**短期(2 处改动,~30 行)**

- `agent-orchestrator.ts:3043` 给 errMsg 增加 `_errorDetails: [stderrOutput.slice(0, 2000), error instanceof Error ? error.stack ?? error.message : String(error)].filter(Boolean)`。这样 SDKMessageRenderer 现成的"查看诊断详情"折叠按钮(`SDKMessageRenderer.tsx:1383-1399`)立刻生效,无需改 UI
- `agent-orchestrator.ts:2997` 把"补 800 字符 stderr hint"的条件从 `/exited with code 1/i` 放宽到所有 `stderrOutput.trim()` 非空场景,并改塞到 `_errorDetails` 而不是拼进 `error.message`(避免 userFacingError 被污染影响重试判断)

**长期**

- STREAM_ERROR IPC payload 升级为 `{sessionId, error: {code, title, message, details[], actions[]}}` 对象,与 errMsg 字段对齐,renderer 直接复用 ErrorMessage 组件渲染
- `extractApiError` 增加第 4 种模式:匹配 kscc 自身错误特征(如 `kscc:` / `Claude Code CLI` / `ripgrep` / `ENOENT`),归类为 `kscc_runtime_error`,区别于 Anthropic API 错误
- errorCode 区分来源:`anthropic_api_error` / `kscc_runtime_error` / `sdk_internal_error` / `network_error`,UI 按来源染色

### 日志兜底建议

**需要**。冒泡链路三处简化(orchestrator catch / extractApiError / IPC payload)短期改动仍可能漏掉边缘场景(SDK throw 时 stack 不含 stderr / typed_error 路径无 stderr 兜底)。

建议加 `~/.tagent/agent-logs/agent-<sessionId>.log`,在 `orchestrator.ts:2337` `console.error` 旁边同步 `fs.appendFileSync` 写一份完整 stderr + SDK 抛错 stack + 时间戳。UI 错误卡片增加"打开日志文件"按钮(`electronAPI.openPath`)。开销极低(每会话单文件,append-only),排查体验提升巨大。

### 关键代码位置

- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts:847-901`(spawn hook + stderr 转发)
- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts:872-890`(stderr 缓冲消费注释)
- `apps/electron/src/main/lib/agent-orchestrator.ts:1181, 2335-2337`(stderrChunks 累积)
- `apps/electron/src/main/lib/agent-orchestrator.ts:163-200`(extractApiError 三模式)
- `apps/electron/src/main/lib/agent-orchestrator.ts:2877-3085`(catch 块,核心丢失点)
- `apps/electron/src/main/lib/agent-orchestrator.ts:2997-3002`(800 字符 hint 兜底)
- `apps/electron/src/main/lib/agent-orchestrator.ts:3043-3054`(errMsg 缺 _errorDetails)
- `apps/electron/src/main/lib/agent-service.ts:226-234, 286-289`(STREAM_ERROR IPC 推送)
- `apps/electron/src/preload/index.ts:884, 2269-2275`(STREAM_ERROR 桥接)
- `apps/electron/src/renderer/hooks/useGlobalAgentListeners.ts:1302-1325`(atom 写入)
- `apps/electron/src/renderer/components/agent/AgentView.tsx:638`(_agentError 未使用)
- `apps/electron/src/renderer/components/agent/SDKMessageRenderer.tsx:1225-1400`(ErrorMessage + "查看诊断详情"折叠,现成能力)

**核心结论**:UI 已具备"查看诊断详情"能力,但 catch 块(3043)漏塞 `_errorDetails` 让这个按钮在 kscc 报错时永远不出现。短期 30 行修复即可让 kscc 原始 stderr 浮出水面;长期建议加日志文件兜底。

---

## 4. 问题 1:发送延迟瓶颈定位

### 各阶段耗时分析

TAgent 主流程 `sendMessage` 已埋点 `markPhase`,日志在 `agent-orchestrator.ts:2381-2384` 输出 `[Agent 编排] 启动阶段耗时...`,**先开 DevTools 抓这条日志拿真实数据**。

| 阶段 | 调用点 | 推测耗时 | 备注 |
|------|--------|---------|------|
| preflight | `buildSdkEnv` line 1461 | 5-30ms | env 拼装,同步 |
| persistUserMsg | line 1517 | <5ms | JSONL append |
| nudgeDetect | line 1563 | 5-20ms | slice + filter |
| sdkImport | line 1576 | 首次 100-300ms / 后续 <5ms | `await import('SDK')`,有模块缓存 |
| buildMcpConfig | line 1753 | <10ms | `buildMcpServers` 是同步函数(line 736-775) |
| injectNanoBanana/CompactSession/Automation/Kanban/TA | line 1755-1795 | **50-300ms** | 全是 `createSdkMcpServer` in-process,**不 spawn 子进程**,但每次都重建对象 |
| buildContextPrompt | line 1857 | 10-50ms | `buildSystemPrompt` 无缓存,每次重拼字符串(line 452) |
| buildQueryOptions | line 2378 | <10ms | 纯对象组装 |
| **adapter.query 调用** | line 2476 | **→ spawn kscc** | **真正的延迟主战场** |

`adapter.query` 内部(line 737-895):
- line 763 `await import('SDK')` — 已缓存
- line 847-895 `spawnClaudeCodeProcess` 自定义 spawn — Node spawn kscc,Windows 走 `where kscc` + `.cmd` 兼容,macOS/Linux 直接 spawn
- SDK 把整段历史 prompt 通过 stdin 喂给 kscc(`--input-format stream-json`)— **历史越长,stdin 写入越慢,kscc 解析越慢**
- kscc 启动后走公司代理认证握手 — **不可控外部延迟**
- LLM 首字节流回吐

### 瓶颈定位

**主因(80% 概率):每条消息重新 spawn kscc 子进程 + SDK 通过 stdin 重放完整 JSONL 历史**

- 历史越长 → SDK 拼 prompt 越慢 → kscc 解析 stdin 越慢 → **延迟随轮次累积**
- kscc 启动加载(`~/.claude/CLAUDE.md`、settings.json、skills 索引)每轮重做一次
- 公司代理握手每轮重做一次

**次因:`buildSystemPrompt`(`agent-prompt-builder.ts:452`)无缓存**,每次重新拼 SOUL.md + 工具指南 + 看板指南 + SubAgent 策略 + ... 估 10-50ms,小但可省。

### 修复方案

**短期(不改架构)**

1. **先抓数据**:让用户复现延迟,在 DevTools 控制台搜 `[Agent 编排] 启动阶段耗时`,把 timings JSON 贴出来。如果 `totalPreflightMs < 200ms`,瓶颈 100% 在 spawn kscc + LLM 首字节;如果某个 inject* 阶段异常大,先优化它
2. **加 kscc spawn 计时**:在 `claude-agent-adapter.ts:866` spawn 之后立刻 `Date.now()`,在第一个 SDK message yield 时打 `kscc_first_byte_ms`。区分"spawn 本身"vs"LLM 首字节"
3. **缓存 buildSystemPrompt**:对相同 `(workspaceSlug, sessionId, permissionMode, modelId)` 做内存 LRU 缓存,失效条件 = workspace 配置变更。省 10-50ms/轮
4. **并行化 inject\* 链**:line 1755-1795 当前是串行 `await`,改 `Promise.all` 可省一半时间(in-process 创建本身很快,但 await import zod/compactor 有微开销)
5. **预热 SDK import**:在 app ready 时 `import('@anthropic-ai/claude-agent-sdk')`,省首次 100-300ms

**长期(架构级)**

1. **会话级长驻 kscc 子进程**:不再每条消息 spawn 一次,而是首次 sendMessage 时 spawn,后续消息通过 stdin 追加到同一进程的 stream-json 输入。SDK 已支持 `streamInput()`,但 adapter 现在主动 `channel.close()` 触发 EOF 退出,需要改为不 close、保持长连接。**这是最大杠杆,可省 80% 启动延迟**,但要处理子进程崩溃恢复
2. **resume 改为增量推送**:目前 SDK `--resume` 把整段 JSONL 拼成 prompt 喂给 kscc。如果 kscc 支持 resumeSessionId 协议(让 kscc 自己读 JSONL),TAgent 只发增量消息即可。需评估 kscc 是否支持
3. **MCP 配置缓存**:buildMcpServers 结果按 workspaceSlug 缓存,workspace 配置变更时失效

### 关键代码位置

- `apps/electron/src/main/lib/agent-orchestrator.ts:1294-1298` — timings 埋点定义
- `apps/electron/src/main/lib/agent-orchestrator.ts:2381-2384` — **已有耗时日志输出**
- `apps/electron/src/main/lib/agent-orchestrator.ts:1461` — buildSdkEnv
- `apps/electron/src/main/lib/agent-orchestrator.ts:1753-1795` — MCP 注入串行 await 链
- `apps/electron/src/main/lib/agent-orchestrator.ts:2280` — buildSystemPrompt(无缓存调用)
- `apps/electron/src/main/lib/agent-orchestrator.ts:2476` — adapter.query 入口
- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts:737-895` — query 实现 + spawn kscc
- `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts:847-895` — 自定义 spawnClaudeCodeProcess
- `apps/electron/src/main/lib/agent-prompt-builder.ts:452` — buildSystemPrompt(同步,无 cache)
- `apps/electron/src/main/lib/agent-orchestrator.ts:736-775` — buildMcpServers(同步)

### 验证步骤

1. 让用户复现延迟,DevTools 搜 `启动阶段耗时` 拿真实 timings
2. 若 totalPreflightMs < 200ms → 瓶颈在 spawn kscc + LLM,走长期方案 1(长驻子进程)
3. 若某 inject* 阶段 > 200ms → 短期方案 4(并行化)
4. 在 `claude-agent-adapter.ts:866` 加 spawn→first-byte 计时,区分 spawn 本身 vs LLM 首字节

**结论**:最可能的主因是每条消息重新 spawn kscc + SDK 重放完整 JSONL 历史。先用现有 timings 日志验证,再加 spawn 计时打点区分 spawn vs LLM,再决定走短期缓存还是长期长驻子进程。

---

## 5. 修复路线图(建议执行顺序)

### 第一波(P0,1-2 天,易修复)

- [ ] **问题 3 - P0**:扩展 `isSessionNotFoundError` 错误模式识别(`agent-orchestrator.ts:253-256`)
- [ ] **问题 3 - P1**:result 错误时回滚 sdkSessionId(`agent-orchestrator.ts:2737-2770`)
- [ ] **问题 2 - (a)**:把 `prompt_too_long` 改为可恢复错误,触发自动兜底压缩(`agent-orchestrator.ts:208-214` + `2639`)
- [ ] **问题 2 - (b)**:错误降级,会话状态保持 idle(`agent-orchestrator.ts:3030-3034`)
- [ ] **问题 4 - 短期**:errMsg 塞 `_errorDetails`(stderr + stack,`agent-orchestrator.ts:3043-3054`)
- [ ] **问题 4 - 短期**:放宽 stderr hint 条件(`agent-orchestrator.ts:2997-3002`)

### 第二波(P1,3-5 天,中等工作量)

- [ ] **问题 3 - P2**:读取 sdkSessionId 时校验 JSONL 存在(`agent-orchestrator.ts:1466-1467`)
- [ ] **问题 3 - P3**:未知错误也自动回退到新会话(`prepareResumeFallbackRecovery`)
- [ ] **问题 2 - (c)**:主动兜底,context > 85% 时 fire-and-forget 调 compactSession
- [ ] **问题 1 - 短期 3**:缓存 buildSystemPrompt(LRU)
- [ ] **问题 1 - 短期 4**:并行化 inject* 链(Promise.all)
- [ ] **问题 1 - 短期 5**:预热 SDK import
- [ ] **问题 4 - 日志兜底**:加 `~/.tagent/agent-logs/agent-<sessionId>.log`

### 第三波(P2,长期架构,1-2 周)

- [ ] **问题 1 - 长期 1**:会话级长驻 kscc 子进程(最大杠杆,省 80% 启动延迟)
- [ ] **问题 2 - 长期**:context 预算管理 + 多级 fallback + summarize 策略实现
- [ ] **问题 2 - 长期**:ContextUsageBadge 不依赖活跃 query,改用 cached 主路径
- [ ] **问题 4 - 长期**:STREAM_ERROR IPC payload 升级为对象 + 错误来源标记
- [ ] **问题 1 - 长期 2**:resume 改为增量推送(评估 kscc 是否支持)

---

## 6. 诊断可信度评估 + 验证清单

> **重要提醒**:本报告的 4 个排查都是**代码阅读 + 理论推测**,没有真实复现 + 实测修复。根因方向基本对(基于直接代码事实),但"主因占比"和"修复效果"都是纸面判断。**实际修复后可能发现修复无效,或引入新问题。**
>
> 把本报告当作"线索"而不是"答案",按"先验证 → 再修复 → 复测确认"的循环来。

### 6.1 诊断可信度评估表

| # | 问题 | 根因证据强度 | 修复方案有效性 | 主要风险 | 是否需实测验证 |
|---|------|------------|--------------|---------|--------------|
| 3 | resume sessionId 错乱 | 🟡 中(代码事实+推测) | P0 强 / P1 需谨慎 | P1 可能误伤正常会话切换 | 是(P1 边界) |
| 2 | context 爆终止 | 🟢 较强(白名单直接事实) | (a)(b) 强 / (c) 需验证 | 清 resume 后 SDK 行为未实测 | 是(compaction 真实行为) |
| 4 | kscc 报错丢失 | 🟢 强(直接代码事实) | 短期强 / 长期中 | typed_error 路径需单独处理 | 否(短期可直接改) |
| 1 | 发送延迟 | 🔴 弱(纯理论推测) | 短期中 / 长期高风险 | 长驻子进程是大改动 | 是(必须先抓数据) |

### 6.2 各问题详细评估

#### 问题 3 — 根因方向对,P1 有隐患

- ✅ 找对:`isSessionNotFoundError` 模式过窄是直接代码事实(`agent-orchestrator.ts:253-256` 只匹配一个英文正则)
- ⚠️ P1 修复可能误伤:`capturedSdkSessionId !== existingSdkSessionId` 作为回滚条件,**正常会话切换时也会分配新 sdkSessionId,result 是正常的**——简单套这个条件可能把正常切换也回滚了。需要严格限制"result 是 error subtype"的判断边界,报告里写了但没说清边界

#### 问题 2 — 根因对,但"kscc 渠道下 compaction 失效"是推测

- ✅ 找对:`prompt_too_long` 不在 `AUTO_RETRYABLE_ERROR_CODES` 白名单是直接事实,可验证
- ⚠️ 推测部分:"SDK 自动 compaction 在 kscc 渠道下基本失效"——这个判断是基于架构推断(每条消息新 spawn + resume),**没有实测验证 SDK 在 resume 模式下是否真的不触发 compaction**。如果 SDK 实际上在 resume 时也维护了 token 累计,这个根因就不成立
- ⚠️ 修复隐患:`existingSdkSessionId = undefined` 清掉 resume 后,如果压缩改了 JSONL,新 query 时 SDK 行为没说清,可能引入新问题

#### 问题 4 — 最可靠,直接代码事实

- ✅ 找对:错误冒泡链路是直接读代码画的,4 个关键丢失位置都有具体行号
- ✅ 修复有效:catch 块漏塞 `_errorDetails` 是直接事实,30 行修复就能让现成的"查看诊断详情"按钮生效
- ⚠️ 未覆盖:typed_error 路径不走 catch,这段兜底不生效,需要单独处理——报告提了但短期修复没覆盖

#### 问题 1 — 最弱,纯理论推测

- 🔴 根因弱:"主因是 spawn kscc + 重放 JSONL"是 80% 概率推测,**没有真实打点数据**
  - 报告自己也说"先抓数据"才能验证
  - "历史越长 stdin 越慢"是推测,SDK 的 stream-json 实现可能没那么慢
- 🔴 长期方案风险高:会话级长驻子进程是大改动,子进程崩溃恢复、stdin 流状态管理、SDK 行为变化都需要重新设计——不是简单"不 close stdin"就行

### 6.3 验证清单(修复前必做)

#### 问题 3 验证步骤

- [ ] 收集 kscc 渠道下真实的 session 失效错误样本(可在 `~/.tagent/agent-sessions/` 找历史错误日志,或主动复现)
- [ ] 确认错误信息格式:是英文?中文?带 kscc 包装?带 stderr stack?
- [ ] 验证 P1 边界:正常会话切换时,capturedSdkSessionId 与 existingSdkSessionId 的差异是否符合回滚条件
- [ ] 确认"result 是 error subtype"判断逻辑,避免误伤正常切换

#### 问题 2 验证步骤

- [ ] 在 kscc 渠道下主动复现 context 爆(发大量历史消息触发 prompt_too_long)
- [ ] 看 SDK 真实报什么错:错误 code 是 `prompt_too_long` 还是其他?
- [ ] 验证 SDK 在 resume 模式下是否真的不触发自动 compaction(看是否出现过 `compact_boundary` system 消息)
- [ ] 测试清 resume 后新 query 的 SDK 行为(是否真能继续会话)

#### 问题 4 验证步骤

- [ ] 直接做短期修复(30 行),无需先验证
- [ ] 修复后实测:触发 kscc 子进程非零退出,看"查看诊断详情"按钮是否真的出现
- [ ] 补 typed_error 路径的 `_errorDetails` 填充

#### 问题 1 验证步骤

- [ ] 在 DevTools 控制台搜 `[Agent 编排] 启动阶段耗时`,抓真实 timings JSON
- [ ] 区分 totalPreflightMs < 200ms 还是 > 200ms,定位瓶颈层
- [ ] 在 `claude-agent-adapter.ts:866` 加 spawn→first-byte 计时,区分 spawn 本身 vs LLM 首字节
- [ ] 多轮对话后看延迟是否随轮次累积(验证"历史越长越慢"推测)
- [ ] **不要急着改架构**,数据说话

### 6.4 修复执行原则

1. **先验证再修复**:不要一口气全改,按"先验证 → 再修复 → 复测确认"循环
2. **小步验证**:每个修复做完都复现一次原问题,确认真的修好了再合 main
3. **优先级**:最稳的先做(问题 4 短期 / 问题 3 P0),其他验证后再做
4. **不盲信诊断**:诊断报告是线索不是答案,实测数据优先

---

## 7. 关联文档

- `docs/plans/2026-06-30-kanban-v1-product-design.md`(看板 v1,Phase D+ 包含 worker 体验硬伤修复)
- `docs/plans/2026-06-25-kscc-internal-provider-design.md`(kscc 内网渠道设计)
- `docs/PROGRESS.md`(项目总进度)

---

**最后更新**:2026-07-05 — 4 个稳定性问题排查完毕 + 可信度评估 + 验证清单。**本报告是线索不是答案,修复前必读 §6 验证清单**。修复时按"§5 修复路线图"分三波执行,每波修复前先做对应的验证步骤。

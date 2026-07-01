# Agent 主会话主动增效设计文档

> 创建日期：2026-07-01
> 状态：已定稿，待实施 P0
> 类型：产品理念 + Prompt 工程方案
> 关联：`2026-07-01-kscc-streaming-and-stuck-analysis.md` 第 13 节方案 B

## 1. 核心理念

**用户原话**：

> 我的 agent 功能很多，但是用户不一定知道如何使用，所以我们 agent 主会话要学会积极调用增效的功能，而不是一条路走到黑，把自己当成聊天软件那么用了。

### 1.1 问题诊断

当前 Agent 主会话存在"聊天软件化"倾向：

| 表现 | 后果 |
|------|------|
| 一问一答，所有执行都堆在主会话 | context 膨胀，长会话卡顿 |
| 遇到独立子任务自己干，不用 SubAgent | 主会话 context 被工具结果填满 |
| context 涨爆了不主动 compact | 等 99% 阈值或用户手动 |
| 有 Skills 不主动复用，重新造轮子 | 效率低，产出不一致 |
| 复杂任务不进 Plan 模式规划 | 边想边做，容易跑偏 |
| 不会用定时任务处理周期性需求 | 用户得手动盯 |

### 1.2 设计原则

**不惩罚长会话用户，而让 Agent 主动瘦身、主动增效。**

- Agent 是"协调者 + 决策者"，不是"全能执行者"
- 主会话保持精简，重活委派给 SubAgent / 工具 / 定时任务
- 用户不需要知道功能清单，Agent 自己会选

## 2. 增效功能全景图

### 2.1 现有功能与 prompt 引导程度

| 功能 | 实现位置 | prompt 引导 | 现状 |
|------|----------|-------------|------|
| **SubAgent / Task** | SDK 内置 + `SUBAGENT_METADATA` | 中-强 | 有委派策略，但 context 大时 Agent 不主动用 |
| **看板多 Agent 编排** | `kanban-agent-tools.ts` | 强 | 引导最完整，但只针对大目标拆解 |
| **Memory 系统** | `injectMemoryTools` (orchestrator 780-834) | 中 | 有触发场景，但 Agent 主动 recall 不够 |
| **compact_session** | `injectCompactSessionTool` (orchestrator 845-885) | **无** | 工具已注入，prompt 零提及 |
| **CronCreate / ScheduleWakeup** | SDK 内置 | **无** | 白名单已放行，Agent 不知何时用 |
| **Automation 系统** | `automation-agent-tools.ts` | 中 | 末尾提及，位置偏 |
| **Skills 系统** | SDK plugin 自动发现 | **弱** | 只讲目录路径，未讲何时主动调用 |
| **Plan 模式** | `EnterPlanMode/ExitPlanMode` | **弱** | 只讲文件路径，未讲何时该进 Plan |
| **TaskCreate/TaskUpdate** | SDK 内置 | 弱 | 有"可见进度"段，但触发不明确 |

### 2.2 核心缺口

**没有一个统一的"增效能力决策树"**。各功能分散在不同 prompt section，Agent 缺少"遇到 X 信号 → 用 Y 工具"的判断框架。

## 3. 增效能力决策树（核心设计）

### 3.1 信号 → 行动 映射表

| 信号 | 应调用的增效功能 | 理由 |
|------|------------------|------|
| 任务包含"搜索/分析/调研"等独立子任务 | **SubAgent**（explorer/researcher） | 子 Agent 用全新 context，不污染主会话 |
| 任务预计 > 5 分钟且可独立验证 | **SubAgent** 或 **看板 worker** | 主会话只做协调 |
| context 占用 > 50% | **compact_session** 主动压缩 | 预防涨爆，不等 99% |
| context 占用 > 70% | **SubAgent 委派**后续独立任务 | 减少主会话堆积 |
| 遇到周期性/定时需求 | **CronCreate** 或 **Automation** | 不用用户盯着 |
| 任务复杂、多步骤、方向不明 | **EnterPlanMode** 先规划 | 边想边做容易跑偏 |
| 遇到"X 类任务"先看 | **Skills/** 目录有没有现成的 | 复用而非重造 |
| 用户提到"以后每次/每天" | **Automation 系统** | 自动化而非手动 |
| 跨会话需要记住的事实/偏好 | **Memory 系统** add_memory | 下次自动 recall |
| 大目标需要拆解为多 Agent | **看板编排** | kanban_create_task 等 |
| 完成有价值的调研/分析 | **写入 .context/note.md** | 沉淀而非只留聊天流 |

### 3.2 反模式（Agent 不该做的）

| 反模式 | 正确做法 |
|--------|----------|
| 主会话连续调 10+ 个 Read/Edit/Bash | 委派给 SubAgent，只返回摘要 |
| context 已 40 万 token 还不 compact | 主动调 compact_session |
| 用户说"每天检查 X" → Agent 每次手动跑 | 用 CronCreate 或 Automation |
| 复杂任务直接开干 | 先 EnterPlanMode 出方案 |
| 重复实现"代码审查/测试生成"等通用流程 | 先看 skills/ 有没有现成的 |
| 调研结果只回复在聊天里 | 写到 .context/note.md |

## 4. Prompt 改造方案

### 4.1 新增"增效能力总览"section

**位置已定**：`agent-prompt-builder.ts` 的 `TOOL_USAGE_GUIDELINES` 之后（约 line 250）。

插入新 section：

```markdown
## 增效能力总览（主动调用，不要一条路走到黑）

你不是聊天软件，不能一问一答把所有执行都堆在主会话。遇到以下信号主动选用对应能力：

### 任务规模判断
- **独立子任务**（搜索/分析/调研/实现单一模块）→ 用 Task 工具委派 SubAgent
  - explorer：代码库探索、多文件搜索
  - researcher：技术方案对比、依赖评估
  - code-reviewer：代码修改后质量检查
- **大目标拆解**（多 Agent 协作）→ 看板编排（kanban_create_task 等）
- **复杂多步骤任务**（方向不明）→ 先 EnterPlanMode 出方案，用户确认后再执行

### Context 管理（主动瘦身）
- 当前会话已较长（> 15 万 token 或 > 50% 窗口）→ 后续独立任务优先 SubAgent
- context > 70% → 主动调 compact_session 压缩历史
- 看到 "prompt_too_long" 错误 → 立即 compact_session

### 复用与沉淀
- 遇到"代码审查/测试生成/性能优化"等通用任务 → 先看 skills/ 有没有现成的
- 完成有价值的调研/分析 → 写到 .context/note.md，不要只留聊天流
- 跨会话需要记住的事实 → add_memory

### 自动化与定时
- 用户说"以后每次/每天/定期" → Automation 系统（非 CronCreate）
- 短时延迟（几分钟到 1 小时）→ ScheduleWakeup
- 周期性定时（每天/每小时）→ CronCreate
- 用户离开后继续跑 → 看板 worker 或 background task

### 协调者心态
你是协调者 + 决策者，不是全能执行者。主会话保持精简，重活委派出去。
```

### 4.2 强化现有 section

**SubAgent 委派策略**（line 444-616）：增加"context 大时优先委派"信号
```markdown
**额外触发信号**：
- 当前会话 context > 50% 窗口时，后续独立任务强制优先 SubAgent
- 主会话连续调用 5+ 个工具仍未完成时，考虑委派
```

**Memory 引导**（line 674-712）：增加主动 recall 时机
```markdown
**主动 recall 时机**：
- 新会话开始时，先 recall_memory 看有没有相关记忆
- 用户提到过往工作/偏好时，先 recall 再回答
```

**Plan 模式**（line 657-671）：增加进入时机
```markdown
**何时进入 Plan 模式**：
- 任务涉及 3+ 文件改动
- 任务有多种实现方案需要权衡
- 用户说"帮我实现 X"但 X 模糊
- 不确定该用 SubAgent / 看板 / 手动时
```

### 4.3 长会话动态注入

在 `buildDynamicContext`（line 913 附近）根据当前 context 占用动态注入提示：

```typescript
// 伪代码
const contextUsage = getContextUsagePercent(sessionId)
if (contextUsage > 50) {
  prompt += `\n## 当前 Context 状态（${contextUsage}%）\n`
  prompt += `会话已较长，后续独立任务请优先用 SubAgent 委派，避免主会话继续膨胀。`
  if (contextUsage > 70) {
    prompt += `\n建议主动调 compact_session 压缩历史。`
  }
}
```

## 5. 实施计划

### 5.1 阶段一：Prompt 静态增强（P0，2-3 小时，待实施）

**文件**：`apps/electron/src/main/lib/agent-prompt-builder.ts`

1. 新增"增效能力总览"section（4.1）
2. 强化 SubAgent 委派策略（4.2 第一段）
3. 强化 Memory / Plan 模式引导（4.2 后两段）
4. 不改任何运行时代码，纯 prompt 工程

**验证**：发几个典型任务，观察 Agent 是否主动用 SubAgent / Plan / Skills。

### 5.2 阶段二：动态 context 感知（P1，2 小时，P0 验证有效后再做）

**文件**：`agent-prompt-builder.ts` + `agent-orchestrator.ts`

1. `buildDynamicContext` 注入当前 context 占用百分比
2. context > 50% 时追加"优先 SubAgent"提示
3. context > 70% 时追加"建议 compact_session"提示

**验证**：长会话中观察 Agent 是否在 50% 后主动委派。

## 6. 预期效果

### 6.1 量化指标

| 指标 | 当前 | 目标 |
|------|------|------|
| 主会话平均 context 峰值 | ~40 万 token | < 20 万 token |
| SubAgent 主动调用率 | 低 | 长会话 > 30% |
| compact_session 主动调用 | 0 | context > 70% 时触发 |
| Plan 模式进入率 | 低 | 复杂任务 > 50% |
| 长会话卡顿反馈 | 频繁 | 偶发 |

### 6.2 用户体验改善

- **长会话不再越用越慢**：Agent 主动 compact + SubAgent 委派
- **产出更结构化**：Plan 模式 + .context/note.md 沉淀
- **用户无需学习**：Agent 自己选，用户只看结果

## 7. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Agent 过度委派，小事也调 SubAgent | prompt 明确"独立子任务"边界，参考 CLAUDE.md 派发策略 |
| compact_session 误压缩进行中的任务 | compact 仅在无活跃工具调用时触发 |
| Plan 模式滥用拖慢简单任务 | prompt 明确"3+ 文件或方向不明"才进 Plan |
| SubAgent 结果不如主会话直接 | 子 Agent 返回摘要 + 关键发现，主会话整合 |

## 8. 相关文件

- `apps/electron/src/main/lib/agent-prompt-builder.ts` — 主改对象（line 235-250, 444-616, 657-712, 913）
- `apps/electron/src/main/lib/agent-orchestrator.ts` — 工具注入（line 780-885）
- `apps/electron/src/main/lib/agent-session-compactor.ts` — compact_session 实现
- `apps/electron/src/main/lib/automation-agent-tools.ts` — Automation 工具
- `packages/shared/src/constants/permission-rules.ts` — 工具白名单（line 121-171）
- `CLAUDE.md` — 已有 SubAgent 派发策略可参考

## 9. 与其他文档的关系

- `2026-07-01-kscc-streaming-and-stuck-analysis.md` 第 13 节方案 B → 本文档展开
- `2026-06-13-context-compaction-architecture.md` → compact 机制细节
- `2026-06-26-speed-test-design.md` 第 9 节 → tok/s 数据支撑"何时该 compact"

## 10. 最终决策（2026-07-01 拍板）

| 决策项 | 结果 |
|--------|------|
| 实施时机 | 文档定稿，待后续单独排期实施 P0 |
| 增效总览位置 | TOOL_USAGE_GUIDELINES 后（agent-prompt-builder.ts:250） |
| UI 轻提示 | 不做，先看 prompt 效果 |
| 行为统计 | 不做，先看用户反馈 |

实施时只做 P0（静态 prompt 增强），P1（动态 context 感知）在 P0 验证有效后再排期。

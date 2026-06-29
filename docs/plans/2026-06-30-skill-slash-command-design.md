# Skill 调用方式对齐 Claude Code 设计

> **状态**：规划中
> **日期**：2026-06-30
> **背景**：TAgent 当前用 Mention 机制调用 skill，和 Claude Code 的 slash command 体验有差距

## 1. 现状

### TAgent 当前机制（Mention）

```
用户输入: /br
         ↑ 弹出下拉框
     ┌─────────────────────────┐
     │ brainstorming           │  ← 用户点选
     └─────────────────────────┘
     
选中后输入框变成:
"帮我看下这个需求 [@brainstorming]，我想做个登录页"

提交后 orchestrator 转成:
<mentioned_tools>brainstorming（请立即调用此 Skill）</mentioned_tools>
帮我看下这个需求，我想做个登录页
```

- `/` 只是触发下拉框的快捷键
- 选中后在消息里插入引用标记 `[@skill-name]`
- 提交时引用被转成 `<mentioned_tools>` XML 注入用户消息
- Agent 看到"用户提到了 X skill"——语义偏引用

### Claude Code 机制（slash command）

```
用户输入: /brainstorming
         ↑ 直接是命令
     按回车 → Agent 立即进入 brainstorming skill 流程
```

- `/skill-name` 是独立命令
- 回车 = 执行该 skill
- Agent 立即激活对应 skill

## 2. 两者本质差异

| 维度 | slash command | Mention |
|------|--------------|---------|
| 是什么 | 命令（执行动作） | 引用（提及对象） |
| 输入形式 | `/brainstorming` 单独一行 | `[@brainstorming] 帮我...` 混在消息 |
| 触发后 | 立即执行该 skill | 引用注入消息，Agent 自行判断 |
| 意图明确度 | 高（明确要执行） | 中（只是提及） |
| 类比 | Slack `/remind` | 群里 @某人 |

## 3. 改造目标

让 TAgent 支持 slash command 风格的 skill 调用：
- 输入 `/skill-name` 后回车，Agent 立即激活该 skill
- 保留现有 Mention 作为补充（混在消息里的引用）
- 两者共存，不互斥

## 4. 改造方案

### 4.1 检测 slash command

在消息提交逻辑里加检测：

```typescript
// 伪代码
const trimmed = userInput.trim()
if (/^\/[\w-]+$/.test(trimmed)) {
  const skillName = trimmed.slice(1)
  const skill = availableSkills.find(s => s.slug === skillName)
  if (skill) {
    // 走 slash command 路径
    submitAsSlashCommand(skill)
    return
  }
}
// 否则走普通消息 + Mention 路径
submitAsNormalMessage(userInput)
```

### 4.2 slash command 的消息格式

slash command 提交时，给 Agent 的消息更明确：

```
<slash_command>brainstorming</slash_command>

用户调用了 brainstorming skill，请立即激活并按其流程执行。
```

比 Mention 的"请立即调用此 Skill"更强烈——明确是命令调用，不是引用。

### 4.3 UI 提示

输入框检测到 `/` 开头时：
- 仍然弹出 skill 下拉框（保持现有交互）
- 但选中后**不插入引用标记**，而是**填入命令形式** `/skill-name`
- 用户可以继续输入参数（如 `/brainstorming 登录页需求`），或者直接回车执行

### 4.4 输入框 placeholder

更新 placeholder 提示用户可用 slash command：

```
"输入消息，或 / 调用 skill（如 /brainstorming）"
```

## 5. 改动清单

| 文件 | 改动 |
|------|------|
| `apps/electron/src/renderer/components/agent/mention-suggestions.tsx` | `/` 选中后插入 `/skill-name` 而非 `[@skill-name]` |
| `apps/electron/src/main/lib/agent-orchestrator.ts` | 检测 slash command，用更强的 `<slash_command>` 注入格式 |
| `apps/electron/src/renderer/components/agent/AgentInput*.tsx` | placeholder 更新 + 回车检测 slash command |
| `apps/electron/src/renderer/atoms/agent-atoms.ts` | 如有提交逻辑原子，同步更新 |

## 6. 兼容性

- 保留 Mention 机制（`@` 触发），混在消息里的引用仍可用
- 旧消息格式（`<mentioned_tools>`）保持兼容
- 新格式（`<slash_command>`）是增量，不影响存量

## 7. 风险

| 风险 | 缓解 |
|------|------|
| 用户误以为所有 `/` 都是命令 | 只在 `/` 后跟已知 skill slug 时才识别为命令 |
| 和现有 Mention 逻辑冲突 | Mention 用 `@` 触发，slash command 用 `/` 触发，互不干扰 |
| Agent 不识别新 `<slash_command>` 格式 | prompt 里加规则说明格式语义 |

## 8. 验证

- 输入 `/brainstorming` + 回车 → Agent 立即进入 brainstorming 流程
- 输入 `/brainstorming 登录页需求` + 回车 → 进入流程并带上下文
- 输入普通消息含 `[@brainstorming]` → 走 Mention 路径（不变）
- 输入 `/unknown-skill` → 当普通消息处理（不识别为命令）

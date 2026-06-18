# IM 模型切换能力设计（飞书 / 钉钉 / 微信）

> **状态**：已完成归档  
> **日期**：2026-06-02  
> **原分支**：`feat-im-model-switch`

## 背景与目标

用户希望在飞书等 IM 上直接切换 Agent 使用的渠道与模型，无需回到 TAgent 桌面端设置。具体需求：罗列渠道、进入某渠道、罗列该渠道下的模型、切换模型，并让 `/now` 显示当前模型。

## 已确认的设计决策

1. **作用域：per-chat**。切换只影响当前 IM chat 绑定的会话，不同 chat 各用各的模型。
2. **命令形态：单命令带参数**，命令名 `/model`，并支持 `/m` 别名。
3. **渠道过滤：只列可用渠道**（`enabled === true` 且至少有一个 `enabled` 模型）。
4. **平台范围：飞书 / 钉钉 / 微信**。
5. **钉钉 / 微信 binding 持久化保持内存态**，与现有 `/workspace`、`/switch` 行为一致。

## 命令语义

- `/model`（或 `/m`）→ 列出可用渠道，带序号。
- `/model <渠道序号>` → 列出该渠道下启用的模型，带序号。
- `/model <渠道序号> <模型序号>` → 切换：写入当前 chat 的 binding。
- `/now` → 显示当前会话、工作区与模型。

## 关键实现

- 共享模型工具：`apps/electron/src/main/lib/bridge-model-utils.ts`
  - `listSwitchableChannels()`
  - `getEnabledModels()`
  - `resolveChannelByIndex()`
  - `resolveModelByIndex()`
  - `describeBindingModel()`
- 飞书：`feishu-bridge.ts` + `feishu-message.ts` 卡片展示。
- 钉钉 / 微信：`bridge-command-handler.ts` 纯文本展示。
- 模型解析优先级改为 binding 优先：
  - 飞书：`binding > botConfig > appSettings`
  - 钉钉 / 微信：`binding > appSettings`

## 追加变更

同批次移除未实现的 Chat 模式占位命令：

- 删除 `/chat`、`/agent` 命令。
- 删除 binding 中的 `mode` 字段。
- `handleUserMessage` 直接走 Agent 逻辑。

## 验收要点

- `/model` 只列启用渠道。
- `/model 1` 只列启用模型。
- `/model 1 2` 后 `/now` 显示新模型。
- 切换后发送消息实际使用新渠道 / 模型。
- 序号越界有友好提示。

## 归档说明

该能力已落地，当前文档仅作为历史设计依据保留。当前进度以 `docs/PROGRESS.md` 为准。

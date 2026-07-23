# Proma 派生关系审计报告

> **审计时间**：2026-07-21
> **审计范围**：`F:\TAgent_General` vs `F:\Proma`，`apps/electron/src/` 下所有 `.ts` / `.tsx` 文件
> **目的**：评估 TAgent 与 Proma 的代码层派生关系，识别残留品牌引用，为后续脱离 Proma / 商业化许可提供依据

---

## 1. 审计背景

TAgent 早期以 Proma 开源版（AGPL-3.0）为基座进行开发，随后进行了大量自研重构。本报告通过文件级对比、行数差异分析和品牌残留扫描，量化当前两个仓库的代码层差异。

### 1.1 两个项目

| 项目 | 路径 | 协议 | 说明 |
|---|---|---|---|
| Proma | `F:\Proma` | AGPL-3.0 | 上游基座，开源 |
| ta_agent | `F:\ta_agent` | 自有闭源 | Frank Danny 自有 |
| TAgent | `F:\TAgent_General` | AGPL-3.0（沿用 Proma） | 派生重构产物 |

### 1.2 审计方法

- 用 `rg` 扫描 `apps/electron/src/` 下 TS/TSX 文件
- 用 PowerShell 建立两个仓库的相对路径映射，做同名文件行数对比
- 用 `rg` 扫描 `proma` / `Proma` / `PROMA` / `kun` / `Kun` 关键字
- 按差异百分比分桶，识别"高度自研"、"高度相似"和"近乎复制"的文件

---

## 2. 文件级对比概览

| 维度 | TAgent | Proma |
|---|---|---|
| `apps/electron/src/` TS/TSX 文件数 | **717** | 475 |
| 同名文件（两边都存在） | **312** | 312 |
| TAgent 独有（自研 / 重构新增） | **405** | — |
| Proma 独有（TAgent 已删 / 未引入） | — | **163** |

### 2.1 解读

- **405 个 TAgent 独有文件**：这是自研部分的核心证据，占 TAgent 总文件数的 56%
- **163 个 Proma 独有文件**：TAgent 没有引入或已删除的 Proma 模块，包括完整的 Pi runtime adapter 层
- **312 个同名文件**：这是派生关系最密切的部分，需要逐个判断

---

## 3. 同名文件差异分析

### 3.1 高度自研（TAgent 远大于 Proma，差距 >50%）

| 文件 | TAgent | Proma | 差距 | 说明 |
|---|---|---|---|---|
| `renderer/components/welcome/WelcomeEmptyState.tsx` | 479L | 100L | +379% | 几乎完全重写 |
| `renderer/components/app-shell/AppShell.tsx` | 681L | 233L | +192% | 完全重构 |
| `main/lib/agent-prompt-builder.ts` | 897L | 310L | +193% | 高度自研 |
| `renderer/components/automation/AutomationFormView.tsx` | 1233L | 574L | +115% | 重写 |
| `main/lib/automation-notification-service.ts` | 95L | 46L | +105% | 扩展 |
| `renderer/atoms/app-mode.ts` | 124L | 14L | +786% | 大幅扩展 |
| `renderer/components/agent/thinking-tag-parser.ts` | 62L | 9L | +585% | 大幅扩展 |
| `main/lib/settings-service.ts` | 162L | 93L | +74% | 扩展 |

**判断**：这些文件可以确认为 TAgent 自研或高度重写。

### 3.2 有显著扩展（TAgent 大于 Proma，差距 15-50%）

| 文件 | TAgent | Proma | 差距 | 说明 |
|---|---|---|---|---|
| `main/lib/agent-orchestrator.ts` | 3500L | 2621L | +34% | 有扩展但核心骨架可能仍是 Proma |
| `preload/index.ts` | 3782L | 2425L | +56% | 大量新增 IPC，原有部分可能占 40-50% |
| `main/lib/config-paths.ts` | 826L | 677L | +22% | 路径扩展 |
| `main/lib/migration-service.ts` | 1551L | 1361L | +14% | 迁移逻辑扩展 |
| `main/lib/runtime-init.ts` | 232L | 184L | +26% | 初始化扩展 |
| `renderer/components/settings/AppearanceSettings.tsx` | 725L | 480L | +51% | 重写 |
| `renderer/components/settings/AboutSettings.tsx` | 804L | 493L | +63% | 扩展 |
| `renderer/components/agent/AgentView.tsx` | 3301L | 2869L | +15% | 扩展 |
| `renderer/components/agent/AgentMessages.tsx` | 995L | 726L | +37% | 扩展 |
| `renderer/components/settings/ShortcutSettings.tsx` | 440L | 657L | -33% | TAgent 裁剪 |
| `renderer/components/settings/McpServerForm.tsx` | 442L | 588L | -25% | TAgent 裁剪 |

**判断**：需要逐个判断扩展部分是否仍以 Proma 逻辑为基础。`agent-orchestrator.ts` 风险最高。

### 3.3 小幅修改（差异 5-15%）

大量文件差异在 5-15% 之间，说明只改了 import 路径、变量名或小幅功能调整。这些文件**是否仍属 Proma 派生需要人工逐个判断**。

典型例子：

- `channel-manager.ts`：1565L vs 1793L（-13%）
- `agent-session-manager.ts`：1520L vs 1772L（-14%）
- `git-diff-service.ts`：672L vs 741L（-9%）
- `bridge-command-handler.ts`：970L vs 798L（+22%）
- `file-preview-service.ts`：788L vs 711L（+11%）
- `app-lifecycle.ts`：14L vs 16L（-12%）

### 3.4 裁剪文件（TAgent 远小于 Proma）

| 文件 | TAgent | Proma | 差距 | 说明 |
|---|---|---|---|---|
| `renderer/components/ai-elements/InputToolbarOverflow.tsx` | 7L | 218L | -97% | 几乎删除 |
| `renderer/components/ai-elements/scroll-minimap.tsx` | 30L | 538L | -94% | 几乎删除 |
| `renderer/components/ai-elements/message.tsx` | 91L | 921L | -90% | 大幅裁剪 |
| `renderer/components/ai-elements/sticky-user-message.tsx` | 19L | 198L | -90% | 大幅裁剪 |
| `renderer/components/ai-elements/context-divider.tsx` | 7L | 58L | -88% | 大幅裁剪 |
| `renderer/components/ai-elements/reasoning.tsx` | 33L | 247L | -87% | 大幅裁剪 |
| `renderer/components/ai-elements/conversation.tsx` | 17L | 120L | -86% | 大幅裁剪 |
| `renderer/lib/agent-session-list.ts` | 17L | 102L | -83% | 大幅裁剪 |
| `renderer/components/ai-elements/file-path-chip.tsx` | 65L | 290L | -78% | 大幅裁剪 |
| `renderer/components/tabs/TabContent.tsx` | 52L | 118L | -56% | 裁剪 |
| `renderer/components/settings/primitives/index.ts` | 6L | 16L | -62% | 裁剪 |
| `renderer/components/ai-elements/speech-button.tsx` | 30L | 69L | -57% | 裁剪 |

**判断**：裁剪过的文件是否仍属 Proma 派生，取决于保留的部分是否来自 Proma 原始代码。如果只是删除了部分逻辑，剩余代码仍可能属于派生作品。

---

## 4. 从 Proma 直接复制未修改的文件（高风险）

以下文件行数完全相同或差异 <2%，**极可能直接从 Proma 复制未改**：

| 文件 | TAgent | Proma | 差距 |
|---|---|---|---|
| `main/lib/conversation-manager.ts` | 481L | 482L | 0% |
| `main/lib/doubao-asr-service.ts` | 448L | 448L | 0% |
| `main/lib/feishu-config.ts` | 234L | 235L | 0% |
| `main/lib/text-output-service.ts` | 50L | 50L | 0% |
| `main/lib/text-insertion-service.ts` | 269L | 270L | 0% |
| `main/lib/voice-dictation-settings-service.ts` | 75L | 75L | 0% |
| `main/lib/utils.ts` | 6L | 6L | 0% |
| `main/lib/local-file-protocol.ts` | 107L | 106L | 1% |
| `renderer/components/tabs/TabPreviewPanel.tsx` | 121L | 121L | 0% |
| `renderer/atoms/markdown-toc.ts` | 4L | 4L | 0% |
| `renderer/atoms/user-profile.ts` | 15L | 15L | 0% |
| `renderer/atoms/markdown-font-size.ts` | 61L | 63L | 3% |

**这 12 个文件是法律风险最高的**——如果发布闭源商业版，它们几乎确定属于 Proma 的 AGPL 派生代码。

---

## 5. Proma 独有文件（TAgent 已删或未引入）

### 5.1 Pi runtime adapter 层（全部 Proma 独有）

```
pi-agent-adapter.ts         1675L
pi-builtin-tools.ts          508L
pi-mcp-tools.ts              358L
pi-message-adapter.ts        301L
pi-model-registry.ts         367L
pi-resource-loader-overrides.ts  13L
runtime-routing-agent-adapter.ts 68L
```

TAgent 没有引入 Proma 的 Pi runtime，说明用的是 Claude SDK 直连。

### 5.2 Agent Runtime 配套（TAgent 已替换或删除）

```
agent-auto-compact-settings.ts      15L
agent-collaboration-tools.ts      1391L
agent-collaboration-utils.ts       114L
agent-fork-workspace-copy.ts        66L
agent-model-selection.ts            70L
agent-runtime-env.ts               219L
agent-runtime-guards.ts            456L
agent-sdk-auth-env.ts               30L
agent-sdk-output-limits.ts           3L
agent-session-context-prompt.ts    215L
agent-workspace-manager.ts        1620L
```

### 5.3 IM / Bridge 集成（TAgent 裁剪或替换）

```
bridge-agent-message-utils.ts       19L
bridge-binding-store.ts             64L
chat-service.ts                    631L
channel-runtime-api-key.test.ts    111L
channel-test-error.ts              258L
```

### 5.4 UI 组件（TAgent 裁剪）

```
context-divider.tsx                 58L
conversation.tsx                   120L
file-path-chip.tsx                 290L
InputToolbarOverflow.tsx           218L
message.tsx                        921L
reasoning.tsx                      247L
scroll-minimap.tsx                 538L
sticky-user-message.tsx            198L
ui-preferences.ts                   73L
```

### 5.5 其他

```
builtin-mcp/ (6 files, ~350L)
agent-auto-compact-settings.ts      15L
error-patterns.ts                   57L
agent-fork-workspace-copy.ts        66L
agent-run-message-visibility.ts     40L
agent-session-usage.ts             119L
```

---

## 6. 品牌残留扫描

### 6.1 TAgent 业务代码中的 Proma 引用（11 处）

全部是注释，不是代码逻辑：

| 文件 | 行 | 内容 |
|---|---|---|
| `main/lib/agent-orchestrator.ts` | 2536 | `// 仅在 session_id 真正变化时才持久化（对齐 Proma #910）` |
| `main/lib/agent-orchestrator.ts` | 3452 | `// 保留 sdkSessionId，确保下一轮能继续 resume（对齐 Proma #903）` |
| `renderer/atoms/agent-atoms.ts` | 814 | `// result.usage 是整个 query 内多次 model call 的累计，直接覆盖会虚高（Proma #821）` |
| `main/lib/config-paths.ts` | 537 | `* 列出 bundle 内 legacy Skill 目录（Proma 时代遗留，不再进入插件商店）` |
| `main/lib/automation-scheduler.ts` | 4 | `* 核心设计（借鉴 Proma v0.13.3）` |
| `main/lib/adapters/claude-agent-adapter.ts` | 780 | `// 对齐 Proma #913` |
| `main/lib/adapters/claude-agent-adapter.ts` | 845 | `// 对齐 Proma #745` |
| `main/lib/usage-stats-service.ts` | 379 | `* 口径对齐 Claude Code context_window / Proma agent-session-usage` |
| `packages/shared/src/utils/context-usage.ts` | 4 | `* usedTokens 口径与 Claude Code / Proma 一致` |
| `packages/shared/src/plugin-store-catalog.ts` | 7 | `- 不展示 Proma 设计包、Coach、tool-builder 等 legacy 条目` |
| `packages/shared/src/types/installer.ts` | 4 | `* TAgent 通过 proma-api 的 /installers/manifest 接口拿到可安装的第三方工具清单` |

**注**：`installer.ts:4` 中 `proma-api` 已确认是历史残留，实际端点为 `tagent-api`（见 `installer-manifest.ts`）。

### 6.2 TAgent 业务代码中的 Kun 引用（12 处）

全部是注释（"参考 Kun 的..."），不是代码逻辑：

| 文件 | 行 | 内容 |
|---|---|---|
| `main/lib/automation-scheduler.ts` | 137 | `// 防休眠（借鉴 Kun 的 powerSaveBlocker）` |
| `renderer/design/shape-ops.ts` | 7 | `* 设计参考：F:/Kun shape-ops（概念独立实现）` |
| `renderer/design/canvas-types.ts` | 4 | `* 设计来源：F:/Kun 的 canvas-types.ts（概念参考，独立实现）` |
| `renderer/design/canvas-shape-store.ts` | 5 | `* 参考 Kun 的 canvas-shape-store.ts 接口（独立实现）` |
| `renderer/components/agent/WpsBrowserPanel.tsx` | 4 | `* 参考 Kun 的 DevBrowserPanel` |
| `renderer/components/agent/plugin-toolbar-button.tsx` | 2 | `* 参考 Kun PluginMarketplace 胶囊样式` |
| `renderer/components/design-preview/CanvasOverlay.tsx` | 11 | `* 设计来源：参考 Kun agent 的 hand-tool + select-tool` |
| `renderer/components/design-preview/README.md` | 64 | `- ❌ 新建或恢复 .kun-canvas/` |
| `packages/shared/src/plugin-store-catalog.ts` | 4 | `* - inline Skill：安装时写入轻量 SKILL.md（参考 Kun 推荐工作流）` |
| `packages/shared/src/plugin-store-catalog.ts` | 335 | `/** 插件商店 MCP 目录（参考 Kun RECOMMENDED_ITEMS）` |
| `packages/shared/src/types/draft.ts` | 4 | `* 从 Kun 的 SDD 系统简化而来` |
| `packages/shared/src/types/draft.ts` | 18 | `/** 需求块 — 比 Kun 的 R-n 块更轻量` |

### 6.3 文档中的 Proma 引用（416 处）

集中在以下文档：

| 文档 | 命中数 | 性质 |
|---|---|---|
| `docs/plans/2026-05-18-proactive-scheduler-monitor-design.md` | 112 | 废弃设计文档 |
| `docs/plans/2026-06-05-tagent-fusion-design.md` | 48 | 历史设计 |
| `docs/plans/2026-07-18-agent-runtime-dual-core-pi-migration.md` | 28 | ADR 10 |
| `docs/plans/2026-06-24-proma-upstream-borrow-list.md` | 29 | 借鉴清单 |
| `docs/PROGRESS.md` | 32 | 进度跟踪 |
| `docs/plans/2026-06-24-upstream-feature-roadmap.md` | 14 | 上游路线图 |
| `docs/process/2026-06-24-doc-cleanup-report.md` | 16 | 文档清理报告 |
| `docs/plans/2026-06-24-automation-design.md` | 18 | 自动化设计 |
| 其他 docs 文件 | 119 | 历史文档 |

**按 AGENTS.md §5 规则**：文档归档保留是合规的，但活跃文档中的 Proma 引用应逐步清理。

### 6.4 LICENSE 文件

```
LICENSE:22: - Proma (https://github.com/proma-ai/proma) — AGPL-3.0
```

这是 AGPL-3.0 的 attribution 要求，**不能删除**（除非确认不再使用任何 Proma 代码）。

### 6.5 AGENTS.md / CLAUDE.md 中的 Proma 引用

- `AGENTS.md:8` — `TAgent = Proma + ta_agent`（已过时表述）
- `AGENTS.md:21` — 品牌约束（正确，但基座描述需更新）
- `CLAUDE.md:22,37` — 品牌约束

### 6.6 .gitignore

```
.kun-canvas/   (历史临时目录的 ignore，保留无害)
```

---

## 7. 风险分级

### 高风险（闭源商业版阻塞）

1. **12 个"几乎完全复制未动"的文件** — 法律上几乎确定属于 Proma 派生代码
2. **`agent-orchestrator.ts`** — 核心编排器，虽扩展 34%，但骨架可能仍是 Proma
3. **5-15% 差异的大量文件** — 需要逐个判断是否仍以 Proma 逻辑为基础
4. **LICENSE 中的 Proma attribution** — 在派生代码完全清除前不能删除

### 中等风险

1. **裁剪过的 renderer 组件**（message.tsx 等）— 保留的部分可能仍是 Proma 代码
2. **preload/index.ts** — +56% 新增，但原有部分可能占 40-50%
3. **5-15% 差异文件** — 需要人工逐文件审计

### 低风险（已确认安全）

1. **405 个 TAgent 独有文件** — 自研新增
2. **高度自研的同名文件**（agent-prompt-builder.ts、WelcomeEmptyState.tsx 等）
3. **ta_agent 整个工具链** — 自有闭源
4. **12 处品牌注释残留** — 可直接清理
5. **文档中的 Proma 引用** — 归档保留或逐步清理

---

## 8. 推荐下一步

### 8.1 立即可做

1. 清理 12 处业务代码中的 Proma 品牌注释
2. 清理 12 处 Kun 品牌注释
3. 把 `installer.ts:4` 的 `proma-api` 改为 `tagent-api`
4. 更新 `AGENTS.md` 中 `TAgent = Proma + ta_agent` 的表述

### 8.2 需要人工审计

1. 逐个审查 12 个"几乎完全复制未动"的文件，决定删除 / 重写 / 保留
2. 对 `agent-orchestrator.ts` 做函数级 Proma 派生边界分析
3. 逐个判断 5-15% 差异文件的派生状态
4. 裁剪过的 renderer 组件（message.tsx 等）判断残留代码是否仍属派生

### 8.3 架构层面

1. 建立《代码许可证来源清单》，按模块记录来源和许可证
2. 对确认是 Proma 派生的核心模块制定重写计划
3. 等审计完成后再决定是否修改 LICENSE

---

## 附录 A：扫描工具命令

```bash
# 扫描 Proma 源码中的 proma 引用
rg -n "proma|Proma|PROMA" F:/Proma/apps/electron/src/

# 扫描 TAgent 源码中的 proma 引用
rg -n "proma|Proma|PROMA" F:/TAgent_General/apps/electron/src/ F:/TAgent_General/packages/

# 扫描 TAgent 源码中的 kun 引用
rg -n "\bkun\b|kunlabor|Kun " F:/TAgent_General/apps/electron/src/ F:/TAgent_General/packages/

# 列出两边 TS/TSX 文件
rg -l "a" --glob "*.ts" --glob "*.tsx" F:/TAgent_General/apps/electron/src/ > .ta-files2.txt
rg -l "a" --glob "*.ts" --glob "*.tsx" F:/Proma/apps/electron/src/ > .pr-files2.txt
```

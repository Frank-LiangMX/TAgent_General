# TAgent 文档索引

> 找文档的入口。**所有 Agent 进工程必读**。

> **最近一次整理**：2026-06-24（详见 [`process/2026-06-24-doc-cleanup-report.md`](process/2026-06-24-doc-cleanup-report.md)）

---

## 入口

| 文档                                           | 受众                                       | 何时读                      |
| ---------------------------------------------- | ------------------------------------------ | --------------------------- |
| [`../AGENTS.md`](../AGENTS.md)                 | 编码 Agent（Claude Code / Cursor / Codex） | **每次开工前**              |
| [`../.claude/CLAUDE.md`](../.claude/CLAUDE.md) | Claude Code 上下文                         | 启动 Claude Code session 时 |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md)     | 人类贡献者                                 | 第一次 PR 前                |
| [`../CHANGELOG.md`](../CHANGELOG.md)           | 所有人                                     | 想知道"最近改了什么"时      |
| [`../README.md`](../README.md)                 | 路人                                       | 第一次进仓库                |

---

## 设计 / 规划（`plans/`）

按时间倒序排列。新增的活跃规划带 ✨ 标记。

### 上游对齐与能力扩展（v0.13.3 基线）

| 文档                                                                                                | 内容                                                         |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| [`plans/2026-06-24-upstream-feature-roadmap.md`](plans/2026-06-24-upstream-feature-roadmap.md) ✨  | **v0.13.3 基线总路线图**（37 大类 / ~130 项 / 5 阶段）       |
| [`plans/2026-06-24-p0-stability-patches.md`](plans/2026-06-24-p0-stability-patches.md) ✨          | **P0 稳定性 PR 模板**（SDK 0.3.185 + #910/#913/#903）         |
| [`plans/2026-06-24-automation-design.md`](plans/2026-06-24-automation-design.md) ✨                | **Automation 调度系统 v1 设计**（30s tick / 失败退避）       |
| [`plans/2026-06-24-collaboration-design.md`](plans/2026-06-24-collaboration-design.md) ✨         | **协作子会话 v1 设计**（MCP 委派 / 后台 Runner）              |
| [`plans/2026-06-16-upstream-upgrade-plan.md`](plans/2026-06-16-upstream-upgrade-plan.md)           | v0.10.34 基线旧上游对齐规划 + 开发 Agent 实施手册             |
| [`plans/2026-06-16-upstream-upgrade-issues.md`](plans/2026-06-16-upstream-upgrade-issues.md)       | Issue A~E 任务拆分（v0.10.34 基线）                          |

### 核心架构

| 文档                                                                                                | 内容                                                |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`plans/2026-06-05-tagent-fusion-design.md`](plans/2026-06-05-tagent-fusion-design.md)               | TAgent Desktop 完整设计（13 节）                    |
| [`plans/2026-06-05-tagent-server-design.md`](plans/2026-06-05-tagent-server-design.md)               | TAgent Server 完整设计（12 节）                     |
| [`plans/2026-06-13-ask-mode-unification-design.md`](plans/2026-06-13-ask-mode-unification-design.md) | **Ask 档位统一 Composer**（替代 Chat 模式）         |
| [`plans/2026-06-13-context-compaction-architecture.md`](plans/2026-06-13-context-compaction-architecture.md) | 双层压缩机制（已落地）                              |
| [`plans/2026-06-13-context-usage-breakdown-design.md`](plans/2026-06-13-context-usage-breakdown-design.md) | Context Usage 分项面板设计（活跃）                  |
| [`plans/2026-06-18-right-panel-anchor-animation.md`](plans/2026-06-18-right-panel-anchor-animation.md) | 右栏岛式布局 + scale 动画（已落地）                 |

### TA 模式（游戏技术美术）

| 文档                                                                                                | 内容                                                |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`plans/2026-06-07-ta-tools-analysis.md`](plans/2026-06-07-ta-tools-analysis.md)                   | ta_agent 工具分类分析（~50 工具，4 类）             |
| [`plans/2026-06-07-ta-mcp-architecture.md`](plans/2026-06-07-ta-mcp-architecture.md)               | TA MCP Server 架构设计                              |

### 历史探索

| 文档                                                                                                | 内容                                                |
| --------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| [`plans/2026-05-18-proactive-scheduler-monitor-design.md`](plans/2026-05-18-proactive-scheduler-monitor-design.md) | Proma Proactive Center 设计（v0.13.3 Automation 已吸收核心思想） |
| [`plans/2026-06-09-agent-ui-optimization-plan.md`](plans/2026-06-09-agent-ui-optimization-plan.md) | Agent UI 优化规划                                   |
| [`plans/2026-06-09-verification-checklist.md`](plans/2026-06-09-verification-checklist.md)         | 2026-06-09 验证清单（决策 #15 实施）                |
| [`plans/2026-06-16-wps-bridge-landing.md`](plans/2026-06-16-wps-bridge-landing.md)                 | WPS 协作 Bridge 落地说明                            |

---

## 架构决策（`decisions/`）

| 文档                                                                                                       | 决策                                                          |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| [`decisions/0000-template.md`](decisions/0000-template.md)                                                 | ADR 模板                                                      |
| [`decisions/0001-fusion-architecture.md`](decisions/0001-fusion-architecture.md)                         | 融合架构（Proma + ta_agent）                                  |
| [`decisions/0002-ask-mode-composer.md`](decisions/0002-ask-mode-composer.md)                             | Ask / Agent Composer 档位（替代独立 Chat 模式）               |
| [`decisions/0003-upstream-feature-roadmap.md`](decisions/0003-upstream-feature-roadmap.md) ✨            | **上游特性对齐策略（v0.13.3 基线）**                           |

---

## 流程规范（`process/`）

| 文档                                                                                  | 内容                              |
| ------------------------------------------------------------------------------------- | --------------------------------- |
| [`process/git-workflow.md`](process/git-workflow.md)                                  | 分支、提交、合并规范              |
| [`process/code-review.md`](process/code-review.md)                                    | Review checklist + 流程           |
| [`process/release.md`](process/release.md)                                            | 发版流程                          |
| [`process/testing.md`](process/testing.md)                                            | 测试标准与覆盖率门槛（80% 强制）  |
| [`process/linting.md`](process/linting.md)                                            | 代码风格与自动检查                |
| **`process/2026-06-24-doc-cleanup-report.md`** ✨                                       | **2026-06-24 文档整理报告**        |

---

## 实验 / 调研（`experiments/`）

| 文档                                                  | 内容                          |
| ----------------------------------------------------- | ----------------------------- |
| [`experiments/README.md`](experiments/README.md)       | 试错记录目录说明（暂空）      |

---

## 报告（`reports/`）

| 文档                                            | 内容                          |
| ----------------------------------------------- | ----------------------------- |
| [`reports/README.md`](reports/README.md)         | 报告型文档目录说明（暂空）    |

---

## 归档（`archive/`）

历史已完成或被替代的文档。

### `archive/plans/`

| 文档                                                                                                            | 内容                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [`archive/plans/2026-06-02-im-model-switch-design.md`](archive/plans/2026-06-02-im-model-switch-design.md)     | IM `/model` 切换设计，能力已完成       |

### `archive/reports/`

| 文档                                                                                                            | 内容                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [`archive/reports/2026-06-05-brand-migration.md`](archive/reports/2026-06-05-brand-migration.md)               | 品牌迁移 / codemod 三份报告合并归档    |

### `archive/sessions/`

会话级一次性进度笔记（从 `.context/` 迁移过来）。

| 文档                                                                                                            | 内容                                   |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [`archive/sessions/README.md`](archive/sessions/README.md)                                                       | 会话归档目录说明                       |
| [`archive/sessions/2026-06-06-progress.md`](archive/sessions/2026-06-06-progress.md)                           | 2026-06-06 26 commits 进度笔记         |

---

## 文档维护规则

- **新设计** → 写 `plans/YYYY-MM-DD-<topic>.md`
- **新决策** → 写 `decisions/NNNN-<topic>.md`（用 `0000-template.md` 模板）
- **新流程** → 写 `process/<topic>.md`
- **新实验** → 写 `experiments/{backend,frontend,infra,design}/YYYY-MM-DD-<topic>.md`
- **新报告** → 写 `reports/YYYY-MM-DD-<topic>.md`（已发生事件复盘）
- **已完成或被替代设计** → 移到 `archive/`，并在 `docs/PROGRESS.md` 登记状态
- **一次性会话笔记** → 会话结束时从 `.context/` 移到 `archive/sessions/`
- **改动公共 API** → 改对应 README
- **改动 release behavior** → 改 `CHANGELOG.md`
- **品牌约束**：所有文档中用 **TAgent** 而非 Proma；引用用 `@tagent/*`；数据路径用 `~/.tagent[-dev]/`

---

## 目录结构速览

```
docs/
├── README.md                                ← 本文件
├── PROGRESS.md                              ← 项目进度追踪
│
├── plans/                                   ← 设计 / 规划（活跃 + 历史）
│   ├── 2026-06-05-tagent-fusion-design.md
│   ├── 2026-06-05-tagent-server-design.md
│   ├── 2026-05-18-proactive-scheduler-monitor-design.md
│   ├── 2026-06-07-ta-tools-analysis.md
│   ├── 2026-06-07-ta-mcp-architecture.md
│   ├── 2026-06-09-agent-ui-optimization-plan.md
│   ├── 2026-06-09-verification-checklist.md
│   ├── 2026-06-13-ask-mode-unification-design.md
│   ├── 2026-06-13-context-compaction-architecture.md
│   ├── 2026-06-13-context-usage-breakdown-design.md
│   ├── 2026-06-16-upstream-upgrade-plan.md
│   ├── 2026-06-16-upstream-upgrade-issues.md
│   ├── 2026-06-16-wps-bridge-landing.md
│   ├── 2026-06-18-right-panel-anchor-animation.md
│   ├── 2026-06-24-upstream-feature-roadmap.md    ✨
│   ├── 2026-06-24-p0-stability-patches.md        ✨
│   ├── 2026-06-24-automation-design.md           ✨
│   └── 2026-06-24-collaboration-design.md        ✨
│
├── decisions/                               ← 架构决策记录（ADR）
│   ├── 0000-template.md
│   ├── 0001-fusion-architecture.md
│   ├── 0002-ask-mode-composer.md
│   └── 0003-upstream-feature-roadmap.md     ✨
│
├── process/                                 ← 流程规范
│   ├── git-workflow.md
│   ├── code-review.md
│   ├── release.md
│   ├── testing.md
│   ├── linting.md
│   └── 2026-06-24-doc-cleanup-report.md     ✨
│
├── reports/                                 ← 报告（复盘、验证）
│   └── README.md
│
├── experiments/                             ← 实验 / 调研
│   └── README.md
│
└── archive/                                 ← 归档
    ├── plans/
    │   └── 2026-06-02-im-model-switch-design.md
    ├── reports/
    │   └── 2026-06-05-brand-migration.md
    └── sessions/
        ├── README.md
        └── 2026-06-06-progress.md
```

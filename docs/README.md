# TAgent 文档索引

> 找文档的入口。**所有 Agent 进工程必读**。

## 入口

| 文档                                           | 受众                                       | 何时读                      |
| ---------------------------------------------- | ------------------------------------------ | --------------------------- |
| [`../AGENTS.md`](../AGENTS.md)                 | 编码 Agent（Claude Code / Cursor / Codex） | **每次开工前**              |
| [`../.claude/CLAUDE.md`](../.claude/CLAUDE.md) | Claude Code 上下文                         | 启动 Claude Code session 时 |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md)     | 人类贡献者                                 | 第一次 PR 前                |
| [`../CHANGELOG.md`](../CHANGELOG.md)           | 所有人                                     | 想知道"最近改了什么"时      |
| [`../README.md`](../README.md)                 | 路人                                       | 第一次进仓库                |

## 设计

| 文档                                                                                                 | 内容                                                  |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| [`plans/2026-06-05-tagent-fusion-design.md`](plans/2026-06-05-tagent-fusion-design.md)               | TAgent Desktop 完整设计（13 节）                      |
| [`plans/2026-06-05-tagent-server-design.md`](plans/2026-06-05-tagent-server-design.md)               | TAgent Server 完整设计（12 节）                       |
| [`plans/2026-06-13-ask-mode-unification-design.md`](plans/2026-06-13-ask-mode-unification-design.md) | **Ask 档位统一 Composer**（替代 Chat 模式，实施清单） |

## 归档

| 文档                                                                                                     | 内容                                   |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| [`archive/plans/2026-06-02-im-model-switch-design.md`](archive/plans/2026-06-02-im-model-switch-design.md) | IM `/model` 切换设计，能力已完成       |
| [`archive/reports/2026-06-05-brand-migration.md`](archive/reports/2026-06-05-brand-migration.md)           | 品牌迁移 / codemod 三份报告合并归档    |

## 架构决策

| 文档                                                                             | 决策                                            |
| -------------------------------------------------------------------------------- | ----------------------------------------------- |
| [`decisions/0000-template.md`](decisions/0000-template.md)                       | ADR 模板                                        |
| [`decisions/0001-fusion-architecture.md`](decisions/0001-fusion-architecture.md) | 融合架构（Proma + ta_agent）                    |
| [`decisions/0002-ask-mode-composer.md`](decisions/0002-ask-mode-composer.md)     | Ask / Agent Composer 档位（替代独立 Chat 模式） |

## 流程规范

| 文档                                                 | 内容                    |
| ---------------------------------------------------- | ----------------------- |
| [`process/git-workflow.md`](process/git-workflow.md) | 分支、提交、合并规范    |
| [`process/code-review.md`](process/code-review.md)   | Review checklist + 流程 |
| [`process/release.md`](process/release.md)           | 发版流程                |
| [`process/testing.md`](process/testing.md)           | 测试标准与覆盖率门槛    |
| [`process/linting.md`](process/linting.md)           | 代码风格与自动检查      |

## 实验 / 调研

`experiments/` 目录：暂未使用，预留给将来的方案试错记录。

---

## 文档维护规则

- **新设计** → 写 `plans/YYYY-MM-DD-<topic>.md`
- **新决策** → 写 `decisions/NNNN-<topic>.md`（用模板）
- **新流程** → 写 `process/<topic>.md`
- **新实验** → 写 `experiments/{backend,frontend}/YYYY-MM-DD-<topic>.md`
- **已完成或被替代设计** → 移到 `archive/`，并在 `docs/PROGRESS.md` 登记状态
- **改动公共 API** → 改对应 README
- **改动 release behavior** → 改 `CHANGELOG.md`

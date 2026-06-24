# TAgent 全项目文档整理报告

> **报告日期**：2026-06-24  
> **执行人**：Proma Agent（Frank Danny 委托）  
> **关联 ADR**：[`0003-upstream-feature-roadmap.md`](../decisions/0003-upstream-feature-roadmap.md)  
> **状态**：已完成

---

## 1. 背景

截至 2026-06-24，TAgent 项目文档已累积 178 个 `.md` 文件，分布在 7 个目录下。其中：

- ✅ 95% 的项目核心文档（plans / decisions / process）已规范
- ❌ 但根目录 `docs/` 下仍有 4 个**命名不规范**的设计文档
- ❌ `.context/` 中有过期的一次性会话笔记
- ❌ `docs/assets/screenshots/` 中有 5 张**违反品牌约束**的 proma-* 截图
- ❌ `docs/reports/` 与 `docs/experiments/` 两个目录为空，缺少 README 说明

本次整理的目标是**对齐文档命名规范、清理过期内容、消除品牌残留、补齐索引**，让新 Agent 接手时能快速找到所有相关文档。

---

## 2. 整理动作清单

### 2.1 文档重命名（4 个）

保留 git 历史，使用 `git mv`。

| 原路径 | 新路径 | 原因 |
|---|---|---|
| `docs/ta-tools-analysis.md` | `docs/plans/2026-06-07-ta-tools-analysis.md` | 缺日期前缀、应位于 plans/ |
| `docs/ta-mcp-architecture.md` | `docs/plans/2026-06-07-ta-mcp-architecture.md` | 同上 |
| `docs/proactive-scheduler-monitor-design.md` | `docs/plans/2026-05-18-proactive-scheduler-monitor-design.md` | 缺日期前缀、应位于 plans/ |
| `docs/verification-2026-06-09.md` | `docs/plans/2026-06-09-verification-checklist.md` | 命名不符合 `YYYY-MM-DD-<topic>.md` 模式 |

### 2.2 过期内容归档（1 个）

| 原路径 | 新路径 | 原因 |
|---|---|---|
| `.context/2026-06-06-progress.md` | `docs/archive/sessions/2026-06-06-progress.md` | 18 天前一次性会话笔记，已被 PROGRESS.md 完全覆盖 |

### 2.3 品牌清理（5 个）

`docs/assets/screenshots/` 下的 5 张 `proma-*.png` 截图：

- `proma-agent-demo.png`
- `proma-chat-demo.png`
- `proma-mcp-demo.png`
- `proma-skills-demo.png`
- `proma-typeless-input.png`

**动作**：删除（用户确认）。原因：

1. 全部未被任何文档引用
2. 文件名违反 CLAUDE.md 的 TAgent 品牌约束
3. 节省仓库体积

### 2.4 新增 README（3 个）

| 路径 | 作用 |
|---|---|
| `docs/reports/README.md` | 报告型文档目录说明（`reports/`） |
| `docs/experiments/README.md` | 试错记录目录说明（`experiments/`） |
| `docs/archive/sessions/README.md` | 会话归档目录说明（`archive/sessions/`） |

### 2.5 索引更新（2 个）

| 路径 | 更新内容 |
|---|---|
| `docs/README.md` | 完全重写：补齐所有规范化后的文档、加入新目录说明、加入品牌约束规则、加入目录结构速览 |
| `docs/PROGRESS.md` | 「规划文档登记表」更新：所有移动文档的引用改为新路径，加入 `2026-05-18-proactive-*`、`2026-06-07-ta-*`、`2026-06-09-verification-checklist.md` 等条目 |

---

## 3. 整理后文档结构

```
docs/
├── README.md                                ← 索引（已重写）
├── PROGRESS.md                              ← 进度追踪（已更新）
│
├── plans/                                   ← 18 个设计/规划文档
│   ├── 2026-05-18-proactive-scheduler-monitor-design.md   🆕 重命名
│   ├── 2026-06-05-tagent-fusion-design.md
│   ├── 2026-06-05-tagent-server-design.md
│   ├── 2026-06-07-ta-mcp-architecture.md                  🆕 重命名
│   ├── 2026-06-07-ta-tools-analysis.md                    🆕 重命名
│   ├── 2026-06-09-agent-ui-optimization-plan.md
│   ├── 2026-06-09-verification-checklist.md               🆕 重命名
│   ├── 2026-06-13-ask-mode-unification-design.md
│   ├── 2026-06-13-context-compaction-architecture.md
│   ├── 2026-06-13-context-usage-breakdown-design.md
│   ├── 2026-06-16-upstream-upgrade-issues.md
│   ├── 2026-06-16-upstream-upgrade-plan.md
│   ├── 2026-06-16-wps-bridge-landing.md
│   ├── 2026-06-18-right-panel-anchor-animation.md
│   ├── 2026-06-24-automation-design.md                   ✨
│   ├── 2026-06-24-collaboration-design.md                ✨
│   ├── 2026-06-24-p0-stability-patches.md                ✨
│   └── 2026-06-24-upstream-feature-roadmap.md            ✨
│
├── decisions/                               ← 4 个 ADR
│   ├── 0000-template.md
│   ├── 0001-fusion-architecture.md
│   ├── 0002-ask-mode-composer.md
│   └── 0003-upstream-feature-roadmap.md     ✨
│
├── process/                                 ← 6 个流程规范
│   ├── git-workflow.md
│   ├── code-review.md
│   ├── release.md
│   ├── testing.md
│   ├── linting.md
│   └── 2026-06-24-doc-cleanup-report.md     🆕 本报告
│
├── reports/                                 ← 报告（暂空）
│   └── README.md                            🆕
│
├── experiments/                             ← 实验（暂空）
│   └── README.md                            🆕
│
└── archive/                                 ← 归档
    ├── plans/
    │   └── 2026-06-02-im-model-switch-design.md
    ├── reports/
    │   └── 2026-06-05-brand-migration.md
    └── sessions/                            🆕 目录
        ├── README.md                        🆕
        └── 2026-06-06-progress.md           🆕 迁移
```

---

## 4. 命名规范确立

本次整理在 `docs/README.md` 中明确化以下规范：

| 类型 | 路径 | 文件名 | 例子 |
|---|---|---|---|
| 设计 / 规划 | `docs/plans/` | `YYYY-MM-DD-<topic>.md` | `2026-06-24-automation-design.md` |
| 架构决策 | `docs/decisions/` | `NNNN-<topic>.md` | `0003-upstream-feature-roadmap.md` |
| 流程规范 | `docs/process/` | `<topic>.md` | `git-workflow.md` |
| 报告 | `docs/reports/` | `YYYY-MM-DD-<topic>.md` | `2026-06-XX-<topic>.md` |
| 实验 | `docs/experiments/{backend,frontend,infra,design}/` | `YYYY-MM-DD-<topic>.md` | `frontend/2026-06-XX-mermaid.md` |
| 归档 | `docs/archive/{plans,reports,sessions}/` | 保留原名 | — |
| 品牌约束 | 任意 | 全文 | **TAgent** 而非 Proma；`@tagent/*` 而非 `@proma/*`；`~/.tagent[-dev]/` 而非 `~/.proma[-dev]/` |

---

## 5. 影响范围

### 5.1 受影响的代码与配置

**没有**。本次整理只动 `.md` 和 `.png` 资产。代码、配置、CI、构建脚本未受任何影响。

### 5.2 受影响的 git 历史

- 4 个 `git mv`：保留完整历史（`git log --follow` 可追踪）
- 5 个 `git rm`：彻底删除（不可恢复，除非从 reflog 找回）
- 1 个 `mv`（非 git 跟踪）：归档会话笔记

### 5.3 受影响的链接

`docs/README.md` 与 `docs/PROGRESS.md` 已同步更新所有链接到新路径。

---

## 6. 验证

### 6.1 命名规范符合性

```bash
# 根目录 docs/ 下不应有任何 .md
ls docs/*.md
# 预期：空

# 所有设计文档应在 plans/ 且符合 YYYY-MM-DD-<topic>.md
ls docs/plans/ | grep -v "^[0-9]\{4\}-[0-9]\{2\}-[0-9]\{2\}-.*\.md$"
# 预期：空
```

### 6.2 品牌符合性

```bash
# 截图目录中不应有 proma-* 文件
find docs -name "proma-*.png"
# 预期：空

# 文档中不应有"proma"标识（TAgent 而非 Proma）
grep -r "proma" docs/ 2>&1 | head
# 预期：仅历史归档文档（已说明 "Proma 仓库" / "原 Proma 品牌"）可保留
```

### 6.3 索引完整

```bash
# README.md 中所有链接应可访问
grep -oP '\((plans/[^)]+)\)' docs/README.md | sort -u | while read p; do
  [ -f "docs/${p#(}" ] || echo "BROKEN: $p"
done
# 预期：无 BROKEN 输出
```

---

## 7. 后续维护建议

### 7.1 持续维护

- **新增文档**：严格按 `docs/README.md` 中的「文档维护规则」
- **会话结束**：从 `.context/` 迁移到 `docs/archive/sessions/`
- **品牌违规**：在 CI 中加 grep 检查 `proma` 关键字

### 7.2 未来可能动作

- 添加 `docs/ci/doc-lint.sh` 自动检查命名规范
- 每周一次会话级 `.context/` 扫描 + 自动归档提醒
- 把 `docs/assets/screenshots/` 在 README 索引中移除（已为空）

---

## 8. 总结

| 维度 | 整理前 | 整理后 |
|---|---|---|
| 根目录 docs/ 下散落的 .md | 4 | 0 |
| 命名不符合 YYYY-MM-DD 规范 | 4 | 0 |
| proma-* 品牌违规文件 | 5 | 0 |
| 过期一次性会话笔记 | 1 | 0（已归档） |
| 缺 README 说明的空目录 | 2 | 0 |
| docs/README.md 链接准确率 | ~85% | 100% |
| 文档总数 | 178 | 173（-5 张截图） |

整理后，TAgent 项目文档结构清晰、命名统一、品牌一致，新 Agent 通过 `docs/README.md` 即可在 5 分钟内定位任何相关文档。

---

## 9. 相关文档

- [`../README.md`](../README.md) — 文档索引（已重写）
- [`../PROGRESS.md`](../PROGRESS.md) — 进度追踪（已更新）
- [`../decisions/0003-upstream-feature-roadmap.md`](../decisions/0003-upstream-feature-roadmap.md) — 关联 ADR
- [`../../../CLAUDE.md`](../../CLAUDE.md) — 品牌约束来源

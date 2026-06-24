# TAgent 上游能力对齐 — Issue 草案（A~E）

> **状态**：活跃 — Issue A 仍可独立执行；Issue B/C/D/E 已被 2026-06-24 新设计文档覆盖
> **关联文档**：
> - **Issue A**（1M 上下文统一）→ [`2026-06-24-upstream-feature-roadmap.md`](2026-06-24-upstream-feature-roadmap.md) §2.4
> - **Issue B/C/D/E**（Automation 相关）→ [`2026-06-24-automation-design.md`](2026-06-24-automation-design.md)
> - **上游基线**：v0.10.34（2026-06-16）→ v0.13.3（2026-06-23）
> **来源规划**：[`docs/plans/2026-06-16-upstream-upgrade-plan.md`](2026-06-16-upstream-upgrade-plan.md)
> **用途**：直接复制到 GitHub Issues（建议一条 issue 对应一个 PR）

---

## Issue A — 统一 1M 上下文能力判断（M1）

**建议标题**

`feat(desktop): unify 1M context capability inference across shared/main/renderer`

**目标**

将 `supports1MContext` / `inferContextWindow` 抽为 shared 单一事实源，消除前后端模型窗口不一致。

**范围**

- `packages/shared`：新增/收敛上下文能力判断函数与类型。
- `apps/electron/src/main`：连通性测试、模型能力读取改为复用 shared。
- `apps/electron/src/renderer`：设置页、模型展示、上下文占用展示统一口径。

**不在范围**

- 不新增新渠道 UI。
- 不改现有渠道配置存储结构。

**验收标准**

- 同一模型在设置页、连通性测试、上下文进度显示一致。
- 不再出现多处硬编码窗口大小。
- 关键映射逻辑有单测覆盖。

**测试要求**

- 单测：模型到上下文窗口映射（含 1M 模型、普通模型、未知模型）。
- 回归：设置页切换模型后上下文显示与实际一致。

**回滚方案**

- 保留旧逻辑分支（临时 feature flag 或兼容分支）；
- 若发现线上模型识别异常，可快速切回旧判断。

---

## Issue B — Automation 基础调度内核（M2）

**建议标题**

`feat(desktop): add automation scheduler core with interval/daily/weekly`

**目标**

实现可用的定时任务核心：创建、启停、调度、执行历史、重启恢复。

**范围**

- 主进程新增调度服务（建议 `main/lib/*scheduler*`）。
- 持久化文件（建议 `~/.tagent[-dev]/automations.json`）。
- 支持调度类型：`interval` / `daily` / `weekly`。
- 失败重试与退避；连续失败自动暂停（可配置阈值）。
- 运行历史记录 `lastRun` / `nextRun` / `failureCount` / `lastError`，便于 UI 展示和排障。

**不在范围**

- monthly 调度（放 Issue E）。
- 复杂通知集成（飞书等）。

**验收标准**

- 任务可 CRUD + 启停 + 手动运行。
- 应用重启后任务状态、下次运行时间可恢复。
- 调度执行不会阻塞主线程 UI。
- 连续失败可退避，最近错误可被后续 UI 读取。

**测试要求**

- 单测：下次触发时间计算、失败退避、暂停恢复。
- 集成验证：创建任务后可按预期触发并记录历史。

**回滚方案**

- 提供总开关禁用调度器加载；
- 保留已有系统行为，不影响非自动任务路径。

---

## Issue C — Automation 管理界面（M2）

**建议标题**

`feat(desktop): add automation management UI with run/pause/delete flows`

**目标**

提供可用的自动任务管理 UI，与调度内核打通。

**范围**

- 渲染层新增列表 + 编辑面板（新建/编辑/删除）。
- 列表展示状态、调度文案、最近执行时间。
- 行为按钮：立即运行、暂停/恢复、删除。
- IPC 四层打通（shared 类型、main handler、preload、renderer）。

**不在范围**

- monthly UI（放 Issue E）。
- 视觉重构（仅做必要样式与可用性）。

**验收标准**

- 用户可在 UI 完成完整生命周期操作。
- 错误态有可理解反馈，不静默失败。
- 编辑保存后状态与持久化一致。

**测试要求**

- 组件测试：列表渲染、状态切换、错误反馈。
- 端到端手工：新建 -> 运行 -> 暂停 -> 恢复 -> 删除。

**回滚方案**

- 保留入口开关，必要时隐藏入口并保留后端数据兼容。

---

## Issue D — 上下文安全阀与会话分流（M3）

**建议标题**

`feat(desktop): add context usage guardrail for automation session reuse`

**目标**

自动任务执行前检查上下文占用率，超过阈值时自动切换新会话，防止上下文过载。

**范围**

- 在调度执行路径增加上下文占用判断。
- 默认阈值建议 70%（可配置）。
- 超阈值时自动新建子会话并记录原因。

**不在范围**

- 改动普通手动会话策略（仅自动任务路径）。

**验收标准**

- 高占用场景不再继续堆叠同一会话。
- 运行记录可追踪“为何切换新会话”。
- 不影响现有非调度任务执行。

**测试要求**

- 单测：临界值（69/70/71）行为正确。
- 回归：低占用任务仍复用会话。

**回滚方案**

- 阈值策略可通过配置关闭；
- 出现误判可临时禁用分流逻辑。

---

## Issue E — 预览分屏偏好 + Monthly 调度（M4）

**建议标题**

`feat(desktop): add preview split preference and monthly automation schedule`

**目标**

补齐 P1：预览分屏偏好持久化与 monthly 调度（含短月边界）。

**范围**

- 预览模式偏好（标签页 / 分屏）存储与读取。
- monthly：支持每月第 N 天触发（1~31）。
- 短月策略：当月无该天时落到月末。

**不在范围**

- 全局 UI 视觉重绘。
- 自动任务跨外部 IM 通知。

**验收标准**

- 预览模式切换后重启仍保留偏好。
- monthly 在 2/4/6/9/11 月行为正确。
- 无新增模式串线问题（general/ta 隔离）。

**测试要求**

- 单测：monthly 日期计算（含 31 号与闰年 2 月）。
- 手工回归：预览分屏切换、拖拽、关闭恢复。

**回滚方案**

- monthly 可降级隐藏，仅保留 interval/daily/weekly；
- 预览偏好异常时回退到“标签页默认”。

---

## 通用执行要求（复制到每个 Issue 描述底部）

- 分支命名：`feature/*` 或 `fix/*`（禁止直接改 `main`）。
- 提交规范：Conventional Commits。
- 必做检查：
  - `bun run typecheck`
  - `bun test`
- 文档同步：
  - 更新 `docs/PROGRESS.md`
  - 如架构变更，补充/更新 ADR 或设计文档。
- 不得破坏：
  - TAgent 品牌约束
  - general/ta 模式隔离
  - 本地优先存储原则

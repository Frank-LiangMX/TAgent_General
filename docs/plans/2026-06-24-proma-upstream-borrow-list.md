# Proma v0.11.1 → v0.13.3 新增特性借鉴清单

> **状态**：参考清单，逐步开发时决定是否落地
> **日期**：2026-06-24
> **背景**：TAgent fork 自 Proma v0.10.25（commit `c8e3ca2b` "bring in official Proma source"）。Proma 从 v0.11.1 到 v0.13.3 新增了大量特性，本文档梳理哪些值得借鉴、哪些已有、哪些不适用。
> **对比基准**：`F:\Proma`（已 fetch 到 origin/main，含 v0.13.4 tag）
> **参考来源**：`F:/Proma/release-notes/v0.11.1.md` ~ `v0.13.3.md`

---

## 0. 如何使用本文档

这不是一份"必须全做"的清单。每个推进到的模块时，回来查一下：

- **已落地**：TAgent 已有同等能力，不用再做
- **待评估**：TAgent 有但 Proma 做得更好，需要决定是否升级
- **候选借鉴**：TAgent 完全没有，值得新增
- **不适用**：TAgent 架构/需求不同，不做

标注的"成本"是粗略估计：低 = 半天内；中 = 1-3 天；高 = 一周以上。

---

## 1. 已落地（不用再做）

这些 TAgent 已经有同等能力，借鉴清单跳过。

| 特性 | 来源 | TAgent 状态 |
|---|---|---|
| SDK 0.3.185 升级 + drain timeout 修复 (#913) | v0.13.3 | 当前分支 `fix/upgrade-sdk-0.3.185` 已完成（typecheck 通过） |
| 并发会话同步写风暴修复 (#910) | v0.13.3 | 已修 `agent-orchestrator.ts:2062`（持久化后同步 `existingSdkSessionId`） |
| 长任务断连保留 sdkSessionId (#903) | v0.13.3 | 已修 `agent-orchestrator.ts:2720`（网络瞬时错误保留 session） |
| TA 模式 / 资产库 / 审核 / 流水线 | TAgent 独有 | 已完成 |
| 记忆 5 层 + 自进化 | TAgent 独有 | 已完成 |
| 飞书/钉钉/微信/WPS Bridge | v0.10.x 起逐步 | 已完成 |
| Plugin Store（替代批量预装 Skill） | v0.12.0 起 | 当前分支已做 |

---

## 2. 候选借鉴：低成本高价值（推荐先做）

### 2.1 Context Usage 显示修复

**来源**：v0.12.23 release note「彻底修正上下文占用量显示失真」

**问题**：TAgent 的 `ContextUsageBadge` 有显示，但 PROGRESS.md 标为活跃待办"Context Usage 分项面板 P0-P2 未实现"，且可能存在同样的 token 计算失真。

**Proma 的修复点**：
1. Anthropic API 上下文占用 = `input_tokens + cache_read_input_tokens + cache_creation_input_tokens`（三者求和，启用 prompt caching 后绝大部分落在 cache_read 上）
2. OpenAI 兼容渠道（zhipu / openai / doubao / qwen / custom）的 `prompt_tokens` 已含缓存命中部分，映射到 Anthropic schema 时需扣减，否则缓存被计两次，显示值约为真实值的 1.5-2 倍
3. `result.usage` 是整个 query 内所有模型调用的累计求和，不能当作当前上下文（complete 分支只信任流式 usage）
4. 真实 `contextWindow` 必须透传，分母不能永远显示 200K

**TAgent 落地**：查 `packages/shared/src/utils/context-window.ts` 和 `apps/electron/src/main/lib/context-usage-cache.ts`，对照 Proma 实现修正。

**成本**：低（1 天内）
**风险**：低
**关联文档**：`docs/plans/2026-06-13-context-usage-breakdown-design.md`

---

### 2.2 上游响应解析失败自动重试

**来源**：v0.12.26 release note「上游响应解析失败自动重试」

**问题**：`API Error: JSON Parse error: Unable to parse JSON string` 这类上游响应体解析失败（HTML 错误页 / SSE 截断 / 代理脏数据），TAgent 现在可能没有归类为可重试。

**Proma 的做法**：新增 `MALFORMED_RESPONSE_PATTERN` 判定，归类为可重试的 `service_error`，复用现有重试机制（指数退避 + 25 次 + 5 分钟预算）。

**TAgent 落地**：查 `apps/electron/src/main/lib/error-patterns.ts`，加 `MALFORMED_RESPONSE_PATTERN`。

**成本**：低（半天）
**风险**：低

---

### 2.3 SKILL.md BOM 处理

**来源**：v0.12.23 release note「带 BOM 的 SKILL.md 解析失败」

**问题**：Windows 上编辑器可能给 SKILL.md 加 BOM 字节，导致 frontmatter / version 解析失败，版本误判为 0.0.0 触发不必要的更新。

**Proma 的做法**：`parseSkillFrontmatter` / `parseSkillVersion` / `extractSkillBody` / `rebuildSkillMd` 统一增加 BOM 处理。

**TAgent 落地**：查 `apps/electron/src/main/lib/config-paths.ts` 里的 SKILL.md 解析函数。

**成本**：低（半天）
**风险**：低

---

### 2.4 外部 MCP 缺 type 字段自动推断

**来源**：v0.12.23 release note「外部 MCP 服务器因缺少 type 字段加载失败」

**问题**：用户手动编写的 `mcp.json` 通常不含 `type` 字段，导致 MCP 服务器被静默跳过、UI 显示 undefined。

**Proma 的做法**：读取后自动按 `command` → stdio、`url` → http 推断类型，配置不完整时输出 warn 而非静默丢弃，UI 把未知类型显示为「未知」。

**TAgent 落地**：查 `apps/electron/src/main/lib/agent-workspace-manager.ts` 里的 MCP 配置加载。

**成本**：低（半天）
**风险**：低

---

### 2.5 LaTeX 原生分隔符渲染

**来源**：v0.12.0 release note「修复 LaTeX 原生分隔符无法渲染数学公式」

**问题**：模型输出 `\(...\)` 行内公式或 `\[...\]` 块级公式时，`react-markdown` 走 CommonMark 规范会把反斜杠括号当作转义吃掉，导致 `remark-math` 识别不到。

**Proma 的做法**：markdown 解析前把 `\(...\)` 规范化为 `$...$`、`\[...\]` 规范化为 `$$...$$`，代码块和内联代码中的字面量用占位符保护。

**TAgent 落地**：查 `packages/ui/` 或 `apps/electron/src/renderer/components/` 下的 markdown 渲染入口。

**成本**：低（半天）
**风险**：低

---

## 3. 候选借鉴：核心能力（中等成本，建议做）

### 3.1 定时任务（Automation）系统

**来源**：v0.12.0 起，v0.12.23 补 monthly，v0.13.3 补 once/maxRuns

**TAgent 现状**：设计文档 `docs/plans/2026-06-24-automation-design.md` 已有，但 PROGRESS.md 标为 P0 缺口"完全缺失"。

**借鉴 Proma 真实实现的关键点**（不是照搬设计文档，是照搬落地代码）：

| 设计点 | Proma 实现 | TAgent 设计现状 | 建议 |
|---|---|---|---|
| 会话策略 | `sessionMode: 'daily' \| 'reuse'`，daily 同日复用 + 70% 阈值 roll over | 单一 `sessionRef` | **改成 daily/reuse 双模式** |
| 权限模式 | `permissionMode: 'auto' \| 'bypassPermissions'`，默认 bypass（无人值守必须） | 5 个细粒度权限位 | **改成 auto/bypass 二选一** |
| 失败退避 | 5 次自动暂停 | 3 次 + 指数退避 | **改成 5 次** |
| 超时 | 2 小时 | 30 分钟 | **改成 2 小时** |
| 用户接管保护 | `automationGraduated` 标记，用户接管过的会话不再注入 | 无 | **补上** |
| 防递归 | prompt 注入 `automationContext`，告诉 Agent 这本身是定时任务 | 无 | **补上** |
| 重启防雪崩 | 过期 `nextRunAt` 顺延一个完整间隔 | 无 | **补上** |
| 运行历史 | 嵌在 automation 对象内，截断 20 条 | 独立持久化 1000 条 | **改成嵌在对象内 20 条** |
| 通知 | 飞书 + `trigger: always/success/error` | 5 通道（飞书/钉钉/微信/WPS/系统） | **先做飞书 + trigger 条件，其他通道后续** |
| MCP 工具 | list/create/update/delete 4 个 | 6 个（含 pause/resume/get_runs） | **先做 4 个核心** |

**关键实现文件参考**（F:\Proma）：
- `apps/electron/src/main/lib/automation-scheduler.ts`（297 行）
- `apps/electron/src/main/lib/automation-manager.ts`（412 行）
- `apps/electron/src/main/lib/automation-agent-tools.ts`（338 行）
- `apps/electron/src/main/lib/automation-notification-service.ts`（46 行）
- `apps/electron/src/main/lib/automation-notification-format.ts`（86 行）
- `packages/shared/src/types/automation.ts`（类型定义）
- `apps/electron/src/renderer/atoms/automation-atoms.ts`

**成本**：中（3-5 天，按里程碑 M1 内核 → M2 UI → M3 扩展）
**风险**：中（涉及主进程后台调度 + SDK headless 调用）
**关联文档**：`docs/plans/2026-06-24-automation-design.md`（需按上表修订）

---

### 3.2 后台任务完成自动唤醒 idle Agent

**来源**：v0.12.0 release note「后台任务 / Monitor 完成时自动唤醒 idle Agent」

**问题**：Agent 模式下 `run_in_background` 后台任务完成时，Agent 可能已经结束当前轮次。用户得手动再发消息才能看到结果。

**Proma 的做法**：用 SDK Stop hook 观察在飞行的任务，仍有任务时保持消息通道开启，并加 1 小时空闲超时兜底释放子进程；软空闲态下仍可继续注入消息，唤醒输出独立成块不会与上一轮混在一起。

**TAgent 落地**：查 `apps/electron/src/main/lib/agent-orchestrator.ts` 的 Stop hook 处理。

**成本**：中（1-2 天）
**风险**：中（涉及 SDK hook 生命周期）
**价值**：高——这是 proactive Agent 的基础能力

---

### 3.3 Bridge 长连接自愈

**来源**：v0.12.0 release note「Bridge 长连接自愈」

**问题**：飞书 / 钉钉 / 企业微信的 Bridge 长连接在系统息屏、唤醒、解锁等网络短暂抖动场景下可能卡在错误状态。

**Proma 的做法**：新增 Bridge Registry 自愈机制，系统恢复 / 解锁后重启已启用的 bridge，并周期性恢复被标记为不健康的连接。

**TAgent 落地**：TAgent 有多 Bridge（飞书/钉钉/微信/WPS），更需要这个。查 `apps/electron/src/main/lib/` 下的 bridge 实现。

**成本**：中（1-2 天）
**风险**：中
**价值**：高——TAgent 的远程连通是核心特性

---

### 3.4 自然语言创建定时任务

**来源**：v0.12.0 release note「自然语言创建定时任务」

**问题**：用户得手动填表创建定时任务。

**Proma 的做法**：Agent 收到周期性任务诉求时，通过结构化输出协议自动创建 Automation。意图识别走「DeepSeek + Anthropic + 关键词启发式」三级 fallback，关键词清单覆盖「定时」「自动」「每隔」等常见说法。

**TAgent 落地**：依赖 3.1 定时任务系统先落地。

**成本**：中（2 天）
**风险**：中（意图识别准确率）
**依赖**：3.1

---

### 3.5 定时任务跨运行记忆

**来源**：v0.12.23 release note「定时任务跨运行记忆机制」

**问题**：定时任务每次触发都是独立的，没有跨运行的积累。

**Proma 的做法**：automation skill 升级，引导 Agent 在创建任务时就把「读取 / 滚动维护工作区 `notes.md`」写进 prompt，路径约定 `.context/automation/<task-slug>/notes.md`，并强调滚动清理过时条目避免变成新的上下文负担。

**TAgent 落地**：依赖 3.1 定时任务系统先落地。

**成本**：低（半天，约定路径 + skill 引导）
**风险**：低
**依赖**：3.1

---

## 4. 候选借鉴：UI / 体验（视情况做）

### 4.1 预览侧边分屏

**来源**：v0.12.23 release note「预览支持侧边分屏」

**问题**：预览只能以 Tab 形式打开，不能常驻右侧。

**Proma 的做法**：新增持久化偏好 `previewModePreferenceAtom`（标签页 / 分屏，默认标签页），可在外观设置里切换，也能直接把预览 Tab 拖出上下边界转为分屏。

**TAgent 落地**：查 `apps/electron/src/renderer/components/diff/` 下的预览组件。

**成本**：中（2-3 天）
**风险**：中
**价值**：中——看是否常用预览

---

### 4.2 「Agent 技能」全屏视图

**来源**：v0.12.26 release note「「Agent 技能」全屏视图」

**问题**：Skills/MCP 管理在设置页里，空间不够。

**Proma 的做法**：迁出为独立全屏视图（左侧栏 Blocks 图标入口），商店风卡片网格 + 右侧详情抽屉（加宽至 62vw），支持搜索、启用切换、更新、导入、卸载。

**TAgent 落地**：TAgent 已有 `PluginStorePanel`（585 行），可参考升级为全屏视图。

**成本**：中（2-3 天）
**风险**：低
**价值**：中——看是否需要更大管理空间

---

### 4.3 全局视觉质感升级

**来源**：v0.12.23 release note「全局视觉质感升级」

**内容**：
- Inter Variable 字体 + OpenType 特性（`cv11`/`ss01`/`tnum`）
- 5 档 elevation token（`--radius` / `--shadow-*`，亮/暗双套）
- 原子组件改造（Button / Input / Textarea / Dialog / Popover / DropdownMenu / Select / Sheet）统一 hairline border + 多层柔阴影 + 双层 focus glow + active scale
- 覆写 Tailwind 内置 shadow / radius，让现有 78+ 处 shadow 类、308+ 处 rounded 类零业务改动整体升级

**TAgent 落地**：大工程，建议单独评估是否做。

**成本**：高（1 周以上）
**风险**：中（影响全局样式）
**价值**：中——看是否追求视觉一致性

---

### 4.4 工作区重命名 + 删除二次确认

**来源**：v0.12.0 release note「工作区重命名」+「项目删除二次确认」

**内容**：
- 工作区三点菜单新增「重命名」入口
- 删除项目前弹出确认对话框，默认项目与最后一个项目不允许删除，索引先落盘再删目录

**TAgent 落地**：查 `apps/electron/src/renderer/components/agent/` 下的工作区管理 UI。

**成本**：低（1 天）
**风险**：低
**价值**：中——防误删

---

### 4.5 点击工作区标题折叠会话列表

**来源**：v0.12.23 release note「点击工作区标题折叠 / 展开会话列表」

**内容**：侧边栏工作区标题可点击折叠其下会话列表，标题前新增可旋转的 ChevronRight 指示图标。

**TAgent 落地**：查 `apps/electron/src/renderer/components/agent/` 下的侧边栏。

**成本**：低（半天）
**风险**：低

---

### 4.6 文件芯片右键「在文件管理器中显示」

**来源**：v0.12.23 release note「文件芯片右键「在文件管理器中显示」」

**内容**：右键路径芯片可直接在系统文件管理器中定位该文件，新增 `shell:show-item-in-folder` IPC 通道。

**TAgent 落地**：低成本低价值。

**成本**：低（半天）
**风险**：低

---

## 5. 不适用（TAgent 架构/需求不同，不做）

| 特性 | 来源 | 不做原因 |
|---|---|---|
| 侧边栏会话列表视觉权重优化 | v0.11.1 | TAgent 侧边栏已分叉重构 |
| 三点菜单浮层漂移修复 | v0.11.1 | TAgent 已用不同实现 |
| 「旧屏微光」CRT 终端主题 | v0.12.26 | TAgent 有自己的主题方向 |
| 深色主题精修（远山暮霭/森息夜语/莫兰迪夜） | v0.12.23 | TAgent 有自己的主题体系 |
| Chat 侧边栏对齐 Agent 布局 | v0.12.0 | TAgent 已退役 Chat 主路径 |
| 推荐消息保留草稿 (#904) | v0.13.3 | TAgent 组件结构不同，需单独评估 |
| 有序列表 Shift+Enter 续项 (#908) | v0.13.3 | 同上 |
| 附件 chip 点击预览 (#906) | v0.13.3 | 同上 |

---

## 6. 优先级建议

### 第一梯队（低成本高价值，先做）

1. **2.1 Context Usage 显示修复** — 直接抄 Proma 修复，TAgent 本来就标了待办
2. **2.2 上游响应解析失败自动重试** — 加 pattern 就行
3. **2.3 SKILL.md BOM 处理** — 小修补
4. **2.4 外部 MCP type 推断** — 小修补
5. **2.5 LaTeX 渲染** — 一行预处理

### 第二梯队（核心能力，规划做）

6. **3.1 定时任务系统** — P0 缺口，按 Proma 真实实现落地（需先修订 `automation-design.md`）
7. **3.2 后台任务唤醒 idle Agent** — proactive 基础能力
8. **3.3 Bridge 长连接自愈** — TAgent 多 Bridge 需求强

### 第三梯队（依赖第二梯队）

9. **3.4 自然语言创建定时任务** — 依赖 3.1
10. **3.5 定时任务跨运行记忆** — 依赖 3.1

### 第四梯队（视情况）

11. **4.4 工作区重命名 + 删除确认** — 低成本
12. **4.5 工作区折叠** — 低成本
13. **4.6 文件芯片右键** — 低成本
14. **4.1 预览侧边分屏** — 中成本
15. **4.2 Agent 技能全屏视图** — 中成本
16. **4.3 全局视觉质感升级** — 高成本，单独评估

---

## 7. 参考文件索引

### F:\Proma 实现位置

```
F:/Proma/apps/electron/src/main/lib/
├── automation-scheduler.ts          # 297 行，30s tick 调度器
├── automation-manager.ts            # 412 行，CRUD + 持久化
├── automation-agent-tools.ts        # 338 行，MCP 工具
├── automation-notification-service.ts  # 46 行，通知发送
└── automation-notification-format.ts   # 86 行，通知 Markdown 渲染

F:/Proma/packages/shared/src/types/automation.ts  # 类型定义
F:/Proma/apps/electron/src/renderer/atoms/automation-atoms.ts  # Jotai atoms
```

### F:\Proma release notes

```
F:/Proma/release-notes/v0.11.1.md
F:/Proma/release-notes/v0.12.0.md
F:/Proma/release-notes/v0.12.23.md
F:/Proma/release-notes/v0.12.26.md
F:/Proma/release-notes/v0.13.3.md
```

### TAgent 关联文档

- `docs/plans/2026-06-24-automation-design.md` — 定时任务设计（需按本文档 §3.1 修订）
- `docs/plans/2026-06-13-context-usage-breakdown-design.md` — Context Usage 分项设计
- `docs/plans/2026-06-24-upstream-feature-roadmap.md` — 上游对齐总路线图
- `docs/plans/2026-06-24-p0-stability-patches.md` — P0 稳定性补丁（已完成 PR-2/PR-3）
- `docs/PROGRESS.md` — 项目进度追踪

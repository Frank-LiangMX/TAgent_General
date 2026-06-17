# TAgent — Agent 协作入口

> **任何编码 Agent（Claude Code、Cursor、Codex 等）进 TAgent 工程前必读本文。**
> 读完后开始工作前：再读 `.claude\CLAUDE.md`。

## 1. 项目是什么

TAgent = Proma（开源通用 Agent 框架） + ta_agent（自研游戏 TA 领域 Agent）的**融合重构产物**。

- **基座 = Proma**（TypeScript + Electron + Claude Agent SDK + 12 Provider + 5 MCP）
- **领域工具 = ta_agent**（Python + 54 工具 + 资产库 + 语义搜索 + Blender/UE5）
- **双顶层模式**：通用模式（Proma 现有能力） / TA 模式（TAgent 工具链）
- **品牌**：TAgent（**任何代码、文档、commit、UI 字符串中都不允许出现 "Proma"**）

## 2. 强制阅读

读这些文档，**按顺序**：

1. `.claude\CLAUDE.md` — 工程级 Agent 上下文
2. `docs\plans\2026-06-05-tagent-fusion-design.md` — TAgent Desktop 设计（13 节）
3. `docs\plans\2026-06-05-tagent-server-design.md` — TAgent Server 设计（12 节）
4. `docs\decisions\0001-fusion-architecture.md` — 融合架构决策（ADR）

**不读就开干 = 必然跑偏**。

## 3. 工作流硬性约束

### 3.1 分支策略：GitHub Flow（风险分级）

- `main` 永远可发布
- 默认走 `feature/*` / `fix/*` / `chore/*` / `docs/*` 分支 + PR
- 代码逻辑、依赖、CI / release、构建、权限 / 安全、用户数据、schema、公共 API、删除 / 移动文件等改动**必须**走分支 + PR
- 低风险小改动可以走轻量流程：纯文档错别字、注释、格式、非流程性文档补充，且不影响 runtime / build / CI / release 时，经维护者明确授权后可以直接在当前分支或 `main` 提交
- Agent 默认仍先用分支；只有用户明确说“小改直接做 / 直接提交到 main”，且改动满足低风险条件时，才不新开分支
- Review 按风险分级：高风险 / 核心代码 2 个 reviewer；普通代码 / CI / release 至少 1 个 reviewer 或 CODEOWNER；低风险文档 / 注释可由 owner 自审或直接合并
- 已发布 tag 仍禁止 force-push 或重写历史

### 3.2 提交规范：Conventional Commits

```
<type>(<scope>): <subject>
```

**type**：`feat` / `fix` / `chore` / `docs` / `refactor` / `test` / `perf` / `ci` / `build` / `style`
**scope**（可选）：`desktop` / `server` / `ta-agent` / `memory` / `sync` / `docs` / `ci`

例子：

- `feat(ta-agent): add ue5_configure_asset merged tool`
- `fix(memory): FTS5 索引在大量 sessions 后不重建`
- `chore(ci): 启用 coverage 80% gate`

### 3.3 测试门槛：80% 强制

- **任何 PR 必含测试**（除非纯文档/纯配置改动）
- 整体覆盖率 ≥ 80%
- 核心逻辑（provider、sync、memory、记忆）100% 覆盖

### 3.4 Pre-commit Hooks

提交前自动跑：

- ruff format + lint（Python）
- eslint + prettier（TypeScript）
- mypy 类型检查
- 禁止 commit 失败

### 3.5 PR 必须包含

- [ ] Description 解释 _为什么_ 改（不是 _什么_ 改）
- [ ] 关联 issue（如果是 fix）或 design doc 章节
- [ ] 测试覆盖（纯文档 / 注释可说明不需要）
- [ ] 截图（UI 改动）
- [ ] 按 §3.1 风险分级完成 reviewer approve
- [ ] **所有 CI 检查通过**

## 4. 代码风格

### 4.1 Python (ta_agent + TAgent Server)

- **格式化**：`ruff format`
- **Lint**：`ruff check`
- **类型检查**：`mypy --strict`
- **测试**：`pytest`，`async def` 用 `pytest-asyncio`
- **Docstring**：Google 风格
- **命名**：snake_case（函数/变量），PascalCase（类），UPPER_SNAKE_CASE（常量）

### 4.2 TypeScript (TAgent Desktop)

- **格式化**：`prettier`
- **Lint**：`eslint`
- **类型检查**：`tsc --noEmit`（必须 0 error）
- **测试**：`vitest`
- **命名**：camelCase（变量/函数），PascalCase（类/组件/类型），UPPER_SNAKE_CASE（常量）

## 5. 绝对边界（不要动这些）

### 不要碰

- ❌ `F:\Proma\`（基座，重命名完成后会迁移到本工程）
- ❌ `F:\ta_agent\packages\tools\registry.py`（除非必要——这是 TAgent 工具注册核心）
- ❌ TAgent brand 字符串（`TAgent` 不允许改为 `Proma` 或其他）
- ❌ 用户数据（`%APPDATA%\TAgent\`）的任何文件
- ❌ 已发布的 git tag（要 revert 走新 PR，不要 force-push）

### 必须问用户

- ⚠️ 跨模式共享的 interface（Provider / Channel / Skill）
- ⚠️ 5 层 memory 的 schema 改动
- ⚠️ 任何 P0 阻断级问题（design doc §11 列了）
- ⚠️ 包名 / scope 改动
- ⚠️ 删除已合并的文件

### 可以直接做

- ✅ 工具的具体实现（只要 contract 不变）
- ✅ UI 组件内部实现
- ✅ 测试用例补充
- ✅ 文档改进
- ✅ 性能优化（不动 schema）

## 6. 模式隔离铁律

**两个模式**（通用 / TA）的代码改动要**严格隔离**：

- `general.*` 与 `ta.*` 命名空间不混
- Provider 全局共享；MCP / Skill / Memory / Session 模式独立
- 切换模式时**严格互斥**（无并发 bug）
- 一个 bug 影响两个模式 = 重新审视设计

## 7. 文档维护

**写代码时必更新**：

- 改 public API → 更新对应 README
- 改架构 → 新增 / 更新 ADR
- 改 release behavior → 更新 CHANGELOG.md
- 加新工具 → 更新 `docs/plans/*-design.md` 工具清单

**文档脱节 = 项目崩坏的开端**。

## 8. 错误处理

- **永远不要** `except: pass`（lint 会失败）
- **永远不要** 吞错（用 logger 记录）
- **永远要** 写明错误恢复策略（重试 / 降级 / 提示用户）

## 9. 调试 / 快速命令

```bash
# 启动 TAgent Desktop (dev)
cd apps/electron && bun run dev

# 启动 ta_agent MCP server (dev)
cd F:\ta_agent && python -m agent --mcp-server

# 类型检查
bun run typecheck

# 跑测试
bun test

# 跑 Python 测试
cd F:\ta_agent && pytest

# Pre-commit 检查
pre-commit run --all-files
```

## 10. 引用

- `.claude\CLAUDE.md` — Claude Code 上下文
- `docs\plans\` — 设计文档
- `docs\decisions\` — 架构决策记录 (ADR)
- `docs\process\` — 流程规范
- `CHANGELOG.md` — 变更日志
- `CONTRIBUTING.md` — 贡献流程
- `CODEOWNERS` — 文件 owner

---

**最后**：如果工作时不理解某条规则或不知道边界，**先查文档，再问用户**。文档没写就是 bug——补上。

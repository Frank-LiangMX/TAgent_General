# Contributing to TAgent

> 这是给**人类开发者**的贡献流程。**Agent（Claude Code 等）请读 `AGENTS.md`**。

## 0. 开始之前

1. 读 `AGENTS.md` — 了解硬性约束
2. 读 `.claude\CLAUDE.md` — 工程上下文
3. 读 `docs\plans\` — 当前设计
4. 读 `docs\decisions\` — 过去的决策（避免重复讨论已决定的事）

## 1. 工作流

### 1.1 分支命名

- `feature/<scope>-<short-desc>` — 新功能
  - 例：`feature/ta-mode-asset-library`
- `fix/<scope>-<short-desc>` — 修 bug
  - 例：`fix/memory-fts5-rebuild`
- `chore/<scope>-<short-desc>` — 非功能性改动
  - 例：`chore/ci-add-coverage-gate`
- `docs/<short-desc>` — 文档

### 1.2 开发循环

默认使用分支 + PR；这是代码、CI、release、依赖、构建、schema、公共 API、用户数据、权限 / 安全相关改动的标准流程。

低风险小改动可以轻量处理：纯文档错别字、注释、格式、非流程性文档补充，且不影响 runtime / build / CI / release 时，经维护者明确授权后可以直接在当前分支或 `main` 提交。

```bash
# 1. 切到新分支（标准流程）
git checkout -b feature/my-feature

# 2. 开发 + 测试
bun run dev           # TAgent Desktop dev
cd F:/ta_agent && python -m agent --mcp-server   # ta_agent dev
bun test              # TS tests
pytest                # Python tests

# 3. Pre-commit（提交前必跑）
pre-commit run --all-files

# 4. 提交（Conventional Commits）
git add .
git commit -m "feat(ta-agent): add FTS5 session search"

# 5. Push + 开 PR（低风险直提例外不需要）
git push origin feature/my-feature
gh pr create
```

### 1.3 PR Review 流程

- 高风险 / 核心代码：2 个 reviewer approve
- 普通代码 / CI / release：至少 1 个 reviewer 或 CODEOWNER approve
- 低风险文档 / 注释：owner 自审即可；已授权的直提小改不需要 PR
- 所有 CI 检查通过
- PR description 勾选所有 checklist
- 改动 ≥ 500 行需特别说明设计动机

## 2. 编码规范

完整版见 `docs\process\`：

- [linting.md](docs/process/linting.md) — 代码风格
- [testing.md](docs/process/testing.md) — 测试标准
- [git-workflow.md](docs/process/git-workflow.md) — 详细 git 流程

## 3. 提交规范

```
<type>(<scope>): <subject>

<body - 解释为什么>

<footer - 关联 issue / breaking change>
```

**type**：`feat` / `fix` / `chore` / `docs` / `refactor` / `test` / `perf` / `ci` / `build` / `style`

**scope**（项目内）：`desktop` / `server` / `ta-agent` / `memory` / `sync` / `provider` / `ui` / `mcp` / `docs` / `ci`

## 4. 报告问题

- **Bug**：[GitHub Issues](../../issues/new?template=bug.md)
- **Feature Request**：[GitHub Issues](../../issues/new?template=feature.md)

## 5. Release 流程

完整版见 `docs\process\release.md`。

简要：

- 改 `VERSION` 文件
- 跑 `python scripts/release.py ship X.Y.Z --yes`
- 自动 bump + commit + tag + push

## 6. 行为准则

- 友善、专业、就事论事
- 不接受骚扰、歧视、攻击性言论
- 优先级：用户价值 > 工程整洁 > 个人偏好

## 7. 提问

- 不确定时：**先看文档**（`docs\`）
- 文档没写：**补文档 + 提 PR**
- 文档有但看不懂：开 issue 问
- 紧急 / 重要：直接 @ 项目 owner

---

**TL;DR**：先读 `AGENTS.md`，再读 `docs\plans`，再开工。

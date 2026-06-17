# Git 工作流

> TAgent 用 **风险分级 GitHub Flow**：`main` 始终可发布，代码和高风险改动走 PR，低风险小改可在维护者明确授权后轻量处理。

## 1. 分支策略

### 1.1 main 分支

- **永远可发布**（任何时候 checkout 都能跑）
- 代码逻辑、依赖、CI / release、构建、权限 / 安全、用户数据、schema、公共 API、删除 / 移动文件等改动必须通过 PR 合并
- 低风险小改动（纯文档错别字、注释、格式、非流程性文档补充）可在维护者明确授权后直接提交到 `main`
- 已发布 tag 禁止 force-push 或重写历史

### 1.2 风险分级

| 风险等级 | 典型改动                                                             | 流程                         | Review                          |
| -------- | -------------------------------------------------------------------- | ---------------------------- | ------------------------------- |
| 高风险   | 核心代码、跨模式接口、memory schema、用户数据、权限 / 安全、发布链路 | 分支 + PR + CI               | 2 个 reviewer                   |
| 普通风险 | 一般代码、测试、CI 调整、依赖升级、构建配置                          | 分支 + PR + CI               | 至少 1 个 reviewer 或 CODEOWNER |
| 低风险   | 纯文档错别字、注释、格式、非流程性文档补充                           | 可直接提交，需维护者明确授权 | owner 自审即可                  |

### 1.3 feature 分支

- 命名：`feature/<scope>-<short-desc>`
- 例：
  - `feature/ta-mode-asset-library`
  - `feature/memory-fts5-search`
  - `feature/sync-engine-push`
- 生命周期：一个 PR + merge 后**立即删除**

### 1.4 fix 分支

- 命名：`fix/<scope>-<short-desc>`
- 例：
  - `fix/memory-fts5-rebuild`
  - `fix/electron-blender-hang`
- 紧急时也可以 `fix/urgent-X`（走 expedited review）

### 1.5 chore / docs 分支

- 命名：`chore/<scope>-<short-desc>` 或 `docs/<short-desc>`
- 例：`chore/ci-add-coverage-gate`

## 2. 提交规范（Conventional Commits）

### 2.1 格式

```
<type>(<scope>): <subject>

<body - 解释为什么（不是做什么）>

<footer - 关联 issue / breaking change>
```

### 2.2 type 枚举

| type       | 含义             | 例子                                                         |
| ---------- | ---------------- | ------------------------------------------------------------ |
| `feat`     | 新功能           | `feat(ta-agent): add ue5_configure_asset merged tool`        |
| `fix`      | 修 bug           | `fix(memory): FTS5 index not rebuilding after 1000 sessions` |
| `chore`    | 非功能性改动     | `chore(ci): enable 80% coverage gate`                        |
| `docs`     | 文档             | `docs: add ADR-0001 fusion architecture`                     |
| `refactor` | 重构（不改行为） | `refactor(memory): extract 5-layer schema`                   |
| `test`     | 测试             | `test(sync): add conflict resolution tests`                  |
| `perf`     | 性能             | `perf(memory): cache FTS5 query results`                     |
| `ci`       | CI/CD            | `ci: add release workflow`                                   |
| `build`    | 构建             | `build: upgrade electron to 39.5.1`                          |
| `style`    | 格式（不改语义） | `style: prettier formatting`                                 |

### 2.3 scope 约定

**项目内**：

- `desktop` — TAgent Desktop
- `server` — TAgent Server
- `ta-agent` — ta_agent Python 工具链
- `memory` — 5 层 memory
- `sync` — TAgent Sync
- `provider` — Provider Adapter
- `ui` — UI 组件
- `mcp` — MCP 集成
- `docs` — 文档
- `ci` — CI/CD
- `core` — 核心库
- `shared` — 共享类型
- `electron` — Electron 主进程

### 2.4 例子

```
feat(ta-agent): add FTS5 session search
  Implements cross-session full-text search for L4 memory layer.
  Indexes raw session JSONL files in SQLite for sub-second query.

  Closes #42

fix(memory): prevent 内存污染 across batch inference
  Previously memory context used only the first asset's features
  for matching rules, polluting batch results.
  Now per-asset context is built.

  Closes #58

chore(ci): add coverage 80% gate
  Coverage threshold: 80% (was: no gate)
  Branch: ta-agent + desktop
```

### 2.5 不允许的提交信息

- ❌ `update` / `fix bug` / `WIP` / `asdf`
- ❌ 单行 commit > 100 字符
- ❌ 改了 10 个文件的 `misc update`

## 3. 合并策略

### 3.1 Squash Merge（推荐）

- 一个 feature 分支的所有 commits squash 成一个
- PR title 用作 commit message（重写为 Conventional Commits 格式）
- 历史更干净，便于 revert

### 3.2 Merge Commit

- 保留所有 feature commits
- 适合复杂功能（每个 commit 独立有意义）
- 工具：GitHub UI "Rebase and merge" 或 `git merge --no-ff`

### 3.3 何时 squash / 何时 merge

- **Squash**：典型 feature（< 500 行改动，1-3 个 commit）
- **Merge**：复杂重构（多个 commit 独立有意义，> 1000 行）
- 选哪个：PR description 注明，reviewer 同意

## 4. Rebase vs Merge

### 4.1 Rebase main 到 feature（推荐）

```bash
git checkout feature/my-feature
git fetch origin
git rebase origin/main
git push --force-with-lease
```

**好处**：

- 历史线性
- 合并时 fast-forward

### 4.2 Merge main 到 feature（紧急时）

```bash
git checkout feature/my-feature
git fetch origin
git merge origin/main
git push
```

**何时**：

- 多人协作同一 feature 分支
- main 有 hotfix 必须拉下来
- 不愿处理 rebase 冲突

## 5. 紧急流程

### 5.1 Hotfix

- 紧急 bug 等不及完整 PR
- 走 `fix/urgent-X` 分支
- 直接 @ 项目 owner 走 expedited review
- 仍需 CI 绿 + 至少 1 个 reviewer 或 owner approve（紧急豁免 2 个）

### 5.2 Revert

- main 出问题立刻 revert

```bash
git revert <bad-commit-sha>
git push
```

- **不用** `git reset --hard`（会丢历史）

## 6. Tag 与 Release

- tag 由 `scripts/release.py` 自动管理
- 手动 tag 仅在紧急时（且必须同步 push）
- tag 格式：`vX.Y.Z`（如 `v0.1.0`）
- 详见 [`release.md`](release.md)

## 7. 紧急联系

- **main 出问题**：立刻 revert + @ owner
- **CI 红**：检查 #ci-channels
- **冲突搞不定**：@ owner 协助

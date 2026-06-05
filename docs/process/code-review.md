# Code Review 流程

> TAgent 用 **2 reviewer** + PR template checklist 双重把关。

## 1. 流程概览

```
开发者 push 分支
   ↓
开 PR（带 description + checklist）
   ↓
CI 自动跑（lint / typecheck / test / build）
   ↓
Reviewer 1 review（可能来回）
   ↓
Reviewer 2 review
   ↓
所有 checklist 勾选 + CI 绿 + 2 approve
   ↓
Squash merge / Merge commit
   ↓
分支自动删除
```

## 2. PR Description 模板

每次开 PR **必须**包含：

```markdown
## Why
[解释 *为什么* 改这个。不只是 *什么* 改]

## What
[列出改动点。文件级别 + 关键决策]

## How
[怎么测。手动步骤 / 单元测试 / 截图]

## Risks
[潜在风险 + 如何回滚]

## Checklist
- [ ] 测试覆盖 ≥ 80%
- [ ] 没有新增 lint error
- [ ] 文档同步更新
- [ ] 关联 issue / ADR / design doc
- [ ] 截图（UI 改动）
- [ ] 2 个 reviewer
```

完整模板在 `.github/PULL_REQUEST_TEMPLATE.md`。

## 3. Reviewer 必看项（Code Review Checklist）

Reviewer 必看 7 项，**任何一项不同意就 request changes**：

### 3.1 正确性
- [ ] 代码确实解决了 PR description 里的 *why*
- [ ] 没有边界条件遗漏（空输入、超大输入、并发、Unicode）
- [ ] 错误处理完整（不吞错，有恢复策略）
- [ ] 公共 API 行为不变（除非 PR 明确说改）

### 3.2 测试
- [ ] 单元测试覆盖新功能
- [ ] 边界条件有测试
- [ ] 覆盖率 ≥ 80%
- [ ] 集成测试（如果跨模块）

### 3.3 设计
- [ ] 改动符合 `AGENTS.md` §3-5 硬性约束
- [ ] 不违反双模式隔离
- [ ] 不动"绝对边界"
- [ ] 如果是新模式 / 新抽象：先讨论后实现（不应该在 PR 里突然出现）

### 3.4 代码风格
- [ ] 通过 ruff / eslint / prettier
- [ ] 命名一致（snake_case / camelCase / PascalCase）
- [ ] 没有重复代码（DRY）
- [ ] 没有死代码 / 调试代码 / 注释代码

### 3.5 文档
- [ ] CHANGELOG.md 更新（如有 release 行为变化）
- [ ] 公共 API 改动 → README 更新
- [ ] 架构变更 → 新增 / 更新 ADR
- [ ] 工具改动 → design doc 工具清单更新

### 3.6 安全
- [ ] 不引入已知 CVE 依赖
- [ ] 用户数据不被泄露
- [ ] API key / 凭证不写入代码
- [ ] 没有注入漏洞（SQL / 命令 / 路径）

### 3.7 性能
- [ ] 没有 N+1 查询
- [ ] 没有不必要的大循环
- [ ] 没有未释放的资源（file handle / subprocess / db connection）
- [ ] 大数据集有流式 / 分页

## 4. Reviewer 行为准则

### 4.1 时效
- 简单 PR：1 个工作日内 review
- 复杂 PR：2 个工作日内 review
- 紧急 PR：2 小时内 review

### 4.2 反馈
- 友善、专业、就事论事
- 区分 **必须改** (`blocking`) 和 **建议改** (`nit`)
- 用问句代替断言（"这里为什么用 X？" vs "X 是错的"）

### 4.3 决策权
- **架构 / 模式隔离 / 品牌**：owner 决策
- **代码风格 / 测试覆盖**：reviewer 决策
- **新功能是否值得做**：开 issue 讨论，PR 本身不接受"功能不需要"

## 5. 作者行为准则

### 5.1 PR 准备
- 自己跑一遍 CI
- 自己过一遍 checklist
- 自己截图（UI 改动）
- 自己读自己 diff 找低级错误

### 5.2 回应 review
- 24 小时内回应每条 comment
- 同意的：直接 fix + push
- 反对的：解释为什么，达成共识再改
- 讨论无果：升级到 owner 决策

### 5.3 不允许
- ❌ "LGTM" 没问题
- ❌ "等下我自己改" 但 1 周没改
- ❌ 强行合并 reviewer 反对的 PR
- ❌ 改 reviewer 期望外的"顺便优化"

## 6. 例外

### 6.1 Hotfix
- 1 个 reviewer 即可（owner 优先）
- 仍需 CI 绿
- PR description 可以简略

### 6.2 文档 / 配置类
- 1 个 reviewer
- 可以省 lint / test 检查（纯文档）

### 6.3 紧急回滚
- 不用 PR，直接 revert
- 事后补 PR 解释

## 7. 工具

- **Reviewer UI**：GitHub PR review
- **本地 diff**：`git diff main..feature/X`
- **历史**：`git log main..feature/X --oneline`
- **影响分析**：`git log --follow <file>` 看历史

## 8. 升级路径

如果 reviewer 与作者僵持：
1. 双方在 PR 评论里讨论
2. 30 分钟无果 → @ owner
3. owner 1 个工作日内决策
4. 决策记录到 `docs/decisions/`

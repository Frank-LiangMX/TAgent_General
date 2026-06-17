# Pull Request

> **2 reviewer required** + all CI green before merge.

## Why

[Explain *why* this change is needed. Not just *what* — *why* this approach.]

## What

[List the changes. File-level + key design decisions.]

## How to Test

[Manual steps / unit tests / screenshots]

## Risks

[Potential risks + how to rollback]

## Screenshots (if UI change)

[Attach or link]

## Related

- Issue: #<n> / "no related issue"
- Design doc: `docs/plans/...` / "no design doc"
- ADR: `docs/decisions/NNNN-...` / "no ADR"

---

## Reviewer Checklist

### 正确性

- [ ] 代码确实解决了 _why_
- [ ] 边界条件覆盖（空输入 / 并发 / Unicode）
- [ ] 错误处理完整
- [ ] 公共 API 行为不变

### 测试

- [ ] 单元测试覆盖新功能
- [ ] 覆盖率 ≥ 80%
- [ ] 集成测试（如果跨模块）

### 设计

- [ ] 符合 `AGENTS.md` §3-5 硬性约束
- [ ] 不违反双模式隔离
- [ ] 不动"绝对边界"

### 代码风格

- [ ] 通过 ruff / eslint / prettier
- [ ] 命名一致
- [ ] 没有重复代码
- [ ] 没有死代码

### 文档

- [ ] CHANGELOG.md 更新
- [ ] 公共 API 改动 → README
- [ ] 架构变更 → ADR

### 安全

- [ ] 不引入 CVE
- [ ] 凭证不写入代码
- [ ] 无注入漏洞

### 性能

- [ ] 无 N+1
- [ ] 无不必要大循环
- [ ] 资源正确释放

---

## Author Checklist

- [ ] PR description 完整
- [ ] 自查过 reviewer checklist
- [ ] 截图（UI 改动）
- [ ] 关联 issue / ADR / design doc
- [ ] 至少 2 个 reviewer requested
- [ ] 所有 CI 检查通过

## Reviewers

<!-- GitHub auto-assigns CODEOWNERS. Manual: @user1 @user2 -->

| Reviewer   | Status       |
| ---------- | ------------ |
| @reviewer1 | ⏳ / ✅ / ❌ |
| @reviewer2 | ⏳ / ✅ / ❌ |

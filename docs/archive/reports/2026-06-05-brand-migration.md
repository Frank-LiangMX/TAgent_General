# Brand Migration Archive（Proma → TAgent）

> **状态**：归档报告  
> **日期**：2026-06-05  
> **合并来源**：
> - `docs/reports/2026-06-05-proma-scope-inventory.md`
> - `docs/reports/2026-06-05-codemod-dryrun-on-copy.md`
> - `docs/reports/2026-06-05-codemod-apply-status.md`

## 结论

TAgent 的品牌迁移已完成，工程包名统一到 `@tagent/*`，产品名统一为 **TAgent**，运行数据目录统一为 `~/.tagent/` / `~/.tagent-dev/`。

## Codemod 前盘点

| 项目 | 数量 |
| ---- | ---- |
| `@proma/*` scope 引用 | 385 个，181 个文件 |
| 裸 `Proma` 字符串 | 185 个，100 个文件 |

主要 scope：

| Scope | 出现次数 |
| ----- | -------- |
| `@proma/shared` | 313 |
| `@proma/core` | 33 |
| `@proma/electron` | 22 |
| `@proma/ui` | 15 |

## Dry-run 摘要

| 指标 | 数值 |
| ---- | ---- |
| 总扫描文件 | 458 |
| 受影响文件 | 197 |
| 总 changes | 593 |

| 规则 | 匹配 | 文件 |
| ---- | ---- | ---- |
| `scope`（`@proma/X` → `@tagent/X`） | 337 | 169 |
| `brand`（裸 `Proma` → `TAgent`） | 190 | 64 |
| `type_prefix`（`PromaXxx` → `TAgentXxx`） | 66 | 17 |

## Apply 摘要

| Pass | 规则 | Changes | Files |
| ---- | ---- | ------- | ----- |
| 1st | scope (`@proma/X` → `@tagent/X`) | 333 | 168 |
| 1st | type_prefix (`PromaXxx` → `TAgentXxx`) | 66 | 17 |
| 1st | brand (`Proma` → `TAgent`) | 190 | 64 |
| 2nd | camel_mid (`xPromaX` → `xTAgentX`) | 48 | 11 |
| 2nd | upper (`PROMA_XXX` → `TAGENT_XXX`) | 32 | 9 |
| **合计** | | **669** | **199** |

## 验证结果

| 检查 | 结果 |
| ---- | ---- |
| 剩余 `PromaXxx` PascalCase | 0 |
| 剩余 `xxxPromaXxx` camelCase mid | 0 |
| 剩余 `@proma/*` scope | 0 |
| 剩余 `PROMA_*` UPPER_CASE | 1（`__PROMA_ENV_START__`，历史记录） |
| 剩余 `proma-file://` lower-case protocol | 后续已迁移为 `tagent-file://` |

## 关键约束

- 不动 lockfile 文本，由包管理器重新生成。
- 不动 `release-notes/` 与 git history。
- 不动 `node_modules/` / `.git/` / build 输出目录。

## 相关提交

```text
1fdebc1 feat: apply Proma → TAgent codemod (2 passes, 669 total changes)
c8e3ca2 feat: bring in official Proma source (uncopied) for renaming
91eac90 docs(report): codemod dry-run on F:\Proma COPY
456f327 feat(scripts): add codemod for Proma → TAgent brand replacement
9b5d77b docs(report): Proma scope + brand inventory before codemod
```

## 归档说明

原三份报告已经合并为本文件。后续如需追溯迁移风险、规则或统计，以本归档为入口。

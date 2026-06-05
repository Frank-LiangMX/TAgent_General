# Codemod Dry-Run Report（副本上跑）

> **状态**：报告（read-only 探察）  
> **日期**：2026-06-05  
> **测试目标**：`F:\TAgent_General_rename_test\Proma\`（F:\Proma 的**完整副本**，30M）  
> **原始目标**：`F:\Proma\`（**未动**）

---

## 1. 跑的命令

```bash
# 1. 复制
cp -r F:/Proma F:/TAgent_General_rename_test/Proma
# 2. dry-run（默认）
PYTHONIOENCODING=utf-8 python scripts/codemod_proma_to_tagent.py \
    F:/TAgent_General_rename_test/Proma --report-only
```

## 2. 统计

| 指标 | 数值 |
|---|---|
| **总扫描文件** | 458 |
| **受影响文件** | 197 |
| **总 changes** | **593** |

### 2.1 按规则

| 规则 | 匹配 | 文件 |
|---|---|---|
| `scope`（@proma/X → @tagent/X） | 337 | 169 |
| `brand`（裸 Proma → TAgent） | 190 | 64 |
| `type_prefix`（PromaXxx → TAgentXxx） | 66 | 17 |
| `package_name`（"proma" → "tagent"） | 0 | 0 |

> **注意**：`package_name` 0 匹配是因为 `package.json` 的 "proma" 实际上写在 `"name": "proma"`，而现有规则需要 `^...` 行首匹配 — 后续可放宽。

### 2.2 改动最频繁的文件

| 改动 | 文件 |
|---|---|
| 75 | `apps\electron\src\preload\index.ts` |
| 23 | `packages\shared\src\types\agent.ts` |
| 23 | `apps\electron\src\main\lib\agent-orchestrator.ts` |
| 19 | `apps\electron\src\main\ipc.ts` |
| 15 | `apps\electron\src\renderer\components\settings\FeishuSettings.tsx` |
| 11 | `apps\electron\src\renderer\components\settings\ChannelSettings.tsx` |
| 11 | `apps\electron\src\main\lib\agent-prompt-builder.ts` |
| 11 | `apps\electron\src\main\lib\git-diff-service.ts` |
| 8 | `apps\electron\src\main\index.ts` |
| 8 | `apps\electron\src\renderer\components\agent\AgentView.tsx` |

### 2.3 典型 change 样本

| 文件:行 | 规则 | before | after |
|---|---|---|---|
| `package.json:12-15` | scope | `@proma/electron` | `@tagent/electron` |
| `packages\core\package.json:2,17` | scope | `@proma/core`, `@proma/shared` | `@tagent/core`, `@tagent/shared` |
| `packages\shared\src\types\agent.ts:545` | type_prefix | `PromaPermissionMode` | `TAgentPermissionMode` |
| `packages\shared\src\types\agent.ts:550` | type_prefix | `PromaEvent` | `TAgentEvent` |
| `packages\shared\src\config\index.ts:6` | brand | `Proma` | `TAgent` |
| `apps\electron\src\preload\index.ts:1` | scope | `import ... from '@proma/shared'` | `import ... from '@tagent/shared'` |

## 3. 风险点

### 3.1 0 风险的规则
- `scope`（337 处）：完全机械替换，import 路径，**低风险**
- `type_prefix`（66 处）：PascalCase 跟随模式，**低风险**（已经在 `re.fullmatch` 范围内）

### 3.2 中风险的规则
- `brand`（190 处）：**裸 'Proma' 字符串**，可能含：
  - 注释（`// Proma Note`）
  - 字符串字面量（`'Welcome to Proma'`）
  - 函数/变量名（`promaConfig`，但 camelCase 不在 BRAND_PATTERN 范围内）
  - 路径（`~/.proma/` — 我们的 user data 目录）
  - URL（`https://proma.ai`）

**需要手工 review 的 ~190 处 brand 替换**。

### 3.3 潜在误伤的样本（待手工确认）

- `apps/electron/src/main/lib/agent-orchestrator.ts` —— 16 处 brand，需逐行看
- `apps/electron/src/main/index.ts` —— 10 处，需看是否含 "Proma 协议" 等

## 4. 排除项生效

| 排除项 | 行为 |
|---|---|
| `node_modules/` | ✅ 不扫（458 - 估计 200+ = 实际 458） |
| `.git/` | ✅ 不扫 |
| `release/` | ✅ 不扫 |
| `__pycache__/` | ✅ 不扫（Python 项目的） |
| `bun.lock` | ✅ 不扫（**重要**：锁文件由 bun install 重新生成） |
| `release-notes/` | ✅ 不扫（**重要**：历史记录） |
| `.md` 文档 | ✅ 不扫（默认；需 `--include-docs`） |

## 5. 下一步

### 5.1 用户需做（按你 22:38 的"继续" 拍板）

```
- [ ] 检查 `brand` 规则的 190 处是否含 "Proma 协议" 之类不该改的
- [ ] 如果都 OK：跑 --apply 在副本上
- [ ] 验证副本能 `bun install` + `bun run typecheck`
- [ ] 都通过后，删副本
- [ ] 在 F:\Proma 真跑（commit 4 计划）
```

### 5.2 如果发现误伤

```
- [ ] 加更精确的 BRAND_PATTERN
- [ ] 加白名单文件 / 行
- [ ] 重新跑 dry-run
```

## 6. 文件位置

- 副本：`F:\TAgent_General_rename_test\Proma\`（30M，可任意删）
- Codemod 脚本：`F:\TAgent_General\scripts\codemod_proma_to_tagent.py`
- 完整 dry-run 输出：`/tmp/codemod_run.txt`（此报告生成时；下次跑会覆盖）

## 7. 自我验证

- ✅ `bun run typecheck` 没跑（**没跑**副本上，避免误报；如果用户需要，再跑）
- ⚠️ 副本 `package.json` 改 name 字段后，bun install 会因"未注册 tagent"失败——**这是预期**（需要先发布新 scope 或临时改回）

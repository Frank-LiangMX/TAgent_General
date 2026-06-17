# Codemod Apply Status (2026-06-05)

## 摘要

F:\TAgent_General 现在是改名后的工程。**669 个 changes, 199 文件。**

## 变更统计

| Pass     | 规则                                   | Changes | Files   |
| -------- | -------------------------------------- | ------- | ------- |
| 1st      | scope (`@proma/X` → `@tagent/X`)       | 333     | 168     |
| 1st      | type_prefix (`PromaXxx` → `TAgentXxx`) | 66      | 17      |
| 1st      | brand (`Proma` → `TAgent`)             | 190     | 64      |
| 2nd      | camel_mid (`xPromaX` → `xTAgentX`)     | 48      | 11      |
| 2nd      | upper (`PROMA_XXX` → `TAGENT_XXX`)     | 32      | 9       |
| **合计** |                                        | **669** | **199** |

## 验证结果（应用后）

| 检查                             | 结果                                |
| -------------------------------- | ----------------------------------- |
| 剩余 `PromaXxx` PascalCase       | **0**                               |
| 剩余 `xxxPromaXxx` camelCase mid | **0**                               |
| 剩余 `@proma/*` scope            | **0**                               |
| 剩余 `PROMA_*` UPPER_CASE        | **1**（`__PROMA_ENV_START__` 单点） |
| 剩余 `proma-file://` (lowercase) | **10**（OS 协议名，需用户单独决定） |

## 之前发现的不一致已修复

**之前**（commit 1fdebc1 之前）：

```typescript
export function isTAgentPermissionMode(mode: string): mode is PromaPermissionMode {
  //                          ^^^^^ TAgent                 ^^^^^ Proma (不一致!)
```

**现在**：

```typescript
export function isTAgentPermissionMode(mode: string): mode is TAgentPermissionMode {
  return (TAGENT_PERMISSION_MODES as readonly string[]).includes(mode)
}
```

## 残留问题（用户决策）

### 1. `__PROMA_ENV_START__` 单点

- 位置：`apps/electron/src/main/lib/shell-env.ts:90`
- 原因：双下划线 `__` 让 `\b` 边界失效，codemod 错过
- 影响：内部 shell marker，运行时无影响
- 处理：可手动改，或加 codemod 规则（双下划线 + UPPER_CASE）

### 2. `proma-file://` OS 协议（10 处，5 个文件）

- 位置：
  - `apps/electron/src/main/index.ts:31,33,417,419`
  - `apps/electron/src/main/lib/file-preview-service.ts:547,553`
  - `apps/electron/src/main/lib/local-file-protocol.ts:4,65`
  - `apps/electron/src/main/lib/screenshot-service.ts:185`
  - `apps/electron/src/renderer/components/diff/markdown-preview-extensions.tsx:352,397`
  - `packages/shared/src/types/runtime.ts:212`
- 原因：是 **OS 注册的协议名**（`protocol.handle('proma-file', ...)`），不是普通字符串
- 影响：可改也可不改。改了 OS 协议需要同步：
  1. 协议注册点（`protocol.handle`）
  2. 所有使用点（URL 生成、CSP、注释）
  3. 用户已保存数据中的 `proma-file://` 引用（**会断**）
- 处理：**用户决策**。MVP 阶段建议保持 `proma-file://`（稳定），M2+ 改名时一次性切换。

## git 历史

```
1fdebc1 feat: apply Proma → TAgent codemod (2 passes, 669 total changes)
c8e3ca2 feat: bring in official Proma source (uncopied) for renaming
91eac90 docs(report): codemod dry-run on F:\Proma COPY
456f327 feat(scripts): add codemod for Proma → TAgent brand replacement
9b5d77b docs(report): Proma scope + brand inventory before codemod
295b696 docs(design): add 5 missed findings from ta_agent second-pass review
05e63c0 docs(design): add subagent pitfalls from prior ta_agent implementation
a1658ed docs(design): resolve 6 open questions in fusion design
9776418 chore: initial project governance scaffolding
```

## F:\Proma 状态

- **未动**。本次所有操作在 F:\TAgent_General\ 副本上。
- 如需丢弃 F:\TAgent_General\ 重来：`rm -rf F:\TAgent_General` 即可。
- F:\Proma\ 仍是独立可用仓库。

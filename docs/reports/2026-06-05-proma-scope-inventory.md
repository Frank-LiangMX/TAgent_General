# Proma 仓库改造范围清单（codemod 前必读）

> **状态**：报告（read-only 探察结果）  
> **日期**：2026-06-05  
> **目的**：为品牌替换 codemod 提供精确的范围数据  
> **生成方式**：`Grep` + `grep -c` + `sort | uniq -c | sort -rn`（零代码改动）

---

## 1. `@proma/*` Scope 使用量

**总计**：**385 个引用**，分布在 **181 个文件**中

| Scope                 | 出现次数 | 备注                           |
| --------------------- | -------- | ------------------------------ |
| `@proma/shared`       | 313      | **最常用**，所有包的类型源头   |
| `@proma/core`         | 33       | Provider Adapter / 高亮 / 类型 |
| `@proma/electron`     | 22       | Electron 主进程 API            |
| `@proma/ui`           | 15       | 共享 React 组件                |
| `@proma/electron-dev` | 2        | 仅 dev 环境用                  |

### 1.1 各包名（package.json 的 `name` 字段）现状

| 包                | 当前 name         | 改名目标           |
| ----------------- | ----------------- | ------------------ |
| 根 package.json   | `proma`           | `tagent`           |
| `packages/shared` | `@proma/shared`   | `@tagent/shared`   |
| `packages/core`   | `@proma/core`     | `@tagent/core`     |
| `packages/ui`     | `@proma/ui`       | `@tagent/ui`       |
| `apps/electron`   | `@proma/electron` | `@tagent/electron` |

### 1.2 需 codemod 改动的文件类型

| 文件类型                            | 数量（估算） | 改动内容                     |
| ----------------------------------- | ------------ | ---------------------------- |
| `*.ts` / `*.tsx`                    | ~150         | import 路径 + 类型前缀       |
| `package.json`                      | 5            | name 字段                    |
| `bun.lock`                          | 1            | 锁文件里所有 `@proma/*` 条目 |
| `tsconfig.json` / `tsconfig.*.json` | ~5           | paths 字段（如果用）         |
| `CLAUDE.md` / `AGENTS.md`           | 2            | 工程描述                     |
| README\*                            | 2-3          | 项目名 / 描述                |

---

## 2. 品牌字符串 "Proma" 使用量

**总计**：**185 个字符串**，分布在 **100 个文件**中

### 2.1 出现频率最高的"派生名"

| 形式                | 数量 | 含义       |
| ------------------- | ---- | ---------- |
| `Proma`（独立词）   | 184  | 主要品牌名 |
| `PromaLogo`         | 1    | 组件名     |
| `PromaLogoSettings` | 1    | 设置项     |

### 2.2 出现最频繁的文件（按 count）

| 文件                                                          | Proma 出现次数 | 类型               |
| ------------------------------------------------------------- | -------------- | ------------------ |
| `apps/electron/src/main/lib/agent-orchestrator.ts`            | 16             | 核心 agent 编排    |
| `apps/electron/src/main/index.ts`                             | 10             | 主进程入口         |
| `apps/electron/src/main/ipc.ts`                               | 9              | IPC 桥             |
| `apps/electron/src/main/lib/agent-prompt-builder.ts`          | 9              | system prompt 构建 |
| `apps/electron/src/main/lib/agent-session-manager.ts`         | 7              | session 管理       |
| `apps/electron/src/main/lib/channel-manager.ts`               | 6              | 渠道管理           |
| `apps/electron/src/main/lib/chat-service.ts`                  | 6              | 聊天服务           |
| `apps/electron/src/main/lib/adapters/claude-agent-adapter.ts` | 4              | Claude SDK 适配    |
| `apps/electron/src/main/lib/agent-exit-plan-service.ts`       | 4              | ExitPlan 模式      |
| `apps/electron/src/main/lib/git-diff-service.ts`              | 11             | git diff 服务      |
| `apps/electron/src/main/lib/agent-permission-service.ts`      | 1              | 权限服务           |
| `apps/electron/src/main/lib/bridge-command-handler.ts`        | 3              | bridge 命令处理    |

### 2.3 需特别关注的"硬品牌"位置

- `apps/electron/src/main/index.ts:10` — 主进程入口，含窗口名 / 产品名
- `package.json:4` — 根 name = "proma"
- `README.md:5` + `README.en.md:5` — 双语 README
- `AGENTS.md:10` + `CLAUDE.md:10` — agent 上下文
- `bun.lock:14` — bun 锁文件（需特殊处理）
- `release-notes/*.md` — 20+ 个发布说明（**建议不动历史记录**）
- `electron-builder.yml` — 打包配置（`productName` 字段）
- `TAgent.spec` — **不存在**，可能是 ta_agent 自己的
- 各 `package.json` 的 `description` / `author` 字段

---

## 3. 风险点

### 3.1 ⚠️ 高风险

- **`bun.lock`**：Bun 锁文件含所有 `@proma/*` 包的 URL 路径。codemod 后必须 `bun install` 重新生成，**不能直接文本替换**。
- **`apps/electron/package-lock.json` / 嵌套 lock**：同上，npm 锁文件。
- **`node_modules/`**：在 `.gitignore` 中，codemod 不应动。
- **commit history**：含旧 commit 的 brand 字样，**不重写历史**（仓库通常不允许）。

### 3.2 ⚠️ 中风险

- **GitHub Actions workflows**：CI 脚本可能 hardcode `proma` 字样。
- **electron-builder 配置**：`productName` / `appId` / `artifactName`。
- **测试文件**：`.test.ts` / `test_*.py` 文件可能含 brand assertion。
- **类型导出链**：`export * from '@proma/shared'` 全替换。
- **JSDoc 注释**：`/** @see {@link proma} */` 之类。
- **JSON config**：`tsconfig.json` 的 `compilerOptions.paths`。
- **Markdown 文件**：文档里的 `proma` 不影响功能但破坏一致性。

### 3.3 ✅ 低风险

- `apps/electron/scripts/dist.ts` 等纯打包脚本
- 测试 fixtures

---

## 4. 推荐的 codemod 策略

### 4.1 用工具：jscodeshift（TypeScript/JavaScript）

```bash
# 安装
bun add -d jscodeshift @types/jscodeshift

# 写 codemod 脚本（scripts/codemod-proma-to-tagent.ts）
#   - scope 替换：@proma/X → @tagent/X
#   - 类型前缀：PromaX → TAgentX
#   - package.json name 字段
#   - bun.lock 让 bun install 重新生成
#   - .md / .ts 文件里裸 "Proma" 字符串谨慎替换
```

### 4.2 阶段（4 个 commit，与设计文档 §10 对齐）

| commit | 内容                                                                  | 风险   | 影响             |
| ------ | --------------------------------------------------------------------- | ------ | ---------------- |
| 1      | 仅本报告（read-only 探察）                                            | 零     | 仅 docs/ 新增    |
| 2      | 写 codemod.py 脚本，**不跑**                                          | 零     | 仅 scripts/ 新增 |
| 3      | 复制 F:\Proma → F:\TAgent_General_rename_test\，跑 codemod，typecheck | 中     | 副本可删         |
| 4      | 真在 F:\Proma 上跑 codemod，commit                                    | **高** | 改源文件         |

### 4.3 验收标准

- ✅ `bun run typecheck` 通过
- ✅ `bun run lint` 通过
- ✅ `grep -r "Proma" F:\Proma --include="*.ts" --include="*.tsx"` **0 命中**（除注释 + 历史 release-notes）
- ✅ `grep -r "@proma/" F:\Proma --include="*.ts" --include="*.tsx"` **0 命中**
- ✅ `grep "proma" F:\Proma\package.json` 名字字段为 `tagent`
- ✅ 所有 app 能 `bun install && bun run dev` 启动
- ✅ 现有测试通过

---

## 5. 估算工作量

- 写 codemod 脚本：1 天
- 测试 + 修正：1 天
- 真跑 + 验证 + 修遗漏：1 天
- **小计**：3 天

（前提：1 人在 F:\Proma 上专注。多人 PR review 流程会加 1-2 天）

---

## 6. 排除项

- ❌ **不动 `release-notes/`**：历史记录保留品牌（不能改写历史）
- ❌ **不动 `bun.lock` 文本**：让 `bun install` 重新生成
- ❌ **不动 commit history**
- ❌ **不改 `apps/electron/src/main/lib/agent-orchestrator.ts:7` 等单点 Proma 字符串**：需手工 review（避免误改"Proma 协议"之类不该改的）

---

## 7. 文件位置

- 本报告：`docs/reports/2026-06-05-proma-scope-inventory.md`
- 数据来源：`F:\Proma\`（v0.10.25）
- 生成时间：2026-06-05 22:19
- 工具：`Grep` + `grep -c` + `bash grep | uniq -c | sort -rn`

---

## 8. 后续报告（待 codemod 阶段生成）

- `2026-06-XX-proma-codemod-design.md` — codemod 脚本设计
- `2026-06-XX-proma-codemod-run-report.md` — 跑完后的"漏网之鱼"清单
- `2026-06-XX-ta-agent-mcp-server-design.md` — P0-2 任务的设计
- `2026-06-XX-pyi-bundle-design.md` — PyInstaller 打包设计

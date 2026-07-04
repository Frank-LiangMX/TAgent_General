# 通用检查钩子 auto-check 设计

> **状态**：已完成 + 语言级精细配置 + UI
> **日期**：2026-06-30
> **背景**：auto-typecheck MVP 已跑通，但只支持 TS 项目。扩展到所有 vibe coding 场景

## 语言级精细配置（2026-06-30 已实现）

每语言可单独配置：
- **enabled**：启用/禁用该语言的检查（TS/JS/Python/Rust/Go/Lua 默认开，C++/Java 默认关）
- **timeoutSec**：检查命令超时（默认 TS/JS/Python/Go/Lua=60s，Rust=120s，C++/Java=180s，可自定义 10-600s）

### 数据结构

```typescript
interface LanguageHookConfig {
  enabled?: boolean
  timeoutSec?: number
}

interface HooksConfig {
  autoCheck?: boolean
  languages?: Partial<Record<AutoCheckLanguage, LanguageHookConfig>>
  autoTypecheck?: boolean  // deprecated 兼容
}
```

### hook 读取配置

`buildPostToolUseHooks(languagesConfig)` 接受用户配置，通过 `resolveLanguageConfig` 合并默认值。每语言单独判断 enabled，超时按配置覆盖。

### UI

`AgentBehaviorSettings.tsx` 加可展开的"按语言精细配置"区（Collapsible）：
- 8 种语言一行展示：名称 + 检测说明 + 超时输入框 + 启用开关
- 自定义过的语言显示"已自定义"标记
- C++/Java 行说明标注"编译慢，默认关"

### 验证

逻辑测试 8 个场景全通过：
1. TS 项目触发 ✅
2. 非代码文件跳过 ✅
3. Python 项目触发 ✅
4. C++ 默认跳过 ✅
5. 无项目配置跳过 ✅
6. 非 PostToolUse 早返回 ✅
7. **用户配置关闭 TS 后不触发** ✅
8. **用户启用 C++ 但无构建文件时智能跳过** ✅
> **关联**：`docs/plans/2026-06-29-agent-hooks-design.md`（hook 机制 MVP）

## 1. 痛点

auto-typecheck MVP 写死了 `bun run typecheck`，只对 TS 项目生效。TAgent 用户群体不止 TS 开发者（TA 模式可能写 Python / Blender / Lua），auto-typecheck 对他们完全无效——这就违背了"通用 vibe coding 增强"的初衷。

## 2. Claude Code 官方做法

调研 Claude Code 官方 hooks 文档（https://code.claude.com/docs/en/hooks）：

- **机制层语言无关**：hooks 跑任意 shell 命令，工具由用户配
- **官方示例覆盖**：bash / Python / Node.js / jq
- **PostToolUse 典型用例**：lint 检查、代码格式化、安全扫描、样式检查
- **没有语言专门支持**：因为本质是执行任意命令

Claude Code 是"机制通用 + 配置层用户自配"——灵活但要用户懂写 shell 命令。

## 3. TAgent 方案：智能识别 + 零配置

**核心设计**：保留 JS 回调机制（安全、零 shell 风险），但 hook 内部按项目配置文件**智能识别语言**并跑对应检查命令。用户不用配任何东西，开箱即用。

### 3.1 语言识别 + 命令映射

| 语言/环境 | 检测文件 | 跑的命令 | 超时 |
|----------|---------|---------|------|
| TypeScript | tsconfig.json | `bun run typecheck`（若有脚本）或 `tsc --noEmit` | 60s |
| JavaScript | package.json（无 tsconfig） | `npm run lint` 或 `eslint .` | 60s |
| Python | pyproject.toml / setup.py / requirements.txt | `ruff check .`（优先）或 `mypy .` | 60s |
| Rust | Cargo.toml | `cargo check` | 120s |
| Go | go.mod | `go vet ./...` | 60s |
| Lua | .luacheckrc | `luacheck .` | 60s |
| C/C++ | CMakeLists.txt / Makefile | **默认跳过**（编译慢，可能卡死 Agent） | - |
| Java | pom.xml / build.gradle | **默认跳过**（编译慢） | - |
| 普通（无识别） | - | 智能跳过 | - |

**设计原则**：
- 优先用项目自己配的脚本（`scripts.typecheck` / `scripts.check` / `scripts.lint`）——尊重项目约定
- 没有脚本时用语言标准工具（tsc / ruff / cargo check）
- 编译型慢语言（C++/Java）默认跳过，避免卡 Agent 流程

### 3.2 文件后缀过滤

只对代码文件触发，非代码文件（文档/资源）跳过：

```
.ts .tsx .mts .cts       → TypeScript
.js .jsx .mjs .cjs        → JavaScript
.py                       → Python
.rs                       → Rust
.go                       → Go
.lua                      → Lua
.cpp .cc .cxx .c .h .hpp  → C/C++（识别但默认跳过检查）
.java                     → Java（识别但默认跳过检查）
```

### 3.3 命令查找优先级

对单个文件，按以下顺序找检查命令：

1. **项目自定义脚本**：从文件路径向上找最近的 `package.json` / `pyproject.toml` 等，看 `scripts` 字段
   - 有 `typecheck` → 跑 `bun run typecheck` / `npm run typecheck`
   - 否则 `check` → 跑对应
   - 否则 `lint` → 跑对应
2. **语言标准工具**：没自定义脚本时用标准命令（tsc / ruff / cargo check / go vet）
3. **找不到**：跳过，hook 不触发

## 4. 改动清单

### 4.1 重命名

| 旧 | 新 |
|----|----|
| `auto-typecheck` | `auto-check` |
| `autoTypecheck`（settings 字段） | `autoCheck` |
| `buildPostToolUseHooks` | 不变（函数名保留） |
| `HOOK_AUTO_VERIFICATION_RULES` | 不变（常量名保留，内容改通用） |

### 4.2 文件改动

| 文件 | 改动 |
|------|------|
| `apps/electron/src/main/lib/hooks/post-tool-use.ts` | 重写 hook 实现：语言识别 + 命令查找优先级 |
| `apps/electron/src/main/lib/agent-prompt-builder.ts` | 改 HOOK_AUTO_VERIFICATION_RULES 文案：类型错误 → 检查错误 |
| `apps/electron/src/types/settings.ts` | `HooksConfig.autoTypecheck` → `autoCheck` |
| `apps/electron/src/main/lib/agent-orchestrator.ts` | `appSettings.hooks?.autoTypecheck` → `autoCheck` |
| `apps/electron/src/renderer/components/settings/GeneralSettings.tsx` | UI 文案改通用 |
| `packages/shared/src/types/agent.ts` | `HooksConfig.autoTypecheck` → `autoCheck` |
| `scripts/test-hooks-logic.ts` | 测试改成多语言场景 |
| `scripts/hook-demo/` | 补 Python / Rust 等多语言 demo（可选） |

### 4.3 兼容性

旧 settings.json 里 `hooks.autoTypecheck` 字段：迁移逻辑读 `autoCheck` 优先，回落 `autoTypecheck`（向后兼容），读完写回 `autoCheck`。

## 5. 实现步骤

1. 重写 `post-tool-use.ts`：加语言识别 + 命令查找 + 多命令执行
2. 改 types + orchestrator + UI（字段重命名）
3. 改 prompt 文案
4. 改逻辑测试覆盖多语言场景
5. 真 SDK 验证（用 TS demo + 可选 Python demo）
6. 应用内实测

## 6. 风险

| 风险 | 缓解 |
|------|------|
| 不同语言工具未安装（ruff/cargo 不在 PATH） | 命令执行失败时回灌"工具未安装"提示，不阻塞 |
| 检查命令输出格式差异大 | 统一截断 + 标准化前缀 |
| 编译型语言卡死 | 默认跳过 C++/Java |
| 旧配置兼容 | 读取时回落 autoTypecheck |

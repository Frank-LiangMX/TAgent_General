# 代码风格与自动检查

> TAgent **用自动化工具强制代码风格**。Pre-commit hooks + CI 双重检查。

## 1. 总览

| 语言       | 格式化        | Lint         | 类型检查        |
| ---------- | ------------- | ------------ | --------------- |
| Python     | `ruff format` | `ruff check` | `mypy --strict` |
| TypeScript | `prettier`    | `eslint`     | `tsc --noEmit`  |
| Markdown   | `prettier`    | —            | —               |
| YAML       | `prettier`    | —            | —               |

## 2. Python (ta_agent + TAgent Server)

### 2.1 ruff（替代 black + flake8 + isort）

- **速度**：Rust 实现，10-100x 比 flake8
- **覆盖面**：PEP 8 + import 排序 + 安全 + 复杂度

```bash
# 格式化
ruff format src/

# 检查 + 自动修复
ruff check --fix src/

# 仅检查
ruff check src/
```

### 2.2 mypy（类型检查）

- **必须通过** `--strict` 模式
- 公共 API 必须有完整 type hints
- 测试代码可以 `Any` 容忍

```bash
mypy --strict src/
```

### 2.3 pyproject.toml 配置示例

```toml
[tool.ruff]
line-length = 100
target-version = "py311"

[tool.ruff.lint]
select = [
  "E",   # pycodestyle errors
  "W",   # pycodestyle warnings
  "F",   # pyflakes
  "I",   # isort
  "B",   # flake8-bugbear
  "C4",  # flake8-comprehensions
  "UP",  # pyupgrade
  "N",   # pep8-naming
  "S",   # flake8-bandit (security)
  "T",   # flake8-print
]
ignore = [
  "S101",  # Use of `assert` (OK in tests)
]

[tool.ruff.lint.per-file-ignores]
"tests/*" = ["S101", "S106"]
"**/tests/*" = ["S101"]

[tool.mypy]
python_version = "3.11"
strict = true
warn_unreachable = true
warn_unused_ignores = true
disallow_untyped_defs = true
```

### 2.4 命名

- 模块：`snake_case.py`
- 类：`PascalCase`
- 函数 / 变量：`snake_case`
- 常量：`UPPER_SNAKE_CASE`
- 私有：`_leading_underscore`

### 2.5 注释 / Docstring

- Google 风格 docstring
- 行内注释解释 _为什么_（不是 _什么_）
- 复杂逻辑必须有 # reason 注释

## 3. TypeScript (TAgent Desktop)

### 3.1 Prettier（格式化）

- 配置文件：`.prettierrc.json`
- 不允许任何分歧（统一风格）

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always"
}
```

### 3.2 ESLint（lint）

- 用 `@typescript-eslint`
- 配置文件：`.eslintrc.cjs`

```js
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/react-in-jsx-scope': 'off',
  },
}
```

### 3.3 tsc（类型检查）

- **必须 0 error**
- 推荐 `strict: true`

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "skipLibCheck": true
  }
}
```

### 3.4 命名

- 类 / 组件 / 类型：`PascalCase`
- 函数 / 变量：`camelCase`
- 常量：`UPPER_SNAKE_CASE`
- 私有（文件内）：`_leadingUnderscore`
- 组件文件名：`PascalCase.tsx`

## 4. Markdown / YAML

- 用 `prettier` 格式化
- 不允许手动加空格对齐（prettier 会重排）
- 中英文之间加空格（prettier 不自动加，建议手写）

## 5. Pre-commit Hooks

`.pre-commit-config.yaml`：

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.4.4
    hooks:
      - id: ruff
        args: [--fix, --exit-non-zero-on-fix]
      - id: ruff-format

  - repo: https://github.com/pre-commit/mirrors-prettier
    rev: v3.3.2
    hooks:
      - id: prettier
        types_or: [markdown, yaml, json, ts, tsx, js, jsx]
        exclude: '^(node_modules|release|dist|out)/'

  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v9.9.0
    hooks:
      - id: eslint
        files: \.(ts|tsx|js|jsx)$
        types: [file]
        additional_dependencies:
          - eslint@9.9.0
          - '@typescript-eslint/parser@8.0.0'
          - '@typescript-eslint/eslint-plugin@8.0.0'

  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: check-yaml
      - id: check-json
      - id: check-merge-conflict
      - id: check-case-conflict
      - id: check-added-large-files
        args: [--maxkb=1000]
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: detect-private-key
```

### 5.1 安装

```bash
pip install pre-commit
pre-commit install
```

### 5.2 手动跑

```bash
pre-commit run --all-files    # 全量
pre-commit run                # 已 staged
```

### 5.3 跳过 hooks（紧急）

```bash
git commit --no-verify -m "emergency fix"
```

**仅在紧急时**用，正常情况必跑。

## 6. CI 检查

CI 跑相同检查（与 pre-commit 一致），失败 = 不可 merge。

```yaml
# .github/workflows/ci.yml
- name: Lint Python
  run: |
    pip install ruff mypy
    ruff check src/
    ruff format --check src/
    mypy --strict src/

- name: Lint TypeScript
  run: |
    bun install
    bun run lint
    bun run typecheck
```

## 7. 不允许的代码

### 7.1 Python

- ❌ `print()` 调试（用 `logger.debug()`）
- ❌ `except: pass`（lint 会失败）
- ❌ `assert` 在生产代码（用 `if not: raise`）
- ❌ `# type: ignore` 不带 reason
- ❌ 全局可变状态（除非是常量）

### 7.2 TypeScript

- ❌ `any`（用 `unknown` + narrowing）
- ❌ `console.log` 调试（用真 logger）
- ❌ `// @ts-ignore` 不带 reason
- ❌ 同步长操作（用 async）
- ❌ 直接 mutate props / state

## 8. 重构 vs 格式

- 格式改动（空格 / import 排序）→ 用工具一键修
- 重构（行为不变）→ 单独 PR，标 `refactor`
- 不要在 feature PR 里"顺便重构"

## 9. 工具版本

- 工具版本在 `pyproject.toml` / `package.json` 锁住
- 升级工具版本 → 单独 PR，标 `chore(deps)`
- 团队 CI 用同一版本

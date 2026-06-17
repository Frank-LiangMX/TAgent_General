# 测试标准

> TAgent 测试门槛：**80% 覆盖率强制**。

## 1. 总体原则

- **任何 PR 必含测试**（除非纯文档 / 纯配置）
- **整体覆盖率 ≥ 80%**
- **核心逻辑 100% 覆盖**：Provider Adapter / 同步协议 / 5 层 Memory / 鉴权
- **关键路径有集成测试**（不只单元测试）

## 2. Python (ta_agent + TAgent Server)

### 2.1 框架

- `pytest` + `pytest-asyncio`（async 测试）
- `pytest-cov`（覆盖率）

### 2.2 文件结构

```
src/
  foo/
    __init__.py
    bar.py
    tests/
      test_bar.py
      conftest.py       (可选 fixtures)
```

或（按项目规模）：

```
tests/
  unit/
    test_foo.py
  integration/
    test_sync.py
  e2e/
    test_workflow.py
```

### 2.3 覆盖率门槛

- `pyproject.toml` 配置：

```toml
[tool.coverage.run]
source = ["src"]
omit = ["*/tests/*", "*/__pycache__/*"]

[tool.coverage.report]
fail_under = 80
exclude_lines = [
  "pragma: no cover",
  "if __name__ == .__main__.:",
  "raise NotImplementedError",
]
```

### 2.4 跑测试

```bash
# 全量
pytest

# 覆盖率
pytest --cov=src --cov-report=term-missing

# 单个测试
pytest tests/test_foo.py::test_bar

# watch 模式
ptw   # pytest-watch
```

### 2.5 命名约定

- 测试文件：`test_<module>.py`
- 测试函数：`test_<behavior>`（用 behavior 不是 method）
  - ✅ `test_analyze_assets_returns_tagged_results`
  - ❌ `test_analyze_assets`

### 2.6 fixture 使用

- 共享 fixture 放 `conftest.py`
- 避免过度 mocking（测真实现优先）
- Mock 边界：HTTP / 文件 I/O / 外部服务

## 3. TypeScript (TAgent Desktop)

### 3.1 框架

- `vitest`（推荐，Vite 生态一致）
- 或 `jest`（如已存在）

### 3.2 文件结构

- 单元测试：`Component.test.tsx` 与被测文件同目录
- 集成测试：`tests/integration/*.test.ts`
- E2E：`tests/e2e/*.test.ts`（用 Playwright）

### 3.3 配置

```ts
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
})
```

### 3.4 跑测试

```bash
bun test              # vitest
bun test:coverage     # + coverage
bun test:watch        # watch 模式
```

### 3.5 React 组件测试

- 用 `@testing-library/react`（不是 enzyme）
- 测**用户行为**不测实现细节
  - ✅ `expect(screen.getByText('Hello')).toBeInTheDocument()`
  - ❌ `expect(component.state.isOpen).toBe(true)`

## 4. 核心逻辑必测清单

这些模块**必须 100% 覆盖**：

### 4.1 Provider Adapter（12 个）

- `packages/core/src/providers/anthropic-adapter.ts` — 消息转换 + SSE 解析
- `packages/core/src/providers/openai-adapter.ts` — 消息转换 + SSE 解析
- `packages/core/src/providers/google-adapter.ts`
- 边界：thinking block signature 回传、tool_call id 拼接、空响应、错误响应

### 4.2 同步协议（TAgent Server）

- `push` 端点：正常 / 冲突 / 版本不匹配 / 软删除
- `pull` 端点：分页 / 增量 / has_more
- 状态机：审核状态合法转换路径

### 4.3 5 层 Memory

- L0 user profile 提取正确性
- L3 corrections 压缩到 L1 rules 的逻辑
- L4 sessions FTS5 索引正确性
- L5 insights 周期 review

### 4.4 鉴权

- 简化版（X-Username）：header 缺失 / 空
- SSO 版（未来）：token 无效 / 过期 / 越权

### 4.5 模式隔离

- Mode switcher：状态切换、互斥锁
- 切模式时数据 / session 保留

## 5. 集成测试

跨模块协作必须有集成测试：

- Provider Adapter + Agent Runner
- MCP Server 启动 + 工具调用
- 模式切换 + 状态保留
- 同步 push + pull 完整流程

## 6. 端到端测试（E2E）

关键用户流程必须有 E2E：

- 开 App → 选 Provider → 发送消息 → 收到回复
- 切到 TA 模式 → 看到资产库 → 搜索资产
- 开 Sync → 登录 → 推本地变更 → 拉远端变更

用 Playwright（已配 MCP server）。

## 7. Mock 策略

### 7.1 必须 mock

- 外部 HTTP 调用（API 端点）
- 文件系统 I/O
- 子进程（Blender / UE5 bridge）
- 时间（用 `freezegun` 或 `vi.useFakeTimers()`）

### 7.2 不要 mock

- 业务逻辑本身
- 数据结构
- 内部函数（用 dependency injection 替代）

## 8. 性能测试

对长跑 / 大数据量操作：

- 1000 个资产的 analyze_assets（时间 < 1 min）
- 10000 条 session 的 FTS5 搜索（< 100ms）
- 100 个工具的 MCP 启动（< 5s）

## 9. CI 集成

```yaml
# .github/workflows/ci.yml
- name: Run Python tests
  run: |
    pip install -e ".[dev]"
    pytest --cov=src --cov-fail-under=80

- name: Run TypeScript tests
  run: |
    bun install
    bun test:coverage
```

CI 失败 = 不可 merge。

## 10. 调试技巧

```bash
# Python
pytest -x                  # 第一次失败就停
pytest -k "test_name"      # 按名字过滤
pytest --pdb               # 失败时进入 debugger
pytest -s                  # 打印 print

# TypeScript
vitest --reporter=verbose
vitest -t "test name"      # 按名字过滤
```

## 11. 不允许的反模式

- ❌ `def test_foo(): assert foo() is None` （测空）
- ❌ 测试里写实现逻辑（应该测已有函数）
- ❌ skip 测试来"过 CI"（应 fix）
- ❌ 改测试代码让它"通过"（应改实现）
- ❌ 100% mock 测出来的"测试"（没价值）

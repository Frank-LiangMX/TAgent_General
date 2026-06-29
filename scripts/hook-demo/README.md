# Hook 演示工作区

这是 auto-typecheck hook 的演示包。

## 怎么跑

### 1. 启动 TAgent

在 TAgent_General 根目录：

```bash
bun run dev
```

### 2. 打开这个目录作为项目工作区

在 TAgent 应用里：
- 左侧栏 → 新建工作区 / 添加项目
- 选择目录：`F:\TAgent_General\scripts\hook-demo`
- 确保设置 → 通用 → "改代码后自动类型检查"开关是**开启**状态（默认开）

### 3. 让 Agent 修复类型错误

在 Agent 对话里发送：

> 帮我修复 hook-demo.ts 里的所有类型错误

### 4. 观察闭环

预期行为：
1. Agent 用 Edit 修复第一个错误
2. **自动**触发 typecheck（你会在 Agent 输出里看到 `[auto-typecheck]` 反馈）
3. 如果还有错误，Agent 继续修
4. 修到 typecheck 通过，Agent 停止

### 验证 hook 生效

- **开关开**：Agent 每次 Edit 后会自动收到 typecheck 反馈，看到 `[auto-typecheck]` 字样
- **开关关**：Agent Edit 后不会收到任何反馈，只靠 Agent 自己判断对错

## 文件说明

- `hook-demo.ts` —— 故意含 4 个类型错误的演示文件
- `package.json` —— 定义 `bun run typecheck` 脚本（hook 调用）
- `tsconfig.json` —— TypeScript 配置

## 故意留的错误

1. `userAge: number = "twenty"` —— string 赋给 number
2. `currentUser: User = { id: 1 }` —— 缺 name 属性
3. `greeting.toUppercase()` —— 方法名大小写错（应是 toUpperCase）
4. `add("1", 2)` —— 参数类型不匹配

修复后 `VALID_CONSTANT` 不应被改动。

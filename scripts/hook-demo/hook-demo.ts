/**
 * hook 演示文件 —— 故意包含类型错误
 *
 * 这是个 demo：让 TAgent Agent 来修这个文件。
 * Agent 每次 Edit 后，auto-typecheck hook 会自动跑 `bun run typecheck`，
 * 把错误回灌给 Agent，Agent 看到 [auto-typecheck] 反馈后会自己修，直到通过。
 *
 * 你可以在 TAgent 里对 Agent 说："帮我修复 hook-demo.ts 里的所有类型错误"
 */

// 错误 1：string 赋给 number
const userAge: number = 20

// 错误 2：缺少必填属性
interface User {
  id: number
  name: string
}
const currentUser: User = { id: 1, name: "TAgent" }

// 错误 3：调用不存在的属性
const greeting = "hello"
const upper = greeting.toUpperCase()

// 错误 4：参数类型不匹配
function add(a: number, b: number): number {
  return a + b
}
const sum = add(1, 2)

// 正确的代码（不应被改）
export const VALID_CONSTANT = 42

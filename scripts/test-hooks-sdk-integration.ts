/**
 * auto-typecheck hook 真实 SDK 集成测试
 *
 * 目标：验证 SDK 在 Agent Edit 文件后是否真调用 PostToolUse hook 回调，
 *      以及 additionalContext 是否真出现在 Agent 后续上下文里。
 *
 * 流程：
 * 1. 从 .env.local 读 suifeng 渠道配置（model, baseUrl, apiKey）
 * 2. 调 @anthropic-ai/claude-agent-sdk 的 query，配置 auto-typecheck hook
 * 3. 让 Agent 用 Write 工具创建一个带类型错误的 .ts 文件
 * 4. 观察：hook 是否触发 + additionalContext 是否回灌 + Agent 是否看到错误
 *
 * 安全：API Key 只从 .env.local 读，不打印；进程退出即销毁
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { HookCallback, HookCallbackMatcher } from '@anthropic-ai/claude-agent-sdk'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'

// ===== 1. 读取凭证：优先环境变量，fallback .env.local =====
const envKey = process.env.SUIFENG_API_KEY
const envModel = process.env.SUIFENG_MODEL
const envBaseUrl = process.env.SUIFENG_BASE_URL

let model: string
let baseUrl: string
let apiKey: string

if (envKey) {
  // 环境变量模式（key 不落盘）
  apiKey = envKey
  model = envModel || 'glm-5.1'
  baseUrl = envBaseUrl || 'https://api.sfkey.cn'
} else {
  // .env.local 模式（格式：model,baseUrl,apiKey）
  const envLocalPath = join(homedir(), '.tagent', 'agent-workspaces', 'tagent-general', '547efd50-6740-4178-979d-0a0f101fcd22', '.env.local')
  if (!existsSync(envLocalPath)) {
    console.error(`[FATAL] 未设置 SUIFENG_API_KEY 环境变量，也找不到 .env.local: ${envLocalPath}`)
    console.error('用法 1: SUIFENG_API_KEY=xxx bun run scripts/test-hooks-sdk-integration.ts')
    console.error('用法 2: 在 .env.local 写 "model,baseUrl,apiKey"')
    process.exit(1)
  }
  const raw = readFileSync(envLocalPath, 'utf-8').trim()
  const parts = raw.split(',').map((s) => s.trim())
  if (parts.length < 3) {
    console.error(`[FATAL] .env.local 格式错误，期望 "model,baseUrl,apiKey"`)
    process.exit(1)
  }
  ;[model, baseUrl, apiKey] = parts
}

if (!apiKey || apiKey.length < 10) {
  console.error('[FATAL] apiKey 为空或过短')
  process.exit(1)
}
console.log(`[配置] model=${model}, baseUrl=${baseUrl}, apiKey=${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`)

// ===== 2. 准备隔离的测试目录 =====
const testCwd = join(tmpdir(), `hooks-sdk-test-${Date.now()}`)
mkdirSync(testCwd, { recursive: true })

// 测试目录要有 package.json + typecheck 脚本，hook 才会跑
writeFileSync(
  join(testCwd, 'package.json'),
  JSON.stringify({
    name: 'hooks-sdk-test',
    private: true,
    scripts: { typecheck: 'tsc --noEmit' },
  }, null, 2)
)
writeFileSync(
  join(testCwd, 'tsconfig.json'),
  JSON.stringify({
    compilerOptions: {
      target: 'esnext',
      module: 'esnext',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
  }, null, 2)
)

const sdkConfigDir = join(tmpdir(), `hooks-sdk-config-${Date.now()}`)
mkdirSync(sdkConfigDir, { recursive: true })

const gitBashPath = 'C:/Program Files/Git/bin/bash.exe'

const sdkEnv: Record<string, string | undefined> = {
  ...process.env,
  ANTHROPIC_API_KEY: apiKey,
  ANTHROPIC_BASE_URL: baseUrl,
  CLAUDE_CONFIG_DIR: sdkConfigDir,
  CLAUDE_CODE_SHELL: gitBashPath,
  CLAUDE_BASH_NO_LOGIN: '1',
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: '1',
  CLAUDE_CODE_ENABLE_TASKS: 'true',
}

// ===== 3. hook 回调（带观测） =====
let hookCallCount = 0
const hookCalls: Array<{ seq: number; tool_name: string; file_path: string }> = []

// 复用 TAgent 的 hook 模块
const { buildPostToolUseHooks } = await import(
  join(process.cwd(), 'apps', 'electron', 'src', 'main', 'lib', 'hooks', 'post-tool-use.ts')
)
const baseHooks = buildPostToolUseHooks()

// 包一层观测回调，记录调用
const observedHooks: Partial<Record<string, HookCallbackMatcher[]>> = {
  PostToolUse: baseHooks.PostToolUse!.map((matcher: HookCallbackMatcher) => ({
    ...matcher,
    hooks: matcher.hooks.map((fn: HookCallback) => {
      const wrapped: HookCallback = async (input, toolUseID, options) => {
        const inputTyped = input as { tool_name: string; tool_input: { file_path?: string } }
        hookCallCount++
        const record = {
          seq: hookCallCount,
          tool_name: inputTyped.tool_name,
          file_path: inputTyped.tool_input?.file_path ?? '(unknown)',
        }
        hookCalls.push(record)
        console.log(`\n[HOOK #${hookCallCount}] PostToolUse 触发`)
        console.log(`  tool_name: ${record.tool_name}`)
        console.log(`  file_path: ${record.file_path}`)
        const result = await fn(input, toolUseID, options)
        const ctx = (result as { hookSpecificOutput?: { additionalContext?: string } })?.hookSpecificOutput?.additionalContext
        if (ctx) {
          console.log(`  additionalContext 回灌 ${ctx.length} 字符`)
          console.log(`  前 200 字符: ${ctx.slice(0, 200)}`)
        } else {
          console.log(`  无 additionalContext（typecheck 通过或未触发）`)
        }
        return result
      }
      return wrapped
    }),
  })),
}

// ===== 4. 启动 query =====
console.log('\n[脚本] 启动 SDK query')
console.log(`  testCwd: ${testCwd}`)
console.log(`  任务: 让 Agent 用 Write 创建一个带类型错误的 ts 文件\n`)

const result = query({
  prompt: `请在当前目录下用 Write 工具创建文件 bad.ts，内容写：const x: number = "not_a_number"
创建后会自动收到检查反馈。如果收到 [auto-check] 错误，请修复 bad.ts 让检查通过，然后告诉我最终结果。`,
  options: {
    model,
    cwd: testCwd,
    permissionMode: 'bypassPermissions',
    env: sdkEnv,
    hooks: observedHooks,
    systemPrompt: `You are a coding agent. Use Chinese to reply.

## 工具后自动验证（PostToolUse hook）

系统已在 Write/Edit/MultiEdit 工具执行后自动运行检查命令（typecheck / lint 等）。

**关键规则：**

- 当你在工具执行后收到 \`[auto-check]\` 开头的回灌内容，**必须立即修复其中列出的所有检查错误**，再次编辑文件后系统会自动重新验证
- 不要把回灌当成"信息性提示"忽略——它是工具执行的硬性反馈，等价于你亲手跑检查命令看到的报错
- 修复后若仍收到 \`[auto-check]\` 回灌，继续修复，直到不再收到（表示已通过）
- 同一文件连续修复 3 次仍有错误时，系统会停止自动验证；此时向用户说明剩余问题`,
  },
})

let msgCount = 0
let sawAdditionalContextInStream = false
const assistantTexts: string[] = []

try {
  for await (const msg of result) {
    msgCount++
    const type = (msg as { type?: string }).type
    console.log(`[MSG #${msgCount}] type=${type}`)

    const msgStr = JSON.stringify(msg)
    if (msgStr.includes('[auto-typecheck]')) {
      sawAdditionalContextInStream = true
      console.log(`  ↑ 在消息流中检测到 [auto-typecheck] 痕迹`)
    }

    if (type === 'assistant') {
      const content = (msg as { message?: { content?: Array<{ type: string; text?: string }> } }).message?.content
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            assistantTexts.push(block.text)
            console.log(`  assistant: ${block.text.slice(0, 200)}`)
          }
        }
      }
    }

    if (type === 'result') {
      const subtype = (msg as { subtype?: string }).subtype
      console.log(`  result subtype: ${subtype}`)
    }
  }
} catch (err) {
  console.error('\n[脚本] query 抛错:', err instanceof Error ? err.message : err)
}

// ===== 5. 结论汇总 =====
console.log('\n========== 集成测试结论 ==========')
console.log(`SDKMessage 总数: ${msgCount}`)
console.log(`PostToolUse hook 触发次数: ${hookCallCount}`)
console.log(`hook 调用详情:`)
for (const c of hookCalls) {
  console.log(`  #${c.seq} ${c.tool_name} → ${c.file_path}`)
}
console.log(`消息流中检测到 [auto-typecheck]: ${sawAdditionalContextInStream}`)
console.log(`Agent 最终文本: ${assistantTexts.join(' ').slice(0, 300)}`)

console.log('\n========== 最终判断 ==========')
if (hookCallCount > 0 && sawAdditionalContextInStream) {
  console.log('✅ 完全成功：SDK 真调用了 hook + additionalContext 真回灌到消息流')
} else if (hookCallCount > 0 && !sawAdditionalContextInStream) {
  console.log('⚠️ 部分成功：hook 被调用，但 additionalContext 未在消息流检测到')
  console.log('   （可能 SDK 内部处理了，不直接出现在 SDKMessage；需看 Agent 是否修复错误判断回灌是否生效）')
} else if (hookCallCount === 0) {
  console.log('❌ hook 未被调用（SDK 可能没把 hooks 配置生效，或 Agent 没用 Write）')
}

// 清理
try {
  rmSync(testCwd, { recursive: true, force: true })
  rmSync(sdkConfigDir, { recursive: true, force: true })
} catch {}

/**
 * 命令注册表（command-registry）
 *
 * TAgent 桌面应用的统一命令路由基础设施。所有 UI 按钮 / 命令面板触发的动作
 * 均通过此注册表统一管理，renderer 经 IPC 调 main 进程执行。
 *
 * 设计目标：
 * - 统一命令入口（避免每个按钮各写一套 IPC 调用）
 * - 为 v1.6 Cmd+K 全局命令面板预留扩展点
 * - 不引入 slash command 文本语法（与现有 `/` = TipTap Mention skill 触发冲突）
 *
 * 详见 CLAUDE.md「能力新增 Footprint Ladder」段。
 */

import type {
  CommandCategory,
  CommandContext,
  CommandMeta,
} from '@tagent/shared'
import type { CompactSessionInput, CompactSessionResult } from '@tagent/shared'

/** 命令定义：handler 在 main 进程执行 */
export interface Command {
  /** 命令 ID（全局唯一，建议用 `<domain>.<action>` 格式如 `agent.compact`） */
  id: string
  /** 显示名（中文） */
  name: string
  /** 描述（中文，用于命令面板提示） */
  description: string
  /** 分类 */
  category: CommandCategory
  /**
   * 执行 handler（main 进程内执行）
   * 返回值经 IPC 序列化回 renderer，renderer 按 id 自行 cast 结果类型
   */
  handler: (ctx: CommandContext) => Promise<unknown> | unknown
  /** 可选：快捷键（v1.6 全局命令面板用，格式如 'Cmd+K'） */
  shortcut?: string
  /** 可选：图标名（v1.6 全局命令面板用） */
  icon?: string
}

const commands: Map<string, Command> = new Map()

/**
 * 注册命令
 * @throws 命令 id 已注册时抛错
 */
export function registerCommand(cmd: Command): void {
  if (commands.has(cmd.id)) {
    throw new Error(`命令已注册: ${cmd.id}`)
  }
  commands.set(cmd.id, cmd)
}

/** 注销命令 */
export function unregisterCommand(id: string): void {
  commands.delete(id)
}

/** 查询命令 */
export function getCommand(id: string): Command | undefined {
  return commands.get(id)
}

/**
 * 列出命令元信息（不含 handler，用于 IPC 传输给 renderer / 命令面板）
 * @param category 可选分类过滤
 */
export function listCommands(category?: CommandCategory): CommandMeta[] {
  const all = Array.from(commands.values())
  const filtered = category ? all.filter((c) => c.category === category) : all
  return filtered.map(({ id, name, description, category, shortcut, icon }) => ({
    id,
    name,
    description,
    category,
    shortcut,
    icon,
  }))
}

/**
 * 执行命令（main 进程内调用，不走 IPC）
 * @returns 命令 handler 的返回值
 * @throws 命令未注册时抛错
 */
export async function runCommand(
  id: string,
  ctx: CommandContext
): Promise<unknown> {
  const cmd = commands.get(id)
  if (!cmd) {
    throw new Error(`命令未注册: ${id}`)
  }
  return cmd.handler(ctx)
}

/**
 * 注册内置命令（在 app ready 时调用一次）
 *
 * 当前已注册：
 * - `agent.compact`：客户端主动压缩会话历史（走 compactSession fallback 路径）
 *
 * 后续逐步迁移：reset / settings / new / fast / usage
 */
export function registerBuiltinCommands(): void {
  registerCommand({
    id: 'agent.compact',
    name: '压缩会话',
    description: '主动触发 context 压缩兜底（drop_old_tool_results 策略）',
    category: 'agent',
    handler: async (ctx: CommandContext): Promise<CompactSessionResult | null> => {
      const sessionId = ctx.sessionId
      if (!sessionId) {
        throw new Error('agent.compact 需要 sessionId')
      }
      const args = ctx.args as { input?: CompactSessionInput } | undefined
      const input: CompactSessionInput = args?.input ?? {
        strategy: 'drop_old_tool_results',
      }
      const { compactSession } = await import('./agent-session-compactor')
      return compactSession(sessionId, input)
    },
  })
}

/**
 * Ask 档位的工具白名单
 *
 * 与 Chat 的 getEnabledTools 平行，但只开放 Ask 安全的子集：
 * - suggest_agent_switch：必开（升级引导，Ask → Agent）
 * - web-search：可选（受 chat-tools.json 配置控制）
 * - memory：可选（受 chat-tools.json 配置控制）
 *
 * 严格禁用：
 * - 任何文件读写工具（Read/Write/Edit/...）
 * - 命令执行工具（Bash）
 * - MCP（任何 MCP server）
 * - Skills
 * - TA 工具（ta-*）
 * - 自定义 HTTP 工具
 * - nano-banana
 *
 * 实现：直接消费 tool-config 的 toolStates 决定可选工具的开关，
 * 不复用 tool-registry（后者会拉起所有 builtin tool）。
 */

import { getChatToolsConfig } from './tool-config'

import type { ToolDefinition, ToolParameterProperty } from '@tagent/core'
import type { AskMessage, ChatToolActivity } from '@tagent/shared'

// ===== suggest_agent_switch 工具定义（必开） =====

export const SUGGEST_AGENT_SWITCH_TOOL_DEFINITION: ToolDefinition = {
  name: 'suggest_agent_switch',
  description:
    "Proactively suggest switching the Composer to Agent mode when the user's task requires file operations, command execution, MCP, Skills, or any other capability beyond pure conversation. Call this BEFORE responding in those cases. Do NOT use this for tasks that can be fully answered in Ask mode.",
  parameters: {
    type: 'object',
    properties: {
      reason: {
        type: 'string',
        description:
          "Specific explanation of how Agent mode can better help the user achieve the goal (in the user's language)",
      },
      suggestedPrompt: {
        type: 'string',
        description: "Suggested initial prompt for Agent mode, summarizing the user's core task",
      },
    },
    required: ['reason', 'suggestedPrompt'],
  },
}

/** suggest_agent_switch 工具名集合（执行器判定用） */
export const SUGGEST_AGENT_SWITCH_TOOL_NAMES: ReadonlySet<string> = new Set([
  'suggest_agent_switch',
])

/**
 * 判断是否为 Ask → Agent 升级工具调用
 */
export function isSuggestAgentSwitchToolCall(toolName: string): boolean {
  return SUGGEST_AGENT_SWITCH_TOOL_NAMES.has(toolName)
}

// ===== 联网搜索（可选） =====

const WEB_SEARCH_TOOL_ID = 'web-search'

/**
 * Ask 下的联网搜索工具定义（无 Tavily 工具用，由 tool-registry 提供）
 *
 * 直接复用 tool-registry.getAskEnabledTools 的同一组定义。
 * 这里仅作为常量说明：Ask 工具集不直接调用 getEnabledTools（避免拉起 nano-banana/ta/...），
 * 而是基于 chat-tools.json 的 toolStates 显式枚举。
 */

// ===== 记忆（可选） =====

const MEMORY_TOOL_ID = 'memory'

// ===== 公开 API =====

/** Ask 工具白名单结果 */
export interface AskEnabledToolsResult {
  /** 工具定义列表（注入 Provider API） */
  tools: ToolDefinition[] | undefined
  /** 工具相关的系统提示词追加（Ask 契约已在 ask-prompt-builder 中提供） */
  systemPromptAppend: string | undefined
}

/**
 * 获取 Ask 档位可用的工具定义
 *
 * 必开：suggest_agent_switch（升级引导）
 * 可选：web-search / memory（受 chat-tools.json 配置控制）
 * 其他一律禁用。
 */
export function getAskEnabledTools(): AskEnabledToolsResult {
  const config = getChatToolsConfig()
  const tools: ToolDefinition[] = [SUGGEST_AGENT_SWITCH_TOOL_DEFINITION]

  if (config.toolStates[WEB_SEARCH_TOOL_ID]?.enabled) {
    // web-search 的 ToolDefinition 由 tools 目录提供，
    // 此处仅占位（P1 视情况接 tool-registry 的轻量子集）
    // 为避免引入 tool-registry（会拉起 nano-banana/ta/memory 的副作用），
    // 当前 P0 阶段暂不注入联网工具，P1 再补
  }

  if (config.toolStates[MEMORY_TOOL_ID]?.enabled) {
    // 同上，P1 阶段补
  }

  return {
    tools,
    systemPromptAppend: undefined,
  }
}

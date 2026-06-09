/**
 * TA 领域工具统一入口
 *
 * 提供技术美术（Technical Artist）相关工具能力：
 * - 命名规范检查与建议
 * - 目录结构验证
 * - 项目规范发现与加载
 * - 模式切换建议
 */

import { CHECK_DIRECTORY_STRUCTURE_TOOL_META, CHECK_DIRECTORY_STRUCTURE_TOOL_DEFINITIONS, executeCheckDirectoryStructure } from './check-directory-structure-tool'
import { CHECK_NAMING_TOOL_META, CHECK_NAMING_TOOL_DEFINITIONS, executeCheckNaming } from './check-naming-tool'
import { DISCOVER_CONVENTIONS_TOOL_META, DISCOVER_CONVENTIONS_TOOL_DEFINITIONS, executeDiscoverConventions } from './discover-conventions-tool'
import { LOAD_CONVENTIONS_TOOL_META, LOAD_CONVENTIONS_TOOL_DEFINITIONS, executeLoadConventions } from './load-conventions-tool'
import { SUGGEST_NAMING_TOOL_META, SUGGEST_NAMING_TOOL_DEFINITIONS, executeSuggestNaming } from './suggest-naming-tool'
import { SWITCH_MODE_TOOL_META, SWITCH_MODE_TOOL_DEFINITIONS, isSwitchModeToolCall } from './switch-mode-tool'

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'

// ===== 工具元数据 =====

export const TA_TOOL_META: ChatToolMeta = {
  id: 'ta_conventions',
  name: 'TA 规范工具',
  description: '技术美术命名与结构规范检查',
  params: [],
  icon: 'FileCheck',
  category: 'builtin',
  executorType: 'builtin',
  systemPromptAppend: `
<ta_conventions_instructions>
你拥有 TA 规范检查能力，可以帮助用户：
- 检查资产命名是否符合项目规范
- 提供符合 TA 习惯的命名建议
- 验证目录结构是否符合约定
- 发现和加载项目中的规范配置文件

适用场景：
- 用户创建新资产时，建议命名
- 用户整理资产时，检查命名和目录结构
- 用户想了解项目规范时，发现和加载配置
</ta_conventions_instructions>`,
}

// ===== 所有 TA 工具定义 =====

export const TA_TOOL_DEFINITIONS: ToolDefinition[] = [
  ...CHECK_NAMING_TOOL_DEFINITIONS,
  ...SUGGEST_NAMING_TOOL_DEFINITIONS,
  ...CHECK_DIRECTORY_STRUCTURE_TOOL_DEFINITIONS,
  ...DISCOVER_CONVENTIONS_TOOL_DEFINITIONS,
  ...LOAD_CONVENTIONS_TOOL_DEFINITIONS,
  ...SWITCH_MODE_TOOL_DEFINITIONS,
]

// ===== 工具名称集合 =====

const TA_TOOL_NAMES = new Set([
  'check_naming',
  'suggest_naming',
  'check_directory_structure',
  'discover_conventions',
  'load_conventions',
  'switch_mode',
])

// ===== 可用性检查 =====

/**
 * 检查 TA 工具是否可用
 * TS 内置工具始终可用，无需外部依赖
 */
export function isTAToolAvailable(): boolean {
  return true
}

// ===== 工具路由 =====

/**
 * 判断是否为 TA 工具调用
 */
export function isTAToolCall(toolName: string): boolean {
  return TA_TOOL_NAMES.has(toolName) || isSwitchModeToolCall(toolName)
}

/**
 * 判断是否为 switch_mode 工具调用（需要特殊处理）
 */
export function isSwitchModeToolCallExport(toolName: string): boolean {
  return isSwitchModeToolCall(toolName)
}

/**
 * 执行 TA 工具调用
 */
export async function executeTATool(toolCall: ToolCall, cwd: string): Promise<ToolResult> {
  try {
    switch (toolCall.name) {
      case 'check_naming':
        return executeCheckNaming(toolCall)
      case 'suggest_naming':
        return executeSuggestNaming(toolCall)
      case 'check_directory_structure':
        return executeCheckDirectoryStructure(toolCall, cwd)
      case 'discover_conventions':
        return executeDiscoverConventions(toolCall, cwd)
      case 'load_conventions':
        return executeLoadConventions(toolCall, cwd)
      default:
        return {
          toolCallId: toolCall.id,
          content: `未知的 TA 工具: ${toolCall.name}`,
          isError: true,
        }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[TA 工具] 执行失败 (${toolCall.name}):`, error)
    return {
      toolCallId: toolCall.id,
      content: `Tool execution failed: ${msg}`,
      isError: true,
    }
  }
}

// ===== 导出各工具元数据（供注册表使用） =====

export {
  CHECK_NAMING_TOOL_META,
  SUGGEST_NAMING_TOOL_META,
  CHECK_DIRECTORY_STRUCTURE_TOOL_META,
  DISCOVER_CONVENTIONS_TOOL_META,
  LOAD_CONVENTIONS_TOOL_META,
  SWITCH_MODE_TOOL_META,
}
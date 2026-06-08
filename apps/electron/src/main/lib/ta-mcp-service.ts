/**
 * TA MCP Server 服务
 *
 * 管理 TA (Technical Artist) MCP Server 的配置、状态检查和自动启用。
 */

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { getWorkspaceMcpPath, getConfigDir } from './config-paths'
import { getAgentWorkspace } from './agent-workspace-manager'

import type { WorkspaceMcpConfig } from '@tagent/shared'

/** TA MCP Server 名称 */
export const TA_MCP_SERVER_NAME = 'ta-agent-mcp'

/** TA MCP Server 配置 */
export interface TAMcpServerConfig {
  /** 是否启用 */
  enabled: boolean
  /** Python 可执行文件路径 */
  pythonPath?: string
  /** 模块名 */
  module: string
}

/** TA MCP Server 状态 */
export interface TAMcpServerStatus {
  /** 是否已安装 */
  installed: boolean
  /** 是否已配置 */
  configured: boolean
  /** Python 版本 */
  pythonVersion?: string
  /** 错误信息 */
  error?: string
}

/**
 * 检测 Python 环境
 *
 * 优先级：python > python3
 */
function detectPython(): { path: string; version: string } | null {
  const commands = ['python', 'python3']

  for (const cmd of commands) {
    try {
      const version = execSync(`${cmd} --version`, { encoding: 'utf-8', timeout: 5000 }).trim()
      const match = version.match(/Python (\d+\.\d+\.\d+)/i)
      if (match) {
        return { path: cmd, version: match[1]! }
      }
    } catch {
      // 继续尝试下一个命令
    }
  }

  return null
}

/**
 * 检查 TA MCP Server 是否已安装
 */
function checkTAMcpInstalled(pythonPath: string): boolean {
  try {
    execSync(`${pythonPath} -c "import ta_agent_mcp"`, { encoding: 'utf-8', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

/**
 * 获取 TA MCP Server 状态
 */
export function getTAMcpServerStatus(): TAMcpServerStatus {
  // 检测 Python
  const python = detectPython()

  if (!python) {
    return {
      installed: false,
      configured: false,
      error: '未找到 Python 环境，请安装 Python 3.10+',
    }
  }

  // 检查 ta-agent-mcp 是否已安装
  const installed = checkTAMcpInstalled(python.path)

  if (!installed) {
    return {
      installed: false,
      configured: false,
      pythonVersion: python.version,
      error: 'ta-agent-mcp 未安装，请运行 pip install ta-agent-mcp',
    }
  }

  return {
    installed: true,
    configured: false, // 由调用方检查工作区配置
    pythonVersion: python.version,
  }
}

/**
 * 获取 TA MCP Server 配置项
 *
 * 用于添加到工作区 mcp.json
 */
export function getTAMcpServerEntry(): { command: string; args: string[]; env?: Record<string, string> } {
  // 使用 Python 模块方式启动
  const python = detectPython()
  const pythonPath = python?.path || 'python'

  return {
    command: pythonPath,
    args: ['-m', 'ta_agent_mcp'],
  }
}

/**
 * 检查工作区是否配置了 TA MCP Server
 */
export function isTAMcpConfigured(workspaceSlug: string): boolean {
  const mcpPath = getWorkspaceMcpPath(workspaceSlug)

  if (!existsSync(mcpPath)) {
    return false
  }

  try {
    const raw = require('fs').readFileSync(mcpPath, 'utf-8')
    const config = JSON.parse(raw) as WorkspaceMcpConfig
    return !!(config.servers?.[TA_MCP_SERVER_NAME]?.enabled)
  } catch {
    return false
  }
}

/**
 * 为工作区启用 TA MCP Server
 *
 * 如果未配置则自动添加，已配置则确保启用。
 */
export function enableTAMcpForWorkspace(workspaceSlug: string): boolean {
  const mcpPath = getWorkspaceMcpPath(workspaceSlug)

  // 读取现有配置
  let config: WorkspaceMcpConfig = { servers: {} }

  if (existsSync(mcpPath)) {
    try {
      const raw = require('fs').readFileSync(mcpPath, 'utf-8')
      config = JSON.parse(raw) as WorkspaceMcpConfig
      if (!config.servers) {
        config.servers = {}
      }
    } catch {
      // 解析失败，使用空配置
    }
  }

  // 添加或更新 TA MCP Server
  const entry = getTAMcpServerEntry()
  config.servers[TA_MCP_SERVER_NAME] = {
    enabled: true,
    type: 'stdio',
    command: entry.command,
    args: entry.args,
    env: entry.env,
  }

  // 保存配置
  try {
    require('fs').writeFileSync(mcpPath, JSON.stringify(config, null, 2), 'utf-8')
    console.log(`[TA MCP] 已为工作区 ${workspaceSlug} 启用 TA MCP Server`)
    return true
  } catch (error) {
    console.error(`[TA MCP] 启用失败:`, error)
    return false
  }
}

/**
 * 为工作区禁用 TA MCP Server
 */
export function disableTAMcpForWorkspace(workspaceSlug: string): boolean {
  const mcpPath = getWorkspaceMcpPath(workspaceSlug)

  if (!existsSync(mcpPath)) {
    return true // 未配置视为成功
  }

  try {
    const raw = require('fs').readFileSync(mcpPath, 'utf-8')
    const config = JSON.parse(raw) as WorkspaceMcpConfig

    if (!config.servers?.[TA_MCP_SERVER_NAME]) {
      return true // 未配置视为成功
    }

    // 禁用而非删除
    config.servers[TA_MCP_SERVER_NAME]!.enabled = false

    require('fs').writeFileSync(mcpPath, JSON.stringify(config, null, 2), 'utf-8')
    console.log(`[TA MCP] 已为工作区 ${workspaceSlug} 禁用 TA MCP Server`)
    return true
  } catch (error) {
    console.error(`[TA MCP] 禁用失败:`, error)
    return false
  }
}

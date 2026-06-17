/**
 * 加载规范配置工具
 *
 * 读取并解析项目中的规范配置文件：
 * - ta-config.json
 * - naming-convention.json
 * - 其他自定义配置
 */

import * as fs from 'fs'
import * as path from 'path'

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'

// ===== 工具元数据 =====

export const LOAD_CONVENTIONS_TOOL_META: ChatToolMeta = {
  id: 'ta_load_conventions',
  name: '加载规范配置',
  description: '读取并解析项目中的规范配置文件',
  params: [{ name: 'configPath', type: 'string', description: '配置文件路径', required: true }],
  icon: 'FileText',
  category: 'builtin',
  executorType: 'builtin',
}

// ===== 工具定义 =====

export const LOAD_CONVENTIONS_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'load_conventions',
    description:
      'Load and parse a convention config file. Returns the parsed configuration with naming rules, directory structure, and style guidelines.',
    parameters: {
      type: 'object',
      properties: {
        configPath: { type: 'string', description: 'Path to config file (relative or absolute)' },
        format: {
          type: 'string',
          description: 'Output format',
          enum: ['full', 'summary', 'rules-only'],
        },
      },
      required: ['configPath'],
    },
  },
]

// ===== TA 规范配置结构 =====

interface TAConventionConfig {
  naming?: {
    prefixes?: Record<string, string[]>
    suffixes?: Record<string, string[]>
    forbiddenChars?: string[]
    maxLength?: number
    caseStyle?: 'pascal' | 'camel' | 'snake' | 'kebab'
  }
  structure?: {
    requiredDirs?: string[]
    assetDirs?: Record<string, string>
    maxDepth?: number
  }
  style?: {
    textureFormats?: string[]
    meshFormats?: string[]
    maxPolyCount?: number
    maxTextureSize?: number
  }
  metadata?: {
    projectType?: string
    engine?: string
    version?: string
    description?: string
  }
}

// ===== 加载逻辑 =====

interface LoadResult {
  success: boolean
  config?: TAConventionConfig
  error?: string
  source: string
}

/**
 * 加载规范配置
 */
function loadConventions(configPath: string, cwd: string): LoadResult {
  // 处理相对路径
  const absolutePath = path.isAbsolute(configPath) ? configPath : path.resolve(cwd, configPath)

  // 1. 检查文件是否存在
  if (!fs.existsSync(absolutePath)) {
    return {
      success: false,
      error: '配置文件不存在',
      source: configPath,
    }
  }

  // 2. 读取文件
  try {
    const content = fs.readFileSync(absolutePath, 'utf-8')

    // 3. 解析 JSON
    let config: TAConventionConfig
    try {
      config = JSON.parse(content)
    } catch {
      return {
        success: false,
        error: 'JSON 解析失败',
        source: configPath,
      }
    }

    // 4. 验证配置结构
    const validation = validateConfig(config as Record<string, unknown>)
    if (!validation.valid) {
      return {
        success: false,
        error: validation.error,
        source: configPath,
      }
    }

    return {
      success: true,
      config,
      source: configPath,
    }
  } catch (error) {
    return {
      success: false,
      error: `读取失败: ${error instanceof Error ? error.message : String(error)}`,
      source: configPath,
    }
  }
}

/**
 * 验证配置结构
 */
function validateConfig(config: Record<string, unknown>): { valid: boolean; error?: string } {
  // 检查是否有任何规范字段
  const validKeys = ['naming', 'structure', 'style', 'metadata']
  const hasValidKey = validKeys.some((k) => config[k] !== undefined)

  if (!hasValidKey) {
    return {
      valid: false,
      error: `配置缺少有效字段: ${validKeys.join(', ')}`,
    }
  }

  // 验证 naming 结构
  if (config.naming && typeof config.naming !== 'object') {
    return { valid: false, error: 'naming 字段必须是对象' }
  }

  // 验证 structure 结构
  if (config.structure && typeof config.structure !== 'object') {
    return { valid: false, error: 'structure 字段必须是对象' }
  }

  return { valid: true }
}

/**
 * 格式化配置输出
 */
function formatConfig(config: TAConventionConfig, format: string): string {
  const lines: string[] = []

  if (format === 'summary') {
    // 简要摘要
    lines.push('## 规范配置摘要')
    lines.push('')

    if (config.metadata) {
      lines.push(`**项目**: ${config.metadata.projectType || '未指定'}`)
      lines.push(`**引擎**: ${config.metadata.engine || '未指定'}`)
      lines.push('')
    }

    if (config.naming) {
      const prefixCount = Object.keys(config.naming.prefixes || {}).length
      const suffixCount = Object.keys(config.naming.suffixes || {}).length
      lines.push(`**命名规范**: ${prefixCount} 前缀, ${suffixCount} 后缀`)
    }

    if (config.structure) {
      const dirCount = (config.structure.requiredDirs || []).length
      lines.push(`**目录结构**: ${dirCount} 必需目录`)
    }

    if (config.style) {
      lines.push(`**资产限制**: 最大多边形 ${config.style.maxPolyCount || '未限制'}`)
    }

    return lines.join('\n')
  }

  if (format === 'rules-only') {
    // 仅输出规则
    lines.push('## 规范规则')
    lines.push('')

    if (config.naming) {
      lines.push('### 命名规则')
      if (config.naming.prefixes) {
        for (const [type, prefixes] of Object.entries(config.naming.prefixes)) {
          lines.push(`- ${type}: ${prefixes.join(', ')}`)
        }
      }
      if (config.naming.caseStyle) {
        lines.push(`- 大小写风格: ${config.naming.caseStyle}`)
      }
      if (config.naming.maxLength) {
        lines.push(`- 最大长度: ${config.naming.maxLength}`)
      }
      lines.push('')
    }

    if (config.structure) {
      lines.push('### 目录规则')
      for (const dir of config.structure.requiredDirs || []) {
        lines.push(`- ${dir}`)
      }
      lines.push('')
    }

    return lines.join('\n')
  }

  // 完整输出
  lines.push('## 规范配置详情')
  lines.push('')

  if (config.metadata) {
    lines.push('### 元数据')
    for (const [key, value] of Object.entries(config.metadata)) {
      lines.push(`- ${key}: ${value}`)
    }
    lines.push('')
  }

  if (config.naming) {
    lines.push('### 命名规范')
    if (config.naming.prefixes) {
      lines.push('**前缀规则**:')
      for (const [type, prefixes] of Object.entries(config.naming.prefixes)) {
        lines.push(`- ${type}: ${(prefixes as string[]).join(', ')}`)
      }
    }
    if (config.naming.suffixes) {
      lines.push('**后缀规则**:')
      for (const [type, suffixes] of Object.entries(config.naming.suffixes)) {
        lines.push(`- ${type}: ${(suffixes as string[]).join(', ')}`)
      }
    }
    if (config.naming.forbiddenChars) {
      lines.push(`**禁用字符**: ${(config.naming.forbiddenChars as string[]).join(' ')}`)
    }
    if (config.naming.caseStyle) {
      lines.push(`**大小写风格**: ${config.naming.caseStyle}`)
    }
    if (config.naming.maxLength) {
      lines.push(`**最大长度**: ${config.naming.maxLength}`)
    }
    lines.push('')
  }

  if (config.structure) {
    lines.push('### 目录结构规范')
    if (config.structure.requiredDirs) {
      lines.push('**必需目录**:')
      for (const dir of config.structure.requiredDirs) {
        lines.push(`- ${dir}`)
      }
    }
    if (config.structure.assetDirs) {
      lines.push('**资产目录映射**:')
      for (const [type, dir] of Object.entries(config.structure.assetDirs)) {
        lines.push(`- ${type} → ${dir}`)
      }
    }
    lines.push('')
  }

  if (config.style) {
    lines.push('### 资产风格规范')
    if (config.style.textureFormats) {
      lines.push(`**纹理格式**: ${(config.style.textureFormats as string[]).join(', ')}`)
    }
    if (config.style.meshFormats) {
      lines.push(`**模型格式**: ${(config.style.meshFormats as string[]).join(', ')}`)
    }
    if (config.style.maxPolyCount) {
      lines.push(`**最大多边形数**: ${config.style.maxPolyCount}`)
    }
    if (config.style.maxTextureSize) {
      lines.push(`**最大纹理尺寸**: ${config.style.maxTextureSize}`)
    }
  }

  return lines.join('\n')
}

// ===== 工具执行 =====

export function executeLoadConventions(toolCall: ToolCall, cwd: string): ToolResult {
  const configPath = toolCall.arguments.configPath as string
  const format = (toolCall.arguments.format as string) || 'full'

  const result = loadConventions(configPath, cwd)

  // 格式化输出
  const lines: string[] = []

  if (!result.success) {
    lines.push(`## 加载失败: "${configPath}"`)
    lines.push('')
    lines.push(`❌ ${result.error}`)
    lines.push('')
    lines.push('### 建议')
    lines.push('- 检查文件路径是否正确')
    lines.push('- 验证 JSON 格式是否有效')
    lines.push('- 确保配置包含 naming/structure/style/metadata 字段')
  } else {
    lines.push(`## 配置加载成功: "${result.source}"`)
    lines.push('')
    lines.push(formatConfig(result.config!, format))
  }

  return {
    toolCallId: toolCall.id,
    content: lines.join('\n'),
  }
}

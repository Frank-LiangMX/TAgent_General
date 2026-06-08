/**
 * 命名规范检查工具
 *
 * 检查资产命名是否符合 TA 规范：
 * - 前缀规范（SM_, T_, M_, SK_, etc）
 * - 后缀规范（_LOD0, _LOD1, etc）
 * - 禁用字符检查
 * - 大小写规范
 */

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'

// ===== 工具元数据 =====

export const CHECK_NAMING_TOOL_META: ChatToolMeta = {
  id: 'ta_check_naming',
  name: '命名检查',
  description: '检查资产命名是否符合 TA 规范',
  params: [
    { name: 'name', type: 'string', description: '要检查的名称', required: true },
    { name: 'assetType', type: 'string', description: '资产类型（mesh/texture/material/skeleton）', required: false },
  ],
  icon: 'FileCheck',
  category: 'builtin',
  executorType: 'builtin',
}

// ===== 工具定义 =====

export const CHECK_NAMING_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'check_naming',
    description: 'Check if an asset name follows TA naming conventions. Returns validation result with issues and suggestions.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'The asset name to check' },
        assetType: { type: 'string', description: 'Asset type: mesh, texture, material, skeleton, animation', enum: ['mesh', 'texture', 'material', 'skeleton', 'animation'] },
      },
      required: ['name'],
    },
  },
]

// ===== TA 命名规范规则 =====

/** 资产类型前缀规范 */
const ASSET_PREFIXES: Record<string, string[]> = {
  mesh: ['SM_', 'BP_', 'UI_'],      // Static Mesh, Blueprint, UI Mesh
  texture: ['T_', 'T_BC', 'T_N', 'T_M', 'T_E'], // Texture BaseColor/Normal/Metallic/Emissive
  material: ['M_', 'MI_'],          // Material, Material Instance
  skeleton: ['SK_', 'SKM_'],        // Skeleton Mesh
  animation: ['A_', 'AS_'],         // Animation, Animation Sequence
}

/** 资产类型后缀规范 */
const ASSET_SUFFIXES: Record<string, string[]> = {
  mesh: ['_LOD0', '_LOD1', '_LOD2', '_LOD3', '_Broken', '_Damaged'],
  texture: ['_BC', '_N', '_M', '_E', '_A', '_R', '_Mask'],
  material: [],
  skeleton: [],
  animation: [],
}

/** 禁用字符 */
const FORBIDDEN_CHARS = [' ', '-', '.', '@', '#', '$', '%', '&', '*', '(', ')', '+', '=', '[', ']', '{', '}', '|', '\\', ':', ';', '"', "'", '<', '>', ',', '/', '?', '!']

/** 禁用模式（UE5 不允许的命名） */
const FORBIDDEN_PATTERNS = [
  /^\d/,           // 数字开头
  /^[a-z]/,        // 小写开头（UE5 资产必须大写开头）
]

// ===== 检查逻辑 =====

interface NamingIssue {
  type: 'error' | 'warning'
  message: string
  suggestion?: string
}

interface NamingCheckResult {
  valid: boolean
  issues: NamingIssue[]
  detectedType?: string
}

/**
 * 检查命名规范
 */
function checkNaming(name: string, assetType?: string): NamingCheckResult {
  const issues: NamingIssue[] = []
  let detectedType: string | undefined = assetType

  // 1. 禁用字符检查
  for (const char of FORBIDDEN_CHARS) {
    if (name.includes(char)) {
      issues.push({
        type: 'error',
        message: `名称包含禁用字符 "${char}"`,
        suggestion: `移除 "${char}" 或使用下划线替代`,
      })
    }
  }

  // 2. 禁用模式检查
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (pattern.test(name)) {
      issues.push({
        type: 'error',
        message: '名称格式不符合 UE5 规范',
        suggestion: 'UE5 资产名必须以大写字母开头',
      })
    }
  }

  // 3. 前缀检查（自动检测或验证）
  if (!assetType) {
    // 自动检测类型
    for (const [type, prefixes] of Object.entries(ASSET_PREFIXES)) {
      for (const prefix of prefixes) {
        if (name.startsWith(prefix)) {
          detectedType = type
          break
        }
      }
      if (detectedType) break
    }
  } else {
    // 验证指定类型的前缀
    const validPrefixes = ASSET_PREFIXES[assetType] || []
    const hasValidPrefix = validPrefixes.some(p => name.startsWith(p))
    if (!hasValidPrefix && validPrefixes.length > 0) {
      issues.push({
        type: 'warning',
        message: `名称缺少 ${assetType} 类型的有效前缀`,
        suggestion: `使用以下前缀之一: ${validPrefixes.join(', ')}`,
      })
    }
  }

  // 4. 后缀检查（如果检测到类型）
  if (detectedType) {
    const validSuffixes = ASSET_SUFFIXES[detectedType] || []
    // 检查是否有无效后缀模式
    // 例如 texture 不应该有 _LOD 后缀
    for (const [otherType, suffixes] of Object.entries(ASSET_SUFFIXES)) {
      if (otherType !== detectedType) {
        for (const suffix of suffixes) {
          if (name.endsWith(suffix) && !validSuffixes.includes(suffix)) {
            issues.push({
              type: 'warning',
              message: `名称使用了 ${otherType} 类型的后缀 "${suffix}"`,
              suggestion: `${detectedType} 类型资产不应使用此后缀`,
            })
          }
        }
      }
    }
  }

  // 5. 长度检查
  if (name.length > 64) {
    issues.push({
      type: 'warning',
      message: '名称超过 64 字符，可能在某些引擎中截断',
      suggestion: '缩短名称或使用缩写',
    })
  }

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues,
    detectedType,
  }
}

// ===== 工具执行 =====

export function executeCheckNaming(toolCall: ToolCall): ToolResult {
  const name = toolCall.arguments.name as string
  const assetType = toolCall.arguments.assetType as string | undefined

  const result = checkNaming(name, assetType)

  // 格式化输出
  const lines: string[] = []
  lines.push(`## 命名检查结果: "${name}"`)
  lines.push('')
  lines.push(`**状态**: ${result.valid ? '✅ 通过' : '❌ 不合规'}`)
  if (result.detectedType) {
    lines.push(`**检测类型**: ${result.detectedType}`)
  }
  lines.push('')

  if (result.issues.length > 0) {
    lines.push('### 问题列表')
    for (const issue of result.issues) {
      const icon = issue.type === 'error' ? '❌' : '⚠️'
      lines.push(`${icon} ${issue.message}`)
      if (issue.suggestion) {
        lines.push(`   → 建议: ${issue.suggestion}`)
      }
    }
  } else {
    lines.push('✅ 无问题，命名符合规范')
  }

  return {
    toolCallId: toolCall.id,
    content: lines.join('\n'),
  }
}
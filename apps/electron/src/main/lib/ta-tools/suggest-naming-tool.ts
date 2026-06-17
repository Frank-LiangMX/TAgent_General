/**
 * 命名建议工具
 *
 * 根据资产类型和用途，生成符合 TA 规范的命名建议：
 * - 自动生成前缀
 * - 添加常见后缀选项
 * - 提供多个备选方案
 */

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'

// ===== 工具元数据 =====

export const SUGGEST_NAMING_TOOL_META: ChatToolMeta = {
  id: 'ta_suggest_naming',
  name: '命名建议',
  description: '根据资产类型生成符合 TA 规范的命名建议',
  params: [
    { name: 'baseName', type: 'string', description: '基础名称（描述资产用途）', required: true },
    { name: 'assetType', type: 'string', description: '资产类型', required: true },
  ],
  icon: 'Lightbulb',
  category: 'builtin',
  executorType: 'builtin',
}

// ===== 工具定义 =====

export const SUGGEST_NAMING_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'suggest_naming',
    description:
      'Generate TA-compliant naming suggestions for an asset. Returns multiple options with prefixes and suffixes.',
    parameters: {
      type: 'object',
      properties: {
        baseName: {
          type: 'string',
          description:
            'Base name describing the asset purpose (e.g., "CharacterHero", "WallStone")',
        },
        assetType: {
          type: 'string',
          description: 'Asset type',
          enum: ['mesh', 'texture', 'material', 'skeleton', 'animation'],
        },
        variant: {
          type: 'string',
          description: 'Variant type (e.g., "LOD0", "Damaged", "BaseColor")',
        },
      },
      required: ['baseName', 'assetType'],
    },
  },
]

// ===== 命名模板 =====

/** 前缀模板 */
const PREFIX_TEMPLATES: Record<string, string[]> = {
  mesh: ['SM_', 'BP_'],
  texture: ['T_', 'T_BC_', 'T_N_', 'T_M_', 'T_E_', 'T_A_'],
  material: ['M_', 'MI_'],
  skeleton: ['SK_', 'SKM_'],
  animation: ['A_', 'AS_'],
}

/** 常见变体后缀 */
const VARIANT_SUFFIXES: Record<string, string[]> = {
  mesh: ['_LOD0', '_LOD1', '_LOD2', '_Broken', '_Damaged', '_VariantA', '_VariantB'],
  texture: ['_BC', '_N', '_M', '_E', '_A', '_R', '_Mask', '_HQ', '_LQ'],
  material: ['_Base', '_Inst', '_VarA', '_VarB'],
  skeleton: ['_Main', '_Proxy'],
  animation: ['_Idle', '_Walk', '_Run', '_Attack', '_Death'],
}

/** 常见用途分类 */
const COMMON_PURPOSES: Record<string, string[]> = {
  mesh: ['Character', 'Prop', 'Weapon', 'Environment', 'Vehicle', 'UI'],
  texture: ['Albedo', 'Normal', 'Metallic', 'Roughness', 'Emissive', 'Mask'],
  material: ['Standard', 'Opaque', 'Transparent', 'Emissive', 'Decal'],
  skeleton: ['Human', 'Animal', 'Creature', 'Robot'],
  animation: ['Idle', 'Walk', 'Run', 'Jump', 'Attack', 'Die', 'Hit'],
}

// ===== 建议生成逻辑 =====

interface NamingSuggestion {
  name: string
  description: string
  prefix: string
  suffix: string
}

/**
 * 生成命名建议
 */
function generateSuggestions(
  baseName: string,
  assetType: string,
  variant?: string
): NamingSuggestion[] {
  const suggestions: NamingSuggestion[] = []

  // 1. 规范化 baseName：移除空格、转大写
  const cleanBaseName = baseName
    .replace(/[^a-zA-Z0-9_]/g, '')
    .replace(/^[a-z]/, (c) => c.toUpperCase())

  // 2. 获取前缀选项
  const prefixes = PREFIX_TEMPLATES[assetType] || ['']

  // 3. 获取后缀选项
  const suffixes = variant ? [`_${variant}`] : VARIANT_SUFFIXES[assetType] || ['']

  // 4. 生成组合建议
  for (const prefix of prefixes) {
    for (const suffix of suffixes.slice(0, 3)) {
      // 每个前缀最多 3 个后缀变体
      const fullName = `${prefix}${cleanBaseName}${suffix}`
      suggestions.push({
        name: fullName,
        description: describeNaming(prefix, cleanBaseName, suffix, assetType),
        prefix,
        suffix,
      })
    }
  }

  // 5. 如果没有变体，添加用途分类建议
  if (!variant && COMMON_PURPOSES[assetType]) {
    const purposes = COMMON_PURPOSES[assetType].slice(0, 3)
    const defaultPrefix = prefixes[0] || ''
    for (const purpose of purposes) {
      const fullName = `${defaultPrefix}${purpose}_${cleanBaseName}`
      suggestions.push({
        name: fullName,
        description: `${purpose} 类型 ${assetType}`,
        prefix: defaultPrefix,
        suffix: `_${purpose}`,
      })
    }
  }

  return suggestions
}

/**
 * 描述命名组成
 */
function describeNaming(prefix: string, base: string, suffix: string, type: string): string {
  const parts: string[] = []

  if (prefix) {
    const prefixMeaning: Record<string, string> = {
      SM_: 'Static Mesh',
      BP_: 'Blueprint',
      T_: 'Texture',
      T_BC_: 'BaseColor Texture',
      T_N_: 'Normal Texture',
      M_: 'Material',
      MI_: 'Material Instance',
      SK_: 'Skeleton',
      A_: 'Animation',
    }
    parts.push(`${prefix} = ${prefixMeaning[prefix] || type} 前缀`)
  }

  parts.push(`${base} = 主体名称`)

  if (suffix) {
    parts.push(`${suffix} = 变体/用途后缀`)
  }

  return parts.join(', ')
}

// ===== 工具执行 =====

export function executeSuggestNaming(toolCall: ToolCall): ToolResult {
  const baseName = toolCall.arguments.baseName as string
  const assetType = toolCall.arguments.assetType as string
  const variant = toolCall.arguments.variant as string | undefined

  const suggestions = generateSuggestions(baseName, assetType, variant)

  // 格式化输出
  const lines: string[] = []
  lines.push(`## 命名建议: "${baseName}" (${assetType})`)
  lines.push('')
  lines.push('### 推荐命名')

  for (let i = 0; i < suggestions.length; i++) {
    const s = suggestions[i]
    if (!s) continue
    lines.push(`${i + 1}. **${s.name}**`)
    lines.push(`   ${s.description}`)
  }

  lines.push('')
  lines.push('### 命名规范提示')
  lines.push('- 前缀标识资产类型，便于引擎识别')
  lines.push('- 主体名称应简洁清晰，描述用途')
  lines.push('- 后缀标识变体或用途，避免歧义')
  lines.push('- 始终使用 PascalCase 或下划线分隔')

  return {
    toolCallId: toolCall.id,
    content: lines.join('\n'),
  }
}

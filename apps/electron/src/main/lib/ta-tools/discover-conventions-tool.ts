/**
 * 发现项目规范工具
 *
 * 扫描项目中的规范配置文件：
 * - .clang-format, .editorconfig
 * - naming-convention.json, ta-config.json
 * - README.md, CLAUDE.md
 */

import * as path from 'path'
import * as fs from 'fs'

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'

// ===== 工具元数据 =====

export const DISCOVER_CONVENTIONS_TOOL_META: ChatToolMeta = {
  id: 'ta_discover_conventions',
  name: '发现规范配置',
  description: '扫描项目中的规范配置文件',
  params: [
    { name: 'directory', type: 'string', description: '项目根目录', required: true },
  ],
  icon: 'Search',
  category: 'builtin',
  executorType: 'builtin',
}

// ===== 工具定义 =====

export const DISCOVER_CONVENTIONS_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'discover_conventions',
    description: 'Discover convention/config files in a project. Finds naming conventions, editor configs, style guides, and project documentation.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Project root directory to scan' },
        includeHidden: { type: 'boolean', description: 'Include hidden files (default: true)' },
      },
      required: ['directory'],
    },
  },
]

// ===== 配置文件类型 =====

interface ConventionFile {
  path: string
  type: string
  description: string
  exists: boolean
}

const CONVENTION_FILE_PATTERNS: ConventionFile[] = [
  // TA 专用配置
  { path: 'ta-config.json', type: 'ta-config', description: 'TA 规范配置文件', exists: false },
  { path: 'naming-convention.json', type: 'naming', description: '命名规范配置', exists: false },
  { path: 'directory-structure.json', type: 'structure', description: '目录结构规范', exists: false },

  // 编辑器配置
  { path: '.editorconfig', type: 'editor', description: 'EditorConfig 跨编辑器配置', exists: false },
  { path: '.clang-format', type: 'format', description: 'Clang-Format 代码格式化', exists: false },
  { path: '.prettierrc', type: 'format', description: 'Prettier 格式化配置', exists: false },
  { path: '.eslintrc', type: 'lint', description: 'ESLint 配置', exists: false },
  { path: '.eslintrc.json', type: 'lint', description: 'ESLint 配置 (JSON)', exists: false },

  // 项目文档
  { path: 'README.md', type: 'docs', description: '项目说明文档', exists: false },
  { path: 'CLAUDE.md', type: 'docs', description: 'Claude Code 项目指南', exists: false },
  { path: 'CONTRIBUTING.md', type: 'docs', description: '贡献指南', exists: false },
  { path: 'STYLE_GUIDE.md', type: 'style', description: '风格指南', exists: false },

  // 项目配置
  { path: 'package.json', type: 'project', description: 'Node.js 项目配置', exists: false },
  { path: 'tsconfig.json', type: 'project', description: 'TypeScript 配置', exists: false },
  { path: '.gitignore', type: 'git', description: 'Git 忽略规则', exists: false },
  { path: '.github/CONTRIBUTING.md', type: 'github', description: 'GitHub 贡献指南', exists: false },
]

// ===== 发现逻辑 =====

interface DiscoverResult {
  found: ConventionFile[]
  missing: ConventionFile[]
  suggestions: string[]
}

/**
 * 发现项目规范配置
 */
function discoverConventions(directory: string, includeHidden: boolean = true): DiscoverResult {
  const found: ConventionFile[] = []
  const missing: ConventionFile[] = []
  const suggestions: string[] = []

  // 1. 检查预定义的配置文件
  for (const pattern of CONVENTION_FILE_PATTERNS) {
    const fullPath = path.join(directory, pattern.path)

    // 跳过隐藏文件（如果配置）
    if (!includeHidden && pattern.path.startsWith('.')) {
      continue
    }

    if (fs.existsSync(fullPath)) {
      found.push({ ...pattern, exists: true })
    } else if (pattern.type === 'ta-config' || pattern.type === 'naming' || pattern.type === 'docs') {
      missing.push({ ...pattern, exists: false })
    }
  }

  // 2. 扫描额外的 JSON 配置文件（可能包含规范）
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.json')) {
        // 检查是否已在预定义列表中
        if (!CONVENTION_FILE_PATTERNS.some(p => p.path === entry.name)) {
          const fullPath = path.join(directory, entry.name)
          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            const json = JSON.parse(content)

            // 检查是否包含规范相关字段
            if (hasConventionFields(json)) {
              found.push({
                path: entry.name,
                type: 'custom',
                description: '自定义规范配置',
                exists: true,
              })
            }
          } catch {
            // JSON 解析失败，跳过
          }
        }
      }
    }
  } catch {
    // 目录读取失败，跳过
  }

  // 3. 生成建议
  if (missing.length > 0) {
    const taConfigs = missing.filter(f => f.type === 'ta-config' || f.type === 'naming')
    if (taConfigs.length > 0) {
      suggestions.push(`建议创建 ${taConfigs.map(f => f.path).join(' 或 ')} 来定义 TA 规范`)
    }

    const docs = missing.filter(f => f.type === 'docs')
    if (docs.length > 0) {
      suggestions.push(`建议添加 ${docs.map(f => f.path).join(', ')} 来记录项目规范`)
    }
  }

  if (found.length === 0) {
    suggestions.push('项目缺少规范配置文件，建议至少创建 README.md 和 .editorconfig')
  }

  return { found, missing, suggestions }
}

/**
 * 检查 JSON 是否包含规范相关字段
 */
function hasConventionFields(json: Record<string, unknown>): boolean {
  const conventionKeywords = [
    'naming', 'prefix', 'suffix', 'convention',
    'structure', 'directory', 'format',
    'style', 'lint', 'config',
  ]

  const keys = Object.keys(json).join(' ').toLowerCase()
  return conventionKeywords.some(kw => keys.includes(kw))
}

// ===== 工具执行 =====

export function executeDiscoverConventions(
  toolCall: ToolCall,
  cwd: string
): ToolResult {
  const directory = toolCall.arguments.directory as string
  const includeHidden = (toolCall.arguments.includeHidden as boolean) ?? true

  // 处理相对路径
  const absolutePath = path.isAbsolute(directory)
    ? directory
    : path.resolve(cwd, directory)

  const result = discoverConventions(absolutePath, includeHidden)

  // 格式化输出
  const lines: string[] = []
  lines.push(`## 规范配置发现: "${directory}"`)
  lines.push('')

  if (result.found.length > 0) {
    lines.push('### 发现的配置文件')
    for (const file of result.found) {
      lines.push(`- **${file.path}** (${file.type})`)
      lines.push(`  ${file.description}`)
    }
    lines.push('')
  }

  if (result.missing.length > 0) {
    lines.push('### 常见配置文件（缺失）')
    for (const file of result.missing) {
      lines.push(`- ${file.path}: ${file.description}`)
    }
    lines.push('')
  }

  if (result.suggestions.length > 0) {
    lines.push('### 建议')
    for (const suggestion of result.suggestions) {
      lines.push(`→ ${suggestion}`)
    }
  }

  lines.push('')
  lines.push('### 统计')
  lines.push(`- 发现: ${result.found.length} 个配置文件`)
  lines.push(`- 缺失: ${result.missing.length} 个常见配置`)

  return {
    toolCallId: toolCall.id,
    content: lines.join('\n'),
  }
}
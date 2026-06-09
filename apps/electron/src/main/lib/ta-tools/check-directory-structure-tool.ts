/**
 * 目录结构检查工具
 *
 * 验证项目目录结构是否符合 TA 规范：
 * - 检查资产分类目录
 * - 检查命名一致性
 * - 发现结构问题
 */

import * as fs from 'fs'
import * as path from 'path'

import type { ToolCall, ToolResult, ToolDefinition } from '@tagent/core'
import type { ChatToolMeta } from '@tagent/shared'

// ===== 工具元数据 =====

export const CHECK_DIRECTORY_STRUCTURE_TOOL_META: ChatToolMeta = {
  id: 'ta_check_directory_structure',
  name: '目录结构检查',
  description: '验证项目目录结构是否符合 TA 规范',
  params: [
    { name: 'directory', type: 'string', description: '要检查的目录路径', required: true },
    { name: 'projectType', type: 'string', description: '项目类型（ue5/blender/general）', required: false },
  ],
  icon: 'FolderCheck',
  category: 'builtin',
  executorType: 'builtin',
}

// ===== 工具定义 =====

export const CHECK_DIRECTORY_STRUCTURE_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'check_directory_structure',
    description: 'Check if a directory structure follows TA conventions. Validates asset organization, naming consistency, and structure issues.',
    parameters: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory path to check' },
        projectType: { type: 'string', description: 'Project type', enum: ['ue5', 'blender', 'unity', 'general'] },
        depth: { type: 'number', description: 'Check depth limit (default: 3)' },
      },
      required: ['directory'],
    },
  },
]

// ===== 标准目录结构模板 =====

const STANDARD_STRUCTURES: Record<string, string[]> = {
  ue5: [
    'Content',
    'Content/Characters',
    'Content/Props',
    'Content/Environment',
    'Content/Materials',
    'Content/Textures',
    'Content/Animations',
    'Content/Audio',
    'Content/UI',
    'Content/Blueprints',
  ],
  unity: [
    'Assets',
    'Assets/Models',
    'Assets/Textures',
    'Assets/Materials',
    'Assets/Animations',
    'Assets/Audio',
    'Assets/Scripts',
    'Assets/Prefabs',
    'Assets/Scenes',
  ],
  blender: [
    'models',
    'textures',
    'materials',
    'animations',
    'renders',
    'scripts',
  ],
  general: [
    'assets',
    'assets/models',
    'assets/textures',
    'assets/materials',
    'assets/animations',
    'assets/audio',
    'source',
    'docs',
  ],
}

// ===== 检查逻辑 =====

interface DirectoryIssue {
  type: 'error' | 'warning' | 'info'
  path: string
  message: string
  suggestion?: string
}

interface StructureCheckResult {
  valid: boolean
  issues: DirectoryIssue[]
  foundDirectories: string[]
  missingDirectories: string[]
}

/**
 * 检查目录结构
 */
async function checkDirectoryStructure(
  directory: string,
  projectType: string = 'general',
  depth: number = 3
): Promise<StructureCheckResult> {
  const issues: DirectoryIssue[] = []
  const foundDirectories: string[] = []
  const missingDirectories: string[] = []

  // 1. 检查目录是否存在
  if (!fs.existsSync(directory)) {
    return {
      valid: false,
      issues: [{ type: 'error', path: directory, message: '目录不存在' }],
      foundDirectories: [],
      missingDirectories: [],
    }
  }

  // 2. 获取标准结构
  const standardDirs = STANDARD_STRUCTURES[projectType] || STANDARD_STRUCTURES.general

  // 3. 扫描目录
  try {
    const scanPattern = depth > 1 ? '**/*' : '*'
    // 使用 fs 直接扫描（避免 Agent SDK 工具依赖）
    const entries = await scanDirectory(directory, depth)

    for (const entry of entries) {
      const relativePath = path.relative(directory, entry)
      foundDirectories.push(relativePath)

      // 检查命名规范
      const name = path.basename(entry)
      if (name.includes(' ')) {
        issues.push({
          type: 'warning',
          path: relativePath,
          message: '目录名包含空格',
          suggestion: '使用下划线或 PascalCase 替代',
        })
      }

      if (name.startsWith('.')) {
        issues.push({
          type: 'info',
          path: relativePath,
          message: '隐藏目录（可能不需要检查）',
        })
      }
    }
  } catch (error) {
    issues.push({
      type: 'error',
      path: directory,
      message: `扫描失败: ${error instanceof Error ? error.message : String(error)}`,
    })
  }

  // 4. 检查缺失的标准目录
  for (const standardDir of standardDirs || []) {
    const fullPath = path.join(directory, standardDir)
    if (!fs.existsSync(fullPath)) {
      missingDirectories.push(standardDir)
      issues.push({
        type: 'warning',
        path: standardDir,
        message: `标准目录缺失`,
        suggestion: `创建 ${standardDir} 以符合 ${projectType} 项目规范`,
      })
    }
  }

  // 5. 检查资产命名一致性（如果存在资产目录）
  for (const assetDir of ['models', 'textures', 'materials', 'Content']) {
    const assetPath = path.join(directory, assetDir)
    if (fs.existsSync(assetPath)) {
      const namingIssues = await checkAssetNamingConsistency(assetPath)
      issues.push(...namingIssues)
    }
  }

  return {
    valid: issues.filter(i => i.type === 'error').length === 0,
    issues,
    foundDirectories,
    missingDirectories,
  }
}

/**
 * 递归扫描目录
 */
async function scanDirectory(dir: string, maxDepth: number): Promise<string[]> {
  const results: string[] = []

  async function scan(current: string, depth: number): Promise<void> {
    if (depth > maxDepth) return

    try {
      const entries = fs.readdirSync(current, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name)
        if (entry.isDirectory()) {
          results.push(fullPath)
          await scan(fullPath, depth + 1)
        }
      }
    } catch {
      // 跳过无法访问的目录
    }
  }

  await scan(dir, 1)
  return results
}

/**
 * 检查资产命名一致性
 */
async function checkAssetNamingConsistency(assetDir: string): Promise<DirectoryIssue[]> {
  const issues: DirectoryIssue[] = []

  try {
    const entries = fs.readdirSync(assetDir, { withFileTypes: true })

    // 检查是否混合了不同的命名风格
    const namingStyles: Set<string> = new Set()
    for (const entry of entries) {
      const name = entry.name
      if (name.includes('_')) {
        namingStyles.add('underscore')
      } else if (/[A-Z][a-z]+[A-Z]/.test(name)) {
        namingStyles.add('pascal')
      } else if (name.includes('-')) {
        namingStyles.add('hyphen')
      }
    }

    if (namingStyles.size > 1) {
      issues.push({
        type: 'warning',
        path: assetDir,
        message: '命名风格不一致',
        suggestion: `统一使用 ${Array.from(namingStyles).join(' 或 ')}`,
      })
    }
  } catch {
    // 跳过无法访问的目录
  }

  return issues
}

// ===== 工具执行 =====

export async function executeCheckDirectoryStructure(
  toolCall: ToolCall,
  cwd: string
): Promise<ToolResult> {
  const directory = toolCall.arguments.directory as string
  const projectType = (toolCall.arguments.projectType as string) || 'general'
  const depth = (toolCall.arguments.depth as number) || 3

  // 处理相对路径
  const absolutePath = path.isAbsolute(directory)
    ? directory
    : path.resolve(cwd, directory)

  const result = await checkDirectoryStructure(absolutePath, projectType, depth)

  // 格式化输出
  const lines: string[] = []
  lines.push(`## 目录结构检查: "${directory}"`)
  lines.push('')
  lines.push(`**状态**: ${result.valid ? '✅ 通过' : '❌ 有问题'}`)
  lines.push(`**项目类型**: ${projectType}`)
  lines.push('')

  if (result.missingDirectories.length > 0) {
    lines.push('### 缺失的标准目录')
    for (const dir of result.missingDirectories) {
      lines.push(`- ${dir}`)
    }
    lines.push('')
  }

  if (result.issues.length > 0) {
    lines.push('### 问题列表')
    for (const issue of result.issues) {
      const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️'
      lines.push(`${icon} ${issue.path}: ${issue.message}`)
      if (issue.suggestion) {
        lines.push(`   → 建议: ${issue.suggestion}`)
      }
    }
  } else {
    lines.push('✅ 无问题，目录结构符合规范')
  }

  lines.push('')
  lines.push(`### 扫描统计`)
  lines.push(`- 发现目录: ${result.foundDirectories.length}`)
  lines.push(`- 缺失标准目录: ${result.missingDirectories.length}`)

  return {
    toolCallId: toolCall.id,
    content: lines.join('\n'),
  }
}
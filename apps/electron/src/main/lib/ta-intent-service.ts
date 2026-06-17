/**
 * TA Intent Service - TA 意图检测服务
 *
 * 检测用户消息中的 TA (Technical Artist) 相关意图，
 * 在通用模式下主动提示用户安装/启用 ta-agent-mcp。
 */

import { getAgentSessionMeta } from './agent-session-manager'
import { getTAMcpServerStatus, isTAMcpConfigured } from './ta-mcp-service'

import type { AgentMessage } from '@tagent/shared'

/** TA 相关关键词（中文+英文） */
const TA_KEYWORDS = [
  // 模型相关
  'mesh',
  '模型',
  'polygon',
  '多边形',
  '顶点',
  'vertex',
  '面数',
  'poly count',
  // 材质纹理
  'texture',
  '纹理',
  '贴图',
  'material',
  '材质',
  'shader',
  '着色器',
  'uv',
  'uv展开',
  'uv mapping',
  'pbr',
  'normal map',
  '法线贴图',
  // FBX/导入导出
  'fbx',
  'obj',
  'gltf',
  'glb',
  '导入模型',
  '导出模型',
  'import',
  'export',
  // 引擎相关
  'unity',
  'ue',
  'ue4',
  'ue5',
  'unreal',
  '虚幻',
  'prefab',
  '蓝图',
  'blueprint',
  'asset',
  '资产',
  '资源管理',
  'asset bundle',
  // 命名规范
  '命名',
  'naming',
  '命名规范',
  'naming convention',
  '命名规则',
  // 目录结构
  '目录结构',
  'directory',
  'folder structure',
  '项目结构',
  'project structure',
  // LOD/优化
  'lod',
  'level of detail',
  '优化',
  'optimization',
  '性能优化',
  'performance',
  // 动画/骨骼
  'rig',
  '骨骼',
  'skeleton',
  'animation',
  '动画',
  'skinned',
  '蒙皮',
  // 技术美术
  'ta',
  'technical artist',
  '技术美术',
  'tech art',
]

/** 强匹配关键词（命中即判定为 TA 意图） */
const STRONG_KEYWORDS = [
  'ta-agent-mcp',
  'tagent',
  'ta mcp',
  'ta 工具',
  'check_mesh_budget',
  'check_fbx_info',
  'check_texture_info',
  '命名规范检查',
  '目录结构检查',
]

/** 会话级已提示记录 */
const sessionPrompted = new Set<string>()

/**
 * 检测用户消息是否包含 TA 相关意图
 */
export function detectTAIntent(userMessage: string): {
  hasIntent: boolean
  matchedKeywords: string[]
  confidence: 'strong' | 'medium' | 'weak'
} {
  const lowerMsg = userMessage.toLowerCase()

  // 强匹配：直接命中技术术语
  const strongMatches: string[] = []
  for (const kw of STRONG_KEYWORDS) {
    if (lowerMsg.includes(kw.toLowerCase())) {
      strongMatches.push(kw)
    }
  }
  if (strongMatches.length > 0) {
    return { hasIntent: true, matchedKeywords: strongMatches, confidence: 'strong' }
  }

  // 普通匹配：统计命中数量
  const matches: string[] = []
  for (const kw of TA_KEYWORDS) {
    if (lowerMsg.includes(kw.toLowerCase())) {
      matches.push(kw)
    }
  }

  // 3+ 关键词 = 高置信度，2 个 = 中等，1 个 = 弱
  if (matches.length >= 3) {
    return { hasIntent: true, matchedKeywords: matches, confidence: 'strong' }
  }
  if (matches.length === 2) {
    return { hasIntent: true, matchedKeywords: matches, confidence: 'medium' }
  }
  if (matches.length === 1) {
    return { hasIntent: true, matchedKeywords: matches, confidence: 'weak' }
  }

  return { hasIntent: false, matchedKeywords: [], confidence: 'weak' }
}

/**
 * 检查是否应该提示用户安装 TA MCP
 *
 * 条件：
 * 1. 当前在通用模式
 * 2. TA MCP 未安装或未启用
 * 3. 本次会话未提示过
 */
export function shouldPromptTAMcp(
  sessionId: string,
  workspaceSlug: string
): {
  shouldPrompt: boolean
  reason: 'not_installed' | 'not_configured' | null
  status: { installed: boolean; configured: boolean } | null
} {
  // 检查会话模式
  const sessionMeta = getAgentSessionMeta(sessionId)
  if (sessionMeta?.mode === 'ta') {
    // 已在 TA 模式，不需要提示
    return { shouldPrompt: false, reason: null, status: null }
  }

  // 检查是否已提示过
  if (sessionPrompted.has(sessionId)) {
    return { shouldPrompt: false, reason: null, status: null }
  }

  // 检查 TA MCP 状态
  const status = getTAMcpServerStatus()

  if (!status.installed) {
    return {
      shouldPrompt: true,
      reason: 'not_installed',
      status: { installed: false, configured: false },
    }
  }

  // 检查工作区配置
  const configured = isTAMcpConfigured(workspaceSlug)
  if (!configured) {
    return {
      shouldPrompt: true,
      reason: 'not_configured',
      status: { installed: true, configured: false },
    }
  }

  return { shouldPrompt: false, reason: null, status: { installed: true, configured: true } }
}

/**
 * 标记会话已提示过 TA MCP
 */
export function markSessionPrompted(sessionId: string): void {
  sessionPrompted.add(sessionId)
}

/**
 * 清理会话提示记录
 */
export function clearSessionPrompted(sessionId: string): void {
  sessionPrompted.delete(sessionId)
}

/**
 * 从最近消息中检测 TA 意图并决定是否提示
 *
 * @returns 提示信息，如果不需要提示则返回 null
 */
export function checkAndGeneratePrompt(
  sessionId: string,
  workspaceSlug: string,
  recentMessages: AgentMessage[]
): {
  prompt: string
  confidence: 'strong' | 'medium' | 'weak'
  reason: 'not_installed' | 'not_configured'
} | null {
  // 获取最近一条用户消息
  const lastUserMsg = [...recentMessages].reverse().find((m) => m.role === 'user')
  if (!lastUserMsg || typeof lastUserMsg.content !== 'string') {
    return null
  }

  // 检测意图
  const intent = detectTAIntent(lastUserMsg.content)
  if (!intent.hasIntent) {
    return null
  }

  // 弱置信度不提示（减少干扰）
  if (intent.confidence === 'weak') {
    return null
  }

  // 检查是否应该提示
  const promptCheck = shouldPromptTAMcp(sessionId, workspaceSlug)
  if (!promptCheck.shouldPrompt || !promptCheck.reason) {
    return null
  }

  // 标记已提示
  markSessionPrompted(sessionId)

  // 生成提示消息
  const keywordList = intent.matchedKeywords.slice(0, 5).join('、')
  let promptMessage = ''

  if (promptCheck.reason === 'not_installed') {
    promptMessage = `检测到您的问题涉及 TA 相关内容（${keywordList}），建议安装 TA MCP Server 获得专业的资产检查、命名规范验证等工具。是否前往 TA 模式查看安装指引？`
  } else if (promptCheck.reason === 'not_configured') {
    promptMessage = `检测到您的问题涉及 TA 相关内容（${keywordList}），TA MCP Server 已安装但未启用。是否前往设置启用？`
  }

  return {
    prompt: promptMessage,
    confidence: intent.confidence,
    reason: promptCheck.reason,
  }
}

/**
 * Memory Graph 数据装配器（P3-MG.1，借鉴 hermes learning_graph.py）
 *
 * 从 L0/L2/L5 md 文件按 \n§\n 切片生成 memory 节点，
 * 从 skill 目录读 SKILL.md 生成 skill 节点，
 * 计算 memory-skill 词法重合边（token 交集 + skill 名子串 +6 分，取 top-4）。
 *
 * 详见 docs/plans/2026-07-06-silent-memory-research/TAgent_Memory_Master_Design.md §8.3
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { app } from 'electron'

import type { MemoryMode } from './memory-layer-service'

// ===== 类型定义 =====

/** 节点 kind */
export type NodeKind = 'memory' | 'skill'

/** 节点 source（memory 用） */
export type MemorySource = 'L0' | 'L2' | 'L5'

/** 图节点 */
export interface GraphNode {
  /** 唯一 id（memory:<source>:<hash> 或 skill:<name>） */
  id: string
  /** 节点类型 */
  kind: NodeKind
  /** 形状：memory=菱形(diamond)，skill=圆形(circle) */
  shape: 'diamond' | 'circle'
  /** 来源层（memory 专用） */
  source?: MemorySource
  /** 标题（切片首行 / skill 名） */
  title: string
  /** 内容（切片正文 / SKILL.md 描述） */
  content: string
  /** 最后使用时间（ring 排列依据） */
  timestamp: number
  /** skill 专用：使用次数 */
  useCount?: number
}

/** 图边 */
export interface GraphEdge {
  /** 起点 id */
  source: string
  /** 终点 id */
  target: string
  /** 边类型 */
  type: 'skill-skill' | 'memory-skill'
  /** 权重（memory-skill 词法重合分数） */
  weight?: number
}

/** 装配结果 */
export interface GraphPayload {
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: {
    memoryNodes: number
    skillNodes: number
    edges: number
  }
}

// ===== 常量 =====

/** LAYER_FILE_HEADERS 对应的 source 映射 */
const FILE_SOURCE_MAP: Record<string, MemorySource> = {
  'L0_user.md': 'L0',
  'L2_facts.md': 'L2',
  'L5_insights.md': 'L5',
}

// ===== 装配入口 =====

/**
 * 构建 Memory Graph payload
 *
 * 完全按需装配，无定时，无缓存（借鉴 hermes 按需扫盘策略）。
 * 每次打开 Memory Graph 视图时调用。
 *
 * @param mode 记忆模式
 * @param workspaceSlug 工作区 slug（用于找 skills 目录）
 */
export function buildGraphPayload(mode: MemoryMode, workspaceSlug?: string): GraphPayload {
  const memoryNodes = buildMemoryNodes(mode)
  const skillNodes = buildSkillNodes(workspaceSlug)
  const allNodes = [...memoryNodes, ...skillNodes]

  const edges = buildEdges(memoryNodes, skillNodes)

  return {
    nodes: allNodes,
    edges,
    stats: {
      memoryNodes: memoryNodes.length,
      skillNodes: skillNodes.length,
      edges: edges.length,
    },
  }
}

// ===== memory 节点构建 =====

/**
 * 从 L0/L2/L5 md 文件按 \n§\n 切片生成 memory 节点
 *
 * 切分规则（借鉴 hermes MEMORY.md/USER.md 按 \n§\n 切片）：
 * - 空行分隔的连续非空行块作为一个切片
 * - 忽略 header 行（# 开头）
 * - 忽略空行和纯分隔符行
 */
function buildMemoryNodes(mode: MemoryMode): GraphNode[] {
  const isDev = !app.isPackaged
  const baseDir = isDev
    ? path.join(app.getPath('home'), '.tagent-dev')
    : path.join(app.getPath('home'), '.tagent')
  const memoryDir =
    mode === 'general' ? path.join(baseDir, 'memory') : path.join(baseDir, 'ta', 'memory')

  const nodes: GraphNode[] = []

  for (const [fileName, source] of Object.entries(FILE_SOURCE_MAP)) {
    const filePath = path.join(memoryDir, fileName)
    if (!fs.existsSync(filePath)) {
      continue
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const slices = sliceMarkdown(content)

      for (let i = 0; i < slices.length; i++) {
        const slice = slices[i] ?? ''
        if (!slice.trim()) continue

        const lines = slice.split('\n').filter((l) => l.trim())
        if (lines.length === 0) continue

        // 跳过纯 header 行（# 开头或 > 开头）
        const firstLine = lines[0]
        if (firstLine !== undefined && (firstLine.startsWith('#') || firstLine.startsWith('>'))) {
          continue
        }

        const title = firstLine ?? slice.slice(0, 50)
        const nodeContent = lines.join('\n')

        // timestamp：取标签里的 last_ref，没有则用文件 mtime
        const mtime = fs.statSync(filePath).mtimeMs
        const lastRefMatch = slice.match(/last_ref:(\d{4}-\d{2}-\d{2})/)
        const timestamp = lastRefMatch
          ? new Date((lastRefMatch[1] ?? '') + 'T00:00:00').getTime()
          : mtime

        const hash = computeContentHash(nodeContent)
        const id = `memory:${source}:${hash}`

        nodes.push({
          id,
          kind: 'memory',
          shape: 'diamond',
          source,
          title: title.replace(/<!--.*?-->/g, '').replace(/^-\s*\[\d{4}-\d{2}-\d{2}\]\s*/, '').trim(),
          content: nodeContent,
          timestamp,
        })
      }
    } catch (e) {
      console.warn(`[LearningGraph] 读 ${fileName} 失败:`, e)
    }
  }

  return nodes
}

/**
 * Markdown 切片：按空行分隔的连续非空行块
 *
 * 规则：
 * - 两个连续空行（或一个空行 + header 行）作为切分点
 * - 纯注释行（<!-- -->）不算空行
 */
function sliceMarkdown(content: string): string[] {
  const slices: string[] = []
  let current: string[] = []

  for (const line of content.split('\n')) {
    // 跳过纯 header/metadata 行
    if (line.startsWith('#') || line.startsWith('---')) {
      if (current.length > 0) {
        slices.push(current.join('\n'))
        current = []
      }
      continue
    }

    if (line.trim() === '') {
      if (current.length > 0) {
        slices.push(current.join('\n'))
        current = []
      }
      continue
    }

    current.push(line)
  }

  if (current.length > 0) {
    slices.push(current.join('\n'))
  }

  return slices
}

// ===== skill 节点构建 =====

/**
 * 从 skill 目录读 SKILL.md 生成 skill 节点
 *
 * 过滤规则（借鉴 hermes _iter_skill_files）：
 * - 排除 .archive / .hub / node_modules / .git
 * - 只读 SKILL.md 文件
 * - 非 base 安装且 created_by=agent 或 use_count>0 的"已学到"skill
 */
function buildSkillNodes(workspaceSlug?: string): GraphNode[] {
  const nodes: GraphNode[] = []

  // skill 目录路径：~/.tagent[-dev]/agent-workspaces/{slug}/skills/
  const isDev = !app.isPackaged
  const baseDir = isDev
    ? path.join(app.getPath('home'), '.tagent-dev')
    : path.join(app.getPath('home'), '.tagent')

  const skillDirs = workspaceSlug
    ? [path.join(baseDir, 'agent-workspaces', workspaceSlug, 'skills')]
    : []

  // 也扫描 default workspace
  const defaultDir = path.join(baseDir, 'agent-workspaces', 'default', 'skills')
  if (fs.existsSync(defaultDir)) {
    skillDirs.push(defaultDir)
  }

  const excludeDirs = new Set(['.archive', '.hub', 'node_modules', '.git'])

  for (const skillsDir of skillDirs) {
    if (!fs.existsSync(skillsDir)) continue

    try {
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true })

      for (const entry of entries) {
        if (!entry.isDirectory() || excludeDirs.has(entry.name)) continue

        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md')
        if (!fs.existsSync(skillMdPath)) continue

        try {
          const content = fs.readFileSync(skillMdPath, 'utf-8')
          const mtime = fs.statSync(skillMdPath).mtimeMs

          // 提取 description（frontmatter 里的 description 字段）
          const descMatch = content.match(/description:\s*(.+)/)
          const description = descMatch ? (descMatch[1] ?? '').trim() : entry.name

          // 提取 created_by（frontmatter）
          const createdByMatch = content.match(/created_by:\s*(.+)/)
          const createdBy = createdByMatch ? (createdByMatch[1] ?? '').trim() : 'user'

          const id = `skill:${entry.name}`

          nodes.push({
            id,
            kind: 'skill',
            shape: 'circle',
            title: entry.name,
            content: description,
            timestamp: mtime,
            useCount: createdBy === 'agent' ? 1 : 0,
          })
        } catch (e) {
          console.warn(`[LearningGraph] 读 SKILL.md 失败: ${skillMdPath}`, e)
        }
      }
    } catch (e) {
      console.warn(`[LearningGraph] 扫描 skills 目录失败: ${skillsDir}`, e)
    }
  }

  return nodes
}

// ===== 边构建 =====

/**
 * 构建边（借鉴 hermes build_edges + _memory_skill_edges）
 *
 * 两类边：
 * 1. skill-skill：SKILL.md frontmatter related_skills 字段（暂不实现，需要解析 frontmatter）
 * 2. memory-skill：词法重合度（token 交集 + skill 名子串 +6 分，取 top-4）
 */
function buildEdges(memoryNodes: GraphNode[], skillNodes: GraphNode[]): GraphEdge[] {
  const edges: GraphEdge[] = []

  // memory-skill 词法重合边
  for (const memNode of memoryNodes) {
    const memTokens = tokenize(memNode.title + ' ' + memNode.content)
    const scores: Array<{ skillId: string; score: number }> = []

    for (const skillNode of skillNodes) {
      const skillTokens = tokenize(skillNode.title)
      const intersection = memTokens.filter((t) => skillTokens.includes(t))

      // skill 名作为子串出现 +6 分
      let score = intersection.length
      if (memNode.content.includes(skillNode.title)) {
        score += 6
      }

      if (score > 0) {
        scores.push({ skillId: skillNode.id, score })
      }
    }

    // 取 top-4（借鉴 hermes _memory_skill_edges）
    scores.sort((a, b) => b.score - a.score)
    const top4 = scores.slice(0, 4)

    for (const { skillId, score } of top4) {
      edges.push({
        source: memNode.id,
        target: skillId,
        type: 'memory-skill',
        weight: score,
      })
    }
  }

  return edges
}

// ===== 工具函数 =====

/**
 * tokenize：中文字按字切，英文按 ≥3 字符单词切（借鉴 hermes tokenize 规则）
 */
function tokenize(text: string): string[] {
  const tokens: string[] = []
  // 英文单词 ≥3 字符
  const englishWords = text.match(/[a-zA-Z]{3,}/g) ?? []
  tokens.push(...englishWords.map((w) => w.toLowerCase()))

  // 中文字（每个字是一个 token）
  const chineseChars = text.match(/[一-鿿]/g) ?? []
  tokens.push(...chineseChars)

  return [...new Set(tokens)]
}

/**
 * 简单内容 hash（64-bit，与 drift 检测同款）
 */
function computeContentHash(content: string): string {
  let hash = 5381n
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5n) + hash + BigInt(content.charCodeAt(i))) & 0xffffffffn
  }
  return hash.toString(16)
}

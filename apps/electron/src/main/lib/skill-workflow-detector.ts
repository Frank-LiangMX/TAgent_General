/**
 * 跨会话工具调用序列模式识别（层次 A）
 *
 * 只比较有序工具名序列的相似度，不读用户消息内容。
 * 门槛：重复 ≥ MIN_OCCURRENCES 且 pairwise 平均相似度 ≥ MIN_SIMILARITY。
 */

import { createSkill, listSkillSlugs, skillExistsAnywhere, suggestSlugFromTitle } from './skill-manage-core'
import {
  loadSkillSuggestions,
  saveSkillSuggestions,
  upsertSkillSuggestion,
  type SkillSuggestionCandidate,
} from './skill-suggestions-store'

/** 最少重复次数 */
export const MIN_OCCURRENCES = 5
/** 序列相似度阈值（Jaccard on bigrams + 序列对齐混合） */
export const MIN_SIMILARITY = 0.8
/** 单会话最少工具调用数（过短无意义） */
export const MIN_SEQUENCE_LENGTH = 3
/** 单会话序列截断长度（防极端） */
export const MAX_SEQUENCE_LENGTH = 40

export interface SessionToolTrace {
  sessionId: string
  tools: string[]
  /** 可选标题，用于生成 skill 名 */
  title?: string
}

export interface WorkflowPattern {
  signature: string
  tools: string[]
  sessionIds: string[]
  occurrences: number
  avgSimilarity: number
  suggestedSkillName: string
  suggestedDescription: string
}

/** 规范化工具名：去掉 MCP 前缀噪声，保留末段 */
export function normalizeToolName(name: string): string {
  const raw = name.trim()
  if (!raw) return ''
  // mcp__server__tool → tool；namespace:tool → tool
  const mcp = raw.match(/^mcp__[^_]+__(.+)$/)
  if (mcp?.[1]) return mcp[1]
  const colon = raw.lastIndexOf(':')
  if (colon >= 0 && colon < raw.length - 1) return raw.slice(colon + 1)
  return raw
}

/** 从会话消息中抽取有序 tool_use 名列表 */
export function extractToolSequenceFromMessages(messages: unknown[]): string[] {
  const tools: string[] = []
  for (const msg of messages) {
    if (!msg || typeof msg !== 'object') continue
    const record = msg as {
      events?: Array<{ type?: string; toolName?: string }>
      message?: { content?: unknown }
      content?: unknown
      role?: string
    }

    if (Array.isArray(record.events)) {
      for (const evt of record.events) {
        if (evt?.type === 'tool_start' && typeof evt.toolName === 'string') {
          const n = normalizeToolName(evt.toolName)
          if (n) tools.push(n)
        }
      }
    }

    const content = record.message?.content ?? record.content
    if (Array.isArray(content)) {
      for (const block of content) {
        if (
          block &&
          typeof block === 'object' &&
          'type' in block &&
          (block as { type: unknown }).type === 'tool_use' &&
          'name' in block &&
          typeof (block as { name: unknown }).name === 'string'
        ) {
          const n = normalizeToolName((block as { name: string }).name)
          if (n) tools.push(n)
        }
      }
    }
  }

  if (tools.length > MAX_SEQUENCE_LENGTH) {
    return tools.slice(0, MAX_SEQUENCE_LENGTH)
  }
  return tools
}

/** bigram 集合 Jaccard 相似度 */
export function sequenceSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1
  if (a.length === 0 || b.length === 0) return 0

  const bigrams = (seq: string[]): Set<string> => {
    const set = new Set<string>()
    if (seq.length === 1) {
      set.add(seq[0]!)
      return set
    }
    for (let i = 0; i < seq.length - 1; i++) {
      set.add(`${seq[i]}→${seq[i + 1]}`)
    }
    return set
  }

  const A = bigrams(a)
  const B = bigrams(b)
  let inter = 0
  for (const x of A) {
    if (B.has(x)) inter++
  }
  const union = A.size + B.size - inter
  if (union === 0) return 0
  return inter / union
}

function signatureOf(tools: string[]): string {
  return tools.join('→')
}

/**
 * 从多会话轨迹中聚类重复工作流
 */
export function detectRepeatedWorkflows(traces: SessionToolTrace[]): WorkflowPattern[] {
  const usable = traces
    .map((t) => ({
      ...t,
      tools: t.tools.map(normalizeToolName).filter(Boolean),
    }))
    .filter((t) => t.tools.length >= MIN_SEQUENCE_LENGTH)

  if (usable.length < MIN_OCCURRENCES) return []

  const used = new Set<number>()
  const patterns: WorkflowPattern[] = []

  for (let i = 0; i < usable.length; i++) {
    if (used.has(i)) continue
    const seed = usable[i]!
    const cluster: number[] = [i]
    const sims: number[] = []

    for (let j = i + 1; j < usable.length; j++) {
      if (used.has(j)) continue
      const sim = sequenceSimilarity(seed.tools, usable[j]!.tools)
      if (sim >= MIN_SIMILARITY) {
        cluster.push(j)
        sims.push(sim)
      }
    }

    if (cluster.length < MIN_OCCURRENCES) continue
    for (const idx of cluster) used.add(idx)

    const avgSimilarity =
      sims.length === 0 ? 1 : sims.reduce((s, x) => s + x, 0) / sims.length
    const titleHint =
      usable[cluster[0]!]?.title?.trim() ||
      seed.tools.slice(0, 4).join(' ')
    const suggestedSkillName = suggestSlugFromTitle(titleHint)
    const suggestedDescription = [
      `重复工作流：${seed.tools.join(' → ')}。`,
      `在出现类似多步工具链（约 ${seed.tools.length} 步）时使用本 skill。`,
      `覆盖会话数 ${cluster.length}，平均相似度 ${(avgSimilarity * 100).toFixed(0)}%。`,
    ].join(' ')

    patterns.push({
      signature: signatureOf(seed.tools),
      tools: seed.tools,
      sessionIds: cluster.map((idx) => usable[idx]!.sessionId),
      occurrences: cluster.length,
      avgSimilarity,
      suggestedSkillName,
      suggestedDescription,
    })
  }

  return patterns.sort((a, b) => b.occurrences - a.occurrences)
}

export interface AutoCurateResult {
  candidatesWritten: number
  skillsCreated: string[]
  skipped: Array<{ slug: string; reason: string }>
}

/**
 * 识别结果写入 suggestions；达门槛且无同名 skill 时自动 createSkill
 */
export function applyWorkflowPatterns(
  patterns: WorkflowPattern[],
  options?: { autoCreate?: boolean; workspaceSlug?: string }
): AutoCurateResult {
  const autoCreate = options?.autoCreate !== false
  const now = Date.now()
  const result: AutoCurateResult = {
    candidatesWritten: 0,
    skillsCreated: [],
    skipped: [],
  }

  const existingGlobal = new Set(listSkillSlugs('global'))

  for (const pattern of patterns) {
    let slug = pattern.suggestedSkillName
    if (skillExistsAnywhere(slug, options?.workspaceSlug) || existingGlobal.has(slug)) {
      // 尝试加后缀避免冲突
      const alt = `${slug}-${pattern.occurrences}`
      if (skillExistsAnywhere(alt, options?.workspaceSlug) || existingGlobal.has(alt)) {
        result.skipped.push({ slug, reason: '已存在同类 skill' })
        // 仍写入候选供 UI 可见
      } else {
        slug = alt
      }
    }

    const candidate: SkillSuggestionCandidate = {
      type: 'repeated_workflow',
      pattern: pattern.signature,
      tools: pattern.tools,
      occurrences: pattern.occurrences,
      sessionIds: pattern.sessionIds,
      firstSeenAt: now,
      lastSeenAt: now,
      suggestedSkillName: slug,
      suggestedDescription: pattern.suggestedDescription,
      avgSimilarity: pattern.avgSimilarity,
      status: 'open',
    }
    upsertSkillSuggestion(candidate)
    result.candidatesWritten++

    if (!autoCreate) continue
    if (skillExistsAnywhere(slug, options?.workspaceSlug)) {
      result.skipped.push({ slug, reason: '已存在，跳过创建' })
      continue
    }

    try {
      createSkill({
        slug,
        name: slug,
        description: pattern.suggestedDescription,
        body: [
          `# ${slug}`,
          '',
          pattern.suggestedDescription,
          '',
          '## 推荐工具序列',
          '',
          ...pattern.tools.map((t, i) => `${i + 1}. \`${t}\``),
          '',
          '## 步骤',
          '',
          '1. 确认当前任务与上述工具链匹配',
          '2. 按序列执行，遇到阻塞时说明原因',
          '3. 完成后简要汇报产出路径与验证结果',
          '',
        ].join('\n'),
        scope: 'global',
        provenance: 'background',
        createdBy: 'agent',
        status: 'draft',
      })
      existingGlobal.add(slug)
      result.skillsCreated.push(slug)
      // 标记候选已采纳
      const store = loadSkillSuggestions()
      const hit = store.candidates.find((c) => c.suggestedSkillName === slug && c.status === 'open')
      if (hit) {
        hit.status = 'created'
        hit.lastSeenAt = Date.now()
        saveSkillSuggestions(store)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.skipped.push({ slug, reason: message })
    }
  }

  return result
}

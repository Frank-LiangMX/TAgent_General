/**
 * 看板 goal judge（阶段 A：complete 闸门）
 *
 * 对齐 hermes judge_goal 精神：
 * - 辅助模型读验收标准 + worker 产出
 * - verdict: done | continue | skipped
 * - judge 不可达 / 解析失败 → fail-open（放行 done 由调用方决定）
 *
 * 独立 aux 调用，不改主会话 system prompt（保 Prompt Cache）。
 */

import type { KanbanJudgeResult, KanbanJudgeVerdict, KanbanTask } from '@tagent/shared'

// 注意：channel/settings 仅在 judgeGoal 内动态 import，避免单测加载 electron

export const DEFAULT_GOAL_MAX_TURNS = 20

export interface JudgeGoalInput {
  title: string
  body?: string
  /** 显式验收标准；空则用 title+body */
  acceptanceCriteria?: string
  /** worker 完成摘要 / 产出 */
  summary: string
  /** 可选指定模型 */
  modelId?: string
  /** 可选指定渠道（默认设置里 agent 渠道） */
  channelId?: string
}

/**
 * 组装验收标准文本
 */
export function buildAcceptanceText(task: Pick<
  KanbanTask,
  'title' | 'body' | 'acceptanceCriteria'
>): string {
  if (task.acceptanceCriteria?.trim()) {
    return task.acceptanceCriteria.trim()
  }
  return `${task.title}\n\n${task.body ?? ''}`.trim()
}

export function taskNeedsJudge(task: Pick<KanbanTask, 'goalMode'>): boolean {
  return task.goalMode === true
}

/**
 * 解析 judge LLM 输出（纯函数，可单测）
 *
 * 期望 JSON：{ "verdict": "done"|"continue", "reason": "..." }
 * 兼容裸字符串 done/continue。
 */
export function parseJudgeVerdict(raw: string): {
  verdict: KanbanJudgeVerdict
  reason: string
  parseFailed: boolean
} {
  const text = raw.trim()
  if (!text) {
    return { verdict: 'continue', reason: 'empty judge response', parseFailed: true }
  }

  // 直接 JSON
  try {
    const obj = JSON.parse(text) as { verdict?: string; reason?: string }
    const v = normalizeVerdict(obj.verdict)
    if (v) {
      return {
        verdict: v,
        reason: typeof obj.reason === 'string' && obj.reason.trim() ? obj.reason.trim() : v,
        parseFailed: false,
      }
    }
  } catch {
    // fall through
  }

  // 提取 {...}
  const brace = text.match(/\{[\s\S]*\}/)
  if (brace) {
    try {
      const obj = JSON.parse(brace[0]!) as { verdict?: string; reason?: string }
      const v = normalizeVerdict(obj.verdict)
      if (v) {
        return {
          verdict: v,
          reason: typeof obj.reason === 'string' && obj.reason.trim() ? obj.reason.trim() : v,
          parseFailed: false,
        }
      }
    } catch {
      // fall through
    }
  }

  const lower = text.toLowerCase()
  if (/\b(verdict|status)\s*[:=]\s*["']?done\b/.test(lower) || /^done\b/.test(lower)) {
    return { verdict: 'done', reason: text.slice(0, 200), parseFailed: false }
  }
  if (/\b(verdict|status)\s*[:=]\s*["']?continue\b/.test(lower) || /^continue\b/.test(lower)) {
    return { verdict: 'continue', reason: text.slice(0, 200), parseFailed: false }
  }

  return {
    verdict: 'continue',
    reason: `unparseable judge output: ${text.slice(0, 160)}`,
    parseFailed: true,
  }
}

function normalizeVerdict(v: unknown): KanbanJudgeVerdict | null {
  if (typeof v !== 'string') return null
  const t = v.trim().toLowerCase()
  if (t === 'done' || t === 'pass' || t === 'yes' || t === 'true') return 'done'
  if (t === 'continue' || t === 'fail' || t === 'no' || t === 'false' || t === 'reject') {
    return 'continue'
  }
  if (t === 'skipped' || t === 'skip') return 'skipped'
  return null
}

/**
 * 探测 judge 是否可用（渠道 + 非 kscc + 有 key）
 */
export function isKanbanJudgeAvailable(channelId?: string): boolean {
  try {
    // 动态 import：单测环境无 electron
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getSettings } = require('./settings-service') as typeof import('./settings-service')
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getChannelById, decryptApiKey } =
      require('./channel-manager') as typeof import('./channel-manager')
    const settings = getSettings()
    const cid = channelId?.trim() || settings.agentChannelId
    if (!cid) return false
    const channel = getChannelById(cid)
    if (!channel) return false
    if (channel.provider === 'kscc-internal') return false
    const key = decryptApiKey(cid)
    return Boolean(key)
  } catch {
    return false
  }
}

/**
 * 执行 goal judge
 *
 * 不可达 / API 失败 / 解析失败 → failOpen + verdict done 由调用方 complete 闸门决定：
 * hermes 在 complete 闸门上：不可达则跳过强制；可解析 continue 则拒绝 complete。
 * 本函数：
 * - 不可达 → { verdict: 'skipped', failOpen: true }
 * - API 失败 → { verdict: 'skipped', failOpen: true }
 * - 解析失败 → { verdict: 'continue', parse 失败 reason }（调用方可选择 fail-open 或拒绝）
 */
export async function judgeGoal(input: JudgeGoalInput): Promise<KanbanJudgeResult> {
  const summary = input.summary.trim()
  const criteria =
    input.acceptanceCriteria?.trim() ||
    `${input.title}\n\n${input.body ?? ''}`.trim()

  if (!criteria) {
    return {
      verdict: 'skipped',
      reason: 'empty acceptance criteria',
      failOpen: true,
      judgedAt: Date.now(),
    }
  }
  if (!summary) {
    return {
      verdict: 'continue',
      reason: 'empty summary (nothing to evaluate)',
      judgedAt: Date.now(),
    }
  }

  let settings: { agentChannelId?: string; agentModelId?: string }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    settings = (require('./settings-service') as typeof import('./settings-service')).getSettings()
  } catch {
    return {
      verdict: 'skipped',
      reason: 'settings unavailable — fail-open',
      failOpen: true,
      judgedAt: Date.now(),
    }
  }
  const channelId = input.channelId?.trim() || settings.agentChannelId
  const modelId = input.modelId?.trim() || settings.agentModelId || 'claude-sonnet-4-6'

  if (!channelId || !isKanbanJudgeAvailable(channelId)) {
    return {
      verdict: 'skipped',
      reason: 'judge unavailable (no channel / kscc / no key) — fail-open',
      failOpen: true,
      judgedAt: Date.now(),
      modelId,
    }
  }

  // 测试钩子：不走真实 LLM
  if (process.env.TAGENT_KANBAN_JUDGE_MOCK === '1') {
    const pass = summary.toLowerCase().includes('pass') || /测试通过|全部通过|criteria met/i.test(summary)
    return {
      verdict: pass ? 'done' : 'continue',
      reason: pass ? 'mock judge: pass keyword found' : 'mock judge: pass keyword missing',
      judgedAt: Date.now(),
      modelId: 'mock',
    }
  }

  try {
    const raw = await callJudgeLlm({
      channelId,
      modelId,
      criteria,
      summary,
      title: input.title,
    })
    const parsed = parseJudgeVerdict(raw)
    // 解析失败：complete 闸门侧 fail-open（与 hermes 防御一致）
    if (parsed.parseFailed) {
      return {
        verdict: 'skipped',
        reason: `judge parse failed — fail-open: ${parsed.reason}`,
        failOpen: true,
        judgedAt: Date.now(),
        modelId,
      }
    }
    return {
      verdict: parsed.verdict === 'skipped' ? 'continue' : parsed.verdict,
      reason: parsed.reason,
      judgedAt: Date.now(),
      modelId,
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[KanbanJudge] aux 调用失败，fail-open:', message)
    return {
      verdict: 'skipped',
      reason: `judge error — fail-open: ${message}`,
      failOpen: true,
      judgedAt: Date.now(),
      modelId,
    }
  }
}

async function callJudgeLlm(params: {
  channelId: string
  modelId: string
  criteria: string
  summary: string
  title: string
}): Promise<string> {
  const { getAdapter, getTAgentUserAgent } = await import('@tagent/core')
  type StreamRequestInput = import('@tagent/core').StreamRequestInput
  const { getChannelById, decryptApiKey } = await import('./channel-manager')
  const { getFetchFn } = await import('./proxy-fetch')

  const channel = getChannelById(params.channelId)
  if (!channel) throw new Error(`渠道不存在: ${params.channelId}`)
  if (channel.provider === 'kscc-internal') {
    throw new Error('kscc 渠道不支持 SSE judge')
  }
  const apiKey = decryptApiKey(params.channelId)
  if (!apiKey) throw new Error('无法解密 API Key')

  const systemPrompt = [
    'You are a strict task completion judge for a kanban worker.',
    'Decide if the worker summary satisfies the acceptance criteria.',
    'Reply with ONLY a JSON object: {"verdict":"done"|"continue","reason":"..."}',
    'Use "done" only when criteria are clearly met with evidence in the summary.',
    'Use "continue" if work is incomplete, unproven, or summary lacks evidence.',
  ].join(' ')

  const userPrompt = [
    `## Task title\n${params.title}`,
    `## Acceptance criteria\n${params.criteria.slice(0, 4000)}`,
    `## Worker summary / evidence\n${params.summary.slice(0, 6000)}`,
  ].join('\n\n')

  const adapter = getAdapter(channel.provider)
  const fetchFn = getFetchFn()
  const streamInput: StreamRequestInput = {
    modelId: params.modelId,
    history: [
      {
        id: 'kanban-judge-system',
        role: 'system',
        content: systemPrompt,
        createdAt: Date.now(),
      },
    ],
    userMessage: userPrompt,
    apiKey,
    baseUrl: channel.baseUrl,
    readImageAttachments: () => [],
  }

  const request = adapter.buildStreamRequest(streamInput)
  const response = await fetchFn(request.url, {
    method: 'POST',
    headers: { ...request.headers, 'User-Agent': getTAgentUserAgent() },
    body: request.body,
  })
  if (!response.ok) {
    throw new Error(`LLM 请求失败: ${response.status} ${response.statusText}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('无法获取响应流')

  const decoder = new TextDecoder()
  let accumulated = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const jsonStr = line.slice(6).trim()
      if (!jsonStr || jsonStr === '[DONE]') continue
      try {
        const json = JSON.parse(jsonStr) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
        }
        const delta =
          json.choices?.[0]?.delta?.content ?? json.choices?.[0]?.message?.content ?? ''
        if (delta) accumulated += delta
      } catch {
        // ignore line
      }
    }
  }
  return accumulated
}

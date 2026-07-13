/**
 * Draft Prompt Builder — 将 DraftDocument 转换为 Agent 初始消息
 */

import type { DraftDocument } from '@tagent/shared'

export function buildAgentPrompt(draft: DraftDocument): string {
  let prompt = `## 背景\n\n`

  // context 是 TipTap HTML，提取纯文本/md
  const contextMd = htmlToSimpleMarkdown(draft.context)
  if (contextMd.trim()) {
    prompt += contextMd + '\n\n'
  }

  prompt += `## 需求\n\n`
  for (const req of draft.requirements) {
    prompt += `### ${req.label}: ${req.title}\n`
    if (req.description.trim()) {
      prompt += `${req.description}\n`
    }
    if (req.acceptanceCriteria.length > 0) {
      prompt += `\n验收标准:\n`
      for (const ac of req.acceptanceCriteria) {
        prompt += `- [${ac.checked ? 'x' : ' '}] ${ac.text}\n`
      }
    }
    prompt += '\n'
  }

  prompt += `请根据以上背景和需求执行任务。`
  return prompt
}

function htmlToSimpleMarkdown(html: string): string {
  if (!html) return ''
  // Simple HTML → markdown extraction for prompt context
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    .replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, '> $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

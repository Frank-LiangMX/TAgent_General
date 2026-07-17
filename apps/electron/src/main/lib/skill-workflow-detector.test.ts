import { describe, expect, it } from 'bun:test'

import {
  detectRepeatedWorkflows,
  extractToolSequenceFromMessages,
  MIN_OCCURRENCES,
  normalizeToolName,
  sequenceSimilarity,
  type SessionToolTrace,
} from './skill-workflow-detector'

describe('skill-workflow-detector', () => {
  it('normalizeToolName 去掉 MCP 前缀', () => {
    expect(normalizeToolName('mcp__kanban__kanban_add_task')).toBe('kanban_add_task')
    expect(normalizeToolName('server:Read')).toBe('Read')
    expect(normalizeToolName('Bash')).toBe('Bash')
  })

  it('extractToolSequenceFromMessages 解析 tool_use 与 tool_start', () => {
    const messages = [
      {
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', name: 'Read' },
            { type: 'tool_use', name: 'Edit' },
          ],
        },
      },
      {
        events: [{ type: 'tool_start', toolName: 'Bash' }],
      },
    ]
    expect(extractToolSequenceFromMessages(messages)).toEqual(['Read', 'Edit', 'Bash'])
  })

  it('sequenceSimilarity 对相同序列为 1', () => {
    const seq = ['Read', 'Edit', 'Bash']
    expect(sequenceSimilarity(seq, seq)).toBe(1)
  })

  it('sequenceSimilarity 对无关序列接近 0', () => {
    expect(sequenceSimilarity(['Read', 'Edit'], ['WebSearch', 'Write'])).toBeLessThan(0.3)
  })

  it('detectRepeatedWorkflows 在达到门槛时返回模式', () => {
    const tools = ['Read', 'Edit', 'Bash', 'Read']
    const traces: SessionToolTrace[] = Array.from({ length: MIN_OCCURRENCES }, (_, i) => ({
      sessionId: `s-${i}`,
      tools: [...tools],
      title: 'fix-bug',
    }))
    const patterns = detectRepeatedWorkflows(traces)
    expect(patterns.length).toBeGreaterThanOrEqual(1)
    expect(patterns[0]!.occurrences).toBe(MIN_OCCURRENCES)
    expect(patterns[0]!.tools).toEqual(tools)
  })

  it('detectRepeatedWorkflows 次数不足时不返回', () => {
    const tools = ['Read', 'Edit', 'Bash']
    const traces: SessionToolTrace[] = Array.from({ length: MIN_OCCURRENCES - 1 }, (_, i) => ({
      sessionId: `s-${i}`,
      tools: [...tools],
    }))
    expect(detectRepeatedWorkflows(traces)).toEqual([])
  })
})

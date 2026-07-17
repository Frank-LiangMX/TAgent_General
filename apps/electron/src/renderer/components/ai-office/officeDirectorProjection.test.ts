import { describe, expect, it } from 'vitest'

import { projectOfficeDirector, resolveOfficeDirectorActivity } from './officeDirectorProjection'

describe('Office director projection', () => {
  it('keeps an idle main Agent present without inventing a Kanban task', () => {
    const director = projectOfficeDirector('session-1', {})

    expect(director).toMatchObject({
      kind: 'director',
      id: 'director:session-1',
      state: 'waiting',
      currentTask: '等待你的指示',
    })
    expect(director).not.toHaveProperty('taskId')
    expect(director).not.toHaveProperty('taskStatus')
  })

  it('maps real streaming phases to director activities', () => {
    expect(resolveOfficeDirectorActivity({ running: true, thinkingText: '分析中' }).state).toBe(
      'thinking'
    )
    expect(resolveOfficeDirectorActivity({ running: true, activeToolName: 'Bash' }).state).toBe(
      'working'
    )
    expect(
      resolveOfficeDirectorActivity({ running: true, activeToolName: 'Run tests' }).state
    ).toBe('reviewing')
    expect(resolveOfficeDirectorActivity({ running: true, responseText: '完成了' }).state).toBe(
      'talking'
    )
  })

  it('prioritizes blocking requests over background activity', () => {
    expect(
      resolveOfficeDirectorActivity({
        status: 'blocked',
        running: true,
        activeToolName: 'Bash',
      })
    ).toMatchObject({ state: 'blocked', label: '等待你的确认' })
  })

  it('settles after a completed turn instead of talking forever', () => {
    expect(resolveOfficeDirectorActivity({ status: 'completed' })).toMatchObject({
      state: 'waiting',
      label: '结果已整理，等待下一步',
    })
  })
})

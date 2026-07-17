import { describe, expect, it } from 'vitest'

import { projectOfficeDirector, resolveOfficeDirectorActivity } from './officeDirectorProjection'
import { advanceDirectorAmbient } from './scene/simulation/directorAmbient'

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

  it('shows real team assembly and supervision phases', () => {
    expect(
      resolveOfficeDirectorActivity({ unfinishedTaskCount: 3, activeWorkerCount: 0 })
    ).toMatchObject({ state: 'waiting', semanticState: 'summoning' })
    expect(
      resolveOfficeDirectorActivity({ unfinishedTaskCount: 3, activeWorkerCount: 2 })
    ).toMatchObject({
      state: 'waiting',
      semanticState: 'supervising',
      label: '正在巡视 2 名员工的进度',
    })
  })

  it('uses low-frequency interruptible ambient actions only in full motion mode', () => {
    const director = projectOfficeDirector('session-ambient', {})
    const [waiting] = advanceDirectorAmbient(0, [director], false)
    const [walking] = advanceDirectorAmbient(20, [waiting!], false)
    const [reduced] = advanceDirectorAmbient(20, [director], true)

    expect(waiting?.ambientActivity).toMatchObject({ phase: 'delay', cycle: 0 })
    expect(walking).toMatchObject({
      state: 'walking',
      transition: { kind: 'ambient', targetState: 'waiting' },
      ambientActivity: { phase: 'walking' },
    })
    expect(reduced?.ambientActivity).toBeUndefined()
  })
})

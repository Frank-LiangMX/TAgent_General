import { describe, expect, test } from 'vitest'

import { getAgentSessionVisualState } from './agent-session-visual-state'

describe('Agent 会话列表视觉状态', () => {
  test('选中且运行中时显示运行修饰类和扫光层', () => {
    expect(
      getAgentSessionVisualState({
        active: true,
        indicatorStatus: 'running',
        isBatchMode: false,
        isBatchSelected: false,
        leftAccent: 'blue',
      })
    ).toEqual({
      selectionClassName: 'session-list-item-active session-list-item-active--running',
      showRunningSweep: true,
      statusLineClass: null,
    })
  })

  test('未选中的运行会话只显示底部运行状态线', () => {
    expect(
      getAgentSessionVisualState({
        active: false,
        indicatorStatus: 'running',
        isBatchMode: false,
        isBatchSelected: false,
        leftAccent: 'blue',
      })
    ).toEqual({
      selectionClassName: 'rounded-xl',
      showRunningSweep: false,
      statusLineClass: 'tab-status-streaming',
    })
  })

  test.each(['idle', 'blocked', 'completed'] as const)(
    '选中但状态为 %s 时不显示扫光层',
    (indicatorStatus) => {
      const state = getAgentSessionVisualState({
        active: true,
        indicatorStatus,
        isBatchMode: false,
        isBatchSelected: false,
      })

      expect(state.showRunningSweep).toBe(false)
      expect(state.statusLineClass).toBeNull()
    }
  )

  test('批量选择模式不显示扫光层或后台状态线', () => {
    expect(
      getAgentSessionVisualState({
        active: true,
        indicatorStatus: 'running',
        isBatchMode: true,
        isBatchSelected: true,
        leftAccent: 'blue',
      })
    ).toEqual({
      selectionClassName: 'rounded-xl bg-primary/10',
      showRunningSweep: false,
      statusLineClass: null,
    })
  })
})

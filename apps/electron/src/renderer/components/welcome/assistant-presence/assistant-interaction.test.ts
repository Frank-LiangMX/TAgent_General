import { describe, expect, it } from 'vitest'

import {
  ASSISTANT_TIRED_DURATION_MS,
  INITIAL_ASSISTANT_CLICK_STATE,
  recoverAssistantClickState,
  resolveAssistantClick,
} from './assistant-interaction'

describe('assistant click interaction', () => {
  it('advances through a playful click story', () => {
    let state = INITIAL_ASSISTANT_CLICK_STATE
    const messages: string[] = []
    const gestures: string[] = []

    for (let index = 0; index < 6; index += 1) {
      const interaction = resolveAssistantClick(state, 1000 + index * 300)
      state = interaction.state
      messages.push(interaction.message)
      if (interaction.gesture) gestures.push(interaction.gesture)
    }

    expect(messages).toEqual([
      '嗯？',
      '又点我呀？',
      '有点痒…',
      '等等，慢一点！',
      '要没力气了…',
      '我累了～',
    ])
    expect(gestures.at(-1)).toBe('tired')
    expect(state.tiredUntil).toBe(2500 + ASSISTANT_TIRED_DURATION_MS)
  })

  it('asks for a rest when clicked while tired', () => {
    let state = INITIAL_ASSISTANT_CLICK_STATE
    for (let index = 0; index < 6; index += 1) {
      state = resolveAssistantClick(state, 1000 + index * 200).state
    }

    const interaction = resolveAssistantClick(state, 2300)
    expect(interaction.message).toBe('让我躺一会儿…')
    expect(interaction.gesture).toBeNull()
    expect(interaction.becameTired).toBe(false)
  })

  it('starts over after the click chain expires or recovery completes', () => {
    const first = resolveAssistantClick(INITIAL_ASSISTANT_CLICK_STATE, 1000)
    const restarted = resolveAssistantClick(first.state, 5000)

    expect(restarted.message).toBe('嗯？')
    expect(resolveAssistantClick(recoverAssistantClickState(), 6000).message).toBe('嗯？')
  })
})

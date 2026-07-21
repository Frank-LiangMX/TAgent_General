import type { AssistantGesture } from './assistant-motion'

export const ASSISTANT_CLICK_CHAIN_WINDOW_MS = 2800
export const ASSISTANT_TIRED_DURATION_MS = 4200

export interface AssistantClickState {
  clickCount: number
  lastClickAt: number
  tiredUntil: number
}

export interface AssistantClickInteraction {
  becameTired: boolean
  gesture: AssistantGesture | null
  message: string
  state: AssistantClickState
}

export const INITIAL_ASSISTANT_CLICK_STATE: AssistantClickState = {
  clickCount: 0,
  lastClickAt: 0,
  tiredUntil: 0,
}

const CLICK_STORY: ReadonlyArray<{ gesture: AssistantGesture; message: string }> = [
  { gesture: 'nod', message: '嗯？' },
  { gesture: 'boop', message: '又点我呀？' },
  { gesture: 'wobble', message: '有点痒…' },
  { gesture: 'startle', message: '等等，慢一点！' },
  { gesture: 'dizzy', message: '要没力气了…' },
  { gesture: 'tired', message: '我累了～' },
]

export function resolveAssistantClick(
  previous: AssistantClickState,
  now: number
): AssistantClickInteraction {
  if (previous.tiredUntil > now) {
    return {
      becameTired: false,
      gesture: null,
      message: '让我躺一会儿…',
      state: { ...previous, lastClickAt: now },
    }
  }

  const continuesChain = now - previous.lastClickAt <= ASSISTANT_CLICK_CHAIN_WINDOW_MS
  const clickCount = continuesChain ? Math.min(previous.clickCount + 1, CLICK_STORY.length) : 1
  const story = CLICK_STORY[clickCount - 1] ?? CLICK_STORY[0]!
  const becameTired = clickCount === CLICK_STORY.length

  return {
    becameTired,
    gesture: story.gesture,
    message: story.message,
    state: {
      clickCount,
      lastClickAt: now,
      tiredUntil: becameTired ? now + ASSISTANT_TIRED_DURATION_MS : 0,
    },
  }
}

export function recoverAssistantClickState(): AssistantClickState {
  return INITIAL_ASSISTANT_CLICK_STATE
}

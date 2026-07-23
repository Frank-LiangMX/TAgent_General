/**
 * 欢迎页 Agent 形象风格。
 *
 * 两种形态共享同一套实时渲染与交互，只切换造型语言。
 */

import { atom } from 'jotai'

import {
  DEFAULT_ASSISTANT_PRESENCE_MOTION,
  DEFAULT_ASSISTANT_PRESENCE_STYLE,
  normalizeAssistantPresenceMotion,
  normalizeAssistantPresenceStyle,
  type AssistantPresenceMotion,
  type AssistantPresenceStyle,
} from '../../types'

export const assistantPresenceStyleAtom = atom<AssistantPresenceStyle>(
  DEFAULT_ASSISTANT_PRESENCE_STYLE
)

export const assistantPresenceMotionAtom = atom<AssistantPresenceMotion>(
  DEFAULT_ASSISTANT_PRESENCE_MOTION
)

/** 从应用设置恢复角色形态。 */
export async function initializeAssistantPresenceStyle(
  setStyle: (style: AssistantPresenceStyle) => void
): Promise<void> {
  try {
    const settings = await window.electronAPI.getSettings()
    setStyle(normalizeAssistantPresenceStyle(settings.assistantPresenceStyle))
  } catch (error) {
    console.error('[Agent形象] 初始化失败:', error)
    setStyle(DEFAULT_ASSISTANT_PRESENCE_STYLE)
  }
}

/** 持久化角色形态。 */
export async function updateAssistantPresenceStyle(style: AssistantPresenceStyle): Promise<void> {
  try {
    await window.electronAPI.updateSettings({
      assistantPresenceStyle: normalizeAssistantPresenceStyle(style),
    })
  } catch (error) {
    console.error('[Agent形象] 持久化失败:', error)
  }
}

/** 从应用设置恢复角色动效强度。 */
export async function initializeAssistantPresenceMotion(
  setMotion: (motion: AssistantPresenceMotion) => void
): Promise<void> {
  try {
    const settings = await window.electronAPI.getSettings()
    setMotion(normalizeAssistantPresenceMotion(settings.assistantPresenceMotion))
  } catch (error) {
    console.error('[Agent形象] 初始化动效失败', error)
    setMotion(DEFAULT_ASSISTANT_PRESENCE_MOTION)
  }
}

/** 持久化角色动效强度。 */
export async function updateAssistantPresenceMotion(
  motion: AssistantPresenceMotion
): Promise<void> {
  try {
    await window.electronAPI.updateSettings({
      assistantPresenceMotion: normalizeAssistantPresenceMotion(motion),
    })
  } catch (error) {
    console.error('[Agent形象] 持久化动效失败', error)
  }
}

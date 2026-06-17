/**
 * 文本输出服务
 *
 * 语音输入完成后优先写入 TAgent 输入框，否则尝试写入当前光标位置。
 */

import { BrowserWindow, clipboard } from 'electron'

import { VOICE_DICTATION_IPC_CHANNELS } from '../../types'
import { getMainWindow } from '../index'
import { pasteTextAtCurrentCursor } from './text-insertion-service'

import type { VoiceDictationCommitResult, VoiceDictationSettings } from '../../types'

let targetWasTAgentInput = false

/** 在显示语音浮窗前记录目标是否为 TAgent 主窗口。 */
export function captureVoiceDictationTarget(forceTAgentInput?: boolean): boolean {
  const mainWindow = getMainWindow()
  targetWasTAgentInput = forceTAgentInput ?? BrowserWindow.getFocusedWindow() === mainWindow
  return targetWasTAgentInput
}

export async function commitVoiceDictationText(
  text: string,
  settings: VoiceDictationSettings
): Promise<VoiceDictationCommitResult> {
  const trimmed = text.trim()
  if (!trimmed) {
    return { mode: 'clipboard', success: false, message: '没有可输出的语音文本' }
  }

  const mainWindow = getMainWindow()
  const shouldWriteTAgent =
    settings.outputMode === 'tagent-input' ||
    (settings.outputMode === 'auto' && targetWasTAgentInput)

  if (shouldWriteTAgent && mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(VOICE_DICTATION_IPC_CHANNELS.INSERT_TEXT, { text: trimmed })
    return { mode: 'tagent-input', success: true, message: '已写入 TAgent 输入框' }
  }

  if (settings.outputMode === 'auto') {
    const result = await pasteTextAtCurrentCursor(trimmed)
    return result.success
      ? { mode: 'cursor', success: true, message: result.message }
      : { mode: 'clipboard', success: true, message: result.message }
  }

  clipboard.writeText(trimmed)
  return { mode: 'clipboard', success: true, message: '已复制到剪贴板' }
}

/**
 * SpeechButton - 语音输入按钮
 *
 * 已迁入 @tagent/ui，此文件保留为 re-export + 回调注入。
 */

import { toast } from 'sonner'

import { SpeechButton as BaseSpeechButton } from '@tagent/ui'

import type { ComponentProps } from 'react'

export type SpeechButtonProps = ComponentProps<typeof BaseSpeechButton>

export function SpeechButton(props: SpeechButtonProps) {
  const handleActivate = async () => {
    try {
      const settings = await window.electronAPI.getVoiceDictationSettings()
      if (!settings.enabled) {
        toast.info('请先在设置中打开语音输入开关')
        return
      }
      await window.electronAPI.toggleVoiceDictation()
    } catch (error) {
      console.error('[语音输入] 唤起浮窗失败:', error)
      toast.error('唤起语音输入失败')
    }
  }

  return <BaseSpeechButton {...props} onActivate={handleActivate} />
}

/**
 * ScrollMinimap — 消息导航迷你地图 + 滚动进度条
 *
 * 已迁入 @tagent/ui，此文件保留为 re-export + 回调注入。
 */

import { ScrollMinimap as BaseScrollMinimap } from '@tagent/ui'

import type { ComponentProps } from 'react'

import { useShortcut } from '@/hooks/useShortcut'
import { getModelLogo } from '@/lib/model-logo'

export type ScrollMinimapProps = ComponentProps<typeof BaseScrollMinimap>

export function ScrollMinimap(props: ScrollMinimapProps) {
  const handleShortcutOpen = () => {
    // 快捷键逻辑由应用层处理
  }

  useShortcut('file-find', handleShortcutOpen, (props.items?.length ?? 0) >= 1)

  return (
    <BaseScrollMinimap
      {...props}
      onShortcutOpen={props.onShortcutOpen ?? handleShortcutOpen}
      getModelLogo={props.getModelLogo ?? getModelLogo}
    />
  )
}

export type { MinimapItem } from '@tagent/ui'

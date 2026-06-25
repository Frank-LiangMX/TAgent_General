import * as React from 'react'
import { toast } from 'sonner'

import { processOsFileDrop, type OsFileDropContext } from '@/lib/os-file-drop'

interface UseOsFileDropResult {
  isDragOver: boolean
  dropZoneProps: {
    onDragEnter: (e: React.DragEvent) => void
    onDragOver: (e: React.DragEvent) => void
    onDragOverCapture: (e: React.DragEvent) => void
    onDragLeave: (e: React.DragEvent) => void
    onDrop: (e: React.DragEvent) => void
  }
}

export function useOsFileDrop(ctx: OsFileDropContext, disabled = false): UseOsFileDropResult {
  const [isDragOver, setIsDragOver] = React.useState(false)
  const dragDepthRef = React.useRef(0)
  const ctxRef = React.useRef(ctx)
  ctxRef.current = ctx

  const allowDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (disabled) return
      e.preventDefault()
      e.stopPropagation()
      if (e.dataTransfer.types.includes('Files')) {
        e.dataTransfer.dropEffect = 'copy'
      }
    },
    [disabled]
  )

  const onDragEnter = React.useCallback(
    (e: React.DragEvent) => {
      allowDrop(e)
      if (disabled) return
      dragDepthRef.current += 1
      if (e.dataTransfer.types.includes('Files')) {
        setIsDragOver(true)
      }
    },
    [allowDrop, disabled]
  )

  const onDragOver = React.useCallback(
    (e: React.DragEvent) => {
      allowDrop(e)
      if (!disabled && e.dataTransfer.types.includes('Files')) {
        setIsDragOver(true)
      }
    },
    [allowDrop, disabled]
  )

  const onDragOverCapture = React.useCallback(
    (e: React.DragEvent) => {
      if (disabled) return
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    },
    [disabled]
  )

  const onDragLeave = React.useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
    if (dragDepthRef.current === 0) {
      setIsDragOver(false)
    }
  }, [])

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      if (disabled) return
      dragDepthRef.current = 0
      setIsDragOver(false)
      allowDrop(e)
      void processOsFileDrop(e, ctxRef.current).catch((error: unknown) => {
        console.error('[OS 文件拖放] 处理失败:', error)
        toast.error('文件拖放失败')
      })
    },
    [allowDrop, disabled]
  )

  return {
    isDragOver,
    dropZoneProps: { onDragEnter, onDragOver, onDragOverCapture, onDragLeave, onDrop },
  }
}

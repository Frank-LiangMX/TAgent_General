/**
 * BlenderPathConfig - Blender 路径配置
 */

import { FolderOpen, Check, AlertCircle } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function BlenderPathConfig(): React.ReactElement {
  const [blenderPath, setBlenderPath] = React.useState('')
  const [isValid, setIsValid] = React.useState<boolean | null>(null)

  const handleValidate = React.useCallback(() => {
    // MVP 占位：模拟验证
    if (blenderPath.includes('blender')) {
      setIsValid(true)
    } else if (blenderPath) {
      setIsValid(false)
    }
  }, [blenderPath])

  const handleBrowse = React.useCallback(() => {
    // MVP 占位：需要 IPC 调用文件选择对话框
    console.log('Browse for Blender path')
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          value={blenderPath}
          onChange={(e) => {
            setBlenderPath(e.target.value)
            setIsValid(null)
          }}
          placeholder="例如: C:/Program Files/Blender Foundation/Blender 4.2/blender.exe"
          className="flex-1"
        />
        <Button variant="outline" size="icon" onClick={handleBrowse}>
          <FolderOpen size={16} />
        </Button>
      </div>

      {/* 验证状态 */}
      {isValid !== null && (
        <div className="flex items-center gap-2 text-xs">
          {isValid ? (
            <>
              <Check size={14} className="text-emerald-500" />
              <span className="text-emerald-500">路径有效</span>
            </>
          ) : (
            <>
              <AlertCircle size={14} className="text-red-500" />
              <span className="text-red-500">路径无效或未找到 Blender</span>
            </>
          )}
        </div>
      )}

      {/* 验证按钮 */}
      {blenderPath && isValid === null && (
        <Button variant="secondary" size="sm" onClick={handleValidate} className="h-7">
          验证路径
        </Button>
      )}
    </div>
  )
}

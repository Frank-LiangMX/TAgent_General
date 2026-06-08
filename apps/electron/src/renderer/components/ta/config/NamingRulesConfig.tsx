/**
 * NamingRulesConfig - 命名规范配置
 */

import { Info } from 'lucide-react'
import * as React from 'react'

import { Input } from '@/components/ui/input'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'

const namingPrefixes = [
  { type: '网格 (Mesh)', prefix: 'SM_', example: 'SM_Character_Hero' },
  { type: '纹理 (Texture)', prefix: 'T_', example: 'T_Wood_BaseColor' },
  { type: '材质 (Material)', prefix: 'M_', example: 'M_Standard_Wood' },
  { type: '骨架 (Skeleton)', prefix: 'SK_', example: 'SK_Character' },
  { type: '动画 (Animation)', prefix: 'A_', example: 'A_Hero_Walk' },
]

export function NamingRulesConfig(): React.ReactElement {
  return (
    <div className="space-y-4">
      {/* 前缀规范 */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">资产类型前缀</div>
        <div className="grid gap-2">
          {namingPrefixes.map(({ type, prefix, example }) => (
            <div key={type} className="flex items-center gap-3">
              <div className="text-xs text-foreground/80 w-[100px]">{type}</div>
              <Input value={prefix} className="w-[80px] h-7 text-xs" readOnly />
              <Tooltip>
                <TooltipTrigger>
                  <span className="text-xs text-muted-foreground cursor-help">{example}</span>
                </TooltipTrigger>
                <TooltipContent>示例命名</TooltipContent>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>

      {/* 禁用字符 */}
      <div>
        <div className="text-xs text-muted-foreground mb-2">禁用字符</div>
        <div className="flex items-center gap-2 text-xs">
          <Input value="空格、连字符(-)、特殊符号" className="flex-1 h-7" readOnly />
          <Tooltip>
            <TooltipTrigger>
              <Info size={14} className="text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent>
              UE5 资产名必须以大写字母开头，不能包含空格或特殊字符
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}
/**
 * BudgetConfig - 资产预算配置
 */

import * as React from 'react'

import { Input } from '@/components/ui/input'

const budgetDefaults = [
  { type: 'LOD0 多边形', value: '50000', unit: '三角形' },
  { type: 'LOD1 多边形', value: '25000', unit: '三角形' },
  { type: 'LOD2 多边形', value: '12500', unit: '三角形' },
  { type: '纹理尺寸', value: '4096', unit: '像素' },
]

export function BudgetConfig(): React.ReactElement {
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground mb-2">资产预算限制</div>
      <div className="grid gap-2">
        {budgetDefaults.map(({ type, value, unit }) => (
          <div key={type} className="flex items-center gap-3">
            <div className="text-xs text-foreground/80 w-[120px]">{type}</div>
            <Input defaultValue={value} className="w-[100px] h-7 text-xs" type="number" />
            <span className="text-xs text-muted-foreground">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
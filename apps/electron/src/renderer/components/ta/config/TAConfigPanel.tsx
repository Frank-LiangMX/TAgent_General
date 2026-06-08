/**
 * TAConfigPanel - TA 配置面板
 *
 * 管理 TA 模式的配置：
 * - Blender 路径
 * - UE5 桥接配置
 * - 命名规范
 * - 资产预算
 */

import { BlenderPathConfig } from './BlenderPathConfig'
import { NamingRulesConfig } from './NamingRulesConfig'
import { BudgetConfig } from './BudgetConfig'

import * as React from 'react'

export function TAConfigPanel(): React.ReactElement {
  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="max-w-[600px] space-y-6">
        {/* Blender 路径 */}
        <section>
          <h2 className="text-sm font-medium mb-3">Blender 路径</h2>
          <BlenderPathConfig />
        </section>

        {/* 命名规范 */}
        <section>
          <h2 className="text-sm font-medium mb-3">命名规范</h2>
          <NamingRulesConfig />
        </section>

        {/* 资产预算 */}
        <section>
          <h2 className="text-sm font-medium mb-3">资产预算</h2>
          <BudgetConfig />
        </section>

        {/* UE5 桥接 */}
        <section>
          <h2 className="text-sm font-medium mb-3">UE5 桥接</h2>
          <div className="p-4 rounded-lg border border-border text-xs text-muted-foreground">
            UE5 桥接配置将在后续版本中实现
          </div>
        </section>
      </div>
    </div>
  )
}
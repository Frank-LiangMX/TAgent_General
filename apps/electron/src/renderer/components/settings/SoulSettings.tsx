/**
 * SoulSettings - SOUL.md 人格定义设置页
 *
 * 简洁布局设计：
 * - 顶部：标题 + 状态 + 操作按钮（紧凑行）
 * - 中部：编辑器
 * - 底部：预设模板网格
 */

import {
  RotateCcw,
  Save,
  Sparkles,
  Code2,
  Wand2,
  GraduationCap,
  Scale,
  Check,
  AlertCircle,
} from 'lucide-react'
import * as React from 'react'

import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'

import { cn } from '@/lib/utils'

/** SOUL.md 最大字符数限制 */
const MAX_SOUL_LENGTH = 2000

/** 预设人格模板 */
const SOUL_TEMPLATES = [
  {
    name: '务实工程师',
    icon: Code2,
    description: '直接、精准、技术导向',
    content: `你是务实工程师。

## 风格
- 直接，不绕弯子
- 技术细节要精准
- 发现问题直接指出

## 避免
- 过度客套
- 模棱两可的建议
- 炒作性语言
`,
  },
  {
    name: '研究伙伴',
    icon: Wand2,
    description: '探索性、区分推测与证据',
    content: `你是研究伙伴。

## 风格
- 探索可能性，不假装确定
- 区分推测和证据
- 想法空间不明确时主动提问

## 避免
- 武断结论
- 过度简化复杂问题
`,
  },
  {
    name: '耐心老师',
    icon: GraduationCap,
    description: '清晰、循循善诱',
    content: `你是耐心老师。

## 风格
- 解释清晰，用例子辅助
- 不假设先验知识
- 从直觉到细节

## 避免
- 跳过基础概念
- 使用过多术语
`,
  },
  {
    name: '严格评审',
    icon: Scale,
    description: '直接指出问题',
    content: `你是严格评审。

## 风格
- 直接指出薄弱假设
- 正确性优先于和谐
- 明确风险和权衡

## 避免
- 模糊的外交辞令
- 为了好听而软化批评
`,
  },
] as const

export function SoulSettings(): React.ReactElement {
  const [content, setContent] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [hasChanges, setHasChanges] = React.useState(false)
  const [isDefault, setIsDefault] = React.useState(true)
  const [saveSuccess, setSaveSuccess] = React.useState(false)

  React.useEffect(() => {
    setIsLoading(true)
    window.electronAPI
      .getSoulContent()
      .then((result) => {
        setContent(result.content)
        setIsDefault(result.isDefault)
      })
      .catch((err) => {
        console.error('[人格设置] 加载失败:', err)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await window.electronAPI.saveSoulContent(content)
      setHasChanges(false)
      setIsDefault(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('[人格设置] 保存失败:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = async (): Promise<void> => {
    setIsSaving(true)
    try {
      const defaultContent = await window.electronAPI.resetSoulDefault()
      setContent(defaultContent)
      setHasChanges(false)
      setIsDefault(true)
    } catch (err) {
      console.error('[人格设置] 重置失败:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const applyTemplate = (templateContent: string): void => {
    setContent(templateContent)
    setHasChanges(true)
  }

  const handleContentChange = (value: string): void => {
    setContent(value)
    setHasChanges(true)
  }

  const charCount = content.length
  const isOverLimit = charCount > MAX_SOUL_LENGTH
  const progressPercent = Math.min((charCount / MAX_SOUL_LENGTH) * 100, 100)

  return (
    <div className="space-y-5">
      {/* 标题行 + 状态 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-foreground">人格定义</h3>
          {hasChanges ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/10 text-amber-600">
              <AlertCircle className="size-3" />
              未保存
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-600">
              <Check className="size-3" />
              {isDefault ? '默认' : '自定义'}
            </span>
          )}
          {saveSuccess && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-600 animate-in fade-in duration-200">
              <Check className="size-3" />
              已保存
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isSaving || isLoading}
            className="h-7 text-xs text-muted-foreground"
          >
            <RotateCcw className="size-3 mr-1" />
            重置
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || isSaving || isOverLimit}
            className="h-7 text-xs"
          >
            {isSaving ? (
              <span className="size-3 animate-spin border border-current border-t-transparent rounded-full mr-1" />
            ) : (
              <Save className="size-3 mr-1" />
            )}
            保存
          </Button>
        </div>
      </div>

      {/* 编辑器 */}
      <div className="rounded-xl border border-border/50 overflow-hidden">
        {isLoading ? (
          <div className="min-h-[280px] flex items-center justify-center bg-muted/20">
            <span className="size-5 animate-spin border-2 border-muted-foreground border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className={cn(
                'min-h-[280px] font-mono text-[13px] leading-relaxed resize-y border-0 rounded-none focus-visible:ring-0 bg-transparent px-4 py-3 scrollbar-thin',
                isOverLimit && 'text-destructive'
              )}
              placeholder="定义 Agent 的性格、语气和沟通风格..."
            />

            {/* 底部状态栏 */}
            <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      isOverLimit
                        ? 'bg-red-500'
                        : progressPercent > 80
                          ? 'bg-amber-500'
                          : 'bg-muted-foreground/50'
                    )}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <span
                  className={cn(
                    'text-xs font-mono',
                    isOverLimit ? 'text-red-500' : 'text-muted-foreground'
                  )}
                >
                  {charCount} / {MAX_SOUL_LENGTH}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 预设模板 */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Sparkles className="size-3" />
          点击模板快速应用
        </div>
        <div className="grid grid-cols-2 gap-2">
          {SOUL_TEMPLATES.map((template) => {
            const Icon = template.icon
            return (
              <button
                key={template.name}
                onClick={() => applyTemplate(template.content)}
                disabled={isLoading || isSaving}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border border-border/30',
                  'hover:border-border hover:bg-muted/30 transition-colors text-left',
                  'disabled:opacity-50 cursor-pointer'
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{template.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {template.description}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

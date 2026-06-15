/**
 * SoulSettings - SOUL.md 人格定义设置页
 *
 * 设计风格：Data-Dense Dashboard + Clean Editorial
 * 配色：Cyan primary + Clean green CTA
 * 排版：Fira Code / Fira Sans (dashboard technical)
 *
 * 结构：
 * - Hero 区：人格预览卡片
 * - 编辑区：Markdown 编辑器 + 实时预览
 * - 模板区：Bento Grid 布局的预设模板
 */

import { RotateCcw, Save, Sparkles, User, Wand2, Code2, GraduationCap, Scale, Check, AlertCircle } from 'lucide-react'
import * as React from 'react'

import {
  SettingsSection,
  SettingsCard,
} from './primitives'
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
    color: 'from-slate-500 to-slate-600',
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
    color: 'from-violet-500 to-purple-600',
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
    color: 'from-emerald-500 to-teal-600',
    description: '清晰、循循善诱、无术语门槛',
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
    color: 'from-rose-500 to-red-600',
    description: '直接指出问题、正确性优先',
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

  // 加载 SOUL.md 内容
  React.useEffect(() => {
    setIsLoading(true)
    window.electronAPI.getSoulContent()
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

  // 保存 SOUL.md
  const handleSave = async (): Promise<void> => {
    setIsSaving(true)
    setSaveSuccess(false)
    try {
      await window.electronAPI.saveSoulContent(content)
      setHasChanges(false)
      setIsDefault(false)
      setSaveSuccess(true)
      // 3秒后隐藏成功提示
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      console.error('[人格设置] 保存失败:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // 重置为默认
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

  // 应用预设模板
  const applyTemplate = (templateContent: string): void => {
    setContent(templateContent)
    setHasChanges(true)
  }

  // 内容变更
  const handleContentChange = (value: string): void => {
    setContent(value)
    setHasChanges(true)
  }

  const charCount = content.length
  const isOverLimit = charCount > MAX_SOUL_LENGTH
  const progressPercent = Math.min((charCount / MAX_SOUL_LENGTH) * 100, 100)

  return (
    <div className="space-y-6 pb-8">
      {/* Hero 预览卡片 */}
      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-cyan-50 via-white to-emerald-50 dark:from-cyan-950/30 dark:via-background dark:to-emerald-950/30 border border-cyan-100 dark:border-cyan-900/50 p-6">
        {/* 背景装饰 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-cyan-200/30 to-emerald-200/30 dark:from-cyan-800/20 dark:to-emerald-800/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

        <div className="relative flex items-start gap-4">
          <div className="shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <User className="size-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-foreground mb-1">
              Agent 人格定义
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              定义你的 AI 助手的性格、语气和沟通风格。
              <span className="text-cyan-600 dark:text-cyan-400 font-medium"> 编辑后下次新建会话生效。</span>
            </p>
            <div className="flex items-center gap-3 mt-3">
              <div className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
                hasChanges
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              )}>
                {hasChanges ? (
                  <>
                    <AlertCircle className="size-3.5" />
                    有未保存的更改
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
                    {isDefault ? '使用默认人格' : '自定义人格'}
                  </>
                )}
              </div>
              {saveSuccess && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 animate-in fade-in slide-in-from-bottom-1 duration-200">
                  <Check className="size-3.5" />
                  已保存
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 编辑区 */}
      <SettingsSection
        title="人格定义"
        action={
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isSaving || isLoading}
            className="text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-4 mr-1.5" />
            重置默认
          </Button>
        }
      >
        <SettingsCard className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="min-h-[320px] flex items-center justify-center bg-muted/20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-muted-foreground">加载中...</span>
              </div>
            </div>
          ) : (
            <>
              {/* 编辑器 */}
              <div className="relative">
                <Textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className={cn(
                    'min-h-[320px] font-mono text-[13px] leading-relaxed resize-y border-0 rounded-none focus-visible:ring-0 bg-transparent px-4 py-4',
                    isOverLimit && 'text-destructive'
                  )}
                  placeholder="编辑 Agent 的人格定义...

示例：
你是务实的 AI 助手。

## 风格
- 简洁直接
- 技术精准

## 避免
- 过度客套
"
                />
              </div>

              {/* 底部状态栏 */}
              <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-t border-border/50">
                <div className="flex items-center gap-3">
                  {/* 字数进度条 */}
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          isOverLimit
                            ? "bg-destructive"
                            : progressPercent > 80
                              ? "bg-amber-500"
                              : "bg-cyan-500"
                        )}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-xs font-mono',
                      isOverLimit ? 'text-destructive font-medium' : 'text-muted-foreground'
                    )}>
                      {charCount.toLocaleString()} / {MAX_SOUL_LENGTH.toLocaleString()}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || isSaving || isOverLimit}
                  className={cn(
                    "gap-1.5 transition-all",
                    hasChanges && !isOverLimit && "bg-cyan-600 hover:bg-cyan-700 text-white"
                  )}
                >
                  {isSaving ? (
                    <>
                      <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="size-4" />
                      保存更改
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </SettingsCard>
      </SettingsSection>

      {/* 预设模板 - Bento Grid */}
      <SettingsSection title="预设模板">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SOUL_TEMPLATES.map((template) => {
            const Icon = template.icon
            return (
              <button
                key={template.name}
                onClick={() => applyTemplate(template.content)}
                disabled={isLoading || isSaving}
                className={cn(
                  "group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 text-left transition-all duration-200",
                  "hover:border-border hover:shadow-md hover:shadow-black/5 dark:hover:shadow-black/20",
                  "focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:ring-offset-2 focus:ring-offset-background",
                  "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                )}
              >
                {/* 背景装饰 */}
                <div className={cn(
                  "absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-300 bg-gradient-to-br",
                  template.color
                )} />

                <div className="relative flex items-start gap-3">
                  <div className={cn(
                    "shrink-0 w-10 h-10 rounded-lg flex items-center justify-center bg-gradient-to-br shadow-sm",
                    template.color
                  )}>
                    <Icon className="size-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground text-sm mb-0.5">
                      {template.name}
                    </h4>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {template.description}
                    </p>
                  </div>
                  <Sparkles className="size-4 text-muted-foreground/50 group-hover:text-cyan-500 group-hover:rotate-12 transition-all duration-200 shrink-0 mt-1" />
                </div>
              </button>
            )
          })}
        </div>

        {/* 提示文字 */}
        <p className="text-xs text-muted-foreground/70 mt-3 flex items-center gap-1.5">
          <Wand2 className="size-3" />
          点击模板卡片快速应用，然后根据需要微调内容
        </p>
      </SettingsSection>
    </div>
  )
}
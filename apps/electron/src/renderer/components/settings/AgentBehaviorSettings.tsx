/**
 * Agent 行为设置面板
 *
 * 整合 Agent 行为相关配置：
 * - auto-check hook 开关 + 语言级精细配置
 * - SubAgent 派发积极性档位
 * - 看板 worker 模型分配规则（避免并行降智）
 *
 * 使用 TAgent 统一的 settings primitives 组件，风格与 ProxySettings 等保持一致。
 */

import * as React from 'react'
import { useAtom } from 'jotai'

import { subagentEagernessAtom } from '@/atoms/agent-atoms'
import type { SubagentEagerness } from '@/atoms/agent-atoms'
import type { AutoCheckLanguage, LanguageHookConfig } from '@tagent/shared'
import { SettingsSection, SettingsCard, SettingsToggle, SettingsSelect } from './primitives'
import { Switch } from '../ui/switch'
import { Input } from '../ui/input'
import { cn } from '@/lib/utils'

/** SubAgent 档位选项 */
const EAGERNESS_OPTIONS = [
  { value: 'never', label: '从不派发' },
  { value: 'conservative', label: '保守（推荐）' },
  { value: 'balanced', label: '平衡' },
  { value: 'aggressive', label: '积极' },
]

/** 单模型最大并发数档位选项 */
const MAX_CONCURRENT_PER_MODEL_OPTIONS = [
  { value: '1', label: '1（最稳，无并行降智）' },
  { value: '2', label: '2（推荐，平衡吞吐与稳定性）' },
  { value: '3', label: '3（较高吞吐，可能触发限流）' },
  { value: '4', label: '4（高吞吐，需渠道支持）' },
  { value: '5', label: '5（激进，仅免费渠道建议）' },
]

/** 看板默认并发上限档位选项 */
const DEFAULT_MAX_CONCURRENT_OPTIONS = [
  { value: '3', label: '3（保守，适合小任务）' },
  { value: '4', label: '4' },
  { value: '5', label: '5（推荐，kscc 6 模型可充分并行）' },
  { value: '6', label: '6（激进，需渠道支持）' },
  { value: '8', label: '8（高并行，适合批量任务）' },
]

/** 各语言的展示信息 + 默认配置 */
const LANGUAGE_INFO: Array<{
  id: AutoCheckLanguage
  label: string
  desc: string
  defaultEnabled: boolean
  defaultTimeoutSec: number
}> = [
  {
    id: 'typescript',
    label: 'TypeScript',
    desc: 'tsconfig.json — tsc --noEmit',
    defaultEnabled: true,
    defaultTimeoutSec: 60,
  },
  {
    id: 'javascript',
    label: 'JavaScript',
    desc: 'package.json — npm run lint',
    defaultEnabled: true,
    defaultTimeoutSec: 60,
  },
  {
    id: 'python',
    label: 'Python',
    desc: 'pyproject.toml — ruff / mypy',
    defaultEnabled: true,
    defaultTimeoutSec: 60,
  },
  {
    id: 'rust',
    label: 'Rust',
    desc: 'Cargo.toml — cargo check',
    defaultEnabled: true,
    defaultTimeoutSec: 120,
  },
  { id: 'go', label: 'Go', desc: 'go.mod — go vet', defaultEnabled: true, defaultTimeoutSec: 60 },
  {
    id: 'lua',
    label: 'Lua',
    desc: '.luacheckrc — luacheck',
    defaultEnabled: true,
    defaultTimeoutSec: 60,
  },
  {
    id: 'cpp',
    label: 'C / C++',
    desc: 'CMakeLists.txt — cmake --build（编译慢，默认关）',
    defaultEnabled: false,
    defaultTimeoutSec: 180,
  },
  {
    id: 'java',
    label: 'Java',
    desc: 'pom.xml — mvn compile（编译慢，默认关）',
    defaultEnabled: false,
    defaultTimeoutSec: 180,
  },
]

export function AgentBehaviorSettings(): React.ReactElement {
  const [autoCheckEnabled, setAutoCheckEnabled] = React.useState<boolean>(true)
  const [subagentEagerness, setSubagentEagerness] = useAtom(subagentEagernessAtom)
  const [languagesConfig, setLanguagesConfig] = React.useState<
    Partial<Record<AutoCheckLanguage, LanguageHookConfig>>
  >({})
  const [langPanelOpen, setLangPanelOpen] = React.useState(false)
  // 看板 worker 模型分配设置
  const [maxConcurrentPerModel, setMaxConcurrentPerModel] = React.useState<number>(2)
  const [preferFreeChannel, setPreferFreeChannel] = React.useState<boolean>(true)
  const [allowExternalModels, setAllowExternalModels] = React.useState<boolean>(false)
  // 看板默认并发上限
  const [defaultMaxConcurrent, setDefaultMaxConcurrent] = React.useState<number>(3)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    window.electronAPI
      .getSettings()
      .then((settings) => {
        const enabled = settings.hooks?.autoCheck ?? settings.hooks?.autoTypecheck ?? true
        setAutoCheckEnabled(enabled)
        setLanguagesConfig(settings.hooks?.languages ?? {})
        // 看板模型分配设置（默认值：2 / true / false）
        const ab = settings.agentBehavior
        setMaxConcurrentPerModel(ab?.maxConcurrentPerModel ?? 2)
        setPreferFreeChannel(ab?.preferFreeChannel ?? true)
        setAllowExternalModels(ab?.allowExternalModels ?? false)
        setDefaultMaxConcurrent(ab?.defaultMaxConcurrent ?? 3)
        setLoaded(true)
      })
      .catch((err) => {
        console.error('[Agent 行为设置] 读取失败:', err)
        setLoaded(true)
      })
  }, [])

  const handleAutoCheckChange = async (checked: boolean): Promise<void> => {
    setAutoCheckEnabled(checked)
    try {
      await window.electronAPI.updateSettings({ hooks: { autoCheck: checked } })
    } catch (error) {
      console.error('[Agent 行为设置] 更新 auto-check 失败:', error)
      setAutoCheckEnabled(!checked)
    }
  }

  const handleEagernessChange = async (value: string): Promise<void> => {
    const v = value as SubagentEagerness
    setSubagentEagerness(v)
    try {
      await window.electronAPI.updateSettings({ subagentEagerness: v })
    } catch (error) {
      console.error('[Agent 行为设置] 更新 SubAgent 积极性失败:', error)
    }
  }

  const handleMaxConcurrentPerModelChange = async (value: string): Promise<void> => {
    const n = parseInt(value, 10)
    if (Number.isNaN(n) || n < 1 || n > 5) return
    setMaxConcurrentPerModel(n)
    try {
      await window.electronAPI.updateSettings({
        agentBehavior: { maxConcurrentPerModel: n },
      })
    } catch (error) {
      console.error('[Agent 行为设置] 更新单模型并发上限失败:', error)
    }
  }

  const handlePreferFreeChannelChange = async (checked: boolean): Promise<void> => {
    setPreferFreeChannel(checked)
    try {
      await window.electronAPI.updateSettings({
        agentBehavior: { preferFreeChannel: checked },
      })
    } catch (error) {
      console.error('[Agent 行为设置] 更新优先免费渠道失败:', error)
      setPreferFreeChannel(!checked)
    }
  }

  const handleAllowExternalModelsChange = async (checked: boolean): Promise<void> => {
    setAllowExternalModels(checked)
    try {
      await window.electronAPI.updateSettings({
        agentBehavior: { allowExternalModels: checked },
      })
    } catch (error) {
      console.error('[Agent 行为设置] 更新允许外部模型失败:', error)
      setAllowExternalModels(!checked)
    }
  }

  const handleDefaultMaxConcurrentChange = async (value: string): Promise<void> => {
    const n = parseInt(value, 10)
    if (Number.isNaN(n) || n < 1 || n > 10) return
    setDefaultMaxConcurrent(n)
    try {
      await window.electronAPI.updateSettings({
        agentBehavior: { defaultMaxConcurrent: n },
      })
    } catch (error) {
      console.error('[Agent 行为设置] 更新默认并发上限失败:', error)
    }
  }

  const handleLanguageConfigChange = async (
    langId: AutoCheckLanguage,
    updates: Partial<LanguageHookConfig>
  ): Promise<void> => {
    const current = languagesConfig[langId] ?? {}
    const next = { ...current, ...updates }
    const newConfig = { ...languagesConfig, [langId]: next }
    setLanguagesConfig(newConfig)
    try {
      await window.electronAPI.updateSettings({ hooks: { languages: newConfig } })
    } catch (error) {
      console.error(`[Agent 行为设置] 更新 ${langId} 配置失败:`, error)
    }
  }

  if (!loaded) {
    return <div className="p-6 text-sm text-muted-foreground">加载中...</div>
  }

  return (
    <div className="space-y-6">
      {/* 自动检查 */}
      <SettingsSection
        title="自动检查"
        description="Agent 编辑代码文件后自动跑项目配置的检查命令，错误回灌让 Agent 自行修复"
      >
        <SettingsCard>
          <SettingsToggle
            label="改代码后自动检查"
            description="支持 TypeScript / JavaScript / Python / Rust / Go / Lua / C++ / Java，非代码项目自动跳过"
            checked={autoCheckEnabled}
            onCheckedChange={handleAutoCheckChange}
          />
        </SettingsCard>

        {/* 语言级精细配置（可展开） */}
        {autoCheckEnabled && (
          <div className="mt-2">
            <button
              onClick={() => setLangPanelOpen(!langPanelOpen)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full"
            >
              <svg
                className={cn('size-3 transition-transform', langPanelOpen && 'rotate-90')}
                viewBox="0 0 12 12"
                fill="none"
              >
                <path
                  d="M4 2L8 6L4 10"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              按语言精细配置
            </button>
            {langPanelOpen && (
              <SettingsCard divided>
                {LANGUAGE_INFO.map((lang) => {
                  const userCfg = languagesConfig[lang.id] ?? {}
                  const enabled = userCfg.enabled ?? lang.defaultEnabled
                  const timeoutSec = userCfg.timeoutSec ?? lang.defaultTimeoutSec
                  const isDefault =
                    (userCfg.enabled ?? lang.defaultEnabled) === lang.defaultEnabled &&
                    (userCfg.timeoutSec ?? lang.defaultTimeoutSec) === lang.defaultTimeoutSec
                  return (
                    <div key={lang.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{lang.label}</span>
                          {!isDefault && (
                            <span className="text-[10px] text-amber-500 dark:text-amber-400">
                              已自定义
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{lang.desc}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Input
                          type="number"
                          min={10}
                          max={600}
                          value={timeoutSec}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10)
                            if (!Number.isNaN(val) && val >= 10 && val <= 600) {
                              handleLanguageConfigChange(lang.id, { timeoutSec: val })
                            }
                          }}
                          className="w-[60px] h-7 text-xs"
                        />
                        <span className="text-[10px] text-muted-foreground">秒</span>
                        <Switch
                          checked={enabled}
                          onCheckedChange={(checked) =>
                            handleLanguageConfigChange(lang.id, { enabled: checked })
                          }
                        />
                      </div>
                    </div>
                  )
                })}
              </SettingsCard>
            )}
          </div>
        )}
      </SettingsSection>

      {/* SubAgent 派发 */}
      <SettingsSection
        title="SubAgent 派发"
        description="主 Agent 在什么条件下把子任务委派给 SubAgent 并行处理"
      >
        <SettingsCard>
          <SettingsSelect
            label="派发积极性"
            description="never=从不派发 / conservative=批量≥5才派（默认） / balanced=批量≥3即派 / aggressive=能派就派"
            value={subagentEagerness}
            onValueChange={handleEagernessChange}
            options={EAGERNESS_OPTIONS}
          />
        </SettingsCard>
      </SettingsSection>

      {/* 看板 worker 模型分配 */}
      <SettingsSection
        title="看板 worker 模型分配"
        description="看板任务并行执行时如何分配模型，避免同模型过度并发触发降智"
      >
        <SettingsCard>
          <SettingsSelect
            label="看板默认并发上限"
            description="新建看板的最大并发任务数。kscc 有 6 个模型，建议 5 充分并行；保守场景选 3。已有看板的并发数不变。"
            value={String(defaultMaxConcurrent)}
            onValueChange={handleDefaultMaxConcurrentChange}
            options={DEFAULT_MAX_CONCURRENT_OPTIONS}
          />
        </SettingsCard>
        <SettingsCard>
          <SettingsSelect
            label="单模型最大并发数"
            description="同一模型同时跑的 worker 数上限，超限自动切换渠道下一个可用模型。kscc 单模型建议 2，避免限流降智。"
            value={String(maxConcurrentPerModel)}
            onValueChange={handleMaxConcurrentPerModelChange}
            options={MAX_CONCURRENT_PER_MODEL_OPTIONS}
          />
        </SettingsCard>
        <SettingsCard>
          <SettingsToggle
            label="优先免费渠道"
            description="未指定模型时优先用 kscc（免费）渠道的可用模型，避免调用外部收费模型"
            checked={preferFreeChannel}
            onCheckedChange={handlePreferFreeChannelChange}
          />
        </SettingsCard>
        <SettingsCard>
          <SettingsToggle
            label="允许使用外部模型"
            description="关闭时 worker 只用免费渠道模型；开启后可在白名单内使用外部收费模型（如 Claude / GPT）"
            checked={allowExternalModels}
            onCheckedChange={handleAllowExternalModelsChange}
          />
        </SettingsCard>
      </SettingsSection>
    </div>
  )
}

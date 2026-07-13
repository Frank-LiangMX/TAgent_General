/**
 * DraftEmptyState — 空态引导组件
 *
 * 新草稿时显示步骤引导 + 示例 + 快捷入口
 */

import { useSetAtom } from 'jotai'
import {
  FileText,
  ListChecks,
  CheckCircle2,
  Rocket,
  Sparkles,
  ArrowRight,
  PencilRuler,
  Workflow,
} from 'lucide-react'
import * as React from 'react'

import type { RequirementBlock } from '@tagent/shared'

import { Button } from '@tagent/ui'
import { currentDraftContextAtom, currentDraftRequirementsAtom } from '@/atoms/draft-atoms'

/** 预设模板 */
const TEMPLATES: Array<{
  id: string
  title: string
  description: string
  context: string
  requirements: Array<{ label: string; title: string; description: string; acceptanceCriteria: string[] }>
}> = [
  {
    id: 'login-system',
    title: '登录系统',
    description: '手机号验证码登录、OAuth 第三方登录',
    context: '开发一个用户登录系统，支持手机号 + 验证码登录，以及微信/Google OAuth 登录。需要考虑安全性（防刷、防爆破）和用户体验。',
    requirements: [
      {
        label: 'R-1',
        title: '设计登录页面 UI',
        description: '包含手机号输入、验证码输入、第三方登录按钮，响应式布局适配移动端',
        acceptanceCriteria: ['支持明暗主题切换', '表单校验实时反馈', '加载状态显示'],
      },
      {
        label: 'R-2',
        title: '实现验证码发送/校验 API',
        description: '短信验证码 60 秒过期，每日每手机号最多 5 次',
        acceptanceCriteria: ['验证码 6 位数字', '60 秒过期', '每日限额 5 次', '支持境外手机号'],
      },
      {
        label: 'R-3',
        title: 'OAuth 登录集成',
        description: '接入微信和 Google OAuth 2.0，获取用户基本信息',
        acceptanceCriteria: ['微信扫码登录', 'Google 一键登录', '首次登录自动创建账号'],
      },
    ],
  },
  {
    id: 'crud-admin',
    title: 'CRUD 管理后台',
    description: '增删改查数据管理页面',
    context: '开发一个通用的 CRUD 管理后台，用于管理用户数据。需要表格展示、搜索筛选、分页、新增/编辑/删除操作。',
    requirements: [
      {
        label: 'R-1',
        title: '数据表格组件',
        description: '支持分页、排序、多选、列配置',
        acceptanceCriteria: ['每页 10/20/50 条切换', '支持列显示/隐藏', '行点击跳转详情'],
      },
      {
        label: 'R-2',
        title: '搜索筛选功能',
        description: '多字段组合搜索，支持模糊匹配和精确匹配',
        acceptanceCriteria: ['关键词搜索', '状态筛选', '日期范围筛选', '筛选条件保存'],
      },
      {
        label: 'R-3',
        title: '新增/编辑表单',
        description: 'Drawer 侧滑表单，支持表单校验',
        acceptanceCriteria: ['必填字段校验', '格式校验（邮箱/手机）', '提交成功后刷新列表'],
      },
    ],
  },
  {
    id: 'api-service',
    title: 'API 服务开发',
    description: 'RESTful API 接口设计与实现',
    context: '开发一套 RESTful API 服务，提供用户管理、数据查询等接口。需要考虑认证、鉴权、限流、文档。',
    requirements: [
      {
        label: 'R-1',
        title: 'API 设计与文档',
        description: 'OpenAPI 3.0 规范，Swagger UI 文档',
        acceptanceCriteria: ['完整的请求/响应 Schema', '错误码定义', '在线调试功能'],
      },
      {
        label: 'R-2',
        title: '认证鉴权中间件',
        description: 'JWT Token 认证，RBAC 权限控制',
        acceptanceCriteria: ['Token 过期自动刷新', '无权限返回 403', '支持黑名单'],
      },
      {
        label: 'R-3',
        title: '限流与缓存',
        description: '接口限流防刷，热点数据缓存',
        acceptanceCriteria: ['滑动窗口限流', 'Redis 缓存', '缓存穿透防护'],
      },
    ],
  },
]

export function DraftEmptyState(): React.ReactElement {
  const setContext = useSetAtom(currentDraftContextAtom)
  const setRequirements = useSetAtom(currentDraftRequirementsAtom)

  const applyTemplate = (template: (typeof TEMPLATES)[number]): void => {
    // 设置背景上下文
    setContext(template.context)

    // 设置需求列表
    const blocks: RequirementBlock[] = template.requirements.map((req) => ({
      id: crypto.randomUUID(),
      label: req.label,
      title: req.title,
      description: req.description,
      acceptanceCriteria: req.acceptanceCriteria.map((ac) => ({
        id: crypto.randomUUID(),
        text: ac,
        checked: false,
      })),
    }))
    setRequirements(blocks)
    // 状态会自动响应 context/requirements 变化，切换到编辑模式
  }

  // 从空白开始：添加一个空需求块
  const startFromScratch = (): void => {
    const firstBlock: RequirementBlock = {
      id: crypto.randomUUID(),
      label: 'R-1',
      title: '',
      description: '',
      acceptanceCriteria: [],
    }
    setRequirements([firstBlock])
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="max-w-3xl mx-auto px-8 py-10">
        {/* 标题区 */}
        <div className="text-center mb-8">
          <div className="material-panel-card mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl">
            <PencilRuler size={24} className="text-primary" />
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">📝 需求草稿</h1>
          <p className="text-sm text-muted-foreground">
            清晰描述你的需求，让 Agent 准确理解并执行
          </p>
        </div>

        {/* 步骤引导 */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="material-panel-card rounded-xl border border-border/50 bg-card/40 p-4 text-center">
            <div className="material-inline-chip mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <FileText size={18} className="text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">背景上下文</h3>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              项目目标、约束条件、技术栈
            </p>
          </div>
          <div className="material-panel-card rounded-xl border border-border/50 bg-card/40 p-4 text-center">
            <div className="material-inline-chip mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <ListChecks size={18} className="text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">需求拆解</h3>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              把大需求拆成可执行的小任务
            </p>
          </div>
          <div className="material-panel-card rounded-xl border border-border/50 bg-card/40 p-4 text-center">
            <div className="material-inline-chip mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <CheckCircle2 size={18} className="text-primary" />
            </div>
            <h3 className="text-sm font-medium text-foreground mb-1">验收标准</h3>
            <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
              明确完成条件，避免返工
            </p>
          </div>
        </div>

        {/* 快速开始按钮 */}
        <div className="flex justify-center gap-3 mb-10">
          <Button onClick={startFromScratch} className="material-cta gap-2 rounded-full border-0">
            <Rocket size={14} />
            从空白开始
          </Button>
          <Button variant="outline" className="material-secondary-btn gap-2 rounded-full border-0">
            <Sparkles size={14} />
            让 AI 帮我拆解
          </Button>
        </div>

        {/* 模板区 */}
        <div className="mb-6">
          <h2 className="text-sm font-medium text-foreground/70 mb-3 flex items-center gap-2">
            <span>📋 从模板创建</span>
            <span className="text-[11px] text-muted-foreground/50">点击快速填充示例内容</span>
          </h2>
          <div className="grid grid-cols-1 gap-3">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                className="material-panel-card group w-full text-left rounded-xl border border-border/50 bg-card/30 hover:bg-card/60 hover:border-border/70 px-5 py-4 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground mb-1 flex items-center gap-2">
                      {template.title}
                      <ArrowRight
                        size={12}
                        className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all"
                      />
                    </h3>
                    <p className="text-[12px] text-muted-foreground/60 mb-2">{template.description}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {template.requirements.map((req) => (
                        <span
                          key={req.label}
                          className="material-inline-chip inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] text-muted-foreground/70"
                        >
                          {req.label}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 流程说明 */}
        <div className="material-flat-input rounded-xl border border-border/30 bg-muted/20 px-5 py-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground/60">
            <Workflow size={14} className="text-primary/80" />
          </div>
          <h3 className="text-xs font-medium text-foreground/60 mb-2">💡 工作流程</h3>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground/70">
            <span className="px-2 py-0.5 rounded bg-muted/40">草稿</span>
            <ArrowRight size={10} className="text-muted-foreground/40" />
            <span className="px-2 py-0.5 rounded bg-muted/40">就绪</span>
            <ArrowRight size={10} className="text-muted-foreground/40" />
            <span className="px-2 py-0.5 rounded bg-muted/40">Agent 执行</span>
            <ArrowRight size={10} className="text-muted-foreground/40" />
            <span className="px-2 py-0.5 rounded bg-muted/40">完成</span>
          </div>
          <p className="text-[11px] text-muted-foreground/50 mt-2">
            ≥2 个需求块时，点击「交给 Agent」会自动创建看板并开始并行执行
          </p>
        </div>
      </div>
    </div>
  )
}

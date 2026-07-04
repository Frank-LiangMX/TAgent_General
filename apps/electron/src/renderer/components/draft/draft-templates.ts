/**
 * DraftTemplates — 草稿模板定义
 *
 * 预设常见场景模板，帮助用户快速开始编写需求。
 */

import type { DraftDocument, RequirementBlock } from '@tagent/shared'

/** 模板定义 */
export interface DraftTemplate {
  id: string
  name: string
  description: string
  icon: string
  context: string
  requirements: RequirementBlock[]
}

/** 预设模板列表 */
export const DRAFT_TEMPLATES: DraftTemplate[] = [
  {
    id: 'feature',
    name: '功能开发',
    description: '新功能完整开发流程',
    icon: '🚀',
    context: `<p>项目背景：</p><p>目标：</p><p>约束：</p>`,
    requirements: [
      {
        id: 'req-1',
        label: 'R-1',
        title: '需求分析与设计',
        description: '分析功能需求，输出设计方案',
        acceptanceCriteria: [
          { id: 'ac-1', text: '需求文档评审通过', checked: false },
          { id: 'ac-2', text: '技术方案确定', checked: false },
        ],
      },
      {
        id: 'req-2',
        label: 'R-2',
        title: '核心功能实现',
        description: '实现核心业务逻辑',
        acceptanceCriteria: [
          { id: 'ac-3', text: '代码 Review 通过', checked: false },
          { id: 'ac-4', text: '单元测试覆盖', checked: false },
        ],
      },
      {
        id: 'req-3',
        label: 'R-3',
        title: '前端界面开发',
        description: '用户界面与交互实现',
        acceptanceCriteria: [
          { id: 'ac-5', text: 'UI 还原度达标', checked: false },
          { id: 'ac-6', text: '交互流畅', checked: false },
        ],
      },
      {
        id: 'req-4',
        label: 'R-4',
        title: '集成测试与部署',
        description: '端到端测试与上线',
        acceptanceCriteria: [
          { id: 'ac-7', text: 'E2E 测试通过', checked: false },
          { id: 'ac-8', text: '生产环境验证', checked: false },
        ],
      },
    ],
  },
  {
    id: 'api',
    name: 'API 开发',
    description: '后端 API 设计与实现',
    icon: '🔌',
    context: `<p>API 用途：</p><p>调用方：</p><p>性能要求：</p>`,
    requirements: [
      {
        id: 'req-1',
        label: 'R-1',
        title: 'API 接口设计',
        description: '设计 RESTful/GraphQL 接口规范',
        acceptanceCriteria: [
          { id: 'ac-1', text: '接口文档完成', checked: false },
          { id: 'ac-2', text: '数据模型确定', checked: false },
        ],
      },
      {
        id: 'req-2',
        label: 'R-2',
        title: '接口实现',
        description: '实现业务逻辑与数据持久化',
        acceptanceCriteria: [
          { id: 'ac-3', text: '接口功能完整', checked: false },
          { id: 'ac-4', text: '错误处理完善', checked: false },
        ],
      },
      {
        id: 'req-3',
        label: 'R-3',
        title: '测试与文档',
        description: '编写测试用例与使用文档',
        acceptanceCriteria: [
          { id: 'ac-5', text: '单元测试覆盖', checked: false },
          { id: 'ac-6', text: '使用文档完成', checked: false },
        ],
      },
    ],
  },
  {
    id: 'crud',
    name: 'CRUD 管理后台',
    description: '增删改查管理界面',
    icon: '📊',
    context: `<p>管理对象：</p><p>字段：</p><p>权限要求：</p>`,
    requirements: [
      {
        id: 'req-1',
        label: 'R-1',
        title: '列表页开发',
        description: '分页列表、搜索、筛选',
        acceptanceCriteria: [
          { id: 'ac-1', text: '列表展示正常', checked: false },
          { id: 'ac-2', text: '搜索筛选功能完整', checked: false },
        ],
      },
      {
        id: 'req-2',
        label: 'R-2',
        title: '新增/编辑表单',
        description: '表单验证与提交',
        acceptanceCriteria: [
          { id: 'ac-3', text: '表单验证完善', checked: false },
          { id: 'ac-4', text: '提交成功反馈', checked: false },
        ],
      },
      {
        id: 'req-3',
        label: 'R-3',
        title: '删除与权限',
        description: '删除确认与权限控制',
        acceptanceCriteria: [
          { id: 'ac-5', text: '删除确认交互', checked: false },
          { id: 'ac-6', text: '权限控制正确', checked: false },
        ],
      },
    ],
  },
  {
    id: 'bugfix',
    name: 'Bug 修复',
    description: '问题定位与修复',
    icon: '🐛',
    context: `<p>问题描述：</p><p>复现步骤：</p><p>期望行为：</p>`,
    requirements: [
      {
        id: 'req-1',
        label: 'R-1',
        title: '问题定位',
        description: '分析日志、复现问题',
        acceptanceCriteria: [
          { id: 'ac-1', text: '根因确定', checked: false },
          { id: 'ac-2', text: '影响范围评估', checked: false },
        ],
      },
      {
        id: 'req-2',
        label: 'R-2',
        title: '修复实现',
        description: '编码修复并测试',
        acceptanceCriteria: [
          { id: 'ac-3', text: '修复代码完成', checked: false },
          { id: 'ac-4', text: '回归测试通过', checked: false },
        ],
      },
    ],
  },
]

/** 从模板创建草稿数据 */
export function createDraftFromTemplate(
  template: DraftTemplate,
  baseData: Partial<DraftDocument> = {}
): Partial<DraftDocument> {
  return {
    ...baseData,
    title: baseData.title || template.name,
    context: template.context,
    requirements: template.requirements.map((req) => ({
      ...req,
      id: crypto.randomUUID(),
      acceptanceCriteria: req.acceptanceCriteria.map((ac) => ({
        ...ac,
        id: crypto.randomUUID(),
      })),
    })),
  }
}

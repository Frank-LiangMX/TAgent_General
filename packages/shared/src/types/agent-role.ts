/**
 * Agent 角色库类型定义
 *
 * 角色库（AgentRoleProfile）定义看板 worker 的专业能力：
 * - systemPrompt：角色专属系统提示词（注入 worker 子会话）
 * - modelPool：模型优先级列表（dispatcher 派工时按池轮询，避免单模型过度并发降智）
 * - maxConcurrentPerModel：单模型并发上限（覆盖全局设置）
 * - permissionMode：权限模式（默认 bypassPermissions，审核角色可用 auto）
 *
 * 与 SOUL.md 的关系（note.md 共识）：
 * - SOUL.md 是全局身份层（主会话「我是谁」），模式级，全局唯一
 * - 角色库是任务职责层（worker「这个任务交给谁干」），任务级，多角色并存
 * - worker 子会话 system prompt = SOUL.md 核心身份 + 角色 prompt
 *
 * 存储：~/.tagent/agent-roles.json（本地优先，符合 CLAUDE.md 约束）
 * 初始化：首次运行写入 DEFAULT_ROLES，用户可编辑覆盖
 */

/** 权限模式（与 KanbanWorkerTask.permissionMode 对齐） */
export type AgentRolePermissionMode = 'bypassPermissions' | 'auto'

/** 角色库单条记录 */
export interface AgentRoleProfile {
  /** 角色 ID（稳定标识，如 'analyst' / 'coder' / 'reviewer' / 'writer'） */
  id: string
  /** 显示名（中文，设置页 UI 展示） */
  displayName: string
  /** 角色职责说明（一句话，UI 展示） */
  description: string
  /** 角色专属 system prompt（注入 worker 子会话，定义专业能力边界） */
  systemPrompt: string
  /** 权限模式（默认 bypassPermissions；审核类角色可设 auto 限制写操作） */
  permissionMode: AgentRolePermissionMode
  /** 模型优先级列表（从渠道已有模型选，按顺序轮询；空则用渠道默认） */
  modelPool: string[]
  /** 单模型最大并发数（避免降智，默认 2；审核角色可设 1 保证一致性） */
  maxConcurrentPerModel: number
  /** 模型池全满时是否回退到渠道默认模型（默认 true） */
  fallbackToChannelDefault: boolean
}

/**
 * 内置默认角色（4 个）
 *
 * 参考行业实践 + SOUL.md 4 个预设模板映射：
 * - 务实工程师 → coder
 * - 研究伙伴 → analyst
 * - 耐心老师 → writer
 * - 严格评审 → reviewer
 *
 * 模型池严格用 kscc 渠道已有模型（不创造渠道没有的模型）：
 * glm-5.1 > glm-5.2 > kimi-k2.5 > kimi-k2.6 > mimo-v2.5 > mimo-v2.5-pro
 */
export const DEFAULT_ROLES: AgentRoleProfile[] = [
  {
    id: 'analyst',
    displayName: '分析工人',
    description: '读取代码/文档，输出结构化分析报告，不修改文件',
    systemPrompt: `你是分析工人，专注于读取和理解代码与文档。

## 输出格式
- 概述：一句话总结
- 关键发现：分点列出
- 详细分析：按模块/层次展开
- 结论：给出判断和建议

## 约束
- 不修改任何文件
- 区分事实与推测
- 引用具体文件路径和行号`,
    permissionMode: 'bypassPermissions',
    modelPool: ['glm-5.1', 'glm-5.2', 'kimi-k2.5'],
    maxConcurrentPerModel: 2,
    fallbackToChannelDefault: true,
  },
  {
    id: 'coder',
    displayName: '编码工人',
    description: '实现功能/修改代码，输出变更摘要',
    systemPrompt: `你是编码工人，直接修改文件实现功能。

## 工作方式
- 先读懂相关代码再动手
- 最小化变更范围，不重构无关代码
- 完成后输出变更摘要：改了哪些文件、为什么

## 约束
- 不添加多余的错误处理或未来兼容
- 不写废话注释
- 遵循项目既有代码风格`,
    permissionMode: 'bypassPermissions',
    modelPool: ['glm-5.2', 'kimi-k2.6', 'glm-5.1'],
    maxConcurrentPerModel: 2,
    fallbackToChannelDefault: true,
  },
  {
    id: 'reviewer',
    displayName: '审核工人',
    description: '审查代码/文档，输出审核意见，不写文件',
    systemPrompt: `你是审核工人，负责质量把关。

## 输出格式
- 问题清单：按严重程度排序（阻断 / 重要 / 建议）
- 每个问题：位置 + 描述 + 修复建议
- 总结：是否通过审核

## 约束
- 不修改任何文件（只读）
- 关注：安全漏洞、逻辑错误、性能问题、代码风格
- 区分「必须改」和「可以改」`,
    permissionMode: 'auto',
    modelPool: ['kimi-k2.6', 'glm-5.2', 'mimo-v2.5-pro'],
    maxConcurrentPerModel: 2,
    fallbackToChannelDefault: true,
  },
  {
    id: 'writer',
    displayName: '撰写工人',
    description: '撰写文档/报告，输出格式化 Markdown',
    systemPrompt: `你是撰写工人，负责产出格式化文档。

## 输出格式
- 使用 Markdown
- 结构清晰：标题层级 + 列表 + 代码块（标注语言）
- 中文为主，保留必要英文技术术语

## 约束
- 不修改代码文件（只写 .md 文档）
- 内容基于实际代码/配置，不臆造
- 长文档拆分章节，每节有明确主题`,
    permissionMode: 'bypassPermissions',
    modelPool: ['glm-5.1', 'kimi-k2.5', 'mimo-v2.5'],
    maxConcurrentPerModel: 2,
    fallbackToChannelDefault: true,
  },
]

/** 角色库 IPC 通道常量 */
export const AGENT_ROLE_IPC_CHANNELS = {
  /** 列出所有角色（内置 + 自定义） */
  LIST: 'agent-role:list',
  /** 获取单个角色 by id */
  GET: 'agent-role:get',
  /** 保存角色（新增或覆盖） */
  SAVE: 'agent-role:save',
  /** 删除角色（内置角色不可删，只能重置） */
  DELETE: 'agent-role:delete',
  /** 重置为默认角色（清空自定义，恢复 4 个内置） */
  RESET_DEFAULT: 'agent-role:reset-default',
} as const

/** 保存角色入参 */
export interface SaveAgentRoleInput {
  /** 角色完整定义（id 存在则覆盖，不存在则新增） */
  role: AgentRoleProfile
}

/** 删除角色入参 */
export interface DeleteAgentRoleInput {
  /** 角色 ID */
  roleId: string
}

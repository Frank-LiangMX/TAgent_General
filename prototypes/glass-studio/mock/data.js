/**
 * TAgent Glass Studio - Mock Data
 *
 * 模拟后端 API 数据结构，方便后续替换为真实 API 调用
 *
 * API 接口设计原则：
 * 1. 所有接口返回 Promise，便于替换为真实 fetch
 * 2. 数据结构与 TAgent 后端类型定义保持一致
 * 3. 支持分页、筛选、排序等查询参数
 */

// ========== 类型定义（与 TAgent 后端对齐）==========

/**
 * @typedef {'pending'|'ready'|'running'|'blocked'|'review'|'done'|'failed'|'cancelled'} KanbanTaskStatus
 * @typedef {'draft'|'ready'|'executing'|'done'|'verified'} DraftStatus
 */

const mockData = {
  // ========== 用户信息 ==========
  user: {
    id: 'u1',
    name: 'Frank',
    email: 'frank@example.com',
    avatar: 'F',
    plan: 'Pro',
    usage: {
      contextPercent: 42,
      inputTokens: 1200,
      outputTokens: 860,
      turns: 3,
    },
  },

  // ========== 项目列表 ==========
  projects: [
    {
      id: 'p1',
      name: 'Glass Studio',
      description: 'UI 设计系统',
      sessionCount: 4,
      lastActive: '刚刚',
      color: '#5b7fd4',
    },
    {
      id: 'p2',
      name: 'TAgent Core',
      description: 'Agent 核心框架',
      sessionCount: 2,
      lastActive: '上周',
      color: '#5a8f72',
    },
    {
      id: 'p3',
      name: 'Kun Agent',
      description: '多智能体协作',
      sessionCount: 1,
      lastActive: '2周前',
      color: '#a07a5e',
    },
  ],

  // ========== 会话列表 ==========
  sessions: [
    {
      id: 's1',
      title: '记忆系统 UI 收尾',
      projectId: 'p1',
      pinned: true,
      lastActive: '刚刚',
      model: 'Claude Sonnet',
      mode: 'Agent',
      permissions: 'auto',
      status: 'idle',
    },
    {
      id: 's2',
      title: '看板 v1 产品化',
      projectId: 'p1',
      lastActive: '2h',
      model: 'Claude Sonnet',
      mode: 'Agent',
      permissions: 'auto',
      status: 'running',
    },
    {
      id: 's3',
      title: 'IPC 通道新增',
      projectId: 'p1',
      lastActive: '昨天',
      model: 'Claude Opus',
      mode: 'Ask',
      permissions: 'plan',
      status: 'idle',
    },
    {
      id: 's4',
      title: '浮岛布局对齐',
      projectId: 'p1',
      lastActive: '3d',
      model: 'Claude Sonnet',
      mode: 'Agent',
      permissions: 'auto',
      status: 'idle',
    },
    {
      id: 's5',
      title: '记忆层监控',
      projectId: 'p2',
      lastActive: '上周',
      model: 'Claude Sonnet',
      mode: 'Agent',
      permissions: 'auto',
      status: 'idle',
    },
    {
      id: 's6',
      title: '权限模式重构',
      projectId: 'p2',
      lastActive: '上周',
      model: 'Claude Opus',
      mode: 'Agent',
      permissions: 'plan',
      status: 'idle',
    },
  ],

  // ========== 归档会话 ==========
  archivedSessions: [
    { id: 'a1', title: '旧版 UI 重构', projectId: 'p1', archivedAt: '1月前' },
    { id: 'a2', title: 'API 文档整理', projectId: 'p2', archivedAt: '2月前' },
  ],

  // ========== 文件列表 ==========
  files: {
    projectFiles: [
      {
        name: 'tagent.html',
        path: '/glass-studio/tagent.html',
        type: 'html',
        size: '33KB',
        modified: '刚刚',
      },
      {
        name: 'tagent.css',
        path: '/glass-studio/tagent.css',
        type: 'css',
        size: '39KB',
        modified: '2分钟前',
      },
      {
        name: 'themes.css',
        path: '/glass-studio/themes.css',
        type: 'css',
        size: '18KB',
        modified: '1小时前',
      },
      {
        name: 'materials.css',
        path: '/glass-studio/materials.css',
        type: 'css',
        size: '26KB',
        modified: '今天',
      },
      {
        name: 'index.html',
        path: '/glass-studio/index.html',
        type: 'html',
        size: '11KB',
        modified: '昨天',
      },
      {
        name: 'styles.css',
        path: '/glass-studio/styles.css',
        type: 'css',
        size: '16KB',
        modified: '昨天',
      },
    ],
    fileActivity: [
      { file: 'tagent.css', action: 'modified', time: '刚刚', additions: 96, deletions: 20 },
      { file: 'tagent.html', action: 'modified', time: '2分钟前', additions: 48, deletions: 12 },
      { file: 'themes.css', action: 'created', time: '1小时前', additions: 650, deletions: 0 },
    ],
  },

  // ========== 自动任务 ==========
  automations: [
    {
      id: 'auto1',
      name: '每日代码审查',
      description: '自动检查代码质量和测试覆盖率',
      schedule: 'daily',
      time: '09:00',
      active: true,
      lastRun: '今天 09:00',
      nextRun: '明天 09:00',
      status: 'success',
      runs: 45,
    },
    {
      id: 'auto2',
      name: '周报生成',
      description: '每周汇总项目进度和问题',
      schedule: 'weekly',
      dayOfWeek: 5,
      time: '18:00',
      active: true,
      lastRun: '上周五 18:00',
      nextRun: '本周五 18:00',
      status: 'success',
      runs: 12,
    },
    {
      id: 'auto3',
      name: '依赖更新检查',
      description: '检查 npm 依赖是否有安全更新',
      schedule: 'interval',
      intervalMinutes: 1440,
      active: false,
      lastRun: '3天前',
      status: 'failed',
      runs: 8,
    },
    {
      id: 'auto4',
      name: 'API 健康检查',
      description: '检测核心 API 端点是否正常响应',
      schedule: 'interval',
      intervalMinutes: 30,
      active: true,
      lastRun: '10分钟前',
      nextRun: '20分钟后',
      status: 'success',
      runs: 156,
    },
  ],

  // ========== 工作台统计 ==========
  dashboard: {
    stats: { activeSessions: 8, runningAgents: 2, pendingReviews: 3, completedToday: 5 },
    recentActivity: [
      { type: 'session', action: '创建会话', target: '记忆系统 UI 收尾', time: '刚刚' },
      { type: 'file', action: '修改文件', target: 'tagent.css', time: '2分钟前' },
      { type: 'automation', action: '任务完成', target: '每日代码审查', time: '今天 09:00' },
      { type: 'kanban', action: '任务完成', target: '设计页面架构', time: '今天 08:30' },
    ],
  },

  // ========== 设置 ==========
  settings: {
    theme: { current: 'mist', mode: 'light', material: 'soft' },
    shortcuts: [
      { key: 'Ctrl+N', action: '新会话' },
      { key: 'Ctrl+/', action: '打开设置' },
      { key: 'Ctrl+K', action: '搜索' },
      { key: 'Ctrl+Shift+S', action: '保存草稿' },
      { key: 'Esc', action: '关闭对话框' },
    ],
    apiKeys: [
      { name: 'Anthropic API', configured: true, lastUsed: '今天' },
      { name: 'OpenAI API', configured: false },
      { name: 'Google AI', configured: false },
    ],
  },

  // ========== 看板 (Kanban) ==========
  kanbanBoards: [
    {
      id: 'kb1',
      title: 'Glass Studio 前端重构',
      rootGoal: '完成 TAgent 前端原型，包含所有核心页面',
      status: 'active',
      mode: 'general',
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now(),
      maxConcurrent: 3,
      paused: false,
      taskCount: 8,
      completedCount: 3,
    },
    {
      id: 'kb2',
      title: 'API 文档迁移',
      rootGoal: '将所有 API 文档迁移到新系统',
      status: 'completed',
      mode: 'general',
      createdAt: Date.now() - 86400000 * 5,
      updatedAt: Date.now() - 3600000,
      maxConcurrent: 2,
      paused: false,
      taskCount: 5,
      completedCount: 5,
    },
  ],

  kanbanTasks: [
    // kb1 任务
    {
      id: 't1',
      boardId: 'kb1',
      title: '设计页面架构',
      status: 'done',
      priority: 10,
      roleId: 'architect',
      createdAt: Date.now() - 86400000 * 2,
      updatedAt: Date.now() - 86400000,
      resultSummary: '完成页面架构设计',
    },
    {
      id: 't2',
      boardId: 'kb1',
      title: '实现 Agent 会话页',
      status: 'done',
      priority: 9,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000 * 12,
      resultSummary: '三栏布局完成',
    },
    {
      id: 't3',
      boardId: 'kb1',
      title: '实现工作台首页',
      status: 'done',
      priority: 8,
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000 * 8,
      resultSummary: '首页完成',
    },
    {
      id: 't4',
      boardId: 'kb1',
      title: '实现自动任务页',
      status: 'running',
      priority: 7,
      assigneeSessionId: 's2',
      createdAt: Date.now() - 3600000 * 6,
      updatedAt: Date.now(),
      startedAt: Date.now() - 3600000,
    },
    {
      id: 't5',
      boardId: 'kb1',
      title: '实现设置页',
      status: 'ready',
      priority: 6,
      createdAt: Date.now() - 3600000 * 4,
      updatedAt: Date.now() - 3600000 * 4,
    },
    {
      id: 't6',
      boardId: 'kb1',
      title: '实现看板页',
      status: 'pending',
      priority: 5,
      parentTaskId: 't4',
      createdAt: Date.now() - 3600000 * 2,
      updatedAt: Date.now() - 3600000 * 2,
    },
    {
      id: 't7',
      boardId: 'kb1',
      title: '实现草稿页',
      status: 'pending',
      priority: 5,
      createdAt: Date.now() - 3600000 * 2,
      updatedAt: Date.now() - 3600000 * 2,
    },
    {
      id: 't8',
      boardId: 'kb1',
      title: '实现记忆页',
      status: 'pending',
      priority: 5,
      createdAt: Date.now() - 3600000,
      updatedAt: Date.now() - 3600000,
    },
    // kb2 任务（已完成）
    {
      id: 't9',
      boardId: 'kb2',
      title: '整理现有文档',
      status: 'done',
      priority: 10,
      createdAt: Date.now() - 86400000 * 5,
      resultSummary: '已整理',
    },
    {
      id: 't10',
      boardId: 'kb2',
      title: '迁移 API 定义',
      status: 'done',
      priority: 9,
      createdAt: Date.now() - 86400000 * 4,
      resultSummary: '已迁移',
    },
    {
      id: 't11',
      boardId: 'kb2',
      title: '更新示例代码',
      status: 'done',
      priority: 8,
      createdAt: Date.now() - 86400000 * 3,
      resultSummary: '已更新',
    },
    {
      id: 't12',
      boardId: 'kb2',
      title: '添加使用指南',
      status: 'done',
      priority: 7,
      createdAt: Date.now() - 86400000 * 2,
      resultSummary: '已添加',
    },
    {
      id: 't13',
      boardId: 'kb2',
      title: '发布文档',
      status: 'done',
      priority: 6,
      createdAt: Date.now() - 86400000,
      resultSummary: '已发布',
    },
  ],

  // ========== 草稿 (Draft) ==========
  drafts: [
    {
      id: 'd1',
      title: '用户认证系统设计',
      workspaceId: 'p1',
      mode: 'general',
      context: '<p>需要设计一个安全的用户认证系统，支持多种登录方式...</p>',
      requirements: [
        {
          id: 'r1',
          label: 'R-1',
          title: '邮箱密码登录',
          description: '用户可以使用邮箱和密码注册登录',
          acceptanceCriteria: [
            { id: 'ac1', text: '用户可以注册新账户', checked: true },
            { id: 'ac2', text: '用户可以登录', checked: true },
            { id: 'ac3', text: '密码加密存储', checked: false },
          ],
          status: 'ready',
        },
        {
          id: 'r2',
          label: 'R-2',
          title: '第三方 OAuth 登录',
          description: '支持 Google、GitHub 等第三方登录',
          acceptanceCriteria: [
            { id: 'ac4', text: '支持 Google OAuth', checked: false },
            { id: 'ac5', text: '支持 GitHub OAuth', checked: false },
          ],
          status: 'draft',
        },
      ],
      status: 'ready',
      createdAt: Date.now() - 86400000 * 3,
      updatedAt: Date.now() - 3600000,
    },
    {
      id: 'd2',
      title: '数据导出功能',
      workspaceId: 'p1',
      mode: 'general',
      context: '<p>用户需要导出会话数据、文件、记忆等...</p>',
      requirements: [
        {
          id: 'r3',
          label: 'R-1',
          title: '导出会话记录',
          description: '导出 JSON/Markdown 格式的会话',
          acceptanceCriteria: [
            { id: 'ac6', text: '导出为 JSON', checked: false },
            { id: 'ac7', text: '导出为 Markdown', checked: false },
          ],
          status: 'draft',
        },
      ],
      status: 'draft',
      createdAt: Date.now() - 86400000,
      updatedAt: Date.now() - 3600000 * 5,
    },
  ],

  // ========== 记忆 (Memory) ==========
  memories: [
    {
      id: 'm1',
      key: 'user.preference.theme',
      value: 'mist',
      type: 'preference',
      category: 'UI',
      description: '用户偏好主题',
      source: 'learned',
      createdAt: Date.now() - 86400000 * 30,
      updatedAt: Date.now() - 86400000,
      accessCount: 42,
    },
    {
      id: 'm2',
      key: 'project.glass-studio.path',
      value: '/Users/frank/Downloads/TAgent_General',
      type: 'fact',
      category: '项目',
      description: 'Glass Studio 项目路径',
      source: 'manual',
      createdAt: Date.now() - 86400000 * 10,
      updatedAt: Date.now() - 86400000 * 2,
      accessCount: 15,
    },
    {
      id: 'm3',
      key: 'user.editor',
      value: 'VSCode',
      type: 'preference',
      category: '工具',
      description: '用户常用编辑器',
      source: 'learned',
      createdAt: Date.now() - 86400000 * 15,
      updatedAt: Date.now() - 86400000 * 5,
      accessCount: 8,
    },
    {
      id: 'm4',
      key: 'coding.style.indent',
      value: '2 spaces',
      type: 'preference',
      category: '代码风格',
      description: '缩进风格',
      source: 'learned',
      createdAt: Date.now() - 86400000 * 20,
      updatedAt: Date.now() - 86400000 * 3,
      accessCount: 12,
    },
    {
      id: 'm5',
      key: 'meeting.notes.2024-01',
      value: '讨论了新版 UI 方案，确定使用 Glassmorphism 风格...',
      type: 'note',
      category: '会议',
      description: 'UI 方案讨论会',
      source: 'manual',
      createdAt: Date.now() - 86400000 * 60,
      updatedAt: Date.now() - 86400000 * 60,
      accessCount: 3,
    },
  ],
}

// ========== API 模拟函数 ==========
// 所有接口返回 Promise，便于替换为真实 fetch

const api = {
  // ===== 会话相关 =====
  getSessions: (params = {}) => {
    let result = [...mockData.sessions]
    if (params.projectId) result = result.filter((s) => s.projectId === params.projectId)
    if (params.status) result = result.filter((s) => s.status === params.status)
    return Promise.resolve(result)
  },
  getSession: (id) => Promise.resolve(mockData.sessions.find((s) => s.id === id)),
  createSession: (data) => {
    const newSession = { id: `s${Date.now()}`, ...data, lastActive: '刚刚', status: 'idle' }
    mockData.sessions.unshift(newSession)
    return Promise.resolve(newSession)
  },
  updateSession: (id, data) => {
    const index = mockData.sessions.findIndex((s) => s.id === id)
    if (index !== -1) {
      mockData.sessions[index] = { ...mockData.sessions[index], ...data, updatedAt: Date.now() }
      return Promise.resolve(mockData.sessions[index])
    }
    return Promise.reject(new Error('Session not found'))
  },
  deleteSession: (id) => {
    mockData.sessions = mockData.sessions.filter((s) => s.id !== id)
    return Promise.resolve({ success: true })
  },
  archiveSession: (id) => {
    const session = mockData.sessions.find((s) => s.id === id)
    if (session) {
      mockData.archivedSessions.unshift({ ...session, archivedAt: '刚刚' })
      mockData.sessions = mockData.sessions.filter((s) => s.id !== id)
    }
    return Promise.resolve({ success: true })
  },

  // ===== 项目相关 =====
  getProjects: () => Promise.resolve(mockData.projects),
  getProject: (id) => Promise.resolve(mockData.projects.find((p) => p.id === id)),
  createProject: (data) => {
    const newProject = { id: `p${Date.now()}`, ...data, sessionCount: 0 }
    mockData.projects.push(newProject)
    return Promise.resolve(newProject)
  },

  // ===== 自动任务相关 =====
  getAutomations: (params = {}) => {
    let result = [...mockData.automations]
    if (params.active !== undefined) result = result.filter((a) => a.active === params.active)
    return Promise.resolve(result)
  },
  getAutomation: (id) => Promise.resolve(mockData.automations.find((a) => a.id === id)),
  createAutomation: (data) => {
    const newAutomation = { id: `auto${Date.now()}`, ...data, runs: 0, status: 'pending' }
    mockData.automations.push(newAutomation)
    return Promise.resolve(newAutomation)
  },
  updateAutomation: (id, data) => {
    const index = mockData.automations.findIndex((a) => a.id === id)
    if (index !== -1) {
      mockData.automations[index] = { ...mockData.automations[index], ...data }
      return Promise.resolve(mockData.automations[index])
    }
    return Promise.reject(new Error('Automation not found'))
  },
  toggleAutomation: (id) => {
    const automation = mockData.automations.find((a) => a.id === id)
    if (automation) {
      automation.active = !automation.active
      return Promise.resolve(automation)
    }
    return Promise.reject(new Error('Automation not found'))
  },
  runAutomation: (id) => {
    const automation = mockData.automations.find((a) => a.id === id)
    if (automation) {
      automation.status = 'running'
      automation.lastRun = '刚刚'
      automation.runs++
      return Promise.resolve(automation)
    }
    return Promise.reject(new Error('Automation not found'))
  },

  // ===== 看板相关 =====
  getKanbanBoards: (params = {}) => {
    let result = [...mockData.kanbanBoards]
    if (params.status) result = result.filter((b) => b.status === params.status)
    return Promise.resolve(result)
  },
  getKanbanBoard: (id) => Promise.resolve(mockData.kanbanBoards.find((b) => b.id === id)),
  getKanbanTasks: (boardId) => {
    if (boardId) {
      return Promise.resolve(mockData.kanbanTasks.filter((t) => t.boardId === boardId))
    }
    return Promise.resolve(mockData.kanbanTasks)
  },
  getKanbanTask: (id) => Promise.resolve(mockData.kanbanTasks.find((t) => t.id === id)),
  createKanbanTask: (data) => {
    const newTask = {
      id: `t${Date.now()}`,
      ...data,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    mockData.kanbanTasks.push(newTask)
    return Promise.resolve(newTask)
  },
  updateKanbanTaskStatus: (id, status, extra = {}) => {
    const task = mockData.kanbanTasks.find((t) => t.id === id)
    if (task) {
      task.status = status
      task.updatedAt = Date.now()
      Object.assign(task, extra)
      return Promise.resolve(task)
    }
    return Promise.reject(new Error('Task not found'))
  },

  // ===== 草稿相关 =====
  getDrafts: (params = {}) => {
    let result = [...mockData.drafts]
    if (params.status) result = result.filter((d) => d.status === params.status)
    if (params.workspaceId) result = result.filter((d) => d.workspaceId === params.workspaceId)
    return Promise.resolve(result)
  },
  getDraft: (id) => Promise.resolve(mockData.drafts.find((d) => d.id === id)),
  createDraft: (data) => {
    const newDraft = {
      id: `d${Date.now()}`,
      ...data,
      status: 'draft',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    mockData.drafts.push(newDraft)
    return Promise.resolve(newDraft)
  },
  updateDraft: (id, data) => {
    const index = mockData.drafts.findIndex((d) => d.id === id)
    if (index !== -1) {
      mockData.drafts[index] = { ...mockData.drafts[index], ...data, updatedAt: Date.now() }
      return Promise.resolve(mockData.drafts[index])
    }
    return Promise.reject(new Error('Draft not found'))
  },
  deleteDraft: (id) => {
    mockData.drafts = mockData.drafts.filter((d) => d.id !== id)
    return Promise.resolve({ success: true })
  },

  // ===== 记忆相关 =====
  getMemories: (params = {}) => {
    let result = [...mockData.memories]
    if (params.category) result = result.filter((m) => m.category === params.category)
    if (params.type) result = result.filter((m) => m.type === params.type)
    if (params.search) {
      const search = params.search.toLowerCase()
      result = result.filter(
        (m) => m.key.toLowerCase().includes(search) || m.value.toLowerCase().includes(search)
      )
    }
    return Promise.resolve(result)
  },
  getMemory: (id) => Promise.resolve(mockData.memories.find((m) => m.id === id)),
  createMemory: (data) => {
    const newMemory = {
      id: `m${Date.now()}`,
      ...data,
      source: 'manual',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      accessCount: 0,
    }
    mockData.memories.push(newMemory)
    return Promise.resolve(newMemory)
  },
  updateMemory: (id, data) => {
    const index = mockData.memories.findIndex((m) => m.id === id)
    if (index !== -1) {
      mockData.memories[index] = { ...mockData.memories[index], ...data, updatedAt: Date.now() }
      return Promise.resolve(mockData.memories[index])
    }
    return Promise.reject(new Error('Memory not found'))
  },
  deleteMemory: (id) => {
    mockData.memories = mockData.memories.filter((m) => m.id !== id)
    return Promise.resolve({ success: true })
  },

  // ===== 用户相关 =====
  getUser: () => Promise.resolve(mockData.user),
  updateUsage: (data) => {
    mockData.user.usage = { ...mockData.user.usage, ...data }
    return Promise.resolve(mockData.user.usage)
  },

  // ===== 文件相关 =====
  getFiles: () => Promise.resolve(mockData.files),
  getFileActivity: () => Promise.resolve(mockData.files.fileActivity),

  // ===== 工作台相关 =====
  getDashboard: () => Promise.resolve(mockData.dashboard),

  // ===== 设置相关 =====
  getSettings: () => Promise.resolve(mockData.settings),
  updateSettings: (data) => {
    mockData.settings = { ...mockData.settings, ...data }
    return Promise.resolve(mockData.settings)
  },
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mockData, api }
}

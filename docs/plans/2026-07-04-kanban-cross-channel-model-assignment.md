# 看板跨渠道模型分配改进设计

> **状态**：Draft v1.0 — 可开工
> **日期**：2026-07-04
> **优先级**：P1（看板 v1 产品化主线）
> **关联文档**：
> - [`2026-06-30-task-kanban-orchestration-design.md`](2026-06-30-task-kanban-orchestration-design.md) — 看板总体设计
> - [`2026-06-30-kanban-v1-product-design.md`](2026-06-30-kanban-v1-product-design.md) — 看板 v1 产品方案

---

## 0. 一句话

**当前看板锁定单一渠道，改进后：kscc 禁止跳外部，但外部 API 渠道间可轮询；角色库 channelId 可覆盖但需合规检查。**

---

## 1. 问题定位

### 1.1 当前行为

`kanban-dispatcher.ts` 的 `assignModelForTask()` 逻辑：

```typescript
// 所有任务都用 task.channelId（继承自 board）
const available = getter(task.channelId)  // 只查这一个渠道的模型
```

**问题**：过度限制，把"禁止 kscc→外部"误实现为"禁止所有跨渠道"

### 1.2 设计文档真实意图

`2026-06-30-task-kanban-orchestration-design.md` §6.2：

> **禁止父会话 kscc、子任务外部 API 混用（v1）**

约束针对的是 **kscc 内网 ↔ 外部 API** 的跨域混用，而非禁止所有跨渠道。

### 1.3 应该支持但当前不支持的场景

| 场景 | 当前行为 | 应该支持 |
|------|---------|---------|
| OpenAI 渠道创建看板 | ❌ 只能用 OpenAI 模型 | ✅ 允许轮询所有外部渠道（OpenAI/DeepSeek/Claude/Gemini...） |
| 角色库指定 channelId | ⚠️ 可能突破 kscc 约束 | ✅ 允许指定，但需检查合规性 |

---

## 2. 改进目标

| 场景 | 改进前 | 改进后 |
|------|--------|--------|
| kscc 渠道创建看板 | ✅ 只用 kscc 模型 | ✅ 保持不变（符合约束） |
| OpenAI 渠道创建看板 | ❌ 只能用 OpenAI | ✅ 允许轮询所有外部渠道模型 |
| 角色库指定 channelId | ⚠️ 无检查 | ✅ 检查合规性（kscc 角色不能跳外部） |
| 显式指定 task.modelId | ✅ 直接用 | ✅ 直接用，但 kscc 任务会检查是否合规 |

---

## 3. 设计方案

### 3.1 扩展渠道查询接口

**当前接口**：

```typescript
export type KanbanAvailableModelsGetter = (channelId: string) => string[]
```

**改进后接口**：

```typescript
export interface KanbanChannelModelsGetter {
  /** 获取指定渠道的所有可用模型 ID */
  getModels: (channelId: string) => string[]
  
  /** 判断渠道是否为 kscc 内网 */
  isKsccChannel: (channelId: string) => boolean
  
  /** 获取所有外部 API 渠道 ID 列表（用于轮询） */
  getExternalChannels: () => string[]
}
```

### 3.2 改进模型分配逻辑

**核心算法**：

```
assignModelForTask(task, boardId):
  1. task.modelId 显式指定 → 检查合规性后直接用
     - kscc 任务 + 外部模型 → warn + 继走分配逻辑
     - 否则 → 直接返回
  
  2. task.roleId 存在 → 查角色库
     - role.channelId 指定 → 检查合规性
       - kscc 看板 + 外部角色 → warn + 回退到看板渠道
       - 否则 → 用 role.channelId 的模型池
     - role.modelPool → 按顺序找未满的
  
  3. 未指定 → 按看板渠道类型决定分配范围
     - kscc 看板 → 只从 kscc 内部分配
     - 外部看板 → 轮询所有外部渠道模型
  
  4. 全满 → 返回 undefined（任务保持 ready）
```

### 3.3 合规性检查规则

| 情况 | 是否合规 | 处理 |
|------|---------|------|
| kscc 看板 + kscc 角色/模型 | ✅ 合规 | 正常使用 |
| kscc 看板 + 外部角色/模型 | ❌ 不合规 | 拦截 + warn + 回退到 kscc |
| 外部看板 + 外部角色/模型 | ✅ 合规 | 正常使用（可跨外部渠道） |
| 外部看板 + kscc 角色/模型 | ✅ 合规 | 正常使用（外网用内网模型允许） |

**设计理由**：
- kscc → 外部：❌ 禁止（内网凭据不泄露、成本控制）
- 外部 → kscc：✅ 允许（用户有意用内网模型节省成本）

---

## 4. 实现细节

### 4.1 新增辅助函数 `assignFromPool`

统一处理模型池分配（支持 modelPool 顺序优先 + round-robin 轮询）：

```typescript
/**
 * 从模型池分配（支持 modelPool 顺序优先 + round-robin 轮询）
 * 
 * @param availableModels 可用模型列表（过滤后的）
 * @param modelPool 角色库优先顺序（可选）
 * @param boardId 看板 ID（用于模型计数）
 * @param maxPerModel 单模型最大并发
 * @returns 分配到的 modelId，或 undefined（全满）
 */
function assignFromPool(
  availableModels: string[],
  modelPool?: string[],
  boardId: string,
  maxPerModel: number
): string | undefined {
  const modelCounts = getOrCreateModelCounts(boardId)
  
  // 1. 若有 modelPool，按顺序找第一个未满的
  if (modelPool && modelPool.length > 0) {
    for (const modelId of modelPool) {
      if (!availableModels.includes(modelId)) continue
      const count = modelCounts.get(modelId) ?? 0
      if (count < maxPerModel) return modelId
    }
  }
  
  // 2. 无 modelPool 或全满 → round-robin
  const cursor = modelRotationCursorByBoard.get(boardId) ?? 0
  for (let i = 0; i < availableModels.length; i++) {
    const idx = (cursor + i) % availableModels.length
    const modelId = availableModels[idx]!
    const count = modelCounts.get(modelId) ?? 0
    if (count < maxPerModel) {
      // 记录游标为下一个位置
      modelRotationCursorByBoard.set(boardId, (idx + 1) % availableModels.length)
      return modelId
    }
  }
  
  // 3. 全满
  return undefined
}
```

### 4.2 改进 `assignModelForTask`

```typescript
function assignModelForTask(task: KanbanTask, boardId: string): string | undefined {
  const opts = dispatcherOptions
  if (!opts) return task.modelId
  
  const getter = opts.channelModelsGetter
  if (!getter) return task.modelId
  
  const globalMaxPerModel = opts.getMaxConcurrentPerModel?.() ?? opts.maxConcurrentPerModel ?? 2
  
  // ========== 1. 显式指定 task.modelId ==========
  if (task.modelId) {
    // 检查合规性：kscc 任务不能用外部模型
    if (getter.isKsccChannel(task.channelId)) {
      const modelChannel = findModelChannel(task.modelId) // 辅助函数
      if (modelChannel && !getter.isKsccChannel(modelChannel)) {
        console.warn(`[看板] kscc 任务禁止用外部模型 ${task.modelId}，忽略显式指定`)
        // 继续走下面的分配逻辑
      } else {
        return task.modelId
      }
    } else {
      // 外部看板：直接用显式指定
      return task.modelId
    }
  }
  
  // ========== 2. 角色库指定 ==========
  if (task.roleId) {
    const role = getRoleById(task.roleId)
    if (role) {
      // 2a. 检查角色 channelId 合规性
      if (role.channelId) {
        const board = opts.db?.getBoard(task.boardId)
        if (board && getter.isKsccChannel(board.channelId) && !getter.isKsccChannel(role.channelId)) {
          console.warn(`[看板] kscc 看板禁止用外部角色 ${role.name}，回退到看板渠道`)
        } else {
          // 用角色指定的渠道
          const roleModels = getter.getModels(role.channelId)
          return assignFromPool(roleModels, role.modelPool, boardId, role.maxConcurrentPerModel ?? globalMaxPerModel)
        }
      }
      
      // 2b. 无 role.channelId → 用角色 modelPool（从看板渠道范围内）
      if (role.modelPool && role.modelPool.length > 0) {
        const boardChannelModels = getBoardChannelModels(task, getter)
        const availableModels = role.modelPool.filter(m => boardChannelModels.includes(m))
        return assignFromPool(availableModels, role.modelPool, boardId, role.maxConcurrentPerModel ?? globalMaxPerModel)
      }
    }
  }
  
  // ========== 3. 未指定 → 按看板渠道类型分配 ==========
  const board = opts.db?.getBoard(task.boardId)
  if (!board) return undefined
  
  if (getter.isKsccChannel(board.channelId)) {
    // kscc 看板：只从 kscc 内部分配
    const ksccModels = getter.getModels(board.channelId)
    return assignFromPool(ksccModels, undefined, boardId, globalMaxPerModel)
  } else {
    // 外部 API 看板：轮询所有外部渠道
    const externalChannels = getter.getExternalChannels()
    const allExternalModels = externalChannels.flatMap(ch => getter.getModels(ch))
    return assignFromPool(allExternalModels, undefined, boardId, globalMaxPerModel)
  }
}

/** 辅助函数：获取看板渠道范围内可用模型（kscc 只返回 kscc，外部返回所有外部） */
function getBoardChannelModels(task: KanbanTask, getter: KanbanChannelModelsGetter): string[] {
  const board = dispatcherOptions?.db?.getBoard(task.boardId)
  if (!board) return []
  
  if (getter.isKsccChannel(board.channelId)) {
    return getter.getModels(board.channelId)
  } else {
    const externalChannels = getter.getExternalChannels()
    return externalChannels.flatMap(ch => getter.getModels(ch))
  }
}

/** 辅助函数：根据模型 ID 反查所属渠道（需 channelManager 支持） */
function findModelChannel(modelId: string): string | undefined {
  // 实现注入到 dispatcherOptions
  return dispatcherOptions?.findModelChannel?.(modelId)
}
```

### 4.3 主进程注入真实实现

```typescript
// kanban-bootstrap.ts 或 main 进程初始化处
import { channelManager } from './channel-manager'

function configureKanbanDispatcherWithRealGetter() {
  configureKanbanDispatcher({
    channelModelsGetter: {
      getModels: (channelId: string) => {
        const channel = channelManager.getChannel(channelId)
        return channel?.models?.filter(m => m.enabled).map(m => m.id) ?? []
      },
      
      isKsccChannel: (channelId: string) => {
        const channel = channelManager.getChannel(channelId)
        return channel?.provider === 'kscc-internal'
      },
      
      getExternalChannels: () => {
        return channelManager.listChannels()
          .filter(ch => ch.enabled && ch.provider !== 'kscc-internal')
          .map(ch => ch.id)
      }
    },
    
    // 新增：根据模型 ID 反查渠道
    findModelChannel: (modelId: string) => {
      const channels = channelManager.listChannels()
      for (const ch of channels) {
        if (ch.models?.some(m => m.id === modelId)) {
          return ch.id
        }
      }
      return undefined
    },
    
    // ...其他配置（db, runner, onTaskStatusChanged 等）
  })
}
```

---

## 5. 需要修改的文件清单

| 文件 | 改动内容 | 优先级 |
|------|---------|--------|
| `packages/shared/src/types/kanban.ts` | 新增 `KanbanChannelModelsGetter` 接口定义 | P0 |
| `apps/electron/src/main/lib/kanban-dispatcher.ts` | 改 `assignModelForTask` + 新增 `assignFromPool` + 改配置接口 | P0 |
| `apps/electron/src/main/lib/kanban-bootstrap.ts` | 注入真实 `channelModelsGetter` + `findModelChannel` | P0 |
| `apps/electron/src/main/lib/channel-manager.ts` | 确保支持 `provider === 'kscc-internal'` 判断 | P1 |
| `apps/electron/src/main/lib/agent-role-service.ts` | 确保 `role.channelId` / `role.modelPool` 可用 | P1 |

---

## 6. 测试用例

### 6.1 单测（kanban-dispatcher.test.ts）

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { configureKanbanDispatcher, assignModelForTask } from './kanban-dispatcher'
import type { KanbanChannelModelsGetter } from '@tagent/shared'

describe('assignModelForTask 跨渠道分配', () => {
  const mockGetter: KanbanChannelModelsGetter = {
    getModels: vi.fn(),
    isKsccChannel: vi.fn(),
    getExternalChannels: vi.fn()
  }
  
  beforeEach(() => {
    vi.clearAllMocks()
    configureKanbanDispatcher({
      channelModelsGetter: mockGetter,
      db: mockDb,
      getMaxConcurrentPerModel: () => 2
    })
  })
  
  describe('kscc 看板', () => {
    it('只分配 kscc 模型', () => {
      mockGetter.isKsccChannel.mockImplementation(ch => ch === 'kscc')
      mockGetter.getModels.mockImplementation(ch => 
        ch === 'kscc' ? ['glm-5.1', 'glm-5.2'] : ['gpt-4o']
      )
      mockGetter.getExternalChannels.mockReturnValue(['openai'])
      
      const task = createTask({ channelId: 'kscc', boardId: 'b1' })
      const model = assignModelForTask(task, 'b1')
      
      expect(model).toMatch(/^glm-/)
      expect(mockGetter.getModels).toHaveBeenCalledWith('kscc')
      expect(mockGetter.getExternalChannels).not.toHaveBeenCalled()
    })
    
    it('禁止用外部模型（显式指定）', () => {
      mockGetter.isKsccChannel.mockImplementation(ch => ch === 'kscc')
      mockGetter.getModels.mockReturnValue(['glm-5.1'])
      
      const task = createTask({ 
        channelId: 'kscc', 
        modelId: 'gpt-4o',  // 显式指定外部模型
        boardId: 'b1'
      })
      
      const model = assignModelForTask(task, 'b1')
      
      // 应忽略显式指定，回退到 kscc 模型
      expect(model).toBe('glm-5.1')
    })
    
    it('禁止用外部角色', () => {
      mockGetter.isKsccChannel.mockImplementation(ch => ch === 'kscc')
      mockGetter.getModels.mockImplementation(ch =>
        ch === 'kscc' ? ['glm-5.1'] : ['gpt-4o']
      )
      
      mockRole({ id: 'role-dev', channelId: 'openai', modelPool: ['gpt-4o'] })
      
      const task = createTask({ 
        channelId: 'kscc', 
        roleId: 'role-dev',
        boardId: 'b1'
      })
      
      const model = assignModelForTask(task, 'b1')
      
      // 应回退到 kscc，而不是用 openai
      expect(model).toBe('glm-5.1')
    })
  })
  
  describe('外部 API 看板', () => {
    it('可跨渠道轮询', () => {
      mockGetter.isKsccChannel.mockReturnValue(false)
      mockGetter.getExternalChannels.mockReturnValue(['openai', 'deepseek'])
      mockGetter.getModels.mockImplementation(ch =>
        ch === 'openai' ? ['gpt-4o'] : ['deepseek-chat']
      )
      
      const task = createTask({ channelId: 'openai', boardId: 'b1' })
      
      // 第一次分配
      const model1 = assignModelForTask(task, 'b1')
      expect(model1).toBe('gpt-4o')
      
      // 第二次分配（round-robin）
      const model2 = assignModelForTask(task, 'b1')
      expect(model2).toBe('deepseek-chat')
      
      // 第三次分配（回到第一个）
      const model3 = assignModelForTask(task, 'b1')
      expect(model3).toBe('gpt-4o')
    })
    
    it('可用 kscc 模型（允许）', () => {
      mockGetter.isKsccChannel.mockImplementation(ch => ch === 'kscc')
      mockGetter.getExternalChannels.mockReturnValue(['openai'])
      mockGetter.getModels.mockImplementation(ch =>
        ch === 'kscc' ? ['glm-5.1'] : ['gpt-4o']
      )
      
      // 外部看板显式指定用 kscc 模型
      const task = createTask({
        channelId: 'openai',
        modelId: 'glm-5.1',  // 外部看板用内网模型（允许）
        boardId: 'b1'
      })
      
      const model = assignModelForTask(task, 'b1')
      expect(model).toBe('glm-5.1')  // 直接用，不拦截
    })
    
    it('角色库可指定不同渠道', () => {
      mockGetter.isKsccChannel.mockReturnValue(false)
      mockGetter.getExternalChannels.mockReturnValue(['openai', 'deepseek'])
      mockGetter.getModels.mockImplementation(ch =>
        ch === 'openai' ? ['gpt-4o'] : ['deepseek-coder']
      )
      
      mockRole({ id: 'role-dev', channelId: 'deepseek', modelPool: ['deepseek-coder'] })
      
      const task = createTask({
        channelId: 'openai',  // 看板是 openai
        roleId: 'role-dev',   // 角色指定 deepseek
        boardId: 'b1'
      })
      
      const model = assignModelForTask(task, 'b1')
      expect(model).toBe('deepseek-coder')  // 用角色指定的渠道
    })
  })
  
  describe('并发上限', () => {
    it('跨渠道轮询仍遵守 maxConcurrentPerModel', () => {
      mockGetter.isKsccChannel.mockReturnValue(false)
      mockGetter.getExternalChannels.mockReturnValue(['openai', 'deepseek'])
      mockGetter.getModels.mockImplementation(ch =>
        ch === 'openai' ? ['gpt-4o'] : ['deepseek-chat']
      )
      
      // 模拟 gpt-4o 已满 2 个并发
      incrementModelCount('b1', 'gpt-4o')
      incrementModelCount('b1', 'gpt-4o')
      
      const task = createTask({ channelId: 'openai', boardId: 'b1' })
      const model = assignModelForTask(task, 'b1')
      
      // gpt-4o 满，应分配 deepseek-chat
      expect(model).toBe('deepseek-chat')
    })
  })
})

// 辅助函数
function createTask(overrides: Partial<KanbanTask>): KanbanTask {
  return {
    id: 't1',
    boardId: overrides.boardId ?? 'b1',
    title: '测试任务',
    body: '...',
    status: 'ready',
    channelId: overrides.channelId ?? 'kscc',
    priority: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides
  }
}

function mockRole(overrides: Partial<AgentRoleProfile>): void {
  vi.mock('./agent-role-service', () => ({
    getRoleById: vi.fn().mockReturnValue({
      id: overrides.id,
      name: overrides.name ?? '测试角色',
      channelId: overrides.channelId,
      modelPool: overrides.modelPool ?? [],
      maxConcurrentPerModel: overrides.maxConcurrentPerModel ?? 2,
      fallbackToChannelDefault: overrides.fallbackToChannelDefault ?? true,
      ...overrides
    })
  }))
}
```

### 6.2 集成测试

```typescript
describe('看板跨渠道真实调度', () => {
  it('外部看板多渠道轮询端到端', async () => {
    // 1. 创建外部渠道看板
    const board = await createBoard({
      channelId: 'openai',
      rootGoal: '完成登录重构'
    })
    
    // 2. 添加 5 个任务
    for (let i = 0; i < 5; i++) {
      await addTask({
        boardId: board.id,
        title: `任务${i}`,
        body: '...'
      })
    }
    
    // 3. 启动调度器
    startKanbanDispatcher()
    
    // 4. 等待任务完成
    await waitForAllTasksComplete(board.id)
    
    // 5. 检查：不同任务用了不同渠道模型
    const tasks = await listTasks(board.id)
    const usedModels = tasks.map(t => t.modelId)
    const usedChannels = tasks.map(t => findModelChannel(t.modelId!))
    
    // 应有多个渠道被使用（openai + deepseek 等）
    expect(new Set(usedChannels).size).toBeGreaterThan(1)
  })
})
```

---

## 7. 改进后的行为示例

### 7.1 kscc 看板（禁止跨域）

```
看板渠道: kscc-internal
角色库:
  - PM角色 → channelId: kscc-internal ✅
  - 开发角色 → channelId: openai ❌ 被拦截，回退到 kscc

任务分配:
  - 任务1 → glm-5.1（kscc）
  - 任务2 → glm-5.2（kscc）
  - 任务3 → mimo-v2.5（kscc）
  
所有任务都在 kscc 内轮询，不会跳外部
```

### 7.2 OpenAI 看板（允许跨外部渠道）

```
看板渠道: openai
可用外部渠道: [openai, deepseek, claude, gemini]

任务分配（round-robin）:
  - 任务1 → openai/gpt-4o
  - 任务2 → deepseek/deepseek-chat
  - 任务3 → claude/claude-sonnet-5
  - 任务4 → gemini/gemini-pro
  
充分利用多个外部 API 渠道，提升吞吐量
```

### 7.3 角色库指定渠道

```
看板渠道: openai
角色库:
  - PM角色 → channelId: openai, modelPool: [gpt-4o, gpt-4o-mini]
  - 开发角色 → channelId: deepseek, modelPool: [deepseek-coder]
  - 测试角色 → channelId: claude, modelPool: [claude-opus]

任务分配（按角色 channelId）:
  - PM任务 → openai/gpt-4o（角色优先顺序）
  - 开发任务 → deepseek/deepseek-coder
  - 测试任务 → claude/claude-opus
  
不同角色用不同渠道，最大化性价比
```

---

## 8. 验收标准

| 标准 | 验证方式 |
|------|---------|
| kscc 看板只用 kscc 模型 | 单测 + 手工验证 |
| 外部看板可跨渠道轮询 | 单测 + 集成测试 |
| kscc 任务禁止用外部模型/角色 | 单测（显式指定 + 角色库） |
| 外部任务可用 kscc 模型（允许） | 单测 |
| 并发上限仍有效 | 单测（跨渠道时检查） |
| 角色库 channelId 可覆盖 | 单测 + 手工验证 |
| 所有单测通过 | `bun test kanban-dispatcher.test.ts` |
| 类型检查通过 | `bun run typecheck` |

---

## 9. 工作量评估

| 改动项 | 预估时间 |
|--------|---------|
| 类型定义（`KanbanChannelModelsGetter`） | 20 分钟 |
| `assignFromPool` 辅助函数 | 30 分钟 |
| `assignModelForTask` 重写 | 1.5 小时 |
| 主进程注入实现 | 30 分钟 |
| 单测编写 | 1 小时 |
| 集成测试 + 手工验证 | 30 分钟 |
| **总计** | **约 4 小时** |

---

## 10. 风险与注意事项

| 风险 | 应对 |
|------|------|
| 渠道模型数据不完整 | 确保 `channelManager.getModels()` 返回完整列表 |
| findModelChannel 实现缺失 | channelManager 需支持反向查询 |
| 角色库 modelPool 与渠道不匹配 | `assignFromPool` 先过滤 `availableModels.includes()` |
| kscc 判断逻辑错误 | 统一用 `provider === 'kscc-internal'` |
| 外部渠道列表为空 | 回退到单一看板渠道（不报错） |

---

## 11. 后续增强（v2+）

| 增强项 | 说明 |
|--------|------|
| 成本优先分配 | 外部渠道按价格排序，优先低成本 |
| 性能优先分配 | 按模型响应速度排序，优先快的 |
| 智能降档 | 高成本任务降档到低成本渠道 |
| 渠道健康检查 | 避开故障渠道 |

---

**最后更新**：2026-07-04 — v1.0 设计完成，可开工实现。
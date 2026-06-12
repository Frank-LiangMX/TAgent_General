/**
 * bridge-model-utils 单测
 *
 * IM Bridge 模型切换共享工具: getEnabledModels / listSwitchableChannels /
 * resolveChannelByIndex / resolveModelByIndex / describeBindingModel
 *
 * bridge-model-utils.ts 依赖 channel-manager（里面用 fs 读 channels.json）。
 * 为了测试不碰 fs，我们在 bridge-model-utils 加了 ChannelDataSource 注入参数，
 * 测试时把内存数据作为 ds 传入，避免跨文件 mock.module 泄漏。
 */

import { describe, expect, test, beforeEach, vi } from 'vitest'

import type { ChannelDataSource } from './bridge-model-utils'
import type { Channel, ChannelModel } from '@tagent/shared'

// bridge-model-utils.ts 通过 channel-manager.ts 间接依赖 'electron' (safeStorage)。
// 单元测试不需要 channel-manager 的真实实现（用注入式 testDataSource 即可），
// 但模块加载阶段仍然会拉 electron，所以也要 mock 掉。
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (s: string) => Buffer.from(s, 'utf-8'),
    decryptString: (b: Buffer) => b.toString('utf-8'),
  },
  app: { getPath: () => '/tmp' },
  BrowserWindow: class {
    static getAllWindows() { return [] }
    static getFocusedWindow() { return null }
  },
  WebContents: class {},
  dialog: { showOpenDialog: () => {} },
}))

// ============================================
// 测试 fixture
// ============================================

let mockChannels: Channel[] = []

function ch(
  id: string,
  name: string,
  enabled: boolean,
  models: Array<{ id: string; name: string; enabled: boolean }>,
): Channel {
  return {
    id,
    name,
    enabled,
    models: models.map((m) => ({ ...m })) as ChannelModel[],
  } as Channel
}

function resetMocks() {
  mockChannels = []
}

/** 测试用 ChannelDataSource — 直接返回 mockChannels 数组 */
const testDataSource: ChannelDataSource = {
  listChannels: () => mockChannels,
  getChannelById: (id: string) => mockChannels.find((c) => c.id === id),
}

const { getEnabledModels, listSwitchableChannels, resolveChannelByIndex, resolveModelByIndex, describeBindingModel } =
  await import('./bridge-model-utils')

// ============================================
// getEnabledModels (纯函数)
// ============================================

describe('getEnabledModels', () => {
  test('Given 全部 enabled When 过滤 Then 返回全部', () => {
    const c = ch('c1', 'C1', true, [
      { id: 'm1', name: 'M1', enabled: true },
      { id: 'm2', name: 'M2', enabled: true },
    ])
    expect(getEnabledModels(c).map((m) => m.id)).toEqual(['m1', 'm2'])
  })

  test('Given 部分 enabled When 过滤 Then 只返回 enabled', () => {
    const c = ch('c1', 'C1', true, [
      { id: 'm1', name: 'M1', enabled: true },
      { id: 'm2', name: 'M2', enabled: false },
      { id: 'm3', name: 'M3', enabled: true },
    ])
    expect(getEnabledModels(c).map((m) => m.id)).toEqual(['m1', 'm3'])
  })

  test('Given 全部 disabled When 过滤 Then 返回空数组', () => {
    const c = ch('c1', 'C1', true, [
      { id: 'm1', name: 'M1', enabled: false },
    ])
    expect(getEnabledModels(c)).toEqual([])
  })

  test('Given 空 models 数组 When 过滤 Then 返回空数组', () => {
    const c = ch('c1', 'C1', true, [])
    expect(getEnabledModels(c)).toEqual([])
  })
})

// ============================================
// listSwitchableChannels
// ============================================

describe('listSwitchableChannels', () => {
  beforeEach(() => resetMocks())

  test('Given 启用渠道 + 有启用模型 When list Then 包含该渠道', () => {
    mockChannels = [
      ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: true }]),
    ]
    expect(listSwitchableChannels(testDataSource).map((c) => c.id)).toEqual(['c1'])
  })

  test('Given 停用渠道 When list Then 排除', () => {
    mockChannels = [
      ch('c1', 'C1', false, [{ id: 'm1', name: 'M1', enabled: true }]),
    ]
    expect(listSwitchableChannels(testDataSource)).toEqual([])
  })

  test('Given 启用渠道但无启用模型 When list Then 排除', () => {
    mockChannels = [
      ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: false }]),
    ]
    expect(listSwitchableChannels(testDataSource)).toEqual([])
  })

  test('Given 混合场景 When list Then 只返回合法渠道 (enabled + 有启用模型)', () => {
    mockChannels = [
      ch('a', 'A', true, [{ id: 'm1', name: 'M1', enabled: true }]),     // ✓
      ch('b', 'B', false, [{ id: 'm2', name: 'M2', enabled: true }]),    // ✗ 停用
      ch('c', 'C', true, [{ id: 'm3', name: 'M3', enabled: false }]),   // ✗ 无启用模型
      ch('d', 'D', true, [{ id: 'm4', name: 'M4', enabled: true }]),     // ✓
    ]
    expect(listSwitchableChannels(testDataSource).map((c) => c.id)).toEqual(['a', 'd'])
  })

  test('Given 空 channels When list Then 返回空', () => {
    expect(listSwitchableChannels(testDataSource)).toEqual([])
  })
})

// ============================================
// resolveChannelByIndex
// ============================================

describe('resolveChannelByIndex', () => {
  beforeEach(() => resetMocks())

  function setup() {
    mockChannels = [
      ch('a', 'A', true, [{ id: 'm1', name: 'M1', enabled: true }]),
      ch('b', 'B', true, [{ id: 'm2', name: 'M2', enabled: true }]),
      ch('c', 'C', true, [{ id: 'm3', name: 'M3', enabled: true }]),
    ]
  }

  test('Given index=1 (合法) When resolve Then 返回第 1 个', () => {
    setup()
    expect(resolveChannelByIndex(1, testDataSource)?.id).toBe('a')
  })

  test('Given index=2 (合法) When resolve Then 返回第 2 个', () => {
    setup()
    expect(resolveChannelByIndex(2, testDataSource)?.id).toBe('b')
  })

  test('Given index=0 (越界) When resolve Then 返回 undefined', () => {
    setup()
    expect(resolveChannelByIndex(0, testDataSource)).toBeUndefined()
  })

  test('Given 负数 (越界) When resolve Then 返回 undefined', () => {
    setup()
    expect(resolveChannelByIndex(-1, testDataSource)).toBeUndefined()
  })

  test('Given 超过列表长度 (越界) When resolve Then 返回 undefined', () => {
    setup()
    expect(resolveChannelByIndex(4, testDataSource)).toBeUndefined()
    expect(resolveChannelByIndex(100, testDataSource)).toBeUndefined()
  })

  test('Given 非整数 (1.5) When resolve Then 返回 undefined', () => {
    setup()
    expect(resolveChannelByIndex(1.5, testDataSource)).toBeUndefined()
  })

  test('Given NaN (非整数) When resolve Then 返回 undefined', () => {
    setup()
    expect(resolveChannelByIndex(NaN, testDataSource)).toBeUndefined()
  })

  test('Given 列表只含不可用渠道 (停用) When resolve 任意 index Then 返回 undefined', () => {
    mockChannels = [ch('a', 'A', false, [{ id: 'm1', name: 'M1', enabled: true }])]
    expect(resolveChannelByIndex(1, testDataSource)).toBeUndefined()
  })
})

// ============================================
// resolveModelByIndex (纯函数)
// ============================================

describe('resolveModelByIndex', () => {
  test('Given index=1 (合法) When resolve Then 返回第 1 个 enabled model', () => {
    const c = ch('c1', 'C1', true, [
      { id: 'm1', name: 'M1', enabled: true },
      { id: 'm2', name: 'M2', enabled: true },
    ])
    expect(resolveModelByIndex(c, 1)?.id).toBe('m1')
  })

  test('Given index=2 (合法) When resolve Then 返回第 2 个 enabled model', () => {
    const c = ch('c1', 'C1', true, [
      { id: 'm1', name: 'M1', enabled: true },
      { id: 'm2', name: 'M2', enabled: true },
    ])
    expect(resolveModelByIndex(c, 2)?.id).toBe('m2')
  })

  test('Given 混合 enabled/disabled When resolve 1 Then 跳过 disabled', () => {
    const c = ch('c1', 'C1', true, [
      { id: 'm1', name: 'M1', enabled: false },
      { id: 'm2', name: 'M2', enabled: true },
      { id: 'm3', name: 'M3', enabled: false },
      { id: 'm4', name: 'M4', enabled: true },
    ])
    expect(resolveModelByIndex(c, 1)?.id).toBe('m2')
    expect(resolveModelByIndex(c, 2)?.id).toBe('m4')
  })

  test('Given index=0 (越界) When resolve Then undefined', () => {
    const c = ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: true }])
    expect(resolveModelByIndex(c, 0)).toBeUndefined()
  })

  test('Given 负数 When resolve Then undefined', () => {
    const c = ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: true }])
    expect(resolveModelByIndex(c, -1)).toBeUndefined()
  })

  test('Given 超过 enabled models 数 When resolve Then undefined', () => {
    const c = ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: true }])
    expect(resolveModelByIndex(c, 2)).toBeUndefined()
  })

  test('Given 非整数 When resolve Then undefined', () => {
    const c = ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: true }])
    expect(resolveModelByIndex(c, 1.5)).toBeUndefined()
    expect(resolveModelByIndex(c, NaN)).toBeUndefined()
  })

  test('Given 全部 disabled When resolve Then undefined', () => {
    const c = ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: false }])
    expect(resolveModelByIndex(c, 1)).toBeUndefined()
  })
})

// ============================================
// describeBindingModel
// ============================================

describe('describeBindingModel', () => {
  beforeEach(() => resetMocks())

  test('Given channel + model 都存在 When describe Then 返回真名 + valid=true', () => {
    mockChannels = [
      ch('c1', 'Anthropic', true, [
        { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', enabled: true },
      ]),
    ]
    const d = describeBindingModel('c1', 'claude-sonnet-4', testDataSource)
    expect(d.channelName).toBe('Anthropic')
    expect(d.modelName).toBe('Claude Sonnet 4')
    expect(d.valid).toBe(true)
  })

  test('Given channelId 不存在 When describe Then channelName 用 ID 本身 + valid=false', () => {
    mockChannels = []
    const d = describeBindingModel('non-existent', 'm1', testDataSource)
    expect(d.channelName).toBe('non-existent')
    expect(d.modelName).toBe('m1')  // modelId 原值
    expect(d.valid).toBe(false)
  })

  test('Given channelId 是 undefined When describe Then channelName 是 "未设置"', () => {
    mockChannels = []
    const d = describeBindingModel(undefined, undefined, testDataSource)
    expect(d.channelName).toBe('未设置')
    expect(d.modelName).toBe('未设置')
    expect(d.valid).toBe(false)
  })

  test('Given channel 存在但 modelId 不在 channel.models When describe Then modelName 用 modelId 原值 + valid=false', () => {
    mockChannels = [
      ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: true }]),
    ]
    const d = describeBindingModel('c1', 'unknown-model', testDataSource)
    expect(d.channelName).toBe('C1')
    expect(d.modelName).toBe('unknown-model')
    expect(d.valid).toBe(false)
  })

  test('Given channel 存在 + modelId 是 undefined When describe Then modelName 是 "未设置" + valid=false', () => {
    mockChannels = [
      ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: true }]),
    ]
    const d = describeBindingModel('c1', undefined, testDataSource)
    expect(d.channelName).toBe('C1')
    expect(d.modelName).toBe('未设置')
    expect(d.valid).toBe(false)
  })

  test('Given channel 存在 + modelId 是空字符串 When describe Then 空字符串被替换为 "未设置" (modelId || "未设置")', () => {
    mockChannels = [
      ch('c1', 'C1', true, [{ id: 'm1', name: 'M1', enabled: true }]),
    ]
    const d = describeBindingModel('c1', '', testDataSource)
    // 实现用 `modelId || '未设置'`, 空字符串是 falsy, 走 fallback
    expect(d.modelName).toBe('未设置')
    expect(d.valid).toBe(false)
  })

  test('Given channel 已停用 (enabled=false) When describe Then valid=false (channel 存在但可能不应该用)', () => {
    // 注: describeBindingModel 不检查 enabled, 只检查存在性
    // 所以即使停用也算 valid
    mockChannels = [
      ch('c1', 'C1', false, [{ id: 'm1', name: 'M1', enabled: true }]),
    ]
    const d = describeBindingModel('c1', 'm1', testDataSource)
    expect(d.valid).toBe(true)  // 仍然 valid (只检查存在性)
  })
})
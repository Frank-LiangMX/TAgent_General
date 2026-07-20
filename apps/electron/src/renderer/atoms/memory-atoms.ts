/**
 * Memory 模块 atoms
 *
 * 记忆页已改为 rail-only 主区自管视图（见 MemoryMonitorPanel），
 * 不再通过左栏 bridge 驱动。保留类型导出供后续扩展。
 */

export type MemoryLayerKey = 'L0' | 'L1' | 'L2' | 'L3' | 'L4' | 'L5'

export type MemoryViewMode = 'layers' | 'graph' | 'pending' | 'sessions'

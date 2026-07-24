/**
 * 终端 tabs 状态持久化 atoms
 *
 * 把 tabs 状态从 TerminalPanel 组件内 useState 上提到 Jotai atom，跨组件卸载/重挂
 * 仍保持（atom 存在 store 里，不随组件生命周期销灭）。
 *
 * 修 bug 核心场景：用户关空所有 tab（tabs=[]）→ 切到别的 rail（组件卸载）→
 * 切回终端 rail（组件重挂）→ 从 atom 读回 [] 保持空态，不再被 initialTerminalTabState
 * 重置成 1 个 main tab。
 *
 * 按 workspaceKey 隔离：atomFamily(workspaceKey)，每个工作区一份 tabs 状态，
 * 切工作区时各份独立。空态（[]）也持久化，不补 initial tab。
 */

import { atom } from 'jotai'
import { atomFamily } from 'jotai/utils'

/** 单个终端 tab 描述 */
export interface TerminalTab {
  id: string
  index: number
  title?: string
}

/** 一个工作区的终端 tabs 整体状态（tabs 列表 + 当前活跃 tab id） */
export interface TerminalTabState {
  tabs: TerminalTab[]
  activeTabId: string
}

/**
 * 按 workspaceKey 隔离的终端 tabs 状态 atomFamily。
 *
 * 每个参数 workspaceKey 对应一个独立 atom，存该工作区的 tabs 状态。
 * 首次读取时 atom 还没初始化值（atom 工厂返回的 atom 初始值为 undefined），
 * 由组件用 initialTerminalTabState() 兜底——若 atom 值为空（undefined）才用 initial，
 * 一旦写入过（哪怕是空 []）就以 atom 值为准，空态持久化得以保证。
 *
 * atomFamily 的 key 是 workspaceKey 字符串，删除某 workspaceKey 的状态用
 * atomFamily.remove(workspaceKey) 回收内存（切工作区场景下不主动 remove，
 * 让各工作区状态常驻 store，切回时恢复）。
 */
export const terminalTabsStateFamily = atomFamily((_workspaceKey: string) =>
  atom<TerminalTabState | null>(null)
)

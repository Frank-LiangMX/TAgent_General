/**
 * Workspace Atom - 工作区相关状态
 *
 * 管理工作区管理弹窗的开关状态。
 * - true: WorkspaceManagerDialog 打开
 * - false: 关闭
 */

import { atom } from 'jotai'

/** 工作区管理弹窗是否打开 */
export const workspaceManagerOpenAtom = atom(false)

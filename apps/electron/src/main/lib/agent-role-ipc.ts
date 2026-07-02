/**
 * Agent 角色库 IPC 处理器
 *
 * 由 main/ipc.ts 在 registerIpcHandlers() 中调用 registerAgentRoleIpcHandlers() 注册。
 * handler 内部调用 agent-role-service 的 CRUD 方法。
 *
 * 通道：AGENT_ROLE_IPC_CHANNELS（@tagent/shared）
 *
 * 与 SOUL.md IPC（soul:get-content / soul:save-content）并列，同属人格/角色配置层。
 */

import { ipcMain } from 'electron'

import {
  AGENT_ROLE_IPC_CHANNELS,
  type SaveAgentRoleInput,
  type DeleteAgentRoleInput,
} from '@tagent/shared'

import {
  loadRoles,
  getRoleById,
  saveRole,
  deleteRole,
  resetDefaultRoles,
} from './agent-role-service'

/** 注册角色库 IPC 处理器 */
export function registerAgentRoleIpcHandlers(): void {
  ipcMain.handle(AGENT_ROLE_IPC_CHANNELS.LIST, async () => {
    return loadRoles()
  })

  ipcMain.handle(AGENT_ROLE_IPC_CHANNELS.GET, async (_event, roleId: string) => {
    return getRoleById(roleId)
  })

  ipcMain.handle(AGENT_ROLE_IPC_CHANNELS.SAVE, async (_event, input: SaveAgentRoleInput) => {
    return saveRole(input.role)
  })

  ipcMain.handle(AGENT_ROLE_IPC_CHANNELS.DELETE, async (_event, input: DeleteAgentRoleInput) => {
    return deleteRole(input.roleId)
  })

  ipcMain.handle(AGENT_ROLE_IPC_CHANNELS.RESET_DEFAULT, async () => {
    return resetDefaultRoles()
  })

  console.log('[角色库] IPC 处理器已注册')
}

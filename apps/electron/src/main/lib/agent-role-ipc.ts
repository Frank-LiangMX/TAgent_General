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

import { ipcMain, dialog, BrowserWindow } from 'electron'

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
  deleteRoles,
  resetDefaultRoles,
  importRoleFromMd,
  findSimilarRoles,
} from './agent-role-service'
import { loadRoleStoreCatalog, installStoreRole } from './role-store-service'

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

  // ─── 角色商店 ────────────────────────────────────────────────

  ipcMain.handle(AGENT_ROLE_IPC_CHANNELS.STORE_LIST, async () => {
    return loadRoleStoreCatalog()
  })

  ipcMain.handle(AGENT_ROLE_IPC_CHANNELS.STORE_INSTALL, async (_event, roleId: string) => {
    return installStoreRole(roleId)
  })

  ipcMain.handle(AGENT_ROLE_IPC_CHANNELS.IMPORT_MD, async () => {
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!win) return { role: null, imported: false, reason: '无可用窗口' }

    const result = await dialog.showOpenDialog(win, {
      title: '导入角色 .md 文件',
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: 'Markdown', extensions: ['md'] }],
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { role: null, imported: false, reason: '已取消' }
    }

    // 导入第一个文件（单选模式下只有一个）
    return importRoleFromMd(result.filePaths[0]!)
  })

  ipcMain.handle(
    AGENT_ROLE_IPC_CHANNELS.FIND_SIMILAR,
    async (_event, displayName: string) => {
      return findSimilarRoles(displayName)
    }
  )

  ipcMain.handle(
    AGENT_ROLE_IPC_CHANNELS.DELETE_BATCH,
    async (_event, roleIds: string[]) => {
      return deleteRoles(roleIds)
    }
  )

  console.log('[角色库] IPC 处理器已注册')
}

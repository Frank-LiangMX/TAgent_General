/**
 * Agent 角色库 atoms
 *
 * 缓存角色列表，提供 roleId → displayName 映射。
 * 看板任务卡片等组件用 useAgentRoleMap() 获取映射，显示角色徽章。
 *
 * 首次订阅时自动加载，角色更新后调用 refreshAgentRoles 刷新缓存。
 */

import { atom, useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'

import type { AgentRoleProfile } from '@tagent/shared'

/** 角色列表 atom（首次访问时为空数组，由 loaderAtom 填充） */
export const agentRolesAtom = atom<AgentRoleProfile[]>([])

/** 角色加载状态 */
const agentRolesLoadingAtom = atom<boolean>(false)

/** 是否已加载过（避免重复请求） */
let loaded = false

/** 加载角色列表到 atom */
const loadAgentRolesAtom = atom(null, (get, set) => {
  if (loaded || get(agentRolesLoadingAtom)) return
  set(agentRolesLoadingAtom, true)
  window.electronAPI.agentRole
    .list()
    .then((roles) => {
      set(agentRolesAtom, roles)
      loaded = true
    })
    .catch((err) => {
      console.error('[角色库] 加载角色列表失败:', err)
    })
    .finally(() => {
      set(agentRolesLoadingAtom, false)
    })
})

/** 刷新角色列表缓存（角色保存/重置后调用） */
export function useRefreshAgentRoles(): () => void {
  const setRoles = useSetAtom(agentRolesAtom)
  return () => {
    loaded = false
    window.electronAPI.agentRole
      .list()
      .then((roles) => setRoles(roles))
      .catch((err) => console.error('[角色库] 刷新角色列表失败:', err))
  }
}

/**
 * 获取 roleId → displayName 映射的 hook
 *
 * 首次调用时自动触发角色列表加载，后续订阅更新。
 * 看板任务卡片等高频渲染组件用此 hook 显示角色徽章。
 */
export function useAgentRoleMap(): Map<string, string> {
  const roles = useAtomValue(agentRolesAtom)
  const load = useSetAtom(loadAgentRolesAtom)
  useEffect(() => {
    load()
  }, [load])
  return new Map(roles.map((r) => [r.id, r.displayName]))
}

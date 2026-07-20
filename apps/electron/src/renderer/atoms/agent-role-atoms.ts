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

import type { AgentRoleProfile, RoleStoreCatalogEntry } from '@tagent/shared'

/** 角色列表 atom（首次访问时为空数组，由 loaderAtom 填充） */
export const agentRolesAtom = atom<AgentRoleProfile[]>([])

/** 角色加载状态 */
export const agentRolesLoadingAtom = atom<boolean>(false)

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
 * 确保角色列表已加载（角色库面板用）
 */
export function useEnsureAgentRoles(): {
  roles: AgentRoleProfile[]
  loading: boolean
} {
  const roles = useAtomValue(agentRolesAtom)
  const loading = useAtomValue(agentRolesLoadingAtom)
  const load = useSetAtom(loadAgentRolesAtom)
  useEffect(() => {
    load()
  }, [load])
  return { roles, loading: loading || (!loaded && roles.length === 0) }
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

// ─── 角色商店 atoms ────────────────────────────────────────────────

/** 角色商店 catalog 条目列表 */
export const roleStoreCatalogAtom = atom<RoleStoreCatalogEntry[]>([])

/** 角色商店加载状态 */
export const roleStoreLoadingAtom = atom<boolean>(false)

/** 角色商店数据来源 */
export const roleStoreSourceAtom = atom<'remote' | 'cached' | 'builtin'>('builtin')

/** 是否已加载过商店 catalog */
let storeLoaded = false

/** 加载角色商店 catalog */
const loadRoleStoreCatalogAtom = atom(null, (get, set) => {
  if (storeLoaded || get(roleStoreLoadingAtom)) return
  set(roleStoreLoadingAtom, true)
  window.electronAPI.agentRole
    .storeList()
    .then((result) => {
      set(roleStoreCatalogAtom, result.catalog.entries)
      set(roleStoreSourceAtom, result.source)
      storeLoaded = true
    })
    .catch((err) => {
      console.error('[角色商店] 加载 catalog 失败:', err)
    })
    .finally(() => {
      set(roleStoreLoadingAtom, false)
    })
})

/** 刷新角色商店 catalog */
export function useRefreshRoleStore(): () => void {
  const setEntries = useSetAtom(roleStoreCatalogAtom)
  const setSource = useSetAtom(roleStoreSourceAtom)
  return () => {
    storeLoaded = false
    window.electronAPI.agentRole
      .storeList()
      .then((result) => {
        setEntries(result.catalog.entries)
        setSource(result.source)
      })
      .catch((err) => console.error('[角色商店] 刷新 catalog 失败:', err))
  }
}

/**
 * 加载角色商店 catalog 的 hook
 *
 * 首次调用时自动触发加载，后续订阅更新。
 */
export function useLoadRoleStoreCatalog() {
  const load = useSetAtom(loadRoleStoreCatalogAtom)
  useEffect(() => {
    load()
  }, [load])
}

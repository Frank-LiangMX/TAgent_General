/**
 * AiOfficeCanvas — Pixi.js 画布宿主 + Agent 右键菜单
 *
 * 承载 OfficeScene，处理 Agent 点击事件和右键菜单。
 */
import { useEffect, useRef, useState } from 'react'
import { OfficeScene, type OfficeAgentClick } from './scene/OfficeScene'
import { OFFICE_STATE_LABELS } from './officeWorkerProjection'
import type { OfficeAgent } from './types/office-agent'

type AgentMenuState = {
  agent: OfficeAgent
  rosterNo: number
  x: number
  y: number
}

interface AiOfficeCanvasProps {
  /** External agents to sync (from Kanban tasks) */
  externalAgents: OfficeAgent[]
  /** 打开与 worker 绑定的看板任务 */
  onAgentSelect?: (taskId: string) => void
}

export function AiOfficeCanvas({ externalAgents, onAgentSelect }: AiOfficeCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const readyRef = useRef(false)
  const [menu, setMenu] = useState<AgentMenuState | null>(null)

  // Initialize Pixi.js scene
  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const handleAgentClick = (event: OfficeAgentClick) => {
      const rect = host.getBoundingClientRect()
      const menuWidth = 220
      setMenu({
        agent: event.agent,
        rosterNo: event.rosterNo,
        x: Math.max(12, Math.min(event.clientX - rect.left, rect.width - menuWidth - 12)),
        y: Math.max(12, Math.min(event.clientY - rect.top, rect.height - 200)),
      })
    }

    const scene = new OfficeScene({ onAgentClick: handleAgentClick })
    sceneRef.current = scene

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return

      if (!readyRef.current) {
        readyRef.current = true
        void scene.init(host, width, height)
        return
      }
      sceneRef.current?.resize(width, height)
    })

    ro.observe(host)

    return () => {
      ro.disconnect()
      readyRef.current = false
      scene.destroy()
      sceneRef.current = null
    }
  }, [])

  // Sync external agents (from Kanban) to scene
  useEffect(() => {
    sceneRef.current?.setAgents(externalAgents)
    setMenu((current) => {
      if (!current) return null
      const agent = externalAgents.find((item) => item.id === current.agent.id)
      return agent ? { ...current, agent } : null
    })
  }, [externalAgents])

  // Close menu on click outside
  useEffect(() => {
    const close = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.ai-office-menu')) {
        return
      }
      setMenu(null)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }

    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [])

  const openTask = () => {
    if (!menu?.agent.taskId) return
    onAgentSelect?.(menu.agent.taskId)
    setMenu(null)
  }

  return (
    <div ref={hostRef} className="ai-office-canvas">
      {/* Zoom controls */}
      <div className="ai-office-toolbar">
        <button
          type="button"
          className="ai-office-toolbar-btn"
          onClick={() => sceneRef.current?.resetView()}
          title="重置视图 (双击画布)"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
          </svg>
        </button>
        <span className="ai-office-toolbar-hint">滚轮缩放 · 拖拽移动 · 双击重置</span>
      </div>

      {menu && (
        <div className="ai-office-menu" style={{ left: menu.x, top: menu.y }}>
          <div className="ai-office-menu-header">
            <span className="ai-office-menu-name">{menu.agent.name}</span>
            <span className="ai-office-menu-state">{OFFICE_STATE_LABELS[menu.agent.state]}</span>
          </div>

          <div className="ai-office-menu-group">
            <div className="ai-office-menu-label">
              {menu.agent.kind === 'director' ? '当前活动' : '当前任务'}
            </div>
            <p className="ai-office-menu-copy">{menu.agent.currentTask}</p>
            {menu.agent.lastToolName ? (
              <p className="ai-office-menu-meta">工具：{menu.agent.lastToolName}</p>
            ) : null}
            {menu.agent.ambientActivity?.label ? (
              <p className="ai-office-menu-meta">场景：{menu.agent.ambientActivity.label}</p>
            ) : null}
            {menu.agent.kind === 'director' ? (
              <p className="ai-office-menu-meta">身份：主会话总监</p>
            ) : menu.agent.workerSessionId ? (
              <p className="ai-office-menu-meta">会话：{menu.agent.workerSessionId}</p>
            ) : (
              <p className="ai-office-menu-meta">尚未领取 worker 会话</p>
            )}
          </div>

          {menu.agent.taskId ? (
            <button type="button" className="ai-office-menu-btn" onClick={openTask}>
              查看 worker 任务
            </button>
          ) : null}
        </div>
      )}

      {externalAgents.length === 0 ? (
        <div className="ai-office-empty">当前看板还没有 worker 任务</div>
      ) : null}
    </div>
  )
}

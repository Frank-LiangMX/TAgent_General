/**
 * AiOfficeCanvas — Pixi.js 画布宿主 + Agent 右键菜单
 *
 * 承载 OfficeScene，处理 Agent 点击事件和右键菜单。
 */
import { useEffect, useRef, useState } from 'react'
import { OfficeScene, type OfficeAgentClick } from './scene/OfficeScene'
import type { OfficeAgent, OfficeAgentState } from './types/office-agent'

type AgentMenuState = {
  agent: OfficeAgent
  rosterNo: number
  x: number
  y: number
  agents: OfficeAgent[]
}

const STATE_ACTIONS: Array<{
  label: string
  state: OfficeAgentState
  task?: string
}> = [
  { label: '开始工作', state: 'working', task: '处理当前任务…' },
  { label: '进入思考', state: 'thinking', task: '思考下一步…' },
  { label: '暂时空闲', state: 'idle' },
]

const EMOTE_ACTIONS = [
  { label: '挥手', animation: 'emotes/wave' },
  { label: '兴奋', animation: 'emotes/excited' },
  { label: '思考', animation: 'emotes/thinking' },
  { label: '灵感', animation: 'emotes/idea' },
  { label: '坚定', animation: 'emotes/determined' },
  { label: '大笑', animation: 'emotes/laugh' },
] as const

interface AiOfficeCanvasProps {
  /** External agents to sync (from Kanban tasks) */
  externalAgents?: OfficeAgent[]
}

export function AiOfficeCanvas({ externalAgents }: AiOfficeCanvasProps) {
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
        agents: sceneRef.current?.getAgents() ?? [],
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
    if (!externalAgents || externalAgents.length === 0) return
    sceneRef.current?.setAgents(externalAgents)
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

  const applyState = (state: OfficeAgentState, task?: string) => {
    if (!menu) return
    sceneRef.current?.setAgentState(menu.agent.id, state, task)
    setMenu(null)
  }

  const playEmote = (animation: string) => {
    if (!menu) return
    sceneRef.current?.playAgentAnimation(menu.agent.id, animation)
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
          </svg>
        </button>
        <span className="ai-office-toolbar-hint">滚轮缩放 · 拖拽移动 · 双击重置</span>
      </div>

      {menu && (
        <div
          className="ai-office-menu"
          style={{ left: menu.x, top: menu.y }}
        >
          <div className="ai-office-menu-header">
            <span className="ai-office-menu-name">{menu.agent.name}</span>
            <span className="ai-office-menu-state">{menu.agent.state}</span>
          </div>

          <div className="ai-office-menu-group">
            <div className="ai-office-menu-label">状态</div>
            {STATE_ACTIONS.map((action) => (
              <button
                key={action.label}
                type="button"
                className="ai-office-menu-btn"
                onClick={() => applyState(action.state, action.task)}
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="ai-office-menu-group">
            <div className="ai-office-menu-label">表情</div>
            <div className="ai-office-emote-grid">
              {EMOTE_ACTIONS.map((action) => (
                <button
                  key={action.animation}
                  type="button"
                  className="ai-office-emote-btn"
                  onClick={() => playEmote(action.animation)}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * AiOfficeCanvas — Pixi.js 画布宿主 + Agent 右键菜单
 *
 * 承载 OfficeScene，处理 Agent 点击事件和右键菜单。
 */
import { ArrowLeft, Maximize2, RefreshCw, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { OfficeScene, type OfficeAgentClick, type OfficeCameraState } from './scene/OfficeScene'
import { OFFICE_SEMANTIC_LABELS, OFFICE_STATE_LABELS } from './officeWorkerProjection'
import type { OfficeAgent } from './types/office-agent'
import type { OfficeMotionMode } from '@/atoms/session-presentation-atoms'
import { Tooltip, TooltipContent, TooltipTrigger } from '@tagent/ui'

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
  cameraState?: OfficeCameraState
  onCameraChange?: (state: OfficeCameraState) => void
  motionMode?: OfficeMotionMode
  onFallbackClassic?: () => void
}

export function AiOfficeCanvas({
  externalAgents,
  onAgentSelect,
  cameraState,
  onCameraChange,
  motionMode = 'full',
  onFallbackClassic,
}: AiOfficeCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<OfficeScene | null>(null)
  const externalAgentsRef = useRef(externalAgents)
  const readyRef = useRef(false)
  const [menu, setMenu] = useState<AgentMenuState | null>(null)
  const [sceneError, setSceneError] = useState<string | null>(null)
  const [sceneAttempt, setSceneAttempt] = useState(0)
  const [rosterOpen, setRosterOpen] = useState(false)
  const initialCameraRef = useRef(cameraState)
  const initialMotionModeRef = useRef(motionMode)
  const cameraCallbackRef = useRef(onCameraChange)
  externalAgentsRef.current = externalAgents
  cameraCallbackRef.current = onCameraChange

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

    let disposed = false
    const scene = new OfficeScene({
      onAgentClick: handleAgentClick,
      initialCamera: initialCameraRef.current,
      reducedMotion: initialMotionModeRef.current === 'reduced',
      onCameraChange: (state) => cameraCallbackRef.current?.(state),
    })
    sceneRef.current = scene
    scene.setAgents(externalAgentsRef.current)
    setSceneError(null)

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      if (width <= 0 || height <= 0) return

      if (!readyRef.current) {
        readyRef.current = true
        void scene
          .init(host, width, height)
          .then(() => {
            if (!disposed) scene.setPaused(document.hidden)
          })
          .catch((error: unknown) => {
            if (disposed) return
            const message = error instanceof Error ? error.message : String(error)
            console.error('[AiOfficeCanvas] 场景初始化失败:', error)
            setSceneError(message)
          })
        return
      }
      sceneRef.current?.resize(width, height)
    })

    ro.observe(host)

    return () => {
      disposed = true
      ro.disconnect()
      readyRef.current = false
      scene.destroy()
      sceneRef.current = null
    }
  }, [sceneAttempt])

  // Sync external agents (from Kanban) to scene
  useEffect(() => {
    sceneRef.current?.setAgents(externalAgents)
    setMenu((current) => {
      if (!current) return null
      const agent = externalAgents.find((item) => item.id === current.agent.id)
      return agent ? { ...current, agent } : null
    })
  }, [externalAgents])

  useEffect(() => {
    sceneRef.current?.setReducedMotion(motionMode === 'reduced')
  }, [motionMode])

  useEffect(() => {
    const syncVisibility = () => sceneRef.current?.setPaused(document.hidden)
    document.addEventListener('visibilitychange', syncVisibility)
    return () => document.removeEventListener('visibilitychange', syncVisibility)
  }, [])

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
      if (event.key !== 'Escape') return
      setMenu(null)
      setRosterOpen(false)
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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="ai-office-toolbar-btn"
              onClick={() => sceneRef.current?.resetView()}
              aria-label="重置办公室视图"
            >
              <Maximize2 className="size-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>重置视图 (双击画布)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="ai-office-toolbar-btn"
              onClick={() => setRosterOpen((value) => !value)}
              aria-label="查看办公室成员及状态"
              aria-expanded={rosterOpen}
            >
              <Users className="size-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent>查看办公室成员</TooltipContent>
        </Tooltip>
        <span className="ai-office-toolbar-hint">滚轮缩放 · 拖拽移动 · 双击重置</span>
      </div>

      {rosterOpen ? (
        <section className="ai-office-roster" aria-label="办公室成员状态">
          <div className="ai-office-roster-header">
            <div>
              <div className="ai-office-roster-title">办公室成员</div>
              <div className="ai-office-roster-count">{externalAgents.length} 人在场</div>
            </div>
            <button
              type="button"
              className="ai-office-roster-close"
              onClick={() => setRosterOpen(false)}
              aria-label="关闭办公室成员列表"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="ai-office-roster-list">
            {externalAgents.map((agent) => {
              const status = agent.semanticState
                ? OFFICE_SEMANTIC_LABELS[agent.semanticState]
                : OFFICE_STATE_LABELS[agent.state]
              const content = (
                <>
                  <span className="ai-office-roster-row-main">
                    <span className="ai-office-roster-name">{agent.name}</span>
                    <span className="ai-office-roster-state">{status}</span>
                  </span>
                  <span className="ai-office-roster-task">{agent.currentTask}</span>
                </>
              )
              return agent.taskId ? (
                <button
                  key={agent.id}
                  type="button"
                  className="ai-office-roster-row"
                  onClick={() => {
                    onAgentSelect?.(agent.taskId!)
                    setRosterOpen(false)
                  }}
                  aria-label={`查看 ${agent.name} 的任务详情，当前${status}`}
                >
                  {content}
                </button>
              ) : (
                <div key={agent.id} className="ai-office-roster-row" role="status">
                  {content}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {sceneError ? (
        <div className="ai-office-error" role="alert">
          <div className="ai-office-error-card">
            <div className="ai-office-error-title">办公室场景加载失败</div>
            <p className="ai-office-error-copy">{sceneError}</p>
            <div className="ai-office-error-actions">
              <button
                type="button"
                className="ai-office-menu-btn"
                onClick={() => {
                  readyRef.current = false
                  initialCameraRef.current = cameraState
                  initialMotionModeRef.current = motionMode
                  setSceneAttempt((value) => value + 1)
                }}
              >
                <RefreshCw className="size-4" aria-hidden />
                重试场景
              </button>
              {onFallbackClassic ? (
                <button
                  type="button"
                  className="ai-office-menu-btn ai-office-menu-btn--secondary"
                  onClick={onFallbackClassic}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  返回经典工作台
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {menu && (
        <div className="ai-office-menu" style={{ left: menu.x, top: menu.y }}>
          <div className="ai-office-menu-header">
            <span className="ai-office-menu-name">{menu.agent.name}</span>
            <span className="ai-office-menu-state">
              {menu.agent.semanticState
                ? OFFICE_SEMANTIC_LABELS[menu.agent.semanticState]
                : OFFICE_STATE_LABELS[menu.agent.state]}
            </span>
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

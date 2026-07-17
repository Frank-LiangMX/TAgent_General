// @ts-nocheck
import { Application, Container, Graphics, Sprite } from 'pixi.js'
import type { FederatedPointerEvent } from 'pixi.js'
import type { OfficeAgent, OfficeAgentState } from '../types/office-agent'
import {
  COLORS,
  DESKS,
  INITIAL_AGENTS,
  SCENE_HEIGHT,
  SCENE_WIDTH,
  isDeskWorkerState,
} from './layout/officeLayout'
import { AgentEntity } from './entities/AgentEntity'
import { DeskEntity } from './entities/DeskEntity'
import { MovementSystem } from './systems/MovementSystem'
import { AnimationSystem } from './systems/AnimationSystem'
import { OfficeSimulator } from './simulation/OfficeSimulator'
import { transitionWorkerRoster } from './simulation/workerStateTransition'
import { bindOfficeScene } from './officeSceneBridge'
import { getOfficeBackgroundTexture, loadOfficeAssets } from './assets/loadOfficeAssets'
import { loadSpineAssets } from './assets/loadSpineAssets'

export type OfficeAgentClick = {
  agent: OfficeAgent
  rosterNo: number
  clientX: number
  clientY: number
}

export interface OfficeCameraState {
  scale: number
  offsetX: number
  offsetY: number
}

const MIN_ZOOM = 0.3
const MAX_ZOOM = 3.0
const ZOOM_SPEED = 0.001

export class OfficeScene {
  private app: Application | null = null
  private world: Container | null = null
  private agentEntities = new Map<string, AgentEntity>()
  private deskEntities = new Map<string, DeskEntity>()
  private officeLayer: Container | null = null

  private movement = new MovementSystem()
  private animation = new AnimationSystem()
  private simulator = new OfficeSimulator()

  private agents: OfficeAgent[] = INITIAL_AGENTS.map((a) => ({ ...a }))
  private readonly options: {
    onAgentClick?: (event: OfficeAgentClick) => void
    onCameraChange?: (state: OfficeCameraState) => void
    initialCamera?: OfficeCameraState
    reducedMotion?: boolean
  }

  // Pan/zoom state
  private userScale = 1
  private userOffsetX = 0
  private userOffsetY = 0
  private baseScale = 1
  private baseOffsetX = 0
  private baseOffsetY = 0
  private isDragging = false
  private dragStartX = 0
  private dragStartY = 0
  private dragStartOffsetX = 0
  private dragStartOffsetY = 0
  private containerWidth = 0
  private containerHeight = 0
  private reduceMotion = false
  private hasProjectedRoster = false
  private interactionCleanup: (() => void) | null = null
  private viewStateFrame: number | null = null
  private destroyed = false
  private paused = false

  constructor(
    options: {
      onAgentClick?: (event: OfficeAgentClick) => void
      onCameraChange?: (state: OfficeCameraState) => void
      initialCamera?: OfficeCameraState
      reducedMotion?: boolean
    } = {}
  ) {
    this.options = options
  }

  async init(container: HTMLElement, width: number, height: number) {
    this.destroyed = false
    this.containerWidth = width
    this.containerHeight = height
    // 只读取 TAgent 产品内设置；不让系统 motion preference 改写业务状态。
    this.reduceMotion = this.options.reducedMotion ?? false
    this.simulator.setReduceMotion(this.reduceMotion)
    this.movement.setSpeedMultiplier(this.reduceMotion ? 1.8 : 1)

    const app = new Application()
    await app.init({
      width,
      height,
      backgroundColor: COLORS.floor,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    })

    if (this.destroyed) {
      app.destroy(true, { children: true })
      return
    }

    this.app = app
    container.appendChild(app.canvas)

    this.world = new Container()
    app.stage.addChild(this.world)

    await loadSpineAssets()
    await loadOfficeAssets()

    if (this.destroyed || !this.world) return

    this.drawMap(this.world)
    this.spawnOffice(this.world)
    this.pushDataToEntities()

    // Initial fit
    this.computeBaseTransform()
    if (this.options.initialCamera) {
      this.userScale = Math.max(0.3, Math.min(3, this.options.initialCamera.scale))
      this.userOffsetX = this.options.initialCamera.offsetX
      this.userOffsetY = this.options.initialCamera.offsetY
    }
    this.applyTransform()

    // Pan/zoom event handlers
    this.setupInteraction()

    app.ticker.add(this.onTick)
    if (this.paused) app.ticker.stop()
    bindOfficeScene(this)
  }

  requestDeskVisit(visitorRosterNo: number, hostRosterNo: number, message: string) {
    this.agents = this.simulator.startDeskVisit(this.agents, visitorRosterNo, hostRosterNo, message)
    this.pushDataToEntities()
  }

  requestDeskVisitTour(
    visitorRosterNo: number,
    hostRosterNos: number[],
    messageFn?: (hostRosterNo: number, hostName: string) => string
  ) {
    this.agents = this.simulator.startDeskVisitTour(
      this.agents,
      visitorRosterNo,
      hostRosterNos,
      messageFn
    )
    this.pushDataToEntities()
  }

  getAgents(): OfficeAgent[] {
    return this.agents.map((agent) => ({ ...agent }))
  }

  setAgents(newAgents: OfficeAgent[]) {
    this.agents = transitionWorkerRoster(
      newAgents.map((agent) => ({ ...agent })),
      this.agents,
      this.reduceMotion,
      { hydrate: !this.hasProjectedRoster }
    )
    this.hasProjectedRoster = true
    this.reconcileAgentEntities()
  }

  setReducedMotion(value: boolean) {
    this.reduceMotion = value
    this.simulator.setReduceMotion(value)
    this.movement.setSpeedMultiplier(value ? 1.8 : 1)
    for (const entity of this.agentEntities.values()) entity.setReducedMotion(value)
  }

  setPaused(value: boolean) {
    this.paused = value
    if (!this.app) return
    if (value) this.app.ticker.stop()
    else this.app.ticker.start()
  }

  getCameraState(): OfficeCameraState {
    return {
      scale: this.userScale,
      offsetX: this.userOffsetX,
      offsetY: this.userOffsetY,
    }
  }

  setCameraState(state: OfficeCameraState) {
    this.userScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, state.scale))
    this.userOffsetX = state.offsetX
    this.userOffsetY = state.offsetY
    this.applyTransform()
  }

  setAgentState(id: string, state: OfficeAgentState, task?: string) {
    this.agents = this.agents.map((agent) => {
      if (agent.id !== id) return agent
      return {
        ...agent,
        state,
        currentTask: task,
        targetX: undefined,
        targetY: undefined,
        walkPath: undefined,
        walkPathIndex: undefined,
        mission: undefined,
        bubbleText: undefined,
        customAnimation: undefined,
        viewFacing: isDeskWorkerState(state) ? ('back' as const) : agent.viewFacing,
      }
    })
    this.pushDataToEntities()
  }

  playAgentAnimation(id: string, animation: string, task?: string) {
    this.agents = this.agents.map((agent) => {
      if (agent.id !== id) return agent
      return {
        ...agent,
        state: 'talking' as const,
        currentTask: task,
        targetX: undefined,
        targetY: undefined,
        walkPath: undefined,
        walkPathIndex: undefined,
        mission: undefined,
        bubbleText: undefined,
        customAnimation: animation,
        viewFacing: 'front' as const,
        facing: 1 as const,
      }
    })
    this.pushDataToEntities()
    this.agentEntities.get(id)?.playCustomAnimation(animation, task)
    this.pullDataFromEntities()
  }

  resize(containerWidth: number, containerHeight: number) {
    if (!this.app || !this.world) return
    this.containerWidth = containerWidth
    this.containerHeight = containerHeight
    this.app.renderer.resize(containerWidth, containerHeight)
    this.computeBaseTransform()
    this.applyTransform()
  }

  /** Reset to default view (fit to container) */
  resetView() {
    this.userScale = 1
    this.userOffsetX = 0
    this.userOffsetY = 0
    this.applyTransform()
    this.emitCameraChange()
  }

  destroy() {
    this.destroyed = true
    bindOfficeScene(null)
    this.interactionCleanup?.()
    this.interactionCleanup = null
    if (this.viewStateFrame != null) cancelAnimationFrame(this.viewStateFrame)
    this.viewStateFrame = null
    this.app?.ticker.remove(this.onTick)
    this.app?.destroy(true, { children: true })
    this.app = null
    this.agentEntities.clear()
    this.deskEntities.clear()
    this.officeLayer = null
  }

  // === Pan/Zoom ===

  private computeBaseTransform() {
    this.baseScale = Math.min(
      this.containerWidth / SCENE_WIDTH,
      this.containerHeight / SCENE_HEIGHT
    )
    this.baseOffsetX = (this.containerWidth - SCENE_WIDTH * this.baseScale) / 2
    this.baseOffsetY = (this.containerHeight - SCENE_HEIGHT * this.baseScale) / 2
  }

  private applyTransform() {
    if (!this.world) return
    const scale = this.baseScale * this.userScale
    const x = this.baseOffsetX + this.userOffsetX
    const y = this.baseOffsetY + this.userOffsetY
    this.world.scale.set(scale)
    this.world.position.set(x, y)
  }

  private setupInteraction() {
    const canvas = this.app?.canvas as HTMLCanvasElement | undefined
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = -e.deltaY * ZOOM_SPEED
      const oldScale = this.userScale
      this.userScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.userScale * (1 + delta)))

      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const scaleRatio = this.userScale / oldScale
      this.userOffsetX = mouseX - scaleRatio * (mouseX - this.userOffsetX)
      this.userOffsetY = mouseY - scaleRatio * (mouseY - this.userOffsetY)

      this.applyTransform()
      this.emitCameraChange()
    }

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return // left button only
      this.isDragging = true
      this.dragStartX = e.clientX
      this.dragStartY = e.clientY
      this.dragStartOffsetX = this.userOffsetX
      this.dragStartOffsetY = this.userOffsetY
      canvas.style.cursor = 'grabbing'
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (!this.isDragging) return
      this.userOffsetX = this.dragStartOffsetX + (e.clientX - this.dragStartX)
      this.userOffsetY = this.dragStartOffsetY + (e.clientY - this.dragStartY)
      this.applyTransform()
    }

    const handleMouseUp = () => {
      if (this.isDragging) this.emitCameraChange()
      this.isDragging = false
      canvas.style.cursor = 'grab'
    }

    const handleDoubleClick = () => this.resetView()

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('dblclick', handleDoubleClick)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    canvas.style.cursor = 'grab'
    this.interactionCleanup = () => {
      canvas.removeEventListener('wheel', handleWheel)
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('dblclick', handleDoubleClick)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }

  private emitCameraChange() {
    if (!this.options.onCameraChange || this.viewStateFrame != null) return
    this.viewStateFrame = requestAnimationFrame(() => {
      this.viewStateFrame = null
      this.options.onCameraChange?.(this.getCameraState())
    })
  }

  // === Tick loop ===

  private onTick = (ticker: { deltaTime: number }) => {
    const dt = Math.min(ticker.deltaTime / 60, 0.05)

    this.agents = this.simulator.tick(dt, this.agents)
    this.pushDataToEntities()

    this.movement.update(this.agentEntities, dt)
    this.pullDataFromEntities()

    this.agents = this.simulator.afterMovement(dt, this.agents, this.agentEntities)
    this.pushDataToEntities()

    this.animation.update(this.agentEntities, dt)
    this.sortOfficeDepth()
    this.syncDeskOccupancy()
  }

  private sortOfficeDepth() {
    if (!this.officeLayer) return
    const agentPositions = [...this.agentEntities.values()].map((e) => ({
      x: e.position.x,
      y: e.position.y,
    }))
    for (const e of this.agentEntities.values()) {
      e.zIndex = e.position.y
    }
    for (const desk of this.deskEntities.values()) {
      desk.updateDepthZ(agentPositions)
    }
    this.officeLayer.sortChildren()
  }

  private pushDataToEntities() {
    for (const agent of this.agents) {
      const entity = this.agentEntities.get(agent.id)
      if (!entity) continue
      const prev = entity.data
      entity.apply(agent)
      if (prev.x !== agent.x || prev.y !== agent.y || agent.state !== 'walking') {
        entity.setPosition(agent.x, agent.y)
      }
    }
  }

  /** Kanban task 列表变化时同步创建、更新和销毁场景实体。 */
  private reconcileAgentEntities() {
    if (!this.officeLayer) return

    const nextIds = new Set(this.agents.map((agent) => agent.id))
    for (const [id, entity] of this.agentEntities) {
      if (nextIds.has(id)) continue
      this.officeLayer.removeChild(entity)
      entity.destroy({ children: true })
      this.agentEntities.delete(id)
    }

    for (const agent of this.agents) {
      const existing = this.agentEntities.get(agent.id)
      if (existing) {
        existing.apply(agent)
        existing.setPosition(agent.x, agent.y)
        continue
      }
      this.mountAgentEntity(agent)
    }

    this.sortOfficeDepth()
    this.syncDeskOccupancy()
  }

  private pullDataFromEntities() {
    this.agents = this.agents.map((agent) => {
      const entity = this.agentEntities.get(agent.id)
      return entity ? { ...agent, ...entity.data } : agent
    })
  }

  private syncDeskOccupancy() {
    const occupied = new Set(
      this.agents
        .filter(
          (agent) =>
            isDeskWorkerState(agent.state) &&
            agent.semanticState !== 'awaiting_review' &&
            agent.assignedDeskId
        )
        .map((agent) => agent.assignedDeskId!)
    )
    for (const desk of this.deskEntities.values()) {
      desk.setOccupied(occupied.has(desk.deskId))
    }
  }

  private spawnOffice(parent: Container) {
    const layer = new Container()
    layer.label = 'office'
    layer.sortableChildren = true
    this.officeLayer = layer

    for (const desk of DESKS) {
      const entity = new DeskEntity(desk)
      this.deskEntities.set(desk.id, entity)
      layer.addChild(
        entity.shadowGfx,
        entity.deskLayer,
        entity.chairLayer,
        entity.occupiedIndicator
      )
    }

    this.reconcileAgentEntities()

    this.sortOfficeDepth()
    parent.addChild(layer)
  }

  private mountAgentEntity(agent: OfficeAgent) {
    if (!this.officeLayer) return
    const entity = new AgentEntity(agent, { reduceMotion: this.reduceMotion })
    this.agentEntities.set(agent.id, entity)
    entity.zIndex = agent.y
    entity.on('pointertap', (event: FederatedPointerEvent) => {
      event.stopPropagation()
      this.options.onAgentClick?.({
        agent: { ...entity.data },
        rosterNo: this.agents.findIndex((item) => item.id === agent.id) + 1,
        clientX: event.clientX,
        clientY: event.clientY,
      })
    })
    this.officeLayer.addChild(entity)
  }

  private drawMap(parent: Container) {
    const map = new Container()
    map.label = 'map'

    const floor = new Graphics()
    floor.rect(0, 0, SCENE_WIDTH, SCENE_HEIGHT)
    floor.fill(COLORS.floor)
    map.addChild(floor)

    const bgTex = getOfficeBackgroundTexture()
    if (bgTex) {
      const bg = new Sprite(bgTex)
      const scale = Math.min(SCENE_WIDTH / bgTex.width, SCENE_HEIGHT / bgTex.height)
      bg.scale.set(scale)
      bg.position.set(
        (SCENE_WIDTH - bgTex.width * scale) / 2,
        (SCENE_HEIGHT - bgTex.height * scale) / 2
      )
      map.addChild(bg)
    }

    parent.addChildAt(map, 0)
  }
}

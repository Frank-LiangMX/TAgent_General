import type { Application, Container, Graphics } from 'pixi.js'

import type { AssistantPresenceStyle } from '../../../../types'

import {
  ASSISTANT_APPEARANCE,
  ASSISTANT_IDLE_GESTURES,
  damp,
  getAssistantGestureDuration,
  sampleAssistantGesture,
  sampleAssistantMotion,
  sampleAssistantRollRotation,
  sampleAssistantSlimeRest,
  sampleAssistantState,
  sampleAssistantTravelDeformation,
  type AssistantGesture,
  type AssistantPresenceState,
  type AssistantPresenceTheme,
} from './assistant-motion'

interface AssistantPalette {
  primary: number
  cool: number
  warm: number
  soft: number
  eye: number
  highlight: number
  danger: number
}

interface AssistantLayers {
  root: Container
  deformAxis: Container
  deformContent: Container
  shadow: Graphics
  particleField: Container
  reactionRing: Graphics
  outerGlow: Graphics
  halo: Graphics
  core: Graphics
  flow: Container
  ribbons: [Graphics, Graphics, Graphics]
  membrane: Graphics
  brandFacet: Graphics
  rimLight: Graphics
  specular: Graphics
  eyeGlow: Container
  eyes: Container
}

interface AssistantParticle {
  graphic: Graphics
  index: number
  angle: number
  colorIndex: number
  phase: number
  radius: number
  size: number
  speed: number
}

const DESIGN_SIZE = 144
const BODY_RADIUS = 39

export const ASSISTANT_VIEWPORT_PADDING = DESIGN_SIZE / 2 - BODY_RADIUS
export const ASSISTANT_PIXI_FILTERS_ENABLED = false

export function fitAssistantCanvasToHost(canvas: Pick<HTMLCanvasElement, 'style'>): void {
  canvas.style.width = '100%'
  canvas.style.height = '100%'
}

function cssTokenToColor(
  style: CSSStyleDeclaration,
  token: string,
  ColorClass: (typeof import('pixi.js'))['Color']
): number {
  const raw = style.getPropertyValue(token).trim()
  return new ColorClass(raw ? `hsl(${raw})` : 'white').toNumber()
}

function readPalette(
  host: HTMLElement,
  theme: AssistantPresenceTheme,
  ColorClass: (typeof import('pixi.js'))['Color']
): AssistantPalette {
  const style = getComputedStyle(host)

  return {
    primary: cssTokenToColor(style, '--primary', ColorClass),
    cool: cssTokenToColor(style, '--scene-ambient-a', ColorClass),
    warm: cssTokenToColor(style, '--scene-ambient-b', ColorClass),
    soft: cssTokenToColor(style, '--scene-ambient-c', ColorClass),
    eye: cssTokenToColor(style, '--foreground', ColorClass),
    highlight: cssTokenToColor(style, theme === 'light' ? '--card' : '--foreground', ColorClass),
    danger: cssTokenToColor(style, '--destructive', ColorClass),
  }
}

function drawRibbon(
  graphics: Graphics,
  color: number,
  alpha: number,
  phase: number,
  offset: number,
  width: number
): void {
  const drift = Math.sin(phase + offset) * 5
  const lift = Math.cos(phase * 0.72 + offset) * 7

  graphics
    .clear()
    .moveTo(-31, drift)
    .bezierCurveTo(-18, -25 + lift, 16, 24 + drift, 33, -4 + lift)
    .stroke({ color, width, alpha, cap: 'round', join: 'round' })
}

function traceFluidBody(graphics: Graphics, radius: number, phase: number): Graphics {
  const horizontal = Math.sin(phase) * 1.45
  const vertical = Math.cos(phase * 0.84) * 1.2
  const right = radius + horizontal
  const left = -radius + horizontal * 0.42
  const top = -radius - vertical
  const bottom = radius + vertical * 0.64
  const curve = 0.57

  return graphics
    .moveTo(horizontal * -0.22, top)
    .bezierCurveTo(right * curve, top + 0.8, right, -radius * curve, right, vertical * 0.2)
    .bezierCurveTo(right, bottom * curve, radius * curve, bottom, horizontal * 0.3, bottom)
    .bezierCurveTo(left * curve, bottom, left, radius * curve, left, -vertical * 0.18)
    .bezierCurveTo(left, top * curve, left * curve, top, horizontal * -0.22, top)
    .closePath()
}

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
}

/**
 * 疲劳时保留一个有体积的圆润上半身，只让底部向卡片表面铺开。
 * 这比缩放整颗球更像柔软生物趴下，也避免轮廓变成金属圆盘。
 */
function tracePresenceBody(
  graphics: Graphics,
  radius: number,
  phase: number,
  restAmount: number,
  fluid: boolean,
  restPhase = phase
): Graphics {
  if (restAmount <= 0.001) {
    return fluid ? traceFluidBody(graphics, radius, phase) : graphics.circle(0, 0, radius)
  }

  const horizontal = fluid ? Math.sin(phase) * 1.45 * (1 - restAmount) : 0
  const vertical = fluid ? Math.cos(phase * 0.84) * 1.2 * (1 - restAmount) : 0
  const restMotion = sampleAssistantSlimeRest(restPhase, false)
  const crownLift = restMotion.breath * radius * 0.04
  const lateralShift = restMotion.lateral * radius
  const top = {
    x: mix(horizontal * -0.22, -radius * 0.1 + lateralShift * 0.028, restAmount),
    y: mix(-radius - vertical, -radius * 0.96 - crownLift, restAmount),
  }
  const right = {
    x: mix(radius + horizontal, radius * 1.072 - lateralShift * 0.025, restAmount),
    y: mix(vertical * 0.2, radius * 0.04, restAmount),
  }
  const bottomRight = {
    x: mix(radius * 0.7 + horizontal * 0.2, radius * 0.76 + lateralShift * 0.004, restAmount),
    y: mix(radius * 0.7 + vertical * 0.45, radius * 0.76, restAmount),
  }
  const bottomLeft = {
    x: mix(-radius * 0.7 + horizontal * 0.18, -radius * 0.68 + lateralShift * 0.004, restAmount),
    y: mix(radius * 0.7 + vertical * 0.48, radius * 0.79, restAmount),
  }
  const left = {
    x: mix(-radius + horizontal * 0.42, -radius * 1.092 - lateralShift * 0.025, restAmount),
    y: mix(-vertical * 0.18, radius * 0.14, restAmount),
  }

  return graphics
    .moveTo(top.x, top.y)
    .bezierCurveTo(
      mix(radius * 0.55, radius * 0.5, restAmount),
      mix(top.y, -radius * 0.98, restAmount),
      mix(right.x, radius * 1.02, restAmount),
      mix(-radius * 0.55, -radius * 0.54, restAmount),
      right.x,
      right.y
    )
    .bezierCurveTo(
      mix(right.x, radius * 1.1, restAmount),
      mix(radius * 0.38, radius * 0.34, restAmount),
      mix(radius * 0.92, radius * 0.9, restAmount),
      mix(radius * 0.56, radius * 0.62, restAmount),
      bottomRight.x,
      bottomRight.y
    )
    .bezierCurveTo(
      mix(radius * 0.4, radius * 0.42, restAmount),
      mix(radius * 0.86, radius * 0.82, restAmount),
      mix(-radius * 0.34, -radius * 0.32, restAmount),
      mix(radius * 0.86, radius * 0.84, restAmount),
      bottomLeft.x,
      bottomLeft.y
    )
    .bezierCurveTo(
      mix(-radius * 0.88, -radius * 0.86, restAmount),
      mix(radius * 0.62, radius * 0.72, restAmount),
      mix(left.x, -radius * 1.1, restAmount),
      mix(radius * 0.38, radius * 0.4, restAmount),
      left.x,
      left.y
    )
    .bezierCurveTo(
      mix(left.x, -radius * 1.12, restAmount),
      mix(-radius * 0.55, -radius * 0.3, restAmount),
      mix(-radius * 0.55, -radius * 0.56, restAmount),
      mix(top.y, -radius * 0.9, restAmount),
      top.x,
      top.y
    )
    .closePath()
}

function drawEyes(
  left: Graphics,
  right: Graphics,
  color: number,
  alpha: number,
  height = 13,
  width = 4.4
): void {
  const radius = width / 2
  left
    .clear()
    .roundRect(-width / 2, -height / 2, width, height, radius)
    .fill({ color, alpha })
  right
    .clear()
    .roundRect(-width / 2, -height / 2, width, height, radius)
    .fill({ color, alpha })
}

export class AssistantPresenceRenderer {
  private app: Application | null = null
  private layers: AssistantLayers | null = null
  private particles: AssistantParticle[] = []
  private palette: AssistantPalette | null = null
  private active = true
  private pointerTarget = { x: 0, y: 0 }
  private pointerCurrent = { x: 0, y: 0 }
  private startTime = performance.now()
  private lastFrame = this.startTime
  private blinkStartedAt: number | null = null
  private nextBlinkAt = this.startTime + 2200
  private activeGesture: AssistantGesture | null = null
  private gestureStartedAt: number | null = null
  private nextIdleGestureAt = this.startTime + 8500
  private lastIdleGesture: AssistantGesture | null = null
  private stateStartedAt = this.startTime
  private rollStartedAt: number | null = null
  private rollDuration = 0
  private rollDirection = 1
  private surfaceContact = false
  private shadowVisibility = 1
  private travelMotion = { deltaX: 0, deltaY: 0, duration: 0, startedAt: this.startTime }
  private travelDeformation = { axisAngle: 0, scaleAcross: 1, scaleAlong: 1 }

  constructor(
    private readonly host: HTMLElement,
    private theme: AssistantPresenceTheme,
    private reducedMotion: boolean,
    private style: AssistantPresenceStyle,
    private presenceState: AssistantPresenceState = 'standby'
  ) {}

  async init(): Promise<HTMLCanvasElement> {
    const pixi = await import('pixi.js')
    const app = new pixi.Application()

    await app.init({
      antialias: true,
      autoDensity: true,
      autoStart: false,
      backgroundAlpha: 0,
      height: DESIGN_SIZE,
      powerPreference: 'low-power',
      preference: 'webgl',
      resolution: Math.min(window.devicePixelRatio || 1, 1.5),
      width: DESIGN_SIZE,
    })

    const shadow = new pixi.Graphics()
    const particleField = new pixi.Container()
    const reactionRing = new pixi.Graphics()
    const particles: AssistantParticle[] = Array.from({ length: 12 }, (_, index) => {
      const size = 0.75 + (index % 4) * 0.28
      const graphic = new pixi.Graphics()
        .circle(0, 0, size * 2.2)
        .fill({ color: 0xffffff, alpha: 0.12 })
        .circle(0, 0, size)
        .fill({ color: 0xffffff })
      particleField.addChild(graphic)

      return {
        graphic,
        index,
        angle: (index / 12) * Math.PI * 2 + Math.sin(index * 2.7) * 0.18,
        colorIndex: index % 4,
        phase: index * 1.37,
        radius: 44 + (index % 4) * 2.2,
        size,
        speed: (0.16 + (index % 5) * 0.035) * (index % 2 === 0 ? 1 : -1),
      }
    })
    const root = new pixi.Container()
    const deformAxis = new pixi.Container()
    const deformContent = new pixi.Container()
    const halo = new pixi.Graphics()
    const outerGlow = new pixi.Graphics()
    const core = new pixi.Graphics()
    const ribbons: [Graphics, Graphics, Graphics] = [
      new pixi.Graphics(),
      new pixi.Graphics(),
      new pixi.Graphics(),
    ]
    const flow = new pixi.Container()
    flow.addChild(...ribbons)
    const membrane = new pixi.Graphics()
    const brandFacet = new pixi.Graphics()
    const rimLight = new pixi.Graphics()
    const specular = new pixi.Graphics()
    const eyeGlow = new pixi.Container()
    const eyes = new pixi.Container()

    // 不给角色节点挂 Pixi Filter。Windows Chromium 在页面切换或 HMR 销毁
    // 离屏纹理时，FilterSystem 偶发读取已释放的 BindGroup 资源。柔光由多层
    // 半透明矢量图形与 CSS 径向光晕承担，不再创建任何滤镜纹理。
    const glowLeft = new pixi.Graphics()
    const glowRight = new pixi.Graphics()
    const eyeLeft = new pixi.Graphics()
    const eyeRight = new pixi.Graphics()
    glowLeft.x = eyeLeft.x = -8
    glowRight.x = eyeRight.x = 8
    eyeGlow.addChild(glowLeft, glowRight)
    eyes.addChild(eyeLeft, eyeRight)

    deformContent.addChild(
      halo,
      outerGlow,
      core,
      flow,
      membrane,
      brandFacet,
      rimLight,
      specular,
      eyeGlow,
      eyes
    )
    deformAxis.addChild(deformContent)
    root.addChild(deformAxis)
    app.stage.addChild(shadow, reactionRing, particleField, root)
    app.ticker.maxFPS = 30
    app.ticker.add(this.tick)

    this.app = app
    this.layers = {
      root,
      deformAxis,
      deformContent,
      shadow,
      particleField,
      reactionRing,
      outerGlow,
      halo,
      core,
      flow,
      ribbons,
      membrane,
      brandFacet,
      rimLight,
      specular,
      eyeGlow,
      eyes,
    }
    this.particles = particles
    this.palette = readPalette(this.host, this.theme, pixi.Color)
    app.canvas.className = 'assistant-presence__canvas'
    // Pixi 会按逻辑分辨率写入 144px 内联尺寸。Hero 容器恰好同宽，Compact
    // 容器则会因此错位放大；强制跟随宿主，保证 Canvas 与静态 fallback 重合。
    fitAssistantCanvasToHost(app.canvas)
    this.draw(performance.now())
    app.render()

    if (this.active) app.ticker.start()
    return app.canvas
  }

  setTheme(theme: AssistantPresenceTheme): void {
    this.theme = theme
    if (!this.app) return

    void import('pixi.js').then(({ Color }) => {
      if (!this.app) return
      this.palette = readPalette(this.host, theme, Color)
      this.syncTicker()
    })
  }

  setStyle(style: AssistantPresenceStyle): void {
    this.style = style
    if (!this.app) return
    this.syncTicker()
  }

  setPresenceState(state: AssistantPresenceState): void {
    if (state === this.presenceState) return
    this.presenceState = state
    this.stateStartedAt = performance.now()
    if (!this.canPlayIdleGesture() && this.isIdleGesture(this.activeGesture)) {
      this.activeGesture = null
      this.gestureStartedAt = null
    }
    if (!this.app) return
    this.syncTicker()
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    this.syncTicker()
  }

  setActive(active: boolean): void {
    this.active = active
    this.syncTicker()
  }

  setPointer(clientX: number, clientY: number): void {
    const rect = this.host.getBoundingClientRect()
    const reach = BODY_RADIUS * 3.6
    this.pointerTarget.x = (clientX - (rect.left + rect.width / 2)) / reach
    this.pointerTarget.y = (clientY - (rect.top + rect.height / 2)) / reach
  }

  triggerReaction(): void {
    this.triggerGesture('tap')
  }

  triggerGesture(gesture: AssistantGesture): void {
    const now = performance.now()
    this.activeGesture = gesture
    this.gestureStartedAt = now
    this.nextIdleGestureAt = now + this.randomIdleDelay()
    this.blinkStartedAt = null
    this.nextBlinkAt = now + 2300
    if (!this.app) return
    this.syncTicker()
  }

  startRoll(direction: number, duration: number): void {
    this.rollDirection = direction >= 0 ? 1 : -1
    this.rollDuration = Math.max(1, duration)
    this.rollStartedAt = performance.now()
    this.syncTicker()
  }

  clearRoll(): void {
    this.rollStartedAt = null
    this.rollDuration = 0
  }

  setTravelMotion(deltaX: number, deltaY: number, duration: number): void {
    this.travelMotion = {
      deltaX,
      deltaY,
      duration: Math.max(0, duration),
      startedAt: performance.now(),
    }
    this.syncTicker()
  }

  setSurfaceContact(surfaceContact: boolean): void {
    this.surfaceContact = surfaceContact
    this.syncTicker()
  }

  destroy(): void {
    if (!this.app) return
    const app = this.app
    this.app = null
    this.layers = null
    this.particles = []
    this.palette = null
    app.ticker.stop()
    app.ticker.remove(this.tick)
    app.destroy(true, { children: true })
  }

  private readonly tick = (): void => {
    this.draw(performance.now())
  }

  private syncTicker(): void {
    if (!this.app) return
    if (this.active) this.app.ticker.start()
    else this.app.ticker.stop()
  }

  private randomIdleDelay(): number {
    return 8500 + Math.random() * 11000
  }

  private canPlayIdleGesture(): boolean {
    return this.presenceState === 'standby' || this.presenceState === 'input'
  }

  private isIdleGesture(gesture: AssistantGesture | null): boolean {
    return gesture !== null && ASSISTANT_IDLE_GESTURES.includes(gesture)
  }

  private updateGesture(now: number): void {
    if (this.activeGesture && this.gestureStartedAt !== null) {
      const duration = getAssistantGestureDuration(this.activeGesture)
      if (now - this.gestureStartedAt < duration) return
      this.activeGesture = null
      this.gestureStartedAt = null
      this.nextIdleGestureAt = now + this.randomIdleDelay()
    }

    if (!this.canPlayIdleGesture() || now < this.nextIdleGestureAt) return
    const candidates = ASSISTANT_IDLE_GESTURES.filter((gesture) => gesture !== this.lastIdleGesture)
    const index = Math.floor(Math.random() * candidates.length)
    const gesture = candidates[index] ?? 'glance'
    this.lastIdleGesture = gesture
    this.activeGesture = gesture
    this.gestureStartedAt = now
  }

  private blinkScale(now: number): number {
    if (this.blinkStartedAt === null && now >= this.nextBlinkAt) this.blinkStartedAt = now
    if (this.blinkStartedAt === null) return 1

    const progress = (now - this.blinkStartedAt) / 150
    if (progress >= 1) {
      this.blinkStartedAt = null
      const minimumDelay = this.reducedMotion ? 5000 : 2600
      const randomDelay = this.reducedMotion ? 3000 : 2400
      this.nextBlinkAt = now + minimumDelay + Math.random() * randomDelay
      return 1
    }
    return Math.max(0.08, 1 - Math.sin(progress * Math.PI) * 0.92)
  }

  private draw(now: number): void {
    if (!this.app || !this.layers || !this.palette) return

    this.updateGesture(now)
    const deltaMs = Math.min(64, Math.max(0, now - this.lastFrame))
    this.lastFrame = now
    this.pointerCurrent.x = damp(this.pointerCurrent.x, this.pointerTarget.x, 9, deltaMs)
    this.pointerCurrent.y = damp(this.pointerCurrent.y, this.pointerTarget.y, 9, deltaMs)
    const state = sampleAssistantState(
      this.presenceState,
      now - this.stateStartedAt,
      this.reducedMotion
    )
    const motion = sampleAssistantMotion(
      (now - this.startTime) * state.timeScale,
      this.pointerCurrent.x,
      this.pointerCurrent.y,
      this.reducedMotion
    )
    const reaction = sampleAssistantGesture(
      this.activeGesture,
      this.gestureStartedAt === null ? Number.POSITIVE_INFINITY : now - this.gestureStartedAt,
      this.reducedMotion
    )
    const gestureSettle = 1 - Math.pow(1 - Math.min(1, reaction.progress / 0.18), 3)
    const restAmount = this.reducedMotion
      ? 0
      : this.activeGesture === 'tired'
        ? gestureSettle
        : this.activeGesture === 'recover'
          ? 1 - gestureSettle
          : 0
    const rollRotation = sampleAssistantRollRotation(
      this.rollStartedAt === null ? 0 : now - this.rollStartedAt,
      this.rollStartedAt === null ? 0 : this.rollDuration,
      this.rollDirection,
      this.reducedMotion
    )
    const ambientMotionWeight = this.activeGesture === 'tired' ? 0 : 1
    const ambientBreathScale = this.activeGesture === 'tired' ? 1 : motion.breathScale
    const appearance = ASSISTANT_APPEARANCE[this.theme]
    const {
      root,
      deformAxis,
      deformContent,
      shadow,
      particleField,
      reactionRing,
      outerGlow,
      halo,
      core,
      flow,
      ribbons,
      membrane,
      brandFacet,
      rimLight,
      specular,
      eyeGlow,
      eyes,
    } = this.layers
    const center = DESIGN_SIZE / 2
    const isFluid = this.style === 'fluid'
    const stateAccent =
      state.accent === 'danger'
        ? this.palette.danger
        : state.accent === 'warm'
          ? this.palette.warm
          : this.palette.primary

    this.shadowVisibility = damp(this.shadowVisibility, this.surfaceContact ? 0 : 1, 12, deltaMs)

    shadow
      .clear()
      .ellipse(
        center + (motion.bodyX * ambientMotionWeight + reaction.bodyX) * 0.45,
        center +
          BODY_RADIUS +
          9 +
          motion.bodyY * ambientMotionWeight * 0.18 +
          reaction.hopY * 0.12 +
          reaction.verticalOffset * 0.3,
        17 + reaction.glowBoost * 3,
        3.5 - reaction.glowBoost * 0.6
      )
      .fill({
        color: stateAccent,
        alpha:
          appearance.glowAlpha *
          state.glowMultiplier *
          (1 + reaction.glowBoost * 0.65) *
          this.shadowVisibility,
      })
    root.position.set(
      center + motion.bodyX * ambientMotionWeight + reaction.bodyX,
      center +
        motion.bodyY * ambientMotionWeight +
        motion.floatY * ambientMotionWeight +
        reaction.hopY +
        reaction.verticalOffset +
        state.verticalOffset
    )
    root.alpha = state.opacity
    const rootRotation =
      motion.tilt * ambientMotionWeight + reaction.rotation + state.rotationOffset + rollRotation
    root.rotation = rootRotation
    root.scale.set(
      ambientBreathScale * reaction.scaleX * state.scaleX,
      (2 - ambientBreathScale) * reaction.scaleY * state.scaleY
    )
    const travelTarget = sampleAssistantTravelDeformation(
      now - this.travelMotion.startedAt,
      this.travelMotion.duration,
      this.travelMotion.deltaX,
      this.travelMotion.deltaY,
      this.reducedMotion || this.activeGesture === 'tired'
    )
    const deformSmoothing = travelTarget.active ? 13 : 9
    this.travelDeformation.scaleAlong = damp(
      this.travelDeformation.scaleAlong,
      travelTarget.scaleAlong,
      deformSmoothing,
      deltaMs
    )
    this.travelDeformation.scaleAcross = damp(
      this.travelDeformation.scaleAcross,
      travelTarget.scaleAcross,
      deformSmoothing,
      deltaMs
    )
    const angleDelta = Math.atan2(
      Math.sin(travelTarget.axisAngle - this.travelDeformation.axisAngle),
      Math.cos(travelTarget.axisAngle - this.travelDeformation.axisAngle)
    )
    const angleFactor = 1 - Math.exp((-11 * deltaMs) / 1000)
    this.travelDeformation.axisAngle += angleDelta * angleFactor
    const relativeDeformAngle = this.travelDeformation.axisAngle - rootRotation
    deformAxis.rotation = relativeDeformAngle
    deformAxis.scale.set(this.travelDeformation.scaleAlong, this.travelDeformation.scaleAcross)
    deformContent.rotation = -relativeDeformAngle
    halo.scale.set(1 + reaction.glowBoost * 0.055)
    outerGlow.scale.set(1 + reaction.glowBoost * 0.075)
    flow.rotation = motion.flowRotation * (isFluid ? 0.36 : 1)
    particleField.visible = !this.reducedMotion
    particleField.position.set(
      center + (motion.bodyX * ambientMotionWeight + reaction.bodyX) * 0.45,
      center +
        motion.bodyY * ambientMotionWeight * 0.35 +
        motion.floatY * ambientMotionWeight * 0.4 +
        reaction.verticalOffset * 0.24
    )
    reactionRing.clear()
    if (state.ringAlpha > 0) {
      reactionRing
        .circle(
          center + (motion.bodyX + reaction.bodyX) * 0.55,
          center + motion.bodyY * 0.4 + motion.floatY * 0.5 + reaction.verticalOffset * 0.3,
          BODY_RADIUS + state.ringRadius
        )
        .stroke({ color: stateAccent, width: 1.25, alpha: state.ringAlpha * appearance.rimAlpha })
    }
    if (reaction.active && !this.reducedMotion) {
      reactionRing
        .circle(
          center + (motion.bodyX + reaction.bodyX) * 0.55,
          center + motion.bodyY * 0.4 + motion.floatY * 0.5 + reaction.verticalOffset * 0.3,
          BODY_RADIUS + 3 + reaction.progress * 17
        )
        .stroke({
          color: this.palette.primary,
          width: 1.6 - reaction.progress * 0.55,
          alpha: appearance.rimAlpha * reaction.ringAlpha,
        })
    }

    if (!this.reducedMotion) {
      const particleColors = [
        this.palette.cool,
        this.palette.warm,
        this.palette.primary,
        this.palette.highlight,
      ]
      for (const particle of this.particles) {
        particle.graphic.visible = !isFluid || particle.index % 2 === 0
        const angle =
          particle.angle + motion.particlePhase * particle.speed * state.particleSpeedMultiplier
        const orbit =
          particle.radius +
          Math.sin(motion.particlePhase * 0.8 + particle.phase) * 2.4 +
          reaction.particleBurst * (8 + (particle.index % 3) * 2.2)
        const twinkle = 0.38 + (Math.sin(motion.particlePhase * 2.1 + particle.phase) + 1) * 0.28
        particle.graphic.position.set(
          Math.cos(angle) * orbit,
          Math.sin(angle) * orbit * 0.72 +
            Math.sin(motion.particlePhase * 1.2 + particle.phase) * 1.8
        )
        particle.graphic.scale.set(
          0.72 + (Math.sin(motion.particlePhase * 1.7 + particle.phase) + 1) * 0.2
        )
        particle.graphic.alpha =
          appearance.particleAlpha *
          state.particleAlphaMultiplier *
          Math.min(1, twinkle + reaction.particleBurst * 0.38) *
          (1 - restAmount * 0.72) *
          (isFluid ? 0.58 : 1)
        particle.graphic.tint = particleColors[particle.colorIndex] ?? this.palette.primary
      }
    }

    const glossStart = motion.glossPhase - 0.42
    const highlightX = -12 + motion.gazeX * 0.34
    const highlightY = -15 + motion.gazeY * 0.24
    const glintPulse = 0.72 + (Math.sin(motion.glossPhase * 1.9) + 1) * 0.13

    if (isFluid) {
      const fluidPhase = motion.ribbonPhase * 0.22
      tracePresenceBody(
        halo.clear(),
        BODY_RADIUS + 4,
        fluidPhase,
        restAmount,
        true,
        motion.ribbonPhase
      ).fill({
        color: stateAccent,
        alpha: appearance.glowAlpha * state.glowMultiplier * (this.reducedMotion ? 0.34 : 0.62),
      })
      tracePresenceBody(
        outerGlow.clear(),
        BODY_RADIUS + 1.5,
        fluidPhase + 1.2,
        restAmount,
        true,
        motion.ribbonPhase
      ).fill({
        color: this.palette.cool,
        alpha: appearance.glowAlpha * state.glowMultiplier * (0.7 + motion.corePulse * 0.12),
      })
      tracePresenceBody(
        core.clear(),
        BODY_RADIUS - 7,
        fluidPhase + 2.4,
        restAmount,
        true,
        motion.ribbonPhase
      )
        .fill({
          color: this.palette.primary,
          alpha: appearance.coreAlpha * motion.corePulse * 0.78,
        })
        .ellipse(8, -8, BODY_RADIUS - 18, BODY_RADIUS - 21)
        .fill({ color: this.palette.soft, alpha: appearance.bodyAlpha * 0.82 })

      for (const ribbon of ribbons) ribbon.clear()

      tracePresenceBody(
        membrane.clear(),
        BODY_RADIUS,
        fluidPhase,
        restAmount,
        true,
        motion.ribbonPhase
      ).fill({
        color: this.palette.highlight,
        alpha: this.theme === 'light' ? 0.58 : appearance.bodyAlpha * 0.16,
      })
      tracePresenceBody(
        membrane,
        BODY_RADIUS,
        fluidPhase,
        restAmount,
        true,
        motion.ribbonPhase
      ).fill({
        color: this.palette.cool,
        alpha: appearance.bodyAlpha * (this.theme === 'light' ? 0.22 : 0.3),
      })
      tracePresenceBody(
        membrane,
        BODY_RADIUS,
        fluidPhase,
        restAmount,
        true,
        motion.ribbonPhase
      ).stroke({
        color: this.theme === 'light' ? this.palette.primary : this.palette.eye,
        width: 1.05,
        alpha: appearance.membraneAlpha * mix(0.62, 0.24, restAmount),
        cap: 'round',
        join: 'round',
      })

      brandFacet.clear()
      if (restAmount > 0.001) {
        brandFacet
          .ellipse(-2, BODY_RADIUS * 0.67, BODY_RADIUS * 0.68, BODY_RADIUS * 0.09)
          .fill({ color: this.palette.cool, alpha: 0.1 * restAmount })
          .ellipse(BODY_RADIUS * 0.7, BODY_RADIUS * 0.43, BODY_RADIUS * 0.13, BODY_RADIUS * 0.1)
          .fill({ color: this.palette.soft, alpha: 0.13 * restAmount })
      } else {
        brandFacet
          .moveTo(7, -28)
          .bezierCurveTo(14, -31, 24, -25, 31, -15)
          .bezierCurveTo(29, -4, 25, 6, 18, 13)
          .bezierCurveTo(14, 3, 11, -12, 7, -28)
          .closePath()
          .fill({
            color: this.palette.primary,
            alpha: this.theme === 'dark' ? 0.24 : 0.16,
          })
      }

      tracePresenceBody(
        rimLight.clear(),
        BODY_RADIUS - 0.4,
        fluidPhase,
        restAmount,
        true,
        motion.ribbonPhase
      ).stroke({
        color: this.palette.eye,
        width: 1.15,
        alpha:
          appearance.rimAlpha *
          mix(this.reducedMotion ? 0.32 : 0.58, this.theme === 'light' ? 0.2 : 0.28, restAmount),
        cap: 'round',
        join: 'round',
      })
      if (restAmount <= 0.001) {
        rimLight.arc(0, 0, BODY_RADIUS - 1.5, glossStart, glossStart + Math.PI * 0.54).stroke({
          color: this.palette.cool,
          width: 1.8,
          alpha: appearance.rimAlpha * (this.reducedMotion ? 0.18 : 0.46),
          cap: 'round',
        })
      }

      specular
        .clear()
        .ellipse(highlightX - 1, highlightY, 12.5, 4.1)
        .fill({
          color: this.palette.highlight,
          alpha: appearance.specularAlpha * glintPulse * (this.reducedMotion ? 0.28 : 0.58),
        })
        .ellipse(highlightX + 3, highlightY + 7, 5.6, 1.45)
        .fill({
          color: this.palette.cool,
          alpha: appearance.specularAlpha * (this.reducedMotion ? 0.12 : 0.3),
        })
    } else {
      if (restAmount > 0.001) {
        tracePresenceBody(
          halo.clear(),
          BODY_RADIUS + 3,
          motion.ribbonPhase,
          restAmount,
          false
        ).stroke({
          color: this.palette.cool,
          width: 3,
          alpha: appearance.rimAlpha * 0.12,
          cap: 'round',
          join: 'round',
        })
      } else {
        halo
          .clear()
          .arc(0, 0, BODY_RADIUS + 3, glossStart, glossStart + Math.PI * 0.78)
          .stroke({
            color: this.palette.cool,
            width: 6,
            alpha: appearance.rimAlpha * (this.reducedMotion ? 0.16 : 0.36),
            cap: 'round',
          })
          .arc(0, 0, BODY_RADIUS + 2, glossStart + Math.PI, glossStart + Math.PI * 1.56)
          .stroke({
            color: this.palette.warm,
            width: 5,
            alpha: appearance.rimAlpha * (this.reducedMotion ? 0.12 : 0.28),
            cap: 'round',
          })
      }
      tracePresenceBody(
        outerGlow.clear(),
        BODY_RADIUS + 2,
        motion.ribbonPhase,
        restAmount,
        false
      ).fill({
        color: stateAccent,
        alpha: appearance.glowAlpha * state.glowMultiplier * (0.84 + motion.corePulse * 0.16),
      })
      tracePresenceBody(core.clear(), BODY_RADIUS - 8, motion.ribbonPhase, restAmount, false)
        .fill({ color: this.palette.primary, alpha: appearance.coreAlpha * motion.corePulse })
        .circle(10, -9, BODY_RADIUS - 19)
        .fill({ color: this.palette.soft, alpha: appearance.bodyAlpha })

      drawRibbon(
        ribbons[0],
        this.palette.cool,
        appearance.ribbonAlpha * (1 - restAmount * 0.85),
        motion.ribbonPhase,
        0,
        10
      )
      drawRibbon(
        ribbons[1],
        this.palette.warm,
        appearance.ribbonAlpha * 0.72 * (1 - restAmount * 0.85),
        -motion.ribbonPhase,
        2.1,
        7
      )
      drawRibbon(
        ribbons[2],
        this.palette.primary,
        appearance.ribbonAlpha * 0.8 * (1 - restAmount * 0.85),
        motion.ribbonPhase,
        4.2,
        5
      )

      tracePresenceBody(membrane.clear(), BODY_RADIUS, motion.ribbonPhase, restAmount, false).fill({
        color: this.palette.highlight,
        alpha: this.theme === 'light' ? 0.6 : appearance.bodyAlpha * 0.16,
      })
      tracePresenceBody(membrane, BODY_RADIUS, motion.ribbonPhase, restAmount, false).fill({
        color: this.palette.cool,
        alpha: appearance.bodyAlpha * (this.theme === 'light' ? 0.2 : 0.38),
      })
      if (restAmount > 0.001) {
        tracePresenceBody(membrane, BODY_RADIUS, motion.ribbonPhase, restAmount, false).stroke({
          color: this.theme === 'light' ? this.palette.primary : this.palette.eye,
          width: 0.95,
          alpha: appearance.membraneAlpha * 0.28,
          cap: 'round',
          join: 'round',
        })
      } else {
        membrane
          .arc(0, 0, BODY_RADIUS, Math.PI * 1.06, Math.PI * 1.72)
          .stroke({
            color: this.theme === 'light' ? this.palette.primary : this.palette.eye,
            width: 1.2,
            alpha: appearance.membraneAlpha,
            cap: 'round',
          })
          .arc(0, 0, BODY_RADIUS - 1, Math.PI * 0.02, Math.PI * 0.6)
          .stroke({
            color: this.palette.cool,
            width: 1.5,
            alpha: appearance.membraneAlpha,
            cap: 'round',
          })
      }
      brandFacet.clear()
      if (restAmount > 0.001) {
        brandFacet
          .ellipse(-2, BODY_RADIUS * 0.67, BODY_RADIUS * 0.68, BODY_RADIUS * 0.09)
          .fill({ color: this.palette.cool, alpha: 0.1 * restAmount })
          .ellipse(BODY_RADIUS * 0.7, BODY_RADIUS * 0.43, BODY_RADIUS * 0.13, BODY_RADIUS * 0.1)
          .fill({ color: this.palette.soft, alpha: 0.13 * restAmount })
      }

      if (restAmount > 0.001) {
        tracePresenceBody(
          rimLight.clear(),
          BODY_RADIUS - 0.4,
          motion.ribbonPhase,
          restAmount,
          false
        ).stroke({
          color: this.palette.highlight,
          width: 1.05,
          alpha: appearance.rimAlpha * 0.24,
          cap: 'round',
          join: 'round',
        })
      } else {
        rimLight
          .clear()
          .arc(0, 0, BODY_RADIUS - 0.4, glossStart, glossStart + Math.PI * 0.62)
          .stroke({
            color: this.palette.highlight,
            width: 1.8,
            alpha: appearance.rimAlpha * (this.reducedMotion ? 0.45 : 0.92),
            cap: 'round',
          })
          .arc(0, 0, BODY_RADIUS - 1.2, glossStart + Math.PI * 0.82, glossStart + Math.PI * 1.34)
          .stroke({
            color: this.palette.warm,
            width: 1.35,
            alpha: appearance.rimAlpha * (this.reducedMotion ? 0.28 : 0.68),
            cap: 'round',
          })
          .arc(0, 0, BODY_RADIUS - 2, glossStart + Math.PI * 1.52, glossStart + Math.PI * 1.88)
          .stroke({
            color: this.palette.cool,
            width: 2.2,
            alpha: appearance.rimAlpha * (this.reducedMotion ? 0.22 : 0.76),
            cap: 'round',
          })
      }

      specular
        .clear()
        .ellipse(highlightX, highlightY, 11, 3.4)
        .fill({
          color: this.palette.highlight,
          alpha: appearance.specularAlpha * glintPulse * (this.reducedMotion ? 0.42 : 1),
        })
        .ellipse(highlightX + 4, highlightY + 7, 4.8, 1.25)
        .fill({
          color: this.palette.cool,
          alpha: appearance.specularAlpha * (this.reducedMotion ? 0.16 : 0.46),
        })
        .circle(18 - motion.gazeX * 0.16, -5 + motion.gazeY * 0.12, 1.7)
        .fill({
          color: this.palette.eye,
          alpha: appearance.specularAlpha * glintPulse * (this.reducedMotion ? 0.28 : 0.86),
        })
    }

    const gazeX = motion.gazeX * ambientMotionWeight + reaction.gazeX + state.gazeXOffset
    const gazeY = motion.gazeY * ambientMotionWeight + reaction.gazeY - 1 + state.gazeYOffset
    eyeGlow.position.set(gazeX, gazeY)
    eyes.position.set(gazeX, gazeY)
    eyeGlow.scale.y = eyes.scale.y = this.blinkScale(now) * reaction.eyeScaleY * state.eyeScaleY
    const [glowLeft, glowRight] = eyeGlow.children as [Graphics, Graphics]
    const [eyeLeft, eyeRight] = eyes.children as [Graphics, Graphics]
    const eyeHeight = isFluid ? 9.5 : 13
    const eyeWidth = isFluid ? 3.8 : 4.4
    drawEyes(
      glowLeft,
      glowRight,
      this.palette.eye,
      this.theme === 'dark' ? 0.54 : 0.4,
      eyeHeight,
      eyeWidth
    )
    drawEyes(
      eyeLeft,
      eyeRight,
      this.palette.eye,
      this.theme === 'dark' ? 0.96 : 0.88,
      eyeHeight,
      eyeWidth
    )
  }
}

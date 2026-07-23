import type { Application, Container, Graphics } from 'pixi.js'

import type { AssistantPresenceStyle } from '../../../../types'

import {
  ASSISTANT_APPEARANCE,
  ASSISTANT_IDLE_GESTURES,
  SATELLITE_MAX,
  damp,
  getAssistantGestureDuration,
  getAssistantRunOrbitProfile,
  isSatelliteAbsorptionFinished,
  isSatelliteChargeFinished,
  resolveAssistantExpression,
  resolveSatelliteAdd,
  sampleAssistantGesture,
  sampleAssistantMotion,
  sampleAssistantRollRotation,
  sampleAssistantSlimeRest,
  sampleAssistantState,
  sampleAssistantTravelDeformation,
  createIdleExpressionTransitionState,
  stepAssistantExpressionTransition,
  type AssistantGesture,
  type AssistantPresenceState,
  type AssistantPresenceTheme,
  type AssistantExpressionSample,
  type AssistantExpressionTransitionState,
  type RunOrbitProfile,
} from './assistant-motion'

interface AssistantPalette {
  primary: number
  cool: number
  warm: number
  soft: number
  eye: number
  highlight: number
  danger: number
  green: number
}

interface AssistantLayers {
  root: Container
  deformAxis: Container
  deformContent: Container
  particleField: Container
  satelliteField: Container
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
  eyebrows: Graphics
  mouth: Graphics
  cheeks: Graphics
}

/** 卫星粒子：被角色捕获后围绕角色公转 */
interface AssistantSatellite {
  graphic: Graphics
  orbitRadius: number
  orbitSpeed: number
  orbitDirection: 1 | -1
  inclination: number
  phase: number
  size: number
  colorIndex: number
}

/** 运行轨道粒子：thinking/acting 时围绕角色的短生命周期粒子 */
interface AssistantRunOrbitParticle {
  graphic: Graphics
  /** 轨道半径（px） */
  orbitRadius: number
  /** 轨道角速度（rad/s） */
  orbitSpeed: number
  /** 轨道方向 */
  orbitDirection: 1 | -1
  /** 轨道倾角（rad） */
  inclination: number
  /** 初始相位偏移（rad） */
  phase: number
  /** 粒子大小（px） */
  size: number
  /** 颜色索引（0-3，复用 palette 数组） */
  colorIndex: number
  /** 创建时间 (ms since epoch) */
  bornAt: number
  /** 生命周期 (ms) */
  lifespan: number
  /** 是否正在收束（状态离开 thinking/acting 后向中心螺旋） */
  converging: boolean
  /** 收束开始时间 (ms since epoch)；独立于 bornAt，收束阶段专用 */
  convergeStartedAt: number | null
}

/** 运行轨道粒子的拖尾帧 */
interface RunOrbitTrailFrame {
  x: number
  y: number
  /** 帧记录时间 (performance.now)；原 recordedAt，重命名避免歧义 */
  time: number
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

/** 视觉核心半径（去掉膜层后的质量半径，用于阴影锚点） */
const BODY_CORE_RADIUS = BODY_RADIUS - 8

/**
 * 身体底部锚点占 host 高度的比例。
 * 由 Pixi 坐标推导：canvas 中心 DESIGN_SIZE/2 + 核心半径，再除以 DESIGN_SIZE。
 * 默认 stage 168 / host 144 几何下，确保初始 distance >= WORLD_SHADOW_FADE_THRESHOLD。
 */
export const BODY_BOTTOM_RATIO = (DESIGN_SIZE / 2 + BODY_CORE_RADIUS) / DESIGN_SIZE

export const ASSISTANT_PIXI_FILTERS_ENABLED = false

/** 运行轨道粒子：数量上限（profile count 的安全边界） */
const RUN_ORBIT_MAX = 3
/** 运行轨道粒子：拖尾采样间隔 (ms) */
const RUN_ORBIT_TRAIL_INTERVAL = 50

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
    green: theme === 'light' ? 0x22c55e : 0x4ade80,
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

/** 眉毛：通过倾斜角度表达情绪（正角 = 怒，负角 = 悲） */
function drawEyebrows(
  graphics: Graphics,
  color: number,
  alpha: number,
  angle: number,
  yOffset: number
): void {
  graphics.clear()
  if (Math.abs(angle) < 0.02 && Math.abs(yOffset) < 0.1) return

  const length = 7
  const leftX = -11
  const rightX = 11
  const baseY = -18 + yOffset

  // 左眉：角度向外倾斜
  const leftStartX = leftX - Math.cos(angle) * length * 0.5
  const leftStartY = baseY - Math.sin(angle) * length * 0.5
  const leftEndX = leftX + Math.cos(angle) * length * 0.5
  const leftEndY = baseY + Math.sin(angle) * length * 0.5
  graphics
    .moveTo(leftStartX, leftStartY)
    .bezierCurveTo(leftX - 2, baseY - 1.5, leftX + 2, baseY - 1.5, leftEndX, leftEndY)
    .stroke({ color, width: 1.5, alpha, cap: 'round', join: 'round' })

  // 右眉：镜像角度
  const rightStartX = rightX + Math.cos(angle) * length * 0.5
  const rightStartY = baseY - Math.sin(angle) * length * 0.5
  const rightEndX = rightX - Math.cos(angle) * length * 0.5
  const rightEndY = baseY + Math.sin(angle) * length * 0.5
  graphics
    .moveTo(rightStartX, rightStartY)
    .bezierCurveTo(rightX - 2, baseY - 1.5, rightX + 2, baseY - 1.5, rightEndX, rightEndY)
    .stroke({ color, width: 1.5, alpha, cap: 'round', join: 'round' })
}

/** 嘴巴：曲线方向表达情绪（正 = 微笑，负 = 撇嘴） */
function drawMouth(
  graphics: Graphics,
  color: number,
  alpha: number,
  curve: number,
  width: number,
  yOffset: number
): void {
  graphics.clear()
  if (Math.abs(curve) < 0.01 && width < 5.5) return

  const halfWidth = width / 2
  const baseY = 12 + yOffset
  const controlY = baseY - curve * 8

  graphics
    .moveTo(-halfWidth, baseY)
    .bezierCurveTo(-halfWidth * 0.4, controlY, halfWidth * 0.4, controlY, halfWidth, baseY)
    .stroke({ color, width: 1.4, alpha, cap: 'round', join: 'round' })
}

/** 腮红：愉悦/开心时脸颊两侧的淡色圆斑 */
function drawCheeks(graphics: Graphics, color: number, alpha: number): void {
  graphics.clear()
  if (alpha < 0.01) return

  graphics
    .ellipse(-16, 5, 5, 3.5)
    .fill({ color, alpha })
    .ellipse(16, 5, 5, 3.5)
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
  private travelMotion = { deltaX: 0, deltaY: 0, duration: 0, startedAt: this.startTime }
  private travelDeformation = { axisAngle: 0, scaleAcross: 1, scaleAlong: 1 }
  private satellites: AssistantSatellite[] = []
  private greenMode = false
  private greenModeStartedAt: number | null = null
  private absorbing = false
  private absorbingStartedAt: number | null = null
  /** 蓄力阶段（5 颗卫星集齐后 stretch 动画期间）；用于表情 resolver 判断 powered 表情 */
  private powerUp = false
  /** 卫星数量变化回调；由 React 层设置 */
  onSatelliteCountChange: ((count: number) => void) | null = null
  /** 生命周期代数；destroy 后递增，使异步回调识别失效 */
  private _generation = 0
  /** 表情过渡状态；管理 decorationAlpha / scale 的连续插值 */
  private expressionTransition: AssistantExpressionTransitionState =
    createIdleExpressionTransitionState()
  /** 运行轨道粒子（thinking/acting 时的短生命周期粒子） */
  private runOrbitParticles: AssistantRunOrbitParticle[] = []
  /** 运行轨道粒子拖尾轨迹 */
  private runOrbitTrails = new WeakMap<AssistantRunOrbitParticle, RunOrbitTrailFrame[]>()
  /** 运行轨道粒子是否激活（上一帧的 presenceState 是否为 thinking/acting） */
  private runOrbitActive = false
  /** 运行轨道粒子的拖尾 Graphics 图层 */
  private runOrbitTrailLayer: Graphics | null = null
  /** 当前运行轨道 profile 快照；状态变化时更新 */
  private runOrbitProfile: RunOrbitProfile = getAssistantRunOrbitProfile('standby', false)
  /** 待生成粒子数量（异步 import 期间防止重复发射） */
  private runOrbitPendingSpawnCount = 0
  /** 下一次允许补足粒子的时间戳 (performance.now) */
  private runOrbitNextRespawnAt = 0
  /** run orbit 专用代数；destroy 后递增，异步 resolve 后校验 */
  private runOrbitGeneration = 0

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
    const eyebrows = new pixi.Graphics()
    const mouth = new pixi.Graphics()
    const cheeks = new pixi.Graphics()
    const satelliteField = new pixi.Container()
    const runOrbitTrailLayer = new pixi.Graphics()

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
      eyes,
      eyebrows,
      mouth,
      cheeks
    )
    deformAxis.addChild(deformContent)
    root.addChild(deformAxis)
    app.stage.addChild(runOrbitTrailLayer, reactionRing, particleField, satelliteField, root)
    app.ticker.maxFPS = 30
    app.ticker.add(this.tick)

    this.app = app
    this.layers = {
      root,
      deformAxis,
      deformContent,
      particleField,
      satelliteField,
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
      eyebrows,
      mouth,
      cheeks,
    }
    this.particles = particles
    this.runOrbitTrailLayer = runOrbitTrailLayer
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
    const generation = this._generation

    void import('pixi.js').then(({ Color }) => {
      if (this._generation !== generation) return
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
    const prevState = this.presenceState
    this.presenceState = state
    this.stateStartedAt = performance.now()
    if (!this.canPlayIdleGesture() && this.isIdleGesture(this.activeGesture)) {
      this.activeGesture = null
      this.gestureStartedAt = null
    }

    // 运行轨道粒子：进入/切换 thinking/acting 时生成，离开时标记收束
    const wasRunning = prevState === 'thinking' || prevState === 'acting'
    const isRunning = state === 'thinking' || state === 'acting'

    if (isRunning) {
      const newProfile = getAssistantRunOrbitProfile(state, this.reducedMotion)
      const profileChanged =
        newProfile.count !== this.runOrbitProfile.count ||
        newProfile.baseSpeed !== this.runOrbitProfile.baseSpeed ||
        newProfile.orbitRadius !== this.runOrbitProfile.orbitRadius

      if (wasRunning && profileChanged) {
        // thinking<->acting 切换：旧粒子短淡出 + 收束，生成新 profile 粒子
        const now = performance.now()
        for (const particle of this.runOrbitParticles) {
          if (!particle.converging) {
            particle.converging = true
            particle.convergeStartedAt = now
          }
        }
        this.runOrbitProfile = newProfile
        this.runOrbitActive = true
        this.runOrbitNextRespawnAt = 0
        this.spawnRunOrbitParticles()
      } else if (!wasRunning) {
        // 从非 running 进入：全新生成
        this.runOrbitProfile = newProfile
        this.runOrbitActive = true
        this.runOrbitNextRespawnAt = 0
        this.runOrbitPendingSpawnCount = 0
        this.runOrbitGeneration++
        this.spawnRunOrbitParticles()
      }
      // 同状态重复进入已在顶部 return
    } else if (wasRunning && !isRunning) {
      // 离开到 success/error/standby/input：标记收束
      this.runOrbitActive = false
      const now = performance.now()
      for (const particle of this.runOrbitParticles) {
        if (!particle.converging) {
          particle.converging = true
          particle.convergeStartedAt = now
        }
      }
    }

    if (!this.app) return
    this.syncTicker()
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    // rich<->reduced 切换时若当前 running，重建对应 profile
    const isRunning = this.presenceState === 'thinking' || this.presenceState === 'acting'
    if (isRunning) {
      const newProfile = getAssistantRunOrbitProfile(this.presenceState, reducedMotion)
      const profileChanged =
        newProfile.count !== this.runOrbitProfile.count ||
        newProfile.baseSpeed !== this.runOrbitProfile.baseSpeed
      if (profileChanged) {
        // 收束旧粒子 + 重建
        const now = performance.now()
        for (const particle of this.runOrbitParticles) {
          if (!particle.converging) {
            particle.converging = true
            particle.convergeStartedAt = now
          }
        }
        this.runOrbitProfile = newProfile
        this.runOrbitNextRespawnAt = 0
        this.spawnRunOrbitParticles()
      }
    }
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

  /** 添加一颗卫星粒子；外部传入颜色索引以保持与捕获粒子一致 */
  addSatellite(colorIndex: number): void {
    if (!this.app || this.satellites.length >= SATELLITE_MAX) return
    const colors = this.palette
      ? [this.palette.cool, this.palette.warm, this.palette.primary, this.palette.highlight]
      : [0xffffff]
    const tint = colors[colorIndex % colors.length] ?? colors[0]
    const generation = this._generation

    void import('pixi.js').then(({ Graphics }) => {
      // 销毁竞态：import resolve 时 renderer 可能已 destroy
      if (this._generation !== generation) return
      if (!this.app || !this.layers) return

      // 并发竞态：多个 addSatellite 同时等待 dynamic import，resolve 后必须基于
      // 当时最新的 satellites.length 和吸收状态重新校验，保证：
      // 1. satellites 永不超过 SATELLITE_MAX
      // 2. 吸收期间不泄漏新图元
      // 3. 第5颗只触发一次 greenMode/stretch/吸收时序
      const prevCount = this.satellites.length
      if (this.absorbing || prevCount >= SATELLITE_MAX) return

      const g = new Graphics()
      g.circle(0, 0, 4.5)
        .fill({ color: tint, alpha: 0.72 })
        .circle(0, 0, 2.5)
        .fill({ color: tint, alpha: 0.95 })
      const satellite: AssistantSatellite = {
        graphic: g,
        orbitRadius: 52 + prevCount * 5,
        orbitSpeed: 0.22 + Math.random() * 0.18,
        orbitDirection: Math.random() > 0.5 ? 1 : -1,
        inclination: (Math.random() * 0.5 + 0.15) * (Math.random() > 0.5 ? 1 : -1),
        phase: Math.random() * Math.PI * 2,
        size: 2.5 + Math.random() * 1.5,
        colorIndex,
      }
      this.satellites.push(satellite)
      this.layers.satelliteField.addChild(g)
      // 复用 assistant-motion.ts 的已测试纯函数决定状态
      const result = resolveSatelliteAdd(prevCount)
      this.onSatelliteCountChange?.(result.count)
      if (result.triggerCharge && !this.greenMode) {
        this.greenMode = true
        this.greenModeStartedAt = performance.now()
        this.powerUp = true
        this.triggerGesture('stretch')
      }
      this.syncTicker()
    })
  }

  /** 设置绿色模式（5 颗卫星集齐后激活） */
  setGreenMode(active: boolean): void {
    if (active && !this.greenMode) {
      this.greenModeStartedAt = performance.now()
      this.powerUp = true
    }
    if (!active) this.powerUp = false
    this.greenMode = active
    this.syncTicker()
  }

  /** 吸收全部卫星并重置计数；外部调用或由内部蓄力完成后自动触发 */
  startAbsorption(): void {
    if (this.absorbing || this.satellites.length === 0) return
    this.absorbing = true
    this.absorbingStartedAt = performance.now()
    this.powerUp = false
  }

  /** 清除所有卫星图元并重置蓄力状态 */
  private clearSatellites(): void {
    for (const satellite of this.satellites) satellite.graphic.destroy()
    this.satellites = []
    this.greenMode = false
    this.greenModeStartedAt = null
    this.absorbing = false
    this.absorbingStartedAt = null
    this.powerUp = false
    this.onSatelliteCountChange?.(0)
  }

  /**
   * 生成运行轨道粒子（thinking/acting 时的短生命周期粒子）。
   * 消费 runOrbitProfile；reduced 模式仍生成粒子（count=1），绝不直接 return。
   * 独立于卫星系统，不调用 addSatellite / persistent satellite count。
   */
  private spawnRunOrbitParticles(): void {
    if (!this.app) return

    const profile = this.runOrbitProfile
    const currentCount = this.runOrbitParticles.length
    const capacity = Math.max(0, Math.min(profile.count, RUN_ORBIT_MAX) - currentCount)
    if (capacity <= 0) return

    const generation = this.runOrbitGeneration
    const now = performance.now()
    // 标记待生成数量，防止异步 import 期间重复发射
    this.runOrbitPendingSpawnCount += capacity
    const trailLength = profile.trailLength
    const lifespanBase = profile.lifespan

    for (let i = 0; i < capacity; i++) {
      const index = currentCount + i
      void import('pixi.js').then(({ Graphics }) => {
        // 代数校验：destroy 后不得创建
        if (this.runOrbitGeneration !== generation) return
        if (!this.app || !this.layers) return
        // 状态校验：import 期间状态可能已离开 running
        if (this.presenceState !== 'thinking' && this.presenceState !== 'acting') {
          this.runOrbitPendingSpawnCount = Math.max(0, this.runOrbitPendingSpawnCount - 1)
          return
        }
        // 容量校验
        if (this.runOrbitParticles.length >= RUN_ORBIT_MAX) {
          this.runOrbitPendingSpawnCount = Math.max(0, this.runOrbitPendingSpawnCount - 1)
          return
        }

        const g = new Graphics()
        const size = this.reducedMotion ? 1.95 : 2.6 + index * 0.45
        g.circle(0, 0, size).fill({ color: 0xffffff, alpha: 0.9 })
        g.circle(0, 0, size * 2.2).fill({ color: 0xffffff, alpha: 0.22 })

        const particle: AssistantRunOrbitParticle = {
          graphic: g,
          orbitRadius: profile.orbitRadius + index * 6,
          orbitSpeed: profile.baseSpeed + (Math.random() - 0.5) * profile.baseSpeed * 0.35,
          orbitDirection: index % 2 === 0 ? 1 : -1,
          inclination: (Math.random() * 0.4 + 0.15) * (Math.random() > 0.5 ? 1 : -1),
          phase: (index / profile.count) * Math.PI * 2 + Math.random() * 0.5,
          size,
          colorIndex: index % 4,
          bornAt: now,
          lifespan: lifespanBase + Math.random() * (lifespanBase * 0.3),
          converging: false,
          convergeStartedAt: null,
        }
        this.runOrbitParticles.push(particle)
        this.runOrbitTrails.set(particle, [])
        this.runOrbitPendingSpawnCount = Math.max(0, this.runOrbitPendingSpawnCount - 1)
        if (this.layers) {
          this.layers.satelliteField.addChild(g)
        }
      })
    }
  }

  /**
   * 更新运行轨道粒子位置、生命周期、拖尾。
   * 包含长任务补足逻辑：粒子消亡后若 presence 仍 running，按 profile respawnDelay 平滑补足。
   */
  private updateRunOrbitParticles(now: number, deltaMs: number, center: number): void {
    if (this.runOrbitParticles.length === 0 && this.runOrbitPendingSpawnCount > 0) return

    const palette = this.palette
    if (!palette) return
    const colors = [palette.cool, palette.warm, palette.primary, palette.highlight]
    const appearance = ASSISTANT_APPEARANCE[this.theme]
    const profile = this.runOrbitProfile
    const trailLength = profile.trailLength
    const convergeDuration = profile.convergeDuration

    const particlesToRemove: AssistantRunOrbitParticle[] = []

    for (const particle of this.runOrbitParticles) {
      const age = now - particle.bornAt
      const lifeProgress = Math.min(1, age / particle.lifespan)

      // 收束阶段：使用 convergeStartedAt（独立于 bornAt）
      if (particle.converging && particle.convergeStartedAt !== null) {
        const convergeAge = now - particle.convergeStartedAt
        const convergeProgress = Math.min(1, convergeAge / convergeDuration)
        const easeOut = 1 - Math.pow(1 - convergeProgress, 2)
        particle.orbitRadius *= 1 - easeOut * 0.04
        // 收束完成 → 移除
        if (convergeProgress >= 1) {
          particlesToRemove.push(particle)
          continue
        }
      }

      // 生命周期结束（非收束态） → 移除
      if (!particle.converging && lifeProgress >= 1) {
        particlesToRemove.push(particle)
        continue
      }

      // 位置计算
      const angle = particle.phase + (age / 1000) * particle.orbitSpeed * particle.orbitDirection
      const x = Math.cos(angle) * particle.orbitRadius
      const yBase = Math.sin(angle) * particle.orbitRadius * 0.62
      const y = yBase * Math.cos(particle.inclination) + Math.sin(particle.inclination) * x * 0.3

      // 拖尾记录（重命名 recordedAt → time）
      const trails = this.runOrbitTrails.get(particle) ?? []
      if (
        trails.length === 0 ||
        now - (trails[trails.length - 1]?.time ?? 0) > RUN_ORBIT_TRAIL_INTERVAL
      ) {
        trails.push({ x, y, time: now })
        if (trails.length > trailLength) trails.shift()
        this.runOrbitTrails.set(particle, trails)
      }

      // alpha 计算：淡入 + 淡出；收束时额外衰减
      const fadeIn = Math.min(1, age / 300)
      const fadeOut = particle.converging
        ? 1 - Math.min(1, (now - (particle.convergeStartedAt ?? now)) / convergeDuration)
        : 1 - Math.pow(lifeProgress, 2)
      const baseAlpha = Math.max(0, fadeIn * fadeOut)

      particle.graphic.position.set(x, y)
      particle.graphic.alpha = appearance.particleAlpha * baseAlpha
      particle.graphic.tint = colors[particle.colorIndex] ?? palette.primary
    }

    // 清理结束粒子
    for (const particle of particlesToRemove) {
      particle.graphic.destroy()
      this.runOrbitTrails.delete(particle)
    }
    if (particlesToRemove.length > 0) {
      this.runOrbitParticles = this.runOrbitParticles.filter((p) => !particlesToRemove.includes(p))
    }

    // 长任务补足：若仍 running 且活跃粒子不足，按 respawnDelay 补足
    if (
      this.runOrbitActive &&
      this.runOrbitParticles.length < profile.count &&
      this.runOrbitPendingSpawnCount === 0 &&
      now >= this.runOrbitNextRespawnAt &&
      profile.count > 0
    ) {
      this.runOrbitNextRespawnAt = now + profile.respawnDelay
      this.spawnRunOrbitParticles()
    }
  }

  /** 渲染运行轨道粒子的拖尾（Graphics 层） */
  private drawRunOrbitTrails(now: number): void {
    const trailLayer = this.runOrbitTrailLayer
    if (!trailLayer) return
    trailLayer.clear()

    const palette = this.palette
    if (!palette) return
    const colors = [palette.cool, palette.warm, palette.primary, palette.highlight]
    const appearance = ASSISTANT_APPEARANCE[this.theme]
    const profile = this.runOrbitProfile

    for (const particle of this.runOrbitParticles) {
      const trails = this.runOrbitTrails.get(particle)
      if (!trails || trails.length < 2) continue

      const color = colors[particle.colorIndex] ?? palette.primary
      const age = now - particle.bornAt
      const lifeProgress = Math.min(1, age / particle.lifespan)
      const fadeIn = Math.min(1, age / 300)
      const fadeOut =
        particle.converging && particle.convergeStartedAt !== null
          ? 1 - Math.min(1, (now - particle.convergeStartedAt) / profile.convergeDuration)
          : 1 - Math.pow(lifeProgress, 2)
      const baseAlpha = Math.max(0, fadeIn * fadeOut)

      for (let i = 0; i < trails.length - 1; i++) {
        const frame = trails[i]
        if (!frame) continue
        const trailAge = now - frame.time
        const trailAlpha = Math.max(
          0,
          appearance.particleAlpha * baseAlpha * 0.4 * (1 - trailAge / 400)
        )
        if (trailAlpha <= 0.01) continue

        const nextFrame = trails[i + 1]
        if (!nextFrame) continue
        trailLayer
          .moveTo(frame.x, frame.y)
          .lineTo(nextFrame.x, nextFrame.y)
          .stroke({
            color,
            width: particle.size * 0.6 * (1 - i / trails.length),
            alpha: trailAlpha,
            cap: 'round',
          })
      }
    }
  }

  /** 销毁全部运行轨道粒子及其拖尾；重置所有 run orbit 状态 */
  private destroyRunOrbitParticles(): void {
    for (const particle of this.runOrbitParticles) {
      particle.graphic.destroy()
    }
    this.runOrbitParticles = []
    this.runOrbitTrails = new WeakMap()
    if (this.runOrbitTrailLayer) {
      this.runOrbitTrailLayer.clear()
    }
    this.runOrbitActive = false
    this.runOrbitPendingSpawnCount = 0
    this.runOrbitNextRespawnAt = 0
    this.runOrbitGeneration++
  }

  /** 获取当前卫星数量 */
  get satelliteCount(): number {
    return this.satellites.length
  }

  destroy(): void {
    if (!this.app) return
    const app = this.app
    this.app = null
    this.layers = null
    this.particles = []
    for (const satellite of this.satellites) satellite.graphic.destroy()
    this.satellites = []
    this.destroyRunOrbitParticles()
    this.runOrbitTrailLayer = null
    this.palette = null
    this.onSatelliteCountChange = null
    this._generation++
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

    // 自动蓄力吸收：集齐卫星后触发蓄力动作，完成后吸收全部卫星
    if (this.greenMode && !this.absorbing && this.greenModeStartedAt !== null) {
      const chargeDuration = getAssistantGestureDuration('stretch')
      if (isSatelliteChargeFinished(this.greenModeStartedAt, chargeDuration, now)) {
        this.startAbsorption()
      }
    }
    if (
      this.absorbing &&
      this.absorbingStartedAt !== null &&
      isSatelliteAbsorptionFinished(this.absorbingStartedAt, now)
    ) {
      this.clearSatellites()
    }

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
      particleField,
      satelliteField,
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
      eyebrows,
      mouth,
      cheeks,
    } = this.layers
    const center = DESIGN_SIZE / 2
    const isFluid = this.style === 'fluid'
    const effectiveAccent = this.greenMode ? 'green' : state.accent
    const stateAccent =
      effectiveAccent === 'danger'
        ? this.palette.danger
        : effectiveAccent === 'warm'
          ? this.palette.warm
          : effectiveAccent === 'green'
            ? this.palette.green
            : this.palette.primary

    // 地面阴影已移至 DOM overlay（世界坐标），此处不再绘制 Pixi 内嵌阴影
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
    // 蓄力期间身体发光脉冲
    const chargeBodyPulse =
      this.greenMode && !this.absorbing && this.greenModeStartedAt !== null
        ? 0.06 + Math.sin((now - this.greenModeStartedAt) / 200) * 0.04
        : 0
    outerGlow.scale.set(1 + reaction.glowBoost * 0.075 + chargeBodyPulse)
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

    // 卫星粒子：围绕角色在倾斜椭圆轨道上公转；蓄力后吸收归零
    satelliteField.visible = !this.reducedMotion
    satelliteField.position.set(
      center + (motion.bodyX * ambientMotionWeight + reaction.bodyX) * 0.45,
      center +
        motion.bodyY * ambientMotionWeight * 0.35 +
        motion.floatY * ambientMotionWeight * 0.4 +
        reaction.verticalOffset * 0.24
    )
    if (!this.reducedMotion) {
      const satelliteColors = [
        this.palette.cool,
        this.palette.warm,
        this.palette.primary,
        this.palette.highlight,
      ]
      const isCharging = this.greenMode && !this.absorbing
      const greenGlow = isCharging ? 1.3 : 1
      const chargePulse =
        isCharging && this.greenModeStartedAt !== null
          ? 0.18 + Math.sin((now - this.greenModeStartedAt) / 260) * 0.12
          : 0
      const absorptionProgress =
        this.absorbing && this.absorbingStartedAt !== null
          ? Math.min(1, (now - this.absorbingStartedAt) / 800)
          : 0
      const absorptionScale = this.absorbing ? 1 - absorptionProgress * absorptionProgress : 1
      const absorptionAlpha = this.absorbing ? 1 - absorptionProgress : 1

      for (const satellite of this.satellites) {
        const angle =
          satellite.phase +
          ((now - this.startTime) / 1000) * satellite.orbitSpeed * satellite.orbitDirection
        const orbitR = satellite.orbitRadius * absorptionScale
        const x = Math.cos(angle) * orbitR
        const yBase = Math.sin(angle) * orbitR * 0.62
        const y =
          yBase * Math.cos(satellite.inclination) + Math.sin(satellite.inclination) * x * 0.3
        const twinkle = 0.68 + (Math.sin((now - this.startTime) / 400 + satellite.phase) + 1) * 0.16
        satellite.graphic.position.set(x, y)
        satellite.graphic.alpha =
          appearance.particleAlpha * twinkle * greenGlow * absorptionAlpha + chargePulse
        satellite.graphic.tint = satelliteColors[satellite.colorIndex] ?? this.palette.primary
      }
    }

    // 运行轨道粒子：thinking/acting 时的短生命周期粒子
    if (this.runOrbitParticles.length > 0 || this.runOrbitPendingSpawnCount > 0) {
      this.updateRunOrbitParticles(now, deltaMs, center)
      this.drawRunOrbitTrails(now)
    } else if (this.runOrbitTrailLayer) {
      this.runOrbitTrailLayer.clear()
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

    // 表情渲染：使用 resolver 综合状态/手势/蓄力决定表情，然后通过过渡系统插值
    const resolvedExpression = resolveAssistantExpression(
      this.presenceState,
      this.activeGesture,
      this.powerUp
    )
    this.expressionTransition = stepAssistantExpressionTransition(
      this.expressionTransition,
      resolvedExpression,
      deltaMs,
      this.reducedMotion
    )
    const expression = this.expressionTransition.sample
    const { decorationAlpha, decorationScale, decorationYOffset } = this.expressionTransition
    const baseEyeHeight = isFluid ? 9.5 : 13
    const baseEyeWidth = isFluid ? 3.8 : 4.4
    const eyeHeight = baseEyeHeight * expression.eyeHeightMultiplier
    const eyeWidth = baseEyeWidth * expression.eyeWidthMultiplier
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

    // 装饰渲染：使用过渡 alpha，接近 0 时 clear 释放绘制
    if (decorationAlpha > 0.01) {
      const expressionAlpha = this.theme === 'dark' ? 0.72 : 0.6
      eyebrows.position.set(gazeX, gazeY + decorationYOffset)
      mouth.position.set(gazeX, gazeY + decorationYOffset)
      cheeks.position.set(gazeX, gazeY + decorationYOffset)
      eyebrows.scale.set(decorationScale)
      mouth.scale.set(decorationScale)
      cheeks.scale.set(decorationScale)
      const effectiveAlpha = expressionAlpha * decorationAlpha * (1 - restAmount * 0.6)
      drawEyebrows(
        eyebrows,
        this.palette.eye,
        effectiveAlpha,
        expression.eyebrowAngle,
        expression.eyebrowYOffset
      )
      drawMouth(
        mouth,
        this.palette.eye,
        effectiveAlpha,
        expression.mouthCurve,
        expression.mouthWidth,
        expression.mouthYOffset
      )
      drawCheeks(
        cheeks,
        this.palette.warm,
        expression.cheekAlpha * decorationAlpha * (1 - restAmount * 0.6)
      )
    } else {
      eyebrows.clear()
      mouth.clear()
      cheeks.clear()
    }
  }
}

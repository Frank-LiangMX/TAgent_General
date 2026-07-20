import type { Application, Container, Graphics } from 'pixi.js'

import type { AssistantPresenceStyle } from '../../../../types'

import {
  ASSISTANT_APPEARANCE,
  damp,
  sampleAssistantMotion,
  sampleAssistantReaction,
  sampleAssistantState,
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
  private reactionStartedAt: number | null = null
  private stateStartedAt = this.startTime

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

    root.addChild(
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
    app.stage.addChild(shadow, reactionRing, particleField, root)
    app.ticker.maxFPS = 30
    app.ticker.add(this.tick)

    this.app = app
    this.layers = {
      root,
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
    const now = performance.now()
    this.reactionStartedAt = now
    this.blinkStartedAt = null
    this.nextBlinkAt = now + 2300
    if (!this.app) return
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
    const reaction = sampleAssistantReaction(
      this.reactionStartedAt === null ? Number.POSITIVE_INFINITY : now - this.reactionStartedAt,
      this.reducedMotion
    )
    if (!reaction.active) this.reactionStartedAt = null
    const appearance = ASSISTANT_APPEARANCE[this.theme]
    const {
      root,
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

    shadow
      .clear()
      .ellipse(
        center + motion.bodyX * 0.45,
        center + BODY_RADIUS + 9 + motion.bodyY * 0.18 + reaction.hopY * 0.12,
        17 + reaction.glowBoost * 3,
        3.5 - reaction.glowBoost * 0.6
      )
      .fill({
        color: stateAccent,
        alpha: appearance.glowAlpha * state.glowMultiplier * (1 + reaction.glowBoost * 0.65),
      })
    root.position.set(
      center + motion.bodyX,
      center + motion.bodyY + motion.floatY + reaction.hopY + state.verticalOffset
    )
    root.alpha = state.opacity
    root.rotation = motion.tilt + state.rotationOffset
    root.scale.set(
      motion.breathScale * reaction.scaleX * state.scaleX,
      (2 - motion.breathScale) * reaction.scaleY * state.scaleY
    )
    halo.scale.set(1 + reaction.glowBoost * 0.055)
    outerGlow.scale.set(1 + reaction.glowBoost * 0.075)
    flow.rotation = motion.flowRotation * (isFluid ? 0.36 : 1)
    particleField.visible = !this.reducedMotion
    particleField.position.set(
      center + motion.bodyX * 0.45,
      center + motion.bodyY * 0.35 + motion.floatY * 0.4
    )
    reactionRing.clear()
    if (state.ringAlpha > 0) {
      reactionRing
        .circle(
          center + motion.bodyX * 0.55,
          center + motion.bodyY * 0.4 + motion.floatY * 0.5,
          BODY_RADIUS + state.ringRadius
        )
        .stroke({ color: stateAccent, width: 1.25, alpha: state.ringAlpha * appearance.rimAlpha })
    }
    if (reaction.active && !this.reducedMotion) {
      reactionRing
        .circle(
          center + motion.bodyX * 0.55,
          center + motion.bodyY * 0.4 + motion.floatY * 0.5,
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
      traceFluidBody(halo.clear(), BODY_RADIUS + 4, fluidPhase).fill({
        color: stateAccent,
        alpha: appearance.glowAlpha * state.glowMultiplier * (this.reducedMotion ? 0.34 : 0.62),
      })
      traceFluidBody(outerGlow.clear(), BODY_RADIUS + 1.5, fluidPhase + 1.2).fill({
        color: this.palette.cool,
        alpha: appearance.glowAlpha * state.glowMultiplier * (0.7 + motion.corePulse * 0.12),
      })
      traceFluidBody(core.clear(), BODY_RADIUS - 7, fluidPhase + 2.4)
        .fill({
          color: this.palette.primary,
          alpha: appearance.coreAlpha * motion.corePulse * 0.78,
        })
        .ellipse(8, -8, BODY_RADIUS - 18, BODY_RADIUS - 21)
        .fill({ color: this.palette.soft, alpha: appearance.bodyAlpha * 0.82 })

      for (const ribbon of ribbons) ribbon.clear()

      traceFluidBody(membrane.clear(), BODY_RADIUS, fluidPhase).fill({
        color: this.palette.highlight,
        alpha: this.theme === 'light' ? 0.58 : appearance.bodyAlpha * 0.16,
      })
      traceFluidBody(membrane, BODY_RADIUS, fluidPhase).fill({
        color: this.palette.cool,
        alpha: appearance.bodyAlpha * (this.theme === 'light' ? 0.22 : 0.3),
      })
      traceFluidBody(membrane, BODY_RADIUS, fluidPhase).stroke({
        color: this.theme === 'light' ? this.palette.primary : this.palette.eye,
        width: 1.05,
        alpha: appearance.membraneAlpha * 0.62,
        cap: 'round',
        join: 'round',
      })

      brandFacet
        .clear()
        .moveTo(7, -28)
        .bezierCurveTo(14, -31, 24, -25, 31, -15)
        .bezierCurveTo(29, -4, 25, 6, 18, 13)
        .bezierCurveTo(14, 3, 11, -12, 7, -28)
        .closePath()
        .fill({
          color: this.palette.primary,
          alpha: this.theme === 'dark' ? 0.24 : 0.16,
        })

      traceFluidBody(rimLight.clear(), BODY_RADIUS - 0.4, fluidPhase).stroke({
        color: this.palette.eye,
        width: 1.15,
        alpha: appearance.rimAlpha * (this.reducedMotion ? 0.32 : 0.58),
        cap: 'round',
        join: 'round',
      })
      rimLight.arc(0, 0, BODY_RADIUS - 1.5, glossStart, glossStart + Math.PI * 0.54).stroke({
        color: this.palette.cool,
        width: 1.8,
        alpha: appearance.rimAlpha * (this.reducedMotion ? 0.18 : 0.46),
        cap: 'round',
      })

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
      outerGlow
        .clear()
        .circle(0, 0, BODY_RADIUS + 2)
        .fill({
          color: stateAccent,
          alpha: appearance.glowAlpha * state.glowMultiplier * (0.84 + motion.corePulse * 0.16),
        })
      core
        .clear()
        .circle(-2, 1, BODY_RADIUS - 8)
        .fill({ color: this.palette.primary, alpha: appearance.coreAlpha * motion.corePulse })
        .circle(10, -9, BODY_RADIUS - 19)
        .fill({ color: this.palette.soft, alpha: appearance.bodyAlpha })

      drawRibbon(ribbons[0], this.palette.cool, appearance.ribbonAlpha, motion.ribbonPhase, 0, 10)
      drawRibbon(
        ribbons[1],
        this.palette.warm,
        appearance.ribbonAlpha * 0.72,
        -motion.ribbonPhase,
        2.1,
        7
      )
      drawRibbon(
        ribbons[2],
        this.palette.primary,
        appearance.ribbonAlpha * 0.8,
        motion.ribbonPhase,
        4.2,
        5
      )

      membrane
        .clear()
        .circle(0, 0, BODY_RADIUS)
        .fill({
          color: this.palette.highlight,
          alpha: this.theme === 'light' ? 0.6 : appearance.bodyAlpha * 0.16,
        })
        .circle(0, 0, BODY_RADIUS)
        .fill({
          color: this.palette.cool,
          alpha: appearance.bodyAlpha * (this.theme === 'light' ? 0.2 : 0.38),
        })
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
      brandFacet.clear()

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

    const gazeX = motion.gazeX + state.gazeXOffset
    const gazeY = motion.gazeY - 1 + state.gazeYOffset
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

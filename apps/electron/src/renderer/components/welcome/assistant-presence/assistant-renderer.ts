import type { Application, Container, Graphics } from 'pixi.js'

import {
  ASSISTANT_APPEARANCE,
  damp,
  sampleAssistantMotion,
  type AssistantPresenceTheme,
} from './assistant-motion'

interface AssistantPalette {
  primary: number
  cool: number
  warm: number
  soft: number
  eye: number
}

interface AssistantLayers {
  root: Container
  shadow: Graphics
  particleField: Container
  outerGlow: Graphics
  halo: Graphics
  core: Graphics
  flow: Container
  ribbons: [Graphics, Graphics, Graphics]
  membrane: Graphics
  rimLight: Graphics
  specular: Graphics
  eyeGlow: Container
  eyes: Container
}

interface AssistantParticle {
  graphic: Graphics
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
    eye: cssTokenToColor(style, theme === 'dark' ? '--foreground' : '--card', ColorClass),
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

function drawEyes(left: Graphics, right: Graphics, color: number, alpha: number): void {
  left.clear().roundRect(-2.2, -6.5, 4.4, 13, 2.2).fill({ color, alpha })
  right.clear().roundRect(-2.2, -6.5, 4.4, 13, 2.2).fill({ color, alpha })
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

  constructor(
    private readonly host: HTMLElement,
    private theme: AssistantPresenceTheme,
    private reducedMotion: boolean
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
    shadow.filters = [new pixi.BlurFilter({ strength: 7, quality: 2 })]
    const particleField = new pixi.Container()
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
    halo.filters = [new pixi.BlurFilter({ strength: 5, quality: 2 })]
    const outerGlow = new pixi.Graphics()
    outerGlow.filters = [new pixi.BlurFilter({ strength: 10, quality: 2 })]
    const core = new pixi.Graphics()
    core.filters = [new pixi.BlurFilter({ strength: 6, quality: 2 })]
    const ribbons: [Graphics, Graphics, Graphics] = [
      new pixi.Graphics(),
      new pixi.Graphics(),
      new pixi.Graphics(),
    ]
    const flow = new pixi.Container()
    flow.filters = [new pixi.BlurFilter({ strength: 2.6, quality: 2 })]
    flow.addChild(...ribbons)
    const membrane = new pixi.Graphics()
    const rimLight = new pixi.Graphics()
    const specular = new pixi.Graphics()
    specular.filters = [new pixi.BlurFilter({ strength: 1.4, quality: 2 })]
    const eyeGlow = new pixi.Container()
    eyeGlow.filters = [new pixi.BlurFilter({ strength: 3.5, quality: 2 })]
    const eyes = new pixi.Container()
    const glowLeft = new pixi.Graphics()
    const glowRight = new pixi.Graphics()
    const eyeLeft = new pixi.Graphics()
    const eyeRight = new pixi.Graphics()
    glowLeft.x = eyeLeft.x = -8
    glowRight.x = eyeRight.x = 8
    eyeGlow.addChild(glowLeft, glowRight)
    eyes.addChild(eyeLeft, eyeRight)

    root.addChild(halo, outerGlow, core, flow, membrane, rimLight, specular, eyeGlow, eyes)
    app.stage.addChild(shadow, particleField, root)
    app.ticker.maxFPS = 30
    app.ticker.add(this.tick)

    this.app = app
    this.layers = {
      root,
      shadow,
      particleField,
      outerGlow,
      halo,
      core,
      flow,
      ribbons,
      membrane,
      rimLight,
      specular,
      eyeGlow,
      eyes,
    }
    this.particles = particles
    this.palette = readPalette(this.host, this.theme, pixi.Color)
    app.canvas.className = 'assistant-presence__canvas'
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
      this.draw(performance.now())
      this.app.render()
    })
  }

  setReducedMotion(reducedMotion: boolean): void {
    this.reducedMotion = reducedMotion
    this.syncTicker()
    if (reducedMotion && this.app) {
      this.draw(performance.now())
      this.app.render()
    }
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

  destroy(): void {
    if (!this.app) return
    this.app.ticker.remove(this.tick)
    this.app.destroy(true, { children: true })
    this.app = null
    this.layers = null
    this.particles = []
    this.palette = null
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
    const motion = sampleAssistantMotion(
      now - this.startTime,
      this.pointerCurrent.x,
      this.pointerCurrent.y,
      this.reducedMotion
    )
    const appearance = ASSISTANT_APPEARANCE[this.theme]
    const {
      root,
      shadow,
      particleField,
      outerGlow,
      halo,
      core,
      flow,
      ribbons,
      membrane,
      rimLight,
      specular,
      eyeGlow,
      eyes,
    } = this.layers
    const center = DESIGN_SIZE / 2

    shadow
      .clear()
      .ellipse(
        center + motion.bodyX * 0.45,
        center + BODY_RADIUS + 9 + motion.bodyY * 0.18,
        17,
        3.5
      )
      .fill({ color: this.palette.primary, alpha: appearance.glowAlpha })
    root.position.set(center + motion.bodyX, center + motion.bodyY + motion.floatY)
    root.rotation = motion.tilt
    root.scale.set(motion.breathScale, 2 - motion.breathScale)
    flow.rotation = motion.flowRotation
    particleField.visible = !this.reducedMotion
    particleField.position.set(
      center + motion.bodyX * 0.45,
      center + motion.bodyY * 0.35 + motion.floatY * 0.4
    )

    if (!this.reducedMotion) {
      const particleColors = [
        this.palette.cool,
        this.palette.warm,
        this.palette.primary,
        this.palette.eye,
      ]
      for (const particle of this.particles) {
        const angle = particle.angle + motion.particlePhase * particle.speed
        const orbit = particle.radius + Math.sin(motion.particlePhase * 0.8 + particle.phase) * 2.4
        const twinkle = 0.38 + (Math.sin(motion.particlePhase * 2.1 + particle.phase) + 1) * 0.28
        particle.graphic.position.set(
          Math.cos(angle) * orbit,
          Math.sin(angle) * orbit * 0.72 +
            Math.sin(motion.particlePhase * 1.2 + particle.phase) * 1.8
        )
        particle.graphic.scale.set(
          0.72 + (Math.sin(motion.particlePhase * 1.7 + particle.phase) + 1) * 0.2
        )
        particle.graphic.alpha = appearance.particleAlpha * twinkle
        particle.graphic.tint = particleColors[particle.colorIndex] ?? this.palette.primary
      }
    }

    const glossStart = motion.glossPhase - 0.42
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
        color: this.palette.cool,
        alpha: appearance.glowAlpha * (0.84 + motion.corePulse * 0.16),
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
      .fill({ color: this.palette.cool, alpha: appearance.bodyAlpha * 0.38 })
      .arc(0, 0, BODY_RADIUS, Math.PI * 1.06, Math.PI * 1.72)
      .stroke({
        color: this.palette.eye,
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

    rimLight
      .clear()
      .arc(0, 0, BODY_RADIUS - 0.4, glossStart, glossStart + Math.PI * 0.62)
      .stroke({
        color: this.palette.eye,
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

    const highlightX = -12 + motion.gazeX * 0.34
    const highlightY = -15 + motion.gazeY * 0.24
    const glintPulse = 0.72 + (Math.sin(motion.glossPhase * 1.9) + 1) * 0.13
    specular
      .clear()
      .ellipse(highlightX, highlightY, 11, 3.4)
      .fill({
        color: this.palette.eye,
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

    const gazeX = motion.gazeX
    const gazeY = motion.gazeY - 1
    eyeGlow.position.set(gazeX, gazeY)
    eyes.position.set(gazeX, gazeY)
    eyeGlow.scale.y = eyes.scale.y = this.blinkScale(now)
    const [glowLeft, glowRight] = eyeGlow.children as [Graphics, Graphics]
    const [eyeLeft, eyeRight] = eyes.children as [Graphics, Graphics]
    drawEyes(glowLeft, glowRight, this.palette.eye, this.theme === 'dark' ? 0.54 : 0.4)
    drawEyes(eyeLeft, eyeRight, this.palette.eye, this.theme === 'dark' ? 0.96 : 0.88)
  }
}

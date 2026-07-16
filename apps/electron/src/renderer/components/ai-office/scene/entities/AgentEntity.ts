// @ts-nocheck
import { Container, Graphics, Rectangle } from 'pixi.js'
import type { OfficeAgent, OfficeAgentState } from '../../types/office-agent'
import { resolveWalkViewFacing, viewFacingToLR } from '../systems/movementFacing'
import { SpineCharacter } from '../characters/SpineCharacter'
import { isSpineReady } from '../assets/loadSpineAssets'
import { Bubble } from '../ui/Bubble'
import { StatusLabel } from '../ui/StatusLabel'

// Unique appearance per agent based on their color
const AGENT_STYLES: Record<string, {
  skinTone: number; hairColor: number; hairStyle: 'short' | 'long' | 'spiky' | 'bald' | 'ponytail';
  shirtStyle: 'round' | 'vneck' | 'collar';
}> = {
  marvis:       { skinTone: 0xffe0c4, hairColor: 0x2a2a30, hairStyle: 'short',    shirtStyle: 'collar' },
  'code-agent': { skinTone: 0xf5d5b8, hairColor: 0x1a1a2e, hairStyle: 'spiky',   shirtStyle: 'vneck' },
  'file-agent': { skinTone: 0xffe8d6, hairColor: 0x4a3728, hairStyle: 'long',     shirtStyle: 'round' },
  'app-agent':  { skinTone: 0xf0c8a0, hairColor: 0x2c1810, hairStyle: 'ponytail', shirtStyle: 'collar' },
  'review-agent':{ skinTone: 0xffdbb4, hairColor: 0x3d2b1f, hairStyle: 'short',   shirtStyle: 'vneck' },
  'data-agent': { skinTone: 0xf5dcc0, hairColor: 0x1a1a2e, hairStyle: 'bald',     shirtStyle: 'round' },
}

function getStyle(agentId: string) {
  return AGENT_STYLES[agentId] ?? AGENT_STYLES.marvis!
}

export class AgentEntity extends Container {
  readonly agentId: string
  private agent: OfficeAgent
  private spineChar: SpineCharacter | null = null
  private fallbackBody: Graphics | null = null
  private statusLabel: StatusLabel
  private bubble: Bubble
  private walkPhase = 0
  private useSpine = false

  constructor(agent: OfficeAgent) {
    super()
    this.agentId = agent.id
    this.agent = { ...agent }
    this.statusLabel = new StatusLabel(agent.name)
    this.bubble = new Bubble()

    if (isSpineReady()) {
      this.spineChar = new SpineCharacter(agent.id, agent.color)
      if (this.spineChar.isReady) {
        this.useSpine = true
        this.spineChar.setAgentColor(agent.color)
        this.spineChar.setFacing(agent.facing)
        this.spineChar.setViewFacing(agent.viewFacing ?? 'front')
        this.spineChar.playState(agent.state)
        this.addChild(this.spineChar, this.statusLabel, this.bubble)
      } else {
        this.spineChar.destroy()
        this.spineChar = null
        this.initFallbackGraphics()
      }
    } else {
      this.initFallbackGraphics()
    }

    this.eventMode = 'static'
    this.cursor = 'pointer'
    this.hitArea = new Rectangle(-34, -92, 68, 124)
    this.syncVisual()
    this.position.set(agent.x, agent.y)
  }

  get data(): OfficeAgent { return this.agent }

  apply(patch: Partial<OfficeAgent>) {
    const prevState = this.agent.state
    const prevFacing = this.agent.facing
    const prevViewFacing = this.agent.viewFacing
    const prevColor = this.agent.color
    const prevCustomAnimation = this.agent.customAnimation
    this.agent = { ...this.agent, ...patch }

    if (this.useSpine && this.spineChar) {
      if (patch.viewFacing != null && patch.viewFacing !== prevViewFacing) this.spineChar.setViewFacing(patch.viewFacing)
      if (patch.facing != null && patch.facing !== prevFacing) this.spineChar.setFacing(patch.facing)
      if ((patch.state != null && patch.state !== prevState) || patch.customAnimation !== prevCustomAnimation) {
        this.spineChar.playState(this.agent.state, this.agent.customAnimation)
      }
      if (patch.color != null && patch.color !== prevColor) this.spineChar.setAgentColor(patch.color)
      this.updateOverlayPositions()
    } else {
      this.syncVisual()
    }
  }

  setPosition(x: number, y: number) {
    this.agent.x = x; this.agent.y = y
    this.position.set(x, y)
  }

  showBubble(text: string, duration = 4) {
    this.agent.bubbleText = text
    this.bubble.show(text, duration)
    this.updateOverlayPositions()
  }

  hideBubble() {
    this.agent.bubbleText = undefined
    this.bubble.hide()
  }

  playCustomAnimation(animation: string, task?: string) {
    this.agent = {
      ...this.agent, state: 'talking', currentTask: task, customAnimation: animation,
      viewFacing: 'front', facing: 1,
      targetX: undefined, targetY: undefined, walkPath: undefined, walkPathIndex: undefined,
      mission: undefined, bubbleText: undefined,
    }
    if (this.useSpine && this.spineChar) {
      this.spineChar.setViewFacing('front')
      this.spineChar.setFacing(1)
      this.spineChar.playAnimation(animation)
      this.updateOverlayPositions()
      return
    }
    this.syncVisual()
  }

  updateVisuals(state: OfficeAgentState, dt: number) {
    if (this.useSpine && this.spineChar) {
      if (state === 'walking' && this.agent.targetX != null && this.agent.targetY != null) {
        const vf = resolveWalkViewFacing(this.agent.targetX - this.agent.x, this.agent.targetY - this.agent.y)
        this.agent.viewFacing = vf
        this.agent.facing = viewFacingToLR(vf)
        this.spineChar.setViewFacing(vf)
        this.spineChar.setFacing(this.agent.facing)
      } else if (state === 'working' || state === 'thinking') {
        if (this.agent.viewFacing !== 'back') { this.agent.viewFacing = 'back'; this.spineChar.setViewFacing('back') }
      }
      this.spineChar.playState(state, this.agent.customAnimation)
    } else {
      this.walkPhase += dt * 8
      this.drawFallbackBody(state, 0)
    }
    this.bubble.update(dt)
    this.statusLabel.setState(state)
    this.statusLabel.setTask(state === 'working' || state === 'thinking' ? this.agent.currentTask : undefined)
    this.updateOverlayPositions()
  }

  private updateOverlayPositions() {
    const crownTopY = this.useSpine && this.spineChar ? this.spineChar.getHeadOffsetY() : -58
    this.statusLabel.layout(crownTopY)
    const labelTopY = this.statusLabel.getLabelTopY(crownTopY)
    this.bubble.position.set(0, labelTopY - 4 - Bubble.TAIL_TIP_Y + 10)
  }

  private syncVisual() {
    this.statusLabel.setName(this.agent.name)
    this.statusLabel.setState(this.agent.state)
    this.statusLabel.setTask(this.agent.state === 'working' || this.agent.state === 'thinking' ? this.agent.currentTask : undefined)
    if (this.agent.bubbleText) this.bubble.show(this.agent.bubbleText)
    if (this.useSpine && this.spineChar) {
      this.spineChar.playState(this.agent.state, this.agent.customAnimation)
      this.spineChar.setFacing(this.agent.facing)
      this.spineChar.setViewFacing(this.agent.viewFacing ?? 'front')
      this.spineChar.setAgentColor(this.agent.color)
    } else {
      this.drawFallbackBody(this.agent.state, 0)
    }
    this.updateOverlayPositions()
  }

  private initFallbackGraphics() {
    this.fallbackBody = new Graphics()
    this.addChild(this.fallbackBody, this.statusLabel, this.bubble)
    this.useSpine = false
  }

  private drawFallbackBody(state: OfficeAgentState, bob: number) {
    if (!this.fallbackBody) return

    const g = this.fallbackBody
    g.clear()

    const style = getStyle(this.agentId)
    const agentColor = this.agent.color
    const facing = this.agent.facing

    const bounce =
      state === 'walking' ? Math.sin(this.walkPhase) * 3
      : state === 'working' ? Math.sin(this.walkPhase * 2) * 1
      : bob

    // Shadow
    g.ellipse(0, 18 + bounce, 16, 5)
    g.fill({ color: 0x000000, alpha: 0.12 })

    // Legs
    const legSwing = state === 'walking' ? Math.sin(this.walkPhase) * 4 : 0
    g.roundRect(-10, 6 + bounce + legSwing, 8, 14, 3)
    g.fill(0x3a3f4a)
    g.roundRect(2, 6 + bounce - legSwing, 8, 14, 3)
    g.fill(0x3a3f4a)

    // Shoes
    g.roundRect(-11, 18 + bounce + legSwing, 10, 4, 2)
    g.fill(0x2a2a2a)
    g.roundRect(1, 18 + bounce - legSwing, 10, 4, 2)
    g.fill(0x2a2a2a)

    // Body/shirt — uses agent's unique color
    g.roundRect(-12, -10 + bounce, 24, 20, 5)
    g.fill(agentColor)

    // Shirt detail based on style
    if (style.shirtStyle === 'collar') {
      g.roundRect(-4, -10 + bounce, 8, 6, 2)
      g.fill(0xffffff)
    } else if (style.shirtStyle === 'vneck') {
      g.moveTo(-3, -10 + bounce)
      g.lineTo(0, -4 + bounce)
      g.lineTo(3, -10 + bounce)
      g.fill(0xffffff)
    }

    // Head
    g.circle(facing * 1, -22 + bounce, 11)
    g.fill(style.skinTone)

    // Hair based on style
    const headX = facing * 1
    const headY = -22 + bounce
    if (style.hairStyle === 'short') {
      g.roundRect(headX - 11, headY - 11, 22, 10, 5)
      g.fill(style.hairColor)
    } else if (style.hairStyle === 'long') {
      g.roundRect(headX - 12, headY - 12, 24, 14, 6)
      g.fill(style.hairColor)
      g.roundRect(headX - 12, headY - 2, 6, 14, 3)
      g.fill(style.hairColor)
      g.roundRect(headX + 6, headY - 2, 6, 14, 3)
      g.fill(style.hairColor)
    } else if (style.hairStyle === 'spiky') {
      g.roundRect(headX - 10, headY - 13, 20, 12, 4)
      g.fill(style.hairColor)
      g.moveTo(headX - 6, headY - 13)
      g.lineTo(headX - 3, headY - 20)
      g.lineTo(headX, headY - 13)
      g.fill(style.hairColor)
      g.moveTo(headX + 2, headY - 13)
      g.lineTo(headX + 5, headY - 19)
      g.lineTo(headX + 8, headY - 13)
      g.fill(style.hairColor)
    } else if (style.hairStyle === 'ponytail') {
      g.roundRect(headX - 11, headY - 11, 22, 12, 6)
      g.fill(style.hairColor)
      g.roundRect(headX + 8, headY - 6, 5, 18, 3)
      g.fill(style.hairColor)
      g.circle(headX + 10, headY + 12, 4)
      g.fill(style.hairColor)
    } else if (style.hairStyle === 'bald') {
      // Just skin, no hair
    }

    // Eyes
    const eyeY = headY - 1
    g.circle(headX - 4, eyeY, 2)
    g.fill(0x333333)
    g.circle(headX + 4, eyeY, 2)
    g.fill(0x333333)

    // Eye whites
    g.circle(headX - 4, eyeY - 0.5, 0.8)
    g.fill(0xffffff)
    g.circle(headX + 4, eyeY - 0.5, 0.8)
    g.fill(0xffffff)

    // Mouth
    if (state === 'working') {
      g.moveTo(headX - 2, headY + 4)
      g.lineTo(headX + 2, headY + 4)
      g.stroke({ color: 0x333333, width: 1 })
    } else if (state === 'thinking') {
      g.circle(headX + 2, headY + 4, 1.5)
      g.fill(0x333333)
    } else {
      g.moveTo(headX - 2, headY + 3)
      g.quadraticCurveTo(headX, headY + 6, headX + 2, headY + 3)
      g.stroke({ color: 0x333333, width: 1 })
    }

    // Arms
    if (state === 'working') {
      // Typing arms
      const armY = -2 + bounce + Math.sin(this.walkPhase * 3) * 2
      g.roundRect(facing * 13, armY, 10, 4, 2)
      g.fill(style.skinTone)
    } else if (state === 'talking') {
      // Waving arm
      const wave = Math.sin(this.walkPhase * 2) * 8
      g.roundRect(facing * 13, -14 + bounce + wave, 4, 12, 2)
      g.fill(style.skinTone)
    }

    // Badge/lanyard
    g.roundRect(-3, -2 + bounce, 6, 8, 2)
    g.fill(agentColor)
    g.roundRect(-1, 0 + bounce, 2, 4, 1)
    g.fill(0xcccccc)

    // Thinking dots
    if (state === 'thinking') {
      for (let i = 0; i < 3; i++) {
        const dotAlpha = i <= Math.floor(this.walkPhase * 0.5) % 3 ? 1 : 0.3
        g.circle(16 + i * 6, -36 + bounce, 2.5)
        g.fill({ color: 0x9b6dd7, alpha: dotAlpha })
      }
    }

    this.scale.x = facing
  }
}

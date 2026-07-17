// @ts-nocheck
import { Spine } from '@esotericsoftware/spine-pixi-v8'
import { Container, Graphics } from 'pixi.js'
import type { ChibiFacing, OfficeAgentState } from '../../types/office-agent'
import {
  createSpineFromCache,
  getSpineCharacterPack,
  type SpineCharacterPack,
} from '../assets/loadSpineAssets'
import {
  getWorkerSpineSkin,
  OFFICE_CHARACTER_SCALE,
  OFFICE_CHARACTER_TARGET_HEIGHT,
  resolveWorkerAnimation,
  type WorkerAnimationSpec,
} from './workerSpineAppearance'

type PackConfig = {
  scale: number
  y: number
  shadow: { w: number; h: number; y: number }
  timeScale?: Partial<Record<OfficeAgentState, number>>
}

const PACK_CONFIG: Record<SpineCharacterPack, PackConfig> = {
  'chibi-stickers': {
    scale: OFFICE_CHARACTER_SCALE,
    y: 2,
    shadow: { w: 12, h: 3.5, y: 3 },
    timeScale: {
      thinking: 0.85,
      talking: 1.05,
      reviewing: 0.8,
      blocked: 0.9,
    },
  },
}

const STATE_MIX_SECONDS = 0.24

export class SpineCharacter extends Container {
  private readonly appearanceKey: string
  private spine: Spine | null = null
  private shadow: Graphics
  private currentAnimationKey = ''
  private ready = false
  private pack: SpineCharacterPack | null = null
  private agentState: OfficeAgentState = 'waiting'
  private customAnimation: string | undefined
  private viewFacing: ChibiFacing = 'front'

  constructor(appearanceKey: string, _agentColor: number) {
    super()
    this.appearanceKey = appearanceKey
    this.shadow = new Graphics()
    this.addChild(this.shadow)
    this.createSpine()
  }

  get isReady() {
    return this.ready
  }

  setAgentColor(_color: number) {
    if (!this.spine) return
    this.spine.skeleton.color.set(1, 1, 1, 1)
  }

  setFacing(_dir: 1 | -1) {
    // Chibi pack has real four-direction animations, so it is never mirrored.
  }

  setViewFacing(facing: ChibiFacing) {
    if (this.viewFacing === facing) return
    this.viewFacing = facing
    this.currentAnimationKey = ''
    this.applyAnimation()
  }

  playState(state: OfficeAgentState, customAnimation?: string) {
    if (!this.spine || !this.ready || !this.pack) return
    this.agentState = state
    if (this.customAnimation !== customAnimation) {
      this.customAnimation = customAnimation
      this.currentAnimationKey = ''
    }
    this.applyAnimation()
  }

  playAnimation(animation: string) {
    if (!this.spine || !this.ready) return
    if (!this.spine.skeleton.data.findAnimation(animation)) {
      console.warn('[SpineCharacter] animation not found:', animation)
      return
    }
    this.customAnimation = animation
    this.agentState = 'talking'
    this.currentAnimationKey = ''
    this.applyAnimation()
  }

  getHeadOffsetY(): number {
    if (!this.spine || !this.pack) return -52
    // 使用角色完整视觉高度作为稳定锚点，避免抬手、转身等骨骼动作带动工牌压到脸上。
    return this.spine.y - OFFICE_CHARACTER_TARGET_HEIGHT
  }

  private animationSpec(): WorkerAnimationSpec {
    if (this.customAnimation && this.agentState !== 'walking') {
      return { name: this.customAnimation, loop: true }
    }
    return resolveWorkerAnimation(this.agentState, this.viewFacing)
  }

  private applyAnimation() {
    if (!this.spine || !this.pack) return
    const config = PACK_CONFIG[this.pack]
    const spec = this.animationSpec()
    const animation = this.spine.skeleton.data.findAnimation(spec.name)
    const fallback = resolveWorkerAnimation('waiting', this.viewFacing).name
    const name = animation ? spec.name : fallback
    const animationKey = `${this.agentState}:${this.viewFacing}:${name}:${spec.loop}`

    if (animationKey === this.currentAnimationKey) {
      this.spine.state.timeScale = config.timeScale?.[this.agentState] ?? 1
      return
    }

    this.currentAnimationKey = animationKey
    const entry = this.spine.state.setAnimation(0, name, animation ? spec.loop : true)
    this.spine.state.timeScale = config.timeScale?.[this.agentState] ?? 1
    if (entry) entry.mixDuration = STATE_MIX_SECONDS

    if (
      animation &&
      !spec.loop &&
      spec.settleTo &&
      this.spine.skeleton.data.findAnimation(spec.settleTo)
    ) {
      this.spine.state.addAnimation(0, spec.settleTo, true, 0)
    }
  }

  private createSpine() {
    const pack = getSpineCharacterPack()
    if (!pack) return
    this.pack = pack

    try {
      const config = PACK_CONFIG[pack]
      const spine = createSpineFromCache()
      if (!spine) return

      const skinName = getWorkerSpineSkin(this.appearanceKey)
      if (spine.skeleton.data.findSkin(skinName)) {
        spine.skeleton.setSkinByName(skinName)
        spine.skeleton.setSlotsToSetupPose()
      }

      spine.state.data.defaultMix = STATE_MIX_SECONDS
      spine.scale.set(config.scale)
      spine.position.set(0, config.y)
      this.spine = spine
      this.ready = true
      this.addChild(spine)
      this.drawShadow(config.shadow)
      this.applyAnimation()
    } catch (error) {
      console.error(`[SpineCharacter] create failed (${pack}):`, error)
      this.ready = false
    }
  }

  private drawShadow(shadow: { w: number; h: number; y: number }) {
    this.shadow.clear()
    this.shadow.ellipse(0, shadow.y, shadow.w, shadow.h)
    this.shadow.fill({ color: 0x000000, alpha: 0.12 })
  }
}

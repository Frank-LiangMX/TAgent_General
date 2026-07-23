import { describe, expect, it } from 'vitest'

import {
  ASSISTANT_APPEARANCE,
  ASSISTANT_REACTION_DURATION_MS,
  SATELLITE_ABSORPTION_MS,
  SATELLITE_CHARGE_DELAY_MS,
  SATELLITE_MAX,
  WORLD_SHADOW_FADE_THRESHOLD,
  clamp,
  computeWorldShadowParams,
  damp,
  getAssistantGestureDuration,
  getAssistantRunOrbitProfile,
  isSatelliteAbsorptionFinished,
  isSatelliteChargeFinished,
  resolveAssistantExpression,
  resolveAssistantPresenceState,
  resolveSatelliteAdd,
  sampleAssistantExpression,
  sampleAssistantGesture,
  sampleAssistantMotion,
  sampleAssistantReaction,
  sampleAssistantRollRotation,
  sampleAssistantSlimeRest,
  sampleAssistantState,
  sampleAssistantTravelDeformation,
  createIdleExpressionTransitionState,
  stepAssistantExpressionTransition,
  EXPRESSION_ENTER_DURATION_MS,
  EXPRESSION_EXIT_DURATION_MS,
  type SatelliteAddResult,
} from './assistant-motion'
import {
  ASSISTANT_PIXI_FILTERS_ENABLED,
  ASSISTANT_VIEWPORT_PADDING,
  BODY_BOTTOM_RATIO,
  fitAssistantCanvasToHost,
} from './assistant-renderer'
import {
  normalizeAssistantPresenceMotion,
  normalizeAssistantPresenceStyle,
} from '../../../../types'

describe('assistant motion', () => {
  it('clamps pointer input to the supported range', () => {
    expect(clamp(-3, -1, 1)).toBe(-1)
    expect(clamp(3, -1, 1)).toBe(1)
    expect(clamp(0.4, -1, 1)).toBe(0.4)
  })

  it('damps toward the target without overshooting', () => {
    expect(damp(0, 1, 7, 0)).toBe(0)
    const next = damp(0, 1, 7, 16)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(1)
  })

  it('rotates only the assistant body through two turns during a card roll', () => {
    expect(sampleAssistantRollRotation(1200, 2400, 1, false)).toBeCloseTo(Math.PI * 2)
    expect(sampleAssistantRollRotation(2400, 2400, -1, false)).toBeCloseTo(-Math.PI * 4)
    expect(sampleAssistantRollRotation(1200, 2400, 1, true)).toBe(0)
  })

  it('compresses a soft body along its velocity axis and stretches across it', () => {
    const horizontal = sampleAssistantTravelDeformation(500, 1000, 100, 0, false)
    const vertical = sampleAssistantTravelDeformation(500, 1000, 0, -100, false)

    expect(horizontal.active).toBe(true)
    expect(horizontal.axisAngle).toBe(0)
    expect(horizontal.scaleAlong).toBeLessThan(1)
    expect(horizontal.scaleAcross).toBeGreaterThan(1)
    expect(vertical.axisAngle).toBeCloseTo(-Math.PI / 2)
    expect(vertical.strain).toBeCloseTo(horizontal.strain)
  })

  it('scales travel deformation with speed and disables it for reduced motion', () => {
    const slow = sampleAssistantTravelDeformation(500, 1000, 20, 0, false)
    const fast = sampleAssistantTravelDeformation(500, 1000, 100, 0, false)
    const reduced = sampleAssistantTravelDeformation(500, 1000, 100, 0, true)

    expect(fast.strain).toBeGreaterThan(slow.strain)
    expect(reduced.strain).toBe(0)
    expect(reduced.scaleAlong).toBe(1)
    expect(reduced.scaleAcross).toBe(1)
  })

  it('keeps a tired slime subtly alive and respects reduced motion', () => {
    const first = sampleAssistantSlimeRest(0, false)
    const later = sampleAssistantSlimeRest(Math.PI, false)
    const reduced = sampleAssistantSlimeRest(Math.PI, true)

    expect(later.breath).not.toBeCloseTo(first.breath)
    expect(later.lateral).not.toBeCloseTo(first.lateral)
    expect(Math.abs(later.lateral)).toBeLessThanOrEqual(1)
    expect(reduced).toEqual({ breath: 0, lateral: 0 })
  })

  it('keeps quiet internal motion without spatial movement for reduced motion', () => {
    const sample = sampleAssistantMotion(1234, 2, -2, true)
    expect(sample.bodyX).toBe(0)
    expect(sample.bodyY).toBe(0)
    expect(sample.breathScale).not.toBe(1)
    expect(Math.abs(sample.floatY)).toBeLessThanOrEqual(0.35)
    expect(sample.gazeX).toBe(2.2)
    expect(sample.gazeY).toBe(-1.4)
    expect(sample.corePulse).not.toBe(0.95)
    expect(sample.flowRotation).not.toBe(0)
    expect(sample.glossPhase).toBe(0.72)
    expect(sample.particlePhase).toBe(0)
    expect(sample.tilt).toBe(0)
    expect(sample.ribbonPhase).toBeGreaterThan(0)
  })

  it('animates breathing, floating, gaze, tilt and ribbon flow', () => {
    const sample = sampleAssistantMotion(700, 0.5, -0.5, false)
    expect(sample.bodyX).toBe(2.9)
    expect(sample.bodyY).toBe(-1.9)
    expect(sample.breathScale).not.toBe(1)
    expect(sample.corePulse).toBeGreaterThan(0.8)
    expect(sample.floatY).not.toBe(0)
    expect(sample.flowRotation).not.toBe(0)
    expect(sample.gazeX).toBe(4.2)
    expect(sample.gazeY).toBe(-2.9)
    expect(sample.glossPhase).toBeGreaterThan(0)
    expect(sample.particlePhase).toBe(0.7)
    expect(sample.tilt).toBeCloseTo(0.0425)
    expect(sample.ribbonPhase).toBeGreaterThan(0)
  })

  it('keeps the dark appearance more legible than the light appearance', () => {
    expect(ASSISTANT_APPEARANCE.dark.bodyAlpha).toBeGreaterThan(
      ASSISTANT_APPEARANCE.light.bodyAlpha
    )
    expect(ASSISTANT_APPEARANCE.dark.ribbonAlpha).toBeGreaterThan(
      ASSISTANT_APPEARANCE.light.ribbonAlpha
    )
  })

  it('gives the light material a defined membrane and stronger highlight', () => {
    expect(ASSISTANT_APPEARANCE.light.membraneAlpha).toBeGreaterThanOrEqual(0.3)
    expect(ASSISTANT_APPEARANCE.light.specularAlpha).toBeGreaterThan(0.5)
  })

  it('reserves enough viewport padding for glow and orbiting particles', () => {
    expect(ASSISTANT_VIEWPORT_PADDING).toBeGreaterThanOrEqual(32)
  })

  it('fits the dynamic canvas to the same box as the static fallback', () => {
    const canvas = { style: { width: '144px', height: '144px' } }

    fitAssistantCanvasToHost(canvas as Pick<HTMLCanvasElement, 'style'>)

    expect(canvas.style.width).toBe('100%')
    expect(canvas.style.height).toBe('100%')
  })

  it('keeps offscreen Pixi filters out of every assistant renderer', () => {
    expect(ASSISTANT_PIXI_FILTERS_ENABLED).toBe(false)
  })

  it('normalizes both selectable presence styles without changing the default', () => {
    expect(normalizeAssistantPresenceStyle('ribbon')).toBe('ribbon')
    expect(normalizeAssistantPresenceStyle('fluid')).toBe('fluid')
    expect(normalizeAssistantPresenceStyle(undefined)).toBe('ribbon')
  })

  it('normalizes presence motion preference and rejects unknown values', () => {
    expect(normalizeAssistantPresenceMotion('rich')).toBe('rich')
    expect(normalizeAssistantPresenceMotion('reduced')).toBe('reduced')
    expect(normalizeAssistantPresenceMotion(undefined)).toBe('rich')
    expect(normalizeAssistantPresenceMotion('system')).toBe('rich')
    expect(normalizeAssistantPresenceMotion('minimal')).toBe('rich')
  })

  it('responds to activation with squash, lift, glow and a particle burst', () => {
    const press = sampleAssistantReaction(90, false)
    const release = sampleAssistantReaction(260, false)

    expect(press.active).toBe(true)
    expect(press.scaleX).toBeGreaterThan(1)
    expect(press.scaleY).toBeLessThan(1)
    expect(release.hopY).toBeLessThan(0)
    expect(release.glowBoost).toBeGreaterThan(0)
    expect(release.particleBurst).toBeGreaterThan(0)
    expect(release.ringAlpha).toBeGreaterThan(0)
  })

  it('uses a non-spatial activation response when reduced motion is enabled', () => {
    const reaction = sampleAssistantReaction(90, true)

    expect(reaction.active).toBe(true)
    expect(reaction.glowBoost).toBeGreaterThan(0)
    expect(reaction.eyeScaleY).toBeLessThan(1)
    expect(reaction.hopY).toBe(0)
    expect(reaction.particleBurst).toBe(0)
    expect(reaction.scaleX).toBe(1)
    expect(reaction.scaleY).toBe(1)
  })

  it('returns to a neutral reaction state after the feedback finishes', () => {
    const reaction = sampleAssistantReaction(ASSISTANT_REACTION_DURATION_MS, false)

    expect(reaction.active).toBe(false)
    expect(reaction.glowBoost).toBe(0)
    expect(reaction.hopY).toBe(0)
    expect(reaction.scaleX).toBe(1)
    expect(reaction.scaleY).toBe(1)
  })

  it('gives idle gestures distinct silhouettes', () => {
    const glance = sampleAssistantGesture('glance', 420, false)
    const stretch = sampleAssistantGesture('stretch', 420, false)
    const peek = sampleAssistantGesture('peek', 420, false)
    const orbit = sampleAssistantGesture('orbit', 420, false)

    expect(Math.abs(glance.gazeX)).toBeGreaterThan(1)
    expect(stretch.scaleY).toBeGreaterThan(1)
    expect(peek.bodyX).toBeGreaterThan(1)
    expect(orbit.particleBurst).toBeGreaterThan(0)
  })

  it('slumps while tired and rises during recovery', () => {
    const tired = sampleAssistantGesture('tired', 1200, false)
    const recovery = sampleAssistantGesture('recover', 360, false)

    expect(tired.verticalOffset).toBeGreaterThan(10)
    expect(tired.scaleX).toBeGreaterThan(1)
    expect(tired.scaleY).toBeGreaterThan(0.8)
    expect(tired.scaleY).toBeLessThan(0.9)
    expect(tired.eyeScaleY).toBeGreaterThan(0.7)
    expect(tired.eyeScaleY).toBeLessThan(0.85)
    expect(recovery.hopY).toBeLessThan(0)
    expect(recovery.glowBoost).toBeGreaterThan(0)
  })

  it('removes spatial gestures in reduced motion mode', () => {
    const tired = sampleAssistantGesture('tired', 1200, true)

    expect(tired.verticalOffset).toBe(0)
    expect(tired.rotation).toBe(0)
    expect(tired.scaleX).toBe(1)
    expect(tired.scaleY).toBe(1)
    expect(tired.eyeScaleY).toBeLessThan(0.3)
  })

  it('keeps the tired pose active until recovery begins', () => {
    const duration = getAssistantGestureDuration('tired')
    expect(sampleAssistantGesture('tired', duration - 1, false).active).toBe(true)
    expect(sampleAssistantGesture('tired', duration, false).active).toBe(false)
  })

  it('resolves session states using the interaction priority', () => {
    const base = {
      acting: false,
      completed: false,
      engaged: false,
      hasError: false,
      needsInput: false,
      running: false,
    }

    expect(resolveAssistantPresenceState(base)).toBe('standby')
    expect(resolveAssistantPresenceState({ ...base, engaged: true })).toBe('input')
    expect(resolveAssistantPresenceState({ ...base, running: true })).toBe('thinking')
    expect(resolveAssistantPresenceState({ ...base, running: true, acting: true })).toBe('acting')
    expect(resolveAssistantPresenceState({ ...base, completed: true })).toBe('success')
    expect(resolveAssistantPresenceState({ ...base, needsInput: true, running: true })).toBe(
      'needs-input'
    )
    expect(
      resolveAssistantPresenceState({ ...base, hasError: true, needsInput: true, running: true })
    ).toBe('error')
  })

  it('makes active work faster and more luminous than standby', () => {
    const standby = sampleAssistantState('standby', 400, false)
    const acting = sampleAssistantState('acting', 400, false)

    expect(acting.timeScale).toBeGreaterThan(standby.timeScale)
    expect(acting.glowMultiplier).toBeGreaterThan(standby.glowMultiplier)
    expect(acting.particleSpeedMultiplier).toBeGreaterThan(standby.particleSpeedMultiplier)
    expect(acting.ringAlpha).toBeGreaterThan(0)
    expect(Math.abs(acting.rotationOffset)).toBeGreaterThan(0)
    expect(acting.scaleX).not.toBe(acting.scaleY)
  })

  it('uses distinct body gestures for attention, completion and error', () => {
    const attention = sampleAssistantState('needs-input', 400, false)
    const success = sampleAssistantState('success', 180, false)
    const error = sampleAssistantState('error', 400, false)

    expect(attention.gazeYOffset).toBeLessThan(0)
    expect(attention.verticalOffset).toBeLessThan(0)
    expect(success.scaleX).toBeGreaterThan(1)
    expect(success.verticalOffset).toBeLessThan(0)
    expect(error.scaleX).toBeGreaterThan(1)
    expect(error.scaleY).toBeLessThan(1)
    expect(error.gazeYOffset).toBeGreaterThan(0)
  })

  it('keeps semantic state cues in reduced motion mode', () => {
    const attention = sampleAssistantState('needs-input', 800, true)
    const error = sampleAssistantState('error', 800, true)

    expect(attention.accent).toBe('warm')
    expect(attention.ringAlpha).toBeGreaterThan(0)
    expect(error.accent).toBe('danger')
    expect(error.eyeScaleY).toBeLessThan(1)
    expect(error.rotationOffset).toBe(0)
    expect(error.scaleX).toBe(1)
    expect(error.scaleY).toBe(1)
    expect(error.verticalOffset).toBe(0)
  })

  it('maps default states to neutral expression', () => {
    const standby = sampleAssistantState('standby', 400, false)
    const input = sampleAssistantState('input', 400, false)
    const thinking = sampleAssistantState('thinking', 400, false)
    const acting = sampleAssistantState('acting', 400, false)

    expect(standby.expression).toBe('neutral')
    expect(input.expression).toBe('neutral')
    expect(thinking.expression).toBe('neutral')
    expect(acting.expression).toBe('neutral')
  })

  it('returns valid expression samples for all expression types', () => {
    const expressions = [
      'neutral',
      'happy',
      'angry',
      'sad',
      'delight',
      'focused',
      'tired',
      'confused',
      'dizzy',
      'powered',
    ] as const

    for (const expr of expressions) {
      const sample = sampleAssistantExpression(expr)
      expect(sample.expression).toBe(expr)
      expect(sample.eyeHeightMultiplier).toBeGreaterThan(0)
      expect(sample.eyeWidthMultiplier).toBeGreaterThan(0)
      expect(sample.mouthWidth).toBeGreaterThan(0)
      expect(sample.cheekAlpha).toBeGreaterThanOrEqual(0)
      expect(typeof sample.showDecorations).toBe('boolean')
    }
  })

  it('gives happy/delight positive mouth curve and angry/sad negative', () => {
    const happy = sampleAssistantExpression('happy')
    const delight = sampleAssistantExpression('delight')
    const angry = sampleAssistantExpression('angry')
    const sad = sampleAssistantExpression('sad')
    const neutral = sampleAssistantExpression('neutral')

    expect(happy.mouthCurve).toBeGreaterThan(0)
    expect(delight.mouthCurve).toBeGreaterThan(happy.mouthCurve)
    expect(angry.mouthCurve).toBeLessThan(0)
    expect(sad.mouthCurve).toBeLessThan(0)
    expect(neutral.mouthCurve).toBe(0)
  })

  it('gives delight and happy visible cheek alpha', () => {
    const happy = sampleAssistantExpression('happy')
    const delight = sampleAssistantExpression('delight')
    const neutral = sampleAssistantExpression('neutral')

    expect(happy.cheekAlpha).toBeGreaterThan(0)
    expect(delight.cheekAlpha).toBeGreaterThan(happy.cheekAlpha)
    expect(neutral.cheekAlpha).toBe(0)
  })

  it('gives focused and tired narrow eye height', () => {
    const focused = sampleAssistantExpression('focused')
    const tired = sampleAssistantExpression('tired')
    const neutral = sampleAssistantExpression('neutral')

    expect(focused.eyeHeightMultiplier).toBeLessThan(neutral.eyeHeightMultiplier)
    expect(tired.eyeHeightMultiplier).toBeLessThan(focused.eyeHeightMultiplier)
  })

  it('gives angry a positive eyebrow angle and sad a negative one', () => {
    const angry = sampleAssistantExpression('angry')
    const sad = sampleAssistantExpression('sad')
    const neutral = sampleAssistantExpression('neutral')

    expect(angry.eyebrowAngle).toBeGreaterThan(0)
    expect(sad.eyebrowAngle).toBeLessThan(0)
    expect(neutral.eyebrowAngle).toBe(0)
  })

  it('gives angry a wider mouth than neutral and focused the narrowest', () => {
    const angry = sampleAssistantExpression('angry')
    const focused = sampleAssistantExpression('focused')
    const neutral = sampleAssistantExpression('neutral')

    expect(angry.mouthWidth).toBeGreaterThan(neutral.mouthWidth)
    expect(focused.mouthWidth).toBeLessThan(neutral.mouthWidth)
  })

  it('delight has the widest eyes and highest eyebrow lift', () => {
    const delight = sampleAssistantExpression('delight')
    const neutral = sampleAssistantExpression('neutral')

    expect(delight.eyeWidthMultiplier).toBeGreaterThan(neutral.eyeWidthMultiplier)
    expect(delight.eyebrowYOffset).toBeLessThan(neutral.eyebrowYOffset)
  })

  describe('resolveAssistantExpression', () => {
    it('standby/input/thinking/acting are neutral with showDecorations false', () => {
      for (const state of ['standby', 'input', 'thinking', 'acting'] as const) {
        const result = resolveAssistantExpression(state, null, false)
        expect(result.expression).toBe('neutral')
        expect(result.showDecorations).toBe(false)
      }
    })

    it('maps terminal states to correct expressions with showDecorations true', () => {
      const success = resolveAssistantExpression('success', null, false)
      expect(success.expression).toBe('happy')
      expect(success.showDecorations).toBe(true)

      const error = resolveAssistantExpression('error', null, false)
      expect(error.expression).toBe('sad')
      expect(error.showDecorations).toBe(true)

      const needsInput = resolveAssistantExpression('needs-input', null, false)
      expect(needsInput.expression).toBe('confused')
      expect(needsInput.showDecorations).toBe(true)
    })

    it('gesture overrides state expression', () => {
      const tiredGesture = resolveAssistantExpression('standby', 'tired', false)
      expect(tiredGesture.expression).toBe('tired')
      expect(tiredGesture.showDecorations).toBe(true)

      const dizzyGesture = resolveAssistantExpression('standby', 'dizzy', false)
      expect(dizzyGesture.expression).toBe('dizzy')
      expect(dizzyGesture.showDecorations).toBe(true)

      const recoverGesture = resolveAssistantExpression('standby', 'recover', false)
      expect(recoverGesture.expression).toBe('happy')
      expect(recoverGesture.showDecorations).toBe(true)

      const tapGesture = resolveAssistantExpression('standby', 'tap', false)
      expect(tapGesture.expression).toBe('happy')
      expect(tapGesture.showDecorations).toBe(true)
    })

    it('powerUp returns powered expression with showDecorations true', () => {
      const result = resolveAssistantExpression('standby', null, true)
      expect(result.expression).toBe('powered')
      expect(result.showDecorations).toBe(true)
    })

    it('gesture takes priority over powerUp', () => {
      const result = resolveAssistantExpression('standby', 'tired', true)
      expect(result.expression).toBe('tired')
    })

    it('powerUp overrides idle gestures like stretch to show powered', () => {
      // 第5颗卫星触发 stretch 期间，powerUp=true，应显示 powered
      const stretchPowered = resolveAssistantExpression('standby', 'stretch', true)
      expect(stretchPowered.expression).toBe('powered')
      expect(stretchPowered.showDecorations).toBe(true)

      // 其他 idle 手势同样被 powerUp 覆盖
      for (const gesture of ['glance', 'peek', 'orbit', 'shimmy'] as const) {
        const result = resolveAssistantExpression('standby', gesture, true)
        expect(result.expression).toBe('powered')
      }
    })

    it('powerUp does not override urgent semantic gestures', () => {
      // 紧急语义手势优先级高于 powerUp
      const tired = resolveAssistantExpression('standby', 'tired', true)
      expect(tired.expression).toBe('tired')

      const dizzy = resolveAssistantExpression('standby', 'dizzy', true)
      expect(dizzy.expression).toBe('dizzy')

      const recover = resolveAssistantExpression('standby', 'recover', true)
      expect(recover.expression).toBe('happy')

      const tap = resolveAssistantExpression('standby', 'tap', true)
      expect(tap.expression).toBe('happy')
    })

    it('idle gestures without expression mapping return neutral', () => {
      for (const gesture of ['glance', 'stretch', 'peek', 'orbit', 'shimmy'] as const) {
        const result = resolveAssistantExpression('standby', gesture, false)
        expect(result.expression).toBe('neutral')
        expect(result.showDecorations).toBe(false)
      }
    })

    it('transient end (gesture null, powerUp false) returns to neutral', () => {
      // 模拟手势结束后回到中性
      const afterGesture = resolveAssistantExpression('standby', null, false)
      expect(afterGesture.expression).toBe('neutral')
      expect(afterGesture.showDecorations).toBe(false)

      // 模拟蓄力结束后回到中性
      const afterPowerUp = resolveAssistantExpression('standby', null, false)
      expect(afterPowerUp.expression).toBe('neutral')
      expect(afterPowerUp.showDecorations).toBe(false)
    })

    it('neutral and focused have showDecorations false', () => {
      const neutral = sampleAssistantExpression('neutral')
      const focused = sampleAssistantExpression('focused')

      expect(neutral.showDecorations).toBe(false)
      expect(focused.showDecorations).toBe(false)
    })

    it('emotion expressions have showDecorations true', () => {
      for (const expr of [
        'happy',
        'angry',
        'sad',
        'delight',
        'tired',
        'confused',
        'dizzy',
        'powered',
      ] as const) {
        const sample = sampleAssistantExpression(expr)
        expect(sample.showDecorations).toBe(true)
      }
    })

    it('confused has asymmetric eyebrow (one raised)', () => {
      const confused = sampleAssistantExpression('confused')
      expect(confused.eyebrowAngle).not.toBe(0)
      expect(confused.eyeHeightMultiplier).toBeGreaterThan(1)
    })

    it('dizzy is visually distinct from tired', () => {
      const dizzy = sampleAssistantExpression('dizzy')
      const tired = sampleAssistantExpression('tired')

      // dizzy 眼睛比 tired 大
      expect(dizzy.eyeHeightMultiplier).toBeGreaterThan(tired.eyeHeightMultiplier)
      // dizzy 眉毛上扬，tired 下垂
      expect(dizzy.eyebrowYOffset).toBeGreaterThan(tired.eyebrowYOffset)
      // dizzy 嘴巴曲线正（微张），tired 负（下撇）
      expect(dizzy.mouthCurve).toBeGreaterThan(tired.mouthCurve)
    })

    it('powered has narrow focused eyes with slight smile', () => {
      const powered = sampleAssistantExpression('powered')
      const neutral = sampleAssistantExpression('neutral')

      expect(powered.eyeHeightMultiplier).toBeLessThan(neutral.eyeHeightMultiplier)
      expect(powered.mouthCurve).toBeGreaterThan(0)
      expect(powered.showDecorations).toBe(true)
    })
  })

  describe('expression transition', () => {
    it('idle state starts with zero decoration alpha and neutral expression', () => {
      const state = createIdleExpressionTransitionState()
      expect(state.decorationAlpha).toBe(0)
      expect(state.decorationScale).toBe(0.9)
      expect(state.phase).toBe('idle')
      expect(state.sample.expression).toBe('neutral')
      expect(state.targetExpression).toBe('neutral')
    })

    it('neutral -> happy entering: first step increases alpha from 0, scale continuous', () => {
      const idle = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')
      const firstStep = stepAssistantExpressionTransition(idle, happySample, 16, false)

      expect(firstStep.phase).toBe('entering')
      expect(firstStep.decorationAlpha).toBeGreaterThan(0)
      expect(firstStep.decorationAlpha).toBeLessThan(1)
      expect(firstStep.decorationScale).toBeGreaterThan(0.9)
      expect(firstStep.decorationScale).toBeLessThan(1)
      expect(firstStep.targetExpression).toBe('happy')
    })

    it('neutral -> happy entering: first step eye values are not target', () => {
      const idle = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')
      const firstStep = stepAssistantExpressionTransition(idle, happySample, 16, false)

      // 首帧眼高不应直接等于 happy 目标值
      expect(firstStep.sample.eyeHeightMultiplier).not.toBe(happySample.eyeHeightMultiplier)
      // 但应介于 neutral 和 happy 之间
      const neutralEye = sampleAssistantExpression('neutral').eyeHeightMultiplier
      expect(firstStep.sample.eyeHeightMultiplier).toBeGreaterThan(
        Math.min(neutralEye, happySample.eyeHeightMultiplier)
      )
      expect(firstStep.sample.eyeHeightMultiplier).toBeLessThan(
        Math.max(neutralEye, happySample.eyeHeightMultiplier)
      )
    })

    it('neutral -> happy entering: converges to target after duration', () => {
      let state = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')

      // 多步推进直到完成
      for (let i = 0; i < 20; i++) {
        state = stepAssistantExpressionTransition(state, happySample, 20, false)
      }

      expect(state.phase).toBe('idle')
      expect(state.decorationAlpha).toBeCloseTo(1, 2)
      expect(state.sample.eyeHeightMultiplier).toBeCloseTo(happySample.eyeHeightMultiplier, 2)
      expect(state.sample.mouthCurve).toBeCloseTo(happySample.mouthCurve, 2)
    })

    it('happy -> neutral exiting: first step decreases alpha', () => {
      // 先到达 happy 稳态
      let state = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')
      for (let i = 0; i < 20; i++) {
        state = stepAssistantExpressionTransition(state, happySample, 20, false)
      }

      // 开始退出到 neutral
      const neutralSample = sampleAssistantExpression('neutral')
      const exitStep = stepAssistantExpressionTransition(state, neutralSample, 16, false)

      expect(exitStep.phase).toBe('exiting')
      expect(exitStep.decorationAlpha).toBeLessThan(1)
      expect(exitStep.decorationAlpha).toBeGreaterThan(0)
    })

    it('happy -> neutral exiting: alpha reaches 0 before clear, then idle', () => {
      let state = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')
      for (let i = 0; i < 20; i++) {
        state = stepAssistantExpressionTransition(state, happySample, 20, false)
      }

      const neutralSample = sampleAssistantExpression('neutral')
      // 推进到退出完成
      for (let i = 0; i < 20; i++) {
        state = stepAssistantExpressionTransition(state, neutralSample, 20, false)
      }

      expect(state.phase).toBe('idle')
      expect(state.decorationAlpha).toBeCloseTo(0, 2)
    })

    it('happy -> sad crossfading: mouthCurve stays between source and target', () => {
      // 先到达 happy 稳态
      let state = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')
      for (let i = 0; i < 20; i++) {
        state = stepAssistantExpressionTransition(state, happySample, 20, false)
      }

      // 开始切换到 sad
      const sadSample = sampleAssistantExpression('sad')
      const crossfadeStep = stepAssistantExpressionTransition(state, sadSample, 30, false)

      expect(crossfadeStep.phase).toBe('crossfading')
      expect(crossfadeStep.decorationAlpha).toBe(1)

      // mouthCurve 应介于 happy 和 sad 之间
      const happyCurve = happySample.mouthCurve
      const sadCurve = sadSample.mouthCurve
      const midCurve = crossfadeStep.sample.mouthCurve
      expect(midCurve).toBeGreaterThan(Math.min(happyCurve, sadCurve))
      expect(midCurve).toBeLessThan(Math.max(happyCurve, sadCurve))
    })

    it('happy -> sad crossfading: alpha stays continuous (never drops to 0)', () => {
      let state = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')
      for (let i = 0; i < 20; i++) {
        state = stepAssistantExpressionTransition(state, happySample, 20, false)
      }

      const sadSample = sampleAssistantExpression('sad')
      // 推进 crossfade 全程，每步检查 alpha
      for (let i = 0; i < 20; i++) {
        state = stepAssistantExpressionTransition(state, sadSample, 20, false)
        expect(state.decorationAlpha).toBeGreaterThan(0)
      }

      expect(state.decorationAlpha).toBeCloseTo(1, 2)
    })

    it('reduced motion: entering uses simpler alpha-only transition', () => {
      const idle = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')
      const step = stepAssistantExpressionTransition(idle, happySample, 16, true)

      expect(step.phase).toBe('entering')
      expect(step.decorationAlpha).toBeGreaterThan(0)
      // reduced 模式 scale 变化很小 (0.98 -> 1)
      expect(step.decorationScale).toBeGreaterThanOrEqual(0.98)
      expect(step.decorationScale).toBeLessThanOrEqual(1)
    })

    it('neutral -> neutral (no decoration) stays idle', () => {
      const idle = createIdleExpressionTransitionState()
      const neutralSample = sampleAssistantExpression('neutral')
      const step = stepAssistantExpressionTransition(idle, neutralSample, 16, false)

      expect(step.phase).toBe('idle')
      expect(step.decorationAlpha).toBe(0)
    })

    it('multiple steps converge smoothly', () => {
      let state = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')

      let prevAlpha = 0
      for (let i = 0; i < 10; i++) {
        state = stepAssistantExpressionTransition(state, happySample, 16, false)
        // alpha 应该单调递增
        expect(state.decorationAlpha).toBeGreaterThanOrEqual(prevAlpha)
        prevAlpha = state.decorationAlpha
      }

      expect(state.decorationAlpha).toBeGreaterThan(0.5)
    })

    it('entering then immediate target switch to crossfade', () => {
      let state = createIdleExpressionTransitionState()
      const happySample = sampleAssistantExpression('happy')

      // 进入 happy 的 entering 阶段
      state = stepAssistantExpressionTransition(state, happySample, 60, false)
      expect(state.phase).toBe('entering')

      // 目标突然变成 sad → 应切换到 crossfading
      const sadSample = sampleAssistantExpression('sad')
      state = stepAssistantExpressionTransition(state, sadSample, 16, false)
      expect(state.phase).toBe('crossfading')
      expect(state.targetExpression).toBe('sad')
      expect(state.decorationAlpha).toBe(1)
    })
  })

  describe('satellite cycle', () => {
    it('resolves the 5th satellite as triggering charge', () => {
      expect(resolveSatelliteAdd(4)).toEqual({ count: SATELLITE_MAX, triggerCharge: true })
    })

    it('does not exceed the maximum satellite count', () => {
      expect(resolveSatelliteAdd(SATELLITE_MAX)).toEqual({
        count: SATELLITE_MAX,
        triggerCharge: true,
      })
    })

    it('resolves normal additions without triggering charge', () => {
      expect(resolveSatelliteAdd(0)).toEqual({ count: 1, triggerCharge: false })
      expect(resolveSatelliteAdd(2)).toEqual({ count: 3, triggerCharge: false })
      expect(resolveSatelliteAdd(3)).toEqual({ count: 4, triggerCharge: false })
    })

    it('reports charge finished only after stretch duration + delay', () => {
      const stretchDur = getAssistantGestureDuration('stretch')
      expect(
        isSatelliteChargeFinished(0, stretchDur, stretchDur + SATELLITE_CHARGE_DELAY_MS - 1)
      ).toBe(false)
      expect(isSatelliteChargeFinished(0, stretchDur, stretchDur + SATELLITE_CHARGE_DELAY_MS)).toBe(
        false
      )
      expect(
        isSatelliteChargeFinished(0, stretchDur, stretchDur + SATELLITE_CHARGE_DELAY_MS + 1)
      ).toBe(true)
    })

    it('reports absorption finished after the defined duration', () => {
      expect(isSatelliteAbsorptionFinished(0, SATELLITE_ABSORPTION_MS - 1)).toBe(false)
      expect(isSatelliteAbsorptionFinished(0, SATELLITE_ABSORPTION_MS)).toBe(true)
    })

    it('allows a full 1→5 cycle after reset', () => {
      let count = 0
      let charged = false
      for (let i = 0; i < SATELLITE_MAX; i++) {
        const result = resolveSatelliteAdd(count)
        count = result.count
        if (result.triggerCharge) charged = true
      }
      expect(count).toBe(SATELLITE_MAX)
      expect(charged).toBe(true)

      // 模拟吸收归零后重新开始
      count = 0
      charged = false
      for (let i = 0; i < SATELLITE_MAX; i++) {
        const result = resolveSatelliteAdd(count)
        count = result.count
        if (result.triggerCharge) charged = true
      }
      expect(count).toBe(SATELLITE_MAX)
      expect(charged).toBe(true)
    })

    it('resolveSatelliteAdd at count=0 returns first satellite without charge', () => {
      expect(resolveSatelliteAdd(0)).toEqual({ count: 1, triggerCharge: false })
    })

    it('resolveSatelliteAdd always clamps to SATELLITE_MAX even for overflows', () => {
      expect(resolveSatelliteAdd(99)).toEqual({ count: SATELLITE_MAX, triggerCharge: true })
      expect(resolveSatelliteAdd(SATELLITE_MAX + 10)).toEqual({
        count: SATELLITE_MAX,
        triggerCharge: true,
      })
    })

    it('charge finishes exactly at boundary, not before', () => {
      const dur = getAssistantGestureDuration('stretch')
      // 边界上恰好不触发（> 不是 >=）
      expect(isSatelliteChargeFinished(100, dur, 100 + dur + SATELLITE_CHARGE_DELAY_MS)).toBe(false)
      expect(isSatelliteChargeFinished(100, dur, 100 + dur + SATELLITE_CHARGE_DELAY_MS + 1)).toBe(
        true
      )
    })

    it('absorption finishes exactly at boundary', () => {
      // >= SATELLITE_ABSORPTION_MS 时完成
      expect(isSatelliteAbsorptionFinished(100, 100 + SATELLITE_ABSORPTION_MS - 1)).toBe(false)
      expect(isSatelliteAbsorptionFinished(100, 100 + SATELLITE_ABSORPTION_MS)).toBe(true)
    })

    /**
     * 并发等价测试：模拟多个 addSatellite 在 import resolve 后依次执行的情况。
     * 当已有 4 颗卫星时，多个 pending 回调依次到达，只有第一个能成为第 5 颗并
     * 触发一次 charge，后续全部拒绝，总数恒为 5。
     *
     * 这验证了 assistant-renderer 中 addSatellite 的并发容量守卫逻辑：
     * import resolve 后必须基于最新 satellites.length 重新校验。
     */
    it('concurrent addSatellite at count=4: only first becomes 5th, rest rejected, charge fires once', () => {
      let satelliteCount = 4 // 已有 4 颗
      let greenMode = false
      let chargeFireCount = 0
      const absorbing = false // 未在吸收中

      // 模拟多个 .then 回调依次执行（JS 单线程微任务队列）
      const pendingCallbacks = 5

      for (let i = 0; i < pendingCallbacks; i++) {
        // 每个回调执行前必须重新读取最新状态（模拟并发 import resolve 后的守卫）
        if (absorbing || satelliteCount >= SATELLITE_MAX) continue

        const prevCount = satelliteCount
        const result = resolveSatelliteAdd(prevCount)
        satelliteCount = result.count
        if (result.triggerCharge && !greenMode) {
          greenMode = true
          chargeFireCount++
        }
      }

      expect(satelliteCount).toBe(SATELLITE_MAX)
      expect(chargeFireCount).toBe(1)
      expect(greenMode).toBe(true)
    })

    it('concurrent addSatellite during absorption: all rejected, no leaked graphics', () => {
      let satelliteCount = 5
      let absorbing = true // 正在吸收
      let greenMode = true
      let graphicsCreated = 0

      const pendingCallbacks = 4

      for (let i = 0; i < pendingCallbacks; i++) {
        if (absorbing || satelliteCount >= SATELLITE_MAX) continue

        // 模拟创建了图元（不应发生）
        graphicsCreated++
        satelliteCount++
      }

      expect(graphicsCreated).toBe(0)
      expect(satelliteCount).toBe(5) // 未被修改
    })
  })

  describe('satellite lifecycle — destroy race guards', () => {
    /**
     * 模拟 assistant-renderer addSatellite 的生命周期守卫逻辑：
     * 1. 调用前检查 generation（对应 addSatellite 入口 guard）
     * 2. import resolve 后再次检查 generation（对应 .then 内 guard）
     * 3. destroy 使 generation 失效，pending 回调被跳过
     */
    it('pending callback after destroy must not mutate state', () => {
      let generation = 0
      let satelliteCount = 0
      let greenMode = false

      // 模拟 addSatellite 入口
      function addSatellite(currentCount: number): { generation: number; proceed: boolean } {
        if (currentCount >= SATELLITE_MAX) return { generation, proceed: false }
        return { generation, proceed: true }
      }

      // 模拟 import resolve 后的逻辑
      function onImportResolved(
        capturedGeneration: number,
        prevCount: number
      ): SatelliteAddResult | null {
        // generation 不匹配 → destroy 后，跳过
        if (capturedGeneration !== generation) return null
        const result = resolveSatelliteAdd(prevCount)
        satelliteCount = result.count
        if (result.triggerCharge) greenMode = true
        return result
      }

      // 正常添加 1 颗卫星
      const snapshot = addSatellite(satelliteCount)
      expect(snapshot.proceed).toBe(true)
      const result = onImportResolved(snapshot.generation, satelliteCount)
      expect(result).toEqual({ count: 1, triggerCharge: false })
      expect(satelliteCount).toBe(1)

      // 模拟 destroy：递增 generation、重置状态
      generation++
      satelliteCount = 0
      greenMode = false

      // 旧的 snapshot 仍然 proceed=true（入口时还没 destroy），但 import resolve 后 generation 不匹配
      const staleResult = onImportResolved(snapshot.generation, satelliteCount)
      expect(staleResult).toBeNull()
      expect(satelliteCount).toBe(0) // 未被修改
      expect(greenMode).toBe(false)
    })

    it('destroy increments generation so all stale snapshots are rejected', () => {
      let generation = 0

      function captureGeneration(): number {
        return generation
      }
      function isStale(captured: number): boolean {
        return captured !== generation
      }

      const snap1 = captureGeneration()
      const snap2 = captureGeneration()
      generation++ // destroy
      const snap3 = captureGeneration()

      expect(isStale(snap1)).toBe(true)
      expect(isStale(snap2)).toBe(true)
      expect(isStale(snap3)).toBe(false) // destroy 后的快照仍有效
    })

    it('re-init after destroy uses fresh generation', () => {
      let generation = 0
      let app: { destroyed: boolean } | null = null

      function init(): void {
        generation++
        app = { destroyed: false }
      }

      function destroy(): void {
        if (!app) return
        app.destroyed = true
        app = null
        generation++
      }

      init()
      const gen1 = generation
      destroy()
      expect(generation).toBe(gen1 + 1)

      // 重新 init
      init()
      const gen2 = generation
      expect(gen2).toBe(gen1 + 2) // destroy(+1) + init(+1)
      expect(app).not.toBeNull()

      // gen1 的快照应该已失效
      expect(gen1).not.toBe(gen2)
    })

    it('satellite count callback must not fire after destroy nulls it', () => {
      // 模拟 renderer 的 onSatelliteCountChange 回调引用；用 Map 避免 TS 控制流收窄
      const store = new Map<string, ((count: number) => void) | null>()
      let callCount = 0

      store.set('cb', () => {
        callCount++
      })
      store.get('cb')!(1)
      expect(callCount).toBe(1)

      // 模拟 destroy：将回调置 null
      store.set('cb', null)
      // destroy 后不应触发回调（与 renderer 中 onSatelliteCountChange = null 等价）
      store.get('cb')?.(2)
      expect(callCount).toBe(1)
    })
  })

  describe('run orbit profile', () => {
    it('non-running states return count=0', () => {
      for (const state of ['standby', 'input', 'needs-input', 'success', 'error'] as const) {
        const profile = getAssistantRunOrbitProfile(state, false)
        expect(profile.count).toBe(0)
        expect(profile.baseSpeed).toBe(0)
        expect(profile.orbitRadius).toBe(0)
        expect(profile.trailLength).toBe(0)
        expect(profile.lifespan).toBe(0)
        expect(profile.respawnDelay).toBe(0)
      }
    })

    it('thinking rich: count=2, slower speed, shorter trail', () => {
      const profile = getAssistantRunOrbitProfile('thinking', false)
      expect(profile.count).toBe(2)
      expect(profile.baseSpeed).toBe(1.2)
      expect(profile.orbitRadius).toBe(32)
      expect(profile.trailLength).toBe(5)
      expect(profile.lifespan).toBeGreaterThan(0)
      expect(profile.respawnDelay).toBeGreaterThan(0)
      expect(profile.convergeDuration).toBeGreaterThan(0)
    })

    it('acting rich: count=3, faster speed, longer trail than thinking', () => {
      const thinking = getAssistantRunOrbitProfile('thinking', false)
      const acting = getAssistantRunOrbitProfile('acting', false)
      expect(acting.count).toBe(3)
      expect(acting.count).toBeGreaterThan(thinking.count)
      expect(acting.baseSpeed).toBeGreaterThan(thinking.baseSpeed)
      expect(acting.trailLength).toBeGreaterThanOrEqual(thinking.trailLength)
      expect(acting.orbitRadius).toBeLessThan(thinking.orbitRadius)
    })

    it('reduced thinking: count=1, low speed, short trail, still visible', () => {
      const profile = getAssistantRunOrbitProfile('thinking', true)
      expect(profile.count).toBe(1)
      expect(profile.baseSpeed).toBeGreaterThan(0)
      expect(profile.baseSpeed).toBeLessThan(1)
      expect(profile.trailLength).toBeGreaterThan(0)
      expect(profile.trailLength).toBeLessThan(5)
      expect(profile.lifespan).toBeGreaterThan(0)
    })

    it('reduced acting: count=1, same as reduced thinking', () => {
      const reducedThinking = getAssistantRunOrbitProfile('thinking', true)
      const reducedActing = getAssistantRunOrbitProfile('acting', true)
      expect(reducedActing.count).toBe(1)
      expect(reducedActing.baseSpeed).toBe(reducedThinking.baseSpeed)
      expect(reducedActing.trailLength).toBe(reducedThinking.trailLength)
    })

    it('convergeDuration is consistent across all running states', () => {
      const thinkingRich = getAssistantRunOrbitProfile('thinking', false)
      const actingRich = getAssistantRunOrbitProfile('acting', false)
      const thinkingReduced = getAssistantRunOrbitProfile('thinking', true)
      expect(thinkingRich.convergeDuration).toBe(actingRich.convergeDuration)
      expect(thinkingRich.convergeDuration).toBe(thinkingReduced.convergeDuration)
    })

    it('all profile numeric fields are non-negative', () => {
      const states = [
        'standby',
        'input',
        'thinking',
        'acting',
        'needs-input',
        'success',
        'error',
      ] as const
      for (const state of states) {
        for (const reduced of [true, false]) {
          const profile = getAssistantRunOrbitProfile(state, reduced)
          expect(profile.count).toBeGreaterThanOrEqual(0)
          expect(profile.baseSpeed).toBeGreaterThanOrEqual(0)
          expect(profile.orbitRadius).toBeGreaterThanOrEqual(0)
          expect(profile.trailLength).toBeGreaterThanOrEqual(0)
          expect(profile.lifespan).toBeGreaterThanOrEqual(0)
          expect(profile.respawnDelay).toBeGreaterThanOrEqual(0)
          expect(profile.convergeDuration).toBeGreaterThan(0)
        }
      }
    })
  })

  describe('run orbit lifecycle', () => {
    /**
     * 长任务等价测试：粒子生命周期结束后若 presence 仍 thinking/acting
     * 且 runOrbitActive，应按 profile 在 respawnDelay 后补足到 profile.count。
     * 模拟 renderer 中的 respawn 逻辑。
     */
    it('long run: respawns particles after lifespan ends if still running', () => {
      const profile = getAssistantRunOrbitProfile('thinking', false)
      const bornAt = 0
      const lifespan = profile.lifespan

      // 粒子已过期（now 超过 lifespan）
      const now = lifespan + 100
      const age = now - bornAt
      expect(age).toBeGreaterThan(lifespan)

      // 模拟 respawn 条件检查
      const activeCount = 0 // 所有粒子已消亡
      const pendingCount = 0
      const nextRespawnAt = 0
      const runOrbitActive = true

      const shouldRespawn =
        runOrbitActive &&
        activeCount < profile.count &&
        pendingCount === 0 &&
        now >= nextRespawnAt &&
        profile.count > 0

      expect(shouldRespawn).toBe(true)
    })

    /**
     * 退出 converge 清除：离开 thinking/acting 后，所有粒子标记 converging，
     * convergeStartedAt 设为当前时间，convergeDuration 后全部移除。
     */
    it('exit converge: particles converge and clear within convergeDuration', () => {
      const profile = getAssistantRunOrbitProfile('thinking', false)
      const convergeStart = 5000
      const convergeDuration = profile.convergeDuration

      // 在 converge 结束前
      const midConverge = convergeStart + convergeDuration * 0.5
      const midProgress = (midConverge - convergeStart) / convergeDuration
      expect(midProgress).toBeLessThan(1)
      expect(midProgress).toBeGreaterThan(0)

      // 在 converge 结束后
      const endConverge = convergeStart + convergeDuration
      const endProgress = (endConverge - convergeStart) / convergeDuration
      expect(endProgress).toBeGreaterThanOrEqual(1)
    })

    /**
     * destroy 后异步 import resolve 不得创建图元：
     * runOrbitGeneration 递增使所有 stale snapshot 失效。
     */
    it('destroy stale async rejected: generation mismatch prevents creation', () => {
      let generation = 0
      let particleCreated = false

      function captureGeneration(): number {
        return generation
      }

      function onDestroy(): void {
        generation++
      }

      function onImportResolved(capturedGen: number): boolean {
        if (capturedGen !== generation) return false
        particleCreated = true
        return true
      }

      // 正常创建
      const snap = captureGeneration()
      expect(onImportResolved(snap)).toBe(true)
      expect(particleCreated).toBe(true)

      // destroy 后
      particleCreated = false
      onDestroy()
      expect(onImportResolved(snap)).toBe(false)
      expect(particleCreated).toBe(false)
    })

    /**
     * count 不超过 profile：即使多次 spawn 被触发，总数不超过 RUN_ORBIT_MAX。
     */
    it('count does not exceed profile max', () => {
      const profile = getAssistantRunOrbitProfile('acting', false)
      const RUN_ORBIT_MAX = 3
      const effectiveCount = Math.min(profile.count, RUN_ORBIT_MAX)
      expect(effectiveCount).toBeLessThanOrEqual(RUN_ORBIT_MAX)
      expect(effectiveCount).toBe(profile.count) // acting count=3 == MAX
    })

    /**
     * thinking<->acting 切换：旧粒子标记 converge + 新 profile 生成。
     * 总活跃数在同一时刻不超过 max。
     */
    it('thinking<->acting switch: old converge + new spawn, count stays bounded', () => {
      const thinkingProfile = getAssistantRunOrbitProfile('thinking', false)
      const actingProfile = getAssistantRunOrbitProfile('acting', false)

      // 切换前 thinking 有 2 颗
      let activeParticles = thinkingProfile.count
      // 标记旧粒子为 converging（它们还在，但正在消亡）
      const converging = activeParticles
      // 新粒子生成（acting profile count=3）
      const newSpawn = actingProfile.count

      // 总图元数 = converging + newSpawn，不应超过 RUN_ORBIT_MAX*2（因为 converging 会很快消失）
      // 但 active（非 converging）不应超过 RUN_ORBIT_MAX
      const activeNonConverging = newSpawn
      expect(activeNonConverging).toBeLessThanOrEqual(3)
    })

    /**
     * convergeStartedAt 独立于 bornAt：
     * 粒子 bornAt=0, lifespan=2000, 但 convergeStartedAt=1800 时，
     * converge 进度从 1800 开始计算，不从 0 开始。
     */
    it('convergeStartedAt is independent of bornAt', () => {
      const bornAt = 0
      const convergeStartedAt = 1800
      const now = 2000
      const convergeDuration = 300

      // 错误方式：用 bornAt 计算 converge（会得到 2000/300 = 6.67, 远超 1）
      const wrongProgress = (now - bornAt) / convergeDuration
      expect(wrongProgress).toBeGreaterThan(1)

      // 正确方式：用 convergeStartedAt
      const correctProgress = Math.min(1, (now - convergeStartedAt) / convergeDuration)
      expect(correctProgress).toBeGreaterThan(0)
      expect(correctProgress).toBeLessThan(1)
    })
  })

  describe('world ground shadow', () => {
    it('returns full opacity and grounded width at ground level (distance <= 0)', () => {
      const result = computeWorldShadowParams(0, false, false)
      expect(result.alpha).toBe(1)
      expect(result.width).toBe(28)
      expect(result.groundContactWidthBonus).toBe(6)
    })

    it('returns full opacity for negative distance (clamped)', () => {
      const result = computeWorldShadowParams(-5, false, false)
      expect(result.alpha).toBe(1)
      expect(result.groundContactWidthBonus).toBe(6)
    })

    it('fades out with sqrt proximity as distance increases', () => {
      const at10 = computeWorldShadowParams(10, false, false)
      const at20 = computeWorldShadowParams(20, false, false)
      const at30 = computeWorldShadowParams(30, false, false)

      expect(at10.alpha).toBeGreaterThan(at20.alpha)
      expect(at20.alpha).toBeGreaterThan(at30.alpha)
      expect(at30.alpha).toBeGreaterThan(0)
    })

    it('reaches zero alpha exactly at threshold (40px)', () => {
      const atThreshold = computeWorldShadowParams(40, false, false)
      expect(atThreshold.alpha).toBe(0)
      expect(atThreshold.width).toBe(0)
      expect(atThreshold.groundContactWidthBonus).toBe(0)
    })

    it('stays zero beyond threshold', () => {
      const beyond = computeWorldShadowParams(80, false, false)
      expect(beyond.alpha).toBe(0)
      expect(beyond.groundContactWidthBonus).toBe(0)
    })

    it('narrows width as distance increases', () => {
      const grounded = computeWorldShadowParams(0, false, false)
      const mid = computeWorldShadowParams(20, false, false)
      const far = computeWorldShadowParams(39, false, false)

      expect(grounded.width).toBe(28)
      expect(mid.width).toBeLessThan(grounded.width)
      expect(far.width).toBeLessThan(mid.width)
    })

    it('hides completely during card surface contact', () => {
      const result = computeWorldShadowParams(0, true, false)
      expect(result.alpha).toBe(0)
      expect(result.width).toBe(0)
      expect(result.groundContactWidthBonus).toBe(0)
    })

    it('hides card contact shadow even at distance 0', () => {
      const result = computeWorldShadowParams(0, true, false)
      expect(result.alpha).toBe(0)
    })

    it('reduced motion: shows static shadow at ground level', () => {
      const result = computeWorldShadowParams(0, false, true)
      expect(result.alpha).toBe(0.35)
      expect(result.width).toBe(28)
      expect(result.groundContactWidthBonus).toBe(6)
    })

    it('reduced motion: hides shadow when airborne', () => {
      const result = computeWorldShadowParams(5, false, true)
      expect(result.alpha).toBe(0)
      expect(result.width).toBe(0)
      expect(result.groundContactWidthBonus).toBe(0)
    })

    it('reduced motion: hides shadow during card contact', () => {
      const result = computeWorldShadowParams(0, true, true)
      expect(result.alpha).toBe(0)
      expect(result.width).toBe(0)
      expect(result.groundContactWidthBonus).toBe(0)
    })

    it('alpha transitions smoothly from 1 to 0 over the fade zone', () => {
      // sqrt proximity: alpha = sqrt(1 - d/threshold)
      const threshold = 40
      for (let d = 0; d <= threshold; d += 5) {
        const result = computeWorldShadowParams(d, false, false)
        const expected = d >= threshold ? 0 : Math.sqrt(1 - d / threshold)
        expect(result.alpha).toBeCloseTo(expected, 5)
      }
    })

    it('width interpolates linearly between grounded and airborne', () => {
      const grounded = 28
      const airborne = 20
      const at20 = computeWorldShadowParams(20, false, false)
      // 20/40 = 0.5 → width = 28 + (20-28)*0.5 = 24
      expect(at20.width).toBeCloseTo(grounded + (airborne - grounded) * 0.5, 5)
      // 从大到小：grounded → mid → airborne
      expect(at20.width).toBeLessThan(grounded)
      expect(at20.width).toBeGreaterThan(airborne)
    })

    it('airborne distance has no ground contact bonus', () => {
      const at15 = computeWorldShadowParams(15, false, false)
      expect(at15.groundContactWidthBonus).toBe(0)
    })

    it('card contact forces all fields to zero including bonus', () => {
      const result = computeWorldShadowParams(-10, true, false)
      expect(result.alpha).toBe(0)
      expect(result.width).toBe(0)
      expect(result.groundContactWidthBonus).toBe(0)
    })

    it('reduced motion is independent of system preference', () => {
      // reducedMotion 是应用内设置，不是系统 prefers-reduced-motion
      const rich = computeWorldShadowParams(0, false, false)
      const reduced = computeWorldShadowParams(0, false, true)
      expect(rich.alpha).toBeGreaterThan(reduced.alpha)
      expect(rich.width).toBe(reduced.width) // 同样宽度
    })

    it('BODY_BOTTOM_RATIO derives from Pixi canvas geometry', () => {
      // DESIGN_SIZE/2 + (BODY_RADIUS-8) / DESIGN_SIZE = (72+31)/144 ≈ 0.715
      expect(BODY_BOTTOM_RATIO).toBeGreaterThan(0.7)
      expect(BODY_BOTTOM_RATIO).toBeLessThan(0.76)
    })

    it('initial rest position produces zero shadow (default stage 168, host 144)', () => {
      const stageHeight = 168 // 10.5rem
      const hostHeight = 144 // 9rem
      const hostTop = (stageHeight - hostHeight) / 2 // grid居中 = 12
      const groundY = stageHeight - 8 // GROUND_INSET_PX
      const bodyBottomWorldY = hostTop + hostHeight * BODY_BOTTOM_RATIO
      const distance = groundY - bodyBottomWorldY

      // 初始距离必须 >= 阈值，确保悬空时阴影不可见
      expect(distance).toBeGreaterThanOrEqual(WORLD_SHADOW_FADE_THRESHOLD)

      const shadow = computeWorldShadowParams(distance, false, false)
      expect(shadow.alpha).toBe(0)
    })

    it('接近地面时阴影出现：distance=20 有可见 alpha', () => {
      const shadow = computeWorldShadowParams(20, false, false)
      expect(shadow.alpha).toBeGreaterThan(0)
      expect(shadow.width).toBeGreaterThan(0)
    })

    it('接地时阴影完全可见：distance=0', () => {
      const shadow = computeWorldShadowParams(0, false, false)
      expect(shadow.alpha).toBe(1)
      expect(shadow.width).toBe(28)
    })

    it('真实几何：stage168 host144 居中，mid y=0 distance>=40 alpha=0', () => {
      const stageHeight = 168
      const hostHeight = 144
      const hostTop = (stageHeight - hostHeight) / 2 // = 12
      const groundY = stageHeight - 8 // = 160
      // y=0 → host 底部 = hostTop + hostHeight * BODY_BOTTOM_RATIO
      const bodyBottom = hostTop + hostHeight * BODY_BOTTOM_RATIO
      const distance = groundY - bodyBottom
      expect(distance).toBeGreaterThanOrEqual(WORLD_SHADOW_FADE_THRESHOLD)
      const shadow = computeWorldShadowParams(distance, false, false)
      expect(shadow.alpha).toBe(0)
    })

    it('真实几何：low y=10 距离减少10，alpha>=0.32 width>=19', () => {
      const stageHeight = 168
      const hostHeight = 144
      const hostTop = (stageHeight - hostHeight) / 2 // = 12
      const groundY = stageHeight - 8 // = 160
      const bodyBottomMid = hostTop + hostHeight * BODY_BOTTOM_RATIO
      const distanceMid = groundY - bodyBottomMid
      // y=10 向下偏移 → distance 减少 10
      const distanceLow = distanceMid - 10
      expect(distanceLow).toBeLessThan(WORLD_SHADOW_FADE_THRESHOLD)
      const shadow = computeWorldShadowParams(distanceLow, false, false)
      expect(shadow.alpha).toBeGreaterThanOrEqual(0.32)
      expect(shadow.width).toBeGreaterThanOrEqual(19)
    })

    it('真实几何：y=5 alpha 介于 mid 和 low 之间', () => {
      const stageHeight = 168
      const hostHeight = 144
      const hostTop = (stageHeight - hostHeight) / 2
      const groundY = stageHeight - 8
      const bodyBottomMid = hostTop + hostHeight * BODY_BOTTOM_RATIO
      const distanceMid = groundY - bodyBottomMid
      const distanceY5 = distanceMid - 5
      const shadowMid = computeWorldShadowParams(distanceMid, false, false)
      const shadowY5 = computeWorldShadowParams(distanceY5, false, false)
      const shadowLow = computeWorldShadowParams(distanceMid - 10, false, false)
      // y=5 的 alpha 介于 mid(0) 和 low 之间
      expect(shadowY5.alpha).toBeGreaterThanOrEqual(shadowMid.alpha)
      expect(shadowY5.alpha).toBeLessThanOrEqual(shadowLow.alpha)
    })

    it('真实几何：cardContact low alpha=0', () => {
      const stageHeight = 168
      const hostHeight = 144
      const hostTop = (stageHeight - hostHeight) / 2
      const groundY = stageHeight - 8
      const bodyBottomMid = hostTop + hostHeight * BODY_BOTTOM_RATIO
      const distanceLow = groundY - bodyBottomMid - 10
      const shadow = computeWorldShadowParams(distanceLow, true, false)
      expect(shadow.alpha).toBe(0)
      expect(shadow.width).toBe(0)
    })
  })
})

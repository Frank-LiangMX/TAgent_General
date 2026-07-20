import { describe, expect, it } from 'vitest'

import {
  ASSISTANT_APPEARANCE,
  ASSISTANT_REACTION_DURATION_MS,
  clamp,
  damp,
  resolveAssistantPresenceState,
  sampleAssistantMotion,
  sampleAssistantReaction,
  sampleAssistantState,
} from './assistant-motion'
import {
  ASSISTANT_PIXI_FILTERS_ENABLED,
  ASSISTANT_VIEWPORT_PADDING,
  fitAssistantCanvasToHost,
} from './assistant-renderer'
import { normalizeAssistantPresenceStyle } from '../../../../types'

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

  it('keeps quiet internal motion without spatial movement for reduced motion', () => {
    const sample = sampleAssistantMotion(1234, 2, -2, true)
    expect(sample.bodyX).toBe(0)
    expect(sample.bodyY).toBe(0)
    expect(sample.breathScale).toBe(1)
    expect(sample.corePulse).not.toBe(0.95)
    expect(sample.floatY).toBe(0)
    expect(sample.flowRotation).not.toBe(0)
    expect(sample.gazeX).toBe(0)
    expect(sample.gazeY).toBe(0)
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
})

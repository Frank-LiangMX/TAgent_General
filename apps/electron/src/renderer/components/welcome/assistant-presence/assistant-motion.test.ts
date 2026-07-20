import { describe, expect, it } from 'vitest'

import { ASSISTANT_APPEARANCE, clamp, damp, sampleAssistantMotion } from './assistant-motion'
import { ASSISTANT_VIEWPORT_PADDING } from './assistant-renderer'

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
    expect(sample.bodyX).toBe(1.8)
    expect(sample.bodyY).toBe(-1.2)
    expect(sample.breathScale).toBe(1)
    expect(sample.corePulse).not.toBe(0.95)
    expect(sample.floatY).toBe(0)
    expect(sample.flowRotation).not.toBe(0)
    expect(sample.gazeX).toBe(4.8)
    expect(sample.gazeY).toBe(-3.2)
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

  it('reserves enough viewport padding for glow and orbiting particles', () => {
    expect(ASSISTANT_VIEWPORT_PADDING).toBeGreaterThanOrEqual(32)
  })
})

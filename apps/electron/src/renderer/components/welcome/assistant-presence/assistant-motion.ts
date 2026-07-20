export type AssistantPresenceTheme = 'light' | 'dark'

export interface AssistantAppearance {
  bodyAlpha: number
  coreAlpha: number
  glowAlpha: number
  membraneAlpha: number
  particleAlpha: number
  rimAlpha: number
  ribbonAlpha: number
  specularAlpha: number
}

export interface AssistantMotionSample {
  bodyX: number
  bodyY: number
  breathScale: number
  corePulse: number
  floatY: number
  flowRotation: number
  gazeX: number
  gazeY: number
  glossPhase: number
  particlePhase: number
  tilt: number
  ribbonPhase: number
}

export const ASSISTANT_APPEARANCE: Record<AssistantPresenceTheme, AssistantAppearance> = {
  light: {
    bodyAlpha: 0.12,
    coreAlpha: 0.18,
    glowAlpha: 0.12,
    membraneAlpha: 0.22,
    particleAlpha: 0.42,
    rimAlpha: 0.42,
    ribbonAlpha: 0.26,
    specularAlpha: 0.46,
  },
  dark: {
    bodyAlpha: 0.2,
    coreAlpha: 0.3,
    glowAlpha: 0.2,
    membraneAlpha: 0.34,
    particleAlpha: 0.62,
    rimAlpha: 0.64,
    ribbonAlpha: 0.4,
    specularAlpha: 0.72,
  },
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function damp(current: number, target: number, smoothing: number, deltaMs: number): number {
  if (deltaMs <= 0) return current
  const factor = 1 - Math.exp((-smoothing * deltaMs) / 1000)
  return current + (target - current) * factor
}

export function sampleAssistantMotion(
  elapsedMs: number,
  pointerX: number,
  pointerY: number,
  reducedMotion: boolean
): AssistantMotionSample {
  const x = clamp(pointerX, -1, 1)
  const y = clamp(pointerY, -1, 1)

  if (reducedMotion) {
    const quietPhase = elapsedMs / 12000

    return {
      bodyX: x * 1.8,
      bodyY: y * 1.2,
      breathScale: 1,
      corePulse: 0.95 + Math.sin(quietPhase * Math.PI * 2) * 0.025,
      floatY: 0,
      flowRotation: Math.sin(quietPhase * Math.PI * 2) * 0.035,
      gazeX: x * 4.8,
      gazeY: y * 3.2,
      glossPhase: 0.72,
      particlePhase: 0,
      tilt: 0,
      ribbonPhase: quietPhase * Math.PI * 2,
    }
  }

  const slowPhase = elapsedMs / 2600
  const flowPhase = elapsedMs / 3600

  return {
    bodyX: x * 5.8,
    bodyY: y * 3.8,
    breathScale: 1 + Math.sin(slowPhase * Math.PI * 2) * 0.024,
    corePulse: 0.9 + (Math.sin((slowPhase + 0.1) * Math.PI * 2) + 1) * 0.08,
    floatY: Math.sin((slowPhase + 0.18) * Math.PI * 2) * 3.2,
    flowRotation: Math.sin(flowPhase * Math.PI * 2) * 0.14,
    gazeX: x * 8.4,
    gazeY: y * 5.8,
    glossPhase: (elapsedMs / 5200) * Math.PI * 2,
    particlePhase: elapsedMs / 1000,
    tilt: x * 0.085,
    ribbonPhase: flowPhase * Math.PI * 2,
  }
}

export type AssistantPresenceTheme = 'light' | 'dark'

export type AssistantPresenceState =
  | 'standby'
  | 'input'
  | 'thinking'
  | 'acting'
  | 'needs-input'
  | 'success'
  | 'error'

export type AssistantPresenceAccent = 'primary' | 'warm' | 'danger'

export type AssistantGesture =
  | 'tap'
  | 'nod'
  | 'boop'
  | 'wobble'
  | 'startle'
  | 'dizzy'
  | 'tired'
  | 'recover'
  | 'glance'
  | 'stretch'
  | 'peek'
  | 'doze'
  | 'orbit'
  | 'shimmy'

export const ASSISTANT_IDLE_GESTURES: readonly AssistantGesture[] = [
  'glance',
  'stretch',
  'peek',
  'doze',
  'orbit',
  'shimmy',
]

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

export interface AssistantTravelDeformationSample {
  active: boolean
  axisAngle: number
  scaleAcross: number
  scaleAlong: number
  strain: number
}

export interface AssistantSlimeRestSample {
  breath: number
  lateral: number
}

export interface AssistantReactionSample {
  active: boolean
  eyeScaleY: number
  glowBoost: number
  hopY: number
  particleBurst: number
  progress: number
  ringAlpha: number
  scaleX: number
  scaleY: number
}

export interface AssistantGestureSample extends AssistantReactionSample {
  bodyX: number
  gazeX: number
  gazeY: number
  rotation: number
  verticalOffset: number
}

export interface AssistantStateSample {
  accent: AssistantPresenceAccent
  eyeScaleY: number
  gazeXOffset: number
  gazeYOffset: number
  glowMultiplier: number
  opacity: number
  particleAlphaMultiplier: number
  particleSpeedMultiplier: number
  ringAlpha: number
  ringRadius: number
  rotationOffset: number
  scaleX: number
  scaleY: number
  timeScale: number
  verticalOffset: number
}

export interface AssistantStateInput {
  acting: boolean
  completed: boolean
  engaged: boolean
  hasError: boolean
  needsInput: boolean
  running: boolean
}

export const ASSISTANT_REACTION_DURATION_MS = 520

export const ASSISTANT_APPEARANCE: Record<AssistantPresenceTheme, AssistantAppearance> = {
  light: {
    bodyAlpha: 0.14,
    coreAlpha: 0.16,
    glowAlpha: 0.13,
    membraneAlpha: 0.3,
    particleAlpha: 0.46,
    rimAlpha: 0.5,
    ribbonAlpha: 0.24,
    specularAlpha: 0.58,
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

/**
 * 将会话信号压缩成角色唯一状态。优先级在这里集中维护，避免不同入口
 * 各自判断后出现同一时刻既“完成”又“报错”的视觉冲突。
 */
export function resolveAssistantPresenceState(input: AssistantStateInput): AssistantPresenceState {
  if (input.hasError) return 'error'
  if (input.needsInput) return 'needs-input'
  if (input.running) return input.acting ? 'acting' : 'thinking'
  if (input.completed) return 'success'
  if (input.engaged) return 'input'
  return 'standby'
}

/** 角色各状态的连续视觉参数；空间运动关闭时仍保留静态色彩差异。 */
export function sampleAssistantState(
  state: AssistantPresenceState,
  elapsedMs: number,
  reducedMotion: boolean
): AssistantStateSample {
  const phase = reducedMotion ? 0.5 : (Math.sin(elapsedMs / 360) + 1) / 2
  const wave = reducedMotion ? 0 : Math.sin(elapsedMs / 280)
  const slowWave = reducedMotion ? 0 : Math.sin(elapsedMs / 620)
  const spatial = reducedMotion ? 0 : 1
  const transient = reducedMotion ? 0.55 : Math.max(0, 1 - elapsedMs / 1400)

  switch (state) {
    case 'input':
      return {
        accent: 'primary',
        eyeScaleY: 1,
        gazeXOffset: 0,
        gazeYOffset: 2 * spatial,
        glowMultiplier: 1.12,
        opacity: 1,
        particleAlphaMultiplier: 0.72,
        particleSpeedMultiplier: 0.78,
        ringAlpha: 0,
        ringRadius: 0,
        rotationOffset: 0.018 * spatial,
        scaleX: 1,
        scaleY: 1,
        timeScale: 0.82,
        verticalOffset: 1.2 * spatial,
      }
    case 'thinking':
      return {
        accent: 'primary',
        eyeScaleY: 0.94,
        gazeXOffset: slowWave * 1.6,
        gazeYOffset: -0.8 * spatial + wave * 0.35,
        glowMultiplier: 1.16 + phase * 0.1,
        opacity: 1,
        particleAlphaMultiplier: 1.05,
        particleSpeedMultiplier: 1.35,
        ringAlpha: 0.08 + phase * 0.1,
        ringRadius: 2 + phase * 2,
        rotationOffset: slowWave * 0.026,
        scaleX: 1 - slowWave * 0.012,
        scaleY: 1 + slowWave * 0.018,
        timeScale: 1.32,
        verticalOffset: 0,
      }
    case 'acting':
      return {
        accent: 'primary',
        eyeScaleY: 0.9,
        gazeXOffset: wave * 2.6,
        gazeYOffset: -1.2 * spatial,
        glowMultiplier: 1.25 + phase * 0.14,
        opacity: 1,
        particleAlphaMultiplier: 1.28,
        particleSpeedMultiplier: 1.85,
        ringAlpha: 0.16 + phase * 0.12,
        ringRadius: 4 + phase * 3,
        rotationOffset: wave * 0.055,
        scaleX: 1 + wave * 0.026,
        scaleY: 1 - wave * 0.02,
        timeScale: 1.75,
        verticalOffset: (-0.8 - phase * 0.7) * spatial,
      }
    case 'needs-input':
      return {
        accent: 'warm',
        eyeScaleY: 1.08,
        gazeXOffset: 0,
        gazeYOffset: -2.2 * spatial,
        glowMultiplier: 1.18 + phase * 0.12,
        opacity: 1,
        particleAlphaMultiplier: 0.82,
        particleSpeedMultiplier: 0.62,
        ringAlpha: 0.25 + phase * 0.24,
        ringRadius: 3 + phase * 4,
        rotationOffset: slowWave * 0.018,
        scaleX: 1 - phase * 0.015 * spatial,
        scaleY: 1 + phase * 0.04 * spatial,
        timeScale: 0.76,
        verticalOffset: (-1.5 - phase * 1.8) * spatial,
      }
    case 'success':
      return {
        accent: 'primary',
        eyeScaleY: 1 + transient * 0.08,
        gazeXOffset: 0,
        gazeYOffset: -1.4 * transient * spatial,
        glowMultiplier: 1.08 + transient * 0.42,
        opacity: 1,
        particleAlphaMultiplier: 0.86 + transient * 0.5,
        particleSpeedMultiplier: 0.9 + transient * 0.45,
        ringAlpha: transient * 0.5,
        ringRadius: 5 + (1 - transient) * 9,
        rotationOffset: 0,
        scaleX: 1 + transient * 0.09 * spatial,
        scaleY: 1 + transient * 0.045 * spatial,
        timeScale: 1.08,
        verticalOffset: -transient * 3.2 * spatial,
      }
    case 'error':
      return {
        accent: 'danger',
        eyeScaleY: 0.62,
        gazeXOffset: slowWave * 0.55,
        gazeYOffset: 2.2 * spatial,
        glowMultiplier: 0.92 + phase * 0.08,
        opacity: 1,
        particleAlphaMultiplier: 0.38,
        particleSpeedMultiplier: 0.35,
        ringAlpha: 0.3 + phase * 0.16,
        ringRadius: 2 + phase * 2,
        rotationOffset: slowWave * 0.012,
        scaleX: 1.055 * spatial + (1 - spatial),
        scaleY: 0.92 * spatial + (1 - spatial),
        timeScale: 0.5,
        verticalOffset: 2.1 * spatial,
      }
    case 'standby':
    default:
      return {
        accent: 'primary',
        eyeScaleY: 1,
        gazeXOffset: 0,
        gazeYOffset: 0,
        glowMultiplier: 0.72,
        opacity: 0.82,
        particleAlphaMultiplier: 0.46,
        particleSpeedMultiplier: 0.42,
        ringAlpha: 0,
        ringRadius: 0,
        rotationOffset: 0,
        scaleX: 1,
        scaleY: 1,
        timeScale: 0.55,
        verticalOffset: 0.6 * spatial,
      }
  }
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function damp(current: number, target: number, smoothing: number, deltaMs: number): number {
  if (deltaMs <= 0) return current
  const factor = 1 - Math.exp((-smoothing * deltaMs) / 1000)
  return current + (target - current) * factor
}

/**
 * 疲劳形态仍保留很慢的黏弹性流动。两个不同频率的波叠加后不会像机械循环，
 * 同时只输出轮廓形变信号，不产生整体位移或点击反馈。
 */
export function sampleAssistantSlimeRest(
  phase: number,
  reducedMotion: boolean
): AssistantSlimeRestSample {
  if (reducedMotion) return { breath: 0, lateral: 0 }

  return {
    breath: Math.sin(phase * 0.44),
    lateral: Math.sin(phase * 0.31 + 1.1) * 0.72 + Math.sin(phase * 0.83) * 0.28,
  }
}

/**
 * 根据一次外层位移估算软体的速度形变。局部 X 轴对齐运动方向并压缩，
 * 局部 Y 轴补偿伸展；正弦速度包络让起步和刹停自然回到中性形态。
 */
export function sampleAssistantTravelDeformation(
  elapsedMs: number,
  durationMs: number,
  deltaX: number,
  deltaY: number,
  reducedMotion: boolean
): AssistantTravelDeformationSample {
  const distance = Math.hypot(deltaX, deltaY)
  const axisAngle = distance > 0.001 ? Math.atan2(deltaY, deltaX) : 0
  if (reducedMotion || durationMs <= 0 || distance < 0.5) {
    return { active: false, axisAngle, scaleAcross: 1, scaleAlong: 1, strain: 0 }
  }

  const progress = clamp(elapsedMs / durationMs, 0, 1)
  const velocityEnvelope = Math.sin(progress * Math.PI)
  const averageSpeed = (distance / durationMs) * 1000
  const peakStrain = clamp(averageSpeed / 550, 0, 0.13)
  const strain = peakStrain * Math.max(0, velocityEnvelope)

  return {
    active: elapsedMs >= 0 && elapsedMs < durationMs,
    axisAngle,
    scaleAcross: 1 + strain * 0.78,
    scaleAlong: 1 - strain,
    strain,
  }
}

export function sampleAssistantRollRotation(
  elapsedMs: number,
  durationMs: number,
  direction: number,
  reducedMotion: boolean
): number {
  if (reducedMotion || durationMs <= 0) return 0
  const progress = clamp(elapsedMs / durationMs, 0, 1)
  return progress * Math.PI * 4 * (direction >= 0 ? 1 : -1)
}

/**
 * 点击角色后的短促回应。减少动画模式只保留亮度和眨眼变化，
 * 不产生位移、形变或粒子扩散。
 */
export function sampleAssistantReaction(
  elapsedMs: number,
  reducedMotion: boolean
): AssistantReactionSample {
  const progress = clamp(elapsedMs / ASSISTANT_REACTION_DURATION_MS, 0, 1)
  const active = elapsedMs >= 0 && elapsedMs < ASSISTANT_REACTION_DURATION_MS

  if (!active) {
    return {
      active: false,
      eyeScaleY: 1,
      glowBoost: 0,
      hopY: 0,
      particleBurst: 0,
      progress: 1,
      ringAlpha: 0,
      scaleX: 1,
      scaleY: 1,
    }
  }

  const response = Math.sin(progress * Math.PI)
  const blink = Math.sin(Math.min(1, progress / 0.34) * Math.PI)

  if (reducedMotion) {
    return {
      active: true,
      eyeScaleY: 1 - blink * 0.34,
      glowBoost: response * 0.48,
      hopY: 0,
      particleBurst: 0,
      progress,
      ringAlpha: 0,
      scaleX: 1,
      scaleY: 1,
    }
  }

  const compression = Math.sin(Math.min(1, progress / 0.26) * Math.PI)
  const releaseProgress = clamp((progress - 0.12) / 0.7, 0, 1)
  const release = Math.sin(releaseProgress * Math.PI)

  return {
    active: true,
    eyeScaleY: 1 - blink * 0.44 + release * 0.08,
    glowBoost: response * 0.72,
    hopY: -release * 6.5,
    particleBurst: release,
    progress,
    ringAlpha: Math.pow(1 - progress, 1.7) * 0.82,
    scaleX: 1 + compression * 0.065 - release * 0.026,
    scaleY: 1 - compression * 0.08 + release * 0.06,
  }
}

const ASSISTANT_GESTURE_DURATIONS: Record<AssistantGesture, number> = {
  tap: ASSISTANT_REACTION_DURATION_MS,
  nod: 520,
  boop: 560,
  wobble: 720,
  startle: 620,
  dizzy: 900,
  tired: 4300,
  recover: 760,
  glance: 1100,
  stretch: 960,
  peek: 1050,
  doze: 1500,
  orbit: 1200,
  shimmy: 820,
}

export function getAssistantGestureDuration(gesture: AssistantGesture): number {
  return ASSISTANT_GESTURE_DURATIONS[gesture]
}

function neutralAssistantGesture(): AssistantGestureSample {
  return {
    active: false,
    bodyX: 0,
    eyeScaleY: 1,
    gazeX: 0,
    gazeY: 0,
    glowBoost: 0,
    hopY: 0,
    particleBurst: 0,
    progress: 1,
    ringAlpha: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    verticalOffset: 0,
  }
}

function reactionAsGesture(reaction: AssistantReactionSample): AssistantGestureSample {
  return {
    ...reaction,
    bodyX: 0,
    gazeX: 0,
    gazeY: 0,
    rotation: 0,
    verticalOffset: 0,
  }
}

/** 独立动作片段叠加在业务状态之上；不改变布局，也不持有业务状态。 */
export function sampleAssistantGesture(
  gesture: AssistantGesture | null,
  elapsedMs: number,
  reducedMotion: boolean
): AssistantGestureSample {
  if (!gesture) return neutralAssistantGesture()
  if (gesture === 'tap') return reactionAsGesture(sampleAssistantReaction(elapsedMs, reducedMotion))

  const duration = getAssistantGestureDuration(gesture)
  const progress = clamp(elapsedMs / duration, 0, 1)
  if (elapsedMs < 0 || elapsedMs >= duration) return neutralAssistantGesture()

  const pulse = Math.sin(progress * Math.PI)
  const settle = 1 - Math.pow(1 - clamp(progress / 0.18, 0, 1), 3)
  const release = Math.pow(1 - progress, 1.4)
  const base: AssistantGestureSample = {
    active: true,
    bodyX: 0,
    eyeScaleY: 1,
    gazeX: 0,
    gazeY: 0,
    glowBoost: pulse * 0.24,
    hopY: 0,
    particleBurst: 0,
    progress,
    ringAlpha: 0,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    verticalOffset: 0,
  }

  if (reducedMotion) {
    const isResting = gesture === 'tired' || gesture === 'doze'
    return {
      ...base,
      eyeScaleY: isResting ? 0.24 : 1 - pulse * 0.34,
      glowBoost: isResting ? 0 : pulse * 0.32,
      ringAlpha: gesture === 'recover' ? pulse * 0.22 : 0,
    }
  }

  switch (gesture) {
    case 'nod':
      return {
        ...base,
        eyeScaleY: 1 - pulse * 0.28,
        gazeY: 2.4 * pulse,
        hopY: 2.8 * Math.sin(progress * Math.PI * 2),
        scaleX: 1 + pulse * 0.025,
        scaleY: 1 - pulse * 0.035,
      }
    case 'boop':
      return {
        ...base,
        eyeScaleY: 1 - pulse * 0.42,
        glowBoost: pulse * 0.46,
        hopY: -pulse * 4.5,
        particleBurst: pulse * 0.42,
        ringAlpha: release * 0.42,
        scaleX: 1 + pulse * 0.09,
        scaleY: 1 - pulse * 0.1,
      }
    case 'wobble':
      return {
        ...base,
        bodyX: Math.sin(progress * Math.PI * 4) * 4.6 * release,
        gazeX: -Math.sin(progress * Math.PI * 4) * 3.2,
        rotation: Math.sin(progress * Math.PI * 5) * 0.13 * release,
        scaleX: 1 + pulse * 0.055,
        scaleY: 1 - pulse * 0.04,
      }
    case 'startle':
      return {
        ...base,
        eyeScaleY: 1.18 - pulse * 0.14,
        gazeY: -3.2 * pulse,
        glowBoost: pulse * 0.58,
        hopY: -9 * pulse,
        particleBurst: pulse * 0.7,
        ringAlpha: release * 0.56,
        scaleX: 1 - pulse * 0.055,
        scaleY: 1 + pulse * 0.11,
      }
    case 'dizzy':
      return {
        ...base,
        bodyX: Math.sin(progress * Math.PI * 4) * 4.2,
        eyeScaleY: 0.72,
        gazeX: Math.cos(progress * Math.PI * 6) * 3.8,
        gazeY: Math.sin(progress * Math.PI * 6) * 2.8,
        rotation: Math.sin(progress * Math.PI * 4) * 0.18,
        scaleX: 1 + pulse * 0.08,
        scaleY: 1 - pulse * 0.07,
        verticalOffset: pulse * 3.4,
      }
    case 'tired':
      return {
        ...base,
        bodyX: settle * 2.2,
        eyeScaleY: 1 - settle * 0.24,
        gazeX: settle * 1.2,
        gazeY: settle * 5.2,
        glowBoost: 0,
        rotation: settle * 0.035,
        scaleX: 1 + settle * 0.04,
        scaleY: 1 - settle * 0.14,
        verticalOffset: settle * 14,
      }
    case 'recover': {
      const rest = 1 - settle
      return {
        ...base,
        bodyX: rest * 2.2,
        eyeScaleY: 0.76 + settle * 0.24,
        gazeX: rest * 1.2,
        gazeY: rest * 5.2,
        glowBoost: pulse * 0.52,
        hopY: -pulse * 5.5,
        particleBurst: pulse * 0.54,
        ringAlpha: release * 0.46,
        rotation: rest * 0.035,
        scaleX: 1 + rest * 0.04 - pulse * 0.05,
        scaleY: 0.86 + settle * 0.14 + pulse * 0.08,
        verticalOffset: rest * 14,
      }
    }
    case 'glance':
      return {
        ...base,
        bodyX: Math.sin(progress * Math.PI) * 2.2,
        gazeX: Math.sin(progress * Math.PI * 2) * 6.8,
        gazeY: -pulse * 1.4,
        rotation: Math.sin(progress * Math.PI * 2) * 0.035,
      }
    case 'stretch':
      return {
        ...base,
        eyeScaleY: 1 - pulse * 0.2,
        gazeY: -pulse * 2.2,
        hopY: -pulse * 3.2,
        scaleX: 1 - pulse * 0.075,
        scaleY: 1 + pulse * 0.12,
      }
    case 'peek':
      return {
        ...base,
        bodyX: pulse * 7.5,
        gazeX: pulse * 5.8,
        eyeScaleY: 1 - Math.sin(progress * Math.PI * 2) * 0.12,
        rotation: pulse * 0.07,
        scaleX: 1 - pulse * 0.025,
        scaleY: 1 + pulse * 0.035,
      }
    case 'doze':
      return {
        ...base,
        eyeScaleY: 1 - pulse * 0.88,
        gazeY: pulse * 3,
        rotation: pulse * 0.045,
        scaleX: 1 + pulse * 0.045,
        scaleY: 1 - pulse * 0.055,
        verticalOffset: pulse * 4.5,
      }
    case 'orbit':
      return {
        ...base,
        gazeX: Math.cos(progress * Math.PI * 2) * 5.2,
        gazeY: Math.sin(progress * Math.PI * 2) * 3.4,
        glowBoost: pulse * 0.48,
        particleBurst: pulse * 0.68,
        ringAlpha: pulse * 0.32,
        rotation: Math.sin(progress * Math.PI * 2) * 0.04,
      }
    case 'shimmy':
      return {
        ...base,
        bodyX: Math.sin(progress * Math.PI * 8) * 3.4 * release,
        eyeScaleY: 1 - pulse * 0.16,
        particleBurst: pulse * 0.3,
        rotation: Math.sin(progress * Math.PI * 8) * 0.075 * release,
        scaleX: 1 + Math.sin(progress * Math.PI * 4) * 0.045,
        scaleY: 1 - Math.sin(progress * Math.PI * 4) * 0.035,
      }
    default:
      return base
  }
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
      bodyX: 0,
      bodyY: 0,
      breathScale: 1,
      corePulse: 0.95 + Math.sin(quietPhase * Math.PI * 2) * 0.025,
      floatY: 0,
      flowRotation: Math.sin(quietPhase * Math.PI * 2) * 0.035,
      gazeX: 0,
      gazeY: 0,
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

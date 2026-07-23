export type AssistantPresenceTheme = 'light' | 'dark'

export type AssistantPresenceState =
  | 'standby'
  | 'input'
  | 'thinking'
  | 'acting'
  | 'needs-input'
  | 'success'
  | 'error'

export type AssistantPresenceAccent = 'primary' | 'warm' | 'danger' | 'green'

/** 角色表情；由状态机驱动，不依赖 Filter */
export type AssistantExpression =
  | 'neutral'
  | 'happy'
  | 'angry'
  | 'sad'
  | 'delight'
  | 'focused'
  | 'tired'
  | 'confused'
  | 'dizzy'
  | 'powered'

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
  expression: AssistantExpression
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

/** 表情参数；由采样函数输出，渲染层直接消费 */
export interface AssistantExpressionSample {
  expression: AssistantExpression
  eyeHeightMultiplier: number
  eyeWidthMultiplier: number
  eyebrowAngle: number
  eyebrowYOffset: number
  mouthCurve: number
  mouthWidth: number
  mouthYOffset: number
  cheekAlpha: number
  /** 是否绘制眉毛/嘴巴/腮红；neutral 和 focused 等中性表情显式关闭 */
  showDecorations: boolean
}

export const ASSISTANT_REACTION_DURATION_MS = 520

/** 表情过渡动画时长 (ms) */
export const EXPRESSION_ENTER_DURATION_MS = 200
export const EXPRESSION_EXIT_DURATION_MS = 250
/** reducedMotion 时表情过渡时长 (ms) */
export const EXPRESSION_ENTER_DURATION_REDUCED_MS = 140
export const EXPRESSION_EXIT_DURATION_REDUCED_MS = 160

/**
 * 表情过渡状态。
 * 管理 decorationAlpha / decorationScale 的连续插值，
 * 以及眼高/宽、眉角、嘴curve/width 等面部参数的平滑过渡。
 */
export interface AssistantExpressionTransitionState {
  /** 当前插值后的表情采样 */
  sample: AssistantExpressionSample
  /** 装饰（眉/嘴/腮红）整体透明度 [0, 1] */
  decorationAlpha: number
  /** 装饰整体缩放 [0.9, 1.05] */
  decorationScale: number
  /** 装饰 Y 偏移（展开时从正到 0） */
  decorationYOffset: number
  /** 当前源表情（过渡中使用） */
  sourceExpression: AssistantExpression
  /** 当前目标表情 */
  targetExpression: AssistantExpression
  /** 目标是否显示装饰 */
  targetShowDecorations: boolean
  /** 过渡阶段 */
  phase: 'idle' | 'entering' | 'exiting' | 'crossfading'
  /** 过渡进度 [0, 1] */
  progress: number
}

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
        expression: STATE_EXPRESSION_MAP[state],
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
        expression: STATE_EXPRESSION_MAP[state],
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
        expression: STATE_EXPRESSION_MAP[state],
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
        expression: STATE_EXPRESSION_MAP[state],
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
        expression: STATE_EXPRESSION_MAP[state],
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
        expression: STATE_EXPRESSION_MAP[state],
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
        expression: STATE_EXPRESSION_MAP[state],
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

function mix(from: number, to: number, amount: number): number {
  return from + (to - from) * amount
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

/** 表情参数表；各表情通过 Pixi 图元组合眼形、眉弧、嘴形 */
const EXPRESSION_TABLE: Record<AssistantExpression, AssistantExpressionSample> = {
  neutral: {
    expression: 'neutral',
    eyeHeightMultiplier: 1,
    eyeWidthMultiplier: 1,
    eyebrowAngle: 0,
    eyebrowYOffset: 0,
    mouthCurve: 0,
    mouthWidth: 4,
    mouthYOffset: 0,
    cheekAlpha: 0,
    showDecorations: false,
  },
  happy: {
    expression: 'happy',
    eyeHeightMultiplier: 0.78,
    eyeWidthMultiplier: 1.08,
    eyebrowAngle: 0,
    eyebrowYOffset: -0.8,
    mouthCurve: 0.45,
    mouthWidth: 9,
    mouthYOffset: 0.5,
    cheekAlpha: 0.22,
    showDecorations: true,
  },
  angry: {
    expression: 'angry',
    eyeHeightMultiplier: 0.72,
    eyeWidthMultiplier: 1.12,
    eyebrowAngle: 0.42,
    eyebrowYOffset: 1.6,
    mouthCurve: -0.32,
    mouthWidth: 7,
    mouthYOffset: 1,
    cheekAlpha: 0,
    showDecorations: true,
  },
  sad: {
    expression: 'sad',
    eyeHeightMultiplier: 0.82,
    eyeWidthMultiplier: 0.92,
    eyebrowAngle: -0.3,
    eyebrowYOffset: -1.2,
    mouthCurve: -0.38,
    mouthWidth: 6.5,
    mouthYOffset: 1.4,
    cheekAlpha: 0,
    showDecorations: true,
  },
  delight: {
    expression: 'delight',
    eyeHeightMultiplier: 1.18,
    eyeWidthMultiplier: 1.14,
    eyebrowAngle: 0,
    eyebrowYOffset: -1.5,
    mouthCurve: 0.55,
    mouthWidth: 11,
    mouthYOffset: 0.5,
    cheekAlpha: 0.32,
    showDecorations: true,
  },
  focused: {
    expression: 'focused',
    eyeHeightMultiplier: 0.68,
    eyeWidthMultiplier: 1.04,
    eyebrowAngle: 0,
    eyebrowYOffset: 0,
    mouthCurve: 0,
    mouthWidth: 3.5,
    mouthYOffset: 0,
    cheekAlpha: 0,
    showDecorations: false,
  },
  tired: {
    expression: 'tired',
    eyeHeightMultiplier: 0.38,
    eyeWidthMultiplier: 0.88,
    eyebrowAngle: -0.18,
    eyebrowYOffset: -0.6,
    mouthCurve: -0.22,
    mouthWidth: 8,
    mouthYOffset: 1.6,
    cheekAlpha: 0,
    showDecorations: true,
  },
  confused: {
    expression: 'confused',
    eyeHeightMultiplier: 1.06,
    eyeWidthMultiplier: 0.96,
    eyebrowAngle: -0.28,
    eyebrowYOffset: -1,
    mouthCurve: -0.15,
    mouthWidth: 5.5,
    mouthYOffset: 0.8,
    cheekAlpha: 0,
    showDecorations: true,
  },
  dizzy: {
    expression: 'dizzy',
    eyeHeightMultiplier: 0.55,
    eyeWidthMultiplier: 1.1,
    eyebrowAngle: 0.22,
    eyebrowYOffset: 1.2,
    mouthCurve: 0.18,
    mouthWidth: 7.5,
    mouthYOffset: 0.6,
    cheekAlpha: 0,
    showDecorations: true,
  },
  powered: {
    expression: 'powered',
    eyeHeightMultiplier: 0.62,
    eyeWidthMultiplier: 1.08,
    eyebrowAngle: 0.16,
    eyebrowYOffset: 0.8,
    mouthCurve: 0.12,
    mouthWidth: 5.5,
    mouthYOffset: 0.3,
    cheekAlpha: 0,
    showDecorations: true,
  },
}

/** 采样表情参数 */
export function sampleAssistantExpression(
  expression: AssistantExpression
): AssistantExpressionSample {
  return EXPRESSION_TABLE[expression]
}

/** 每个基础状态对应的表情；默认/standby/input/thinking/acting 保持中性双眼 */
const STATE_EXPRESSION_MAP: Record<AssistantPresenceState, AssistantExpression> = {
  standby: 'neutral',
  input: 'neutral',
  thinking: 'neutral',
  acting: 'neutral',
  'needs-input': 'confused',
  success: 'happy',
  error: 'sad',
}

/** 手势可覆盖常规状态的表情；仅映射有语义表情差异的手势 */
const ASSISTANT_GESTURE_EXPRESSION_MAP: Partial<Record<AssistantGesture, AssistantExpression>> = {
  tired: 'tired',
  doze: 'tired',
  dizzy: 'dizzy',
  recover: 'happy',
  tap: 'happy',
}

/**
 * 纯函数：综合状态、手势、蓄力决定当前表情。
 * 手势优先于常规状态，动作/状态结束立即回中性双眼。
 * 返回的 sample 中 showDecorations=false 时渲染层不绘制眉毛/嘴巴/腮红。
 */
export function resolveAssistantExpression(
  presenceState: AssistantPresenceState,
  activeGesture: AssistantGesture | null,
  powerUp: boolean
): AssistantExpressionSample {
  let expression: AssistantExpression

  if (activeGesture) {
    const gestureExpression = ASSISTANT_GESTURE_EXPRESSION_MAP[activeGesture]
    if (gestureExpression) {
      // 紧急语义手势（tired/dizzy/recover/tap）优先级高于 powerUp
      expression = gestureExpression
    } else if (powerUp) {
      // 普通手势（stretch 等）被 powerUp 覆盖，显示 powered 表情
      expression = 'powered'
    } else {
      expression = 'neutral'
    }
  } else if (powerUp) {
    expression = 'powered'
  } else {
    expression = STATE_EXPRESSION_MAP[presenceState]
  }

  return EXPRESSION_TABLE[expression]
}

/** 创建空闲（无表情）过渡状态 */
export function createIdleExpressionTransitionState(): AssistantExpressionTransitionState {
  const neutral = EXPRESSION_TABLE.neutral
  return {
    sample: neutral,
    decorationAlpha: 0,
    decorationScale: 0.9,
    decorationYOffset: 2,
    sourceExpression: 'neutral',
    targetExpression: 'neutral',
    targetShowDecorations: false,
    phase: 'idle',
    progress: 1,
  }
}

/**
 * 纯函数：推进表情过渡状态。
 *
 * 场景：
 * 1. neutral/none → 情绪：entering，decorationAlpha 0→1，scale 0.9→1，Y offset 正→0
 * 2. 情绪 → neutral/none：exiting，alpha 1→0，scale 略回缩
 * 3. 情绪A → 情绪B：crossfading，保持 alpha=1，面部参数连续插值
 * 4. reducedMotion：只做 alpha 或微小 scale 变化
 *
 * @param current 当前过渡状态
 * @param targetSample 目标表情采样（由 resolveAssistantExpression 返回）
 * @param deltaMs 距上一帧的时间差 (ms)
 * @param reducedMotion 是否减少动画
 * @returns 新的过渡状态（不修改输入）
 */
export function stepAssistantExpressionTransition(
  current: AssistantExpressionTransitionState,
  targetSample: AssistantExpressionSample,
  deltaMs: number,
  reducedMotion: boolean
): AssistantExpressionTransitionState {
  const targetExpression = targetSample.expression
  const targetShow = targetSample.showDecorations
  const currentShow = current.targetShowDecorations

  // 判断是否需要切换过渡阶段
  const expressionChanged = targetExpression !== current.targetExpression
  const showChanged = targetShow !== currentShow

  let phase = current.phase
  let progress = current.progress
  let sourceExpression = current.sourceExpression
  let sourceSample = current.sample

  if (expressionChanged || showChanged) {
    // 目标发生变化，启动新过渡
    if (!currentShow && targetShow) {
      // 从无装饰 → 有装饰：entering
      phase = 'entering'
      progress = 0
      sourceExpression = current.targetExpression
      sourceSample = EXPRESSION_TABLE.neutral
    } else if (currentShow && !targetShow) {
      // 有装饰 → 无装饰：exiting
      phase = 'exiting'
      progress = 0
      sourceExpression = current.targetExpression
      sourceSample = EXPRESSION_TABLE[current.targetExpression]
    } else if (currentShow && targetShow) {
      // 情绪A → 情绪B：crossfading
      phase = 'crossfading'
      progress = 0
      sourceExpression = current.targetExpression
      sourceSample = EXPRESSION_TABLE[current.targetExpression]
    } else {
      // 无装饰 → 无装饰（如 neutral → neutral），直接切换
      return {
        sample: targetSample,
        decorationAlpha: 0,
        decorationScale: 0.9,
        decorationYOffset: 2,
        sourceExpression: current.targetExpression,
        targetExpression,
        targetShowDecorations: targetShow,
        phase: 'idle',
        progress: 1,
      }
    }
  }

  // 推进进度
  const enterDuration = reducedMotion
    ? EXPRESSION_ENTER_DURATION_REDUCED_MS
    : EXPRESSION_ENTER_DURATION_MS
  const exitDuration = reducedMotion
    ? EXPRESSION_EXIT_DURATION_REDUCED_MS
    : EXPRESSION_EXIT_DURATION_MS
  const crossfadeDuration = reducedMotion
    ? EXPRESSION_ENTER_DURATION_REDUCED_MS
    : EXPRESSION_ENTER_DURATION_MS

  let duration: number
  switch (phase) {
    case 'entering':
      duration = enterDuration
      break
    case 'exiting':
      duration = exitDuration
      break
    case 'crossfading':
      duration = crossfadeDuration
      break
    default:
      duration = enterDuration
  }

  if (phase !== 'idle') {
    progress = Math.min(1, progress + deltaMs / Math.max(1, duration))
  }

  // 缓动函数
  const easeOut = (t: number): number => 1 - Math.pow(1 - t, 2.2)
  const easeInOut = (t: number): number => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)
  const easedProgress = phase === 'crossfading' ? easeInOut(progress) : easeOut(progress)

  // 计算插值后的面部参数
  const targetFaceSample = targetShow ? targetSample : EXPRESSION_TABLE.neutral
  const interpolatedSample: AssistantExpressionSample = {
    expression: progress >= 1 ? targetExpression : sourceSample.expression,
    eyeHeightMultiplier: mix(
      sourceSample.eyeHeightMultiplier,
      targetFaceSample.eyeHeightMultiplier,
      easedProgress
    ),
    eyeWidthMultiplier: mix(
      sourceSample.eyeWidthMultiplier,
      targetFaceSample.eyeWidthMultiplier,
      easedProgress
    ),
    eyebrowAngle: mix(sourceSample.eyebrowAngle, targetFaceSample.eyebrowAngle, easedProgress),
    eyebrowYOffset: mix(
      sourceSample.eyebrowYOffset,
      targetFaceSample.eyebrowYOffset,
      easedProgress
    ),
    mouthCurve: mix(sourceSample.mouthCurve, targetFaceSample.mouthCurve, easedProgress),
    mouthWidth: mix(sourceSample.mouthWidth, targetFaceSample.mouthWidth, easedProgress),
    mouthYOffset: mix(sourceSample.mouthYOffset, targetFaceSample.mouthYOffset, easedProgress),
    cheekAlpha: mix(sourceSample.cheekAlpha, targetFaceSample.cheekAlpha, easedProgress),
    showDecorations: targetShow,
  }

  // 计算装饰 alpha / scale / yOffset
  let decorationAlpha: number
  let decorationScale: number
  let decorationYOffset = 0

  switch (phase) {
    case 'entering': {
      if (reducedMotion) {
        decorationAlpha = easedProgress
        decorationScale = 0.98 + easedProgress * 0.02
      } else {
        decorationAlpha = easedProgress
        decorationScale = 0.9 + easedProgress * 0.1
        decorationYOffset = (1 - easedProgress) * 2
      }
      break
    }
    case 'exiting': {
      if (reducedMotion) {
        decorationAlpha = 1 - easedProgress
        decorationScale = 1 - easedProgress * 0.02
      } else {
        decorationAlpha = 1 - easedProgress
        decorationScale = 1 - easedProgress * 0.06
      }
      break
    }
    case 'crossfading': {
      decorationAlpha = 1
      decorationScale = 1
      break
    }
    default: {
      // idle
      decorationAlpha = currentShow ? 1 : 0
      decorationScale = currentShow ? 1 : 0.9
      decorationYOffset = currentShow ? 0 : 2
    }
  }

  // 判断过渡是否完成
  let finalPhase = phase
  if (progress >= 1) {
    if (phase === 'exiting' && !targetShow) {
      finalPhase = 'idle'
    } else if (phase === 'entering' || phase === 'crossfading') {
      finalPhase = targetShow ? 'idle' : 'idle'
    }
  }

  return {
    sample: interpolatedSample,
    decorationAlpha: clamp(decorationAlpha, 0, 1),
    decorationScale: clamp(decorationScale, 0.85, 1.1),
    decorationYOffset: clamp(decorationYOffset ?? 0, -4, 6),
    sourceExpression,
    targetExpression,
    targetShowDecorations: targetShow,
    phase: finalPhase,
    progress,
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

/** 卫星循环上限 */
export const SATELLITE_MAX = 5

/**
 * 世界坐标地面阴影参数。
 * 距离 >= 阈值时 alpha=0，绝不保留下限。
 */
export interface WorldShadowParams {
  alpha: number
  width: number
  /** 地面接触时的水平宽度增量（仅 distance<=0 且非 cardContact） */
  groundContactWidthBonus: number
}

/** 地面阴影距离阈值（px）：超过此距离阴影完全消失 */
export const WORLD_SHADOW_FADE_THRESHOLD = 40

/** 地面阴影宽度范围 */
const WORLD_SHADOW_WIDTH_GROUNDED = 28
const WORLD_SHADOW_WIDTH_AIRBORNE = 20

/** 地面接触时额外宽度增量 */
const WORLD_SHADOW_GROUND_CONTACT_BONUS = 6

/**
 * 纯函数：根据角色底部到 groundY 的距离计算世界阴影参数。
 * - distance <= 0：角色在地面，完全不透明，宽度最大
 * - 0 < distance < threshold：随距离连续衰减（sqrt proximity），宽度线性收缩
 * - distance >= threshold：alpha=0，不可见
 * - cardContact：卡片表面接触期间完全隐藏（包括滚动、疲劳趴下）
 * - reducedMotion：应用内设置的轻量静态反馈，不依赖系统 prefers-reduced-motion
 */
export function computeWorldShadowParams(
  distanceFromGround: number,
  cardContact: boolean,
  reducedMotion: boolean
): WorldShadowParams {
  if (cardContact) return { alpha: 0, width: 0, groundContactWidthBonus: 0 }

  if (reducedMotion) {
    if (distanceFromGround <= 0) {
      return {
        alpha: 0.35,
        width: WORLD_SHADOW_WIDTH_GROUNDED,
        groundContactWidthBonus: WORLD_SHADOW_GROUND_CONTACT_BONUS,
      }
    }
    return { alpha: 0, width: 0, groundContactWidthBonus: 0 }
  }

  if (distanceFromGround <= 0) {
    return {
      alpha: 1,
      width: WORLD_SHADOW_WIDTH_GROUNDED,
      groundContactWidthBonus: WORLD_SHADOW_GROUND_CONTACT_BONUS,
    }
  }

  if (distanceFromGround >= WORLD_SHADOW_FADE_THRESHOLD) {
    return { alpha: 0, width: 0, groundContactWidthBonus: 0 }
  }

  const t = distanceFromGround / WORLD_SHADOW_FADE_THRESHOLD
  const proximity = 1 - t
  const alpha = Math.sqrt(proximity)
  const width =
    WORLD_SHADOW_WIDTH_GROUNDED + (WORLD_SHADOW_WIDTH_AIRBORNE - WORLD_SHADOW_WIDTH_GROUNDED) * t
  return { alpha, width, groundContactWidthBonus: 0 }
}
/**
 * 运行轨道粒子配置 profile。
 * 由纯函数 getAssistantRunOrbitProfile 生成，renderer 消费。
 */
export interface RunOrbitProfile {
  /** 粒子数量 */
  count: number
  /** 基础角速度 (rad/s) */
  baseSpeed: number
  /** 轨道半径 (px)，各粒子在此基础上递增 */
  orbitRadius: number
  /** 拖尾帧数 */
  trailLength: number
  /** 基础生命周期 (ms) */
  lifespan: number
  /** 粒子消亡后到下一次补足的延迟 (ms) */
  respawnDelay: number
  /** 收束动画时长 (ms) */
  convergeDuration: number
}

/** 收束动画时长 (ms)，thinking/acting 一致 */
const RUN_ORBIT_CONVERGE_MS = 300

/**
 * 纯函数：根据当前状态和 reducedMotion 偏好返回运行轨道粒子配置。
 * 非 running 状态返回 count=0；reduced 模式仍返回 count=1（renderer 绝不因 reduced 直接 return）。
 */
export function getAssistantRunOrbitProfile(
  state: AssistantPresenceState,
  reducedMotion: boolean
): RunOrbitProfile {
  if (state !== 'thinking' && state !== 'acting') {
    return {
      count: 0,
      baseSpeed: 0,
      orbitRadius: 0,
      trailLength: 0,
      lifespan: 0,
      respawnDelay: 0,
      convergeDuration: RUN_ORBIT_CONVERGE_MS,
    }
  }

  if (reducedMotion) {
    return {
      count: 1,
      baseSpeed: 0.6,
      orbitRadius: 34,
      trailLength: 2,
      lifespan: 1600,
      respawnDelay: 300,
      convergeDuration: RUN_ORBIT_CONVERGE_MS,
    }
  }

  if (state === 'thinking') {
    return {
      count: 2,
      baseSpeed: 1.45,
      orbitRadius: 18,
      trailLength: 6,
      lifespan: 2200,
      respawnDelay: 200,
      convergeDuration: RUN_ORBIT_CONVERGE_MS,
    }
  }

  // acting — 更快、方向性更强、trail 稍长
  return {
    count: 3,
    baseSpeed: 2.8,
    orbitRadius: 16,
    trailLength: 8,
    lifespan: 1800,
    respawnDelay: 150,
    convergeDuration: RUN_ORBIT_CONVERGE_MS,
  }
}

/** 蓄力结束后额外等待时间 (ms) */
export const SATELLITE_CHARGE_DELAY_MS = 1200
/** 吸收动画时长 (ms) */
export const SATELLITE_ABSORPTION_MS = 800

export interface SatelliteAddResult {
  count: number
  triggerCharge: boolean
}

/** 一颗卫星被成功捕获后的状态 */
export function resolveSatelliteAdd(currentCount: number): SatelliteAddResult {
  const count = Math.min(currentCount + 1, SATELLITE_MAX)
  return { count, triggerCharge: count >= SATELLITE_MAX }
}

/** 蓄力是否结束、应开始吸收 */
export function isSatelliteChargeFinished(
  chargeStartedAt: number,
  stretchDuration: number,
  now: number
): boolean {
  return now - chargeStartedAt > stretchDuration + SATELLITE_CHARGE_DELAY_MS
}

/** 吸收是否结束、应清零卫星 */
export function isSatelliteAbsorptionFinished(absorptionStartedAt: number, now: number): boolean {
  return now - absorptionStartedAt >= SATELLITE_ABSORPTION_MS
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
    const quietWave = Math.sin(quietPhase * Math.PI * 2)

    return {
      bodyX: 0,
      bodyY: 0,
      breathScale: 1 + quietWave * 0.008,
      corePulse: 0.95 + quietWave * 0.025,
      floatY: quietWave * 0.35,
      flowRotation: quietWave * 0.035,
      gazeX: x * 2.2,
      gazeY: y * 1.4,
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

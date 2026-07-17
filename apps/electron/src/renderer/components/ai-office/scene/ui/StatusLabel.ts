// @ts-nocheck
import { Container, Graphics, Text } from 'pixi.js'

const NAME_STYLE = {
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 11,
  fontWeight: '600' as const,
  fill: 0x333333,
}

const STATE_COLORS: Record<string, number> = {
  waiting: 0x94a3b8,
  walking: 0x4a90d9,
  working: 0x50b86c,
  talking: 0xe8a838,
  thinking: 0x9b6dd7,
  reviewing: 0x3b82f6,
  blocked: 0xf97316,
  completed: 0x16a34a,
  failed: 0xdc2626,
  cancelled: 0x64748b,
}

const CROWN_GAP = 14
const CHIP_PAD_X = 8
const CHIP_PAD_Y = 4
const DOT_GAP = 7

export class StatusLabel extends Container {
  private nameText: Text
  private nameBg: Graphics
  private stateDot: Graphics
  private currentState = 'idle'

  constructor(name: string) {
    super()
    this.nameText = new Text({ text: name, style: NAME_STYLE })
    this.nameText.anchor.set(0.5)

    this.nameBg = new Graphics()
    this.stateDot = new Graphics()
    this.addChild(this.nameBg, this.nameText, this.stateDot)
    this.layoutNameChip()
  }

  setName(name: string) {
    if (this.nameText.text === name) return
    this.nameText.text = name
    this.layoutNameChip()
  }

  /** 任务描述属于详情信息，不常驻角色头顶，避免遮挡角色和相邻 worker。 */
  setTask(_task?: string) {
    // 保留接口供场景实体调用；头顶只展示姓名和状态。
  }

  setState(state: string) {
    if (this.currentState === state) return
    this.currentState = state
    this.layoutNameChip()
  }

  layout(crownTopY: number) {
    this.position.set(0, crownTopY - CROWN_GAP)
  }

  getLabelTopY(crownTopY: number): number {
    return crownTopY - CROWN_GAP - this.nameText.height - CHIP_PAD_Y * 2
  }

  private layoutNameChip() {
    const chipHeight = this.nameText.height + CHIP_PAD_Y * 2
    const chipWidth = this.nameText.width + CHIP_PAD_X * 2 + DOT_GAP
    const chipTop = -chipHeight

    this.nameBg.clear()
    this.nameBg.roundRect(-chipWidth / 2, chipTop, chipWidth, chipHeight, 5)
    this.nameBg.fill({ color: 0xffffff, alpha: 0.92 })
    this.nameBg.stroke({ color: 0xffffff, alpha: 0.72, width: 1 })

    this.nameText.position.set(DOT_GAP / 2, chipTop + chipHeight / 2)

    const color = STATE_COLORS[this.currentState] ?? 0xaaaaaa
    this.stateDot.clear()
    this.stateDot.circle(-chipWidth / 2 + CHIP_PAD_X, chipTop + chipHeight / 2, 3.5)
    this.stateDot.fill(color)
  }
}

// @ts-nocheck
import type { AgentEntity } from '../entities/AgentEntity'

/** 驱动 Spine 动画切换 */
export class AnimationSystem {
  update(entities: Map<string, AgentEntity>, dt: number) {
    for (const entity of entities.values()) {
      entity.updateVisuals(entity.data.state, dt)
    }
  }
}

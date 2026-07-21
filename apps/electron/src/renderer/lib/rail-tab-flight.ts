/**
 * rail-tab-flight — 右栏功能 ⇄ 主区标签页的飞行过渡动画
 *
 * 晋升：inspector 面板矩形 → 新建 tab 矩形
 * 回归：被关闭的 tab 矩形 → 右栏 rail 按钮矩形
 *
 * 用 WAAPI 驱动一个玻璃 ghost 元素（fixed 定位、transform 动画），
 * 不参与 React 渲染，目标元素由调用方以回调形式延迟解析
 * （新 tab / 回归的 rail 按钮要等下一轮 React commit 才出现在 DOM）。
 */

const FLIGHT_MS = 320
const RESOLVE_MAX_FRAMES = 10

export function flyRailGhost(from: DOMRect, resolveTarget: () => HTMLElement | null): void {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  if (from.width <= 0 || from.height <= 0) return

  const ghost = document.createElement('div')
  ghost.className = 'rail-tab-flight-ghost'
  Object.assign(ghost.style, {
    left: `${from.left}px`,
    top: `${from.top}px`,
    width: `${from.width}px`,
    height: `${from.height}px`,
  })
  document.body.appendChild(ghost)

  let attempts = 0
  const tryFly = (): void => {
    const target = resolveTarget()
    if (!target) {
      if (++attempts < RESOLVE_MAX_FRAMES) {
        requestAnimationFrame(tryFly)
        return
      }
      // 目标一直没出现：原地淡出兜底，不留残影
      const fallback = ghost.animate([{ opacity: 0.85 }, { opacity: 0 }], {
        duration: 160,
        easing: 'ease-out',
      })
      fallback.onfinish = () => ghost.remove()
      fallback.oncancel = () => ghost.remove()
      return
    }

    const to = target.getBoundingClientRect()
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const sx = Math.max(to.width / Math.max(from.width, 1), 0.02)
    const sy = Math.max(to.height / Math.max(from.height, 1), 0.02)

    const anim = ghost.animate(
      [
        { transform: 'translate(0px, 0px) scale(1, 1)', opacity: 0.85 },
        { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, opacity: 0.2 },
      ],
      { duration: FLIGHT_MS, easing: 'cubic-bezier(0.32, 0.72, 0.28, 1)', fill: 'forwards' }
    )
    const cleanup = (): void => {
      ghost.remove()
      // 落点闪一圈 accent 高光，提示"到这了"
      target.animate(
        [
          { boxShadow: '0 0 0 0 hsl(var(--primary) / 0.45)' },
          { boxShadow: '0 0 0 6px hsl(var(--primary) / 0)' },
        ],
        { duration: 420, easing: 'ease-out' }
      )
    }
    anim.onfinish = cleanup
    anim.oncancel = () => ghost.remove()
  }

  // 双 rAF：等 React commit + 布局稳定后再解析目标
  requestAnimationFrame(() => requestAnimationFrame(tryFly))
}

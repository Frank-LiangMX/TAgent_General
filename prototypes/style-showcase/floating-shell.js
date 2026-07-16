/**
 * 右侧浮岛展开/折叠 — 镜像 TAgent RightPanelRail togglePanel
 */
;(function () {
  function initRightPanelToggle(options) {
    const island = document.querySelector(options.islandSelector)
    const toggleBtn = document.querySelector(options.toggleSelector)
    if (!island || !toggleBtn) return

    let panelOpen = options.initialOpen !== false

    function applyState(open) {
      panelOpen = open
      island.classList.toggle('right-island--expanded', open)
      island.classList.toggle('right-island--collapsed', !open)
      toggleBtn.classList.toggle('active', open)
      toggleBtn.setAttribute('aria-pressed', String(open))
      toggleBtn.setAttribute('aria-label', open ? '折叠工作区面板' : '展开工作区面板')
      document.documentElement.style.setProperty(
        '--right-float-w',
        open
          ? 'calc(var(--right-panel-width) + var(--right-rail-width))'
          : 'var(--right-rail-width)'
      )
      document.documentElement.style.setProperty(
        '--chrome-bleed-right',
        open
          ? 'calc(var(--right-panel-width) + var(--right-rail-width) + var(--content-body-pad-x))'
          : 'calc(var(--right-rail-width) + var(--content-body-pad-x))'
      )
    }

    toggleBtn.addEventListener('click', () => {
      applyState(!panelOpen)
    })

    applyState(panelOpen)
  }

  window.initRightPanelToggle = initRightPanelToggle

  /** TabBar 切换 + 底部指示条滑动 */
  function initTabBar(options) {
    const scroll = document.querySelector(options.scrollSelector)
    const indicator = document.querySelector(options.indicatorSelector)
    const titleEl = document.querySelector(options.titleSelector)
    if (!scroll) return

    const getTabs = () => Array.from(scroll.querySelectorAll('[data-tab-id]'))

    function moveIndicator(tabWrap) {
      if (!indicator || !tabWrap) return
      const btn = tabWrap.querySelector('.tab-item')
      indicator.style.left = `${tabWrap.offsetLeft}px`
      indicator.style.width = `${btn ? btn.offsetWidth : tabWrap.offsetWidth}px`
    }

    function activate(tabId) {
      getTabs().forEach((wrap) => {
        const btn = wrap.querySelector('.tab-item')
        const active = wrap.dataset.tabId === tabId
        btn.classList.toggle('active', active)
        btn.classList.toggle('neu-glass-tab', active && btn.classList.contains('neu-tab'))
        btn.setAttribute('aria-selected', String(active))
      })
      const current = getTabs().find((w) => w.dataset.tabId === tabId)
      if (titleEl && current) {
        titleEl.textContent =
          current.dataset.tabTitle || current.querySelector('.tab-item-title')?.textContent || ''
      }
      moveIndicator(current)
    }

    scroll.addEventListener('click', (e) => {
      const closeBtn = e.target.closest('.tab-item-close')
      if (closeBtn) {
        e.stopPropagation()
        const wrap = closeBtn.closest('[data-tab-id]')
        const all = getTabs()
        if (!wrap || all.length <= 1) return
        const wasActive = wrap.querySelector('.tab-item')?.classList.contains('active')
        wrap.remove()
        const next = getTabs()
        if (wasActive) activate(next[0].dataset.tabId)
        else moveIndicator(next.find((w) => w.querySelector('.tab-item.active')))
        return
      }
      const btn = e.target.closest('.tab-item')
      if (!btn) return
      const wrap = btn.closest('[data-tab-id]')
      if (wrap) activate(wrap.dataset.tabId)
    })

    window.addEventListener('resize', () => {
      const active = getTabs().find((w) => w.querySelector('.tab-item.active'))
      moveIndicator(active)
    })

    const initial = getTabs().find((w) => w.querySelector('.tab-item.active')) || getTabs()[0]
    if (initial) {
      requestAnimationFrame(() => activate(initial.dataset.tabId))
    }
  }

  window.initTabBar = initTabBar
})()

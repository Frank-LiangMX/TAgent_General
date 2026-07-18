const shell = document.querySelector('#prototype-shell')
const directionNote = document.querySelector('#direction-note')
const sidebar = document.querySelector('.sidebar')
const sidebarTitle = document.querySelector('#sidebar-title')
const sidebarMain = document.querySelector('#sidebar-main')
const inspectorTitle = document.querySelector('#inspector-title')
const inspectorBody = document.querySelector('#inspector-body')
const conversation = document.querySelector('#conversation')
const workspace = document.querySelector('.workspace')
const composer = document.querySelector('#composer-form')
const composerUnderlay = document.querySelector('#composer-underlay')
const sceneExitLabel = document.querySelector('#scene-exit-label')
const railTooltip = document.querySelector('#rail-tooltip')
const sidebarMorphSurface = document.querySelector('#sidebar-morph-surface')
const sidebarMorphTether = document.querySelector('#sidebar-morph-tether')
const prototypeMotionMode =
  new URLSearchParams(window.location.search).get('motion') || 'full'
document.body.dataset.motion = prototypeMotionMode

let sidebarContentSwitchVersion = 0
let sidebarMorphVersion = 0
let sidebarMorphAnimation = null
let sidebarTetherAnimation = null

const DIRECTION_NOTES = {
  instrument: '连续机身，一套边界，导航沿周边组织',
  spatial: '主画布优先，只有临时上下文使用语义浮层',
  editorial: '横向会话工作集，对话与设计形成双舞台',
}

const SECTION_CONTENT = {
  sessions: {
    title: '会话',
    groups: [
      {
        title: '默认工作区',
        items: [
          ['你好', 'Agent 任务已完成，等待下一步', '16:19'],
          ['页面样式可见吗', '设计预览与布局讨论', '周四'],
          ['看板测试任务', '3 个 Worker 已结束', '周三'],
        ],
      },
      {
        title: 'TAgent General',
        items: [
          ['UI layout refactor', 'feature/ui-polish', '今天'],
          ['TUN 启动诊断', '开发服务运行中', '今天'],
        ],
      },
    ],
  },
  draft: {
    title: '草稿',
    groups: [
      {
        title: '需求草稿',
        items: [
          ['桌面壳层重构', '包含布局、材质和动效约束', '刚刚'],
          ['TA 资产审核流程', '待补充 UE5 工具链', '昨天'],
          ['记忆层可视化', 'L0-L5 信息结构', '周二'],
        ],
      },
    ],
  },
  skills: {
    title: '插件',
    groups: [
      {
        title: '工作区能力',
        items: [
          ['Design Preview', '画布、分层与版本快照', '启用'],
          ['GitHub', '代码与 Pull Request 工作流', '可安装'],
          ['Blender Bridge', 'TA 模式资产工具', '启用'],
        ],
      },
    ],
  },
  kanban: {
    title: '看板',
    groups: [
      {
        title: 'Agent 任务编排',
        items: [
          ['布局调研', '完成', '3/3'],
          ['视觉原型', '正在进行', '2/4'],
          ['生产迁移', '等待基调确认', '0/5'],
        ],
      },
    ],
  },
  automation: {
    title: '自动任务',
    groups: [
      {
        title: '调度',
        items: [
          ['每日项目摘要', '工作日 18:00', '启用'],
          ['依赖更新检查', '每周一 09:30', '启用'],
          ['构建健康巡检', '手动运行', '闲置'],
        ],
      },
    ],
  },
  memory: {
    title: '记忆',
    groups: [
      {
        title: 'L0-L5 记忆层',
        items: [
          ['工作记忆', '当前会话上下文健康', '80%'],
          ['项目记忆', 'TAgent General', '同步'],
          ['长期记忆', '最近整理于今天', '24 条'],
        ],
      },
    ],
  },
  general: {
    title: '通用模式',
    groups: [{ title: '模式状态', items: [['通用 Agent', 'Chat / Agent / 草稿', '当前']] }],
  },
  ta: {
    title: 'TA 模式',
    groups: [
      {
        title: '技术美术工具',
        items: [
          ['资产库', '语义检索与批处理', '54 工具'],
          ['审核队列', '材质与模型检查', '6 项'],
          ['流水线', 'Blender / UE5', '就绪'],
        ],
      },
    ],
  },
  office: {
    title: 'AI Office',
    groups: [
      {
        title: '数字员工',
        items: [
          ['研究员', '收集设计基调参考', '工作中'],
          ['架构师', '检查布局层级', '工作中'],
          ['设计师', '输出静态原型', '工作中'],
        ],
      },
    ],
  },
}

const PANEL_CONTENT = {
  files: ['文件', '项目文件树', '12 个变更待查看'],
  btw: ['旁注', '快速询问', '不会写入主对话历史'],
  browser: ['预览', '浏览器与文档预览', '当前地址可在画布中打开'],
  design: ['Design Preview', '等待 Agent 生成 UI 原型', '选中元素后可直接告诉 Agent 修改这里'],
  crew: ['班组', '3 个 Worker 正在运行', '研究、架构与设计任务同步进行'],
}

function renderSidebar(section) {
  const config = SECTION_CONTENT[section] || SECTION_CONTENT.sessions
  sidebarTitle.textContent = config.title
  sidebarMain.replaceChildren(
    ...config.groups.map((group, groupIndex) => {
      const block = document.createElement('section')
      block.className = 'project-block'
      block.innerHTML = `
        <button class="project-heading" type="button">
          <i class="ph ph-caret-down" aria-hidden="true"></i><strong>${group.title}</strong><small>${group.items.length}</small>
        </button>
        <div class="session-list">
          ${group.items
            .map(
              ([title, detail, meta], index) => `
                <button class="session-row ${groupIndex === 0 && index === 0 ? 'is-active' : ''}" type="button">
                  <span class="session-title">${title}</span><time>${meta}</time><small>${detail}</small>
                </button>`
            )
            .join('')}
        </div>`
      return block
    })
  )
}

function setDirection(direction) {
  shell.classList.add('is-changing')
  document.body.dataset.direction = direction
  window.setTimeout(() => {
    shell.classList.remove('direction-instrument', 'direction-spatial', 'direction-editorial')
    shell.classList.add(`direction-${direction}`)
    if (direction === 'spatial' && !shell.className.includes('spatial-state-')) {
      setSpatialState('standard')
    }
    shell.classList.remove('is-changing')
    directionNote.textContent = DIRECTION_NOTES[direction]
    localStorage.setItem('tagent-layout-study-direction', direction)
  }, 130)

  document.querySelectorAll('.direction-tab').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.direction === direction)
  })
}

function setSpatialState(state, { preserveSidebar = false } = {}) {
  resetSidebarMorph()
  shell.classList.remove(
    'spatial-state-standard',
    'spatial-state-focus',
    'spatial-state-canvas',
    'spatial-state-office'
  )
  shell.classList.add(`spatial-state-${state}`)
  if (!preserveSidebar) {
    shell.classList.toggle('is-sidebar-hidden', state !== 'standard')
  }
  shell.classList.toggle('is-inspector-hidden', state !== 'standard')
  workspace.classList.remove('is-composer-expanded')
  sceneExitLabel.textContent =
    state === 'office' ? '返回 Spatial Workspace' : '返回对话工作区'
  document.querySelectorAll('[data-spatial-state]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.spatialState === state)
  })
  localStorage.setItem('tagent-layout-study-spatial-state', state)
}

async function transitionSpatialState(state) {
  if (state === 'focus') {
    await closeSidebarToRail()
    setSpatialState('focus', { preserveSidebar: true })
    return
  }

  if (state === 'standard' && shell.classList.contains('is-sidebar-hidden')) {
    setSpatialState('standard', { preserveSidebar: true })
    await openSidebarFromRail()
    return
  }

  setSpatialState(state)
}

function setPlatform(platform) {
  shell.dataset.platform = platform
  document.querySelectorAll('.platform-button').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.platform === platform)
  })
  localStorage.setItem('tagent-layout-study-platform', platform)
}

function setRailVariant(variant, animate = true) {
  const applyVariant = () => {
    shell.classList.remove('rail-variant-solid', 'rail-variant-split')
    shell.classList.add(`rail-variant-${variant}`)
    document.querySelectorAll('[data-rail-variant]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.railVariant === variant)
    })
    localStorage.setItem('tagent-layout-study-rail-variant', variant)
  }

  if (!animate) {
    applyVariant()
    return
  }

  shell.classList.add('is-rail-changing')
  window.setTimeout(() => {
    applyVariant()
    window.setTimeout(() => shell.classList.remove('is-rail-changing'), 40)
  }, 120)
}

function setSurfaceVariant(variant, animate = true) {
  const applyVariant = () => {
    shell.classList.remove('surface-variant-panel', 'surface-variant-field')
    shell.classList.add(`surface-variant-${variant}`)
    document.querySelectorAll('[data-surface-variant]').forEach((button) => {
      button.classList.toggle('is-active', button.dataset.surfaceVariant === variant)
    })
    localStorage.setItem('tagent-layout-study-surface-variant', variant)
  }

  if (!animate) {
    applyVariant()
    return
  }

  shell.classList.add('is-surface-changing')
  window.setTimeout(() => {
    applyVariant()
    window.setTimeout(() => shell.classList.remove('is-surface-changing'), 40)
  }, 120)
}

function setSection(section, { animateContent = false } = {}) {
  document.querySelectorAll('[data-section]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.section === section)
  })

  if (!animateContent) {
    renderSidebar(section)
    return
  }

  const version = ++sidebarContentSwitchVersion
  sidebarMain.classList.add('is-switching')
  window.setTimeout(() => {
    if (version !== sidebarContentSwitchVersion) return
    renderSidebar(section)
    window.requestAnimationFrame(() => sidebarMain.classList.remove('is-switching'))
  }, 90)
}

function showRailTooltip(target) {
  const label = target.dataset.label
  if (!label) return

  const overlayRect = railTooltip.parentElement.getBoundingClientRect()
  const targetRect = target.getBoundingClientRect()
  railTooltip.textContent = label
  railTooltip.style.left = `${targetRect.right - overlayRect.left + 10}px`
  railTooltip.style.top = `${targetRect.top - overlayRect.top + targetRect.height / 2}px`
  railTooltip.classList.add('is-visible')
  target.setAttribute('aria-describedby', 'rail-tooltip')
}

function hideRailTooltip(target) {
  railTooltip.classList.remove('is-visible')
  target?.removeAttribute('aria-describedby')
}

function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration))
}

function waitForLayout() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
  })
}

function prefersReducedMotion() {
  if (prototypeMotionMode === 'reduced') return true
  if (prototypeMotionMode === 'system') {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }
  return false
}

function getActiveRailSource() {
  return (
    document.querySelector('.function-rail .rail-button.is-active') ||
    document.querySelector('.function-rail .rail-button[data-section="sessions"]')
  )
}

function resetSidebarMorph() {
  sidebarMorphVersion += 1
  sidebarMorphAnimation?.cancel()
  sidebarTetherAnimation?.cancel()
  sidebarMorphAnimation = null
  sidebarTetherAnimation = null
  sidebarMorphSurface.classList.remove('is-active', 'is-opening', 'is-closing')
  sidebarMorphSurface.removeAttribute('style')
  sidebarMorphSurface.replaceChildren()
  sidebarMorphTether.classList.remove('is-active')
  sidebarMorphTether.removeAttribute('style')
  shell.classList.remove(
    'is-sidebar-morphing',
    'is-sidebar-content-leaving',
    'is-sidebar-revealing'
  )
  document.querySelectorAll('.rail-button').forEach((button) => {
    button.classList.remove('is-morph-absorbing', 'is-morph-emitting')
  })
}

function prepareSidebarMorphSurface(targetRect) {
  const overlayRect = sidebarMorphSurface.parentElement.getBoundingClientRect()
  Object.assign(sidebarMorphSurface.style, {
    left: `${targetRect.left - overlayRect.left}px`,
    top: `${targetRect.top - overlayRect.top}px`,
    width: `${targetRect.width}px`,
    height: `${targetRect.height}px`,
  })
  sidebarMorphSurface.innerHTML = `
    <div class="sidebar-morph-ghost">
      <span class="sidebar-morph-mark"><i class="ph ph-sparkle"></i></span>
      <div><small>WORKSPACE</small><strong>${sidebarTitle.textContent}</strong></div>
    </div>`
  sidebarMorphSurface.classList.add('is-active')
}

function prepareSidebarMorphTether(sourceRect, targetRect) {
  const overlayRect = sidebarMorphTether.parentElement.getBoundingClientRect()
  const sourceCenterX = sourceRect.left + sourceRect.width / 2
  const sourceCenterY = sourceRect.top + sourceRect.height / 2
  Object.assign(sidebarMorphTether.style, {
    left: `${sourceCenterX - overlayRect.left}px`,
    top: `${sourceCenterY - overlayRect.top - 9}px`,
    width: `${Math.max(18, targetRect.left - sourceCenterX + 18)}px`,
  })
  sidebarMorphTether.classList.add('is-active')
}

function localMorphRect(rect) {
  const overlayRect = sidebarMorphSurface.parentElement.getBoundingClientRect()
  return {
    left: rect.left - overlayRect.left,
    top: rect.top - overlayRect.top,
    width: rect.width,
    height: rect.height,
  }
}

function morphGeometry(rect, opacity, borderRadius) {
  return {
    left: `${rect.left}px`,
    top: `${rect.top}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    opacity,
    borderRadius,
  }
}

function sidebarMorphPath(sourceRect, targetRect) {
  const source = localMorphRect(sourceRect)
  const target = localMorphRect(targetRect)
  const sourceRight = source.left + source.width
  const sourceCenterY = source.top + source.height / 2
  const streamRight = target.left + Math.max(116, target.width * 0.38)
  return {
    source,
    target,
    gathered: {
      left: target.left - 10,
      top: target.top + (sourceCenterY - target.top) * 0.14,
      width: target.width * 0.76,
      height: target.height * 0.8,
    },
    stream: {
      left: sourceRight + 5,
      top: sourceCenterY - 68,
      width: Math.max(112, streamRight - sourceRight),
      height: 136,
    },
    droplet: {
      left: sourceRight + 4,
      top: sourceCenterY - 44,
      width: Math.max(70, target.width * 0.24),
      height: 88,
    },
  }
}

async function openSidebarFromRail(sourceButton = getActiveRailSource()) {
  if (!shell.classList.contains('direction-spatial')) {
    shell.classList.remove('is-sidebar-hidden')
    return
  }
  if (!shell.classList.contains('is-sidebar-hidden')) return

  resetSidebarMorph()
  const version = sidebarMorphVersion
  hideRailTooltip(sourceButton)

  if (prefersReducedMotion()) {
    shell.classList.remove('is-sidebar-hidden')
    return
  }

  const sourceRect = sourceButton.getBoundingClientRect()
  sourceButton.classList.add('is-morph-emitting')
  shell.classList.add('is-sidebar-morphing')
  shell.classList.remove('is-sidebar-hidden')
  await waitForLayout()
  if (version !== sidebarMorphVersion) return

  const targetRect = sidebar.getBoundingClientRect()
  prepareSidebarMorphSurface(targetRect)
  prepareSidebarMorphTether(sourceRect, targetRect)
  sidebarMorphSurface.classList.add('is-opening')
  const path = sidebarMorphPath(sourceRect, targetRect)
  sidebarMorphAnimation = sidebarMorphSurface.animate(
    [
      { ...morphGeometry(path.source, 0, '18px'), easing: 'cubic-bezier(.16,.72,.18,1)' },
      { ...morphGeometry(path.droplet, 0.9, '18px 34px 34px 18px'), offset: 0.22 },
      { ...morphGeometry(path.stream, 0.94, '20px 38px 38px 20px'), offset: 0.46 },
      { ...morphGeometry(path.gathered, 0.98, '26px'), offset: 0.74 },
      morphGeometry(path.target, 1, '22px'),
    ],
    { duration: 500, easing: 'cubic-bezier(.18,.72,.14,1)', fill: 'forwards' }
  )
  sidebarTetherAnimation = sidebarMorphTether.animate(
    [
      { opacity: 0, transform: 'scaleX(0.04)' },
      { opacity: 0.66, offset: 0.22, transform: 'scaleX(0.58)' },
      { opacity: 0.46, offset: 0.68, transform: 'scaleX(1)' },
      { opacity: 0, transform: 'scaleX(1)' },
    ],
    { duration: 500, easing: 'cubic-bezier(.18,.72,.14,1)', fill: 'forwards' }
  )

  await sidebarMorphAnimation.finished.catch(() => undefined)
  if (version !== sidebarMorphVersion) return
  sidebarMorphSurface.classList.remove('is-active', 'is-opening')
  sidebarMorphSurface.removeAttribute('style')
  sidebarMorphSurface.replaceChildren()
  sidebarMorphTether.classList.remove('is-active')
  sidebarMorphTether.removeAttribute('style')
  sidebarMorphAnimation = null
  sidebarTetherAnimation = null
  shell.classList.remove('is-sidebar-morphing')
  sourceButton.classList.remove('is-morph-emitting')
  shell.classList.add('is-sidebar-revealing')
  window.setTimeout(() => shell.classList.remove('is-sidebar-revealing'), 190)
}

async function closeSidebarToRail(sourceButton = getActiveRailSource()) {
  if (!shell.classList.contains('direction-spatial')) {
    shell.classList.add('is-sidebar-hidden')
    return
  }
  if (shell.classList.contains('is-sidebar-hidden')) return

  resetSidebarMorph()
  const version = sidebarMorphVersion
  hideRailTooltip(sourceButton)

  if (prefersReducedMotion()) {
    shell.classList.add('is-sidebar-hidden')
    return
  }

  shell.classList.add('is-sidebar-content-leaving')
  await wait(70)
  if (version !== sidebarMorphVersion) return

  const targetRect = sidebar.getBoundingClientRect()
  const sourceRect = sourceButton.getBoundingClientRect()
  sourceButton.classList.add('is-morph-absorbing')
  prepareSidebarMorphSurface(targetRect)
  prepareSidebarMorphTether(sourceRect, targetRect)
  sidebarMorphSurface.classList.add('is-closing')
  const path = sidebarMorphPath(sourceRect, targetRect)
  shell.classList.add('is-sidebar-morphing', 'is-sidebar-hidden')
  shell.classList.remove('is-sidebar-content-leaving')

  sidebarMorphAnimation = sidebarMorphSurface.animate(
    [
      {
        ...morphGeometry(path.target, 1, '22px'),
        easing: 'cubic-bezier(.34,0,.56,.42)',
      },
      {
        ...morphGeometry(path.gathered, 0.97, '26px'),
        offset: 0.3,
        easing: 'cubic-bezier(.18,.72,.14,1)',
      },
      { ...morphGeometry(path.stream, 0.94, '20px 38px 38px 20px'), offset: 0.6 },
      { ...morphGeometry(path.droplet, 0.86, '18px 34px 34px 18px'), offset: 0.82 },
      morphGeometry(path.source, 0, '18px'),
    ],
    { duration: 460, easing: 'linear', fill: 'forwards' }
  )
  sidebarTetherAnimation = sidebarMorphTether.animate(
    [
      { opacity: 0, transform: 'scaleX(1)' },
      { opacity: 0.62, offset: 0.18, transform: 'scaleX(1)' },
      { opacity: 0.48, offset: 0.7, transform: 'scaleX(0.54)' },
      { opacity: 0, transform: 'scaleX(0.03)' },
    ],
    { duration: 460, easing: 'cubic-bezier(.34,0,.14,1)', fill: 'forwards' }
  )

  await sidebarMorphAnimation.finished.catch(() => undefined)
  if (version !== sidebarMorphVersion) return
  sidebarMorphSurface.classList.remove('is-active', 'is-closing')
  sidebarMorphSurface.removeAttribute('style')
  sidebarMorphSurface.replaceChildren()
  sidebarMorphTether.classList.remove('is-active')
  sidebarMorphTether.removeAttribute('style')
  sidebarMorphAnimation = null
  sidebarTetherAnimation = null
  shell.classList.remove('is-sidebar-morphing')
  window.setTimeout(() => sourceButton.classList.remove('is-morph-absorbing'), 40)
}

function setInspectorPanel(panel) {
  const [title, headline, detail] = PANEL_CONTENT[panel] || PANEL_CONTENT.design
  inspectorTitle.textContent = title
  document.querySelectorAll('.inspector-tab').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.panel === panel)
  })

  const emptyIcon = panel === 'crew' ? 'ph-users-three' : panel === 'files' ? 'ph-files' : 'ph-sparkle'
  inspectorBody.innerHTML = `
    <div class="canvas-toolbar">
      <button type="button">${panel === 'design' ? '分层' : '选项'}</button>
      <button type="button">${panel === 'files' ? '刷新' : '导入'}</button>
      <span>${panel === 'crew' ? '3 人' : '100%'}</span>
    </div>
    <div class="design-canvas">
      <div class="canvas-grid" aria-hidden="true"></div>
      <div class="canvas-empty">
        <span><i class="ph ${emptyIcon}" aria-hidden="true"></i></span>
        <strong>${headline}</strong>
        <small>${detail}</small>
      </div>
    </div>
    <div class="version-strip">
      <button type="button">v1</button><button type="button">v2</button><button class="is-active" type="button">v3</button>
    </div>`
}

document.querySelectorAll('.direction-tab').forEach((button) => {
  button.addEventListener('click', () => setDirection(button.dataset.direction))
})

document.querySelectorAll('.platform-button').forEach((button) => {
  button.addEventListener('click', () => setPlatform(button.dataset.platform))
})

document.querySelectorAll('[data-rail-variant]').forEach((button) => {
  button.addEventListener('click', () => setRailVariant(button.dataset.railVariant))
})

document.querySelectorAll('[data-surface-variant]').forEach((button) => {
  button.addEventListener('click', () => setSurfaceVariant(button.dataset.surfaceVariant))
})

document.querySelectorAll('[data-spatial-state]').forEach((button) => {
  button.addEventListener('click', () => transitionSpatialState(button.dataset.spatialState))
})

document.querySelectorAll('[data-section]').forEach((button) => {
  button.addEventListener('click', () => {
    const isRailSource = Boolean(button.closest('.function-rail'))
    const sidebarWasHidden = shell.classList.contains('is-sidebar-hidden')
    const sectionChanged = !button.classList.contains('is-active')
    setSection(button.dataset.section, {
      animateContent: isRailSource && sectionChanged && !sidebarWasHidden,
    })
    if (isRailSource && sidebarWasHidden) openSidebarFromRail(button)
  })
})

document.querySelectorAll('.rail-button[data-label], .rail-avatar[data-label]').forEach((button) => {
  button.addEventListener('mouseenter', () => showRailTooltip(button))
  button.addEventListener('mouseleave', () => hideRailTooltip(button))
  button.addEventListener('focus', () => showRailTooltip(button))
  button.addEventListener('blur', () => hideRailTooltip(button))
})

window.addEventListener('resize', () => hideRailTooltip())

document.querySelectorAll('.inspector-tab').forEach((button) => {
  button.addEventListener('click', () => setInspectorPanel(button.dataset.panel))
})

document.querySelector('#toggle-inspector').addEventListener('click', () => {
  shell.classList.toggle('is-inspector-hidden')
})

document.querySelector('#close-inspector').addEventListener('click', () => {
  shell.classList.add('is-inspector-hidden')
})

document.querySelector('#close-sidebar').addEventListener('click', () => {
  closeSidebarToRail()
})

document.querySelector('.inspector-peek').addEventListener('click', () => {
  shell.classList.remove('is-inspector-hidden')
})

document.querySelector('.scene-exit').addEventListener('click', () => {
  setSpatialState('standard')
})

composer.addEventListener('focusin', () => {
  workspace.classList.add('is-composer-expanded')
})

document.addEventListener('pointerdown', (event) => {
  if (composer.contains(event.target) || composerUnderlay.contains(event.target)) return
  workspace.classList.remove('is-composer-expanded')
})

document.querySelector('#composer-form').addEventListener('submit', (event) => {
  event.preventDefault()
  const input = document.querySelector('#composer-input')
  const text = input.value.trim()
  if (!text) return

  const message = document.createElement('article')
  message.className = 'message message-user'
  const paragraph = document.createElement('p')
  paragraph.textContent = text
  message.append(paragraph)
  conversation.append(message)
  conversation.scrollTop = conversation.scrollHeight
  input.value = ''
})

document.querySelectorAll('.session-row, .ribbon-session').forEach((button) => {
  button.addEventListener('click', () => {
    const scope = button.closest('.session-list, .session-ribbon')
    scope?.querySelectorAll('.is-active').forEach((item) => item.classList.remove('is-active'))
    button.classList.add('is-active')
  })
})

const previewParams = new URLSearchParams(window.location.search)
const requestedDirection = previewParams.get('direction')
const requestedPlatform = previewParams.get('platform')
const requestedSpatialState = previewParams.get('state')
const requestedComposerState = previewParams.get('composer')
const requestedRailVariant = previewParams.get('rail')
const requestedSurfaceVariant = previewParams.get('surface')
const savedDirection = localStorage.getItem('tagent-layout-study-direction')
const savedPlatform = localStorage.getItem('tagent-layout-study-platform')
const savedSpatialState = localStorage.getItem('tagent-layout-study-spatial-state')
const savedRailVariant = localStorage.getItem('tagent-layout-study-rail-variant')
const savedSurfaceVariant = localStorage.getItem('tagent-layout-study-surface-variant')

if (requestedDirection && DIRECTION_NOTES[requestedDirection]) {
  setDirection(requestedDirection)
} else if (savedDirection && DIRECTION_NOTES[savedDirection]) {
  setDirection(savedDirection)
}

if (requestedPlatform === 'mac' || requestedPlatform === 'windows') {
  setPlatform(requestedPlatform)
} else if (savedPlatform === 'mac' || savedPlatform === 'windows') {
  setPlatform(savedPlatform)
}

if (requestedRailVariant === 'solid' || requestedRailVariant === 'split') {
  setRailVariant(requestedRailVariant, false)
} else if (savedRailVariant === 'solid' || savedRailVariant === 'split') {
  setRailVariant(savedRailVariant, false)
} else {
  setRailVariant('split', false)
}

if (requestedSurfaceVariant === 'panel' || requestedSurfaceVariant === 'field') {
  setSurfaceVariant(requestedSurfaceVariant, false)
} else if (savedSurfaceVariant === 'panel' || savedSurfaceVariant === 'field') {
  setSurfaceVariant(savedSurfaceVariant, false)
} else {
  setSurfaceVariant('field', false)
}

if (['standard', 'focus', 'canvas', 'office'].includes(requestedSpatialState)) {
  setSpatialState(requestedSpatialState)
} else if (['standard', 'focus', 'canvas', 'office'].includes(savedSpatialState)) {
  setSpatialState(savedSpatialState)
} else {
  setSpatialState('standard')
}

if (requestedComposerState === 'expanded') {
  workspace.classList.add('is-composer-expanded')
}

if (previewParams.get('selftest') === '1') {
  window.setTimeout(() => {
    document.querySelector('[data-direction="spatial"]').click()
    window.setTimeout(async () => {
      document.querySelector('[data-section="kanban"]').click()
      document.querySelector('[data-panel="crew"]').click()
      await wait(120)
      document.querySelector('#composer-input').value = '把这个方向的侧栏再轻一点'
      document.querySelector('#composer-form').requestSubmit()
      document.querySelector('[data-platform="mac"]').click()

      document.querySelector('#composer-input').focus()
      const composerExpanded = workspace.classList.contains('is-composer-expanded')
      setRailVariant('solid', false)
      const solidRail = shell.classList.contains('rail-variant-solid')
      setRailVariant('split', false)
      const splitRail =
        shell.classList.contains('rail-variant-split') &&
        document.querySelector('[data-rail-variant="split"]').classList.contains('is-active')
      setSurfaceVariant('panel', false)
      const panelSurface = shell.classList.contains('surface-variant-panel')
      setSurfaceVariant('field', false)
      const fieldSurface =
        shell.classList.contains('surface-variant-field') &&
        document.querySelector('[data-surface-variant="field"]').classList.contains('is-active')
      setSpatialState('focus')
      const focusState =
        shell.classList.contains('spatial-state-focus') &&
        shell.classList.contains('is-sidebar-hidden') &&
        shell.classList.contains('is-inspector-hidden')
      setSpatialState('canvas')
      const canvasState = shell.classList.contains('spatial-state-canvas')
      document.querySelector('.scene-exit').click()
      const returnedToStandard = shell.classList.contains('spatial-state-standard')
      const tooltipTarget = document.querySelector('.rail-button[data-section="skills"]')
      showRailTooltip(tooltipTarget)
      const tooltipUsesGlobalLayer =
        railTooltip.classList.contains('is-visible') &&
        Boolean(railTooltip.closest('.preview-stage')) &&
        !railTooltip.closest('.prototype-shell')
      hideRailTooltip(tooltipTarget)
      const morphTarget = getActiveRailSource()
      await closeSidebarToRail(morphTarget)
      const sidebarMorphClosed =
        shell.classList.contains('is-sidebar-hidden') &&
        !sidebarMorphSurface.classList.contains('is-active')
      const sidebarHasNoDetachedPeek =
        !document.querySelector('.sidebar-peek') && Boolean(getActiveRailSource())
      await openSidebarFromRail(morphTarget)
      const sidebarMorphOpened =
        !shell.classList.contains('is-sidebar-hidden') &&
        !sidebarMorphSurface.classList.contains('is-active')

      const checks = [
        shell.classList.contains('direction-spatial'),
        shell.dataset.platform === 'mac',
        composerExpanded,
        solidRail,
        splitRail,
        panelSurface,
        fieldSurface,
        focusState,
        canvasState,
        returnedToStandard,
        tooltipUsesGlobalLayer,
        sidebarMorphClosed,
        sidebarHasNoDetachedPeek,
        sidebarMorphOpened,
        sidebarTitle.textContent === '看板',
        inspectorTitle.textContent === '班组',
        [...document.querySelectorAll('.message-user p')].at(-1)?.textContent ===
          '把这个方向的侧栏再轻一点',
      ]
      shell.dataset.selftestFailures = checks
        .map((passed, index) => (passed ? null : index))
        .filter((index) => index !== null)
        .join(',')
      shell.dataset.selftest = checks.every(Boolean) ? 'passed' : 'failed'
    }, 220)
  }, 220)
}

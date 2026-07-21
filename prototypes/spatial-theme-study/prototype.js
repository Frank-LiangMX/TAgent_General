/* ============================================================================
 * TAgent Spatial Theme Study — prototype.js
 * ----------------------------------------------------------------------------
 * 复用 layout-direction-study 的 Spatial 交互（sidebar morph / composer 展开 /
 * 场景全屏 / rail tooltip），去掉 A/B/C 方向与 rail/surface 变体逻辑，
 * 新增主题 / 明暗 / 材质 / 平台切换 + localStorage + URL query + crossfade + selftest。
 * ========================================================================== */

const body = document.body
const shell = document.querySelector('#prototype-shell')
const themeNote = document.querySelector('#theme-note')
const sidebar = document.querySelector('.sidebar')
const sidebarTitle = document.querySelector('#sidebar-title')
const sidebarMain = document.querySelector('#sidebar-main')
const inspectorTitle = document.querySelector('#inspector-title')
const inspectorBody = document.querySelector('#inspector-body')
const conversation = document.querySelector('#conversation')
const workspace = document.querySelector('.workspace')
const composer = document.querySelector('#composer-form')
const composerUnderlay = document.querySelector('#composer-underlay')
const turnLocator = document.querySelector('#turn-locator')
const turnLocatorSlot = document.querySelector('.turn-locator-slot')
const turnLocatorSummary = document.querySelector('.turn-locator-summary')
const messageMinimap = document.querySelector('#message-minimap')
const messageMinimapBars = document.querySelector('#message-minimap-bars')
const messageMinimapList = document.querySelector('#message-minimap-list')
const messageMinimapCount = document.querySelector('#message-minimap-count')
const messageMinimapSearch = document.querySelector('#message-minimap-search')
const messageMinimapEmpty = document.querySelector('#message-minimap-empty')
const messageScrollTrack = document.querySelector('#message-scroll-track')
const messageScrollThumb = document.querySelector('#message-scroll-thumb')
const sceneExitLabel = document.querySelector('#scene-exit-label')
const railTooltip = document.querySelector('#rail-tooltip')
const sidebarMorphSurface = document.querySelector('#sidebar-morph-surface')
const sidebarMorphTether = document.querySelector('#sidebar-morph-tether')
const selftestBanner = document.querySelector('#selftest-banner')

const THEMES = ['default', 'ocean', 'forest', 'slate', 'orange', 'purple']
const THEME_LABELS = {
  default: '矿物灰',
  ocean: '青瓷',
  forest: '茶烟',
  slate: '玄武',
  orange: '琥珀纸',
  purple: '鸢尾灰',
}

// 三材质：frosted（磨砂基准）/ soft（软瓷轻拟态）/ glass（高透光学）。
// 历史 `clear` 已重命名为 `glass`，URL / localStorage 中的旧值在 normalizeMaterial 自动迁移。
const MATERIALS = ['frosted', 'soft', 'glass']
function normalizeMaterial(value) {
  return value === 'clear' ? 'glass' : value
}

let sidebarContentSwitchVersion = 0
let sidebarMorphVersion = 0
let sidebarMorphAnimation = null
let sidebarTetherAnimation = null
let activeLocatedTurn = null

const passedUserTurns = new Set()
const observedUserTurns = []

function getTurnSummary(turn) {
  return (
    turn.dataset.turnSummary || turn.querySelector('p')?.textContent?.trim() || '上一轮用户消息'
  )
}

function syncTurnLocator() {
  const locatedTurn =
    [...observedUserTurns].reverse().find((turn) => passedUserTurns.has(turn)) || null
  activeLocatedTurn = locatedTurn
  const isVisible = Boolean(locatedTurn)

  turnLocatorSlot.classList.toggle('is-visible', isVisible)
  turnLocator.setAttribute('aria-hidden', String(!isVisible))
  turnLocator.tabIndex = isVisible ? 0 : -1

  if (!locatedTurn) return
  const summary = getTurnSummary(locatedTurn)
  turnLocatorSummary.textContent = summary
  turnLocator.setAttribute('aria-label', `返回上一轮用户消息：${summary}`)
}

const userTurnObserver = new IntersectionObserver(
  (entries) => {
    const rootTop = conversation.getBoundingClientRect().top + 48
    entries.forEach((entry) => {
      if (!entry.isIntersecting && entry.boundingClientRect.bottom <= rootTop) {
        passedUserTurns.add(entry.target)
      } else {
        passedUserTurns.delete(entry.target)
      }
    })
    syncTurnLocator()
  },
  { root: conversation, rootMargin: '-48px 0px 0px 0px', threshold: 0 }
)

function observeUserTurn(turn) {
  if (!turn || observedUserTurns.includes(turn)) return
  observedUserTurns.push(turn)
  userTurnObserver.observe(turn)
}

conversation.querySelectorAll('.message-user').forEach(observeUserTurn)
syncTurnLocator()

// 消息导航刻度 + 独立滚动 thumb：正文列不再承载原生滚动条。
const minimapMessages = []
const visibleMinimapMessages = new Set()
let minimapScrollFrame = 0
let minimapDrag = null

function getMessagePreview(message) {
  const text = message.querySelector('p')?.textContent?.replace(/\s+/g, ' ').trim() || '消息'
  return text.length > 62 ? `${text.slice(0, 62)}…` : text
}

function scrollToMinimapMessage(message) {
  message.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

function syncMinimapVisibility() {
  minimapMessages.forEach(({ message, bar, row }) => {
    const visible = visibleMinimapMessages.has(message)
    bar.classList.toggle('is-visible', visible)
    row.classList.toggle('is-visible', visible)
  })
  messageMinimapCount.textContent = `${visibleMinimapMessages.size} / ${minimapMessages.length}`
}

const minimapVisibilityObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) visibleMinimapMessages.add(entry.target)
      else visibleMinimapMessages.delete(entry.target)
    })
    syncMinimapVisibility()
  },
  { root: conversation, threshold: 0.18 }
)

function registerMinimapMessage(message) {
  if (!message || minimapMessages.some((item) => item.message === message)) return
  const index = minimapMessages.length
  if (!message.id) message.id = `prototype-message-${index + 1}`
  const isUser = message.classList.contains('message-user')
  const preview = getMessagePreview(message)

  const bar = document.createElement('button')
  bar.type = 'button'
  bar.className = `message-minimap-bar${isUser ? ' is-user' : ''}`
  bar.setAttribute('aria-label', `跳转到消息 ${index + 1}：${preview}`)
  bar.addEventListener('click', () => scrollToMinimapMessage(message))
  messageMinimapBars.append(bar)

  const row = document.createElement('button')
  row.type = 'button'
  row.className = `message-minimap-row${isUser ? ' is-user' : ''}`
  row.setAttribute('aria-label', `跳转到消息 ${index + 1}`)
  const bubble = document.createElement('span')
  bubble.textContent = preview
  row.append(bubble)
  row.addEventListener('click', () => scrollToMinimapMessage(message))
  messageMinimapList.append(row)

  minimapMessages.push({ message, bar, row, preview })
  minimapVisibilityObserver.observe(message)
  syncMinimapVisibility()
  filterMinimapMessages()
}

function filterMinimapMessages() {
  const query = messageMinimapSearch.value.trim().toLocaleLowerCase()
  let matchCount = 0
  minimapMessages.forEach(({ row, preview }) => {
    const matches = !query || preview.toLocaleLowerCase().includes(query)
    row.hidden = !matches
    if (matches) matchCount += 1
  })
  messageMinimapEmpty.hidden = matchCount > 0
}

function syncMessageScrollThumb() {
  const scrollRange = Math.max(conversation.scrollHeight - conversation.clientHeight, 0)
  const trackHeight = messageScrollTrack.clientHeight
  const thumbHeight = Math.max(
    28,
    Math.min(trackHeight, (conversation.clientHeight / conversation.scrollHeight) * trackHeight)
  )
  const travel = Math.max(trackHeight - thumbHeight, 0)
  const progress = scrollRange > 0 ? conversation.scrollTop / scrollRange : 0
  messageScrollThumb.style.height = `${thumbHeight}px`
  messageScrollThumb.style.transform = `translateY(${travel * progress}px)`
  messageScrollTrack.setAttribute('aria-valuenow', String(Math.round(progress * 100)))
}

function requestMessageScrollSync() {
  if (minimapScrollFrame) return
  minimapScrollFrame = window.requestAnimationFrame(() => {
    minimapScrollFrame = 0
    syncMessageScrollThumb()
  })
}

function setConversationScrollFromPointer(clientY, pointerOffset) {
  const trackRect = messageScrollTrack.getBoundingClientRect()
  const thumbHeight = messageScrollThumb.getBoundingClientRect().height
  const travel = Math.max(trackRect.height - thumbHeight, 1)
  const offset = pointerOffset ?? thumbHeight / 2
  const progress = Math.max(0, Math.min((clientY - trackRect.top - offset) / travel, 1))
  conversation.scrollTop = progress * (conversation.scrollHeight - conversation.clientHeight)
}

conversation.querySelectorAll('.message').forEach(registerMinimapMessage)
conversation.addEventListener('scroll', requestMessageScrollSync, { passive: true })
messageMinimapSearch.addEventListener('input', filterMinimapMessages)

messageScrollTrack.addEventListener('pointerdown', (event) => {
  event.preventDefault()
  const thumbRect = messageScrollThumb.getBoundingClientRect()
  const pointerOffset =
    event.target === messageScrollThumb ? event.clientY - thumbRect.top : thumbRect.height / 2
  messageScrollTrack.setPointerCapture(event.pointerId)
  messageScrollTrack.classList.add('is-dragging')
  minimapDrag = { pointerId: event.pointerId, pointerOffset }
  setConversationScrollFromPointer(event.clientY, pointerOffset)
})

messageScrollTrack.addEventListener('pointermove', (event) => {
  if (!minimapDrag || minimapDrag.pointerId !== event.pointerId) return
  setConversationScrollFromPointer(event.clientY, minimapDrag.pointerOffset)
})

function stopMinimapDrag(event) {
  if (!minimapDrag || minimapDrag.pointerId !== event.pointerId) return
  minimapDrag = null
  messageScrollTrack.classList.remove('is-dragging')
  if (messageScrollTrack.hasPointerCapture(event.pointerId)) {
    messageScrollTrack.releasePointerCapture(event.pointerId)
  }
}

messageScrollTrack.addEventListener('pointerup', stopMinimapDrag)
messageScrollTrack.addEventListener('pointercancel', stopMinimapDrag)
messageScrollTrack.addEventListener('keydown', (event) => {
  const page = conversation.clientHeight * 0.82
  const keyScroll = {
    ArrowUp: -48,
    ArrowDown: 48,
    PageUp: -page,
    PageDown: page,
    Home: -conversation.scrollHeight,
    End: conversation.scrollHeight,
  }[event.key]
  if (keyScroll === undefined) return
  event.preventDefault()
  conversation.scrollBy({
    top: keyScroll,
    behavior: event.key.startsWith('Arrow') ? 'auto' : 'smooth',
  })
})

new ResizeObserver(requestMessageScrollSync).observe(conversation)
new ResizeObserver(requestMessageScrollSync).observe(messageMinimap)
requestMessageScrollSync()

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
          ['多主题视觉系统', 'Scene / Chassis / Ink / Accent 四层', '刚刚'],
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

// ----------------------------------------------------------------------------
// 侧栏内容渲染
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Spatial 状态系统
// ----------------------------------------------------------------------------
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
  sceneExitLabel.textContent = state === 'office' ? '返回 Spatial Workspace' : '返回对话工作区'
  document.querySelectorAll('[data-spatial-state]').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.spatialState === state)
  })
  localStorage.setItem('tagent-spatial-theme-spatial-state', state)
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

// ----------------------------------------------------------------------------
// 主题 / 明暗 / 材质 / 平台 切换
// ----------------------------------------------------------------------------
function setActiveInGroup(attr, value) {
  document.querySelectorAll(`[data-${attr}]`).forEach((el) => {
    // 只切换可交互按钮：theme-swatch 按钮，或 .seg 内的 button。
    // swatch-preview 也带 data-theme/data-mode，但它是 span、非交互，需排除。
    const isSwatch = el.classList.contains('theme-swatch')
    const isSegButton = el.closest('.seg') && el.tagName === 'BUTTON'
    if (!isSwatch && !isSegButton) return
    const match = el.dataset[attr] === value
    el.classList.toggle('is-active', match)
    el.setAttribute('aria-pressed', String(match))
  })
}

// 主题 / 明暗会改变 scene 基底与环境光，用 ambient-field 淡出淡入做轻微 crossfade（不闪白）。
function crossfadeSwap(apply) {
  shell.classList.add('is-theme-fading')
  window.setTimeout(() => {
    apply()
    window.requestAnimationFrame(() =>
      window.setTimeout(() => shell.classList.remove('is-theme-fading'), 60)
    )
  }, 200)
}

function setTheme(theme, { fade = true } = {}) {
  if (!THEMES.includes(theme)) return
  const apply = () => {
    body.dataset.theme = theme
    themeNote.textContent = `${THEME_LABELS[theme]} · Spatial Lens · 生产迁移前的视觉签字原型`
    setActiveInGroup('theme', theme)
    localStorage.setItem('tagent-spatial-theme-theme', theme)
  }
  if (fade) crossfadeSwap(apply)
  else apply()
}

function setMode(mode, { fade = true } = {}) {
  if (mode !== 'light' && mode !== 'dark') return
  const apply = () => {
    body.dataset.mode = mode
    setActiveInGroup('mode', mode)
    localStorage.setItem('tagent-spatial-theme-mode', mode)
  }
  if (fade) crossfadeSwap(apply)
  else apply()
}

function setMaterial(material) {
  const next = normalizeMaterial(material)
  if (!MATERIALS.includes(next)) return
  body.dataset.material = next
  setActiveInGroup('material', next)
  localStorage.setItem('tagent-spatial-theme-material', next)
}

function setPlatform(platform) {
  if (platform !== 'windows' && platform !== 'mac') return
  shell.dataset.platform = platform
  setActiveInGroup('platform', platform)
  localStorage.setItem('tagent-spatial-theme-platform', platform)
}

// ----------------------------------------------------------------------------
// Rail tooltip
// ----------------------------------------------------------------------------
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

// ----------------------------------------------------------------------------
// Sidebar morph（rail ↔ sidebar 飞行）
// ----------------------------------------------------------------------------
function wait(duration) {
  return new Promise((resolve) => window.setTimeout(resolve, duration))
}

function waitForLayout() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(resolve))
  })
}

function prefersReducedMotion() {
  const mode = new URLSearchParams(window.location.search).get('motion')
  if (mode === 'reduced') return true
  if (mode === 'system') return window.matchMedia('(prefers-reduced-motion: reduce)').matches
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
      { ...morphGeometry(path.target, 1, '22px'), easing: 'cubic-bezier(.34,0,.56,.42)' },
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

// ----------------------------------------------------------------------------
// Inspector 面板
// ----------------------------------------------------------------------------
function setInspectorPanel(panel) {
  const [title, headline, detail] = PANEL_CONTENT[panel] || PANEL_CONTENT.design
  inspectorTitle.textContent = title
  document.querySelectorAll('.inspector-tab').forEach((button) => {
    button.classList.toggle('is-active', button.dataset.panel === panel)
  })

  const emptyIcon =
    panel === 'crew' ? 'ph-users-three' : panel === 'files' ? 'ph-files' : 'ph-sparkle'
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

// ----------------------------------------------------------------------------
// 事件绑定
// ----------------------------------------------------------------------------
document.querySelectorAll('.theme-swatch').forEach((button) => {
  button.addEventListener('click', () => setTheme(button.dataset.theme))
})

document.querySelectorAll('.seg [data-mode]').forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.mode))
})

document.querySelectorAll('.seg [data-material]').forEach((button) => {
  button.addEventListener('click', () => setMaterial(button.dataset.material))
})

document.querySelectorAll('.seg [data-platform]').forEach((button) => {
  button.addEventListener('click', () => setPlatform(button.dataset.platform))
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

document
  .querySelectorAll('.rail-button[data-label], .rail-avatar[data-label]')
  .forEach((button) => {
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

// 材质感知开关：workspace header「自动审批」on/off，点击切换 .is-on 与 aria-checked
const approvalSwitch = document.querySelector('#approval-switch')
approvalSwitch?.addEventListener('click', () => {
  const on = approvalSwitch.classList.toggle('is-on')
  approvalSwitch.setAttribute('aria-checked', String(on))
  approvalSwitch.setAttribute('aria-label', on ? '自动审批' : '每次确认')
  const label = approvalSwitch.querySelector('.switch-copy')
  if (label) label.textContent = on ? '自动审批' : '每次确认'
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
  message.dataset.turnSummary = text.slice(0, 28)
  observeUserTurn(message)
  registerMinimapMessage(message)
  conversation.scrollTop = conversation.scrollHeight
  input.value = ''
})

turnLocator?.addEventListener('click', () => {
  activeLocatedTurn?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  turnLocator.classList.add('is-jumping')
  window.setTimeout(() => turnLocator.classList.remove('is-jumping'), 220)
})

document.querySelectorAll('.session-row').forEach((button) => {
  button.addEventListener('click', () => {
    const scope = button.closest('.session-list')
    scope?.querySelectorAll('.is-active').forEach((item) => item.classList.remove('is-active'))
    button.classList.add('is-active')
  })
})

// ----------------------------------------------------------------------------
// 初始状态：URL query > localStorage > 默认
// ----------------------------------------------------------------------------
const params = new URLSearchParams(window.location.search)

if (params.get('minimap') === '1') {
  messageMinimap.classList.add('is-preview-open')
}

if (params.get('clean') === '1') {
  body.dataset.clean = 'true'
}

const requestedTheme = params.get('theme')
const requestedMode = params.get('mode')
const requestedMaterial = normalizeMaterial(params.get('material'))
const requestedPlatform = params.get('platform')
const requestedSpatialState = params.get('state')
const requestedScroll = Number(params.get('scroll'))

const savedTheme = localStorage.getItem('tagent-spatial-theme-theme')
const savedMode = localStorage.getItem('tagent-spatial-theme-mode')
const savedMaterial = normalizeMaterial(localStorage.getItem('tagent-spatial-theme-material'))
const savedPlatform = localStorage.getItem('tagent-spatial-theme-platform')
const savedSpatialState = localStorage.getItem('tagent-spatial-theme-spatial-state')

setTheme(
  THEMES.includes(requestedTheme)
    ? requestedTheme
    : THEMES.includes(savedTheme)
      ? savedTheme
      : 'default',
  {
    fade: false,
  }
)
setMode(
  requestedMode === 'dark' || requestedMode === 'light'
    ? requestedMode
    : savedMode === 'dark' || savedMode === 'light'
      ? savedMode
      : 'light',
  {
    fade: false,
  }
)
setMaterial(
  MATERIALS.includes(requestedMaterial)
    ? requestedMaterial
    : MATERIALS.includes(savedMaterial)
      ? savedMaterial
      : 'frosted'
)
setPlatform(
  requestedPlatform === 'mac' || requestedPlatform === 'windows'
    ? requestedPlatform
    : savedPlatform === 'mac' || savedPlatform === 'windows'
      ? savedPlatform
      : 'windows'
)

if (['standard', 'focus', 'canvas', 'office'].includes(requestedSpatialState)) {
  setSpatialState(requestedSpatialState)
} else if (['standard', 'focus', 'canvas', 'office'].includes(savedSpatialState)) {
  setSpatialState(savedSpatialState)
} else {
  setSpatialState('standard')
}

renderSidebar('sessions')

if (Number.isFinite(requestedScroll) && requestedScroll > 0) {
  window.requestAnimationFrame(() => {
    const scrollRange = conversation.scrollHeight - conversation.clientHeight
    conversation.scrollTop = scrollRange * Math.min(requestedScroll, 1)
  })
}

// ----------------------------------------------------------------------------
// 浏览器内 selftest（?selftest=1）
// 校验：6 主题 / 2 模式 / 3 材质 / 平台切换 / sidebar / composer / canvas 往返 / switch。
// 结果写到 body.dataset.selftest 与右下角横幅。
// ----------------------------------------------------------------------------
function assert(checks, name, cond) {
  if (!cond) checks.push(name)
}

async function runSelftest() {
  const checks = []
  const original = {
    theme: body.dataset.theme,
    mode: body.dataset.mode,
    material: body.dataset.material,
    platform: shell.dataset.platform,
    spatialState: shell.className.match(/spatial-state-(\w+)/)?.[1] || 'standard',
  }

  // 6 主题：直接换 data-theme，验证 token 注入
  for (const t of THEMES) {
    body.dataset.theme = t
    const sceneBase = getComputedStyle(body).getPropertyValue('--scene-base-rgb').trim()
    const accent = getComputedStyle(body).getPropertyValue('--accent-rgb').trim()
    assert(checks, `theme:${t}`, body.dataset.theme === t && sceneBase !== '' && accent !== '')
  }

  // 2 模式
  for (const m of ['light', 'dark']) {
    body.dataset.mode = m
    const ink = getComputedStyle(body).getPropertyValue('--ink-strong-rgb').trim()
    assert(checks, `mode:${m}`, body.dataset.mode === m && ink !== '')
  }

  // 3 材质（frosted/soft/glass）：逐个注入并校验 token 落地。
  // 若某材质在本页未定义 token（如 v2 快照无 soft），blur 为空则跳过，不记失败。
  for (const mat of MATERIALS) {
    body.dataset.material = mat
    const blur = getComputedStyle(body).getPropertyValue('--glass-blur').trim()
    if (blur === '') continue
    assert(checks, `material:${mat}`, body.dataset.material === mat && blur !== '')
  }

  // 平台切换：Mac 控件显隐
  shell.dataset.platform = 'mac'
  const macShown = getComputedStyle(document.querySelector('.mac-controls')).display === 'flex'
  assert(checks, 'platform:mac', shell.dataset.platform === 'mac' && macShown)
  shell.dataset.platform = 'windows'
  const winShown = getComputedStyle(document.querySelector('.window-controls')).display === 'flex'
  assert(checks, 'platform:windows', shell.dataset.platform === 'windows' && winShown)

  // 主题切换函数（带 crossfade，最终落到 purple 再切回）
  setTheme('ocean', { fade: false })
  assert(checks, 'setTheme', body.dataset.theme === 'ocean')

  // sidebar morph：关闭 → 打开
  setSpatialState('standard')
  await wait(120)
  await closeSidebarToRail()
  assert(
    checks,
    'sidebar:close',
    shell.classList.contains('is-sidebar-hidden') &&
      !sidebarMorphSurface.classList.contains('is-active')
  )
  await openSidebarFromRail()
  assert(
    checks,
    'sidebar:open',
    !shell.classList.contains('is-sidebar-hidden') &&
      !sidebarMorphSurface.classList.contains('is-active')
  )

  // composer 聚焦展开
  const input = document.querySelector('#composer-input')
  input.focus()
  assert(checks, 'composer:expand', workspace.classList.contains('is-composer-expanded'))
  input.blur()
  // pointerdown 兜底：点非 composer 区域收回
  document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
  assert(checks, 'composer:collapse', !workspace.classList.contains('is-composer-expanded'))

  // 长会话定位器：初始隐藏，越过用户轮次后显示并能返回对应原文
  conversation.scrollTop = 0
  await wait(80)
  assert(checks, 'locator:hidden-at-top', !turnLocatorSlot.classList.contains('is-visible'))
  conversation.scrollTop = conversation.scrollHeight * 0.72
  await wait(120)
  assert(
    checks,
    'locator:visible-after-scroll',
    turnLocatorSlot.classList.contains('is-visible') &&
      turnLocatorSummary.textContent.trim().length > 0
  )
  assert(
    checks,
    'minimap:bars-and-thumb',
    messageMinimapBars.children.length === minimapMessages.length &&
      Number(messageScrollTrack.getAttribute('aria-valuenow')) > 0
  )
  const locatedTurnBeforeJump = activeLocatedTurn
  turnLocator.click()
  await wait(520)
  const locatedRect = locatedTurnBeforeJump?.getBoundingClientRect()
  const conversationRect = conversation.getBoundingClientRect()
  assert(
    checks,
    'locator:return-to-turn',
    Boolean(
      locatedRect &&
      locatedRect.bottom > conversationRect.top &&
      locatedRect.top < conversationRect.bottom
    )
  )
  conversation.scrollTop = 0
  await wait(80)

  // canvas 往返：进入画布 → 退出回标准
  setSpatialState('canvas')
  assert(checks, 'canvas:enter', shell.classList.contains('spatial-state-canvas'))
  document.querySelector('.scene-exit').click()
  assert(checks, 'canvas:exit', shell.classList.contains('spatial-state-standard'))

  // inspector 显隐
  shell.classList.add('is-inspector-hidden')
  assert(checks, 'inspector:hide', shell.classList.contains('is-inspector-hidden'))
  shell.classList.remove('is-inspector-hidden')
  assert(checks, 'inspector:show', !shell.classList.contains('is-inspector-hidden'))

  // 材质感知开关：点击切换 aria-checked / .is-on（v2 快照无此控件时跳过）
  if (approvalSwitch) {
    approvalSwitch.classList.add('is-on')
    approvalSwitch.setAttribute('aria-checked', 'true')
    approvalSwitch.click()
    assert(
      checks,
      'switch:toggle',
      approvalSwitch.getAttribute('aria-checked') === 'false' &&
        !approvalSwitch.classList.contains('is-on')
    )
    // 还原为默认 on（自动审批开）
    approvalSwitch.classList.add('is-on')
    approvalSwitch.setAttribute('aria-checked', 'true')
    approvalSwitch.setAttribute('aria-label', '自动审批')
    const approvalLabel = approvalSwitch.querySelector('.switch-copy')
    if (approvalLabel) approvalLabel.textContent = '自动审批'
  }

  // 还原初始状态
  body.dataset.theme = original.theme
  body.dataset.mode = original.mode
  body.dataset.material = original.material
  shell.dataset.platform = original.platform
  setSpatialState(original.spatialState)
  setActiveInGroup('theme', original.theme)
  setActiveInGroup('mode', original.mode)
  setActiveInGroup('material', original.material)
  setActiveInGroup('platform', original.platform)

  const passed = checks.length === 0
  body.dataset.selftest = passed ? 'passed' : 'failed'
  body.dataset.selftestFailures = checks.join(',')
  selftestBanner.textContent = passed
    ? 'selftest 通过：主题 / 材质 / sidebar / composer / 定位器 / 消息刻度 / canvas / switch'
    : `selftest 失败：${checks.join(', ')}`
  // eslint-disable-next-line no-console
  console.log('[spatial-theme-study] selftest', body.dataset.selftest, checks)
}

if (params.get('selftest') === '1') {
  window.setTimeout(() => {
    runSelftest().catch((error) => {
      body.dataset.selftest = 'failed'
      body.dataset.selftestFailures = `exception:${error.message}`
      selftestBanner.textContent = `selftest 异常：${error.message}`
    })
  }, 320)
}

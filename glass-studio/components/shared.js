/**
 * TAgent Glass Studio - Shared JavaScript Utilities
 *
 * 共享工具函数，所有页面统一引用
 */

// ========== 主题系统 ==========

const ThemeManager = {
  themes: { mist: '云絮', ocean: '碧海', moss: '青苔', dusk: '暮霭' },
  modes: { light: '浅色', dark: '深色' },
  materials: { soft: '轻拟态', liquid: '液态玻璃' },

  init() {
    const saved = this.load();
    this.apply(saved.theme, saved.mode, saved.material, false);
    this.bindEvents();
  },

  load() {
    try {
      return {
        theme: localStorage.getItem('tagent-theme') || 'mist',
        mode: localStorage.getItem('tagent-mode') || 'light',
        material: localStorage.getItem('tagent-material') || 'soft'
      };
    } catch {
      return { theme: 'mist', mode: 'light', material: 'soft' };
    }
  },

  save(theme, mode, material) {
    try {
      localStorage.setItem('tagent-theme', theme);
      localStorage.setItem('tagent-mode', mode);
      localStorage.setItem('tagent-material', material);
    } catch {}
  },

  apply(theme, mode, material, persist = true) {
    const root = document.documentElement;
    root.dataset.theme = this.themes[theme] ? theme : 'mist';
    root.dataset.mode = mode === 'dark' ? 'dark' : 'light';
    root.dataset.material = this.materials[material] ? material : 'soft';

    // 更新 UI 状态
    document.querySelectorAll('[data-pick]').forEach(el => {
      el.classList.toggle('is-active', el.dataset.pick === theme);
    });
    document.querySelectorAll('[data-mode]').forEach(el => {
      el.classList.toggle('is-active', el.dataset.mode === mode);
    });
    document.querySelectorAll('[data-material]').forEach(el => {
      el.classList.toggle('is-active', el.dataset.material === material);
    });

    // 更新主题名称显示
    const themeNameEl = document.getElementById('themeName');
    if (themeNameEl) {
      themeNameEl.textContent = `${this.themes[root.dataset.theme]} · ${this.modes[root.dataset.mode]} · ${this.materials[root.dataset.material]}`;
    }

    if (persist) this.save(theme, mode, material);
  },

  bindEvents() {
    const root = document.documentElement;

    // 主题色切换
    document.querySelectorAll('[data-pick]').forEach(el => {
      el.addEventListener('click', () => {
        this.apply(el.dataset.pick, root.dataset.mode, root.dataset.material);
      });
    });

    // 明暗模式切换
    document.querySelectorAll('[data-mode]').forEach(el => {
      el.addEventListener('click', () => {
        this.apply(root.dataset.theme, el.dataset.mode, root.dataset.material);
      });
    });

    // 材质切换
    document.querySelectorAll('[data-material]').forEach(el => {
      el.addEventListener('click', () => {
        this.apply(root.dataset.theme, root.dataset.mode, el.dataset.material);
      });
    });
  }
};

// ========== 导航系统 ==========

const Navigation = {
  currentPage: '',

  init() {
    this.currentPage = this.getCurrentPage();
    this.updateActiveState();
    this.bindEvents();
  },

  getCurrentPage() {
    const path = window.location.pathname;
    const filename = path.split('/').pop() || 'index.html';
    return filename.replace('.html', '');
  },

  updateActiveState() {
    document.querySelectorAll('[data-nav]').forEach(link => {
      const linkPage = link.dataset.nav;
      link.classList.toggle('is-active', linkPage === this.currentPage);
    });
  },

  bindEvents() {
    document.querySelectorAll('[data-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        const href = link.getAttribute('href');
        if (href) {
          // 允许正常导航
          return;
        }
        e.preventDefault();
        this.navigate(link.dataset.nav);
      });
    });
  },

  navigate(page) {
    const pages = {
      dashboard: '../index.html',
      chat: 'chat.html',
      automation: 'automation.html',
      settings: 'settings.html'
    };
    if (pages[page]) {
      window.location.href = pages[page];
    }
  }
};

// ========== 模态框系统 ==========

const Modal = {
  open(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      // 聚焦第一个输入框
      const firstInput = modal.querySelector('input, textarea, select');
      if (firstInput) firstInput.focus();
    }
  },

  close(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }
  },

  bindCloseButtons(container) {
    container.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) this.close(modal.id);
      });
    });
  },

  init() {
    // 点击遮罩层关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          this.close(overlay.id);
        }
      });
    });

    // ESC 关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal-overlay.is-open');
        if (openModal) this.close(openModal.id);
      }
    });
  }
};

// ========== Toast 通知 ==========

const Toast = {
  show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || this.createContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span class="toast-message">${message}</span>
      <button class="toast-close" aria-label="关闭">×</button>
    `;

    container.appendChild(toast);

    // 触发动画
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    // 自动关闭
    const timeout = setTimeout(() => this.dismiss(toast), duration);

    // 手动关闭
    toast.querySelector('.toast-close').addEventListener('click', () => {
      clearTimeout(timeout);
      this.dismiss(toast);
    });
  },

  createContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;top:16px;right:16px;z-index:2000;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
    return container;
  },

  dismiss(toast) {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 200);
  },

  success(message) { this.show(message, 'success'); },
  error(message) { this.show(message, 'error'); },
  warning(message) { this.show(message, 'warning'); },
  info(message) { this.show(message, 'info'); }
};

// ========== 工具函数 ==========

const Utils = {
  // 格式化时间
  formatTime(date) {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  },

  // 防抖
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // 节流
  throttle(fn, delay = 100) {
    let last = 0;
    return (...args) => {
      const now = Date.now();
      if (now - last >= delay) {
        last = now;
        fn.apply(this, args);
      }
    };
  },

  // 生成唯一 ID
  uuid() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  },

  // 安全的 innerHTML
  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
};

// ========== 设置弹窗（双浮岛 Soft Glass） ==========

const SettingsModal = {
  currentSection: 'general',
  _bound: false,
  _observer: null,

  init() {
    this.bindOpeners();
  },

  open() {
    this.render();
    Modal.open('settingsModal');
    this.bindInner();
    this.syncAppearanceControls();
  },

  close() {
    Modal.close('settingsModal');
  },

  render() {
    const container = document.getElementById('settingsModal');
    if (!container) return;

    container.classList.add('settings-dialog-overlay');
    container.innerHTML = `
<div class="modal-content settings-dialog" role="dialog" aria-modal="true" aria-label="设置">
<div class="specular" aria-hidden="true"></div><div class="chroma-edge" aria-hidden="true"></div>
<div class="settings-shell">
  <!-- 左侧导航 -->
  <aside class="settings-nav-island" aria-label="设置导航">
    <div class="settings-nav-head">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/>
        <path d="M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      设置
    </div>
    <nav class="settings-nav-scroll" id="settingsNav">
      <div class="settings-nav-group">
        <div class="settings-nav-group-label">核心</div>
        <div class="settings-nav-list">
          <button type="button" class="settings-nav-item is-active" data-section="general">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" stroke-width="1.5"/></svg>
            通用
          </button>
          <button type="button" class="settings-nav-item" data-section="channels">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="2" stroke="currentColor" stroke-width="1.5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            AI 渠道
          </button>
          <button type="button" class="settings-nav-item" data-section="prompts">
            <svg viewBox="0 0 24 24" fill="none"><path d="M4 19.5A2.5 2.5 0 016.5 17H20" stroke="currentColor" stroke-width="1.5"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" stroke="currentColor" stroke-width="1.5"/></svg>
            提示词
          </button>
          <button type="button" class="settings-nav-item" data-section="agent">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 15l-6.3 4 2.3-7-6-4.6h7.6L12 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>
            Agent 偏好
          </button>
        </div>
      </div>
      <div class="settings-nav-group">
        <div class="settings-nav-group-label">集成</div>
        <div class="settings-nav-list">
          <button type="button" class="settings-nav-item" data-section="bots">
            <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="10" rx="2" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="16" r="1" stroke="currentColor" stroke-width="1.5"/><path d="M8 11V7a4 4 0 118 0v4" stroke="currentColor" stroke-width="1.5"/></svg>
            远程
          </button>
          <button type="button" class="settings-nav-item" data-section="voice">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" stroke="currentColor" stroke-width="1.5"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            语音
          </button>
          <button type="button" class="settings-nav-item" data-section="proxy">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M2 12h20M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" stroke="currentColor" stroke-width="1.5"/></svg>
            代理
          </button>
        </div>
      </div>
      <div class="settings-nav-group">
        <div class="settings-nav-group-label">高级</div>
        <div class="settings-nav-list">
          <button type="button" class="settings-nav-item" data-section="shortcuts">
            <svg viewBox="0 0 24 24" fill="none"><rect x="3" y="6" width="18" height="12" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M7 10h2M15 10h2M7 14h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            快捷键
          </button>
          <button type="button" class="settings-nav-item" data-section="insights">
            <svg viewBox="0 0 24 24" fill="none"><path d="M18 20V10M12 20V4M6 20v-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            数据
          </button>
          <button type="button" class="settings-nav-item" data-section="appearance">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.5"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            外观
          </button>
          <button type="button" class="settings-nav-item" data-section="about">
            <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
            关于
          </button>
        </div>
      </div>
    </nav>
  </aside>

  <!-- 右侧内容 -->
  <section class="settings-content-island">
    <div class="settings-content-top">
      <input class="settings-search" type="search" placeholder="搜索设置…" aria-label="搜索设置" />
      <button type="button" class="settings-close" data-modal-close aria-label="关闭设置" title="关闭">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      </button>
    </div>
    <div class="settings-content-scroll">
      <div class="settings-content-inner" id="settingsContent">

        <!-- 通用设置 -->
        <div class="settings-section is-active" id="section-general">
          <h1 class="settings-section-title">通用</h1>
          <p class="settings-section-desc">语言、归档、通知等基础偏好</p>

          <div class="settings-card settings-card--flush">
            <div class="settings-profile">
              <div class="settings-avatar">F</div>
              <div>
                <div class="settings-profile-name">Frank</div>
                <div class="settings-profile-meta">frank@example.com</div>
              </div>
            </div>
          </div>

          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">语言</div><div class="settings-row-desc">界面显示语言</div></div>
              <select class="settings-input" style="width:140px;padding:6px 12px;"><option selected>简体中文</option><option>English</option></select>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">自动归档</div><div class="settings-row-desc">会话超过指定天数未活动时自动归档</div></div>
              <select class="settings-input" style="width:140px;padding:6px 12px;"><option>禁用</option><option selected>7 天</option><option>14 天</option><option>30 天</option></select>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">桌面通知</div><div class="settings-row-desc">任务完成、权限审批等事件触发系统通知</div></div>
              <div class="toggle-switch is-active" role="switch" aria-checked="true" tabindex="0"></div>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">消息置顶条</div><div class="settings-row-desc">将指定用户消息置顶显示，方便对照需求写代码</div></div>
              <div class="toggle-switch" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">Token Plan 消费提醒</div><div class="settings-row-desc">选择 Token Plan（按次计费）供应商时提示</div></div>
              <div class="toggle-switch is-active" role="switch" aria-checked="true" tabindex="0"></div>
            </div>
          </div>

          <h2 style="margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);">通知提示音</h2>
          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">启用提示音</div><div class="settings-row-desc">开启后任务完成、权限审批等事件会播放提示音</div></div>
              <div class="toggle-switch is-active" role="switch" aria-checked="true" tabindex="0"></div>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">任务完成</div><div class="settings-row-desc">任务执行完成时的提示音</div></div>
              <select class="settings-input" style="width:100px;padding:6px 12px;"><option selected>默认</option><option>清脆</option><option>柔和</option><option>无</option></select>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">权限审批</div><div class="settings-row-desc">需要审批时的提示音</div></div>
              <select class="settings-input" style="width:100px;padding:6px 12px;"><option selected>默认</option><option>清脆</option><option>柔和</option><option>无</option></select>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">计划审批</div><div class="settings-row-desc">退出计划模式时的提示音</div></div>
              <select class="settings-input" style="width:100px;padding:6px 12px;"><option selected>默认</option><option>清脆</option><option>柔和</option><option>无</option></select>
            </div>
          </div>
        </div>

        <!-- AI 渠道 -->
        <div class="settings-section" id="section-channels">
          <h1 class="settings-section-title">AI 渠道</h1>
          <p class="settings-section-desc">配置 AI 模型渠道，支持多渠道切换</p>

          <div class="settings-card settings-card--flush">
            <div class="api-key-card">
              <div class="api-key-info">
                <div class="api-key-icon" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);">C</div>
                <div>
                  <div class="api-key-name">Claude 渠道</div>
                  <div class="api-key-status" style="color:var(--success);">已激活 · Claude Sonnet 5</div>
                </div>
              </div>
              <button type="button" class="btn-secondary">编辑</button>
            </div>
            <div class="api-key-card">
              <div class="api-key-info">
                <div class="api-key-icon" style="background:linear-gradient(135deg,#10a37f,#1a7f64);">O</div>
                <div>
                  <div class="api-key-name">OpenAI 渠道</div>
                  <div class="api-key-status">未配置</div>
                </div>
              </div>
              <button type="button" class="btn-secondary">配置</button>
            </div>
            <div class="api-key-card">
              <div class="api-key-info">
                <div class="api-key-icon" style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);">K</div>
                <div>
                  <div class="api-key-name">Kscc 渠道</div>
                  <div class="api-key-status" style="color:var(--success);">已激活 · 免费</div>
                </div>
              </div>
              <button type="button" class="btn-secondary">编辑</button>
            </div>
            <div class="settings-card-footer">
              <button type="button" class="btn-secondary" style="width:100%;">+ 添加渠道</button>
            </div>
          </div>
        </div>

        <!-- 提示词 -->
        <div class="settings-section" id="section-prompts">
          <h1 class="settings-section-title">提示词</h1>
          <p class="settings-section-desc">自定义提示词模板</p>

          <div class="settings-card settings-card--flush">
            <div class="api-key-card">
              <div class="api-key-info">
                <div class="api-key-icon">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 002 17V6.5A2.5 2.5 0 014.5 4H20v16M4 19.5A2.5 2.5 0 006.5 17H20" stroke="currentColor" stroke-width="1.5"/></svg>
                </div>
                <div>
                  <div class="api-key-name">代码审查</div>
                  <div class="api-key-status">自动审查代码变更</div>
                </div>
              </div>
              <button type="button" class="btn-secondary">编辑</button>
            </div>
            <div class="api-key-card">
              <div class="api-key-info">
                <div class="api-key-icon">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 002 17V6.5A2.5 2.5 0 014.5 4H20v16M4 19.5A2.5 2.5 0 006.5 17H20" stroke="currentColor" stroke-width="1.5"/></svg>
                </div>
                <div>
                  <div class="api-key-name">文档生成</div>
                  <div class="api-key-status">自动生成文档注释</div>
                </div>
              </div>
              <button type="button" class="btn-secondary">编辑</button>
            </div>
            <div class="api-key-card">
              <div class="api-key-info">
                <div class="api-key-icon">
                  <svg viewBox="0 0 24 24" fill="none" width="16" height="16"><path d="M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 002 17V6.5A2.5 2.5 0 014.5 4H20v16M4 19.5A2.5 2.5 0 006.5 17H20" stroke="currentColor" stroke-width="1.5"/></svg>
                </div>
                <div>
                  <div class="api-key-name">错误修复</div>
                  <div class="api-key-status">自动修复常见错误</div>
                </div>
              </div>
              <button type="button" class="btn-secondary">编辑</button>
            </div>
            <div class="settings-card-footer">
              <button type="button" class="btn-secondary" style="width:100%;">+ 新建提示词</button>
            </div>
          </div>
        </div>

        <!-- Agent 偏好 -->
        <div class="settings-section" id="section-agent">
          <h1 class="settings-section-title">Agent 偏好</h1>
          <p class="settings-section-desc">Agent 行为、自动检查、SubAgent 派发等配置</p>

          <h2 style="margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);">自动检查</h2>
          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">改代码后自动检查</div><div class="settings-row-desc">支持 TypeScript/JavaScript/Python/Rust/Go/Lua/C++/Java</div></div>
              <div class="toggle-switch is-active" role="switch" aria-checked="true" tabindex="0"></div>
            </div>
          </div>

          <h2 style="margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);">SubAgent 派发</h2>
          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">派发积极性</div><div class="settings-row-desc">never=从不派发 / conservative=批量≥5才派（默认）</div></div>
              <select class="settings-input" style="width:160px;padding:6px 12px;"><option>从不派发</option><option selected>保守（推荐）</option><option>平衡</option><option>积极</option></select>
            </div>
          </div>

          <h2 style="margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);">看板 worker 模型分配</h2>
          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">看板默认并发上限</div><div class="settings-row-desc">新建看板的最大并发任务数</div></div>
              <select class="settings-input" style="width:140px;padding:6px 12px;"><option>3（保守）</option><option selected>5（推荐）</option><option>8（高并行）</option></select>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">单模型最大并发数</div><div class="settings-row-desc">同一模型同时跑的 worker 上限</div></div>
              <select class="settings-input" style="width:140px;padding:6px 12px;"><option selected>2（推荐）</option><option>3</option><option>4</option></select>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">优先免费渠道</div><div class="settings-row-desc">未指定模型时优先用 kscc（免费）渠道</div></div>
              <div class="toggle-switch is-active" role="switch" aria-checked="true" tabindex="0"></div>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">允许使用外部模型</div><div class="settings-row-desc">开启后可在白名单内使用外部收费模型</div></div>
              <div class="toggle-switch" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">Worker Approval 处理策略</div><div class="settings-row-desc">看板 worker 在 auto 权限模式下触发 approval 时的处理</div></div>
              <select class="settings-input" style="width:140px;padding:6px 12px;"><option selected>自动拒绝（推荐）</option><option>自动放行</option></select>
            </div>
          </div>
        </div>

        <!-- 远程 -->
        <div class="settings-section" id="section-bots">
          <h1 class="settings-section-title">远程 Bot</h1>
          <p class="settings-section-desc">配置远程 Bot Hub，支持远程 Agent 执行</p>

          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">Bot Hub 地址</div><div class="settings-row-desc">远程 Bot 服务的 URL 地址</div></div>
              <input type="text" class="settings-input" placeholder="https://bot-hub.example.com" style="width:200px;">
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">API 密钥</div><div class="settings-row-desc">用于认证的 API 密钥</div></div>
              <input type="password" class="settings-input" placeholder="sk-xxx" style="width:200px;">
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">启用远程 Bot</div><div class="settings-row-desc">开启后将任务委派给远程 Bot 执行</div></div>
              <div class="toggle-switch" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
          </div>
        </div>

        <!-- 语音 -->
        <div class="settings-section" id="section-voice">
          <h1 class="settings-section-title">语音输入</h1>
          <p class="settings-section-desc">配置语音识别和输入设置</p>

          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">启用语音输入</div><div class="settings-row-desc">允许通过麦克风进行语音输入</div></div>
              <div class="toggle-switch" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">语音识别服务</div><div class="settings-row-desc">选择语音识别服务提供商</div></div>
              <select class="settings-input" style="width:140px;padding:6px 12px;"><option selected>系统默认</option><option>Whisper</option></select>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">自动发送</div><div class="settings-row-desc">语音识别完成后自动发送消息</div></div>
              <div class="toggle-switch" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
          </div>
        </div>

        <!-- 代理 -->
        <div class="settings-section" id="section-proxy">
          <h1 class="settings-section-title">代理配置</h1>
          <p class="settings-section-desc">配置 HTTP/HTTPS 代理服务器</p>

          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">启用代理</div><div class="settings-row-desc">通过代理服务器访问网络</div></div>
              <div class="toggle-switch" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">代理地址</div><div class="settings-row-desc">代理服务器的地址</div></div>
              <input type="text" class="settings-input" placeholder="127.0.0.1:7890" style="width:200px;">
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">代理类型</div><div class="settings-row-desc">选择代理协议类型</div></div>
              <select class="settings-input" style="width:140px;padding:6px 12px;"><option selected>HTTP</option><option>HTTPS</option><option>SOCKS5</option></select>
            </div>
          </div>
        </div>

        <!-- 快捷键 -->
        <div class="settings-section" id="section-shortcuts">
          <h1 class="settings-section-title">快捷键</h1>
          <p class="settings-section-desc">常用操作的键盘映射</p>

          <div class="settings-card settings-card--flush">
            <div class="shortcut-item"><span class="shortcut-action">新会话</span><span class="shortcut-key">⌘ N</span></div>
            <div class="shortcut-item"><span class="shortcut-action">搜索</span><span class="shortcut-key">⌘ K</span></div>
            <div class="shortcut-item"><span class="shortcut-action">打开设置</span><span class="shortcut-key">⌘ /</span></div>
            <div class="shortcut-item"><span class="shortcut-action">关闭对话框</span><span class="shortcut-key">Esc</span></div>
            <div class="shortcut-item"><span class="shortcut-action">发送消息</span><span class="shortcut-key">Enter</span></div>
            <div class="shortcut-item"><span class="shortcut-action">换行</span><span class="shortcut-key">Shift + Enter</span></div>
            <div class="shortcut-item"><span class="shortcut-action">放大界面</span><span class="shortcut-key">⌘ +</span></div>
            <div class="shortcut-item"><span class="shortcut-action">缩小界面</span><span class="shortcut-key">⌘ -</span></div>
            <div class="shortcut-item"><span class="shortcut-action">重置缩放</span><span class="shortcut-key">⌘ 0</span></div>
          </div>
        </div>

        <!-- 数据 -->
        <div class="settings-section" id="section-insights">
          <h1 class="settings-section-title">数据统计</h1>
          <p class="settings-section-desc">使用量和运行数据概览</p>

          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">本月会话数</div><div class="settings-row-desc">已创建的会话总数</div></div>
              <span style="font-size:18px;font-weight:600;color:var(--text);">127</span>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">本月消息数</div><div class="settings-row-desc">发送和接收的消息总数</div></div>
              <span style="font-size:18px;font-weight:600;color:var(--text);">1,842</span>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">Token 用量</div><div class="settings-row-desc">本月消耗的 Token 总数</div></div>
              <span style="font-size:18px;font-weight:600;color:var(--text);">892K</span>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">任务完成数</div><div class="settings-row-desc">已完成的工作任务数</div></div>
              <span style="font-size:18px;font-weight:600;color:var(--text);">43</span>
            </div>
          </div>
        </div>

        <!-- 外观 -->
        <div class="settings-section" id="section-appearance">
          <h1 class="settings-section-title">外观</h1>
          <p class="settings-section-desc">4 大家族 × 明暗 × Soft / Liquid</p>

          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">深色模式</div><div class="settings-row-desc">切换界面明暗</div></div>
              <div class="toggle-switch" id="darkModeToggle" role="switch" aria-checked="false" tabindex="0"></div>
            </div>
          </div>

          <h2 style="margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);">主题家族</h2>
          <div class="settings-card settings-card--flush">
            <div class="theme-grid" id="themeGrid">
              <button type="button" class="theme-card is-selected" data-theme-pick="mist">
                <span class="theme-card-check">✓</span>
                <div class="theme-card-swatch" style="background:linear-gradient(135deg,#c5d0e2,#5b7fd4);"></div>
                <div class="theme-card-name">云絮</div>
                <div class="theme-card-sub">Mist</div>
              </button>
              <button type="button" class="theme-card" data-theme-pick="ocean">
                <span class="theme-card-check">✓</span>
                <div class="theme-card-swatch" style="background:linear-gradient(135deg,#c2d2e0,#4f8fc4);"></div>
                <div class="theme-card-name">碧海</div>
                <div class="theme-card-sub">Ocean</div>
              </button>
              <button type="button" class="theme-card" data-theme-pick="moss">
                <span class="theme-card-check">✓</span>
                <div class="theme-card-swatch" style="background:linear-gradient(135deg,#c6d4ca,#5a8f72);"></div>
                <div class="theme-card-name">青苔</div>
                <div class="theme-card-sub">Moss</div>
              </button>
              <button type="button" class="theme-card" data-theme-pick="dusk">
                <span class="theme-card-check">✓</span>
                <div class="theme-card-swatch" style="background:linear-gradient(135deg,#d4ccc2,#a07a5e);"></div>
                <div class="theme-card-name">暮霭</div>
                <div class="theme-card-sub">Dusk</div>
              </button>
            </div>
          </div>

          <h2 style="margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);">界面材质</h2>
          <div class="settings-card settings-card--flush">
            <div class="material-pair" id="materialPair">
              <button type="button" class="material-tile is-selected" data-material-pick="soft">
                <div class="material-preview material-preview-soft"></div>
                <div class="material-name">轻拟态</div>
                <div class="material-tag">Soft Glass</div>
              </button>
              <button type="button" class="material-tile" data-material-pick="liquid">
                <div class="material-preview material-preview-liquid"></div>
                <div class="material-name">液态玻璃</div>
                <div class="material-tag">Liquid Glass</div>
              </button>
            </div>
          </div>

          <h2 style="margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);">排版</h2>
          <div class="settings-card settings-card--flush">
            <div class="settings-row">
              <div><div class="settings-row-label">阅读字号</div><div class="settings-row-desc">AI 回复与 Markdown 编辑器的正文字号</div></div>
              <select class="settings-input" style="width:100px;padding:6px 12px;"><option>小</option><option selected>中</option><option>大</option></select>
            </div>
            <div class="settings-row">
              <div><div class="settings-row-label">Agent 预览展开方式</div><div class="settings-row-desc">点击「预览」时的默认位置</div></div>
              <select class="settings-input" style="width:120px;padding:6px 12px;"><option selected>标签页</option><option>侧边分屏</option></select>
            </div>
          </div>
        </div>

        <!-- 关于 -->
        <div class="settings-section" id="section-about">
          <h1 class="settings-section-title">关于</h1>
          <p class="settings-section-desc">版本与产品信息</p>
          <div class="settings-card settings-card--flush">
            <div class="about-hero">
              <div class="about-logo">T</div>
              <div class="about-title">TAgent</div>
              <div class="about-version">版本 1.0.0 · Glass Studio</div>
              <div class="about-copy">
                Soft Glass 浮岛壳层原型。<br>
                支持 Mist / Ocean / Moss / Dusk × Soft / Liquid。<br><br>
                © 2026 TAgent Team
              </div>
              <div style="margin-top:16px;display:flex;gap:12px;justify-content:center;">
                <a href="#" class="about-link">查看文档</a>
                <a href="#" class="about-link">GitHub</a>
                <a href="#" class="about-link">问题反馈</a>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </section>
</div>
</div>
`;

    Modal.bindCloseButtons(container);
  },

  bindOpeners() {
    document.querySelectorAll('#settingsBtn, [data-settings]').forEach((btn) => {
      if (btn.dataset.settingsBound === '1') return;
      btn.dataset.settingsBound = '1';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.open();
      });
    });
  },

  bindInner() {
    const root = document.documentElement;
    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    modal.querySelectorAll('.settings-nav-item').forEach((item) => {
      if (item.dataset.bound === '1') return;
      item.dataset.bound = '1';
      item.addEventListener('click', () => this.switchSection(item.dataset.section));
    });

    modal.querySelectorAll('[data-theme-pick]').forEach((card) => {
      if (card.dataset.bound === '1') return;
      card.dataset.bound = '1';
      card.addEventListener('click', () => {
        ThemeManager.apply(card.dataset.themePick, root.dataset.mode, root.dataset.material);
        this.syncAppearanceControls();
      });
    });

    modal.querySelectorAll('[data-material-pick]').forEach((tile) => {
      if (tile.dataset.bound === '1') return;
      tile.dataset.bound = '1';
      tile.addEventListener('click', () => {
        ThemeManager.apply(root.dataset.theme, root.dataset.mode, tile.dataset.materialPick);
        this.syncAppearanceControls();
      });
    });

    const darkToggle = document.getElementById('darkModeToggle');
    if (darkToggle && darkToggle.dataset.bound !== '1') {
      darkToggle.dataset.bound = '1';
      const toggleMode = () => {
        const next = root.dataset.mode === 'dark' ? 'light' : 'dark';
        ThemeManager.apply(root.dataset.theme, next, root.dataset.material);
        this.syncAppearanceControls();
      };
      darkToggle.addEventListener('click', toggleMode);
      darkToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggleMode();
        }
      });
    }

    // Toggle switches
    modal.querySelectorAll('.toggle-switch').forEach((toggle) => {
      if (toggle.dataset.bound === '1') return;
      toggle.dataset.bound = '1';
      toggle.addEventListener('click', () => {
        toggle.classList.toggle('is-active');
        const isActive = toggle.classList.contains('is-active');
        toggle.setAttribute('aria-checked', isActive ? 'true' : 'false');
      });
    });

    if (this._observer) this._observer.disconnect();
    this._observer = new MutationObserver(() => this.syncAppearanceControls());
    this._observer.observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-mode', 'data-material'] });

    this.switchSection(this.currentSection);
  },

  switchSection(section) {
    this.currentSection = section;
    document.querySelectorAll('#settingsModal .settings-nav-item').forEach((item) => {
      item.classList.toggle('is-active', item.dataset.section === section);
    });
    document.querySelectorAll('#settingsModal .settings-section').forEach((sec) => {
      sec.classList.toggle('is-active', sec.id === `section-${section}`);
    });
  },

  syncAppearanceControls() {
    const root = document.documentElement;
    const mode = root.dataset.mode;
    const material = root.dataset.material;
    const theme = root.dataset.theme;

    const darkToggle = document.getElementById('darkModeToggle');
    if (darkToggle) {
      darkToggle.classList.toggle('is-active', mode === 'dark');
      darkToggle.setAttribute('aria-checked', mode === 'dark' ? 'true' : 'false');
    }

    document.querySelectorAll('#settingsModal [data-theme-pick]').forEach((el) => {
      el.classList.toggle('is-selected', el.dataset.themePick === theme);
    });
    document.querySelectorAll('#settingsModal [data-material-pick]').forEach((el) => {
      el.classList.toggle('is-selected', el.dataset.materialPick === material);
    });
  }
};

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  Navigation.init();
  Modal.init();
  SettingsModal.init();

  if (new URLSearchParams(location.search).has('settings')) {
    SettingsModal.open();
  }
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, Navigation, Modal, Toast, Utils, SettingsModal };
}
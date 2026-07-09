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
      settings: 'chat.html?settings'
    };
    if (pages[page]) {
      window.location.href = pages[page];
    }
  }
};

// ========== 模态框系统 ==========

const Modal = {
  _escBound: false,

  open(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
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

  bindCloseButtons(root = document) {
    root.querySelectorAll('[data-modal-close]').forEach((btn) => {
      if (btn.dataset.modalCloseBound === '1') return;
      btn.dataset.modalCloseBound = '1';
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) this.close(modal.id);
      });
    });
  },

  init() {
    document.querySelectorAll('.modal-overlay').forEach((overlay) => {
      if (overlay.dataset.modalOverlayBound === '1') return;
      overlay.dataset.modalOverlayBound = '1';
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.close(overlay.id);
      });
    });

    if (!this._escBound) {
      this._escBound = true;
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          const openModal = document.querySelector('.modal-overlay.is-open');
          if (openModal) this.close(openModal.id);
        }
      });
    }

    this.bindCloseButtons();
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
  currentSection: 'account',
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
    this.renderShortcuts();
    this.renderApiKeys();
  },

  close() {
    Modal.close('settingsModal');
  },

  render() {
    const container = document.getElementById('settingsModal');
    if (!container) return;

    container.classList.add('settings-dialog-overlay');
    container.innerHTML =
      '<div class="modal-content settings-dialog" role="dialog" aria-modal="true" aria-label="设置">' +
      "<div class=\"specular\" aria-hidden=\"true\"></div><div class=\"chroma-edge\" aria-hidden=\"true\"></div><div class=\"settings-shell\">\n      <!-- Left nav island -->\n      <aside class=\"settings-nav-island\" aria-label=\"\u8bbe\u7f6e\u5bfc\u822a\">\n        <div class=\"settings-nav-head\">\n          <svg viewBox=\"0 0 24 24\" fill=\"none\" aria-hidden=\"true\">\n            <circle cx=\"12\" cy=\"12\" r=\"3\" stroke=\"currentColor\" stroke-width=\"1.5\"/>\n            <path d=\"M12 4.5v2M12 17.5v2M4.5 12h2M17.5 12h2M6.4 6.4l1.4 1.4M16.2 16.2l1.4 1.4M17.6 6.4l-1.4 1.4M7.8 16.2l-1.4 1.4\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/>\n          </svg>\n          \u8bbe\u7f6e\n        </div>\n        <nav class=\"settings-nav-scroll\" id=\"settingsNav\">\n          <div class=\"settings-nav-group\">\n            <div class=\"settings-nav-group-label\">\u901a\u7528</div>\n            <div class=\"settings-nav-list\">\n              <button type=\"button\" class=\"settings-nav-item is-active\" data-section=\"account\">\n                <svg viewBox=\"0 0 24 24\" fill=\"none\"><circle cx=\"12\" cy=\"8\" r=\"4\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M5 20a7 7 0 0114 0\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>\n                \u8d26\u6237\n              </button>\n              <button type=\"button\" class=\"settings-nav-item\" data-section=\"appearance\">\n                <svg viewBox=\"0 0 24 24\" fill=\"none\"><circle cx=\"12\" cy=\"12\" r=\"4\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M12 4v2M12 18v2M4 12h2M18 12h2\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>\n                \u5916\u89c2\n              </button>\n              <button type=\"button\" class=\"settings-nav-item\" data-section=\"shortcuts\">\n                <svg viewBox=\"0 0 24 24\" fill=\"none\"><rect x=\"3\" y=\"6\" width=\"18\" height=\"12\" rx=\"2\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M7 10h2M15 10h2M7 14h10\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>\n                \u5feb\u6377\u952e\n              </button>\n            </div>\n          </div>\n          <div class=\"settings-nav-group\">\n            <div class=\"settings-nav-group-label\">\u8fde\u63a5</div>\n            <div class=\"settings-nav-list\">\n              <button type=\"button\" class=\"settings-nav-item\" data-section=\"api\">\n                <svg viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>\n                API \u914d\u7f6e\n              </button>\n            </div>\n          </div>\n          <div class=\"settings-nav-group\">\n            <div class=\"settings-nav-group-label\">\u5173\u4e8e</div>\n            <div class=\"settings-nav-list\">\n              <button type=\"button\" class=\"settings-nav-item\" data-section=\"about\">\n                <svg viewBox=\"0 0 24 24\" fill=\"none\"><circle cx=\"12\" cy=\"12\" r=\"10\" stroke=\"currentColor\" stroke-width=\"1.5\"/><path d=\"M12 16v-4M12 8h.01\" stroke=\"currentColor\" stroke-width=\"1.5\" stroke-linecap=\"round\"/></svg>\n                \u5173\u4e8e\n              </button>\n            </div>\n          </div>\n        </nav>\n      </aside>\n\n      <!-- Right content island -->\n      <section class=\"settings-content-island\">\n        <div class=\"settings-content-top\">\n          <input class=\"settings-search\" type=\"search\" placeholder=\"\u641c\u7d22\u8bbe\u7f6e\u2026\" aria-label=\"\u641c\u7d22\u8bbe\u7f6e\" />\n          <button type=\"button\" class=\"settings-close\" data-modal-close aria-label=\"\u5173\u95ed\u8bbe\u7f6e\" title=\"\u5173\u95ed\">\n            <svg width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\"><path d=\"M6 6l12 12M18 6L6 18\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\"/></svg>\n          </button>\n        </div>\n\n        <div class=\"settings-content-scroll\">\n          <div class=\"settings-content-inner\" id=\"settingsContent\">\n            <!-- Account -->\n            <div class=\"settings-section is-active\" id=\"section-account\">\n              <h1 class=\"settings-section-title\">\u8d26\u6237</h1>\n              <p class=\"settings-section-desc\">\u7ba1\u7406\u4e2a\u4eba\u8d44\u6599\u4e0e\u7528\u91cf\u4fe1\u606f</p>\n\n              <div class=\"settings-card settings-card--flush\">\n                <div class=\"settings-profile\">\n                  <div class=\"settings-avatar\">F</div>\n                  <div>\n                    <div class=\"settings-profile-name\">Frank</div>\n                    <div class=\"settings-profile-meta\">frank@example.com</div>\n                    <span class=\"badge badge-accent\" style=\"margin-top:6px;display:inline-flex;\">Pro</span>\n                  </div>\n                </div>\n              </div>\n\n              <div class=\"settings-card settings-card--flush\">\n                <div class=\"settings-row\">\n                  <div>\n                    <div class=\"settings-row-label\">\u7528\u6237\u540d</div>\n                    <div class=\"settings-row-desc\">\u663e\u793a\u5728\u754c\u9762\u548c\u534f\u4f5c\u4e2d</div>\n                  </div>\n                  <div class=\"settings-row-action\">\n                    <input type=\"text\" class=\"settings-input\" value=\"Frank\" />\n                  </div>\n                </div>\n                <div class=\"settings-row\">\n                  <div>\n                    <div class=\"settings-row-label\">\u90ae\u7bb1</div>\n                    <div class=\"settings-row-desc\">\u7528\u4e8e\u901a\u77e5\u548c\u8d26\u6237\u6062\u590d</div>\n                  </div>\n                  <div class=\"settings-row-action\">\n                    <input type=\"email\" class=\"settings-input\" value=\"frank@example.com\"  />\n                  </div>\n                </div>\n                <div class=\"settings-row\">\n                  <div>\n                    <div class=\"settings-row-label\">\u4f7f\u7528\u91cf\u7edf\u8ba1</div>\n                    <div class=\"settings-row-desc\">Context 42% \u00b7 \u8f93\u5165 1.2k \u00b7 \u8f93\u51fa 860</div>\n                  </div>\n                  <div class=\"settings-row-action\">\n                    <button type=\"button\" class=\"btn-secondary\">\u67e5\u770b\u8be6\u60c5</button>\n                  </div>\n                </div>\n              </div>\n            </div>\n\n            <!-- Appearance -->\n            <div class=\"settings-section\" id=\"section-appearance\">\n              <h1 class=\"settings-section-title\">\u5916\u89c2</h1>\n              <p class=\"settings-section-desc\">4 \u5927\u5bb6\u65cf \u00d7 \u660e\u6697 \u00d7 Soft / Liquid</p>\n\n              <div class=\"settings-card settings-card--flush\">\n                <div class=\"settings-row\">\n                  <div>\n                    <div class=\"settings-row-label\">\u6df1\u8272\u6a21\u5f0f</div>\n                    <div class=\"settings-row-desc\">\u5207\u6362\u754c\u9762\u660e\u6697</div>\n                  </div>\n                  <div class=\"settings-row-action\">\n                    <div class=\"toggle-switch\" id=\"darkModeToggle\" role=\"switch\" aria-checked=\"false\" tabindex=\"0\"></div>\n                  </div>\n                </div>\n              </div>\n\n              <h2 style=\"margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);\">\u4e3b\u9898\u5bb6\u65cf</h2>\n              <div class=\"settings-card settings-card--flush\">\n                <div class=\"theme-grid\" id=\"themeGrid\">\n                  <button type=\"button\" class=\"theme-card is-selected\" data-theme-pick=\"mist\">\n                    <span class=\"theme-card-check\">\u2713</span>\n                    <div class=\"theme-card-swatch\" style=\"background:linear-gradient(135deg,#c5d0e2,#5b7fd4);\"></div>\n                    <div class=\"theme-card-name\">\u4e91\u7d6e</div>\n                    <div class=\"theme-card-sub\">Mist</div>\n                  </button>\n                  <button type=\"button\" class=\"theme-card\" data-theme-pick=\"ocean\">\n                    <span class=\"theme-card-check\">\u2713</span>\n                    <div class=\"theme-card-swatch\" style=\"background:linear-gradient(135deg,#c2d2e0,#4f8fc4);\"></div>\n                    <div class=\"theme-card-name\">\u78a7\u6d77</div>\n                    <div class=\"theme-card-sub\">Ocean</div>\n                  </button>\n                  <button type=\"button\" class=\"theme-card\" data-theme-pick=\"moss\">\n                    <span class=\"theme-card-check\">\u2713</span>\n                    <div class=\"theme-card-swatch\" style=\"background:linear-gradient(135deg,#c6d4ca,#5a8f72);\"></div>\n                    <div class=\"theme-card-name\">\u9752\u82d4</div>\n                    <div class=\"theme-card-sub\">Moss</div>\n                  </button>\n                  <button type=\"button\" class=\"theme-card\" data-theme-pick=\"dusk\">\n                    <span class=\"theme-card-check\">\u2713</span>\n                    <div class=\"theme-card-swatch\" style=\"background:linear-gradient(135deg,#d4ccc2,#a07a5e);\"></div>\n                    <div class=\"theme-card-name\">\u66ae\u972d</div>\n                    <div class=\"theme-card-sub\">Dusk</div>\n                  </button>\n                </div>\n              </div>\n\n              <h2 style=\"margin:18px 0 10px;font-size:13px;font-weight:600;color:var(--text-soft);\">\u754c\u9762\u6750\u8d28</h2>\n              <div class=\"settings-card settings-card--flush\">\n                <div class=\"material-pair\" id=\"materialPair\">\n                  <button type=\"button\" class=\"material-tile is-selected\" data-material-pick=\"soft\">\n                    <div class=\"material-preview material-preview-soft\"></div>\n                    <div class=\"material-name\">\u8f7b\u62df\u6001</div>\n                    <div class=\"material-tag\">Soft Glass</div>\n                  </button>\n                  <button type=\"button\" class=\"material-tile\" data-material-pick=\"liquid\">\n                    <div class=\"material-preview material-preview-liquid\"></div>\n                    <div class=\"material-name\">\u6db2\u6001\u73bb\u7483</div>\n                    <div class=\"material-tag\">Liquid Glass</div>\n                  </button>\n                </div>\n              </div>\n            </div>\n\n            <!-- Shortcuts -->\n            <div class=\"settings-section\" id=\"section-shortcuts\">\n              <h1 class=\"settings-section-title\">\u5feb\u6377\u952e</h1>\n              <p class=\"settings-section-desc\">\u5e38\u7528\u64cd\u4f5c\u7684\u952e\u76d8\u6620\u5c04</p>\n              <div class=\"settings-card settings-card--flush\" id=\"shortcutsList\"></div>\n            </div>\n\n            <!-- API -->\n            <div class=\"settings-section\" id=\"section-api\">\n              <h1 class=\"settings-section-title\">API \u914d\u7f6e</h1>\n              <p class=\"settings-section-desc\">\u7ba1\u7406\u6a21\u578b\u670d\u52a1\u5546\u5bc6\u94a5</p>\n              <div class=\"settings-card settings-card--flush\">\n                <div id=\"apiKeysList\"></div>\n                <div class=\"settings-card-footer\">\n                  <button type=\"button\" class=\"btn-secondary\" id=\"addApiKeyBtn\">+ \u6dfb\u52a0 API \u5bc6\u94a5</button>\n                </div>\n              </div>\n            </div>\n\n            <!-- About -->\n            <div class=\"settings-section\" id=\"section-about\">\n              <h1 class=\"settings-section-title\">\u5173\u4e8e</h1>\n              <p class=\"settings-section-desc\">\u7248\u672c\u4e0e\u4ea7\u54c1\u4fe1\u606f</p>\n              <div class=\"settings-card settings-card--flush\">\n                <div class=\"about-hero\">\n                  <div class=\"about-logo\">T</div>\n                  <div class=\"about-title\">TAgent</div>\n                  <div class=\"about-version\">\u7248\u672c 1.0.0 \u00b7 Glass Studio</div>\n                  <div class=\"about-copy\">\n                    Soft Glass \u6d6e\u5c9b\u58f3\u5c42\u539f\u578b\u3002<br />\n                    \u652f\u6301 Mist / Ocean / Moss / Dusk \u00d7 Soft / Liquid\u3002<br /><br />\n                    \u00a9 2026 TAgent Team\n                  </div>\n                </div>\n              </div>\n            </div>\n          </div>\n        </div>\n      </section>\n    </div>" +
      '</div>';

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

    const addApi = document.getElementById('addApiKeyBtn');
    if (addApi && addApi.dataset.bound !== '1') {
      addApi.dataset.bound = '1';
      addApi.addEventListener('click', () => {
        Toast.info('API 密钥配置功能开发中...');
      });
    }

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
  },

  renderShortcuts() {
    const container = document.getElementById('shortcutsList');
    if (!container || typeof mockData === 'undefined') return;
    container.innerHTML = mockData.settings.shortcuts.map((s) => `
      <div class="shortcut-item">
        <span class="shortcut-action">${s.action}</span>
        <span class="shortcut-key">${s.key}</span>
      </div>
    `).join('');
  },

  renderApiKeys() {
    const container = document.getElementById('apiKeysList');
    if (!container || typeof mockData === 'undefined') return;
    container.innerHTML = mockData.settings.apiKeys.map((api) => `
      <div class="api-key-card">
        <div class="api-key-info">
          <div class="api-key-icon">
            <svg viewBox="0 0 24 24" fill="none" width="16" height="16">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div>
            <div class="api-key-name">${api.name}</div>
            <div class="api-key-status">${api.configured ? `上次使用: ${api.lastUsed || '今天'}` : '未配置'}</div>
          </div>
        </div>
        <button type="button" class="btn-secondary">${api.configured ? '更新' : '配置'}</button>
      </div>
    `).join('');
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
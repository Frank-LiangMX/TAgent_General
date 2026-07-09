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

    // 关闭按钮
    document.querySelectorAll('[data-modal-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modal = btn.closest('.modal-overlay');
        if (modal) this.close(modal.id);
      });
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

// ========== 初始化 ==========

document.addEventListener('DOMContentLoaded', () => {
  ThemeManager.init();
  Navigation.init();
  Modal.init();
});

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ThemeManager, Navigation, Modal, Toast, Utils };
}
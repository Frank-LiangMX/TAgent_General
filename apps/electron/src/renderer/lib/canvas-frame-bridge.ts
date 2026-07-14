/**
 * canvas-frame-bridge.ts — iframe 内部 DOM 追踪 + 通信桥
 *
 * v2 设计：docs/plans/2026-07-14-design-canvas-v2.md §4.1-§4.2
 *
 * 这个文件包含两段代码：
 *  1) INNER_SCRIPT_JS — 注入到 iframe 内部的脚本源码（**纯 JS**，无 TS 类型注解，
 *     因为它会被 toString() 出来作为字符串塞进 <script>）。
 *     职责：
 *       - 遍历 body 子树给有意义元素打 data-design-id
 *       - 把元素元数据 postMessage 回父窗口（layers:report）
 *       - 监听 click / mouseover，把事件打包回父窗口
 *       - 监听父窗口 command：highlight:set / highlight:clear / layers:rescan
 *  2) FrameBridgeClient（父窗口侧）— 管理 iframe 引用、监听 message、
 *     派发回调供 React hook 使用。
 *
 * 关键约束：
 *  - iframe 必须 sandbox="allow-scripts allow-same-origin"，否则父窗口收不到 postMessage
 *  - srcDoc 每次 version 变化都会重写整个文档，注入脚本需要自包含、自启动
 *  - 注入脚本内不做任何网络请求（合规约束）
 */

import type {
  CanvasElement,
  CanvasFrameCommand,
  CanvasFrameMessage,
  DesignViewport,
} from '@/atoms/design-preview-atoms'

/**
 * 注入到 iframe 内部的脚本源码（纯 JS，无 TS 类型注解）。
 * 函数体是 toString() 的输出，会被父组件拼到 <script> 里。
 */
const INNER_SCRIPT_JS = `
(function () {
  if (window.__tagent_design_v2__) return;
  window.__tagent_design_v2__ = { ready: false };
  var currentMode = 'select'; // 'select' | 'interact' | 'pan'

  var SKIP_TAGS = {
    SCRIPT: 1, STYLE: 1, META: 1, LINK: 1, BR: 1, HR: 1, NOSCRIPT: 1,
    HEAD: 1, TITLE: 1, BASE: 1,
  };
  var ROLE_BY_TAG = {
    BUTTON: 'button', INPUT: 'input', TEXTAREA: 'input', SELECT: 'input',
    IMG: 'image', SVG: 'image', A: 'link',
  };
  function classifyRole(tag) {
    if (ROLE_BY_TAG[tag]) return ROLE_BY_TAG[tag];
    if (/^H[1-6]$/.test(tag)) return 'heading';
    return null;
  }

  var idCounter = 0;
  var idMap = new Map();
  var reverseMap = new Map();

  function nextId() { idCounter += 1; return 'd-' + idCounter; }

  function shouldSkip(el) {
    var tag = el.tagName.toUpperCase();
    if (SKIP_TAGS[tag]) return true;
    try {
      var s = window.getComputedStyle(el);
      if (s.display === 'none' || s.visibility === 'hidden') return true;
    } catch (e) {}
    return false;
  }

  function classify(el) {
    var tag = el.tagName.toUpperCase();
    var role = classifyRole(tag);
    var text = '';
    if (!role) {
      var hasEl = false;
      for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 1) { hasEl = true; break; }
      }
      role = hasEl ? 'container' : 'text';
    }
    var raw = (el.textContent || '').replace(/\\s+/g, ' ').trim();
    text = raw.length > 80 ? raw.slice(0, 80) + '…' : raw;
    return { role: role, text: text };
  }

  function walk(root, parentId, out) {
    if (shouldSkip(root)) return;
    var id = nextId();
    idMap.set(root, id);
    reverseMap.set(id, root);
    root.setAttribute('data-design-id', id);
    var childIds = [];
    var children = root.children;
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (shouldSkip(child)) continue;
      walk(child, id, out);
      var cid = idMap.get(child);
      if (cid) childIds.push(cid);
    }
    var rect = root.getBoundingClientRect();
    var info = classify(root);
    out.push({
      id: id,
      tag: root.tagName.toUpperCase(),
      text: info.text,
      role: info.role,
      parentId: parentId,
      childIds: childIds,
      bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    });
  }

  var collected = [];

  function rescan() {
    collected = [];
    idMap.clear();
    reverseMap.clear();
    idCounter = 0;
    var body = document.body;
    if (!body) return;
    walk(body, null, collected);
    parent.postMessage({ type: 'layers:report', layers: collected }, '*');
  }

  function findElId(target) {
    var el = target;
    while (el && el.nodeType === 1) {
      if (el.hasAttribute && el.hasAttribute('data-design-id')) return el;
      el = el.parentElement;
    }
    return null;
  }

  document.addEventListener('click', function (e) {
    if (currentMode !== 'select') return; // 非选择模式：不捕获点击，让控件正常工作
    var el = findElId(e.target);
    if (!el) return;
    var id = el.getAttribute('data-design-id');
    var rect = el.getBoundingClientRect();
    // 选择模式：停止事件传播，让控件不响应（输入框不聚焦、按钮不触发、链接不跳转）
    e.stopPropagation();
    e.preventDefault();
    parent.postMessage({
      type: 'element:clicked',
      id: id,
      bounds: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      additive: !!(e.metaKey || e.ctrlKey || e.shiftKey),
    }, '*');
  }, true);

  // hover 节流：mouseover 在画布内可能 1s 触发数百次；
  // 只在 interval 内最多同步一次，避免 postMessage 风暴造成父窗口重渲染卡顿。
  // interact 模式跳过 hover（不需要选中高亮）。
  var lastHoverId = null;
  var lastHoverTs = 0;
  var HOVER_INTERVAL = 80;
  document.addEventListener('mouseover', function (e) {
    if (currentMode !== 'select') return;
    var el = findElId(e.target);
    var id = el ? el.getAttribute('data-design-id') : null;
    var now = Date.now();
    if (id === lastHoverId) return;
    if (now - lastHoverTs < HOVER_INTERVAL) return;
    lastHoverId = id;
    lastHoverTs = now;
    parent.postMessage({ type: 'element:hovered', id: id }, '*');
  }, true);

  // 选择模式时光标覆盖：强制所有元素显示指针光标（避免输入框 I 型光标干扰选中）
  var cursorStyleId = '__tagent_cursor_override__';
  function updateCursorForMode(mode) {
    var el = document.getElementById(cursorStyleId);
    if (mode === 'select') {
      if (!el) {
        el = document.createElement('style');
        el.id = cursorStyleId;
        document.head.appendChild(el);
      }
      el.textContent = '*, *::before, *::after { cursor: pointer !important; }';
    } else {
      if (el) el.textContent = '';
    }
  }

  window.addEventListener('message', function (e) {
    var data = e.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'mode:set') {
      currentMode = data.mode;
      updateCursorForMode(data.mode);
    } else if (data.type === 'highlight:set') {
      var hlNodes = document.querySelectorAll('[data-design-hl]');
      for (var i = 0; i < hlNodes.length; i++) {
        hlNodes[i].removeAttribute('data-design-hl');
        hlNodes[i].style.outline = '';
        hlNodes[i].style.outlineOffset = '';
      }
      var ids = data.ids || [];
      for (var j = 0; j < ids.length; j++) {
        var target = reverseMap.get(ids[j]);
        if (!target) continue;
        target.setAttribute('data-design-hl', '1');
        target.style.outline = '2px solid #3b82f6';
        target.style.outlineOffset = '-2px';
      }
    } else if (data.type === 'highlight:clear') {
      var clr = document.querySelectorAll('[data-design-hl]');
      for (var k = 0; k < clr.length; k++) {
        clr[k].removeAttribute('data-design-hl');
        clr[k].style.outline = '';
        clr[k].style.outlineOffset = '';
      }
    } else if (data.type === 'layers:rescan') {
      rescan();
    }
  });

  function boot() {
    rescan();
    window.__tagent_design_v2__.ready = true;
    parent.postMessage({ type: 'iframe:ready' }, '*');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
`.trim()

/**
 * 父组件调用：拿到要拼到 <script> 的字符串
 */
export function buildFrameInjectionScript(): string {
  return INNER_SCRIPT_JS
}

// ==================== 父窗口侧：FrameBridgeClient ====================

export interface FrameBridgeHandlers {
  onLayers: (layers: CanvasElement[]) => void
  onElementClicked: (id: string, bounds: CanvasElement['bounds'], additive: boolean) => void
  onElementHovered: (id: string | null) => void
  onReady?: () => void
}

/**
 * 父窗口侧的 bridge 客户端。
 * 生命周期：组件挂载时 new，挂载前/卸载时 dispose()。
 */
export class FrameBridgeClient {
  private iframe: HTMLIFrameElement | null = null
  private contentWindow: Window | null = null
  private handlers: FrameBridgeHandlers | null = null

  /** 关联到具体的 iframe 元素 + handler 集合。 */
  attach(iframe: HTMLIFrameElement, handlers: FrameBridgeHandlers): void {
    this.detach()
    this.iframe = iframe
    this.contentWindow = iframe.contentWindow
    this.handlers = handlers
    window.addEventListener('message', this.onMessage)
  }

  detach(): void {
    window.removeEventListener('message', this.onMessage)
    this.iframe = null
    this.contentWindow = null
    this.handlers = null
  }

  /**
   * iframe.contentWindow 变化时（srcDoc 重写 / 重新加载）调用，
   * 否则 onMessage 里的 source 比对会失败，新的 contentWindow 发出的 message 全被丢。
   */
  onIframeReloaded(): void {
    if (this.iframe) {
      this.contentWindow = this.iframe.contentWindow
    }
  }

  private onMessage = (e: MessageEvent): void => {
    // 比对：必须是最新 contentWindow（srcDoc 重写后会变）
    if (!this.contentWindow || e.source !== this.contentWindow) return
    const data = e.data as CanvasFrameMessage | undefined
    if (!data || typeof data !== 'object') return
    switch (data.type) {
      case 'layers:report':
        this.handlers?.onLayers(data.layers)
        break
      case 'element:clicked':
        this.handlers?.onElementClicked(data.id, data.bounds, data.additive)
        break
      case 'element:hovered':
        this.handlers?.onElementHovered(data.id)
        break
      case 'iframe:ready':
        this.handlers?.onReady?.()
        break
    }
  }

  /** 父 → iframe：设置高亮元素 */
  setHighlight(ids: string[]): void {
    this.post({ type: 'highlight:set', ids })
  }

  clearHighlight(): void {
    this.post({ type: 'highlight:clear' })
  }

  rescan(): void {
    this.post({ type: 'layers:rescan' })
  }

  setMode(mode: 'select' | 'interact' | 'pan'): void {
    this.post({ type: 'mode:set', mode })
  }

  private post(cmd: CanvasFrameCommand): void {
    const win = this.iframe?.contentWindow
    if (!win) return
    win.postMessage(cmd, '*')
  }
}

// ==================== 工具：iframe 内容坐标 → 画布坐标 ====================

/**
 * iframe 视口坐标（来自 CanvasElement.bounds）转画布坐标。
 * 父窗口在画布上绘制高亮覆盖层时用。
 */
export function iframeBoundsToCanvas(
  bounds: CanvasElement['bounds'],
  iframeRect: DOMRect,
  zoom: number,
  pan: DesignViewport,
): { x: number; y: number; width: number; height: number } {
  return {
    x: iframeRect.left + bounds.x * zoom + pan.panX,
    y: iframeRect.top + bounds.y * zoom + pan.panY,
    width: bounds.width * zoom,
    height: bounds.height * zoom,
  }
}
/**
 * designPreviewSampleHtml — Design Preview 测试用样例 HTML
 *
 * 提供几个演示样例，方便手动测试画布渲染。
 */

import type { DeviceType } from './design-preview-atoms'

export interface DesignPreviewSample {
  id: string
  name: string
  html: string
  css?: string
  recommendedDevice?: DeviceType
}

/** 登录页样例 */
const loginPage: DesignPreviewSample = {
  id: 'login',
  name: '登录页',
  recommendedDevice: 'mobile',
  html: `
    <div class="page">
      <div class="hero">
        <div class="logo">●</div>
        <h1>欢迎回来</h1>
        <p class="subtitle">登录以继续使用</p>
      </div>
      <form class="form">
        <label class="field">
          <span>邮箱</span>
          <input type="email" placeholder="you@example.com" />
        </label>
        <label class="field">
          <span>密码</span>
          <input type="password" placeholder="••••••••" />
        </label>
        <button type="submit" class="btn-primary">登录</button>
        <a href="#" class="link">忘记密码？</a>
      </form>
    </div>
  `,
  css: `
    .page { padding: 32px 24px; min-height: 100vh; }
    .hero { text-align: center; margin-bottom: 32px; }
    .logo { width: 56px; height: 56px; margin: 0 auto 16px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 16px; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; }
    h1 { font-size: 24px; font-weight: 700; margin: 0 0 8px; color: #1a1a1a; }
    .subtitle { font-size: 14px; color: #71717a; margin: 0; }
    .form { display: flex; flex-direction: column; gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field span { font-size: 13px; font-weight: 500; color: #3f3f46; }
    .field input { padding: 12px 14px; border: 1px solid #e4e4e7; border-radius: 10px; font-size: 15px; outline: none; transition: border-color 0.15s; }
    .field input:focus { border-color: #3b82f6; }
    .btn-primary { padding: 14px; background: #3b82f6; color: white; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
    .btn-primary:hover { background: #2563eb; }
    .link { text-align: center; color: #3b82f6; font-size: 13px; text-decoration: none; }
  `,
}

/** 仪表盘样例 */
const dashboard: DesignPreviewSample = {
  id: 'dashboard',
  name: '仪表盘',
  recommendedDevice: 'desktop',
  html: `
    <div class="layout">
      <aside class="sidebar">
        <div class="brand">Studio</div>
        <nav>
          <a class="nav-item active">概览</a>
          <a class="nav-item">项目</a>
          <a class="nav-item">团队</a>
          <a class="nav-item">设置</a>
        </nav>
      </aside>
      <main class="main">
        <header class="header">
          <h2>概览</h2>
          <div class="user-avatar">F</div>
        </header>
        <div class="grid">
          <div class="card">
            <div class="card-label">本月收入</div>
            <div class="card-value">¥ 128,400</div>
            <div class="card-trend up">↑ 12.5%</div>
          </div>
          <div class="card">
            <div class="card-label">活跃用户</div>
            <div class="card-value">3,842</div>
            <div class="card-trend up">↑ 8.1%</div>
          </div>
          <div class="card">
            <div class="card-label">转化率</div>
            <div class="card-value">4.6%</div>
            <div class="card-trend down">↓ 0.3%</div>
          </div>
        </div>
      </main>
    </div>
  `,
  css: `
    .layout { display: flex; min-height: 100vh; }
    .sidebar { width: 220px; background: #fafafa; padding: 24px 16px; border-right: 1px solid #e4e4e7; }
    .brand { font-size: 18px; font-weight: 700; margin-bottom: 24px; padding: 0 8px; }
    .nav-item { display: block; padding: 10px 12px; border-radius: 8px; color: #71717a; font-size: 14px; cursor: pointer; }
    .nav-item:hover { background: #f4f4f5; color: #1a1a1a; }
    .nav-item.active { background: #3b82f6; color: white; }
    .main { flex: 1; padding: 32px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; }
    .header h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
    .card { padding: 20px; background: white; border: 1px solid #e4e4e7; border-radius: 12px; }
    .card-label { font-size: 13px; color: #71717a; margin-bottom: 8px; }
    .card-value { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .card-trend { font-size: 12px; font-weight: 500; }
    .card-trend.up { color: #10b981; }
    .card-trend.down { color: #ef4444; }
  `,
}

/** 设置页样例 */
const settings: DesignPreviewSample = {
  id: 'settings',
  name: '设置页',
  recommendedDevice: 'desktop',
  html: `
    <div class="container">
      <h1>设置</h1>
      <div class="section">
        <h3>账户</h3>
        <div class="row">
          <div>
            <div class="row-title">头像</div>
            <div class="row-desc">点击更换</div>
          </div>
          <div class="avatar">F</div>
        </div>
        <div class="row">
          <div>
            <div class="row-title">显示名称</div>
            <div class="row-desc">Frank Danny</div>
          </div>
        </div>
      </div>
      <div class="section">
        <h3>通知</h3>
        <div class="row">
          <div>
            <div class="row-title">桌面通知</div>
            <div class="row-desc">允许 Agent 发送桌面通知</div>
          </div>
          <label class="switch"><input type="checkbox" checked /><span></span></label>
        </div>
      </div>
    </div>
  `,
  css: `
    .container { max-width: 720px; margin: 0 auto; padding: 32px; }
    h1 { font-size: 24px; font-weight: 700; margin: 0 0 24px; }
    .section { background: white; border: 1px solid #e4e4e7; border-radius: 12px; margin-bottom: 16px; overflow: hidden; }
    .section h3 { margin: 0; padding: 16px 20px; font-size: 14px; font-weight: 600; color: #71717a; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e4e4e7; }
    .row { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid #f4f4f5; }
    .row:last-child { border-bottom: none; }
    .row-title { font-size: 14px; font-weight: 500; }
    .row-desc { font-size: 12px; color: #71717a; margin-top: 2px; }
    .avatar { width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; display: flex; align-items: center; justify-content: center; font-weight: 600; }
    .switch { position: relative; width: 40px; height: 22px; }
    .switch input { opacity: 0; width: 0; height: 0; }
    .switch span { position: absolute; cursor: pointer; inset: 0; background: #e4e4e7; border-radius: 22px; transition: 0.2s; }
    .switch span::before { content: ''; position: absolute; width: 18px; height: 18px; left: 2px; top: 2px; background: white; border-radius: 50%; transition: 0.2s; }
    .switch input:checked + span { background: #3b82f6; }
    .switch input:checked + span::before { transform: translateX(18px); }
  `,
}

/** 所有样例 */
export const DESIGN_PREVIEW_SAMPLES: DesignPreviewSample[] = [loginPage, dashboard, settings]
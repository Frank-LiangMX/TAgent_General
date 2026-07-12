# 柔和 Material Design 表面体系（普通材质）

> **状态**: In Progress  
> **日期**: 2026-07-12  
> **分支**: `feature/material-md-surface-system`  
> **前置**: ADR-0005 Surface Token 基线（已合 main）

---

## 0. TL;DR

在 **普通材质（frosted）** 上建立 M3 风格的 **surface 角色阶梯 + 轻 elevation + 形状/字号约定**，解决灰叠脏、字号圆角碎片化。

高级材质 glass / soft **不破坏**；仍只改 `--surface-*` 增强表。

---

## 1. 角色表（`packages/ui/styles/md-surface.css`）

| MD 角色 | CSS 变量 | 浅色映射 | 用途 |
|---------|----------|----------|------|
| surface | `--md-surface` | background | 主内容画布 |
| surface-container-lowest | `--md-surface-container-lowest` | dialog 近白 | 会话 well、抬起卡片 |
| surface-container-low | `--md-surface-container-low` | card | 侧栏岛、panel |
| surface-container | `--md-surface-container` | secondary | chip、搜索槽、分段轨 |
| surface-container-high | `--md-surface-container-high` | muted | 少用；深分组 |
| on-surface | `--md-on-surface` | foreground | 正文 |
| on-surface-variant | `--md-on-surface-variant` | muted-foreground | 次要字 |
| primary-container | `--md-primary-container` | primary 混 dialog | 列表选中 |
| outline | `--md-outline` | border | 描边 |
| state-hover | `--md-state-hover` | color-mix 不透明 | hover |

**硬规则**：大面积面板 **禁止** 当 `muted` 底。

---

## 2. 与材质表的桥接

`glass.css` frosted 表：

```
--surface-bg          ← container-low
--surface-bg-well     ← container-lowest
--surface-bg-chip     ← container
--session-glass-strong← primary-container
--hover-fill          ← state-hover
--surface-shadow*     ← md-elevation-1/2
```

---

## 3. 形状与字号（约定，逐步收敛）

| 档 | 变量 | 值 |
|----|------|-----|
| xs–xl | `--md-shape-*` | 4 / 8 / 12 / 16 / 24 |
| label/body/title | `--md-type-*` | 11–16px |

业务新增禁止随意 `text-[9px]` / `rounded-[14px]`（存量后续清）。

---

## 4. 落地范围（本分支 P0）

- [x] `md-surface.css` + globals import  
- [x] frosted 映射 MD 角色  
- [x] well / nav-island / panel / content-plate / 选中 / 气泡  
- [ ] 侧栏字号统一到 type 型谱（P1）  
- [ ] 全量清理 `text-[Npx]`（P1）  
- [ ] colors.ts 内嵌真实 tone 阶梯（P2，可选）  

---

## 5. 验收

- [ ] 浅色：侧栏灰岛 + **近白 well**，不脏  
- [ ] 选中：primary-container 柔和，非高饱和整条  
- [ ] hover：实色浅灰，不透  
- [ ] glass/soft：高级材质仍可用  

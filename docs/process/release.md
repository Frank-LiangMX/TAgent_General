# Release 流程

> TAgent 用 **语义化版本** + `scripts/release.py` 自动发版。

## 1. 版本号规则

[Semantic Versioning](https://semver.org/)：`MAJOR.MINOR.PATCH`

- **MAJOR**：不兼容 API 改动
- **MINOR**：向后兼容的新功能
- **PATCH**：向后兼容的 bug 修复
- **预发布**：`1.0.0-rc.1` / `1.0.0-beta.2`

## 2. 什么时候发版

- **PATCH**：随时（bug fix 后）
- **MINOR**：功能累积到一个里程碑（每 2-4 周）
- **MAJOR**：架构大改（每 3-6 月）

## 3. 发版流程

### 3.1 准备
1. 所有计划功能合入 main
2. CI 全绿
3. CHANGELOG.md 完整（`[Unreleased]` 段已填好）
4. README.md 反映当前状态

### 3.2 跑 release 脚本
```bash
# 1. 看现状
python scripts/release.py status

# 2. 试运行（不真发）
python scripts/release.py ship 0.2.0 --dry-run

# 3. 真发
python scripts/release.py ship 0.2.0 --yes
```

脚本自动：
1. 把 `[Unreleased]` 段移到新的 `[0.2.0] - 2026-06-05` 段
2. 重置 `[Unreleased]` 为空
3. 更新 `VERSION` 文件 + `package.json` + 同步 4 个文件
4. git commit + push main
5. 创建 git tag `v0.2.0` + push tag
6. 触发 CI build 流程

### 3.3 CI 跑构建
- tag push → GitHub Actions 触发 release workflow
- 构建：PyInstaller（ta_agent）+ electron-builder（Desktop）+ docker build（Server）
- 产物上传到 GitHub Releases
- 自动写 Release Notes（从 CHANGELOG 拉）

## 4. Release 后验证

- [ ] 产物下载链接有效
- [ ] 安装包能跑（macOS / Windows / Linux 各跑一次）
- [ ] 旧版本能升级（数据迁移）
- [ ] CHANGELOG.md 在 GitHub Releases 可见

## 5. 紧急 Hotfix Release

紧急修复走 **fast-track**：

```bash
# 1. 切 hotfix 分支
git checkout -b fix/critical-bug main

# 2. 修 + 测试 + push
git push origin fix/critical-bug

# 3. 紧急 PR（1 个 reviewer）
gh pr create --label "hotfix"

# 4. merge 后立刻 ship patch
python scripts/release.py ship 0.2.1 --yes
```

## 6. Pre-release 流程

大版本前发 RC / Beta：

```bash
# RC
python scripts/release.py ship 1.0.0-rc.1 --yes

# Beta
python scripts/release.py ship 1.0.0-beta.1 --yes

# 正式
python scripts/release.py ship 1.0.0 --yes
```

RC 期间：
- 不强制兼容
- 用户明确知道是 pre-release
- 数据迁移脚本可后续补

## 7. 长期支持版本（LTS）

TAgent 暂不维护 LTS（项目早期）。后续看需要。

## 8. 不允许的发版操作

- ❌ 手动改 `VERSION` 后 commit（脚本会覆盖）
- ❌ 手动 `git tag`（脚本会覆盖）
- ❌ force-push tag（重写历史 = 数据丢失风险）
- ❌ 跳号发版（如 0.1.0 → 0.3.0 而不写 0.2.x）
- ❌ 在 CI 失败时手动上传产物

## 9. 故障恢复

### 9.1 Tag 推错了
```bash
# 删本地 + 远端
git tag -d v0.2.0
git push origin :refs/tags/v0.2.0

# 改 CHANGELOG + 重新 ship
```

### 9.2 Build 失败
```bash
# 删 tag
git push origin :refs/tags/v0.2.0

# 修 spec / config
# 重新 ship
```

### 9.3 数据迁移出错
- 不重发版本（用户可能已经升级）
- 发 0.2.1 修复 + 数据迁移回滚命令
- 在 CHANGELOG 标注 "important: if upgrading from 0.1.x, ..."

## 10. 工具脚本

`scripts/release.py` 必须包含：
- `status` — 当前版本 / 下一个版本建议
- `ship <version>` — 发版
- `dry-run` — 试运行不真做
- `--yes` — 跳过确认
- `--no-tag` — 不打 tag（罕见）
- `--no-push` — 不 push（罕见）
- `--from <branch>` — 从其他分支发版

脚本必须 idempotent：跑两遍第二遍应检测到"已发过"并退出。

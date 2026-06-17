# Release 流程

TAgent 发布由 GitHub Actions 完成。本地发布工具只负责检查状态、触发
`.github/workflows/release.yml`、等待 workflow 完成，并列出最终上传的产物。

发布工具不直接 push `main`，不 force-push tag，也不手动上传 release 资产。

## 1. 版本规则

使用 Semantic Versioning：

- `MAJOR.MINOR.PATCH`，例如 `1.0.1`
- 预发布版本，例如 `1.1.0-rc.1`
- GitHub Release tag 使用 `v` 前缀，例如 `v1.0.1`

### 版本号来源

- **应用版本号**：从 `apps/electron/package.json` 的 `version` 字段读取
- **关于页显示**：
  - 显示当前安装版本（`package.json` 版本）
  - 自动从 GitHub Release 获取最新发布版本
  - 若有新版本，显示"新版本 vX.X.X 可用"提示
- **更新检查**：通过 `electron-updater` 连接 GitHub Release 自动检测

### 版本号更新流程

1. 手动修改 `apps/electron/package.json` 的 `version` 字段
2. 运行发布脚本创建对应 tag
3. GitHub Actions 自动构建并创建 Release
4. 用户应用自动检测到新版本提示更新

## 2. 发布前检查

1. 所有发布相关改动必须通过 PR 合并进 `main`。
2. 确认 `origin/main` 包含要发布的提交。
3. 确认 CI 通过。
4. 确认 `CHANGELOG.md` 已记录发布相关变更。
5. 确认 GitHub CLI 已登录：

```bash
gh auth status
```

如未登录：

```bash
gh auth login
```

## 3. 发布工具

查看发布状态和最近的 release workflow：

```bash
python scripts/release.py status
bun run release:status
```

查看某个已发布 tag：

```bash
python scripts/release.py status v1.0.0
```

试运行，不真正触发 GitHub Actions：

```bash
python scripts/release.py publish v1.0.1 --dry-run
```

触发发布并等待 workflow 完成：

```bash
python scripts/release.py publish v1.0.1 --yes
bun run release:publish -- v1.0.1 --yes
```

只触发，不等待：

```bash
python scripts/release.py publish v1.0.1 --yes --no-watch
```

`ship` 子命令保留为 `publish` 的兼容别名：

```bash
python scripts/release.py ship v1.0.1 --yes
```

## 4. 工具会检查什么

- 本机存在 `git` 和 `gh`。
- GitHub CLI 已登录。
- 传入版本符合 semver。
- `origin/main` 可用。
- 同名 GitHub Release 不存在。只有明确传入 `--allow-existing-release` 时才允许重跑。

本地工作区有未提交文件时，工具会提示但不阻止发布。发布产物始终来自远端
`main`，不来自本地工作区。

## 5. GitHub Actions 会构建什么

release workflow 会构建并上传：

- Windows installer 和 updater metadata
- macOS dmg/zip 和 updater metadata
- Linux AppImage、deb、tar.gz 和 updater metadata

所有平台构建成功后，workflow 会创建对应 tag 的 GitHub Release。

## 6. 失败恢复

如果 workflow 失败：

1. 在 GitHub Actions 查看失败 job 日志，或执行：

```bash
gh run view <run-id> --log
```

2. 在 `fix/*` 分支修复。
3. 开 PR 并合并到 `main`。
4. 用同一个 tag 重新触发：

```bash
python scripts/release.py publish v1.0.1 --yes
```

除非项目负责人明确要求，不要删除或重写已经发布的 tag。

## 7. 发布后验证

确认 release 页面和资产列表：

```bash
python scripts/release.py status v1.0.1
```

尽量做安装包 smoke test：

- Windows `.exe`
- macOS `.dmg` 或 `.zip`
- Linux `.AppImage`、`.deb` 或 `.tar.gz`

# Reference-Only Assets

这个目录只放“未进入主线运行逻辑，但保留用于参考”的实现与备份。

包括：

- `electron-renderer-mirror/`：从 `apps/electron` 挪出的独立 HTML/CSS 镜像页面与样式
- `renderer-experiments/`：未接线的消息流实验组件、旧版 renderer 备份
- `ui-style-experiments/`：未被正式 `packages/ui` 样式入口引用的试验性样式文件

这些文件不参与 Electron 正式构建，也不应被当作当前产品代码入口。

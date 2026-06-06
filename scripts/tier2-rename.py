#!/usr/bin/env python3
"""
Tier 2 in-app brand rename: proma-* / proma: / proma_event / proma-user 等
T2.1 范围：localStorage keys / event names / DOM data-attr / CSS class / TS id / 业务字段
不在范围：~/.proma/ (生产配置目录 T2.4)，资产文件名 (T2.3)，yml/package.json (T2.4)
"""
import re
import sys
from pathlib import Path

ROOT = Path(r"F:\TAgent_General")

# (pattern, replacement, description) — pattern 用 regex 精确匹配
RENAMES = [
    # === localStorage keys (A1) ===
    (r"proma-theme-mode", "tagent-theme-mode", "localStorage key"),
    (r"proma-theme-style", "tagent-theme-style", "localStorage key"),
    (r"proma-app-mode", "tagent-app-mode", "localStorage key"),
    (r"proma-selected-model", "tagent-selected-model", "localStorage key"),
    (r"proma-context-length", "tagent-context-length", "localStorage key"),
    (r"proma-thinking-enabled", "tagent-thinking-enabled", "localStorage key"),
    (r"proma-thinking-expanded", "tagent-thinking-expanded", "localStorage key"),
    (r"proma-agent-process-groups-keep-expanded", "tagent-agent-process-groups-keep-expanded", "localStorage key"),
    (r"proma-agent-sidepanel-open", "tagent-agent-sidepanel-open", "localStorage key"),
    (r"proma-agent-sidepanel-width", "tagent-agent-sidepanel-width", "localStorage key"),
    (r"proma-markdown-toc-open", "tagent-markdown-toc-open", "localStorage key"),
    (r"proma-preview-split-ratio", "tagent-preview-split-ratio", "localStorage key"),
    (r"proma-auto-preview-enabled", "tagent-auto-preview-enabled", "localStorage key"),
    (r"proma-sidebar-collapsed", "tagent-sidebar-collapsed", "localStorage key"),
    (r"proma-workspace-list-height", "tagent-workspace-list-height", "localStorage key"),
    (r"proma-agent-sidebar-top-height", "tagent-agent-sidebar-top-height", "localStorage key"),
    (r"proma-selected-system-prompt-id", "tagent-selected-system-prompt-id", "localStorage key"),

    # === 自定义事件 (A2) ===
    (r"proma:stop-generation", "tagent:stop-generation", "window event"),
    (r"proma:focus-input", "tagent:focus-input", "window event"),
    (r"proma:clear-context", "tagent:clear-context", "window event"),
    (r"proma:insert-voice-dictation-text", "tagent:insert-voice-dictation-text", "window event"),
    (r"__proma-scratch-pad__", "__tagent-scratch-pad__", "DOM input id"),

    # === 业务 kind 字段 (A4/A5) ===
    (r"'proma_event'", "'tagent_event'", "AgentEvent kind"),
    (r'"proma_event"', '"tagent_event"', "AgentEvent kind"),

    # === TS 变量名 (A4) ===
    (r"_promaStableKey", "_tagentStableKey", "TS private field"),
    (r"targetIsProma", "targetIsTAgent", "voice-dictation param"),
    (r"shouldWriteProma", "shouldWriteTAgent", "text-output bool"),
    (r"promaOfficial", "tagentOfficial", "AgentView local var"),

    # === 业务字段值 (A5) ===
    (r"'proma-input'", "'tagent-input'", "voice dictation output mode"),
    (r"'proma-preview'", "'tagent-preview'", "settings type literal"),
    (r"'proma-installers'", "'tagent-installers'", "settings type literal"),
    (r"'proma-official'", "'tagent-official'", "channel id"),
    (r"'proma-user'", "'tagent-user'", "memory userId default"),
    (r"'proma-desktop'", "'tagent-desktop'", "doubao asr uid"),
    (r"uid: 'proma-desktop'", "uid: 'tagent-desktop'", "doubao asr uid assign"),
    (r"source: 'proma'", "source: 'tagent'", "memos source"),
    (r"source: 'proma-builtin'", "source: 'tagent-builtin'", "memos source"),
    (r"\['proma'\]", "['tagent']", "memos tags"),
    (r"client_id: `proma_", "client_id: `tagent_", "wechat client_id"),
    (r"proma_\$\{Date\.now\(\)\}", "tagent_${Date.now()}", "wechat client_id"),
    (r"conversation_id: params\.conversationId \|\| `proma-", "conversation_id: params.conversationId || `tagent-", "memos conv id"),

    # === DOM data-attr (A3) ===
    (r"data-proma-find-match", "data-tagent-find-match", "DOM attr"),
    (r"data-proma-find-active", "data-tagent-find-active", "DOM attr"),
    (r"data-proma-find-ignore", "data-tagent-find-ignore", "DOM attr"),
    (r"data-proma-find-index", "data-tagent-find-index", "DOM attr"),
    (r"data-proma-screenshot-root", "data-tagent-screenshot-root", "DOM attr"),
    (r"data-proma-render-mode", "data-tagent-render-mode", "DOM attr"),
    # dataset access patterns
    (r"dataset\.promaFindMatch", "dataset.tagentFindMatch", "dataset access"),
    (r"dataset\.promaFindActive", "dataset.tagentFindActive", "dataset access"),
    (r"dataset\.promaFindIndex", "dataset.tagentFindIndex", "dataset access"),
    (r"dataset\.promaCodeBlock", "dataset.tagentCodeBlock", "dataset access"),

    # === CSS class names (A3) ===
    (r"proma-code-block--mermaid", "tagent-code-block--mermaid", "CSS class"),
    (r"proma-mermaid-preview", "tagent-mermaid-preview", "CSS class"),
    (r"proma-code-header", "tagent-code-header", "CSS class"),
    (r"proma-code-source-body", "tagent-code-source-body", "CSS class"),
    (r"proma-screenshot-wrapper", "tagent-screenshot-wrapper", "CSS class"),
    (r"proma-screenshot-sheet", "tagent-screenshot-sheet", "CSS class"),
    (r"proma-find-highlight-style", "tagent-find-highlight-style", "style id"),
    (r"proma-read-line", "tagent-read-line", "CSS counter"),

    # === HTML title (A7) ===
    (r"<title>Proma</title>", "<title>TAgent</title>", "HTML title"),

    # === 临时目录 / 文件名 (A6) ===
    (r"tmpdir\(\), 'proma-preview'", "tmpdir(), 'tagent-preview'", "tmp preview dir"),
    (r"tmpdir\(\), 'proma-installers'", "tmpdir(), 'tagent-installers'", "tmp installers dir"),
    (r"'proma-preview'", "'tagent-preview'", "string literal in tmpdir"),
    (r"'proma-installers'", "'tagent-installers'", "string literal in tmpdir"),
    (r"'proma-icon-'", "'tagent-icon-'", "ipc tmp dir"),
    (r"tmpdir\(\), 'proma-icon-'", "tmpdir(), 'tagent-icon-'", "ipc tmp dir"),
    (r"proma-import-\$\{", "tagent-import-${", "import tmp dir prefix"),
    (r"proma-ss-\$\{", "tagent-ss-${", "screenshot tmp prefix"),
    (r"proma-migration-\$\{", "tagent-migration-${", "migration default name"),
    (r"proma-workspace-\$\{", "tagent-workspace-${", "workspace session name"),
    (r"\$\{workspaceSlug\}`,", "${workspaceSlug}`,", "agent session name"),

    # === Desktop screenshot filename (A6) ===
    (r"'proma-\$\{ts\}\.png'", "'tagent-${ts}.png'", "desktop screenshot filename"),
    (r"homedir\(\), 'Desktop', `proma-", "homedir(), 'Desktop', `tagent-", "desktop screenshot path"),

    # === External URLs (A8) ===
    (r"https://api\.proma\.cool", "https://api.tagent.cool", "API base URL"),
    (r"https://github\.com/yourusername/proma", "https://github.com/yourusername/tagent", "menu URL"),
    (r"/proma\\\.cool/i", "/tagent\\.cool/i", "model logo regex"),
]


def should_skip(path: Path) -> bool:
    """跳过文档/历史/资源/构建产物"""
    s = str(path).replace("\\", "/")
    if "/docs/" in s or "/release-notes/" in s or "/scripts/" in s:
        return True
    if "/proma-thinking/" in s:
        return True
    if s.endswith(".md") and "default-skills" not in s:
        return True
    if "/.git/" in s or "/node_modules/" in s or "/dist/" in s or "/out/" in s:
        return True
    if "/assets/" in s:  # 资源文件名留给 T2.3 单独 git mv
        return True
    return False


def should_consider(path: Path) -> bool:
    """T2.1 + T2.2 只动 .ts/.tsx/.html/.yml/.json（assets 跳过）"""
    if should_skip(path):
        return False
    if path.suffix not in (".ts", ".tsx", ".html", ".yml", ".yaml", ".json", ".css"):
        return False
    # 跳过 package.json 描述（留给 T2.4）
    if path.name == "package.json":
        return False
    # 跳过 electron-builder.yml（留给 T2.4）
    if "electron-builder" in path.name:
        return False
    return True


def main():
    files = []
    for p in ROOT.rglob("*"):
        if p.is_file() and should_consider(p):
            files.append(p)
    print(f"扫描 {len(files)} 个文件")

    total_changes = 0
    changed_files = []
    for f in files:
        try:
            content = f.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        original = content
        file_changes = 0
        for pattern, repl, desc in RENAMES:
            new_content, n = re.subn(pattern, repl, content)
            if n > 0:
                content = new_content
                file_changes += n
        if file_changes > 0:
            f.write_text(content, encoding="utf-8")
            changed_files.append((f, file_changes))
            total_changes += file_changes

    print(f"修改 {len(changed_files)} 个文件，共 {total_changes} 处替换：")
    for f, n in sorted(changed_files, key=lambda x: -x[1]):
        rel = f.relative_to(ROOT)
        print(f"  {n:4d}  {rel}")


if __name__ == "__main__":
    main()

"""Tests for scripts/release.py release-notes validation."""

import importlib.util
import sys
from pathlib import Path
from typing import Any

import pytest

_RELEASE_PY = Path(__file__).resolve().parent.parent / "scripts" / "release.py"


@pytest.fixture(scope="module")
def release() -> Any:
    """Load scripts/release.py as a module (it is not a package).

    Must register in sys.modules: the module uses ``from __future__ import
    annotations``, so dataclasses needs a resolvable module for string hints.
    """
    spec = importlib.util.spec_from_file_location("tagent_release", _RELEASE_PY)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    sys.modules["tagent_release"] = module
    spec.loader.exec_module(module)
    return module


VALID_NOTES = """# v1.7.0

Spatial Shell 空间材质重构 + 动画虚拟角色 + 看板目标模式 + CSV 分析工具。

## ✨ 新功能
- 新功能条目
"""


def test_accepts_single_version_notes(release: Any) -> None:
    assert release.validate_release_notes(VALID_NOTES, "v1.7.0") == []


def test_rejects_missing_tag_title(release: Any) -> None:
    errors = release.validate_release_notes(VALID_NOTES, "v1.6.1")
    assert any("未找到" in error for error in errors)


def test_rejects_too_short_notes(release: Any) -> None:
    errors = release.validate_release_notes("# v1.7.0\n\nshort", "v1.7.0")
    assert any("过短" in error for error in errors)


def test_rejects_nested_previous_version(release: Any) -> None:
    notes = VALID_NOTES + "\n---\n\n# v1.6.1\n\n旧版本说明段落，" + "补充内容" * 20
    errors = release.validate_release_notes(notes, "v1.7.0")
    assert any("只包含当前版本一个标题" in error for error in errors)

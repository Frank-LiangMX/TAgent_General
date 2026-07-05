"""
重新生成 macOS 菜单栏 tray icon（简化版）。

旧版：五边形 + 5 条内部细分线 + 2 个半透明切面 → 22x22 下糊成「一大坨」
新版：只保留五边形实心轮廓，符合 macOS 菜单栏「极简轮廓」规范

生成 3 个尺寸：22x22 (1x) / 44x44 (2x) / 66x66 (3x)
"""

from PIL import Image, ImageDraw
from pathlib import Path

OUT_DIR = Path(__file__).parent

# 五边形顶点（32x32 design coords，centered at 16,16）
PENTAGON_OUTER = [
    (16, 4),       # top
    (28, 12),      # upper right
    (23, 24),      # lower right
    (9, 24),       # lower left
    (4, 12),       # upper left
]


def draw_tray_icon(size: int) -> Image.Image:
    """Draw monochrome (white) pentagon at given size."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    s = size / 32.0
    cx = cy = size / 2

    pent = [(x * s, y * s) for x, y in PENTAGON_OUTER]
    draw.polygon(pent, fill=(255, 255, 255, 255))

    return img


SIZES = [
    ("iconTemplate.png", 22),
    ("iconTemplate@2x.png", 44),
    ("iconTemplate@3x.png", 66),
]

for name, size in SIZES:
    img = draw_tray_icon(size)
    out = OUT_DIR / name
    img.save(out, format="PNG", optimize=True)
    print(f"[OK] {out.name} ({size}x{size}) -> {out.stat().st_size} bytes")

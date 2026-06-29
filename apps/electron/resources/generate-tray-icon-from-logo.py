"""从深色主题 logo 图案生成带深色底板的托盘图标（Windows + macOS）。

规范：
- 深色圆角矩形底板（#1A1A1A）+ 白色图案，小尺寸下清晰可辨
- 不再是 template（固定彩色，不随顶栏明暗自动反转）
- 透明背景（底板外透明）
- 3 尺寸：22px (1x) / 44px (2x) / 66px (3x)

来源：tagent-logo-proposals-v2/tagent-dark-pattern-only.png（彩色图案，透明背景）
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

ROOT = Path(__file__).resolve().parent
PATTERN_SOURCE = ROOT / "tagent-logo-proposals-v2" / "tagent-dark-pattern-only.png"
OUT_DIR = ROOT

SIZES = [
    ("iconTemplate.png", 22),
    ("iconTemplate@2x.png", 44),
    ("iconTemplate@3x.png", 66),
]

PLATE_COLOR = (26, 26, 26, 255)  # #1A1A1A 深色底板
PLATE_RADIUS_RATIO = 0.22  # 圆角半径占图标比例（匹配 logo 圆角）


def make_tray_icon(pattern: Image.Image, size: int) -> Image.Image:
    """深色圆角底板 + 白色图案，缩放到指定尺寸。"""
    # 1. 画深色圆角矩形底板（带 alpha，圆角外透明）
    plate = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(plate)
    radius = int(size * PLATE_RADIUS_RATIO)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=PLATE_COLOR)

    # 2. 图案转纯白（保留原 alpha 作为形状 mask），去掉彩色层次
    pattern_rgba = pattern.convert("RGBA")
    # 用图案的 alpha 作为白色填充的 mask
    pattern_alpha = pattern_rgba.split()[3]
    white_pattern = Image.new("RGBA", pattern_rgba.size, (255, 255, 255, 255))
    white_pattern.putalpha(pattern_alpha)

    # 3. 缩放图案到底板尺寸（留 11% 内边距，图案占 78% 更接近主流软件视觉）
    inner = int(size * 0.78)
    white_pattern_resized = white_pattern.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = (size - inner) // 2

    # 4. 合成：底板 + 白色图案（用 paste + alpha mask）
    plate.paste(white_pattern_resized, (offset, offset), white_pattern_resized)
    return plate


def main() -> None:
    if not PATTERN_SOURCE.exists():
        raise FileNotFoundError(f"图案源文件不存在: {PATTERN_SOURCE}")

    pattern = Image.open(PATTERN_SOURCE).convert("RGBA")

    for name, size in SIZES:
        icon = make_tray_icon(pattern, size)
        out = OUT_DIR / name
        icon.save(out, format="PNG", optimize=True)
        print(f"[OK] {out.name} ({size}x{size}) -> {out.stat().st_size} bytes")


if __name__ == "__main__":
    main()


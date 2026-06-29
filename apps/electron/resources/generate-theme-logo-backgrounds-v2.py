"""Create TAgent theme proposals by recoloring only dark neutral regions."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "icon.png"
OUTPUT_DIR = ROOT / "tagent-logo-proposals-v2"

THEMES: tuple[tuple[str, str, str], ...] = (
    # 浅色主题用 --accent（浅色带主题色相），深色主题用 --background（深色）
    ("default-light", "默认浅色", "#FFFFFF"),
    ("default-dark", "默认深色", "#1A1A1A"),
    # slate 晶灰（暖灰调）
    ("slate-light", "晶灰浅色", "#DBD8D2"),
    ("slate-dark", "晶灰深色", "#1D1B20"),
    # ocean 碧海
    ("ocean-light", "碧海浅色", "#C1D6E7"),
    ("ocean-dark", "碧海深色", "#182434"),
    # forest 森绿
    ("forest-light", "森绿浅色", "#DAE7DF"),
    ("forest-dark", "森绿深色", "#212C26"),
    # orange 橙陶
    ("orange-light", "橙陶浅色", "#E8D4C0"),
    ("orange-dark", "橙陶深色", "#1F1410"),
    # purple 锐紫
    ("purple-light", "锐紫浅色", "#E8DEEC"),
    ("purple-dark", "锐紫深色", "#1C1726"),
)


def hex_rgb(value: str) -> tuple[int, int, int]:
    """Convert a six-digit CSS hex color to RGB."""
    value = value.removeprefix("#")
    red = int(value[0:2], 16)
    green = int(value[2:4], 16)
    blue = int(value[4:6], 16)
    return red, green, blue


def dark_neutral_mask(source: Image.Image) -> Image.Image:
    """Select the black background and matching hollow facets, not the mark."""
    red, green, blue = source.convert("RGB").split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    minimum = ImageChops.darker(ImageChops.darker(red, green), blue)
    chroma = ImageChops.subtract(maximum, minimum)
    dark = maximum.point(lambda value: 255 if value <= 80 else 0)
    neutral = chroma.point(lambda value: 255 if value <= 24 else 0)
    return ImageChops.multiply(dark, neutral)


def light_region_mask(source: Image.Image) -> Image.Image:
    """选 logo 主体亮区（白色线框 + 填充面），用于叠加接触阴影。"""
    red, green, blue = source.convert("RGB").split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    return maximum.point(lambda value: 255 if value > 80 else 0)


def light_frame_mask(source: Image.Image) -> Image.Image:
    """仅选最亮的白色线框像素（亮度 > 200），用于浅色主题反色。

    不含彩色填充面（灰/青绿，亮度 80-200），保留其原色。
    """
    red, green, blue = source.convert("RGB").split()
    maximum = ImageChops.lighter(ImageChops.lighter(red, green), blue)
    return maximum.point(lambda value: 255 if value > 200 else 0)


def darken_light_frame(image: Image.Image, frame_mask: Image.Image) -> Image.Image:
    """把白色线框染成深色（浅色主题用，保证浅背景上可见）。

    深色用主题前景色（#312f2a 系），和浅色主题的前景文字色一致。
    """
    dark_frame = Image.new("RGB", image.size, (49, 47, 42))
    return Image.composite(dark_frame, image, frame_mask)


def themed_dark_regions(source: Image.Image, color: str) -> Image.Image:
    """Keep the source shading while shifting dark neutral pixels to a theme hue."""
    gray = ImageOps.grayscale(source)
    base = hex_rgb(color)

    def channel(base_value: int) -> Image.Image:
        return gray.point(
            lambda lightness: max(0, min(255, round(base_value + (lightness - 30) * 0.5)))
        )

    return Image.merge("RGB", tuple(channel(value) for value in base))


def apply_glass_effect(
    image: Image.Image, dark_mask: Image.Image, light_mask: Image.Image, theme_color: str
) -> Image.Image:
    """在背景着色区叠加液态玻璃质感，并给 logo 主体加接触阴影。

    参考 AndroidLiquidGlass 的核心视觉层次：
    0. 接触阴影（浅色主题上给 logo 主体垫深色衬底，保证白线框可见）
    1. 边缘内侧高光（玻璃边缘全反射，最标志性特征）
    2. 顶部柔和渐变（环境光从上方照射）
    3. 整体轻微提亮（玻璃比纯色稍亮）

    接触阴影强度按主题色明度动态调节：浅色背景需强衬底，深色背景不需要。
    """
    width, height = image.size
    highlight = Image.new("RGB", (width, height), (255, 255, 255))
    shadow_color = Image.new("RGB", (width, height), (20, 20, 25))

    # 计算主题色明度（0-255），决定接触阴影强度
    r, g, b = hex_rgb(theme_color)
    lightness = (max(r, g, b) + min(r, g, b)) / 2
    # 浅色背景（lightness > 120）才需要衬底，强度随明度上升而增强
    if lightness > 120:
        # 明度 120→0，alpha 0→0.35
        shadow_alpha = min(0.35, (lightness - 120) / 200 * 0.45)
    else:
        shadow_alpha = 0.0

    glassed = image
    if shadow_alpha > 0:
        # 0a. 给整个 logo 主体垫半透明深色衬底，让白线框浮起
        shadow_overlay = Image.blend(image, shadow_color, shadow_alpha)
        glassed = Image.composite(shadow_overlay, image, light_mask)

        # 0b. 边缘加深：logo 主体边缘再叠深色描边，提升轮廓
        eroded_light = light_mask.filter(ImageFilter.MinFilter(3))
        light_edge = ImageChops.subtract(light_mask, eroded_light)
        light_edge = light_edge.filter(ImageFilter.GaussianBlur(radius=width * 0.002))
        glassed = Image.composite(
            Image.blend(glassed, shadow_color, shadow_alpha * 1.8), glassed, light_edge
        )

    # 1. 整体轻微提亮：整个背景色块叠 10% 白色，让玻璃比纯色稍亮
    glassed = Image.composite(
        Image.blend(glassed, highlight, 0.1), glassed, dark_mask
    )

    # 2. 顶部柔和渐变：上半部分低 alpha 提亮（柔和，非硬高光）
    top_glow = Image.new("L", (width, height), 0)
    top_px = top_glow.load()
    cutoff = int(height * 0.7)
    for y in range(height):
        alpha = int(55 * max(0.0, 1 - y / cutoff)) if y < cutoff else 0
        for x in range(width):
            top_px[x, y] = alpha
    glassed = Image.composite(
        Image.blend(glassed, highlight, 0.5), glassed, ImageChops.multiply(top_glow, dark_mask)
    )

    # 3. 边缘内侧高光（液态玻璃核心特征）：dark_mask 腐蚀取内侧边缘带
    # 这条亮线沿背景色块边缘内侧走，模拟光线在玻璃边缘的全反射
    eroded = dark_mask.filter(ImageFilter.MinFilter(7))
    edge_inner = ImageChops.subtract(dark_mask, eroded)
    edge_inner = edge_inner.filter(ImageFilter.GaussianBlur(radius=width * 0.003))
    glassed = Image.composite(
        Image.blend(glassed, highlight, 0.75), glassed, edge_inner
    )

    return glassed


def preview_font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    """Load a local UI font for the contact sheet."""
    path = Path("C:/Windows/Fonts/segoeui.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def write_preview(images: dict[str, Image.Image]) -> None:
    """Write the twelve variants to one neutral review sheet."""
    columns, rows = 4, 3
    card_width, card_height = 360, 410
    gap, margin = 28, 36
    sheet = Image.new(
        "RGB",
        (
            margin * 2 + columns * card_width + (columns - 1) * gap,
            margin * 2 + rows * card_height + (rows - 1) * gap,
        ),
        "#ECEDEF",
    )
    draw = ImageDraw.Draw(sheet)
    font = preview_font(28)
    for index, (theme_id, label, _) in enumerate(THEMES):
        row, column = divmod(index, columns)
        left = margin + column * (card_width + gap)
        top = margin + row * (card_height + gap)
        draw.rounded_rectangle(
            (left, top, left + card_width, top + card_height),
            radius=28,
            fill="#F8F8F8",
            outline="#D3D5D8",
            width=2,
        )
        icon = images[theme_id].resize((300, 300), Image.Resampling.LANCZOS)
        # logo 现在是 RGBA 带圆角透明，paste 需要传 alpha mask 保留透明度
        if icon.mode == "RGBA":
            sheet.paste(icon, (left + 30, top + 26), icon)
        else:
            sheet.paste(icon, (left + 30, top + 26))
        text = f"{label} · {theme_id.title()}"
        box = draw.textbbox((0, 0), text, font=font)
        draw.text(
            (left + (card_width - (box[2] - box[0])) / 2, top + 346),
            text,
            fill="#26282C",
            font=font,
        )
    sheet.save(OUTPUT_DIR / "background-and-hollows-preview.png", optimize=True)


def apply_rounded_alpha(image: Image.Image, radius_ratio: float = 0.22) -> Image.Image:
    """给图加圆角 alpha mask：圆角矩形外设透明，让 logo 自然透出页面背景。

    radius_ratio 是圆角半径占图片尺寸的比例（0.22 ≈ CSS rounded-2xl 在 64px 上的视觉）。
    """
    width, height = image.size
    radius = int(min(width, height) * radius_ratio)
    # 画一个白色圆角矩形作为 alpha mask
    alpha_mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(alpha_mask)
    draw.rounded_rectangle((0, 0, width, height), radius=radius, fill=255)
    # 转 RGBA 并应用 alpha
    rgba = image.convert("RGBA")
    rgba.putalpha(alpha_mask)
    return rgba


def main() -> None:
    """Generate review PNGs without touching frontend code."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    mask = dark_neutral_mask(source)
    light_mask = light_region_mask(source)
    frame_mask = light_frame_mask(source)
    selected_pixels = sum(count for value, count in mask.getcolors() or [] if value > 0)
    rendered: dict[str, Image.Image] = {}
    for theme_id, _, color in THEMES:
        themed = themed_dark_regions(source, color)
        result = Image.composite(themed, source, mask)
        # 浅色主题：白色线框在浅背景上不可见，染成深色线框
        r, g, b = hex_rgb(color)
        lightness = (max(r, g, b) + min(r, g, b)) / 2
        if lightness > 120:
            result = darken_light_frame(result, frame_mask)
        result = apply_glass_effect(result, mask, light_mask, color)
        result = apply_rounded_alpha(result)
        result.save(OUTPUT_DIR / f"tagent-{theme_id}.png", optimize=True)
        rendered[theme_id] = result
    write_preview(rendered)
    print(f"Generated {len(THEMES)} proposals; recolored mask covers {selected_pixels} pixels")


if __name__ == "__main__":
    main()

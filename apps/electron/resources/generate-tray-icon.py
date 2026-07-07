"""
Generate macOS status bar template icons directly from the current TAgent logo pattern.

This keeps the menu bar mark visually aligned with the shipped icon language:
- uses the existing pattern-only logo as the source of truth
- converts the mark to a monochrome template image
- keeps transparent background for macOS automatic tinting
- exports 22x22, 44x44, and 66x66 variants
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent
PATTERN_SOURCE = ROOT / "tagent-logo-proposals-v2" / "tagent-dark-pattern-only.png"
OUT_DIR = ROOT

SIZES = [
    ("iconTemplate.png", 22),
    ("iconTemplate@2x.png", 44),
    ("iconTemplate@3x.png", 66),
]

PADDING_RATIO = 0.14


def extract_pattern_alpha(source: Image.Image) -> Image.Image:
    """Crop the visible logo pattern to its alpha bounds."""
    rgba = source.convert("RGBA")
    alpha = rgba.getchannel("A")
    bbox = alpha.getbbox()
    if bbox is None:
        raise ValueError("Pattern source has no visible alpha content")
    return rgba.crop(bbox)


def make_template_icon(pattern: Image.Image, size: int) -> Image.Image:
    """Render the existing logo pattern as a white template icon."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    alpha = pattern.getchannel("A")
    white_pattern = Image.new("RGBA", pattern.size, (255, 255, 255, 255))
    white_pattern.putalpha(alpha)

    inner = max(1, round(size * (1 - PADDING_RATIO * 2)))
    resized = white_pattern.resize((inner, inner), Image.Resampling.LANCZOS)
    offset = ((size - inner) // 2, (size - inner) // 2)
    canvas.paste(resized, offset, resized)
    return canvas


def main() -> None:
    if not PATTERN_SOURCE.exists():
        raise FileNotFoundError(f"Pattern source not found: {PATTERN_SOURCE}")

    pattern = extract_pattern_alpha(Image.open(PATTERN_SOURCE))

    for name, size in SIZES:
        icon = make_template_icon(pattern, size)
        out = OUT_DIR / name
        icon.save(out, format="PNG", optimize=True)
        print(f"[OK] {out.name} ({size}x{size})")


if __name__ == "__main__":
    main()
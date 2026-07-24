"""
从 tagent-logo-proposals-v2/tagent-default-light.png 生成 icon.png 和 icon.ico
使用 Pillow。

用法: python generate-default-icons.py
"""
from pathlib import Path
from PIL import Image
import struct
from io import BytesIO

RESOURCES = Path(__file__).parent
SRC = RESOURCES / "tagent-logo-proposals-v2" / "tagent-default-light.png"
PNG_DST = RESOURCES / "icon.png"
ICO_DST = RESOURCES / "icon.ico"

# ICO 格式支持多个尺寸
ICO_SIZES = [256, 128, 96, 64, 48, 32, 16]
# PNG 目标尺寸（1024x1024，electron-builder 会自动缩放）
PNG_SIZE = 1024


def convert_to_rgba(im: Image.Image) -> Image.Image:
    if im.mode != "RGBA":
        return im.convert("RGBA")
    return im


def build_ico(images: list[Image.Image]) -> bytes:
    """将多个尺寸的 PNG 图像打包成 ICO 文件。"""
    if not images:
        raise ValueError("No images to pack")

    num_images = len(images)
    header = struct.pack("<HHH", 0, 1, num_images)

    png_datas: list[bytes] = []
    for im in images:
        buf = BytesIO()
        im.save(buf, format="PNG", optimize=False)
        png_datas.append(buf.getvalue())

    offset = 6 + 16 * num_images
    dir_entries = b""
    for size, png_data in zip([im.size[0] for im in images], png_datas):
        w = 0 if size >= 256 else size
        h = 0 if size >= 256 else size
        entry = struct.pack(
            "<BBBBHHII",
            w, h, 0, 0, 1, 32, len(png_data), offset,
        )
        dir_entries += entry
        offset += len(png_data)

    ico_data = header + dir_entries + b"".join(png_datas)
    return ico_data


def main() -> int:
    if not SRC.exists():
        print(f"❌ Source not found: {SRC}")
        return 1

    im = Image.open(SRC)
    print(f"[SRC] {SRC.name} ({im.size[0]}x{im.size[1]} {im.mode})")

    # 生成 icon.png (1024x1024)
    png_im = im.resize((PNG_SIZE, PNG_SIZE), Image.Resampling.LANCZOS)
    png_im = convert_to_rgba(png_im)
    png_im.save(PNG_DST, format="PNG", optimize=True)
    print(f"[OK] icon.png ({PNG_SIZE}x{PNG_SIZE})")

    # 生成 icon.ico (多分辨率)
    ico_images = []
    for size in ICO_SIZES:
        resized = im.resize((size, size), Image.Resampling.LANCZOS)
        resized = convert_to_rgba(resized)
        ico_images.append(resized)
        print(f"  [ICO] {size}x{size}")

    ico_data = build_ico(ico_images)
    ICO_DST.write_bytes(ico_data)
    print(f"[OK] icon.ico ({len(ico_data):,} bytes)")

    # 生成 icon.icns (macOS)
    icns_dst = RESOURCES / "icon.icns"
    # ICNS 需要的尺寸：16, 32, 64, 128, 256, 512, 1024
    icns_sizes = [16, 32, 64, 128, 256, 512, 1024]
    icns_images = []
    for size in icns_sizes:
        resized = im.resize((size, size), Image.Resampling.LANCZOS)
        resized = convert_to_rgba(resized)
        icns_images.append(resized)
        print(f"  [ICNS] {size}x{size}")

    # Pillow 保存 ICNS 格式
    icns_images[0].save(
        icns_dst,
        format="ICNS",
        append_images=icns_images[1:],
    )
    print(f"[OK] icon.icns")

    print("\n[DONE] 全部生成完成！")
    print(f"  - {PNG_DST.name}")
    print(f"  - {ICO_DST.name}")
    print(f"  - {icns_dst.name}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())

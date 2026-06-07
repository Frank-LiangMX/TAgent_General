#!/bin/bash

# TAgent Icon Generation Script
# Generates all required icon formats from icon.svg
# Requires: rsvg-convert (librsvg), iconutil (macOS), magick (ImageMagick)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "🎨 Generating TAgent icons..."

# Check required tools
if ! command -v rsvg-convert &> /dev/null; then
  echo "❌ rsvg-convert not found. Install with: brew install librsvg"
  exit 1
fi

if ! command -v magick &> /dev/null; then
  echo "❌ ImageMagick (magick) not found. Install with: brew install imagemagick"
  exit 1
fi

if ! command -v iconutil &> /dev/null; then
  echo "⚠️  iconutil not found (macOS only). Skipping .icns generation"
fi

# 1. Generate icon.png (1024x1024) from SVG
echo "📦 Generating icon.png (1024x1024)..."
rsvg-convert -w 1024 -h 1024 icon.svg -o icon.png

# 2. Generate menubar/tray icons (multi-resolution for Retina displays)
# macOS 托盘图标规范：
#   - 标准尺寸: 22x22pt
#   - @2x Retina: 44x44px
#   - @3x 高分辨率: 66x66px
# 使用 "Template" 命名让 macOS 自动适配深色/浅色菜单栏
# Tray 图标使用 icon.svg 居中裁剪版（macOS 会自动用 alpha 通道当作 mask）
echo "📦 Generating tray icons..."

TRAY_PNG="$(mktemp -t tray.XXXXXX).png"
TRAY_PNG_2X="$(mktemp -t tray.XXXXXX).png"
TRAY_PNG_3X="$(mktemp -t tray.XXXXXX).png"

rsvg-convert -w 22 -h 22 icon.svg -o "$TRAY_PNG"
rsvg-convert -w 44 -h 44 icon.svg -o "$TRAY_PNG_2X"
rsvg-convert -w 66 -h 66 icon.svg -o "$TRAY_PNG_3X"

# macOS Template 图标必须是单色 + alpha 通道，用 ImageMagick 把彩色转成单色
magick "$TRAY_PNG"   -colorspace gray -alpha set -background none \
      -channel A -evaluate set 100% +channel iconTemplate.png
magick "$TRAY_PNG_2X" -colorspace gray -alpha set -background none \
      -channel A -evaluate set 100% +channel 'iconTemplate@2x.png'
magick "$TRAY_PNG_3X" -colorspace gray -alpha set -background none \
      -channel A -evaluate set 100% +channel 'iconTemplate@3x.png'

rm -f "$TRAY_PNG" "$TRAY_PNG_2X" "$TRAY_PNG_3X"

echo "✅ Tray icons generated:"
echo "   - iconTemplate.png (22x22 @1x)"
echo "   - iconTemplate@2x.png (44x44 @2x Retina)"
echo "   - iconTemplate@3x.png (66x66 @3x)"

# 3. Generate .icns (macOS app icon)
if command -v iconutil &> /dev/null; then
  echo "📦 Generating icon.icns..."

  mkdir -p icon.iconset

  # Generate all required sizes for macOS
  sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png      > /dev/null 2>&1
  sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png   > /dev/null 2>&1
  sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png      > /dev/null 2>&1
  sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png   > /dev/null 2>&1
  sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png    > /dev/null 2>&1
  sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png > /dev/null 2>&1
  sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png    > /dev/null 2>&1
  sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png > /dev/null 2>&1
  sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png    > /dev/null 2>&1
  sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png > /dev/null 2>&1

  iconutil -c icns icon.iconset -o icon.icns

  rm -rf icon.iconset

  echo "✅ icon.icns generated"
else
  echo "⚠️  Skipping .icns generation (iconutil not available)"
fi

# 4. Generate .ico (Windows app icon)
echo "📦 Generating icon.ico..."
magick icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
echo "✅ icon.ico generated"

echo ""
echo "✅ All icons generated successfully!"
echo ""
echo "Generated files:"
echo "  - icon.png (1024x1024) - Linux & macOS Dock"
echo "  - icon.icns - macOS app icon"
echo "  - icon.ico - Windows app icon"
echo "  - iconTemplate.png - macOS tray (22x22 @1x)"
echo "  - iconTemplate@2x.png - macOS tray (44x44 @2x Retina)"
echo "  - iconTemplate@3x.png - macOS tray (66x66 @3x)"

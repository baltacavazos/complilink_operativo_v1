from pathlib import Path
import json

import numpy as np
from PIL import Image

SOURCE = Path('/home/ubuntu/upload/pasted_file_5i8kM0_image.png')
ASSET_DIR = Path('/home/ubuntu/webdev-static-assets/auditapatron-final-logo')
ASSET_DIR.mkdir(parents=True, exist_ok=True)

FULL_LOGO = ASSET_DIR / 'auditapatron-logo-final.png'
WORDMARK_LOGO = ASSET_DIR / 'auditapatron-wordmark-final.png'
ICON_BASE = ASSET_DIR / 'auditapatron-icon-base.png'
FAVICON_16 = ASSET_DIR / 'favicon-16x16.png'
FAVICON_32 = ASSET_DIR / 'favicon-32x32.png'
APPLE_TOUCH = ASSET_DIR / 'apple-touch-icon.png'
ANDROID_192 = ASSET_DIR / 'android-chrome-192x192.png'
ANDROID_512 = ASSET_DIR / 'android-chrome-512x512.png'
MANIFEST = ASSET_DIR / 'site.webmanifest'
META = ASSET_DIR / 'asset-meta.json'

WORDMARK_BOX = (70, 140, 1505, 520)
ICON_BOX = (1130, 170, 1515, 705)
HEADER_SAFE_ICON_SCALE = 0.62
HEADER_SAFE_GAP_RATIO = 0.095
HEADER_SAFE_SIDE_PADDING_RATIO = 0.05


def whiten_to_alpha(image: Image.Image, threshold: int = 245) -> Image.Image:
    rgba = image.convert('RGBA')
    pixels = []
    for r, g, b, a in rgba.getdata():
        if r >= threshold and g >= threshold and b >= threshold:
            pixels.append((255, 255, 255, 0))
        else:
            pixels.append((r, g, b, a))
    rgba.putdata(pixels)
    return rgba


def trim_transparent(image: Image.Image) -> Image.Image:
    bbox = image.getbbox()
    return image.crop(bbox) if bbox else image


def find_vertical_segments(image: Image.Image, alpha_threshold: int = 10, min_pixels: int = 6):
    alpha = np.array(image.getchannel('A'))
    occupied = (alpha > alpha_threshold).sum(axis=0) > min_pixels
    segments = []
    start = None

    for index, is_active in enumerate(occupied):
        if is_active and start is None:
            start = index
        elif not is_active and start is not None:
            if index - start >= 4:
                segments.append((start, index))
            start = None

    if start is not None and len(occupied) - start >= 4:
        segments.append((start, len(occupied)))

    return segments


def crop_from_segments(image: Image.Image, segments, start_index: int, end_index: int) -> Image.Image:
    start_x = segments[start_index][0]
    end_x = segments[end_index][1]
    return trim_transparent(image.crop((start_x, 0, end_x, image.height)))


def build_header_safe_wordmark(source: Image.Image) -> Image.Image:
    base_wordmark = trim_transparent(whiten_to_alpha(source.crop(WORDMARK_BOX)))
    segments = find_vertical_segments(base_wordmark)
    if len(segments) < 3:
        return base_wordmark

    icon_index = max(range(len(segments)), key=lambda idx: segments[idx][1] - segments[idx][0])
    if icon_index == 0 or icon_index == len(segments) - 1:
        return base_wordmark

    left = crop_from_segments(base_wordmark, segments, 0, icon_index - 1)
    icon = crop_from_segments(base_wordmark, segments, icon_index, icon_index)
    right = crop_from_segments(base_wordmark, segments, icon_index + 1, len(segments) - 1)

    target_height = max(left.height, right.height)
    icon_target_height = max(32, int(target_height * HEADER_SAFE_ICON_SCALE))

    left_resized = left.resize((int(left.width * target_height / left.height), target_height), Image.LANCZOS)
    right_resized = right.resize((int(right.width * target_height / right.height), target_height), Image.LANCZOS)
    icon_resized = icon.resize((int(icon.width * icon_target_height / icon.height), icon_target_height), Image.LANCZOS)

    gap = max(10, int(target_height * HEADER_SAFE_GAP_RATIO))
    side_padding = max(10, int(target_height * HEADER_SAFE_SIDE_PADDING_RATIO))
    canvas_height = max(target_height, icon_target_height) + side_padding * 2
    canvas_width = side_padding * 2 + left_resized.width + gap + icon_resized.width + gap + right_resized.width

    canvas = Image.new('RGBA', (canvas_width, canvas_height), (255, 255, 255, 0))
    cursor_x = side_padding
    baseline_top = side_padding + (canvas_height - side_padding * 2 - target_height) // 2

    canvas.paste(left_resized, (cursor_x, baseline_top), left_resized)
    cursor_x += left_resized.width + gap

    icon_top = side_padding + max(0, (canvas_height - side_padding * 2 - icon_resized.height) // 2)
    canvas.paste(icon_resized, (cursor_x, icon_top), icon_resized)
    cursor_x += icon_resized.width + gap

    canvas.paste(right_resized, (cursor_x, baseline_top), right_resized)
    return trim_transparent(canvas)


source = Image.open(SOURCE)
transparent = trim_transparent(whiten_to_alpha(source))
transparent.save(FULL_LOGO)

header_safe_wordmark = build_header_safe_wordmark(source)
header_safe_wordmark.save(WORDMARK_LOGO)

icon = trim_transparent(whiten_to_alpha(source.crop(ICON_BOX)))
canvas = Image.new('RGBA', (1024, 1024), (255, 255, 255, 0))
icon.thumbnail((820, 820), Image.LANCZOS)
left = (1024 - icon.width) // 2
top = (1024 - icon.height) // 2
canvas.paste(icon, (left, top), icon)
canvas.save(ICON_BASE)

for size, path in [
    (16, FAVICON_16),
    (32, FAVICON_32),
    (180, APPLE_TOUCH),
    (192, ANDROID_192),
    (512, ANDROID_512),
]:
    resized = canvas.resize((size, size), Image.LANCZOS)
    resized.save(path)

manifest = {
    'name': 'AuditaPatron',
    'short_name': 'AuditaPatron',
    'icons': [
        {'src': '/favicon-32x32.png', 'sizes': '32x32', 'type': 'image/png'},
        {'src': '/android-chrome-192x192.png', 'sizes': '192x192', 'type': 'image/png'},
        {'src': '/android-chrome-512x512.png', 'sizes': '512x512', 'type': 'image/png'},
    ],
    'theme_color': '#143c86',
    'background_color': '#ffffff',
    'display': 'standalone'
}
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

meta = {
    'source': str(SOURCE),
    'outputs': {
        'full_logo': str(FULL_LOGO),
        'wordmark_logo': str(WORDMARK_LOGO),
        'icon_base': str(ICON_BASE),
        'favicon_16': str(FAVICON_16),
        'favicon_32': str(FAVICON_32),
        'apple_touch_icon': str(APPLE_TOUCH),
        'android_chrome_192': str(ANDROID_192),
        'android_chrome_512': str(ANDROID_512),
        'site_manifest': str(MANIFEST),
    },
    'notes': {
        'ui_logo_usage': 'Usar la imagen maestra completa para hero, footer y superficies amplias.',
        'header_logo_usage': 'Usar la variante header-safe del wordmark para cabeceras, navegación, sidebars y barras tipo app.',
        'small_icon_usage': 'Usar el recorte simplificado de la lupa para favicon e iconos pequeños.',
        'header_safe_rule': 'La lupa se reduce de forma agresiva y se separa con más aire del resto del wordmark para evitar invasión visual en tamaños pequeños.',
    },
}
META.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')

print(str(META))

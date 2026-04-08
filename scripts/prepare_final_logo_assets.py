from __future__ import annotations

from pathlib import Path
import json

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


source = Image.open(SOURCE)
transparent = trim_transparent(whiten_to_alpha(source))
transparent.save(FULL_LOGO)

# Recorte manual del wordmark superior sin la leyenda, derivado directamente del logo aprobado.
wordmark_box = (70, 140, 1505, 520)
wordmark = trim_transparent(whiten_to_alpha(source.crop(wordmark_box)))
wordmark.save(WORDMARK_LOGO)

# Recorte manual del isotipo de la lupa basado en la composición aprobada.
icon_box = (1130, 170, 1515, 705)
icon = trim_transparent(whiten_to_alpha(source.crop(icon_box)))

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
        'header_logo_usage': 'Usar el recorte wordmark transparente para cabeceras, navegación y barras laterales.',
        'small_icon_usage': 'Usar el recorte simplificado de la lupa para favicon e iconos pequeños.',
    },
}
META.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')

print(str(META))

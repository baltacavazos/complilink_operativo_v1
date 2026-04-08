#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
import qrcode
from qrcode.constants import ERROR_CORRECT_H

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
ASSET_DIR = Path('/home/ubuntu/webdev-static-assets/auditapatron-logo-qr')
ASSET_DIR.mkdir(parents=True, exist_ok=True)

TARGET_URL = 'https://auditapatron.mx'
OUTPUT_LOGO = ASSET_DIR / 'auditapatron_logo_qr_master.png'
OUTPUT_PREVIEW = ASSET_DIR / 'auditapatron_logo_qr_preview.png'
OUTPUT_ICON = ASSET_DIR / 'auditapatron_logo_qr_icon.png'
OUTPUT_META = ASSET_DIR / 'auditapatron_logo_qr_master.json'

NAVY = '#0c2d72'
TEAL = '#58d6d3'
WHITE = '#ffffff'
PRE_WORD = 'AUDITAPATR'
POST_WORD = 'N'
TAGLINE = 'CONOCE TUS DERECHOS'

FONT_BOLD_CANDIDATES = [
    '/usr/share/fonts/truetype/liberation/LiberationSansNarrow-Bold.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Bold.otf',
]
FONT_REGULAR_CANDIDATES = [
    '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
    '/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf',
]


def load_font(candidates: list[str], size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in candidates:
        path = Path(candidate)
        if path.exists():
            return ImageFont.truetype(str(path), size=size)
    return ImageFont.load_default()


def build_qr(size: int) -> Image.Image:
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=1,
        border=4,
    )
    qr.add_data(TARGET_URL)
    qr.make(fit=True)

    matrix = qr.get_matrix()
    module_count = len(matrix)
    module_size = size / module_count
    dot_ratio = 0.72
    finder_origins = {
        (4, 4),
        (4, module_count - 11),
        (module_count - 11, 4),
    }

    def in_finder_zone(row_index: int, col_index: int) -> bool:
        return any(
            origin_row <= row_index < origin_row + 7 and origin_col <= col_index < origin_col + 7
            for origin_row, origin_col in finder_origins
        )

    image = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)

    for row_index, row in enumerate(matrix):
        for col_index, value in enumerate(row):
            if not value:
                continue

            x0 = col_index * module_size
            y0 = row_index * module_size
            x1 = (col_index + 1) * module_size
            y1 = (row_index + 1) * module_size

            if in_finder_zone(row_index, col_index):
                draw.rounded_rectangle(
                    (x0, y0, x1, y1),
                    radius=max(1.0, module_size * 0.18),
                    fill=NAVY,
                )
            else:
                inset = module_size * (1 - dot_ratio) / 2
                draw.ellipse((x0 + inset, y0 + inset, x1 - inset, y1 - inset), fill=NAVY)

    return image


def rounded_handle(draw: ImageDraw.ImageDraw, start: tuple[int, int], end: tuple[int, int], width: int, fill: str):
    draw.line([start, end], fill=fill, width=width)
    r = width // 2
    draw.ellipse((start[0] - r, start[1] - r, start[0] + r, start[1] + r), fill=fill)
    draw.ellipse((end[0] - r, end[1] - r, end[0] + r, end[1] + r), fill=fill)


def main():
    canvas_w = 2600
    canvas_h = 900
    image = Image.new('RGBA', (canvas_w, canvas_h), (255, 255, 255, 0))
    draw = ImageDraw.Draw(image)

    word_font = load_font(FONT_BOLD_CANDIDATES, 255)
    tagline_font = load_font(FONT_REGULAR_CANDIDATES, 112)

    left_margin = 130
    baseline_y = 180

    pre_bbox = draw.textbbox((0, 0), PRE_WORD, font=word_font)
    pre_w = pre_bbox[2] - pre_bbox[0]
    pre_h = pre_bbox[3] - pre_bbox[1]

    post_bbox = draw.textbbox((0, 0), POST_WORD, font=word_font)
    post_w = post_bbox[2] - post_bbox[0]

    lens_outer_d = 270
    lens_outer_r = lens_outer_d // 2
    ring_width = 24
    lens_inner_d = lens_outer_d - (ring_width * 2)
    quiet_padding = 24
    qr_size = lens_inner_d - (quiet_padding * 2)

    pre_x = left_margin
    pre_y = baseline_y
    draw.text((pre_x, pre_y), PRE_WORD, font=word_font, fill=NAVY)

    lens_cx = pre_x + pre_w + 18 + lens_outer_r
    lens_cy = pre_y + pre_h // 2 + 10

    ring_bounds = (
        lens_cx - lens_outer_r,
        lens_cy - lens_outer_r,
        lens_cx + lens_outer_r,
        lens_cy + lens_outer_r,
    )
    inner_r = lens_outer_r - ring_width
    inner_bounds = (
        lens_cx - inner_r,
        lens_cy - inner_r,
        lens_cx + inner_r,
        lens_cy + inner_r,
    )

    handle_start = (lens_cx + int(lens_outer_r * 0.72), lens_cy + int(lens_outer_r * 0.82))
    handle_end = (handle_start[0] + 120, handle_start[1] + 125)
    rounded_handle(draw, handle_start, handle_end, 54, TEAL)

    draw.ellipse(ring_bounds, fill=NAVY)
    draw.ellipse(inner_bounds, fill=WHITE)

    qr = build_qr(qr_size)
    qr_x = lens_cx - qr_size // 2
    qr_y = lens_cy - qr_size // 2
    image.alpha_composite(qr, (qr_x, qr_y))

    post_x = lens_cx + lens_outer_r + 26
    post_y = pre_y
    draw.text((post_x, post_y), POST_WORD, font=word_font, fill=NAVY)

    tagline_x = left_margin
    tagline_y = pre_y + 292
    draw.text((tagline_x, tagline_y), TAGLINE, font=tagline_font, fill=NAVY)

    bbox = image.getbbox()
    if bbox is None:
        raise RuntimeError('No se pudo generar el logotipo.')

    cropped = image.crop((bbox[0] - 20, max(0, bbox[1] - 20), min(canvas_w, bbox[2] + 20), min(canvas_h, bbox[3] + 20)))
    cropped.save(OUTPUT_LOGO)

    preview = Image.new('RGBA', (max(1800, cropped.width + 200), max(900, cropped.height + 220)), (245, 250, 252, 255))
    offset = ((preview.width - cropped.width) // 2, (preview.height - cropped.height) // 2)
    preview.alpha_composite(cropped, offset)
    preview.save(OUTPUT_PREVIEW)

    icon_padding = 55
    icon_crop = image.crop((
        lens_cx - lens_outer_r - icon_padding,
        lens_cy - lens_outer_r - icon_padding,
        handle_end[0] + icon_padding,
        handle_end[1] + icon_padding,
    ))
    icon_crop.save(OUTPUT_ICON)

    meta = {
        'target_url': TARGET_URL,
        'qr_error_correction': 'H',
        'recommended_min_logo_width_web_px': 220,
        'recommended_min_qr_area_web_px': 120,
        'recommended_min_logo_width_print_mm': 55,
        'recommended_min_qr_area_print_mm': 25,
        'use_simplified_logo_below_width_px': 180,
        'logo_file': str(OUTPUT_LOGO),
        'preview_file': str(OUTPUT_PREVIEW),
        'icon_file': str(OUTPUT_ICON),
        'colors': {'navy': NAVY, 'teal': TEAL},
    }
    OUTPUT_META.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(meta, ensure_ascii=False))


if __name__ == '__main__':
    main()

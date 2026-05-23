from pathlib import Path
from io import BytesIO

import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_DIR / 'store-assets' / 'final'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / 'icons').mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / 'splash').mkdir(parents=True, exist_ok=True)
(OUTPUT_DIR / 'screenshots').mkdir(parents=True, exist_ok=True)

ASSETS = {
    'full_logo': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-logo-final_01c8b00a.png',
    'wordmark': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-wordmark-final_059d1915.png',
}

HOMEPAGE_SHOT = Path('/home/ubuntu/screenshots/3000-ifwslt4380ij879_2026-05-21_19-56-12_4763.webp')
ACCESS_SHOT = Path('/home/ubuntu/screenshots/3000-ifwslt4380ij879_2026-05-21_19-56-30_4747.webp')

BG = '#EAF6F4'
BG_SOFT = '#F6FBFA'
DARK = '#334155'
ACCENT = '#1FCFC8'
TEXT = '#081222'
MUTED = '#566273'
CARD = '#F8FCFB'
BORDER = '#D5E5E2'
CHIP_BG = '#F7FCFB'

IOS_ICON_SIZES = [1024, 180, 167, 152, 120, 87, 80, 76, 60]
ANDROID_ICON_SIZES = [512, 432, 192, 144, 96, 72, 48]

SPLASH_SPECS = {
    'ios_69_portrait': (1260, 2736),
    'ios_65_portrait': (1242, 2688),
    'iphone_modern_portrait': (1179, 2556),
    'android_phone_portrait': (1080, 1920),
    'android_phone_tall': (1440, 3120),
}

SCREENSHOT_SPECS = {
    'ios_69': (1260, 2736),
    'ios_65': (1242, 2688),
    'android_phone': (1080, 1920),
}

SCREENSHOT_COPY = [
    {
        'slug': '01_sube_en_segundos',
        'headline': 'Sube tu recibo en segundos',
        'subheadline': 'Empieza con una foto o archivo y recibe una primera lectura clara.',
        'eyebrow': 'PRIMER PASO SIMPLE',
        'source': HOMEPAGE_SHOT,
        'crop': (0.00, 0.00, 0.88, 0.88),
    },
    {
        'slug': '02_ve_que_revisar',
        'headline': 'Ve qué revisar de un vistazo',
        'subheadline': 'Identifica puntos clave sin lenguaje técnico ni vueltas innecesarias.',
        'eyebrow': 'CLARIDAD INMEDIATA',
        'source': HOMEPAGE_SHOT,
        'crop': (0.02, 0.30, 0.96, 0.98),
    },
    {
        'slug': '03_tu_info_privada',
        'headline': 'Tu información siempre privada',
        'subheadline': 'Solo tú controlas tus documentos y su revisión dentro de la app.',
        'eyebrow': 'PRIVACIDAD',
        'source': ACCESS_SHOT,
        'crop': (0.12, 0.10, 0.88, 0.96),
    },
    {
        'slug': '04_simple_y_claro',
        'headline': 'Simple y claro para ti',
        'subheadline': 'Entiende tus documentos laborales sin complicarte ni perder tiempo.',
        'eyebrow': 'SIN TECNICISMOS',
        'source': None,
        'crop': None,
    },
]


def font(size: int, bold: bool = False):
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/liberation2/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
    ]
    for path in candidates:
        p = Path(path)
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def download_image(url: str) -> Image.Image:
    response = requests.get(url, timeout=120)
    response.raise_for_status()
    return Image.open(BytesIO(response.content)).convert('RGBA')


def load_local_image(path: Path) -> Image.Image:
    return Image.open(path).convert('RGBA')


def fit_cover(img: Image.Image, size):
    target_w, target_h = size
    ratio = max(target_w / img.width, target_h / img.height)
    resized = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def fit_contain(img: Image.Image, size):
    target_w, target_h = size
    ratio = min(target_w / img.width, target_h / img.height)
    new_size = (max(1, int(img.width * ratio)), max(1, int(img.height * ratio)))
    return img.resize(new_size, Image.LANCZOS)


def rounded_mask(size, radius):
    mask = Image.new('L', size, 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def crop_relative(img: Image.Image, crop):
    if crop is None:
        return img
    x1 = int(img.width * crop[0])
    y1 = int(img.height * crop[1])
    x2 = int(img.width * crop[2])
    y2 = int(img.height * crop[3])
    return img.crop((x1, y1, x2, y2))


def add_shadowed_card(canvas: Image.Image, box, radius, fill='white', shadow_opacity=26):
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sx1, sy1, sx2, sy2 = box
    shadow_box = (sx1 + 10, sy1 + 18, sx2 + 10, sy2 + 18)
    sdraw.rounded_rectangle(shadow_box, radius=radius, fill=(15, 23, 42, shadow_opacity))
    shadow = shadow.filter(ImageFilter.GaussianBlur(24))
    canvas.alpha_composite(shadow)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=BORDER, width=4)


def paste_center(canvas: Image.Image, img: Image.Image, center_x: int, top_y: int):
    x = center_x - img.width // 2
    canvas.alpha_composite(img, (x, top_y))


def draw_wrapped_text(draw: ImageDraw.ImageDraw, text: str, box, font_obj, fill, spacing=8):
    x1, y1, x2, y2 = box
    words = text.split()
    lines = []
    current = ''
    max_width = x2 - x1
    for word in words:
        candidate = f'{current} {word}'.strip()
        candidate_width = draw.textbbox((0, 0), candidate, font=font_obj)[2]
        if candidate_width <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    y = y1
    for line in lines:
        draw.text((x1, y), line, font=font_obj, fill=fill)
        y += font_obj.size + spacing
        if y > y2:
            break
    return y


def build_icon_master():
    canvas = Image.new('RGBA', (1024, 1024), BG)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((44, 44, 980, 980), radius=228, fill=BG_SOFT, outline=BORDER, width=8)
    draw.rounded_rectangle((164, 742, 860, 894), radius=76, fill=ACCENT)

    doc_box = (238, 176, 742, 676)
    draw.rounded_rectangle(doc_box, radius=112, fill='white', outline=BORDER, width=10)
    draw.rounded_rectangle((238, 176, 742, 306), radius=66, fill=DARK)

    for y in (372, 452, 532):
        draw.rounded_rectangle((314, y, 528, y + 30), radius=15, fill='#D7E7E4')

    draw.ellipse((428, 396, 690, 658), outline=ACCENT, width=40)
    draw.rounded_rectangle((624, 596, 784, 658), radius=30, fill=ACCENT)
    return canvas


def create_icons():
    master = build_icon_master()
    icons_dir = OUTPUT_DIR / 'icons'
    master.save(icons_dir / 'auditapatron-icon-master-1024.png')
    for size in IOS_ICON_SIZES:
        master.resize((size, size), Image.LANCZOS).save(icons_dir / f'auditapatron-ios-icon-{size}.png')
    for size in ANDROID_ICON_SIZES:
        master.resize((size, size), Image.LANCZOS).save(icons_dir / f'auditapatron-android-icon-{size}.png')


def create_splash(full_logo: Image.Image, wordmark: Image.Image, label: str, size):
    w, h = size
    canvas = Image.new('RGBA', size, BG)
    draw = ImageDraw.Draw(canvas)

    draw.rectangle((0, 0, w, int(h * 0.105)), fill=DARK)
    top_wordmark = fit_contain(wordmark, (int(w * 0.32), int(h * 0.055)))
    paste_center(canvas, top_wordmark, int(w * 0.18), int(h * 0.025))

    hero_box = (int(w * 0.07), int(h * 0.20), int(w * 0.93), int(h * 0.78))
    add_shadowed_card(canvas, hero_box, radius=int(w * 0.055), fill=CARD)
    logo = fit_contain(full_logo, (int(w * 0.56), int(h * 0.16)))
    paste_center(canvas, logo, w // 2, int(h * 0.29))

    title_f = font(max(44, w // 14), bold=True)
    body_f = font(max(22, w // 28), bold=False)
    cta_f = font(max(24, w // 25), bold=True)
    draw.text((int(w * 0.16), int(h * 0.55)), 'Tu nómina, clara.', font=title_f, fill=TEXT)
    draw_wrapped_text(draw, 'Revisa recibos y entiende qué conviene revisar primero, con un lenguaje simple y útil.', (int(w * 0.16), int(h * 0.61), int(w * 0.84), int(h * 0.72)), body_f, MUTED, spacing=10)
    cta_box = (int(w * 0.16), int(h * 0.72), int(w * 0.84), int(h * 0.80))
    draw.rounded_rectangle(cta_box, radius=int(w * 0.05), fill=ACCENT)
    cta = 'Empieza con un archivo'
    bbox = draw.textbbox((0, 0), cta, font=cta_f)
    tx = (w - (bbox[2] - bbox[0])) // 2
    draw.text((tx, int(h * 0.744)), cta, font=cta_f, fill='#053231')

    canvas.save((OUTPUT_DIR / 'splash' / f'auditapatron-splash-{label}-{w}x{h}.png'))


def build_privacy_scene(size):
    w, h = size
    scene = Image.new('RGBA', (int(w * 0.84), int(h * 0.60)), CARD)
    d = ImageDraw.Draw(scene)
    d.rounded_rectangle((0, 0, scene.width - 1, scene.height - 1), radius=int(w * 0.04), fill=CARD, outline=BORDER, width=4)
    title_f = font(max(24, w // 28), bold=True)
    body_f = font(max(18, w // 36), bold=False)
    chip_f = font(max(18, w // 40), bold=True)
    d.text((48, 44), 'Privacidad visible', font=title_f, fill=TEXT)
    d.text((48, 94), 'Solo tú ves tus documentos y su lectura.', font=body_f, fill=MUTED)
    items = ['Empieza con un recibo', 'Ve una señal clara', 'Decide si lo guardas']
    for idx, item in enumerate(items):
        top = 162 + idx * 138
        d.rounded_rectangle((40, top, scene.width - 40, top + 92), radius=24, fill='white', outline=BORDER, width=3)
        d.ellipse((66, top + 22, 112, top + 68), fill=ACCENT)
        d.text((140, top + 26), item, font=chip_f, fill=TEXT)
    return scene


def create_screenshot(spec_name: str, size, meta, wordmark: Image.Image, source_img: Image.Image | None):
    w, h = size
    canvas = Image.new('RGBA', size, BG)
    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, w, int(h * 0.10)), fill=DARK)
    top_wordmark = fit_contain(wordmark, (int(w * 0.30), int(h * 0.05)))
    paste_center(canvas, top_wordmark, int(w * 0.17), int(h * 0.025))

    pill_box = (int(w * 0.08), int(h * 0.145), int(w * 0.40), int(h * 0.185))
    draw.rounded_rectangle(pill_box, radius=int(w * 0.03), fill=CHIP_BG, outline=BORDER)
    eyebrow_f = font(max(20, w // 38), bold=True)
    draw.text((pill_box[0] + 24, pill_box[1] + 14), meta['eyebrow'], font=eyebrow_f, fill='#0F766E')

    title_f = font(max(54, w // 9), bold=True)
    subtitle_f = font(max(24, w // 26), bold=False)
    title_end = draw_wrapped_text(draw, meta['headline'], (int(w * 0.08), int(h * 0.22), int(w * 0.92), int(h * 0.39)), title_f, TEXT, spacing=10)
    draw_wrapped_text(draw, meta['subheadline'], (int(w * 0.08), title_end + 24, int(w * 0.92), int(h * 0.47)), subtitle_f, MUTED, spacing=10)

    frame_box = (int(w * 0.06), int(h * 0.43), int(w * 0.94), int(h * 0.83))
    add_shadowed_card(canvas, frame_box, radius=int(w * 0.05), fill='white', shadow_opacity=32)
    inner_box = (frame_box[0] + int(w * 0.016), frame_box[1] + int(w * 0.016), frame_box[2] - int(w * 0.016), frame_box[3] - int(w * 0.016))

    if source_img is not None:
        cropped = crop_relative(source_img, meta['crop'])
        fitted = fit_cover(cropped, (inner_box[2] - inner_box[0], inner_box[3] - inner_box[1]))
        mask = rounded_mask(fitted.size, radius=int(w * 0.03))
        canvas.paste(fitted, (inner_box[0], inner_box[1]), mask)
    else:
        scene = build_privacy_scene(size)
        scene = fit_cover(scene, (inner_box[2] - inner_box[0], inner_box[3] - inner_box[1]))
        mask = rounded_mask(scene.size, radius=int(w * 0.03))
        canvas.paste(scene, (inner_box[0], inner_box[1]), mask)

    chip_f = font(max(20, w // 40), bold=True)
    chips = ['Gratis para empezar', 'Privado desde el inicio', 'Siguiente paso claro']
    chip_y = int(h * 0.875)
    available = int(w * 0.86)
    chip_gap = int(w * 0.02)
    chip_width = int((available - 2 * chip_gap) / 3)
    start_x = int(w * 0.07)
    for idx, chip in enumerate(chips):
        x1 = start_x + idx * (chip_width + chip_gap)
        x2 = x1 + chip_width
        draw.rounded_rectangle((x1, chip_y, x2, chip_y + int(h * 0.05)), radius=int(w * 0.026), fill=CHIP_BG, outline=BORDER)
        draw.text((x1 + 18, chip_y + 16), chip, font=chip_f, fill=TEXT)

    out = OUTPUT_DIR / 'screenshots' / f'auditapatron-store-{meta["slug"]}-{spec_name}.png'
    canvas.save(out)


def main():
    full_logo = download_image(ASSETS['full_logo'])
    wordmark = download_image(ASSETS['wordmark'])
    home_img = load_local_image(HOMEPAGE_SHOT)
    access_img = load_local_image(ACCESS_SHOT)

    create_icons()

    for label, size in SPLASH_SPECS.items():
        create_splash(full_logo, wordmark, label, size)

    for spec_name, size in SCREENSHOT_SPECS.items():
        for meta in SCREENSHOT_COPY:
            if meta['source'] == HOMEPAGE_SHOT:
                source = home_img
            elif meta['source'] == ACCESS_SHOT:
                source = access_img
            else:
                source = None
            create_screenshot(spec_name, size, meta, wordmark, source)

    readme = OUTPUT_DIR / 'README.md'
    readme.write_text(
        '# Store assets final\n\n'
        'Paquete final de base para listing y branding móvil de Auditapatron.\n\n'
        '| Tipo | Cobertura |\n'
        '|---|---|\n'
        '| Iconos iOS | `icons/auditapatron-ios-icon-1024.png` y tamaños derivados 180, 167, 152, 120, 87, 80, 76, 60 |\n'
        '| Iconos Android | `icons/auditapatron-android-icon-512.png` y tamaños derivados 432, 192, 144, 96, 72, 48 |\n'
        '| Splash screens | `splash/` con variantes iPhone 6.9, iPhone 6.5, iPhone moderno y Android portrait/tall |\n'
        '| Screenshots iOS | `screenshots/` con series para `ios_69` e `ios_65` |\n'
        '| Screenshots Android | `screenshots/` con serie para `android_phone` |\n',
        encoding='utf-8'
    )


if __name__ == '__main__':
    main()

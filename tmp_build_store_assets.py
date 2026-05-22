from pathlib import Path
from io import BytesIO

import requests
from PIL import Image, ImageDraw, ImageFont, ImageFilter

PROJECT_DIR = Path('/home/ubuntu/complilink_operativo_v1')
OUTPUT_DIR = PROJECT_DIR / 'store-assets'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

ASSETS = {
    'full_logo': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-logo-final_01c8b00a.png',
    'wordmark': 'https://d2xsxph8kpxj0f.cloudfront.net/310519663473809458/cGpJC3DAdnBiVVBEKZfqbd/auditapatron-wordmark-final_059d1915.png',
}

HOMEPAGE_SHOT = Path('/home/ubuntu/screenshots/3000-ifwslt4380ij879_2026-05-21_19-56-12_4763.webp')
ACCESS_SHOT = Path('/home/ubuntu/screenshots/3000-ifwslt4380ij879_2026-05-21_19-56-30_4747.webp')

BG = '#EAF6F4'
DARK = '#334155'
ACCENT = '#1FCFC8'
TEXT = '#081222'
MUTED = '#566273'
CARD = '#F8FCFB'
BORDER = '#D5E5E2'

SCREEN_SPECS = {
    'ios_69': (1260, 2736),
    'android_phone': (1080, 1920),
}

SHOT_COPY = [
    {
        'slug': '01_sube_y_revisa',
        'title': 'Sube tu recibo y ve qué revisar',
        'subtitle': 'Empieza gratis con un archivo y recibe una primera lectura clara.',
        'source': HOMEPAGE_SHOT,
        'crop': (0.03, 0.02, 0.83, 0.84),
        'eyebrow': 'PRIMER PASO SIMPLE',
    },
    {
        'slug': '02_senal_clara',
        'title': 'Recibe una señal clara',
        'subtitle': 'Una explicación breve y el siguiente paso útil desde el primer vistazo.',
        'source': HOMEPAGE_SHOT,
        'crop': (0.53, 0.50, 0.98, 0.96),
        'eyebrow': 'RESULTADO INICIAL',
    },
    {
        'slug': '03_continua_despues',
        'title': 'Sigue donde te quedaste',
        'subtitle': 'Vuelve a tu revisión sin pasos confusos y con continuidad visible.',
        'source': ACCESS_SHOT,
        'crop': (0.22, 0.16, 0.78, 0.91),
        'eyebrow': 'CONTINUIDAD',
    },
    {
        'slug': '04_privado_y_simple',
        'title': 'Privado, simple y claro',
        'subtitle': 'Tu revisión inicia fácil y el control del archivo sigue en tus manos.',
        'source': None,
        'crop': None,
        'eyebrow': 'CONFIANZA VISIBLE',
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


def draw_multiline(draw: ImageDraw.ImageDraw, text: str, box, font_obj, fill, spacing=8):
    x1, y1, x2, y2 = box
    words = text.split()
    lines = []
    current = ''
    for word in words:
        test = f'{current} {word}'.strip()
        width = draw.textbbox((0, 0), test, font=font_obj)[2]
        if width <= (x2 - x1):
            current = test
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
    return y


def paste_center(canvas: Image.Image, img: Image.Image, center_x: int, top_y: int):
    x = center_x - img.width // 2
    canvas.alpha_composite(img, (x, top_y))


def add_shadowed_card(canvas: Image.Image, box, radius, fill='white'):
    shadow = Image.new('RGBA', canvas.size, (0, 0, 0, 0))
    sdraw = ImageDraw.Draw(shadow)
    sx1, sy1, sx2, sy2 = box
    shadow_box = (sx1 + 8, sy1 + 16, sx2 + 8, sy2 + 16)
    sdraw.rounded_rectangle(shadow_box, radius=radius, fill=(15, 23, 42, 26))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    canvas.alpha_composite(shadow)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=BORDER, width=4)


def create_icons():
    canvas = Image.new('RGBA', (1024, 1024), BG)
    draw = ImageDraw.Draw(canvas)
    draw.rounded_rectangle((52, 52, 972, 972), radius=220, fill=BG, outline=BORDER, width=6)

    # tarjeta base
    draw.rounded_rectangle((220, 220, 720, 650), radius=110, fill='white', outline=BORDER, width=8)
    draw.rounded_rectangle((220, 220, 720, 320), radius=60, fill=DARK)
    draw.rounded_rectangle((140, 760, 894, 900), radius=72, fill=ACCENT)

    # lente / auditoría
    draw.ellipse((420, 390, 670, 640), outline=ACCENT, width=38)
    draw.rounded_rectangle((620, 590, 770, 650), radius=30, fill=ACCENT)

    # líneas del documento
    for y in (380, 450, 520):
        draw.rounded_rectangle((300, y, 520, y + 28), radius=14, fill='#D8E6E4')

    canvas.save(OUTPUT_DIR / 'auditapatron-ios-icon-1024.png')

    android = canvas.resize((512, 512), Image.LANCZOS)
    android.save(OUTPUT_DIR / 'auditapatron-android-icon-512.png')


def create_splash(full_logo: Image.Image, wordmark: Image.Image, label: str, size):
    w, h = size
    canvas = Image.new('RGBA', (w, h), BG)
    draw = ImageDraw.Draw(canvas)

    draw.rectangle((0, 0, w, int(h * 0.11)), fill=DARK)
    word = fit_contain(wordmark, (int(w * 0.42), int(h * 0.07)))
    paste_center(canvas, word, int(w * 0.23), int(h * 0.025))

    add_shadowed_card(canvas, (int(w*0.09), int(h*0.20), int(w*0.91), int(h*0.77)), radius=int(w*0.05), fill=CARD)
    logo = fit_contain(full_logo, (int(w*0.58), int(h*0.16)))
    paste_center(canvas, logo, w // 2, int(h*0.29))
    title_f = font(max(34, w // 17), bold=True)
    body_f = font(max(22, w // 30), bold=False)
    draw.text((int(w*0.18), int(h*0.54)), 'Tu nómina, clara.', font=title_f, fill=TEXT)
    draw.text((int(w*0.18), int(h*0.60)), 'Revisa recibos y entiende qué conviene revisar primero.', font=body_f, fill=MUTED)
    draw.rounded_rectangle((int(w*0.18), int(h*0.69), int(w*0.82), int(h*0.78)), radius=int(w*0.05), fill=ACCENT)
    cta = 'Empieza con un archivo'
    cta_f = font(max(24, w // 28), bold=True)
    bbox = draw.textbbox((0, 0), cta, font=cta_f)
    tx = (w - (bbox[2] - bbox[0])) // 2
    draw.text((tx, int(h*0.715)), cta, font=cta_f, fill='#053231')
    canvas.save(OUTPUT_DIR / f'auditapatron-splash-{label}-{w}x{h}.png')


def build_designed_scene(size):
    w, h = size
    scene = Image.new('RGBA', (int(w*0.48), int(h*0.52)), CARD)
    d = ImageDraw.Draw(scene)
    d.rounded_rectangle((0, 0, scene.width-1, scene.height-1), radius=int(w*0.03), fill=CARD, outline=BORDER, width=4)
    d.text((40, 36), 'Privacidad visible', font=font(max(20, w//36), bold=True), fill=TEXT)
    d.text((40, 84), 'Nadie de tu empresa ve lo que subes.', font=font(max(18, w//42), False), fill=MUTED)
    entries = [
        'Empieza con un recibo',
        'Ve una señal clara',
        'Decide si lo guardas',
    ]
    for idx, entry in enumerate(entries):
        top = 150 + idx * 150
        d.rounded_rectangle((36, top, scene.width-36, top+100), radius=28, fill='white', outline=BORDER, width=3)
        d.ellipse((56, top+26, 104, top+74), fill=ACCENT)
        d.text((128, top+32), entry, font=font(max(20, w//38), bold=True), fill=TEXT)
    return scene


def create_screenshot_poster(spec_name: str, size, shot_meta, wordmark: Image.Image, source_img: Image.Image | None):
    w, h = size
    canvas = Image.new('RGBA', (w, h), BG)
    draw = ImageDraw.Draw(canvas)

    draw.rectangle((0, 0, w, int(h * 0.11)), fill=DARK)
    word = fit_contain(wordmark, (int(w * 0.34), int(h * 0.06)))
    paste_center(canvas, word, int(w * 0.19), int(h * 0.03))

    pill_y = int(h * 0.16)
    draw.rounded_rectangle((int(w*0.10), pill_y, int(w*0.40), pill_y + int(h*0.04)), radius=int(w*0.03), fill='#F7FCFB', outline=BORDER)
    eyebrow_f = font(max(20, w // 36), bold=True)
    draw.text((int(w*0.125), pill_y + int(h*0.010)), shot_meta['eyebrow'], font=eyebrow_f, fill='#0F766E')

    title_f = font(max(52, w // 9), bold=True)
    body_f = font(max(24, w // 24), bold=False)
    title_end_y = draw_multiline(draw, shot_meta['title'], (int(w*0.10), int(h*0.23), int(w*0.90), int(h*0.40)), title_f, TEXT, spacing=14)
    body_end_y = draw_multiline(draw, shot_meta['subtitle'], (int(w*0.10), title_end_y + 18, int(w*0.90), int(h*0.48)), body_f, MUTED, spacing=12)

    frame_box = (int(w*0.08), int(h*0.41), int(w*0.92), int(h*0.82))
    add_shadowed_card(canvas, frame_box, radius=int(w*0.045), fill='white')
    inner_box = (frame_box[0] + int(w*0.016), frame_box[1] + int(w*0.016), frame_box[2] - int(w*0.016), frame_box[3] - int(w*0.016))

    if source_img is not None:
        cropped = crop_relative(source_img, shot_meta['crop'])
        fitted = fit_cover(cropped, (inner_box[2]-inner_box[0], inner_box[3]-inner_box[1]))
        canvas.paste(fitted, (inner_box[0], inner_box[1]), rounded_mask(fitted.size, radius=int(w*0.03)))
    else:
        scene = build_designed_scene(size)
        scene = fit_cover(scene, (inner_box[2]-inner_box[0], inner_box[3]-inner_box[1]))
        canvas.paste(scene, (inner_box[0], inner_box[1]), rounded_mask(scene.size, radius=int(w*0.03)))

    footer_y = int(h*0.86)
    chip_font = font(max(18, w // 40), bold=True)
    chips = ['Gratis para empezar', 'Privado desde el inicio', 'Siguiente paso claro']
    chip_w = int((w*0.82) / 3)
    start_x = int(w*0.09)
    for idx, chip in enumerate(chips):
        x1 = start_x + idx * chip_w
        x2 = x1 + chip_w - int(w*0.02)
        draw.rounded_rectangle((x1, footer_y, x2, footer_y + int(h*0.045)), radius=int(w*0.025), fill='#F7FCFB', outline=BORDER)
        draw.text((x1 + 18, footer_y + 14), chip, font=chip_font, fill=TEXT)

    out = OUTPUT_DIR / f'auditapatron-store-{shot_meta["slug"]}-{spec_name}.png'
    canvas.save(out)


def main():
    full_logo = download_image(ASSETS['full_logo'])
    wordmark = download_image(ASSETS['wordmark'])
    home_img = load_local_image(HOMEPAGE_SHOT)
    access_img = load_local_image(ACCESS_SHOT)

    create_icons()
    for label, size in SCREEN_SPECS.items():
        create_splash(full_logo, wordmark, label, size)
    for spec_name, size in SCREEN_SPECS.items():
        for shot_meta in SHOT_COPY:
            if shot_meta['source'] == HOMEPAGE_SHOT:
                source = home_img
            elif shot_meta['source'] == ACCESS_SHOT:
                source = access_img
            else:
                source = None
            create_screenshot_poster(spec_name, size, shot_meta, wordmark, source)

    readme = OUTPUT_DIR / 'README.md'
    readme.write_text(
        '# Store assets\n\n'
        'Paquete visual base para iOS y Android de Auditapatron.\n\n'
        '| Tipo | Archivos principales |\n'
        '|---|---|\n'
        '| Iconos | `auditapatron-ios-icon-1024.png`, `auditapatron-android-icon-512.png` |\n'
        '| Splash | `auditapatron-splash-ios_69-1260x2736.png`, `auditapatron-splash-android_phone-1080x1920.png` |\n'
        '| Screenshots iOS | `auditapatron-store-01_sube_y_revisa-ios_69.png` a `auditapatron-store-04_privado_y_simple-ios_69.png` |\n'
        '| Screenshots Android | `auditapatron-store-01_sube_y_revisa-android_phone.png` a `auditapatron-store-04_privado_y_simple-android_phone.png` |\n',
        encoding='utf-8'
    )


if __name__ == '__main__':
    main()

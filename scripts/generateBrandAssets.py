from pathlib import Path

from PIL import Image, ImageChops, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/home/ubuntu/webdev-static-assets/auditapatron-app-icon-v2.png')
WEB_OUT = Path('/home/ubuntu/webdev-static-assets/auditapatron-brand')
ANDROID_RES = ROOT / 'android/app/src/main/res'
IOS_ASSETS = ROOT / 'ios/App/App/Assets.xcassets'

NAVY = (20, 44, 82)


def load_source() -> Image.Image:
    image = Image.open(SOURCE).convert('RGB')
    return image


def save_square(source: Image.Image, size: int, target: Path) -> None:
    target.parent.mkdir(parents=True, exist_ok=True)
    source.resize((size, size), Image.Resampling.LANCZOS).save(target, optimize=True)


def make_foreground(source: Image.Image) -> Image.Image:
    rgba = source.convert('RGBA')
    pixels = rgba.load()
    for y in range(rgba.height):
        for x in range(rgba.width):
            red, green, blue, _ = pixels[x, y]
            distance = abs(red - NAVY[0]) + abs(green - NAVY[1]) + abs(blue - NAVY[2])
            alpha = 0 if distance < 42 else min(255, max(0, (distance - 24) * 5))
            pixels[x, y] = (red, green, blue, alpha)
    return rgba


def save_round(source: Image.Image, size: int, target: Path) -> None:
    resized = source.resize((size, size), Image.Resampling.LANCZOS).convert('RGBA')
    mask = Image.new('L', (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    resized.putalpha(mask)
    target.parent.mkdir(parents=True, exist_ok=True)
    resized.save(target, optimize=True)


def save_splash(foreground: Image.Image, width: int, height: int, target: Path) -> None:
    canvas = Image.new('RGB', (width, height), NAVY)
    icon_size = round(min(width, height) * 0.28)
    icon = foreground.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    canvas.paste(icon, ((width - icon_size) // 2, (height - icon_size) // 2), icon)
    target.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(target, optimize=True)


def main() -> None:
    source = load_source()
    foreground = make_foreground(source)

    for size, name in ((32, 'favicon-32.png'), (180, 'apple-touch-icon-180.png'), (192, 'pwa-192.png'), (512, 'pwa-512.png')):
        save_square(source, size, WEB_OUT / name)

    densities = {
        'mdpi': (48, 108),
        'hdpi': (72, 162),
        'xhdpi': (96, 216),
        'xxhdpi': (144, 324),
        'xxxhdpi': (192, 432),
    }
    for density, (legacy_size, foreground_size) in densities.items():
        folder = ANDROID_RES / f'mipmap-{density}'
        save_square(source, legacy_size, folder / 'ic_launcher.png')
        save_round(source, legacy_size, folder / 'ic_launcher_round.png')
        foreground.resize((foreground_size, foreground_size), Image.Resampling.LANCZOS).save(
            folder / 'ic_launcher_foreground.png', optimize=True
        )

    splash_targets = {
        'drawable/splash.png': (480, 320),
        'drawable-land-mdpi/splash.png': (480, 320),
        'drawable-land-hdpi/splash.png': (800, 480),
        'drawable-land-xhdpi/splash.png': (1280, 720),
        'drawable-land-xxhdpi/splash.png': (1600, 960),
        'drawable-land-xxxhdpi/splash.png': (1920, 1280),
        'drawable-port-mdpi/splash.png': (320, 480),
        'drawable-port-hdpi/splash.png': (480, 800),
        'drawable-port-xhdpi/splash.png': (720, 1280),
        'drawable-port-xxhdpi/splash.png': (960, 1600),
        'drawable-port-xxxhdpi/splash.png': (1280, 1920),
    }
    for relative_path, (width, height) in splash_targets.items():
        save_splash(foreground, width, height, ANDROID_RES / relative_path)

    save_square(source, 1024, IOS_ASSETS / 'AppIcon.appiconset/AppIcon-512@2x.png')
    for filename in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
        save_splash(foreground, 2732, 2732, IOS_ASSETS / f'Splash.imageset/{filename}')


if __name__ == '__main__':
    main()

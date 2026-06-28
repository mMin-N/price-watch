#!/usr/bin/env python3
"""Generate Dropt icon assets from a single source PNG.

Usage:
  pip install pillow
  python scripts/generate-icons.py
  python scripts/generate-icons.py --source path/to/logo.png

Outputs icons for Next.js web, Expo mobile, Chrome extension, and Capacitor Android.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:
    print("Missing dependency: pip install pillow", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE = ROOT / "assets" / "logo-source.png"

# Deep purple matching the Dropt logo background
BRAND_BG = (26, 15, 46)  # #1a0f2e
SPLASH_BG = (26, 15, 46)
NOTIFICATION_TINT = (255, 255, 255)

ANDROID_MIPMAP = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def fit_square(img: Image.Image, size: int, padding_ratio: float = 0.0) -> Image.Image:
    """Resize image to fit inside a square canvas with optional inner padding."""
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * (1 - padding_ratio * 2))
    fitted = ImageOps.contain(img.convert("RGBA"), (inner, inner), Image.Resampling.LANCZOS)
    offset = ((size - fitted.width) // 2, (size - fitted.height) // 2)
    canvas.paste(fitted, offset, fitted)
    return canvas


def solid_background(size: int, color: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGB", (size, size), color)


def to_monochrome(img: Image.Image, size: int) -> Image.Image:
    """White silhouette on transparent background for Android notification icon."""
    fitted = fit_square(img, size, padding_ratio=0.12)
    alpha = fitted.split()[3]
    mono = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    white = Image.new("RGBA", (size, size), (*NOTIFICATION_TINT, 255))
    mono.paste(white, mask=alpha)
    return mono


def save_png(img: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if img.mode == "RGBA":
        img.save(path, "PNG", optimize=True)
    else:
        img.convert("RGB").save(path, "PNG", optimize=True)
    print(f"  wrote {path.relative_to(ROOT)}")


def generate_capacitor_android(source: Image.Image) -> None:
    res_dir = ROOT / "capacitor-app" / "android" / "app" / "src" / "main" / "res"
    if not res_dir.exists():
        print("  skip capacitor android (res dir not found)")
        return

    for folder, size in ANDROID_MIPMAP.items():
        icon = fit_square(source, size, padding_ratio=0.08)
        save_png(icon, res_dir / folder / "ic_launcher.png")
        save_png(icon, res_dir / folder / "ic_launcher_round.png")
        fg = fit_square(source, size, padding_ratio=0.18)
        save_png(fg, res_dir / folder / "ic_launcher_foreground.png")

    for name in ("drawable", "drawable-port-mdpi", "drawable-port-hdpi",
                 "drawable-port-xhdpi", "drawable-port-xxhdpi", "drawable-port-xxxhdpi"):
        splash_size = 480 if name == "drawable" else 320
        splash = Image.new("RGB", (splash_size, splash_size), SPLASH_BG)
        logo = fit_square(source, splash_size, padding_ratio=0.22).convert("RGBA")
        splash.paste(logo, (0, 0), logo)
        save_png(splash, res_dir / name / "splash.png")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Dropt icon assets")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Source logo PNG")
    args = parser.parse_args()

    if not args.source.exists():
        print(f"Source not found: {args.source}", file=sys.stderr)
        print("Place your logo at assets/logo-source.png or pass --source", file=sys.stderr)
        sys.exit(1)

    source = Image.open(args.source).convert("RGBA")
    print(f"Source: {args.source} ({source.width}x{source.height})")
    print("Generating icons...")

    # Next.js App Router
    web_icon = fit_square(source, 512, padding_ratio=0.06)
    save_png(web_icon, ROOT / "app" / "icon.png")
    save_png(fit_square(source, 180, padding_ratio=0.06), ROOT / "app" / "apple-icon.png")
    save_png(web_icon, ROOT / "public" / "icon.png")

    mobile = ROOT / "mobile" / "assets" / "images"
    save_png(fit_square(source, 1024, padding_ratio=0.06), mobile / "icon.png")
    save_png(fit_square(source, 1024, padding_ratio=0.18), mobile / "android-icon-foreground.png")
    save_png(solid_background(1024, BRAND_BG), mobile / "android-icon-background.png")
    save_png(to_monochrome(source, 1024), mobile / "android-icon-monochrome.png")
    save_png(fit_square(source, 512, padding_ratio=0.15), mobile / "splash-icon.png")
    save_png(fit_square(source, 48, padding_ratio=0.06), mobile / "favicon.png")

    ext = ROOT / "extension" / "icons"
    for size in (16, 48, 128):
        padding = 0.08 if size >= 48 else 0.04
        save_png(fit_square(source, size, padding_ratio=padding), ext / f"icon{size}.png")

    generate_capacitor_android(source)
    print("Done.")


if __name__ == "__main__":
    main()

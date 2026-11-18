"""Gilded Ember UI/VFX pack (user Eldervane_Gilded_Ember_UI_VFX.zip, 2026-11-18).

Sources (tracked, do not edit): assets/ui/gilded/*.png → runtime WebP in public/ui/gilded/.
- Icons: 256 × 256 (alpha kept). Divider: 1024 × 128.
- VFX sheets (4 × 3 frames, black background): black is un-mixed to real alpha
  (alpha = brightest channel, colour divided back out) so the light composites over the
  page without "screen" blending, then 1024 × 768 (256 px frames).
Needs Pillow + numpy. Re-run after replacing a source PNG.
"""
from pathlib import Path
import numpy as np
from PIL import Image

SRC, OUT = Path('assets/ui/gilded'), Path('public/ui/gilded')
ICONS = ['star_lit', 'star_empty', 'star_awakened', 'ring_frame', 'sparkle', 'hero_memory',
         'star_up', 'level_up', 'breakthrough', 'training_slot']
VFX = ['vfx_starup_pillar', 'vfx_starup_burst', 'vfx_levelup_ring', 'vfx_breakthrough']


def unmix_black(im: Image.Image) -> Image.Image:
    rgb = np.asarray(im.convert('RGB')).astype(np.float32) / 255
    a = rgb.max(axis=2)
    a = np.clip((a - 0.04) / 0.96, 0, 1)  # drop the near-black noise floor (keeps files small, no grey haze)
    col = np.where(a[..., None] > 1e-3, rgb / np.maximum(rgb.max(axis=2, keepdims=True), 1e-3), 0)
    out = np.dstack([np.clip(col, 0, 1), a]) * 255
    return Image.fromarray(out.round().astype(np.uint8), 'RGBA')


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for n in ICONS:
        Image.open(SRC / f'{n}.png').convert('RGBA').resize((256, 256), Image.LANCZOS).save(OUT / f'{n}.webp', quality=92, method=6)
    Image.open(SRC / 'divider.png').convert('RGBA').resize((1024, 128), Image.LANCZOS).save(OUT / 'divider.webp', quality=92, method=6)
    for n in VFX:
        unmix_black(Image.open(SRC / f'{n}.png')).resize((1024, 768), Image.LANCZOS).save(OUT / f'{n}.webp', quality=82, alpha_quality=70, method=6)
    for f in sorted(OUT.iterdir()):
        print(f'{f.name:28} {f.stat().st_size // 1024:4} KB')


if __name__ == '__main__':
    main()

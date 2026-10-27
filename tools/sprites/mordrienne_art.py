"""Mordrienne Vale UI art (user 2026-10-27) without modifying the originals.

python3 tools/sprites/mordrienne_art.py [source directory] [public output]
Sources: assets/heroes/Mordrienne/art/{portrait,s1,s2,ult,banner}.png
  portrait (1199 × 1312, bust)  → public/portraits/mordrienne.webp  288 (square crop around the face + shoulders)
  s1 Ashen Mark broken-hex sigil / s2 Cinderbind Hex thorned ground hex / ult House of Ashes serpent field
                                → public/skills/mordrienne-{s1,s2,ult}.webp  160
  banner (16:9)                 → public/banners/mordrienne.webp  1400 wide
Also called by mordrienne.py, so a full rebake never restores the old reference crop.
"""
import json
import sys
from pathlib import Path

from PIL import Image

KINDS = ('portrait', 's1', 's2', 'ult', 'banner')
# portrait: the tall bust is cropped to a square that keeps the face in the upper half (face ≈ x 560, y 300)
PORTRAIT_BOX = (150, 30, 1010, 890)


def square(im: Image.Image) -> Image.Image:
    s = min(im.size)
    x, y = (im.width - s) // 2, (im.height - s) // 2
    return im.crop((x, y, x + s, y + s))


def bake_ui(src, out):
    src, out = Path(src), Path(out)
    report = {}
    for kind in KINDS:
        path = src / f'{kind}.png'
        if not path.is_file():
            raise FileNotFoundError(f'Required Mordrienne UI art: {path}')
        im = Image.open(path).convert('RGB')
        if kind == 'banner':
            size, folder, name = (1400, round(im.height * 1400 / im.width)), 'banners', 'mordrienne.webp'
        elif kind == 'portrait':
            box = PORTRAIT_BOX if im.size == (1199, 1312) else None
            im = im.crop(box) if box else square(im)
            size, folder, name = (288, 288), 'portraits', 'mordrienne.webp'
        else:
            im, size, folder, name = square(im), (160, 160), 'skills', f'mordrienne-{kind}.webp'
        (out / folder).mkdir(parents=True, exist_ok=True)
        im.resize(size, Image.Resampling.LANCZOS).save(out / folder / name, quality=92)
        report[kind] = {'file': str(out / folder / name), 'size': size}
    return report


if __name__ == '__main__':
    print(json.dumps(bake_ui(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Mordrienne/art',
                             sys.argv[2] if len(sys.argv) > 2 else 'public'), indent=2))

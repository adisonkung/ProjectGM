"""Draeven UI art (user 2026-10-26) without modifying the originals.

python3 tools/sprites/draeven_art.py [source directory] [public output]
Sources: assets/heroes/Draeven/art/{portrait,s1,s2,ult,banner}.png
  portrait (square)  → public/portraits/draeven.webp  288
  s1 Blood Debt sigil / s2 Sovereign's Reprisal crimson slash / ult Blood Dominion sword impact
                     → public/skills/draeven-{s1,s2,ult}.webp  160
  banner (16:9)      → public/banners/draeven.webp  1400 wide
Also called by draeven.py, so a full rebake never restores the old reference crop.
"""
import json
import sys
from pathlib import Path

from PIL import Image

KINDS = ('portrait', 's1', 's2', 'ult', 'banner')


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
            raise FileNotFoundError(f'Required Draeven UI art: {path}')
        im = Image.open(path).convert('RGB')
        if kind == 'banner':
            size, folder, name = (1400, round(im.height * 1400 / im.width)), 'banners', 'draeven.webp'
        elif kind == 'portrait':
            im, size, folder, name = square(im), (288, 288), 'portraits', 'draeven.webp'
        else:
            im, size, folder, name = square(im), (160, 160), 'skills', f'draeven-{kind}.webp'
        (out / folder).mkdir(parents=True, exist_ok=True)
        im.resize(size, Image.Resampling.LANCZOS).save(out / folder / name, quality=92)
        report[kind] = {'file': str(out / folder / name), 'size': size}
    return report


if __name__ == '__main__':
    print(json.dumps(bake_ui(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Draeven/art',
                             sys.argv[2] if len(sys.argv) > 2 else 'public'), indent=2))

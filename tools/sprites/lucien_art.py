"""Lucien Valthorne UI art (user 2026-10-28) without modifying the originals.

python3 tools/sprites/lucien_art.py [source directory] [public output]
Sources: assets/heroes/Lucien/art/
  portrait.png (1199 × 1312, bust)  → public/portraits/lucien.webp  288 (square crop around the face + shoulders)
  skills.png   (2172 × 724, three framed panels left → right = S1 Black Benediction · S2 Martyr's Veil · Ult Black
                Miracle)            → public/skills/lucien-{s1,s2,ult}.webp  160 (each panel inside its black frame)
  banner.png   (16:9)               → public/banners/lucien.webp  1400 wide
Also called by lucien.py (instead of the temporary reference crop) when art/portrait.png exists.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

# portrait: the face sits at about (640, 300) — square that keeps the face in the upper half with the shoulders
PORTRAIT_BOX = (210, 20, 1070, 880)
SKILLS = ('s1', 's2', 'ult')


def square(im: Image.Image) -> Image.Image:
    s = min(im.size)
    x, y = (im.width - s) // 2, (im.height - s) // 2
    return im.crop((x, y, x + s, y + s))


def panels(im: Image.Image, n=3, inset=4):
    """the n framed panels of a strip: split on the near-black frame columns / rows (≥ 97 % dark)"""
    m = np.array(im.convert('RGB')).max(2)
    def spans(dark):
        out, start = [], None
        for i, d in enumerate(list(dark) + [True]):
            if not d and start is None:
                start = i
            elif d and start is not None:
                out.append((start, i)); start = None
        return [s for s in out if s[1] - s[0] > 50]
    xs = spans((m[im.height // 4: 3 * im.height // 4] < 25).mean(0) > 0.97)
    ys = spans((m[:, 30:-30] < 25).mean(1) > 0.97)
    if len(xs) != n or len(ys) != 1:
        raise ValueError(f'expected {n} framed panels, found columns {xs} rows {ys}')
    (y0, y1), = ys
    return [im.crop((x0 + inset, y0 + inset, x1 - inset, y1 - inset)) for x0, x1 in xs]


def bake_ui(src, out):
    src, out = Path(src), Path(out)
    report = {}
    for name in ('portrait.png', 'skills.png', 'banner.png'):
        if not (src / name).is_file():
            raise FileNotFoundError(f'Required Lucien UI art: {src / name}')
    jobs = []
    im = Image.open(src / 'portrait.png').convert('RGB')
    jobs.append(('portrait', im.crop(PORTRAIT_BOX) if im.size == (1199, 1312) else square(im), (288, 288),
                 'portraits', 'lucien.webp'))
    for kind, p in zip(SKILLS, panels(Image.open(src / 'skills.png').convert('RGB'))):
        jobs.append((kind, square(p), (160, 160), 'skills', f'lucien-{kind}.webp'))
    im = Image.open(src / 'banner.png').convert('RGB')
    jobs.append(('banner', im, (1400, round(im.height * 1400 / im.width)), 'banners', 'lucien.webp'))
    for kind, im, size, folder, name in jobs:
        (out / folder).mkdir(parents=True, exist_ok=True)
        im.resize(size, Image.Resampling.LANCZOS).save(out / folder / name, quality=92)
        report[kind] = {'file': str(out / folder / name), 'size': size}
    return report


if __name__ == '__main__':
    print(json.dumps(bake_ui(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Lucien/art',
                             sys.argv[2] if len(sys.argv) > 2 else 'public'), indent=2))

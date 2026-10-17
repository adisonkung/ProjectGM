"""Convert supplied Sylvara UI art without modifying originals.

python3 tools/sprites/sylvara_art.py [source directory] [public output]
Also used by sylvara.py so a full rebake never restores the old reference crop.
"""
import json
import sys
from pathlib import Path

from PIL import Image

SOURCES = {'portrait': 'icon_portrait.png', 's1': 'skill1.png', 's2': 'skill2.png',
           'ult': 'ultimate.png', 'banner': 'banner.png'}


def bake_ui(src, out):
    src, out = Path(src), Path(out)
    for filename in SOURCES.values():
        if not (src / filename).is_file():
            raise FileNotFoundError(f'Required Sylvara UI art: {src / filename}')
    report = {}
    for kind, filename in SOURCES.items():
        im = Image.open(src / filename).convert('RGB')
        size = (1400, round(im.height * 1400 / im.width)) if kind == 'banner' else (288, 288) if kind == 'portrait' else (160, 160)
        folder = out / ('banners' if kind == 'banner' else 'portraits' if kind == 'portrait' else 'skills')
        folder.mkdir(parents=True, exist_ok=True)
        name = 'sylvara.webp' if kind in ('portrait', 'banner') else f'sylvara-{kind}.webp'
        im.resize(size, Image.Resampling.LANCZOS).save(folder / name, quality=92)
        report[kind] = {'file': str(folder / name), 'size': size}
    return report


if __name__ == '__main__':
    print(json.dumps(bake_ui(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/sylvara/art',
                             sys.argv[2] if len(sys.argv) > 2 else 'public'), indent=2))

"""Convert Elira_icn.zip UI sources; keep originals and their full composition.

python3 tools/sprites/elira_art.py [source directory] [public output]
elira.py also calls this so a full rebake cannot restore the reference portrait.
"""
import json
import sys
from pathlib import Path

from PIL import Image

SOURCES = {'portrait': 'icon.png', 's1': 'skill1.png', 's2': 'skill2.png',
           'ult': 'ultimate.png', 'banner': 'banner.png'}


def bake_ui(src, out):
    src, out = Path(src), Path(out)
    for filename in SOURCES.values():
        if not (src / filename).is_file():
            raise FileNotFoundError(f'Required Elira UI art: {src / filename}')
    report = {}
    for kind, filename in SOURCES.items():
        with Image.open(src / filename) as source:
            im = source.convert('RGB')
        size = (1400, round(im.height * 1400 / im.width)) if kind == 'banner' else (288, 288) if kind == 'portrait' else (160, 160)
        folder = out / ('banners' if kind == 'banner' else 'portraits' if kind == 'portrait' else 'skills')
        folder.mkdir(parents=True, exist_ok=True)
        name = 'elira.webp' if kind in ('portrait', 'banner') else f'elira-{kind}.webp'
        im.resize(size, Image.Resampling.LANCZOS).save(folder / name, quality=92)
        report[kind] = {'file': str(folder / name), 'size': size}
    return report


if __name__ == '__main__':
    print(json.dumps(bake_ui(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/elira/art',
                             sys.argv[2] if len(sys.argv) > 2 else 'public'), indent=2))

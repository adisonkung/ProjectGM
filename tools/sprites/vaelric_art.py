"""Import supplied v_icon.zip UI art without changing original files.

python3 tools/sprites/vaelric_art.py [ZIP or source directory] [public output]
vaelric.py also uses this importer so a rebake cannot restore the old reference crop.
"""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path

from PIL import Image, ImageOps

SOURCES = {'portrait': 'protrait.png', 's1': 'icon-s1.png', 's2': 'icon-s2.png',
           'ult': 'icon-ultimate.png', 'banner': 'v_banner.png'}


def read_sources(src):
    src = Path(src)
    if src.is_file():
        with zipfile.ZipFile(src) as archive:
            return {kind: archive.read(name) for kind, name in SOURCES.items()}
    return {kind: (src / name).read_bytes() for kind, name in SOURCES.items()}


def bake_ui(src, out):
    sources = read_sources(src)  # Fail before writing if any dedicated source is absent.
    images = {kind: Image.open(io.BytesIO(data)).convert('RGB') for kind, data in sources.items()}
    out = Path(out)
    report = {}
    for kind, im in images.items():
        if kind == 'portrait':
            # Tall portrait: keep the face/hair and original proportions, crop the lower torso.
            size = (288, 288)
            result = ImageOps.fit(im, size, Image.Resampling.LANCZOS, centering=(.5, 0))
        else:
            size = (1400, round(im.height * 1400 / im.width)) if kind == 'banner' else (160, 160)
            result = im.resize(size, Image.Resampling.LANCZOS)
        folder = out / ('banners' if kind == 'banner' else 'portraits' if kind == 'portrait' else 'skills')
        folder.mkdir(parents=True, exist_ok=True)
        name = 'vaelric.webp' if kind in ('portrait', 'banner') else f'vaelric-{kind}.webp'
        result.save(folder / name, quality=92, method=6)
        report[kind] = {'source': SOURCES[kind], 'sha256': hashlib.sha256(sources[kind]).hexdigest(),
                        'sourceSize': im.size, 'size': size, 'file': str(folder / name)}
    return report


if __name__ == '__main__':
    print(json.dumps(bake_ui(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/vaelric/art',
                             sys.argv[2] if len(sys.argv) > 2 else 'public'), indent=2))

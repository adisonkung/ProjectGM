"""Import the user's 2026-10-30 portrait/banner refresh without cropping or editing original assets.

python3 tools/dev/import_hero_ui_art.py [archive] [public-output]
The original ZIP is retained separately; assets/heroes/Kael and art/incoming are never modified.
"""
import hashlib
import io
import json
import sys
import zipfile
from pathlib import Path
from PIL import Image, ImageOps

ALIASES = {'bai': 'bailong', 'yue': 'yuezheng', 'mo': 'moye', 'tang': 'tangxun',
           'lin': 'linxue', 'garrick': 'garrick', 'kael': 'kael', 'mir': 'mirelle',
           'syl': 'sylvara', 'elira': 'elira', 'dra': 'draeven'}
EXPECTED = {f'{name}_{kind}.png' for name in ALIASES for kind in ('portrait', 'banner')
            if not (name == 'dra' and kind == 'banner')}
EXPECTED.remove('garrick_portrait.png')
EXPECTED.add('garrick_portrait2.png')


def import_art(archive, output):
    archive, output = Path(archive), Path(output)
    report = {'source': archive.as_posix(), 'source_sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'images': []}
    with zipfile.ZipFile(archive) as z:
        if len(z.namelist()) != len(EXPECTED) or set(z.namelist()) != EXPECTED:
            raise ValueError('Archive files differ from the reviewed 21-image refresh')
        # Validate every source before replacing any runtime image.
        for name in EXPECTED:
            with Image.open(io.BytesIO(z.read(name))) as im:
                im.verify()
        for name in sorted(EXPECTED):
            alias, kind = Path(name).stem.split('_')
            kind = 'portrait' if kind == 'portrait2' else kind
            hero = ALIASES[alias]
            data = z.read(name)
            with Image.open(io.BytesIO(data)) as src:
                im = ImageOps.exif_transpose(src).convert('RGBA')
            original_size = list(im.size)
            limit = (768, 768) if kind == 'portrait' else (1600, 1600)
            im.thumbnail(limit, Image.Resampling.LANCZOS)
            if im.getextrema()[3] == (255, 255):
                im = im.convert('RGB')
            dest = output / f'{kind}s' / f'{hero}.webp'
            dest.parent.mkdir(parents=True, exist_ok=True)
            im.save(dest, format='WEBP', quality=94, method=6)
            report['images'].append({'source_file': name, 'hero': hero, 'kind': kind,
                'source_size': original_size, 'size': list(im.size), 'output': dest.as_posix(),
                'source_sha256': hashlib.sha256(data).hexdigest(),
                'output_sha256': hashlib.sha256(dest.read_bytes()).hexdigest()})
    return report


if __name__ == '__main__':
    result = import_art(sys.argv[1] if len(sys.argv) > 1 else 'assets/ui/hero-refresh-2026-10-30.zip',
                        sys.argv[2] if len(sys.argv) > 2 else 'public')
    Path('docs/hero-art-refresh-2026-10-30.json').write_text(json.dumps(result, indent=2) + '\n')
    print(f"Imported {len(result['images'])} images with original aspect ratios")

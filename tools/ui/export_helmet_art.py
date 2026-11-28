"""Helmet tier art (user upload New_folder_5.zip, 2026-11-28): T1 … T5 = Common … Epic.

Sources (tracked, do not edit): assets/ui/equipment-helmet/T1.png … T5.png (1254 × 1254, alpha).
Runtime: public/ui/equipment/tiered/helmet/<tier>.webp (512 × 512, the size of the other tiered icons).
Helmet is an illustrative socket only (no real slot), so no -large showcase file is exported. Needs Pillow. Re-run after replacing a source PNG.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image

SRC, OUT = Path('assets/ui/equipment-helmet'), Path('public/ui/equipment/tiered/helmet')
TIERS = ['common', 'uncommon', 'rare', 'elite', 'epic']


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for n, tier in enumerate(TIERS, start=1):
        src = SRC / f'T{n}.png'
        manifest[src.name] = {'tier': tier, 'sha256': hashlib.sha256(src.read_bytes()).hexdigest()}
        im = Image.open(src).convert('RGBA')
        im.resize((512, 512), Image.LANCZOS).save(OUT / f'{tier}.webp', quality=88, method=6)
    (SRC / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    for f in sorted(OUT.iterdir()):
        print(f'{f.name:22} {f.stat().st_size // 1024:4} KB')


if __name__ == '__main__':
    main()

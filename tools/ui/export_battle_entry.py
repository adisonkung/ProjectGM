"""Reproduce the approved pearl aura and the black-screen runner. Originals stay unchanged."""
from pathlib import Path
from hashlib import sha256
from io import BytesIO
import argparse
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/ui/battle-entry/pearl-collision.png'
GOBLIN = ROOT / 'public/sprites/enemy-fa-forest-goblin.png'
MANIFEST = ROOT / 'assets/ui/battle-entry/manifest.json'
OUT = ROOT / 'public/ui/battle-entry'

def digest(path):
    return sha256(path.read_bytes()).hexdigest()

def exports():
    aura = Image.open(SOURCE)
    aura.thumbnail((1200, 480))
    result = BytesIO()
    aura.save(result, format='WEBP', quality=86, method=6)
    sheet = Image.open(GOBLIN).convert('RGBA')
    strip = Image.new('RGBA', (640, 80))
    for i in range(8):
        frame = sheet.crop((i * 132, 0, (i + 1) * 132, 100)).crop((52, 35, 90, 85)).resize((80, 80))
        strip.paste(frame, (i * 80, 0))
    runner = BytesIO()
    strip.save(runner, format='WEBP', lossless=True)
    return {'pearl-collision.webp': result.getvalue(), 'goblin-run.webp': runner.getvalue()}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    data = json.loads(MANIFEST.read_text())
    for path in (SOURCE, GOBLIN):
        assert digest(path) == data['sources'][str(path.relative_to(ROOT))], f'Changed source: {path}'
    OUT.mkdir(parents=True, exist_ok=True)
    for name, content in exports().items():
        path = OUT / name
        if args.check:
            assert path.read_bytes() == content, f'Export differs: {path}'
        else:
            path.write_bytes(content)
        assert digest(path) == data['runtime'][str(path.relative_to(ROOT))], f'Changed runtime asset: {path}'
    print('Battle entry sources and runtime exports verified.')

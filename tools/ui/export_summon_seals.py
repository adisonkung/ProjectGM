"""Export original generated stone icons; alpha bounds, padding and WebP delivery only."""
from pathlib import Path
import json
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/ui/summon-seals'
TARGET = ROOT / 'public/ui/summon-seals'
TARGET.mkdir(parents=True, exist_ok=True)
manifest = []
for name, filename, half in [('standard', 'blue-aurora-source.png', 0), ('aurora', 'blue-aurora-source.png', 1), ('gold', 'gold-source.png', None)]:
    path = SOURCE / filename
    im = Image.open(path).convert('RGBA')
    origin = 0 if half is None else half * (im.width // 2)
    cell_width = im.width if half is None else im.width // 2
    alpha = im.getchannel('A').crop((origin, 0, origin + cell_width, im.height))
    box = alpha.point(lambda a: 255 if a >= 8 else 0).getbbox()
    assert box, f'Empty source: {name}'
    x0, y0, x1, y1 = box
    pad = 12
    x0 = max(0, x0 - pad) + origin
    x1 = min(cell_width, x1 + pad) + origin
    y0 = max(0, y0 - pad)
    y1 = min(im.height, y1 + pad)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-vf', f'crop={x1-x0}:{y1-y0}:{x0}:{y0},scale=-1:512', '-c:v', 'libwebp', '-quality', '86', '-y', str(TARGET / f'{name}.webp')], check=True)
    manifest.append({'name': name, 'source': filename, 'sourceSize': list(im.size), 'crop': [x0,y0,x1-x0,y1-y0], 'url': f'/ui/summon-seals/{name}.webp'})
(SOURCE / 'exports.json').write_text(json.dumps(manifest, indent=2)+'\n')
print(json.dumps(manifest))

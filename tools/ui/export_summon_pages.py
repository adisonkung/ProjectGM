"""Export the approved loose ancient pages without changing their painted artwork."""
from pathlib import Path
import json
import subprocess
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/ui/summon-pages'
TARGET = ROOT / 'public/ui/summon-pages'
TARGET.mkdir(parents=True, exist_ok=True)
path = SOURCE / 'pages-source.png'
im = Image.open(path).convert('RGBA')
manifest = []
for index, name in enumerate(['standard', 'gold', 'aurora']):
    left, right = index * im.width // 3, (index + 1) * im.width // 3
    alpha = im.getchannel('A').crop((left, 0, right, im.height))
    box = alpha.point(lambda value: 255 if value >= 8 else 0).getbbox()
    assert box, f'Empty source: {name}'
    x0, y0, x1, y1 = box
    pad = 12
    x0 = max(0, x0 - pad) + left
    x1 = min(right - left, x1 + pad) + left
    y0 = max(0, y0 - pad)
    y1 = min(im.height, y1 + pad)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-i', str(path),
                    '-vf', f'crop={x1-x0}:{y1-y0}:{x0}:{y0},scale=-1:512',
                    '-c:v', 'libwebp', '-quality', '88', '-y', str(TARGET / f'{name}.webp')], check=True)
    manifest.append({'name': name, 'source': path.name, 'sourceSize': list(im.size),
                     'crop': [x0, y0, x1-x0, y1-y0], 'url': f'/ui/summon-pages/{name}.webp'})
(SOURCE / 'exports.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(json.dumps(manifest))

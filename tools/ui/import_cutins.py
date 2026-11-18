"""Export approved isolated cut-in PNGs without resizing or changing alpha."""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
manifest = ROOT / 'assets/ui/cutins/manifest.json'
rows = json.loads(manifest.read_text())
for row in rows:
    source = ROOT / row['source']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == row['source_sha256'], source
    image = Image.open(source).convert('RGBA')
    assert image.getextrema()[3][0] == 0, f'{source}: expected real alpha'
    assert image.size == (row['w'], row['h']), source
    output = ROOT / row['file']
    output.parent.mkdir(parents=True, exist_ok=True)
    image.save(output, 'WEBP', quality=92, method=6)
    row['runtime_sha256'] = hashlib.sha256(output.read_bytes()).hexdigest()
manifest.write_text(json.dumps(rows, ensure_ascii=False, indent=2) + '\n')

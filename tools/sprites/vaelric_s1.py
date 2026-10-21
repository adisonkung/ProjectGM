"""Cut the supplied native-alpha S1 Main / Loop / Impact strips, preserving their drawn pixels.

python3 tools/sprites/vaelric_s1.py [source dir] [sprite output] [metadata output]
Character poses are baked by vaelric.py. No keying, redraw, replacement VFX or source edits.
"""
import hashlib
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/vaelric/s1')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    metadata = Path(sys.argv[3] if len(sys.argv) > 3 else 'tmp/vaelric-s1/fx-metadata.json')
    result = {}
    for part in ['main', 'loop', 'impact']:
        path = src / f's1_{part}.png'
        im = Image.open(path).convert('RGBA')
        if im.size != (2172, 724):
            raise ValueError(f'Expected 8-stage native-alpha strip: {path}')
        pixels = np.array(im)
        ys, _ = np.nonzero(pixels[..., 3] >= 16)
        scale = 112 / (int(ys.max()) - int(ys.min()) + 1)
        w, h = round(2172 / 8 * scale), round(724 * scale)
        strip = Image.new('RGBA', (w * 8, h))
        for i in range(8):
            frame = im.crop((round(i * 2172 / 8), 0, round((i + 1) * 2172 / 8), 724))
            frame = frame.resize((w, h), Image.Resampling.LANCZOS)
            strip.alpha_composite(frame, (i * w, 0))
        out.mkdir(parents=True, exist_ok=True)
        file = f'fx-vaelric-s1-{part}.png'
        strip.save(out / file, optimize=True)
        result[part] = {'file': file, 'frames': 8, 'w': w, 'h': h,
                        'pivot': [0.5, (int(ys.min()) + int(ys.max())) / 2 / 724],
                        'sourceSha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    metadata.parent.mkdir(parents=True, exist_ok=True)
    metadata.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()

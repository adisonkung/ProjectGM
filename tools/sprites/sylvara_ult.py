"""Bake supplied Emerald Skyfall tracks for provisional runtime review.

python3 tools/sprites/sylvara_ult.py [source directory] [sprite output]
Uses original alpha where supplied. Ascent/rain motion is presentation only;
field cadence, occupants and damage remain owned by the combat engine.
"""
import json
import sys
from pathlib import Path

import numpy as np
from scipy import ndimage
from PIL import Image
import aurel_v2 as A
from sylvara_s1 import load_fx, cut_frames
from sylvara_s2 import rows
from mirelle_s2 import bake_ground


def motion(frames, out, name, rain=False):
    """Translate the supplied arrow stages; never rotate the vertical falling variant."""
    w, h = (300, 400) if rain else (440, 390)
    strip = Image.new('RGBA', (w * len(frames), h))
    scale = (90 / max(im.height for im, _ in frames)) if rain else (110 / max(im.width for im, _ in frames))
    for i, (source, _) in enumerate(frames):
        im = source.resize((max(1, round(source.width * scale)), max(1, round(source.height * scale))), Image.Resampling.LANCZOS)
        k = i / (len(frames) - 1)
        if rain:
            # Six fixed cell contacts in three columns and two lanes, not six damage emitters.
            positions = [(x - im.width // 2, round(y - 160 * (1 - k)) - im.height)
                         for y in (260, 360) for x in (50, 150, 250)]
        else:
            positions = [(round(65 + 245 * k) - im.width // 2, round(290 - 245 * k) - im.height // 2)]
        for x, y in positions:
            if x < 0 or y < 0 or x + im.width >= w or y + im.height >= h:
                raise ValueError(f'{name}: clipped arrow stage {i + 1}: {(x, y, im.size)}')
            strip.alpha_composite(im, (i * w + x, y))
    strip.save(out / name, optimize=True)
    return {'frames': len(frames), 'w': w, 'h': h,
            'pivot': [0.5, 310 / h] if rain else [65 / w, 290 / h],
            'sourceBounds': [bounds for _, bounds in frames]}


def field_frames(path):
    a = load_fx(path)
    result = []
    for y0, y1 in [(250, 600), (650, 1020)]:
        row = a[y0:y1].copy()
        labels, _ = A.seam_labels(row[..., 3], 3, 50)
        for i in range(1, 4):
            mask = (labels == i) & (row[..., 3] > 0)
            blobs, _ = ndimage.label(mask, np.ones((3, 3)))
            sizes = np.bincount(blobs.ravel())
            mask &= sizes[blobs] >= 12
            ys, xs = np.nonzero(mask)
            x0, x1, top, bottom = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            tile = row[top:bottom, x0:x1].copy()
            tile[~mask[top:bottom, x0:x1]] = 0
            result.append((Image.fromarray(tile), [int(x0), int(y0 + top), int(x1), int(y0 + bottom)]))
    return result


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/sylvara/ult')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    charge = rows(src / 'Ultimate Charge VFX.png', [[190, 550, 910, 1270]] * 2, [0, 530, 1086])
    ascent = rows(src / 'Ultimate Main VFX.png', [[210, 680, 1160, 1670]] * 2, [0, 390, 793])
    field = field_frames(src / 'Ultimate Arrow Rain Ground Field VFX.png')
    rain = cut_frames(load_fx(src / 'ultimate Falling Arrows VFX.png'), [100, 325, 550, 775, 1000, 1225, 1450, 1675], [0, 488])
    impact = rows(src / 'Ultimate Arrow Impact Burst VFX.png', [[220, 660, 1100, 1540]] * 2, [0, 475, 887])
    report = {'state': 'PROVISIONAL_REVIEW',
              'charge': bake_ground(charge, out, 'fx-sylvara-ult-charge.png', 120),
              'ascent': motion(ascent, out, 'fx-sylvara-ult-ascent.png'),
              'field': bake_ground(field, out, 'fx-sylvara-ult-field.png', 240),
              'rain': motion(rain, out, 'fx-sylvara-ult-rain.png', True),
              'impact': bake_ground(impact, out, 'fx-sylvara-ult-impact.png', 96)}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

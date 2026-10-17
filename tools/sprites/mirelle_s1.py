"""Cut the user-supplied Frost Needle sources for a PROVISIONAL visual review.

python3 tools/sprites/mirelle_s1.py [source directory] [sprite output]
No timeline JSON, Sync Sheet, final event timings or generated replacement art.
Character baking belongs to mirelle.py. Original PNG/XLSX files remain read-only.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def load_fx(path):
    a = np.array(Image.open(path).convert('RGBA'))
    rgb = a[..., :3].astype(float)
    # The projectile already has alpha. Respect it instead of keying its hidden green RGB.
    if a[..., 3].min() == 0:
        a[a[..., 3] < 16] = 0
        return a
    # Recover painted ice/glow from the flat magenta matte, preserving blue/white colour.
    bg = np.median(np.concatenate((rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3))), axis=0)
    alpha = np.clip(np.max(np.abs(rgb - bg), axis=2) / 255, 0, 1)
    clean = (rgb - (1 - alpha[..., None]) * bg) / np.maximum(alpha[..., None], 1 / 255)
    a[..., :3] = np.clip(clean, 0, 255).astype(np.uint8)
    a[..., 3] = np.where(alpha >= 0.06, np.round(alpha * 255), 0).astype(np.uint8)
    a[a[..., 3] == 0] = 0
    return a


def cut_frames(a, centres):
    """Assign whole connected components to source centres; never equal-grid cut the irregular projectile."""
    mask = a[..., 3] > 0
    labels, count = ndimage.label(mask, np.ones((3, 3)))
    boxes = ndimage.find_objects(labels)
    sizes = np.bincount(labels.ravel())
    owners = np.full(count + 1, -1)
    for i, box in enumerate(boxes, 1):
        if box is None or sizes[i] < 4:
            continue
        cy, cx = ndimage.center_of_mass(mask[box], labels[box], i)
        cx += box[1].start
        cy += box[0].start
        # Drop low-alpha dust far away from the actual strip.
        if abs(cy - 570) > 190 and a.shape[0] > 1000:
            continue
        owners[i] = int(np.argmin(np.abs(np.array(centres) - cx)))
    out = []
    for i, center in enumerate(centres):
        own = owners[labels] == i
        ys, xs = np.nonzero(own)
        if not len(xs):
            raise ValueError(f'Missing frame {i + 1}')
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        tile = a[y0:y1, x0:x1].copy()
        tile[~own[y0:y1, x0:x1]] = 0
        out.append((Image.fromarray(tile), (int(x0), int(y0), int(x1), int(y1))))
    return out


def bake(frames, out, name, peak_width, tip=False, blank_end=False):
    scale = peak_width / max(im.width for im, _ in frames)
    tiles = [im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.Resampling.LANCZOS)
             for im, _ in frames]
    # Projectiles are sampled about the flight point; put each needle tip at the centre.
    w = 2 * (max(im.width for im in tiles) + 2) if tip else max(im.width for im in tiles) + 4
    h = max(im.height for im in tiles) + 4
    n = len(tiles) + int(blank_end)
    strip = Image.new('RGBA', (w * n, h))
    for i, im in enumerate(tiles):
        x = w // 2 - im.width + 1 if tip else (w - im.width) // 2
        strip.alpha_composite(im, (i * w + x, (h - im.height) // 2))
    strip.save(out / name, optimize=True)
    return {'frames': n, 'w': w, 'h': h, 'sourceBounds': [b for _, b in frames]}


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/mirelle/s1')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    projectile = cut_frames(load_fx(src / 's1_projectile.png'), [72, 197, 365, 559, 784, 1016, 1213, 1377])
    impact = cut_frames(load_fx(src / 's1_impact.png'), [137, 392, 715, 1063, 1450, 1823, 2133, 2375])
    # Source frames 1–2 are circular build-up, not flying needles. Use 3–8 for flight.
    # Empty terminal frame prevents the flight strip becoming a second impact on arrival.
    report = {'state': 'PROVISIONAL_REVIEW',
              'projectile': bake(projectile[2:], out, 'fx-mirelle-s1-projectile.png', 32, tip=True, blank_end=True),
              'impact': bake(impact, out, 'fx-mirelle-s1-impact.png', 32)}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

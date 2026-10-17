"""Cut the supplied Emerald Piercer Main/Impact for provisional in-game review.

python3 tools/sprites/sylvara_s1.py [S1 source directory] [sprite output]
Original PNGs/XLSX are read-only. No replacement art or final timing/Sync Sheet.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def load_fx(path):
    a = np.array(Image.open(path).convert('RGBA'))
    if a[..., 3].min() == 0:
        # Main has real alpha with green RGB hidden in transparent pixels. Never key its green artwork.
        a[a[..., 3] < 16] = 0
        return a
    rgb = a[..., :3].astype(float)
    bg = np.median(np.concatenate((rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3))), axis=0)
    alpha = np.clip(np.max(np.abs(rgb - bg), axis=2) / 255, 0, 1)
    clean = (rgb - (1 - alpha[..., None]) * bg) / np.maximum(alpha[..., None], 1 / 255)
    a[..., :3] = np.clip(clean, 0, 255).astype(np.uint8)
    a[..., 3] = np.where(alpha >= 0.06, np.round(alpha * 255), 0).astype(np.uint8)
    a[a[..., 3] == 0] = 0
    return a


def cut_frames(a, centers, band):
    # Ignore the Main's isolated matte specks above/below its actual painted strip.
    a[:band[0]] = 0
    a[band[1]:] = 0
    mask = a[..., 3] > 0
    labels, count = ndimage.label(mask, np.ones((3, 3)))
    sizes = np.bincount(labels.ravel())
    owners = np.full(count + 1, -1)
    for i, box in enumerate(ndimage.find_objects(labels), 1):
        if box is None or sizes[i] < 4:
            continue
        y, x = ndimage.center_of_mass(mask[box], labels[box], i)
        x += box[1].start
        owners[i] = int(np.argmin(np.abs(np.array(centers) - x)))
    frames = []
    for i in range(len(centers)):
        own = owners[labels] == i
        ys, xs = np.nonzero(own)
        if not len(xs):
            raise ValueError(f'Missing source frame {i + 1}')
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        tile = a[y0:y1, x0:x1].copy()
        tile[~own[y0:y1, x0:x1]] = 0
        frames.append((Image.fromarray(tile), [int(x0), int(y0), int(x1), int(y1)]))
    return frames


def bake(frames, path, peak_width, projectile=False):
    scale = peak_width / max(im.width for im, _ in frames)
    tiles = [im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.Resampling.LANCZOS)
             for im, _ in frames]
    w = 2 * (max(im.width for im in tiles) + 2) if projectile else max(im.width for im in tiles) + 4
    h = max(im.height for im in tiles) + 4
    count = len(tiles) + int(projectile)
    strip = Image.new('RGBA', (w * count, h))
    for i, im in enumerate(tiles):
        # Flight point is the arrow tip. The final blank cell prevents a second arrival burst.
        x = w // 2 - im.width + 1 if projectile else (w - im.width) // 2
        strip.alpha_composite(im, (i * w + x, (h - im.height) // 2))
    strip.save(path, optimize=True)
    return {'frames': count, 'w': w, 'h': h, 'sourceBounds': [b for _, b in frames]}


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/sylvara/s1')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    main_frames = cut_frames(load_fx(src / 's1_main.png'), [105, 275, 520, 825, 1185, 1525, 1810, 2040], [280, 460])
    impact_frames = cut_frames(load_fx(src / 's1_impact.png'), [85, 250, 450, 710, 970, 1200, 1410, 1590], [300, 680])
    # Source1 is a round buildup sparkle, not a flying arrow; source2–8 supply the flight progression.
    print(json.dumps({'state': 'PROVISIONAL_REVIEW',
                      'projectile': bake(main_frames[1:], out / 'fx-sylvara-s1-projectile.png', 64, True),
                      'impact': bake(impact_frames, out / 'fx-sylvara-s1-impact.png', 64)}, indent=2))


if __name__ == '__main__':
    main()

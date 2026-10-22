"""Draeven Ult — charge aura around the blade (user 2026-10-22). Never modifies the source PNG.

python3 tools/sprites/draeven_ult_vfx.py [source] [out dir]
Source: assets/heroes/Draeven/vfx/draeven_ult_charge_aura.png — 8 frames in one row on a magenta key (2172 × 724).

User: during the Ult charge hold the aura wraps the sword; play the 8 frames once, then keep cycling the last frames until
the downward slash starts, then the aura is gone. The hold is a fixed 1.5 s in the clip (sprites.ts, step 15), so the
strip is baked to exactly that length: intro f1–f8, then f6 → f7 → f8 → f7 … (60 ms per frame, 25 frames = 1.50 s).

Each frame keeps its place inside its slot of the source row (the artist grows the spiral from one end). The spiral's long
axis (measured on f8) is turned onto the blade of the hold pose (atlas row 7 col 15: blade tip (127, 60) → hilt (167, 67),
~41 px) and scaled so the spiral is BLADE_COVER × the blade length. Baked at 2 × atlas px (FxDef scale 1/3 = 1 atlas px).
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = 'assets/heroes/Draeven/vfx/draeven_ult_charge_aura.png'
N, SLOT = 8, 2172 / 8
EDGES = [0, 266, 526, 792, 1061, 1328, 1607, 1879, 2172]  # mid-gaps between the drawn frames
BLADE = ((127, 60), (167, 67))  # tip → hilt in the atlas cell (hold pose)
BLADE_COVER = 1.45
RES = 2  # bake at 2 × atlas px
FRAME_MS = 60
HOLD_MS = 1500
LOOP = [5, 6, 7, 6]


def unmix(rgb: np.ndarray) -> np.ndarray:
    rgb = rgb.astype(float)
    bg = np.median(rgb[:6].reshape(-1, 3), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = np.clip(1 - (np.minimum(r, b) - g) / (min(bg[0], bg[2]) - bg[1]), 0, 1)
    al = np.where(al < 0.08, 0, al)
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    return np.dstack([col, al * 255]).astype(np.uint8)


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else SRC)
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    im = unmix(np.array(Image.open(src).convert('RGB')))
    h = im.shape[0]
    slots = []
    for k in range(N):
        a, b = EDGES[k], EDGES[k + 1]
        s = np.zeros((h, 420, 4), np.uint8)
        x0 = int(round(k * SLOT)) - 60  # slot origin on the artist's spacing (keeps each frame's drawn position)
        part = im[:, a:b].copy()
        part[..., 3] = np.where(ndimage.binary_opening(part[..., 3] > 20, iterations=1) | (part[..., 3] > 60), part[..., 3], 0)
        s[:, a - x0:b - x0] = part
        slots.append(s)
    # long axis of the full spiral (f8) by PCA of its alpha
    al = slots[-1][..., 3].astype(float)
    ys, xs = np.nonzero(al > 60)
    cx, cy = xs.mean(), ys.mean()
    cov = np.cov(np.vstack([xs - cx, ys - cy]))
    ev, evec = np.linalg.eigh(cov)
    ax = evec[:, np.argmax(ev)]
    proj = (xs - cx) * ax[0] + (ys - cy) * ax[1]
    length = np.percentile(proj, 99) - np.percentile(proj, 1)
    src_ang = np.degrees(np.arctan2(ax[1], ax[0]))  # image coords (y down)
    (tx, ty), (hx, hy) = BLADE
    blade_ang = np.degrees(np.arctan2(hy - ty, hx - tx))
    blade_len = np.hypot(hx - tx, hy - ty)
    scale = BLADE_COVER * blade_len * RES / length
    # rotate every slot about the f8 centre by the same angle, then scale
    rot = src_ang - blade_ang
    frames = []
    for s in slots:
        img = Image.fromarray(s)
        pad = Image.new('RGBA', (900, 900))
        pad.paste(img, (int(450 - cx), int(450 - cy)))
        r = pad.rotate(rot, resample=Image.BICUBIC, center=(450, 450))
        n = int(round(900 * scale))
        frames.append(r.resize((n, n), Image.LANCZOS))
    box = None
    for f in frames:
        bb = f.getbbox()
        if bb:
            box = bb if box is None else (min(box[0], bb[0]), min(box[1], bb[1]), max(box[2], bb[2]), max(box[3], bb[3]))
    c = frames[0].size[0] / 2  # the f8 centre (= blade centre) stays the frame centre
    half_w = int(np.ceil(max(c - box[0], box[2] - c))) + 2
    half_h = int(np.ceil(max(c - box[1], box[3] - c))) + 2
    cells = [f.crop((int(c - half_w), int(c - half_h), int(c + half_w), int(c + half_h))) for f in frames]
    seq = list(range(N))
    total = HOLD_MS // FRAME_MS
    while len(seq) < total:
        seq.append(LOOP[(len(seq) - N) % len(LOOP)])
    W, H = cells[0].size
    strip = Image.new('RGBA', (W * len(seq), H))
    for i, k in enumerate(seq):
        strip.paste(cells[k], (i * W, 0))
    out.mkdir(parents=True, exist_ok=True)
    strip.save(out / 'fx-draeven-ult-charge.png', optimize=True)
    print({'frames': len(seq), 'w': W, 'h': H, 'frameMs': FRAME_MS, 'rotate': round(rot, 1), 'scale': round(scale, 4),
           'bladeCentre': ((tx + hx) / 2, (ty + hy) / 2), 'seq': seq})


if __name__ == '__main__':
    main()

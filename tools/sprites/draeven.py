"""Draeven Morcant (The Bloodwrought Sovereign) — Phase A sprite bake. Never modifies the source PNGs.

python3 tools/sprites/draeven.py [source dir] [sprite output] [portrait output]
Default source: assets/heroes/Draeven (user-supplied Autosprite sheets, 2026-10-22).

Every source sheet is a square-cell RGBA grid drawn at its own zoom. Each sheet is mapped into the idle sheet's space
with one similarity transform (scale + offset) measured once with SIFT against idle F0 (feature matches on armour /
face; frames 0–2 of run, the stand-up frames of death / attack, both ends of the skill sheets). That keeps the body
the same size in every clip. The idle body (head → feet, sword excluded) is then scaled to 80 px with the feet on the
cell root (130, 155) — the game's 260 × 170 hero cell, matching Mirelle / Sylvara proportions.

Downscale = premultiplied INTER_AREA with the soft alpha kept (no 0/255 threshold) — the frames are painted art, a hard
cut makes the edges shimmer frame to frame.

S2 source: Draeven's ungloved fingertip is pink in the raw sheet; it is dyed to the glove colour (only small pink /
beige components that stick out of the dark glove into the background — the gold gauntlet trim is never touched).
"""
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

CELL_W, CELL_H, ROOT_X, ROOT_Y = 260, 170, 130, 155
BODY_PX = 80
# idle F0 (768 px cells): body head → feet = 690 px, feet centre x 415, ground y 732
IDLE_BODY, IDLE_FEET_X, IDLE_GROUND = 690, 415, 732
K = BODY_PX / IDLE_BODY

# sheet: (file, grid columns, similarity to idle space: scale, tx, ty) — measured with SIFT vs idle F0
SHEETS = {
    'idle': ('base/draeven_idle.png', 7, (1.0, 0.0, 0.0)),
    'run': ('base/draeven_run.png', 8, (1.854, -148.4, -76.6)),
    'attack': ('base/draeven_attack.png', 5, (1.974, -599.7, -1162.7)),
    'death': ('base/draeven_death.png', 8, (1.33, -127.1, -129.4)),
    's1': ('skill/draeven_s1_taunt.png', 8, (1.5, -0.136, -0.207)),
    's2': ('skill/draeven_s2_sword_release.png', 12, (1.501, -0.283, -0.273)),
}
# atlas rows (frame indices into each sheet's non-empty cells, reading order)
ROWS = [
    ('idle', 'idle', list(range(0, 48, 4))),                     # 12 · breathing loop
    ('walk', 'run', list(range(18, 34, 2))),                     # 8 · one run cycle
    ('hurt', 'death', [0, 7, 9]),                                # 3 · provisional: the stagger at the start of death
    ('attack', 'attack', list(range(21))),                       # 21 · basic attack (ult reuses this row)
    ('die', 'death', [5, 7, 9, 11, 13, 14, 16, 18, 21, 24, 26, 28, 29, 30]),  # 14
    ('skill', 's1', list(range(0, 56, 2))),                      # 28 · S1 Blood Debt taunt (hand beckon)
    ('skill2', 's2', list(range(76, 127, 2))),                   # 26 · S2 provisional: sword raised and released forward
]
COLS = max(len(r[2]) for r in ROWS)


def cells(path: Path, cols: int):
    im = Image.open(path).convert('RGBA')
    size = im.width // cols
    out = []
    for i in range(cols * (im.height // size)):
        r, c = divmod(i, cols)
        f = np.array(im.crop((c * size, r * size, c * size + size, r * size + size)))
        if (f[..., 3] > 0).sum() >= 500:
            out.append(f)
    return out


def dye_fingers(a: np.ndarray) -> np.ndarray:
    """pink / beige fingertip components sticking out of the dark glove → glove colour (luminance kept)"""
    a = a.astype(np.float32)
    r, g, b, al = (a[..., k] for k in range(4))
    h, w = r.shape
    yy, xx = np.mgrid[0:h, 0:w]
    skin = (al > 0) & (r > 110) & (g > 55) & (b > g - 75) & (r - g > 6) & (xx > 335) & (yy < 330)
    dark = (al > 0) & (a[..., :3].max(-1) < 90)
    near = ndimage.binary_dilation(dark, iterations=5)
    bgn = ndimage.binary_dilation(al == 0, iterations=3)
    lab, _ = ndimage.label(skin, np.ones((3, 3)))
    m = np.zeros_like(skin)
    for j, sl in enumerate(ndimage.find_objects(lab), 1):
        comp = lab[sl] == j
        if comp.shape[0] <= 60 and comp.shape[1] <= 60 and comp.sum() >= 4 and (near[sl] & comp).any() \
                and (bgn[sl] & comp).sum() >= 0.35 * comp.sum():
            m[sl] |= comp
    m = ndimage.binary_dilation(m, iterations=1) & (al > 0) & ~dark
    lum = 0.3 * r + 0.59 * g + 0.11 * b
    t = np.clip((lum - 70) / 150, 0, 1)[..., None]
    dark_c, light_c = np.array([30, 22, 12], np.float32), np.array([105, 84, 62], np.float32)
    a[..., :3] = np.where(m[..., None], dark_c + (light_c - dark_c) * t, a[..., :3])
    return a.astype(np.uint8)


def to_cell(frame: np.ndarray, sim) -> np.ndarray:
    s, tx, ty = sim
    sc = s * K
    p = frame.astype(np.float32) / 255
    p = np.dstack([p[..., :3] * p[..., 3:], p[..., 3:]])
    n = round(frame.shape[0] * sc)
    sm = cv2.resize(p, (n, n), interpolation=cv2.INTER_AREA)
    x0 = round(tx * K + ROOT_X - IDLE_FEET_X * K)
    y0 = round(ty * K + ROOT_Y - IDLE_GROUND * K)
    cell = np.zeros((CELL_H, CELL_W, 4), np.float32)
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    w = min(n - sx0, CELL_W - dx0)
    h = min(n - sy0, CELL_H - dy0)
    cell[dy0:dy0 + h, dx0:dx0 + w] = sm[sy0:sy0 + h, sx0:sx0 + w]
    al = cell[..., 3:]
    rgb = np.where(al > 1e-3, cell[..., :3] / np.maximum(al, 1e-3), 0)
    return (np.clip(np.dstack([rgb, al]), 0, 1) * 255).astype(np.uint8)


def portrait(src: Path, out: Path):
    """temporary portrait: head + shoulders of the master reference (magenta keyed), crimson backdrop"""
    a = np.array(Image.open(src).convert('RGB')).astype(np.int32)
    key = (a[..., 0] > 150) & (a[..., 2] > 150) & (a[..., 1] < 120)
    rgba = np.dstack([a, np.where(key, 0, 255)]).astype(np.uint8)
    face = Image.fromarray(rgba).crop((470, 40, 830, 400))
    bg = Image.new('RGBA', face.size, (58, 14, 20, 255))
    grad = Image.linear_gradient('L').resize(face.size).point(lambda v: int(v * 0.55))
    bg = Image.composite(Image.new('RGBA', face.size, (18, 6, 10, 255)), bg, grad)
    bg.alpha_composite(face)
    out.parent.mkdir(parents=True, exist_ok=True)
    bg.convert('RGB').resize((288, 288), Image.LANCZOS).save(out, 'WEBP', quality=92)


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Draeven')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    portraits = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
    hashes = {}
    frames = {}
    for name, (file, cols, sim) in SHEETS.items():
        path = src / file
        hashes[file] = hashlib.sha256(path.read_bytes()).hexdigest()
        fr = cells(path, cols)
        if name == 's2':
            fr = [dye_fingers(f) for f in fr]
        frames[name] = (fr, sim)
    atlas = np.zeros((CELL_H * len(ROWS), CELL_W * COLS, 4), np.uint8)
    meta = {}
    for row, (anim, sheet, picks) in enumerate(ROWS):
        fr, sim = frames[sheet]
        for i, idx in enumerate(picks):
            atlas[row * CELL_H:(row + 1) * CELL_H, i * CELL_W:(i + 1) * CELL_W] = to_cell(fr[idx], sim)
        meta[anim] = {'row': row, 'frames': len(picks), 'source': sheet, 'sourceFrames': picks}
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(out / 'hero-draeven.png', optimize=True)
    portrait(src / 'reference/draeven_master_reference.png', portraits / 'draeven.webp')
    body = atlas[:CELL_H, :CELL_W, 3] > 96
    ys = np.nonzero(body.any(1))[0]
    print(json.dumps({'cols': COLS, 'rows': len(ROWS), 'idleBody': int(ys.max() - ys.min() + 1), 'rows_meta': meta,
                      'sourceSha256': hashes}, indent=1))


if __name__ == '__main__':
    main()

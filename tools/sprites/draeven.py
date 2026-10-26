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

S2 / Ult sources (2026-10-22): user sheets on a white background, saved as JPEG (no alpha) → `key_white` on load. The S2
release frames keep their baked wave / burst / impact disc as drawn (user: "ใส่มาให้ครบ"); white-hot cores re-filled.
The Ult sheet keeps its baked white motion smears (part of the swing, like Vaelric's baked slash).
"""
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

CELL_W, CELL_H, ROOT_X, ROOT_Y = 290, 170, 145, 155  # 290 wide (2026-10-22): the S2 burst / disc reach 140 px ahead of the feet
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
    # 2026-10-22 supplied S2 / Ult sheets: 8 × 7 cells of 1000 px on a WHITE background (JPEG, no alpha) → keyed on load.
    # Mapped by matching the head → feet height of the opening stance (261 px → idle 686 px ≈ ×2.6, the stance differs from
    # idle F0 so SIFT has too few inliers) and putting the mid-feet on the idle feet
    's2': ('skill/draeven_s2_release_v2.jpg', 8, (2.6, -907.1, -1527.4)),
    'ult': ('skill/draeven_ult.jpg', 8, (2.6, -860.3, -1556.0)),
}
# atlas rows (frame indices into each sheet's non-empty cells, reading order)
ROWS = [
    ('idle', 'idle', list(range(0, 48, 4))),                     # 12 · breathing loop
    ('walk', 'run', list(range(18, 34, 2))),                     # 8 · one run cycle
    ('hurt', 'death', [0, 7, 9]),                                # 3 · provisional: the stagger at the start of death
    ('attack', 'attack', list(range(21))),                       # 21 · basic attack (ult reuses this row)
    ('die', 'death', [5, 7, 9, 11, 13, 14, 16, 18, 21, 24, 26, 28, 29, 30]),  # 14
    ('skill', 's1', list(range(0, 56, 2))),                      # 28 · S1 Blood Debt taunt (hand beckon)
    # 27 · S2 Sovereign's Reprisal: raise → sword drawn back F17 → forward release F18–F24 (baked wave / burst stripped) → recover
    ('skill2', 's2', [2, 4, 6, 8, 10, 12, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 30, 32, 34, 36, 38, 40, 42]),
    # 28 · Ult Bloodwrought Execution: raise → crouch + spin (momentum, no hit) → sword lowered behind the head to the
    # horizontal wind-up F33 = the charge HOLD (aura around the blade) → ONE downward slam F34–F36 → recover
    ('ult', 'ult', [7, 10, 13, 16, 18, 19, 20, 21, 22, 23, 24, 25, 27, 29, 31, 33, 34, 35, 36, 37, 38, 39, 40, 42, 44, 46, 48, 54]),
]
# S2 sheet frames whose forward release carries the baked crimson wave / burst / impact disc — kept as drawn
S2_VFX_FRAMES = range(18, 25)
COLS = max(len(r[2]) for r in ROWS)


def key_white(rgb: np.ndarray) -> np.ndarray:
    """white-background (JPEG) cell → RGBA: the enclosed body is opaque, soft edges and light motion smears are unmixed
    from white (alpha = how far the darkest channel is from white); enclosed near-white gaps stay transparent"""
    a = rgb.astype(np.float32)
    mn = a.min(-1)
    alpha = np.clip((255 - mn) / 45.0, 0, 1)
    solid = ndimage.binary_erosion(ndimage.binary_fill_holes(mn < 200) & (mn < 236), iterations=2)
    alpha = np.where(solid, 1.0, alpha)
    # JPEG ringing leaves a pale rim around the dark outline: pull light edge pixels in by ~3 px
    rim = (ndimage.grey_erosion(alpha, size=7) < alpha) & (mn > 120)
    alpha = np.where(rim, ndimage.grey_erosion(alpha, size=7), alpha)
    alpha[alpha < 0.06] = 0
    al = alpha[..., None]
    col = np.where(al > 0, (a - (1 - al) * 255) / np.maximum(al, 1e-3), 0)
    return np.dstack([np.clip(col, 0, 255), alpha * 255]).astype(np.uint8)


def fill_glow_cores(frames: list, raw: list) -> list:
    """S2 release frames keep the baked wave / burst (user 2026-10-22: "ใส่มาให้ครบ"). Their white-hot cores are as white
    as the background, so keying empties them; holes enclosed by the glow (right of the body) are filled back opaque"""
    out = list(frames)
    for i in S2_VFX_FRAMES:
        f = frames[i].copy()
        m = f[..., 3] > 64
        h, w = m.shape
        sealed = m
        if i >= 20:  # the spiky burst / disc frames: seal the gaps between the rays first
            grown = ndimage.distance_transform_edt(~m) <= 16  # round closing (a square one leaves boxy corners)
            sealed = ndimage.distance_transform_edt(grown) > 16
        holes = ndimage.binary_fill_holes(sealed) & ~m & (np.mgrid[0:h, 0:w][1] > 640)
        holes = ndimage.binary_dilation(holes, iterations=2) & (f[..., 3] < 255)
        f[..., :3] = np.where(holes[..., None], raw[i][..., :3], f[..., :3])
        f[..., 3] = np.where(holes, 255, f[..., 3])
        out[i] = f
    return out


def cells(path: Path, cols: int, with_raw: bool = False):
    im = Image.open(path)
    keyed = path.suffix.lower() in ('.jpg', '.jpeg')
    im = im.convert('RGB' if keyed else 'RGBA')
    size = im.width // cols
    out = []
    raw = []
    for i in range(cols * (im.height // size)):
        r, c = divmod(i, cols)
        f = np.array(im.crop((c * size, r * size, c * size + size, r * size + size)))
        src = f
        if keyed:
            f = key_white(f)
        if (f[..., 3] > 0).sum() >= 500:
            out.append(f)
            raw.append(src)
    return (out, raw) if with_raw else out


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
        fr, raw = cells(path, cols, with_raw=True)
        if name == 's2':
            fr = fill_glow_cores(fr, raw)
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
    if (src / 'art/portrait.png').is_file():  # the user's painted UI art (2026-10-26) wins over the reference crop
        import draeven_art
        draeven_art.bake_ui(src / 'art', portraits.parent)
    else:
        portrait(src / 'reference/draeven_master_reference.png', portraits / 'draeven.webp')
    body = atlas[:CELL_H, :CELL_W, 3] > 96
    ys = np.nonzero(body.any(1))[0]
    print(json.dumps({'cols': COLS, 'rows': len(ROWS), 'idleBody': int(ys.max() - ys.min() + 1), 'rows_meta': meta,
                      'sourceSha256': hashes}, indent=1))


if __name__ == '__main__':
    main()

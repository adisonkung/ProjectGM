"""Sylas Veyrn — The Dusk Reaver (Archer: Ranged DPS / Hunter / Sharpshooter) — sprite bake. Never modifies the sources.

python3 tools/sprites/sylas.py [source dir] [sprite output] [portrait output]
Default source: assets/heroes/Sylas (user-supplied, 2026-10-27, hero_sylas.zip).

Sources: 8 × 7 cells of 512 px, RGBA (reading order), one camera for every sheet (feet y ≈ 421–427):
  base/sylas_idle.png    55 frames, one breathing loop (F55 ≈ F1)
  base/sylas_run.png     49 frames, a 16-frame run cycle three times
  base/sylas_hurt.png    56 frames: stand → hit F13 → recoil F14–F22 → crouch → rise F37–F42 → stand
  base/sylas_death.png   56 frames: stand → stagger F15–F16 → kneel F17–F40 → fall F41–F48 → lie still
  skill/sylas_s1_dusk_mark.png             56: draw F1–F8 → aim F9–F16 → RELEASE F17 (baked flash F17–F24) → hold →
                                               lower F38–F41 → stand
  skill/sylas_s2_reaver_volley.png         56: draw → aim F9–F12 → SHOT 1 F13 · SHOT 2 F23 · SHOT 3 F32 (baked
                                               flashes) → hold → lower F43–F45 → stand
  skill/sylas_ult_nightfall_execution.png  56: draw F1–F5 → kneel F6–F9 → aim F10–F17 → RELEASE F18 (baked beam
                                               F18–F22) → kneeling re-aim F23–F56 (no stand-up frames: the kneel
                                               frames are played back in reverse to stand)
The baked muzzle flashes / bolts / blobs in the skill sheets are erased (alpha 0 ahead of the crossbow tip): the
dedicated Dusk Teal VFX sheets (tools/sprites/sylas_vfx.py) replace them.

Skill sheets are drawn ~3 % larger than idle (body 345 vs 335 px) → scaled 0.97 into idle space. Each sheet's frame-0
feet are placed on the idle feet; the idle body (hair top → feet) is scaled to BODY_PX with the feet on the 260 × 170
cell root (130, 155). Basic attack = the aim → release part of the S1 sheet (user 2026-10-27).
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
BODY_PX = 78
IDLE_BODY = 335  # idle F1: hair top y 86 → feet y 421 (512 px cells)
K = BODY_PX / IDLE_BODY
SRC_CELL = 512

# sheet: (file, scale into idle space, flash-erase: (from x, source frame indices) or None)
SHEETS = {
    'idle': ('base/sylas_idle.png', 1.0, None),
    'run': ('base/sylas_run.png', 1.0, None),
    'hurt': ('base/sylas_hurt.png', 1.0, None),
    'death': ('base/sylas_death.png', 1.0, None),
    # crossbow tip while aiming: S1 x 463 · S2 x 454 · Ult x 425 (kneeling) — everything ahead of it is baked VFX
    's1': ('skill/sylas_s1_dusk_mark.png', 0.97, (466, range(16, 25))),
    's2': ('skill/sylas_s2_reaver_volley.png', 0.97, (457, [*range(12, 16), *range(22, 27), *range(31, 35)])),
    'ult': ('skill/sylas_ult_nightfall_execution.png', 0.97, (428, range(17, 23))),
}
# atlas rows: (anim, sheet, source frame indices 0-based)
ROWS = [
    ('idle', 'idle', list(range(0, 54, 3))),                                                  # 18 · loop
    ('walk', 'run', list(range(0, 16, 2))),                                                   # 8 · one run cycle
    ('hurt', 'hurt', [12, 13, 14, 16, 19, 22, 34, 37, 39, 41, 43]),                           # 11 · hit → recover
    # 12 · basic attack (user: the S1 sprite): aim → release F17 (DAMAGE = bolt spawn) → hold → lower
    ('attack', 's1', [8, 10, 12, 14, 15, 16, 24, 27, 31, 36, 39, 41]),
    ('die', 'death', [13, 14, 15, 16, 17, 18, 19, 22, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48]),  # 19
    # 19 · S1 Dusk Mark: draw → aim / AimCharge at the tip F11–F16 → RELEASE F17 → recoil / hold → lower → stand
    ('skill', 's1', [0, 2, 4, 6, 8, 10, 12, 14, 15, 16, 24, 26, 28, 31, 34, 37, 39, 41, 43]),
    # 21 · S2 Reaver Volley: draw → aim → SHOT 1 F13 → SHOT 2 F23 → SHOT 3 (final piercing) F32 → hold → lower
    ('skill2', 's2', [0, 3, 6, 8, 10, 11, 12, 14, 17, 20, 22, 25, 28, 30, 31, 33, 36, 39, 42, 44, 46]),
    # 23 · Ult Nightfall Execution: draw → kneel → aim → CHARGE HOLD (F17) → RELEASE F18 → recoil / re-aim →
    #      stand up (the kneel frames reversed)
    ('ult', 'ult', [0, 2, 4, 5, 6, 7, 8, 10, 12, 14, 16, 17, 23, 25, 27, 30, 8, 7, 6, 5, 4, 2, 0]),
]
COLS = max(len(r[2]) for r in ROWS)


def cells(path: Path) -> list:
    im = Image.open(path).convert('RGBA')
    cols = im.width // SRC_CELL
    out = []
    for i in range(cols * (im.height // SRC_CELL)):
        r, c = divmod(i, cols)
        f = np.array(im.crop((c * SRC_CELL, r * SRC_CELL, (c + 1) * SRC_CELL, (r + 1) * SRC_CELL)))
        if (f[..., 3] > 0).sum() >= 500:
            out.append(f)
    return out


def erase_flash(frames: list, spec) -> list:
    if not spec:
        return frames
    x0, idx = spec
    out = list(frames)
    xs = np.arange(SRC_CELL)[None, :]
    for i in idx:
        f = out[i].copy()
        rgb = f[..., :3].astype(np.int16)
        # the flash sits on the tip itself: cream-white core + bright green glow (the crossbow is brown / steel grey)
        glow = (rgb.min(2) > 195) | ((rgb[..., 1] - rgb[..., 0] > 40) & (rgb[..., 1] > 140))
        f[(xs >= x0) | ((xs >= x0 - 40) & glow), 3] = 0
        # specks left ahead of the bow
        lab, n = ndimage.label(f[..., 3] > 0)
        if n > 1:
            size = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            com = ndimage.center_of_mass(f[..., 3] > 0, lab, range(1, n + 1))
            for k in range(n):
                if size[k] < 60 and com[k][1] > x0 - 60:
                    f[lab == k + 1, 3] = 0
        out[i] = f
    return out


def feet(frame: np.ndarray):
    """ground y + feet centre x of a standing frame (bottom 4 % of the opaque body)"""
    ys, xs = np.nonzero(frame[..., 3] > 128)
    g = ys.max()
    low = ys > g - 0.04 * (g - ys.min())
    return float(xs[low].mean()), float(g)


def to_cell(frame: np.ndarray, scale: float, anchor) -> np.ndarray:
    """scale (sheet → idle space) × K, sheet anchor (feet x, ground y) on the cell root; premultiplied INTER_AREA"""
    sc = scale * K
    fx, gy = anchor
    p = frame.astype(np.float32) / 255
    p = np.dstack([p[..., :3] * p[..., 3:], p[..., 3:]])
    n = round(frame.shape[0] * sc)
    sm = cv2.resize(p, (n, n), interpolation=cv2.INTER_AREA)
    x0 = round(ROOT_X - fx * sc)
    y0 = round(ROOT_Y - gy * sc)
    cell = np.zeros((CELL_H, CELL_W, 4), np.float32)
    sx0, sy0 = max(0, -x0), max(0, -y0)
    dx0, dy0 = max(0, x0), max(0, y0)
    w = min(n - sx0, CELL_W - dx0)
    h = min(n - sy0, CELL_H - dy0)
    if w > 0 and h > 0:
        cell[dy0:dy0 + h, dx0:dx0 + w] = sm[sy0:sy0 + h, sx0:sx0 + w]
    al = cell[..., 3:]
    rgb = np.where(al > 1e-3, cell[..., :3] / np.maximum(al, 1e-3), 0)
    return (np.clip(np.dstack([rgb, al]), 0, 1) * 255).astype(np.uint8)


def to_atlas(src_x: float, src_y: float, sheet: str, anchor) -> tuple:
    """a point in a sheet's 512 px cell → atlas px of the hero cell"""
    sc = SHEETS[sheet][1] * K
    return round(ROOT_X + (src_x - anchor[0]) * sc, 1), round(ROOT_Y + (src_y - anchor[1]) * sc, 1)


def portrait(src: Path, out: Path):
    """temporary portrait: head + shoulders of the master reference (magenta keyed), dusk-teal backdrop"""
    a = np.array(Image.open(src).convert('RGB')).astype(np.int32)
    key = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) > 120
    rgba = np.dstack([a, np.where(key, 0, 255)]).astype(np.uint8)
    face = Image.fromarray(rgba).crop((760, 300, 1200, 740))
    bg = Image.new('RGBA', face.size, (14, 58, 62, 255))
    grad = Image.linear_gradient('L').resize(face.size).point(lambda v: int(v * 0.7))
    bg = Image.composite(Image.new('RGBA', face.size, (6, 12, 16, 255)), bg, grad)
    bg.alpha_composite(face)
    out.parent.mkdir(parents=True, exist_ok=True)
    bg.convert('RGB').resize((288, 288), Image.LANCZOS).save(out, 'WEBP', quality=92)


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Sylas')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    portraits = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
    hashes, frames = {}, {}
    for name, (file, scale, flash) in SHEETS.items():
        path = src / file
        hashes[file] = hashlib.sha256(path.read_bytes()).hexdigest()
        fr = erase_flash(cells(path), flash)
        frames[name] = (fr, scale, feet(fr[0]))
    atlas = np.zeros((CELL_H * len(ROWS), CELL_W * COLS, 4), np.uint8)
    meta = {}
    for row, (anim, sheet, picks) in enumerate(ROWS):
        fr, scale, anchor = frames[sheet]
        for i, idx in enumerate(picks):
            atlas[row * CELL_H:(row + 1) * CELL_H, i * CELL_W:(i + 1) * CELL_W] = to_cell(fr[idx], scale, anchor)
        meta[anim] = {'row': row, 'frames': len(picks), 'source': sheet, 'sourceFrames': picks}
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(out / 'hero-sylas.png', optimize=True)
    if (src / 'art/portrait.png').is_file():
        import sylas_art
        sylas_art.bake_ui(src / 'art', portraits.parent)
    else:
        portrait(src / 'reference/sylas_master_reference.png', portraits / 'sylas.webp')
    # crossbow tip (muzzle) on the release frames, atlas px (for FxDef.muzzle / anchors)
    tips = {}
    for key, sheet, idx in (('s1', 's1', 16), ('s2', 's2', 12), ('ult', 'ult', 17)):
        f = frames[sheet][0][idx]
        al = f[..., 3] > 100
        al[:, :300] = False                      # the crossbow is the front-most part of the body
        cols = np.nonzero(al.any(0))[0]
        tx = int(cols.max())
        ty = float(np.nonzero(al[:, tx - 6:tx + 1].any(1))[0].mean())
        tips[key] = to_atlas(tx, ty, sheet, frames[sheet][2])
    print(json.dumps({'cols': COLS, 'rows': meta, 'tips': tips, 'k': round(K, 5), 'sources': hashes}, indent=1))


if __name__ == '__main__':
    main()

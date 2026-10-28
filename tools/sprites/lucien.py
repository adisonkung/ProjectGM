"""Lucien Valthorne — The Black Saint (Healer: sacrifice healer / damage-redirect support) — sprite bake.

python3 tools/sprites/lucien.py [source dir] [sprite output] [portrait output]
Default source: assets/heroes/Lucien (user-supplied 2026-10-27 / 2026-10-28, lucien.zip + the earlier S1 sheets). Never
modifies the sources.

Sources: 8 × 7 (idle 8 × 4, run 8 × 2) cells of 512 px, RGBA (reading order):
  base/lu_idle.png             32 frames, one breathing loop
  base/lu_run.png              15 frames, one run cycle (two strides)
  base/lu_hurt.png             52 frames: stand → hit F12 → recoil F14–F33 → recover F34–F40 → stand
  base/lu_death.png            56 frames: stand → drops the staff F5 → sways → collapses F17–F23 → kneels → falls F40–F43
  skill/lu_normal_attack.png   56 frames: a slight staff push (staff head barely moves) — drawn 1.53 × larger
  skill/lucien_s1_sheet_{a,b}  56 frames (S1 Black Benediction): staff raised high F4–F14 → held → lowered F28–F41 —
                               junk backgrounds, cut by tools/sprites/lucien_s1_prep.py (clean_frames) — drawn smaller
  skill/lu_skil2.png           56 frames (S2 Martyr's Veil): staff raised F7–F17 → held F17–F33 → lowered F34–F46
  skill/lu_ult.png             56 frames (Ult Black Miracle): staff raised forward F10–F22 → held F22–F37 → lowered
                               F38–F53
Every sheet is mapped into idle space by its frame-0 body height (hair top → feet; idle 316 px), its frame-0 feet on
the idle feet, then the idle body is scaled to BODY_PX with the feet on the 260 × 170 cell root (130, 155).
The staff head (centroid of the top 40 px on the staff side) is tracked on every atlas frame → report
`staffHead[anim]` (atlas px) for the staff-following VFX (tools/sprites/lucien_vfx.py).
"""
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
import lucien_s1_prep  # noqa: E402

CELL_W, CELL_H, ROOT_X, ROOT_Y = 260, 170, 130, 155
BODY_PX = 78
IDLE_BODY = 316  # idle F0: hair top y 98 → feet y 414 (512 px cells)
K = BODY_PX / IDLE_BODY
SRC_CELL = 512

# sheet: (file or None = S1 cleaned frames, scale into idle space = idle body / sheet frame-0 body)
SHEETS = {
    'idle': ('base/lu_idle.png', 1.0),
    'run': ('base/lu_run.png', 1.0),
    'hurt': ('base/lu_hurt.png', 1.0),
    'death': ('base/lu_death.png', 1.0),
    'attack': ('skill/lu_normal_attack.png', 316 / 485),
    's1': (None, 316 / 258),
    's2': ('skill/lu_skil2.png', 316 / 257),
    'ult': ('skill/lu_ult.png', 316 / 351),
}
# atlas rows: (anim, sheet, source frame indices 0-based) — timing lives in sprites.ts
ROWS = [
    ('idle', 'idle', list(range(0, 32, 2))),                                                   # 16 · loop
    ('walk', 'run', list(range(15))),                                                          # 15 · one cycle
    ('hurt', 'hurt', [11, 12, 13, 14, 16, 18, 22, 27, 31, 34, 36, 38, 40]),                    # 13 · hit → recover
    ('attack', 'attack', list(range(0, 56, 3))),                                               # 19 · staff push
    ('die', 'death', [0, 2, 4, 5, 6, 8, 12, 16, 17, 18, 19, 20, 22, 24, 30, 38, 40, 41, 42, 43, 44, 46]),  # 22
    ('skill', 's1', list(range(2, 56, 2))),                                                    # 27 · S1 (1.2 s)
    ('skill2', 's2', list(range(0, 56, 2))),                                                   # 28 · S2 (1.8 s)
    # 26 · Ult (4.2 s): entry F0–F9 → raise F10–F22 → hold F24–F36 (near-static, every 3rd) → lower F38–F52 → stand
    #      (≤ 28 columns: the atlas stays under the 8192 px GPU texture limit)
    ('ult', 'ult', [0, 3, 6, 9] + list(range(10, 23, 2)) + list(range(24, 37, 3)) + list(range(38, 53, 2)) + [54, 55]),
]
COLS = max(len(r[2]) for r in ROWS)


def cells(path: Path) -> list:
    im = Image.open(path).convert('RGBA')
    cols = im.width // SRC_CELL
    out = []
    for i in range(cols * (im.height // SRC_CELL)):
        r, c = divmod(i, cols)
        f = np.array(im.crop((c * SRC_CELL, r * SRC_CELL, (c + 1) * SRC_CELL, (r + 1) * SRC_CELL)))
        if (f[..., 3] > 128).sum() >= 500:
            out.append(f)
    return out


def feet(frame: np.ndarray):
    """ground y + feet centre x of a standing frame (bottom 4 % of the opaque body)"""
    ys, xs = np.nonzero(frame[..., 3] > 128)
    g = ys.max()
    low = ys > g - 0.04 * (g - ys.min())
    return float(xs[low].mean()), float(g)


def staff_head(frame: np.ndarray):
    """centroid of the top 40 px of the staff side (sheet px) — the staff is held on his front side"""
    a = frame[..., 3] > 128
    ys, xs = np.nonzero(a)
    right = a.copy()
    right[:, :int(np.median(xs)) + 15] = False
    ry, rx = np.nonzero(right)
    if not len(ry):
        return None
    sel = ry < ry.min() + 40
    return float(rx[sel].mean()), float(ry[sel].mean())


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


def to_atlas(pt, scale: float, anchor) -> list:
    """a point in a sheet's 512 px cell → atlas px of the hero cell"""
    sc = scale * K
    return [round(ROOT_X + (pt[0] - anchor[0]) * sc, 1), round(ROOT_Y + (pt[1] - anchor[1]) * sc, 1)]


def portrait(src: Path, out: Path):
    """temporary portrait: head + shoulders of the master reference (magenta keyed), dark crimson backdrop"""
    a = np.array(Image.open(src).convert('RGB')).astype(np.int32)
    key = (np.minimum(a[..., 0], a[..., 2]) - a[..., 1]) > 120
    rgba = np.dstack([a, np.where(key, 0, 255)]).astype(np.uint8)
    face = Image.fromarray(rgba).crop((420, 40, 820, 440))
    bg = Image.new('RGBA', face.size, (58, 14, 20, 255))
    grad = Image.linear_gradient('L').resize(face.size).point(lambda v: int(v * 0.7))
    bg = Image.composite(Image.new('RGBA', face.size, (12, 8, 10, 255)), bg, grad)
    bg.alpha_composite(face)
    out.parent.mkdir(parents=True, exist_ok=True)
    bg.convert('RGB').resize((288, 288), Image.LANCZOS).save(out, 'WEBP', quality=92)


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Lucien')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    portraits = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
    hashes, frames = {}, {}
    for name, (file, scale) in SHEETS.items():
        if file is None:
            lucien_s1_prep.SRC = src
            for k in 'ab':
                p = src / f'skill/lucien_s1_sheet_{k}.png'
                hashes[str(p.relative_to(src))] = hashlib.sha256(p.read_bytes()).hexdigest()
            fr = [np.array(f) for f in lucien_s1_prep.clean_frames()]
        else:
            path = src / file
            hashes[file] = hashlib.sha256(path.read_bytes()).hexdigest()
            fr = cells(path)
        frames[name] = (fr, scale, feet(fr[0]))
    atlas = np.zeros((CELL_H * len(ROWS), CELL_W * COLS, 4), np.uint8)
    meta, heads = {}, {}
    for row, (anim, sheet, picks) in enumerate(ROWS):
        fr, scale, anchor = frames[sheet]
        hs = []
        for i, idx in enumerate(picks):
            atlas[row * CELL_H:(row + 1) * CELL_H, i * CELL_W:(i + 1) * CELL_W] = to_cell(fr[idx], scale, anchor)
            h = staff_head(fr[idx])
            hs.append(to_atlas(h, scale, anchor) if h else None)
        meta[anim] = {'row': row, 'frames': len(picks), 'source': sheet, 'sourceFrames': picks}
        heads[anim] = hs
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(out / 'hero-lucien.png', optimize=True)
    if (src / 'art/portrait.png').is_file():
        import lucien_art
        lucien_art.bake_ui(src / 'art', portraits.parent)
    else:
        portrait(src / 'reference/lucien_master_reference.png', portraits / 'lucien.webp')
    report = {'cols': COLS, 'rows': meta, 'k': round(K, 5), 'staffHead': heads, 'sources': hashes}
    Path(__file__).with_name('lucien_report.json').write_text(json.dumps(report, indent=1))
    print(json.dumps({'cols': COLS, 'rows': {k: v['frames'] for k, v in meta.items()}}, indent=1))


if __name__ == '__main__':
    main()

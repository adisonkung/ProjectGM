"""Mordrienne Vale (Mage — Control / Debuff) — Phase A sprite bake. Never modifies the source sheets.

python3 tools/sprites/mordrienne.py [source dir] [sprite output] [portrait output]
Default source: assets/heroes/Mordrienne (user-supplied sheets, 2026-10-26).

Sources (square-cell grids, reading order):
  base/mordrienne_idle.png       7 × 7 cells of 512 px, RGBA (49 frames, one breathing loop; F48 = F0)
  base/mordrienne_idle_alt.png   second idle variant (kept, unused)
  base/mordrienne_idle_v2.png    8 × 5 cells of 512 px, RGBA (36 frames, wand held forward) — the idle row since 2026-10-27
  base/mordrienne_hurt.png       8 × 7 cells of 512 px, RGBA (56 frames: stand → hit F15 → recoil → recover → stand)
  base/mordrienne_run.png        8 × 5 cells of 512 px, RGBA (33 frames, a 16-frame run cycle twice)
  base/mordrienne_death.png      7 × 7 cells of 512 px, RGBA (49 frames: stand → kneel → collapse → lie still)
  skill/mordrienne_s1_ashen_mark.jpg        8 × 5 cells of 1000 px, WHITE background JPEG (40 frames)
  skill/mordrienne_s2_cinderbind.jpg        8 × 7 cells of 1000 px, WHITE background JPEG (56 frames)
  skill/mordrienne_ult_house_of_ashes.png   8 × 7 cells of 1000 px, WHITE background RGB (56 frames, baked green
                                            wand trail / ground splash — kept as drawn)
White-background sheets are keyed with draeven.key_white (opaque body, soft edges / light trails unmixed from white).

Every sheet is mapped into the idle sheet's space with one scale (death measured with SIFT vs idle F0 = 1.696; the
skill / run sheets are drawn in a wider stance so SIFT has few inliers — scale chosen by comparing the head / body
against idle at the same ground line) and its frame-0 feet placed on the idle feet. The idle body (hair top → feet)
is then scaled to BODY_PX with the feet on the cell root — the game's 260 × 170 hero cell.

Provisional (user 2026-10-26, no dedicated sheet yet): basic attack = the point → release part of the S1 sheet.
idle (wand forward) and hurt come from their own sheets (user 2026-10-27).
"""
import hashlib
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from draeven import key_white  # noqa: E402

CELL_W, CELL_H, ROOT_X, ROOT_Y = 260, 170, 130, 155
BODY_PX = 78
IDLE_BODY = 488  # idle F0: hair top y 12 → feet y 500 (512 px cells)
K = BODY_PX / IDLE_BODY

# sheet: (file, grid columns, scale into idle space)
SHEETS = {
    'idle': ('base/mordrienne_idle.png', 7, 1.0),
    # user 2026-10-27: new idle (wand held forward) + dedicated hurt — drawn smaller (body 286 px in 512 cells) → 489 / 286
    'idle2': ('base/mordrienne_idle_v2.png', 8, 1.71),
    'hurt': ('base/mordrienne_hurt.png', 8, 1.71),
    'run': ('base/mordrienne_run.png', 8, 1.56),
    'death': ('base/mordrienne_death.png', 7, 1.696),
    's1': ('skill/mordrienne_s1_ashen_mark.jpg', 8, 1.5),
    's2': ('skill/mordrienne_s2_cinderbind.jpg', 8, 1.6),
    'ult': ('skill/mordrienne_ult_house_of_ashes.png', 8, 1.55),
}
# atlas rows (frame indices into each sheet's non-empty cells, reading order)
ROWS = [
    ('idle', 'idle2', list(range(0, 36, 2))),                                  # 18 · new idle (2026-10-27), loop
    ('walk', 'run', list(range(0, 16, 2))),                                    # 8 · one run cycle
    # 8 · new hurt sheet (2026-10-27): hit F15 → recoil F17–F25 → recover F33–F39 (standing)
    ('hurt', 'hurt', [15, 17, 19, 25, 33, 35, 37, 39]),
    ('attack', 's1', [8, 11, 12, 13, 14, 16, 23, 25, 27, 30]),                 # 10 · provisional: S1 point → release
    ('die', 'death', [9, 11, 12, 13, 14, 16, 20, 24, 25, 26, 27, 28, 30, 32]),  # 14
    # 17 · S1 Ashen Mark (Timeline Sync 2026-10-26): ready → aim / wand raised F11–F12 → thrust F13 = wand-release frame
    #      (the Hex Bolt leaves the tip) → hold → recover. The baked gold spark frames F14–F16 are skipped — the
    #      dedicated Deep Emerald VFX (CastCharge / HexBolt / HexMark) replace them
    ('skill', 's1', [0, 4, 8, 10, 11, 12, 13, 17, 18, 20, 22, 23, 24, 25, 26, 28, 32]),
    # 30 · S2 Cinderbind Hex: raise → STRIKE 1 F13 (thrust: place the hex) → hold → twirl at the chest F21–F27 (charge)
    #      → raise F28–F30 → STRIKE 2 F32 (activate) → hold → recover
    ('skill2', 's2', [0, 2, 4, 6, 8, 10, 11, 12, 13, 15, 17, 19, 20, 21, 22, 24, 26, 27, 28, 29, 30, 31, 32, 34, 36,
                      38, 40, 42, 44, 47]),
    # 31 · Ult House of Ashes: point → draw the circle with the wand (baked green trail) F5–F29 → raise to the sky
    #      F30–F33 (CHARGE HOLD at F33) → swing over F35–F39 → slam down F40–F43 → ground splash F44 → recover
    ('ult', 'ult', [0, 5, 6, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 30, 31, 32, 33, 35, 37, 39, 40, 41, 42, 43,
                    44, 45, 47, 50, 54]),
]
COLS = max(len(r[2]) for r in ROWS)


def cells(path: Path, cols: int) -> list:
    im = Image.open(path)
    keyed = im.mode in ('RGB', 'L') or path.suffix.lower() in ('.jpg', '.jpeg')
    im = im.convert('RGB' if keyed else 'RGBA')
    size = im.width // cols
    out = []
    for i in range(cols * (im.height // size)):
        r, c = divmod(i, cols)
        f = np.array(im.crop((c * size, r * size, c * size + size, r * size + size)))
        if keyed:
            f = key_white(f)
        if (f[..., 3] > 0).sum() >= 500:
            out.append(f)
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


def portrait(src: Path, out: Path):
    """temporary portrait: head + shoulders of the master reference (magenta keyed), deep emerald backdrop"""
    a = np.array(Image.open(src).convert('RGB')).astype(np.int32)
    key = (a[..., 0] > 150) & (a[..., 2] > 150) & (a[..., 1] < 120)
    rgba = np.dstack([a, np.where(key, 0, 255)]).astype(np.uint8)
    face = Image.fromarray(rgba).crop((820, 400, 1260, 840))
    bg = Image.new('RGBA', face.size, (16, 52, 36, 255))
    grad = Image.linear_gradient('L').resize(face.size).point(lambda v: int(v * 0.6))
    bg = Image.composite(Image.new('RGBA', face.size, (6, 14, 10, 255)), bg, grad)
    bg.alpha_composite(face)
    out.parent.mkdir(parents=True, exist_ok=True)
    bg.convert('RGB').resize((288, 288), Image.LANCZOS).save(out, 'WEBP', quality=92)


def hex_bolt(out: Path):
    """provisional basic-attack bolt (no dedicated asset yet), drawn procedurally in the Deep Emerald Curse palette:
    frames 0–3 = a spinning broken-hex diamond with an emerald glow and a black-ash core (flight), frame 4 = the impact
    burst (ring + shards). 48 × 48 per frame, pivot centre; the bolt points along +x (angle0 0)."""
    n, S = 5, 48
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) - (S - 1) / 2
    frames = []
    for k in range(n):
        rgba = np.zeros((S, S, 4), np.float32)
        if k < 4:
            ang = k * np.pi / 8
            u = xx * np.cos(ang) + yy * np.sin(ang)
            v = -xx * np.sin(ang) + yy * np.cos(ang)
            dia = np.abs(u) / 11 + np.abs(v) / 6           # diamond, long axis along the flight
            r = np.hypot(xx * 0.8, yy * 1.25)
            glow = np.clip(1 - r / 16, 0, 1) ** 1.6
            body = np.clip((1.0 - dia) * 4, 0, 1)
            core = np.clip((0.45 - dia) * 6, 0, 1)
            tail = np.clip(1 - np.hypot((xx + 12) / 12, yy / 3.2), 0, 1) * (xx < 0)
            a = np.clip(glow * 0.75 + body + tail * 0.6, 0, 1)
            col = (np.array([30, 190, 105])[None, None] * glow[..., None]
                   + np.array([120, 255, 170])[None, None] * body[..., None]
                   + np.array([60, 210, 120])[None, None] * tail[..., None])
            col = col * (1 - core[..., None]) + np.array([8, 22, 14])[None, None] * core[..., None]
        else:
            r = np.hypot(xx, yy)
            ring = np.clip(1 - np.abs(r - 15) / 3, 0, 1)
            th = np.arctan2(yy, xx)
            shards = np.clip(1 - np.abs(np.sin(th * 3)) * 8, 0, 1) * np.clip(1 - np.abs(r - 9) / 6, 0, 1)
            glow = np.clip(1 - r / 22, 0, 1) ** 2
            a = np.clip(ring + shards + glow * 0.6, 0, 1)
            col = (np.array([150, 255, 190])[None, None] * ring[..., None]
                   + np.array([40, 200, 110])[None, None] * (shards + glow)[..., None])
        rgba[..., :3] = np.clip(col / np.maximum(a[..., None], 1e-3), 0, 255)
        rgba[..., 3] = a * 255
        frames.append(rgba)
    Image.fromarray(np.hstack(frames).astype(np.uint8)).save(out, optimize=True)


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Mordrienne')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    portraits = Path(sys.argv[3] if len(sys.argv) > 3 else 'public/portraits')
    hashes, frames = {}, {}
    for name, (file, cols, scale) in SHEETS.items():
        path = src / file
        hashes[file] = hashlib.sha256(path.read_bytes()).hexdigest()
        fr = cells(path, cols)
        frames[name] = (fr, scale, feet(fr[0]))
    atlas = np.zeros((CELL_H * len(ROWS), CELL_W * COLS, 4), np.uint8)
    meta = {}
    for row, (anim, sheet, picks) in enumerate(ROWS):
        fr, scale, anchor = frames[sheet]
        for i, idx in enumerate(picks):
            atlas[row * CELL_H:(row + 1) * CELL_H, i * CELL_W:(i + 1) * CELL_W] = to_cell(fr[idx], scale, anchor)
        meta[anim] = {'row': row, 'frames': len(picks), 'source': sheet, 'sourceFrames': picks}
    out.mkdir(parents=True, exist_ok=True)
    Image.fromarray(atlas).save(out / 'hero-mordrienne.png', optimize=True)
    if (src / 'art/portrait.png').is_file():  # the user's painted UI art (2026-10-27) wins over the reference crop
        import mordrienne_art
        mordrienne_art.bake_ui(src / 'art', portraits.parent)
    else:
        portrait(src / 'reference/mordrienne_master_reference.png', portraits / 'mordrienne.webp')
    hex_bolt(out / 'fx-mordrienne-hex-bolt.png')
    body = atlas[:CELL_H, :CELL_W, 3] > 96
    ys = np.nonzero(body.any(1))[0]
    print(json.dumps({'cols': COLS, 'rows': len(ROWS), 'idleBody': int(ys.max() - ys.min() + 1), 'rows_meta': meta,
                      'sourceSha256': hashes}, indent=1))


if __name__ == '__main__':
    main()

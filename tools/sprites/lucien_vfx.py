"""Lucien Valthorne — The Black Saint: skill VFX bake (user 2026-10-28, lucien.zip + the earlier S1 StaffCross).

python3 tools/sprites/lucien_vfx.py [source dir] [sprite output]
Default source: assets/heroes/Lucien (never modified). Run after tools/sprites/lucien.py (reads lucien_report.json for
the staff-head track of every atlas frame).

Sources: vfx/*.png — magenta-keyed painted sheets, 5 × 2 grids (BurdenLink: 4 × 2), unmixed with
lucien_s1_prep.unmix (gold / white glow kept warm, dark smoke kept a warm dark). Every strip is baked at RES × atlas px
(FX scale 1 / (1.5 × RES)); a sheet keeps the artist's frame-to-frame motion (the cells share one crop box).

Strips (fx-lucien-*.png → sprites.ts FX `lu-*`):
  s1-cross     StaffCross on the staff head of every S1 clip frame (feet-anchored canvas, 45 ms = the clip): grows with
               the raise → pulses at the top → stays until the staff is planted → fades (lucien_s1_prep.seq / fade)
  s1-gain      BurdenGain on Lucien (impact)                 · s1-heal  TeamHealingWave, small, on the healed ally
  s2-source    LinkSource on the linked ally (CHARGE_START)  · s2-link  BurdenLink tether ally → Lucien (span)
  s2-absorb    BurdenAbsorb on Lucien (the link lands)
  ult-staff    StaffCharge on the raised staff head (CHARGE_START → lowering, 75 ms, staff-tracked)
  ult-aura     SacredAshAuraLoop under Lucien (CHARGE_START → release, replaces Ult_Charge — user 2026-10-28)
  ult-release  BurdenRelease on Lucien (release)
  ult-wave     ONE TeamHealingWave expanding from Lucien across the allied side (ring 6 cells at full size); the
               per-ally pulse reuses s1-heal (sprites.ts `lu-ult-halo`, delayed by the wave's arrival)
  atk-glow     StaffCharge f1–f4, small, on the attack staff head · fx-lucien-bolt  procedural dark-sacred bolt
Writes tools/sprites/lucien_vfx_report.json (w, h, frames, pivot, scale per strip).
"""
import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
import lucien_s1_prep as prep  # noqa: E402

RES = 2
ROOT = (130, 155)
FXS = 1.5
SCALE = round(1 / (FXS * RES), 6)


# ---------------------------------------------------------------- helpers
def grid(src: Path, name: str, cols=5, rows=2):
    """unmixed RGBA cells (reading order) + the raw RGB cells (for gem detection)"""
    raw = np.array(Image.open(src / f'vfx/{name}.png').convert('RGB')).astype(float)
    H, W = raw.shape[:2]
    rgba = prep.unmix(raw)
    out, rgb = [], []
    for r in range(rows):
        for c in range(cols):
            x0, y0 = int(round(c * W / cols)), int(round(r * H / rows))
            x1, y1 = int(round((c + 1) * W / cols)), int(round((r + 1) * H / rows))
            cell = rgba[y0:y1, x0:x1].copy()
            # 3 px edge feather: neighbouring frames never bleed in along the grid line
            e = np.ones(cell.shape[:2], np.float32)
            for i in range(3):
                f = (i + 1) / 4
                e[i, :] *= f; e[-1 - i, :] *= f; e[:, i] *= f; e[:, -1 - i] *= f
            cell[..., 3] = (cell[..., 3] * e).astype(np.uint8)
            out.append(cell)
            rgb.append(raw[y0:y1, x0:x1])
    h = min(c.shape[0] for c in out); w = min(c.shape[1] for c in out)
    return [c[:h, :w] for c in out], [c[:h, :w] for c in rgb]


def resize(cell: np.ndarray, f: float) -> np.ndarray:
    p = cell.astype(np.float32) / 255
    p = np.dstack([p[..., :3] * p[..., 3:], p[..., 3:]])
    w, h = max(1, round(cell.shape[1] * f)), max(1, round(cell.shape[0] * f))
    sm = cv2.resize(p, (w, h), interpolation=cv2.INTER_AREA)
    al = sm[..., 3:]
    rgb = np.where(al > 1e-3, sm[..., :3] / np.maximum(al, 1e-3), 0)
    return (np.clip(np.dstack([rgb, al]), 0, 1) * 255).astype(np.uint8)


def crop_union(cells, pad=4):
    a = np.zeros(cells[0].shape[:2], bool)
    for c in cells:
        a |= c[..., 3] > 6
    ys, xs = np.nonzero(a)
    y0, y1 = max(0, ys.min() - pad), min(a.shape[0], ys.max() + pad + 1)
    x0, x1 = max(0, xs.min() - pad), min(a.shape[1], xs.max() + pad + 1)
    return [c[y0:y1, x0:x1] for c in cells], (x0, y0)


def ground_pivot(cells):
    """the ground ring centre line: per frame the widest solid row in the lower half (the ring ellipse is the widest
    thing near the ground), median over the frames — the union of all frames is wide everywhere and put the pivot
    above the ring (art drawn below the feet, user 2026-10-28)"""
    H = cells[0].shape[0]
    lo = H // 2
    ys, xs = [], []
    for c in cells:
        a = c[lo:, :, 3] > 60
        rows = a.sum(1)
        if rows.max() < 20:
            continue
        y = int(np.argmax(rows))
        cols = np.nonzero(a[y])[0]
        ys.append(lo + y)
        xs.append((cols.min() + cols.max()) / 2)
    return float(np.median(xs)), float(np.median(ys))


def gem_of(rgb: np.ndarray, rgba: np.ndarray):
    """the red gem centre of a cross frame (fallback: the brightest blob centroid)"""
    red = (rgb[..., 0] > 170) & (rgb[..., 1] < 90) & (rgb[..., 2] < 110)
    lab, n = ndimage.label(red)
    if n:
        sizes = ndimage.sum(red, lab, range(1, n + 1))
        if sizes.max() >= 6:
            gy, gx = ndimage.center_of_mass(lab == int(np.argmax(sizes)) + 1)
            return float(gx), float(gy)
    lum = rgba[..., :3].astype(float).mean(-1) * (rgba[..., 3] / 255)
    m = lum > np.percentile(lum, 99.7)
    gy, gx = ndimage.center_of_mass(m)
    return float(gx), float(gy)


def faded(cell: np.ndarray, a: float) -> np.ndarray:
    out = cell.copy()
    out[..., 3] = (out[..., 3] * a).astype(np.uint8)
    return out


def save(out: Path, name: str, frames, meta: dict):
    Image.fromarray(np.hstack(frames), 'RGBA').save(out / f'fx-lucien-{name}.png', optimize=True)
    h, w = frames[0].shape[:2]
    return {'file': f'fx-lucien-{name}.png', 'frames': len(frames), 'w': w, 'h': h, 'scale': SCALE, **meta}


def sheet_strip(src, out, name, sheet, k, seq, *, cols=5, rows=2, alphas=None, pivot='ground'):
    """a grid sheet resampled to k atlas px per source px, played in `seq` (0-based cell indices)"""
    cells, _ = grid(src, sheet, cols, rows)
    cells, _ = crop_union(cells)
    cells = [resize(c, k * RES) for c in cells]
    frames = [faded(cells[i], alphas[j]) if alphas else cells[i] for j, i in enumerate(seq)]
    h, w = cells[0].shape[:2]
    if pivot == 'ground':
        px, py = ground_pivot(cells)
        pv = [round(px / w, 5), round(py / h, 5)]
    elif pivot == 'left':
        pv = [0.0, 0.5]
    else:
        pv = [0.5, 0.5]
    return save(out, name, frames, {'pivot': pv})


def staff_tracked(src, out, name, sheet, k, keys, heads, step_at):
    """the cross VFX with its gem on the staff head: keys = [(time s, cell index, alpha)], heads = atlas staff head per
    clip frame, step_at(t) = clip frame at time t. Canvas anchored on the hero root (feet) → follows the body."""
    cells, raws = grid(src, sheet)
    gems = [gem_of(r, c) for r, c in zip(raws, cells)]
    cells, (ox, oy) = crop_union(cells)
    f = k * RES
    cells = [resize(c, f) for c in cells]
    gems = [((g[0] - ox) * f, (g[1] - oy) * f) for g in gems]
    ch, cw = cells[0].shape[:2]
    pos = [heads[step_at(t)] for t, _, _ in keys]
    xs = [p[0] for p in pos]; ys = [p[1] for p in pos]
    left = (ROOT[0] - min(xs)) * RES + cw; right = (max(xs) - ROOT[0]) * RES + cw
    up = (ROOT[1] - min(ys)) * RES + ch; down = max(0.0, (max(ys) - ROOT[1]) * RES + ch)
    W, H = int(np.ceil(left + right)) + 2, int(np.ceil(up + down)) + 2
    rx, ry = int(np.ceil(left)) + 1, int(np.ceil(up)) + 1
    frames = []
    for (t, i, a), p in zip(keys, pos):
        canvas = np.zeros((H, W, 4), np.uint8)
        if i is not None:
            g = gems[i]
            x0 = int(round(rx + (p[0] - ROOT[0]) * RES - g[0])); y0 = int(round(ry + (p[1] - ROOT[1]) * RES - g[1]))
            canvas[y0:y0 + ch, x0:x0 + cw] = faded(cells[i], a)
        frames.append(canvas)
    # trim empty margins (keep the root inside)
    al = np.zeros((H, W), bool)
    for fr in frames:
        al |= fr[..., 3] > 0
    ys_, xs_ = np.nonzero(al)
    x0, x1 = min(xs_.min(), rx) - 2, max(xs_.max(), rx) + 3
    y0, y1 = min(ys_.min(), ry) - 2, max(ys_.max(), ry) + 3
    frames = [fr[y0:y1, x0:x1] for fr in frames]
    h, w = frames[0].shape[:2]
    return save(out, name, frames, {'pivot': [round((rx - x0) / w, 5), round((ry - y0) / h, 5)]})


def s1_cross(src, out, heads, picks):
    """StaffCross on every S1 clip frame (45 ms): the S1 prep's source-frame → VFX-frame map through the atlas picks"""
    prep.SRC = src
    cells, gems = prep.vfx_cells()
    k = prep.VFX_SCALE * (316 / 258) * (78 / 316)   # source VFX px → S1 clip cell px → atlas px
    f = k * RES
    raw = [np.array(c) for c in cells]
    mh = min(c.shape[0] for c in raw); mw = min(c.shape[1] for c in raw)
    arr = [resize(c[:mh, :mw], f) for c in raw]
    gm = [(g[0] * f, g[1] * f) for g in gems]
    ch, cw = arr[0].shape[:2]
    xs = [h[0] for h in heads]; ys = [h[1] for h in heads]
    left = (ROOT[0] - min(xs)) * RES + cw; right = (max(xs) - ROOT[0]) * RES + cw
    up = (ROOT[1] - min(ys)) * RES + ch; down = max(0.0, (max(ys) - ROOT[1]) * RES + ch)
    W, H = int(np.ceil(left + right)) + 2, int(np.ceil(up + down)) + 2
    rx, ry = int(np.ceil(left)) + 1, int(np.ceil(up)) + 1
    frames = []
    for j, s in enumerate(picks):
        canvas = np.zeros((H, W, 4), np.uint8)
        v = prep.seq[s]
        if v is not None:
            a = prep.fade.get(s, 1.0)
            p = heads[j]
            x0 = int(round(rx + (p[0] - ROOT[0]) * RES - gm[v][0])); y0 = int(round(ry + (p[1] - ROOT[1]) * RES - gm[v][1]))
            canvas[y0:y0 + ch, x0:x0 + cw] = faded(arr[v], a)
        frames.append(canvas)
    al = np.zeros((H, W), bool)
    for fr in frames:
        al |= fr[..., 3] > 0
    ys_, xs_ = np.nonzero(al)
    x0, x1 = min(xs_.min(), rx) - 2, max(xs_.max(), rx) + 3
    y0, y1 = min(ys_.min(), ry) - 2, max(ys_.max(), ry) + 3
    frames = [fr[y0:y1, x0:x1] for fr in frames]
    h, w = frames[0].shape[:2]
    first = next(i for i, s in enumerate(picks) if prep.seq[s] is not None)
    return save(out, 's1-cross', frames, {'pivot': [round((rx - x0) / w, 5), round((ry - y0) / h, 5)],
                                          'firstVisible': first})


def bolt(out: Path):
    """procedural dark-sacred bolt (2 × atlas px): gold-white core, dark ash trail, gold motes; last frame = burst"""
    W, H = 72, 40
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    rng = np.random.default_rng(15)
    frames = []
    for i in range(5):
        img = np.zeros((H, W, 4), np.float32)

        def put(rgb, a):
            nonlocal img
            a = np.clip(a, 0, 1)[..., None]
            img[..., :3] = img[..., :3] * (1 - a) + np.array(rgb, np.float32) * a
            img[..., 3:] = np.maximum(img[..., 3:], a)

        cx, cy = W - 18, H / 2
        if i < 4:
            ph = i * 0.9
            # dark ash trail (behind = left), wavy
            for s in range(26):
                tx = cx - 6 - s * 1.7
                ty = cy + np.sin(ph + s * 0.45) * (1 + s * 0.12)
                r = 2.2 + s * 0.22
                d = ((xx - tx) ** 2 + (yy - ty) ** 2) / r ** 2
                put((44, 30, 34), np.exp(-d) * 0.75 * (1 - s / 28))
            # gold glow + white core
            d = ((xx - cx) / 9) ** 2 + ((yy - cy) / 6.5) ** 2
            put((255, 196, 92), np.exp(-d * 1.4) * 0.9)
            d = ((xx - cx) / 4.2) ** 2 + ((yy - cy) / 3.2) ** 2
            put((255, 248, 226), np.exp(-d * 2.2))
            # cross glint (sacred)
            put((255, 236, 180), np.exp(-((yy - cy) ** 2) / 0.8 - ((xx - cx) ** 2) / 60) * (0.7 + 0.2 * (i % 2)))
            put((255, 236, 180), np.exp(-((xx - cx) ** 2) / 0.8 - ((yy - cy) ** 2) / 26) * 0.6)
            for _ in range(5):
                mx, my = cx - rng.uniform(6, 40), cy + rng.uniform(-8, 8)
                put((255, 214, 120), np.exp(-((xx - mx) ** 2 + (yy - my) ** 2) / 0.9) * rng.uniform(0.5, 0.9))
        else:
            d = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
            put((40, 28, 32), np.exp(-((d - 13) ** 2) / 10) * 0.7)
            put((255, 200, 110), np.exp(-((d - 9) ** 2) / 4) * 0.9)
            put((255, 250, 232), np.exp(-(d ** 2) / 14))
            for _ in range(10):
                an = rng.uniform(0, 2 * np.pi); rr = rng.uniform(11, 17)
                mx, my = cx + np.cos(an) * rr, cy + np.sin(an) * rr * 0.9
                put((255, 220, 140), np.exp(-((xx - mx) ** 2 + (yy - my) ** 2) / 1.2) * 0.85)
        frames.append((np.clip(img, 0, 1) * 255).astype(np.uint8))
    Image.fromarray(np.hstack(frames), 'RGBA').save(out / 'fx-lucien-bolt.png', optimize=True)
    return {'file': 'fx-lucien-bolt.png', 'frames': 5, 'w': W, 'h': H, 'scale': round(1 / 1.8, 6)}   # ×1.44 the 2 × bake: a readable bolt


def team_wave(src, out, name, sheet, *, width_cells=6.0, sy_dome=0.55, sy_ring=2.1, grow_frames=6,
              seq=(0, 1, 2, 3, 4, 5, 5, 6, 7, 8, 9, 9), alphas=None, start=0.18):
    """ONE team-heal wave from the caster's feet: the TeamHealingWave frames played in `seq` while the whole wave
    grows linearly from `start` to full size over `grow_frames` frames, then holds full size while it fades.
    Full size: the ground ring spans `width_cells` board cells. Ground perspective: the ring band (below the ring
    top) is stretched vertically `sy_ring` × the horizontal scale so it reaches the lanes above / below; the dome
    above it is squashed (`sy_dome`) so the wave stays low over the formation. Returns the strip meta + the growth
    (radius in cells at frame 0, cells/s) for the per-ally pulses."""
    cells, _ = grid(src, sheet)
    # ring geometry from the first frame (the bare ground ring): its top edge (the first wide row), its bottom edge,
    # centre = the pivot on the caster's feet
    f0 = cells[0][..., 3] > 60
    rows = f0.sum(1)
    top = int(np.nonzero(rows > 60)[0].min())
    bottom = int(np.nonzero(rows > 30)[0].max())
    cols = np.nonzero(f0[top - 3:bottom + 3].any(0))[0]
    ring_w = float(cols.max() - cols.min())
    px, py = float(cols.min() + cols.max()) / 2, (top + bottom) / 2
    split = float(top - 3)                               # top of the ring band
    sx = width_cells * 80 * RES / ring_w                 # output px per source px at full size
    H0, W0 = cells[0].shape[:2]
    left, right = px * sx, (W0 - px) * sx
    up = (split - 0) * sx * sy_dome + (py - split) * sx * sy_ring
    down = (H0 - py) * sx * sy_ring
    Wc, Hc = int(np.ceil(left + right)) + 2, int(np.ceil(up + down)) + 2
    cx, cy = left + 1, up + 1
    yy, xx = np.mgrid[0:Hc, 0:Wc].astype(np.float32)
    frames = []
    for j, i in enumerate(seq):
        e = start + (1 - start) * min(1.0, j / grow_frames)
        c = cells[i].astype(np.float32) / 255
        pm = np.dstack([c[..., :3] * c[..., 3:], c[..., 3:]])
        mx = px + (xx - cx) / (sx * e)
        dy = yy - cy
        ds = (split - py) * sx * sy_ring * e              # the ring top in output px (negative)
        my = np.where(dy >= ds, py + dy / (sx * sy_ring * e), split + (dy - ds) / (sx * sy_dome * e))
        # downscaling: blur the source by the reduction so the remap does not alias
        k = 1 / max(1e-3, min(sx * e, sx * sy_dome * e))
        src_im = cv2.GaussianBlur(pm, (0, 0), 0.5 * k) if k > 1.2 else pm
        r = cv2.remap(src_im, mx.astype(np.float32), my.astype(np.float32), cv2.INTER_LINEAR,
                      borderMode=cv2.BORDER_CONSTANT, borderValue=0)
        al = r[..., 3:] * (alphas[j] if alphas else 1.0)
        rgb = np.where(r[..., 3:] > 1e-3, r[..., :3] / np.maximum(r[..., 3:], 1e-3), 0)
        frames.append((np.clip(np.dstack([rgb, al]), 0, 1) * 255).astype(np.uint8))
    # trim (keep the pivot inside)
    al = np.zeros((Hc, Wc), bool)
    for f in frames:
        al |= f[..., 3] > 2
    ys_, xs_ = np.nonzero(al)
    x0, x1 = min(xs_.min(), int(cx)) - 2, max(xs_.max(), int(cx)) + 3
    y0, y1 = min(ys_.min(), int(cy)) - 2, max(ys_.max(), int(cy)) + 3
    frames = [f[max(0, y0):y1, max(0, x0):x1] for f in frames]
    x0, y0 = max(0, x0), max(0, y0)
    h, w = frames[0].shape[:2]
    meta = save(out, name, frames, {'pivot': [round((cx - x0) / w, 5), round((cy - y0) / h, 5)]})
    meta['ringCells'] = [round(start * width_cells / 2, 3), width_cells / 2]   # radius frame 0 → full
    meta['growFrames'] = grow_frames
    return meta


# ---------------------------------------------------------------- clip timing (= sprites.ts 'hero-lucien.png')
ULT_STEPS = [100] * 4 + [86] * 7 + [260] * 5 + [100] * 8 + [250, 250]
ULT_CHARGE_START = sum(ULT_STEPS[:4]) / 1000      # 0.40 s, the raise begins
ULT_PEAK = sum(ULT_STEPS[:11]) / 1000             # 1.002 s, staff up
ULT_RELEASE = sum(ULT_STEPS[:16]) / 1000          # 2.302 s, first lowering frame = DAMAGE


def ult_step_at(t: float) -> int:
    acc = 0.0
    for i, s in enumerate(ULT_STEPS):
        acc += s / 1000
        if t < acc - 1e-9:
            return i
    return len(ULT_STEPS) - 1


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'assets/heroes/Lucien')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    rep = json.loads(Path(__file__).with_name('lucien_report.json').read_text())
    heads = rep['staffHead']
    R = {}
    # S1 Black Benediction
    R['s1-cross'] = s1_cross(src, out, heads['skill'], rep['rows']['skill']['sourceFrames'])
    R['s1-gain'] = sheet_strip(src, out, 's1-gain', 'Lucien_S1_BurdenGain_VFX', 0.3, list(range(10)))
    R['s1-heal'] = sheet_strip(src, out, 's1-heal', 'Lucien_ULT_TeamHealingWave_VFX', 0.16, list(range(10)))
    # S2 Martyr's Veil: source + tether grow f1–f4, breathe f4/f5 (f5/f6 for the source), release f6–f8
    R['s2-source'] = sheet_strip(src, out, 's2-source', 'Lucien_S2_LinkSource_VFX', 0.28,
                                 [0, 1, 2, 3, 4, 5, 4, 5, 4, 5, 6, 7], cols=4)
    R['s2-link'] = sheet_strip(src, out, 's2-link', 'Lucien_S2_BurdenLink_VFX', 0.17,
                               [0, 1, 2, 3, 4, 3, 4, 3, 4, 5, 6, 7], cols=4, pivot='left')
    R['s2-absorb'] = sheet_strip(src, out, 's2-absorb', 'Lucien_S2_BurdenAbsorb_VFX', 0.3, list(range(10)))
    # Ult Black Miracle — StaffCharge on the staff head, 75 ms keys from CHARGE_START
    MS = 0.075
    keys, t = [], ULT_CHARGE_START
    n_grow = round((ULT_PEAK - ULT_CHARGE_START) / MS)
    for j in range(n_grow):
        keys.append((t, min(4, int(j / max(1, n_grow - 1) * 4 + 0.5)), 1.0)); t += MS
    loop = [4, 3]
    j = 0
    while t < ULT_RELEASE - 1e-6:
        keys.append((t, loop[(j // 2) % 2], 1.0)); t += MS; j += 1
    for i, a in [(5, 1.0), (5, 1.0), (6, 1.0), (7, 1.0), (8, 0.9), (9, 0.7), (9, 0.4)]:
        keys.append((t, i, a)); t += MS
    R['ult-staff'] = staff_tracked(src, out, 'ult-staff', 'Lucien_ULT_StaffCharge_VFX', 0.17, keys, heads['ult'], ult_step_at)
    R['ult-staff']['frameMs'] = MS * 1000
    # Sacred ash aura under him from CHARGE_START (user 2026-10-28: replaces Ult_Charge): build f1–f5 to the staff
    # peak, breathe f4/f5 through the hold, dissolve f6–f10 from the release
    nb = round((ULT_RELEASE - ULT_PEAK) / 0.12)
    R['ult-aura'] = sheet_strip(src, out, 'ult-aura', 'Lucien_ULT_SacredAshAuraLoop_VFX', 0.36,
                                [0, 1, 2, 3, 4] + [3 + (j + 1) % 2 for j in range(nb)] + [5, 6, 7, 8, 9])
    R['ult-aura']['frameMs'] = 120
    R['ult-release'] = sheet_strip(src, out, 'ult-release', 'Lucien_ULT_BurdenRelease_VFX', 0.38, list(range(10)))
    # ONE team-heal wave expanding from Lucien over the allied side (user 2026-10-28) + a small pulse per ally
    R['ult-wave'] = team_wave(src, out, 'ult-wave', 'Lucien_ULT_TeamHealingWave_VFX',
                              alphas=[1, 1, 1, 1, 0.92, 0.88, 0.85, 0.85, 0.8, 0.72, 0.55, 0.3])
    R['ult-wave']['frameMs'] = 70
    # attack: a small StaffCharge glint on the (nearly still) staff head
    ah = heads['attack']
    mean = [sum(p[0] for p in ah[2:9]) / 7, sum(p[1] for p in ah[2:9]) / 7]
    akeys = [(0.0, i, a) for i, a in [(0, 1), (1, 1), (2, 1), (3, 1), (3, 1), (2, 0.8)]]
    R['atk-glow'] = staff_tracked(src, out, 'atk-glow', 'Lucien_ULT_StaffCharge_VFX', 0.09, akeys, [mean], lambda t: 0)
    R['atk-glow']['head'] = [round(v, 1) for v in mean]
    R['bolt'] = bolt(out)
    R['anchor'] = {'muzzleAtlas': [round(v, 1) for v in ah[8]]}
    Path(__file__).with_name('lucien_vfx_report.json').write_text(json.dumps(R, indent=1))
    for k_, v in R.items():
        print(k_, {kk: vv for kk, vv in v.items() if kk in ('frames', 'w', 'h', 'pivot', 'frameMs')} if 'w' in v else v)


if __name__ == '__main__':
    main()

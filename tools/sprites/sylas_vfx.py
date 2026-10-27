"""Sylas Veyrn — VFX bake (user 2026-10-27, hero_sylas.zip). Never modifies the source PNGs.

python3 tools/sprites/sylas_vfx.py [source dir] [out dir] [--preview DIR]
Sources: assets/heroes/Sylas/vfx/Sylas_*_VFX.png — 8 painted frames in one row on a magenta key, Dusk Teal +
Shadow Black + Cold Cyan. Keyed by unmixing the magenta (soft glow edges keep their alpha), the magenta spill pulled
back to the teal / black palette (red never above green, blue ≤ green + a little). Frames are cut by connected pieces
(each piece goes to the nearest of 8 frame centres — a 1-D k-means of the alpha mass per column, the frames grow
unevenly), then every frame is re-centred on its own pivot:
  'centre'  bbox centre (rings, sigils, bursts, auras)          'ground'  bbox centre x, lowest row (ground bursts)
  'tip'     the arrow / bolt point at the frame centre (projectiles: the engine draws a bolt centred on its path)
and baked at 2 × its board size (FxDef scale 1 / (2 · FX_SCALE) = 1/3 for FX, 1 / (2 · PROJECTILE_SCALE) = 1/2.6
for projectiles), so at DPR 2 one baked pixel ≈ one device pixel.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

N = 8
SRC = Path('assets/heroes/Sylas/vfx')
OUT = Path('public/sprites')

# out file: (source, pivot mode, board size of the largest frame in atlas px (width; bolts: length), frame order)
BAKE = {
    'fx-sylas-s1-charge.png': ('Sylas_S1_AimCharge_VFX.png', 'centre', 34, None),
    # projectile: f2 … f6 grow in flight (5 flight frames) · last frame = f8 (the bolt bursting into motes = impact)
    'fx-sylas-s1-bolt.png': ('Sylas_S1_DuskBolt_VFX.png', 'tip', 58, [1, 2, 3, 4, 5, 7]),
    'fx-sylas-bolt.png': ('Sylas_S1_DuskBolt_VFX.png', 'tip', 38, [1, 2, 3, 4, 7]),           # basic attack
    'fx-sylas-s1-mark-in.png': ('Sylas_S1_DuskMark_VFX.png', 'centre', 44, [0, 1, 2, 3, 4]),
    'fx-sylas-s1-mark.png': ('Sylas_S1_DuskMark_VFX.png', 'centre', 44, [5, 6, 7, 6]),
    'fx-sylas-s2-muzzle.png': ('Sylas_S2_MuzzleFlash_VFX.png', 'centre', 40, None),
    'fx-sylas-s2-bolt.png': ('Sylas_S2_RapidBolt_VFX.png', 'tip', 46, [0, 1, 2, 3, 4, 7]),
    'fx-sylas-s2-final.png': ('Sylas_S2_FinalPiercingShot_VFX.png', 'tip', 82, [1, 2, 3, 4, 5, 7]),
    'fx-sylas-s2-burst.png': ('Sylas_S2_MarkedBurst_VFX.png', 'ground', 78, None),
    # lock on f1–f5, pulse f4 ↔ f5 through the charge (≈ 1.35 s), dissolve f6–f8 as the bolt lands
    'fx-sylas-ult-lock.png': ('Sylas_ULT_TargetLock_VFX.png', 'centre', 60, [0, 1, 2, 3, 4] + [3, 4] * 9 + [5, 6, 7]),
    'fx-sylas-ult-charge.png': ('Sylas_ULT_CrossbowCharge_VFX.png', 'centre', 42, None),
    'fx-sylas-ult-aura.png': ('Sylas_ULT_ChargeAuraLoop_VFX.png', 'ground', 104, None),
    # 7 frames only in this sheet (growing as it flies)
    'fx-sylas-ult-bolt.png': ('Sylas_ULT_ExecutionBolt_VFX.png', 'tip', 110, [0, 1, 2, 3, 4, 5, 6, 6]),
    'fx-sylas-ult-impact.png': ('Sylas_ULT_ImpactBurst_VFX.png', 'centre', 118, None),
    'fx-sylas-ult-marked.png': ('Sylas_ULT_MarkedExecution_VFX.png', 'centre', 80, None),
}


COUNT = {'Sylas_ULT_ExecutionBolt_VFX.png': 7}
# frame centres read off the sheets (source px) where long flare lines join neighbouring frames: cut at the
# least-alpha column between two centres
CENTRES = {
    'Sylas_S2_MarkedBurst_VFX.png': [104, 326, 576, 880, 1195, 1488, 1759, 2031],
    'Sylas_ULT_TargetLock_VFX.png': [109, 315, 560, 825, 1136, 1451, 1738, 2031],
    'Sylas_ULT_MarkedExecution_VFX.png': [130, 421, 727, 1036, 1397, 1756, 2077, 2370],
}


def unmix(rgb: np.ndarray) -> np.ndarray:
    rgb = rgb.astype(float)
    bg = np.median(np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3),
                                   rgb[:, :8].reshape(-1, 3), rgb[:, -8:].reshape(-1, 3)]), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = np.clip(1 - (np.minimum(r, b) - g) / (min(bg[0], bg[2]) - bg[1]), 0, 1)
    al = np.where(al < 0.08, 0, al)
    al[:4], al[-4:], al[:, :4], al[:, -4:] = 0, 0, 0, 0          # sheet-border artefacts
    lab, n = ndimage.label(al > 0.03)                              # specks of key noise
    if n:
        sz = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
        al[np.isin(lab, np.nonzero(sz < 6)[0] + 1)] = 0
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    # magenta spill on soft edges: teal / cyan / black never carry more red than green, blue ≤ green + a little
    col[..., 0] = np.minimum(col[..., 0], col[..., 1] * 0.8 + 18)
    col[..., 2] = np.minimum(col[..., 2], col[..., 1] * 1.15 + 30)
    return np.dstack([col, al * 255])


def frame_centres(al: np.ndarray, n: int = N) -> np.ndarray:
    w = al.shape[1]
    mass = (al > 20).sum(0).astype(float)
    xs = np.arange(w, dtype=float)
    c = (np.arange(n) + 0.5) * w / n
    for _ in range(80):
        lab = np.argmin(np.abs(xs[:, None] - c[None]), 1)
        for k in range(n):
            m = mass[lab == k]
            if m.sum() > 0:
                c[k] = (xs[lab == k] * m).sum() / m.sum()
    return np.sort(c)


def split_at(im: np.ndarray, cs) -> list:
    mass = im[..., 3].sum(0)
    bounds = [0]
    for a, b in zip(cs[:-1], cs[1:]):
        lo, hi = int(a + 0.3 * (b - a)), int(b - 0.3 * (b - a))
        bounds.append(lo + int(np.argmin(mass[lo:hi + 1])))
    bounds.append(im.shape[1])
    out = []
    for k in range(len(cs)):
        f = np.zeros_like(im)
        f[:, bounds[k]:bounds[k + 1]] = im[:, bounds[k]:bounds[k + 1]]
        out.append(f)
    return out


def split(im: np.ndarray, n: int = N) -> list:
    """frames = runs of drawn columns: separated runs → frames (closest runs merged while there are too many — stray
    sparks), touching frames → the widest run is cut at its least-alpha column until there are n"""
    al = im[..., 3]
    mass = (al > 20).sum(0)
    on = mass > 0
    runs, x = [], 0
    while x < len(on):
        if on[x]:
            st = x
            while x < len(on) and on[x]:
                x += 1
            runs.append([st, x])
        x += 1
    while len(runs) > n:
        gaps = [runs[i + 1][0] - runs[i][1] for i in range(len(runs) - 1)]
        i = int(np.argmin(gaps))
        runs[i:i + 2] = [[runs[i][0], runs[i + 1][1]]]
    while len(runs) < n:
        i = int(np.argmax([b - a for a, b in runs]))
        a, b = runs[i]
        lo, hi = a + int(0.25 * (b - a)), b - int(0.25 * (b - a))
        cut = lo + int(np.argmin(mass[lo:hi]))
        runs[i:i + 1] = [[a, cut], [cut, b]]
    bounds = [0] + [(runs[i][1] + runs[i + 1][0]) // 2 for i in range(n - 1)] + [al.shape[1]]
    frames = []
    for k in range(n):
        f = np.zeros_like(im)
        f[:, bounds[k]:bounds[k + 1]] = im[:, bounds[k]:bounds[k + 1]]
        frames.append(f)
    return frames


def pivot(f: np.ndarray, mode: str):
    ys, xs = np.nonzero(f[..., 3] > 24)
    if mode == 'tip':
        tx = xs.max()
        row = np.nonzero(f[:, max(0, tx - 3):tx + 1, 3].max(1) > 24)[0]
        return float(tx), float(row.mean())
    if mode == 'ground':
        return (xs.min() + xs.max()) / 2, float(ys.max())
    return (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2


def extent(f, px, py):
    ys, xs = np.nonzero(f[..., 3] > 8)
    return px - xs.min(), xs.max() + 1 - px, py - ys.min(), ys.max() + 1 - py


def rescale(f: np.ndarray, r: float) -> np.ndarray:
    pm = np.dstack([f[..., :3] * f[..., 3:] / 255, f[..., 3]])
    H, W = f.shape[:2]
    nw, nh = max(1, round(W * r)), max(1, round(H * r))
    ch = [np.asarray(Image.fromarray(pm[..., c].astype(np.float32)).resize((nw, nh), Image.LANCZOS)) for c in range(4)]
    a = np.clip(ch[3], 0, 255)
    rgb = np.stack(ch[:3], -1) / np.maximum(a[..., None] / 255, 1e-3)
    return np.dstack([np.clip(rgb, 0, 255), a])


def bake(name, src, mode, size_px, order, out: Path):
    im = unmix(np.array(Image.open(src).convert('RGB')))
    name_ = Path(src).name
    frames = split_at(im, CENTRES[name_]) if name_ in CENTRES else split(im, COUNT.get(name_, N))
    piv = [pivot(f, mode) for f in frames]
    # the board size refers to the widest frame (bolts: the longest)
    widest = max(np.ptp(np.nonzero(f[..., 3] > 24)[1]) + 1 for f in frames)
    r = 2 * size_px / widest
    picks = order if order is not None else list(range(len(frames)))
    # common canvas around the pivot (tips: the pivot in the middle so the bolt rotates about its point)
    L = R = U = D = 0
    for k in picks:
        l_, r_, u_, d_ = extent(frames[k], *piv[k])
        L, R, U, D = max(L, l_), max(R, r_), max(U, u_), max(D, d_)
    if mode in ('tip', 'centre'):
        L = R = max(L, R)
    if mode == 'centre':
        U = D = max(U, D)
    W, H = int(np.ceil((L + R) * r)) + 4, int(np.ceil((U + D) * r)) + 4
    cells = []
    for k in picks:
        f = frames[k]
        px, py = piv[k]
        s = rescale(f, r)
        c = np.zeros((H, W, 4), np.float32)
        x0, y0 = int(round(2 + L * r - px * r)), int(round(2 + U * r - py * r))
        sx0, sy0 = max(0, -x0), max(0, -y0)
        w = min(s.shape[1] - sx0, W - max(0, x0))
        h = min(s.shape[0] - sy0, H - max(0, y0))
        c[max(0, y0):max(0, y0) + h, max(0, x0):max(0, x0) + w] = s[sy0:sy0 + h, sx0:sx0 + w]
        cells.append(c)
    strip = np.concatenate(cells, 1)
    Image.fromarray(np.clip(strip, 0, 255).astype(np.uint8), 'RGBA').save(out / name, optimize=True)
    pv = [round((2 + L * r) / W, 6), round((2 + U * r) / H, 6)]
    return {'frames': len(picks), 'w': W, 'h': H, 'pivot': pv, 'bake': round(r, 4), 'sizePx': size_px}


def main():
    argv = sys.argv[1:]
    src = Path(argv[0]) if argv and not argv[0].startswith('--') else SRC
    out = Path(argv[1]) if len(argv) > 1 and not argv[1].startswith('--') else OUT
    out.mkdir(parents=True, exist_ok=True)
    rep = {}
    for name, (file, mode, size, order) in BAKE.items():
        rep[name] = bake(name, src / file, mode, size, order, out)
    print(json.dumps(rep, indent=1))
    if '--preview' in argv:
        d = Path(argv[argv.index('--preview') + 1])
        d.mkdir(parents=True, exist_ok=True)
        for name, m in rep.items():
            im = Image.open(out / name)
            bg = Image.new('RGBA', im.size, (40, 46, 58, 255))
            bg.alpha_composite(im)
            dr = __import__('PIL.ImageDraw', fromlist=['ImageDraw']).Draw(bg)
            for k in range(m['frames']):
                x = k * m['w'] + m['pivot'][0] * m['w']
                y = m['pivot'][1] * m['h']
                dr.line([(x - 4, y), (x + 4, y)], fill=(255, 60, 60, 255))
                dr.line([(x, y - 4), (x, y + 4)], fill=(255, 60, 60, 255))
            bg.save(d / name)


if __name__ == '__main__':
    main()

import numpy as np
from PIL import Image
from rows import bands, NAMES

LABEL_END = {  # per-row label right edge (x) — rows with long labels need more
    'knight': {n: 148 for n in NAMES},
    'berserk': {**{n: 100 for n in NAMES[:4]}, **{n: 182 for n in NAMES[4:]}},
    'plague': {n: 132 for n in NAMES},
    'reaper': {n: 160 for n in NAMES},
    'necro': {n: 192 for n in NAMES},
}

def runs(v, minw=1):
    r, s = [], None
    for i, x in enumerate(v):
        if x and s is None:
            s = i
        if not x and s is not None:
            if i - s >= minw:
                r.append((s, i))
            s = None
    if s is not None:
        r.append((s, len(v)))
    return r

def fit_grid(prof, x0, spacing, n=8):
    xs = np.arange(len(prof))
    w = prof.astype(float)
    best = None
    for sp in np.linspace(spacing * 0.93, spacing * 1.07, 15):
        for off in np.arange(x0, x0 + sp, 2.0):
            c = off + sp * np.arange(n)
            if c[-1] > len(prof) + sp * 0.3:
                continue
            d = np.min(np.abs(xs[:, None] - c[None, :]), axis=1)
            cost = (w * d).sum()
            if best is None or cost < best[0]:
                best = (cost, c)
    return [int(round(v)) for v in best[1]]

SPACING = {'knight': 155, 'berserk': 136, 'plague': 134.5, 'reaper': 173, 'necro': 145.5}

def centres(h, spacing=None):
    spacing = spacing or SPACING[h]
    b, _ = bands(h)
    A = np.array(Image.open(f'{h}.png'))[..., 3] >= 150
    out = {}
    for n in NAMES:
        y0, y1 = b[n]
        lx = LABEL_END[h][n]
        prof = A[y0:y1].sum(0).astype(float)
        prof[:lx] = 0
        sp = spacing or (A.shape[1] - lx) / 8
        # exactly 8 separate figures → use their real centres (grids are not perfectly even)
        rr = runs(prof > 2, minw=5)
        if len(rr) == 8:
            out[n] = [int((a + b) / 2) for a, b in rr]
        else:
            out[n] = fit_grid(prof, lx, sp)
    return out

if __name__ == '__main__':
    import sys
    for h in sys.argv[1:]:
        c = centres(h)
        print(h)
        for k, v in c.items():
            print('  ', k, v)

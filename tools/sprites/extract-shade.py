"""Extract the hooded rogue sheets into game-ready sprite sheets.

hero-shade.png   9 cols x 8 rows, cell 132x100, feet baseline y=86, centre x=66, facing right
                 rows (same as source): idle, walk, hurt, die, attack, skill(teleport), skill2(smoke dash), ult(phantom)
fx-shade-{teleport,smoke,phantom}.png   8 frames each
Source sheets have real alpha: labels and haze (alpha < 50 / < 30) are removed.
"""
from PIL import Image
import numpy as np
from scipy import ndimage

CHAR_SRC, FX_SRC = 'e78ff294.png', '0ddadf00.png'
SCALE = 0.65
CELL_W, CELL_H, BASE_Y, CX = 132, 100, 86, 66

# ---------------------------------------------------------------- characters
A = np.array(Image.open(CHAR_SRC).convert('RGBA'))
ROWS = [(20, 134), (145, 262), (272, 392), (401, 516), (529, 649), (663, 778), (786, 891), (897, 1015)]
C0, SP, NC = 237, 152.3, 9
LABEL_X = 184  # everything left of this is the row label


def keep_near(crop, cx, reach):
    """Keep the biggest blob plus any blob whose centre is within `reach` px of cx and not cut by the window edge."""
    mask = crop[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=2), structure=np.ones((3, 3)))
    if n == 0:
        return crop
    idx = range(1, n + 1)
    sizes = ndimage.sum(mask, lab, idx)
    coms = ndimage.center_of_mass(mask, lab, idx)
    objs = ndimage.find_objects(lab)
    main = max(range(n), key=lambda i: sizes[i] - 30 * abs(coms[i][1] - cx))
    keep = np.zeros_like(mask)
    for i in range(n):
        sx = objs[i][1]
        edge = sx.start == 0 or sx.stop == mask.shape[1]
        if i == main or (abs(coms[i][1] - cx) < reach and not edge and sizes[i] > 6):
            keep |= lab == i + 1
    out = crop.copy()
    out[~(keep & mask)] = 0
    return out


sheet = Image.new('RGBA', (CELL_W * NC, CELL_H * len(ROWS)), (0, 0, 0, 0))
for r, (ry0, ry1) in enumerate(ROWS):
    y0 = (ROWS[r - 1][1] + ry0) // 2 + 1 if r else ry0 - 6
    y1 = (ry1 + ROWS[r + 1][0]) // 2 if r < len(ROWS) - 1 else min(A.shape[0], ry1 + 6)
    for c in range(NC):
        ax = C0 + SP * c
        half = 100 if r == 3 else 80  # death row: lying body is wide
        x0, x1 = max(LABEL_X, int(ax - half)), int(ax + half)
        crop = A[y0:y1, x0:x1].copy()
        crop[crop[..., 3] < 50] = 0
        crop = keep_near(crop, ax - x0, 55 if r != 3 else 0)
        ys, _ = np.nonzero(crop[..., 3] >= 150)
        bottom = ys.max()
        tile = Image.fromarray(crop)
        tile = tile.resize((round(tile.width * SCALE), round(tile.height * SCALE)), Image.LANCZOS)
        px = round(c * CELL_W + CX - (ax - x0) * SCALE)
        py = round(r * CELL_H + BASE_Y - (bottom + 1) * SCALE)
        layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
        layer.alpha_composite(tile, (px, py))
        la = np.array(layer)
        clip = np.zeros(la.shape[:2], bool)
        clip[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W] = True
        la[~clip] = 0
        sheet.alpha_composite(Image.fromarray(la))
sheet.save('out/hero-shade.png', optimize=True)
print('hero', sheet.size)

# ---------------------------------------------------------------- effects
F = np.array(Image.open(FX_SRC).convert('RGBA'))
FX_ROWS = {'teleport': (10, 285), 'smoke': (300, 500), 'phantom': (495, 760)}
FX_N = 8
# frame centres per row (measured from the sheet; spacing is not uniform)
FX_CENTERS = {
    'teleport': [345, 569, 779, 1007, 1239, 1500, 1700, 1900],
    'smoke': [338, 529, 758, 1018, 1271, 1500, 1710, 1900],
    'phantom': [352, 561, 794, 1022, 1265, 1480, 1680, 1900],
}
FX_SCALE = 0.5
FX_SP = 221
for name, (y0, y1) in FX_ROWS.items():
    centers = FX_CENTERS[name]
    band = F[y0:y1, 240:].copy()
    band[band[..., 3] < 30] = 0
    m = band[..., 3] > 0
    # group nearby pieces, then give each group to the nearest frame centre
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=3), structure=np.ones((3, 3)))
    coms = ndimage.center_of_mass(m, lab, range(1, n + 1))
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    owner = np.full(n + 1, -1)
    for j in range(n):
        if sizes[j] < 4:
            continue
        x = coms[j][1] + 240
        owner[j + 1] = int(np.argmin([abs(x - c) for c in centers]))
    frame_of = owner[lab]
    tiles = []
    for i, cx in enumerate(centers):
        t = band.copy()
        t[(frame_of != i) | ~m] = 0
        tiles.append((Image.fromarray(t), cx - 240))
    # common frame: same window size, centred on the grid column (keeps motion consistent)
    cw = 300
    ch = y1 - y0
    out = Image.new('RGBA', (cw * FX_N, ch), (0, 0, 0, 0))
    for i, (t, off) in enumerate(tiles):
        out.alpha_composite(t, (i * cw + cw // 2 - off, 0))
    # trim empty rows top/bottom, then scale
    al = np.array(out)[..., 3]
    ys = np.nonzero(al.sum(1))[0]
    out = out.crop((0, max(0, ys.min() - 2), out.width, min(out.height, ys.max() + 3)))
    out = out.resize((round(out.width * FX_SCALE / FX_N) * FX_N, round(out.height * FX_SCALE)), Image.LANCZOS)
    out.save(f'out/fx-shade-{name}.png', optimize=True)
    print(name, 'cell', out.width // FX_N, out.height, 'sheet', out.size)

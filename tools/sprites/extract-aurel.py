"""Extract the golden-knight tank sheet into game-ready sprite sheets.

Output (all transparent PNG):
  hero-aurel.png      8 cols x 8 rows, cell 132x100, feet baseline y=86, centre x=66, facing right
                      rows: idle, walk, hurt, attack(shield bash), skill(defense), skill2(charge), ult(guard), die
  fx-aurel-defense.png  7 frames, cell 96x96
  fx-aurel-charge.png   5 frames, cell 128x96
  fx-aurel-ult.png      5 frames, cell 112x112
"""
from PIL import Image
import numpy as np
from scipy import ndimage

SRC = 'src.png'
SCALE = 0.75
im = Image.open(SRC).convert('RGBA')
A = np.array(im)

# ---------------------------------------------------------------- characters
ROWS = [(18, 115), (127, 222), (229, 329), (339, 434), (445, 539), (545, 639), (650, 752), (757, 859)]
ANCHOR_X = [248 + 156.2 * i for i in range(8)]
CELL_W, CELL_H, BASE_Y, CX = 132, 100, 86, 66
ALPHA_MIN = 50


def clean_crop(x0, y0, x1, y1, alpha_min):
    crop = A[y0:y1, x0:x1].copy()
    crop[crop[..., 3] < alpha_min] = 0
    return crop


def main_blob(crop, center_x, grow=4):
    """Keep the component nearest the frame centre (+ small parts close to it); drops neighbour bleed."""
    mask = crop[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(mask, iterations=grow), structure=np.ones((3, 3)))
    if n == 0:
        return crop
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    coms = ndimage.center_of_mass(mask, lab, range(1, n + 1))
    # score: big and close to centre
    best = max(range(n), key=lambda i: sizes[i] - 40 * abs(coms[i][1] - center_x))
    keep = lab == best + 1
    out = crop.copy()
    out[~(keep & mask)] = 0
    return out


sheet = Image.new('RGBA', (CELL_W * 8, CELL_H * 8), (0, 0, 0, 0))
for r, (ry0, ry1) in enumerate(ROWS):
    for c in range(8):
        ax = ANCHOR_X[c]
        x0, x1 = int(ax - 90), int(ax + 90)
        y0 = (ROWS[r - 1][1] + ry0) // 2 + 1 if r else ry0 - 6
        y1 = (ry1 + ROWS[r + 1][0]) // 2 if r < 7 else ry1 + 6
        crop = clean_crop(x0, y0, x1, y1, ALPHA_MIN)
        crop = main_blob(crop, ax - x0, grow=2)
        ys, xs = np.nonzero(crop[..., 3] >= 150)
        bottom = ys.max()
        tile = Image.fromarray(crop)
        tw, th = round(tile.width * SCALE), round(tile.height * SCALE)
        tile = tile.resize((tw, th), Image.LANCZOS)
        # anchor x -> CX, bbox bottom -> BASE_Y
        px = round(c * CELL_W + CX - (ax - x0) * SCALE)
        py = round(r * CELL_H + BASE_Y - (bottom + 1) * SCALE)
        cellbox = Image.new('RGBA', (CELL_W * 8, CELL_H * 8), (0, 0, 0, 0))
        cellbox.alpha_composite(tile, (px, py))
        # clip to own cell so nothing bleeds into neighbours
        clip = Image.new('L', cellbox.size, 0)
        clip.paste(255, (c * CELL_W, r * CELL_H, (c + 1) * CELL_W, (r + 1) * CELL_H))
        cellbox.putalpha(Image.fromarray(np.minimum(np.array(cellbox)[..., 3], np.array(clip))))
        sheet.alpha_composite(cellbox)
sheet.save('out/hero-aurel.png', optimize=True)

# ---------------------------------------------------------------- effects
FX_Y0, FX_Y1 = 898, 1014
FX = {
    'defense': [(244, 266), (186, 235), (280, 310), (324, 366), (378, 430), (453, 520), (534, 585)],
    'charge': [(632, 689), (694, 'split'), ('split', 852), (852, 915), (919, 1004)],
    'ult': [(1044, 1099), (1106, 1204), (1212, 1315), (1324, 1440), (1449, 1511)],
}
band = A[FX_Y0:FX_Y1].copy()
# drop label text (dark navy) and faint haze
lum = band[..., :3].astype(int).mean(-1)
band[(band[..., 3] < 40) | ((lum < 90) & (np.arange(band.shape[0])[:, None] < 16))] = 0

# split point inside the merged streak + crescent of charge
colsum = (band[:, 760:800, 3] > 0).sum(0)
split = 792  # streak tip ends ~791, crescent starts after
FX['charge'] = [(a if a != 'split' else split, b if b != 'split' else split) for a, b in FX['charge']]

for name, spans in FX.items():
    tiles = []
    for x0, x1 in spans:
        t = band[:, x0:x1].copy()
        m = t[..., 3] > 0
        lab, n = ndimage.label(m, structure=np.ones((3, 3)))
        sizes = ndimage.sum(m, lab, range(1, n + 1))
        for i, sz in enumerate(sizes):
            if sz < (150 if name == "charge" else 25):
                t[lab == i + 1] = 0
        ys, xs = np.nonzero(t[..., 3])
        t = t[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
        img = Image.fromarray(t)
        img = img.resize((max(1, round(img.width * SCALE)), max(1, round(img.height * SCALE))), Image.LANCZOS)
        tiles.append(img)
    cw = max(t.width for t in tiles) + 4
    ch = max(t.height for t in tiles) + 4
    out = Image.new('RGBA', (cw * len(tiles), ch), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        out.alpha_composite(t, (i * cw + (cw - t.width) // 2, (ch - t.height) // 2))
    out.save(f'out/fx-aurel-{name}.png', optimize=True)
    print(name, len(tiles), 'frames, cell', cw, ch, 'sheet', out.size)
print('split', split, 'hero sheet', sheet.size)

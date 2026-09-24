"""Extract Draken v2 sheet (1536x1024, real alpha) into game-ready sprite sheets.

hero-draken.png  11 cols x 11 rows, cell 132x100, feet y=86, centre x=66, facing right
  rows: idle 8, walk 9, run 9, jump 9, fall 8, hurt 7, die 9, attack 9, skill 7, skill2 6, ult 11
fx-draken-{slash,dash,ult}.png  4 frames each (built from the Skill Effects strip)
Frames are not on a uniform grid, so each blob is assigned to the nearest measured frame centre.
"""
from PIL import Image
import numpy as np
from scipy import ndimage

A = np.array(Image.open('src.png').convert('RGBA'))
SCALE = 0.9
CELL_W, CELL_H, BASE_Y, CX = 132, 100, 86, 66
LABEL_X = 188

ROWS = [  # (y0, y1, frame centres)
    (6, 91, [222, 310, 398, 487, 575, 664, 751, 841]),
    (91, 176, [222, 310, 399, 487, 575, 664, 753, 843, 933]),
    (176, 256, [227, 318, 408, 497, 586, 675, 765, 855, 944]),
    (256, 344, [224, 318, 409, 499, 589, 679, 769, 859, 950]),
    (344, 431, [223, 314, 403, 490, 581, 672, 761, 853]),
    (431, 516, [223, 315, 406, 497, 590, 677, 767]),
    (516, 592, [223, 320, 421, 519, 625, 740, 842, 941, 1043]),
    (592, 668, [228, 318, 432, 522, 632, 735, 840, 935, 1045]),
    (668, 740, [249, 376, 502, 630, 756, 875, 995]),
    (740, 802, [251, 385, 518, 651, 778, 917]),
    (802, 900, [233, 333, 432, 537, 627, 712, 812, 880, 953, 1030, 1160]),
]
NC = max(len(r[2]) for r in ROWS)


def split_row(y0, y1, centres, alpha_min=50):
    band = A[y0:y1].copy()
    band[band[..., 3] < alpha_min] = 0
    band[:, :LABEL_X] = 0
    m = band[..., 3] > 0
    lab, n = ndimage.label(ndimage.binary_dilation(m, iterations=1), structure=np.ones((3, 3)))
    idx = range(1, n + 1)
    coms = ndimage.center_of_mass(m, lab, idx)
    sizes = ndimage.sum(m, lab, idx)
    owner = np.full(n + 1, -1)
    for j in range(n):
        if sizes[j] >= 3:
            owner[j + 1] = int(np.argmin([abs(coms[j][1] - c) for c in centres]))
    of = owner[lab]
    frames = []
    for i in range(len(centres)):
        f = band.copy()
        f[(of != i) | ~m] = 0
        frames.append(f)
    return frames


sheet = Image.new('RGBA', (CELL_W * NC, CELL_H * len(ROWS)), (0, 0, 0, 0))
for r, (y0, y1, centres) in enumerate(ROWS):
    frames = split_row(y0, y1, centres)
    bottoms = [np.nonzero(f[..., 3] >= 150)[0].max() for f in frames if (f[..., 3] >= 150).any()]
    base = int(np.median(bottoms))  # row ground line
    for c, (f, cx) in enumerate(zip(frames, centres)):
        tile = Image.fromarray(f)
        tile = tile.resize((round(tile.width * SCALE), round(tile.height * SCALE)), Image.LANCZOS)
        px = round(c * CELL_W + CX - cx * SCALE)
        py = round(r * CELL_H + BASE_Y - (base + 1) * SCALE)
        layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
        layer.alpha_composite(tile, (px, py)) if px >= 0 and py >= 0 else layer.paste(tile, (px, py), tile)
        la = np.array(layer)
        clip = np.zeros(la.shape[:2], bool)
        clip[r * CELL_H:(r + 1) * CELL_H, c * CELL_W:(c + 1) * CELL_W] = True
        la[~clip] = 0
        sheet.alpha_composite(Image.fromarray(la))
sheet.save('out/hero-draken.png', optimize=True)
print('hero', sheet.size, 'rows', len(ROWS), 'cols', NC)

# ---------------------------------------------------------------- effects
FY0, FY1 = 930, 1012
PIECES = {  # x ranges of single pieces in the strip
    'slash1': (28, 92), 'slash2': (92, 160), 'slash3': (160, 255),
    'dash1': (530, 645), 'dash2': (668, 722), 'cloud': (733, 800),
    'spike2': (826, 910), 'spike3': (910, 1002), 'burst': (1015, 1088), 'sparks': (1095, 1152),
    'hit1': (1175, 1215), 'hit2': (1218, 1305), 'particles': (1318, 1515),
}
band = A[FY0:FY1].copy()
band[band[..., 3] < 30] = 0
band[band[..., :3].astype(int).mean(-1) < 50] = 0  # dark label/panel edges
# white label text sits in the top rows; effects there are blue (b >> r)
top = band[:16]
top[(top[..., 2].astype(int) - top[..., 0].astype(int)) < 60] = 0
top = band[:24]
top[top[..., :3].astype(int).mean(-1) < 110] = 0  # faint pill outlines


def piece(name):
    x0, x1 = PIECES[name]
    t = band[:, x0:x1].copy()
    m = t[..., 3] > 0
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    objs = ndimage.find_objects(lab)
    for j, sz in enumerate(sizes):
        sx = objs[j][1]
        sy = objs[j][0]
        thin = (sy.stop - sy.start) <= 5 and (sx.stop - sx.start) > 12  # label pill outlines
        if sz < 3 or thin or (sx.start == 0 and sx.stop < 6) or (sx.stop == t.shape[1] and sx.start > t.shape[1] - 6):
            t[lab == j + 1] = 0
    ys, xs = np.nonzero(t[..., 3])
    return Image.fromarray(t[ys.min():ys.max() + 1, xs.min():xs.max() + 1])


SEQ = {
    'slash': ['slash1', 'slash2', 'slash3', 'hit2'],
    'dash': ['dash1', 'dash2', 'hit2', 'cloud'],
    'ult': ['spike2', 'spike3', 'burst', 'particles'],
}
for name, seq in SEQ.items():
    tiles = [piece(p) for p in seq]
    cw = max(t.width for t in tiles) + 4
    ch = max(t.height for t in tiles) + 4
    out = Image.new('RGBA', (cw * len(tiles), ch), (0, 0, 0, 0))
    for i, t in enumerate(tiles):
        out.alpha_composite(t, (i * cw + (cw - t.width) // 2, (ch - t.height) // 2))
    out.save(f'out/fx-draken-{name}.png', optimize=True)
    print(name, 'frames', len(tiles), 'cell', cw, ch)

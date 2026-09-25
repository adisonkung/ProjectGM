"""Slime enemy sheet from the labelled 5-row sheet (fake checkerboard background, label bars under
every frame, labels on the left; the slime faces LEFT in the source).

usage: python3 tools/sprites/slime.py <source.png> [out.png]
Output: public/sprites/enemy-slime.png, cells 132x100, feet y=86, centre x=66, facing right.
Rows: idle 4 · walk (hop) 6 · hurt 3 · die 6 · attack (body slam) 6 — hit frame = index 4.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

CW, CH, CX, BASE_Y = 132, 100, 66, 86
SCALE = 0.5
LABEL_END = 163  # left column with "Row N" boxes

# (name, y_top, y_label_top, panel split x's) — the band above the label bar of each row
ROWS = [
    ('idle',   20, 160, [385, 610, 855]),
    ('walk',  215, 367, [365, 603, 812, 1060, 1293]),
    ('hurt',  425, 559, [372, 610]),
    ('die',   615, 761, [385, 615, 832, 1068, 1318]),
    ('attack', 815, 963, [373, 578, 810, 1043, 1318]),
]


def foreground(rgb):
    mx, mn = rgb.max(-1), rgb.min(-1)
    # checkerboard / panel borders are grey (unsaturated, light); slime = saturated green or dark outline
    return ((mx - mn) > 45) | (mx < 110)


def main(src, out):
    rgb = np.array(Image.open(src).convert('RGB')).astype(int)
    fg = foreground(rgb)
    fg[:, :LABEL_END] = False
    sheet = Image.new('RGBA', (CW * 6, CH * len(ROWS)), (0, 0, 0, 0))
    for i, (name, y0, y1, splits) in enumerate(ROWS):
        band = np.zeros_like(fg)
        band[y0:y1] = fg[y0:y1]
        lab, n = ndimage.label(band, structure=np.ones((3, 3)))
        idx = np.arange(1, n + 1)
        sizes = ndimage.sum(band, lab, idx)
        coms = ndimage.center_of_mass(band, lab, idx)
        k = len(splits) + 1
        masks = [np.zeros_like(fg) for _ in range(k)]
        for j in range(n):
            if sizes[j] < 12:  # speckles from the checkerboard
                continue
            f = int(np.searchsorted(splits, coms[j][1]))
            masks[f] |= lab == j + 1
        frames = []
        for f, m in enumerate(masks):
            # fill the pale highlights inside the outline (unsaturated, so the key dropped them)
            m = ndimage.binary_fill_holes(m)
            body_lab, bn = ndimage.label(m)
            big = np.argmax(ndimage.sum(m, body_lab, range(1, bn + 1))) + 1
            body = body_lab == big
            ys, xs = np.nonzero(body)
            top, bot = ys.min(), ys.max()
            lower = ys >= top + (bot - top) * 0.5
            frames.append((m, float(np.median(xs[lower])), bot))
        ground = int(np.median([b for *_, b in frames]))
        for f, (m, ax, _) in enumerate(frames):
            # drop loose droplets that would be cut by the cell edge (a half bubble looks wrong);
            # after the flip a source x lands at CX + (ax - x) * SCALE inside the cell
            cl, cn = ndimage.label(m, structure=np.ones((3, 3)))
            for q in range(1, cn + 1):
                part = cl == q
                _, px_ = np.nonzero(part)
                lo, hi = CX + (ax - px_.max()) * SCALE, CX + (ax - px_.min()) * SCALE
                if (lo < 1 or hi > CW - 1) and part.sum() < 800:
                    m = m & ~part
            yy, xx = np.nonzero(m)
            ya, yb, xa, xb = yy.min(), yy.max() + 1, xx.min(), xx.max() + 1
            crop = np.zeros((yb - ya, xb - xa, 4), np.uint8)
            crop[..., :3] = rgb[ya:yb, xa:xb]
            crop[..., 3] = m[ya:yb, xa:xb] * 255
            img = Image.fromarray(crop).transpose(Image.FLIP_LEFT_RIGHT)  # face right
            local = (xb - 1) - ax  # anchor x inside the flipped crop
            img = img.resize((max(1, round(img.width * SCALE)), max(1, round(img.height * SCALE))), Image.LANCZOS)
            px = round(f * CW + CX - local * SCALE)
            py = round(i * CH + BASE_Y - (ground + 1 - ya) * SCALE)
            layer = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
            layer.paste(img, (px, py), img)
            la = np.array(layer)
            clip = np.zeros(la.shape[:2], bool)
            clip[i * CH:(i + 1) * CH, f * CW:(f + 1) * CW] = True
            lost = la[..., 3][~clip].sum() / max(1, la[..., 3].sum())
            if lost > 0.005:
                print(f'  ! {name}[{f}] {lost:.1%} outside cell')
            la[~clip] = 0
            sheet.alpha_composite(Image.fromarray(la))
        print(name, k, 'frames, ground', ground)
    sheet.save(out, optimize=True)
    print(out, sheet.size)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 'public/sprites/enemy-slime.png')

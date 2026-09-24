"""Remove sideways jitter from an idle row: shift each frame so the feet (bottom rows) line up.

usage: python3 stabilize_idle.py sheet.png cols frames [row=0]
Cells are 132x100 with feet at y=86 (see core/data/sprites.ts).
"""
import sys
import numpy as np
from PIL import Image

CW, CH, FEET_Y = 132, 100, 86


def stabilize(path, cols, frames, row=0):
    img = np.array(Image.open(path).convert('RGBA'))
    y0 = row * CH
    centres = []
    for c in range(frames):
        cell = img[y0:y0 + CH, c * CW:(c + 1) * CW]
        feet = cell[FEET_Y - 8:FEET_Y + 1, :, 3] >= 150
        xs = np.nonzero(feet)[1]
        centres.append(xs.mean() if len(xs) else CW / 2)
    target = float(np.median(centres))
    for c, cx in enumerate(centres):
        dx = int(round(target - cx))
        if dx == 0:
            continue
        cell = img[y0:y0 + CH, c * CW:(c + 1) * CW].copy()
        img[y0:y0 + CH, c * CW:(c + 1) * CW] = np.roll(cell, dx, axis=1)
    Image.fromarray(img).save(path, optimize=True)
    return [round(target - cx, 1) for cx in centres]


if __name__ == '__main__':
    p, cols, frames = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    row = int(sys.argv[4]) if len(sys.argv) > 4 else 0
    print(p, stabilize(p, cols, frames, row))

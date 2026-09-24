"""Rebuild FX sheets with soft edges: python3 tools/sprites/draken_fx.py <source.png> (run from repo root)."""
import numpy as np
from fx_strip import build
import sys
SRC = sys.argv[1]  # the original sheet image (with alpha)
C = [60, 126, 207, 329, 451, 587, 695, 766, 868, 956, 1051, 1123, 1195, 1261, 1416]
def clear(b):
    for x in (10, 261, 515, 812, 1159, 1309, 1525):  # panel borders
        b[:, x - 4:x + 5] = 0
    lum = b[..., :3].mean(-1)
    b[lum < 50] = 0                                   # dark label panels
    top = b[:16]
    top[(top[..., 2] - top[..., 0]) < 60] = 0         # white label text
    b[:24][lum[:24] < 110] = 0                        # panel outlines at the top
    b[(lum < 100) & (b[..., 3] < 160)] = 0            # faint panel borders
for name, keep in {
    'slash': [0, 1, 2, 13],
    'dash': [5, 6, 13, 7],
    'ult': [8, 9, 10, 14],
}.items():
    print(name, build(SRC, 930, 1014, C, keep, 1.0, f'public/sprites/fx-draken-{name}.png', clear=clear))

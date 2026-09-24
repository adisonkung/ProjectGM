"""Rebuild FX sheets with soft edges: python3 tools/sprites/aurel_fx.py <source.png> (run from repo root)."""
import numpy as np
from fx_strip import build
import sys
SRC = sys.argv[1]  # the original sheet image (with alpha)
C = [210, 255, 295, 345, 404, 486, 560, 660, 743, 822, 883, 961, 1071, 1155, 1263, 1382, 1480]
def clear(b):
    for x0, x1 in [(0, 178), (612, 622), (1015, 1025)]:
        b[:, x0:x1] = 0
    lum = b[..., :3].mean(-1)
    b[:16][lum[:16] < 90] = 0
for name, keep in {
    'defense': [1, 0, 2, 3, 4, 5, 6],
    'charge': [7, 8, 9, 10, 11],
    'ult': [12, 13, 14, 15, 16],
}.items():
    print(name, build(SRC, 898, 1016, C, keep, 0.75, f'public/sprites/fx-aurel-{name}.png', clear=clear))

"""Rebuild FX sheets with soft edges: python3 tools/sprites/shade_fx.py <source.png> (run from repo root)."""
from fx_strip import build
import sys
SRC = sys.argv[1]  # the original sheet image (with alpha)
ROWS = {
    'teleport': (10, 290, [345, 569, 779, 1007, 1239, 1500, 1700, 1900]),
    'smoke': (296, 500, [338, 529, 758, 1018, 1271, 1500, 1710, 1900]),
    'phantom': (496, 764, [352, 561, 794, 1022, 1265, 1480, 1680, 1900]),
}
def clear(b):
    b[:, :240] = 0  # row labels
for name, (y0, y1, cs) in ROWS.items():
    print(name, build(SRC, y0, y1, cs, list(range(8)), 0.5, f'public/sprites/fx-shade-{name}.png', alpha_min=30, x_min=240, clear=clear))

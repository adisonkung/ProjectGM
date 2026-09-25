"""FX v2 for Aurel / Jin / Sylvie: 8 frames per skill, labelled sheets (F1..F8 pills + row titles)."""
import sys
import numpy as np
import fx_strip
from fx_strip import build

fx_strip.REACH = 40      # these sheets have wide soft glows
fx_strip.MIN_BLOB = 20   # ignore scattered specks
SCALE = 0.42
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'

SHEETS = {
    'aurel': dict(src='aurel.png', label_x=258, centres=[354, 558, 760, 993, 1244, 1480, 1701, 1925],
                  pills=[(12, 60), (288, 334), (506, 554)],
                  rows={'defense': (60, 290), 'charge': (334, 508), 'ult': (554, 760)}),
    'jin': dict(src='jin.png', label_x=276, centres=[364, 583, 813, 1053, 1312, 1558, 1801, 2037],
                pills=[(22, 72), (282, 332), (479, 530)],
                rows={'spin': (72, 282), 'thrust': (332, 480), 'dragon': (505, 724)}),
    'sylvie': dict(src='sylvie.png', label_x=240, centres=[355, 586, 819, 1048, 1283, 1545, 1778, 2017],
                   pills=[(28, 76), (266, 316), (500, 552)],
                   rows={'rapid': (76, 266), 'volley': (300, 500), 'celestial': (540, 724)}),
}

sizes = {}
for hero, d in SHEETS.items():
    def clear(b, y0=0, d=d):
        b[:, :d['label_x']] = 0
        for py0, py1 in d['pills']:
            for c in d['centres']:
                ys0, ys1 = max(0, py0 - y0), max(0, py1 - y0)
                if ys1 > 0:
                    b[ys0:ys1, max(0, c - 62):c + 62] = 0
    for name, (y0, y1) in d['rows'].items():
        sizes[f'{hero}-{name}'] = build(d['src'], y0, y1, d['centres'], list(range(8)), SCALE,
                                         f'{OUT}/fx-{hero}-{name}.png', clear=lambda b, y0=y0: clear(b, y0))
for k, v in sizes.items():
    print(k, v)

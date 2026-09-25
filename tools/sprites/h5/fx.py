import fx_strip
from fx_strip import build
from rows import bands
from grid import centres, LABEL_END
from softwin import build_soft
from chars import SCALE
fx_strip.REACH = 30
fx_strip.MIN_BLOB = 12
ROWNAME = {'fx1': 's1', 'fx2': 's2', 'fxu': 'ult'}
sizes = {}
for h in ['knight', 'berserk', 'plague', 'reaper', 'necro']:
    b, _ = bands(h)
    C = centres(h)
    for r, nm in ROWNAME.items():
        y0, y1 = b[r]
        lx = LABEL_END[h][r]
        cs = C[r]
        if (h, r) == ('plague', 'fx2'):
            sizes['plague-s2'] = build_soft(f'{h}.png', y0, y1, C['skill2'], 105, SCALE[h], 'out/fx-plague-s2.png', x_min=lx)
            continue
        if (h, r) == ('necro', 'fxu'):
            # skull charge (4 frames, at the caster) + green soul beam (3 frames, flies to the target)
            sizes['necro-ult'] = build(f'{h}.png', y0, y1, cs[:4] + [880, 1100, 1390], [0, 1, 2, 3], SCALE[h], 'out/fx-necro-ult.png', x_min=lx)
            fx_strip.SPLIT = False
            sizes['necro-beam'] = build(f'{h}.png', y0, y1, cs[:4] + [1030, 1390], [4, 5], SCALE[h] * 0.8, 'out/fx-necro-beam.png', x_min=lx)
            fx_strip.SPLIT = True
            continue
        sizes[f'{h}-{nm}'] = build(f'{h}.png', y0, y1, cs, list(range(8)), SCALE[h], f'out/fx-{h}-{nm}.png', x_min=lx)
for k, v in sizes.items():
    print(k, v)

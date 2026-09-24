import numpy as np
import fx_strip
from fx_strip import build
out = {}
# ---- Jin (samurai): strip y 1162-1295
def clear_sam(b):
    b[:10, :115] = 0            # "Skill Effects" label bottom
    b[:, 538:552] = 0; b[:, 826:840] = 0   # group dividers
C = [65, 180, 295, 405, 505, 600, 695, 790, 915, 1045, 1165]
for name, keep in {'spin': [0, 1, 2, 3, 4], 'thrust': [5, 6, 7], 'dragon': [8, 9, 10]}.items():
    out[f'jin-{name}'] = build('samurai.png', 1162, 1295, C, keep, 0.7, f'out/fx-jin-{name}.png', clear=clear_sam)
# ---- Sylvie (elf) skill strip y 1047-1122
def clear_elf(b):
    b[:, :178] = 0
C = [202, 245, 290, 348, 400, 455, 507, 562, 632, 685, 737, 790, 855, 906, 1007, 1100, 1180, 1265, 1345]
for name, keep in {'rapid': [0, 1, 2, 3, 4, 5, 6, 7], 'volley': [8, 9, 10, 11, 12, 13], 'celestial': [14, 15, 16, 17, 18]}.items():
    out[f'sylvie-{name}'] = build('elf.png', 1047, 1122, C, keep, 0.75, f'out/fx-sylvie-{name}.png', clear=clear_elf)
# ---- arrows: 4 rows x 6 frames
AC = [319, 545, 765, 987, 1217, 1422]
def clear_arrow(b):
    b[:, :225] = 0
for name, (y0, y1) in {'normal': (140, 255), 'rapid': (335, 445), 'volley': (505, 700), 'celestial': (705, 945)}.items():
    out[f'arrow-{name}'] = build('arrows.png', y0, y1, AC, list(range(6)), 0.4, f'out/fx-arrow-{name}.png', clear=clear_arrow)
# ---- Lumina (priest) fx: 3 rows x 8
fx_strip.MIN_BLOB = 14
def clear_p(b):
    b[:, :290] = 0
for name, (y0, y1, cs) in {
    'prayer': (80, 300, [370, 552, 741, 916, 1108, 1299, 1479, 1668]),
    'bless': (345, 575, [379, 555, 746, 923, 1112, 1295, 1480, 1670]),
    'rez': (605, 815, [384, 561, 743, 924, 1112, 1300, 1478, 1670]),
}.items():
    out[f'lumina-{name}'] = build('priestfx.png', y0, y1, cs, list(range(8)), 0.5, f'out/fx-lumina-{name}.png', clear=clear_p)
# small orb projectile for Lumina's attack: prayer frames 0,1 flying + frame 4 as the hit
out['lumina-orb'] = build('priestfx.png', 80, 300, [370, 552, 741, 916, 1108, 1299, 1479, 1668], [0, 1, 0, 1, 4], 0.3, 'out/fx-lumina-orb.png', clear=clear_p)
for k, v in out.items():
    print(k, v)

"""Cut supplied Winterglass Field assets for provisional review, without a final Timeline Sync.

python3 tools/sprites/mirelle_ult.py [source directory] [sprite output]
Field loop reuses formed Main poses; no new source art or burst damage is invented.
"""
import json
import sys
from pathlib import Path

from mirelle_s1 import load_fx, cut_frames
from mirelle_s2 import bake_ground


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/mirelle/ult')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    charge = cut_frames(load_fx(src / 'ult_charge.png'), [83, 248, 455, 662, 920, 1179, 1448, 1655, 1892, 2100])
    a = load_fx(src / 'ult_main.png')
    formation = cut_frames(a[:434], [114, 310, 538, 776, 1024, 1334, 1634, 1976])
    dissolve = cut_frames(a[434:], [155, 538, 900, 1200, 1510, 1810, 2069])
    impact = load_fx(src / 'ult_impact.png')
    breaking = cut_frames(impact[397:681], [186, 566, 971, 1293, 1614])
    fragments = cut_frames(impact[681:], [152, 498, 828, 1140, 1411, 1673])
    # Do not replay formation or the large rising pillars as the persistent field / finisher.
    loop = [formation[i] for i in [6, 7]]
    shatter = breaking + fragments[:3]
    report = {'state': 'PROVISIONAL_REVIEW',
              # Larger review presentation (user, 2026-10-17): retain more source resolution.
              'charge': bake_ground(charge, out, 'fx-mirelle-ult-charge.png', 144),
              'main': bake_ground(formation, out, 'fx-mirelle-ult-main.png', 200),
              'field': bake_ground(loop, out, 'fx-mirelle-ult-field.png', 200),
              'shatter': bake_ground(shatter, out, 'fx-mirelle-ult-shatter.png', 360),
              'residual': bake_ground(dissolve[3:], out, 'fx-mirelle-ult-residual.png', 150)}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

"""Cut the supplied Verdant Snare projectile/impact/root without changing originals.

python3 tools/sprites/sylvara_s2.py [S2 source directory] [sprite output]
Root growth and stable coil loop remain separate from gameplay/status duration.
"""
import json
import sys
from pathlib import Path

from sylvara_s1 import load_fx, cut_frames, bake
from mirelle_s2 import bake_ground


def rows(path, counts, y_cuts):
    a = load_fx(path)
    frames = []
    for centers, (y0, y1) in zip(counts, zip(y_cuts, y_cuts[1:])):
        frames.extend(cut_frames(a.copy(), centers, [y0, y1]))
    return frames


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/sylvara/s2')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    main_frames = rows(src / 's2_main.png', [[110, 325, 600, 950, 1380], [260, 770, 1160, 1510]], [150, 450, 750])
    impact = rows(src / 's2_impact.png', [[170, 510, 870, 1240], [220, 610, 970, 1290]], [70, 550, 1020])
    root = rows(src / 's2_root.png', [[180, 530, 880, 1230, 1580], [180, 530, 880, 1230, 1580]], [30, 470, 850])
    # Main1–2 are gathering stages; Main3–9 are the travelling arrow. No extra hits are inferred.
    report = {'state': 'PROVISIONAL_REVIEW',
              'projectile': bake(main_frames[2:], out / 'fx-sylvara-s2-projectile.png', 72, True),
              'impact': bake(impact, out / 'fx-sylvara-s2-impact.png', 112),
              'root': bake_ground(root, out, 'fx-sylvara-s2-root.png', 80)}
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()

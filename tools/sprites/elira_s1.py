"""Bake supplied S1 caster blessing/target heal burst for provisional visual review.
Original PNG/XLSX inputs are read-only. No replacement art or final Sync Sheet.
python3 tools/sprites/elira_s1.py [source dir] [sprite out]
"""
import json
import sys
from pathlib import Path
from mirelle_s1 import load_fx, cut_frames, bake
from mirelle_s2 import bake_ground


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/elira/s1')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    main_frames = cut_frames(load_fx(src / 'Skill 1 Main VFX.png'), [95, 260, 470, 685, 925, 1155, 1370, 1575])
    impact_frames = cut_frames(load_fx(src / 'Skill 1 Impact VFX.png'), [130, 370, 640, 920, 1235, 1510, 1790, 2050])
    print(json.dumps({'state': 'PROVISIONAL_REVIEW',
      'main': bake_ground(main_frames, out, 'fx-elira-s1-main.png', 110),
      'impact': bake(impact_frames, out, 'fx-elira-s1-impact.png', 72)}, indent=2))


if __name__ == '__main__':
    main()

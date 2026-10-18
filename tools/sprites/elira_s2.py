"""Cut supplied Sanctuary Veil Main/Impact; preserve original PNG/XLSX bytes.
Main's faint painted panel dividers are layout guides, never gameplay FX.
python3 tools/sprites/elira_s2.py [source dir] [sprite out]
"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from mirelle_s1 import cut_frames, bake
from mirelle_s2 import bake_ground


def load_fx(path):
    a = np.array(Image.open(path).convert('RGBA'))
    if a[..., 3].min() == 0:
        return a
    rgb = a[..., :3].astype(float)
    bg = np.median(np.concatenate((rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3))), axis=0)
    distance = np.max(np.abs(rgb - bg), axis=2)
    # Opaque painted pastels keep their source colours; only matte-edge glow is unmixed.
    # Using green/255 for every pixel would turn lavender/mint ribbons into solid yellow-white.
    alpha = np.clip(distance / 204, 0, 1)
    clean = (rgb - (1 - alpha[..., None]) * bg) / np.maximum(alpha[..., None], 1 / 255)
    a[..., :3] = np.clip(clean, 0, 255).astype(np.uint8)
    a[..., 3] = np.where(distance >= 16, np.round(alpha * 255), 0).astype(np.uint8)
    a[a[..., 3] == 0] = 0
    return a


def main():
    src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/elira/s2')
    out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    a = load_fx(src / 'skill 2 Main VFX.png')
    main_frames = []
    # Two irregular 8-panel rows, with a drawn grid that must not join adjacent stages.
    rows = [(0, 396, [0,224,462,723,996,1289,1605,1894,2172]),
            (403,724,[0,225,462,725,1005,1299,1618,1918,2172])]
    for y0, y1, edges in rows:
        for left, right in zip(edges[:-1], edges[1:]):
            x0, x1 = left + 4, right - 4
            tile = Image.fromarray(a[y0:y1, x0:x1])
            box = tile.getbbox()
            if box is None:
                raise ValueError('Empty supplied stage')
            tile = tile.crop(box)
            main_frames.append((tile, [x0+box[0],y0+box[1],x0+box[2],y0+box[3]]))
    impact = cut_frames(load_fx(src / 'skill 2 impact VFX.png'), [100,350,690,1030,1390,1755,2090,2400])
    print(json.dumps({'state':'PROVISIONAL_REVIEW',
      'main':bake_ground(main_frames,out,'fx-elira-s2-main.png',114),
      'impact':bake(impact,out,'fx-elira-s2-impact.png',76)},indent=2))


if __name__ == '__main__':
    main()

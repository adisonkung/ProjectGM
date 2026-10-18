"""Elira supplied Ultimate tracks, source-preserving extraction and board projection.
python3 tools/sprites/elira_ult.py [source dir] [sprite out]
"""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage
import aurel_v2 as A
from elira_s2 import load_fx
from mirelle_s2 import bake_ground


def frames(path, columns, rows=2):
    a = load_fx(path)  # preserves true alpha; only the Dissolve needs magenta recovery
    a[a[..., 3] < 16] = 0
    result = []
    for row in range(rows):
        y0 = round(a.shape[0] * row / rows)
        y1 = round(a.shape[0] * (row + 1) / rows)
        band = a[y0:y1]
        labels, _ = A.seam_labels(band[..., 3], columns, 36)
        for column in range(1, columns + 1):
            mask = (labels == column) & (band[..., 3] > 0)
            components, count = ndimage.label(mask, np.ones((3, 3)))
            sizes = np.bincount(components.ravel())
            mask &= sizes[components] >= 8
            yy, xx = np.nonzero(mask)
            if not len(xx):
                raise ValueError(f'Empty stage {path.name}/{row}/{column}')
            left, right, top, bottom = xx.min(), xx.max()+1, yy.min(), yy.max()+1
            tile = band[top:bottom, left:right].copy()
            tile[~mask[top:bottom, left:right]] = 0
            result.append((Image.fromarray(tile), [int(left),int(y0+top),int(right),int(y0+bottom)]))
    return result


def floor(im):
    a = np.array(im)[..., 3] >= 96
    start = int(im.height * .65)
    y = start + int(np.argmax(a.sum(1)[start:]))
    xs = np.flatnonzero(a[y])
    return ((float(xs[0])+float(xs[-1]))/2 if len(xs) else im.width/2, float(y))


def dome(items, out, name, reference, normalize=False):
    # Shared projected canvas/root for all three world-field tracks. The source art is portrait-shaped;
    # project it into the user's wide dome target instead of clipping its crest above the five-row board.
    w, h, rootx, rooty = 520, 440, 260, 335
    ref, _ = items[reference]
    tiles = []
    for im, bounds in items:
        sx = 484 / (im.width if normalize else ref.width)
        sy = 330 / (im.height if normalize else ref.height)
        cx, cy = floor(im)
        tile = im.resize((max(1,round(im.width*sx)), max(1,round(im.height*sy))), Image.Resampling.LANCZOS)
        x, y = round(rootx-cx*sx), round(rooty-cy*sy)
        tiles.append((tile,x,y,bounds))
    # Keep every source pixel: if halo exceeds the common projected envelope, fail rather than crop it.
    strip = Image.new('RGBA',(w*len(tiles),h))
    for i,(tile,x,y,bounds) in enumerate(tiles):
        if x<1 or y<1 or x+tile.width>=w or y+tile.height>=h:
            raise ValueError(f'{name} stage{i+1} outside canvas: {(x,y,tile.size,bounds)}')
        strip.alpha_composite(tile,(i*w+x,y))
    strip.save(out/name,optimize=True)
    return {'frames':len(tiles),'w':w,'h':h,'pivot':[rootx/w,rooty/h],
      'projected':True,'sourceBounds':[b for _,b in items]}


def main():
    src = Path(sys.argv[1] if len(sys.argv)>1 else 'art/incoming/elira/ult')
    out = Path(sys.argv[2] if len(sys.argv)>2 else 'public/sprites')
    out.mkdir(parents=True,exist_ok=True)
    charge = frames(src/'Ultimate Charge VFX only.png',5)
    formation = frames(src/'Ultimate Dome Formation VFX.png',4)
    loop = frames(src/'Ultimate Field Dome Loop VFX.png',4)
    end = frames(src/'Ultimate Dome Dissolve VFX.png',4)
    print(json.dumps({'state':'PROVISIONAL_REVIEW',
      'charge':bake_ground(charge,out,'fx-elira-ult-charge.png',108),
      'formation':dome(formation,out,'fx-elira-ult-main.png',7),
      'loop':dome(loop,out,'fx-elira-ult-field.png',0,True),
      'dissolve':dome(end,out,'fx-elira-ult-dissolve.png',0)},indent=2))


if __name__=='__main__':
    main()

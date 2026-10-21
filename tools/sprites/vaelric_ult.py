"""Bake supplied Ultimate art without generating/redesigning pixels.
Usage: python3 tools/sprites/vaelric_ult.py SOURCE_DIR [OUTPUT_DIR] [REPORT]
Preserves atlas rows0-6. User override: all12 Impact frames at40ms, F5 damage unchanged.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

src = Path(sys.argv[1])
out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
report_path = Path(sys.argv[3] if len(sys.argv) > 3 else 'tmp/vaelric-ult/assets.json')
out.mkdir(parents=True, exist_ok=True)
report = {'sources': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in src.glob('*.png')},
          'impactFrames': 12, 'impactFrameMs': 40, 'bodyHeight': 78, 'phantoms': []}
assert report['sources'] == {'ulti_character.png': '977ff1d2f834740f31966b4fbe3ce2339a768d269b4eef47215d091e112d6db7', 'Crimson Swordsman Attack Montage.png': '08d25854201960ff1b0cf8b446174c88bdfcf0dc2b952f40e42a85b2372ade88', 'Crimson Shadow Swordsman Sprite Sheet.png': '20aa4aa86bb4a39509c0ae8e0af94b7d52c538e19adeabb0489744f632609509', 'ulti_crimson vanish vfx.png': 'afa31363867b234ba25a07d2cfa4f10f754c6eef334c3406311af72171d6b965', 'ulti_impact VFX.png': '2016505ea80e3787d5a2f27f8df696b2c8fd2663558f0a439b9e067efd559994'}, 'Changed source: review the extraction anchors before baking'
# Native-alpha character: same standing reference and fixed source root for every pose.
source = Image.open(src / 'ulti_character.png').convert('RGBA')
assert source.size == (5120, 4096)
frames = [source.crop((i % 5 * 1024, i // 5 * 1024, i % 5 * 1024 + 1024, i // 5 * 1024 + 1024)) for i in range(20)]
assert all(f.getbbox() for f in frames[:17]) and not any(f.getbbox() for f in frames[17:])
ys, xs = np.nonzero(ndi.binary_opening(np.array(frames[0])[:, :, 3] >= 80, structure=np.ones((9, 9))))
scale = 78 / (ys.max() - ys.min())
root = (512, int(ys.max()))
atlas = Image.open(out / 'hero-vaelric.png').convert('RGBA')
assert atlas.size == (6500, 1360)
atlas.paste((0, 0, 0, 0), (0, 1190, 6500, 1360))
for i, fr in enumerate(frames[:17]):
 box = fr.getbbox(); crop = fr.crop(box)
 resized = crop.resize((round(crop.width * scale), round(crop.height * scale)), Image.Resampling.LANCZOS)
 x, y = round(130 + (box[0] - root[0]) * scale), round(155 + (box[1] - root[1]) * scale)
 assert x >= 0 and y >= 0 and x + resized.width < 260 and y + resized.height < 170
 atlas.alpha_composite(resized, (i * 260 + x, 1190 + y))
atlas.save(out / 'hero-vaelric.png', optimize=True)
report['characterScale'] = scale
# FX ownership follows whole connected artwork when separable; merged source poses
# require a documented nearest-anchor partition. All original alpha pixels belong once.
report['fx'] = {}
for part, filename, cols, split in [('vanish', 'ulti_crimson vanish vfx.png', 5, 362), ('impact', 'ulti_impact VFX.png', 6, 373)]:
 im = np.array(Image.open(src / filename).convert('RGBA'))
 anchors = (np.arange(cols) + .5) * im.shape[1] / cols
 pieces, merged = [], []
 for row, (lo, hi) in enumerate([(0, split), (split, im.shape[0])]):
  pixels = im[lo:hi]
  strong = pixels[:, :, 3] > 8
  labels, count = ndi.label(strong)
  owned = np.zeros(labels.shape, np.int16)
  for j, box in enumerate(ndi.find_objects(labels), 1):
   ys, xs = np.nonzero(labels[box] == j)
   xs = xs + box[1].start; ys = ys + box[0].start
   if box[1].stop - box[1].start > im.shape[1] / cols * 1.4:
    owned[ys, xs] = np.argmin(abs(xs[:, None]-anchors), axis=1) + 1
    merged.append({'row': row+1, 'box': [box[1].start, lo+box[0].start, box[1].stop, lo+box[0].stop]})
   else:
    owned[ys, xs] = int(np.argmin(abs(np.median(xs)-anchors))) + 1
  _, nearest = ndi.distance_transform_edt(~strong, return_indices=True)
  owned = np.where(strong, owned, owned[tuple(nearest)])
  owned[pixels[:, :, 3] == 0] = 0
  assert np.count_nonzero(owned) == np.count_nonzero(pixels[:, :, 3])
  for col in range(cols):
   mask = owned == col+1
   ys, xs = np.nonzero(mask)
   box = [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)]
   crop = pixels[box[1]:box[3], box[0]:box[2]].copy()
   crop[~mask[box[1]:box[3], box[0]:box[2]]] = 0
   ground = int(np.nonzero(mask & strong)[0].max()) + 1
   pieces.append((Image.fromarray(crop), box[0]-anchors[col], box[1]-ground))
 # One common density/canvas: no per-frame rescale or vertical clipping.
 density = 204 / max(im.shape[1]/cols, im.shape[0]/2)
 left = max(max(-x, x+p.width) for p,x,y in pieces)
 above = max(-y for p,x,y in pieces)
 below = max(y+p.height for p,x,y in pieces)
 w, h = int(np.ceil(left*density))*2+16, int(np.ceil((above+below)*density))+16
 foot = round(above*density)+8
 canvas = Image.new('RGBA', (w*len(pieces), h))
 for i, (crop, x, y) in enumerate(pieces):
  crop = crop.resize((round(crop.width*density), round(crop.height*density)), Image.Resampling.LANCZOS)
  frame = Image.new('RGBA', (w,h))
  frame.alpha_composite(crop, (round(w/2+x*density), round(foot+y*density)))
  alpha=np.array(frame)[:,:,3]
  assert not (alpha[0].any() or alpha[-1].any() or alpha[:,0].any() or alpha[:,-1].any())
  canvas.alpha_composite(frame, (i*w,0))
 canvas.save(out / f'fx-vaelric-ult-{part}.png', optimize=True)
 report['fx'][part] = {'w':w,'h':h,'pivot':[.5,foot/h], 'sourceAlphaPixels':int(np.count_nonzero(im[:,:,3])), 'mergedSourceComponents':merged}
# Connected artwork, not rectangular panels: trails/limbs cross panel boundaries.
configs = [
 ('Crimson Shadow Swordsman Sprite Sheet.png', [(936, 683, 205, 683), (1522, 964, 430, 964)]),
 ('Crimson Swordsman Attack Montage.png', [(650, 535, 170, 535), (1310, 529, 220, 529), (630, 966, 595, 966), (1230, 965, 645, 965)])]
index = 0
for filename, poses in configs:
 a = np.array(Image.open(src / filename).convert('RGBA'))
 rgb = a[:, :, :3].astype(float)
 mask = (rgb.max(2) - rgb.min(2) > 25) | (rgb.max(2) < 150)
 # Recover white blade highlights enclosed by the original red/black artwork.
 holes, count = ndi.label(ndi.binary_fill_holes(mask) & ~mask)
 sizes = np.bincount(holes.ravel())
 mask |= (holes > 0) & (sizes[holes] < 400)
 labels, _ = ndi.label(mask)
 objects = ndi.find_objects(labels)
 major = sorted(range(1, len(objects) + 1), key=lambda j: np.count_nonzero(labels[objects[j-1]] == j), reverse=True)[:len(poses)]
 major.sort(key=lambda j: (objects[j-1][0].start // 540, objects[j-1][1].start))
 core = np.isin(labels, major)
 _, nearest = ndi.distance_transform_edt(~core, return_indices=True)
 owners = labels[tuple(nearest)]
 # Each original connected body owns its nearby detached trails; never borrow the adjacent character.
 for j, (_, _, head, foot) in zip(major, poses):
  index += 1
  owned = mask & (owners == j)
  ys, xs = np.nonzero(owned)
  box = [int(xs.min()), int(ys.min()), int(xs.max()+1), int(ys.max()+1)]
  p = a.copy(); p[:, :, 3] = np.where(owned, 255, 0)
  crop = Image.fromarray(p).crop(box)
  s = 78 / (foot - head)
  crop = crop.resize((round(crop.width*s), round(crop.height*s)), Image.Resampling.LANCZOS)
  canvas = Image.new('RGBA', (300, 220))
  # Body anchor = midpoint of the silhouette's main body, fixed feet baseline.
  body = objects[j-1]
  cx = (body[1].start + body[1].stop) / 2
  px = round(150 + (box[0]-cx)*s)
  py = round(190 + (box[1]-foot)*s)
  assert px >= 0 and py >= 0 and px+crop.width < 300 and py+crop.height < 220
  canvas.alpha_composite(crop, (px, py))
  file = f'fx-vaelric-ult-phantom-{index}.png'
  canvas.save(out / file, optimize=True)
  report['phantoms'].append({'file': file, 'source': filename, 'sourceBox': box, 'bodyHeightSource': foot-head, 'scale': s, 'pixels': int(owned.sum())})
report_path.parent.mkdir(parents=True, exist_ok=True)
report_path.write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps(report, indent=2))

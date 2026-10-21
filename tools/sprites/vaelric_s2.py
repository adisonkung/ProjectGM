"""Cut all24 supplied S2 poses by connected artwork, preserving overlapping frame extents.
python3 tools/sprites/vaelric_s2.py [source dir] [sprite output] [metadata output]
The source is a presentation sheet, not a uniform8-column atlas. Faint haze may connect
neighbouring poses; strong components own whole shapes, and faint pixels follow their nearest shape.
"""
import hashlib
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

src = Path(sys.argv[1] if len(sys.argv) > 1 else 'art/incoming/vaelric/s2')
out = Path(sys.argv[2] if len(sys.argv) > 2 else 'public/sprites')
meta = Path(sys.argv[3] if len(sys.argv) > 3 else 'tmp/vaelric-s2/fx.json')
path = src / 's2_impact.png'
sha = hashlib.sha256(path.read_bytes()).hexdigest()
if sha != '7674a86e8d08a09f4755652d8c9254aca7aeeaf3da39e8b0a8030d84aa60fa13':
    raise ValueError('Review pose anchors/row gaps for a different S2 source')
a = np.array(Image.open(path).convert('RGBA'))
if a.shape != (724, 2172, 4):
    raise ValueError('Expected supplied2172x724 S2 Impact presentation sheet')
# Reviewed source-space horizontal pose centres and shared ground baselines.
anchors = np.array([115, 370, 645, 950, 1250, 1520, 1780, 2025])
rows, baselines = [0, 232, 461, 724], [195, 440, 695]
parts, bounds = [], []
for row in range(3):
    pixels = a[rows[row]:rows[row + 1]]
    strong = pixels[..., 3] > 8
    labels, count = ndimage.label(strong)
    owners = np.zeros(count + 1, np.int16)
    for index, box in enumerate(ndimage.find_objects(labels), 1):
        ys, xs = np.nonzero(labels[box] == index)
        # Whole components may extend past the neighbouring pose's nominal midpoint.
        x = float(np.median(xs + box[1].start))
        owners[index] = 1 + int(np.argmin(abs(anchors - x)))
    owned = owners[labels]
    _, nearest = ndimage.distance_transform_edt(~strong, return_indices=True)
    owned = np.where(strong, owned, owned[tuple(nearest)])
    owned[pixels[..., 3] == 0] = 0
    assert np.count_nonzero(owned) == np.count_nonzero(pixels[..., 3])
    for col in range(8):
        mask = owned == col + 1
        ys, xs = np.nonzero(mask)
        x0, x1 = int(xs.min()), int(xs.max()) + 1
        y0, y1 = int(ys.min()), int(ys.max()) + 1
        crop = pixels[y0:y1, x0:x1].copy()
        crop[~mask[y0:y1, x0:x1]] = 0
        box = [x0, y0 + rows[row], x1, y1 + rows[row]]
        relative = [box[0] - int(anchors[col]), box[1] - baselines[row],
                    box[2] - int(anchors[col]), box[3] - baselines[row]]
        bounds.append(relative)
        parts.append((row, col, crop, box, relative))
# One roomy canvas and one scale for all poses: no per-frame fitting, shrinking or clipping.
left = max(-min(b[0] for b in bounds), max(b[2] for b in bounds)) + 16
base = -min(b[1] for b in bounds) + 16
canvas_w, canvas_h = 2 * left, base + max(b[3] for b in bounds) + 16
scale = 112 / (724 / 3)  # same source-pixel density as the previous reviewed cut
w, scaled_h = round(canvas_w * scale), round(canvas_h * scale)
fit_cells = w * 2.25 / 126
prepared = []
frames = []
covered = 0
for row, col, crop, box, relative in parts:
    canvas = Image.new('RGBA', (canvas_w, canvas_h))
    canvas.alpha_composite(Image.fromarray(crop), (left + relative[0], base + relative[1]))
    expected = int(np.count_nonzero(crop[..., 3]))
    assert np.count_nonzero(np.array(canvas)[..., 3]) == expected, 'Source pixels clipped'
    covered += expected
    frame = canvas.resize((w, scaled_h), Image.Resampling.LANCZOS)
    alpha = np.array(frame)[..., 3]
    assert not (alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), 'Nontransparent frame edge'
    # Invisible near-zero-alpha haze must not make the visible base hover above the floor.
    # Register the lowest visible row, preserving every softer pixel below it in the gutter.
    ground = int(np.nonzero(alpha >= 8)[0].max()) + 1
    prepared.append((row, col, frame, ground, box, expected))
assert covered == np.count_nonzero(a[..., 3]), 'Every source pixel must belong to exactly one pose'
foot = max(ground - frame.getbbox()[1] for _, _, frame, ground, _, _ in prepared) + 8
h = foot + max(frame.getbbox()[3] - ground for _, _, frame, ground, _, _ in prepared) + 8
pivot = [0.5, foot / h]
strips = [Image.new('RGBA', (w * 8, h)) for _ in range(3)]
for row, col, frame, ground, box, expected in prepared:
    aligned = Image.new('RGBA', (w, h))
    shift = foot - ground
    aligned.paste(frame, (0, shift))
    assert np.array_equal(np.array(frame.crop(frame.getbbox())), np.array(aligned.crop(aligned.getbbox()))), 'Alignment changed/cut pixels'
    alpha = np.array(aligned)[..., 3]
    assert int(np.nonzero(alpha >= 8)[0].max()) + 1 == foot
    assert not (alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any()), 'Aligned frame edge'
    strips[row].alpha_composite(aligned, (col * w, 0))
    frames.append({'row': row + 1, 'frame': col + 1, 'sourceBox': box, 'ownedAlphaPixels': expected,
                   'groundShiftPx': shift, 'visibleGroundY': foot, 'nontransparentEdgePixels': 0})
out.mkdir(parents=True, exist_ok=True)
result = {}
for row, strip in enumerate(strips):
    file = f'fx-vaelric-s2-impact-{row + 1}.png'
    strip.save(out / file, optimize=True)
    result[str(row + 1)] = {'file': file, 'frames': 8, 'w': w, 'h': h, 'pivot': pivot,
                           'fitCells': fit_cells, 'dy': 27.25, 'sourceSha256': sha}
report = {'strips': result, 'sourceCanvas': [canvas_w, canvas_h], 'sourceCoveragePixels': covered,
          'clippedSourcePixels': 0, 'nontransparentFrameEdges': 0,
          'groundAlphaThreshold': 8, 'visibleGroundY': foot, 'frames': frames}
meta.parent.mkdir(parents=True, exist_ok=True)
meta.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'frames'}, indent=2))

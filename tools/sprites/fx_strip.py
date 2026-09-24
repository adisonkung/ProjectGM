"""Cut effect frames out of a source strip without straight cuts.

Frames in AI sheets often overlap (a big slash reaches into the next frame's area), so a
straight split line leaves hard edges. Instead:
  1. solid "core" blobs (alpha >= CORE) are labelled and each blob goes to the nearest frame centre;
  2. every other visible pixel (glow) goes to whichever core pixel is closest;
  3. glow further than REACH px from any core is dropped (background haze).
Each frame is then placed in its own cell with transparent padding, anchored on its centre.

build(src, y0, y1, centres, keep, scale, out) -> (cell_w, cell_h)
  centres: x of every frame in the strip (include ones you don't keep so they don't leak)
  keep:    indexes of centres to output, in playback order
"""
import numpy as np
from PIL import Image
from scipy import ndimage

CORE = 90
MIN_BLOB = 1  # raise for sheets with scattered noise specks
REACH = 24
PAD = 6


def build(src, y0, y1, centres, keep, scale, out, alpha_min=20, x_min=0, clear=None):
    A = np.array(Image.open(src).convert('RGBA')).astype(float)
    band = A[y0:y1].copy()
    band[band[..., 3] < alpha_min] = 0
    band[:, :x_min] = 0
    if clear is not None:
        clear(band)
    alpha = band[..., 3]
    core = alpha >= CORE
    lab, n = ndimage.label(ndimage.binary_dilation(core, iterations=1), structure=np.ones((3, 3)))
    lab[~core] = 0
    coms = ndimage.center_of_mass(core, lab, range(1, n + 1))
    owner_of = np.full(n + 1, -1)
    sizes = ndimage.sum(core, lab, range(1, n + 1))
    for j, (_, cx) in enumerate(coms):
        if sizes[j] < MIN_BLOB:
            continue
        owner_of[j + 1] = int(np.argmin([abs(cx - c) for c in centres]))
    core_owner = owner_of[lab]  # -1 where not core
    # nearest core pixel for every pixel
    dist, (iy, ix) = ndimage.distance_transform_edt(~core, return_indices=True)
    owner = core_owner[iy, ix]
    owner[(alpha <= 0) | (dist > REACH)] = -1

    frames = []
    for idx in keep:
        f = band.copy()
        f[owner != idx] = 0
        # soften glow that sits far from its core so no halo ends abruptly
        f[..., 3] *= np.clip((REACH - dist) / 8, 0, 1)
        frames.append((f, centres[idx]))

    half = 1
    top, bottom = band.shape[0], 0
    for f, cx in frames:
        ys, xs = np.nonzero(f[..., 3] > 4)
        if len(xs):
            half = max(half, int(np.ceil(max(cx - xs.min(), xs.max() - cx))) + 1)
            top, bottom = min(top, ys.min()), max(bottom, ys.max())
    cw = int(round(2 * half * scale)) + 2 * PAD
    ch = int(round((bottom - top + 1) * scale)) + 2 * PAD
    sheet = Image.new('RGBA', (cw * len(frames), ch), (0, 0, 0, 0))
    W = band.shape[1]
    for k, (f, cx) in enumerate(frames):
        x0, x1 = int(cx) - half, int(cx) + half
        pad_l = max(0, -x0)
        crop = f[top:bottom + 1, max(0, x0):min(W, x1)]
        img = Image.fromarray(np.clip(crop, 0, 255).astype(np.uint8))
        img = img.resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
        sheet.alpha_composite(img, (k * cw + PAD + round(pad_l * scale), PAD))
    sheet.save(out, optimize=True)
    return cw, ch

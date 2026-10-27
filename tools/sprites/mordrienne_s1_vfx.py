"""Mordrienne Vale — S1 Ashen Mark VFX + Timeline Sync bake (user 2026-10-26). Never modifies the source PNGs.

python3 tools/sprites/mordrienne_s1_vfx.py [source dir] [out dir] [--preview DIR]
Sources (assets/heroes/Mordrienne/vfx/, 8 frames in one row on a magenta key):
  Mordrienne_S1_CastCharge_VFX.png  → fx-mordrienne-s1-charge.png   (wand-tip charge, baked along the clip's wand tip)
  Mordrienne_S1_HexBolt_VFX.png     → fx-mordrienne-s1-bolt.png     (projectile: f1 spawn orb → f6 flight, f8 = impact)
  Mordrienne_S1_HexMark_VFX.png     → fx-mordrienne-s1-mark-in.png  (appear f1 → f5 burst → settle)
                                      fx-mordrienne-s1-mark.png     (status loop while Hex Mark lasts)

Frames are cut by connected pieces (each piece goes to the nearest of 8 evenly spaced slots — smoke reaching into a
neighbour's slot is never clipped), keyed by unmixing the magenta, the magenta spill pulled back to the green / ash
palette. Each frame keeps the artist's placement inside its slot (slot centre x, the strip's common centre y).
Baked at RES × atlas px (FxDef scale 1 / (FX_SCALE · RES)), drawn pixelated (no smoothing at runtime).

Timeline (S1 clip in sprites.ts, 17 frames): idle 0.00 → aim 0.05 (CAST_START, CastCharge starts at the wand tip and
follows it frame by frame) → wand-release frame F13 at 0.30 s (DAMAGE = the Hex Bolt leaves the tip; the charge
collapses in 75 ms) → flight → hit (magic damage + Hex Mark status + HexMark VFX on the target's upper body) →
recovery from 0.71 s, idle at 1.11 s.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

N, RES = 8, 2
FX_SCALE, PROJECTILE_SCALE = 1.5, 1.3
ROOT = (130, 155)  # hero cell root (feet) in atlas px

# S1 clip (row 5) frame timing — must match sprites.ts `hero-mordrienne.png` anims.skill.steps
STEPS = [50, 45, 45, 45, 55, 60, 120, 80, 70, 70, 70, 60, 60, 60, 60, 70, 90]
RELEASE = 6  # clip frame index of the wand-release frame (source F13)
# wand tip per clip frame 0–6 (atlas px, measured on the baked atlas row 5): aim F0–F10, raise F11–F12, thrust F13
TIP = [(170, 82), (170, 82), (170, 83), (170, 82), (145, 65), (163, 68), (203, 96)]

CHARGE_MS = 25          # charge strip frame time
CHARGE_PEAK_PX = 30     # charge width at its peak (atlas px) — small and concentrated at the wand tip
BOLT_PX = 60            # Hex Bolt length at full flight (atlas px)
MARK_PX = 40            # Hex Mark width at the appear burst (atlas px) — never hides the whole target; loop ~80 %


def unmix(rgb: np.ndarray) -> np.ndarray:
    rgb = rgb.astype(float)
    bg = np.median(np.concatenate([rgb[:6].reshape(-1, 3), rgb[-6:].reshape(-1, 3)]), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = np.clip(1 - (np.minimum(r, b) - g) / (min(bg[0], bg[2]) - bg[1]), 0, 1)
    al = np.where(al < 0.1, 0, al)
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    # magenta spill on soft smoke edges: ash / emerald never carry more red or blue than green (+ a little)
    lim = col[..., 1] * 0.85 + 28
    col[..., 0] = np.minimum(col[..., 0], lim)
    col[..., 2] = np.minimum(col[..., 2], lim)
    return np.dstack([col, al * 255])


def frame_centres(al: np.ndarray) -> np.ndarray:
    """x centres of the N drawn frames: 1-D k-means of the alpha mass per column (frames grow / spread unevenly)"""
    w = al.shape[1]
    mass = (al > 20).sum(0).astype(float)
    xs = np.arange(w, dtype=float)
    c = (np.arange(N) + 0.5) * w / N
    for _ in range(60):
        lab = np.argmin(np.abs(xs[:, None] - c[None]), 1)
        for k in range(N):
            m = mass[lab == k]
            if m.sum() > 0:
                c[k] = (xs[lab == k] * m).sum() / m.sum()
    return np.sort(c)


# drawn frame x centres per sheet (source px, read off the sheets — the frames grow / spread unevenly, so an even split
# or a k-means of the alpha mass merges the dense middle frames)
CENTRES = {
    'Mordrienne_S1_CastCharge_VFX.png': [152, 418, 690, 956, 1233, 1504, 1776, 2042],
    'Mordrienne_S1_HexMark_VFX.png': [136, 413, 698, 969, 1233, 1504, 1770, 2042],
    'Mordrienne_S1_HexBolt_VFX.png': [125, 364, 652, 982, 1348, 1721, 2069, 2351],
}


def cut(path: Path, align: str = 'core'):
    """→ [(frame RGBA, cx, cy)]: every connected piece to the nearest frame centre; the frame's own pivot =
    'core' (the bright sigil / orb centre, bbox centre when there is none) or 'tip' (rightmost point, core height)"""
    im = unmix(np.array(Image.open(path).convert('RGB')))
    im[:8] = 0
    im[-8:] = 0
    al = im[..., 3]
    centres = np.array(CENTRES[path.name], float) if path.name in CENTRES else frame_centres(al)
    lab, n = ndimage.label(ndimage.binary_dilation(al > 20, iterations=2))
    sizes = ndimage.sum(al > 20, lab, range(1, n + 1))
    frames = [np.zeros_like(im) for _ in range(N)]
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sizes[i - 1] < 12:
            continue
        m = lab[sl] == i
        xs = np.nonzero(m)[1] + sl[1].start
        inside = ((centres >= xs.min()) & (centres <= xs.max())).sum()
        if inside > 1:
            # smoke joins neighbouring frames into one piece: split it column-wise at the midpoints between centres
            cols = np.arange(sl[1].start, sl[1].stop)
            owner = np.argmin(np.abs(cols[:, None] - centres[None]), 1)
            for k in np.unique(owner):
                mk = m & (owner == k)[None, :]
                frames[k][sl] = np.where(mk[..., None], im[sl], frames[k][sl])
            continue
        k = int(np.argmin(np.abs(centres - xs.mean())))
        frames[k][sl] = np.where(m[..., None], im[sl], frames[k][sl])
    out = []
    for f in frames:
        a = f[..., 3]
        ys, xs = np.nonzero(a > 40)
        bright = (a > 200) & (f[..., 1] > 170)
        by, bx = np.nonzero(bright)
        cy = by.mean() if len(by) > 20 else (ys.min() + ys.max()) / 2
        if align == 'tip':
            cx = float(xs.max())
        else:
            cx = bx.mean() if len(bx) > 20 else (xs.min() + xs.max()) / 2
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        out.append((f[y0:y1, x0:x1], cx - x0, cy - y0))
    return out


def width_of(f: np.ndarray) -> int:
    xs = np.nonzero(f[..., 3].max(0) > 40)[0]
    return int(xs.max() - xs.min() + 1) if len(xs) else 1


def scaled(f: np.ndarray, s: float) -> Image.Image:
    img = Image.fromarray(np.clip(f, 0, 255).astype(np.uint8), 'RGBA')
    return img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)


def cells_around(frames, s, extra=2):
    """common cell for frames scaled by s, each frame centred on its (cx, cy)"""
    placed = [(scaled(f, s), cx * s, cy * s) for f, cx, cy in frames]
    half_w = max(max(px - b[0], b[2] - px) for (i, px, py) in placed if (b := i.getbbox()))
    half_h = max(max(py - b[1], b[3] - py) for (i, px, py) in placed if (b := i.getbbox()))
    W, H = 2 * int(np.ceil(half_w)) + 2 * extra, 2 * int(np.ceil(half_h)) + 2 * extra
    cells = []
    for img, px, py in placed:
        c = Image.new('RGBA', (W, H))
        c.alpha_composite(img, (int(round(W / 2 - px)), int(round(H / 2 - py))))
        cells.append(np.asarray(c).astype(np.float32))
    return cells, W, H


def blend(a: np.ndarray, b: np.ndarray, t: float, alpha: float = 1.0) -> np.ndarray:
    pa = a[..., :3] * a[..., 3:] / 255
    pb = b[..., :3] * b[..., 3:] / 255
    al = a[..., 3] * (1 - t) + b[..., 3] * t
    rgb = (pa * (1 - t) + pb * t) / np.maximum(al[..., None] / 255, 1e-3)
    return np.dstack([np.clip(rgb, 0, 255), al * alpha]).astype(np.uint8)


def strip(cells, seq) -> Image.Image:
    H, W = cells[0].shape[:2]
    out = Image.new('RGBA', (W * len(seq), H))
    for i, (a, b, t, alpha) in enumerate(seq):
        out.paste(Image.fromarray(blend(cells[a], cells[b], t, alpha), 'RGBA'), (i * W, 0))
    return out


def clip_frame_at(ms: float) -> int:
    acc = 0
    for i, s in enumerate(STEPS):
        if ms < acc + s:
            return i
        acc += s
    return len(STEPS) - 1


def build_charge(frames, out: Path):
    """CastCharge baked along the wand tip: grows f1 → f5 from CAST_START (0.05 s) to the release (0.30 s), then
    collapses f6 → f8 at the release tip in 75 ms. Canvas anchored on the hero root (feet) so it follows the body."""
    s = CHARGE_PEAK_PX * RES / width_of(frames[4][0])
    cells, cw, ch = cells_around(frames, s)
    start = STEPS[0]
    release = sum(STEPS[:RELEASE])
    n_grow = (release - start) // CHARGE_MS
    keys = []
    for i in range(n_grow):
        p = i / max(1, n_grow - 1) * 4          # f1 → f5 (0..4), cross-faded
        a = int(np.floor(p)); b = min(4, a + 1)
        keys.append((start + i * CHARGE_MS, a, b, p - a, 1.0))
    for j, k in enumerate((5, 6, 7)):           # collapse at the release
        keys.append((release + j * CHARGE_MS, k, k, 0, 1.0 - 0.25 * j))
    # canvas covers every tip position ± half a cell, root at a fixed point
    xs = [t[0] for t in TIP]; ys = [t[1] for t in TIP]
    left = (ROOT[0] - min(xs)) * RES + cw / 2; right = (max(xs) - ROOT[0]) * RES + cw / 2
    up = (ROOT[1] - min(ys)) * RES + ch / 2; down = max(0, (max(ys) - ROOT[1]) * RES + ch / 2)
    W, H = int(np.ceil(left + right)) + 2, int(np.ceil(up + down)) + 2
    rx, ry = int(np.ceil(left)) + 1, int(np.ceil(up)) + 1
    seq = []
    for t, a, b, tt, alpha in keys:
        tip = TIP[min(clip_frame_at(t), RELEASE)]
        canvas = np.zeros((H, W, 4), np.uint8)
        c = blend(cells[a], cells[b], tt, alpha)
        x0 = int(round(rx + (tip[0] - ROOT[0]) * RES - cw / 2)); y0 = int(round(ry + (tip[1] - ROOT[1]) * RES - ch / 2))
        canvas[y0:y0 + ch, x0:x0 + cw] = c
        seq.append(canvas)
    img = Image.fromarray(np.hstack(seq), 'RGBA')
    img.save(out, optimize=True)
    return {'frames': len(seq), 'w': W, 'h': H, 'frameMs': CHARGE_MS, 'delayMs': start,
            'pivot': [round(rx / W, 4), round(ry / H, 4)], 'scale': round(1 / (FX_SCALE * RES), 5)}


def build_bolt(frames, out: Path):
    """projectile strip: f1 spawn orb → f6 full bolt = flight frames (played once across the flight), f8 = impact"""
    s = BOLT_PX * RES / width_of(frames[4][0])
    f, _, cy = frames[7]
    frames = frames[:7] + [(f, f.shape[1] / 2, cy)]  # the impact burst centred on the target, not tip-aligned
    cells, W, H = cells_around(frames, s)
    seq = [(k, k, 0, 1.0) for k in (0, 1, 2, 3, 4, 5, 7)]
    strip(cells, seq).save(out, optimize=True)
    return {'frames': len(seq), 'w': W, 'h': H, 'scale': round(1 / (PROJECTILE_SCALE * RES), 5)}


def build_mark(frames, out_in: Path, out_loop: Path):
    """appear: f1 → f5 burst (peak MARK_PX) → settle onto f3 (40 ms keys) · loop: f3 ⇄ f4 breathing with in-betweens
    at 85 % opacity (100 ms keys), seamless"""
    s = MARK_PX * RES / width_of(frames[4][0])
    cells, W, H = cells_around(frames, s)
    appear = [(0, 0, 0, 1.0), (1, 1, 0, 1.0), (2, 2, 0, 1.0), (3, 3, 0, 1.0), (4, 4, 0, 1.0), (4, 4, 0, 1.0),
              (4, 3, 0.5, 0.95), (3, 3, 0, 0.9), (3, 2, 0.4, 0.85)]
    strip(cells, appear).save(out_in, optimize=True)
    loop = [(2, 2, 0, 0.85), (2, 3, 0.5, 0.85), (3, 3, 0, 0.85), (3, 2, 0.5, 0.85)]
    strip(cells, loop).save(out_loop, optimize=True)
    return {'in': len(appear), 'loop': len(loop), 'w': W, 'h': H, 'scale': round(1 / (FX_SCALE * RES), 5)}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src = Path(args[0] if args else 'assets/heroes/Mordrienne/vfx')
    out = Path(args[1] if len(args) > 1 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    res = {
        'charge': build_charge(cut(src / 'Mordrienne_S1_CastCharge_VFX.png'), out / 'fx-mordrienne-s1-charge.png'),
        'bolt': build_bolt(cut(src / 'Mordrienne_S1_HexBolt_VFX.png', 'tip'), out / 'fx-mordrienne-s1-bolt.png'),
        'mark': build_mark(cut(src / 'Mordrienne_S1_HexMark_VFX.png'), out / 'fx-mordrienne-s1-mark-in.png',
                           out / 'fx-mordrienne-s1-mark.png'),
    }
    print(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()

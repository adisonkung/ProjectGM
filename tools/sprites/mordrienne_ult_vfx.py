"""Mordrienne Vale — Ult House of Ashes VFX bake for the Timeline Sync (user 2026-10-27, revision 2026-10-27 #2).
Never modifies the sources.

python3 tools/sprites/mordrienne_ult_vfx.py [source dir] [out dir]
Sources (assets/heroes/Mordrienne/vfx/, one row on a magenta key) — mapping by content:
  Mordrienne_ULT_MagicCircleDraw_VFX.png        8 f (star → broken ring → serpent-skull sigil)  → fx-mordrienne-ult-circle.png
  Mordrienne_ULT_ChargeHold_VFX.png             8 f (inward vortex, peak f5)                    → fx-mordrienne-ult-charge.png
  Mordrienne_ULT_FieldActivationBurst_VFX.png  10 f (small field → eruption f6 → settles)       → fx-mordrienne-ult-burst.png
  Mordrienne_ULT_HouseOfAshesField_Loop_VFX.png 10 f (field + intermittent skull-serpent)        → fx-mordrienne-ult-field.png
                                                 + fade-out at the field end                     → fx-mordrienne-ult-field-end.png
  Mordrienne_ULT_CastAura_VFX.png               12 f on black (4 × 3: rise f1–f4, full f5–f8, fade f9–f12) → fx-mordrienne-ult-aura.png

Character clip (sprites.ts hero-mordrienne.png row 7, STEPS below): draw the circle 0.05–1.03 s → raise 1.03 (CHARGE_START)
→ hold 1.21–1.96 (revision #2: +0.3 s) → over the head (peak) → wand down 2.14 (release) → ground 2.32 (VFX_SPAWN =
activation) → recovery.

* aura (revision #2): behind her from CAST_START, rises f1 → f4, loops f5 → f8 (cross-faded, cyclic) until the wand hits the
  ground (VFX_SPAWN), then f9 → f12 fade out
* revision #2: the charge vortex spins while it grows and loops f5 → f6 → f5 → f4 (cross-faded) over the longer hold;
  burst / field frames are split along a seam between touching frames (the column split used to shave the eruption's sides);
  the field ring = 3 cells (240 atlas px), the burst erupts at a smaller ring (180) and widens to the field in its last frames

* circle: small (pre-scaled, RES × atlas px, pixelated) centred on the circle she draws (atlas 166, 107): grows f1 → f8
  with the drawing, holds the full sigil, fades as she raises the wand (no ground field here)
* charge: small, at the raised wand tip (atlas 136, 48): f1 → f5 over the raise + hold, holds the peak until the release,
  collapses f6 → f8 in 90 ms at the wand-down frame
* burst / field / field-end: the artist's pixels (no resampling), one pivot = the star centre on the ground ring,
  the same scale for all three (ring → RING_ATLAS atlas px ≈ the 3 × 3 field) — the burst's last frames are the loop's
  first look, the loop's f10 → f1 is seamless, the end strip fades from the loop's f1
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from mordrienne_s1_vfx import blend, cells_around, width_of  # noqa: E402
from mordrienne_s1_vfx import unmix  # noqa: E402
from mordrienne_s2_vfx import cut  # noqa: E402
from scipy import ndimage  # noqa: E402

FX_SCALE, RES = 1.5, 2
STEPS = [50, *[70] * 14, 60, 60, 60, 750, 60, 60, 60, 45, 45, 45, 45, 90, 80, 80, 80, 80]
CAST, CHARGE_START, HOLD, RELEASE, ACTIVATE = 1, 15, 18, 22, 26
at = lambda i: sum(STEPS[:i])  # noqa: E731  ms

CIRCLE_PX = 56     # drawn sigil width at full size (atlas px) ≈ the circle her wand trail draws (~50 px)
CHARGE_PX = 50     # charge vortex width at its peak (atlas px)
RING_SRC = 175     # field ring diameter in the burst / loop sheets (source px)
RING_ATLAS = 240   # on the board: the 3 × 3 field = 3 cells (80 px = 1 cell)
BURST_RING = [180] * 6 + [184, 200, 220, 240]   # the eruption a little smaller, then the ring widens into the field
GROW_MS = 420      # charge f1 → f5 from CHARGE_START, then the loop until the release
CHARGE_KEYS, CHARGE_KEY_MS = [4, 5, 4, 3], 150
SPIN = -150        # charge vortex spin (deg / s, clockwise)
AURA_PX = 120      # cast aura ground-ring width (atlas px) ≈ 1.5 cells
AURA_MS = 50
AURA_KEYS, AURA_KEY_MS = [4, 5, 6, 7], 150
CIRCLE_MS = 98     # 10 keys from 0.05 s to the raise (1.03 s)
CHARGE_MS = 30

SHEETS = {
    'circle': ('Mordrienne_ULT_MagicCircleDraw_VFX.png', [75, 233, 422, 633, 858, 1098, 1330, 1555], 477, 'star'),
    'charge': ('Mordrienne_ULT_ChargeHold_VFX.png', [132, 392, 657, 927, 1216, 1511, 1781, 2038], 360, 'fixed'),
    'burst': ('Mordrienne_ULT_FieldActivationBurst_VFX.png',
              [98, 282, 472, 679, 891, 1146, 1412, 1656, 1863, 2063], 401, 'star'),
    'field': ('Mordrienne_ULT_HouseOfAshesField_Loop_VFX.png',
              [109, 331, 554, 777, 994, 1211, 1434, 1651, 1868, 2069], 389, 'star'),
}


def save(cells, seq, out: Path):
    H, W = cells[0].shape[:2]
    img = Image.new('RGBA', (W * len(seq), H))
    for i, (a, b, t, alpha) in enumerate(seq):
        img.paste(Image.fromarray(blend(cells[a], cells[b], t, alpha), 'RGBA'), (i * W, 0))
    img.save(out, optimize=True)
    return {'frames': len(seq), 'w': W, 'h': H}


def canvas(frames, extra=2):
    """unresampled common canvas around the pivot (pivot at the horizontal centre) → cells, pivot fraction"""
    hw = up = dn = 0
    for f, px, py in frames:
        ys, xs = np.nonzero(f[..., 3] > 8)
        if len(xs):
            hw = max(hw, px - xs.min(), xs.max() + 1 - px)
            up, dn = max(up, py - ys.min()), max(dn, ys.max() + 1 - py)
    W, U, D = 2 * int(np.ceil(hw)) + 2 * extra, int(np.ceil(up)) + extra, int(np.ceil(dn)) + extra
    H = U + D
    cells = []
    for f, px, py in frames:
        c = np.zeros((H, W, 4), np.float32)
        x0, y0 = int(round(px)) - W // 2, int(round(py)) - U
        src = f[max(0, y0):y0 + H, max(0, x0):x0 + W]
        c[max(0, -y0):max(0, -y0) + src.shape[0], max(0, -x0):max(0, -x0) + src.shape[1]] = np.clip(src, 0, 255)
        cells.append(c)
    return cells, [round((W // 2) / W, 6), round(U / H, 6)]


def small(frames, px_peak, peak):
    """pre-scaled (LANCZOS) cells at RES × atlas px, centred on each frame's pivot"""
    crop = []
    for f, cx, cy in frames:
        ys, xs = np.nonzero(f[..., 3] > 8)
        x0, y0 = xs.min(), ys.min()
        crop.append((f[y0:ys.max() + 1, x0:xs.max() + 1], cx - x0, cy - y0))
    s = px_peak * RES / width_of(crop[peak][0])
    cells, W, H = cells_around(crop, s)
    return cells


def seam_split(m, alpha, centres, x0):
    """owner index per pixel of mask m (box starting at column x0): pieces between neighbouring centres are separated by
    a top → bottom least-alpha seam (DP, ±1 px per row), not a straight column, so a touching spike or smoke tip keeps
    its frame"""
    h, w = m.shape
    cost = np.where(m, alpha, 0).astype(np.float64) + 1.0
    owner = np.zeros((h, w), int)
    xs = np.arange(w)[None, :] + x0
    for k in range(len(centres) - 1):
        a, b = centres[k] - x0, centres[k + 1] - x0
        lo, hi = int(max(0, a + 0.2 * (b - a))), int(min(w - 1, b - 0.2 * (b - a)))
        c = cost[:, lo:hi + 1]
        acc = c.copy()
        back = np.zeros_like(acc, int)
        for y in range(1, h):
            prev = acc[y - 1]
            cand = np.stack([np.r_[np.inf, prev[:-1]], prev, np.r_[prev[1:], np.inf]])
            j = np.argmin(cand, 0)
            back[y] = j - 1
            acc[y] += cand[j, np.arange(len(prev))]
        seam = np.zeros(h, int)
        seam[-1] = int(np.argmin(acc[-1]))
        for y in range(h - 1, 0, -1):
            seam[y - 1] = seam[y] + back[y, seam[y]]
        owner += (xs - x0 > (seam + lo)[:, None])
    return owner


def seam_cut(path: Path, centres, ground: int, mode: str):
    """like mordrienne_s2_vfx.cut, but frames that touch are split along a seam"""
    im = unmix(np.array(Image.open(path).convert('RGB')))
    im[:6] = 0
    im[-6:] = 0
    im[:, :6] = 0
    im[:, -6:] = 0
    al = im[..., 3]
    centres = np.array(centres, float)
    n = len(centres)
    lab, cnt = ndimage.label(ndimage.binary_dilation(al > 20, iterations=2))
    sizes = ndimage.sum(al > 20, lab, range(1, cnt + 1))
    frames = [np.zeros_like(im) for _ in range(n)]
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        if sizes[i - 1] < 10:
            continue
        m = lab[sl] == i
        xs = np.nonzero(m)[1] + sl[1].start
        inside = np.nonzero((centres >= xs.min()) & (centres <= xs.max()))[0]
        if len(inside) > 1:
            own = seam_split(m, al[sl], centres[inside], sl[1].start)
            for j, k in enumerate(inside):
                mk = m & (own == j)
                frames[k][sl] = np.where(mk[..., None], im[sl], frames[k][sl])
            continue
        k = int(np.argmin(np.abs(centres - xs.mean())))
        frames[k][sl] = np.where(m[..., None], im[sl], frames[k][sl])
    out = []
    for k, f in enumerate(frames):
        cx = centres[k]
        if mode == 'star':
            br = (f[..., 3] > 200) & (f[..., 1] > 150)
            x0 = int(cx - 60)
            colsum = br[ground - 60:ground + 60, x0:x0 + 120].sum(0)
            if colsum.max() > 8:
                cx = x0 + float(np.argmax(colsum))
        out.append((f, cx, float(ground)))
    return out


def rescale(frame, px, py, r):
    """frame scaled by r about its pivot (premultiplied LANCZOS) → (frame, pivot)"""
    if abs(r - 1) < 1e-6:
        return frame, px, py
    f = frame.astype(np.float32)
    pm = np.dstack([f[..., :3] * f[..., 3:] / 255, f[..., 3]])
    H, W = f.shape[:2]
    nw, nh = max(1, round(W * r)), max(1, round(H * r))
    ch = [np.asarray(Image.fromarray(pm[..., c]).resize((nw, nh), Image.LANCZOS)) for c in range(4)]
    a = np.clip(ch[3], 0, 255)
    rgb = np.stack(ch[:3], -1) / np.maximum(a[..., None] / 255, 1e-3)
    return np.dstack([np.clip(rgb, 0, 255), a]).astype(np.float32), px * r, py * r


def aura_frames(path: Path):
    """12 frames (4 × 3 grid) on black: alpha = brightness, colour un-premultiplied; whole connected pieces go to the cell
    of their centre (the full-size frames' sigil tops reach into the row above); pivot = centre of the ground ring"""
    rgb = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    mx = rgb.max(2)
    # revision #3 (user: deeper colour): denser alpha + deep emerald (a little darker, more saturated, ash stays dark)
    a = np.clip((mx - 8) / 110, 0, 1) ** 0.7 * 255
    hue = rgb / np.maximum(mx[..., None], 1)
    grey = hue.mean(2, keepdims=True)
    hue = np.clip(grey + (hue - grey) * 1.35, 0, 1)
    col = hue * np.clip(mx[..., None] * 0.92, 0, 255)
    im = np.dstack([np.clip(col, 0, 255), a])
    H, W = im.shape[:2]
    ch, cw = H / 3, W / 4
    lab, cnt = ndimage.label(ndimage.binary_dilation(mx > 14, iterations=2))
    frames = [np.zeros_like(im) for _ in range(12)]
    com = ndimage.center_of_mass(mx > 14, lab, range(1, cnt + 1))
    for i, sl in enumerate(ndimage.find_objects(lab), 1):
        cy, cx = com[i - 1]
        k = min(2, int(cy // ch)) * 4 + min(3, int(cx // cw))
        m = lab[sl] == i
        frames[k][sl] = np.where(m[..., None], im[sl], frames[k][sl])
    out = []
    for k, f in enumerate(frames):
        r, c = divmod(k, 4)
        y0 = int(r * ch)
        band = f[y0 + 200:int((r + 1) * ch), int(c * cw):int((c + 1) * cw), 3] > 150
        gy = y0 + 200 + int(np.argmax(band.sum(1)))
        xs = np.nonzero(f[gy - 4:gy + 5, int(c * cw):int((c + 1) * cw), 3].max(0) > 60)[0]
        gx = c * cw + (xs.min() + xs.max()) / 2 if len(xs) else c * cw + cw / 2
        out.append((f, gx, float(gy), (xs.max() - xs.min()) if len(xs) else 0))
    return out


def square(cells):
    """pad cells (pivot at the centre) to a square that holds any rotation"""
    H, W = cells[0].shape[:2]
    S = int(np.ceil(np.hypot(W, H))) // 2 * 2 + 2
    out = []
    for c in cells:
        q = np.zeros((S, S, 4), np.float32)
        q[(S - H) // 2:(S - H) // 2 + H, (S - W) // 2:(S - W) // 2 + W] = c
        out.append(q)
    return out


def rotate(cell, deg):
    if abs(deg) < 1e-3:
        return cell
    return np.asarray(Image.fromarray(cell.astype(np.uint8), 'RGBA').rotate(deg, Image.NEAREST)).astype(np.float32)


def save_cells(cells, out: Path):
    H, W = cells[0].shape[:2]
    img = Image.new('RGBA', (W * len(cells), H))
    for i, c in enumerate(cells):
        img.paste(Image.fromarray(np.clip(c, 0, 255).astype(np.uint8), 'RGBA'), (i * W, 0))
    img.save(out, optimize=True)
    return {'frames': len(cells), 'w': W, 'h': H}


def keyed(cells, keys, key_ms, frame_ms, t):
    """cyclic cross-fade through keys at time t (ms) → (a, b, mix)"""
    p = t / key_ms
    i = int(np.floor(p))
    return keys[i % len(keys)], keys[(i + 1) % len(keys)], p - i


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    src = Path(args[0] if args else 'assets/heroes/Mordrienne/vfx')
    out = Path(args[1] if len(args) > 1 else 'public/sprites')
    out.mkdir(parents=True, exist_ok=True)
    fr = {k: (seam_cut if k in ('burst', 'field') else cut)(src / name, centres, ground, mode)
          for k, (name, centres, ground, mode) in SHEETS.items()}
    res = {}

    # magic circle: f1 → f8 across the drawing (CAST_START 0.05 → raise 1.03), the full sigil held for the last keys
    cells = small(fr['circle'], CIRCLE_PX, 7)
    seq = [(k, k, 0, 1.0) for k in range(8)] + [(7, 7, 0, 1.0), (7, 7, 0, 0.92)]
    res['circle'] = {**save(cells, seq, out / 'fx-mordrienne-ult-circle.png'), 'frameMs': CIRCLE_MS,
                     'span': [at(CAST), at(CAST) + len(seq) * CIRCLE_MS], 'raise': at(CHARGE_START)}

    # charge: spins the whole time; grow f1 → f5 (cross-faded) for GROW_MS from CHARGE_START, then loop
    # f5 → f6 → f5 → f4 (cross-faded) over the hold, collapse f6 → f8 at the release (wand-down) frame
    cells = square(small(fr['charge'], CHARGE_PX, 4))
    grow = GROW_MS // CHARGE_MS
    loop = (at(RELEASE) - at(CHARGE_START)) // CHARGE_MS - grow
    frames = []
    for i in range(grow):
        p = i / max(1, grow - 1) * 4
        a = int(np.floor(p))
        frames.append(blend(cells[a], cells[min(4, a + 1)], p - a))
    for i in range(loop):
        a, b, t = keyed(cells, CHARGE_KEYS, CHARGE_KEY_MS, CHARGE_MS, i * CHARGE_MS)
        frames.append(blend(cells[a], cells[b], t))
    for k, al in ((5, 0.9), (6, 0.7), (7, 0.45)):
        frames.append(blend(cells[k], cells[k], 0, al))
    frames = [rotate(f, SPIN * i * CHARGE_MS / 1000) for i, f in enumerate(frames)]
    ys, xs = np.nonzero(np.max([f[..., 3] for f in frames], 0) > 8)
    r = int(max(abs(xs - frames[0].shape[1] / 2).max(), abs(ys - frames[0].shape[0] / 2).max())) + 2
    c0 = frames[0].shape[0] // 2
    frames = [f[c0 - r:c0 + r, c0 - r:c0 + r] for f in frames]
    res['charge'] = {**save_cells(frames, out / 'fx-mordrienne-ult-charge.png'), 'frameMs': CHARGE_MS,
                     'loopFrom': at(CHARGE_START) + grow * CHARGE_MS,
                     'collapseAt': at(CHARGE_START) + (grow + loop) * CHARGE_MS, 'release': at(RELEASE)}

    # cast aura: from CAST_START, rise f1 → f4, cyclic loop f5 → f8 until VFX_SPAWN, then f9 → f12 fading out
    af = aura_frames(src / 'Mordrienne_ULT_CastAura_VFX.png')
    ring = af[5][3]
    sc = AURA_PX * RES / ring
    cells, apiv = canvas([rescale(f, x, y, sc) for f, x, y, _ in af])   # tight canvas, pivot on the ground ring
    rise = 400 // AURA_MS
    hold = (at(ACTIVATE) - at(CAST)) // AURA_MS - rise
    seq = []
    for i in range(rise):
        p = i / (rise - 1) * 3
        a = int(np.floor(p))
        seq.append((a, min(3, a + 1), p - a, 1.0))
    for i in range(hold):
        a, b, t = keyed(cells, AURA_KEYS, AURA_KEY_MS, AURA_MS, i * AURA_MS)
        seq.append((a, b, t, 1.0))
    a, b, t, _ = seq[-1]
    for k, al in ((8, 0.8), (9, 0.55), (10, 0.32), (11, 0.12)):
        seq.append((k, k, 0, al))
    res['aura'] = {**save(cells, seq, out / 'fx-mordrienne-ult-aura.png'), 'frameMs': AURA_MS,
                   'loopFrom': at(CAST) + rise * AURA_MS, 'fadeAt': at(CAST) + (rise + hold) * AURA_MS,
                   'spawn': at(ACTIVATE), 'pivot': apiv}

    # burst + field + end on ONE canvas (same pivot / scale) so the hand-off is pixel-exact; the burst frames are
    # resized about the pivot so the eruption is a little smaller and the ring widens into the field
    k = RING_ATLAS / RING_SRC
    burst = [rescale(f, px, py, BURST_RING[i] / RING_ATLAS) for i, (f, px, py) in enumerate(fr['burst'])]
    cells, pivot = canvas(burst + fr['field'])
    burst, field = cells[:10], cells[10:]
    H, W = cells[0].shape[:2]
    save(burst, [(k2, k2, 0, 1.0) for k2 in range(10)], out / 'fx-mordrienne-ult-burst.png')
    save(field, [(k2, k2, 0, 1.0) for k2 in range(10)], out / 'fx-mordrienne-ult-field.png')
    # end: the loop's f1 (no skull) with the rune glow / smoke thinning, embers going out
    end = [(0, 0, 0, a) for a in (0.92, 0.8, 0.66, 0.52, 0.38, 0.26, 0.15, 0.07)]
    save(field, end, out / 'fx-mordrienne-ult-field-end.png')
    res['field'] = {'w': W, 'h': H, 'pivot': pivot, 'scale': round(k / FX_SCALE, 6),
                    'frames': {'burst': 10, 'field': 10, 'end': len(end)}}
    print(json.dumps(res, indent=1))


if __name__ == '__main__':
    main()

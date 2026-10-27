"""Bai Long — Nine Dragon Sequence charge aura (user 2026-10-27: "ทีกดใช้ตั้งท่าชาจ รอออร่าขึ้นครบค่อยรำ ultimate").

python3 tools/sprites/bailong_ult_charge.py [source] [out dir] [--preview out.png]
Source: assets/heroes/BaiLong/vfx/Bailong_ULT_ChargeAura_VFX.png — 10 painted frames (5 × 2) on black with an "F1…F10"
caption under each frame. Black → alpha from brightness (colour un-premultiplied), captions dropped (rows below the
art), each frame placed on one common canvas by the centre of its ground ring (= Bai Long's feet). The ring and the
white dragon grow F1 → F10 exactly as painted (no per-frame normalising).

→ public/sprites/fx-bailong-ult-charge.png: F1 … F10 + F10 held (HOLD extra frames) — FX 'bl-ult-charge' plays it once
from CHARGE_START at FRAME_MS, so the dragon has fully risen just before the dance starts, then fades out (fadeOutMs).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SRC = Path('assets/heroes/BaiLong/vfx/Bailong_ULT_ChargeAura_VFX.png')
OUT = Path('public/sprites')
ROWS = [(0, 300), (340, 662)]   # art bands; the F-number captions sit below each (y 305–335 / 668–705)
BAKE = 0.75                     # source px → strip px (the FX scale in sprites.ts sets the board size)
HOLD = 2                        # extra F10 frames before the fade
FRAME_MS = 80
RING_UP = 20                    # ground-ring centre above its lower edge (source px)


def load(path: Path):
    rgb = np.array(Image.open(path).convert('RGB')).astype(np.float32)
    mx = rgb.max(2)
    a = np.clip((mx - 10) / 120, 0, 1) ** 0.75 * 255
    col = rgb / np.maximum(mx[..., None], 1) * mx[..., None] / np.maximum(a[..., None] / 255, 1e-3)
    return np.dstack([np.clip(col, 0, 255), a]), mx


def frames(im, mx):
    """10 frames in reading order, each (rgba, pivot x, pivot y) in its own crop"""
    out = []
    for y0, y1 in ROWS:
        cols = (mx[y0:y1] > 30).sum(0) > 0
        lab, n = ndimage.label(ndimage.binary_closing(cols, iterations=20))
        spans = sorted((s[0].start, s[0].stop) for s in ndimage.find_objects(lab))
        spans = [s for s in spans if s[1] - s[0] > 50]
        assert len(spans) == 5, spans
        for x0, x1 in spans:
            f = im[y0:y1, max(0, x0 - 4):x1 + 4].copy()
            f[..., 3] *= (mx[y0:y1, max(0, x0 - 4):x1 + 4] > 6)
            al = f[..., 3]
            # ground ring: its lower edge = the lowest row still ≥ 40 % of the widest lit row (the widest row itself
            # is sometimes a swirl band of the taller frames); pivot = RING_UP px above that edge, middle of the row
            widths = (al > 120).sum(1)
            low = int(np.nonzero(widths > 0.4 * widths.max())[0].max())
            gy = low - RING_UP
            xs = np.nonzero(al[gy - 3:gy + 4].max(0) > 60)[0]
            gx = (xs.min() + xs.max()) / 2
            out.append((f, gx, float(gy), int(xs.max() - xs.min())))
    return out


def rescale(f, px, py, r):
    pm = np.dstack([f[..., :3] * f[..., 3:] / 255, f[..., 3]])
    H, W = f.shape[:2]
    nw, nh = round(W * r), round(H * r)
    ch = [np.asarray(Image.fromarray(pm[..., c].astype(np.float32)).resize((nw, nh), Image.LANCZOS)) for c in range(4)]
    a = np.clip(ch[3], 0, 255)
    rgb = np.stack(ch[:3], -1) / np.maximum(a[..., None] / 255, 1e-3)
    return np.dstack([np.clip(rgb, 0, 255), a]), px * r, py * r


def canvas(fr, extra=2):
    hw = up = dn = 0
    for f, px, py in fr:
        ys, xs = np.nonzero(f[..., 3] > 6)
        hw = max(hw, px - xs.min(), xs.max() + 1 - px)
        up, dn = max(up, py - ys.min()), max(dn, ys.max() + 1 - py)
    W, U, D = 2 * int(np.ceil(hw)) + 2 * extra, int(np.ceil(up)) + extra, int(np.ceil(dn)) + extra
    H = U + D
    cells = []
    for f, px, py in fr:
        c = np.zeros((H, W, 4), np.float32)
        x0, y0 = int(round(px)) - W // 2, int(round(py)) - U
        src = f[max(0, y0):y0 + H, max(0, x0):x0 + W]
        c[max(0, -y0):max(0, -y0) + src.shape[0], max(0, -x0):max(0, -x0) + src.shape[1]] = src
        cells.append(c)
    return cells, [round((W // 2) / W, 6), round(U / H, 6)]


def build(src=SRC, out=OUT):
    im, mx = load(Path(src))
    raw = frames(im, mx)
    scaled = [rescale(f, px, py, BAKE) for f, px, py, _ in raw]
    cells, pivot = canvas(scaled)
    cells += [cells[-1]] * HOLD
    H, W = cells[0].shape[:2]
    strip = np.concatenate(cells, 1)
    Path(out).mkdir(parents=True, exist_ok=True)
    Image.fromarray(np.clip(strip, 0, 255).astype(np.uint8), 'RGBA').save(Path(out) / 'fx-bailong-ult-charge.png')
    rep = {'frames': len(cells), 'w': W, 'h': H, 'pivot': pivot, 'frameMs': FRAME_MS,
           'ringSrc': [r[3] for r in raw], 'ringBaked': round(raw[-1][3] * BAKE, 1)}
    print(json.dumps(rep))
    return cells, rep


def preview(cells, path):
    H, W = cells[0].shape[:2]
    sheet = Image.new('RGBA', (W * 6, H * 2), (40, 44, 56, 255))
    for i, c in enumerate(cells[:12]):
        sheet.alpha_composite(Image.fromarray(np.clip(c, 0, 255).astype(np.uint8)), ((i % 6) * W, (i // 6) * H))
    sheet.save(path)


if __name__ == '__main__':
    argv = sys.argv[1:]
    prev = argv.index('--preview') if '--preview' in argv else None
    args = [a for i, a in enumerate(argv) if not a.startswith('--') and (prev is None or i != prev + 1)]
    cells, _ = build(args[0] if args else SRC, args[1] if len(args) > 1 else OUT)
    if '--preview' in sys.argv:
        preview(cells, sys.argv[sys.argv.index('--preview') + 1])

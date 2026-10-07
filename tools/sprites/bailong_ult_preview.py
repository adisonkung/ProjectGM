"""Bai Long — Nine Dragon Sequence: 2.45 s composited preview at 60 FPS (T000–T146) from the game assets.

Sources (all already in the game, nothing redrawn):
  public/sprites/hero-bailong.png row 7    character C01–C20 (19 drawn frames; C05 reuses the dash pose C04)
  public/sprites/fx-bailong-v3-*.png       hint / emerge / ascent / core / dive / impact / residual
  scratch fx-coilA.png                     Coil Loop A (cut from art/incoming/bailong/v3_coilA.png)

Tracks (kept separate, composited per timeline frame):
  root      ground x + forward travel (dash) and airborne height — the poses are placed by their lowest point,
            never shifted inside their cells
  spearTip  measured per pose (extreme point along the pose's attack direction) → hint / flashes / dive follow it
  ground    contact point G = spear tip of C18 on the ground → final impact, shockwave, residual
  dragon    each VFX frame: own anchor + scale + opacity envelope, split into a BEHIND part and a FRONT part
            (coil / core: head side ≈ 40 % in front, body ≈ 60 % behind)
  camera    shake offsets (T033 small, T115–T122 strong)
Layers back → front: 1 background · 2 ground aura + far ring · 3 dragon behind · 4 Bai Long · 5 dragon front ·
6 tip flash / contact / near ring. The face box and spear tip are cut out of layer 5.

Writes: <out>/bailong_ult_preview_60fps.mp4, _50fps.gif, _contact.png, bailong_ult_timeline.json
Usage: python3 tools/sprites/bailong_ult_preview.py <scratch dir with fx-coilA.png> <out dir>
"""
import json
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SCR = sys.argv[1]
OUT = sys.argv[2]
TAG = sys.argv[3] if len(sys.argv) > 3 else ''          # output name suffix, e.g. _v2
FPS, N = 60, 147
W, H, UP = 460, 300, 3                         # canvas in sheet px, upscaled ×3 nearest
GROUND, X0 = 250, 140                          # Bai Long's root (feet) on the canvas
CELL_W, CELL_H = 220, 170

# ------------------------------------------------------------------ character
sheet = np.array(Image.open('public/sprites/hero-bailong.png').convert('RGBA'))
ROW = sheet[7 * CELL_H:8 * CELL_H]
DRAWN = [1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]     # C01..C20 → drawn frame
DIRS = {6: (1, 0), 7: (1, 0), 5: (1, 0), 8: (1, .2), 9: (1, -.3), 10: (1, -.3), 16: (.3, 1), 17: (.4, 1), 18: (.6, 1)}
CHAR_T = [(0, 7, 1), (8, 14, 2), (15, 19, 3), (20, 24, 4), (25, 29, 5), (30, 35, 6), (36, 44, 7), (45, 51, 8),
          (52, 57, 9), (58, 64, 10), (65, 71, 11), (72, 78, 12), (79, 85, 13), (86, 90, 14), (91, 95, 15),
          (96, 104, 16), (105, 112, 17), (113, 122, 18), (123, 130, 19), (131, 146, 20)]


def pose(c):
    cell = ROW[:, (DRAWN[c - 1] - 1) * CELL_W:DRAWN[c - 1] * CELL_W].copy()
    m = cell[..., 3] > 0
    ys, xs = np.nonzero(m)
    crop = cell[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    body = ndimage.binary_opening(crop[..., 3] >= 128, structure=np.ones((5, 5)))
    by, bx = np.nonzero(body)
    top, bot = by.min(), by.max()
    band = (by > top + .2 * (bot - top)) & (by < top + .55 * (bot - top))
    torso = (float(np.median(bx[band])), float(np.median(by[band])))
    d = np.array(DIRS.get(c, (1, -.25)), float)
    py, px = np.nonzero(crop[..., 3] > 0)
    k = int(np.argmax(px * d[0] + py * d[1]))
    head = (top, top + .22 * (bot - top), np.percentile(bx[by < top + .22 * (bot - top)], [5, 95]))
    return {'img': crop, 'torso': torso, 'tip': (float(px[k]), float(py[k])), 'h': crop.shape[0], 'head': head}


POSES = {c: pose(c) for c in range(1, 21)}


def char_at(t):
    for a, b, c in CHAR_T:
        if a <= t <= b:
            return c


def lerp_keys(keys, t):
    ks = sorted(keys)
    if t <= ks[0][0]:
        return ks[0][1]
    for (a, va), (b, vb) in zip(ks, ks[1:]):
        if a <= t <= b:
            u = (t - a) / (b - a)
            u = u * u * (3 - 2 * u)
            return va + (vb - va) * u
    return ks[-1][1]


# root tracks (sheet px): forward travel of the dash / sweep, airborne height of the lowest point
TRAVEL = [(0, 0), (15, 0), (30, 14), (44, 18), (64, 18), (85, 22), (112, 30), (146, 30)]
HEIGHT = [(0, 0), (66, 0), (72, 22), (79, 44), (86, 58), (91, 64), (96, 60), (104, 34), (112, 0), (146, 0)]


def placement(t):
    c = char_at(t)
    p = POSES[c]
    x = X0 + lerp_keys(TRAVEL, t)
    y = GROUND - lerp_keys(HEIGHT, t)
    ox, oy = x - p['torso'][0], y - p['h']
    return c, p, round(ox), round(oy)


# ------------------------------------------------------------------ VFX sources
def strip(path, n):
    a = np.array(Image.open(path).convert('RGBA'))
    w = a.shape[1] // n
    return [a[:, i * w:(i + 1) * w] for i in range(n)]


FX = {
    'hint': strip('public/sprites/fx-bailong-v3-hint.png', 6),
    'emerge': strip('public/sprites/fx-bailong-v3-emerge.png', 8),
    'ascent': strip('public/sprites/fx-bailong-v3-ascent.png', 8),
    'coilA': strip(f'{SCR}/fx-coilA.png', 10),
    'core': strip('public/sprites/fx-bailong-v3-core.png', 12),
    'dive': strip('public/sprites/fx-bailong-v3-dive.png', 8),
    'impact': strip('public/sprites/fx-bailong-v3-impact.png', 10),
    'residual': strip('public/sprites/fx-bailong-v3-residual.png', 6),
    # v2 start / end (user sheets 2026-10-07): ground charge (10) · final ground impact with debris + ring (12)
    'charge': strip('public/sprites/fx-bailong-v3-charge.png', 10),
    'final': strip('public/sprites/fx-bailong-v3-final.png', 12),
}
# strip px → sheet px (game FX scale × FX_SCALE 1.5)
SC = {'hint': .5, 'emerge': .6, 'ascent': .6, 'coilA': .8, 'core': .82, 'dive': .5, 'impact': .55, 'residual': .45, 'charge': .72, 'final': .9}


def scaled(a, s, sx=None):
    img = Image.fromarray(a)
    w, h = max(1, round(img.width * (sx or s))), max(1, round(img.height * s))
    return np.array(img.resize((w, h), Image.NEAREST))


def bbox(a):
    ys, xs = np.nonzero(a[..., 3] > 0)
    return (xs.min(), xs.max(), ys.min(), ys.max()) if len(xs) else (0, 0, 0, 0)


def split(a, mode):
    """(behind, front) parts of one dragon frame"""
    x0, x1, y0, y1 = bbox(a)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    if mode == 'head40':          # head / front arc = the head-side 40 % (heads face right)
        f = xx > x0 + .64 * (x1 - x0)
    elif mode == 'tip':           # leading flash at the right end
        f = xx > x0 + .78 * (x1 - x0)
    elif mode == 'band':          # one curved section crossing his lower body
        f = (yy > y0 + .5 * (y1 - y0)) & (yy < y0 + .68 * (y1 - y0))
    elif mode == 'base':          # bright base / near ground in front
        f = yy > y0 + .86 * (y1 - y0)
    elif mode == 'head-bottom':   # dive: head is at the bottom
        f = yy > y0 + .8 * (y1 - y0)
    elif mode == 'lower':         # ground burst: near ring half + near debris (lower 40 %) in front
        f = yy > y0 + .6 * (y1 - y0)
    elif mode == 'front':
        f = np.ones((h, w), bool)
    else:
        f = np.zeros((h, w), bool)
    b, fr = a.copy(), a.copy()
    b[f, 3] = 0
    fr[~f, 3] = 0
    return b, fr


def fade_top(a, frac):
    """alpha ramps from 0 at the top to full at `frac` of the height (removes the dragon head from the column)"""
    a = a.copy()
    x0, x1, y0, y1 = bbox(a)
    yy = np.arange(a.shape[0])[:, None]
    lim = y0 + frac * (y1 - y0)
    k = np.clip((yy - (lim - 0.15 * (y1 - y0))) / (0.15 * (y1 - y0)), 0, 1)
    a[..., 3] = (a[..., 3] * k).astype(np.uint8)
    return a


def env(t, a, b, fin=0, fout=0):
    """opacity envelope: 0 outside [a, b], ramps fin frames in / fout frames out"""
    if t < a or t > b:
        return 0.0
    v = 1.0
    if fin:
        v = min(v, (t - a + 1) / fin)
    if fout:
        v = min(v, (b - t + 1) / fout)
    return max(0.0, min(1.0, v))


def idx(t, a, b, n, first=0, last=None):
    last = n - 1 if last is None else last
    if b <= a:
        return first
    return int(round(first + (last - first) * min(1, max(0, (t - a) / (b - a)))))


# ------------------------------------------------------------------ the sequence
EVENTS = []                      # for the JSON timeline


def frame(t):
    L = {k: Image.new('RGBA', (W, H), (0, 0, 0, 0)) for k in (2, 3, 4, 5, 6)}
    c, p, ox, oy = placement(t)
    L[4].alpha_composite(Image.fromarray(p['img']), (ox, oy))
    tip = (ox + p['tip'][0], oy + p['tip'][1])
    center = (ox + p['torso'][0], oy + p['torso'][1])
    ptip18 = POSES[18]
    _, _, gx18, gy18 = placement(113)
    # final burst one board cell (80 sheet px = 100 %) in front of the spear's contact point
    CELL_PX = 80
    G = (gx18 + ptip18['tip'][0] + CELL_PX, GROUND)

    def put(name, k, at, how, alpha=1.0, mode='none', layer_b=3, layer_f=5, s_mul=1.0, sx=None, prep=None, hold=False):
        a = FX[name][k]
        if prep:
            a = prep(a)
        a = scaled(a, SC[name] * s_mul, sx)
        if alpha < 1:
            a = a.copy()
            a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
        x0, x1, y0, y1 = bbox(a)
        cy_, cx_ = np.nonzero(a[..., 3] > 200)
        core = (float(cx_.mean()), float(cy_.mean())) if len(cx_) else ((x0 + x1) / 2, (y0 + y1) / 2)
        if how == 'core':
            px, py = at[0] - core[0], at[1] - core[1]
        elif how == 'left':      # tail (left end) on the point, vertical core on it
            px, py = at[0] - x0, at[1] - core[1]
        elif how == 'right':
            px, py = at[0] - x1, at[1] - core[1]
        elif how == 'bottom':    # bottom-centre on the point
            px, py = at[0] - (x0 + x1) / 2, at[1] - y1
        else:                    # 'headdown': bottom (head) on the point
            px, py = at[0] - (x0 + x1) / 2, at[1] - y1
        b, f = split(a, mode)
        L[layer_b].alpha_composite(Image.fromarray(b), (round(px), round(py)))
        L[layer_f].alpha_composite(Image.fromarray(f), (round(px), round(py)))
        EVENTS.append({'T': t, 'track': name, 'frame': k + 1, 'x': round(px), 'y': round(py), 'opacity': round(alpha, 2),
                       'split': mode})

    # Charge T000–T024 (v2): ground charge sheet under his feet — wisps → rings + pillar (f1–f6) during C01–C02,
    # then f9–f10 (the energy shoots up into the spear) as the dash starts; f7–f8 (dragon head) skipped: no full
    # dragon silhouette during the charge
    if t <= 24:
        k = idx(t, 0, 14, 6) if t <= 14 else (8 if t <= 19 else 9)
        a = env(t, 0, 24, fin=4, fout=5)
        put('charge', k, (center[0] + 2, GROUND + 3), 'bottom', a, 'lower', layer_b=2, layer_f=6)
    # Dash / Thrust: hint from T025 on the spear tip (tail on the tip, flash end in front), hit-stop T033–T035
    a = env(t, 25, 46, fin=3, fout=4)
    if a:
        tt = min(t, 33) if 33 <= t <= 35 else (t - 2 if t > 35 else t)
        put('hint', idx(tt, 25, 41, 6), (tip[0] - 26, tip[1]), 'left', a, 'tip')
    if 31 <= t <= 36:
        put('impact', 1, (tip[0] + 2, tip[1] + 10), 'bottom', env(t, 31, 36, fout=3), 'front', layer_f=6, s_mul=.5)
    # Sweep / Emerge T045–T066: behind first, head crosses in front T055–T060
    a = env(t, 45, 66, fin=3, fout=5)
    if a:
        put('emerge', idx(t, 45, 62, 8), (center[0] - 14 + (t - 45) * 1.6, center[1] - 6), 'left', a, 'head40' if 55 <= t <= 60 else 'none')
    if 54 <= t <= 58:
        put('impact', 1, (tip[0], tip[1] + 10), 'bottom', env(t, 54, 58, fout=2), 'front', layer_f=6, s_mul=.45)
    # Ascent T065–T092: starts on the ground point, then follows the rising character centre
    a = env(t, 65, 92, fin=3, fout=7)
    if a:
        u = min(1, max(0, (t - 65) / 14))
        base_y = GROUND + 4 - u * (GROUND + 4 - (oy + p['h'] + 8))
        put('ascent', idx(t, 65, 86, 8), (center[0], base_y), 'bottom', a, 'band')
    # Coil A T086–T100 then Core Form T094–T106 around the airborne body (60 % behind / 40 % front)
    a = env(t, 86, 100, fin=3, fout=6)
    if a:
        put('coilA', idx(t, 86, 100, 10), (center[0] + 4, center[1]), 'core', a, 'head40')
    a = env(t, 94, 106, fin=4, fout=6)
    if a:
        put('core', idx(t, 94, 106, 12, 2, 11), (center[0] + 4, center[1] - 2), 'core', a, 'head40')
    # Dive T101–T112: axis on the spear shaft, head at the tip; gone by T112
    a = env(t, 101, 111, fin=2, fout=5)
    if a:
        put('dive', idx(t, 101, 109, 8), (tip[0], tip[1] + 6), 'headdown', a, 'head-bottom')
    # Final impact (v2): user's ground-impact sheet on the contact point G — T113 flash f1 · T115 core f2 ·
    # T117 column rising f3–f4 · T120 ring f5 (far half behind, near half + near debris in front) · debris f6–f8 ·
    # decay f9–f12 into the residual
    FIN = {113: 0, 114: 0, 115: 1, 116: 1, 117: 2, 118: 3, 119: 3, 120: 4, 121: 4, 122: 4, 123: 5, 124: 5, 125: 6,
           126: 6, 127: 7, 128: 7, 129: 8, 130: 8, 131: 8, 132: 9, 133: 9, 134: 9, 135: 10, 136: 10, 137: 10,
           138: 11, 139: 11, 140: 11}
    if t in FIN:
        a = 1.0 if t <= 131 else max(0.0, 1 - (t - 131) / 10)
        put('final', FIN[t], (G[0], G[1] + 3), 'bottom', a, 'lower', layer_b=3, layer_f=6)
    # Residual T131–T146: faint contour + sparks behind him, fading to zero
    a = env(t, 132, 146, fin=4) * max(0, 1 - (t - 132) / 15)
    if a > .02:
        put('residual', idx(t, 132, 146, 6, 2, 5), (G[0] - 6, GROUND - 40), 'core', a * .8, 'none')

    # protect the face and the spear tip on layer 5 (front dragon)
    l5 = np.array(L[5])
    hy0, hy1, (hx0, hx1) = p['head']
    l5[max(0, int(oy + hy0) - 2):int(oy + hy1) + 2, max(0, int(ox + hx0) - 2):int(ox + hx1) + 2, 3] = 0
    tx, ty = int(tip[0]), int(tip[1])
    l5[max(0, ty - 4):ty + 5, max(0, tx - 4):tx + 5, 3] = 0
    L[5] = Image.fromarray(l5)

    bg = background()
    for k in (2, 3, 4, 5, 6):
        bg.alpha_composite(L[k])
    # camera shake
    sh = (0, 0)
    if 33 <= t <= 36:
        sh = [(1, 0), (-1, 1), (1, -1), (0, 0)][t - 33]
    if 115 <= t <= 122:
        amp = [4, 4, 3, 3, 2, 2, 1, 1][t - 115]
        sh = ((-1) ** t * amp, (-1) ** (t // 2) * (amp // 2))
    out = background()                 # shake: the shifted frame lands on the plain background (no black edge)
    out.paste(bg, sh)
    return out.resize((W * UP, H * UP), Image.NEAREST), c, tip, center


_BG = None


def background():
    global _BG
    if _BG is None:
        a = np.zeros((H, W, 4), np.uint8)
        yy = np.arange(H)[:, None]
        sky = np.clip(yy / GROUND, 0, 1)
        a[..., 0] = (18 + 20 * sky).astype(np.uint8)
        a[..., 1] = (22 + 26 * sky).astype(np.uint8)
        a[..., 2] = (40 + 30 * sky).astype(np.uint8)
        g = yy >= GROUND
        a[..., 0] = np.where(g, 40, a[..., 0])
        a[..., 1] = np.where(g, 58, a[..., 1])
        a[..., 2] = np.where(g, 46, a[..., 2])
        a[GROUND:GROUND + 1, :, :3] = (62, 86, 64)
        a[..., 3] = 255
        _BG = Image.fromarray(a)
    return _BG.copy()


def main():
    frames, track = [], []
    for t in range(N):
        img, c, tip, center = frame(t)
        frames.append(img.convert('RGB'))
        track.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': DRAWN[c - 1], 'root': [round(X0 + lerp_keys(TRAVEL, t), 1),
                      round(GROUND - lerp_keys(HEIGHT, t), 1)], 'spearTip': [round(tip[0], 1), round(tip[1], 1)],
                      'center': [round(center[0], 1), round(center[1], 1)]})
    import subprocess
    import tempfile
    d = tempfile.mkdtemp(dir=SCR)
    for i, f in enumerate(frames):
        f.save(f'{d}/f{i:03d}.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{d}/f%03d.png', '-c:v', 'libx264',
                    '-pix_fmt', 'yuv420p', '-crf', '14', f'{OUT}/bailong_ult_preview{TAG}_60fps.mp4'], check=True)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{d}/f%03d.png', '-vf',
                    'fps=50,scale=800:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=none',
                    '-loop', '0', f'{OUT}/bailong_ult_preview{TAG}_50fps.gif'], check=True)
    keys = [0, 14, 25, 33, 40, 50, 55, 62, 70, 80, 90, 98, 104, 110, 113, 115, 117, 120, 125, 131, 138, 146]
    cw, ch = 400, 250
    sheet_ = Image.new('RGB', (cw * 6, ch * 4), (0, 0, 0))
    from PIL import ImageDraw
    dr = ImageDraw.Draw(sheet_)
    for i, t in enumerate(keys[:24]):
        sheet_.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 6) * cw, (i // 6) * ch))
        dr.text(((i % 6) * cw + 6, (i // 6) * ch + 4), f'T{t:03d} {track[t]["char"]}', fill=(255, 255, 255))
    sheet_.save(f'{OUT}/bailong_ult_preview{TAG}_contact.png')
    json.dump({'fps': 60, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
               'layers': ['1 background', '2 ground aura + far ring', '3 dragon behind', '4 Bai Long + spear',
                          '5 dragon front (face + spear tip masked out)', '6 tip flash / contact / near ring'],
               'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': DRAWN[c - 1]} for a, b, c in CHAR_T],
               'rootTracks': {'travel': TRAVEL, 'height': HEIGHT}, 'scales': SC | {'_ring': .55},
               'perFrame': track, 'vfx': EVENTS}, open(f'{OUT}/bailong_ult{TAG}_timeline.json', 'w'), indent=1, default=float)


if __name__ == '__main__':
    main()

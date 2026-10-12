"""Tang Xun — Skill 2 Severing Chain: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/tangxun, not committed):
  s2_vfx.png     main VFX = ONE flying blade, 8 frames (f1 spawn sparkle → f2–f6 blade + jade trail (f4 wind ring) →
                 f7 trail only → f8 last sparkle) — the same single-blade asset is spawned three separate times
  s2_impact.png  impact VFX, 8 painted frames separated by dark divider lines (pin star → burst + shards → crescents fade)
  public/sprites/hero-tangxun.png row 6 (character, 16 frames, built by tools/sprites/tangxun.py — nothing baked)

Timeline (user spec 2026-10, 60 FPS, T000–T071 = 1.20 s):
  A ready / draw T000–T009 · B throw 1 T010–T025 · C throw 2 T026–T039 · D throw 3 T040–T055 · E finish T056–T063 ·
  F recovery T064–T071. Spawns T014 / T030 / T045 (from the throwing hand), hits T020 / T036 / T052. Damage 25 / 30 / 45 %,
  interrupt + Open Wound on hit 3 only. Impact 80 / 90 / 100 % · hit-stop 1 / 1 / 3 frames · shake 1 / 1 / 4 px ·
  root <= 10 px (runtime AnimDef.root, torso / pivot — no running). Never three blades in one frame.

In game every throw is the engine's projectile (clip DAMAGE events at the spawns, kit repeat 3) with `tx-s2-blade` as its
sprite; the impact FX picks its strip per hit index.

Usage: python3 tools/sprites/tangxun_s2.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

B.SRC = 'art/incoming/tangxun'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tangxun_s2'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 72
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 60
CELL_PX = 80
BODY = 78
TX = X0 + 150                           # the single target (≈ 1.9 cells — a ranged throw)
CONTACT_X, CONTACT_Y = TX - 14, GROUND - 44

# ------------------------------------------------------------------ character (atlas row 6, game scale)
atlas = np.array(Image.open('public/sprites/hero-tangxun.png').convert('RGBA'))
ROW = atlas[6 * CELL_H:7 * CELL_H]
CHAR = [(0, 5, 1), (6, 9, 2), (10, 12, 3), (13, 13, 4), (14, 18, 5), (19, 25, 6), (26, 28, 7), (29, 29, 8), (30, 34, 9),
        (35, 39, 10), (40, 42, 11), (43, 44, 12), (45, 55, 13), (56, 63, 14), (64, 67, 15), (68, 71, 16)]
POSES = {1: ('READY', 'ยืนพร้อม มีดลับในมือ', 'CAST_START T000'),
         2: ('DRAW', 'ย่อตัว เตรียมมีด', 'PREPARE_BLADES T006'),
         3: ('THROW 1', 'ง้างมีดเล่มแรกระดับอก', 'THROW_1_START T010'),
         4: ('THROW 1', 'ส่งแขน', ''),
         5: ('RELEASE 1', 'แขนเหยียด ปล่อยมีด 1', 'PROJECTILE_SPAWN_1 T014'),
         6: ('FOLLOW 1', 'ค้างแขน / ดึงกลับ', 'HIT_1 T020'),
         7: ('THROW 2', 'บิดไหล่ ดึงมีดเล่มสอง', 'THROW_2_START T026'),
         8: ('THROW 2', 'แขนเหยียดพร้อมมีด', ''),
         9: ('RELEASE 2', 'ปล่อยมีด 2', 'PROJECTILE_SPAWN_2 T030'),
         10: ('FOLLOW 2', 'ค้างแขน', 'HIT_2 T036'),
         11: ('THROW 3', 'ง้างหนักสุด', 'THROW_3_START T040'),
         12: ('THROW 3', 'แขนเหยียดพร้อมมีด', ''),
         13: ('RELEASE 3', 'ปล่อยมีด 3 (แรงสุด) ค้างมอง', 'PROJECTILE_SPAWN_3 T045 · HIT_3 T052'),
         14: ('FINISH', 'ส่งแรงจบ ลดแขน', 'FINAL_FOLLOW_THROUGH T056'),
         15: ('RECOVERY', 'ยืดตัวกลับ', 'RECOVERY_START T064'),
         16: ('READY', 'ยืนพร้อม', 'ANIMATION_END T071')}
SPAWNS = [14, 30, 45]
HITS = [20, 36, 52]
THROWS = [10, 26, 40]
# torso / pivot weight transfer only: each throw leans 3–5 px forward, throw 3 the most (10 px), back to 0 by T071
ROOT_KEYS = [[0, 0], [10, 0], [14, 3], [22, 2], [26, 2], [30, 5], [38, 4], [40, 4], [45, 8], [52, 10], [60, 9], [64, 6], [71, 0]]


def smooth(keys, t):
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b:
            k = (t - a) / (b - a)
            return va + (vb - va) * k * k * (3 - 2 * k)
    return keys[-1][1]


def root_x(t):
    return smooth(ROOT_KEYS, t)


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    for i, (a, b, _) in enumerate(CHAR):
        if a <= t <= b:
            return round(i + (t - a) / (b - a + 1), 3)
    return float(len(CHAR))


def hand(c):
    """front-most opaque pixel of the arm band (the throwing hand) in cell px"""
    a = pose(c)[..., 3] >= 128
    ys, xs = np.nonzero(a)
    top, bot = ys.min(), ys.max()
    band = a.copy()
    band[:int(top + .25 * (bot - top))] = False
    band[int(top + .55 * (bot - top)):] = False
    bx = np.nonzero(band.any(0))[0].max()
    return float(bx), float(np.nonzero(band[:, bx])[0].mean())


HAND = {c: hand(c) for c in range(1, 17)}


def release(k):
    t = SPAWNS[k]
    hx, hy = HAND[char_at(t)]
    return X0 + root_x(t) + hx - ROOT[0] + 3, GROUND + hy - ROOT[1]


straw = np.array(Image.open('public/sprites/enemy-straw-recruit.png').convert('RGBA'))[0:100, 0:132][:, ::-1]


# ------------------------------------------------------------------ VFX
def load_vfx(name, thr=80):
    rgb = np.array(Image.open(f'{B.SRC}/{name}.png').convert('RGB')).astype(int)
    bg = np.median(np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3)]), 0)
    d = np.sqrt(((rgb - bg) ** 2).sum(-1))
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = np.where(d > thr, 255, 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = (b > g + 30) & (r > g + 30)
    out[..., 0] = np.where(spill, np.minimum(r, g + 20), r).astype(np.uint8)
    return out


def cut(name, centres):
    """blobs → nearest hand-placed frame centre"""
    im = load_vfx(name)
    a = im[..., 3] > 0
    lab, k = ndimage.label(a, np.ones((3, 3)))
    idx = np.arange(1, k + 1)
    cx = np.array(ndimage.center_of_mass(a, lab, idx))[:, 1]
    cen = np.array(centres, float)
    owner = np.full(a.shape, -1)
    for i in range(k):
        owner[lab == i + 1] = int(np.argmin(np.abs(cen - cx[i])))
    ys = np.nonzero(a.any(1))[0]
    cy = (ys.min() + ys.max()) / 2
    out = []
    for j in range(len(cen)):
        own = owner == j
        yy, xx = np.nonzero(own)
        x0, x1, y0, y1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
        fr = im[y0:y1, x0:x1].copy()
        fr[..., 3] = np.where(own[y0:y1, x0:x1], fr[..., 3], 0)
        core = fr[..., 3] > 0
        bright = core & (fr[..., :3].astype(int).sum(-1) > 650)
        pick = bright if bright.sum() > 6 else core
        out.append({'img': fr, 'cx': float(np.nonzero(pick.any(0))[0].mean()), 'cy': cy - y0, 'tip': float(x1 - x0 - 1)})
    return out


def cut_impact():
    """painted frames between dark divider lines · alpha unmixed from the magenta (min(r, b) − g), colour unmixed too"""
    rgb = np.array(Image.open(f'{B.SRC}/s2_impact.png').convert('RGB')).astype(float)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    bg = np.array([251., 3., 251.])
    al = np.clip(1 - (np.minimum(r, b) - g) / 247, 0, 1)
    al = np.where(al < 0.12, 0, al)
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    divs = [0, 178, 400, 657, 893, 1111, 1336, 1564, 1773]
    piv_x = [80, 128, 166, 155, 150, 150, 150, 150]
    out = []
    for i in range(8):
        x0, x1 = divs[i] + 4, divs[i + 1] - 3
        y0, y1 = 150, 720
        fr = np.zeros((y1 - y0, x1 - x0, 4), np.uint8)
        fr[..., :3] = col[y0:y1, x0:x1].astype(np.uint8)
        fr[..., 3] = (al[y0:y1, x0:x1] * 255).astype(np.uint8)
        # fade the 6 px next to the cut so no divider residue / straight edge shows
        e = np.minimum(np.arange(x1 - x0), np.arange(x1 - x0)[::-1])
        fr[..., 3] = (fr[..., 3] * np.clip(e / 6, 0, 1)[None, :]).astype(np.uint8)
        out.append({'img': fr, 'cx': float(piv_x[i]), 'cy': 455. - y0})
    return out


MAIN = cut('s2_vfx', [130, 460, 780, 1100, 1425, 1742, 2030, 2330])
IMPACT = cut_impact()


def wh(fr, thr=0):
    ys, xs = np.nonzero(fr['img'][..., 3] > thr)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes: the blade + trail in flight (f5) ≈ 0.85 cell (a quick single knife, shorter than S1's fang) · impact peak (f3)
# at 100 % ≈ 1.2 body tall · instances 80 / 90 / 100 %
SC = {'main': 0.85 * CELL_PX / wh(MAIN[4])[0], 'imp': 1.2 * BODY / wh(IMPACT[2], 60)[1]}
IMP_SCALE = [0.8, 0.9, 1.0]
IMP_GAIN = [1.0, 1.0, 1.15]             # throw 3 slightly brighter


def proj_plan(k):
    """single-blade instance k: f1 spawn sparkle at the hand → f2–f6 in flight → f7 trail at contact → f8 sparkle"""
    s, h = SPAWNS[k], HITS[k]
    fl = list(range(s + 1, h))
    seq = [2, 3, 4, 5, 6] if len(fl) == 5 else [2, 3, 4, 4, 5, 6]
    plan = {s: 1, **{t: f for t, f in zip(fl, seq)}, h: 7, h + 1: 8}
    alpha = {t: 1.0 for t in plan}
    alpha[h + 1] = 0.6
    return plan, alpha


PROJ = [proj_plan(k) for k in range(3)]
IMP_PLANS = [{HITS[0] + d: f for d, f in enumerate([1, 2, 3, 3, 4, 5, 6, 7, 8])},
             {HITS[1] + d: f for d, f in enumerate([1, 2, 3, 3, 4, 5, 6, 7, 8])},
             {HITS[2] + d: f for d, f in enumerate([1, 2, 3, 3, 3, 4, 4, 5, 6, 6, 7, 8])}]
SHAKE = {20: (1, 0), 36: (1, 0), 37: (-1, 0), 52: (4, 0), 53: (-3, 1), 54: (2, 0), 55: (-1, 0)}
HITSTOP = {20: 1, 36: 1, 52: 3}         # frames


def tip_x(k, t):
    rx = release(k)[0]
    return rx + (CONTACT_X - rx) * (t - SPAWNS[k]) / (HITS[k] - SPAWNS[k])


def tip_y(k, t):
    ry = release(k)[1]
    return ry + (CONTACT_Y - ry) * min(1, max(0, (t - SPAWNS[k]) / (HITS[k] - SPAWNS[k])))


def dither(a, alpha):
    if alpha >= 1:
        return a
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
    th = np.tile(bayer, (a.shape[0] // 4 + 1, a.shape[1] // 4 + 1))[:a.shape[0], :a.shape[1]]
    a = a.copy()
    a[..., 3] = np.where(th < alpha, a[..., 3], 0)
    return a


def tile(fr, s, alpha=1.0, pivot='core', soft=False, gain=1.0):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS if soft else Image.NEAREST)
    a = np.array(img)
    if soft:
        if gain != 1:
            a[..., :3] = np.clip(a[..., :3].astype(float) * gain, 0, 255).astype(np.uint8)
        a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
    else:
        a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
        a = dither(a, alpha)
    px, py = (fr['tip'] * s, fr['cy'] * s) if pivot == 'tip' else (fr['cx'] * s, fr['cy'] * s)
    return a, px, py


def tracks_at(t):
    out = []
    for k, (plan, alpha) in enumerate(PROJ):
        if t in plan:
            f = plan[t]
            piv = 'core' if f in (1, 8) else 'tip'
            a, px, py = tile(MAIN[f - 1], SC['main'], alpha[t], piv)
            at = release(k) if f == 1 else (CONTACT_X, CONTACT_Y) if f == 8 else (tip_x(k, t), tip_y(k, t))
            out.append((f'proj{k + 1}', f, a, px, py, at, alpha[t]))
    for i, plan in enumerate(IMP_PLANS):
        if t in plan:
            a, px, py = tile(IMPACT[plan[t] - 1], SC['imp'] * IMP_SCALE[i], 1.0, soft=True, gain=IMP_GAIN[i])
            out.append((f'impact{i + 1}', plan[t], a, px, py, (CONTACT_X + 4, CONTACT_Y), 1.0))
    assert sum(1 for x in out if x[0].startswith('proj')) <= 1, f'two blades at T{t}'
    return out


def background():
    a = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    sky = np.clip(yy / GROUND, 0, 1)
    a[..., 0], a[..., 1], a[..., 2] = (20 + 18 * sky), (18 + 20 * sky), (34 + 26 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 40, a[..., 0])
    a[..., 1] = np.where(g, 54, a[..., 1])
    a[..., 2] = np.where(g, 46, a[..., 2])
    a[GROUND, :, :3] = (62, 86, 64)
    for k in range(-3, 6):
        x = int(TX - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    img = Image.fromarray(a)
    img.alpha_composite(Image.fromarray(straw), (TX - (132 - 66), GROUND - 86))
    return img


LOG = []


def frame(t, log=True):
    img = background()
    c = char_at(t)
    img.alpha_composite(Image.fromarray(pose(c)), (round(X0 + root_x(t)) - ROOT[0], GROUND - ROOT[1]))
    for key, f, a, px, py, at, op in tracks_at(t):
        img.alpha_composite(Image.fromarray(a), (round(at[0] - px), round(at[1] - py)))
        if log:
            LOG.append({'T': t, 'track': key if key.startswith('proj') else 'impact', 'frame': f, 'x': round(at[0] - px),
                        'y': round(at[1] - py), 'opacity': round(op, 2), 'split': 'front', 'part': key})
    if log:
        for i, h in enumerate(HITS):
            if h <= t <= h + 1:
                LOG.append({'T': t, 'track': 'damage', 'frame': i + 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t == h else 0.5, 'split': '-'})
        if HITS[2] <= t <= HITS[2] + 2:
            LOG.append({'T': t, 'track': 'mark', 'frame': 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t == HITS[2] else 0.5, 'split': '-'})
        for h, n in HITSTOP.items():
            if h <= t < h + n:
                LOG.append({'T': t, 'track': 'hitstop', 'frame': 1, 'x': 0, 'y': 0, 'opacity': 1.0, 'split': '-'})
    if t in SHAKE:
        out = background()
        out.paste(img, SHAKE[t])
        img = out
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/tangxun_s2_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=50,scale=860:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=192[p];[b][p]paletteuse=dither=none',
                '-loop', '0', f'{OUT}/tangxun_s2_preview_50fps.gif'], check=True)
KEYS = [0, 6, 10, 14, 17, 20, 23, 30, 36, 45, 52, 54, 56, 64, 68, 71]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 4))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/tangxun_s2_preview_contact.png')


# ------------------------------------------------------------------ in-game strips
def bake_projectile():
    """the single flying blade = projectile sprite: f2–f8 (f1 spawn sparkle is shown at the hand by the projectile's
    first frame) in order, tip on the frame centre (ProjectileComponent centres the frame on the flight point)"""
    tiles = []
    for i, fr in enumerate(MAIN):
        a, px, py = tile(fr, SC['main'], 1.0, 'core' if i in (0, 7) else 'tip')
        tiles.append((a, px, py))
    back = max(max(px, a.shape[1] - px) for a, px, _ in tiles)
    half_h = int(np.ceil(max(max(py, a.shape[0] - py) for a, _, py in tiles))) + 1
    w, h = 2 * (int(np.ceil(back)) + 2), 2 * half_h
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for i, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (i * w + round(w / 2 - px), round(h / 2 - py)))
    out.save('public/sprites/fx-tangxun-s2-blade.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h}


def bake_impact(i):
    plan = IMP_PLANS[i]
    ts = sorted(plan)
    tiles = [tile(IMPACT[plan[t] - 1], SC['imp'] * IMP_SCALE[i], 1.0, soft=True, gain=IMP_GAIN[i]) for t in ts[::2]]
    l = max(px for _, px, _ in tiles)
    r = max(a.shape[1] - px for a, px, _ in tiles)
    u = max(py for _, _, py in tiles)
    d = max(a.shape[0] - py for a, _, py in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for k, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (k * w + round(l - px) + 1, round(u - py) + 1))
    out.save(f'public/sprites/fx-tangxun-s2-impact{i + 1}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(2000 / 60, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)],
            'dx': round((CONTACT_X + 4 - TX) * 1.25, 2), 'dy': round(27.25 + (CONTACT_Y - GROUND) * 1.25, 2)}


game_fx = {'blade': bake_projectile(), **{f'impact{i + 1}': bake_impact(i) for i in range(3)}}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
sx = lambda t: step_of(t) if t < N - 1 else float(len(CHAR))
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(6), 'STRIKE_START': [step_of(t) for t in THROWS],
                   'DAMAGE': [step_of(t) for t in SPAWNS], 'RECOVERY_START': step_of(64)},
        'root': [[sx(t), round(root_x(t), 1), 0] for t in sorted({k[0] for k in ROOT_KEYS} | set(range(0, N, 4)) | {N - 1})],
        'impact': [{'hitStopMs': 17, 'shakePx': 1, 'shakeMs': 40}, {'hitStopMs': 17, 'shakePx': 1, 'shakeMs': 50},
                   {'hitStopMs': 50, 'shakePx': 4, 'shakeMs': 90}]}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = []
for t in range(N):
    c = char_at(t)
    hx, hy = HAND[c]
    x = X0 + root_x(t)
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [round(x, 1), GROUND],
               'spearTip': [round(x + hx - ROOT[0]), GROUND + hy - ROOT[1]], 'center': [round(x), GROUND - BODY / 2]})
meta = {
    'name': 'tangxun_s2_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 2 Severing Chain · Tang Xun', '',
               '60 FPS, 72 เฟรม (T000–T071) = 1.20 วินาที · ตัวละคร 16 ท่า + มีดเล่มเดียว (Main VFX 8 เฟรม) × 3 instance + Impact (8 เฟรม) × 3',
               'Frames = ทุกเฟรม · Character = ท่า C01–C16 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · หุ่นฟาง 1 ตัว (เป้าเดี่ยว)',
               'ที่มา: tools/sprites/tangxun_s2.py → tangxun_s2_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill2 ใน SHEETS hero-tangxun.png (รวม 1200 ms) · มีดแต่ละเล่ม = กระสุนของเอนจิน (fx-tangxun-s2-blade)',
    'title': 'Timeline Sync Sheet — Skill 2 Severing Chain  ·  Tang Xun · Whispering Blade',
    'subtitle': '60 FPS · 72 frames (T000–T071) = 1.20 s · 1 column = 1 frame (16.7 ms) · spawn T014 / T030 / T045 · hit T020 / T036 / T052 · one blade per instance',
    'phases': [[0, 9, 'A', 'READY / DRAW', [120, 130, 150], 'พร้อม / เตรียมมีด'],
               [10, 25, 'B', 'THROW 1', [60, 170, 140], 'ขว้าง 1'],
               [26, 39, 'C', 'THROW 2', [80, 140, 190], 'ขว้าง 2'],
               [40, 55, 'D', 'THROW 3', [215, 90, 90], 'ขว้าง 3 (แรงสุด)'],
               [56, 63, 'E', 'FINISH', [200, 160, 90], 'ส่งแรงจบ'],
               [64, 71, 'F', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': HITS,
    'events': [[0, 'CAST_START', 'C01'], [6, 'PREPARE_BLADES', 'C02'],
               [10, 'THROW_1_START', 'C03'], [14, 'PROJECTILE_SPAWN_1', 'มีด #1 f1 ที่มือ'], [20, 'HIT_1', 'ดาเมจ 25 % · impact 80 %'],
               [26, 'THROW_2_START', 'C07'], [30, 'PROJECTILE_SPAWN_2', 'มีด #2'], [36, 'HIT_2', 'ดาเมจ 30 % · impact 90 %'],
               [40, 'THROW_3_START', 'C11'], [45, 'PROJECTILE_SPAWN_3', 'มีด #3'], [52, 'HIT_3', 'ดาเมจ 45 % · impact 100 %'],
               [52, 'INTERRUPT_CHECK', 'ตัดร่าย Break 40'], [52, 'OPEN_WOUND', 'แผลเปิด 5 วิ'],
               [56, 'FINAL_FOLLOW_THROUGH', 'C14'], [64, 'RECOVERY_START', 'C15'], [71, 'ANIMATION_END', 'C16']],
    'lanes': 8,
    'tracks': [['proj1', 'L3 Projectile #1', [120, 220, 190], 'fx-tangxun-s2-blade (s2_vfx.png 8 fr) = กระสุน', 'L3 · หน้า',
                'ปลายมีด = จุดบิน · เกิดที่มือ C05', 'T014 f1 ประกาย → f2–f6 บิน → T020 f7 ชน → f8 ประกายจาง'],
               ['proj2', 'L4 Projectile #2', [110, 200, 220], 'asset เดียวกัน (instance 2)', 'L4 · หน้า',
                'เกิดที่มือ C09', 'T030 → T036'],
               ['proj3', 'L5 Projectile #3', [140, 230, 160], 'asset เดียวกัน (instance 3)', 'L5 · หน้า',
                'เกิดที่มือ C13', 'T045 → T052 (บิน 7 เฟรม, f4 ค้าง 2)'],
               ['impact', 'L6 Impact VFX', [255, 200, 140], 'fx-tangxun-s2-impact1/2/3 (s2_impact.png 8 fr)', 'L6 · หน้าสุด',
                'จุดสัมผัสหน้าเป้า', '80 % / 90 % / 100 % (ครั้งที่ 3 สว่างขึ้น ค้าง peak นานกว่า)'],
               ['damage', 'L7 Damage', [230, 90, 90], 'engine (repeat 3)', '-', '-', '25 / 30 / 45 % ของ 160 %'],
               ['mark', 'L8 Interrupt / Mark', [240, 150, 220], 'INTERRUPT + APPLY_STATUS onHits [2]', '-', '-', 'ครั้งที่ 3 เท่านั้น: ตัดร่าย Break 40 + แผลเปิด (รับดาเมจ +10 % 5 วิ)'],
               ['hitstop', 'L9 Hitstop', [255, 255, 255], 'AnimDef.impact', '-', '-', '1 / 1 / 3 เฟรม']],
    'trackNames': {'proj1': 'มีด #1', 'proj2': 'มีด #2', 'proj3': 'มีด #3', 'impact': 'ประกายกระทบ', 'damage': 'ดาเมจ',
                   'mark': 'ตัด / แผลเปิด', 'hitstop': 'หยุดเฟรม'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Root X (L2)'], [3, 'มีด #1 (L3)'], [4, 'มีด #2 (L4)'], [5, 'มีด #3 (L5)'],
               [6, 'Impact (L6)'], [7, 'ดาเมจ (L7)'], [8, 'ตัด / แผลเปิด (L8)'], [9, 'Hitstop (L9)'], [10, 'สั่นกล้อง (L10)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': [0, 14, 20, 30, 36, 45, 52, 56, 64],
    'thumbLabels': {0: 'READY', 14: 'SPAWN 1', 20: 'HIT 1', 30: 'SPAWN 2', 36: 'HIT 2', 45: 'SPAWN 3', 52: 'HIT 3',
                    56: 'FINISH', 64: 'RECOVERY'},
    'thumbCrop': [20 * UP, 70 * UP, 300 * UP, 180 * UP],
    'travelLabel': 'L2 Root X (px) — ไม่เกิน 10 px (ลำตัว / pivot ไม่วิ่ง)', 'heightLabel': 'Y movement (px)',
    'notes': [
        'Main VFX = มีดเล่มเดียว · asset เดียวกัน spawn 3 ครั้งแยกกัน (T014 / T030 / T045) จากมือที่ขว้าง — ไม่มีเฟรมไหนมีมีด 3 เล่มพร้อมกัน',
        'ดาเมจ 25 / 30 / 45 % (ครั้งที่ 3 แรงสุด) · ตัดร่าย + แผลเปิดเฉพาะครั้งที่ 3 (`onHits: [2]`)',
        'Impact เล่น 3 ครั้ง ขนาด 80 / 90 / 100 % · ครั้งที่ 3 สว่างขึ้นเล็กน้อย + ค้าง peak 3 เฟรม',
        'Hit-stop 1 / 1 / 3 เฟรม · สั่น 1 / 1 / 4 px',
        'Root ไม่เกิน 10 px (runtime AnimDef.root) — โยกลำตัวไปหน้าแต่ละครั้ง มากสุดตอนขว้าง 3 แล้วคืน 0',
        'ในเกม: DAMAGE ของท่า = เวลาปล่อยมีดแต่ละเล่ม แล้วเอนจินยิงกระสุน 3 ลูก · เวลาบินจริงขึ้นกับระยะ (0.1 + 0.06 วิ/ช่อง)',
        'Character กับ VFX แยกชั้น · มีดที่ลอยในแผ่นท่าถูกตัดออกจากตัวละคร',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': ROOT_KEYS, 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/tangxun_s2_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'release': [release(k) for k in range(3)], 'gameFx': game_fx, 'game': game}, indent=1, default=float))

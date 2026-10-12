"""Tang Xun — Skill 1 Piercing Fang: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/tangxun, not committed):
  s1_vfx.png     main VFX = the flying Piercing Fang, 8 frames (spawn flash → blade + narrow jade trail → wind ring →
                 fading streak → last sparkle) — ONE blade that pierces the whole 1×3 line
  s1_impact.png  impact VFX, 8 frames (pin-point star → cross + jade ring with blade shards → fading)
  public/sprites/hero-tangxun.png row 5 (character, 10 frames, built by tools/sprites/tangxun.py — nothing baked)

Timeline (user spec 2026-10, 60 FPS, T000–T045 ≈ 0.77 s):
  A ready T000–T006 · B draw / anticipation T007–T015 (peak T012) · C throw T016–T023 (release T019) ·
  D projectile travel T024–T035 (target 1 T030, target 2 T034) · E impact / follow-through T036–T040 (target 3 T036) ·
  F recovery T041–T045. Root <= 6 px (runtime AnimDef.root) — a planted precision throw.

In game the projectile is the engine's (flight = 0.1 s + 0.06 s / cell) with this strip as its sprite and `overshoot`
so the same blade keeps flying through the line; the pierced units behind take their hits `pierceDelays` later
(+4 / +6 frames) with their own smaller impact.

Usage: python3 tools/sprites/tangxun_s1.py <out dir>
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
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tangxun_s1'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 46
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 60
CELL_PX = 80
BODY = 78
T1X = X0 + 130                          # first target (≈ 1.6 cells — a ranged throw), then one per cell
TARGETS = [T1X, T1X + CELL_PX, T1X + 2 * CELL_PX]
CONTACT_DX, CONTACT_Y = -14, GROUND - 42   # blade contact on each target's front
AXIS_Y = GROUND - 44                    # flight height (the throwing hand at release)

# ------------------------------------------------------------------ character (atlas row 5, game scale)
atlas = np.array(Image.open('public/sprites/hero-tangxun.png').convert('RGBA'))
ROW = atlas[5 * CELL_H:6 * CELL_H]
CHAR = [(0, 6, 1), (7, 9, 2), (10, 11, 3), (12, 15, 4), (16, 18, 5), (19, 23, 6), (24, 37, 7), (38, 40, 8), (41, 43, 9),
        (44, 45, 10)]
POSES = {1: ('READY', 'ท่าพร้อม ถือมีดลับมือขวาต่ำ', 'CAST_START'),
         2: ('DRAW', 'ดึงมีดจากซอง', 'DRAW_START T007'),
         3: ('DRAW', 'ยกมีดขึ้นระดับอก', ''),
         4: ('ANTICIPATION', 'บิดไหล่ ศอกง้างไปหลัง มือซ้ายเล็ง', 'ANTICIPATION_PEAK T012'),
         5: ('THROW', 'เริ่มส่งแขน', 'THROW_START T016'),
         6: ('RELEASE', 'แขนเหยียด ปล่อยมีด', 'PROJECTILE_RELEASE T019'),
         7: ('FOLLOW', 'ค้างแขนเหยียด มองมีดทะลุแนว', 'TARGET 1–3 T030–T036'),
         8: ('FOLLOW', 'ลดแขน', 'FOLLOW_THROUGH T038'),
         9: ('RECOVER', 'กลับท่ายิงไกล', 'RECOVERY_START T041'),
         10: ('READY', 'พร้อม', 'ANIMATION_END T045')}
ROOT_KEYS = [[0, 0], [16, 0], [19, 3], [24, 5], [38, 4], [45, 0]]   # front-foot weight transfer only (≤ 6 px)
RELEASE_T = 19
HITS = [30, 34, 36]
PIERCE_DELAYS = [(HITS[1] - HITS[0]) / FPS, (HITS[2] - HITS[0]) / FPS]


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
    """front-most opaque pixel of the arm band (the throwing hand / fingertip) in cell px"""
    a = pose(c)[..., 3] >= 128
    ys, xs = np.nonzero(a)
    top, bot = ys.min(), ys.max()
    band = a.copy()
    band[:int(top + .25 * (bot - top))] = False
    band[int(top + .55 * (bot - top)):] = False
    bx = np.nonzero(band.any(0))[0].max()
    return float(bx), float(np.nonzero(band[:, bx])[0].mean())


HAND = {c: hand(c) for c in range(1, 11)}
RELEASE = (X0 + HAND[6][0] - ROOT[0] + 3, GROUND + HAND[6][1] - ROOT[1])
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
    spill = (b > g + 30) & (r > g + 30)                     # magenta fringe on the jade / white edges
    out[..., 0] = np.where(spill, np.minimum(r, g + 20), r).astype(np.uint8)
    return out


def cut(name, centres):
    """blobs → nearest hand-placed frame centre (the trails of neighbouring frames nearly touch)"""
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
        out.append({'img': fr, 'cx': float(np.nonzero(pick.any(0))[0].mean()), 'cy': cy - y0,
                    'tip': float(x1 - x0 - 1)})
    return out


MAIN = cut('s1_vfx', [108, 358, 670, 1008, 1405, 1795, 2108, 2376])
IMPACT = cut('s1_impact', [140, 433, 752, 1085, 1417, 1743, 2059, 2360])


def wh(fr):
    ys, xs = np.nonzero(fr['img'][..., 3] > 0)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes: the blade + trail at full flight (main f5) ≈ 1.15 cells long, still a narrow line · impact peak (f4) ≈ 0.9 body
# wide on target 1 (precision, not an explosion) · targets 2 / 3: 65 % / 50 % of it
SC = {'main': 1.15 * CELL_PX / wh(MAIN[4])[0], 'imp': 0.9 * BODY / wh(IMPACT[3])[0]}
IMP_SCALE = [1.0, 0.65, 0.5]
IMP_ALPHA = [1.0, 0.85, 0.75]

MAIN_PLAN = {19: 1, 20: 2, 21: 2, 22: 3, 23: 3, 24: 4, 25: 4, 26: 4, 27: 5, 28: 5, 29: 5, 30: 6, 31: 6, 32: 6, 33: 6,
             34: 5, 35: 5, 36: 6, 37: 7, 38: 7, 39: 8, 40: 8}
MAIN_A = {t: 1.0 if t < 39 else [0.7, 0.35][t - 39] for t in MAIN_PLAN}
IMP_PLANS = [{31: 2, 32: 4, 33: 4, 34: 5, 35: 5, 36: 6, 37: 7, 38: 8},
             {35: 2, 36: 3, 37: 4, 38: 5, 39: 6, 40: 7},
             {37: 2, 38: 3, 39: 4, 40: 5, 41: 6, 42: 7}]
SHAKE = {30: (3, 0), 31: (-2, 1), 34: (1, 0), 36: (1, 0)}
HITSTOP = {30: 2}                       # frames (target 1 only; 2 / 3 none)


def contact(i):
    return TARGETS[i] + CONTACT_DX


# blade tip x over time: release → target 1 → 2 → 3 (the same blade) → keeps going while it fades
TIP_KEYS = [[RELEASE_T, RELEASE[0]], [HITS[0], contact(0)], [HITS[1], contact(1)], [HITS[2], contact(2)], [40, contact(2) + 70]]


def tip_x(t):
    for (a, va), (b, vb) in zip(TIP_KEYS, TIP_KEYS[1:]):
        if a <= t <= b:
            return va + (vb - va) * (t - a) / (b - a)
    return TIP_KEYS[-1][1]


def tip_y(t):
    k = min(1, max(0, (t - RELEASE_T) / (HITS[0] - RELEASE_T)))
    return RELEASE[1] + (CONTACT_Y - RELEASE[1]) * k


def dither(a, alpha):
    if alpha >= 1:
        return a
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
    th = np.tile(bayer, (a.shape[0] // 4 + 1, a.shape[1] // 4 + 1))[:a.shape[0], :a.shape[1]]
    a = a.copy()
    a[..., 3] = np.where(th < alpha, a[..., 3], 0)
    return a


def tile(fr, s, alpha=1.0, pivot='core'):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.NEAREST)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    px, py = (fr['tip'] * s, fr['cy'] * s) if pivot == 'tip' else (fr['cx'] * s, fr['cy'] * s)
    return dither(a, alpha), px, py


def tracks_at(t):
    out = []
    if t in MAIN_PLAN:
        a, px, py = tile(MAIN[MAIN_PLAN[t] - 1], SC['main'], MAIN_A[t], 'tip')
        out.append(('main', MAIN_PLAN[t], a, px, py, (tip_x(t), tip_y(t)), MAIN_A[t]))
    for i, plan in enumerate(IMP_PLANS):
        if t in plan:
            a, px, py = tile(IMPACT[plan[t] - 1], SC['imp'] * IMP_SCALE[i], IMP_ALPHA[i])
            out.append((f'impact{i + 1}', plan[t], a, px, py, (contact(i), CONTACT_Y), IMP_ALPHA[i]))
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
    for k in range(-1, 6):
        x = int(T1X - CELL_PX / 2 + (k - 1) * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    img = Image.fromarray(a)
    for tx in TARGETS:
        img.alpha_composite(Image.fromarray(straw), (tx - (132 - 66), GROUND - 86))
    return img


LOG = []


def frame(t, log=True):
    img = background()
    c = char_at(t)
    img.alpha_composite(Image.fromarray(pose(c)), (round(X0 + root_x(t)) - ROOT[0], GROUND - ROOT[1]))
    for key, f, a, px, py, at, op in tracks_at(t):
        img.alpha_composite(Image.fromarray(a), (round(at[0] - px), round(at[1] - py)))
        if log:
            LOG.append({'T': t, 'track': 'main' if key == 'main' else 'impact', 'frame': f, 'x': round(at[0] - px),
                        'y': round(at[1] - py), 'opacity': round(op, 2), 'split': 'front', 'part': key})
    if log:
        for i, h in enumerate(HITS):
            if h <= t <= h + 1:
                LOG.append({'T': t, 'track': 'damage', 'frame': i + 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t == h else 0.5, 'split': '-'})
            if t == h - 1 or t == h:
                LOG.append({'T': t, 'track': 'collision', 'frame': i + 1, 'x': round(contact(i)), 'y': CONTACT_Y,
                            'opacity': 1.0 if t == h else 0.4, 'split': '-'})
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
                '-crf', '14', f'{OUT}/tangxun_s1_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=50,scale=860:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=none',
                '-loop', '0', f'{OUT}/tangxun_s1_preview_50fps.gif'], check=True)
KEYS = [0, 7, 12, 16, 19, 24, 30, 32, 34, 36, 38, 41]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/tangxun_s1_preview_contact.png')


# ------------------------------------------------------------------ in-game strips
def bake_projectile():
    """the flying blade as the projectile sprite: frames 1–8 in order, tip on the frame centre (ProjectileComponent
    centres the frame on the flight point), knife axis on the vertical centre; points right (angle0 0)"""
    tiles = [tile(fr, SC['main'], 1.0, 'tip') for fr in MAIN]
    back = max(px for _, px, _ in tiles)
    up = max(py for _, _, py in tiles)
    down = max(a.shape[0] - py for a, _, py in tiles)
    half_h = int(np.ceil(max(up, down))) + 1
    w, h = 2 * (int(np.ceil(back)) + 2), 2 * half_h
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for i, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (i * w + round(w / 2 - px), round(h / 2 - py)))
    out.save('public/sprites/fx-tangxun-s1-fang.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h}


def bake_impact(i):
    plan = IMP_PLANS[i]
    ts = sorted(plan)
    tiles = [tile(IMPACT[plan[t] - 1], SC['imp'] * IMP_SCALE[i], IMP_ALPHA[i]) for t in ts[::2]]
    l = max(px for _, px, _ in tiles)
    r = max(a.shape[1] - px for a, px, _ in tiles)
    u = max(py for _, _, py in tiles)
    d = max(a.shape[0] - py for a, _, py in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for k, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (k * w + round(l - px) + 1, round(u - py) + 1))
    out.save(f'public/sprites/fx-tangxun-s1-impact{i + 1}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(2000 / 60, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)],
            'dx': round(CONTACT_DX * 1.25, 2), 'dy': round(27.25 + (CONTACT_Y - GROUND) * 1.25, 2),
            'delayMs': round((ts[0] - HITS[i]) * 1000 / FPS)}


game_fx = {'fang': bake_projectile(), **{f'impact{i + 1}': bake_impact(i) for i in range(3)}}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
sx = lambda t: step_of(t) if t < N - 1 else float(len(CHAR))
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(12), 'STRIKE_START': step_of(16), 'DAMAGE': step_of(RELEASE_T),
                   'RECOVERY_START': step_of(41)},
        'root': [[sx(t), round(root_x(t), 1), 0] for t in sorted({k[0] for k in ROOT_KEYS} | set(range(0, N, 3)) | {N - 1})],
        'pierceDelays': [round(d, 3) for d in PIERCE_DELAYS],
        'impact': [{'hitStopMs': round(2 * 1000 / FPS), 'shakePx': 3, 'shakeMs': 50}, {'shakePx': 1, 'shakeMs': 40}, {'shakePx': 1, 'shakeMs': 40}]}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = []
for t in range(N):
    c = char_at(t)
    hx, hy = HAND[c]
    x = X0 + root_x(t)
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [round(x, 1), GROUND],
               'spearTip': [round(x + hx - ROOT[0]), GROUND + hy - ROOT[1]], 'center': [round(x), GROUND - BODY / 2]})
meta = {
    'name': 'tangxun_s1_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 1 Piercing Fang · Tang Xun', '',
               '60 FPS, 46 เฟรม (T000–T045) ≈ 0.77 วินาที · ตัวละคร 10 ท่า + มีดบิน (Main VFX 8 เฟรม) + Impact (8 เฟรม × 3 เป้า)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · หุ่นฟาง 3 ตัวเรียงแนว 1×3',
               'ที่มา: tools/sprites/tangxun_s1.py → tangxun_s1_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill ใน SHEETS hero-tangxun.png (รวม 767 ms) · มีดบิน = กระสุนของเอนจิน (fx-tangxun-s1-fang)',
    'title': 'Timeline Sync Sheet — Skill 1 Piercing Fang  ·  Tang Xun · Whispering Blade',
    'subtitle': '60 FPS · 46 frames (T000–T045) = 0.77 s · 1 column = 1 frame (16.7 ms) · release T019 · pierce T030 / T034 / T036 · one blade',
    'phases': [[0, 6, 'A', 'READY', [120, 130, 150], 'พร้อม'],
               [7, 15, 'B', 'DRAW / ANTICIPATION', [90, 150, 130], 'ดึงมีด / ง้าง'],
               [16, 23, 'C', 'THROW', [60, 170, 140], 'ขว้าง'],
               [24, 35, 'D', 'PROJECTILE TRAVEL', [80, 140, 190], 'มีดทะลวงแนว'],
               [36, 40, 'E', 'IMPACT / FOLLOW-THROUGH', [215, 90, 90], 'ปะทะ / ส่งแรง'],
               [41, 45, 'F', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': HITS,
    'events': [[0, 'CAST_START', 'C01'], [7, 'DRAW_START', 'C02 ดึงมีด'], [12, 'ANTICIPATION_PEAK', 'C04 ศอกง้าง'],
               [16, 'THROW_START', 'C05'], [19, 'PROJECTILE_RELEASE', 'C06 ปลายนิ้ว'], [19, 'MAIN_VFX_SPAWN', 'มีด f1'],
               [20, 'PROJECTILE_ACTIVE', 'มีด + ทางลมหยกแคบ'], [24, 'LINE_TARGET_CHECK_START', 'แนว 1×3'],
               [30, 'DAMAGE_TARGET_1', 'เป้า 1 แรงสุด 240 %'], [31, 'IMPACT_VFX_SPAWN', 'impact เต็ม'],
               [32, 'IMPACT_PEAK', 'วงหยก'], [33, 'TARGET_2_PIERCE', 'มีดเล่มเดิมทะลุ'], [34, 'DAMAGE_TARGET_2', '120 % · impact 65 %'],
               [36, 'DAMAGE_TARGET_3', '120 % · impact 50 %'], [38, 'FOLLOW_THROUGH', 'C08'], [41, 'RECOVERY_START', 'C09'],
               [45, 'ANIMATION_END', 'C10']],
    'lanes': 8,
    'tracks': [['main', 'L3 Projectile Main VFX', [120, 220, 190], 'fx-tangxun-s1-fang (s1_vfx.png 8 fr) = กระสุน', 'L3 · หน้า',
                'ปลายมีด = จุดบิน (pivot) · ปล่อยที่ปลายนิ้ว C06', 'f1 T019 แสงปล่อย · f2–f5 มีด + ทาง · f6 วงลมที่จุดปะทะ · f7–f8 จางหลังเป้า 3'],
               ['collision', 'L4 Target Collision', [200, 200, 120], 'engine LINE_3', '-', '-', 'แตะเป้า 1/2/3 = T030 / T034 / T036'],
               ['damage', 'L5 Damage Events', [230, 90, 90], 'engine', '-', '-', '240 % > 120 % > 120 % (pierceDelays 0.067 / 0.1 วิ)'],
               ['impact', 'L6 Impact VFX', [255, 200, 140], 'fx-tangxun-s1-impact1/2/3 (s1_impact.png 8 fr)', 'L6 · หน้าสุด',
                'จุดสัมผัสหน้าเป้าแต่ละตัว', 'เป้า 1 เต็ม (0.9 ตัว) peak T032 · เป้า 2 65 % · เป้า 3 50 % จางกว่า'],
               ['hitstop', 'L7 Hitstop', [255, 255, 255], 'AnimDef.impact', '-', '-', 'เป้า 1 = 2 เฟรม (33 ms) · เป้า 2/3 = 0']],
    'trackNames': {'main': 'มีดทะลวง', 'collision': 'ชนเป้า', 'damage': 'ดาเมจ', 'impact': 'ประกายกระทบ', 'hitstop': 'หยุดเฟรม'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Root X (L2)'], [3, 'มีดบิน (L3)'], [4, 'ชนเป้า (L4)'], [5, 'ดาเมจ (L5)'],
               [6, 'Impact (L6)'], [7, 'Hitstop (L7)'], [8, 'สั่นกล้อง (L8)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': [0, 12, 19, 30, 34, 36, 41],
    'thumbLabels': {0: 'READY', 12: 'ANTICIPATION', 19: 'RELEASE', 30: 'TARGET 1', 34: 'TARGET 2', 36: 'TARGET 3', 41: 'RECOVERY'},
    'thumbCrop': [20 * UP, 70 * UP, 425 * UP, 180 * UP],
    'travelLabel': 'L2 Root X (px) — ไม่เกิน 6 px ถ่ายน้ำหนักเท้าหน้า', 'heightLabel': 'Y movement (px)',
    'notes': [
        'มีดเล่มเดียว (ไม่มีมีด 3 เล่ม) บินซ้าย > ขวา ทะลุแนว 1×3: เป้า 1 แรงสุด 240 % · เป้า 2 / 3 120 % — ในเกมคือกระสุนของเอนจิน + `overshoot` บินเลยเป้าต่อ',
        'ดาเมจเป้า 2 / 3 ลง +4 / +6 เฟรมหลังเป้า 1 (`DAMAGE.pierceDelays`) พร้อม impact ของตัวเอง (เล็ก/จางกว่า)',
        'ทางมีดแคบ เรียบ แม่นยำ — ไม่ใช่ลูกไฟ / ลำแสง / กระสุนพลังงานใหญ่ · จุดปล่อย = ปลายนิ้วมือขวาท่า C06',
        'Root ไม่เกิน 6 px (runtime AnimDef.root) ยืนเกือบนิ่ง ถ่ายน้ำหนักเท้าหน้าเล็กน้อยตอนขว้าง — ไม่ใช่การพุ่ง',
        'Hit-stop: เป้า 1 = 2 เฟรม เท่านั้น · สั่น 3 px เป้า 1, 1 px เป้า 2/3 · ไม่หยุดทั้งท่าทุกเป้า',
        'Character กับ VFX แยกชั้น · มีดที่ลอยอยู่ในแผ่นท่าถูกตัดออกจากตัวละคร (ภาพนั้นคือกระสุน)',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': ROOT_KEYS, 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/tangxun_s1_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'release': RELEASE, 'gameFx': game_fx, 'game': game}, indent=1, default=float))

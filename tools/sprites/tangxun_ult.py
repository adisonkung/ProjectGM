"""Tang Xun — Ultimate Heaven-Snaring Blade Array: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/tangxun, not committed):
  ult_char.png    character, 2 rows 9 + 8 = 17 frames → public/sprites/hero-tangxun.png row 7 (tools/sprites/tangxun.py)
  ult_charge.png  Charge VFX around Tang Xun, 7 + 6 = 13 frames (wisps → dark-green / shadow vortex with blades → stable
                  star → the blades stream out to the right = release toward the target)
  ult_main.png    Main VFX = the Heaven-Snaring Blade Array at the target, 6 + 6 = 12 frames (ground sigil → orbit →
                  wider formation → lock pillar → tightening spiral)
  ult_impact.png  row 1 (5 frames) = Ultimate Impact (all blades converge → burst → spiral) · row 2 (6 frames) = Residual
                  (broken ribbons, last blades, particles fading) — the user's 4th sheet carries both
  public/sprites/fx-tangxun-s1-impact3.png = the small jade contact spark of the 4 minor hits (reused)

Timeline (user spec 2026-10, 60 FPS, T000–T149 = 2.50 s):
  A cast / prepare T000–017 · B charge T018–039 · C array deploy T040–059 · D orbit / target lock T060–083 ·
  E compression T084–103 · F multi-hit T104–123 (T108 / T112 / T116 / T120) · G final execution T124–133 (T130 finisher) ·
  H impact T134–139 · I residual T140–145 · J recovery T146–149.
  Root <= 12 px (runtime) · hit-stop 1 frame per minor hit, 6 on the finisher · shake 1–2 px / 8 px · push-in 4 %
  T124–T133 back by T140 (preview only).

Painted VFX: alpha + colour unmixed from the magenta key (min(r, b) − g), smooth resize, not pixelated in game.

Usage: python3 tools/sprites/tangxun_ult.py <out dir>
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
from jade import jadeify  # noqa: E402

B.SRC = 'art/incoming/tangxun'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/tangxun_ult'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 150
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 72
CELL_PX = 80
BODY = 78
TX = X0 + 220                           # the locked target (2.75 cells away — Tang Xun never enters melee range)
TCY = GROUND - 40                       # target body centre

# ------------------------------------------------------------------ character (atlas row 7, game scale)
atlas = np.array(Image.open('public/sprites/hero-tangxun.png').convert('RGBA'))
ROW = atlas[7 * CELL_H:8 * CELL_H]
CHAR = [(0, 9, 1), (10, 17, 2), (18, 39, 3), (40, 51, 4), (52, 59, 5), (60, 67, 6), (68, 77, 7), (78, 83, 8), (84, 95, 9),
        (96, 103, 10), (104, 111, 11), (112, 119, 12), (120, 123, 13), (124, 127, 14), (128, 139, 15), (140, 145, 16),
        (146, 149, 17)]
POSES = {1: ('READY', 'ยืนพร้อม', 'CAST_START T000'),
         2: ('DRAW', 'ย่อตัว ชักมีดลับ', 'PREPARE_ARRAY T010'),
         3: ('CHARGE', 'กางแขน มีดสองมือ คุมพลัง', 'CHARGE T018–T039'),
         4: ('RELEASE', 'ชี้ปล่อยค่ายมีด', 'MAIN_VFX_SPAWN T040'),
         5: ('CONTROL', 'ย่อตัว มือคุมค่าย', 'ARRAY_FORMED T048'),
         6: ('RAISE', 'ยกมือคุมวงโคจร', 'ORBIT_START T060'),
         7: ('RAISE', 'ยกมีดสูง (กระโดดเบา)', 'TARGET_SCAN T068'),
         8: ('LOCK', 'ลงพื้น มือยังชู', 'TARGET_LOCK T080'),
         9: ('COMMAND', 'ชี้สั่งบีบค่าย', 'COMPRESSION T084'),
         10: ('COMMAND', 'ค้างแขนชี้', 'ARRAY_TIGHT T096'),
         11: ('GUIDE', 'ชี้นำมีด', 'HIT 1 T108'),
         12: ('GUIDE', 'ย่อรวบมือ', 'HIT 2 / 3'),
         13: ('GUIDE', 'ชี้อีกครั้ง', 'HIT 4 T120'),
         14: ('GATHER', 'ย่อ ยกมีดเตรียมสั่งปิด', 'FINAL_ALIGNMENT T124'),
         15: ('EXECUTE', 'ชี้สั่งเด็ดขาด ค้างจนระเบิด', 'FINAL_DAMAGE T130'),
         16: ('SETTLE', 'ย่อต่ำ ผ่อนแรง', 'RESIDUAL T140'),
         17: ('READY', 'ยืนพร้อม', 'RECOVERY T146')}
HITS = [108, 112, 116, 120]
FINAL = 130
WEIGHTS = [0.10, 0.10, 0.10, 0.15, 0.55]
ROOT_KEYS = [[0, 0], [40, 0], [44, 4], [52, 2], [60, 0], [84, 0], [88, 5], [104, 4], [124, 2], [128, 8], [132, 12],
             [140, 10], [146, 5], [149, 0]]


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


straw = np.array(Image.open('public/sprites/enemy-straw-recruit.png').convert('RGBA'))[0:100, 0:132][:, ::-1]
spark = np.array(Image.open('public/sprites/fx-tangxun-s1-impact3.png').convert('RGBA'))
SPARK_W = spark.shape[1] // 3


# ------------------------------------------------------------------ VFX (painted, soft alpha)
def unmix(name):
    rgb = np.array(Image.open(f'{B.SRC}/{name}.png').convert('RGB')).astype(float)
    bg = np.median(rgb[:6].reshape(-1, 3), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = np.clip(1 - (np.minimum(r, b) - g) / (min(bg[0], bg[2]) - bg[1]), 0, 1)
    al = np.where(al < 0.1, 0, al)
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = jadeify(col)   # Tang Xun's jade palette (tools/sprites/jade.py)
    out[..., 3] = (al * 255).astype(np.uint8)
    return out


def cut(name, rows):
    """rows = [(y0, y1, centres, pivots)] · blobs of a row band → nearest frame centre · pivot = (x, y) in source px
    (None = centre x / band bottom)"""
    im = unmix(name)
    out = []
    for y0, y1, centres, pivots in rows:
        band = im[y0:y1]
        a = band[..., 3] > 25
        lab, k = ndimage.label(a, np.ones((3, 3)))
        cx = np.array(ndimage.center_of_mass(a, lab, np.arange(1, k + 1)))[:, 1]
        cen = np.array(centres, float)
        owner = np.zeros(a.shape, int) - 1
        idx = np.argmin(np.abs(cx[:, None] - cen[None, :]), 1)
        owner[a] = idx[lab[a] - 1]
        for j, (c, pv) in enumerate(zip(centres, pivots)):
            own = owner == j
            yy, xx = np.nonzero(own)
            fx0, fx1, fy0, fy1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
            fr = band[fy0:fy1, fx0:fx1].copy()
            fr[..., 3] = np.where(own[fy0:fy1, fx0:fx1], fr[..., 3], 0)
            px, py = pv
            out.append({'img': fr, 'px': px - fx0, 'py': py - y0 - fy0})
    return out


def mids(segs):
    return [(a + b) / 2 for a, b in segs]


CH1 = mids([(21, 264), (295, 548), (579, 835), (863, 1124), (1150, 1459), (1479, 1809), (1838, 2154)])
CH2 = [190, 560, 928, 1310, 1660, 1995]
# charge pivot = Tang Xun's feet: the ground-ring centre (row 1 y 300, row 2 y 625); the streaming frames (row 2 f4–f6)
# start at his throwing hand at chest height and travel out toward the target (pivot left of their left end)
CHARGE = cut('ult_charge', [(0, 338, CH1, [(x, 300) for x in CH1]),
                            (346, 679, CH2, [(x, 625) for x in CH2[:3]] + [(1121 - 65, 665), (1500 - 125, 665), (1835 - 205, 665)])])
MA1 = mids([(70, 229), (309, 553), (588, 845), (880, 1147), (1165, 1445), (1460, 1756)])
MA2 = mids([(20, 290), (309, 576), (595, 896), (907, 1176), (1203, 1472), (1494, 1742)])
# main pivot = the ground sigil under the target (ring centre)
MAIN = cut('ult_main', [(132, 398, MA1, [(x, 362) for x in MA1]), (481, 806, MA2, [(x, 752) for x in MA2])])
IM1 = [278, 791, 1240, 1620, 1985]
IM2 = [202, 625, 1026, 1385, 1700, 2000]
IMPACT = cut('ult_impact', [(68, 365, IM1, [(x, 216) for x in IM1])])
RESIDUAL = cut('ult_impact', [(405, 657, IM2, [(x, 531) for x in IM2])])


def size(fr, thr=60):
    ys, xs = np.nonzero(fr['img'][..., 3] > thr)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes (game px) — "more spectacular" pass (user 2026-10): charge peak (f7) ≈ 1.6 body tall around Tang Xun · array at
# its widest (main f9) ≈ 1.95 body tall · impact f1 = 2.0 body wide (top of the spec's 1.5–2 character heights) ·
# residual at the impact's scale · every painted layer gets a soft jade bloom (GLOW)
SC = {'charge': 1.6 * BODY / size(CHARGE[6])[1], 'main': 1.95 * BODY / size(MAIN[8])[1],
      'impact': 2.0 * BODY / size(IMPACT[0])[0]}
GLOW = {'charge': (3, 0.45), 'main': (3, 0.6), 'impact': (4, 0.85), 'residual': (2, 0.4)}
SC['residual'] = SC['impact']

# ------------------------------------------------------------------ plans: T → (frame 1-based, alpha, scale mul)
CHARGE_PLAN = {}
# user 2026-10: charge done → the blades are THROWN at T040 (charge f11–f13 stream out of his hand) → they fly in and
# surround the target (SURROUND) → only then the storm / array (MAIN) forms → minor cuts → explosion
# smoothness pass (user 2026-10: "frames look rushed"): every charge frame held 2–4 T, the stream tail lingers to T051
CH_KEYS = [(18, 1), (21, 2), (24, 3), (27, 4), (30, 5), (33, 6), (35, 7), (38, 8), (40, 9), (42, 10), (44, 11), (47, 12),
           (50, 13), (54, None)]
for (t0, f), (t1, _) in zip(CH_KEYS, CH_KEYS[1:]):
    for t in range(t0, t1):
        CHARGE_PLAN[t] = f
for t in list(CHARGE_PLAN):
    CHARGE_PLAN[t] = (CHARGE_PLAN[t], 1.0 if t < 45 else max(0.15, 1 - (t - 44) * 0.095), 1.0)
MAIN_KEYS = [(56, 1), (60, 2), (64, 3), (68, 4), (72, 5), (76, 6), (80, 7), (86, 8), (96, 9), (104, 10), (112, 11),
             (120, 12), (130, None)]
MAIN_PLAN = {}
for (t0, f), (t1, _) in zip(MAIN_KEYS, MAIN_KEYS[1:]):
    for t in range(t0, t1):
        a = (min(1.0, 0.2 + 0.1 * (t - 56)) if t < 124 else [0.85, 0.7, 0.55, 0.4, 0.3, 0.2][t - 124])
        MAIN_PLAN[t] = (f, a, 1.0)
IMP_KEYS = [(130, 1, 0.8), (131, 1, 0.88), (132, 1, 0.95), (133, 1, 1.0), (134, 1, 1.0), (135, 2, 1.0), (136, 2, 1.0),
            (137, 3, 1.0), (138, 4, 1.0), (139, 5, 1.0)]
IMP_PLAN = {t: (f, 1.0, s) for t, f, s in IMP_KEYS}
RES_PLAN = {}
for k, f in enumerate([1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6]):
    RES_PLAN[140 + k] = (f, 1.0 if k < 12 else 0.75, 1.0)
SPARK_PLAN = {}                          # minor hit → small jade spark (3 frames × 2 T) at a spot on the target
SPARK_AT = [(-10, -14), (6, -26), (-4, 2), (10, -8)]
for i, h in enumerate(HITS):
    for d in range(6):
        SPARK_PLAN.setdefault(h + d, []).append((i, d // 2))
HITSTOP = {108: 1, 112: 1, 116: 1, 120: 1, 130: 6}
SHAKE = {108: (1, 0), 112: (-1, 0), 116: (1, 1), 120: (-2, 0), 121: (1, 0),
         130: (8, 0), 131: (-6, 2), 132: (5, -1), 133: (-4, 1), 134: (3, 0), 135: (-2, 0), 136: (1, 0)}


def zoom_at(t):
    if 124 <= t <= 133:
        return 1 + 0.04 * (t - 124) / 9
    if 133 < t < 140:
        return 1 + 0.04 * (140 - t) / 7
    return 1.0


def bloom(a, rad, strength, col=(150, 255, 205)):
    """soft jade glow under the bright parts of a painted tile (padded by 3 × rad) → (rgba, pad)"""
    pad = rad * 3
    big = np.pad(a, ((pad, pad), (pad, pad), (0, 0)))
    luma = big[..., :3].astype(float).mean(-1) / 255
    w = big[..., 3] / 255 * luma ** 2
    g = np.clip(ndimage.gaussian_filter(w, rad) * strength * 2.2, 0, 1)
    glow = np.zeros_like(big)
    glow[..., 0], glow[..., 1], glow[..., 2] = col
    glow[..., 3] = (g * 255).astype(np.uint8)
    out = Image.fromarray(glow)
    out.alpha_composite(Image.fromarray(big))
    return np.array(out), pad


def tile(fr, s, alpha=1.0, glow=None):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    a = np.array(img)
    px, py = fr['px'] * s, fr['py'] * s
    if glow:
        a, pad = bloom(a, *glow)
        px, py = px + pad, py + pad
    a[..., 3] = (a[..., 3].astype(float) * alpha).astype(np.uint8)
    return a, px, py


# ---- surround: 8 blades (the S2 single-blade art) thrown at T040 fly in from Tang Xun's side, fan out and take a ring
# around the target (T047), orbit pointing inward while the storm forms (MAIN from T050), fade by T056
BLADE = np.array(Image.open('public/sprites/fx-tangxun-s2-blade.png').convert('RGBA'))
BLADE = BLADE[:, 4 * (BLADE.shape[1] // 8):5 * (BLADE.shape[1] // 8)]      # f5: blade + jade trail, tip at the centre
SUR_T0, SUR_ARRIVE, SUR_END = 40, 52, 66
SUR_FROM = (-175, -4)                   # launch point relative to the target centre (Tang Xun's hand, in front of him)
SUR_RING = 64                           # ring radius (x), ellipse 0.55
SUR_PLAN = list(range(SUR_T0, SUR_END))


def _ring(k, t):
    spin = 0 if t <= SUR_ARRIVE else 7 * (t - SUR_ARRIVE) + 0.12 * (t - SUR_ARRIVE) ** 2
    th = np.radians(k * 45 + 22.5 + spin)
    return th, np.array([SUR_RING * np.cos(th), SUR_RING * np.sin(th) * 0.55])


def _blade_pos(k, t):
    """(position, angle) of blade k at T (relative to the target centre)"""
    th, ring = _ring(k, t)
    if t >= SUR_ARRIVE:
        inward = np.degrees(np.arctan2(np.sin(th) * 0.55, -np.cos(th)))
        return ring, inward
    u = (t - SUR_T0) / (SUR_ARRIVE - SUR_T0)
    e = u * u * (3 - 2 * u) * 0.35 + (1 - (1 - u) ** 3) * 0.65   # quick launch, long soft settle
    p0 = np.array(SUR_FROM, float) + np.array([0, (k - 3.5) * 2])
    ctrl = (p0 + ring) / 2 + np.array([0, -38 + (k % 4) * 14])  # fan: each blade on its own arc
    pos = (1 - e) ** 2 * p0 + 2 * (1 - e) * e * ctrl + e ** 2 * ring
    d = 2 * (1 - e) * (ctrl - p0) + 2 * e * (ring - ctrl)  # velocity → blade direction (PIL rotates CCW, y down)
    ang = np.degrees(np.arctan2(-d[1], d[0]))
    if u > 0.6:                                            # turn to face the target as it settles
        inward = np.degrees(np.arctan2(np.sin(th) * 0.55, -np.cos(th)))
        k2 = (u - 0.6) / 0.4
        k2 = k2 * k2 * (3 - 2 * k2)
        ang = ang + ((inward - ang + 180) % 360 - 180) * k2
    return pos, ang


def surround_tile(t):
    x0, x1, y0, y1 = SUR_FROM[0] - 40, SUR_RING + 40, -80, 60
    img = Image.new('RGBA', (x1 - x0, y1 - y0), (0, 0, 0, 0))
    b = Image.fromarray(BLADE)
    alpha = 1.0 if t < 59 else max(0.0, 1 - (t - 58) * 0.13)
    for k in range(8):
        pos, ang = _blade_pos(k, t)
        r = b.rotate(ang, Image.BICUBIC, expand=True)
        a = np.array(r)
        a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
        img.alpha_composite(Image.fromarray(a), (round(pos[0] - x0 - r.width / 2), round(pos[1] - y0 - r.height / 2)))
    a, pad = bloom(np.array(img), 2, 0.6)
    return a, -x0 + pad, -y0 + pad


# ---- jade shockwave ring on the ground under the target, T130–T141 (under the units)
def shock_tile(t):
    k = (t - FINAL) / 11
    rx = 22 + 108 * (1 - (1 - k) ** 2)
    ry = rx * 0.3
    W2, H2 = int(2 * rx + 24), int(2 * ry + 24)
    img = Image.new('RGBA', (W2, H2), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = W2 / 2, H2 / 2
    al = int(255 * (1 - k) ** 1.2)
    d.ellipse((cx - rx, cy - ry, cx + rx, cy + ry), outline=(120, 240, 190, al), width=max(1, round(4 * (1 - k)) + 1))
    d.ellipse((cx - rx + 3, cy - ry + 1, cx + rx - 3, cy + ry - 1), outline=(235, 255, 245, al // 2), width=1)
    a, pad = bloom(np.array(img), 2, 0.7)
    return a, cx + pad, cy + pad


SHOCK_PLAN = list(range(FINAL, FINAL + 12))


def blend_tiles(t0, t1, w):
    """two painted tiles on one canvas (pivots aligned): t0 at 1 − w, t1 at w"""
    (a0, x0, y0), (a1, x1, y1) = t0, t1
    l, u = max(x0, x1), max(y0, y1)
    r = max(a0.shape[1] - x0, a1.shape[1] - x1)
    d = max(a0.shape[0] - y0, a1.shape[0] - y1)
    W2, H2 = int(np.ceil(l + r)) + 1, int(np.ceil(u + d)) + 1
    out = Image.new('RGBA', (W2, H2), (0, 0, 0, 0))
    for a, px, py, k in [(a0, x0, y0, 1 - w), (a1, x1, y1, w)]:
        if k <= 0.01:
            continue
        b = a.copy()
        b[..., 3] = (b[..., 3] * k).astype(np.uint8)
        out.alpha_composite(Image.fromarray(b), (round(l - px), round(u - py)))
    return np.array(out), l, u


MAIN_HOLD = {}
for (t0, f), (t1, _) in zip(MAIN_KEYS, MAIN_KEYS[1:]):
    for t in range(t0, t1):
        MAIN_HOLD[t] = (t - t0, t1 - t0)


def main_tile(t):
    f, a, m = MAIN_PLAN[t]
    cur = tile(MAIN[f - 1], SC['main'] * m, a, GLOW['main'])
    i, n = MAIN_HOLD[t]
    fade = min(4, n - 1)                                  # last ≤ 4 T of each hold dissolve into the next frame
    if f < len(MAIN) and t + 1 in MAIN_PLAN and i >= n - fade:
        w = (i - (n - fade) + 1) / (fade + 1)
        nxt = tile(MAIN[f], SC['main'] * m, a, GLOW['main'])
        return blend_tiles(cur, nxt, w)
    return cur


def tracks_at(t):
    """(key, frame, rgba, pivot x, pivot y, anchor xy, alpha, layer)"""
    out = []
    feet = (X0 + root_x(t), GROUND)
    if t in CHARGE_PLAN:
        f, a, m = CHARGE_PLAN[t]
        img, px, py = tile(CHARGE[f - 1], SC['charge'] * m, a, GLOW['charge'])
        out.append(('charge', f, img, px, py, feet, a, 'under'))
    if t in MAIN_PLAN:
        f, a, m = MAIN_PLAN[t]
        img, px, py = main_tile(t)
        out.append(('main', f, img, px, py, (TX, GROUND - 2), a, 'over'))
    for i, k in SPARK_PLAN.get(t, []):
        img = spark[:, k * SPARK_W:(k + 1) * SPARK_W]
        out.append(('spark', i + 1, img, SPARK_W / 2, img.shape[0] / 2, (TX + SPARK_AT[i][0], TCY + SPARK_AT[i][1]), 1.0, 'over'))
    if t in IMP_PLAN:
        f, a, m = IMP_PLAN[t]
        img, px, py = tile(IMPACT[f - 1], SC['impact'] * m, a, GLOW['impact'])
        out.append(('impact', f, img, px, py, (TX, TCY), a, 'over'))
    if t in SUR_PLAN:
        img, px, py = surround_tile(t)
        out.append(('surround', t - SUR_T0 + 1, img, px, py, (TX, TCY), 1.0, 'over'))
    if t in SHOCK_PLAN:
        img, px, py = shock_tile(t)
        out.append(('shock', t - FINAL + 1, img, px, py, (TX, GROUND - 2), 1.0, 'under'))
    if t in RES_PLAN:
        f, a, m = RES_PLAN[t]
        img, px, py = tile(RESIDUAL[f - 1], SC['residual'] * m, a, GLOW['residual'])
        out.append(('residual', f, img, px, py, (TX, TCY), a, 'over'))
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
    for k in range(-4, 3):
        x = int(TX - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    img = Image.fromarray(a)
    img.alpha_composite(Image.fromarray(straw), (TX - (132 - 66), GROUND - 86))
    return img


LOG = []


def put(img, a, px, py, at):
    x, y = round(at[0] - px), round(at[1] - py)
    tile_img = Image.fromarray(a)
    img.alpha_composite(tile_img, (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return x, y


def frame(t, log=True):
    img = background()
    tr = tracks_at(t)
    for key, f, a, px, py, at, op, layer in tr:
        if layer == 'under':
            x, y = put(img, a, px, py, at)
            if log:
                LOG.append({'T': t, 'track': key, 'frame': f, 'x': x, 'y': y, 'opacity': round(op, 2), 'split': 'back', 'part': key})
    c = char_at(t)
    img.alpha_composite(Image.fromarray(pose(c)), (round(X0 + root_x(t)) - ROOT[0], GROUND - ROOT[1]))
    for key, f, a, px, py, at, op, layer in tr:
        if layer == 'over':
            x, y = put(img, a, px, py, at)
            if log:
                LOG.append({'T': t, 'track': key, 'frame': f, 'x': x, 'y': y, 'opacity': round(op, 2), 'split': 'front', 'part': key})
    if log:
        for name, a0, a1 in [('mark', 68, 74), ('mark', 74, 80), ('mark', 80, 130)]:
            if a0 <= t < a1:
                LOG.append({'T': t, 'track': 'mark', 'frame': {68: 1, 74: 2, 80: 3}[a0], 'x': 0, 'y': 0,
                            'opacity': 1.0 if a0 == 80 else 0.6, 'split': '-'})
        for i, h in enumerate(HITS):
            if h <= t <= h + 1:
                LOG.append({'T': t, 'track': 'minor', 'frame': i + 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t == h else 0.5, 'split': '-'})
        if FINAL <= t <= FINAL + 3:
            LOG.append({'T': t, 'track': 'final', 'frame': 5, 'x': 0, 'y': 0, 'opacity': 1.0 if t == FINAL else 0.5, 'split': '-'})
        for h, n in HITSTOP.items():
            if h <= t < h + n:
                LOG.append({'T': t, 'track': 'hitstop', 'frame': 1, 'x': 0, 'y': 0, 'opacity': 1.0, 'split': '-'})
    if t in SHAKE:
        out = background()
        out.paste(img, SHAKE[t])
        img = out
    z = zoom_at(t)
    if z > 1:
        cw, ch = W / z, H / z
        cx, cy = (X0 + TX) / 2 + 20, GROUND - 60
        x0 = min(max(0, cx - cw / 2), W - cw)
        y0 = min(max(0, cy - ch / 2), H - ch)
        img = img.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((W, H), Image.BILINEAR)
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/tangxun_ult_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=645:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/tangxun_ult_preview_30fps.gif'], check=True)
KEYS = [0, 30, 36, 40, 43, 46, 49, 52, 55, 58, 62, 66, 72, 80, 96, 108, 120, 130, 133, 140]
KEYS = sorted(KEYS)
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 5))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/tangxun_ult_preview_contact.png')


# ------------------------------------------------------------------ in-game strips (30 FPS timeline order)
def bake(name, plan, scale, frames_src, ts, glow=None):
    """frames = the plan at every 2nd T in `ts` · common pivot box · returns FxDef numbers (px of this preview scale)"""
    tiles = []
    for t in ts[::2]:
        f, a, m = plan[t]
        tiles.append(tile(frames_src[f - 1], scale * m, a, glow))
    return bake_tiles(name, tiles)


def bake_tiles(name, tiles, frame_ms=2000 / 60):
    l = max(px for _, px, _ in tiles)
    r = max(a.shape[1] - px for a, px, _ in tiles)
    u = max(py for _, _, py in tiles)
    d = max(a.shape[0] - py for a, _, py in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for k, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (k * w + round(l - px) + 1, round(u - py) + 1))
    out.save(f'public/sprites/fx-tangxun-ult-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


game_fx = {
    'charge': {**bake('charge', CHARGE_PLAN, SC['charge'], CHARGE, sorted(CHARGE_PLAN), GLOW['charge']), 'dy': 27.25},
    'main': {**bake_tiles('main', [main_tile(t) for t in sorted(MAIN_PLAN)[::2]]), 'dy': round(27.25 - 2 * 1.25, 2),
             'delayMs': round((min(MAIN_PLAN) - 40) * 1000 / FPS)},
    'impact': {**bake('impact', IMP_PLAN, SC['impact'], IMPACT, sorted(IMP_PLAN), GLOW['impact']), 'dy': round(27.25 + (TCY - GROUND) * 1.25, 2)},
    'residual': {**bake('residual', RES_PLAN, SC['residual'], RESIDUAL, sorted(RES_PLAN), GLOW['residual']), 'dy': round(27.25 + (TCY - GROUND) * 1.25, 2),
                 'delayMs': round((140 - FINAL) * 1000 / FPS)},
    # 60 FPS strip (26 frames T040–T065) — the thrown blades must visibly travel in
    'surround': {**bake_tiles('surround', [surround_tile(t) for t in SUR_PLAN], 1000 / 60), 'dy': round(27.25 + (TCY - GROUND) * 1.25, 2)},
    'shock': {**bake_tiles('shock', [shock_tile(t) for t in SHOCK_PLAN[::2]]), 'dy': round(27.25 - 2 * 1.25, 2)},
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
sx = lambda t: step_of(t) if t < N - 1 else float(len(CHAR))
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(10), 'CHARGE_START': step_of(18), 'CHARGE_PEAK': step_of(36),
                   'VFX_SPAWN': step_of(40), 'FINAL_ANTICIPATION': step_of(124), 'STRIKE_START': step_of(128),
                   'DAMAGE': [step_of(t) for t in HITS + [FINAL]], 'RECOVERY_START': step_of(146)},
        'root': [[sx(t), round(root_x(t), 1), 0] for t in sorted({k[0] for k in ROOT_KEYS} | set(range(0, N, 6)) | {N - 1})],
        'weights': WEIGHTS,
        'impact': [{'hitStopMs': 17, 'shakePx': 1, 'shakeMs': 40}] * 3 + [{'hitStopMs': 17, 'shakePx': 2, 'shakeMs': 50},
                                                                          {'hitStopMs': 100, 'shakePx': 8, 'shakeMs': 240, 'flashMs': 180}]}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = []
for t in range(N):
    c = char_at(t)
    x = X0 + root_x(t)
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [round(x, 1), GROUND], 'spearTip': [round(x), GROUND - 50],
               'center': [round(x), GROUND - BODY / 2]})
meta = {
    'name': 'tangxun_ult_sync_sheet',
    'readme': ['Timeline Sync Sheet — Ultimate Heaven-Snaring Blade Array · Tang Xun', '',
               '60 FPS, 150 เฟรม (T000–T149) = 2.50 วินาที · ตัวละคร 17 ท่า + Charge 13 + Main 12 + Impact 5 + Residual 6 เฟรม',
               'Frames = ทุกเฟรม · Character = ท่า C01–C17 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · เป้าล็อกห่าง 2.75 ช่อง',
               'ที่มา: tools/sprites/tangxun_ult.py → tangxun_ult_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า ult ใน SHEETS hero-tangxun.png (รวม 2500 ms) · ซูม 4 % = preview เท่านั้น',
    'title': 'Timeline Sync Sheet — Ultimate Heaven-Snaring Blade Array  ·  Tang Xun · Whispering Blade',
    'subtitle': '60 FPS · 150 frames (T000–T149) = 2.50 s · 1 column = 1 frame (16.7 ms) · lock T080 · hits T108 / T112 / T116 / T120 · finisher T130',
    'phases': [[0, 17, 'A', 'CAST / PREPARE', [120, 130, 150], 'ร่าย / เตรียม'],
               [18, 39, 'B', 'CHARGE', [90, 110, 170], 'ชาร์จ'],
               [40, 59, 'C', 'ARRAY DEPLOY', [60, 170, 140], 'กางค่าย'],
               [60, 83, 'D', 'ORBIT / LOCK', [70, 150, 190], 'โคจร / ล็อก'],
               [84, 103, 'E', 'COMPRESSION', [100, 130, 200], 'บีบค่าย'],
               [104, 123, 'F', 'MULTI-HIT', [200, 140, 80], 'ฟันรัว'],
               [124, 133, 'G', 'FINAL', [215, 90, 90], 'ปิดฉาก'],
               [134, 139, 'H', 'IMPACT', [235, 120, 110], 'ระเบิด'],
               [140, 145, 'I', 'RESIDUAL', [150, 110, 170], 'เศษค่าย'],
               [146, 149, 'J', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': HITS + [FINAL],
    'events': [[0, 'CAST_START', 'C01'], [10, 'PREPARE_ARRAY', 'C02'], [18, 'CHARGE_VFX_START', 'C03'], [28, 'CHARGE_BUILD', ''],
               [36, 'CHARGE_PEAK', ''], [40, 'MAIN_VFX_SPAWN', 'C04 ปามีด 8 เล่ม'], [52, 'BLADES_SURROUND', 'มีดล้อมเป้า'], [56, 'ARRAY_FORMED', 'พายุค่ายมีดก่อตัว'], [60, 'ORBIT_START', 'C06'],
               [68, 'TARGET_SCAN', ''], [74, 'MARK_PRIORITY_CHECK', 'แผลเปิดก่อน'], [80, 'TARGET_LOCK', 'C08'],
               [84, 'ARRAY_COMPRESSION_START', 'C09'], [96, 'ARRAY_TIGHT', ''], [104, 'CONVERGENCE_START', 'C11'],
               [108, 'MULTI_HIT_1', '10 %'], [112, 'MULTI_HIT_2', '10 %'], [116, 'MULTI_HIT_3', '10 %'], [120, 'MULTI_HIT_4', '15 %'],
               [124, 'FINAL_ALIGNMENT', 'C14'], [128, 'FINAL_BLADE_CONVERGENCE', 'C15'], [130, 'FINAL_DAMAGE', '55 % คริ'],
               [130, 'IMPACT_VFX_SPAWN', ''], [133, 'IMPACT_PEAK', ''], [140, 'RESIDUAL_FX_START', 'C16'],
               [146, 'RECOVERY_START', 'C17'], [149, 'ANIMATION_END', '']],
    'lanes': 9,
    'tracks': [['charge', 'L3 Ultimate Charge VFX', [150, 120, 210], 'fx-tangxun-ult-charge (ult_charge.png 13 fr)', 'L3 · หลังตัว',
                'เท้าถังซวิ่น (วงพื้น)', 'T018 ไอลม → มีดโผล่ → วงหมุน T036 peak → T040 ปามีดออกไปทางเป้า → จางถึง T046'],
               ['surround', 'L3b Blade Surround', [140, 255, 215], 'fx-tangxun-ult-surround (มีด S2 × 8, 60 FPS)', 'L4 · หน้า',
                'กลางตัวเป้า (ปล่อยจากฝั่งถังซวิ่น)', 'T040 ปามีด 8 เล่ม → บินโค้งกระจาย → T052 ล้อมเป้าเป็นวง → หมุนช้า ๆ → จาง T059–T065'],
               ['main', 'L4 Ultimate Main VFX', [80, 200, 150], 'fx-tangxun-ult-main (ult_main.png 12 fr)', 'L4 · หน้า',
                'ตราบนพื้นใต้เป้า', 'T056 ตรา (หลังมีดล้อมเป้า) ค่อย ๆ ชัด → T064 ค่ายก่อตัว → T080 เสาล็อก → T096 บีบแน่น → จาง T124–T129'],
               ['mark', 'L5 Target / Mark State', [240, 150, 220], 'TargetRule FOCUS → MARKED (open_wound)', '-', '-',
                'T068 สแกน · T074 เช็กแผลเปิด · T080 ล็อก'],
               ['spark', 'L6 Minor Hit Events', [120, 230, 200], 'fx-tangxun-s1-impact3 (ประกายหยกเล็ก ใช้ซ้ำ)', 'L6 · หน้า',
                'จุดบนตัวเป้า 4 จุด', 'T108 / T112 / T116 / T120 = 10 / 10 / 10 / 15 %'],
               ['minor', 'L6b Minor Damage', [230, 160, 90], 'engine (repeat 5)', '-', '-', 'ตัดร่าย Break 60 ที่ครั้งแรก'],
               ['final', 'L7 Final Damage', [230, 90, 90], 'engine', '-', '-', 'T130 = 55 % คริแน่นอน + รอบตัว 8 ช่อง'],

               ['impact', 'L8 Ultimate Impact VFX', [255, 200, 140], 'fx-tangxun-ult-impact (ult_impact.png แถว 1, 5 fr) + bloom', 'L8 · หน้าสุด',
                'กลางตัวเป้า', 'T130 → peak T133 (2.0 ตัว) → T139'],
               ['shock', 'L8b Shockwave', [120, 240, 190], 'fx-tangxun-ult-shock (วงพื้นหยก)', 'L8 · ใต้ตัว',
                'พื้นใต้เป้า', 'T130 → T141 ขยายถึง ~3 ช่อง แล้วจาง'],
               ['residual', 'L9 Residual FX', [170, 130, 200], 'fx-tangxun-ult-residual (ult_impact.png แถว 2, 6 fr)', 'L9 · หน้า',
                'กลางตัวเป้า', 'T140 → T157 ไม่มีดาเมจ'],
               ['hitstop', 'L10 Hitstop', [255, 255, 255], 'AnimDef.impact', '-', '-', 'ครั้งย่อย 1 เฟรม · ปิดฉาก 6 เฟรม']],
    'trackNames': {'charge': 'ชาร์จ', 'main': 'ค่ายมีด', 'mark': 'สแกน / ล็อก', 'spark': 'ประกายย่อย', 'minor': 'ดาเมจย่อย',
                   'final': 'ดาเมจปิด', 'surround': 'มีดล้อมเป้า', 'shock': 'คลื่นพื้น', 'impact': 'ระเบิด', 'residual': 'เศษค่าย', 'hitstop': 'หยุดเฟรม'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Root X (L2)'], [3, 'ชาร์จ (L3)'], [4, 'ค่ายมีด (L4)'], [5, 'ล็อกเป้า (L5)'],
               [6, 'ดาเมจย่อย (L6)'], [7, 'ดาเมจปิด (L7)'], [8, 'Impact (L8)'], [9, 'Residual (L9)'], [10, 'Hitstop (L10)'],
               [11, 'สั่นกล้อง (L11)'], [12, 'ซูม (L12)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': [0, 36, 46, 54, 80, 96, 108, 133, 140, 146],
    'thumbLabels': {0: 'READY', 36: 'CHARGE PEAK', 46: 'BLADES THROWN', 54: 'SURROUND', 80: 'LOCK', 96: 'TIGHT', 108: 'HIT 1', 128: 'ALIGN',
                    133: 'IMPACT PEAK', 140: 'RESIDUAL', 146: 'RECOVERY'},
    'thumbCrop': [20 * UP, 40 * UP, 420 * UP, 185 * UP],
    'travelLabel': 'L2 Root X (px) — ไม่เกิน 12 px ยืนที่เดิม', 'heightLabel': 'Y movement (px) — ยืนพื้น',
    'notes': [
        'ถังซวิ่นยืนที่เดิมตลอด (root ไม่เกิน 12 px) ไม่เข้าระยะประชิด — พลังมาจากค่ายมีด ไม่ใช่การเคลื่อนที่',
        'ลำดับ: ชาร์จเสร็จ T036 > ปามีดออก T040 > มีด 8 เล่มบินไปล้อมเป้า T052 > พายุค่ายมีดก่อตัว T056 > บีบ > ฟันย่อย > ระเบิด T130',
        'เลือกเป้า: โฟกัสของผู้เล่น แล้ว แผลเปิด (Open Wound จาก S2) แล้ว แถวหลัง แล้ว ผู้ร่าย แล้ว เป้าปัจจุบัน',
        'ครั้งย่อย T108 / T112 / T116 / T120 = 10 / 10 / 10 / 15 % ใช้ประกายหยกเล็ก ไม่ใช้ Impact ใหญ่ · hit-stop 1 เฟรม สั่น 1-2 px',
        'ปิดฉาก T130 = 55 % คริแน่นอน + รอบตัว 8 ช่อง · Impact 2.0 ตัว peak T133 · hit-stop 6 เฟรม สั่น 8 px แฟลช 180 ms · ไม่ระเบิดทั้งสนาม',
        'อลังการขึ้น: ทุกชั้นภาพวาดมี bloom หยก · ค่ายมีด 1.95 ตัว · T040 ปามีด 8 เล่มบินไปล้อมเป้า (T052) ก่อนพายุค่ายมีดก่อตัว (T056) · ภาพค่ายมีดค่อย ๆ ละลายเข้าเฟรมถัดไป (cross-fade) ไม่กระตุก · T130 คลื่นพื้นหยกขยาย ~3 ช่อง',
        'Residual T140 ไม่มีดาเมจ · ซูม 4 % T124 ถึง T133 กลับ T140 (preview เท่านั้น)',
        'VFX เป็นภาพวาด: alpha / สีแยกจากพื้น magenta, ย่อแบบเนียน ไม่ pixelated',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': ROOT_KEYS, 'height': [[0, 0], [N - 1, 0]], 'zoom': [[t, round(zoom_at(t), 4)] for t in range(N)]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/tangxun_ult_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'gameFx': game_fx, 'game': {k: v for k, v in game.items() if k != 'root'}}, indent=1, default=float))

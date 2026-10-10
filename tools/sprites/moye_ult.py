"""Mo Ye — Ultimate Thousand Petal Execution: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/moye, not committed):
  ult_main.png      main VFX, 2 rows 7 + 5 (thin streak → crescents → crescent + swirl → vortex → broken rings → trail)
  ult_impact.png    impact VFX, 7 frames (ground burst: spikes → big crimson flower of blades → swirl → petals)
  ult_residual.png  residual FX, 2 rows 5 + 6 (dense vortex → broken ribbons → drifting petals → ink → gone)
  public/sprites/hero-moye.png row 7 (character, 16 frames, built by tools/sprites/moye.py — NO root baked: the local
  steps between slashes and the leap / dive arc are runtime `AnimDef.root`, the vanish is runtime `AnimDef.opacity`)

Timeline (user spec 2026-10, 60 FPS, T000–T125 = 2.10 s), locked order:
  vanish → reappear at target → slash 1 (T032) → slash 2 (T048) → slash 3 (T064) → leap (T072) → aerial anticipation
  (T088) → final descending slash → FINAL HIT (T104, critical finisher) → land (T110) → residual (T114) → recovery (T118).
  Damage 15 / 15 / 20 / 50 % · hit-stop 2 / 2 / 3 / 6 frames · shake 2 / 2 / 3 / 9 px · optional push-in 4 % T088–T104.

The VFX sheets' frames overlap in x → blobs go to the nearest hand-placed frame centre of their row (no empty-column cut).

Usage: python3 tools/sprites/moye_ult.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
from scipy.interpolate import PchipInterpolator

sys.path.insert(0, os.path.dirname(__file__))
import bailong as B  # noqa: E402

B.SRC = 'art/incoming/moye'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/moye_ult'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 126
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 400, 240, 3                  # preview canvas (atlas px) · ×3 nearest
GROUND, X0 = 204, 60                    # Mo Ye's feet (pose 1) on the canvas
CELL_PX = 80                            # 1 board cell in atlas px
BODY = 74                               # idle body height (atlas px) = 1 "character height" / tile of the spec
TRAVEL = 120                            # stage 1: rapid move into range (≈ 1.6 tiles) — the engine's blink in game
DEST = X0 + TRAVEL                      # where she reappears (her cell next to the target)
TARGET_X = DEST + CELL_PX               # the target: the next cell
ORIGIN = (X0 + 4, GROUND - 38)          # vanish trail pivot (left-centre on her body at the start)
ENEMY_C = (TARGET_X - 6, GROUND - 40)   # slash arcs: on the enemy body
GROUND_HIT = (TARGET_X - 10, GROUND)    # final impact: ground / target contact point (burst grows up from it)
RESID_C = (TARGET_X - 8, GROUND - 30)   # residual vortex around the target's lower body
ZOOM_C = (TARGET_X - 30, GROUND - 50)   # camera push-in centre (preview only)

# ------------------------------------------------------------------ character (atlas row 7, game scale, nothing baked)
atlas = np.array(Image.open('public/sprites/hero-moye.png').convert('RGBA'))
ROW = atlas[7 * CELL_H:8 * CELL_H]
CHAR = [  # (from T, to T, pose C##) — source frames read left → right, top row then bottom row
    (0, 5, 1), (6, 11, 2), (12, 27, 3), (28, 29, 4), (30, 43, 5), (44, 57, 6), (58, 65, 7), (66, 71, 8),
    (72, 79, 9), (80, 87, 10), (88, 95, 11), (96, 99, 12), (100, 103, 13), (104, 117, 14), (118, 121, 15), (122, 125, 16)]
POSE_NAMES = {
    1: ('READY', 'ท่าพร้อม ดาบใหญ่มือขวา / ดาบเล็กมือซ้าย', 'CAST_START'),
    2: ('CROUCH', 'ย่อตัว ล็อกเป้า', 'TARGET_LOCK T008'),
    3: ('VANISH', 'พุ่งต่ำ ดาบใหญ่ลากหลัง (ตัวโปร่ง)', 'VANISH_START T012 · REAPPEAR T028'),
    4: ('REAPPEAR', 'ตั้งท่าข้างเป้า ง้างดาบใหญ่', 'REAPPEAR T028'),
    5: ('SLASH 1', 'ดาบใหญ่ (ขวา) ฟันยื่นสุดแขน', 'HIT_1 T032'),
    6: ('SLASH 2', 'ดาบเล็ก (ซ้าย) แทงตรง', 'HIT_2 T048'),
    7: ('SLASH 3', 'ย่อฟันต่ำ ดาบใหญ่', 'HIT_3 T064'),
    8: ('LOAD', 'ย่อสุด โหลดกระโดด', ''),
    9: ('LEAP', 'ถีบตัวขึ้น', 'LEAP_START T072'),
    10: ('AIRBORNE', 'ลอย ยกดาบใหญ่', 'AIRBORNE T080'),
    11: ('AERIAL RAISE', 'ง้างดาบใหญ่เหนือหัวสูงสุด', 'FINAL_ANTICIPATION T088'),
    12: ('DESCENT', 'เริ่มดิ่ง ดาบชี้ลง', 'FINAL_DESCENT_START T096'),
    13: ('DIVE', 'ดิ่งลงหาเป้า', ''),
    14: ('CONTACT', 'ปักลงพื้น ดาบใหญ่แตะเป้า', 'FINAL_HIT T104 · LAND T110'),
    15: ('RECOVER', 'ยืดตัว', 'RECOVERY_START T118'),
    16: ('READY', 'กลับท่าพร้อมรบ', 'ANIMATION_END T125'),
}

# runtime root (AnimDef.root): local x between hits (6–18 px), the leap arc, the dive toward the target
LOCAL_X = [[0, 0], [24, 0], [28, 0], [32, 6], [44, 4], [48, 10], [58, 8], [64, 16], [72, 12], [88, 14], [96, 14],
           [100, 18], [104, 24], [110, 22], [118, 12], [125, 0]]
LIFT = [[0, 0], [72, 0], [78, -18], [84, -38], [88, -52], [94, -62], [96, -61], [100, -32], [104, 0], [125, 0]]
OPACITY = [[0, 1], [11, 1], [12, .7], [14, .3], [16, .08], [23, .05], [24, .25], [26, .6], [28, 1], [125, 1]]
BLINK_T = 24                            # TARGET_POSITION_REACHED = the engine's blink (clip `move`)
HITS = [32, 48, 64, 104]
WEIGHTS = [0.15, 0.15, 0.2, 0.5]
HITSTOP_FR = {32: 2, 48: 2, 64: 3, 104: 6}
SHAKE = {32: (2, 0), 33: (-2, 1), 48: (2, -1), 49: (-2, 0), 64: (3, -1), 65: (-3, 1), 66: (2, 0),
         104: (9, -2), 105: (-8, 2), 106: (6, -1), 107: (-4, 1), 108: (3, 0), 109: (-2, 0), 110: (1, 0)}
ZOOM = [[0, 1.0], [88, 1.0], [104, 1.04], [110, 1.04], [122, 1.0], [125, 1.0]]


def lin(keys, t):
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b:
            return va + (vb - va) * (t - a) / (b - a)
    return keys[-1][1]


def smooth(keys, t):
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b:
            k = (t - a) / (b - a)
            return va + (vb - va) * k * k * (3 - 2 * k)
    return keys[-1][1]


_lift = PchipInterpolator([k[0] for k in LIFT], [k[1] for k in LIFT])


def lift(t):
    return float(_lift(t))


def local_x(t):
    return smooth(LOCAL_X, t)


def travel(t):
    """sheet only: stage 1 move (in game the blink at T024 jumps the unit to its new cell)"""
    return smooth([[0, 0], [12, 0], [24, TRAVEL], [125, TRAVEL]], t)


def opacity(t):
    return lin(OPACITY, t)


def zoom(t):
    return smooth(ZOOM, t)


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    for i, (a, b, _) in enumerate(CHAR):
        if a <= t <= b:
            return round(i + (t - a) / (b - a + 1), 3)
    return float(len(CHAR))


def blade_tip(c):
    a = pose(c)[..., 3] >= 128
    ys, xs = np.nonzero(a)
    return float(xs.max()), float(ys[xs == xs.max()].mean())


TIP = {c: blade_tip(c) for c in range(1, 17)}
straw = np.array(Image.open('public/sprites/enemy-straw-recruit.png').convert('RGBA'))[0:100, 0:132][:, ::-1]


# ------------------------------------------------------------------ VFX strips
def load_vfx(name, thr=80):
    """RGB distance from the sheet's own background (a hue key eats the pink) + magenta de-spill (as moye_s1 / s2)"""
    rgb = np.array(Image.open(f'{B.SRC}/{name}.png').convert('RGB')).astype(int)
    bg = np.median(np.concatenate([rgb[:8].reshape(-1, 3), rgb[-8:].reshape(-1, 3)]), 0)
    d = np.sqrt(((rgb - bg) ** 2).sum(-1))
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = np.where(d > thr, 255, 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    spill = (b > g + 30) & (r > g + 30)
    out[..., 2] = np.where(spill, np.minimum(b, np.maximum(g + 20, (r * 0.55).astype(int))), b).astype(np.uint8)
    return out


def cut(name, rows):
    """rows = [(y0, y1, [frame centre x …])] in source px: each blob → nearest centre of its row (centroid x);
    blobs wider than ~1.3 frame spacing are split pixel by pixel. Frames keep the row's common vertical centre."""
    im = load_vfx(name)
    out = []
    for y0, y1, cen in rows:
        band = im[y0:y1].copy()
        a = band[..., 3] > 0
        lab, k = ndimage.label(a, np.ones((3, 3)))
        idx = np.arange(1, k + 1)
        size = ndimage.sum(a, lab, idx)
        cx = np.array(ndimage.center_of_mass(a, lab, idx))[:, 1]
        sl = ndimage.find_objects(lab)
        cen = np.array(cen, float)
        spacing = np.diff(cen).mean() if len(cen) > 1 else 1e9
        owner = np.full(a.shape, -1)
        near = np.argmin(np.abs(np.arange(a.shape[1])[:, None] - cen[None]), 1)
        for i in range(k):
            if size[i] < 3:
                continue
            m = lab[sl[i]] == i + 1
            if sl[i][1].stop - sl[i][1].start > 1.3 * spacing:
                o = np.broadcast_to(near[sl[i][1]][None], m.shape)
                owner[sl[i]][m] = o[m]
            else:
                owner[sl[i]][m] = int(np.argmin(np.abs(cen - cx[i])))
        ys = np.nonzero(a.any(1))[0]
        cy = (ys.min() + ys.max()) / 2
        for j in range(len(cen)):
            own = owner == j
            yy, xx = np.nonzero(own)
            fx0, fx1, fy0, fy1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
            fr = band[fy0:fy1, fx0:fx1].copy()
            fr[..., 3] = np.where(own[fy0:fy1, fx0:fx1], fr[..., 3], 0)
            core = fr[..., 3] > 200
            bright = core & (fr[..., :3].astype(int).sum(-1) > 600)
            pick = bright if bright.sum() > 6 else core
            bx = float(np.nonzero(pick.any(0))[0].mean()) if pick.any() else (fx1 - fx0) / 2
            by = float(np.nonzero(pick.any(1))[0].mean()) if pick.any() else (fy1 - fy0) / 2
            out.append({'img': fr, 'cx': bx, 'cy': cy - fy0, 'by': by})
    return out


MAIN = cut('ult_main', [(43, 337, [150, 337, 560, 775, 1100, 1410, 1860]), (374, 666, [280, 750, 1135, 1560, 1910])])
IMPACT = cut('ult_impact', [(126, 562, [157, 434, 825, 1205, 1520, 1781, 2020])])
RESID = cut('ult_residual', [(33, 339, [270, 775, 1235, 1645, 2000]), (378, 644, [200, 600, 1000, 1360, 1690, 1990])])


def wh(fr):
    a = fr['img'][..., 3] > 0
    ys, xs = np.nonzero(a)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes (atlas px): arcs ≈ 1.0–1.2 body tall · aerial vortex 1.4 body wide · descending crescent 1.5 body tall ·
# final impact 1.8 body wide at its peak (1.5–2 per spec, S2 impact = 1.2 tall) · residual 1.6 body wide
SC = {'trail': 0.75 * BODY / wh(MAIN[1])[1], 'arc': 1.1 * BODY / wh(MAIN[4])[1], 'aura': 1.4 * BODY / wh(MAIN[7])[0],
      'desc': 1.5 * BODY / wh(MAIN[4])[0], 'imp': 1.8 * BODY / wh(IMPACT[2])[0], 'res': 1.6 * BODY / wh(RESID[0])[0]}


def dither(a, alpha):
    if alpha >= 1:
        return a
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
    th = np.tile(bayer, (a.shape[0] // 4 + 1, a.shape[1] // 4 + 1))[:a.shape[0], :a.shape[1]]
    a = a.copy()
    a[..., 3] = np.where(th < alpha, a[..., 3], 0)
    return a


def tile(fr, sx, sy=None, alpha=1.0, flipv=False, rot=0, pivot='core'):
    """→ (rgba, pivot x, pivot y): nearest scale, optional vertical mirror / clockwise quarter turns, hard alpha"""
    sy = sx if sy is None else sy
    img = Image.fromarray(fr['img'])
    w0, h0 = img.size
    img = img.resize((max(1, round(w0 * sx)), max(1, round(h0 * sy))), Image.NEAREST)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    if pivot == 'core':
        px, py = fr['cx'] * sx, fr['by'] * sy
    elif pivot == 'left':
        px, py = 0.0, fr['by'] * sy
    elif pivot == 'bottom':
        px, py = fr['cx'] * sx, a.shape[0] - 1.0
    else:                               # box centre
        px, py = a.shape[1] / 2, a.shape[0] / 2
    if flipv:
        a = a[::-1]
        py = a.shape[0] - 1 - py
    for _ in range(rot % 4):            # clockwise quarter turn: (x, y) → (h-1-y, x)
        h = a.shape[0]
        a = np.rot90(a, -1)
        px, py = h - 1 - py, px
    return dither(a, alpha), px, py


# ------------------------------------------------------------------ track plans: T → (frame, alpha, extra)
def fade_tail(ts, n, steps=(0.7, 0.45, 0.2)):
    ts = sorted(ts)
    return {t: (1.0 if i < len(ts) - n else steps[i - (len(ts) - n)]) for i, t in enumerate(ts)}


# L4 main, sectioned to the attacks
TRAIL = {16: 1, 17: 1, 18: 1, 19: 1, 20: 2, 21: 2, 22: 2, 23: 2, 24: 2, 25: 2, 26: 2, 27: 2}
TRAIL_A = fade_tail(TRAIL, 2, (0.6, 0.3))
ARC1 = {30: 3, 31: 3, 32: 3, 33: 4, 34: 4, 35: 4, 36: 4, 37: 4, 38: 4}
ARC1_A = fade_tail(ARC1, 2, (0.6, 0.3))
ARC2 = {46: 4, 47: 4, 48: 5, 49: 5, 50: 5, 51: 5, 52: 5}
ARC2_A = fade_tail(ARC2, 2, (0.6, 0.3))
ARC3 = {60: 5, 61: 5, 62: 5, 63: 6, 64: 6, 65: 6, 66: 6, 67: 6, 68: 6}
ARC3_A = fade_tail(ARC3, 2, (0.6, 0.3))
AURA = {**{t: 6 for t in range(80, 84)}, **{t: 7 for t in range(84, 90)}, **{t: 8 for t in range(90, 100)}}
AURA_A = {t: (0.5 + 0.5 * min(1, (t - 80) / 8)) if t < 96 else [0.8, 0.6, 0.4, 0.2][t - 96] for t in AURA}
AURA_S = {t: 0.8 + 0.4 * (t - 80) / 19 for t in AURA}           # escalation: the vortex grows toward the dive
DESC = {96: 4, 97: 4, 98: 5, 99: 5, 100: 5, 101: 5, 102: 6, 103: 6, 104: 6, 105: 6, 106: 6}
DESC_A = fade_tail(DESC, 3)
IMP = {104: 1, 105: 2, 106: 3, 107: 3, 108: 3, 109: 4, 110: 4, 111: 5, 112: 5, 113: 6, 114: 6, 115: 7, 116: 7, 117: 7}
IMP_A = fade_tail(IMP, 3)
RES = {}
for i, (a0, n) in enumerate([(114, 3), (117, 3), (120, 3), (123, 3), (126, 3), (129, 3), (132, 3), (135, 3), (138, 2), (140, 2), (142, 2)]):
    for t in range(a0, a0 + n):
        RES[t] = i + 1
RES_A = {t: 1.0 if t < 134 else max(0.15, 1 - (t - 133) * 0.08) for t in RES}
RESID_END = max(RES)

AIR = (DEST + 14, GROUND - 52 - 38)                             # her body at the top of the leap (aura centre)
DESC_C = (TARGET_X - 22, GROUND - 58)                           # descending crescent: from her dive down to the contact


def main_tile(t):
    if t in TRAIL:
        fr = MAIN[TRAIL[t] - 1]
        s = SC['trail']
        reach = min(TRAVEL + 10, travel(t) + 24)
        sx = max(s, reach / fr['img'].shape[1]) if t >= 18 else s
        return ('trail',) + tile(fr, sx, s, TRAIL_A[t], pivot='left'), ORIGIN, TRAIL[t], TRAIL_A[t]
    for key, plan, al, flipv in (('arc1', ARC1, ARC1_A, False), ('arc2', ARC2, ARC2_A, True), ('arc3', ARC3, ARC3_A, False)):
        if t in plan:
            return (key,) + tile(MAIN[plan[t] - 1], SC['arc'], alpha=al[t], flipv=flipv), ENEMY_C, plan[t], al[t]
    if t in DESC:
        return ('descent',) + tile(MAIN[DESC[t] - 1], SC['desc'], alpha=DESC_A[t], rot=1), DESC_C, DESC[t], DESC_A[t]
    if t in AURA:
        s = SC['aura'] * AURA_S[t]
        return ('aura',) + tile(MAIN[AURA[t] - 1], s, alpha=AURA_A[t], pivot='box'), AIR, AURA[t], AURA_A[t]
    return None


def tracks_at(t):
    """[(track, sub key, rgba, px, py, anchor, frame, opacity)]"""
    out = []
    m = main_tile(t)
    if m:
        (key, a, px, py), at, f, op = m
        out.append(('main', key, a, px, py, at, f, op))
    # the descent crescent overlaps the end of the aura (T096–T099): both drawn
    if t in DESC and t in AURA:
        a, px, py = tile(MAIN[AURA[t] - 1], SC['aura'] * AURA_S[t], alpha=AURA_A[t], pivot='box')
        out.insert(0, ('main', 'aura', a, px, py, AIR, AURA[t], AURA_A[t]))
    if t in IMP:
        a, px, py = tile(IMPACT[IMP[t] - 1], SC['imp'], alpha=IMP_A[t], pivot='bottom')
        out.append(('impact', 'impact', a, px, py, GROUND_HIT, IMP[t], IMP_A[t]))
    if t in RES:
        a, px, py = tile(RESID[RES[t] - 1], SC['res'], alpha=RES_A[t], pivot='box')
        out.append(('residual', 'residual', a, px, py, RESID_C, RES[t], RES_A[t]))
    return out


# ------------------------------------------------------------------ preview
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
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    img = Image.fromarray(a)
    img.alpha_composite(Image.fromarray(straw), (TARGET_X - (132 - 66), GROUND - 86))
    return img


LOG = []


def char_pos(t):
    return X0 + travel(t) + local_x(t), GROUND + lift(t)


def frame(t, log=True):
    img = background()
    c = char_at(t)
    cx, cy = char_pos(t)
    trk = tracks_at(t)
    behind = [x for x in trk if x[1] in ('trail', 'aura')]      # trail / aerial vortex behind her, the rest in front
    front = [x for x in trk if x[1] not in ('trail', 'aura')]
    for tr, key, a, px, py, at, f, op in behind:
        img.alpha_composite(Image.fromarray(a), (round(at[0] - px), round(at[1] - py)))
    img.alpha_composite(Image.fromarray(dither(pose(c), opacity(t))), (round(cx) - ROOT[0], round(cy) - ROOT[1]))
    for tr, key, a, px, py, at, f, op in front:
        img.alpha_composite(Image.fromarray(a), (round(at[0] - px), round(at[1] - py)))
    if log:
        for tr, key, a, px, py, at, f, op in trk:
            LOG.append({'T': t, 'track': tr, 'frame': f, 'x': round(at[0] - px), 'y': round(at[1] - py), 'opacity': round(op, 2),
                        'split': 'back' if key in ('trail', 'aura') else 'front', 'part': key})
        LOG.append({'T': t, 'track': 'opacity', 'frame': c, 'x': round(cx), 'y': round(cy), 'opacity': round(opacity(t), 2), 'split': '-'})
        for i, h in enumerate(HITS):
            if h <= t <= h + 1:
                LOG.append({'T': t, 'track': 'damage', 'frame': i + 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t == h else 0.5, 'split': '-'})
            if h <= t < h + HITSTOP_FR[h]:
                LOG.append({'T': t, 'track': 'hitstop', 'frame': i + 1, 'x': 0, 'y': 0, 'opacity': 1.0, 'split': '-'})
        if zoom(t) > 1.0005:
            LOG.append({'T': t, 'track': 'zoom', 'frame': round((zoom(t) - 1) * 100), 'x': 0, 'y': 0,
                        'opacity': round(0.4 + 15 * (zoom(t) - 1), 2), 'split': '-'})
    z = zoom(t)
    if z > 1.0005:                      # optional push-in about the target (preview)
        w2, h2 = W / z, H / z
        x0 = min(max(ZOOM_C[0] - w2 / 2, 0), W - w2)
        y0 = min(max(ZOOM_C[1] - h2 / 2, 0), H - h2)
        img = img.resize((W, H), Image.NEAREST, box=(x0, y0, x0 + w2, y0 + h2))
    if t in SHAKE:
        out = background()
        out.paste(img, SHAKE[t])
        img = out
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tail = [frame(t, False) for t in range(N, RESID_END + 1)]       # residual keeps playing after ANIMATION_END
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/moye_ult_preview_60fps.mp4'], check=True)
for i, f in enumerate(tail):
    f.save(f'{tmp}/f{N + i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=50,scale=800:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=none',
                '-loop', '0', f'{OUT}/moye_ult_preview_50fps.gif'], check=True)
KEYS = [0, 14, 32, 48, 64, 76, 92, 104, 110, 116, 122]
cw, ch = 400, 240
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(t):02d} a{opacity(t):.2f} y{lift(t):.0f}', fill=(255, 255, 255))
sheet.save(f'{OUT}/moye_ult_preview_contact.png')


# ------------------------------------------------------------------ in-game FX strips (30 FPS, timeline order)
def bake(name, ts, fn, ref, base_t):
    tiles = [fn(t) for t in ts]
    l = max(px for _, px, _ in tiles)
    r = max(a.shape[1] - px for a, px, _ in tiles)
    u = max(py for _, _, py in tiles)
    d = max(a.shape[0] - py for a, _, py in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for i, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (i * w + round(l - px) + 1, round(u - py) + 1))
    out.save(f'public/sprites/fx-moye-ult-{name}.png', optimize=True)
    ax, ay, rx = ref
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(2000 / 60, 2),
            'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)],
            'dx': round((ax - rx) * 1.25, 2), 'dy': round(27.25 + (ay - GROUND) * 1.25, 2), 'startT': ts[0],
            'delayMs': round((ts[0] - base_t) * 1000 / 60)}


def part(key):
    def fn(t):
        for tr, k, a, px, py, at, f, op in tracks_at(t):
            if k == key:
                return a, px, py
        raise KeyError((key, t))
    return fn


even = lambda plan: sorted(plan)[::2]
game_fx = {
    # at 'self' on VFX_SPAWN (T016, before the blink): her origin, pivot = left-centre on her body
    'trail': bake('trail', even(TRAIL), part('trail'), (ORIGIN[0], ORIGIN[1], X0), 16),
    # at 'target' on STRIKE_START #1 / #2 / #3 (T030 / T044 / T058): on the enemy body
    'arc1': bake('arc1', even(ARC1), part('arc1'), (ENEMY_C[0], ENEMY_C[1], TARGET_X), 30),
    'arc2': bake('arc2', even(ARC2), part('arc2'), (ENEMY_C[0], ENEMY_C[1], TARGET_X), 44),
    'arc3': bake('arc3', even(ARC3), part('arc3'), (ENEMY_C[0], ENEMY_C[1], TARGET_X), 58),
    # at 'self' (her new cell) on CHARGE_START = AIRBORNE (T080): around her body at the top of the leap
    'aura': bake('aura', even(AURA), part('aura'), (AIR[0], AIR[1], DEST), 80),
    # at 'target' on STRIKE_START #4 = FINAL_DESCENT_START (T096)
    'descent': bake('descent', even(DESC), part('descent'), (DESC_C[0], DESC_C[1], TARGET_X), 96),
    # at 'target' on the final hit (T104): ground contact · residual from T114 (+167 ms), no damage
    'impact': bake('impact', even(IMP), part('impact'), (GROUND_HIT[0], GROUND_HIT[1], TARGET_X), 104),
    'residual': bake('residual', even(RES), part('residual'), (RESID_C[0], RESID_C[1], TARGET_X), 104),
}

# ------------------------------------------------------------------ game clip data
steps = [round((b - a + 1) * 1000 / 60) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / 60) - sum(steps)
game_events = {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(8), 'VANISH_START': step_of(12), 'VFX_SPAWN': step_of(16),
               'REAPPEAR_START': step_of(28), 'STRIKE_START': [step_of(30), step_of(44), step_of(58), step_of(96)],
               'DAMAGE': [step_of(t) for t in HITS], 'IMPACT': [step_of(t) for t in HITS], 'CHARGE_START': step_of(80),
               'FINAL_ANTICIPATION': step_of(88), 'RECOVERY_START': step_of(118)}
sx = lambda t: step_of(t) if t < N - 1 else float(len(CHAR))
game_opacity = [[sx(t), v] for t, v in OPACITY]
# root motion sampled every 2 frames (+ the key frames) so the linear keyframes trace the curves
rk = sorted(set(list(range(0, N, 2)) + [k[0] for k in LOCAL_X + LIFT] + [N - 1]))
game_root = [[sx(t), round(local_x(t) if t >= BLINK_T else 0.0, 1), round(lift(t), 1)] for t in rk]
game_impact = [{'hitStopMs': round(HITSTOP_FR[h] * 1000 / 60), 'shakePx': max(abs(v[0]) for k, v in SHAKE.items() if h <= k <= h + 6),
                'shakeMs': 50 if h < 64 else 60 if h == 64 else 200} for h in HITS]

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = []
for t in range(N):
    c = char_at(t)
    x, y = char_pos(t)
    fx, fy = TIP[c]
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [round(x, 1), round(y, 1)], 'opacity': round(opacity(t), 2),
               'spearTip': [round(x) + fx - ROOT[0], round(y) + fy - ROOT[1]], 'center': [round(x), round(y) - BODY / 2]})
EVENTS = [[0, 'CAST_START', 'C01 · ท่าพร้อม'], [8, 'TARGET_LOCK', 'C02 · ล็อกเป้าเลือดต่ำสุด'],
          [12, 'VANISH_START', 'C03 · 70 %'], [14, 'CHARACTER_FADE_OUT', '30 % > 0–10 %'],
          [16, 'MAIN_VFX_START', 'เงาลากจากจุดเริ่ม'], [24, 'TARGET_POSITION_REACHED', 'blink ของเอนจิน · 25 %'],
          [28, 'REAPPEAR', 'C04 · 100 % ข้างเป้า'], [30, 'STRIKE_1_START', 'arc 1'],
          [32, 'DAMAGE_1', 'HIT 1 · 15 % · ดาบใหญ่'], [44, 'STRIKE_2_START', 'C06'], [48, 'DAMAGE_2', 'HIT 2 · 15 % · ดาบเล็ก'],
          [58, 'STRIKE_3_START', 'C07'], [64, 'DAMAGE_3', 'HIT 3 · 20 % · ดาบใหญ่ต่ำ'], [72, 'LEAP_START', 'C09'],
          [80, 'AIRBORNE', 'C10 · vortex รอบตัว'], [88, 'FINAL_ANTICIPATION', 'C11 · -52 px'],
          [96, 'FINAL_DESCENT_START', 'C12 · เสี้ยวดิ่ง'], [104, 'FINAL_DAMAGE', 'FINAL HIT 50 % CRITICAL'],
          [104, 'IMPACT_VFX_SPAWN', 'จุดสัมผัสพื้น'], [106, 'IMPACT_PEAK', 'impact สูงสุด'], [110, 'LAND_CONTACT', 'C14 ลงพื้น'],
          [114, 'RESIDUAL_FX_START', 'ไม่มีดาเมจ'], [118, 'RECOVERY_START', 'C15'], [125, 'ANIMATION_END', 'C16 · idle']]
meta = {
    'name': 'moye_ult_sync_sheet',
    'readme': ['Timeline Sync Sheet — Ultimate Thousand Petal Execution · Mo Ye', '',
               '60 FPS, 126 เฟรม (T000–T125) = 2.10 วินาที · ตัวละคร 16 ท่า + Main VFX (12 เฟรม, แบ่ง 6 ช่วง) + Impact (7) + Residual (11)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C16 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 400×240, พื้น y = 204) · 80 px = 1 ช่อง · ตัวสูง 74 px',
               'Root X / ความสูงกระโดด / ความทึบ = runtime ทั้งหมด (AnimDef.root / opacity) ไม่อบในแผ่น sprite',
               'ที่มา: tools/sprites/moye_ult.py → moye_ult_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า ult ใน SHEETS hero-moye.png (รวม 2100 ms) · root / opacity = AnimDef.root / opacity',
    'title': 'Timeline Sync Sheet — Ultimate Thousand Petal Execution  ·  Mo Ye · Shadow Orchid Blade',
    'subtitle': '60 FPS · 126 frames (T000–T125) = 2.10 s · 1 column = 1 frame (16.7 ms) · hits T032 / T048 / T064 · FINAL T104 (15 / 15 / 20 / 50 %)',
    'phases': [[0, 11, 'A', 'LOCK / PREPARE', [120, 130, 150], 'ล็อกเป้า'],
               [12, 27, 'B', 'VANISH / APPROACH', [120, 70, 150], 'หายตัว'],
               [28, 43, 'C', 'SLASH 1', [215, 70, 90], 'ฟัน 1'],
               [44, 57, 'D', 'SLASH 2', [190, 45, 100], 'ฟัน 2'],
               [58, 71, 'E', 'SLASH 3', [215, 70, 90], 'ฟัน 3'],
               [72, 87, 'F', 'LEAP', [110, 120, 200], 'กระโดด'],
               [88, 99, 'G', 'FINAL ANTICIPATION', [200, 170, 60], 'ง้างกลางอากาศ'],
               [100, 109, 'H', 'FINAL EXECUTION', [235, 60, 60], 'ประหาร'],
               [110, 117, 'I', 'LAND / IMPACT', [200, 100, 140], 'ลงพื้น'],
               [118, 125, 'J', 'RESIDUAL / RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSE_NAMES.items()},
    'gameSteps': steps,
    'hits': HITS,
    'events': EVENTS,
    'lanes': 10,
    'tracks': [['opacity', 'L2 Character Opacity', [170, 170, 200], 'runtime AnimDef.opacity', 'L2', 'ไม่มีเงาซ้ำอบในแผ่น',
                '100 > 70 T012 > 30 T014 > 0–10 T016–T023 > 25 T024 > 60 T026 > 100 T028'],
               ['main', 'L5 Ultimate Main VFX', [235, 90, 130], 'fx-moye-ult-trail / arc1–3 / aura / descent (ult_main.png 12 fr)',
                'L5 · trail + aura หลังตัว, arc + descent หน้าตัว', 'trail = จุดเริ่ม · arc = กลางตัวเป้า · aura = ตัวโม่เย่กลางอากาศ · descent = เหนือเป้า',
                'trail f1–f2 T016–027 · arc1 f3–f4 T030–038 · arc2 f4–f5 (กลับแนวตั้ง) T046–052 · arc3 f5–f6 T060–068 · aura f6–f8 T080–099 (โตขึ้น) · descent f4–f6 หมุนลง T096–106'],
               ['impact', 'L6 Ultimate Impact VFX', [255, 200, 140], 'fx-moye-ult-impact (ult_impact.png 7 fr)', 'L6 · หน้าสุด',
                'จุดสัมผัสพื้นของเป้า (ฐานภาพ)', 'T104 spawn · T106–T108 peak (กว้าง 1.8 × ตัว) · จางถึง T117'],
               ['residual', 'L7 Residual FX', [200, 120, 220], 'fx-moye-ult-residual (ult_residual.png 11 fr)', 'L7 · หน้าตัว',
                'รอบตัวเป้า', 'T114 vortex > ribbons > กลีบ > หมึก > หาย ~0.5 วิ (ต่อถึง T143 หลังท่าจบ) · ไม่มีดาเมจ'],
               ['damage', 'L8 Damage / Critical', [230, 90, 90], 'engine', '-', '-', 'T032 15 % · T048 15 % · T064 20 % · T104 50 % CRITICAL'],
               ['hitstop', 'L9 Hitstop', [255, 255, 255], 'AnimDef.impact', '-', '-', '2 / 2 / 3 / 6 เฟรม (33 / 33 / 50 / 100 ms)'],
               ['zoom', 'L11 Camera push-in (optional)', [120, 200, 230], 'preview เท่านั้น', '-', '-', '100 > 104 % T088–T104 · กลับ 100 % T122']],
    'trackNames': {'opacity': 'ความทึบตัวละคร', 'main': 'รอยกลีบพันรอย', 'impact': 'ระเบิดประหาร', 'residual': 'กลีบค้าง',
                   'damage': 'ดาเมจ', 'hitstop': 'หยุดเฟรม', 'zoom': 'ซูมกล้อง'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'ความทึบ (L2)'], [3, 'Root X (L3)'], [4, 'ความสูงกระโดด (L4)'], [5, 'Main VFX (L5)'],
               [6, 'Impact (L6)'], [7, 'Residual (L7)'], [8, 'ดาเมจ (L8)'], [9, 'Hitstop (L9)'], [10, 'สั่นกล้อง (L10)'], [11, 'ซูม (L11)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': KEYS,
    'thumbLabels': {0: 'CAST', 14: 'VANISH', 32: 'HIT 1', 48: 'HIT 2', 64: 'HIT 3', 76: 'LEAP', 92: 'FINAL ANTIC.',
                    104: 'FINAL HIT', 110: 'LAND', 116: 'RESIDUAL', 122: 'RECOVERY'},
    'thumbCrop': [36 * UP, 62 * UP, 332 * UP, 222 * UP],
    'travelLabel': 'L3 Root X (px) — เข้าหาเป้า 120 + ขยับ 6–24', 'heightLabel': 'L4 ความสูงกระโดด (px)',
    'notes': [
        'Character กับ VFX แยกชั้น — VFX ไม่แก้ sprite ของโม่เย่ · ไม่มีเงาซ้ำ / afterimage อบในแผ่น · ดาบใหญ่มือขวา ดาบเล็กมือซ้ายทุกเฟรม',
        'หายตัว = ความทึบ runtime + Main VFX (trail) · ย้ายเข้าเป้า = blink ของเอนจินที่ T024 (move ของท่า) · Root X / กระโดด / ดิ่ง = runtime (AnimDef.root) ไม่ย้ายช่อง',
        'กระโดด: 0 T072 > -18 T078 > -38 T084 > -52 T088 > -62 T094 > เริ่มดิ่ง T096 > -32 T100 > 0 T104 (เส้นโค้ง pchip ไม่วาร์ป)',
        'ดาเมจ 4 จังหวะ 15 / 15 / 20 / 50 % (repeat 4 ของ kit) · FINAL HIT T104 = คริติคอล แรงสุดทั้งดาเมจ, hit-stop 100 ms, สั่น 9 px (ขึ้นเร็วลดเร็ว) · ไม่สั่นช่วง residual',
        'Impact ยึดจุดสัมผัสพื้นของเป้า กว้าง 1.8 × ตัว (มากกว่า S1 / S2 แต่ไม่ใช่ระเบิดทั้งสนาม) · Residual ไม่มีดาเมจ เล่นต่อหลังท่าจบถึง ~T143',
        'ซูม 4 % T088–T104 = ตัวเลือก (preview นี้แสดง · ในเกมยังไม่ทำ)',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[t, round(travel(t) + local_x(t), 1)] for t in (0, 12, 24, 32, 48, 64, 72, 88, 104, 118, 125)],
                          'height': [[t, round(-lift(t), 1)] for t in (0, 72, 78, 84, 88, 94, 100, 104, 125)]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx,
           'game': {'steps': steps, 'events': game_events, 'move': step_of(BLINK_T), 'opacity': game_opacity, 'root': game_root,
                    'impact': game_impact, 'weights': WEIGHTS}},
          open(f'{OUT}/moye_ult_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'gameFx': game_fx, 'steps': steps, 'events': game_events, 'move': step_of(BLINK_T),
                  'impact': game_impact}, indent=1, default=float))

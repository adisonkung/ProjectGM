"""Lin Xue — Ultimate Returning Spring Rite: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/linxue, not committed):
  ult_charge_raw.png  approved Charge VFX, 12 painted frames in a captioned 6 × 2 grid on #FF00FF (ripple → gather →
                      lotus form → energy rise → ritual build → peak focus → overflow → stabilize → hold → release →
                      echo → end) — wide and low, around Lin Xue's feet
  ult_main_raw.png    approved Main VFX, 12 frames, same grid (field start → spring emerge → lotus bloom → ritual flow →
                      team blessing → heal wave → cleanse sweep → revival light → peak aura → sustain → residual → fade)
                      — the ritual field over the allied formation; it carries the team heal / cleanse / revival look
                      (no impact VFX, no per-ally heal pulse)
  public/sprites/hero-linxue.png row 7 (character, 21 frames from ult_char_raw.png via tools/sprites/linxue.py)

Production timeline (user spec 2026-10, 60 FPS, 144 frames T000–T143 = 2.40 s):
  A invocation T000–T017 (eyes close T008, staff raise T016) · B charge build T018–T047 (charge VFX T018, build T030,
  high T044) · C charge peak / hold T048–T059 (peak T052) · D release T060–T069 (anticipation T060, release T064, charge
  drains T066–T073) · E spring field T070–T087 (Main VFX on the formation T070, spring T078, lotus / flow T086) ·
  F team heal T088–T099 (HEAL ALL T092, peak T096) · G team cleanse T100–T109 (sweep T100, CLEANSE ALL T104) ·
  H revival T110–T123 (check T110, revival light on the chosen dead ally T114, silhouette T116, REVIVE T118, residual
  T120) · I blessing settle T124–T133 · J recovery T134–T143 (field fades T134). Root <= 4 px · no shake.

In game: kit Ult = repeat 3 on the clip's DAMAGE events — HEAL ALL_ALLIES (T092) · CLEANSE ALL_ALLIES (T104) · REVIVE
(T114: the ally is picked = REVIVE_TARGET slot, revival cue FX at its body, revived `delay` 4 frames later = T118) ·
`lx-ult-charge` (self, CHARGE_START, under) · `lx-ult-main` (on vfx, `at: 'allies'` = centre of the living allied
formation) · `lx-ult-revive` (impact hit 2 at the picked dead ally — a localized instance of the Main VFX revival light).

Usage: python3 tools/sprites/linxue_ult.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

SRC = 'art/incoming/linxue'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/linxue_ult'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 144
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 520, 300, 2
GROUND = 268
CELL_PX = 80
BODY = 80
X0 = 80                                  # Lin Xue (back line)
TEAM = [('hero-tangxun.png', 260, (130, 155), 160), ('hero-yuezheng.png', 260, (130, 155), 235),
        ('hero-bailong.png', 220, (110, 155), 305), ('hero-moye.png', 260, (130, 155), 380)]
DEAD = 3                                  # Mo Ye is down when the rite starts → the revival target in the preview
FIELD_X = round((X0 + sum(t[3] for t in TEAM)) / 5)   # centre of the allied formation

# ------------------------------------------------------------------ character (atlas row 7, game scale)
atlas = np.array(Image.open('public/sprites/hero-linxue.png').convert('RGBA'))
ROW = atlas[7 * CELL_H:8 * CELL_H]
CHAR = [(0, 7, 1), (8, 15, 2), (16, 21, 3), (22, 29, 4), (30, 35, 5), (36, 43, 6), (44, 47, 7), (48, 53, 8), (54, 59, 9),
        (60, 63, 10), (64, 87, 11), (88, 109, 12), (110, 133, 13), (134, 135, 14), (136, 136, 15), (137, 137, 16),
        (138, 139, 17), (140, 140, 18), (141, 141, 19), (142, 142, 20), (143, 143, 21)]
POSES = {1: ('READY', 'ยืนพร้อม', 'CAST_START'), 2: ('CLOSE EYES', 'หลับตา สวดภาวนา', 'EYES_CLOSE / PRAYER T008'),
         3: ('RAISE STAFF', 'ยกไม้เท้าบัว', 'STAFF_RAISE T016 · CHARGE_VFX_START T018'), 4: ('INVOKE', 'อัญเชิญชี่วสันต์', ''),
         5: ('CHANNEL 1', 'รวมพลัง', 'CHARGE_BUILD T030'), 6: ('CHANNEL 2', 'ชูไม้เท้าสูง', ''),
         7: ('CHANNEL 3', 'รวมพลังสูง', 'CHARGE_HIGH T044'), 8: ('CHANNEL 4', 'ไม้เท้าสูงสุด', 'CHARGE_PEAK T052'),
         9: ('CHANNEL 5', 'ค้างพลัง', 'HOLD'), 10: ('RELEASE', 'ชี้ไม้เท้าออก', 'RELEASE_ANTICIPATION T060'),
         11: ('FOLLOW THROUGH 1', 'ส่งพลังเปิดลานพิธี', 'ULTIMATE_RELEASE T064 · MAIN_VFX T070'),
         12: ('FOLLOW THROUGH 2', 'ค้างระหว่างฮีล / ชำระล้างทั้งทีม', 'TEAM HEAL T092 · TEAM CLEANSE T104'),
         13: ('FOLLOW THROUGH 3', 'ค้างระหว่างคืนชีพ / พร', 'REVIVE T118 · BLESSING T124'),
         14: ('RECOVER 1', 'ดึงไม้เท้ากลับ', 'RECOVERY_START T134'), 15: ('RECOVER 2', '', ''), 16: ('RECOVER 3', '', ''),
         17: ('RECOVER 3b', '', ''), 18: ('RECOVER 4', '', ''), 19: ('RECOVER 5', '', ''), 20: ('RETURN', 'กลับท่ายืน', ''),
         21: ('IDLE END', 'พร้อม', 'ANIMATION_END T143')}
T = dict(EYES=8, RAISE=16, CHARGE=18, BUILD=30, HIGH=44, PEAK=52, ANTIC=60, RELEASE=64, FIELD=70, SPRING=78, FLOW=86,
         HEAL_PREP=88, HEAL=92, HEAL_PEAK=96, SWEEP=100, CLEANSE=104, CHECK=110, REV_LIGHT=114, SIL=116, REVIVE=118,
         REV_RES=120, BLESS=124, FADE=134, REC=134)
ROOT_KEYS = [[0, 0], [60, 0], [64, 2], [133, 2], [143, 0]]   # a slight lean into the release (<= 4 px)


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


def idle(sheet, w):
    return np.array(Image.open(f'public/sprites/{sheet}').convert('RGBA'))[0:CELL_H, 0:w]


ALLIES = [(idle(s, w), root, x) for s, w, root, x in TEAM]


# ------------------------------------------------------------------ VFX (painted, soft alpha unmixed from magenta)
def unmix(name):
    rgb = np.array(Image.open(f'{SRC}/{name}.png').convert('RGB')).astype(float)
    bg = np.median(rgb[100:110, 5:20].reshape(-1, 3), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = np.clip(1 - (np.minimum(r, b) - g) / (min(bg[0], bg[2]) - bg[1]), 0, 1)
    al = np.where(al < 0.06, 0, al)
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = col
    out[..., 3] = (al * 255).astype(np.uint8)
    return out


UPPX, DOWNPX, HALF = 300, 30, 172               # common box around the pivot (source px)
SHEETS_CFG = {
    # name: rows (y0, y1, ring centre y, x dividers)
    'ult_charge_raw': [(64, 383, 339, [0, 327, 658, 991, 1319, 1647, 1983]), (423, 733, 684, [0, 327, 658, 991, 1319, 1647, 1983])],
    'ult_main_raw': [(64, 381, 335, [0, 314, 635, 957, 1295, 1632, 1983]), (419, 729, 683, [0, 343, 682, 1021, 1362, 1689, 1983])],
}


def cut(name):
    im = unmix(name)
    out = []
    for y0, y1, ry, xs in SHEETS_CFG[name]:
        for i in range(6):
            x0, x1 = xs[i] + 5, xs[i + 1] - 5
            cx = (xs[i] + xs[i + 1]) / 2
            panel = np.zeros_like(im)
            panel[y0 + 4:y1 - 4, x0:x1] = im[y0 + 4:y1 - 4, x0:x1]
            box = np.zeros((UPPX + DOWNPX, 2 * HALF, 4), np.uint8)
            bx0, by0 = int(round(cx - HALF)), ry - UPPX
            sx0, sy0 = max(0, bx0), max(0, by0)
            sx1, sy1 = min(im.shape[1], bx0 + 2 * HALF), min(im.shape[0], by0 + UPPX + DOWNPX)
            box[sy0 - by0:sy1 - by0, sx0 - bx0:sx1 - bx0] = panel[sy0:sy1, sx0:sx1]
            # soften the hard panel edges (wide rings run into the cell border)
            yy, xx = np.mgrid[0:box.shape[0], 0:box.shape[1]]
            ex = np.minimum(xx - (sx0 - bx0) - (x0 - sx0), (x1 - bx0) - xx)
            box[..., 3] = (box[..., 3] * np.clip(ex / 10, 0, 1)).astype(np.uint8)
            out.append(box)
    return out


CHARGE = cut('ult_charge_raw')
MAIN = cut('ult_main_raw')


def size(a, thr=60):
    m = a[..., 3] > thr
    xs, ys = np.nonzero(m.any(0))[0], np.nonzero(m.any(1))[0]
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


# sizes: charge = wide and low around her — peak focus (f6) ~1.5 character heights wide, ~1.35 tall · main = the ritual
# field over the formation, peak aura (f9) ~3.6 cells wide (covers the 5 heroes) · revival = the Main VFX revival light
# (f8 / f9) localized on one ally, ~1.1 body wide
SC = {'charge': 1.5 * BODY / size(CHARGE[5])[0], 'main': 3.6 * CELL_PX / size(MAIN[8])[0]}
SC['revive'] = 1.1 * BODY / size(MAIN[7])[0]


def scaled(src, k, s, alpha=1.0):
    img = Image.fromarray(src[k])
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    a = np.array(img).astype(float)
    a[..., 3] *= alpha
    return a


def mix(src, s, k0, k1, w, alpha):
    a, b = scaled(src, k0, s), scaled(src, k1, s)
    pa, pb = a[..., :3] * a[..., 3:] / 255, b[..., :3] * b[..., 3:] / 255
    al = a[..., 3] * (1 - w) + b[..., 3] * w
    col = (pa * (1 - w) + pb * w) / np.maximum(al[..., None] / 255, 1e-3)
    out = np.zeros_like(a)
    out[..., :3] = np.clip(col, 0, 255)
    out[..., 3] = np.clip(al * alpha, 0, 255)
    return out.astype(np.uint8)


def plan(keys, alpha_fn):
    """keys [(t0, frame index)] (last = (end, None)) → T: (frame, next frame, blend, alpha) — every hold ends with a
    2-frame cross-fade into the next painted frame"""
    out = {}
    for (t0, f), (t1, nf) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            w = 0.0
            if nf is not None and t1 - t0 >= 3 and t1 - t <= 2:
                w = 0.33 if t1 - t == 2 else 0.66
            out[t] = (f, nf if w else f, w, alpha_fn(t))
    return out


def charge_alpha(t):
    if t < 22:
        return 0.4 + 0.6 * (t - 18) / 4
    if t >= 64:                          # release: the charge drains fast while the field takes over (4 frames overlap)
        return max(0.0, 1 - (t - 63) * 0.11)
    return 1.0


CHARGE_PLAN = plan([(18, 0), (22, 1), (26, 2), (30, 3), (36, 4), (44, 5), (48, 6), (54, 7), (58, 8), (62, 9), (66, 10),
                    (70, 11), (74, None)], charge_alpha)


def main_alpha(t):
    if t < 74:
        return 0.35 + 0.65 * (t - 70) / 4
    if t >= 138:
        return max(0.15, 1 - (t - 137) * 0.14)
    return 1.0


MAIN_PLAN = plan([(70, 0), (78, 1), (84, 2), (88, 3), (92, 4), (96, 5), (100, 6), (110, 7), (118, 8), (124, 9),
                  (134, 10), (140, 11), (144, None)], main_alpha)
# revival cue on the chosen dead ally: Main f8 (revival light) rising T114 → f9 (peak) on the revive T118 → fade by T125
REV_PLAN = {t: (7, 7, 0.0, a) for t, a in zip(range(114, 118), [0.45, 0.7, 0.9, 1.0])}
REV_PLAN.update({t: (8, 8, 0.0, a) for t, a in zip(range(118, 126), [1, 1, 0.9, 0.75, 0.6, 0.45, 0.3, 0.15])})
REVIVE_ALPHA = 0.9


def tile(src, s, p, t):
    f, nf, w, a = p[t]
    return mix(src, s, f, nf, w, a) if w else scaled(src, f, s, a).astype(np.uint8)


def intensity(t):
    keys = [[18, 0.15], [30, 0.45], [44, 0.8], [52, 1.0], [60, 1.0], [64, 0.8], [70, 0.2], [74, 0.0]]
    if t < 18 or t > 74:
        return 0.0
    return smooth(keys, t)


def zoom_at(t):                           # optional camera push (preview only)
    if 48 <= t <= 64:
        return 1 + 0.025 * smooth([[48, 0], [64, 1]], t)
    if 64 < t <= 84:
        return 1 + 0.025 * smooth([[70, 1], [84, 0]], t) if t >= 70 else 1.025
    if 90 <= t <= 96:
        return 1 + 0.008 * np.sin(np.pi * (t - 90) / 6)
    return 1.0


def cam_dy(t):                            # revival emphasis: 2 px vertical
    return {118: 2, 119: 1, 120: -1}.get(t, 0)


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
    for k in range(-1, 7):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    return Image.fromarray(a)


def put(img, a, at, px, py):
    x, y = round(at[0] - px), round(at[1] - py)
    img.alpha_composite(Image.fromarray(a), (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return x, y


LOG = []


def ev(t, track, frame, op=1.0):
    LOG.append({'T': t, 'track': track, 'frame': frame, 'x': 0, 'y': 0, 'opacity': round(float(op), 2), 'split': '-'})


def frame(t):
    img = background()
    # charge (under her) + main field (under the team: the ring sits on the ground) first, then characters, then the
    # field's upper half is redrawn semi-transparent over them so the formation stands INSIDE the ritual
    layers = []
    if t in CHARGE_PLAN:
        layers.append(('charge', tile(CHARGE, SC['charge'], CHARGE_PLAN, t), (X0 + 4, GROUND), HALF * SC['charge'],
                       UPPX * SC['charge'], CHARGE_PLAN[t]))
    if t in MAIN_PLAN:
        layers.append(('main', tile(MAIN, SC['main'], MAIN_PLAN, t), (FIELD_X, GROUND), HALF * SC['main'],
                       UPPX * SC['main'], MAIN_PLAN[t]))
    for key, a, at, px, py, p in layers:
        x, y = put(img, a, at, px, py)
        LOG.append({'T': t, 'track': key, 'frame': p[0] + 1, 'x': x, 'y': y, 'opacity': round(p[3], 2), 'split': 'back', 'part': key})
    for i, (spr, root, x) in enumerate(ALLIES):
        if i == DEAD and t < T['SIL']:
            continue
        s = spr
        if i == DEAD and t < T['REVIVE']:  # silhouette forming T116–T117: pale light figure
            s = spr.copy()
            s[..., :3] = (s[..., :3] * 0.3 + np.array([235, 245, 255]) * 0.7).astype(np.uint8)
            s[..., 3] = (s[..., 3] * (0.35 if t == T['SIL'] else 0.65)).astype(np.uint8)
        img.alpha_composite(Image.fromarray(s), (x - root[0], GROUND - root[1]))
    c = char_at(t)
    img.alpha_composite(Image.fromarray(pose(c)), (round(X0 + root_x(t)) - ROOT[0], GROUND - ROOT[1]))
    for key, a, at, px, py, p in layers:   # front pass: the field's light over the bodies (40 %)
        if key == 'main':
            front = a.copy()
            front[..., 3] = (front[..., 3] * 0.4).astype(np.uint8)
            put(img, front, at, px, py)
    if t in REV_PLAN:
        dx = TEAM[DEAD][3]
        a = tile(MAIN, SC['revive'], REV_PLAN, t)
        x, y = put(img, a, (dx, GROUND), HALF * SC['revive'], UPPX * SC['revive'])
        LOG.append({'T': t, 'track': 'revcue', 'frame': REV_PLAN[t][0] + 1, 'x': x, 'y': y, 'opacity': round(REV_PLAN[t][3], 2),
                    'split': 'front', 'part': 'revcue'})
    # logical tracks
    ev(t, 'intensity', 1, intensity(t)) if intensity(t) > 0 else None
    if T['HEAL'] <= t <= T['HEAL'] + 1:
        ev(t, 'heal', 1, 1.0 if t == T['HEAL'] else 0.5)
    if T['SWEEP'] <= t <= T['CLEANSE'] + 1:
        ev(t, 'cleanse', 1, 1.0 if t == T['CLEANSE'] else 0.4)
    if T['CHECK'] <= t <= T['CHECK'] + 1:
        ev(t, 'deadcheck', 1, 1.0 if t == T['CHECK'] else 0.5)
    if T['CHECK'] <= t <= T['REVIVE']:
        ev(t, 'revtarget', 1, 1.0 if t >= T['REV_LIGHT'] else 0.5)
    if T['REVIVE'] <= t <= T['REVIVE'] + 1:
        ev(t, 'revive', 1, 1.0 if t == T['REVIVE'] else 0.5)
    if t >= T['SIL']:
        ev(t, 'visible', 1 if t < T['REVIVE'] else 2, 0.5 if t < T['REVIVE'] else 1.0)
    z = zoom_at(t)
    if z > 1.0005:
        ev(t, 'camera', 1, min(1.0, (z - 1) / 0.025))
    if t >= T['REC']:
        ev(t, 'recovery', 1, 0.6)
    if z > 1.0005:
        cw, ch = W / z, H / z
        cx, cy = FIELD_X, GROUND - 70
        x0 = min(max(0, cx - cw / 2), W - cw)
        y0 = min(max(0, cy - ch / 2), H - ch)
        img = img.crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((W, H), Image.BILINEAR)
    if cam_dy(t):
        out = background()
        out.paste(img, (0, cam_dy(t)))
        img = out
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/linxue_ult_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=780:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/linxue_ult_preview_30fps.gif'], check=True)
CK = [0, 16, 30, 44, 52, 60, 64, 70, 78, 86, 92, 96, 100, 104, 114, 116, 118, 124, 134, 143]
cw, ch = 520, 300
sheet = Image.new('RGB', (cw * 4, ch * 5))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(CK):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/linxue_ult_preview_contact.png')


# ------------------------------------------------------------------ in-game strips (60 FPS)
def bake(name, tiles, px, py, frame_ms=1000 / 60):
    h, w = tiles[0].shape[:2]
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for k, a in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (k * w, 0))
    out.save(f'public/sprites/fx-linxue-ult-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round(px / w, 4), round(py / h, 4)]}


def trim(tiles, px, py):
    """crop the common empty margin of a strip (the boxes are generous) → (tiles, px, py)"""
    m = np.zeros(tiles[0].shape[:2], bool)
    for a in tiles:
        m |= a[..., 3] > 2
    ys, xs = np.nonzero(m.any(1))[0], np.nonzero(m.any(0))[0]
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    return [a[y0:y1, x0:x1] for a in tiles], px - x0, py - y0


ch_t, ch_px, ch_py = trim([tile(CHARGE, SC['charge'], CHARGE_PLAN, t) for t in sorted(CHARGE_PLAN)], HALF * SC['charge'], UPPX * SC['charge'])
mn_t, mn_px, mn_py = trim([tile(MAIN, SC['main'], MAIN_PLAN, t) for t in sorted(MAIN_PLAN)], HALF * SC['main'], UPPX * SC['main'])
rv_t, rv_px, rv_py = trim([tile(MAIN, SC['revive'], REV_PLAN, t) for t in sorted(REV_PLAN)], HALF * SC['revive'], UPPX * SC['revive'])
game_fx = {
    'charge': {**bake('charge', ch_t, ch_px, ch_py), 'dy': 27.25, 'dx': 5.0},
    # the field is huge: bake it at half resolution (painted, soft — no visible loss) and scale it back up in game
    'main': {**bake('main', [np.array(Image.fromarray(a).resize((a.shape[1] // 2, a.shape[0] // 2), Image.LANCZOS)) for a in mn_t],
                    mn_px / 2, mn_py / 2), 'dy': 27.25, 'scale2x': True},
    'revive': {**bake('revive', rv_t, rv_px, rv_py), 'dy': 27.25},
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
sx = lambda t: step_of(t) if t < N - 1 else float(len(CHAR))
game = {'steps': steps,
        'events': {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(T['EYES']), 'CHARGE_START': step_of(T['CHARGE']),
                   'CHARGE_PEAK': step_of(T['PEAK']), 'FINAL_ANTICIPATION': step_of(T['ANTIC']), 'SKILL_ACTIVATE': step_of(T['RELEASE']),
                   'VFX_SPAWN': step_of(T['FIELD']), 'DAMAGE': [step_of(T['HEAL']), step_of(T['CLEANSE']), step_of(T['REV_LIGHT'])],
                   'RECOVERY_START': step_of(T['REC'])},
        'reviveDelay': round((T['REVIVE'] - T['REV_LIGHT']) / FPS, 4),
        'root': [[sx(t), round(root_x(t), 1), 0] for t in sorted({k[0] for k in ROOT_KEYS} | set(range(0, N, 12)) | {N - 1})]}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [round(X0 + root_x(t), 1), GROUND],
       'spearTip': [X0 + 30, GROUND - 90], 'center': [X0, GROUND - BODY / 2]} for t in range(N)]
meta = {
    'name': 'linxue_ult_sync_sheet',
    'readme': ['Timeline Sync Sheet — Ultimate Returning Spring Rite · Lin Xue (production)', '',
               '60 FPS, 144 เฟรม (T000–T143) = 2.40 วินาที · ตัวละคร 21 ท่า + Charge VFX 12 + Main VFX 12 เฟรม · ไม่มี Impact VFX / ไม่มีฮีลแยกต่อคน',
               'Frames = ทุกเฟรม · Character = ท่า C01–C21 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 520×300, พื้น y = 268) · 80 px = 1 ช่อง · ทีม 5 คน, โม่เย่ล้มอยู่ = เป้าคืนชีพในพรีวิว',
               'ที่มา: tools/sprites/linxue_ult.py > linxue_ult_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า ult ใน SHEETS hero-linxue.png (รวม 2400 ms) · ฮีลทั้งทีม T092 / ชำระทั้งทีม T104 / เลือกเป้าคืนชีพ T114 > คืนชีพ T118',
    'title': 'Timeline Sync Sheet — Ultimate Returning Spring Rite  ·  Lin Xue · Lotus Spirit Physician',
    'subtitle': '60 FPS · 144 frames (T000–T143) = 2.40 s · 1 column = 1 frame (16.7 ms) · team heal T092 · team cleanse T104 · revive T118 · no impact VFX',
    'phases': [[0, 17, 'A', 'INVOCATION', [120, 130, 150], 'อัญเชิญ'],
               [18, 47, 'B', 'CHARGE BUILD', [150, 120, 200], 'สะสมพลัง'],
               [48, 59, 'C', 'PEAK / HOLD', [190, 120, 210], 'พลังสูงสุด'],
               [60, 69, 'D', 'RELEASE', [230, 150, 190], 'ปล่อย'],
               [70, 87, 'E', 'SPRING FIELD', [110, 170, 210], 'ลานวสันต์'],
               [88, 99, 'F', 'TEAM HEAL', [120, 210, 150], 'ฮีลทั้งทีม'],
               [100, 109, 'G', 'TEAM CLEANSE', [170, 140, 230], 'ชำระทั้งทีม'],
               [110, 123, 'H', 'REVIVAL', [240, 210, 130], 'คืนชีพ'],
               [124, 133, 'I', 'BLESSING', [200, 170, 220], 'พรตกผลึก'],
               [134, 143, 'J', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}' if v[1] else v[0], v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [T['HEAL'], T['CLEANSE'], T['REVIVE']],
    'events': [[0, 'CAST_START', 'C01'], [8, 'EYES_CLOSE / PRAYER', 'C02'], [16, 'STAFF_RAISE', 'C03'],
               [18, 'CHARGE_VFX_START', 'ใต้เท้าหลินเสวี่ย'], [30, 'CHARGE_BUILD', 'C05'], [44, 'CHARGE_HIGH', 'C07'],
               [52, 'CHARGE_PEAK', 'C08'], [60, 'RELEASE_ANTICIPATION', 'C10'], [64, 'ULTIMATE_RELEASE', 'C11'],
               [70, 'MAIN_VFX_SPAWN_TEAM_FIELD', 'กลางทีม'], [78, 'SPRING_EMERGE', 'f2'], [86, 'LOTUS / RITUAL_FLOW', 'f3–f4'],
               [88, 'TEAM_HEAL_PREP', ''], [92, 'TEAM_HEAL_APPLY', '150 % + 15 % ทุกคน'], [96, 'HEAL_VISUAL_PEAK', 'f6'],
               [100, 'CLEANSE_SWEEP_START', 'f7'], [104, 'TEAM_CLEANSE_APPLY', 'ดีบัฟทั้งทีม'], [110, 'REVIVAL_CHECK', 'มีคนล้มไหม'],
               [114, 'REVIVAL_LIGHT_START', 'เลือกเป้า + แสงที่ร่าง'], [116, 'SILHOUETTE', ''], [118, 'REVIVE_APPLY', '40 % HP'],
               [120, 'REVIVAL_RESIDUAL', ''], [124, 'BLESSING_SETTLE', 'f10'], [134, 'MAIN_VFX_FADE / RECOVERY_START', 'C14'],
               [143, 'ANIMATION_END', 'C21']],
    'lanes': 9,
    'tracks': [['charge', 'L2 Ultimate Charge VFX', [190, 150, 240], 'fx-linxue-ult-charge (Charge VFX 12 fr)', 'L2 · ใต้ตัว',
                'เท้าหลินเสวี่ย', 'T018 ระลอก > T026 บัว > T044 สูง > T052 peak > T062 ปล่อย > ลดเร็ว T064–T073 (ทับ Main 4 เฟรม)'],
               ['intensity', 'L3 Charge Intensity', [230, 170, 240], 'ความแรงชาร์จ (ความทึบของแถบ)', '-', '-', '15 % > 45 % T030 > 80 % T044 > 100 % T052–T060 > 0 T074'],
               ['main', 'L4 Ultimate Main VFX', [150, 200, 255], 'fx-linxue-ult-main (Main VFX 12 fr)', 'L4 · พื้นใต้ทีม + แสงทับ 40 %',
                'กลางรูปขบวนทีม', 'T070 ลานเกิด > T078 น้ำพุ > T086 บัว > T092 พร > T096 คลื่นฮีล > T100 ชำระ > T110 แสงคืนชีพ > T118 ออร่า > T124 คงตัว > T134 จาง'],
               ['heal', 'L5 Team Heal Event', [120, 230, 160], 'engine HEAL ALL_ALLIES', '-', '-', 'T092 ทุกคนพร้อมกัน (ไม่มีเอฟเฟกต์ฮีลแยกต่อคน)'],
               ['cleanse', 'L6 Team Cleanse Event', [190, 150, 255], 'engine CLEANSE ALL_ALLIES', '-', '-', 'คลื่นชำระ T100 > ลบดีบัฟทั้งทีม T104'],
               ['deadcheck', 'L7 Dead Ally Check', [220, 220, 160], 'engine deadAllies()', '-', '-', 'T110 ไม่มีคนล้ม = ข้ามแทร็กคืนชีพ'],
               ['revtarget', 'L8 Revival Target', [240, 200, 120], 'REVIVE_TARGET slot (runtime rule)', '-', 'ตัวที่ถูกเลือก',
                'เลือก 1 คน (ตอนนี้ = ศพที่ยังเห็นก่อน ตามลำดับเอนจิน)'],
               ['revcue', 'L9 Revival Visual Cue', [255, 230, 160], 'fx-linxue-ult-revive (Main f8 > f9 ย่อส่วน)', 'L9 · หน้า',
                'เท้าเพื่อนที่ล้ม', 'T114 แสงคืนชีพ > T118 peak > จาง T125'],
               ['revive', 'L10 Revive Event', [255, 200, 120], 'engine REVIVE (delay 4 fr)', '-', '-', 'T118 คืนชีพ 40 % HP'],
               ['visible', 'L11 Character Visibility', [200, 230, 255], 'ร่างเพื่อนที่ล้ม', '-', '-', 'T116 เงาแสง > T118 กลับมาเต็มตัว'],
               ['camera', 'L12 Optional Camera Push', [200, 200, 200], 'preview เท่านั้น', '-', '-', 'ซูมช้า 2.5 % T048–T064 > ค้าง T070 > คืน T084 · ชีพจรเบา T092 · 2 px T118'],
               ['recovery', 'L13 Recovery', [90, 170, 120], 'ท่า C14–C21', '-', '-', 'T134 > T143']],
    'trackNames': {'charge': 'Charge VFX', 'intensity': 'ความแรงชาร์จ', 'main': 'Main VFX', 'heal': 'ฮีลทั้งทีม', 'cleanse': 'ชำระทั้งทีม',
                   'deadcheck': 'เช็กคนล้ม', 'revtarget': 'เป้าคืนชีพ', 'revcue': 'แสงคืนชีพ', 'revive': 'คืนชีพ',
                   'visible': 'ร่างเพื่อน', 'camera': 'กล้อง', 'recovery': 'กลับท่า'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Charge (L2)'], [3, 'ความแรง (L3)'], [4, 'Main (L4)'], [5, 'ฮีลทีม (L5)'], [6, 'ชำระทีม (L6)'],
               [7, 'เช็กคนล้ม (L7)'], [8, 'เป้าคืนชีพ (L8)'], [9, 'แสงคืนชีพ (L9)'], [10, 'คืนชีพ (L10)'], [11, 'ร่างเพื่อน (L11)'],
               [12, 'กล้อง (L12)'], [13, 'กลับท่า (L13)']],
    'shake': {str(k): [0, v] for k, v in {118: 2, 119: 1, 120: -1}.items()},
    'thumbs': [0, 30, 52, 64, 78, 92, 104, 114, 118, 134],
    'thumbLabels': {0: 'READY', 30: 'CHARGE', 52: 'PEAK', 64: 'RELEASE', 78: 'FIELD', 92: 'TEAM HEAL', 104: 'CLEANSE',
                    114: 'REVIVAL LIGHT', 118: 'REVIVE', 134: 'RECOVERY'},
    'thumbCrop': [10 * UP, 20 * UP, 510 * UP, 290 * UP],
    'travelLabel': 'L1 Root X (px) — ไม่เกิน 4 px (ใช้ 2) ยืนที่เดิม', 'heightLabel': 'Y movement (px)',
    'notes': [
        'หลินเสวี่ยยืนที่เดิม (root ไม่เกิน 4 px) ไม่กระโดด ไม่พุ่ง · Charge VFX อยู่รอบเท้าเธอเท่านั้น กว้าง ~1.5 ตัว สูง ~1.3 ตัว (ไม่เป็นเสาแสงแคบสูง)',
        'Charge > Main: เริ่มปล่อย T060 · ท่าปล่อย T064 · Charge ลดเร็ว T064–T073 · Main เกิดกลางทีม T070 ทับกัน 4 เฟรม (ไม่สว่างสุดพร้อมกัน)',
        'Main VFX = ลานพิธีบนรูปขบวนทีม (กว้าง ~3.6 ช่อง) ทำหน้าที่ฮีลทั้งทีม / ชำระทั้งทีม / คืนชีพ / ลานพิธี · ไม่มี Impact VFX · ไม่มีเอฟเฟกต์ฮีลใหญ่แยก 5 ตัว',
        'ฮีลทั้งทีม T092 (ทุกคนในจังหวะเดียว) · ชำระทั้งทีม T104 (คลื่นชำระเริ่ม T100) · เช็กคนล้ม T110 > ถ้าไม่มี ข้ามแทร็กคืนชีพ',
        'คืนชีพ: เลือก 1 คน T114 (REVIVE_TARGET = กฎของ runtime ไม่อบในภาพ) > แสงคืนชีพเฉพาะที่ร่างนั้น (ย่อส่วนจาก Main f8/f9) > เงาแสง T116 > คืนชีพ T118 > จาง T125',
        'ในเกม: repeat 3 ตาม DAMAGE ของท่า (HEAL ALL / CLEANSE ALL / REVIVE delay 4 เฟรม) · ศพในเกมยังเห็นตามกฎ runtime เดิม (พรีวิวซ่อนไว้ตามสเปก)',
        'กล้อง: ซูมช้า 2.5 % T048–T064 ค้างถึง T070 · ชีพจรเบา T092 · 2 px แนวตั้งตอนคืนชีพ T118 (preview เท่านั้น) · ไม่มี hit-stop การต่อสู้',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': ROOT_KEYS, 'height': [[0, 0], [117, 0], [118, 2], [119, 1], [120, -1], [121, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/linxue_ult_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'fieldX': FIELD_X, 'gameFx': game_fx, 'game': game}, indent=1, default=float))

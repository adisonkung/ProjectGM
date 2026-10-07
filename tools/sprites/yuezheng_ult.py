"""Yue Zheng — Ultimate Mountain Seal Bastion: VFX cut + 60 FPS preview + timeline JSON (sync-sheet meta) + game FX strips.

Inputs (art/incoming/yuezheng, not committed) — four separate VFX sheets on magenta, painted (soft glow), each with a
title banner (top left) and frame numbers under the frames, both removed here:
  ult_charge.png   Ultimate Charge VFX, 10 frames (seed → spiral → tall pillar f8 → transition out)
  ult_impact.png   Ultimate Impact VFX, 9 frames (labelled 1–6, 8–10: frame 7 is missing on the sheet)
  ult_main.png     Ultimate Main VFX, 9 frames (labelled 1–6, 8–10: frame 7 missing) — the mountain bastion
  ult_field.png    Bastion Field Loop, 10 frames (seamless loop)
  public/sprites/hero-yuezheng.png row 7 (character, tools/sprites/yuezheng.py)

Soft alpha: colour-difference unmix against the sheet's key colour (alpha = the least opacity that explains the pixel
over magenta, colour = un-premultiplied) — the painted glow keeps its gradient instead of a hard magenta-spill cut.

Timeline (user spec 2026-10, 60 FPS): character T000–T131 (2.20 s), ground contact = master sync T100, the field loop
continues after T131 (shown to T167). Outputs: <out>/yuezheng_ult_preview_60fps.mp4 · _50fps.gif · _contact.png ·
yuezheng_ult_timeline.json · public/sprites/fx-yuezheng-ult-{charge,impact,field-back,field-front}.png
(revision 2026-10: no Main VFX — the impact is held in its place; charge larger; field centred on Yue Zheng)

Usage: python3 tools/sprites/yuezheng_ult.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/yz_ult'
os.makedirs(OUT, exist_ok=True)
SRC = 'art/incoming/yuezheng'
FPS, N, N_CHAR = 60, 168, 132
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 520, 300, 3
GROUND, X0 = 262, 190
CELL_PX, BODY = 80, 78

# ------------------------------------------------------------------ character
atlas = np.array(Image.open('public/sprites/hero-yuezheng.png').convert('RGBA'))
ROW = atlas[7 * CELL_H:8 * CELL_H]
CHAR = [(0, 7, 1), (8, 12, 2), (13, 17, 3), (18, 25, 4), (26, 33, 5), (34, 55, 6), (56, 95, 7), (96, 96, 8), (97, 98, 9),
        (99, 99, 10), (100, 109, 11), (110, 115, 12), (116, 121, 13), (122, 125, 14), (126, 128, 15), (129, 131, 16)]
TRAVEL = [(0, 0), (84, 0), (100, 4), (131, 4)]          # 0–6 px stance settle into the slam, no travel


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    if t > CHAR[-1][1]:
        return 16
    return next(c for a, b, c in CHAR if a <= t <= b)


def ease(u):
    return u * u * (3 - 2 * u)


def travel(t):
    for (a, va), (b, vb) in zip(TRAVEL, TRAVEL[1:]):
        if a <= t <= b:
            return va + (vb - va) * ease((t - a) / (b - a))
    return TRAVEL[-1][1]


def torso_x(c):
    a = pose(c)[..., 3] >= 128
    m = ndimage.binary_opening(a, structure=np.ones((5, 5)))
    ys, xs = np.nonzero(m)
    top, bot = ys.min(), ys.max()
    band = (ys >= top + .2 * (bot - top)) & (ys <= top + .55 * (bot - top))
    return float(np.median(xs[band]))


def contact_point(c):
    """the shield's ground contact on the contact pose: the shield is the front edge of the silhouette (the body touches
    it, so runs merge) — its bottom centre = the front-most opaque x in the 6 rows above the feet minus half a shield"""
    a = pose(c)[..., 3] >= 128
    xs = np.nonzero(a[ROOT[1] - 6:ROOT[1] + 1].any(0))[0]
    return float(xs.max()) - SHIELD_HALF


SHIELD_HALF = 9            # half the shield's width on the board (atlas px)
G = contact_point(11) - ROOT[0]          # contact x relative to the feet (atlas px)
FIELD_AT = 0                              # the field is centred on Yue Zheng's feet

# ------------------------------------------------------------------ VFX sheets
FEATHER = 24


def load_vfx(name, n, cut_y):
    rgb = np.array(Image.open(f'{SRC}/{name}.png').convert('RGB')).astype(float)
    h, w, _ = rgb.shape
    key = np.median(rgb[:6, -60:].reshape(-1, 3), 0)
    # magenta-ness unmix: a pixel over the key is (1 - a)·key + a·colour; the painted VFX never contain magenta, so
    # how far min(r, b) rises above g measures how much key shows through (white / teal / dark rock = opaque, pink glow
    # fringe = translucent) — dark colours stay dark instead of turning green as with a per-channel distance
    mag = np.minimum(rgb[..., 0], rgb[..., 2]) - rgb[..., 1]
    kmag = min(key[0], key[2]) - key[1]
    a = 1 - np.clip(mag / kmag, 0, 1)
    a = np.clip((a - 0.04) / 0.96, 0, 1)
    a[:int(0.27 * h), :int(0.30 * w)] = 0       # title banner
    a[cut_y:] = 0                               # frame numbers (read below for the frame centres)
    fg = np.where(a[..., None] > 0, (rgb - (1 - a[..., None]) * key) / np.maximum(a[..., None], 1e-3), 0)
    img = np.dstack([np.clip(fg, 0, 255), a * 255]).astype(np.uint8)
    core = a > 0.3
    lab, k = ndimage.label(core)
    sizes = ndimage.sum(core, lab, range(1, k + 1))
    core &= np.isin(lab, 1 + np.nonzero(sizes >= 12)[0])
    # frame centres = the frame numbers printed under the sheet (the painted glows of neighbours overlap, so column
    # gaps cannot split them): white glyphs below cut_y, glyphs within 40 px are one label ("10")
    lab_area = (rgb[cut_y:, :, 0] > 200) & (rgb[cut_y:, :, 1] > 200) & (rgb[cut_y:, :, 2] > 200)
    gl, k2 = ndimage.label(lab_area)
    cxs = sorted(float(np.mean(np.nonzero(gl == i + 1)[1])) for i in range(k2) if (gl == i + 1).sum() >= 15)
    centres = []
    for x in cxs:
        if centres and x - centres[-1][-1] < 40:
            centres[-1].append(x)
        else:
            centres.append([x])
    centres = [float(np.mean(c)) for c in centres]
    assert len(centres) == n, (name, len(centres))
    bounds = [0] + [int((centres[i] + centres[i + 1]) / 2) for i in range(n - 1)] + [w]
    frames = []
    for i in range(n):
        fr = img[:, bounds[i]:bounds[i + 1]].copy()
        # neighbouring glows overlap on the sheet: fade the alpha over the last FEATHER px at a shared bound
        fw = fr.shape[1]
        ramp = np.ones(fw)
        if i > 0:
            ramp[:FEATHER] = np.minimum(ramp[:FEATHER], np.linspace(0, 1, FEATHER))
        if i < n - 1:
            ramp[-FEATHER:] = np.minimum(ramp[-FEATHER:], np.linspace(1, 0, FEATHER))
        fr[..., 3] = (fr[..., 3] * ramp[None, :]).astype(np.uint8)
        fa = fr[..., 3] > 8
        ys, xs = np.nonzero(fa)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        c = core[:, bounds[i]:bounds[i + 1]]
        cy_, cx_ = np.nonzero(c)
        frames.append({'img': fr[y0:y1, x0:x1], 'cx': float(np.median(cx_)) - x0, 'base': float(cy_.max()) - y0,
                       'w': float(cx_.max() - cx_.min()), 'h': float(cy_.max() - cy_.min())})
    return frames


CHARGE = load_vfx('ult_charge', 10, 450)
IMPACT = load_vfx('ult_impact', 9, 462)       # sheet labels 1–6, 8–10
FIELD = load_vfx('ult_field', 10, 415)
IMP_LABEL = [1, 2, 3, 4, 5, 6, 8, 9, 10]

# sizes (atlas px): charge pillar peak (f8) 2.3 × body tall · impact peak (8) 1.7 × body wide · bastion peak (8)
# 2.75 × body wide (spec 2.5–3) · field 2.5 × body wide
SC = {'charge': 2.7 * BODY / CHARGE[7]['h'], 'impact': 1.7 * BODY / IMPACT[6]['w'],
      'field': 2.5 * BODY / np.mean([f['w'] for f in FIELD])}
# user 2026-10: charge +17 % (2.3 → 2.7 body heights) · the Main VFX (mountain) is dropped — the Impact VFX is held
# longer in its place, IMPACT_FWD px further forward · the field loop is centred on Yue Zheng (feet), not on G
IMPACT_FWD = 14


def plan(spans):
    out = {}
    for f, a, b in spans:
        for t in range(a, b + 1):
            out[t] = f
    return out


# frame plans (1-based index into the cut strips) · opacity envelopes
CHARGE_PLAN = plan([(1, 40, 43), (2, 44, 47), (3, 48, 51), (4, 52, 55), (5, 56, 59), (6, 60, 63), (7, 64, 67), (8, 68, 78),
                    (9, 79, 84), (10, 85, 90)])
CHARGE_A = {t: min(1, (t - 39) / 3) if t < 43 else (1 if t < 87 else (91 - t) / 4) for t in CHARGE_PLAN}
# impact: 1 → 3 → 5 → 6 → peak (sheet 8) T104–T108 → 9 → 10 — sheet frames 2 / 4 skipped for a sharp 60 FPS burst
# impact: 1 → 3 → 5 → 6 → peak (sheet 8) held T104–T113 → 9 T114–T122 → 10 T123–T130 (fade from T127) — replaces the
# bastion; sheet frames 2 / 4 skipped for a sharp 60 FPS burst
IMP_PLAN = plan([(1, 100, 100), (3, 101, 101), (5, 102, 102), (6, 103, 103), (7, 104, 113), (8, 114, 122), (9, 123, 130)])
IMP_A = {t: 1 if t < 127 else (131 - t) / 4 for t in IMP_PLAN}
IMP_AT = None   # set after G
FIELD_START, FIELD_STEP = 118, 5           # field loop: 10 frames × 5 T (83 ms) = 0.83 s per cycle
FIELD_PLAN = {t: (t - FIELD_START) // FIELD_STEP % 10 + 1 for t in range(FIELD_START, N)}
FIELD_A = {t: min(1, (t - FIELD_START + 1) / 7) for t in FIELD_PLAN}
SHAKE = {96: (1, 0), 97: (-1, 0), 98: (1, 1), 99: (-1, 0), 100: (5, 2), 101: (-7, -3), 102: (8, 3), 103: (-10, -4),
         104: (11, 4), 105: (-10, -3), 106: (7, 2), 107: (-5, -2), 108: (4, 1), 109: (-2, -1), 110: (1, 0)}
FRONT_SHARE = {'field': 0.2}   # the near ground ring (lowest part of the tile) is drawn in front of Yue Zheng


def scaled(fr, s, alpha):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    a = np.array(img)
    a[..., 3] = (a[..., 3] * alpha).astype(np.uint8)
    return a, fr['cx'] * s, fr['base'] * s


def place(strip, f, s, alpha, at):
    """tile + top-left relative to the feet; `at` = x of the centre-bottom pivot (relative to the feet)"""
    a, cx, base = scaled(strip[f - 1], s, alpha)
    return a, (at - cx, -base)


def split(a, share):
    cut = int(a.shape[0] * (1 - share))
    b, f = a.copy(), a.copy()
    b[cut:, :, 3] = 0
    f[:cut, :, 3] = 0
    return b, f


def charge_at(t):
    return torso_x(char_at(t)) - ROOT[0]


def background():
    a = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    sky = np.clip(yy / GROUND, 0, 1)
    a[..., 0], a[..., 1], a[..., 2] = (18 + 20 * sky), (22 + 26 * sky), (40 + 30 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 40, a[..., 0])
    a[..., 1] = np.where(g, 58, a[..., 1])
    a[..., 2] = np.where(g, 46, a[..., 2])
    a[GROUND, :, :3] = (62, 86, 64)
    for k in range(-2, 4):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    return Image.fromarray(a)


LOG = []
CAST_X = X0                                 # the field / bastion stay at the cast position (world anchored)


def frame(t):
    img = background()
    rx = X0 + travel(t)
    back, front = [], []

    def put(key, a, off, base_x, layer):
        pos = (round(base_x + off[0]), round(GROUND + off[1]))
        (back if layer == 'back' else front).append((Image.fromarray(a), pos))

    if t in CHARGE_PLAN:
        a, off = place(CHARGE, CHARGE_PLAN[t], SC['charge'], CHARGE_A[t], charge_at(t))
        put('charge', a, off, rx, 'back')
        LOG.append({'T': t, 'track': 'charge', 'frame': CHARGE_PLAN[t], 'x': 0, 'y': 0, 'opacity': round(CHARGE_A[t], 2), 'split': 'behind'})
    for key, pl, al, strip in (('field', FIELD_PLAN, FIELD_A, FIELD),):
        if t in pl:
            a, off = place(strip, pl[t], SC[key], al[t], FIELD_AT)
            b, f = split(a, FRONT_SHARE[key])
            put(key, b, off, CAST_X, 'back')
            put(key, f, off, CAST_X, 'front')
            lbl = pl[t]
            LOG.append({'T': t, 'track': key, 'frame': lbl, 'x': 0, 'y': 0, 'opacity': round(al[t], 2), 'split': 'near ring front'})
    if t in IMP_PLAN:
        a, off = place(IMPACT, IMP_PLAN[t], SC['impact'], IMP_A[t], G + IMPACT_FWD)
        put('impact', a, off, CAST_X, 'front')
        LOG.append({'T': t, 'track': 'impact', 'frame': IMP_LABEL[IMP_PLAN[t] - 1], 'x': 0, 'y': 0, 'opacity': round(IMP_A[t], 2), 'split': 'front'})
    if t >= 100:
        LOG.append({'T': t, 'track': 'gameplay', 'frame': 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t <= 104 else 0.45, 'split': '-'})
    for im, pos in back:
        img.alpha_composite(im, pos) if pos[0] >= 0 and pos[1] >= 0 else img.paste(im, pos, im)
    img.alpha_composite(Image.fromarray(pose(char_at(t))), (round(rx) - ROOT[0], GROUND - ROOT[1]))
    for im, pos in front:
        img.alpha_composite(im, pos) if pos[0] >= 0 and pos[1] >= 0 else img.paste(im, pos, im)
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
                '-crf', '14', f'{OUT}/yuezheng_ult_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=50,scale=780:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/yuezheng_ult_preview_50fps.gif'], check=True)
keys = [0, 18, 40, 56, 68, 84, 96, 100, 104, 110, 116, 122, 131, 150]
cw, ch = 390, 225
sheet = Image.new('RGB', (cw * 7, ch * 2))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(keys):
    sheet.paste(frames[t].resize((cw, ch), Image.LANCZOS), ((i % 7) * cw, (i // 7) * ch))
    dr.text(((i % 7) * cw + 6, (i // 7) * ch + 4), f'T{t:03d} C{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/yuezheng_ult_preview_contact.png')


# ------------------------------------------------------------------ in-game FX strips (30 FPS, timeline order)
def bake(tiles, name, step_ms=round(2000 / 60, 2)):
    l = max(-ox for _, (ox, _) in tiles)
    r = max(a.shape[1] + ox for a, (ox, _) in tiles)
    u = max(-oy for _, (_, oy) in tiles)
    d = max(a.shape[0] + oy for a, (_, oy) in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for i, (a, (ox, oy)) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (i * w + round(l + ox) + 1, round(u + oy) + 1))
    out.save(f'public/sprites/{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': step_ms, 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)],
            'dx': 0, 'dy': 27.25}


def tiles_for(pl, al, strip, key, at, part=None):
    out = []
    for t in sorted(pl)[::2]:
        a, off = place(strip, pl[t], SC[key], al[t], at(t) if callable(at) else at)
        if part:
            a = split(a, FRONT_SHARE[key])[0 if part == 'back' else 1]
        out.append((a, off))
    return out


game_fx = {
    'charge': bake(tiles_for(CHARGE_PLAN, CHARGE_A, CHARGE, 'charge', charge_at), 'fx-yuezheng-ult-charge'),
    'impact': bake(tiles_for(IMP_PLAN, IMP_A, IMPACT, 'impact', G + IMPACT_FWD), 'fx-yuezheng-ult-impact'),
}
# the field loop: one cycle, 10 frames × 83 ms, full opacity (the game repeats it for the field's duration)
for part in ('back', 'front'):
    tiles = []
    for f in range(1, 11):
        a, off = place(FIELD, f, SC['field'], 1.0, FIELD_AT)
        tiles.append((split(a, FRONT_SHARE['field'])[0 if part == 'back' else 1], off))
    game_fx[f'field-{part}'] = bake(tiles, f'fx-yuezheng-ult-field-{part}', step_ms=round(FIELD_STEP * 1000 / 60, 2))

# ------------------------------------------------------------------ timeline JSON + sheet meta
pf = []
for t in range(N):
    c = char_at(t)
    rx = X0 + travel(t)
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [round(rx, 1), GROUND],
               'spearTip': [round(CAST_X + G, 1), GROUND], 'center': [round(rx, 1), GROUND - BODY / 2]})
steps = [round((b - a + 1) * 1000 / 60) for a, b, _ in CHAR]
steps[-1] += round(N_CHAR * 1000 / 60) - sum(steps)
starts = {c: a for a, b, c in CHAR}
spans = {c: b - a + 1 for a, b, c in CHAR}


def step_at(t):
    c = char_at(t)
    return round(c - 1 + (t - starts[c]) / spans[c], 3)


meta = {
    'name': 'yuezheng_ult_sync_sheet',
    'title': 'Timeline Sync Sheet — Ultimate Mountain Seal Bastion  ·  Yue Zheng · Iron Mountain Bastion',
    'subtitle': '60 FPS · character T000–T131 = 2.20 s (field loop continues, shown to T167) · 1 column = 1 frame (16.7 ms) · master sync T100 ground contact',
    'readme': ['Timeline Sync Sheet — Ultimate Mountain Seal Bastion · Yue Zheng', '',
               '60 FPS · ท่าตัวละคร 132 เฟรม (T000–T131) = 2.20 วินาที · Bastion Field วนต่อหลังท่าจบ (แสดงถึง T167)',
               'VFX: Charge 10 เฟรม · Impact 9 เฟรม (แผ่นไม่มีเฟรม 7) · Main 9 เฟรม (แผ่นไม่มีเฟรม 7) · Field Loop 10 เฟรม',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 520×300, พื้น y = 262) · 80 px = 1 ช่องสนาม ≈ ความสูงตัวละครตอนยืน',
               'ที่มา: tools/sprites/yuezheng_ult.py → yuezheng_ult_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า ult ใน SHEETS hero-yuezheng.png (เท่ากับไทม์ไลน์นี้ รวม 2,200 ms)',
    'phases': [[0, 17, 'A', 'GUARD / PREPARE', [120, 130, 150], 'การ์ด / เตรียม'],
               [18, 39, 'B', 'SHIELD RAISE', [70, 140, 220], 'ยกโล่'],
               [40, 67, 'C', 'CHARGE', [150, 120, 235], 'ชาร์จ'],
               [68, 83, 'D', 'SLAM ANTICIPATION', [200, 170, 60], 'ง้างกระแทก'],
               [84, 99, 'E', 'DESCENT', [220, 130, 50], 'กดลง'],
               [100, 109, 'F', 'GROUND IMPACT', [215, 70, 70], 'กระแทกพื้น'],
               [110, 121, 'G', 'IMPACT SUSTAIN / FIELD RISE', [60, 170, 170], 'กระแทกค้าง / สนามขึ้น'],
               [122, 131, 'H', 'RECOVERY / FIELD ACTIVE', [90, 170, 120], 'กลับท่า'],
               [132, N - 1, 'I', 'FIELD LOOP (continues)', [110, 110, 125], 'สนามวนต่อ']],
    'poses': {1: ['F1', 'การ์ดปกติ', 'CAST_START'], 2: ['F2', 'กางขาออก', ''], 3: ['F3', 'ลดตัวลง', ''],
              4: ['F4', 'โล่เริ่มยก', 'SHIELD_RAISE_START'], 5: ['F5', 'โล่ยกสูงขึ้น', ''],
              6: ['F6', 'โล่ระดับไหล่ (ค้างช่วงเริ่มชาร์จ)', 'CHARGE_VFX_START T040'],
              7: ['F7', 'โล่เหนือหัว ค้าง 40 เฟรม = ท่าชาร์จ + ง้างสุด', 'CHARGE_INTENSIFY T056 · ANTICIPATION_PEAK T068'],
              8: ['F8', 'กดโล่ลง (ในภาพโล่ถึงพื้นแล้ว)', 'SLAM_START / FINAL_DESCENT T096'], 9: ['F9', 'ตัวย่อลงตามแรงกด', ''],
              10: ['F10', 'ย่อลึก', ''], 11: ['F11', 'GROUND CONTACT — master sync (ค้าง 10 เฟรม)', 'ULTIMATE_HIT · TAUNT · BUFF · IMPACT T100'],
              12: ['F12', 'follow-through หนัก', 'impact ค้างเฟรม 8'], 13: ['F13', 'ตั้งรับหลังโล่ที่ปัก (ค้าง)', 'FIELD_LOOP_START T118'],
              14: ['F14', 'เริ่มลุก', 'RECOVERY_START T122'], 15: ['F15', 'กลับสู่การ์ด', ''], 16: ['F16', 'ท่าตั้งรับมั่นคง', 'CHARACTER_ANIMATION_END T131']},
    'gameSteps': steps,
    'hits': [100],
    'events': [[0, 'CAST_START', 'C01'], [18, 'SHIELD_RAISE_START', 'C04'], [40, 'CHARGE_VFX_START', 'charge f1 ที่เท้า'],
               [56, 'CHARGE_INTENSIFY', 'C07 โล่เหนือหัว · charge f5'], [68, 'ANTICIPATION_PEAK', 'charge f8 peak T068–T078'],
               [84, 'SLAM_START', 'ช่วงกดลง (ท่าค้าง C07 ถึง T095)'], [96, 'FINAL_DESCENT', 'C08 · สั่นเบา 1 px'],
               [100, 'GROUND_CONTACT', 'C11 = master sync'], [100, 'ULTIMATE_HIT', 'INTERRUPT รัศมี 2 ช่อง (Break 70)'],
               [100, 'TAUNT_APPLY', 'ศัตรูรัศมี 2 ช่อง ถูกยั่วยุ 3 วิ'],
               [100, 'DEFENSIVE_BUFF_APPLY', 'โล่ 30 % HP ตัวเอง / 15 % เพื่อน 6 วิ · taunt_guard ×0.60 3 วิ'],
               [100, 'IMPACT_VFX_SPAWN', 'หน้าจุดโล่แตะพื้น G + 14 px'], [102, 'CAMERA_SHAKE_START', 'สั่นแรง T100–T108'],
               [104, 'IMPACT_PEAK', 'impact เฟรม 8 ค้างถึง T113 · สั่น 11 px'], [114, 'IMPACT_SETTLE', 'impact เฟรม 9 → 10 จางถึง T130'],
               [118, 'FIELD_LOOP_START', 'field เฟดเข้า 7 เฟรม รอบตัวเยว่เจิ้ง'], [122, 'RECOVERY_START', 'C14'],
               [131, 'CHARACTER_ANIMATION_END', 'field วนต่อ']],
    'tracks': [['charge', 'L2 Ultimate Charge VFX', [150, 120, 235], 'ult_charge.png 10 fr', 'behind Yue Zheng',
                'centre-bottom at Yue Zheng (torso x, ground)', 'f1 T040 → f8 peak T068–T078 → f9–f10 out, fade T087–T090'],
               ['impact', 'L3 Ultimate Impact VFX', [240, 210, 120], 'ult_impact.png 9 fr (no 7)', 'front',
                f'centre-bottom at G + {IMPACT_FWD} px (shield contact +{G + IMPACT_FWD:.0f} px)', '1 → 3 → 5 → 6 → 8 peak held T104–T113 → 9 → 10, fade T127–T130 (replaces the Main VFX)'],
               ['field', 'L4 Bastion Field Loop', [100, 190, 140], 'ult_field.png 10 fr loop', 'back / near ring front',
                'centre-bottom on Yue Zheng (feet), world position of the cast (never follows him)', 'from T118 (fade-in 7 fr) · 10 × 5 T = 0.83 s per cycle, 10 → 1 seamless'],
               ['gameplay', 'L6 Gameplay state', [230, 90, 90], 'engine', '-',
                'RADIUS_2 around Yue Zheng', 'T100 interrupt + taunt 3 s + taunt_guard 3 s + shields 6 s · no break / CC immunity in the kit']],
    'trackNames': {'charge': 'ชาร์จ', 'impact': 'กระแทก (แทนป้อมภูผา)', 'field': 'สนามป้อม (วน)', 'gameplay': 'ยั่วยุ / บัฟ / ตัดร่าย'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'Charge หลังตัว (L2)'], [3, 'Impact หน้าสุด (L3)'], [4, 'Field หลังตัว + วงหน้า (L4)'],
               [5, 'สั่นกล้อง (L5)'], [6, 'จังหวะเกมเพลย์ (L6)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': [0, 18, 40, 56, 68, 84, 96, 100, 104, 110, 116, 122, 131, 150],
    'thumbCrop': [60 * UP, 30 * UP, 470 * UP, 290 * UP],
    'travelLabel': 'L1 Root X (px) — ยืนที่เดิม', 'heightLabel': 'Y movement (px)',
    'notes': [
        f'Anchor: charge = กลางล่างที่ลำตัว (สูง 2.7 เท่าตัว) · impact = กลางล่างหน้าจุดโล่แตะพื้น G + {IMPACT_FWD} px (+{G + IMPACT_FWD:.0f} px จากเท้า) · field = กลางล่างที่เท้าเยว่เจิ้ง ตรึงตำแหน่งโลกตอนร่าย',
        'จังหวะ: GROUND_CONTACT T100 = ตัดร่าย (RADIUS_2, Break 70) + ยั่วยุ 3 วิ + โล่ 30/15 % 6 วิ + taunt_guard · impact เกิด T100 สูงสุด T104 ค้างถึง T113 แล้วจางถึง T130 (แทน Main VFX) · field T118',
        'สั่น: เบา 1 px T096–T099 · แรง T100–T108 สูงสุด 11 px T104 · หยุด T110 · ไม่สั่นระหว่าง field loop',
        'ชั้น: charge หลังตัว · field หลังตัว ยกเว้นวงพื้นด้านใกล้ (ล่าง 20 %) หน้าตัว · impact หน้าสุด · root X ขยับแค่ 4 px ตอนกระแทก',
        'Loop: field 10 เฟรม × 83 ms วน 10 > 1 ต่อเนื่อง · ระยะเวลาในเกมตาม taunt (3 วิ) แล้วจาง · แผ่น Impact ไม่มีเฟรม 7 (ใช้ 6 > 8) · ไม่ใช้แผ่น Main VFX แล้ว',
    ],
    'stepAt': {k: step_at(t) for k, t in (('charge', 40), ('peak', 68), ('strike', 96), ('hit', 100), ('recovery', 122))},
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR] +
                              [{'from': N_CHAR, 'to': N - 1, 'char': 'C16', 'drawnFrame': 16}],
           'rootTracks': {'travel': [list(k) for k in TRAVEL], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx},
          open(f'{OUT}/yuezheng_ult_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'G': G, 'scale': SC, 'steps': steps, 'stepAt': meta['stepAt'], 'gameFx': game_fx}, indent=1, default=float))

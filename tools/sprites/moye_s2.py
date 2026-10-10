"""Mo Ye — Skill 2 Phantom Step: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/moye, not committed):
  s2_vfx.png     main VFX, 9 frames in one row (shadow gathers → S-swirl → crimson-black crescent → dash arrow → petals)
  s2_impact.png  impact VFX, 7 frames in one row (star → X burst → big X peak → swirl → crescent fade → petals)
  public/sprites/hero-moye.png row 6 (character, built by tools/sprites/moye.py — small push-off / lunge baked per pose)

Timeline (user spec 2026-10, 60 FPS, T000–T057 ≈ 0.97 s):
  A prepare T000–T007 · B vanish T008–T015 · C phantom travel T016–T027 · D reappear T028–T035 ·
  E assassination strike T036–T045 (damage T040, impact peak T042) · F recovery T046–T057.
  Character opacity is runtime (AnimDef.opacity): 100 % → 80 % T008 → 45 % T010 → 0–15 % T012–T024 → 20 % T025 →
  55 % T028 → 80 % T030 → 100 % T032. No extra Mo Ye sprites — the afterimage / trail is the Main VFX layer.
  Root: a true reposition of 2 tiles (148 px = 2 × body) — in game the engine's BLINK_BEHIND moves her at T025.

The frames of both VFX sheets overlap in x (a crescent's tail runs under the next frame) → frames are split by
connected blobs assigned to the nearest frame centre (k-means on blob centroids), not by empty columns.

Usage: python3 tools/sprites/moye_s2.py <out dir>
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

B.SRC = 'art/incoming/moye'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/moye_s2'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 58
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 440, 200, 3                  # preview canvas (atlas px) · ×3 nearest
GROUND, X0 = 168, 64                    # Mo Ye's feet (pose 1) on the canvas
CELL_PX = 80                            # 1 board cell in atlas px
BODY = 74                               # idle body height (atlas px) = 1 "tile" of the spec
TRAVEL = 2 * BODY                       # reposition: 2 tiles
DEST = X0 + TRAVEL                      # where she reappears
FRONT_X = X0 + CELL_PX                  # the frontline dummy she phases past
TARGET_X = DEST + CELL_PX               # the backline target (next cell after the destination)
ORIGIN = (X0 + 4, GROUND - 38)          # main VFX pivot: Mo Ye's body at the origin (left-centre of the trail)
REAPPEAR = (DEST + 4, GROUND - 40)      # shadow / petal cluster where she comes back
CONTACT = (TARGET_X - 14, GROUND - 42)  # blade contact on the target's front (impact VFX)

# ------------------------------------------------------------------ character (atlas row 6, game scale, local shift baked)
atlas = np.array(Image.open('public/sprites/hero-moye.png').convert('RGBA'))
ROW = atlas[6 * CELL_H:7 * CELL_H]
SHIFT = [0, 0, 0, 4, 10, 0, 10, 8, 5, 4]          # = moye.py ROOT_SHIFT['skill2'] (already in the atlas cells)
CHAR = [  # (from T, to T, pose C##)
    (0, 3, 1), (4, 5, 2), (6, 7, 3), (8, 11, 4), (12, 19, 5), (20, 31, 6), (32, 35, 3), (36, 38, 4), (39, 45, 7),
    (46, 50, 8), (51, 54, 9), (55, 57, 10)]
ROOT_KEYS = [[0, 0], [8, 0], [12, 4], [16, 10], [25, TRAVEL], [36, TRAVEL], [40, TRAVEL + 10], [46, TRAVEL + 8], [57, TRAVEL + 4]]
OPACITY = [[0, 1], [7, 1], [8, .8], [10, .45], [12, .12], [24, .08], [25, .2], [28, .55], [30, .8], [32, 1], [57, 1]]
BLINK_T = 25                            # engine relocation (TARGET_POSITION_REACHED)


def curve(keys, t, smooth=True):
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b:
            k = (t - a) / (b - a)
            if smooth:
                k = k * k * (3 - 2 * k)
            return va + (vb - va) * k
    return keys[-1][1]


def root_x(t):
    return curve(ROOT_KEYS, t)


def opacity(t):
    return curve(OPACITY, t, False)


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next(c for a, b, c in CHAR if a <= t <= b)


def step_of(t):
    """T (60 FPS frame) → position in the clip's steps (fractions = inside a held step) — the unit of AnimDef events"""
    for i, (a, b, _) in enumerate(CHAR):
        if a <= t <= b:
            return round(i + (t - a) / (b - a + 1), 3)
    return float(len(CHAR))


def blade_tip(c):
    a = pose(c)[..., 3] >= 128
    ys, xs = np.nonzero(a)
    top, bot = ys.min(), ys.max()
    band = a.copy()
    band[:int(top + .2 * (bot - top))] = False
    band[int(top + .7 * (bot - top)):] = False
    bx = np.nonzero(band.any(0))[0].max()
    col = np.nonzero(band[:, bx])[0]
    return float(bx), float(col.mean())


TIP = {c: blade_tip(c) for c in range(1, 11)}

# ------------------------------------------------------------------ the dummies (preview only): frontline straw, backline crossbow
straw = np.array(Image.open('public/sprites/enemy-straw-recruit.png').convert('RGBA'))[0:100, 0:132][:, ::-1]
xbow = np.array(Image.open('public/sprites/enemy-crossbow-dummy.png').convert('RGBA'))[0:100, 0:132][:, ::-1]


# ------------------------------------------------------------------ VFX strips
def load_vfx(name, thr=80):
    """RGB distance from the sheet's own background (a hue key eats the pink) + magenta de-spill (same as moye_s1)"""
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


def cut(name, n):
    """blobs → nearest of n frame centres (k-means on blob centroids, weighted by size); a blob wider than a frame
    spacing is split pixel by pixel. Returns frames with a common vertical centre `cy` and their left edge."""
    im = load_vfx(name)
    a = im[..., 3] > 0
    lab, k = ndimage.label(a, np.ones((3, 3)))
    idx = np.arange(1, k + 1)
    size = ndimage.sum(a, lab, idx)
    keep = size >= 3
    xs_all = np.nonzero(a.any(0))[0]
    cen = np.linspace(xs_all.min(), xs_all.max(), 2 * n + 1)[1::2]
    cx = np.array(ndimage.center_of_mass(a, lab, idx))[:, 1]
    sl = ndimage.find_objects(lab)
    spacing = (xs_all.max() - xs_all.min()) / n
    wide = np.array([(s[1].stop - s[1].start) > 1.1 * spacing for s in sl])
    for _ in range(30):
        asg = np.argmin(np.abs(cx[:, None] - cen[None]), 1)
        new = np.array([np.average(cx[(asg == j) & keep], weights=size[(asg == j) & keep]) if ((asg == j) & keep).any() else cen[j]
                        for j in range(n)])
        if np.allclose(new, cen):
            break
        cen = new
    owner = np.zeros(a.shape, int) - 1
    cols = np.arange(a.shape[1])
    near = np.argmin(np.abs(cols[:, None] - cen[None]), 1)
    for i in range(k):
        if not keep[i]:
            continue
        m = lab[sl[i]] == i + 1
        if wide[i]:
            o = np.broadcast_to(near[sl[i][1]][None], m.shape)
            owner[sl[i]][m] = o[m]
        else:
            owner[sl[i]][m] = asg[i]
    ys = np.nonzero(a.any(1))[0]
    cy = (ys.min() + ys.max()) / 2
    out = []
    for j in range(n):
        own = owner == j
        yy, xx = np.nonzero(own)
        x0, x1, y0, y1 = xx.min(), xx.max() + 1, yy.min(), yy.max() + 1
        fr = im[y0:y1, x0:x1].copy()
        fr[..., 3] = np.where(own[y0:y1, x0:x1], fr[..., 3], 0)
        core = fr[..., 3] > 200
        bright = core & (fr[..., :3].astype(int).sum(-1) > 600)
        pick = bright if bright.sum() > 6 else core
        bx = float(np.nonzero(pick.any(0))[0].mean()) if pick.any() else (x1 - x0) / 2
        out.append({'img': fr, 'cx': bx, 'cy': cy - y0, 'left': 0.0})
    return out


MAIN = cut('s2_vfx', 9)
IMPACT = cut('s2_impact', 7)


def rows_h(fr):
    ys = np.nonzero(fr['img'][..., 3] > 0)[0]
    return ys.max() - ys.min()


# sizes: the crescent (main f5) ≈ 1.05 × body tall · impact peak (f3) ≈ 1.2 × body (S1 hit 2 = 0.8, the ult will be far
# bigger) · reappear cluster ≈ 0.5 × body
SC = {'main': 1.05 * BODY / rows_h(MAIN[4]), 'imp': 1.2 * BODY / rows_h(IMPACT[2]), 'rep': 0.5 * BODY / rows_h(IMPACT[0]),
      'petal': 0.45 * BODY / rows_h(MAIN[8])}

# track plans: T → frame (1-based)
MAIN_PLAN = {10: 1, 11: 1, 12: 2, 13: 2, 14: 3, 15: 3, 16: 4, 17: 4, 18: 5, 19: 5, 20: 5, 21: 6, 22: 6, 23: 6,
             24: 7, 25: 7, 26: 7, 27: 8, 28: 8, 29: 8, 30: 9, 31: 9, 32: 9, 33: 9, 34: 9}
MAIN_A = {t: 1.0 if t < 30 else [0.85, 0.7, 0.5, 0.35, 0.2][t - 30] for t in MAIN_PLAN}
# the trail's front end follows the phantom along the path (pivot = origin, never leaves it — not a projectile)
REACH_LEAD = 26


def main_reach(t):
    return min(TRAVEL + 18, root_x(t) + REACH_LEAD)


REP_PLAN = {28: ('imp', 1), 29: ('imp', 1), 30: ('petal', 9), 31: ('petal', 9), 32: ('petal', 9), 33: ('petal', 9)}
REP_A = {28: 1.0, 29: 0.85, 30: 0.8, 31: 0.6, 32: 0.4, 33: 0.2}
IMP_PLAN = {40: 1, 41: 2, 42: 3, 43: 3, 44: 3, 45: 4, 46: 4, 47: 5, 48: 5, 49: 6, 50: 6, 51: 6, 52: 7, 53: 7, 54: 7, 55: 7}
IMP_A = {t: 1.0 if t < 52 else [0.8, 0.6, 0.4, 0.2][t - 52] for t in IMP_PLAN}
SHAKE = {40: (5, -1), 41: (-5, 1), 42: (4, 0), 43: (-2, 0)}
HIT = 40
HITSTOP_MS = 50                         # game only: ~3 display frames T040–T043


def dither(a, alpha):
    if alpha >= 1:
        return a
    bayer = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16
    th = np.tile(bayer, (a.shape[0] // 4 + 1, a.shape[1] // 4 + 1))[:a.shape[0], :a.shape[1]]
    a = a.copy()
    a[..., 3] = np.where(th < alpha, a[..., 3], 0)
    return a


def scaled(fr, sx, sy=None, alpha=1.0):
    sy = sx if sy is None else sy
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * sx)), max(1, round(img.height * sy))), Image.NEAREST)
    a = np.array(img)
    a[..., 3] = np.where(a[..., 3] >= 128, 255, 0)
    return dither(a, alpha), fr['cx'] * sx, fr['cy'] * sy


def main_tile(t):
    """main frame for T: uniform scale while the shadow gathers at the origin; from T016 stretched along x so its front
    reaches the phantom's position (left edge pinned on the origin)"""
    fr = MAIN[MAIN_PLAN[t] - 1]
    s = SC['main']
    sx = s
    if t >= 16:
        w = fr['img'].shape[1]
        sx = max(s, main_reach(t) / w)
    a, _, cy = scaled(fr, sx, s, MAIN_A[t])
    return a, 0.0, cy                   # pivot = left edge, common vertical centre


def tracks_at(t):
    """(track, frame no, rgba, pivot x, pivot y, anchor, opacity)"""
    out = []
    if t in MAIN_PLAN:
        a, px, py = main_tile(t)
        out.append(('main', MAIN_PLAN[t], a, px, py, ORIGIN, MAIN_A[t]))
    if t in REP_PLAN:
        sk, f = REP_PLAN[t]
        src = IMPACT if sk == 'imp' else MAIN
        a, px, py = scaled(src[f - 1], SC[sk], alpha=REP_A[t])
        # petals: centred on their own box (no white core)
        if sk == 'petal':
            px, py = a.shape[1] / 2, a.shape[0] / 2
        out.append(('reappear', f, a, px, py, REAPPEAR, REP_A[t]))
    if t in IMP_PLAN:
        a, px, py = scaled(IMPACT[IMP_PLAN[t] - 1], SC['imp'], alpha=IMP_A[t])
        out.append(('impact', IMP_PLAN[t], a, px, py, CONTACT, IMP_A[t]))
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
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    img = Image.fromarray(a)
    img.alpha_composite(Image.fromarray(straw), (FRONT_X - (132 - 66), GROUND - 86))
    img.alpha_composite(Image.fromarray(xbow), (TARGET_X - (132 - 66), GROUND - 86))
    return img


LOG = []


def char_x(t):
    """where the cell origin of the drawn pose sits: the root curve minus the shift the atlas already holds"""
    c = char_at(t)
    return X0 + root_x(t) - SHIFT[c - 1]


def frame(t):
    img = background()
    c = char_at(t)
    al = opacity(t)
    under = [x for x in tracks_at(t) if x[0] == 'main']
    over = [x for x in tracks_at(t) if x[0] != 'main']
    # main trail behind the character (it must never hide her during the strike — it is gone by T035 anyway)
    for key, f, a, px, py, at, op in under + []:
        img.alpha_composite(Image.fromarray(a), (round(at[0] - px), round(at[1] - py)))
    img.alpha_composite(Image.fromarray(dither(pose(c), al)), (round(char_x(t)) - ROOT[0], GROUND - ROOT[1]))
    for key, f, a, px, py, at, op in over:
        img.alpha_composite(Image.fromarray(a), (round(at[0] - px), round(at[1] - py)))
    for key, f, a, px, py, at, op in under + over:
        LOG.append({'T': t, 'track': key, 'frame': f, 'x': round(at[0] - px), 'y': round(at[1] - py), 'opacity': round(op, 2),
                    'split': 'back' if key == 'main' else 'front'})
    LOG.append({'T': t, 'track': 'opacity', 'frame': c, 'x': round(char_x(t)), 'y': GROUND, 'opacity': round(al, 2), 'split': '-'})
    if HIT <= t <= HIT + 1:
        LOG.append({'T': t, 'track': 'damage', 'frame': 1, 'x': 0, 'y': 0, 'opacity': 1.0 if t == HIT else 0.5, 'split': '-'})
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
                '-crf', '14', f'{OUT}/moye_s2_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=50,scale=880:-1:flags=neighbor,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=none',
                '-loop', '0', f'{OUT}/moye_s2_preview_50fps.gif'], check=True)
keys = [0, 6, 10, 14, 18, 22, 25, 28, 32, 40, 42, 50]
cw, ch = 440, 200
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(keys):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(t):02d} a{opacity(t):.2f}', fill=(255, 255, 255))
sheet.save(f'{OUT}/moye_s2_preview_contact.png')


# ------------------------------------------------------------------ in-game FX strips (30 FPS, timeline order)
def bake(name, ts, tile, anchor_ref, base_t):
    tiles = [tile(t) for t in ts]
    l = max(px for _, px, _ in tiles)
    r = max(a.shape[1] - px for a, px, _ in tiles)
    u = max(py for _, _, py in tiles)
    d = max(a.shape[0] - py for a, _, py in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for i, (a, px, py) in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (i * w + round(l - px) + 1, round(u - py) + 1))
    out.save(f'public/sprites/fx-moye-s2-{name}.png', optimize=True)
    pivot = ((l + 1) / w, (u + 1) / h)
    ax, ay, ref_x = anchor_ref
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(2000 / 60, 2), 'pivot': [round(pivot[0], 4), round(pivot[1], 4)],
            'dx': round((ax - ref_x) * 1.25, 2), 'dy': round(27.25 + (ay - GROUND) * 1.25, 2), 'startT': ts[0],
            'delayMsAfterTrigger': round((ts[0] - base_t) * 1000 / 60)}


def rep_tile(t):
    return next((a, px, py) for k, f, a, px, py, at, op in tracks_at(t) if k == 'reappear')


def imp_tile(t):
    return next((a, px, py) for k, f, a, px, py, at, op in tracks_at(t) if k == 'impact')


game_fx = {
    # at 'self' (her origin cell, spawned on VFX_SPAWN T010): pivot = left-centre of the trail on her body
    'main': bake('main', sorted(MAIN_PLAN)[::2], main_tile, (ORIGIN[0], ORIGIN[1], X0), 10),
    # at 'self' after the blink (event REAPPEAR_START T028): on her body at the destination
    'reappear': bake('reappear', sorted(REP_PLAN)[::2], rep_tile, (REAPPEAR[0], REAPPEAR[1], DEST), 28),
    # at 'target' on the hit (T040): contact point on the target's front (negative dx = toward Mo Ye)
    'impact': bake('impact', sorted(IMP_PLAN)[::2], imp_tile, (CONTACT[0], CONTACT[1], TARGET_X), 40),
}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = []
for t in range(N):
    c = char_at(t)
    fx, fy = TIP[c]
    pf.append({'T': t, 'char': f'C{c:02d}', 'drawnFrame': c, 'root': [round(X0 + root_x(t), 1), GROUND], 'opacity': round(opacity(t), 2),
               'spearTip': [round(char_x(t)) + fx - ROOT[0], GROUND + fy - ROOT[1]], 'center': [round(char_x(t)), GROUND - BODY / 2]})
steps = [round((b - a + 1) * 1000 / 60) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / 60) - sum(steps)
game_events = {'CAST_START': 0, 'ANTICIPATION_PEAK': step_of(6), 'VANISH_START': step_of(8), 'VFX_SPAWN': step_of(10),
               'REAPPEAR_START': step_of(28), 'STRIKE_START': step_of(36), 'DAMAGE': step_of(40), 'IMPACT': step_of(40),
               'RECOVERY_START': step_of(46)}
game_opacity = [[step_of(t) if t < N - 1 else float(len(CHAR)), v] for t, v in OPACITY]
meta = {
    'name': 'moye_s2_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 2 Phantom Step · Mo Ye', '',
               '60 FPS, 58 เฟรม (T000–T057) ≈ 0.97 วินาที · ตัวละคร 10 ท่า (12 ช่วง) + Main VFX (9 เฟรม) + Reappear + Impact VFX (7 เฟรม)',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม + ความทึบ · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 440×200, พื้น y = 168) · 80 px = 1 ช่องสนาม · 1 tile (สเปก) = ความสูงตัว 74 px',
               'หุ่นฟาง = แนวหน้าที่ผ่าน · หุ่นหน้าไม้ = เป้าแถวหลัง',
               'ที่มา: tools/sprites/moye_s2.py → moye_s2_timeline.json → tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill2 ใน SHEETS hero-moye.png (เท่ากับไทม์ไลน์นี้ รวม 967 ms) · ความทึบ = AnimDef.opacity',
    'title': 'Timeline Sync Sheet — Skill 2 Phantom Step  ·  Mo Ye · Shadow Orchid Blade',
    'subtitle': '60 FPS · 58 frames (T000–T057) = 0.97 s · 1 column = 1 frame (16.7 ms) · vanish T008 · blink T025 · reappear T028 · hit T040',
    'phases': [[0, 7, 'A', 'PREPARE', [120, 130, 150], 'เตรียม'],
               [8, 15, 'B', 'VANISH', [120, 70, 150], 'หายตัว'],
               [16, 27, 'C', 'PHANTOM TRAVEL', [150, 40, 90], 'เคลื่อนเงา'],
               [28, 35, 'D', 'REAPPEAR', [190, 70, 140], 'ปรากฏ'],
               [36, 45, 'E', 'ASSASSINATION STRIKE', [215, 60, 80], 'ฟันลอบสังหาร'],
               [46, 57, 'F', 'RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {1: ['F1', 'ท่าพร้อม ดาบใหญ่มือขวา / ดาบเล็กมือซ้าย', 'CAST_START'],
              2: ['F2', 'ย่อตัวโหลดน้ำหนัก', ''],
              3: ['F3', 'ย่อต่ำสุด (ง้าง) · ใช้ซ้ำตอนลงพื้น T032', 'ANTICIPATION T006'],
              4: ['F4', 'ถีบตัวพุ่ง ดาบใหญ่ไขว้หลัง · ใช้ซ้ำตอนง้างฟัน T036', 'VANISH_START T008 · STRIKE_START T036'],
              5: ['F5', 'พุ่งต่ำ (ตัวโปร่ง 0–15 %)', 'PHANTOM_MOVE_START T016'],
              6: ['F6', 'ลอยกลางอากาศ — โผล่ที่ปลายทาง', 'TARGET_POSITION_REACHED T025 · REAPPEAR T028'],
              7: ['F7', 'แทงดาบใหญ่ (มือขวา) สุดแขน', 'DAMAGE T040'],
              8: ['F8', 'สะบัดดาบใหญ่เหนือหัว', 'RECOVERY_START T046'],
              9: ['F9', 'ย่อรับน้ำหนัก', ''],
              10: ['F10', 'กลับท่าพร้อมรบ', 'ANIMATION_END T057']},
    'gameSteps': steps,
    'hits': [HIT],
    'events': [[0, 'CAST_START', 'C01 · ท่าพร้อม'],
               [6, 'ANTICIPATION', 'C03 · ย่อต่ำสุด'],
               [8, 'VANISH_START', 'C04 · ถีบตัว ความทึบ 80 %'],
               [10, 'MAIN_VFX_SPAWN', 'เงารวมตัวที่จุดเริ่ม (45 %)'],
               [12, 'CHARACTER_FADE_OUT', 'ตัวโปร่ง 0–15 %'],
               [16, 'PHANTOM_MOVE_START', 'รอยพุ่งยืดตามทาง'],
               [25, 'TARGET_POSITION_REACHED', 'blink ของเอนจิน (ย้ายช่อง) · 20 %'],
               [28, 'REAPPEAR_START', 'กลุ่มเงา/กลีบเล็ก · 55 %'],
               [32, 'CHARACTER_FULL_VISIBLE', 'C03 ลงพื้น 100 %'],
               [36, 'STRIKE_START', 'C04 ง้างฟัน'],
               [40, 'DAMAGE', 'ดาบใหญ่แทง 200 % · BACKLINE / TARGET HIT'],
               [40, 'IMPACT_VFX_SPAWN', 'จุดสัมผัสหน้าเป้า · สั่น 5 px'],
               [42, 'IMPACT_PEAK', 'X ระเบิดสูงสุด'],
               [44, 'HITSTOP_END', 'hit-stop ในเกม 50 ms'],
               [46, 'RECOVERY_START', 'C08'],
               [57, 'ANIMATION_END', 'C10 · กลับ idle']],
    'tracks': [['opacity', 'L2 Character Opacity', [170, 170, 200], 'runtime (AnimDef.opacity)', 'L2 · ตัวละคร',
                'ไม่มี sprite เงาเพิ่ม', '100 % > 80 T008 > 45 T010 > 0–15 T012–T024 > 20 T025 > 55 T028 > 80 T030 > 100 T032'],
               ['main', 'L4 Skill 2 Main VFX', [235, 90, 130], 'fx-moye-s2-main (s2_vfx.png 9 fr)', 'L4 · หลังตัวละคร',
                'pivot = ซ้ายกลางที่จุดเริ่ม (ไม่ขยับ) · ปลายหน้ายืดตามตำแหน่งเงา', 'f1–f3 เงารวม T010–T015 · f4 streak T016 · f5 crescent T018 · f6–f7 ลูกศร T021–T026 · f8–f9 กลีบจาง T027–T034'],
               ['reappear', 'L5 Reappear VFX', [200, 120, 220], 'fx-moye-s2-reappear (impact f1 + main f9)', 'L5 · หน้าตัวละคร',
                'กลางตัวที่ปลายทาง', 'T028 กลุ่มเงาเล็ก · T030–T033 กลีบกระจายจาง'],
               ['impact', 'L6 Skill 2 Impact VFX', [255, 200, 140], 'fx-moye-s2-impact (s2_impact.png 7 fr)', 'L6 · หน้าสุด',
                'จุดสัมผัสหน้าเป้า', 'T040 spawn · T042–T044 peak (1.2 × ตัว > S1 0.8) · จางถึง T055'],
               ['damage', 'L7 Damage / Target', [230, 90, 90], 'engine', '-', '-', 'T040 ดาเมจ 200 % เป้าแถวหลัง (โฟกัส / เลือด % ต่ำสุด)']],
    'trackNames': {'opacity': 'ความทึบตัวละคร', 'main': 'รอยก้าวเงา', 'reappear': 'กลุ่มเงาปรากฏ', 'impact': 'ประกายลอบสังหาร', 'damage': 'ดาเมจ'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'ความทึบ (L2)'], [3, 'Root X (L3)'], [4, 'Main VFX หลังตัว (L4)'],
               [5, 'Reappear VFX (L5)'], [6, 'Impact VFX (L6)'], [7, 'ดาเมจ/เป้า (L7)'], [8, 'สั่นกล้อง (L8)']],
    'shake': {str(k): list(v) for k, v in SHAKE.items()},
    'thumbs': [0, 10, 18, 28, 40, 50],
    'thumbLabels': {0: 'READY', 10: 'VANISH', 18: 'PHANTOM TRAVEL', 28: 'REAPPEAR', 40: 'STRIKE', 50: 'RECOVERY'},
    'thumbCrop': [10 * UP, 40 * UP, 420 * UP, 186 * UP],
    'travelLabel': 'L3 Root X (px) — ย้าย 2 tile (148 px) ถึง T025', 'heightLabel': 'Y movement (px)',
    'notes': [
        'มือ: ดาบใหญ่มือขวา / ดาบเล็กมือซ้ายเสมอ — ฟันลอบสังหาร T040 = ดาบใหญ่แทงสุดแขน C07',
        'ความทึบ = runtime ทั้งหมด (ไม่มี sprite เงาของโม่เย่เพิ่ม) — ภาพติดตา/รอยพุ่งเป็นชั้น Main VFX',
        'Root: ย้ายจริง 2 tile — ในเกมคือ BLINK_BEHIND ของเอนจินที่ T025 (move ของท่า) ไปช่องข้างเป้า แล้วหันเข้าหาเป้า; ท่า F4/F5 อบก้าวพุ่ง 4/10 px, F7–F10 แทงไป 10 แล้วคืน 4',
        'Main VFX: pivot ซ้ายกลางที่จุดเริ่มตลอด (ไม่ใช่กระสุน) · ในเกมความยาวคงที่ 2 tile แม้วาร์ปไกล/ใกล้กว่านั้น · จบก่อน T035 ไม่บังตอนฟัน',
        'Impact: T040 ที่จุดสัมผัส peak T042 ใหญ่กว่า Orchid Sever (1.2 vs 0.8 × ตัว) เล็กกว่าอัลติมาก',
        'Camera: ไม่สั่นระหว่างพุ่ง · 5/5/4/2 px T040–T043 · hit-stop ในเกม 50 ms — preview นี้ไม่หยุดเฟรม',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': ROOT_KEYS, 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx,
           'game': {'steps': steps, 'events': game_events, 'move': step_of(BLINK_T), 'opacity': game_opacity}},
          open(f'{OUT}/moye_s2_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'gameFx': game_fx, 'steps': steps, 'events': game_events, 'move': step_of(BLINK_T),
                  'opacity': game_opacity}, indent=1, default=float))

"""Kael Ashen Vanguard — Ultimate Ashen Rupture: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Canonical sources (assets/heroes/Kael — approved, never edited):
  character/kael_ult_character.png  10 frames 5 + 5 on transparency (row 7 of hero-kael.png, built by tools/sprites/kael.py)
  vfx/kael_ult_charge_vfx.png  Charge VFX 8 frames: ember slashes spiral up around him → blazing X vortex → crescent
  vfx/kael_ult_main_vfx.png    Main VFX = the sword wave, 8 frames: small X → widening crescent wave (peak f5) → fades
  vfx/kael_ult_impact_vfx.png  Impact VFX 8 frames: X burst with rocks (peak f5) → fades
  timeline/kael_timeline_v2.json (ultimate_ashen_rupture): 10 frames at 12 FPS (provisional) · F2 vfx_spawn
                               ultimate_charge (caster) · F8 projectile_spawn ultimate_main (ONE wave, travel 4 cells) ·
                               impact_on_collision ultimate_impact · damage once per valid target on the wave's hit

Timeline (60 FPS preview, per-frame holds `DUR` — user 2026-10: bigger, slower, a longer charge; clip 94 T = 1.57 s):
  F1 READY T00 · F2 CHARGE_START T05 (charge VFX) · F3 CHARGE T13 · F4 LIFT_SWORD T21 · F5 OVERHEAD_READY T30 ·
  F6 STRONG_ANTICIPATION T40 (held 18 T: the vortex roars at its peak) · F7 RELEASE_START T58 (a fast 4 T cut) ·
  F8 SWORD_WAVE_SPAWN T62 (one wave) · F9 FOLLOW_THROUGH T72 · F10 RECOVERY T82 → T93
  Wave: 7 cells / s (8.57 T per cell) from his front edge → reaches cell k centre at T62 + (k − 0.5) × 8.57 = T66 / T75 /
  T83 / T92 → damage + impact on whoever stands there (each unit once) → fades past cell 4 (~T102)

In game: kit ult DAMAGE FRONT_LINE_4 `travel` 7 (engine: cell k resolves (k − 0.5) / 7 s after F8, own impact per
collision) · `kl-ult-charge` = self on CHARGE_START (behind him) · `kl-ult-wave` = self on VFX_SPAWN (F8), the travel
baked into the strip · `kl-ult-impact` = target on every collision impact (perHit).

Usage: python3 tools/sprites/kael_ult.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

SRC = 'assets/heroes/Kael'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/kael_ult'
os.makedirs(OUT, exist_ok=True)
FPS = 60
DUR = [5, 8, 8, 9, 10, 18, 4, 10, 10, 12]   # T per character frame (charge F2–F6 drawn out, F6 held, F7 snaps)
N = sum(DUR)                             # 94 T = 1.57 s
TAIL = 26                                # preview runs on after the clip (the last impact fades ~T116)
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 600, 250, 3
GROUND, X0 = 215, 120
CELL_PX = 80
START = [sum(DUR[:i]) for i in range(10)]
CHARGE_T, PEAK_T, STRIKE_T, SPAWN_T, RECOVER_T = START[1], START[5], START[6], START[7], START[8]
SPEED = 7                                # wave cells / s  (= kit travel)
T_CELL = FPS / SPEED                     # 6 T per cell
WAVE_X0 = 40                             # wave starts at his front edge (px ahead of his feet)
TARGETS = [1, 2, 3, 4]                   # one foe per cell ahead in the preview
HITS = [round(SPAWN_T + (k - 0.5) * T_CELL) for k in TARGETS]

# sizes (game px): charge vortex peak ≈ 2.4 × his body width · wave peak ≈ 1.9 × his body height · impact ≈ 1.6 × body
# (user 2026-10: bigger, an ultimate) · every layer gets an ember bloom (GLOW)
BODY_W, BODY_H = 84, 78

atlas = np.array(Image.open('public/sprites/hero-kael.png').convert('RGBA'))
ROW = atlas[7 * CELL_H:8 * CELL_H]
CHAR = [(START[i], START[i] + DUR[i] - 1, i + 1) for i in range(10)]
POSES = {1: ('READY', 'ยืนพร้อม', 'CAST_START'),
         2: ('CHARGE_START', 'รวบรวมพลัง', 'CHARGE VFX'),
         3: ('CHARGE', 'พลังหมุนรอบตัว', ''),
         4: ('LIFT_SWORD', 'ยกดาบ', ''),
         5: ('OVERHEAD_READY', 'ดาบเหนือศีรษะ', ''),
         6: ('STRONG_ANTICIPATION', 'ง้างสุด', 'CHARGE_PEAK'),
         7: ('RELEASE_START', 'ฟันลง', 'STRIKE_START'),
         8: ('SWORD_WAVE_SPAWN', 'ดาบลงสุด ปล่อยคลื่น', 'WAVE SPAWN (1 ลูก)'),
         9: ('FOLLOW_THROUGH', 'ตามดาบ', 'RECOVERY'),
         10: ('RECOVERY', 'กลับท่า', '')}


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    i = max(k for k in range(10) if START[k] <= t)
    return round(i + (t - START[i]) / DUR[i], 3)


ENEMY = np.array(Image.open('public/sprites/enemy-goblin-fighter.png').convert('RGBA'))[0:100, 0:132][:, ::-1]
ENEMY_ROOT = (132 - 66, 86)


# ------------------------------------------------------------------ VFX (alpha unmixed from the magenta key)
def unmix(name):
    rgb = np.array(Image.open(f'{SRC}/{name}.png').convert('RGB')).astype(float)
    bg = np.median(rgb[:6].reshape(-1, 3), 0)
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    al = np.clip(1 - (np.minimum(r, b) - g) / (min(bg[0], bg[2]) - bg[1]), 0, 1)
    al = np.where(al < 0.08, 0, al)
    col = np.clip((rgb - (1 - al[..., None]) * bg) / np.maximum(al[..., None], 1e-3), 0, 255)
    out = np.zeros(rgb.shape[:2] + (4,), np.uint8)
    out[..., :3] = col
    out[..., 3] = (al * 255).astype(np.uint8)
    return out


def dividers(m, n, win=70):
    w = m.shape[1]
    col = np.convolve(m.sum(0).astype(float), np.ones(5) / 5, 'same')
    return [int(k * w / n) - win + int(np.argmin(col[int(k * w / n) - win:int(k * w / n) + win])) for k in range(1, n)]


def cut(name, n, pivot='ground'):
    """one row of n frames; blobs go whole to their slot (split only when really spanning two), specks far from the
    frame's art dropped · pivot 'ground' = slot centre on the row's ground line (lowest edge of the cleaned frames) ·
    'centre' = the peak frame's alpha centre, shared by every frame (the burst stays put)"""
    im = unmix(name)
    hard = im[..., 3] > 40
    divs = dividers(hard, n)
    edges = [0] + divs + [im.shape[1]]
    lab, k = ndimage.label(im[..., 3] > 0, np.ones((3, 3)))
    slot = np.broadcast_to(np.digitize(np.arange(im.shape[1]), divs), lab.shape)
    own = np.full(lab.shape, -1)
    for i in range(1, k + 1):
        sel = lab == i
        ks, cnt = np.unique(slot[sel], return_counts=True)
        if len(ks) > 1 and np.sort(cnt)[-2] >= 0.15 * sel.sum():
            own[sel] = slot[sel]
        else:
            own[sel] = ks[np.argmax(cnt)]
    row = []
    for s in range(n):
        fr = im.copy()
        fr[own != s] = 0
        ml, mk = ndimage.label(fr[..., 3] > 12, np.ones((3, 3)))
        if mk > 1:
            sz = ndimage.sum(np.ones(ml.shape), ml, range(1, mk + 1))
            big = ml == 1 + int(np.argmax(sz))
            near = ndimage.binary_dilation(big, iterations=60)
            for i in range(1, mk + 1):
                if sz[i - 1] < 400 and not (near & (ml == i)).any():
                    fr[ml == i] = 0
        ys, xs = np.nonzero(fr[..., 3] > 12)
        row.append({'img': fr[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'x0': xs.min(), 'y0': ys.min(),
                    'y1': ys.max() + 1, 'cx': (edges[s] + edges[s + 1]) / 2})
    if pivot == 'ground':
        ground = max(f['y1'] for f in row) - 1
        return [{'img': f['img'], 'px': f['cx'] - f['x0'], 'py': ground - f['y0']} for f in row]
    peak = max(row, key=lambda f: int((f['img'][..., 3] > 60).sum()))
    ys, xs = np.nonzero(peak['img'][..., 3] > 60)
    cy = peak['y0'] + (ys.min() + ys.max()) / 2
    return [{'img': f['img'], 'px': f['cx'] - f['x0'], 'py': cy - f['y0']} for f in row]


CHARGE = cut('vfx/kael_ult_charge_vfx', 8)


def cut_rows(name, per_row=5):
    """two rows of per_row frames (the S1 sheets, same cut as kael_s1.py): rows split at the emptiest row between 35–65 %
    of the height, then the single-row cut per band; pivot = slot centre on the band's ground line"""
    im = unmix(name)
    hard = im[..., 3] > 40
    h = im.shape[0]
    rows = hard.sum(1)
    mid = int(h * 0.35) + int(np.argmin(rows[int(h * 0.35):int(h * 0.65)]))
    out = []
    for y0, y1 in [(0, mid), (mid, h)]:
        band = im[y0:y1]
        m = hard[y0:y1]
        divs = dividers(m, per_row)
        edges = [0] + divs + [band.shape[1]]
        lab, k = ndimage.label(band[..., 3] > 0, np.ones((3, 3)))
        slot = np.broadcast_to(np.digitize(np.arange(band.shape[1]), divs), lab.shape)
        own = np.full(lab.shape, -1)
        for i in range(1, k + 1):
            sel = lab == i
            ks, cnt = np.unique(slot[sel], return_counts=True)
            own[sel] = slot[sel] if len(ks) > 1 and np.sort(cnt)[-2] >= 0.15 * sel.sum() else ks[np.argmax(cnt)]
        ground = int(np.nonzero(m.any(1))[0].max())
        for sl in range(per_row):
            fr = band.copy()
            fr[own != sl] = 0
            ml, mk = ndimage.label(fr[..., 3] > 12, np.ones((3, 3)))
            if mk > 1:
                sz = ndimage.sum(np.ones(ml.shape), ml, range(1, mk + 1))
                near = ndimage.binary_dilation(ml == 1 + int(np.argmax(sz)), iterations=60)
                for i in range(1, mk + 1):
                    if sz[i - 1] < 400 and not (near & (ml == i)).any():
                        fr[ml == i] = 0
            ys, xs = np.nonzero(fr[..., 3] > 12)
            cx = (edges[sl] + edges[sl + 1]) / 2
            out.append({'img': fr[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'px': cx - xs.min(), 'py': ground - ys.min()})
    return out


SLAM = cut_rows('vfx/kael_s1_impact_vfx')
WAVE = cut('vfx/kael_ult_main_vfx', 8)
IMPACT = cut('vfx/kael_ult_impact_vfx', 8, 'centre')


def size(fr, thr=60):
    ys, xs = np.nonzero(fr['img'][..., 3] > thr)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


SC = {'charge': 2.4 * BODY_W / size(CHARGE[5])[0], 'wave': 1.9 * BODY_H / size(WAVE[4])[1],
      'impact': 1.6 * BODY_W / size(IMPACT[4])[0], 'slam': 1.7 * BODY_W / size(SLAM[2])[0]}
GLOW = {'charge': (7, 0.75), 'wave': (6, 0.7), 'impact': (5, 0.6), 'slam': (6, 0.85)}   # bloom radius (game px) / strength


def plan(keys):
    out = {}
    for (t0, f), (t1, _) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            if f:
                out[t] = f
    return out


# charge F2 (T05) → builds around him over F2–F5 → the biggest vortex f6 from T38, held still through the whole held
# anticipation F6 (user 2026-10: no f6 / f5 flicker) → crescent f7–f8 drawn into the overhead sword on the cut F7 → gone
# just after the release
CHARGE_PLAN = plan([(5, 1), (11, 2), (17, 3), (23, 4), (30, 5), (38, 6), (58, 7), (61, 8), (65, None)])


def charge_tile(t):
    """the charge frame at T — f6 is simply held through the held anticipation F6 (user 2026-10: hold it still; an f6 / f5
    alternation read as flicker, a breathing loop moved too much)"""
    return tile(CHARGE[CHARGE_PLAN[t] - 1], SC['charge'], glow=GLOW['charge'])


# ground slam (user 2026-10: the S1 impact VFX reused where the sword hits the ground on F8, to sell the blow): the S1
# burst (spike → ground burst with rocks, peak f3) at the blade's ground contact, bigger + ember bloom, under the wave
SLAM_DX = 52                             # px ahead of his feet: F8 blade tip (+54, 12 px above the ground) meets the ground
SLAM_PLAN = plan([(62, 1), (63, 2), (65, 3), (68, 4), (71, 5), (74, 6), (77, 7), (80, 8), (83, 9), (86, 10), (89, None)])
# the wave: F8 (T62) small X at his front edge → grows while it flies → peak f5 over cells 2–3 → fades past cell 4
WAVE_PLAN = plan([(62, 1), (65, 2), (68, 3), (72, 4), (78, 5), (86, 6), (93, 7), (98, 8), (102, None)])
WAVE_END = 102
IMP_T = 3                                # impact: 8 frames × 3 T from each collision


def wave_x(t):
    return WAVE_X0 + (t - SPAWN_T) * CELL_PX / T_CELL


# impact per collision: 8 frames × IMP_T from the hit
def impact_frame(t, h):
    k = (t - h) // IMP_T
    return k + 1 if 0 <= k < 8 else None


def tile(fr, s, alpha=1.0, glow=None):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    a = np.array(img)
    px, py = fr['px'] * s, fr['py'] * s
    if glow:                                  # ember bloom: the bright core blurred out under the art
        r, k = glow
        pad = 2 * r
        a = np.pad(a, ((pad, pad), (pad, pad), (0, 0)))
        px, py = px + pad, py + pad
        f = a.astype(float) / 255
        lum = f[..., :3].max(-1) * f[..., 3]
        src = np.zeros_like(f)
        src[..., :3] = f[..., :3] * lum[..., None]
        src[..., 3] = lum
        b = np.stack([ndimage.gaussian_filter(src[..., c], r) for c in range(4)], -1)
        ga = np.clip(b[..., 3] * 2.2 * k, 0, 1)
        gc = np.clip(b[..., :3] / np.maximum(b[..., 3:], 1e-4), 0, 1) * np.array([1.0, 0.72, 0.45])   # warm ember tint
        sa = f[..., 3]
        oa = sa + ga * (1 - sa)
        rgb = (f[..., :3] * sa[..., None] + gc * ga[..., None] * (1 - sa[..., None])) / np.maximum(oa[..., None], 1e-4)
        a = np.concatenate([rgb, oa[..., None]], -1)
        a = (np.clip(a, 0, 1) * 255).astype(np.uint8)
    a[..., 3] = (a[..., 3].astype(float) * alpha).astype(np.uint8)
    return a, px, py


def background():
    a = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    sky = np.clip(yy / GROUND, 0, 1)
    a[..., 0], a[..., 1], a[..., 2] = (26 + 16 * sky), (22 + 14 * sky), (30 + 18 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 46, a[..., 0])
    a[..., 1] = np.where(g, 46, a[..., 1])
    a[..., 2] = np.where(g, 44, a[..., 2])
    a[GROUND, :, :3] = (84, 80, 72)
    for k in range(-1, 7):
        x = int(X0 - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (98, 94, 84)
    a[..., 3] = 255
    return Image.fromarray(a)


def put(img, a, px, py, at):
    x, y = round(at[0] - px), round(at[1] - py)
    img.alpha_composite(Image.fromarray(a), (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return x, y


LOG = []


def ev(t, track, frame, op=1.0):
    LOG.append({'T': t, 'track': track, 'frame': frame, 'x': 0, 'y': 0, 'opacity': op, 'split': '-'})


def frame(t, log=True):
    img = background()
    dr = ImageDraw.Draw(img)
    if t in CHARGE_PLAN:                 # behind him
        a, px, py = charge_tile(t)
        x, y = put(img, a, px, py, (X0, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'charge', 'frame': CHARGE_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'back', 'part': 'charge'})
    for k, h in zip(TARGETS, HITS):
        hit = h <= t <= h + 8
        sx = (-3 if (t - h) % 2 else 2) if hit else 0
        img.alpha_composite(Image.fromarray(ENEMY), (int(X0 + k * CELL_PX + sx - ENEMY_ROOT[0]), GROUND - ENEMY_ROOT[1]))
    img.alpha_composite(Image.fromarray(pose(char_at(t))), (X0 - ROOT[0], GROUND - ROOT[1]))
    if t in SLAM_PLAN:                   # in front of him, under the wave
        a, px, py = tile(SLAM[SLAM_PLAN[t] - 1], SC['slam'], glow=GLOW['slam'])
        x, y = put(img, a, px, py, (X0 + SLAM_DX, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'slam', 'frame': SLAM_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'slam'})
    if t in WAVE_PLAN:
        a, px, py = tile(WAVE[WAVE_PLAN[t] - 1], SC['wave'], glow=GLOW['wave'])
        x, y = put(img, a, px, py, (X0 + wave_x(t), GROUND))
        if log:
            LOG.append({'T': t, 'track': 'wave', 'frame': WAVE_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'wave'})
    for i, (k, h) in enumerate(zip(TARGETS, HITS)):
        f = impact_frame(t, h)
        if f:
            a, px, py = tile(IMPACT[f - 1], SC['impact'], glow=GLOW['impact'])
            put(img, a, px, py, (X0 + k * CELL_PX - 6, GROUND - 32))
            if log:
                LOG.append({'T': t, 'track': 'impact', 'frame': f, 'x': 0, 'y': 0, 'opacity': 1, 'split': 'front', 'part': 'impact'})
        if h <= t <= h + 6:
            dr.text((X0 + k * CELL_PX - 14, GROUND - 100), f'HIT {k}', fill=(255, 220, 140))
    if log:
        if t == 0:
            ev(t, 'events', 1)
        if t == CHARGE_T:
            ev(t, 'events', 2)
        if t == SPAWN_T:
            ev(t, 'spawn', 1)
        for i, h in enumerate(HITS):
            if h <= t <= h + 1:
                ev(t, 'damage', i + 1, 1.0 if t == h else 0.5)
        if t == RECOVER_T:
            ev(t, 'events', 3)
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(N + TAIL)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/kael_ult_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=780:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/kael_ult_preview_30fps.gif'], check=True)
KEYS = [0, 13, 30, 40, 50, 58, 62, 66, 75, 83, 92, 104]
cw, ch = 600, 250
sheet = Image.new('RGB', (cw * 4, ch * 3))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(KEYS):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} F{char_at(t):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/kael_ult_preview_contact.png')


# ------------------------------------------------------------------ in-game strips
def bake(name, tiles, frame_ms=1000 / 60, offsets=None):
    """tiles = (rgba, px, py); offsets = per-frame x shift of the pivot (the wave's travel baked into the strip)"""
    offsets = offsets or [0] * len(tiles)
    l = max(px - o for (_, px, _), o in zip(tiles, offsets))
    r = max(a.shape[1] - px + o for (a, px, _), o in zip(tiles, offsets))
    u = max(py for _, _, py in tiles)
    d = max(a.shape[0] - py for a, _, py in tiles)
    w, h = int(np.ceil(l + r)) + 2, int(np.ceil(u + d)) + 2
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for k, ((a, px, py), o) in enumerate(zip(tiles, offsets)):
        out.alpha_composite(Image.fromarray(a), (k * w + round(l - px + o) + 1, round(u - py) + 1))
    out.save(f'{OUT}/fx-kael-ult-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round((l + 1) / w, 4), round((u + 1) / h, 4)]}


wave_ts = list(range(SPAWN_T, WAVE_END, 2))     # 30 FPS strip: the travel is long, every other preview frame
charge_ts = list(range(CHARGE_T, max(CHARGE_PLAN) + 1, 2))
game_fx = {
    'charge': bake('charge', [charge_tile(t) for t in charge_ts], 1000 / 30),
    'wave': bake('wave', [tile(WAVE[WAVE_PLAN[t] - 1], SC['wave'], glow=GLOW['wave']) for t in wave_ts], 1000 / 30,
                 [wave_x(t) - WAVE_X0 for t in wave_ts]),
    'slam': bake('slam', [tile(SLAM[SLAM_PLAN[t] - 1], SC['slam'], glow=GLOW['slam']) for t in sorted(SLAM_PLAN)]),
    'impact': bake('impact', [tile(IMPACT[f], SC['impact'], glow=GLOW['impact']) for f in range(8)], IMP_T * 1000 / FPS),
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
game = {'steps': steps,
        'events': {'CAST_START': 0, 'CHARGE_START': step_of(CHARGE_T), 'CHARGE_PEAK': step_of(PEAK_T), 'STRIKE_START': step_of(STRIKE_T),
                   'VFX_SPAWN': step_of(SPAWN_T), 'DAMAGE': step_of(SPAWN_T), 'RECOVERY_START': step_of(RECOVER_T)},
        'waveDx': round(WAVE_X0 / CELL_PX * 100, 2), 'slamDx': round(SLAM_DX / CELL_PX * 100, 2), 'impactDy': round(-32 / CELL_PX * 100 + 27.25, 2), 'scale': SC}

pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [X0, GROUND],
       'spearTip': [X0 + 60, GROUND - 40], 'center': [X0, GROUND - 40]} for t in range(N)]
SHAKE = [4, 4, 5, 8]                     # px per collision — the last cut lands hardest (+ a flash)
hs = ' / '.join(f'T{h:03d}' for h in HITS)
meta = {
    'name': 'kael_ult_sync_sheet',
    'readme': ['Timeline Sync Sheet — Ultimate Ashen Rupture · Kael Ashen Vanguard', '',
               f'60 FPS พรีวิว · 10 ท่า ค้างต่อท่า {"/".join(map(str, DUR))} T = {N} เฟรม T000–T{N - 1:03d} = {N / FPS:.2f} วินาที',
               'ตัวละคร 10 ท่า + Charge VFX 8 + คลื่นดาบ (Main VFX) 8 + Impact VFX 8 เฟรม · คลื่นเดียว F8 · ดาเมจตอนคลื่นถึงแต่ละช่อง',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 600×250, พื้น y = 215) · 80 px = 1 ช่อง · ศัตรู 4 ตัวในแนว 1×4',
               'ที่มา: assets/heroes/Kael > tools/sprites/kael_ult.py > kael_ult_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': f'Game ms = steps ของท่า ult ใน SHEETS hero-kael.png (รวม {sum(steps)} ms) · 260 % ต่อตัว ครั้งเดียว · '
                f'คลื่น {SPEED} ช่อง/วิ (ช่อง k ลงหลัง F8 (k − 0.5) / {SPEED} วิ)',
    'title': 'Timeline Sync Sheet — Ultimate Ashen Rupture  ·  Kael Ashen Vanguard',
    'subtitle': f'60 FPS · clip {N} frames (T000–T{N - 1:03d}) = {N / FPS:.2f} s · charge F2–F6 (held peak) · one sword wave F8 · '
                f'damage on collision (cell 1–4: {hs})',
    'phases': [[0, CHARGE_T - 1, 'A', 'READY', [120, 130, 150], 'ตั้งท่า'],
               [CHARGE_T, PEAK_T - 1, 'B', 'CHARGE / LIFT', [200, 170, 90], 'รวมพลัง F2 · ยกดาบเหนือศีรษะ'],
               [PEAK_T, SPAWN_T - 1, 'C', 'PEAK / RELEASE', [230, 110, 90], 'ง้างค้าง F6 (vortex ใหญ่สุดค้างนิ่ง) · ฟันลง F7'],
               [SPAWN_T, N - 1, 'D', 'WAVE / RECOVER', [235, 130, 70], 'ปล่อยคลื่น F8 · ชน 4 ช่อง · กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [h for h in HITS if h < N],
    'events': [[0, 'CAST_START', 'F1'], [CHARGE_T, 'VFX_SPAWN ultimate_charge', 'F2 รอบตัว'], [PEAK_T, 'CHARGE_PEAK', 'F6 ค้าง'],
               [STRIKE_T, 'RELEASE_START', 'F7'], [SPAWN_T, 'GROUND SLAM + WAVE SPAWN (1)', 'F8 ดาบกระแทกพื้น'],
               [HITS[0], 'COLLISION cell 1', 'ดาเมจ + impact'], [RECOVER_T, 'RECOVERY', 'F9'],
               [HITS[1], 'COLLISION cell 2', 'ดาเมจ + impact'], [HITS[2], 'COLLISION cell 3', 'ดาเมจ + impact'],
               [HITS[3], 'COLLISION cell 4', 'ดาเมจ + impact + แฟลช']],
    'lanes': 5,
    'tracks': [['charge', 'L2 Charge VFX (ultimate_charge)', [235, 160, 90], 'fx-kael-ult-charge (kael_ult_charge_vfx.png 8 fr)',
                'L2 · หลังตัวละคร', 'เท้าเคล', f'F2 T{CHARGE_T:03d} > vortex f6 T038 ค้างนิ่งตลอด F6 > เข้าดาบ F7 > หาย T065'],
               ['wave', 'L3 Sword Wave (ultimate_main)', [255, 140, 80], 'fx-kael-ult-wave (kael_ult_main_vfx.png 8 fr, เดินทาง 4 ช่อง)',
                'L3 · หน้าตัวละคร', f'เริ่มหน้าเคล +{WAVE_X0} px · {SPEED} ช่อง/วิ',
                f'F8 T{SPAWN_T:03d} เกิด 1 ลูก > โตขณะวิ่ง > peak ช่อง 2–3 > จางหลังช่อง 4 (T{WAVE_END})'],
               ['slam', 'L3b Ground Slam (skill1_impact)', [255, 120, 60], 'fx-kael-ult-slam (kael_s1_impact_vfx.png 10 fr)',
                'L3 · หน้าตัวละคร ใต้คลื่น', f'จุดดาบแตะพื้น +{SLAM_DX} px', f'F8 T{SPAWN_T:03d} > peak f3 T065 > เศษหิน > จาง T088 · สั่น 7 px'],
               ['impact', 'L4 Impact VFX (ultimate_impact)', [255, 200, 120], 'fx-kael-ult-impact (kael_ult_impact_vfx.png 8 fr × 3 T)',
                'L4 · หน้าเป้า', 'กลางตัวเป้าที่ชน', 'ทุกครั้งที่คลื่นชน (ไม่ใช่ที่ F8)'],
               ['damage', 'L5 Damage on collision', [255, 110, 90], f'DAMAGE FRONT_LINE_4 260 % travel {SPEED}', '-', 'ทุกตัวในช่องที่คลื่นถึง',
                f'ตัวละ 1 ครั้ง · {hs}'],
               ['events', 'L6 Gameplay Events', [200, 200, 200], 'engine', '-', '-', 'F1 cast · F2 charge · F9 recovery']],
    'trackNames': {'slam': 'Slam', 'charge': 'Charge', 'wave': 'คลื่นดาบ', 'impact': 'Impact', 'damage': 'ดาเมจ', 'spawn': 'Spawn', 'events': 'อีเวนต์'},
    'layers': [[1, 'Charge (L2, หลัง)'], [2, 'ตัวละคร (L1)'], [3, 'Slam + คลื่นดาบ (L3)'], [4, 'Impact (L4)'], [5, 'ดาเมจ (L5)'], [6, 'อีเวนต์ (L6)']],
    'shake': {str(SPAWN_T): [7, 0], **{str(h): [s, 0] for h, s in zip(HITS, SHAKE) if h < N}},
    'thumbs': [0, CHARGE_T, 30, PEAK_T, STRIKE_T, SPAWN_T, HITS[0], HITS[1], HITS[2], HITS[3]],
    'thumbLabels': {0: 'READY', CHARGE_T: 'CHARGE START', 30: 'LIFT SWORD', PEAK_T: 'CHARGE PEAK', STRIKE_T: 'RELEASE',
                    SPAWN_T: 'WAVE SPAWN', HITS[0]: 'HIT CELL 1', HITS[1]: 'HIT CELL 2', HITS[2]: 'HIT CELL 3', HITS[3]: 'HIT CELL 4'},
    'thumbCrop': [0, 0, W * UP, 240 * UP],
    'travelLabel': 'L1 Root X (px) — 0 (ยืนที่เดิม ไม่พุ่ง)', 'heightLabel': 'Root Y (px) — 0',
    'notes': [
        'ฟันลงครั้งเดียว ปล่อยคลื่นดาบ 1 ลูกที่ F8 — ไม่พุ่ง ไม่หลายจังหวะ · ที่ F8 ยังไม่มีดาเมจ',
        f'คลื่นวิ่ง {SPEED} ช่อง/วิ: ช่อง 1–4 ลงที่ {hs} — ใครยืนในช่องตอนคลื่นถึงโดน ตัวละ 1 ครั้งต่อการร่าย',
        'ชาร์จยาวขึ้น (ผู้ใช้ 2026-10): F2–F5 ค่อย ๆ รวม > F6 ค้างนิ่ง 0.3 วิ บน vortex เฟรมใหญ่สุด f6 > F7 ฟันเร็ว 4 T ตัดกัน',
        'F8 ดาบกระแทกพื้น: ระเบิดพื้นจาก Impact ของ S1 (1.7 × ตัว + bloom) ที่จุดดาบแตะพื้น + สั่น 7 px / hit-stop 50 ms / แฟลช',
        'VFX ใหญ่ขึ้น: charge 2.4 × ตัว · คลื่น 1.9 × ความสูงตัว · impact 1.6 × ตัว · ทุกชั้นมี bloom ถ่านเพลิง',
        f'สั่น {"/".join(map(str, SHAKE))} px ต่อการชน · แฟลชตอนชนช่อง 4 · ไม่มี root motion',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': [x for x in LOG if x['T'] < N], 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/kael_ult_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'gameFx': game_fx, 'game': game}, indent=1, default=float))

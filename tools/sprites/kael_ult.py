"""Kael Ashen Vanguard — Ultimate Ashen Rupture: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Canonical sources (assets/heroes/Kael — approved, never edited):
  character/kael_ult_character.png  10 frames 5 + 5 on transparency (row 7 of hero-kael.png, built by tools/sprites/kael.py)
  vfx/kael_ult_charge_vfx.png  Charge VFX 8 frames: ember slashes spiral up around him → blazing X vortex → crescent
  vfx/kael_ult_main_vfx.png    Main VFX = the sword wave, 8 frames: small X → widening crescent wave (peak f5) → fades
  vfx/kael_ult_impact_vfx.png  Impact VFX 8 frames: X burst with rocks (peak f5) → fades
  timeline/kael_timeline_v2.json (ultimate_ashen_rupture): 10 frames at 12 FPS (provisional) · F2 vfx_spawn
                               ultimate_charge (caster) · F8 projectile_spawn ultimate_main (ONE wave, travel 4 cells) ·
                               impact_on_collision ultimate_impact · damage once per valid target on the wave's hit

Timeline (60 FPS preview, 1 character frame = 5 T = 83.33 ms; clip 50 T = 0.83 s, the wave runs on past the clip):
  F1 READY T00 · F2 CHARGE_START T05 (charge VFX) · F3 CHARGE T10 · F4 LIFT_SWORD T15 · F5 OVERHEAD_READY T20 ·
  F6 STRONG_ANTICIPATION T25 · F7 RELEASE_START T30 · F8 SWORD_WAVE_SPAWN T35 (one wave) · F9 FOLLOW_THROUGH T40 ·
  F10 RECOVERY T45 → T49
  Wave: 10 cells / s (6 T per cell) from his front edge → reaches cell k centre at T35 + (k − 0.5) × 6 = T38 / T44 /
  T50 / T56 → damage + impact on whoever stands there (each unit once) → fades past cell 4 (~T62)

In game: kit ult DAMAGE FRONT_LINE_4 `travel` 10 (engine: cell k resolves (k − 0.5) / 10 s after F8, own impact per
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
FPS, N, PER = 60, 50, 5                  # 10 character frames × 5 T (12 FPS provisional, timeline_v2)
TAIL = 22                                # preview runs on after the clip (the wave crosses 4 cells)
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 520, 200, 3
GROUND, X0 = 168, 70
CELL_PX = 80
CHARGE_T, SPAWN_T = 5, 35                # F2 / F8
SPEED = 10                               # wave cells / s  (= kit travel)
T_CELL = FPS / SPEED                     # 6 T per cell
WAVE_X0 = 40                             # wave starts at his front edge (px ahead of his feet)
TARGETS = [1, 2, 3, 4]                   # one foe per cell ahead in the preview
HITS = [round(SPAWN_T + (k - 0.5) * T_CELL) for k in TARGETS]

# sizes (game px): charge vortex peak ≈ 1.7 × his body width · wave peak ≈ 1.25 × his body height · impact ≈ 1.1 × body
BODY_W, BODY_H = 84, 78

atlas = np.array(Image.open('public/sprites/hero-kael.png').convert('RGBA'))
ROW = atlas[7 * CELL_H:8 * CELL_H]
CHAR = [(i * PER, i * PER + PER - 1, i + 1) for i in range(10)]
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
    return round(t / PER, 3)


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
WAVE = cut('vfx/kael_ult_main_vfx', 8)
IMPACT = cut('vfx/kael_ult_impact_vfx', 8, 'centre')


def size(fr, thr=60):
    ys, xs = np.nonzero(fr['img'][..., 3] > thr)
    return xs.max() - xs.min() + 1, ys.max() - ys.min() + 1


SC = {'charge': 1.7 * BODY_W / size(CHARGE[5])[0], 'wave': 1.25 * BODY_H / size(WAVE[4])[1],
      'impact': 1.1 * BODY_W / size(IMPACT[4])[0]}


def plan(keys):
    out = {}
    for (t0, f), (t1, _) in zip(keys, keys[1:]):
        for t in range(t0, t1):
            if f:
                out[t] = f
    return out


# charge F2 (T05) → builds around him → blazing vortex f6 at the strongest anticipation F6 (T25) → crescent f7–f8 drawn
# into the overhead sword → gone at the release (T36)
CHARGE_PLAN = plan([(5, 1), (9, 2), (13, 3), (17, 4), (21, 5), (25, 6), (29, 7), (33, 8), (36, None)])
# the wave: F8 (T35) small X at his front edge → grows while it flies → peak f5 over cells 2–3 → fades past cell 4
WAVE_LEN = 28
WAVE_PLAN = plan([(35, 1), (38, 2), (41, 3), (44, 4), (48, 5), (53, 6), (57, 7), (60, 8), (63, None)])


def wave_x(t):
    return WAVE_X0 + (t - SPAWN_T) * CELL_PX / T_CELL


# impact per collision: 8 frames × 2 T from the hit
def impact_frame(t, h):
    k = (t - h) // 2
    return k + 1 if 0 <= k < 8 else None


def tile(fr, s, alpha=1.0):
    img = Image.fromarray(fr['img'])
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    a = np.array(img)
    a[..., 3] = (a[..., 3].astype(float) * alpha).astype(np.uint8)
    return a, fr['px'] * s, fr['py'] * s


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
        a, px, py = tile(CHARGE[CHARGE_PLAN[t] - 1], SC['charge'])
        x, y = put(img, a, px, py, (X0, GROUND))
        if log:
            LOG.append({'T': t, 'track': 'charge', 'frame': CHARGE_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'back', 'part': 'charge'})
    for k, h in zip(TARGETS, HITS):
        hit = h <= t <= h + 6
        sx = (-3 if (t - h) % 2 else 2) if hit else 0
        img.alpha_composite(Image.fromarray(ENEMY), (int(X0 + k * CELL_PX + sx - ENEMY_ROOT[0]), GROUND - ENEMY_ROOT[1]))
    img.alpha_composite(Image.fromarray(pose(char_at(t))), (X0 - ROOT[0], GROUND - ROOT[1]))
    if t in WAVE_PLAN:
        a, px, py = tile(WAVE[WAVE_PLAN[t] - 1], SC['wave'])
        x, y = put(img, a, px, py, (X0 + wave_x(t), GROUND))
        if log:
            LOG.append({'T': t, 'track': 'wave', 'frame': WAVE_PLAN[t], 'x': x, 'y': y, 'opacity': 1, 'split': 'front', 'part': 'wave'})
    for i, (k, h) in enumerate(zip(TARGETS, HITS)):
        f = impact_frame(t, h)
        if f:
            a, px, py = tile(IMPACT[f - 1], SC['impact'])
            put(img, a, px, py, (X0 + k * CELL_PX - 6, GROUND - 32))
            if log:
                LOG.append({'T': t, 'track': 'impact', 'frame': f, 'x': 0, 'y': 0, 'opacity': 1, 'split': 'front', 'part': 'impact'})
        if h <= t <= h + 5:
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
        if t == 40:
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
KEYS = [0, 10, 20, 25, 30, 35, 38, 44, 50, 56, 62, 70]
cw, ch = 520, 200
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


wave_ts = list(range(SPAWN_T, 63, 2))     # 30 FPS strip: the travel is long, every other preview frame
game_fx = {
    'charge': bake('charge', [tile(CHARGE[CHARGE_PLAN[t] - 1], SC['charge']) for t in sorted(CHARGE_PLAN)]),
    'wave': bake('wave', [tile(WAVE[WAVE_PLAN[t] - 1], SC['wave']) for t in wave_ts], 1000 / 30,
                 [wave_x(t) - WAVE_X0 for t in wave_ts]),
    'impact': bake('impact', [tile(IMPACT[f], SC['impact']) for f in range(8) for _ in (0, 1)]),
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
game = {'steps': steps,
        'events': {'CAST_START': 0, 'CHARGE_START': step_of(CHARGE_T), 'CHARGE_PEAK': step_of(25), 'STRIKE_START': step_of(30),
                   'VFX_SPAWN': step_of(SPAWN_T), 'DAMAGE': step_of(SPAWN_T), 'RECOVERY_START': step_of(40)},
        'waveDx': round(WAVE_X0 / CELL_PX * 100, 2), 'impactDy': round(-32 / CELL_PX * 100 + 27.25, 2), 'scale': SC}

pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [X0, GROUND],
       'spearTip': [X0 + 60, GROUND - 40], 'center': [X0, GROUND - 40]} for t in range(N)]
meta = {
    'name': 'kael_ult_sync_sheet',
    'readme': ['Timeline Sync Sheet — Ultimate Ashen Rupture · Kael Ashen Vanguard', '',
               '60 FPS พรีวิว · 10 ท่า × 5 T (12 FPS ชั่วคราวตาม timeline_v2) = 50 เฟรม T000–T049 = 0.83 วินาที (คลื่นวิ่งต่อหลังจบท่า)',
               'ตัวละคร 10 ท่า + Charge VFX 8 + คลื่นดาบ (Main VFX) 8 + Impact VFX 8 เฟรม · คลื่นเดียว F8 · ดาเมจตอนคลื่นถึงแต่ละช่อง',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 520×200, พื้น y = 168) · 80 px = 1 ช่อง · ศัตรู 4 ตัวในแนว 1×4',
               'ที่มา: assets/heroes/Kael > tools/sprites/kael_ult.py > kael_ult_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า ult ใน SHEETS hero-kael.png (รวม 833 ms) · 260 % ต่อตัว ครั้งเดียว · คลื่น 10 ช่อง/วิ (ช่อง k ลงหลัง F8 (k − 0.5) / 10 วิ)',
    'title': 'Timeline Sync Sheet — Ultimate Ashen Rupture  ·  Kael Ashen Vanguard',
    'subtitle': '60 FPS · clip 50 frames (T000–T049) = 0.83 s + wave travel to T062 · one sword wave F8 · damage on collision '
                '(cell 1–4: T038 / T044 / T050 / T056)',
    'phases': [[0, 4, 'A', 'READY', [120, 130, 150], 'ตั้งท่า'],
               [5, 24, 'B', 'CHARGE / LIFT', [200, 170, 90], 'รวมพลัง F2 · ยกดาบเหนือศีรษะ'],
               [25, 34, 'C', 'ANTICIPATION / RELEASE', [230, 110, 90], 'ง้างสุด F6 · ฟันลง F7'],
               [35, 49, 'D', 'WAVE / RECOVER', [235, 130, 70], 'ปล่อยคลื่น F8 · กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [h for h in HITS if h < N],
    'events': [[0, 'CAST_START', 'F1'], [CHARGE_T, 'VFX_SPAWN ultimate_charge', 'F2 รอบตัว'], [25, 'STRONG_ANTICIPATION', 'F6'],
               [30, 'RELEASE_START', 'F7'], [SPAWN_T, 'WAVE SPAWN ultimate_main (1)', 'F8 ที่หน้าเคล'],
               [HITS[0], 'COLLISION cell 1', 'ดาเมจ + impact'], [HITS[1], 'COLLISION cell 2', 'ดาเมจ + impact'],
               [40, 'RECOVERY', 'F9'], [HITS[2], 'COLLISION cell 3', 'ดาเมจ + impact']],
    'lanes': 5,
    'tracks': [['charge', 'L2 Charge VFX (ultimate_charge)', [235, 160, 90], 'fx-kael-ult-charge (kael_ult_charge_vfx.png 8 fr)',
                'L2 · หลังตัวละคร', 'เท้าเคล', 'F2 T005 > vortex f6 T025 > เข้าดาบ > หาย T036'],
               ['wave', 'L3 Sword Wave (ultimate_main)', [255, 140, 80], 'fx-kael-ult-wave (kael_ult_main_vfx.png 8 fr, เดินทาง 4 ช่อง)',
                'L3 · หน้าตัวละคร', f'เริ่มหน้าเคล +{WAVE_X0} px · 10 ช่อง/วิ', 'F8 T035 เกิด 1 ลูก > โตขณะวิ่ง > peak ช่อง 2–3 > จางหลังช่อง 4'],
               ['impact', 'L4 Impact VFX (ultimate_impact)', [255, 200, 120], 'fx-kael-ult-impact (kael_ult_impact_vfx.png 8 fr)',
                'L4 · หน้าเป้า', 'กลางตัวเป้าที่ชน', 'ทุกครั้งที่คลื่นชน (ไม่ใช่ที่ F8)'],
               ['damage', 'L5 Damage on collision', [255, 110, 90], 'DAMAGE FRONT_LINE_4 260 % travel 10', '-', 'ทุกตัวในช่องที่คลื่นถึง',
                'ตัวละ 1 ครั้ง · T038 / T044 / T050 / T056'],
               ['events', 'L6 Gameplay Events', [200, 200, 200], 'engine', '-', '-', 'F1 cast · F2 charge · F9 recovery']],
    'trackNames': {'charge': 'Charge', 'wave': 'คลื่นดาบ', 'impact': 'Impact', 'damage': 'ดาเมจ', 'spawn': 'Spawn', 'events': 'อีเวนต์'},
    'layers': [[1, 'Charge (L2, หลัง)'], [2, 'ตัวละคร (L1)'], [3, 'คลื่นดาบ (L3)'], [4, 'Impact (L4)'], [5, 'ดาเมจ (L5)'], [6, 'อีเวนต์ (L6)']],
    'shake': {str(h): [3, 0] for h in HITS if h < N},
    'thumbs': [0, 5, 15, 25, 30, 35, 38, 44, 49],
    'thumbLabels': {0: 'READY', 5: 'CHARGE START', 15: 'LIFT SWORD', 25: 'ANTICIPATION', 30: 'RELEASE', 35: 'WAVE SPAWN',
                    38: 'HIT CELL 1', 44: 'HIT CELL 2', 49: 'RECOVERY'},
    'thumbCrop': [0, 20 * UP, W * UP, 190 * UP],
    'travelLabel': 'L1 Root X (px) — 0 (ยืนที่เดิม ไม่พุ่ง)', 'heightLabel': 'Root Y (px) — 0',
    'notes': [
        'ฟันลงครั้งเดียว ปล่อยคลื่นดาบ 1 ลูกที่ F8 — ไม่พุ่ง ไม่หลายจังหวะ · ที่ F8 ยังไม่มีดาเมจ',
        'คลื่นวิ่ง 10 ช่อง/วิ: ช่อง 1–4 ลงที่ T038 / T044 / T050 / T056 — ใครยืนในช่องตอนคลื่นถึงโดน ตัวละ 1 ครั้งต่อการร่าย',
        'Impact VFX เกิดตอนชนจริงเท่านั้น (ไม่เกิดที่ F8) · ไม่มีระเบิดซ้ำ/ดาเมจซ้ำ',
        'Charge VFX F2 อยู่หลังตัว ยอด vortex ตอนง้างสุด F6 แล้วหายตอนปล่อยคลื่น',
        '12 FPS เป็นค่าชั่วคราว · ไม่มี root motion · สั่น 3 px ทุกครั้งที่ชน',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': [x for x in LOG if x['T'] < N], 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/kael_ult_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'gameFx': game_fx, 'game': game}, indent=1, default=float))

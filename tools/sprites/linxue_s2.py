"""Lin Xue — Skill 2 Spirit Mend: VFX cut + 60 FPS preview + timeline JSON + in-game FX strips.

Inputs (art/incoming/linxue, not committed):
  s2_vfx_raw.png  the approved REVISED Main VFX, 12 painted frames in a captioned 6 × 2 grid on #FF00FF (seal form →
                  purification sweep → target lock → heal burst → Qi Guard formation → guard stabilize → residual ×2 →
                  fade ×3 → end) — the whole effect sits on the ALLY (ground ring = the ally's feet). No separate impact.
  public/sprites/hero-linxue.png row 6 (character, 10 frames from s2_char_raw.png via tools/sprites/linxue.py)

Production timeline (user spec 2026-10, 60 FPS, 63 frames T000–T062 = 1.05 s):
  A target / ready T000–T008 (select T003, lock T008) · B cast T009–T019 (character cast T010, peak T017) ·
  C VFX target lock T020–T027 (Main VFX spawns ON the ally T020, seal formed T024) · D cleanse T028–T035 (sweep T028,
  CLEANSE 1 debuff T030) · E emergency heal T036–T043 (burst T036, HEAL T038) · F Qi Guard form T044–T053 (shell
  T044, QI GUARD applied T048, stabilize T052) · G settle / recovery T054–T062 (residual + fade run on to T067 on the
  ally). Root <= 4 px · no shake / zoom.

In game: kit S2 = repeat 3 on the clip's DAMAGE events (T030 cleanse / T038 heal / T048 Qi Guard shield) ·
`lx-s2-main` = on vfx at the ally (60 FPS, 48 frames, cross-faded holds) · `lx-s2-guard` = the persistent runtime
guard after the main effect: a simplified static shell (the stabilised dome at low opacity, slow pulse) looped for the
Qi Guard's 4 s instead of keeping the whole Main VFX alive.

Usage: python3 tools/sprites/linxue_s2.py <out dir>
"""
import json
import os
import subprocess
import sys
import tempfile

import numpy as np
from PIL import Image, ImageDraw

SRC = 'art/incoming/linxue'
OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/linxue_s2'
os.makedirs(OUT, exist_ok=True)
FPS, N = 60, 63
TAIL = 72                               # the preview keeps rendering past the clip: residual fade + runtime guard
CELL_W, CELL_H, ROOT = 260, 170, (130, 155)
W, H, UP = 430, 200, 3
GROUND, X0 = 168, 70
CELL_PX = 80
BODY = 80
T1X = X0 + 150                          # the selected ally ~1.9 cells ahead of her
SHIELD_S = 4.0                          # Qi Guard duration (kit)

# ------------------------------------------------------------------ character (atlas row 6, game scale)
atlas = np.array(Image.open('public/sprites/hero-linxue.png').convert('RGBA'))
ROW = atlas[6 * CELL_H:7 * CELL_H]
CHAR = [(0, 8, 1), (9, 12, 2), (13, 16, 3), (17, 19, 4), (20, 35, 5), (36, 53, 6), (54, 56, 7), (57, 58, 8), (59, 60, 9),
        (61, 62, 10)]
POSES = {1: ('READY', 'ยืนถือไม้เท้าบัว เลือกเพื่อนที่ต้องช่วย', 'CAST_START · TARGET_SELECT T003 · TARGET_LOCK T008'),
         2: ('RAISE STAFF', 'ยกไม้เท้าขึ้น', 'CHARACTER_CAST_START T010'),
         3: ('CHANNEL', 'หลับตา รวมชี่ที่หัวไม้เท้า', ''),
         4: ('GATHER ENERGY', 'ชูไม้เท้าสูงสุด', 'ANTICIPATION_PEAK T017'),
         5: ('RELEASE', 'ชี้ไม้เท้าไปทางเพื่อน ค้างระหว่างผนึก / ชำระล้าง', 'MAIN_VFX_SPAWN_ON_TARGET T020 · CLEANSE T030'),
         6: ('FOLLOW THROUGH', 'ยื่นไม้เท้าสุด ค้างระหว่างฮีล / Qi Guard', 'EMERGENCY HEAL T038 · QI GUARD T048'),
         7: ('RECOVER START', 'ดึงไม้เท้ากลับ', 'CHARACTER_RECOVERY_START T054'),
         8: ('RECOVER', 'ถือไม้เท้าข้างตัว', ''),
         9: ('RETURN', 'กลับท่ายืน', ''),
         10: ('IDLE END', 'พร้อม', 'ANIMATION_END T062')}
SPAWN_T, SEAL_T, SWEEP_T, CLEANSE_T, BURST_T, HEAL_T, FORM_T, GUARD_T, STAB_T, REC_T = 20, 24, 28, 30, 36, 38, 44, 48, 52, 54
ROOT_KEYS = [[0, 0], [17, 0], [20, 3], [24, 4], [53, 4], [58, 1], [62, 0]]   # a lean toward the ally (<= 6 px)


def smooth(keys, t):
    for (a, va), (b, vb) in zip(keys, keys[1:]):
        if a <= t <= b:
            k = (t - a) / (b - a)
            return va + (vb - va) * k * k * (3 - 2 * k)
    return keys[-1][1]


def root_x(t):
    return smooth(ROOT_KEYS, min(t, N - 1))


def pose(c):
    return ROW[:, (c - 1) * CELL_W:c * CELL_W]


def char_at(t):
    return next((c for a, b, c in CHAR if a <= t <= b), CHAR[-1][2])


def step_of(t):
    for i, (a, b, _) in enumerate(CHAR):
        if a <= t <= b:
            return round(i + (t - a) / (b - a + 1), 3)
    return float(len(CHAR))


ALLY = np.array(Image.open('public/sprites/hero-bailong.png').convert('RGBA'))[0:CELL_H, 0:220]
ALLY_ROOT = (110, 155)


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


# panels of the captioned grid (x dividers 331 / 662 / 991 / 1320 / 1651) · pivot = the ground ring centre = ally feet
XS = [0, 331, 662, 991, 1320, 1651, 1983]
ROWS = [(70, 386, 364), (426, 724, 688)]       # (y0, y1, ring centre y)
UPPX, DOWNPX, HALF = 300, 26, 162              # common box around the pivot (source px)


def cut():
    im = unmix('s2_vfx_raw')
    out = []
    for y0, y1, ry in ROWS:
        for i in range(6):
            x0, x1 = XS[i] + 4, XS[i + 1] - 4
            cx = (XS[i] + XS[i + 1]) / 2
            box = np.zeros((UPPX + DOWNPX, 2 * HALF, 4), np.uint8)
            panel = np.zeros_like(im)
            panel[y0 + 2:y1 - 2, x0:x1] = im[y0 + 2:y1 - 2, x0:x1]
            bx0, by0 = int(round(cx - HALF)), ry - UPPX
            sx0, sy0 = max(0, bx0), max(0, by0)
            sx1, sy1 = min(im.shape[1], bx0 + 2 * HALF), min(im.shape[0], by0 + UPPX + DOWNPX)
            box[sy0 - by0:sy1 - by0, sx0 - bx0:sx1 - bx0] = panel[sy0:sy1, sx0:sx1]
            out.append(box)
    return out


MAIN = cut()                            # 12 frames, identical box, pivot (HALF, UPPX)


def width(a, thr=60):
    xs = np.nonzero((a[..., 3] > thr).any(0))[0]
    return xs.max() - xs.min() + 1


# size: the stabilised Qi Guard dome with its petals (f6) ~1.45 body wide around the ally — the seal pillar (f1) then
# rises ~1.6 body above the feet
SC = 1.45 * BODY / width(MAIN[5])


def scaled(k, alpha=1.0, s=SC):
    img = Image.fromarray(MAIN[k])
    img = img.resize((round(img.width * s), round(img.height * s)), Image.LANCZOS)
    a = np.array(img).astype(float)
    a[..., 3] *= alpha
    return a


def mix(k0, k1, w, alpha=1.0):
    """cross-fade two painted frames (same box / pivot) — premultiplied, so the glow does not dip"""
    a, b = scaled(k0), scaled(k1)
    pa, pb = a[..., :3] * a[..., 3:] / 255, b[..., :3] * b[..., 3:] / 255
    al = a[..., 3] * (1 - w) + b[..., 3] * w
    col = (pa * (1 - w) + pb * w) / np.maximum(al[..., None] / 255, 1e-3)
    out = np.zeros_like(a)
    out[..., :3] = np.clip(col, 0, 255)
    out[..., 3] = np.clip(al * alpha, 0, 255)
    return out.astype(np.uint8)


# plan: T → (frame a, frame b, blend, alpha) — every hold ends with a 2-frame cross-fade into the next painted frame
KEYS = [(20, 0), (28, 1), (32, 2), (36, 3), (44, 4), (48, 5), (54, 6), (57, 7), (60, 8), (62, 9), (64, 10), (66, 11), (68, None)]
PLAN = {}
for (t0, f), (t1, nf) in zip(KEYS, KEYS[1:]):
    for t in range(t0, t1):
        blend = 0.0
        if nf is not None and t1 - t <= 1 and t1 - t0 >= 3:
            blend = 0.5
        a = 1.0
        if t < SEAL_T:                  # the seal fades in from the spawn
            a = 0.35 + 0.65 * (t - SPAWN_T) / (SEAL_T - SPAWN_T)
        if t >= 66:
            a = [0.6, 0.3][t - 66]
        PLAN[t] = (f, nf if blend else f, blend, a)


def main_tile(t):
    f, nf, w, a = PLAN[t]
    return mix(f, nf, w, a) if w else scaled(f, a).astype(np.uint8)


# runtime guard: the stabilised dome (f6) as a quiet shell, 35–48 % opacity breathing over 0.5 s, from T058 (as the
# main dome fades into its residual) for the rest of the Qi Guard
GUARD_T0 = 58
GUARD_LOOP = 30


def guard_tile(k):
    a = 0.35 + 0.13 * (0.5 - 0.5 * np.cos(2 * np.pi * k / GUARD_LOOP))
    return scaled(5, a, SC * 0.96).astype(np.uint8)


def ally_and_bg(t):
    a = np.zeros((H, W, 4), np.uint8)
    yy = np.arange(H)[:, None]
    sky = np.clip(yy / GROUND, 0, 1)
    a[..., 0], a[..., 1], a[..., 2] = (20 + 18 * sky), (18 + 20 * sky), (34 + 26 * sky)
    g = yy >= GROUND
    a[..., 0] = np.where(g, 40, a[..., 0])
    a[..., 1] = np.where(g, 54, a[..., 1])
    a[..., 2] = np.where(g, 46, a[..., 2])
    a[GROUND, :, :3] = (62, 86, 64)
    for k in range(-3, 4):
        x = int(T1X - CELL_PX / 2 + k * CELL_PX)
        if 0 <= x < W:
            a[GROUND + 1:GROUND + 8, x, :3] = (80, 104, 82)
    a[..., 3] = 255
    img = Image.fromarray(a)
    dr = ImageDraw.Draw(img)
    # L2 selected ally (preview only): scan T003–T007, lock ring from T008
    if 3 <= t <= 53:
        c = (150, 255, 200) if t >= 8 else (120, 170, 150)
        w = 26 if t >= 8 else 18 + 2 * (t - 3)
        dr.ellipse([T1X - w, GROUND - 5, T1X + w, GROUND + 5], outline=c, width=1)
    img.alpha_composite(Image.fromarray(ALLY), (T1X - ALLY_ROOT[0], GROUND - ALLY_ROOT[1]))
    # the ally's debuff (purple wisp over the head) until the cleanse
    if t < CLEANSE_T:
        dr = ImageDraw.Draw(img)
        dr.ellipse([T1X - 4, GROUND - 98, T1X + 4, GROUND - 90], fill=(150, 70, 200, 255), outline=(220, 160, 255, 255))
    return img


def put(img, a, at, px, py):
    x, y = round(at[0] - px), round(at[1] - py)
    img.alpha_composite(Image.fromarray(a), (max(0, x), max(0, y)), (max(0, -x), max(0, -y)))
    return x, y


LOG = []


def ev(t, track, frame, op=1.0):
    LOG.append({'T': t, 'track': track, 'frame': frame, 'x': 0, 'y': 0, 'opacity': op, 'split': '-'})


def frame(t):
    img = ally_and_bg(t)
    log = t < N
    if t >= GUARD_T0:
        g = guard_tile((t - GUARD_T0) % GUARD_LOOP)
        x, y = put(img, g, (T1X, GROUND), HALF * SC * 0.96, UPPX * SC * 0.96)
        if log:
            LOG.append({'T': t, 'track': 'guard', 'frame': 1, 'x': x, 'y': y, 'opacity': 0.4, 'split': 'front', 'part': 'guard'})
    c = char_at(min(t, N - 1))
    img.alpha_composite(Image.fromarray(pose(c)), (round(X0 + root_x(t)) - ROOT[0], GROUND - ROOT[1]))
    if t in PLAN:
        f, nf, w, a = PLAN[t]
        x, y = put(img, main_tile(t), (T1X, GROUND), HALF * SC, UPPX * SC)
        if log:
            LOG.append({'T': t, 'track': 'main', 'frame': f + 1, 'x': x, 'y': y, 'opacity': round(a, 2), 'split': 'front', 'part': 'main'})
    if log:
        if 3 <= t <= 7:
            ev(t, 'ally', 1, 0.6)
        if 8 <= t <= 53:
            ev(t, 'ally', 2, 1.0 if t == 8 else 0.5)
        for h, track in [(CLEANSE_T, 'cleanse'), (HEAL_T, 'heal')]:
            if h <= t <= h + 1:
                ev(t, track, 1, 1.0 if t == h else 0.5)
        if GUARD_T <= t <= GUARD_T + 1:
            ev(t, 'qiguard', 1, 1.0 if t == GUARD_T else 0.5)
        if t >= GUARD_T:
            ev(t, 'duration', 1, 0.45)
        if t >= REC_T:
            ev(t, 'recovery', 1, 0.6)
    return img.resize((W * UP, H * UP), Image.NEAREST).convert('RGB')


frames = [frame(t) for t in range(TAIL)]
tmp = tempfile.mkdtemp()
for i, f in enumerate(frames):
    f.save(f'{tmp}/f{i:03d}.png')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                '-crf', '14', f'{OUT}/linxue_s2_preview_60fps.mp4'], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '60', '-i', f'{tmp}/f%03d.png', '-vf',
                'fps=30,scale=645:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=200[p];[b][p]paletteuse=dither=bayer',
                '-loop', '0', f'{OUT}/linxue_s2_preview_30fps.gif'], check=True)
CK = [0, 8, 17, 20, 24, 28, 30, 33, 36, 38, 44, 48, 52, 54, 62, 70]
cw, ch = 430, 200
sheet = Image.new('RGB', (cw * 4, ch * 4))
dr = ImageDraw.Draw(sheet)
for i, t in enumerate(CK):
    sheet.paste(frames[t].resize((cw, ch), Image.NEAREST), ((i % 4) * cw, (i // 4) * ch))
    dr.text(((i % 4) * cw + 6, (i // 4) * ch + 4), f'T{t:03d} C{char_at(min(t, N - 1)):02d}', fill=(255, 255, 255))
sheet.save(f'{OUT}/linxue_s2_preview_contact.png')


# ------------------------------------------------------------------ in-game strips (60 FPS)
def bake(name, tiles, px, py, frame_ms=1000 / 60):
    h, w = tiles[0].shape[:2]
    out = Image.new('RGBA', (w * len(tiles), h), (0, 0, 0, 0))
    for k, a in enumerate(tiles):
        out.alpha_composite(Image.fromarray(a), (k * w, 0))
    out.save(f'public/sprites/fx-linxue-s2-{name}.png', optimize=True)
    return {'frames': len(tiles), 'w': w, 'h': h, 'frameMs': round(frame_ms, 2), 'pivot': [round(px / w, 4), round(py / h, 4)]}


main_tiles = [main_tile(t) for t in sorted(PLAN)]
guard_tiles = [guard_tile(k) for k in range(GUARD_LOOP)]
guard_loops = int((SHIELD_S - (GUARD_T0 - GUARD_T) / FPS) // (GUARD_LOOP / FPS))
game_fx = {
    'main': {**bake('main', main_tiles, HALF * SC, UPPX * SC), 'dy': 27.25},
    'guard': {**bake('guard', guard_tiles, HALF * SC * 0.96, UPPX * SC * 0.96), 'dy': 27.25,
              'delayMs': round((GUARD_T0 - GUARD_T) * 1000 / FPS), 'repeat': guard_loops, 'fadeOutMs': 300},
}
steps = [round((b - a + 1) * 1000 / FPS) for a, b, _ in CHAR]
steps[-1] += round(N * 1000 / FPS) - sum(steps)
sx = lambda t: step_of(t) if t < N - 1 else float(len(CHAR))
game = {'steps': steps,
        'events': {'CAST_START': 0, 'STRIKE_START': step_of(10), 'ANTICIPATION_PEAK': step_of(17), 'SKILL_ACTIVATE': step_of(SPAWN_T),
                   'VFX_SPAWN': step_of(SPAWN_T), 'DAMAGE': [step_of(CLEANSE_T), step_of(HEAL_T), step_of(GUARD_T)],
                   'RECOVERY_START': step_of(REC_T)},
        'root': [[sx(t), round(root_x(t), 1), 0] for t in sorted({k[0] for k in ROOT_KEYS} | set(range(0, N, 6)) | {N - 1})]}

# ------------------------------------------------------------------ timeline JSON (+ sync-sheet meta)
pf = [{'T': t, 'char': f'C{char_at(t):02d}', 'drawnFrame': char_at(t), 'root': [round(X0 + root_x(t), 1), GROUND],
       'spearTip': [X0 + 40, GROUND - 60], 'center': [X0, GROUND - BODY / 2]} for t in range(N)]
meta = {
    'name': 'linxue_s2_sync_sheet',
    'readme': ['Timeline Sync Sheet — Skill 2 Spirit Mend · Lin Xue (production)', '',
               '60 FPS, 63 เฟรม (T000–T062) = 1.05 วินาที · ตัวละคร 10 ท่า + Main VFX 12 เฟรม (บนตัวเพื่อน) · ไม่มี Impact VFX แยก',
               'Frames = ทุกเฟรม · Character = ท่า C01–C10 + ความยาวในเกม · VFX Tracks / Events / Layers',
               'หน่วย: px = พิกเซลของแผ่นเกม (canvas 430×200, พื้น y = 168) · 80 px = 1 ช่อง · เพื่อนที่ถูกช่วยห่าง ~1.9 ช่อง',
               'ที่มา: tools/sprites/linxue_s2.py > linxue_s2_timeline.json > tools/sprites/ult_sync_sheet.py'],
    'gameNote': 'Game ms = steps ของท่า skill2 ใน SHEETS hero-linxue.png (รวม 1050 ms) · ชำระล้าง T030 / ฮีล T038 / Qi Guard T048 = repeat 3 ของ kit',
    'title': 'Timeline Sync Sheet — Skill 2 Spirit Mend  ·  Lin Xue · Lotus Spirit Physician',
    'subtitle': '60 FPS · 63 frames (T000–T062) = 1.05 s · 1 column = 1 frame (16.7 ms) · cleanse T030 · emergency heal T038 · Qi Guard T048 · no impact VFX',
    'phases': [[0, 8, 'A', 'TARGET / READY', [120, 130, 150], 'เลือกเป้า'],
               [9, 19, 'B', 'CAST', [150, 120, 170], 'ร่าย'],
               [20, 27, 'C', 'VFX TARGET LOCK', [110, 150, 210], 'ผนึกเกิดบนเพื่อน'],
               [28, 35, 'D', 'CLEANSE', [170, 120, 220], 'ชำระล้าง'],
               [36, 43, 'E', 'EMERGENCY HEAL', [230, 190, 110], 'ฮีลฉุกเฉิน'],
               [44, 53, 'F', 'QI GUARD FORM', [110, 200, 210], 'Qi Guard'],
               [54, 62, 'G', 'SETTLE / RECOVERY', [90, 170, 120], 'กลับท่า']],
    'poses': {c: [f'F{c}', f'{v[0]} — {v[1]}', v[2]] for c, v in POSES.items()},
    'gameSteps': steps,
    'hits': [CLEANSE_T, HEAL_T, GUARD_T],
    'events': [[0, 'CAST_START', 'C01'], [3, 'TARGET_SELECT', 'เพื่อนที่ต้องช่วย'], [8, 'TARGET_LOCK', ''],
               [10, 'CHARACTER_CAST_START', 'C02'], [17, 'ANTICIPATION_PEAK', 'C04'],
               [20, 'MAIN_VFX_SPAWN_ON_TARGET', 'f1 บนเพื่อน'], [24, 'SEAL_FORM', 'f1 เต็ม'],
               [28, 'PURIFICATION_SWEEP', 'f2'], [30, 'CLEANSE_1_DEBUFF', 'ลบ 1 ดีบัฟ'], [36, 'HEAL_BURST_PHASE', 'f4'],
               [38, 'EMERGENCY_HEAL_APPLY', '220 % ATK + 10 %'], [44, 'QI_GUARD_FORM_START', 'f5'],
               [48, 'QI_GUARD_APPLY', 'โล่ 12 % · 4 วิ'], [52, 'GUARD_STABILIZE', 'f6'],
               [54, 'CHARACTER_RECOVERY_START', 'C07'], [62, 'ANIMATION_END', 'C10']],
    'lanes': 7,
    'tracks': [['ally', 'L2 Selected Ally', [150, 230, 200], 'LOWEST_HP_ALLY (ฉุกเฉิน)', 'พื้น', 'ใต้เท้าเพื่อน',
                'T003 เลือก · T008 ล็อก'],
               ['main', 'L3 Skill 2 Main VFX', [190, 170, 255], 'fx-linxue-s2-main (s2 Main VFX revised, 12 fr)', 'L3 · หน้า',
                'วงพื้น = เท้าเพื่อน', 'T020 ผนึก > T028 ริบบิ้นชำระ > T032 ล็อก > T036 แสงฮีล > T044 โดม > T048 คงตัว > T054 เศษ > จาง T067'],
               ['cleanse', 'L4 Cleanse Event', [200, 140, 255], 'engine CLEANSE PRIMARY ×1', '-', '-', 'T030 ลบดีบัฟ 1 (ใหม่สุด) ก่อนแสงฮีล'],
               ['heal', 'L5 Emergency Heal Event', [120, 230, 160], 'engine HEAL PRIMARY', '-', '-', 'T038 ฮีลเดี่ยวแรงสุดของสกิลปกติ'],
               ['qiguard', 'L6 Qi Guard Buff', [120, 220, 230], 'engine SHIELD to PRIMARY', '-', '-', 'T048 โล่ 12 % maxHP ผู้ร่าย'],
               ['guard', 'L7 Guard Duration', [150, 220, 240], 'fx-linxue-s2-guard (เปลือกโดมเรียบ 35–48 %)', 'L7 · หน้า',
                'เท้าเพื่อน', 'T048–T288 (4 วิ) · ภาพเปลือกเริ่ม T058 วนชีพจร 0.5 วิ'],
               ['duration', 'L7 Guard Duration (buff)', [100, 160, 190], 'SHIELD duration 4 s', '-', '-', 'จาก T048 ต่อเนื่องหลังจบท่า'],
               ['recovery', 'L8 Recovery', [90, 170, 120], 'ท่า C07–C10', '-', '-', 'T054 > T062']],
    'trackNames': {'ally': 'เพื่อนที่เลือก', 'main': 'Main VFX', 'cleanse': 'ชำระล้าง', 'heal': 'ฮีลฉุกเฉิน', 'qiguard': 'Qi Guard',
                   'guard': 'เปลือก Guard', 'duration': 'ระยะโล่', 'recovery': 'กลับท่า'},
    'layers': [[1, 'ตัวละคร (L1)'], [2, 'เพื่อนที่เลือก (L2)'], [3, 'Main VFX (L3)'], [4, 'ชำระล้าง (L4)'], [5, 'ฮีลฉุกเฉิน (L5)'],
               [6, 'Qi Guard (L6)'], [7, 'ระยะ Guard (L7)'], [8, 'กลับท่า (L8)']],
    'shake': {},
    'thumbs': [0, 8, 17, 24, 30, 38, 48, 54, 62],
    'thumbLabels': {0: 'READY', 8: 'LOCK', 17: 'CAST PEAK', 24: 'SEAL', 30: 'CLEANSE', 38: 'HEAL', 48: 'QI GUARD', 54: 'RECOVERY',
                    62: 'END'},
    'thumbCrop': [20 * UP, 25 * UP, 425 * UP, 185 * UP],
    'travelLabel': 'L1 Root X (px) — ไม่เกิน 6 px (ใช้ 4) เอนเข้าหาเพื่อน', 'heightLabel': 'Y movement (px)',
    'notes': [
        'Main VFX ทั้งชุดเกิดบนตัวเพื่อนที่เลือก (วงพื้น = เท้าเพื่อน) ไม่มีวงรอบตัวหลินเสวี่ย ไม่มี Impact VFX แยก',
        'ลำดับ: ผนึก T024 > ริบบิ้นชำระผ่านตัว T028 > ลบดีบัฟ 1 T030 (ก่อนแสงฮีล) > แสงฮีลแรงสุด T036 > ฮีลฉุกเฉิน T038',
        'Qi Guard: เปลือกโดมก่อตัว T044 > ใส่โล่ T048 > คงตัว T052 · หลังจบ Main VFX ใช้เปลือกโดมเรียบโปร่ง (ไม่เล่นภาพเต็มค้างไว้) จนหมด 4 วิ',
        'ในเกม: repeat 3 ตาม DAMAGE ของท่า — CLEANSE / HEAL / SHIELD คนละจังหวะ · เพื่อนตายก่อน = จังหวะที่เหลือไม่ลง',
        'Root ไม่เกิน 6 px (ใช้ 4) · ไม่สั่นกล้อง · ไม่ซูม (ตัวเลือก 1–2 % ตอนแสงฮีล — ไม่ได้ใส่)',
        'Main VFX ภาพวาด: alpha / สีแยกจากพื้น magenta, cross-fade 1 เฟรมระหว่างภาพ, แผ่นในเกม 60 FPS',
    ],
}
json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
           'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in CHAR],
           'rootTracks': {'travel': ROOT_KEYS, 'height': [[0, 0], [N - 1, 0]]},
           'perFrame': pf, 'vfx': LOG, 'sheet': meta, 'gameFx': game_fx, 'game': game},
          open(f'{OUT}/linxue_s2_timeline.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps({'scale': SC, 'gameFx': game_fx, 'game': game}, indent=1, default=float))

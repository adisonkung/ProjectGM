"""Mordrienne Vale — S1 Ashen Mark: Timeline Sync preview + sheet (user 2026-10-26).

python3 tools/sprites/mordrienne_s1_sync.py <out dir>
Renders the GAME assets (hero-mordrienne.png row 5 with the in-game steps, fx-mordrienne-s1-{charge,bolt,mark-in,mark})
at game scale (1 atlas px = 1 px, 80 px = 1 cell) on a 60 FPS clock, with the engine's hero projectile flight rule
(0.1 + 0.06 × cells) to a goblin 4 cells ahead → <out>/mordrienne_s1_preview_60fps.mp4 + mordrienne_s1_timeline.json
(with the `sheet` block) → then run: python3 tools/sprites/ult_sync_sheet.py <json> <mp4> <out>
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from mordrienne_s1_vfx import RES, STEPS, RELEASE, TIP  # noqa: E402

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/mordrienne-s1-sync')
OUT.mkdir(parents=True, exist_ok=True)
FPS, N, UP = 60, 96, 3
W, H, GROUND = 520, 190, 160
HERO_X, CELLS = 110, 4
TARGET_X = HERO_X + CELLS * 80
SP = 'public/sprites/'
ATLAS = Image.open(SP + 'hero-mordrienne.png').convert('RGBA')
GOB = Image.open(SP + 'enemy-goblin-fighter.png').convert('RGBA')
CH = Image.open(SP + 'fx-mordrienne-s1-charge.png').convert('RGBA')
BOLT = Image.open(SP + 'fx-mordrienne-s1-bolt.png').convert('RGBA')
MIN = Image.open(SP + 'fx-mordrienne-s1-mark-in.png').convert('RGBA')
MLOOP = Image.open(SP + 'fx-mordrienne-s1-mark.png').convert('RGBA')
BG = Image.open('public/backgrounds/forest-1.webp').convert('RGBA')

CAST = sum(STEPS[:1]) / 1000            # 0.05 CAST_START (charge spawn)
REL = sum(STEPS[:RELEASE]) / 1000       # 0.30 release
FLIGHT = 0.1 + 0.06 * CELLS             # engine hero projectile flight
HIT = REL + FLIGHT                      # 0.64 damage + Hex Mark
REC = sum(STEPS[:11]) / 1000            # 0.71 recovery
END = sum(STEPS) / 1000                 # 1.11 idle
T = lambda s: int(round(s * FPS))       # noqa: E731


def frames_of(img, n):
    w = img.width // n
    return [img.crop((k * w, 0, k * w + w, img.height)) for k in range(n)]


CHF, BOLTF, MINF, MLF = frames_of(CH, 13), frames_of(BOLT, 7), frames_of(MIN, 9), frames_of(MLOOP, 4)
half = lambda im: im.resize((max(1, im.width // RES), max(1, im.height // RES)), Image.NEAREST)  # noqa: E731


def clip_frame(t):
    ms, acc = t * 1000, 0
    for i, s in enumerate(STEPS):
        if ms < acc + s:
            return i
        acc += s
    return None  # back to idle


def put(canvas, im, x, y):
    canvas.alpha_composite(im, (int(round(x)), int(round(y))))


def render(t):
    bg = BG.resize((int(BG.width * 300 / BG.height), 300)).crop((200, 110, 200 + W, 110 + H))
    c = bg.copy()
    # goblin target (faces left), feet on the ground
    g = GOB.crop((0, 0, 132, 100)).transpose(Image.FLIP_LEFT_RIGHT)
    put(c, g, TARGET_X - 66, GROUND - 86)
    k = clip_frame(t)
    hero = ATLAS.crop((k * 260, 5 * 170, k * 260 + 260, 6 * 170)) if k is not None else ATLAS.crop((0, 0, 260, 170))
    put(c, hero, HERO_X - 130, GROUND - 155)
    log = []
    # CastCharge: on cast + 50 ms, 25 ms frames, pivot = feet
    ci = int((t - CAST) * 1000 // 25)
    if t >= CAST and 0 <= ci < 13:
        f = half(CHF[ci])
        put(c, f, HERO_X - 0.0269 * CH.width / 13 / RES, GROUND - 0.9956 * CH.height / RES)
        log.append(('charge', ci + 1))
    # Hex Bolt: from the muzzle (release tip) to the target's cell centre (42 % height), tip leading
    sx, sy = HERO_X + TIP[RELEASE][0] - 130, GROUND + TIP[RELEASE][1] - 155
    tx, ty = TARGET_X, GROUND - (0.7725 - 0.42) * 80
    if REL <= t < HIT:
        p = (t - REL) / FLIGHT
        fi = min(5, int(p * 6))
        f = half(BOLTF[fi])
        ang = np.degrees(np.arctan2(ty - sy, tx - sx))
        f = f.rotate(-ang, resample=Image.NEAREST, expand=True)
        x, y = sx + (tx - sx) * p, sy + (ty - sy) * p
        put(c, f, x - f.width / 2, y - f.height / 2)
        log.append(('bolt', fi + 1))
    elif HIT <= t < HIT + 0.14:
        f = half(BOLTF[6])
        put(c, f, tx - f.width / 2, ty - f.height / 2)
        log.append(('bolt', 7))
    # Hex Mark on the target's upper body (dy −10.25 % from the cell centre = 30 px above the feet)
    my = GROUND - (0.7725 - 0.5 + 0.1025) * 80
    if t >= HIT:
        dt = t - HIT
        if dt < 9 * 0.04:
            f, n = half(MINF[int(dt / 0.04)]), ('mark-in', int(dt / 0.04) + 1)
        else:
            li = int((dt - 0.36) / 0.1) % 4
            f, n = half(MLF[li]), ('mark', li + 1)
        put(c, f, TARGET_X - f.width / 2, my - f.height / 2)
        log.append(n)
    return c, k, log


def main():
    vid = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s',
                            f'{W * UP}x{H * UP}', '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
                            '-crf', '16', str(OUT / 'mordrienne_s1_preview_60fps.mp4')], stdin=subprocess.PIPE)
    per, vfx, chars = [], [], []
    for i in range(N):
        t = i / FPS
        img, k, log = render(t)
        big = img.resize((W * UP, H * UP), Image.NEAREST)
        d = ImageDraw.Draw(big)
        d.text((10, 8), f'T{i:03d}  {t:.3f}s', fill='white')
        vid.stdin.write(big.tobytes())
        cf = (k if k is not None else -1) + 1
        per.append({'T': i, 'char': f'C{max(cf, 1):02d}', 'drawnFrame': cf, 'root': [HERO_X, GROUND],
                    'spearTip': [HERO_X + TIP[min(max(cf - 1, 0), RELEASE)][0] - 130, GROUND + TIP[min(max(cf - 1, 0), RELEASE)][1] - 155],
                    'center': [HERO_X, GROUND - 40]})
        chars.append(max(cf, 1) if k is not None else 18)
        for track, fr in log:
            vfx.append({'T': i, 'track': {'mark-in': 'mark'}.get(track, track), 'frame': fr, 'opacity': 1.0, 'layer': 'front', 'split': 'over'})
    vid.stdin.close()
    vid.wait()
    runs, a = [], 0
    for i in range(1, N + 1):
        if i == N or chars[i] != chars[a]:
            runs.append((a, i - 1, chars[a]))
            a = i
    poses = {c: [f'S1 clip {c - 1}' if c < 18 else 'idle', d, k] for c, d, k in [
        (1, 'ท่าพร้อม (idle → เล็ง)', 'T000 idle'), (2, 'เริ่มเล็งไม้กายสิทธิ์', 'CAST_START · CastCharge เกิดที่ปลายไม้'),
        (3, 'เล็ง', 'charge โต'), (4, 'เล็ง', ''), (5, 'ยกไม้ขึ้น', 'charge ตามปลายไม้'), (6, 'ยกไม้สุด', 'ANTICIPATION_PEAK'),
        (7, 'แทงไม้ไปหน้า = wand release', 'DAMAGE · Hex Bolt ออกจากปลายไม้ · charge ยุบ'), (8, 'ค้างท่าชี้', ''),
        (9, 'ค้างท่าชี้', ''), (10, 'ค้างท่าชี้', ''), (11, 'ค้างท่าชี้', ''), (12, 'ดึงไม้กลับ', 'RECOVERY_START'),
        (13, 'ดึงกลับ', ''), (14, 'ดึงกลับ', ''), (15, 'ดึงกลับ', ''), (16, 'กลับท่ายืน', ''), (17, 'กลับท่ายืน', 'ท่าจบ'),
        (18, 'idle', 'ต่อ idle')]}
    ev = [[0, 'IDLE', 'C01'], [T(CAST), 'CAST_START', 'C02 · CastCharge spawn @ wand tip'],
          [T(0.185), 'WAND_RAISE', 'C05'], [T(0.24), 'ANTICIPATION_PEAK', 'C06'],
          [T(REL), 'HEX_BOLT_RELEASE', 'C07 · charge collapse · bolt spawn @ muzzle'],
          [T(HIT), 'DAMAGE (magic)', f'flight {FLIGHT:.2f}s @ {CELLS} cells'], [T(HIT), 'APPLY_HEX_MARK', 'status 8 s'],
          [T(HIT), 'HEX_MARK_VFX', 'appear > loop'], [T(REC), 'RECOVERY_START', 'C12'], [T(END), 'IDLE', 'clip end']]
    meta = {
        'name': 'mordrienne_s1_sync_sheet',
        'readme': ['Timeline Sync Sheet — Skill 1 Ashen Mark · Mordrienne Vale', '',
                   f'60 FPS · {N} frames · clip {END:.2f} s · release {REL:.2f} s · hit {HIT:.2f} s (target {CELLS} cells)',
                   'หน่วย: px = พิกเซลแผ่นเกม · 80 px = 1 ช่อง', 'ที่มา: tools/sprites/mordrienne_s1_sync.py > ult_sync_sheet.py'],
        'gameNote': 'Game ms = steps ของท่า skill ใน SHEETS hero-mordrienne.png · DAMAGE event = ปล่อยกระสุน · ดาเมจ + Hex Mark ลงตอนกระสุนถึง',
        'title': 'Timeline Sync Sheet — Skill 1 Ashen Mark  ·  Mordrienne Vale',
        'subtitle': f'60 FPS · 1 column = 1 frame (16.7 ms) · release T{T(REL):03d} · hit T{T(HIT):03d} ({CELLS} cells) · '
                    'Deep Emerald Curse + Black Ash + Broken Hex',
        'phases': [[0, T(CAST) - 1, 'A', 'IDLE', [120, 130, 150], 'ยืน'],
                   [T(CAST), T(REL) - 1, 'B', 'AIM + CAST CHARGE', [60, 170, 110], 'เล็ง + ชาร์จที่ปลายไม้'],
                   [T(REL), T(HIT) - 1, 'C', 'RELEASE + FLIGHT', [90, 200, 140], 'ปล่อย Hex Bolt'],
                   [T(HIT), T(REC) - 1, 'D', 'HIT + HEX MARK', [40, 140, 90], 'ดาเมจ + ตราสาป'],
                   [T(REC), N - 1, 'E', 'RECOVERY → IDLE', [110, 120, 130], 'กลับท่ายืน (ตรายังอยู่บนเป้า)']],
        'poses': {str(c): v for c, v in poses.items()},
        'gameSteps': STEPS,
        'hits': [T(HIT)],
        'events': ev,
        'lanes': 4,
        'tracks': [['charge', 'L2 CastCharge (wand tip)', [70, 200, 120], 'fx-mordrienne-s1-charge (13 × 25 ms)', 'over',
                    'ปลายไม้ตามท่า (baked)', 'T003 เกิด > โต f1–f5 > T018 ยุบ f6–f8'],
                   ['bolt', 'L3 Hex Bolt (projectile)', [40, 230, 140], 'fx-mordrienne-s1-bolt (6 flight + impact)', 'over',
                    'muzzle = ปลายไม้ท่าปล่อย', 'บินตรงเข้าเป้า หันตามทิศ · เฟรมสุดท้าย = เศษรูนแตกที่เป้า'],
                   ['mark', 'L4 Hex Mark (status)', [30, 160, 90], 'fx-mordrienne-s1-mark-in (9) + mark loop (4)', 'over',
                    'ช่วงอกของเป้า', 'ขึ้นตอนกระสุนถึง · burst f5 > ลูปหายใจ จนสถานะหมด (8 วิ)'],
                   ['events', 'L5 Gameplay Events', [200, 200, 200], 'engine', '-', '-', 'DAMAGE = release · ดาเมจ/ตราลงตอนถึง']],
        'trackNames': {'charge': 'CastCharge', 'bolt': 'Hex Bolt', 'mark': 'Hex Mark', 'events': 'อีเวนต์'},
        'layers': [[1, 'ตัวละคร (L1)'], [2, 'CastCharge (L2)'], [3, 'Hex Bolt (L3)'], [4, 'Hex Mark (L4)'], [5, 'อีเวนต์ (L5)']],
        'shake': {},
        'thumbs': [0, T(CAST) + 2, T(0.24), T(REL), T(REL) + 6, T(HIT), T(REC), T(HIT) + 12, T(END), N - 1],
        'thumbLabels': {0: 'IDLE', T(CAST) + 2: 'AIM + CHARGE', T(0.24): 'RAISE', T(REL): 'RELEASE', T(REL) + 6: 'FLIGHT',
                        T(HIT): 'HIT', T(REC): 'RECOVERY', T(HIT) + 12: 'HEX MARK', T(END): 'IDLE', N - 1: 'MARK LOOP'},
        'thumbCrop': [40 * UP, 20 * UP, 500 * UP, 180 * UP],
        'travelLabel': 'L1 Root X (px) — 0 (ยืนที่เดิม)', 'heightLabel': 'Root Y (px) — 0',
        'notes': ['ไม่ได้วาดตัวละคร/VFX ใหม่ — จัดจังหวะ ตำแหน่งเกิด กระสุน ดาเมจ ตรา และการกลับท่าเท่านั้น',
                  'เฟรมประกายทองที่อบในแผ่น S1 (F14–F16) ไม่ใช้ — แทนด้วย VFX Deep Emerald ของสกิลนี้',
                  'CastCharge อบตามตำแหน่งปลายไม้ทุกเฟรมของท่า (เล็ง > ยก > แทง) เล็กและรวมศูนย์ ไม่คลุมตัวละคร · ไม่เล่นซ้ำหลังปล่อย',
                  'Hex Bolt ออกจากปลายไม้ (muzzle) บินเส้นตรงเข้าเป้า หันตามทิศบิน ไม่ยืด/บิดภาพ · เวลาบิน = กฎเอนจิน 0.1 + 0.06 × ช่อง',
                  'ตอนถึงเป้า: ดาเมจเวท + สถานะ Hex Mark (8 วิ, สกิลของเธอแรงขึ้น ×1.2 ใส่ตัวที่ติด) + ภาพตราที่อกเป้า วนจนสถานะหมด',
                  'pixel art: VFX ทุกชั้นวาดแบบ pixelated (nearest) ไม่มี blur/AA ตอนแสดงผล']}
    json.dump({'fps': FPS, 'frames': N, 'canvas': [W, H], 'upscale': UP, 'ground': GROUND,
               'characterTiming': [{'from': a, 'to': b, 'char': f'C{c:02d}', 'drawnFrame': c} for a, b, c in runs],
               'rootTracks': {'travel': [[0, 0], [N - 1, 0]], 'height': [[0, 0], [N - 1, 0]]},
               'perFrame': per, 'vfx': vfx, 'sheet': meta},
              open(OUT / 'mordrienne_s1_timeline.json', 'w'), indent=1, ensure_ascii=False)
    print({'release': REL, 'hit': HIT, 'recovery': REC, 'end': END, 'T': [T(REL), T(HIT), T(REC), T(END)]})


if __name__ == '__main__':
    main()

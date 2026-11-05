"""Forest Arc monster art (user ZIPs monster1–4, 2026-11-05) → game sheets + FX strips.

    python3 tools/sprites/forest_arc/art.py [--only id,id] [--preview DIR]

Sources (user files, tracked, never edited): assets/monsters/forest-arc/monster{1..4}/
  PixelLab sheets = 256 px cells (768 × 768 = 3 × 3, 1024 × 1024 = 4 × 4, 1280 × 1024 = 5 × 4, 768 × 512 = 3 × 2),
  1254 px sheets = 3 × 3 cells of 418, 1536 × 1024 = 3 × 2 cells of 512. All characters face LEFT.
  VFX sheets 1774 × 887 = N × 2 cells (N detected from the gutters).

Per clip: cells → hard alpha (≥ 128) → scale to the monster's target height (measured on the clip's first frame, a standing
pose) → feet registration (first frame's feet centre on the cell centre; every frame keeps its offset inside the clip) →
ground lock (a frame sunk below the first frame's ground is lifted back; a frame ≤ 4 src px above it is snapped down; higher =
airborne, kept) → frame order from `SEQ` (loop fixes: duplicate last frame dropped / ping-pong) → mirrored to face right
(the game flips enemies) → one sheet per monster in the monster row order (idle, move, hurt, death, attack, skills…).
Writes public/sprites/enemy-fa-<id>.png, public/sprites/fx-fa-<name>.png and
src/app/core/data/forest-arc-art.generated.ts (AnimationConfig per monster + FxDef per VFX strip).
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / 'assets/monsters/forest-arc'
OUT = ROOT / 'public/sprites'
TS = ROOT / 'src/app/core/data/forest-arc-art.generated.ts'
REPORT = Path(__file__).parent / 'report.json'

CH_MARGIN = 14          # lowest foot row = cellH − 1 − 14 (same bottom margin as every monster sheet)
SNAP = 4                # src px: a frame this close above the clip ground is snapped onto it


# ------------------------------------------------------------------ config
# clip: (file, cell px or None = auto, seq, frameMs, events {EVENT: 1-based frame in the BAKED sequence}, opts)
def C(file, seq=None, ms=100, ev=None, **o):
    return dict(file=file, seq=seq, ms=ms, ev=ev or {}, **o)


MONSTERS = {
    'forest_goblin': dict(windup=0.255, dir='monster1', target=51, clips=dict(
        idle=C('goblin_idle.png', 'pingpong', 150),
        move=C('goblin_walk.png', None, 100),
        hurt=C('goblin_hurt.png', None, 60),
        death=C('goblin_death.png', None, 80),
        attack=C('goblin_attack.png', None, 60, {'DAMAGE': 'auto'}),
    )),
    'goblin_archer': dict(windup=0.34, dir='monster1', target=51, clips=dict(
        idle=C('goblin_archer_idle.png', 'pingpong', 150),
        move=C('goblin_archer_walk.png', None, 90),
        hurt=C('goblin_archer_hurt.png', None, 60),
        death=C('goblin_archer_death.png', None, 80),
        attack=C('goblin_archer_attack.png', None, 60, {'PROJECTILE_SPAWN': 'auto'}),
    )),
    'mist_bat': dict(windup=0.25, dir='monster1', target=72, measure='width', airborne=True, hover=22, clips=dict(
        idle=C('mist_bat_idle.png', None, 90),
        move=C('mist_bat_fly.png', None, 80),
        hurt=C('mist_bat_hurt.png', None, 60),
        death=C('mist_bat_death.png', None, 80),
        attack=C('mist_bat_attack.png', None, 60, {'DAMAGE': 'auto'}),
    )),
    'forest_wolf': dict(windup=0.255, dir='monster4', target=48, clips=dict(
        idle=C('forest_wolf_idle.png', 'pingpong', 140),
        move=C('forest_wolf_walk.png', None, 70),
        hurt=C('forest_wolf_hurt.png', None, 60),
        death=C('forest_wolf_death.png', None, 75),
        attack=C('forest_wolf_attack.png', None, 55, {'DAMAGE': 'auto'}),
    )),
    'alpha_wolf': dict(windup=0.255, dir='monster4', target=58, clips=dict(
        idle=C('alpha_wolf_idle.png', 'pingpong', 140),
        move=C('alpha_wolf_walk.png', None, 70),
        hurt=C('alpha_wolf_hurt.png', None, 60),
        death=C('alpha_wolf_death.png', None, 75),
        attack=C('pixellab-Create-a-fast-5-frame-ATTACK-a-1793804933508.png', None, 55, {'DAMAGE': 'auto'}),
        howl=C('alpha_wolf_howling.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
        claw=C('alpha_wolf_charge_claw.png', None, 70, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
    )),
    'corrupted_wolf': dict(windup=0.25, dir='monster4', target=54, clips=dict(
        idle=C('wolf-idle-clean.png', 'pingpong', 140, cell=418),
        move=C('wolf-run-clean.png', None, 70, cell=418),
        hurt=C('wolf-hurt-clean.png', None, 60, cell=418),
        death=C('wolf-death-clean.png', None, 75, cell=418),
        attack=C('wolf-attack-clean.png', None, 55, {'DAMAGE': 'auto'}, cell=418),
    )),
    'mushroom_creature': dict(windup=0.35, dir='monster2', target=50, clips=dict(
        idle=C('mushroom_idle.png', 'pingpong', 150),
        move=C('mushroom_walk.png', None, 100),
        hurt=C('mushroom_hurt.png', None, 60),
        death=C('mushroom_death.png', None, 80),
        attack=C('mushroom_attack.png', None, 60, {'DAMAGE': 'auto'}),
    )),
    'thorn_slime': dict(windup=0.3, dir='monster3', target=44, clips=dict(
        idle=C('thorn_slime_idle.png', 'pingpong', 150),
        move=C('thorn_slime_walk.png', None, 100),
        hurt=C('thorn_slime_hurt.png', None, 60),
        death=C('thorn_slime_death.png', None, 80),
        attack=C('thorn_slime_attack.png', None, 60, {'DAMAGE': 'auto'}),
    )),
    'young_treant': dict(windup=0.45, dir='monster3', target=88, clips=dict(
        idle=C('young_treant_idle.png', 'pingpong', 150),
        move=C('young_treant_walk.png', None, 110),
        hurt=C('young_treant_hurt.png', None, 70),
        death=C('young_treant_death.png', None, 90),
        attack=C('young_treant_attack.png', None, 75, {'DAMAGE': 'auto'}),
    )),
    'corrupted_treant': dict(windup=0.45, dir='monster3', target=100, clips=dict(
        idle=C('corrupted-treant-idle.png', 'pingpong', 150, cell=418),
        move=C('corrupted-treant-walk.png', None, 110, cell=418),
        hurt=C('corrupted-treant-hurt.png', None, 70, cell=512),
        death=C('corrupted-treant-death.png', None, 90, cell=418),
        attack=C('corrupted-treant-attack.png', None, 75, {'DAMAGE': 'auto'}, cell=418),
    )),
    'dark_shaman': dict(windup=0.3, dir='monster1', target=62, clips=dict(
        idle=C('dark_shaman_idle.png', 'pingpong', 150),
        move=C('dark_shaman_walk.png', None, 100),
        hurt=C('dark_shaman_hurt.png', None, 60),
        death=C('dark_shaman_death.png', None, 85),
        attack=C('dark_shaman_attack.png', None, 70, {'PROJECTILE_SPAWN': 'auto'}),
        hex=C('dark_shaman_curese.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
        chant=C('dark_shaman_buff.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
    )),
    'mist_witch': dict(windup=0.3, dir='monster2', target=74, clips=dict(
        idle=C('mist_witch_idle.png', 'pingpong', 150),
        move=C('mist_witch_walk.png', None, 100),
        hurt=C('mist_witch_hurt.png', None, 60),
        death=C('mist_witch_death.png', None, 85),
        attack=C('mist_witch_attack.png', None, 70, {'PROJECTILE_SPAWN': 'auto'}),
        fog=C('mist_witch_black_fog.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
        veil=C('mist_witch_veil_curese.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
    )),
    'mist_wraith': dict(windup=0.3, dir='monster2', target=70, clips=dict(
        idle=C('mist_wraith_idle.png', 'pingpong', 140),
        move=C('mist_wraith_floa.png', None, 100),
        hurt=C('mist_wraith_hurt.png', None, 60),
        death=C('mist_wraith_death.png', None, 85),
        attack=C('mist_wraith_attack.png', None, 55, {'DAMAGE': 'auto'}),
        slash=C('mist_wraith_spectral_X-slash.png', None, 70, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
    )),
    'elder_treant': dict(windup=0.45, dir='monster1', target=140, clips=dict(
        idle=C('elder_treant_idle.png', 'pingpong', 150),
        move=C('elder_treant_walk.png', None, 120),
        hurt=C('elder_treant_hurt.png', None, 70),
        death=C('elder_treant_death.png', None, 90),
        attack=C('elder_treant_attack.png', None, 75, {'DAMAGE': 'auto'}),
        slam=C('elder_treant_heavy_root_slam.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
        roots=C('elder_treant_entangling_roots.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
        call=C('elder_treant_call_of_the_forest.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
        bark=C('elder_treant_bark_guard.png', None, 90, {'CAST_START': 1, 'SKILL_ACTIVATE': 'auto'}, cast=True),
    )),
}


# ------------------------------------------------------------------ cutting

def load(path):
    a = np.array(Image.open(path).convert('RGBA'))
    m = a[..., 3] >= 128
    a[..., 3] = np.where(m, 255, 0)
    a[~m, :3] = 0
    return a


def cells(a, cell):
    H, W = a.shape[:2]
    if cell is None:
        cell = 256 if W % 256 == 0 and H % 256 == 0 else (418 if W == 1254 else 512)
    out = []
    for r in range(H // cell):
        for c in range(W // cell):
            f = a[r * cell:(r + 1) * cell, c * cell:(c + 1) * cell]
            if (f[..., 3] > 0).sum() > 200:
                out.append(f)
    return out, cell


def bbox(f):
    ys, xs = np.nonzero(f[..., 3])
    return xs.min(), ys.min(), xs.max(), ys.max()


def feet_x(f):
    ys, xs = np.nonzero(f[..., 3])
    return xs[ys > ys.max() - 10].mean()


def diff(a, b):
    return int(((a[..., 3] > 0) != (b[..., 3] > 0)).sum())


def analyse(frames):
    d = [diff(frames[i], frames[i + 1]) for i in range(len(frames) - 1)]
    return d, diff(frames[-1], frames[0])


# ------------------------------------------------------------------ clip fixes (smoothness), events
# Sequences are 0-based source frames; None = the default rule (see `default_seq`). Chosen from the frame review
# (consecutive-frame difference + contact sheets): duplicate end frames dropped, start-walk frames cut, holds on strikes.
SEQ = {
    # goblin walk: F1–F3 turn from the 3/4 idle into the side walk — loop the side walk only, body locked
    ('forest_goblin', 'move'): dict(seq=[3, 4, 5, 6, 7, 8], bodylock=True),
    ('forest_goblin', 'hurt'): dict(seq=[2, 3, 4, 4, 3, 1]),
    # lying frames settle downwards (F9 sits higher than F8 → end on the flattest)
    ('forest_goblin', 'death'): dict(seq=[1, 2, 3, 4, 5, 6, 6, 8, 7]),
    ('forest_goblin', 'attack'): dict(seq=[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 9, 10, 10, 11, 12], ev={'DAMAGE': 10}),
    ('goblin_archer', 'attack'): dict(seq=[0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10, 11, 12], ev={'PROJECTILE_SPAWN': 11}),
    ('mist_bat', 'attack'): dict(seq=[0, 1, 2, 3, 3, 4, 5, 5, 6, 7, 8], ev={'DAMAGE': 7}),
    ('forest_wolf', 'attack'): dict(seq=list(range(13)), ev={'DAMAGE': 9}),
    ('alpha_wolf', 'attack'): dict(seq=[0, 1, 2, 3, 4, 4, 5, 6, 7, 8], ev={'DAMAGE': 5}),
    # howl: rise → howl held over the whole 2 s cast (stretched) → settle
    ('alpha_wolf', 'howl'): dict(seq=list(range(17)), ev={'CAST_START': 5, 'SKILL_ACTIVATE': 14}),
    ('alpha_wolf', 'claw'): dict(seq=list(range(17)), ev={'CAST_START': 3, 'SKILL_ACTIVATE': 6}),
    ('corrupted_wolf', 'attack'): dict(seq=[0, 1, 2, 3, 3, 4, 5, 6, 7, 8], ev={'DAMAGE': 4}),
    # mushroom attack: F12–F17 are the idle again — cut, hold the bash
    ('mushroom_creature', 'attack'): dict(seq=[0, 1, 2, 3, 4, 5, 6, 6, 7, 8, 9, 10], ev={'DAMAGE': 7}),
    ('thorn_slime', 'attack'): dict(seq=[0, 1, 2, 3, 4, 4, 5, 6, 7, 8], ev={'DAMAGE': 5}),
    # young treant: the smear is F2 — hold the first frame as the wind-up
    ('young_treant', 'attack'): dict(seq=[0, 0, 0, 1, 1, 2, 3, 4, 5, 6, 7, 8], ev={'DAMAGE': 4}),
    ('corrupted_treant', 'attack'): dict(seq=[0, 1, 2, 3, 3, 4, 5, 6, 7, 8], ev={'DAMAGE': 4}),
    ('dark_shaman', 'attack'): dict(seq=list(range(9)), ev={'PROJECTILE_SPAWN': 4}),
    ('dark_shaman', 'hex'): dict(seq=list(range(9)), ev={'CAST_START': 2, 'SKILL_ACTIVATE': 5}),
    ('dark_shaman', 'chant'): dict(seq=list(range(9)), ev={'CAST_START': 2, 'SKILL_ACTIVATE': 5}),
    ('mist_witch', 'attack'): dict(seq=list(range(9)), ev={'PROJECTILE_SPAWN': 4}),
    ('mist_witch', 'fog'): dict(seq=list(range(9)), ev={'CAST_START': 3, 'SKILL_ACTIVATE': 5}),
    ('mist_witch', 'veil'): dict(seq=list(range(9)), ev={'CAST_START': 3, 'SKILL_ACTIVATE': 6}),
    # wraith attack: F10–F17 are hover idle — cut
    ('mist_wraith', 'attack'): dict(seq=[0, 1, 2, 2, 3, 4, 5, 6, 7, 8], ev={'DAMAGE': 3}),
    ('mist_wraith', 'slash'): dict(seq=list(range(9)), ev={'CAST_START': 3, 'SKILL_ACTIVATE': 5}),
    ('elder_treant', 'attack'): dict(seq=[0, 1, 2, 3, 3, 4, 5, 6, 7, 8], ev={'DAMAGE': 4}),
    ('elder_treant', 'slam'): dict(seq=list(range(9)), ev={'CAST_START': 3, 'SKILL_ACTIVATE': 7}),
    ('elder_treant', 'roots'): dict(seq=list(range(9)), ev={'CAST_START': 2, 'SKILL_ACTIVATE': 5}),
    ('elder_treant', 'call'): dict(seq=list(range(9)), ev={'CAST_START': 2, 'SKILL_ACTIVATE': 5}),
    ('elder_treant', 'bark'): dict(seq=list(range(9)), ev={'CAST_START': 2, 'SKILL_ACTIVATE': 4}),
}


def default_seq(name, frames):
    """loop clips: drop a duplicate end frame, ping-pong when the end → start jump is big · hurt / death start on F2"""
    n = len(frames)
    d, close = analyse(frames)
    med = float(np.median(d)) if d else 0
    if name in ('idle', 'move'):
        if close < 0.25 * med and n > 2:
            return list(range(n - 1)), 'dup end dropped'
        if close > 1.6 * med:
            return list(range(n)) + list(range(n - 2, 0, -1)), 'ping-pong'
        return list(range(n)), 'loop'
    if name in ('hurt', 'death'):
        return list(range(1, n)), 'starts on F2'
    return list(range(n)), 'as sheet'


# ------------------------------------------------------------------ baking

def shift(f, dx, dy):
    g = np.zeros_like(f)
    H, W = f.shape[:2]
    g[max(0, dy):H + min(0, dy), max(0, dx):W + min(0, dx)] = f[max(0, -dy):H - max(0, dy), max(0, -dx):W - max(0, dx)]
    return g


def upper_cx(f):
    ys, xs = np.nonzero(f[..., 3])
    top, bot = ys.min(), ys.max()
    return xs[ys < top + 0.45 * (bot - top)].mean()


def small(f, K):
    n = max(1, round(f.shape[0] * K))
    im = Image.fromarray(f).resize((n, n), Image.BOX)
    x = np.array(im)
    x[..., 3] = np.where(x[..., 3] >= 128, 255, 0)
    x[x[..., 3] == 0, :3] = 0
    im = Image.fromarray(x)
    rgb = ImageEnhance.Color(im.convert('RGB').filter(ImageFilter.UnsharpMask(1, 60, 0))).enhance(1.08)
    return Image.merge('RGBA', (*rgb.split(), im.getchannel('A')))


def bake_monster(mid, m):
    rows, meta = [], {}
    for name, c in m['clips'].items():
        raw, cell = cells(load(SRC / m['dir'] / c['file']), c.get('cell'))
        fix = SEQ.get((mid, name), {})
        if fix.get('seq') is not None:
            seq, why = fix['seq'], 'reviewed'
        else:
            seq, why = default_seq(name, raw)
        x0, y0, x1, y1 = bbox(raw[0])
        size = (x1 - x0 + 1) if m.get('measure') == 'width' else (y1 - y0 + 1)
        K = m['target'] / size if m.get('measure') != 'width' else m['target'] / size
        ground = y1
        fx0 = feet_x(raw[0]) if not m.get('airborne') else (x0 + x1) / 2
        ref_cx = upper_cx(raw[seq[0]])
        frames = []
        for i in seq:
            f = raw[i]
            dx = int(round(ref_cx - upper_cx(f))) if fix.get('bodylock') else 0
            dy = 0
            if not m.get('airborne'):
                b = bbox(f)[3]
                if b > ground or 0 < ground - b <= SNAP:
                    dy = ground - b          # sunk → lifted · nearly on the ground → snapped
            frames.append(shift(f, dx, dy) if dx or dy else f)
        ev = dict(fix.get('ev', {}))
        ms = c['ms']
        hit = ev.get('DAMAGE') or ev.get('PROJECTILE_SPAWN')
        if name == 'attack' and hit and hit > 1:
            # keep the gameplay wind-up (monster stat attackWindup = the hit event time) where the frame rate stays sane
            ms = int(round(min(130, max(45, m['windup'] * 1000 / (hit - 1)))))
        rows.append(dict(name=name, frames=frames, K=K, ground=ground, feet=fx0, ms=ms, cast=c.get('cast', False), ev=ev))
        meta[name] = dict(source=c['file'], cell=cell, srcFrames=len(raw), seq=seq, rule=why, K=round(K, 4))
    # cell size from the extents around the feet anchor (after scaling)
    smalls, ext_l, ext_r, top = [], 0, 0, 0
    for r in rows:
        lst = []
        for f in r['frames']:
            s = small(f, r['K'])
            a = np.array(s)
            ys, xs = np.nonzero(a[..., 3])
            ax, gy = r['feet'] * r['K'], (r['ground'] + 1) * r['K']
            ext_l, ext_r = max(ext_l, ax - xs.min()), max(ext_r, xs.max() - ax)
            top = max(top, gy - ys.min() + m.get('hover', 0))
            lst.append((s, ax, gy))
        smalls.append(lst)
    CW = int(np.ceil(2 * max(ext_l, ext_r) + 6))
    CW += CW % 2
    CW = max(CW, 132)
    CH = max(100, int(np.ceil(top + CH_MARGIN + 6)))
    foot = CH - CH_MARGIN
    cols = max(len(r['frames']) for r in rows)
    sheet = Image.new('RGBA', (cols * CW, len(rows) * CH))
    for ri, lst in enumerate(smalls):
        for ci, (s, ax, gy) in enumerate(lst):
            fl = s.transpose(Image.FLIP_LEFT_RIGHT)              # sheets face right; the game flips enemies
            sheet.alpha_composite(fl, (round(ci * CW + CW / 2 - (s.width - ax)), round(ri * CH + foot - gy - m.get('hover', 0))))
    name = f'enemy-fa-{mid.replace("_", "-")}.png'
    sheet.save(OUT / name, optimize=True)
    clips = {}
    for ri, r in enumerate(rows):
        events = []
        for e, fr in r['ev'].items():
            events.append({'frame': fr, 'event': e, 'name': e if e != 'DAMAGE' else f'{mid.upper()}_DAMAGE'})
        if r['name'] == 'death':
            events.append({'frame': len(r['frames']), 'event': 'DEATH_COMPLETE', 'name': 'DEATH_COMPLETE'})
        clip = {'row': ri + 1, 'frames': len(r['frames']), 'frameMs': r['ms'], 'events': events}
        if r['cast']:
            clip['castDriven'] = True
        clips[r['name']] = clip
    return name, dict(sheet=name, cellW=CW, cellH=CH, clips=clips), meta, sheet


# ------------------------------------------------------------------ VFX (4 × 2 sheets, 8 frames)
# name: (dir, file, display width atlas px, pivot 'ground' | 'center', FxDef extras)
HERO_BODY = -21.5        # % of a cell: hero body centre (feet +27.25 % − 39 px × 1.25 %)
HERO_FEET = 27.25
MON_FEET = 28.5          # monster feet: sheet bottom 46 % − 14 px × 1.25 %
VFX = {
    # the howl sheet carries a ~10 % grey haze over the whole canvas — alpha floor 40 removes it
    'fa-howl':         ('monster4', 'Pixel-Art Howl Shockwave Sprite Sheet.png', 74, 'center', dict(at='self', dx=55, dy=-30, frameMs=70), 40),
    'fa-claw':         ('monster4', 'Charge-Claw_VFX.png', 70, 'center', dict(at='target', dy=HERO_BODY, frameMs=50)),
    'fa-curse':        ('monster1', 'curse_vfx.png', 58, 'center', dict(at='target', dy=HERO_BODY, frameMs=70)),
    'fa-dark-chant':   ('monster1', 'Dark Shaman Buff Sprite Sheet.png', 58, 'ground', dict(at='target', dy=MON_FEET, frameMs=70)),
    'fa-black-fog':    ('monster2', 'BLACK_FOG_VFX.png', 150, 'ground', dict(at='target', dy=HERO_FEET + 4, frameMs=90, layer='under')),
    'fa-veil-curse':   ('monster2', 'VEIL_CURSE_VFX.png', 62, 'center', dict(at='target', dy=HERO_BODY, frameMs=70)),
    'fa-phase':        ('monster2', 'PHASE_vfx.png', 92, 'center', dict(at='self', dy=-15, frameMs=100)),
    'fa-x-slash':      ('monster2', 'Spectral_X-Slash_vfx.png', 76, 'center', dict(at='target', dy=HERO_BODY, frameMs=55)),
    'fa-root-slam':    ('monster1', 'heavy_root_slam_vfx.png', 130, 'ground', dict(at='self', dx=70, dy=MON_FEET, frameMs=70)),
    'fa-root-slam-hit': ('monster1', 'heavy_root_slam_impact_vfx.png', 84, 'ground', dict(at='target', dy=HERO_FEET, frameMs=60)),
    'fa-roots':        ('monster1', 'entangling_roots_vfx.png', 74, 'ground', dict(at='target', dy=HERO_FEET, frameMs=80)),
    'fa-call-charge':  ('monster1', 'call_of_the_forest_charge_vfx.png', 150, 'ground', dict(at='self', dy=MON_FEET, frameMs=94, repeat=4, layer='under')),
    'fa-call-summon':  ('monster1', 'call_of_the_forest_summon_vfx.png', 120, 'ground', dict(at='target', dx=70, dy=MON_FEET, frameMs=80)),
    'fa-bark-guard':   ('monster1', 'bark_guard_vfx.png', 170, 'center', dict(at='target', dy=-58, frameMs=70)),
    'fa-enraged':      ('monster1', 'ENRAGED FOREST ACTIVATION VFX.png', 200, 'ground', dict(at='target', dy=MON_FEET, frameMs=80)),
}
FX_BAKE = 2              # strips baked at 2 × the display size → FxDef scale 1/3 (display px = w × scale × 1.5)


def bake_vfx(name, cfg):
    d, file, width, pivot, extra = cfg[:5]
    floor = cfg[5] if len(cfg) > 5 else 10
    a = np.array(Image.open(SRC / d / file).convert('RGBA'))
    al = a[..., 3].astype(float)
    a[..., 3] = np.where(al < floor, 0, np.clip((al - floor) * 255 / (255 - floor), 0, 255)).astype(np.uint8) if floor > 10 \
        else np.where(al < floor, 0, al).astype(np.uint8)
    H, W = a.shape[:2]
    cw, ch = W / 4, H / 2
    frames = [a[int(r * ch):int((r + 1) * ch), int(c * cw):int((c + 1) * cw)] for r in range(2) for c in range(4)]
    h0 = min(f.shape[0] for f in frames); w0 = min(f.shape[1] for f in frames)
    frames = [f[:h0, :w0] for f in frames]
    union = np.zeros((h0, w0), bool)
    for f in frames:
        union |= f[..., 3] > 0
    ys, xs = np.nonzero(union)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    k = width * FX_BAKE / (x1 - x0)
    fw, fh = max(1, round((x1 - x0) * k)), max(1, round((y1 - y0) * k))
    strip = Image.new('RGBA', (fw * 8, fh))
    for i, f in enumerate(frames):
        im = Image.fromarray(np.ascontiguousarray(f[y0:y1, x0:x1])).resize((fw, fh), Image.LANCZOS)
        strip.alpha_composite(im.transpose(Image.FLIP_LEFT_RIGHT), (i * fw, 0))   # authored facing left → right
    out = f'fx-{name}.png'
    strip.save(OUT / out, optimize=True)
    fx = dict(file=out, frames=8, w=fw, h=fh, scale=round(1 / (1.5 * FX_BAKE), 6), pivot=[0.5, 1 if pivot == 'ground' else 0.5], **extra)
    return fx


# ------------------------------------------------------------------ main

def write_ts(anims, fx):
    lines = ['// GENERATED by tools/sprites/forest_arc/art.py — do not edit by hand.',
             "import type { AnimationConfig } from '../models/monster';", "import type { FxDef } from './sprites';", '',
             '/** Forest Arc monster sheets (user art, monster1–4.zip 2026-11-05) — idle / move / hurt / death / attack + skill clips */',
             f'export const FOREST_ARC_ANIMATIONS: Record<string, AnimationConfig> = {json.dumps(anims, indent=2)};', '',
             '/** Forest Arc skill VFX strips (8 frames, baked at 2 × display size) */',
             f'export const FOREST_ARC_FX: Record<string, FxDef> = {json.dumps(fx, indent=2)};', '']
    TS.write_text('\n'.join(lines))


def main(argv):
    only = None
    if '--only' in argv:
        only = argv[argv.index('--only') + 1].split(',')
    anims, report, fx = {}, {}, {}
    for mid, m in MONSTERS.items():
        if only and mid not in only:
            continue
        name, anim, meta, _ = bake_monster(mid, m)
        anims[mid] = anim
        report[mid] = dict(sheet=name, cell=[anim['cellW'], anim['cellH']], clips=meta)
        print(mid, name, anim['cellW'], anim['cellH'], {k: v['frames'] for k, v in anim['clips'].items()})
    for name, cfg in VFX.items():
        fx[name] = bake_vfx(name, cfg)
    if not only:
        write_ts(anims, fx)
        REPORT.write_text(json.dumps(report, indent=2))


if __name__ == '__main__':
    main(sys.argv[1:])

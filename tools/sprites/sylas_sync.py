"""Sylas Veyrn — timeline preview (game geometry, 60 FPS) for review. Renders from the baked game assets.

python3 tools/sprites/sylas_sync.py <out dir> [marked]
→ <out>/sylas_{attack,s1,s2,ult}_60fps.mp4 + sylas_sync_stills.png (+ `marked`: the target starts with Dusk Mark, so
the Marked Burst / Marked Execution layers show)

Mirrors sprites.ts `hero-sylas.png` + the sy-* FxDefs (keep in sync): board cell 80 px (rendered × UP), the hero
sprite 1 atlas px = 1 board px, sheet bottom on the cell's 96 % line (feet 15 px above = +27.25 %), FX width = w · scale · 1.5 (projectiles · 1.3),
pivot on its anchor (% of a cell from the cell centre), projectiles from the muzzle (cell 42 % + muzzle) to the
target (cell 42 %), flight 0.1 + 0.06 / cell, flight frames 0 … n−2 once, last frame held 0.14 s.
"""
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else 'tmp/sylas-sync')
MARKED = 'marked' in sys.argv[2:]
OUT.mkdir(parents=True, exist_ok=True)
SP = Path('public/sprites')
UP, CELL, FPS = 2, 80, 60
C = CELL * UP
COLS, ROWS = 7, 3
W, H = COLS * C, ROWS * C
HERO_C, FOE_C, ROW = 1, 5, 1
DIST = FOE_C - HERO_C

ANCH = {'feet': (0, 27.25), 'tipS1': (54, -50.9), 'tipS2': (53.1, -43.6), 'tipUlt': (43.4, -31.5)}
CLIPS = {  # row, steps (ms), events (step index) — sprites.ts
    'attack': (3, [45, 45, 45, 50, 60, 70, 50, 50, 50, 55, 55, 60], {'DAMAGE': [5]}),
    'skill': (5, [40, 40, 40, 40, 40, 70, 70, 80, 90, 80, 55, 55, 55, 60, 60, 60, 55, 55, 55],
              {'CAST_START': [0], 'CHARGE_START': [5], 'DAMAGE': [9]}),
    'skill2': (6, [40, 40, 40, 45, 50, 55, 60, 55, 55, 55, 60, 55, 55, 70, 90, 60, 60, 60, 55, 55, 60],
               {'CAST_START': [0], 'DAMAGE': [6, 10, 14]}),
    'ult': (7, [50, 50, 50, 50, 50, 60, 60, 60, 60, 70, 1200, 90, 70, 70, 70, 80, 50, 50, 50, 50, 50, 50, 60],
            {'CAST_START': [0], 'CHARGE_START': [10], 'DAMAGE': [11]}),
}
# FxDefs: file, frames, w, h, pivot, frameMs, scale, at, anchor/dy, extra
REP = json.load(open(Path(__file__).parent / 'sylas_vfx_report.json'))


def fxdef(file, frame_ms, scale=1 / 3, **kw):
    m = REP[file]
    return dict(file=file, frames=m['frames'], w=m['w'], h=m['h'], pivot=m['pivot'], frameMs=frame_ms, scale=scale, **kw)


FX = {
    'sy-s1-charge': fxdef('fx-sylas-s1-charge.png', 40, at='self', anchor='tipS1', dx=24, add=True),
    'sy-s1-mark-in': fxdef('fx-sylas-s1-mark-in.png', 45, at='target', dy=-14),
    'sy-s1-mark': fxdef('fx-sylas-s1-mark.png', 110, at='target', dy=-14, loop=True),
    'sy-s2-muzzle': fxdef('fx-sylas-s2-muzzle.png', 28, at='self', anchor='tipS2', add=True),
    'sy-s2-muzzle3': fxdef('fx-sylas-s2-muzzle.png', 32, scale=0.47, at='self', anchor='tipS2', add=True),
    'sy-s2-burst': fxdef('fx-sylas-s2-burst.png', 50, at='target', dy=27.25),
    'sy-ult-lock': fxdef('fx-sylas-ult-lock.png', 75, at='target', dy=-14),
    'sy-ult-aura': fxdef('fx-sylas-ult-aura.png', 75, at='self', anchor='feet', repeat=2, fade=120, under=True),
    'sy-ult-charge': fxdef('fx-sylas-ult-charge.png', 75, at='self', anchor='tipUlt', dx=26, repeat=2, fade=80, add=True),
    'sy-ult-impact': fxdef('fx-sylas-ult-impact.png', 55, at='target', dy=-14),
    'sy-ult-marked': fxdef('fx-sylas-ult-marked.png', 55, at='target', dy=-14, add=True),
}
PROJ = {
    'sy-bolt': fxdef('fx-sylas-bolt.png', 60, 1 / 2.6, muzzle=(54, -42.9)),
    'sy-s1-bolt': fxdef('fx-sylas-s1-bolt.png', 60, 1 / 2.6, muzzle=(54, -42.9)),
    'sy-s2-bolt': fxdef('fx-sylas-s2-bolt.png', 45, 1 / 2.6, muzzle=(53.1, -35.6)),
    'sy-s2-final': fxdef('fx-sylas-s2-final.png', 45, 1 / 2.6, muzzle=(53.1, -35.6), overshoot=2),
    'sy-ult-bolt': fxdef('fx-sylas-ult-bolt.png', 50, 1 / 2.6, muzzle=(43.4, -23.5)),
}
_cache = {}


def frames_of(d, kscale):
    key = (d['file'], kscale)
    if key not in _cache:
        im = Image.open(SP / d['file']).convert('RGBA')
        fw = im.width // d['frames']
        sw, sh = max(1, round(fw * kscale)), max(1, round(im.height * kscale))
        _cache[key] = [im.crop((i * fw, 0, (i + 1) * fw, im.height)).resize((sw, sh), Image.LANCZOS) for i in range(d['frames'])]
    return _cache[key]


ATLAS = Image.open(SP / 'hero-sylas.png').convert('RGBA')
FOE = Image.open(SP / 'enemy-goblin-fighter.png').convert('RGBA').crop((0, 0, 132, 100)).transpose(Image.FLIP_LEFT_RIGHT)
FOE = FOE.resize((FOE.width * UP, FOE.height * UP), Image.LANCZOS)
bg = Image.open('public/backgrounds/forest-1.webp').convert('RGBA')
BG = bg.resize((int(bg.width * H * 1.6 / bg.height), int(H * 1.6)))
BG = BG.crop((0, BG.height - H, W, BG.height))


def cell_xy(c, r=ROW):
    return c * C + C / 2, r * C + C / 2


def put(canvas, im, x, y, add=False, a=1.0):
    if a < 1:
        im = im.copy()
        im.putalpha(im.getchannel('A').point(lambda v: int(v * a)))
    if add:
        from PIL import ImageChops
        layer = Image.new('RGBA', canvas.size)
        layer.alpha_composite(im, (int(round(x)), int(round(y))))
        rgb = Image.composite(layer, Image.new('RGBA', canvas.size), layer.getchannel('A'))
        canvas.alpha_composite(Image.blend(rgb, rgb, 1))  # straight alpha composite then a mild additive boost
        boost = ImageChops.multiply(layer, Image.new('RGBA', canvas.size, (255, 255, 255, 120)))
        canvas.paste(ImageChops.add(canvas, boost.convert('RGBA')), (0, 0))
    else:
        canvas.alpha_composite(im, (int(round(x)), int(round(y))))


def draw_fx(canvas, d, t0, t, base_xy):
    dt = (t - t0) * 1000
    if dt < 0:
        return
    n, fm = d['frames'], d['frameMs']
    total = n * fm * d.get('repeat', 1)
    a = 1.0
    if d.get('loop'):
        k = int(dt // fm) % n
    elif dt < total:
        k = int(dt // fm) % n
    elif dt < total + d.get('fade', 0):
        k, a = n - 1, 1 - ((dt - total) / d['fade']) ** 2
    else:
        return
    fr = frames_of(d, d['scale'] * 1.5 * UP * CELL / 80)[k]
    if 'anchor' in d:
        ax, ay = ANCH[d['anchor']]
        ax += d.get('dx', 0)
    else:
        ax, ay = 0, d.get('dy', 0)
    x = base_xy[0] + ax / 100 * C - d['pivot'][0] * fr.width
    y = base_xy[1] + ay / 100 * C - d['pivot'][1] * fr.height
    put(canvas, fr, x, y, d.get('add', False), a)


def render(kind, t, sched):
    row, steps, ev = CLIPS[kind]
    c = BG.copy()
    hx, hy = cell_xy(HERO_C)
    fx_, fy = cell_xy(FOE_C)
    for d, t0, base in sched['fx']:
        if d.get('under'):
            draw_fx(c, d, t0, t, base)
    # target (sheet bottom on the cell's 96 % line, like the board)
    c.alpha_composite(FOE, (int(fx_ - 66 * UP), int(ROW * C + 0.96 * C - 100 * UP)))
    acc, k = 0, len(steps) - 1
    for i, s in enumerate(steps):
        if t * 1000 < acc + s:
            k = i
            break
        acc += s
    else:
        k = None
    hero = ATLAS.crop((k * 260, row * 170, k * 260 + 260, row * 170 + 170)) if k is not None else ATLAS.crop((0, 0, 260, 170))
    hero = hero.resize((260 * UP, 170 * UP), Image.LANCZOS)
    c.alpha_composite(hero, (int(hx - 130 * UP), int(ROW * C + 0.96 * C - 170 * UP)))
    for d, t0, base in sched['fx']:
        if not d.get('under'):
            draw_fx(c, d, t0, t, base)
    for p, t0, flight in sched['proj']:
        dt = t - t0
        if dt < 0 or dt > flight + 0.14:
            continue
        sx = hx + p['muzzle'][0] / 100 * C
        sy = ROW * C + 0.42 * C + p['muzzle'][1] / 100 * C
        tx, ty = fx_, ROW * C + 0.42 * C
        over = p.get('overshoot', 0) * C
        fl = flight * (1 + over / max(1, tx - sx))
        if dt <= fl:
            kf = min(p['frames'] - 2, int(dt / fl * (p['frames'] - 1)))
            x = sx + (tx + over - sx) * (dt / fl)
        else:
            continue
        fr = frames_of(p, p['scale'] * 1.3 * UP * CELL / 80)[kf]
        put(c, fr, x - fr.width / 2, ty + (sy - ty) * (1 - dt / fl) - fr.height / 2, True)
    d = ImageDraw.Draw(c)
    d.text((8, 8), f'{kind}  T{int(round(t * FPS)):03d}  {t:.3f}s{"  (target Dusk-Marked)" if MARKED else ""}', fill='white')
    return c


def schedule(kind):
    row, steps, ev = CLIPS[kind]
    at = lambda i: sum(steps[:i]) / 1000  # noqa: E731
    hxy, fxy = cell_xy(HERO_C), cell_xy(FOE_C)
    fx, proj = [], []
    flight = 0.1 + 0.06 * DIST
    if MARKED:
        fx.append((FX['sy-s1-mark'], -10, fxy))
    if kind == 'attack':
        proj.append((PROJ['sy-bolt'], at(ev['DAMAGE'][0]), flight))
    if kind == 'skill':
        fx.append((FX['sy-s1-charge'], at(ev['CHARGE_START'][0]), hxy))
        t = at(ev['DAMAGE'][0])
        proj.append((PROJ['sy-s1-bolt'], t, flight))
        if not MARKED:
            fx.append((FX['sy-s1-mark-in'], t + flight, fxy))
            fx.append((FX['sy-s1-mark'], t + flight + 0.225, fxy))
    if kind == 'skill2':
        for i, s in enumerate(ev['DAMAGE']):
            t = at(s)
            fx.append((FX['sy-s2-muzzle3' if i == 2 else 'sy-s2-muzzle'], t, hxy))
            proj.append((PROJ['sy-s2-final' if i == 2 else 'sy-s2-bolt'], t, flight))
        if MARKED:
            fx.append((FX['sy-s2-burst'], at(ev['DAMAGE'][2]) + flight, fxy))
    if kind == 'ult':
        fx.append((FX['sy-ult-lock'], 0, fxy))
        fx.append((FX['sy-ult-aura'], at(ev['CHARGE_START'][0]), hxy))
        fx.append((FX['sy-ult-charge'], at(ev['CHARGE_START'][0]), hxy))
        t = at(ev['DAMAGE'][0])
        proj.append((PROJ['sy-ult-bolt'], t, flight))
        fx.append((FX['sy-ult-impact'], t + flight, fxy))
        if MARKED:
            fx.append((FX['sy-ult-marked'], t + flight, fxy))
    return {'fx': fx, 'proj': proj}, sum(steps) / 1000


def main():
    stills = []
    for kind, name in (('attack', 'attack'), ('skill', 's1'), ('skill2', 's2'), ('ult', 'ult')):
        sched, total = schedule(kind)
        n = int((total + 0.6) * FPS)
        out = OUT / f'sylas_{name}{"_marked" if MARKED else ""}_60fps.mp4'
        v = subprocess.Popen(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', f'{W}x{H}',
                              '-r', str(FPS), '-i', '-', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '16', str(out)],
                             stdin=subprocess.PIPE)
        keys = set(int(x * n) for x in (0.15, 0.3, 0.45, 0.6, 0.75))
        for i in range(n):
            im = render(kind, i / FPS, sched)
            v.stdin.write(im.tobytes())
            if i in keys:
                stills.append(im)
        v.stdin.close()
        v.wait()
        print(out)
    sheet = Image.new('RGBA', (W // 2 * 5, H // 2 * 4))
    for j, im in enumerate(stills):
        sheet.paste(im.resize((W // 2, H // 2)), ((j % 5) * W // 2, (j // 5) * H // 2))
    sheet.save(OUT / f'sylas_sync_stills{"_marked" if MARKED else ""}.png')


if __name__ == '__main__':
    main()

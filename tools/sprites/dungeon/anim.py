"""Build game-ready sprite sheets (facing RIGHT, feet 14 px above the cell bottom, centred) for the 12
special-dungeon monsters from the pixel-art drawings. Frames are made from the drawn poses + pixel transforms
(bob, lean, lunge, flash, fall, fade) — nearest-neighbour only, so the pixel grid stays crisp."""
import math
import numpy as np
from PIL import Image
import m_training as T, m_ascension as A, m_hunt_trial as H

FEET = 14


def render(fn, pose, k, leg=0):
    return Image.fromarray(fn(pose, k, leg).img, 'RGBA')


def anchor(im):
    a = np.array(im)[..., 3] > 0
    ys, xs = np.nonzero(a)
    bot = ys.max()
    low = ys >= bot - max(3, (bot - ys.min()) // 5)
    return float(np.median(xs[low])), bot


def tint(im, col, amt):
    a = np.array(im).astype(float)
    m = a[..., 3] > 0
    a[m, :3] = a[m, :3] * (1 - amt) + np.array(col) * amt
    return Image.fromarray(a.astype(np.uint8), 'RGBA')


def glow(im, col, r=2, alpha=150):
    a = np.array(im)[..., 3] > 0
    from scipy import ndimage
    g = ndimage.binary_dilation(a, iterations=r) & ~a
    out = Image.new('RGBA', im.size, (0, 0, 0, 0))
    o = np.array(out); o[g] = (*col, alpha)
    out = Image.fromarray(o, 'RGBA'); out.alpha_composite(im)
    return out


def fade(im, f):
    a = np.array(im).copy(); a[..., 3] = (a[..., 3] * f).astype(np.uint8)
    return Image.fromarray(a, 'RGBA')


class Frame:
    """a pose image + transform around the pose's feet anchor"""
    def __init__(self, im, ax, ay, dx=0, dy=0, sx=1.0, sy=1.0, rot=0.0, alpha=1.0, fx=None):
        self.im, self.ax, self.ay = im, ax, ay
        self.dx, self.dy, self.sx, self.sy, self.rot, self.alpha, self.fx = dx, dy, sx, sy, rot, alpha, fx

    def draw(self):
        im = self.im
        if self.sx != 1 or self.sy != 1:
            w, h = im.size
            im = im.resize((max(1, round(w * self.sx)), max(1, round(h * self.sy))), Image.NEAREST)
            ax, ay = self.ax * self.sx, self.ay * self.sy
        else:
            ax, ay = self.ax, self.ay
        pad = max(im.size)
        big = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
        big.alpha_composite(im, (pad, pad))
        ax, ay = ax + pad, ay + pad
        if self.rot:
            big = big.rotate(self.rot, resample=Image.NEAREST, center=(ax, ay))
        if self.alpha < 1:
            big = fade(big, self.alpha)
        if self.fx:
            big = self.fx(big)
        return big, ax - self.dx, ay - self.dy   # dx>0 = forward (left in the source, right after the flip)


# ------------------------------------------------------------------ monsters
# kind: legs | float | roll ; attack: pose used for the strike ; ranged: recoil instead of lunge
M = {
    'straw_recruit': dict(fn=T.straw_recruit, k=1.2, kind='legs', attack='attack', skills=[]),
    'crossbow_dummy': dict(squash=True, fn=T.crossbow_dummy, k=1.2, kind='roll', attack='attack', ranged=True,
                           skills=[('volley', 'attack', 8, (255, 220, 150))]),
    'drill_sergeant': dict(fn=T.drill_sergeant, k=1.35, kind='legs', attack='idle',
                           skills=[('rally', 'skill', 8, (255, 90, 70))]),
    'brass_shishi': dict(squash=True, fn=A.brass_shishi, k=1.8, kind='legs', attack='idle',
                         skills=[('roar', 'skill', 8, (90, 230, 200)), ('pounce', 'idle', 6, None)]),
    'moonblade_ronin': dict(fn=A.moonblade_ronin, k=1.8, kind='float', attack='idle',
                            skills=[('iaido', 'idle', 8, (150, 190, 255)), ('mirror', 'skill', 6, (200, 225, 255))]),
    'astral_seraph': dict(fn=A.astral_seraph, k=1.7, kind='float', attack='skill', ranged=True,
                          skills=[('starfall', 'skill', 6, (255, 220, 140)), ('judgement', 'skill', 10, (190, 170, 255))]),
    'gem_beetle': dict(squash=True, fn=H.gem_beetle, k=1.2, kind='legs', attack='idle',
                       skills=[('shell', 'skill', 6, (190, 140, 255))]),
    'mimic_chest': dict(squash=True, fn=H.mimic_chest, k=1.15, kind='hop', attack='skill',
                        skills=[('devour', 'skill', 8, (255, 120, 150)), ('wake', 'skill', 4, None)]),
    'coin_kobold': dict(fn=H.coin_kobold, k=1.2, kind='legs', attack='idle', run='skill',
                        skills=[('smoke', 'skill', 4, (200, 190, 210))]),
    'rune_wisp': dict(fn=H.rune_wisp, k=1.2, kind='float', attack='skill', ranged=True,
                      skills=[('bolt', 'skill', 8, (127, 240, 255))]),
    'grimoire_familiar': dict(fn=H.grimoire_familiar, k=1.15, kind='float', attack='idle',
                              skills=[('barrier', 'skill', 8, (255, 216, 74))]),
    'arcane_examiner': dict(fn=H.arcane_examiner, k=1.3, kind='legs', attack='skill', ranged=True,
                            skills=[('seal', 'skill', 8, (255, 216, 74)), ('chalk', 'skill', 6, (230, 230, 255))]),
}


def rows_for(mid):
    c = M[mid]; fn, k = c['fn'], c['k']
    kind = c['kind']
    poses = {}

    def P(pose, leg=0):
        key = (pose, leg)
        if key not in poses:
            im = render(fn, pose, k, leg)
            poses[key] = im
        return poses[key]

    base = P('idle')
    ax, ay = anchor(base)          # one anchor per monster → poses never jump
    F = lambda im, **kw: Frame(im, ax, ay, **kw)
    s = k                          # transform unit scales with the art
    rows = []

    # IDLE 4
    if kind == 'float':
        rows.append(('idle', [F(base, dy=d * s) for d in (0, 2, 3, 1)]))
    else:
        rows.append(('idle', [F(base, dy=d * s, sy=q) for d, q in ((0, 1), (0, .97), (1, .96), (0, .98))]))

    # WALK / MOVE 6
    walk = []
    run_pose = c.get('run')
    for i in range(6):
        ph = math.sin(i / 6 * 2 * math.pi)
        if kind == 'legs':
            im = P(run_pose, 0) if run_pose else P('idle', round(ph, 1))
            walk.append(F(im, dy=abs(ph) * 2 * s, rot=-3 * ph * (0.5 if s > 1.3 else 1)))
        elif kind == 'float':
            walk.append(F(base, dy=(2 + 2 * ph) * s, rot=-4))
        elif kind == 'hop':
            h = [0, 3, 8, 10, 6, 1][i]
            walk.append(F(base, dy=h * s, sy=[0.9, 1, 1.05, 1.05, 1, 0.92][i]))
        else:  # roll
            walk.append(F(base, dy=(i % 2) * s, rot=(-2 if i % 2 else 0)))
    rows.append(('move', walk))

    # HURT 3
    rows.append(('hurt', [F(base, dx=-2 * s, fx=lambda im: tint(im, (255, 255, 255), .55)),
                          F(base, dx=-4 * s, sy=.95, rot=6, fx=lambda im: tint(im, (255, 60, 60), .35)),
                          F(base, dx=-1 * s)]))

    # DEATH
    n_death = 8 if s > 1.5 else (7 if mid == 'arcane_examiner' else 6)
    death = []
    for i in range(n_death):
        t = i / (n_death - 1)
        if c.get('squash'):
            death.append(F(base, dx=-3 * s * t, sy=1 - .45 * t, sx=1 + .12 * t, rot=-6 * t,
                           fx=(lambda im: tint(im, (255, 80, 80), .3)) if i == 0 else (lambda im, t=t: tint(im, (40, 20, 60), .4 * t))))
        elif kind == 'float':
            death.append(F(base, dy=-t * 6 * s, sx=1 - .35 * t, sy=1 - .55 * t, alpha=1 - .85 * t,
                           fx=lambda im, t=t: tint(im, (255, 255, 255), .5 * t)))
        else:
            ang = -min(88, 105 * t)
            death.append(F(base, dx=-6 * s * t, rot=ang, sy=1 - .12 * t,
                           fx=(lambda im: tint(im, (255, 80, 80), .3)) if i == 0 else (lambda im, t=t: tint(im, (40, 20, 60), .35 * t))))
    rows.append(('death', death))

    # ATTACK 6 (event frame 4)
    ap = P(c['attack'])
    if c.get('ranged'):
        rows.append(('attack', [F(base), F(base, dx=-1 * s, sy=.97), F(ap), F(ap, dx=-3 * s, fx=lambda im: glow(im, (255, 255, 220), 1, 170)),
                                F(ap, dx=-1 * s), F(base)]))
    else:
        rows.append(('attack', [F(base), F(base, dx=-4 * s, sy=.95, rot=-4), F(ap, dx=-1 * s),
                                F(ap, dx=9 * s, rot=6, fx=lambda im: glow(im, (255, 240, 200), 1, 150)),
                                F(ap, dx=4 * s, rot=2), F(base, dx=1 * s)]))

    # SKILLS
    for name, pose, n, col in c['skills']:
        col = col or (255, 255, 255)
        sp = P(pose)
        fr = []
        if name == 'pounce':          # leap arc forward, land on frame 4
            for i, (dx, dy, r) in enumerate(((0, 0, 0), (-3, -2, -6), (5, 14, 10), (12, 3, 4), (9, 0, 0), (3, 0, 0))):
                fr.append(F(sp, dx=dx * s, dy=dy * s, rot=r, sy=.94 if i in (1, 4) else 1))
        elif name == 'iaido':         # crouch, flash dash forward with afterimage, return
            steps = ((0, 0, 1), (-3, 0, .92), (-4, 0, .9), (-4, 0, .9), (16, 0, 1), (18, 0, 1), (8, 0, 1), (0, 0, 1))
            for i, (dx, dy, q) in enumerate(steps):
                fxf = (lambda im, col=col: glow(im, col, 2, 180)) if i in (2, 3, 4, 5) else None
                fr.append(F(sp, dx=dx * s, sy=q, fx=fxf))
        elif name == 'wake':          # closed → lid pops open
            fr = [F(base), F(base, dy=2 * s, sy=.95), F(sp, dy=4 * s, sy=1.05), F(sp)]
        elif name == 'smoke':         # throws smoke, turns grey-transparent
            fr = [F(sp), F(sp, dy=2 * s, fx=lambda im: tint(im, (200, 190, 210), .4)),
                  F(sp, alpha=.45, fx=lambda im: tint(im, (200, 190, 210), .6)), F(sp, alpha=.8)]
        elif n == 6 and name in ('mirror', 'shell'):   # held stance loop with a pulsing aura
            for i in range(6):
                fr.append(F(sp if i else base, fx=(lambda im, i=i, col=col: glow(im, col, 2 + i % 2, 120 + 30 * (i % 3))) if i else None))
        else:                         # cast-driven: 1 ready · 2 CAST_START · … · activation · recovery
            act = {6: 3, 8: 4, 10: 7}[n]
            for i in range(n):
                if i == 0:
                    fr.append(F(base))
                elif i < act:
                    p = (i - 1) / max(1, act - 1)
                    fr.append(F(sp, dy=(1 * s if kind == 'float' else 0), fx=lambda im, p=p, col=col: glow(im, col, 1 + round(2 * p), int(90 + 110 * p))))
                elif i == act:
                    fr.append(F(sp, dx=2 * s, fx=lambda im, col=col: glow(tint(im, (255, 255, 255), .45), col, 3, 230)))
                elif i < n - 1:
                    fr.append(F(sp, dx=1 * s, fx=lambda im, col=col: glow(im, col, 1, 110)))
                else:
                    fr.append(F(base))
        rows.append((name, fr))
    return rows


def build(mid):
    rows = rows_for(mid)
    drawn = [[f.draw() for f in fr] for _, fr in rows]
    # extents around the anchor
    L = R = U = D = 0
    for row in drawn:
        for im, ax, ay in row:
            a = np.array(im)[..., 3] > 0
            ys, xs = np.nonzero(a)
            if not len(xs):
                continue
            L = max(L, ax - xs.min()); R = max(R, xs.max() - ax); U = max(U, ay - ys.min()); D = max(D, ys.max() - ay)
    half = int(math.ceil(max(L, R))) + 3
    W = max(132, 2 * half)
    W += W % 2
    Hc = max(100, int(math.ceil(U)) + FEET + 4)
    Hc = max(Hc, int(math.ceil(D)) + FEET)  # never needed, feet at bottom
    cols = max(len(r) for r in drawn)
    sheet = Image.new('RGBA', (W * cols, Hc * len(drawn)), (0, 0, 0, 0))
    for r, row in enumerate(drawn):
        for c, (im, ax, ay) in enumerate(row):
            ox = c * W + W // 2 - round(ax)
            oy = r * Hc + (Hc - FEET) - round(ay)
            cell = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
            cell.alpha_composite(im, (0, 0)) if False else None
            sheet.alpha_composite(im, (max(0, ox), max(0, oy)), (max(0, -ox), max(0, -oy)))
    # the art faces left: flip every cell in place so the sheet faces right
    out = Image.new('RGBA', sheet.size, (0, 0, 0, 0))
    for r in range(len(drawn)):
        for c in range(cols):
            box = (c * W, r * Hc, (c + 1) * W, (r + 1) * Hc)
            out.alpha_composite(sheet.crop(box).transpose(Image.FLIP_LEFT_RIGHT), box[:2])
    names = [(n, len(fr)) for n, fr in rows]
    return out, W, Hc, names


if __name__ == '__main__':
    import json, sys
    meta = {}
    for mid in (sys.argv[1:] or M):
        sh, W, Hc, names = build(mid)
        sh.save(f'out/enemy-{mid.replace("_", "-")}.png', optimize=True)
        meta[mid] = dict(cellW=W, cellH=Hc, rows=names, size=sh.size)
        print(mid, W, Hc, names)
    json.dump(meta, open('out/sheets.json', 'w'), indent=1)

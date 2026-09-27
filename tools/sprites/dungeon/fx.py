"""Skill FX strips (6 frames, 64x64 low-res, crisp pixels, no antialias)."""
import math
from PIL import Image, ImageDraw

N, S = 6, 64


def frame():
    im = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    return im, ImageDraw.Draw(im)


def strip(fn, n=N):
    out = Image.new('RGBA', (S * n, S), (0, 0, 0, 0))
    for i in range(n):
        im, d = frame()
        fn(d, i, i / (n - 1))
        out.alpha_composite(im, (i * S, 0))
    return out


def ring(d, c, r, col, w=2, ry=None):
    ry = ry or r
    d.ellipse((c[0] - r, c[1] - ry, c[0] + r, c[1] + ry), outline=col, width=w)


def star(d, cx, cy, r, col, pts=4):
    p = []
    for k in range(pts * 2):
        a = math.pi * k / pts - math.pi / 2
        rr = r if k % 2 == 0 else r * 0.35
        p.append((cx + rr * math.cos(a), cy + rr * math.sin(a)))
    d.polygon(p, fill=col)


def fade(a, t):
    return int(a * (1 - t * 0.8))


# ---------------- Training
def triple_volley(d, i, t):
    # three bolts fanning out left, then impact sparks
    for k, ang in enumerate((-18, 0, 18)):
        a = math.radians(180 + ang)
        dist = 8 + t * 46
        x, y = 56 + dist * math.cos(a), 32 + dist * math.sin(a)
        bx, by = x - 7 * math.cos(a), y - 7 * math.sin(a)
        if i < 5:
            d.line((bx, by, x, y), fill=(210, 200, 180, 255), width=1)
            d.point((x, y), fill=(160, 170, 190, 255))
            d.line((bx - 3 * math.cos(a), by - 3 * math.sin(a), bx, by), fill=(200, 60, 50, 255), width=1)
        else:
            star(d, x, y, 5, (255, 230, 150, 230))
    if i < 2:
        d.ellipse((50, 26, 62, 38), fill=(255, 240, 200, 150 - i * 60))


def rally_whistle(d, i, t):
    c = (14, 30)
    for k in range(3):
        r = 6 + (t * 40 + k * 10) % 44
        a = int(230 * (1 - r / 50))
        ring(d, c, r, (230, 70, 60, a), 2, int(r * 0.7))
    # musical/shout marks + buff arrows
    for k, (x, y) in enumerate(((24, 12), (36, 22), (30, 40))):
        yy = y - t * 8
        d.polygon([(x, yy), (x + 4, yy + 5), (x - 4, yy + 5)], fill=(255, 210, 70, fade(255, t)))
        d.rectangle((x - 1, yy + 5, x + 1, yy + 9), fill=(255, 210, 70, fade(255, t)))


# ---------------- Ascension
def lions_roar(d, i, t):
    # teal shockwave arcs in a cone to the left
    for k in range(3):
        r = 8 + (t * 50 + k * 12) % 50
        a = int(240 * (1 - r / 58))
        d.arc((58 - r, 34 - r, 58 + r, 34 + r), 140, 220, fill=(80, 220, 190, a), width=3)
    for k in range(4):
        x = 50 - t * 40 - k * 3; y = 20 + k * 8
        d.point((x, y), fill=(220, 255, 240, fade(255, t)))


def crescent_iaido(d, i, t):
    if i == 0:  # telegraph line
        d.line((2, 40, 62, 40), fill=(140, 180, 255, 120), width=1)
    elif i <= 3:
        x = 62 - i * 20
        d.arc((x - 10, 20, x + 30, 60), 100, 260, fill=(220, 235, 255, 255), width=4)
        d.arc((x - 6, 24, x + 26, 56), 110, 250, fill=(120, 160, 255, 200), width=2)
        d.line((x + 10, 40, 62, 40), fill=(170, 200, 255, 140), width=1)
    else:
        a = 255 - (i - 3) * 100
        d.line((2, 40, 62, 40), fill=(230, 240, 255, a), width=2)
        for k in range(5):
            d.point((6 + k * 12, 36 + (k % 2) * 8), fill=(200, 220, 255, a))


def mirror_stance(d, i, t):
    # a pale moon disc shield with rotating glints
    a = 160 if i < 5 else 80
    d.ellipse((12, 8, 52, 56), outline=(200, 220, 255, a), width=2)
    d.ellipse((18, 14, 46, 50), fill=(150, 180, 255, 50))
    ang = t * math.pi * 2
    for k in range(3):
        x = 32 + 20 * math.cos(ang + k * 2.1); y = 32 + 24 * math.sin(ang + k * 2.1)
        star(d, x, y, 4, (240, 248, 255, 230))


def starfall(d, i, t):
    # warning circle then a falling star impact
    d.ellipse((10, 46, 54, 60), outline=(255, 120, 120, 200 if i < 3 else 90), width=1)
    if i < 3:
        y = -6 + i * 18
        star(d, 32 + (3 - i) * 4, y, 7, (255, 230, 140, 255))
        d.line((32 + (3 - i) * 4 + 6, y - 6, 32 + (3 - i) * 4 + 16, y - 16), fill=(180, 160, 255, 180), width=2)
    else:
        r = 8 + (i - 3) * 9
        d.ellipse((32 - r, 53 - r * 0.45, 32 + r, 53 + r * 0.45), fill=(255, 230, 160, 200 - (i - 3) * 60))
        star(d, 32, 44, 12 - (i - 3) * 3, (255, 250, 220, 255))


def judgement_beam(d, i, t):
    w = [2, 6, 14, 18, 12, 4][i]
    a = [150, 220, 255, 255, 200, 110][i]
    d.rectangle((32 - w, 0, 32 + w, 60), fill=(200, 180, 255, a))
    d.rectangle((32 - w // 2, 0, 32 + w // 2, 60), fill=(255, 255, 255, a))
    d.ellipse((32 - w - 8, 54, 32 + w + 8, 63), fill=(160, 140, 255, a))
    for k in range(4):
        y = (k * 17 + i * 9) % 60
        d.point((32 - w - 3, y), fill=(255, 240, 180, a)); d.point((32 + w + 3, 60 - y), fill=(255, 240, 180, a))


# ---------------- Hunt
def crystal_shell(d, i, t):
    h = min(1, t * 2.2)
    top = 60 - 50 * h
    d.polygon([(8, 60), (14, top + 10), (32, top), (50, top + 10), (56, 60)], fill=(176, 122, 232, 90), outline=(230, 208, 255, 220))
    d.line((32, top, 32, 60), fill=(230, 208, 255, 140)); d.line((14, top + 10, 50, top + 10), fill=(230, 208, 255, 110))
    if i >= 2:
        star(d, 20 + i * 4, top + 14, 3, (255, 255, 255, 220))


def devour(d, i, t):
    # big jaws chomping from top/bottom
    g = [26, 20, 10, 2, 2, 8][i]
    for k in range(6):
        x = 8 + k * 9
        d.polygon([(x, 32 - g), (x + 4, 32 - g + 8), (x + 8, 32 - g)], fill=(244, 239, 224, 255))
        d.polygon([(x, 32 + g), (x + 4, 32 + g - 8), (x + 8, 32 + g)], fill=(244, 239, 224, 255))
    d.rectangle((6, 32 - g - 4, 58, 32 - g), fill=(122, 40, 60, 255))
    d.rectangle((6, 32 + g, 58, 32 + g + 4), fill=(122, 40, 60, 255))
    if i in (3, 4):
        star(d, 32, 32, 12, (255, 220, 120, 220))


def smoke_pouch(d, i, t):
    for k, (x, y) in enumerate(((22, 40), (36, 36), (30, 26), (42, 46), (18, 30))):
        r = 4 + t * 12 + k
        a = int(200 * (1 - t * 0.7))
        d.ellipse((x - r, y - r, x + r, y + r), fill=(170, 160, 180, a))
    for k in range(4):
        x = 16 + k * 10; y = 52 - (k % 2) * 6 + t * 6
        d.ellipse((x, y, x + 5, y + 3), fill=(240, 204, 85, 255))


# ---------------- Trial
def rune_bolt(d, i, t):
    x = 56 - t * 48
    d.ellipse((x - 7, 25, x + 7, 39), fill=(127, 240, 255, 200))
    d.line((x, 27, x, 37), fill=(255, 255, 255, 255)); d.line((x - 3, 30, x + 3, 34), fill=(255, 255, 255, 255))
    for k in range(3):
        d.point((x + 9 + k * 4, 32 + (k - 1) * 3), fill=(127, 240, 255, 160 - k * 40))
    if i == 5:
        ring(d, (x, 32), 12, (127, 240, 255, 200), 2)


def page_barrier(d, i, t):
    d.ellipse((8, 6, 56, 58), fill=(255, 216, 74, 40), outline=(255, 216, 74, 180), width=1)
    ang = t * math.pi * 1.5
    for k in range(5):
        a = ang + k * math.pi * 2 / 5
        x = 32 + 22 * math.cos(a); y = 32 + 22 * math.sin(a) * 0.9
        d.polygon([(x - 4, y - 5), (x + 4, y - 4), (x + 4, y + 5), (x - 4, y + 4)], fill=(242, 232, 204, 255), outline=(154, 138, 106, 255))


def arcane_seal(d, i, t):
    r = [26, 20, 14, 12, 12, 12][i]
    a = 255 if i < 5 else 140
    ring(d, (32, 32), r, (255, 216, 74, a), 2)
    ring(d, (32, 32), max(4, r - 6), (200, 106, 255, a), 1)
    for k in range(6):
        ang = k * math.pi / 3 + t
        d.point((32 + (r - 3) * math.cos(ang), 32 + (r - 3) * math.sin(ang)), fill=(255, 255, 255, a))
    if i >= 3:  # silence mark: crossed speech bubble
        d.ellipse((24, 24, 40, 38), fill=(255, 255, 255, a))
        d.polygon([(28, 37), (30, 43), (33, 37)], fill=(255, 255, 255, a))
        d.line((25, 25, 39, 37), fill=(200, 50, 60, a), width=2)


ALL = {
    'triple_volley': triple_volley, 'rally_whistle': rally_whistle,
    'lions_roar': lions_roar, 'crescent_iaido': crescent_iaido, 'mirror_stance': mirror_stance,
    'starfall': starfall, 'judgement_beam': judgement_beam,
    'crystal_shell': crystal_shell, 'devour': devour, 'smoke_pouch': smoke_pouch,
    'rune_bolt': rune_bolt, 'page_barrier': page_barrier, 'arcane_seal': arcane_seal,
}

"""Terrain materials, island ground composite, road layer (from layout road splines), background layers."""
from __future__ import annotations

import math

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

from pixart import (BAYER4, C, DIRT, GRASS, MOSS, STONE, STONE_WARM, WATER, bayer, fbm, glow, outline, over, pad, ramp_map, value_noise)

# ------------------------------------------------------------------ materials (64×64, tileable)

T = 64


def grass_tile(seed, ramp=GRASS, shift=0.0, tufts=True):
    v = np.clip(fbm(T, T, 12, seed, 3, tile=True) * 0.42 + 0.3 + shift, 0, .999)
    a = ramp_map(v, ramp[1:5], 0.55)
    if tufts:
        rng = np.random.default_rng(seed)
        for _ in range(38):
            x, y = int(rng.integers(0, T)), int(rng.integers(1, T))
            a[y, x] = ramp[4] if rng.random() < .7 else ramp[5]
            a[(y - 1) % T, x] = ramp[3]
            a[(y + 1) % T, x] = ramp[1]
    a[..., 3] = 255
    return a


def dirt_tile(seed, shift=0.0):
    v = np.clip(fbm(T, T, 8, seed, 3, tile=True) * 0.6 + 0.2 + shift, 0, .999)
    a = ramp_map(v, DIRT[1:5], 0.8)
    rng = np.random.default_rng(seed)
    for _ in range(26):
        x, y = int(rng.integers(0, T - 1)), int(rng.integers(0, T - 1))
        a[y, x] = STONE_WARM[4]; a[y, (x + 1) % T] = STONE_WARM[3]; a[(y + 1) % T, x] = DIRT[1]
    return a


def flagstones(seed, ramp=STONE_WARM, cells=14, seam=None, size=T, grass_seams=True):
    rng = np.random.default_rng(seed)
    pts = rng.random((cells, 2)) * size
    pts = np.concatenate([pts + [dx * size, dy * size] for dx in (-1, 0, 1) for dy in (-1, 0, 1)])
    Y, X = np.mgrid[0:size, 0:size].astype(np.float32)
    dd = np.stack([np.hypot(X - px, Y - py) for px, py in pts], -1)
    srt = np.sort(dd, -1)
    idx = np.argmin(dd, -1) % cells
    tone = rng.random(cells)
    v = np.clip(0.35 + tone[idx] * 0.4 + (fbm(size, size, 3, seed, 2, tile=True) - .5) * .25, 0, .999)
    a = ramp_map(v, ramp[2:6], .6)
    s = (srt[..., 1] - srt[..., 0]) < 1.3
    a[s] = seam or ramp[1]
    if grass_seams:
        g = s & (fbm(size, size, 4, seed + 1, 2, tile=True) > .55)
        a[g] = GRASS[2]
    a[..., 3] = 255
    return a


def cliff_tile(seed, w=T, h=30):
    """vertical rock face with strata, tileable horizontally"""
    v = fbm(w, h, 6, seed, 3, tile=True)[:h] if h == w else fbm(w, w, 6, seed, 3, tile=True)[:h]
    strata = (np.sin(np.arange(h)[:, None] * 0.9 + v * 5) + 1) / 2
    shade = np.clip(0.75 - np.linspace(0, 0.6, h)[:, None] + (strata - .5) * .35 + (v - .5) * .3, 0, .999)
    cl = [C(20, 16, 24), C(34, 28, 36), C(52, 42, 48), C(74, 60, 62), C(98, 82, 78)]
    a = ramp_map(shade, cl, .7)
    a[..., 3] = 255
    return a


def ledge_tile(seed, w=T, h=10):
    a = cliff_tile(seed, w, h)
    a[0, :] = C(98, 82, 78); a[1, :] = C(74, 60, 62)
    return a


def materials():
    return {
        'grass_a': grass_tile(11), 'grass_b': grass_tile(12, shift=0.08), 'grass_dark': grass_tile(13, shift=-0.12, tufts=False),
        'grass_c': grass_tile(14, ramp=[C(24, 34, 26), C(36, 52, 34), C(50, 70, 40), C(68, 88, 48), C(88, 104, 56), C(108, 120, 64)]),
        'dirt': dirt_tile(21), 'dirt_worn': dirt_tile(22, 0.14), 'dirt_packed': dirt_tile(23),
        'stone_ground': flagstones(31, cells=18), 'mossy_stone': flagstones(32, cells=14, ramp=STONE),
        'plaza_ground': flagstones(33, cells=30), 'stone_platform': flagstones(34, cells=6, grass_seams=False),
        'cliff_edge': cliff_tile(41), 'height_transition': ledge_tile(42),
    }


def tiled(tile, w, h):
    th, tw = tile.shape[:2]
    return np.tile(tile, (h // th + 1, w // tw + 1, 1))[:h, :w]


# ------------------------------------------------------------------ geometry helpers

def poly_mask(w, h, pts):
    im = Image.new('L', (w, h), 0)
    ImageDraw.Draw(im).polygon([(round(x), round(y)) for x, y in pts], fill=255)
    return np.array(im) > 0


def catmull(points, samples=10):
    """Catmull-Rom through points (end points duplicated)"""
    P = [points[0]] + list(points) + [points[-1]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = map(np.array, (P[i - 1], P[i], P[i + 1], P[i + 2]))
        for k in range(samples):
            t = k / samples
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(np.array(points[-1]))
    return np.array(out)


def dist_to_polyline(w, h, pts):
    """exact distance field to a polyline (via rasterised line + EDT)"""
    im = Image.new('L', (w, h), 255)
    ImageDraw.Draw(im).line([tuple(p) for p in pts], fill=0, width=1)
    return ndimage.distance_transform_edt(np.array(im) > 0)


# ------------------------------------------------------------------ ground composite

def ground(L, M):
    s = L['pixelScale']
    W, H = L['world']['w'] // s, L['world']['h'] // s
    g = [(x / s, y / s) for x, y in L['ground']]
    isl = poly_mask(W, H, g)
    # grass variants by low-frequency noise (dithered boundaries)
    n = fbm(W, H, 55, 7, 3)
    n2 = fbm(W, H, 22, 9, 2)
    b = bayer(W, H) * 0.08
    ga, gb, gd, gc = (tiled(M[k], W, H) for k in ('grass_a', 'grass_b', 'grass_dark', 'grass_c'))
    out = ga.copy()
    out[(n + b) > 0.58] = gb[(n + b) > 0.58]
    out[(n + b) < 0.36] = gd[(n + b) < 0.36]
    out[((n2 + b) > 0.68) & ((n + b) > 0.45)] = gc[((n2 + b) > 0.68) & ((n + b) > 0.45)]
    # dirt patches
    dn = fbm(W, H, 18, 13, 3)
    dt = tiled(M['dirt_packed'], W, H)
    dm = (dn + b) > 0.8
    out[dm] = dt[dm]
    # edge darkening (grass near the coast is shaded)
    edge = ndimage.distance_transform_edt(isl)
    dark = (edge < 4) & isl
    out[dark] = (out[dark].astype(int) * 0.72).astype(np.uint8)
    out[..., 3] = np.where(isl, 255, 0)
    # plateau: lighter grass + south-facing ledge
    pl = poly_mask(W, H, [(x / s, y / s) for x, y in L['plateau']])
    lift = pl & isl
    out[lift, :3] = np.clip(out[lift, :3].astype(int) * 1.08 + 4, 0, 255).astype(np.uint8)
    ledge = tiled(cliff_tile(43, 64, 64), W, H)
    below = ~np.roll(pl, -1, 0) & pl  # bottom boundary pixels
    ys, xs = np.where(below)
    face_h = 9
    for x, y in zip(xs, ys):
        hh = face_h + int(value_noise(W, 1, 8, 3)[0, x] * 3)
        for k in range(1, hh):
            if y + k < H and not pl[y + k, x]:
                out[y + k, x] = ledge[min(63, k * 5), x % 64]
                out[y + k, x, 3] = 255
        if y + hh < H: out[y + hh, x] = C(18, 14, 22)
    # plateau rim highlight
    out[below & isl] = C(120, 150, 80)
    # stream bed (water animates on its own layer)
    st = L['stream']
    sp = catmull([(x / s, y / s) for x, y in st['points']], 12)
    dist = dist_to_polyline(W, H, sp)
    half = st['width'] / s / 2
    bank = (dist <= half + 2) & isl
    bed = (dist <= half) & isl
    out[bank] = C(40, 34, 30)
    out[(dist <= half + 1) & isl & ~bed] = C(58, 48, 40)
    out[bed] = WATER[1]
    # bank stones
    rng = np.random.default_rng(3)
    ys, xs = np.where(bank & ~bed)
    for i in rng.choice(len(xs), min(len(xs), 90), replace=False):
        out[ys[i], xs[i]] = STONE[3]
    # cliff face under the island (it floats): depth varies, bottom tapers into hanging rocks
    cliff = tiled(cliff_tile(44, 64, 64), W, H + 64)
    col_bottom = np.full(W, -1)
    for x in range(W):
        yy = np.where(isl[:, x])[0]
        if len(yy): col_bottom[x] = yy[-1]
    depth_n = fbm(W, 1, 14, 5, 3)[0]
    face = np.zeros((H, W), bool)
    for x in range(W):
        yb = col_bottom[x]
        if yb < 0: continue
        dep = int(16 + depth_n[x] * 26 + (8 if 190 < x < 420 else 0))
        for k in range(1, dep):
            y = yb + k
            if y >= H: break
            c = cliff[k + (x % 7), x].copy()
            t = k / dep
            c[:3] = (c[:3].astype(int) * (1 - t * 0.6)).astype(np.uint8)
            out[y, x] = c
            face[y, x] = True
        # dark rim at the lip
        out[yb, x] = (out[yb, x].astype(int) * 0.6).astype(np.uint8); out[yb, x, 3] = 255
    # hanging rock spikes under the cliff
    for x0 in rng.choice(np.where(col_bottom > 0)[0], 26, replace=False):
        yb = col_bottom[x0]
        top = yb + 14
        ln = int(rng.integers(6, 18)); wd = int(rng.integers(2, 5))
        for k in range(ln):
            half_w = max(0, int(wd * (1 - k / ln)))
            for dx in range(-half_w, half_w + 1):
                x, y = x0 + dx, top + k
                if 0 <= x < W and 0 <= y < H and out[y - 1, x, 3] > 0:
                    out[y, x] = C(30 + 6 * (dx < 0), 24, 32); out[y, x, 3] = 255
    # moss / roots dripping over the lip
    for x in range(W):
        yb = col_bottom[x]
        if yb < 0: continue
        if depth_n[x] > 0.35 and (x * 7 + 3) % 5 < 2:
            for k in range(1, 3 + (x % 4)):
                if yb + k < H: out[yb + k, x] = MOSS[1 + (k % 2)]
    # top rim: dark grass line along the island's upper edge
    top_edge = isl & ~np.roll(isl, 1, 0)
    out[top_edge] = GRASS[1]
    return out


def waterfall_sheet(L, frames=6):
    """where the stream pours off the island edge"""
    s = L['pixelScale']
    x_end, y_end = L['stream']['points'][-1]
    w, h = 18, 52
    out = []
    for f in range(frames):
        a = np.zeros((h, w, 4), np.uint8)
        for y in range(h):
            spread = 5 + y * 0.08
            for x in range(w):
                d = abs(x - w / 2) / spread
                if d > 1: continue
                streak = (math.sin(x * 2.1 + (y - f * 4) * 0.7) + 1) / 2
                c = WATER[5] if streak > 0.85 else WATER[4] if streak > 0.45 else WATER[3]
                al = int(255 * (1 - y / h) ** 0.7 * (1 - d * 0.6))
                a[y, x] = (*c[:3], al)
        out.append(a)
    from pixart import strip
    return strip(out)


def stream_water(L, frames=4):
    from gen_fx_props import water_sheet
    s = L['pixelScale']
    xs = [p[0] / s for p in L['stream']['points']]; ys = [p[1] / s for p in L['stream']['points']]
    x0, x1 = int(min(xs)) - 10, int(max(xs)) + 10
    y0, y1 = int(min(ys)) - 2, int(max(ys)) + 2
    w, h = x1 - x0, y1 - y0
    sp = catmull([(x / s - x0, y / s - y0) for x, y in L['stream']['points']], 12)
    dist = dist_to_polyline(w, h, sp)
    m = dist <= L['stream']['width'] / s / 2
    W, H = L['world']['w'] // s, L['world']['h'] // s
    isl = poly_mask(W, H, [(x / s, y / s) for x, y in L['ground']])[y0:y1, x0:x1]
    m &= isl[:m.shape[0], :m.shape[1]]
    return water_sheet(w, h, m, frames, seed=12), (x0, y0)


# ------------------------------------------------------------------ roads (layer from the layout's road splines)

ROAD_W = {'MAIN': 1.3, 'SECONDARY': 1.15, 'TRAIL': 1.0, 'BROKEN': 1.0}


def road_layer(L, M):
    s = L['pixelScale']
    W, H = L['world']['w'] // s, L['world']['h'] // s
    N = {n['id']: (n['x'] / s, n['y'] / s) for n in L['nodes']}
    out = np.zeros((H, W, 4), np.uint8)
    dirt = tiled(M['dirt'], W, H); worn = tiled(M['dirt_worn'], W, H)
    edge_n = fbm(W, H, 3, 17, 2)
    patch_n = fbm(W, H, 9, 19, 2)
    b = bayer(W, H) * 0.1
    rng = np.random.default_rng(5)
    stair_masks = []
    for r in L['roads']:
        pts = [N[k] for k in r['nodes']]
        sp = catmull(pts, 14)
        dist = dist_to_polyline(W, H, sp)
        half = r['width'] / s / 2 * ROAD_W[r['kind']]
        wobble = (edge_n - 0.5) * 3.2 + (patch_n - 0.5) * half * 0.5
        m = dist <= half + wobble
        # dithered, grass-eaten verge
        m &= ~((dist > half + wobble - 1.6) & (b * 10 + edge_n > 0.95))
        if r['kind'] in ('TRAIL', 'BROKEN'):
            m &= (patch_n + b) > (0.36 if r['kind'] == 'TRAIL' else 0.46)
        # bridges are a sprite → no dirt over the water
        for a_, b_ in r.get('bridges', []):
            seg = dist_to_polyline(W, H, catmull([N[a_], N[b_]], 4))
            m &= ~(seg <= half + 3)
        # stairs segments
        for a_, b_ in r.get('stairs', []):
            pa, pb = np.array(N[a_]), np.array(N[b_])
            seg = dist_to_polyline(W, H, [tuple(pa), tuple(pb)])
            stair_masks.append(((seg <= half + 0.5), pa, pb))
        tone = np.clip(1 - dist / max(1, half), 0, 1)
        layer = np.where((tone[..., None] + b[..., None] * 2) > 0.38, worn, dirt)
        # darker verges
        verge = m & (dist > half - 1.5 + wobble)
        layer[verge, :3] = (layer[verge, :3].astype(int) * 0.72).astype(np.uint8)
        out[m] = layer[m]
        # grass tufts invading the edges
        tuft = m & (dist > half - 2.5 + wobble) & (edge_n > 0.62)
        out[tuft] = GRASS[3]
        # embedded stones on main roads
        if r['kind'] == 'MAIN':
            ys, xs = np.where(m & (dist < half - 1))
            for i in rng.choice(len(xs), min(len(xs), int(len(xs) * 0.02)), replace=False):
                y, x = ys[i], xs[i]
                out[y, x] = STONE_WARM[4]; out[y, min(W - 1, x + 1)] = STONE_WARM[3]
                if y + 1 < H: out[y + 1, x] = STONE_WARM[1]
    # plazas (flagstones with grassy, irregular rims)
    fl = tiled(M['plaza_ground'], W, H)
    for pz in L['plazas']:
        pm = poly_mask(W, H, [(x / s, y / s) for x, y in pz['points']])
        dd = ndimage.distance_transform_edt(pm)
        pm &= (dd + (edge_n - .5) * 4) > 1.2
        out[pm] = fl[pm]
        rim = pm & (dd < 2.2)
        out[rim, :3] = (out[rim, :3].astype(int) * 0.75).astype(np.uint8)
    # stone stairs
    for (m, pa, pb) in stair_masks:
        d = pb - pa; L2 = np.hypot(*d); u = d / L2
        Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
        t = ((X - pa[0]) * u[0] + (Y - pa[1]) * u[1])
        step = (t.astype(int) // 3) % 2 == 0
        riser = (t.astype(int) % 3) == 0
        out[m] = np.where(step[m][:, None], np.array(STONE_WARM[4]), np.array(STONE_WARM[3]))
        out[m & riser] = STONE_WARM[1]
    return out


def road_piece(kind, seed=3):
    """small modular road pieces (for hand-placed / future theme maps) drawn with the same brush"""
    M = {'dirt': dirt_tile(21), 'dirt_worn': dirt_tile(22, 0.14), 'plaza_ground': flagstones(33, cells=30)}
    w, h = 64, 48
    shapes = {
        'curve_left': [(0, 40), (22, 36), (36, 20), (40, 0)],
        'curve_right': [(64, 40), (42, 36), (28, 20), (24, 0)],
        's_curve': [(0, 30), (18, 34), (32, 24), (46, 14), (64, 18)],
        'sharp_curve': [(0, 36), (30, 38), (38, 24), (34, 0)],
        'diagonal_ne': [(4, 46), (60, 2)],
        'diagonal_nw': [(60, 46), (4, 2)],
        'plaza_connector': [(0, 24), (64, 24)],
        'narrow_trail': [(0, 30), (20, 24), (40, 28), (64, 20)],
        'fork_30': [(0, 30), (30, 26), (64, 18)],
        'fork_45': [(0, 30), (30, 26), (64, 36)],
        'junction_irregular': [(0, 28), (30, 26), (50, 40)],
        'stair_path': [(32, 48), (32, 0)],
        'bridge_entrance': [(0, 26), (40, 24)],
        'road_end': [(0, 26), (40, 26)],
        'broken_road': [(0, 26), (64, 22)],
    }
    pts = shapes[kind]
    L = {'pixelScale': 1, 'world': {'w': w, 'h': h}, 'nodes': [{'id': str(i), 'x': x, 'y': y} for i, (x, y) in enumerate(pts)],
         'roads': [{'id': kind, 'kind': 'TRAIL' if kind in ('narrow_trail',) else 'BROKEN' if kind == 'broken_road' else 'MAIN',
                    'width': 8 if kind == 'narrow_trail' else 14 if kind != 'plaza_connector' else 22, 'nodes': [str(i) for i in range(len(pts))],
                    **({'stairs': [['0', '1']]} if kind == 'stair_path' else {})}],
         'plazas': []}
    if kind.startswith('fork') or kind == 'junction_irregular':
        L['nodes'].append({'id': 'b', 'x': 64 if kind != 'junction_irregular' else 36, 'y': 46 if kind == 'fork_30' else 4 if kind == 'fork_45' else 0})
        L['roads'].append({'id': 'b', 'kind': 'SECONDARY', 'width': 12, 'nodes': ['1', 'b']})
    return road_layer(L, M)


# ------------------------------------------------------------------ background layers

def sky(W, H):
    Y = np.linspace(0, 1, H)[:, None].repeat(W, 1)
    stops = [(0.0, (10, 8, 26)), (0.18, (22, 18, 48)), (0.3, (48, 38, 82)), (0.36, (96, 70, 96)), (0.4, (60, 58, 92)), (0.55, (26, 32, 54)), (1.0, (10, 12, 22))]
    rgb = np.zeros((H, W, 3), np.float32)
    for (t0, c0), (t1, c1) in zip(stops, stops[1:]):
        m = (Y >= t0) & (Y <= t1)
        k = ((Y - t0) / (t1 - t0))[..., None]
        rgb = np.where(m[..., None], np.array(c0) * (1 - k) + np.array(c1) * k, rgb)
    # banding (retro) — quantize with dithering
    q = 10.0
    rgb = np.floor(rgb / q + bayer(W, H)[..., None] * 0.9 + 0.5) * q
    a = np.zeros((H, W, 4), np.uint8)
    a[..., :3] = np.clip(rgb, 0, 255).astype(np.uint8); a[..., 3] = 255
    rng = np.random.default_rng(1)
    for _ in range(170):
        x, y = int(rng.integers(0, W)), int(rng.integers(0, int(H * 0.3)))
        v = int(rng.integers(120, 230)); a[y, x, :3] = (v, v, min(255, v + 20))
    # moon behind thin cloud
    mg = glow(W, H, W * 0.8, H * 0.1, 22, (220, 210, 240), 0.35, 1.4)
    a = over(a, mg)
    Yy, Xx = np.mgrid[0:H, 0:W]
    moon = (Xx - W * 0.8) ** 2 + (Yy - H * 0.1) ** 2 <= 36
    a[moon, :3] = (226, 222, 236)
    a[moon & ((Xx - W * 0.8 - 2) ** 2 + (Yy - H * 0.1 + 1) ** 2 <= 20), :3] = (200, 196, 220)
    return a


def mountains(W, h=90, seed=3):
    a = np.zeros((h, W, 4), np.uint8)
    for layer, (base, amp, col, rim) in enumerate([(30, 50, (50, 48, 84), (86, 76, 118)), (52, 34, (34, 34, 60), (60, 58, 92))]):
        n = fbm(W, 1, 40 - layer * 12, seed + layer, 4)[0]
        peaks = np.abs(np.sin(np.arange(W) * (0.021 + layer * 0.013) + seed)) ** 3
        top = (base + (1 - n) * amp * 0.6 - peaks * amp * 0.5).astype(int)
        for x in range(W):
            t = max(0, top[x])
            a[t:, x, :3] = col; a[t:, x, 3] = 255
            a[t, x, :3] = rim
            if x > 0 and top[x - 1] > top[x]: a[t:t + 2, x, :3] = rim
    return a


def forest_far(W, h=64, seed=5):
    a = np.zeros((h, W, 4), np.uint8)
    rng = np.random.default_rng(seed)
    cols = [(18, 30, 34), (24, 40, 42), (30, 50, 48)]
    for layer in range(3):
        x = int(rng.integers(0, 8))
        while x < W + 10:
            r = int(rng.integers(5, 11)) + (3 - layer) * 2
            cy = int(h - 10 - rng.integers(0, 8) - (2 - layer) * 8 + r * 0.2)
            big = rng.random() < 0.06
            if big: r += 7
            Y, X = np.ogrid[0:h, 0:W]
            m = ((X - x) ** 2) / (r * r) + ((Y - cy) ** 2) / ((r * 1.2) ** 2) <= 1
            m[cy:, max(0, x - r):x + r] = True
            a[m, :3] = cols[layer]; a[m, 3] = 255
            # rim light top-left
            rim = m & ~np.roll(m, 1, 0) & (X < x)
            a[rim, :3] = tuple(min(255, c + 22) for c in cols[layer])
            x += int(r * 1.3)
    return a


def mist_band(W, h=40):
    a = np.zeros((h, W, 4), np.uint8)
    n = fbm(W, h, 16, 4, 3)
    v = np.clip((1 - np.abs(np.linspace(-1, 1, h))[:, None]) * 0.9 * (0.5 + n), 0, 1)
    v = np.floor(v * 6 + bayer(W, h) * 0.8) / 6
    a[..., :3] = (120, 120, 160); a[..., 3] = np.clip(v * 110, 0, 255).astype(np.uint8)
    return a


def fore_branch(seed=2, flip=False):
    """leafy branch hanging into the top corner of the frame (foreground)"""
    from gen_nature import crown
    from pixart import LEAF
    w, h = 120, 60
    a = np.zeros((h, w, 4), np.uint8)
    im = Image.fromarray(a); d = ImageDraw.Draw(im)
    d.line([(0, 6), (40, 14), (80, 10), (118, 22)], fill=(40, 26, 24, 255), width=4)
    a = np.array(im)
    sph = [(20, 18, 16, 10), (46, 24, 18, 12), (74, 20, 15, 10), (100, 30, 14, 10), (60, 36, 10, 8), (30, 32, 12, 8)]
    darkleaf = [C(8, 16, 20), C(14, 28, 30), C(22, 44, 40), C(34, 64, 50), C(52, 86, 60), C(80, 112, 72)]
    a = over(a, crown(w, h, sph, darkleaf, seed, tex=.25))
    a = outline(a, C(6, 8, 12))
    return a[:, ::-1] if flip else a


def fore_grass(seed=4, w=90, h=26):
    rng = np.random.default_rng(seed)
    a = np.zeros((h, w, 4), np.uint8)
    for i in range(70):
        x = rng.random() * w; hh = rng.integers(8, h); bend = rng.random() * 5 - 2.5
        for k in range(int(hh)):
            t = k / hh
            xx, yy = int(x + bend * t * t), h - 1 - k
            if 0 <= xx < w: a[yy, xx] = (C(18, 34, 26) if t < .5 else C(30, 54, 36) if t < .85 else C(52, 84, 50))
    return a

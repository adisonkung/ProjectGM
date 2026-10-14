"""Sprite Normalization — keep a character the same size across all of its animations.

Problem: each animation of a hero comes from a different source sheet (base / S1 / S2 / Ult …), drawn and downscaled
separately, so the body is a little bigger or smaller per animation and the character visibly grows / shrinks when an
action or skill starts. This tool measures every animation against ONE reference frame, scales each animation by a
single factor (all its frames together — never per frame, so the motion inside the clip is untouched), and re-packs
everything on a standard canvas with a fixed pivot.

Pipeline (per config, tools/sprites/normalize/<id>.json):
  1. frames   — from the game atlas (`source.type = "atlas"`: cell grid, rows from the config) or from a raw sheet
                (`"sheet"`: verified boxes per frame, or `"grid"`: cols × rows of a fixed cell)
  2. key      — raw sheets: magenta (#FF00FF ± tolerance) → transparent + magenta spill on edges removed
  3. measure  — size of each animation relative to the reference frame (`reference: {anim, frame}`):
                  sift   feature matching (OpenCV SIFT, RANSAC similarity) of every frame vs the reference → median
                         scale weighted by inliers (pose-independent: head / armour / weapon details match)
                  area   √(body area / reference body area) of the opened silhouette (no thin weapons / hair)
                  height opened-silhouette height of the animation's own reference frame (`ref`) vs the reference
                `scale` in the config overrides the measurement (a number = the factor to apply)
  4. resize   — every frame of an animation × the same factor (shrink = area average, enlarge = Lanczos, alpha
                hardened again so pixel-art edges stay crisp) about the pivot
  5. canvas   — each frame on a standard cell (`canvas.cell`) with the feet at `canvas.pivot`
  6. export   — atlas (same layout as the game sheet), one PNG per frame, report.json / report.md
  7. preview  — GIF per animation: BEFORE | AFTER, idle → action → idle, with the reference head line and pivot, so a
                size jump between animations is visible at a glance; plus compare.png (all animations side by side)

Usage:
  python3 tools/sprites/normalize.py init <hero-id>      # config from the game's SHEETS (src/app/core/data/sprites.ts)
  python3 tools/sprites/normalize.py run <hero-id|config.json> [--write] [--metric sift|area|height]
      without --write: outputs go to art/normalized/<id>/ only (game files untouched)
      with --write:    the game atlas (public/sprites/hero-<id>.png) is replaced by the normalized one
  python3 tools/sprites/normalize.py audit [ids…]        # measure only: one table for every hero, nothing written

Needs numpy, Pillow, scipy; OpenCV (`pip install opencv-python`) for the sift metric — without it, area is used.
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

try:
    import cv2
except ImportError:  # area metric only
    cv2 = None

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CONF_DIR = os.path.join(ROOT, 'tools', 'sprites', 'normalize')
SPRITES_TS = os.path.join(ROOT, 'src', 'app', 'core', 'data', 'sprites.ts')
ANIMS = ['idle', 'walk', 'hurt', 'attack', 'die', 'skill', 'skill2', 'ult']
ALPHA_CUT = 96          # alpha below = transparent after resampling (crisp pixel-art edges)
DEADBAND = 0.03         # |factor − 1| below this = leave the animation untouched
CLAMP = (0.7, 1.4)
POSE_ANIMS = {'die'}    # body lies down: never measured, follows the base factor (1.0 in atlas mode)


# ---------------------------------------------------------------- config

def ts_sheet(sheet):
    """cell size + rows/frames/ms of one SHEETS entry in sprites.ts"""
    src = open(SPRITES_TS, encoding='utf-8').read()
    i = src.index(f"'{sheet}': {{")
    blk = src[i:src.index('\n  },', i)]
    head = re.search(r'cols: (\d+), rows: (\d+)(?:, cellW: (\d+))?(?:, cellH: (\d+))?', blk)
    cw = int(head.group(3) or 132)
    ch = int(head.group(4) or 100)
    anims = {}
    for a in ANIMS:
        m = re.search(rf'\n\s+{a}: \{{(.*?)\n?\s*\}}?,?\n', blk, re.S)
        if not m:
            continue
        body = blk[m.start():m.start() + 400]
        r = re.search(r'row: (\d+), frames: (\d+)', body)
        if not r:
            continue
        line = body[r.start():body.index('\n', r.start()) if '\n' in body[r.start():] else len(body)]
        ms = re.search(r'^row: \d+, frames: \d+, ms: (\d+)', line)
        anims[a] = {'row': int(r.group(1)), 'frames': int(r.group(2)), 'ms': int(ms.group(1)) if ms else (150 if a == 'idle' else 90)}
    return cw, ch, anims


def init(hid):
    sheet = f'hero-{hid}.png'
    cw, ch, anims = ts_sheet(sheet)
    pivot = [cw // 2, ch - 15]
    for a in anims.values():
        a['scale'] = 'auto'
    for a in POSE_ANIMS & anims.keys():
        anims[a]['scale'] = 'follow'
    conf = {
        'id': hid,
        'source': {'type': 'atlas', 'file': f'public/sprites/{sheet}', 'cell': [cw, ch]},
        'canvas': {'cell': [cw, ch], 'pivot': pivot},
        'reference': {'anim': 'idle', 'frame': 0},
        'metric': 'edge',
        'anims': anims,
        'output': {'dir': f'art/normalized/{hid}', 'atlas': f'public/sprites/{sheet}'},
    }
    os.makedirs(CONF_DIR, exist_ok=True)
    path = os.path.join(CONF_DIR, f'{hid}.json')
    json.dump(conf, open(path, 'w'), indent=2, ensure_ascii=False)
    print('wrote', os.path.relpath(path, ROOT))
    return path


def load_conf(arg):
    path = arg if arg.endswith('.json') else os.path.join(CONF_DIR, f'{arg}.json')
    if not os.path.exists(path) and not arg.endswith('.json'):
        path = init(arg)
    return json.load(open(path, encoding='utf-8'))


# ---------------------------------------------------------------- 1–2 frames + magenta key

def hexrgb(s):
    s = s.lstrip('#')
    return tuple(int(s[i:i + 2], 16) for i in (0, 2, 4))


def key_magenta(im, key='#FF00FF', tol=90):
    """chroma key + spill: pixels near the key colour → transparent; pink-tinted anti-aliased edges → transparent"""
    a = im.astype(np.int16)
    kr, kg, kb = hexrgb(key)
    d = np.abs(a[..., 0] - kr) + np.abs(a[..., 1] - kg) + np.abs(a[..., 2] - kb)
    out = im.copy()
    out[d < tol, 3] = 0
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    spill = (out[..., 3] > 0) & (r - g > 60) & (b - g > 60) & (np.abs(r - b) < 60)
    out[spill, 3] = 0
    return out


def extract(conf):
    """{anim: [RGBA frame]} — atlas frames already sit at the pivot; sheet / grid frames are cropped tight"""
    s = conf['source']
    im = np.array(Image.open(os.path.join(ROOT, s['file'])).convert('RGBA'))
    if s['type'] != 'atlas':
        im = key_magenta(im, s.get('key', '#FF00FF'), s.get('keyTolerance', 90))
    out = {}
    for name, a in conf['anims'].items():
        fr = []
        if s['type'] == 'atlas':
            cw, ch = s['cell']
            for f in range(a['frames']):
                fr.append(im[a['row'] * ch:(a['row'] + 1) * ch, f * cw:(f + 1) * cw].copy())
        elif s['type'] == 'sheet':
            for x, y, w, h in s['boxes'][name]:
                fr.append(im[y:y + h, x:x + w].copy())
        else:  # grid
            g = s['grid']
            cw, ch = g['cell']
            ox, oy = g.get('origin', [0, 0])
            for f in range(a['frames']):
                fr.append(im[oy + a['row'] * ch:oy + (a['row'] + 1) * ch, ox + f * cw:ox + (f + 1) * cw].copy())
        out[name] = fr
    return out


# ---------------------------------------------------------------- 3 measure

def body_mask(fr, k=5):
    """main body: opaque, thin parts (spear shafts, hair strands, sparks) opened away, largest blob"""
    m = fr[..., 3] > 60
    if not m.any():
        return m
    o = ndimage.binary_opening(m, structure=np.ones((k, k)))
    if not o.any():
        o = m
    lab, n = ndimage.label(o)
    if n > 1:
        sizes = ndimage.sum(o, lab, range(1, n + 1))
        o = lab == (np.argmax(sizes) + 1)
    return o


def feet(fr):
    """pivot of a loose frame: bottom of the body, x = centre of its lowest 15 %"""
    m = body_mask(fr)
    ys, xs = np.nonzero(m)
    y1 = ys.max()
    low = ys >= y1 - max(3, int((y1 - ys.min()) * 0.15))
    return float(xs[low].mean()), float(y1)


_sift = None


def _features(fr, up=4):
    global _sift
    if _sift is None:
        _sift = cv2.SIFT_create(contrastThreshold=0.02)
    a = fr[..., 3:] / 255.0
    g = (fr[..., :3] * a + 128 * (1 - a)).astype(np.uint8)
    g = cv2.resize(g, None, fx=up, fy=up, interpolation=cv2.INTER_NEAREST)
    m = cv2.resize((fr[..., 3] > 60).astype(np.uint8) * 255, None, fx=up, fy=up, interpolation=cv2.INTER_NEAREST)
    return _sift.detectAndCompute(cv2.cvtColor(g, cv2.COLOR_RGB2GRAY), m)


UPS = (3, 4, 5, 6)   # the art is small: SIFT on several upsamplings, median → much less noise than one pass


def ref_features(fr):
    return {u: _features(fr, u) for u in UPS}


def sift_scale(ref_feat, fr):
    """(scale of fr relative to the reference, RANSAC inliers) — median over the upsamplings; None when the frames
    share too little detail"""
    vals, inl = [], 0
    for u in UPS:
        k1, d1 = ref_feat[u]
        k2, d2 = _features(fr, u)
        if d1 is None or d2 is None or len(k2) < 4:
            continue
        pairs = cv2.BFMatcher().knnMatch(d1, d2, k=2)
        good = [p[0] for p in pairs if len(p) == 2 and p[0].distance < 0.8 * p[1].distance]
        if len(good) < 4:
            continue
        p1 = np.float32([k1[m.queryIdx].pt for m in good])
        p2 = np.float32([k2[m.trainIdx].pt for m in good])
        M, ok = cv2.estimateAffinePartial2D(p1, p2, method=cv2.RANSAC, ransacReprojThreshold=1.5 * u)
        if M is None:
            continue
        vals.append(float(np.hypot(M[0, 0], M[1, 0])))
        inl += int(ok.sum())
    if len(vals) < 2:
        return None, inl // max(1, len(UPS))
    return float(np.median(vals)), inl // len(UPS)


def weighted_median(vals, w):
    o = np.argsort(vals)
    v, w = np.asarray(vals)[o], np.asarray(w, float)[o]
    c = np.cumsum(w)
    return float(v[np.searchsorted(c, c[-1] / 2)])


BASE_GROUP = {'idle', 'walk', 'hurt', 'attack', 'die'}


def group_of(name, a):
    """rows cut from the same source sheet share one scale by construction → measured and scaled together"""
    return a.get('group', 'base' if name in BASE_GROUP else name)


def edge_height(fr):
    m = body_mask(fr)
    yy = np.nonzero(m)[0]
    return yy.max() - yy.min() + 1 if len(yy) else 0


def measure(frames, conf, metric):
    """{anim: {size, confidence, method, …}} — size = how big the animation draws the body vs the reference.

    metric 'edge' (default): the size jump shows where an action starts / ends, and an action's first and last frames
    stand in the same ready stance as the reference idle → compare those frames with two independent measures:
      sift   feature-matching scale (details: head, armour, weapon)        weighted by RANSAC inliers
      height opened-silhouette height (the stance is the same, so height ≈ size)
    agree within 4 % = high, 8 % = medium (mean used); disagree = low → no change unless sift is very sure, so the
    previews / report show it for a manual `scale` in the config. Every animation of one source-sheet group (`group`,
    default: idle/walk/hurt/attack/die = 'base') gets the group's size — poses differ, the drawing scale does not.
    metric 'sift' / 'area' / 'height': the older per-animation measures (all frames) for comparison."""
    rname, rf = conf['reference']['anim'], conf['reference']['frame']
    ref = frames[rname][rf]
    rheight = edge_height(ref)
    rarea = body_mask(ref).sum()
    use_sift = metric in ('sift', 'edge') and cv2 is not None
    ref_feat = ref_features(ref) if use_sift else None
    anims = conf['anims']
    rgroup = group_of(rname, anims[rname])
    out = {}
    if metric == 'edge':
        groups = {}
        for name in frames:
            groups.setdefault(group_of(name, anims[name]), []).append(name)
        for g, names in groups.items():
            if g == rgroup:
                for n in names:
                    out[n] = {'size': 1.0, 'confidence': 'reference', 'method': f'group {g}'}
                continue
            sv, sw, hv, det = [], [], [], []
            for n in names:
                if anims[n].get('scale') == 'follow':
                    continue
                fr = frames[n]
                for i in sorted({0, len(fr) - 1} | set(anims[n].get('edges', []))):
                    s, k = sift_scale(ref_feat, fr[i]) if use_sift else (None, 0)
                    h = edge_height(fr[i]) / rheight
                    det.append((f'{n}#{i}: sift {s:.2f}/{k}' if s else f'{n}#{i}: sift -/{k}') + f' h {h:.2f}')
                    hv.append(h)
                    if s and k >= 6 and 0.5 < s < 1.8:
                        sv.append(s)
                        sw.append(k)
            # few matches on the edge frames → add every frame of the group (more detail, some pose bias)
            if use_sift and sum(sw) < 20:
                for n in names:
                    if anims[n].get('scale') == 'follow':
                        continue
                    for i, f in enumerate(frames[n][1:-1], 1):
                        s, k = sift_scale(ref_feat, f)
                        if s and k >= 6 and 0.5 < s < 1.8:
                            sv.append(s)
                            sw.append(k * 0.5)
                            det.append(f'{n}#{i}: sift {s:.2f}/{k} (all-frames)')
            hs = float(np.median(hv)) if hv else None
            if len(sv) >= 3:
                # drop outliers (a frame matched to the wrong part) — > 0.15 away from the median
                med = float(np.median(sv))
                keep = [i for i, v in enumerate(sv) if abs(v - med) <= 0.15]
                det.append(f'dropped {len(sv) - len(keep)} outlier(s) around median {med:.2f}')
                sv, sw = [sv[i] for i in keep], [sw[i] for i in keep]
            if sv:
                w = np.asarray(sw, float)
                ss = float(np.average(sv, weights=w))
                spread = float(np.sqrt(np.average((np.asarray(sv) - ss) ** 2, weights=w)))
                tot = float(w.sum())
                lv = 'high' if tot >= 40 and spread <= 0.04 else 'medium' if (tot >= 18 and spread <= 0.08) or (tot >= 12 and spread <= 0.05) else 'low'
                size = ss if lv != 'low' else None
            else:
                ss, spread, tot, lv = None, None, 0, 'low'
                size = hs if not use_sift else None
            for n in names:
                if anims[n].get('scale') == 'follow':
                    out[n] = {'size': None, 'confidence': 'follow', 'method': 'follow'}
                    continue
                out[n] = {'size': size, 'confidence': lv, 'method': f'edge (group {g})',
                          'sift': None if ss is None else round(ss, 3), 'spread': None if spread is None else round(spread, 3),
                          'height': None if hs is None else round(hs, 3), 'inliers': int(tot), 'detail': det}
        return out
    for name, fr in frames.items():
        a = anims[name]
        if a.get('scale') == 'follow':
            out[name] = {'size': None, 'confidence': 'follow', 'method': 'follow'}
            continue
        if name == rname:
            out[name] = {'size': 1.0, 'confidence': 'reference', 'method': 'reference'}
            continue
        areas = [body_mask(f).sum() for f in fr if f[..., 3].any()]
        area_size = float(np.sqrt(np.median(areas) / rarea)) if areas else 1.0
        if metric == 'height':
            out[name] = {'size': edge_height(fr[a.get('ref', 0)]) / rheight, 'confidence': 'pose-dependent', 'method': 'height'}
        elif use_sift:
            res = [sift_scale(ref_feat, f) for f in fr]
            ok = [(s, n) for s, n in res if s and n >= 8 and 0.5 < s < 1.8]
            if len(ok) >= max(2, len(fr) // 3):
                size = weighted_median([s for s, _ in ok], [n for _, n in ok])
                out[name] = {'size': size, 'confidence': 'pose-dependent', 'method': 'sift (all frames)', 'area': area_size}
            else:
                out[name] = {'size': area_size, 'confidence': 'low', 'method': 'area (sift: too few matches)'}
        else:
            out[name] = {'size': area_size, 'confidence': 'pose-dependent', 'method': 'area'}
    return out


def factors(meas, conf):
    """factor applied to each animation (1 / measured size), with overrides, dead band and clamp"""
    out = {}
    for name, a in conf['anims'].items():
        s = a.get('scale', 'auto')
        if isinstance(s, (int, float)):
            out[name] = float(s)
            continue
        m = meas[name]
        if s == 'follow' or m['size'] is None:
            out[name] = 1.0
            continue
        f = 1.0 / m['size']
        f = min(max(f, CLAMP[0]), CLAMP[1])
        out[name] = 1.0 if abs(f - 1) < DEADBAND else round(f, 3)
    return out


# ---------------------------------------------------------------- 4–5 resize + canvas

def rescale(fr, f, pivot):
    """scale a cell-sized frame by f about pivot (x, y), back onto a cell of the same size"""
    if abs(f - 1) < 1e-6:
        return fr.copy()
    h, w = fr.shape[:2]
    nw, nh = max(1, round(w * f)), max(1, round(h * f))
    # premultiplied alpha so transparent pixels never bleed their colour into the edges
    pm = fr.astype(np.float32)
    pm[..., :3] *= pm[..., 3:] / 255.0
    img = Image.fromarray(pm.clip(0, 255).astype(np.uint8), 'RGBA')
    res = Image.BOX if f < 1 else Image.LANCZOS
    big = np.array(img.resize((nw, nh), res)).astype(np.float32)
    al = big[..., 3:]
    big[..., :3] = np.where(al > 0, big[..., :3] * 255.0 / np.maximum(al, 1), 0)
    big[..., 3] = np.where(big[..., 3] >= ALPHA_CUT, 255, 0)
    big = big.clip(0, 255).astype(np.uint8)
    out = np.zeros_like(fr)
    px, py = pivot
    ox, oy = round(px - px * f), round(py - py * f)       # where the scaled image's (0,0) lands
    x0, y0 = max(0, ox), max(0, oy)
    x1, y1 = min(w, ox + nw), min(h, oy + nh)
    out[y0:y1, x0:x1] = big[y0 - oy:y1 - oy, x0 - ox:x1 - ox]
    clipped = (big[..., 3] > 0).sum() - (out[..., 3] > 0).sum()
    return out, int(clipped)


def place(fr, f, cell, pivot, src_pivot=None):
    """loose frame (sheet / grid source) → scaled by f, pasted with its feet on the canvas pivot"""
    fx, fy = src_pivot or feet(fr)
    h, w = fr.shape[:2]
    canvas = np.zeros((cell[1], cell[0], 4), np.uint8)
    pad = np.zeros((h * 3, w * 3, 4), np.uint8)
    pad[h:2 * h, w:2 * w] = fr
    scaled, _ = rescale(pad, f, (fx + w, fy + h))
    # the feet are now at (fx + w, fy + h) of `scaled`; copy the window around them
    cx, cy = round(fx + w - pivot[0]), round(fy + h - pivot[1])
    sx0, sy0 = max(0, cx), max(0, cy)
    sx1, sy1 = min(scaled.shape[1], cx + cell[0]), min(scaled.shape[0], cy + cell[1])
    canvas[sy0 - cy:sy1 - cy, sx0 - cx:sx1 - cx] = scaled[sy0:sy1, sx0:sx1]
    return canvas


# ---------------------------------------------------------------- 6–7 export + previews

def checker(w, h, s=8):
    yy, xx = np.mgrid[0:h, 0:w]
    v = np.where(((yy // s) + (xx // s)) % 2, 58, 70).astype(np.uint8)
    return np.dstack([v, v + 8, v, np.full_like(v, 255)])


def onbg(fr):
    bg = Image.fromarray(checker(fr.shape[1], fr.shape[0]))
    bg.alpha_composite(Image.fromarray(fr))
    return bg


def guides(img, head_y, pivot, zoom):
    d = ImageDraw.Draw(img)
    w = img.size[0]
    d.line((0, head_y * zoom, w, head_y * zoom), fill=(255, 220, 80, 255), width=1)
    d.line((0, pivot[1] * zoom, w, pivot[1] * zoom), fill=(255, 80, 60, 255), width=1)
    px = pivot[0] * zoom
    d.line((px - 6, pivot[1] * zoom, px + 6, pivot[1] * zoom), fill=(255, 255, 255, 255), width=2)
    d.line((px, pivot[1] * zoom - 6, px, pivot[1] * zoom + 6), fill=(255, 255, 255, 255), width=2)


def preview_gif(path, title, before, after, conf, idle_b, idle_a, head_y, ms, idle_ms, zoom=2):
    """BEFORE | AFTER, idle → action → idle (the jump shows at the cuts)"""
    pivot = conf['canvas']['pivot']
    seq = [(i, 'idle', idle_ms) for i in range(len(idle_b))] + [(i, 'act', ms) for i in range(len(before))] + \
          [(i, 'idle', idle_ms) for i in range(len(idle_b))]
    frames, durs = [], []
    for i, kind, d in seq:
        b = idle_b[i] if kind == 'idle' else before[i]
        a = idle_a[i] if kind == 'idle' else after[i]
        h, w = b.shape[:2]
        panel = Image.new('RGBA', (w * zoom * 2 + 6, h * zoom + 18), (24, 20, 34, 255))
        for k, fr in enumerate((b, a)):
            im = onbg(fr).resize((w * zoom, h * zoom), Image.NEAREST)
            guides(im, head_y, pivot, zoom)
            panel.paste(im, (k * (w * zoom + 6), 18))
        dr = ImageDraw.Draw(panel)
        dr.text((4, 3), f'BEFORE  {title}  ({"idle" if kind == "idle" else "action"})', fill=(255, 255, 255, 255))
        dr.text((w * zoom + 10, 3), 'AFTER', fill=(140, 255, 160, 255))
        frames.append(panel.convert('P', palette=Image.ADAPTIVE, colors=255))
        durs.append(d)
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=durs, loop=0, disposal=2)


def compare_png(path, before, after, conf, head_y, order):
    """one row BEFORE, one row AFTER: the middle frame of every animation side by side on the same baseline"""
    pivot = conf['canvas']['pivot']
    cw, ch = conf['canvas']['cell']
    tiles_b = [before[n][len(before[n]) // 2] for n in order]
    tiles_a = [after[n][len(after[n]) // 2] for n in order]
    zoom = 2
    img = Image.new('RGBA', (len(order) * cw * zoom, (ch * zoom + 16) * 2), (24, 20, 34, 255))
    d = ImageDraw.Draw(img)
    for row, tiles in enumerate((tiles_b, tiles_a)):
        for i, (n, t) in enumerate(zip(order, tiles)):
            im = onbg(t).resize((cw * zoom, ch * zoom), Image.NEAREST)
            guides(im, head_y, pivot, zoom)
            img.paste(im, (i * cw * zoom, row * (ch * zoom + 16) + 16))
            d.text((i * cw * zoom + 4, row * (ch * zoom + 16) + 2), f'{"BEFORE" if row == 0 else "AFTER"} {n}',
                   fill=(255, 255, 255, 255) if row == 0 else (140, 255, 160, 255))
    img.save(path)


def run(arg, write=False, metric=None):
    conf = load_conf(arg)
    hid = conf['id']
    metric = metric or conf.get('metric', 'edge')
    if metric in ('sift', 'edge') and cv2 is None:
        print('OpenCV not installed → edge metric uses height only (pip install opencv-python for sift)')
    frames = extract(conf)
    cell, pivot = conf['canvas']['cell'], conf['canvas']['pivot']
    atlas_src = conf['source']['type'] == 'atlas'
    base = 1.0
    feet_of = {}
    if not atlas_src:
        # raw sheet: one base factor so the reference body gets `canvas.refHeight` px tall, every frame on the canvas
        # with its feet on the pivot — measured afterwards at game size, exactly like an atlas
        rh = edge_height(frames[conf['reference']['anim']][conf['reference']['frame']])
        base = conf['canvas'].get('refHeight', rh) / rh
        feet_of = {n: [feet(x) for x in fr] for n, fr in frames.items()}
        before = {n: [place(x, base, cell, pivot, feet_of[n][i]) for i, x in enumerate(fr)] for n, fr in frames.items()}
    else:
        before = frames
    meas = measure(before, conf, metric)
    fac = factors(meas, conf)

    def build(fac):
        after, clipped = {}, {}
        for name, fr in frames.items():
            if atlas_src:
                res = [rescale(x, fac[name], pivot) for x in fr]
                after[name] = [r[0] if isinstance(r, tuple) else r for r in res]
                clipped[name] = sum(r[1] for r in res if isinstance(r, tuple))
            else:
                after[name] = [place(x, fac[name] * base, cell, pivot, feet_of[name][i]) for i, x in enumerate(fr)]
                clipped[name] = 0
        return after, clipped

    after, clipped = build(fac)

    out_dir = os.path.join(ROOT, conf['output']['dir'])
    for sub in ('frames', 'preview'):
        os.makedirs(os.path.join(out_dir, sub), exist_ok=True)
    # atlas: same layout; rows the config does not list are copied unchanged from the source atlas
    rows = max(a['row'] for a in conf['anims'].values()) + 1
    cols = max(a['frames'] for a in conf['anims'].values())
    if atlas_src:
        src = np.array(Image.open(os.path.join(ROOT, conf['source']['file'])).convert('RGBA'))
        atlas = src.copy()
    else:
        atlas = np.zeros((rows * cell[1], cols * cell[0], 4), np.uint8)
    for name, fr in after.items():
        r = conf['anims'][name]['row']
        for i, x in enumerate(fr):
            atlas[r * cell[1]:(r + 1) * cell[1], i * cell[0]:(i + 1) * cell[0]] = x
            Image.fromarray(x).save(os.path.join(out_dir, 'frames', f'{name}_{i:02d}.png'))
    Image.fromarray(atlas).save(os.path.join(out_dir, f'hero-{hid}.png'), optimize=True)

    # previews: reference head line = top of the reference body
    rname, rf = conf['reference']['anim'], conf['reference']['frame']
    rm = body_mask(after[rname][rf])
    head_y = int(np.nonzero(rm)[0].min())
    idle_ms = conf['anims'][rname].get('ms', 150)
    for name in after:
        a = conf['anims'][name]
        preview_gif(os.path.join(out_dir, 'preview', f'{name}.gif'), f'{hid} {name} x{fac[name]:.3f}',
                    before[name], after[name], conf, before[rname], after[rname], head_y, a.get('ms', 90), idle_ms)
    order = [n for n in ANIMS if n in after]
    compare_png(os.path.join(out_dir, 'compare.png'), before, after, conf, head_y, order)

    report = {'id': hid, 'metric': metric, 'reference': conf['reference'], 'anims': {}}
    lines = [f'# Sprite normalization — {hid}', '',
             f'reference: {rname} frame {rf} · metric: {metric} · dead band ±{DEADBAND:.0%} · clamp {CLAMP}', '',
             '| anim | measured size | confidence | method | factor | clipped px |', '|---|---|---|---|---|---|']
    for name in order:
        m = meas[name]
        report['anims'][name] = {**m, 'factor': fac[name], 'clipped': clipped[name]}
        size = f"{m['size']:.3f}" if m['size'] else '-'
        lines.append(f"| {name} | {size} | {m['confidence']} | {m['method']} | {fac[name]:.3f} | {clipped[name]} |")
    json.dump(report, open(os.path.join(out_dir, 'report.json'), 'w'), indent=1)
    open(os.path.join(out_dir, 'report.md'), 'w').write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    if write:
        dst = os.path.join(ROOT, conf['output']['atlas'])
        Image.fromarray(atlas).save(dst, optimize=True)
        print('replaced', os.path.relpath(dst, ROOT))
    print('outputs:', os.path.relpath(out_dir, ROOT))
    return report


def audit(ids):
    if not ids:
        ids = sorted(f[5:-4] for f in os.listdir(os.path.join(ROOT, 'public', 'sprites')) if f.startswith('hero-') and f.endswith('.png'))
    print(f"{'hero':10s} " + ' '.join(f'{a:>14s}' for a in ANIMS))
    for hid in ids:
        conf = load_conf(hid)
        meas = measure(extract(conf), conf, conf.get('metric', 'edge'))
        cells = []
        for a in ANIMS:
            m = meas.get(a)
            cells.append('-' if not m or m['size'] is None else f"{m['size']:.2f} {m['confidence'][:4]}")
        print(f'{hid:10s} ' + ' '.join(f'{c:>14s}' for c in cells))


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] not in ('init', 'run', 'audit'):
        print(__doc__)
        sys.exit(1)
    cmd, rest = args[0], args[1:]
    flags = {a.split('=')[0]: (a.split('=')[1] if '=' in a else True) for a in rest if a.startswith('--')}
    pos = [a for a in rest if not a.startswith('--')]
    if cmd == 'init':
        for h in pos:
            init(h)
    elif cmd == 'audit':
        audit(pos)
    else:
        for h in pos:
            run(h, write=bool(flags.get('--write')), metric=flags.get('--metric'))

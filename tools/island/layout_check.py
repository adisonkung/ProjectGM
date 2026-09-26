"""Validate + preview the shared Home Island layout (tools/island/layout_check.py [out.png])."""
import json, math, sys, os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
L = json.load(open(os.path.join(ROOT, 'src/app/core/data/island/default-layout.json')))
N = {n['id']: (n['x'], n['y']) for n in L['nodes']}

def inside_poly(p, poly):
    x, y = p; c = False; j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]; xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi: c = not c
        j = i
    return c

def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy or 1)))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)

def poly_dist(p, poly):
    return min(seg_dist(p, poly[i], poly[(i + 1) % len(poly)]) for i in range(len(poly)))

def edges():
    out = []
    for r in L['roads']:
        for a, b in zip(r['nodes'], r['nodes'][1:]): out.append((a, b, r))
    for a, b in L['connectors']: out.append((a, b, None))
    return out

def samples(a, b, step=4):
    n = max(1, int(math.dist(a, b) / step))
    return [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(n + 1)]

errors = []
for nid, p in N.items():
    if not inside_poly(p, L['ground']) or poly_dist(p, L['ground']) < 24: errors.append(f'node {nid} too close to coast')
for pl in L['plots']:
    bx, by, bw, bh = pl['bounds']
    for c in [(bx, by + bh), (bx + bw, by + bh)]:
        if not inside_poly(c, L['ground']): errors.append(f'{pl["plotId"]} footprint off island')
stairs = {tuple(s) for r in L['roads'] for s in r.get('stairs', [])}
bridges = {tuple(s) for r in L['roads'] for s in r.get('bridges', [])}
st = L['stream']
for a, b, r in edges():
    pa, pb = N[a], N[b]
    for q in samples(pa, pb):
        for pl in L['plots']:
            bx, by, bw, bh = pl['bounds']
            if bx - 6 < q[0] < bx + bw + 6 and by - 6 < q[1] < by + bh + 6: errors.append(f'edge {a}-{b} hits {pl["plotId"]}'); break
    wet = any(min(seg_dist(q, st['points'][i], st['points'][i + 1]) for i in range(len(st['points']) - 1)) < st['width'] / 2 + 8 for q in samples(pa, pb))
    if wet and (a, b) not in bridges and (b, a) not in bridges: errors.append(f'edge {a}-{b} crosses the stream without a bridge')
    cross = inside_poly(pa, L['plateau']) != inside_poly(pb, L['plateau'])
    if cross and (a, b) not in stairs and (b, a) not in stairs: errors.append(f'edge {a}-{b} changes height without stairs')
for e in sorted(set(errors)): print('ERR', e)
print('errors:', len(set(errors)))

if len(sys.argv) > 1:
    im = Image.new('RGB', (L['world']['w'] // 2, L['world']['h'] // 2), (16, 22, 40))
    d = ImageDraw.Draw(im)
    h = lambda p: (p[0] / 2, p[1] / 2)
    d.polygon([h(p) for p in L['ground']], fill=(46, 80, 44))
    d.polygon([h(p) for p in L['plateau']], fill=(66, 96, 56), outline=(20, 20, 20))
    d.line([h(p) for p in st['points']], fill=(50, 90, 140), width=st['width'] // 2)
    for pz in L['plazas']: d.polygon([h(p) for p in pz['points']], fill=(110, 100, 80))
    for a, b, r in edges():
        w = (r['width'] // 2) if r else 2
        d.line([h(N[a]), h(N[b])], fill=(150, 120, 80) if r else (90, 90, 90), width=w)
    for pl in L['plots']:
        bx, by, bw, bh = pl['bounds']
        d.rectangle([bx / 2, by / 2, (bx + bw) / 2, (by + bh) / 2], outline=(240, 200, 100))
        d.text((bx / 2, by / 2 - 10), pl['plotId'], fill=(255, 255, 255))
    for nid, p in N.items():
        x, y = h(p); d.ellipse([x - 3, y - 3, x + 3, y + 3], fill=(255, 80, 80)); d.text((x + 4, y - 4), nid, fill=(230, 230, 230))
    im.save(sys.argv[1])

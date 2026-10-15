"""Kael S2 Relentless Cross — derived edit of character frames F4–F6 so the first strike reads as a HORIZONTAL CUT
(user 2026-10: the approved sheet draws F4–F6 with the sword held straight out like a thrust).

Never touches the approved PNG: works on the frames kael.py cut from it (source px, hard alpha) and returns new frames.
Side view of a horizontal cut = the blade sweeps across the depth axis, so its visible length changes:
  F4 RELEASE_HORIZONTAL   blade turning toward the viewer → short, broad (foreshortened 45 %) + sweep smear behind it
  F5 HIT_1_HORIZONTAL_CUT blade at full reach, crossing the target line + bright horizontal sweep smear (contact)
  F6 FOLLOW_THROUGH_1     blade carried past, receding to the far side → short, thin (foreshortened 35 %), fading smear
Body, arms, hands, guard and cape stay exactly as drawn — only the blade beyond the guard and the smear change.

Run directly for a BEFORE | AFTER comparison: python3 tools/sprites/kael_s2_edit.py <out.png>
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

EDIT = {3: 'F4', 4: 'F5', 5: 'F6'}           # 0-based frame index in the 14-frame clip


def blade_of(img):
    """the blade beyond the guard: (guard_x, y_line, thickness, tip_x, mask) — thin columns right of the hands"""
    a = img[..., 3] > 0
    cols = a.sum(0)
    xs = np.nonzero(cols)[0]
    tip = int(xs.max())
    x = tip
    while x > 0 and cols[x] <= 22:              # walk back from the tip while the column stays blade-thin
        x -= 1
    guard = x + 1
    m = np.zeros_like(a)
    m[:, guard:] = a[:, guard:]
    ys = np.nonzero(m.any(1))[0]
    yl = float(np.average(np.nonzero(m)[0]))
    return guard, yl, int(ys.max() - ys.min() + 1), tip, m


def smear(size, x0, x1, y, h, alpha, back=1.0):
    """a horizontal sweep trail: a flat crescent from x0 (behind) to x1 (front), brightest at the leading edge"""
    w, hh = size
    lay = Image.new('L', (w, hh), 0)
    d = ImageDraw.Draw(lay)
    d.ellipse([x0, y - h, x1 + (x1 - x0) * 0.12, y + h * 0.9], fill=255)
    d.ellipse([x0 + (x1 - x0) * 0.12, y - h * 0.62, x1 - (x1 - x0) * 0.02, y + h * 0.25], fill=0)
    lay = lay.filter(ImageFilter.GaussianBlur(2))
    g = np.array(lay).astype(float) / 255
    ramp = np.clip((np.arange(w) - x0) / max(1, x1 - x0), 0, 1) ** 1.6 * back + (1 - back)
    g *= ramp[None, :] * alpha
    col = np.zeros((hh, w, 4), np.uint8)
    t = np.clip((np.arange(w) - x0) / max(1, x1 - x0), 0, 1)[None, :]
    col[..., 0] = 255                                    # ember tail → white-hot leading edge (Ashen palette)
    col[..., 1] = (120 + 130 * t).astype(np.uint8)
    col[..., 2] = (50 + 190 * t ** 2).astype(np.uint8)
    col[..., 3] = (g * 255).astype(np.uint8)
    return col


def over(dst, src, behind=False):
    """alpha composite src onto dst; behind = only where dst is empty (keeps the body in front)"""
    out = dst.astype(float)
    s = src.astype(float)
    sa = s[..., 3:] / 255
    if behind:
        sa = sa * (dst[..., 3:] == 0)
    da = out[..., 3:] / 255
    oa = sa + da * (1 - sa)
    rgb = (s[..., :3] * sa + out[..., :3] * da * (1 - sa)) / np.maximum(oa, 1e-6)
    res = np.concatenate([rgb, oa * 255], -1)
    return np.clip(res, 0, 255).astype(np.uint8)


def edit_frame(img, which):
    guard, yl, th, tip, m = blade_of(img)
    blade = img.copy()
    blade[~m] = 0
    body = img.copy()
    body[m] = 0
    L = tip - guard + 1
    y0 = int(round(yl - th / 2))
    strip = blade[max(0, y0 - 2):y0 + th + 2, guard:tip + 1]
    pad = 60
    h, w = img.shape[:2]
    canvas = np.zeros((h + 2 * pad, w + 2 * pad, 4), np.uint8)
    canvas[pad:pad + h, pad:pad + w] = body
    gx, gy = guard + pad, int(round(yl)) + pad
    if which == 'F4':
        k, thick, sm = 0.45, 1.45, (gx - 190, gx + int(L * 0.45) + 20, gy + 4, 30, 0.7, 1.0)
    elif which == 'F5':
        k, thick, sm = 1.0, 1.0, (gx - 230, gx + L + 16, gy + 4, 34, 0.9, 1.0)
    else:
        k, thick, sm = 0.35, 0.8, (gx - 120, gx + L + 30, gy + 6, 28, 0.45, 0.6)
    nb = Image.fromarray(strip).resize((max(2, int(round(strip.shape[1] * k))), max(2, int(round(strip.shape[0] * thick)))),
                                       Image.LANCZOS)
    nb = np.array(nb)
    nb[..., 3] = np.where(nb[..., 3] >= 110, 255, 0)
    trail = smear((canvas.shape[1], canvas.shape[0]), *sm)
    # character layer (hard pixel edges, like every other frame): body + the new blade
    char = canvas.copy()
    lay = np.zeros_like(canvas)
    by = gy - nb.shape[0] // 2
    lay[by:by + nb.shape[0], gx:gx + nb.shape[1]] = nb
    char = over(char, lay)
    # smear layer (soft, translucent): behind his body, in front of it past the guard (the cut crosses his front)
    ramp = np.clip((np.arange(trail.shape[1]) - (gx - 30)) / 40, 0, 1)    # feathered, no seam at the guard
    front = trail.copy()
    front[..., 3] = (front[..., 3] * ramp[None, :]).astype(np.uint8)
    back = trail.copy()
    back[..., 3] = (back[..., 3] * (char[..., 3] == 0)).astype(np.uint8)
    glow = over(back, front)
    if which == 'F5':                            # the leading-edge glint where the blade crosses the target line
        glow = over(glow, smear((canvas.shape[1], canvas.shape[0]), gx + L - 40, gx + L + 14, gy, 6, 0.9, 1.0))
    both = np.maximum(char[..., 3], glow[..., 3])
    ys, xs = np.nonzero(both > 0)
    oy, ox = ys.min(), xs.min()
    sl = (slice(oy, ys.max() + 1), slice(ox, xs.max() + 1))
    return (char[sl], glow[sl]), (ox - pad, oy - pad)


def apply(frames):
    """kael.py hook: frames = the 14 S2 frames (dicts with 'img' and 'root' in source px) → edited copies of F4–F6"""
    for i, which in EDIT.items():
        fr = frames[i]
        (char, glow), (dx, dy) = edit_frame(fr['img'], which)
        fr['img'] = char
        fr['layers'] = [(glow, True), (char, False)]          # aurel_v2.paste_frame: soft smear, crisp character
        fr['root'] = (fr['root'][0] - dx, fr['root'][1] - dy)
    return frames


if __name__ == '__main__':
    import os
    import sys
    sys.path.insert(0, os.path.dirname(__file__))
    out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/kael_s2_edit.png'
    sys.argv = [sys.argv[0], 'assets/heroes/Kael', '/tmp', '/tmp']
    import kael as K                      # noqa: E402  (loads the pipeline with the canonical source dir)
    frs = K.A.sheet_frames('s2_char', [7, 7], False)
    for fr in frs:
        K.drop_strays(fr)
    import copy
    after = apply(copy.deepcopy(frs))
    tiles = []
    for i in (2, 3, 4, 5, 6):
        for src, tag in ((frs[i], 'BEFORE'), (after[i], 'AFTER')):
            im = Image.new('RGBA', (560, 420), (40, 44, 52, 255))
            rx, ry = src['root']
            for lay in ([l for l, _ in src['layers']] if 'layers' in src else [src['img']]):
                im.alpha_composite(Image.fromarray(lay), (int(200 - rx), int(390 - ry)))
            ImageDraw.Draw(im).text((8, 6), f'F{i + 1} {tag}', fill=(255, 255, 255))
            tiles.append(im)
    sheet = Image.new('RGB', (560 * 5, 420 * 2))
    for k, t in enumerate(tiles):
        sheet.paste(t, ((k // 2) * 560, (k % 2) * 420))
    sheet.save(out)
    print(out)

"""Tang Xun's palette pass for his skill VFX (user 2026-10: "every skill in the jade-green theme").

Visual motif: emerald-jade wind rings · silver blades · pale-cyan trails · restrained gold. The painted sheets came in
blue / violet / crimson, so every coloured pixel's hue is remapped (neutral silver / white / black stay as they are):
  blue (190–250°)          → pale cyan-jade (178 → 166°)
  violet / magenta (250–330°) → emerald (164 → 150°), a little less saturated and darker so the shadow flames read as
                             deep green
  red / orange (330–25°)   → restrained gold (42°, toned down) — the crimson petals become gold flecks
  yellow … cyan (25–190°)  unchanged (the jade sheets pass through untouched)
Saturation < 0.12 (silver, white, ink) is never touched.
"""
import numpy as np
from matplotlib.colors import hsv_to_rgb, rgb_to_hsv


def _hue_map(h):
    """h in degrees [0, 360) → new hue (degrees) + saturation / value multipliers"""
    nh = h.copy()
    sm = np.ones_like(h)
    vm = np.ones_like(h)
    blue = (h >= 190) & (h < 250)
    nh[blue] = 178 - (h[blue] - 190) / 60 * 12
    vio = (h >= 250) & (h < 330)
    nh[vio] = 164 - (h[vio] - 250) / 80 * 14
    sm[vio] = 0.85
    vm[vio] = 0.82
    red = (h >= 330) | (h < 25)
    nh[red] = 42
    sm[red] = 0.7
    vm[red] = 0.92
    return nh, sm, vm


def jadeify(rgb):
    """uint8 / float RGB array (… × 3) → uint8 RGB in Tang Xun's jade palette"""
    a = np.asarray(rgb, float) / 255.0
    hsv = rgb_to_hsv(np.clip(a, 0, 1))
    h = hsv[..., 0] * 360
    nh, sm, vm = _hue_map(h)
    col = hsv[..., 1] >= 0.12
    hsv[..., 0] = np.where(col, nh / 360, hsv[..., 0])
    hsv[..., 1] = np.where(col, np.clip(hsv[..., 1] * sm, 0, 1), hsv[..., 1])
    hsv[..., 2] = np.where(col, np.clip(hsv[..., 2] * vm, 0, 1), hsv[..., 2])
    return (hsv_to_rgb(hsv) * 255).round().astype(np.uint8)

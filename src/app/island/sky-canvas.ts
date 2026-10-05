import { SKY_LAYERS, SKY_MASKS, SkyMask, SKY_WORLD } from '../core/data/sky-city';

/**
 * Sky City sky + effects drawn on two viewport-sized canvases (behind and in front of the island).
 *
 * Why canvas: as DOM, every cloud strip / sky / god-ray / masked FX was its own GPU layer thousands of px wide. On a
 * Retina Mac that added up to a few hundred MB of layer textures — Chrome ran out of tile memory and painted holes
 * and stale blocks ("ภาพพัง"), and stuttered. Two canvases the size of the screen cost a fixed ~2 × 16 MB, and the
 * drawing itself is a few dozen GPU image draws per frame.
 *
 * Coordinates: world px (SKY_WORLD). A layer at depth p is shifted by (panX / k) · (1 − p) world px (parallax:
 * p 0 = glued to the screen, 1 = moves with the island), exactly like the old CSS `par(p)`.
 */

export type CanvasImg = HTMLImageElement | HTMLCanvasElement;
export type ImgLookup = (url: string) => HTMLImageElement | null;

export interface SkyCamera {
  /** world → screen scale (fit × focus zoom) */
  s: number;
  /** world origin on screen (css px) */
  tx: number;
  ty: number;
  /** pan (css px) and base scale, for parallax */
  panX: number;
  k: number;
  /** viewport (css px) and canvas pixel ratio */
  vw: number;
  vh: number;
  dpr: number;
}

const W = SKY_WORLD.w;
const H = SKY_WORLD.h;
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
/** 0 → 1 → 0 over one period (sine ease, like CSS ease-in-out keyframes 0 % / 50 % / 100 %); `ahead` = −animation-delay */
const wave = (t: number, period: number, ahead = 0) => (1 - Math.cos((TAU * (t + ahead)) / period)) / 2;
const frac = (v: number) => v - Math.floor(v);
const ease = (u: number) => (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, u)))) / 2;

interface Strip { img: keyof typeof SKY_LAYERS; p: number; top: number; h: number; T: number; dur: number; dir: 1 | -1; a: number }
const BACK_STRIPS: Strip[] = [
  { img: 'farIslands', p: 0.12, top: 560, h: 576, T: 1152, dur: 210, dir: 1, a: 0.8 },
  { img: 'bank', p: 0.22, top: 760, h: 760, T: 1524, dur: 130, dir: 1, a: 0.92 },
];
const SEA_BACK: Strip = { img: 'sea', p: 0.45, top: 1290, h: 700, T: 1601, dur: 80, dir: -1, a: 1 };
const SEA_FRONT: Strip = { img: 'sea', p: 1.1, top: 1700, h: 520, T: 1189, dur: 55, dir: 1, a: 1 };
const MIST: Strip = { img: 'mist', p: 1.25, top: 1340, h: 560, T: 1603, dur: 35, dir: -1, a: 0.55 };

const STARS = Array.from({ length: 34 }, (_, i) => ({ x: (i * 1237) % W, y: 12 + ((i * 331) % 260), s: 2 + (i % 3), ahead: (i * 0.71) % 4 }));
const MOTES = Array.from({ length: 26 }, (_, i) => ({
  x: (i * 977) % W, y: 120 + ((i * 613) % (H - 300)), s: 6 + (i % 4) * 3, d: 7 + (i % 5) * 2.3, ahead: (i * 1.37) % 9,
}));
const FLOCK = [
  { x: 0, y: 40, ahead: 0 }, { x: 90, y: 0, ahead: 0.21 }, { x: 95, y: 92, ahead: 0.4 }, { x: 185, y: -30, ahead: 0.13 }, { x: 200, y: 130, ahead: 0.55 },
];
/** island FX are rendered at 1/4 world resolution (soft shimmer — invisible difference, 16× fewer pixels) */
const FX_RES = 0.25;

export class SkyCanvasRenderer {
  private darkWing: HTMLCanvasElement | null = null;
  private fx: { falls?: FxLayer; water?: FxLayer; crystals?: HTMLCanvasElement } = {};

  constructor(private readonly img: ImgLookup) {}

  // ------------------------------------------------------------------ public
  /** sky, sun, stars, far islands, cloud bank, whale, dragon, back cloud sea */
  drawBack(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number, lite: boolean): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.sky(ctx, cam);
    this.sun(ctx, cam, t);
    if (!lite) this.stars(ctx, cam, t);
    for (const s of BACK_STRIPS) this.strip(ctx, cam, s, t);
    this.whale(ctx, cam, t, lite);
    if (!lite) this.dragon(ctx, cam, t);
    this.strip(ctx, cam, SEA_BACK, t);
    ctx.globalAlpha = 1;
  }

  /** island FX (falls / canal shimmer / crystals, bobbing with the island) · front cloud sea · mist · birds · god rays · motes */
  drawFront(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number, bob: number, lite: boolean): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    this.islandFx(ctx, cam, t, bob, lite);
    this.strip(ctx, cam, SEA_FRONT, t);
    if (!lite) {
      this.strip(ctx, cam, MIST, t);
      this.flock(ctx, cam, t);
      this.godrays(ctx, cam, t);
      this.motes(ctx, cam, t);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------ helpers
  /** put the context in layer space for depth p (+ extra world offset) */
  private at(ctx: CanvasRenderingContext2D, cam: SkyCamera, p: number, dx = 0, dy = 0): void {
    const ox = (cam.panX / cam.k) * (1 - p);
    const sc = cam.s * cam.dpr;
    ctx.setTransform(sc, 0, 0, sc, cam.dpr * (cam.tx + cam.s * (ox + dx)), cam.dpr * (cam.ty + cam.s * dy));
  }
  /** visible layer-space x range for depth p */
  private span(cam: SkyCamera, p: number): [number, number] {
    const ox = (cam.panX / cam.k) * (1 - p);
    return [-cam.tx / cam.s - ox, (cam.vw - cam.tx) / cam.s - ox];
  }
  private visibleY(cam: SkyCamera, y0: number, y1: number): boolean {
    return y1 * cam.s + cam.ty > 0 && y0 * cam.s + cam.ty < cam.vh;
  }

  private strip(ctx: CanvasRenderingContext2D, cam: SkyCamera, s: Strip, t: number): void {
    const im = this.img(SKY_LAYERS[s.img]);
    if (!im || !this.visibleY(cam, s.top, s.top + s.h)) return;
    const f = frac(t / s.dur);
    const off = s.dir > 0 ? -f * s.T : -(1 - f) * s.T;
    const [x0, x1] = this.span(cam, s.p);
    this.at(ctx, cam, s.p);
    ctx.globalAlpha = s.a;
    // tiles overlap by a hair so no seam line shows between them at fractional scales
    for (let n = Math.floor((x0 - off) / s.T); off + n * s.T < x1; n++) ctx.drawImage(im, off + n * s.T, s.top, s.T + 0.5, s.h);
  }

  private sky(ctx: CanvasRenderingContext2D, cam: SkyCamera): void {
    const im = this.img(SKY_LAYERS.sky);
    // the DOM sky box was (−200, 0, W + 400, H), cover, position 30 % 100 %; reaches 400 px higher for the area behind the app bar
    const bx = -200, bw = W + 400, bh = H + 400;
    if (!im) return;
    const sc = Math.max(bw / im.naturalWidth, bh / im.naturalHeight);
    const dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
    this.at(ctx, cam, 0.04);
    ctx.globalAlpha = 1;
    ctx.drawImage(im, bx + (bw - dw) * 0.3, H - dh, dw, dh);
  }

  private sun(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number): void {
    const w = wave(t, 8);
    const cx = 630, cy = 1530, r = 450 * (1 + 0.05 * w);
    this.at(ctx, cam, 0.04);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 1.414);
    g.addColorStop(0, '#fff6d8aa'); g.addColorStop(0.14, '#ffe2a666'); g.addColorStop(0.36, '#ffc98a22'); g.addColorStop(0.66, '#ffc98a00');
    ctx.globalAlpha = 1 - 0.18 * w;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
  }

  private stars(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number): void {
    if (!this.visibleY(cam, 0, 300)) return;
    this.at(ctx, cam, 1);
    ctx.fillStyle = '#fff6dc';
    for (const s of STARS) {
      const w = wave(t, 3.6, s.ahead);
      ctx.globalAlpha = 1 - 0.8 * w;
      ctx.beginPath(); ctx.arc(s.x + s.s / 2, s.y + s.s / 2, (s.s / 2) * (1 - 0.4 * w) + 0.6, 0, TAU); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ whale (p .3)
  private whale(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number, lite: boolean): void {
    const L = SKY_LAYERS;
    const body = this.img(L.whaleBody), tail = this.img(L.whaleTail), ff = this.img(L.whaleFinFront), fb = this.img(L.whaleFinBack), sh = this.img(L.whaleShards);
    if (!body || !tail || !ff || !fb || !sh) return;
    const X = -1100 + 6100 * frac(t / 95);
    const [x0, x1] = this.span(cam, 0.3);
    if (X > x1 || X + 720 < x0) return;
    const Y = 105 * Math.cos((Math.PI * t) / 13);
    const pw = wave(t, 7.2);
    this.at(ctx, cam, 0.3, X, 40);
    ctx.scale(0.6545, 0.6545);
    ctx.translate(0, Y);
    ctx.translate(660, 304.5); ctx.translate(0, -40 * pw); ctx.rotate((-1.2 + 2.8 * pw) * DEG); ctx.translate(-660, -304.5);
    ctx.globalAlpha = 0.92;
    const part = (im: CanvasImg, x: number, y: number, ox: number, oy: number, deg: number) => {
      ctx.save(); ctx.translate(x + ox, y + oy); ctx.rotate(deg * DEG); ctx.drawImage(im, -ox, -oy); ctx.restore();
    };
    part(fb, 751, 369, 79, 31, -3 + 6 * wave(t, 3.6, 1.1));
    part(tail, 0, 0, 345, 262, -7 + 15 * wave(t, 3.6));
    ctx.drawImage(body, 324, 71);
    part(ff, 364, 314, 326, 31, 4 - 9 * wave(t, 3.6, 0.5));
    const sw = wave(t, 5.4);
    ctx.globalAlpha = 0.92 * (0.95 - 0.25 * sw);
    ctx.drawImage(sh, -14 * sw, 2 + 8 * sw);
    if (!lite) {
      const g = ctx.createRadialGradient(660, 270, 0, 660, 270, 280);
      g.addColorStop(0, '#b48cff55'); g.addColorStop(0.7, '#b48cff00');
      ctx.globalAlpha = 0.25 + 0.6 * wave(t, 4);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(660, 270, 280, 150, 0, 0, TAU); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ dragon (p .32)
  private dragon(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number): void {
    const body = this.img(SKY_LAYERS.dragonBody), wing = this.img(SKY_LAYERS.dragonWing);
    if (!body || !wing) return;
    const f = frac((t + 60) / 150);
    const [x, y] = f < 0.5 ? [-1400 + 3200 * (f / 0.5), 120 - 160 * (f / 0.5)] : [1800 + 3400 * ((f - 0.5) / 0.5), -40 + 130 * ((f - 0.5) / 0.5)];
    const [x0, x1] = this.span(cam, 0.32);
    if (x > x1 || x + 1009 * 0.42 < x0) return;
    this.darkWing ??= darken(wing, 0.28);
    this.at(ctx, cam, 0.32, x, 230 + y);
    ctx.scale(0.42, 0.42);
    ctx.globalAlpha = 1;
    const flapAt = (ph: number) => {
      const u = frac(ph / 1.6);
      const e = u < 0.45 ? ease(u / 0.45) : u < 0.55 ? 1 : 1 - ease((u - 0.55) / 0.45);
      return { r: 14 * e, sy: 1 - 0.68 * e };
    };
    const drawWing = (im: CanvasImg, lx: number, ly: number, ph: number) => {
      const { r, sy } = flapAt(ph);
      ctx.save(); ctx.translate(lx + 601, ly + 415); ctx.rotate(r * DEG); ctx.scale(1, sy); ctx.drawImage(im, -601, -415, 613, 445); ctx.restore();
    };
    drawWing(this.darkWing, 230, -262, t + 0.12);
    const bw = wave(t, 3.2);
    ctx.save(); ctx.translate(504.5, 216 - 14 * bw); ctx.rotate(-bw * DEG); ctx.drawImage(body, -504.5, -216); ctx.restore();
    drawWing(wing, 162, -242, t);
  }

  // ------------------------------------------------------------------ front: birds, rays, motes
  private flock(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number): void {
    const sheet = this.img(SKY_LAYERS.birds);
    if (!sheet) return;
    const f = frac((t + 10) / 48);
    const fx = -600 + 5000 * f, fy = 820 - 400 * f;
    this.at(ctx, cam, 1.05, fx, fy);
    ctx.globalAlpha = 1;
    for (const b of FLOCK) {
      const fr = Math.floor(frac((t + b.ahead) / 0.72) * 8) % 8;
      ctx.drawImage(sheet, fr * 120, 0, 120, 148, b.x, b.y, 120, 148);
    }
  }

  private godrays(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number): void {
    const im = this.img(SKY_LAYERS.rays);
    if (!im) return;
    const w = wave(t, 11);
    this.at(ctx, cam, 0.15, -200, -120);
    ctx.rotate(1.6 * w * DEG);
    ctx.globalAlpha = 0.32 + 0.26 * w;
    ctx.drawImage(im, 0, 0, 2900, 1630);
  }

  private motes(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number): void {
    this.at(ctx, cam, 1);
    for (const m of MOTES) {
      const u = frac((t + m.ahead) / m.d);
      const a = u < 0.2 ? 0.9 * ease(u / 0.2) : u < 0.8 ? 0.9 - 0.2 * ease((u - 0.2) / 0.6) : 0.7 * (1 - ease((u - 0.8) / 0.2));
      if (a < 0.02) continue;
      const e = ease(u);
      const cx = m.x + m.s / 2 + 80 * e, cy = m.y + m.s / 2 - 160 * e, r = m.s / 2 + 10;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, '#fff3d6'); g.addColorStop(m.s / 2 / r, '#fff3d6'); g.addColorStop((m.s / 2 + 2) / r, '#ffe1a8aa'); g.addColorStop(1, '#ffe1a800');
      ctx.globalAlpha = a;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
    }
  }

  // ------------------------------------------------------------------ island FX (masks cut from the art)
  private islandFx(ctx: CanvasRenderingContext2D, cam: SkyCamera, t: number, bob: number, lite: boolean): void {
    const mf = this.img(SKY_MASKS.falls.src), mw = this.img(SKY_MASKS.water.src), mc = this.img(SKY_MASKS.crystals.src);
    if (mf) {
      this.fx.falls ??= new FxLayer(SKY_MASKS.falls, mf, fallsTile());
      // the pattern slides one period (120 world px) down every 0.7 s; frozen in lite
      this.fx.falls.render(0, lite ? 0 : frac(t / 0.7) * 120);
      this.blit(ctx, cam, this.fx.falls.canvas, SKY_MASKS.falls, bob, 0.85);
    }
    if (mw) {
      this.fx.water ??= new FxLayer(SKY_MASKS.water, mw, waterTile());
      this.fx.water.render(lite ? 0 : frac(t / 3.2) * 180, 0);
      this.blit(ctx, cam, this.fx.water.canvas, SKY_MASKS.water, bob, 0.6);
    }
    if (mc) {
      this.fx.crystals ??= crystalLayer(SKY_MASKS.crystals, mc);
      this.blit(ctx, cam, this.fx.crystals, SKY_MASKS.crystals, bob, lite ? 0.55 : 0.25 + 0.6 * wave(t, 3.4));
    }
  }
  private blit(ctx: CanvasRenderingContext2D, cam: SkyCamera, c: HTMLCanvasElement, m: SkyMask, bob: number, a: number): void {
    if (!this.visibleY(cam, m.y + bob, m.y + m.h + bob)) return;
    this.at(ctx, cam, 1, 0, bob);
    ctx.globalAlpha = a;
    ctx.drawImage(c, m.x, m.y, m.w, m.h);
  }
}

// ------------------------------------------------------------------ offscreen helpers
const canvas = (w: number, h: number) => {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
};

/** a pattern masked by the art's FX mask, re-rendered each frame at FX_RES with a scrolling offset (world px) */
class FxLayer {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly pattern: CanvasPattern | null;
  constructor(private readonly m: SkyMask, private readonly mask: CanvasImg, private readonly tile: { c: HTMLCanvasElement; w: number; h: number }) {
    this.canvas = canvas(m.w * FX_RES, m.h * FX_RES);
    this.ctx = this.canvas.getContext('2d')!;
    this.pattern = this.ctx.createPattern(tile.c, 'repeat');
  }
  render(dx: number, dy: number): void {
    const c = this.ctx, w = this.canvas.width, h = this.canvas.height;
    if (!this.pattern) return;
    c.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, w, h);
    // pattern space: world px × FX_RES; tile.w/h are the world period
    const px = ((dx % this.tile.w) - this.tile.w) * FX_RES, py = ((dy % this.tile.h) - this.tile.h) * FX_RES;
    c.translate(px, py);
    c.fillStyle = this.pattern;
    c.fillRect(-px, -py, w, h);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.drawImage(this.mask, 0, 0, w, h);
    c.globalCompositeOperation = 'source-over';
  }
}

/** waterfall streaks: the old CSS repeating-linear-gradient (180deg, period 120 world px) */
function fallsTile() {
  const P = 120, c = canvas(4, P * FX_RES), x = c.getContext('2d')!;
  const g = x.createLinearGradient(0, 0, 0, c.height);
  const stops: [number, string][] = [[0, '#ffffff00'], [10, '#ffffff00'], [22, '#ffffffcc'], [34, '#dff4ff55'], [52, '#ffffff00'], [78, '#ffffff00'], [92, '#c8ecff88'], [120, '#ffffff00']];
  for (const [p, col] of stops) g.addColorStop(p / P, col);
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  return { c, w: 4 / FX_RES, h: P };
}

/** canal glints: CSS repeating-linear-gradient(115deg … period 90) on a 180 × 180 world tile */
function waterTile() {
  const S = 180, n = Math.round(S * FX_RES), c = canvas(n, n), x = c.getContext('2d')!;
  const img = x.createImageData(n, n);
  const dx = Math.sin(115 * DEG), dy = -Math.cos(115 * DEG);
  const len = Math.abs(S * dx) + Math.abs(S * dy);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const X = (i + 0.5) / FX_RES, Y = (j + 0.5) / FX_RES;
      const d = (X - S / 2) * dx + (Y - S / 2) * dy + len / 2;
      const u = ((d % 90) + 90) % 90;
      const a = u < 26 ? 0 : u < 34 ? ((u - 26) / 8) * 0.6 : u < 46 ? (1 - (u - 34) / 12) * 0.6 : 0;
      const o = (j * n + i) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      img.data[o + 3] = Math.round(a * 255);
    }
  }
  x.putImageData(img, 0, 0);
  return { c, w: S, h: S };
}

/** crystal glow: the old radial gradient through the crystal mask (static — only its opacity pulses) */
function crystalLayer(m: SkyMask, mask: CanvasImg): HTMLCanvasElement {
  const c = canvas(m.w * FX_RES, m.h * FX_RES), x = c.getContext('2d')!;
  const r = Math.hypot(c.width, c.height) / 2;
  const g = x.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, r);
  g.addColorStop(0, '#e2cdff'); g.addColorStop(0.6, '#9b6bff'); g.addColorStop(1, '#5ec8e0');
  x.fillStyle = g;
  x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(mask, 0, 0, c.width, c.height);
  return c;
}

/** the far wing: the art darkened once (CSS used brightness(.72); canvas filters are not in every Safari) */
function darken(im: CanvasImg, amount: number): HTMLCanvasElement {
  const w = im instanceof HTMLImageElement ? im.naturalWidth : im.width, h = im instanceof HTMLImageElement ? im.naturalHeight : im.height;
  const c = canvas(w, h), x = c.getContext('2d')!;
  x.drawImage(im, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = `rgba(16, 10, 30, ${amount})`;
  x.fillRect(0, 0, w, h);
  return c;
}

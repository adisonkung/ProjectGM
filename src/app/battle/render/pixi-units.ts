import type { Application, ColorMatrixFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { FX, SHEETS, SheetDef } from '../../core/data/sprites';
import { fxPlacement, fxPoseAt, projectilePlacement, projectilePoseAt } from './fx-clip';
import { ClipRequest, UnitClip } from './unit-clip';
import { frameChunk } from './tex-chunks';
import { LOOK_COLORS, RING_BOX, UnitLook } from './unit-look';

/** one unit to draw this frame (board pixels, already interpolated by the board's motion loop) */
export interface PixiUnit {
  id: number;
  sheet: string;
  /** top-left of the unit's cell box (board px) */
  x: number;
  y: number;
  flip: boolean;
  z: number;
  /** the DOM unit's opacity (dead / blink-in / revive / untargetable fades) */
  alpha: number;
  req: ClipRequest;
  key: number;
  moving: boolean | undefined;
  pace?: number;
  /** state looks (glow / broken / grey / ground rings) — `unitLook()` */
  look?: UnitLook;
}

/** one skill FX on the board this frame (FxView, positions in board px) */
export interface PixiFx {
  id: number;
  name: string;
  /** top-left of the cell it sits on (board px) — the unit's drawn cell for an attached FX */
  x: number;
  y: number;
  angle: number;
  flip: boolean;
  offset?: [number, number];
  under: boolean;
}

/** one projectile (ProjectileView): from / to in board cells (x = column, y = row incl. scenery), flight ms at x1 */
export interface PixiBolt {
  id: number;
  name: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  flight: number;
}

type Pixi = typeof import('pixi.js');

interface UnitGfx {
  sprite: Sprite;
  clip: UnitClip;
  sheet: string;
  /** glow: the same frame as a blurred one-colour silhouette behind the sprite */
  halo?: Sprite;
  haloTint?: ColorMatrixFilter;
  tone?: ColorMatrixFilter;
  rings?: Graphics;
  ringKey?: string;
}

/** z bands on the one stage: ground FX < units (≈ 10–90) < FX over them */
const Z_UNDER = -100000;
const Z_OVER = 100000;
const Z_BOLT = 200000;

/**
 * Battle units, skill FX and projectiles drawn by PixiJS (WebGL) — phases 1–4 of the renderer move (bars, cast bars,
 * focus marks and the damage numbers stay DOM: text and a few divs per unit, cheap and crisp). FX: `fxPoseAt(def, now − spawn)` on the same clock — a hit-stop freezes the burst on its frame,
 * and an FX the battle list drops early (its real-time timer) still plays out on the game clock.
 * The board's frame loop calls `draw()` once per display frame with ONE game clock; every unit's frame comes from
 * `UnitClip.pose(now)` (nothing animates by itself → pause / hit-stop / x2 / x4 are just the clock).
 * Pixi is imported lazily (its own chunk) only when the Pixi renderer is switched on.
 */
export class PixiUnitLayer {
  private readonly sprites = new Map<number, UnitGfx>();
  private readonly reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly textures = new Map<string, Texture | 'loading' | 'failed'>();
  private readonly frames = new Map<string, Texture>();
  private readonly fxs = new Map<number, { sprite: Sprite; name: string; t0: number; seq: number; last: PixiFx }>();
  private readonly bolts = new Map<number, { sprite: Sprite; t0: number; last: PixiBolt }>();
  private readonly chunks = new Map<string, Texture>();
  private fxSeq = 0;
  private cell = 0;
  /** GPU texture size limit (bigger sheets are cut into chunks — render/tex-chunks.ts) */
  private readonly maxTex: number;

  private constructor(
    private readonly pixi: Pixi,
    private readonly app: Application,
    private readonly stage: Container,
  ) {
    const gl = (app.renderer as unknown as { gl?: WebGLRenderingContext }).gl;
    this.maxTex = Math.min(16384, (gl?.getParameter(gl.MAX_TEXTURE_SIZE) as number | undefined) ?? 4096);
  }

  /** null = WebGL unavailable (the board keeps drawing units with the DOM) */
  static async create(host: HTMLElement, width: number, height: number): Promise<PixiUnitLayer | null> {
    try {
      const pixi = await import('pixi.js');
      const app = new pixi.Application();
      await app.init({
        width: Math.max(1, width),
        height: Math.max(1, height),
        backgroundAlpha: 0,
        antialias: false,
        autoStart: false,
        sharedTicker: false,
        resolution: Math.min(2, window.devicePixelRatio || 1),
        autoDensity: true,
        preference: 'webgl',
      });
      app.ticker?.stop();
      app.canvas.style.cssText = 'position:absolute;left:0;top:0;display:block;';
      host.appendChild(app.canvas);
      const stage = new pixi.Container();
      stage.sortableChildren = true;
      app.stage.addChild(stage);
      return new PixiUnitLayer(pixi, app, stage);
    } catch (err) {
      console.warn('[pixi] renderer unavailable — units stay DOM', err);
      return null;
    }
  }

  resize(width: number, height: number): void {
    if (width > 0 && height > 0) this.app.renderer.resize(width, height);
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
    for (const t of this.chunks.values()) t.destroy(true);
    this.chunks.clear();
    this.sprites.clear();
    this.fxs.clear();
    this.bolts.clear();
  }

  /** the sheet's texture (loaded on first use; null until ready) */
  private texture(file: string, def: { pixelated?: boolean }): Texture | null {
    const t = this.textures.get(file);
    if (t === 'loading' || t === 'failed') return null;
    if (t) return t;
    this.textures.set(file, 'loading');
    this.pixi.Assets.load<Texture>(`sprites/${file}`).then(
      tex => {
        tex.source.scaleMode = def.pixelated ? 'nearest' : 'linear';
        this.textures.set(file, tex);
      },
      () => this.textures.set(file, 'failed'),
    );
    return null;
  }

  /** frame (col, row) of a grid of fw × fh cells — a sub-texture, or of a chunk when the image is over the GPU limit */
  private cellTex(file: string, base: Texture, pixelated: boolean | undefined, fw: number, fh: number, col: number, row: number): Texture {
    const k = `${file}|${fw}|${fh}|${col}|${row}`;
    let f = this.frames.get(k);
    if (f) return f;
    const src = base.source;
    const W = src.pixelWidth;
    const H = src.pixelHeight;
    if (W <= this.maxTex && H <= this.maxTex) {
      f = new this.pixi.Texture({ source: src, frame: new this.pixi.Rectangle(col * fw, row * fh, fw, fh) });
    } else {
      const c = frameChunk(col, row, fw, fh, W, H, this.maxTex);
      const ck = `${file}|${fw}|${fh}|${c.cx}|${c.cy}`;
      let chunk = this.chunks.get(ck);
      if (!chunk) {
        const canvas = document.createElement('canvas');
        canvas.width = c.sw;
        canvas.height = c.sh;
        canvas.getContext('2d')!.drawImage(src.resource as CanvasImageSource, c.sx, c.sy, c.sw, c.sh, 0, 0, c.sw, c.sh);
        chunk = this.pixi.Texture.from(canvas);
        chunk.source.scaleMode = pixelated ? 'nearest' : 'linear';
        this.chunks.set(ck, chunk);
      }
      f = new this.pixi.Texture({ source: chunk.source, frame: new this.pixi.Rectangle(c.fx, c.fy, fw, fh) });
    }
    this.frames.set(k, f);
    return f;
  }

  private frame(file: string, def: SheetDef, base: Texture, row: number, col: number): Texture {
    return this.cellTex(file, base, def.pixelated, def.cellW ?? 132, def.cellH ?? 100, col, row);
  }

  /** a unit's skill FX textures start loading when the unit first appears (its first cast is not drawn by the DOM) */
  private preloadFx(def: SheetDef): void {
    const names = [...Object.values(def.fx ?? {}).flat(), ...Object.values(def.projectile ?? {})].filter((n): n is string => !!n);
    for (const n of names) {
      const d = FX[n];
      if (!d) continue;
      this.texture(d.file, d);
      if (d.hitFx && FX[d.hitFx]) this.texture(FX[d.hitFx].file, FX[d.hitFx]);
    }
  }

  private fxFrame(file: string, base: Texture, strip: number, i: number, pixelated?: boolean): Texture {
    return this.cellTex(file, base, pixelated, base.source.pixelWidth / strip, base.source.pixelHeight, i, 0);
  }

  /**
   * The FX for this frame (`now` = game clock). Returns the ids drawn (their DOM copy is hidden by the board).
   * An id that left the list keeps playing at its last place until its clip ends.
   */
  private drawFx(list: PixiFx[], cell: number, now: number): Set<number> {
    const drawn = new Set<number>();
    const seen = new Set<number>();
    for (const f of list) {
      seen.add(f.id);
      let s = this.fxs.get(f.id);
      if (!s) {
        if (!FX[f.name]) continue;
        const sprite = new this.pixi.Sprite();
        sprite.visible = false;
        this.stage.addChild(sprite);
        s = { sprite, name: f.name, t0: now, seq: ++this.fxSeq, last: f };
        this.fxs.set(f.id, s);
      }
      s.last = f;
    }
    for (const [id, s] of this.fxs) {
      const d = FX[s.name];
      const pose = fxPoseAt(d, now - s.t0);
      if (pose.done) {
        s.sprite.destroy();
        this.fxs.delete(id);
        continue;
      }
      const base = this.texture(d.file, d);
      const sp = s.sprite;
      if (!base) {
        sp.visible = false;
        continue;
      }
      const f = s.last;
      const at = fxPlacement(d, cell, f.x, f.y, f.flip, f.angle, f.offset);
      const tex = this.fxFrame(d.file, base, d.stripFrames ?? d.frames, pose.frame, d.pixelated);
      sp.texture = tex;
      const piv = d.pivot ?? [0.5, 0.5];
      sp.anchor.set(piv[0], piv[1]);
      sp.position.set(at.x, at.y);
      sp.rotation = at.rotation;
      sp.scale.set(((at.flip ? -1 : 1) * at.width) / tex.frame.width, at.height / tex.frame.height);
      sp.alpha = pose.alpha;
      sp.blendMode = d.blend === 'add' ? 'add' : 'normal';
      sp.zIndex = (f.under ? Z_UNDER : Z_OVER) + s.seq;
      sp.visible = pose.visible;
      if (seen.has(id)) drawn.add(id);
    }
    return drawn;
  }

  /** projectiles: fly from → to on the game clock, impact frame on arrival; the same play-out rule as the FX */
  private drawBolts(list: PixiBolt[], cell: number, now: number): Set<number> {
    const drawn = new Set<number>();
    const seen = new Set<number>();
    for (const b of list) {
      seen.add(b.id);
      let s = this.bolts.get(b.id);
      if (!s) {
        if (!FX[b.name]) continue;
        const sprite = new this.pixi.Sprite();
        sprite.anchor.set(0.5, 0.5);
        sprite.visible = false;
        this.stage.addChild(sprite);
        s = { sprite, t0: now, last: b };
        this.bolts.set(b.id, s);
      }
      s.last = b;
    }
    for (const [id, s] of this.bolts) {
      const b = s.last;
      const d = FX[b.name];
      const pose = projectilePoseAt(d, b.flight / 1000, now - s.t0);
      if (pose.done) {
        s.sprite.destroy();
        this.bolts.delete(id);
        continue;
      }
      const base = this.texture(d.file, d);
      if (!base) {
        s.sprite.visible = false;
        continue;
      }
      const at = projectilePlacement(d, cell, b.from, b.to, pose.k);
      const sp = s.sprite;
      const tex = this.fxFrame(d.file, base, d.frames, pose.frame, d.pixelated);
      sp.texture = tex;
      sp.position.set(at.x, at.y);
      sp.rotation = at.rotation;
      sp.scale.set(at.width / tex.frame.width, at.height / tex.frame.height);
      sp.blendMode = d.blend === 'add' ? 'add' : 'normal';
      sp.zIndex = Z_BOLT + id;
      sp.visible = true;
      if (seen.has(id)) drawn.add(id);
    }
    return drawn;
  }

  /**
   * Draw all units (and FX) for this display frame. `cell` = board cell size (px) · `now` = game clock (s) · `idleNow` =
   * real-time clock for the idle breath. Returns the ids actually drawn (their DOM sheet is hidden by the board).
   */
  draw(
    units: PixiUnit[],
    cell: number,
    now: number,
    idleNow: number,
    fx: PixiFx[] = [],
    bolts: PixiBolt[] = [],
  ): { units: Set<number>; fx: Set<number>; bolts: Set<number> } {
    this.cell = cell;
    const drawn = new Set<number>();
    const live = new Set<number>();
    for (const u of units) {
      const def = SHEETS[u.sheet];
      if (!def) continue;
      live.add(u.id);
      const base = this.texture(u.sheet, def);
      let s = this.sprites.get(u.id);
      if (!s || s.sheet !== u.sheet) {
        if (s) this.dropUnit(s);
        const sprite = new this.pixi.Sprite();
        sprite.anchor.set(0.5, 1);
        this.stage.addChild(sprite);
        s = { sprite, clip: new UnitClip(def), sheet: u.sheet };
        this.sprites.set(u.id, s);
        this.preloadFx(def);
      }
      s.clip.request(u.req, u.key, now, u.moving);
      const pose = s.clip.pose(now, idleNow, u.moving, u.pace);
      if (!base) {
        s.sprite.visible = false;
        continue;
      }
      // same geometry as the DOM sheet: 165 % × cellW / 132 of a cell wide, feet 4 % above the cell bottom
      const k = (cell * 1.65) / 132;
      const sx = u.flip ? -1 : 1;
      const sp = s.sprite;
      sp.texture = this.frame(u.sheet, def, base, pose.row, pose.col);
      sp.scale.set(k * sx, k);
      sp.position.set(u.x + cell / 2 + pose.dx * k * sx, u.y + cell * 0.96 + pose.dy * k);
      sp.alpha = u.alpha * pose.opacity;
      sp.zIndex = u.z;
      sp.visible = sp.alpha > 0.001;
      this.applyLook(s, u, cell, idleNow);
      drawn.add(u.id);
    }
    for (const [id, s] of this.sprites) {
      if (!live.has(id)) {
        this.dropUnit(s);
        this.sprites.delete(id);
      }
    }
    const fxDrawn = this.drawFx(fx, cell, now);
    const boltsDrawn = this.drawBolts(bolts, cell, now);
    this.app.render();
    return { units: drawn, fx: fxDrawn, bolts: boltsDrawn };
  }

  private dropUnit(s: UnitGfx): void {
    s.sprite.destroy();
    s.halo?.destroy();
    s.rings?.destroy();
  }

  /** the CSS state looks of the DOM `.unit`, drawn on the canvas (render/unit-look.ts) */
  private applyLook(s: UnitGfx, u: PixiUnit, cell: number, idleNow: number): void {
    const look = u.look;
    const sp = s.sprite;
    const px = cell / 56; // CSS px at the reference cell size (56 px)
    // broken: darkened sepia (brightness .6 sepia .6 hue −20°) + 2 px jitter every 0.2 s · untargetable: partly grey
    if (look?.broken || look?.gray) {
      if (!s.tone) s.tone = new this.pixi.ColorMatrixFilter();
      const t = s.tone;
      t.reset();
      if (look.broken) {
        t.brightness(0.6, false);
        t.sepia(true);
        t.alpha = 0.6;
      } else {
        t.desaturate();
        t.alpha = 0.6;
      }
      sp.filters = [t];
      if (look.broken && !this.reduced) sp.position.x += (idleNow % 0.2 < 0.1 ? 0 : 2) * px;
    } else if (sp.filters) {
      sp.filters = null;
    }
    // glow
    if (look?.glow != null && sp.visible) {
      if (!s.halo) {
        s.halo = new this.pixi.Sprite();
        s.haloTint = new this.pixi.ColorMatrixFilter();
        s.halo.filters = [s.haloTint, new this.pixi.BlurFilter({ strength: 6 * px, quality: 2 })];
        s.halo.blendMode = 'add';
        this.stage.addChild(s.halo);
      }
      const c = look.glow;
      // one colour, the frame's own alpha
      s.haloTint!.matrix = [0, 0, 0, 0, ((c >> 16) & 255) / 255, 0, 0, 0, 0, ((c >> 8) & 255) / 255, 0, 0, 0, 0, (c & 255) / 255, 0, 0, 0, 1, 0];
      const h = s.halo;
      h.texture = sp.texture;
      h.anchor.copyFrom(sp.anchor);
      h.position.copyFrom(sp.position);
      h.scale.copyFrom(sp.scale);
      const pulse = look.glowPulse && !this.reduced ? 0.5 + 0.5 * Math.abs(((idleNow / 0.9) % 2) - 1) : 1;
      h.alpha = sp.alpha * (0.75 + 0.25 * pulse);
      h.zIndex = u.z - 0.01;
      h.visible = true;
    } else if (s.halo) {
      s.halo.visible = false;
    }
    // ground rings (under the sprite)
    const key = look?.rings?.length ? `${look.rings.join(',')}|${cell.toFixed(1)}` : '';
    if (key && !s.rings) {
      s.rings = new this.pixi.Graphics();
      this.stage.addChild(s.rings);
    }
    if (s.rings) {
      const g = s.rings;
      if (s.ringKey !== key) {
        g.clear();
        for (const r of look?.rings ?? []) {
          const b = RING_BOX[r];
          const rx = (b.w / 2) * cell;
          const ry = (b.h / 2) * cell;
          const cy = (b.cy - 1) * cell; // drawn around the cell bottom, the Graphics sits there
          if (r === 'aura5' || r === 'aura6') {
            const col = r === 'aura6' ? LOOK_COLORS.r6 : LOOK_COLORS.r5;
            g.ellipse(0, cy, rx * 1.15, ry * 1.25).fill({ color: col, alpha: 0.12 });
            g.ellipse(0, cy, rx, ry).fill({ color: col, alpha: 0.35 });
            g.ellipse(0, cy, rx, ry).stroke({ color: r === 'aura6' ? LOOK_COLORS.aura6Rim : LOOK_COLORS.aura5Rim, width: 2 * px, alpha: 1 });
          } else {
            const col = r === 'elite' ? LOOK_COLORS.r5 : LOOK_COLORS.gold;
            g.ellipse(0, cy, rx + 3 * px, ry + 3 * px).stroke({ color: col, width: 4 * px, alpha: 0.25 });
            g.ellipse(0, cy, rx, ry).stroke({ color: col, width: 2 * px, alpha: 1 });
          }
        }
        s.ringKey = key;
      }
      g.visible = !!key;
      g.position.set(u.x + cell / 2, u.y + cell);
      const aura = look?.rings?.some(r => r === 'aura5' || r === 'aura6');
      // star aura breathes (scale .94 → 1.04, opacity .75 → 1, 1.6 s alternate)
      const k = aura && !this.reduced ? Math.abs(((idleNow / 1.6) % 2) - 1) : 1;
      g.scale.set(aura ? 0.94 + 0.1 * k : 1);
      g.alpha = (aura ? 0.75 + 0.25 * k : 1) * u.alpha;
      g.zIndex = u.z - 0.02;
    }
  }

  get cellSize(): number {
    return this.cell;
  }
}

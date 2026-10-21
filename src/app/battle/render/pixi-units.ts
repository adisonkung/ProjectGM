import { FxTrack } from '../../core/models/fx';
import type { Application, ColorMatrixFilter, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { particleDef, ParticleShape } from '../../core/data/particles';
import { gridCell, spriteUrl, stripGrid } from '../../core/data/sprite-files';
import { FX, SHEETS, SheetDef } from '../../core/data/sprites';
import type { AdvancedBloomFilter, GlowFilter } from 'pixi-filters';
import { fxLength, fxPivot, fxPlacement, fxPoseAt, projectilePlacement, projectilePoseAt } from './fx-clip';
import { Emitter, particleRng } from './particles';
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
  /** hits taken so far (battle): a change = a white hit flash */
  hit?: number;
}

/** one skill FX on the board this frame (FxView, positions in board px) */
export interface PixiFx {
  motionY?: number;
  track?: FxTrack;
  additive?: boolean;
  delayMs?: number;
  scale?: number;
  id: number;
  name: string;
  /** top-left of the cell it sits on (board px) — the unit's drawn cell for an attached FX */
  x: number;
  y: number;
  angle: number;
  flip: boolean;
  offset?: [number, number];
  under: boolean;
  managed?: boolean;
  loop?: boolean;
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
type Filters = typeof import('pixi-filters');

interface UnitGfx {
  sprite: Sprite;
  clip: UnitClip;
  sheet: string;
  /** state glow (pixi-filters GlowFilter, colour / strength per frame) */
  glow?: GlowFilter;
  tone?: ColorMatrixFilter;
  /** white hit flash */
  flash?: ColorMatrixFilter;
  lastHit?: number;
  flashAt?: number;
  filterKey?: string;
  rings?: Graphics;
  ringKey?: string;
}

/** z bands on the one stage: ground FX < units (≈ 10–90) < FX over them */
const Z_UNDER = -100000;
const Z_OVER = 100000;
const Z_BOLT = 200000;
/** particles: above the FX, below the projectiles */
const Z_PARTICLES = 150000;
/** hit flash length (game s) */
const FLASH = 0.11;

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
  private readonly fxs = new Map<number, { sprite: Sprite; name: string; t0: number; seq: number; last: PixiFx; sparked: boolean; reveal?: Texture }>();
  private readonly bolts = new Map<number, { sprite: Sprite; t0: number; last: PixiBolt }>();
  private readonly chunks = new Map<string, Texture>();
  /** FX drawn over the units sit in one container with a bloom (bright pixels glow) */
  private readonly overFx: Container;
  private readonly crispFx: Container;
  private readonly fxPool: Sprite[] = [];
  private readonly crispTextures = new Map<string, Texture>();
  private readonly bloom?: AdvancedBloomFilter;
  private readonly partLayer: Container;
  private readonly partSprites: Sprite[] = [];
  private readonly partTex = new Map<ParticleShape, Texture>();
  private readonly emitters: Emitter[] = [];
  private readonly rng = particleRng(0x5eed);
  private lastNow = 0;
  private fxSeq = 0;
  private cell = 0;
  /** GPU texture size limit (bigger sheets are cut into chunks — render/tex-chunks.ts) */
  private readonly maxTex: number;

  private constructor(
    private readonly pixi: Pixi,
    private readonly app: Application,
    private readonly stage: Container,
    private readonly filters: Filters | null,
  ) {
    this.overFx = new pixi.Container();
    this.overFx.sortableChildren = true;
    this.overFx.zIndex = Z_OVER;
    if (filters) {
      this.bloom = new filters.AdvancedBloomFilter({ threshold: 0.55, bloomScale: 0.9, brightness: 1, blur: 6, quality: 4 });
      this.overFx.filters = [this.bloom];
    }
    stage.addChild(this.overFx);
    this.crispFx = new pixi.Container();
    this.crispFx.sortableChildren = true;
    this.crispFx.zIndex = Z_OVER - .5;
    stage.addChild(this.crispFx);
    this.partLayer = new pixi.Container();
    this.partLayer.zIndex = Z_PARTICLES;
    stage.addChild(this.partLayer);
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
      // keep autoDensity's CSS width / height (a cssText here wiped them → on a 2× screen the canvas showed at its
      // pixel size: every sprite twice as big and shifted right / down)
      Object.assign(app.canvas.style, { position: 'absolute', left: '0', top: '0', display: 'block' });
      app.canvas.style.width = `${Math.max(1, width)}px`;
      app.canvas.style.height = `${Math.max(1, height)}px`;
      host.appendChild(app.canvas);
      const stage = new pixi.Container();
      stage.sortableChildren = true;
      app.stage.addChild(stage);
      // pixi-filters (bloom / glow): optional — without it the layer still draws, just plainer
      const filters = await import('pixi-filters').catch(() => null);
      return new PixiUnitLayer(pixi, app, stage, filters);
    } catch (err) {
      console.warn('[pixi] renderer unavailable — units stay DOM', err);
      return null;
    }
  }

  resize(width: number, height: number): void {
    if (width > 0 && height > 0) {
      this.app.renderer.resize(width, height);
      this.app.canvas.style.width = `${width}px`;
      this.app.canvas.style.height = `${height}px`;
    }
  }

  destroy(): void {
    for (const fx of this.fxs.values()) fx.reveal?.destroy();
    for (const sprite of this.fxPool) sprite.destroy();
    this.fxPool.length = 0;
    this.app.destroy(true, { children: true });
    for (const texture of this.crispTextures.values()) texture.destroy(true);
    this.crispTextures.clear();
    for (const t of this.chunks.values()) t.destroy(true);
    for (const t of this.partTex.values()) t.destroy(true);
    this.partTex.clear();
    this.emitters.length = 0;
    this.chunks.clear();
    this.sprites.clear();
    this.fxs.clear();
    this.bolts.clear();
  }

  /** the sheet's texture (loaded on first use; null until ready) */
  private texture(file: string, def: { pixelated?: boolean }, crisp = false): Texture | null {
    if (crisp) {
      const cached = this.crispTextures.get(file);
      if (cached) return cached;
      const base = this.texture(file, def);
      if (!base) return null;
      // A private sampler shares the decoded image, without changing legacy FX using the same file.
      const source = new this.pixi.ImageSource({ resource: base.source.resource as ImageBitmap, scaleMode: 'nearest' });
      const texture = new this.pixi.Texture({ source });
      this.crispTextures.set(file, texture);
      return texture;
    }
    const t = this.textures.get(file);
    if (t === 'loading' || t === 'failed') return null;
    if (t) return t;
    this.textures.set(file, 'loading');
    this.pixi.Assets.load<Texture>(spriteUrl(file)).then(
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
    const k = `${file}|${fw}|${fh}|${col}|${row}|${pixelated ? 1 : 0}`;
    let f = this.frames.get(k);
    if (f) return f;
    const src = base.source;
    const W = src.pixelWidth;
    const H = src.pixelHeight;
    if (W <= this.maxTex && H <= this.maxTex) {
      f = new this.pixi.Texture({ source: src, frame: new this.pixi.Rectangle(col * fw, row * fh, fw, fh) });
    } else {
      const c = frameChunk(col, row, fw, fh, W, H, this.maxTex);
      const ck = `${file}|${fw}|${fh}|${c.cx}|${c.cy}|${pixelated ? 1 : 0}`;
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

  /** the DOM rule: the image is cut into cols × rows equal cells (background-size cols×100 % rows×100 %) */
  private frame(file: string, def: SheetDef, base: Texture, row: number, col: number): Texture {
    return this.cellTex(file, base, def.pixelated, base.source.pixelWidth / def.cols, base.source.pixelHeight / def.rows, col, row);
  }

  /** a unit's skill FX textures start loading when the unit first appears (its first cast is not drawn by the DOM) */
  private preloadFx(def: SheetDef): void {
    const names = [...Object.values(def.fx ?? {}).flat(), ...Object.values(def.projectile ?? {}),
      ...Object.values(def.motionFx ?? {}).flatMap(f => [f.start, f.loop]),
      ...Object.values(def.appliedStatusFx ?? {}), ...Object.values(def.statusFx ?? {}).flatMap(f => [f.start, f.loop]),
      ...[def.fieldFx?.start, def.fieldFx?.loop, def.fieldFx?.end, def.fieldFx?.residual, def.fieldFx?.wave?.rain, def.fieldFx?.wave?.impact],
      ...Object.values(def.sequenceFx ?? {}).flatMap(cues => cues.flatMap(cue => [...cue.names, ...Object.values(cue.variants ?? {}).flat(), ...(cue.outward?.trails ?? [])]))].filter((n): n is string => !!n);
    for (const n of names) {
      const d = FX[n];
      if (!d) continue;
      this.texture(d.file, d);
      if (d.hitFx && FX[d.hitFx]) this.texture(FX[d.hitFx].file, FX[d.hitFx]);
    }
  }

  /** frame i of an FX / projectile strip — one row, or the grid the optimizer re-packed it into */
  private fxFrame(file: string, base: Texture, strip: number, i: number, pixelated?: boolean): Texture {
    const g = stripGrid(file, strip);
    const [c, r] = gridCell(i, g);
    return this.cellTex(file, base, pixelated, base.source.pixelWidth / g.cols, base.source.pixelHeight / g.rows, c, r);
  }

  /**
   * The FX for this frame (`now` = game clock). Returns the ids drawn (their DOM copy is hidden by the board).
   * Legacy one-shots finish after leaving the list; runtime-managed field views stop as soon as their owner removes them.
   */
  private drawFx(list: PixiFx[], cell: number, now: number): Set<number> {
    const drawn = new Set<number>();
    const seen = new Set<number>();
    for (const f of list) {
      seen.add(f.id);
      let s = this.fxs.get(f.id);
      if (!s) {
        if (!FX[f.name]) continue;
        const sprite = f.track ? this.fxPool.pop() ?? new this.pixi.Sprite() : new this.pixi.Sprite();
        sprite.visible = false;
        (f.under ? this.stage : f.track ? this.crispFx : this.overFx).addChild(sprite);
        s = { sprite, name: f.name, t0: now, seq: ++this.fxSeq, last: f, sparked: false };
        this.fxs.set(f.id, s);
      }
      s.last = f;
    }
    for (const [id, s] of this.fxs) {
      if (s.last.managed && !seen.has(id)) {
        s.reveal?.destroy(); this.retireFx(s.sprite, !!s.last.track); this.fxs.delete(id); continue;
      }
      const d = FX[s.name];
      const pose = fxPoseAt(d, now - s.t0 - (s.last.delayMs ?? 0) / 1000, !!s.last.loop, s.last.track);
      if (pose.done) {
        // Retain completed instances while the host still lists them; otherwise they restart as new one-shots.
        if (seen.has(id)) { s.sprite.visible = false; continue; }
        s.reveal?.destroy(); this.retireFx(s.sprite, !!s.last.track);
        this.fxs.delete(id);
        continue;
      }
      const base = this.texture(d.file, d, !!s.last.track);
      const sp = s.sprite;
      if (!base) {
        sp.visible = false;
        continue;
      }
      const f = s.last;
      const at = fxPlacement(d, cell, f.x, f.y, f.flip, f.angle, f.offset, (f.scale ?? 1) * (pose.scale ?? 1));
      at.x += (pose.dx ?? 0) * (f.flip ? -1 : 1) / 100 * cell;
      at.y += (pose.dy ?? 0) * (f.motionY ?? 1) / 100 * cell;
      const tex = this.fxFrame(d.file, base, d.stripFrames ?? d.frames, pose.frame, d.pixelated || !!f.track);
      // A per-instance cropped view reveals the original ribbon; cached/shared textures stay immutable.
      let shown = tex;
      const reveal = f.track?.reveal ? Math.max(.001, Math.min(1, pose.reveal ?? 1)) : 1;
      if (f.track?.reveal) {
        const crop = s.reveal ??= new this.pixi.Texture({ source: tex.source, frame: tex.frame.clone(), orig: tex.orig.clone(), dynamic: true });
        crop.frame.x = tex.frame.x; crop.frame.y = tex.frame.y;
        crop.frame.width = Math.max(1, Math.round(tex.frame.width * reveal));
        crop.frame.height = tex.frame.height;
        crop.orig.width = crop.frame.width; crop.orig.height = crop.frame.height;
        crop.update(); shown = crop;
      }
      sp.texture = shown;
      const piv = fxPivot(d, pose.frame);
      sp.anchor.set(piv[0] * tex.frame.width / shown.frame.width, piv[1]);
      sp.position.set(at.x, at.y);
      sp.rotation = at.rotation;
      sp.scale.set(((at.flip ? -1 : 1) * at.width) / tex.frame.width, at.height / tex.frame.height);
      sp.alpha = pose.alpha;
      sp.blendMode = d.blend === 'add' || f.additive ? 'add' : 'normal';
      sp.zIndex = f.under ? Z_UNDER + s.seq : s.seq;
      sp.visible = pose.visible;
      // particles start with the FX (after its delay), at its pivot, mirrored with it
      if (!s.sparked && pose.visible) {
        s.sparked = true;
        for (const ref of d.particles ?? []) {
          const pd = particleDef(ref);
          if (pd) this.emitters.push(new Emitter(pd, at.x / cell, at.y / cell, at.flip, this.rng, fxLength(d)));
        }
      }
      if (seen.has(id)) drawn.add(id);
    }
    return drawn;
  }

  /** Recycle only bounded, action-owned choreography; legacy FX retain their play-out behavior. */
  private retireFx(sprite: Sprite, reusable: boolean): void {
    if (reusable && this.fxPool.length < 64) {
      sprite.visible = false;
      sprite.parent?.removeChild(sprite);
      this.fxPool.push(sprite);
    } else sprite.destroy();
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
    this.drawParticles(cell, now);
    this.app.render();
    return { units: drawn, fx: fxDrawn, bolts: boltsDrawn };
  }

  private dropUnit(s: UnitGfx): void {
    s.sprite.destroy();
    s.rings?.destroy();
  }

  /** one white texture per particle shape (tinted per particle) */
  private shapeTex(shape: ParticleShape): Texture {
    let t = this.partTex.get(shape);
    if (t) return t;
    const g = new this.pixi.Graphics();
    if (shape === 'spark') {
      for (let i = 0; i < 4; i++) g.ellipse(32, 6, 32 - i * 6, 6 - i * 1.2).fill({ color: 0xffffff, alpha: 0.25 + i * 0.2 });
    } else if (shape === 'chunk') {
      g.poly([2, 0, 14, 3, 16, 12, 6, 16, 0, 9]).fill({ color: 0xffffff });
    } else if (shape === 'petal') {
      g.ellipse(10, 6, 10, 6).fill({ color: 0xffffff });
    } else {
      // soft round (dot / puff): stacked discs, brighter in the middle
      const r = shape === 'puff' ? 32 : 16;
      for (let i = 0; i < 6; i++) g.circle(r, r, r * (1 - i / 6)).fill({ color: 0xffffff, alpha: shape === 'puff' ? 0.12 : 0.2 });
    }
    t = this.app.renderer.generateTexture({ target: g, resolution: 1 });
    g.destroy();
    this.partTex.set(shape, t);
    return t;
  }

  /** step every emitter by the game clock (frozen → dt 0) and draw its particles from a sprite pool */
  private drawParticles(cell: number, now: number): void {
    const dt = Math.min(0.1, Math.max(0, now - this.lastNow));
    this.lastNow = now;
    let n = 0;
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const em = this.emitters[i];
      em.step(dt);
      if (em.done) {
        this.emitters.splice(i, 1);
        continue;
      }
      const tex = this.shapeTex(em.def.shape);
      for (const p of em.particles) {
        let sp = this.partSprites[n];
        if (!sp) {
          sp = new this.pixi.Sprite();
          sp.anchor.set(0.5);
          this.partLayer.addChild(sp);
          this.partSprites.push(sp);
        }
        n++;
        sp.texture = tex;
        sp.tint = p.color;
        sp.blendMode = em.def.blend === 'normal' ? 'normal' : 'add';
        sp.alpha = Math.max(0, em.alphaOf(p));
        sp.position.set(p.x * cell, p.y * cell);
        const size = em.sizeOf(p) * cell;
        if (em.def.shape === 'spark') {
          // a streak along its flight, longer while fast
          const v = Math.hypot(p.vx, p.vy);
          sp.rotation = Math.atan2(p.vy, p.vx);
          sp.scale.set((size * (2 + Math.min(4, v * 0.35))) / tex.width, (size * 0.7) / tex.height);
        } else {
          sp.rotation = p.rot;
          sp.scale.set(size / tex.width, (size * (em.def.shape === 'petal' ? 0.6 : 1)) / tex.height);
        }
        sp.visible = true;
      }
    }
    for (let i = n; i < this.partSprites.length; i++) this.partSprites[i].visible = false;
  }

  /** the CSS state looks of the DOM `.unit`, drawn on the canvas (render/unit-look.ts) */
  private applyLook(s: UnitGfx, u: PixiUnit, cell: number, idleNow: number): void {
    const look = u.look;
    const sp = s.sprite;
    const px = cell / 56; // CSS px at the reference cell size (56 px)
    // broken: darkened sepia (brightness .6 sepia .6 hue −20°) + 2 px jitter every 0.2 s · untargetable: partly grey
    let tone: ColorMatrixFilter | undefined;
    if (look?.broken || look?.gray) {
      tone = s.tone ??= new this.pixi.ColorMatrixFilter();
      const want = look.broken ? 'broken' : 'gray';
      if (s.filterKey?.split('|')[0] !== want) {
        tone.reset();
        if (look.broken) {
          tone.brightness(0.6, false);
          tone.sepia(true);
        } else {
          tone.desaturate();
        }
        tone.alpha = 0.6;
      }
      if (look.broken && !this.reduced) sp.position.x += (idleNow % 0.2 < 0.1 ? 0 : 2) * px;
    }
    // hit flash: the frame washes to white and back over FLASH game seconds
    if (u.hit != null && u.hit !== s.lastHit) {
      if (s.lastHit != null) s.flashAt = this.lastNow;
      s.lastHit = u.hit;
    }
    const fk = s.flashAt != null ? 1 - (this.lastNow - s.flashAt) / FLASH : 0;
    let flash: ColorMatrixFilter | undefined;
    if (fk > 0) {
      flash = s.flash ??= new this.pixi.ColorMatrixFilter();
      const w = 0.85 * fk;
      flash.matrix = [1 - w, 0, 0, 0, w, 0, 1 - w, 0, 0, w, 0, 0, 1 - w, 0, w, 0, 0, 0, 1, 0];
    }
    // state glow (buffed pulses)
    let glow: GlowFilter | undefined;
    if (look?.glow != null && this.filters) {
      glow = s.glow ??= new this.filters.GlowFilter({ distance: 10, outerStrength: 2, innerStrength: 0, color: look.glow, quality: 0.2 });
      glow.color = look.glow;
      const pulse = look.glowPulse && !this.reduced ? Math.abs(((idleNow / 0.9) % 2) - 1) : 1;
      glow.outerStrength = 1.4 + 1.6 * pulse;
    }
    const key = `${tone ? (look!.broken ? 'broken' : 'gray') : ''}|${flash ? 'f' : ''}|${glow ? 'g' : ''}`;
    if (key !== s.filterKey) {
      const list = [tone, flash, glow].filter((x): x is NonNullable<typeof x> => !!x);
      sp.filters = list.length ? list : null;
      s.filterKey = key;
    }
    // ground rings (under the sprite)
    const rkey = look?.rings?.length ? `${look.rings.join(',')}|${cell.toFixed(1)}` : '';
    if (rkey && !s.rings) {
      s.rings = new this.pixi.Graphics();
      this.stage.addChild(s.rings);
    }
    if (s.rings) {
      const g = s.rings;
      if (s.ringKey !== rkey) {
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
        s.ringKey = rkey;
      }
      g.visible = !!rkey;
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

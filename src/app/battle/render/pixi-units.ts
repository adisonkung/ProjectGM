import type { Application, Container, Sprite, Texture } from 'pixi.js';
import { FX, SHEETS, SheetDef } from '../../core/data/sprites';
import { fxPlacement, fxPoseAt, projectilePlacement, projectilePoseAt } from './fx-clip';
import { ClipRequest, UnitClip } from './unit-clip';

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
  private readonly sprites = new Map<number, { sprite: Sprite; clip: UnitClip; sheet: string }>();
  private readonly textures = new Map<string, Texture | 'loading' | 'failed'>();
  private readonly frames = new Map<string, Texture>();
  private readonly fxs = new Map<number, { sprite: Sprite; name: string; t0: number; seq: number; last: PixiFx }>();
  private readonly bolts = new Map<number, { sprite: Sprite; t0: number; last: PixiBolt }>();
  private fxSeq = 0;
  private cell = 0;

  private constructor(
    private readonly pixi: Pixi,
    private readonly app: Application,
    private readonly stage: Container,
  ) {}

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

  private frame(file: string, def: SheetDef, base: Texture, row: number, col: number): Texture {
    const k = `${file}|${row}|${col}`;
    let f = this.frames.get(k);
    if (!f) {
      const w = def.cellW ?? 132;
      const h = def.cellH ?? 100;
      f = new this.pixi.Texture({ source: base.source, frame: new this.pixi.Rectangle(col * w, row * h, w, h) });
      this.frames.set(k, f);
    }
    return f;
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

  private fxFrame(file: string, base: Texture, strip: number, i: number): Texture {
    const k = `fx|${file}|${i}`;
    let f = this.frames.get(k);
    if (!f) {
      const w = base.source.width / strip;
      f = new this.pixi.Texture({ source: base.source, frame: new this.pixi.Rectangle(i * w, 0, w, base.source.height) });
      this.frames.set(k, f);
    }
    return f;
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
      const tex = this.fxFrame(d.file, base, d.stripFrames ?? d.frames, pose.frame);
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
      const tex = this.fxFrame(d.file, base, d.frames, pose.frame);
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
        s?.sprite.destroy();
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
      drawn.add(u.id);
    }
    for (const [id, s] of this.sprites) {
      if (!live.has(id)) {
        s.sprite.destroy();
        this.sprites.delete(id);
      }
    }
    const fxDrawn = this.drawFx(fx, cell, now);
    const boltsDrawn = this.drawBolts(bolts, cell, now);
    this.app.render();
    return { units: drawn, fx: fxDrawn, bolts: boltsDrawn };
  }

  get cellSize(): number {
    return this.cell;
  }
}

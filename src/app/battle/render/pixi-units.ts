import type { Application, Container, Sprite, Texture } from 'pixi.js';
import { SHEETS, SheetDef } from '../../core/data/sprites';
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

type Pixi = typeof import('pixi.js');

/**
 * Battle units drawn by PixiJS (WebGL) — phase 1–2 of the renderer move (FX, projectiles, bars stay DOM for now).
 * The board's frame loop calls `draw()` once per display frame with ONE game clock; every unit's frame comes from
 * `UnitClip.pose(now)` (nothing animates by itself → pause / hit-stop / x2 / x4 are just the clock).
 * Pixi is imported lazily (its own chunk) only when the Pixi renderer is switched on.
 */
export class PixiUnitLayer {
  private readonly sprites = new Map<number, { sprite: Sprite; clip: UnitClip; sheet: string }>();
  private readonly textures = new Map<string, Texture | 'loading' | 'failed'>();
  private readonly frames = new Map<string, Texture>();
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
  }

  /** the sheet's texture (loaded on first use; null until ready) */
  private texture(file: string, def: SheetDef): Texture | null {
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

  /**
   * Draw all units for this display frame. `cell` = board cell size (px) · `now` = game clock (s) · `idleNow` =
   * real-time clock for the idle breath. Returns the ids actually drawn (their DOM sheet is hidden by the board).
   */
  draw(units: PixiUnit[], cell: number, now: number, idleNow: number): Set<number> {
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
    this.app.render();
    return drawn;
  }

  get cellSize(): number {
    return this.cell;
  }
}

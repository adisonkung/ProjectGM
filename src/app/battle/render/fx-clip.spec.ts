import { FX, FX_SCALE, FxDef, PX_TO_CELL } from '../../core/data/sprites';
import { fxDuration } from '../fx-sprite/fx-sprite.component';
import { projectileLife } from '../projectile/projectile.component';
import { easeIn, fxLength, fxPlacement, fxPoseAt, PROJECTILE_HOLD, projectilePlacement, projectilePoseAt } from './fx-clip';

/** the Pixi renderer's FX: one clock in, frame / alpha / place out — the same rules as the DOM FX sprite */
describe('fxPoseAt / fxPlacement (one-clock skill FX)', () => {
  const base: FxDef = { file: 'x.png', frames: 6, w: 100, h: 50, frameMs: 50, at: 'self' };

  it('plays the strip at frameMs per frame, then is done', () => {
    expect(fxPoseAt(base, 0)).toEqual({ frame: 0, alpha: 1, visible: true, done: false });
    expect(fxPoseAt(base, 0.051).frame).toBe(1);
    expect(fxPoseAt(base, 0.299).frame).toBe(5);
    expect(fxPoseAt(base, 0.301).done).toBeTrue();
    expect(fxLength(base) * 1000).toBeCloseTo(300, 6);
  });

  it('delayMs hides it until it starts · `from` plays a segment of a longer strip', () => {
    const d = { ...base, delayMs: 100, from: 4, stripFrames: 12 };
    expect(fxPoseAt(d, 0.05).visible).toBeFalse();
    expect(fxPoseAt(d, 0.1).frame).toBe(4);
    expect(fxPoseAt(d, 0.1 + 0.29).frame).toBe(9);
  });

  it('repeat loops the strip; fadeOutMs holds the last frame and fades (ease-in)', () => {
    const d = { ...base, repeat: 2, fadeOutMs: 200 };
    expect(fxPoseAt(d, 0.31).frame).toBe(0);                                      // second loop
    const mid = fxPoseAt(d, 0.6 + 0.1);
    expect(mid.frame).toBe(5);
    expect(mid.alpha).toBeCloseTo(1 - easeIn(0.5), 6);
    expect(mid.alpha).toBeGreaterThan(0.5);                                       // ease-in: slow start
    expect(fxPoseAt(d, 0.81).done).toBeTrue();
    expect(fxLength(d) * 1000).toBeCloseTo(800, 6);
  });

  it('every FX in the game has the same length on both renderers', () => {
    for (const [name, d] of Object.entries(FX)) expect(fxLength(d) * 1000).withContext(name).toBeCloseTo(fxDuration(name), 6);
  });

  it('places the pivot on (50 % + dx·flip, 50 % + dy) of the cell, sized like the DOM box', () => {
    const d = { ...base, dx: 50, dy: -20, scale: 2, pivot: [0.1, 0.9] as [number, number] };
    const p = fxPlacement(d, 40, 100, 200, false, 0);
    expect(p.x).toBeCloseTo(100 + 20 + 20, 6);
    expect(p.y).toBeCloseTo(200 + 20 - 8, 6);
    expect(p.width).toBeCloseTo((100 * PX_TO_CELL * 2 * FX_SCALE) / 100 * 40, 6);
    expect(p.height).toBeCloseTo(p.width / 2, 6);
    const f = fxPlacement(d, 40, 100, 200, true, 90);
    expect(f.x).toBeCloseTo(100 + 20 - 20, 6);
    expect(f.rotation).toBeCloseTo(Math.PI / 2, 6);
    expect(fxPlacement({ ...d, fitCells: 3 }, 40, 0, 0, false, 0).width).toBe(120);
    expect(fxPlacement(d, 40, 0, 0, false, 0, [0, 0]).x).toBe(20);              // resolved anchor offset wins
  });

  it('Kael Ult charge glow is additive light', () => {
    expect(FX['kl-ult-charge'].blend).toBe('add');
  });
});

describe('fxPlacement matches the DOM FX box', () => {
  for (const [name, flip] of [['kl-ult-wave', false], ['kl-ult-wave', true], ['kl-ult-impact', true], ['kl-ult-charge', false]] as const) {
    it(`${name}${flip ? ' (flipped)' : ''}`, async () => {
      const { TestBed } = await import('@angular/core/testing');
      const { FxSpriteComponent } = await import('../fx-sprite/fx-sprite.component');
      const cell = 50;
      const wrap = document.createElement('div');
      wrap.style.cssText = `position:fixed;left:200px;top:100px;width:${cell}px;height:${cell}px;`;
      document.body.appendChild(wrap);
      const fixture = TestBed.createComponent(FxSpriteComponent);
      fixture.componentRef.setInput('name', name);
      fixture.componentRef.setInput('flip', flip);
      wrap.appendChild(fixture.nativeElement);
      fixture.detectChanges();
      const r = (fixture.nativeElement as HTMLElement).querySelector('.fx')!.getBoundingClientRect();
      const d = FX[name];
      const p = fxPlacement(d, cell, 200, 100, flip, 0);
      const piv = d.pivot ?? [0.5, 0.5];
      const left = flip ? p.x - (1 - piv[0]) * p.width : p.x - piv[0] * p.width;
      expect(r.left).toBeCloseTo(left, 0);
      expect(r.top).toBeCloseTo(p.y - piv[1] * p.height, 0);
      expect(r.width).toBeCloseTo(p.width, 0);
      expect(r.height).toBeCloseTo(p.height, 0);
      fixture.destroy();
      wrap.remove();
    });
  }
});

describe('projectilePoseAt / projectilePlacement (one-clock projectiles)', () => {
  const bolt: FxDef = { file: 'b.png', frames: 5, w: 40, h: 20, frameMs: 50, at: 'target', angle0: 0 };

  it('flight frames 0 … n−2 once over the flight, the impact frame on arrival, gone after the hold', () => {
    expect(projectilePoseAt(bolt, 0.4, 0)).toEqual({ k: 0, frame: 0, done: false });
    expect(projectilePoseAt(bolt, 0.4, 0.39).frame).toBe(3);
    expect(projectilePoseAt(bolt, 0.4, 0.2).k).toBeCloseTo(0.5, 6);
    expect(projectilePoseAt(bolt, 0.4, 0.41)).toEqual({ k: 1, frame: 4, done: false });
    expect(projectilePoseAt(bolt, 0.4, 0.4 + PROJECTILE_HOLD + 0.001).done).toBeTrue();
    expect((0.4 + PROJECTILE_HOLD) * 1000).toBeCloseTo(projectileLife(400), 6);
    expect(projectilePoseAt({ ...bolt, frames: 1 }, 0.4, 0.2).frame).toBe(0);
  });

  it('flies the line, centred at 50 % / 42 % of the cell, rotated to the flight (noRotate stays upright)', () => {
    const a = { x: 2, y: 3 }, b = { x: 2, y: 5 };
    const p = projectilePlacement(bolt, 40, a, b, 0.5);
    expect([p.x, p.y]).toEqual([2 * 40 + 20, 4 * 40 + 40 * 0.42]);
    expect(p.rotation).toBeCloseTo(Math.PI / 2, 6);
    expect(projectilePlacement({ ...bolt, noRotate: true }, 40, a, b, 0.5).rotation).toBe(0);
    expect(projectilePlacement({ ...bolt, angle0: 90 }, 40, a, b, 0.5).rotation).toBeCloseTo(0, 6);
  });

  it('is the same box as the DOM projectile', async () => {
    const { TestBed } = await import('@angular/core/testing');
    const { ProjectileComponent } = await import('../projectile/projectile.component');
    const name = Object.keys(FX).find(n => FX[n].angle0 != null)!;
    const cell = 50;
    const wrap = document.createElement('div');
    wrap.style.cssText = `position:fixed;left:0;top:0;width:${cell * 16}px;height:${cell * 8}px;--cell:${cell}px;`;
    document.body.appendChild(wrap);
    const fixture = TestBed.createComponent(ProjectileComponent);
    fixture.componentRef.setInput('name', name);
    fixture.componentRef.setInput('from', { x: 3, y: 2 });
    fixture.componentRef.setInput('to', { x: 3, y: 2 });
    fixture.componentRef.setInput('flight', 1000);
    wrap.appendChild(fixture.nativeElement);
    fixture.detectChanges();
    await fixture.whenStable();
    const r = (fixture.nativeElement as HTMLElement).querySelector('.p')!.getBoundingClientRect();
    const p = projectilePlacement(FX[name], cell, { x: 3, y: 2 }, { x: 3, y: 2 }, 1);
    // from = to → atan2(0, 0) = 0: rotation −angle0 on both sides; compare the centre
    expect(r.left + r.width / 2).toBeCloseTo(p.x, 0);
    expect(r.top + r.height / 2).toBeCloseTo(p.y, 0);
    fixture.destroy();
    wrap.remove();
  });
});

describe('FxDef.mirror (art drawn facing left)', () => {
  it('the Bai Long ult pillar head faces the enemy: image mirrored, placement unchanged', async () => {
    const d = FX['bl3-impact'];
    expect(d.mirror).toBeTrue();
    for (const flip of [false, true]) {
      const p = fxPlacement(d, 50, 0, 0, flip, 0);
      expect(p.flip).toBe(!flip);                                                // facing right → drawn mirrored
      expect(p.x).toBeCloseTo(fxPlacement({ ...d, mirror: false }, 50, 0, 0, flip, 0).x, 6); // same spot (dx follows the caster)
    }
    const { TestBed } = await import('@angular/core/testing');
    const { FxSpriteComponent } = await import('../fx-sprite/fx-sprite.component');
    const fixture = TestBed.createComponent(FxSpriteComponent);
    fixture.componentRef.setInput('name', 'bl3-impact');
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.fx')!.style.transform).toContain('scaleX(-1)');
    fixture.componentRef.setInput('flip', true);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('.fx')!.style.transform).not.toContain('scaleX(-1)');
  });
});

import { FX, FX_SCALE, FxDef, PX_TO_CELL } from '../../core/data/sprites';
import { fxDuration } from '../fx-sprite/fx-sprite.component';
import { easeIn, fxLength, fxPlacement, fxPoseAt } from './fx-clip';

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

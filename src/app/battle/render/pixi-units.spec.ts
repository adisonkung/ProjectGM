import { PixiFx, PixiUnitLayer } from './pixi-units';

/** the Pixi canvas must keep its CSS size on high-DPI screens (bug: 2× sprites shifted on Retina) */
describe('PixiUnitLayer canvas', () => {
  it('on a 2× screen the canvas renders at 2× pixels but stays the board size in CSS', async () => {
    const dpr = Object.getOwnPropertyDescriptor(window, 'devicePixelRatio');
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: () => 2 });
    const host = document.createElement('div');
    document.body.appendChild(host);
    try {
      const layer = await PixiUnitLayer.create(host, 320, 180);
      if (!layer) return pending('no WebGL in this browser');
      const canvas = host.querySelector('canvas')!;
      expect(canvas.width).toBe(640);
      expect(canvas.style.width).toBe('320px');
      expect(canvas.style.height).toBe('180px');
      layer.resize(400, 200);
      expect(canvas.width).toBe(800);
      expect(canvas.style.width).toBe('400px');
      expect(canvas.getBoundingClientRect().width).toBeCloseTo(400, 0);
      layer.destroy();
    } finally {
      if (dpr) Object.defineProperty(window, 'devicePixelRatio', dpr);
      else delete (window as { devicePixelRatio?: number }).devicePixelRatio;
      host.remove();
    }
  });
});


describe('Pixi one-shot ownership', () => {
  it('never restarts a completed ascending arrow while the host retains its ID for cleanup', () => {
    const layer = Object.create(PixiUnitLayer.prototype) as {
      fxs: Map<number, unknown>; drawFx(list: PixiFx[], cell: number, now: number): Set<number>;
    };
    const view: PixiFx = { id: 1, name: 'sw-ult-ascent', x: 0, y: 0, flip: false, angle: 0, under: false };
    const sprite = { visible: true, destroy: jasmine.createSpy('destroy') };
    layer.fxs = new Map([[1, { sprite, name: view.name, t0: 0, seq: 1, last: view, sparked: true }]]);
    layer.drawFx([view], 56, 0.51);
    expect(sprite.visible).toBeFalse();
    expect(layer.fxs.size).toBe(1);
    layer.drawFx([view], 56, 0.55);
    expect(sprite.destroy).not.toHaveBeenCalled();
    layer.drawFx([], 56, 0.6);
    expect(layer.fxs.size).toBe(0);
    expect(sprite.destroy).toHaveBeenCalledTimes(1);
  });
});

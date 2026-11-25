import { PixiFx, PixiUnitLayer } from './pixi-units';
import { PlaybackClocks } from './exclusive-playback';

/** the Pixi canvas must keep its CSS size on high-DPI screens (bug: 2× sprites shifted on Retina) */
describe('PixiUnitLayer canvas', () => {
  it('disposes prepared frame views once without destroying shared cached images', () => {
    const layer = Object.create(PixiUnitLayer.prototype) as PixiUnitLayer;
    const frame = { destroy: jasmine.createSpy('frame.destroy') }, shared = { destroy: jasmine.createSpy('shared.destroy') };
    Object.assign(layer, {
      destroyed: false, fxs: new Map(), fxPool: [], app: { destroy: jasmine.createSpy('app.destroy') },
      frames: new Map([['ready-frame', frame]]), textures: new Map([['shared-sheet', shared]]),
      crispTextures: new Map(), chunks: new Map(), partTex: new Map(), emitters: [], sprites: new Map(), bolts: new Map(),
    });
    layer.destroy(); layer.destroy();
    expect(frame.destroy).toHaveBeenCalledTimes(1); expect(frame.destroy).toHaveBeenCalledWith();
    expect(shared.destroy).not.toHaveBeenCalled();
  });
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
    Object.assign(layer, { playback: new PlaybackClocks(), liveClocks: new Set(), focus: null });
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

describe('scripted FX sprite reuse', () => {
  it('recycles bounded owned sprites, detaches them immediately, and keeps legacy disposal unchanged', () => {
    const layer=Object.create(PixiUnitLayer.prototype) as {fxPool:unknown[];retireFx(sprite:unknown,reusable:boolean):void};
    layer.fxPool=[];
    const sprites=Array.from({length:65},()=>({visible:true,parent:{removeChild:jasmine.createSpy()},destroy:jasmine.createSpy()}));
    sprites.forEach(s=>layer.retireFx(s,true));
    expect(layer.fxPool.length).toBe(64);
    expect(sprites[0].visible).toBeFalse();expect(sprites[0].parent.removeChild).toHaveBeenCalledWith(sprites[0]);
    expect(sprites[64].destroy).toHaveBeenCalledTimes(1);
    const legacy={destroy:jasmine.createSpy()};layer.retireFx(legacy,false);expect(legacy.destroy).toHaveBeenCalledTimes(1);
  });
});

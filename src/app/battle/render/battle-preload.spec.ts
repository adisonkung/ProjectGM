import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { preloadBattle, PreloadResult } from './battle-preload';

describe('strict battle asset readiness', () => {
  let decode: (url: string) => Promise<boolean>;
  beforeEach(() => {
    decode = () => Promise.resolve(true);
    spyOn(window, 'Image').and.callFake(function () {
      const image = { src: '', decoding: '', decode: () => decode(image.src).then(ok => ok ? undefined : Promise.reject(new Error('missing'))) };
      return image as unknown as HTMLImageElement;
    });
  });
  it('deduplicates files and never reports failed images as complete', async () => {
    decode = url => Promise.resolve(url !== '/missing');
    const progress: number[] = [];
    const result = await preloadBattle({ sprites: ['/ok', '/ok'], images: ['/ok', '/missing'], pixi: false, onProgress: n => progress.push(n) });
    expect(result.loaded).toBe(1); expect(result.total).toBe(2); expect(result.failed).toEqual(['/missing']);
    expect(Math.max(...progress)).toBe(1); expect(window.Image).toHaveBeenCalledTimes(2);
  });
  it('keeps a timed-out required file incomplete rather than unlocking combat', fakeAsync(() => {
    decode = () => new Promise(() => {});
    let result: PreloadResult | undefined;
    void preloadBattle({ sprites: [], images: ['/slow'], pixi: false, timeoutMs: 10 }).then(r => result = r);
    flushMicrotasks(); tick(11); flushMicrotasks();
    expect(result?.loaded).toBe(0); expect(result?.failed).toEqual(['/slow']);
  }));
  it('suppresses progress from a cancelled in-flight request', async () => {
    const complete: ((ok: boolean) => void)[] = [];
    decode = () => new Promise(resolve => complete.push(resolve));
    const token = { cancelled: false }, progress = jasmine.createSpy('progress');
    const pending = preloadBattle({ sprites: [], images: ['/pending', '/next'], pixi: false, token, onProgress: progress });
    token.cancelled = true; complete.forEach(resolve => resolve(true));
    await pending;
    expect(progress).toHaveBeenCalledTimes(1);
  });
});

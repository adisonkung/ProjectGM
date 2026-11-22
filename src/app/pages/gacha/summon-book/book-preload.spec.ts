import { loadBookImage } from './book-preload';

describe('decoded summon image cache', () => {
  it('shares an in-flight image and waits for decoding before it is usable', async () => {
    let decoded!: () => void;
    const image = { src: '', onload: () => {}, decode: () => new Promise<void>(resolve => { decoded = resolve; }) };
    const construct = spyOn(window, 'Image').and.returnValue(image as unknown as HTMLImageElement);
    const a = loadBookImage('/spec/shared-summon-image'), b = loadBookImage('/spec/shared-summon-image');
    expect(a).toBe(b);
    expect(construct).toHaveBeenCalledTimes(1);
    let ready = false; void a.then(() => { ready = true; });
    image.onload(); await Promise.resolve();
    expect(ready).toBeFalse();
    decoded(); expect(await a).toBe(image as unknown as HTMLImageElement);
    expect(loadBookImage('/spec/shared-summon-image')).toBe(a);
  });

  it('evicts failed images so the next visit can retry', async () => {
    const image = { src: '', onerror: () => {} };
    const construct = spyOn(window, 'Image').and.returnValue(image as unknown as HTMLImageElement);
    const first = loadBookImage('/spec/retry-summon-image');
    image.onerror(); await expectAsync(first).toBeRejected();
    const retry = loadBookImage('/spec/retry-summon-image');
    expect(construct).toHaveBeenCalledTimes(2);
    expect(retry).not.toBe(first);
    image.onerror(); await expectAsync(retry).toBeRejected();
  });
});

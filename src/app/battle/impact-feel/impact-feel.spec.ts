import { playImpactFeel } from './impact-feel';

describe('playImpactFeel camera zoom', () => {
  it('ignores authored screen flash while retaining the hit-stop and camera feel', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="board"><div class="cam"></div></div>';
    document.body.appendChild(root);
    try {
      expect(playImpactFeel(root, { flashMs: 180, hitStopMs: 40, shakePx: 4, zoomPct: 2 })).toBe(40);
      expect(root.querySelector('.board')!.children.length).toBe(1);
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        expect(root.getAnimations().length).toBe(1);
        expect(root.querySelector('.cam')!.getAnimations().length).toBe(1);
      }
    } finally { root.remove(); }
  });
  it('scales the board camera layer around the focus cell and eases back', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="board"><div class="cam"></div></div>';
    document.body.appendChild(root);
    const cam = root.querySelector<HTMLElement>('.cam')!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    playImpactFeel(root, { zoomPct: 5, shakeMs: 100 }, { c: 3, r: 2 });
    if (!reduced) {
      const a = cam.getAnimations();
      expect(a.length).toBe(1);
      const k = (a[0].effect as KeyframeEffect).getKeyframes();
      expect(k.map(f => f['scale'])).toEqual(['1', '1.05', '1']);
      expect((a[0].effect as KeyframeEffect).getTiming().duration).toBe(200);
      expect(cam.style.transformOrigin).toContain('var(--cell)');
    }
    root.remove();
  });

  it('no zoomPct: the camera is left alone', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div class="board"><div class="cam"></div></div>';
    document.body.appendChild(root);
    playImpactFeel(root, { shakePx: 4 });
    expect(root.querySelector<HTMLElement>('.cam')!.getAnimations().length).toBe(0);
    root.remove();
  });
});

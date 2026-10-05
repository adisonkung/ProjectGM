import { ImpactFeel } from '../../core/data/sprites';

/**
 * Contact feel of a landed skill (data: `AnimDef.impact`), shared by the battle page and the sprite lab:
 * hit-stop = every running animation under `root` (sprites, FX, unit tweens) pauses for `hitStopMs`, then a small
 * screen shake on `root`. Returns the hit-stop length (the battle page also holds the engine for it).
 * Purely visual — never touches combat state; reduced-motion users get no shake.
 */
export function playImpactFeel(root: HTMLElement | null | undefined, feel: ImpactFeel | undefined): number {
  if (!root || !feel || typeof root.getAnimations !== 'function') return 0;
  const stop = Math.max(0, feel.hitStopMs ?? 0);
  if (stop > 0) {
    const running = root.getAnimations({ subtree: true }).filter(a => a.playState === 'running');
    running.forEach(a => a.pause());
    setTimeout(() => running.forEach(a => a.playState === 'paused' && a.play()), stop);
  }
  const px = feel.shakePx ?? 0;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (px > 0 && !reduced) {
    root.animate(
      [
        { translate: '0 0' },
        { translate: `${-px}px ${px * 0.5}px` },
        { translate: `${px}px ${-px * 0.5}px` },
        { translate: `${-px * 0.5}px 0` },
        { translate: '0 0' },
      ],
      { duration: feel.shakeMs ?? 140, delay: stop, easing: 'linear' },
    );
  }
  const flash = feel.flashMs ?? 0;
  if (flash > 0 && typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.style.cssText = 'position:absolute;inset:0;background:#fff;pointer-events:none;z-index:400;mix-blend-mode:screen;opacity:0';
    ((root.querySelector('.board') as HTMLElement | null) ?? root).appendChild(el);
    const a = el.animate([{ opacity: reduced ? 0.25 : 0.7 }, { opacity: 0 }], { duration: flash, delay: stop * 0.5, easing: 'ease-out' });
    a.onfinish = a.oncancel = () => el.remove();
    setTimeout(() => el.remove(), flash + stop + 200);
  }
  return stop;
}

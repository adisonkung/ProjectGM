import { ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, input, output, inject } from '@angular/core';

/**
 * One-shot UI VFX from a grid sprite sheet (Gilded Ember pack: 4 × 3 frames, black un-mixed to alpha by tools/ui/import_gilded.py).
 * Plays once with the Web Animations API, then emits `done`. Reduced motion = skipped (emits immediately).
 * Decorative only (aria-hidden, no pointer events). Size/position come from the parent's CSS.
 */
@Component({
  selector: 'app-sheet-fx',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: '<i></i>',
  styles: `:host{position:absolute;display:block;pointer-events:none;transform:translate(-50%,-50%)}
    i{display:block;width:100%;height:100%;background-repeat:no-repeat;opacity:0}`,
})
export class SheetFxComponent implements OnInit, OnDestroy {
  readonly src = input.required<string>();
  readonly cols = input(4);
  readonly rows = input(3);
  readonly frames = input(12);
  readonly fps = input(14);
  readonly delayMs = input(0);
  readonly done = output<void>();
  private readonly host = inject(ElementRef<HTMLElement>);
  private anim?: Animation;

  ngOnInit(): void {
    const el = this.host.nativeElement.querySelector('i') as HTMLElement;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof el.animate !== 'function') { queueMicrotask(() => this.done.emit()); return; }
    const cols = this.cols(), rows = this.rows(), n = this.frames();
    el.style.backgroundImage = `url(${this.src()})`;
    el.style.backgroundSize = `${cols * 100}% ${rows * 100}%`;
    const pos = (i: number) => `${cols > 1 ? (i % cols) / (cols - 1) * 100 : 0}% ${rows > 1 ? Math.floor(i / cols) / (rows - 1) * 100 : 0}%`;
    const keys: Keyframe[] = Array.from({ length: n }, (_, i) => ({ backgroundPosition: pos(i), opacity: 1, offset: i / n, easing: 'steps(1, end)' }));
    keys.push({ backgroundPosition: pos(n - 1), opacity: 0, offset: 1 });
    this.anim = el.animate(keys, { duration: (n / this.fps()) * 1000, delay: this.delayMs(), fill: 'both' });
    this.anim.onfinish = () => this.done.emit();
  }

  ngOnDestroy(): void { this.anim?.cancel(); }
}

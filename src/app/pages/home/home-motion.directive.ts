import { Directive, ElementRef, HostListener, inject, input, OnDestroy, OnInit, signal } from '@angular/core';

/** Decorative motion follows hover, keyboard focus, and touch without handling clicks. */
@Directive({
  selector: '[appHomeMotion]',
  exportAs: 'homeMotion',
  host: {
    '[class.art-active]': 'active()',
    '[class.art-short]': 'short()',
  },
})
export class HomeMotionDirective implements OnInit, OnDestroy {
  readonly introDelay = input<number>();
  readonly pressDuration = input(460);
  readonly active = signal(false);
  readonly short = signal(false);

  private readonly element = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly reduced = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly touchOnly = matchMedia('(hover: none) and (pointer: coarse)');
  private intro?: ReturnType<typeof setTimeout>;
  private release?: ReturnType<typeof setTimeout>;
  private replay?: ReturnType<typeof setTimeout>;
  private over = false;
  private focused = false;
  private destroyed = false;

  ngOnInit(): void {
    const delay = this.introDelay();
    if (delay !== undefined && this.touchOnly.matches && !this.reduced.matches) {
      this.intro = setTimeout(() => this.playBriefly(false), delay);
    }
    this.reduced.addEventListener('change', this.preferenceChanged);
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.preferenceChanged();
    this.reduced.removeEventListener('change', this.preferenceChanged);
  }

  @HostListener('pointerenter', ['$event'])
  enter(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.touchOnly.matches) return;
    this.over = true;
    this.play();
  }

  @HostListener('pointerleave', ['$event'])
  leave(event: PointerEvent): void {
    if (event.pointerType !== 'mouse') return;
    this.over = false;
    if (!this.focused) this.active.set(false);
  }

  @HostListener('focus')
  focus(): void {
    if (!this.element.matches(':focus-visible')) return;
    this.focused = true;
    this.play();
  }

  @HostListener('blur')
  blur(): void {
    this.focused = false;
    if (!this.over) this.active.set(false);
  }

  @HostListener('pointerdown', ['$event'])
  press(event: PointerEvent): void {
    if (event.pointerType === 'touch' || this.touchOnly.matches) {
      clearTimeout(this.intro);
      this.cancelPress();
      const short = this.introDelay() === undefined;
      if (this.active()) {
        // Let Angular release the current layers before replaying a touch during the intro.
        this.active.set(false);
        this.replay = setTimeout(() => this.playBriefly(short));
      } else {
        this.playBriefly(short);
      }
    }
  }

  private play(): void {
    if (this.reduced.matches || this.destroyed) return;
    this.short.set(false);
    this.active.set(true);
  }

  private playBriefly(short: boolean): void {
    if (this.reduced.matches || this.destroyed) return;
    clearTimeout(this.release);
    this.short.set(short);
    this.active.set(true);
    this.release = setTimeout(() => {
      if (!this.over && !this.focused) this.active.set(false);
    }, this.pressDuration());
  }

  private readonly preferenceChanged = (): void => {
    clearTimeout(this.intro);
    this.cancelPress();
    this.active.set(false);
  };

  private cancelPress(): void {
    clearTimeout(this.release);
    clearTimeout(this.replay);
  }
}

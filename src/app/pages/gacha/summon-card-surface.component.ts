import { AfterViewInit, ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, NgZone, OnDestroy, ViewEncapsulation } from '@angular/core';

/** A continuous hinged surface: the texture bends with the card, not just its outer pose. */
@Component({
  selector: 'app-summon-card-surface',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<div class="card-flex-surface" aria-hidden="true"></div>',
  styleUrl: './summon-card-surface.component.scss',
})
export class SummonCardSurfaceComponent implements AfterViewInit, OnDestroy {
  readonly src = input.required<string>();
  readonly seed = input(0);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private animations: Animation[] = [];
  private ready = false;
  private builtKey = '';
  private readonly onMotion = () => this.build();

  constructor() { effect(() => { this.src(); this.seed(); if (this.ready) this.build(); }); }
  ngAfterViewInit(): void {
    this.ready = true;
    this.motion.addEventListener('change', this.onMotion);
    this.build();
  }
  private build(): void {
    if (!this.ready) return;
    const surface = this.element.nativeElement.querySelector<HTMLElement>('.card-flex-surface');
    if (!surface) return;
    const key = `${this.src()}|${this.seed()}|${this.motion.matches}`;
    if (this.builtKey === key) return;
    this.builtKey = key;
    this.animations.forEach(a => a.cancel()); this.animations = [];
    surface.replaceChildren();
    const count = 10, seed = this.seed() * .73, duration = 1800 + (this.seed() % 4) * 110;
    surface.style.setProperty('--card-texture', `url("${this.src()}")`);
    surface.style.setProperty('--bands', String(count));
    this.zone.runOutsideAngular(() => {
      let parent = surface;
      const bones: HTMLElement[] = [], glints: HTMLElement[] = [];
      for (let i = 0; i < count; i++) {
        const bone = document.createElement('div'), face = document.createElement('div'), glint = document.createElement('i');
        bone.className = 'card-flex-bone' + (i === 0 ? ' card-flex-root' : ''); face.className = 'card-flex-face'; glint.className = 'card-flex-glint';
        face.style.setProperty('--slice-y', `${i / (count - 1) * 100}%`);
        face.append(glint); bone.append(face); parent.append(bone); parent = bone;
        bones.push(bone); glints.push(glint);
      }
      if (this.motion.matches) return;
      const rig: Keyframe[] = [], hinges: Keyframe[][] = bones.map(() => []), light: Keyframe[][] = bones.map(() => []);
      for (let step = 0; step <= 48; step++) {
        const t = step / 48, a = t * Math.PI * 2;
        rig.push({ offset:t, transform:`rotateX(${16*Math.sin(a+seed)}deg) rotateY(${27*Math.sin(a+seed+.9)}deg) rotateZ(${10*Math.sin(2*a+seed)}deg)` });
        bones.forEach((_, j) => {
          // Hinges share their endpoints. Phase lag accumulates toward the free lower edge.
          const wave = 2*a-j*.35+seed;
          const bend = 7*Math.sin(wave)+2*Math.sin(a-j*.6+seed);
          const twist = 1.7*Math.sin(a-j*.43+seed+.6);
          hinges[j].push({ offset:t, transform:`rotateX(${bend}deg) rotateY(${twist}deg)` });
          light[j].push({ offset:t, opacity:.035+.17*Math.max(0,Math.sin(wave+.5)) });
        });
      }
      const options: KeyframeAnimationOptions = { duration, iterations:Infinity, easing:'linear' };
      this.animations.push(surface.animate(rig, options));
      bones.forEach((bone,j) => {
        this.animations.push(bone.animate(hinges[j], options));
        this.animations.push(glints[j].animate(light[j], options));
      });
      // Give all joints one explicit timeline origin, including the first rendered frame.
      const start = document.timeline.currentTime;
      if (start !== null) this.animations.forEach(a => { a.startTime = start; });
    });
  }
  ngOnDestroy(): void {
    this.ready = false;
    this.animations.forEach(a => a.cancel()); this.animations = [];
    this.motion.removeEventListener('change', this.onMotion);
  }
}

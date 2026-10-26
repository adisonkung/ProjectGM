import { SummonCardSurfaceComponent } from './summon-card-surface.component';
import { summonCardBack } from './summon-card-art';
import { AfterViewInit, ChangeDetectionStrategy, Component, computed, effect, ElementRef, inject, input, NgZone, OnDestroy } from '@angular/core';

let flightId = 0;

/** Light-bound card choreography; presentation of committed results, with no timers or RNG. */
@Component({
  selector: 'app-summon-flight',
  imports: [SummonCardSurfaceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.releasing]': 'release()', '[class.grand]': 'grand()' },
  template: `
    <svg class="light-ribbons" viewBox="0 0 1000 700" preserveAspectRatio="none">
      <defs><linearGradient [id]="id" x1="0" y1="1" x2="0" y2="0"><stop stop-color="#ffe8ac" stop-opacity="0"/><stop offset=".28" stop-color="#ffe8ac"/><stop offset=".7" stop-color="#b8e9ff"/><stop offset="1" stop-color="#fff9df" stop-opacity="0"/></linearGradient></defs>
      @for (c of cards(); track $index) { <g [style.--delay]="c.delay + 's'"><path class="ribbon-halo" [attr.d]="c.path" [attr.stroke]="'url(#' + id + ')'"/><path class="ribbon-core" [attr.d]="c.path" [attr.stroke]="'url(#' + id + ')'"/></g> }
    </svg>
    <div class="floor-wash"></div>
    <div class="flight-space">
      @for (c of cards(); track $index) {
        <div class="floor-glint" [style.--floor-x]="c.x * .72 + 'vw'" [style.--delay]="c.delay + 's'"></div>
        <div class="flight" [class.rare]="c.star >= 3" [style.--x]="c.x + 'vw'" [style.--y]="c.y + 'vh'" [style.--arc-x]="c.arcX + 'vw'" [style.--arc-y]="c.arcY + 'vh'" [style.--end-x]="c.endX + 'vw'" [style.--end-y]="c.endY + 'vh'" [style.--depth]="c.depth + 'px'" [style.--yaw]="c.yaw + 'deg'" [style.--roll]="c.roll + 'deg'" [style.--end-roll]="c.roll * 1.6 + 'deg'" [style.--delay]="c.delay + 's'" [style.--size]="c.size" [style.--face-mask]="'url(' + cardBack(c.star) + ')'">
          <i class="wake"></i><div class="card-body"><app-summon-card-surface [src]="cardBack(c.star)" [seed]="$index" /></div>
        </div>
      }
    </div>
  `,
  styleUrl: './summon-flight.component.scss',
})
export class SummonFlightComponent implements AfterViewInit, OnDestroy {
  readonly stars = input.required<readonly number[]>();
  readonly release = input(false);
  readonly grand = input(false);
  readonly cardBack = summonCardBack;
  readonly id = 'summon-flight-light-' + flightId++;
  readonly cards = computed(() => {
    const stars = this.stars(), n = stars.length;
    return stars.map((star, i) => {
      const a = n === 1 ? -Math.PI / 2 : i * Math.PI * 2 / n - Math.PI / 2;
      const depth = Math.sin(a), x = n === 1 ? 0 : Math.cos(a) * 24;
      const y = n === 1 ? -5 : Math.sin(a) * 9 - 3;
      return { star, x, y, depth: depth * 85, size: .8 + depth * .12,
        arcX: n === 1 ? 0 : Math.cos(a + .65) * 29,
        arcY: n === 1 ? -8 : Math.sin(a + .65) * 12 - 5,
        endX: n === 1 ? 0 : Math.cos(a + .65) * 57,
        endY: n === 1 ? -18 : Math.sin(a + .65) * 47 - 8,
        yaw: n === 1 ? -18 : -Math.cos(a) * 38,
        roll: n === 1 ? -5 : Math.cos(a) * 9,
        delay: n === 1 ? 0 : i * (this.grand() ? .034 : .014),
        path: `M500 508 C${500 + x * 2} 478 ${500 + x * 8} ${336 + y * 5} ${500 + x * 10} ${336 + y * 7}`,
      };
    });
  });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly zone = inject(NgZone);
  private animations: Animation[] = [];
  private ready = false;
  private phaseKey = '';

  constructor() {
    effect(() => { this.release(); this.grand(); this.stars(); if (this.ready) this.play(); });
  }
  ngAfterViewInit(): void { this.ready = true; this.play(); }
  private play(): void {
    const key = `${this.release()}-${this.grand()}-${this.stars().join(',')}`;
    if (this.phaseKey === key) return;
    this.phaseKey = key;
    this.animations.forEach(a => a.cancel()); this.animations = [];
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const releasing = this.release(), duration = releasing ? (this.grand() ? 2250 : 1300) : (this.grand() ? 1800 : 300);
    const elements = this.host.nativeElement.querySelectorAll<HTMLElement>('.flight');
    this.zone.runOutsideAngular(() => this.cards().forEach((card, i) => {
      const el = elements[i]; if (!el) return;
      type Point = { x: number; y: number; z: number };
      const origin: Point = { x: card.x, y: card.y, z: card.depth };
      const points: Point[] = releasing ? [origin,
        { x: card.arcX, y: card.arcY, z: card.depth + 70 },
        { x: card.endX * .62, y: card.endY * .56, z: 180 },
        { x: card.endX, y: card.endY, z: 410 }] : [
        { x: 0, y: 24, z: -330 }, { x: 0, y: 15, z: -210 },
        { x: card.x * .72, y: card.y - 10, z: card.depth - 120 }, origin];
      const position = (u: number): Point => {
        const q = 1 - u, [a,b,c,d] = points;
        return { x: q*q*q*a.x+3*q*q*u*b.x+3*q*u*u*c.x+u*u*u*d.x,
          y: q*q*q*a.y+3*q*q*u*b.y+3*q*u*u*c.y+u*u*u*d.y,
          z: q*q*q*a.z+3*q*q*u*b.z+3*q*u*u*c.z+u*u*u*d.z };
      };
      const frames: Keyframe[] = [], wakes: Keyframe[] = [];
      for (let step = 0; step <= 64; step++) {
        const t = step / 64;
        // Sample a continuous cubic path. Accelerating release retains a curved orbit tangent;
        // quintic gathering approaches the suspended position with zero endpoint velocity.
        const u = releasing ? Math.pow(t, 1.6) : t*t*t*(10-15*t+6*t*t);
        const p = position(u), next = position(Math.min(1, u + .002));
        const vx = (next.x-p.x)*innerWidth*.01, vy = (next.y-p.y)*innerHeight*.01;
        const bank = Math.max(-18, Math.min(18, vx * .9));
        const yaw = releasing ? card.yaw * (1 - u * 1.75) : card.yaw * u;
        const roll = releasing ? card.roll + bank * Math.sin(t*Math.PI) : card.roll*u + Math.sin(t*10)*3*(1-u);
        const pitch = releasing ? -8 + Math.sin(t*Math.PI)*16 : 60 - 68*u;
        const scale = releasing ? card.size + .55*u : .08 + (card.size-.08)*u;
        const opacity = releasing ? 1 - Math.pow(Math.max(0,(t-.66)/.34), 1.7) : Math.min(1,t/.24);
        frames.push({ offset:t, opacity, transform:`translate(calc(-50% + ${p.x}vw),calc(-50% + ${p.y}vh)) translateZ(${p.z}px) rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${roll}deg) scale(${scale})` });
        wakes.push({ offset:t, transform:`translateZ(-4px) rotateZ(${Math.atan2(vx, -vy)*180/Math.PI-roll}deg) rotateX(15deg)`, opacity:releasing ? Math.sin(t*Math.PI)*.65 : 0 });
      }
      const options: KeyframeAnimationOptions = { duration, delay:card.delay*1000, easing:'linear', fill:'both' };
      this.animations.push(el.animate(frames, options));
      const wake = el.querySelector<HTMLElement>('.wake');
      if (wake) this.animations.push(wake.animate(wakes, options));
    }));
  }
  ngOnDestroy(): void { this.animations.forEach(a => a.cancel()); this.animations = []; }

}

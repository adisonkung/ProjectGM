import { Component, computed, input } from '@angular/core';
import { MAX_STAR } from '../core/data/stars';
import { HERO_STAR_EMPTY, HERO_STAR_LIT } from './hero-star-art';

@Component({
  selector: 'app-awakened-star',
  standalone: true,
  host: {
    'aria-hidden': 'true',
    '[style.--accent-delay]': "index() * 320 + 'ms'",
  },
  template: `
    <span class="aura"></span>
    <img [src]="art" alt="" />
    <span class="sheen"></span>
    <span class="glint"></span>
  `,
  styleUrl: './awakened-star.component.scss',
})
export class AwakenedStarComponent {
  readonly index = input.required<number>();
  readonly art = HERO_STAR_LIT;
}

@Component({
  selector: 'app-hero-stars',
  standalone: true,
  imports: [AwakenedStarComponent],
  host: { role: 'img', '[attr.aria-label]': "count() + ' ดาว'" },
  template: `
    @for (index of slots(); track index) {
      <span class="star-slot" aria-hidden="true">
        @if (awakened() && index < count()) {
          <app-awakened-star [index]="index" />
        } @else {
          <img [src]="index < count() ? litArt : emptyArt" alt="" />
        }
      </span>
    }
  `,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      gap: var(--hero-star-gap, 1px);
      max-inline-size: 100%;
      vertical-align: middle;
      white-space: nowrap;
    }
    .star-slot {
      inline-size: var(--hero-star-size, 1.12em);
      min-inline-size: 0;
      flex: 0 1 var(--hero-star-size, 1.12em);
      aspect-ratio: 1;
    }
    img, app-awakened-star {
      inline-size: 100%;
      block-size: 100%;
    }
    img {
      display: block;
      object-fit: contain;
    }
  `,
})
export class HeroStarsComponent {
  readonly count = input.required<number>();
  readonly total = input(0);
  readonly litArt = HERO_STAR_LIT;
  readonly emptyArt = HERO_STAR_EMPTY;
  readonly awakened = computed(() => this.count() >= MAX_STAR);
  readonly slots = computed(() => Array.from({ length: Math.max(this.count(), this.total()) }, (_, index) => index));
}

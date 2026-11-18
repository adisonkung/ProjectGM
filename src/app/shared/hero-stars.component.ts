import { Component, computed, input } from '@angular/core';
import { MAX_STAR } from '../core/data/stars';

@Component({
  selector: 'app-awakened-star',
  standalone: true,
  host: {
    'aria-hidden': 'true',
    '[style.--fire-delay]': "index() * -280 + 'ms'",
    '[style.--shine-delay]': "index() * 320 + 'ms'",
  },
  template: `
    <span class="fire" aria-hidden="true"></span>
    <img src="ui/gilded/star_lit.webp" alt="" />
    <span class="sheen" aria-hidden="true"></span>
  `,
  styleUrl: './awakened-star.component.scss',
})
export class AwakenedStarComponent {
  readonly index = input.required<number>();
}

@Component({
  selector: 'app-hero-stars',
  standalone: true,
  imports: [AwakenedStarComponent],
  host: { role: 'img', '[attr.aria-label]': "count() + ' ดาว'" },
  template: `
    @if (awakened()) {
      @for (index of stars(); track index) {
        <app-awakened-star [index]="index" />
      }
    } @else if (painted()) {
      @for (index of stars(); track index) {
        <img src="ui/gilded/star_lit.webp" alt="" />
      }
    } @else {
      <span aria-hidden="true">{{ glyphs() }}</span>
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
    img, app-awakened-star {
      inline-size: var(--hero-star-size, 1em);
      min-inline-size: 0;
      flex: 0 1 auto;
      aspect-ratio: 1;
    }
  `,
})
export class HeroStarsComponent {
  readonly count = input.required<number>();
  readonly painted = input(false);
  readonly awakened = computed(() => this.count() >= MAX_STAR);
  readonly stars = computed(() => Array.from({ length: this.count() }, (_, index) => index));
  readonly glyphs = computed(() => '★'.repeat(this.count()));
}

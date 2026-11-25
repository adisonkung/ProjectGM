import { GENERATED_ICONS } from '../../core/data/generated-art';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Collection glyphs stay monochrome so the sidebar can carry the class palette. */
const PATHS: Record<string, string> = {
  all: 'M12 1 15.5 6.5 12 10 8.5 6.5ZM23 12 17.5 15.5 14 12 17.5 8.5ZM12 23 8.5 17.5 12 14 15.5 17.5ZM1 12 6.5 8.5 10 12 6.5 15.5Z',
  news: 'M3 9h5l12-5v16L8 15H3ZM7 15l2 6h4l-2-5M5 9v6M20 8l2-1M20 16l2 1',
  back: 'M15 3 6 12l9 9',
  search: 'M16 16l6 6M18 10A8 8 0 1 1 2 10a8 8 0 0 1 16 0',
  filter: 'M2 3h20l-8 9v8l-4 2V12Z',
  check: 'M4 12l5 5L21 5',
  gem: 'M6 3h12l4 6-10 12L2 9ZM2 9h20M9 3l3 18 3-18',
};
@Component({
  selector: 'app-collection-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (classArt(); as src) {<span class="class-art" [style.width.px]="size()" [style.height.px]="size()" [style.mask-image]="'url(' + src + ')'" aria-hidden="true"></span>} @else {<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="path()" [attr.fill]="name() === 'all' ? 'currentColor' : 'none'" /></svg>}`,
  styles: ':host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; flex: none; } .class-art { display: block; background: currentColor; mask-position: center; mask-repeat: no-repeat; mask-size: contain; }',

})
export class CollectionIconComponent {
  readonly name = input.required<string>();
  readonly size = input(24);
  readonly classArt = computed(() => GENERATED_ICONS['class-' + this.name()]);
  readonly path = computed(() => PATHS[this.name()] ?? PATHS['all']);
}

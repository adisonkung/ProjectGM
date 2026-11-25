import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Collection glyphs stay monochrome so the sidebar can carry the class palette. */
const PATHS: Record<string, string> = {
  all: 'M12 1 15.5 6.5 12 10 8.5 6.5ZM23 12 17.5 15.5 14 12 17.5 8.5ZM12 23 8.5 17.5 12 14 15.5 17.5ZM1 12 6.5 8.5 10 12 6.5 15.5Z',
  fighter: 'M4 3l12 12-3 3L2 5ZM20 3 8 15l3 3L22 5ZM12 17l5 5M7 14l-4 4M12 17l-5 5M17 14l4 4',
  tank: 'M12 2 21 6v7c0 5-5 8-9 10-4-2-9-5-9-10V6ZM12 5v15M6 8l6-3 6 3v5c0 3-3 5-6 7-3-2-6-4-6-7Z',
  assassin: 'M19 2 13 5 5 15l4 4 10-8ZM5 15l4 4M4 18l2 2M2 22l3-3M12 9l3 3',
  archer: 'M5 3c18 2 18 16 0 18M5 3l10 9L5 21M2 12h20M18 8l4 4-4 4',
  mage: 'M12 2c0 5 6 6 6 12a6 6 0 0 1-12 0c0-3 2-5 4-7-1 5 4 6 4 9a2 2 0 0 1-4 0M5 8c-3 3-3 9 0 12M19 7c3 4 3 9 0 13',
  healer: 'M12 2c1 6 4 9 10 10-6 1-9 4-10 10-1-6-4-9-10-10 6-1 9-4 10-10ZM12 7v10M7 12h10',
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
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="path()" [attr.fill]="name() === 'all' ? 'currentColor' : 'none'" /></svg>`,
  styles: ':host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; flex: none; }',
})
export class CollectionIconComponent {
  readonly name = input.required<string>();
  readonly size = input(24);
  readonly path = computed(() => PATHS[this.name()] ?? PATHS['all']);
}

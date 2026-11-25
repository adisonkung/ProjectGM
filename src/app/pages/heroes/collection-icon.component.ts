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
/** Original angular line seals: shared 64-unit canvas and stroke weight. */
export const CLASS_GLYPHS: Record<string, { lines: string; facets: string }> = {
  fighter: {
    lines: 'M32 5 39 17 36 27 43 36 39 48 32 59 25 48 21 36 28 27 25 17Z M32 17v30 M32 27l-7 9 7 13 7-13Z M22 13l-8-4 4 15-8-3 8 15-5 6 12 11 M42 13l8-4-4 15 8-3-8 15 5 6-12 11 M20 42l5 6 M44 42l-5 6',
    facets: 'M32 3 35 9 32 13 29 9Z M7 34l4 3-1 6-4-3Z M57 34l-4 3 1 6 4-3Z',
  },
  tank: {
    lines: 'M32 5 50 12v20c0 11-9 19-18 26-9-7-18-15-18-26V12Z M32 12l12 5v15c0 8-6 14-12 19-6-5-12-11-12-19V17Z M32 13v38 M20 24h24 M25 24v13l7 7 7-7V24 M9 17 5 20v15l6 9 M55 17l4 3v15l-6 9 M22 55l10 7 10-7',
    facets: 'M32 2 35 6 32 10 29 6Z M8 8l3 4-3 4-3-4Z M56 8l3 4-3 4-3-4Z M29 29h6v6h-6Z',
  },
  assassin: {
    lines: 'M25 6 13 19l3 14 10 8-5-17 10-9 M39 6l12 13-3 14-10 8 5-17-10-9 M32 19l-7 12 7 16 7-16Z M32 24v14 M9 25 5 36l14 13 3-5 M55 25l4 11-14 13-3-5 M26 44l-4 9 10 8 10-8-4-9 M14 48l-1 8 10-1 M50 48l1 8-10-1',
    facets: 'M32 2 36 9 32 15 28 9Z M29 51l3-4 3 4-3 5Z M6 17l3 4-3 4-3-4Z M58 17l3 4-3 4-3-4Z',
  },
  archer: {
    lines: 'M32 5v49 M32 5l-7 11h14Z M23 14 12 9l6 12-9-1 11 13 8 3 M41 14l11-5-6 12 9-1-11 13-8 3 M23 21l6 7 M41 21l-6 7 M24 38l8 16 8-16 M18 36l6 17 8 8 8-8 6-17 M13 30l-7 4 12 8 M51 30l7 4-12 8',
    facets: 'M29 30l3-5 3 5-3 6Z M29 51l3-5 3 5-3 6Z M4 19l4 3-2 5-4-3Z M60 19l-4 3 2 5 4-3Z',
  },
  mage: {
    lines: 'M32 4 41 19 32 36 23 19Z M32 10v20 M23 19h18 M22 12l-8 5 3 13-11 6 14 5 3 14 9-10 9 10 3-14 14-5-11-6 3-13-8-5 M21 35l11 10 11-10 M15 48l7-7 M49 48l-7-7 M9 12l7 5 M55 12l-7 5 M32 45v15 M27 56l5 5 5-5',
    facets: 'M32 1 35 6 32 10 29 6Z M3 34l5-3 4 4-5 3Z M61 34l-5-3-4 4 5 3Z M29 39l3-4 3 4-3 4Z',
  },
  healer: {
    lines: 'M32 5c-9 9-11 18 0 29 11-11 9-20 0-29Z M32 13v39 M15 18c-3 15 2 22 17 24-1-15-7-22-17-24Z M49 18c3 15-2 22-17 24 1-15 7-22 17-24Z M7 32c2 14 11 21 25 20 14 1 23-6 25-20-12 0-20 5-25 16-5-11-13-16-25-16Z M23 58l9 4 9-4 M20 28l7 10 M44 28l-7 10 M15 39l10 7 M49 39l-10 7',
    facets: 'M32 1 35 6 32 10 29 6Z M4 17l3 4-3 4-3-4Z M60 17l3 4-3 4-3-4Z M29 55l3-4 3 4-3 4Z',
  },
};
@Component({
  selector: 'app-collection-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg [attr.width]="size()" [attr.height]="size()" [attr.viewBox]="glyph() ? '0 0 64 64' : '0 0 24 24'" fill="none" stroke="currentColor" [attr.stroke-width]="glyph() ? 2.6 : 1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">@if (glyph(); as seal) {<path [attr.d]="seal.lines" /><path [attr.d]="seal.facets" fill="currentColor" stroke="none" />} @else {<path [attr.d]="path()" [attr.fill]="name() === 'all' ? 'currentColor' : 'none'" />}</svg>`,
  styles: ':host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; flex: none; }',
})
export class CollectionIconComponent {
  readonly name = input.required<string>();
  readonly size = input(24);
  readonly glyph = computed(() => CLASS_GLYPHS[this.name()]);
  readonly path = computed(() => PATHS[this.name()] ?? PATHS['all']);
}

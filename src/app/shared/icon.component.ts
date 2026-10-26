import { UI_SYMBOL_ART } from '../core/data/ui-symbol-art';
import { UiSymbolComponent } from './ui-symbol.component';
import { GENERATED_ICONS } from '../core/data/generated-art';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** stroke paths (24×24 viewBox) for the game's UI glyphs — drawn in currentColor */
export const ICON_PATHS: Record<string, string> = {
  home: 'M3 21h18 M5 21V10l3-2 3 2v11 M13 21V6l3-3 3 3v15 M8 13v2 M16 9v2 M16 14v2',
  heroes: 'M12 3l2.2 3.2L18 5l-1 4 3 2.5-3.5 1L15 17H9l-1.5-4.5L4 11.5 7 9 6 5l3.8 1.2z M9 21h6',
  armory: 'M4 4l9 9 M20 4l-9 9 M7 17l-3 3 M17 17l3 3 M6 14l4 4 M18 14l-4 4',
  team: 'M5 3v18 M5 4h12l-3 4 3 4H5',
  tower: 'M7 21V9l-2-2V3h3v2h2V3h4v2h2V3h3v4l-2 2v12z M10 21v-4a2 2 0 0 1 4 0v4 M11 11h2',
  summon: 'M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8z M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z M5 3l.5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5z',
  lab: 'M9 3h6 M10 3v6L4.5 19a1.5 1.5 0 0 0 1.3 2h12.4a1.5 1.5 0 0 0 1.3-2L14 9V3 M7 15h10',
  sword: 'M14.5 3H21v6.5L10 20.5 3.5 14z M5 19l-2 2 M8 16l-3-3',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  flame: 'M12 22c4 0 7-3 7-7 0-5-5-7-5-12-3 2-4 5-4 7-1-1-2-2-2-4-2 2-3 5-3 9 0 4 3 7 7 7z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  potion: 'M9 3h6 M10 3v5l-4.5 7.5A4 4 0 0 0 9 21h6a4 4 0 0 0 3.5-5.5L14 8V3 M7 14h10',
  crystal: 'M12 2l6 7-6 13-6-13z M6 9h12 M12 2v20',
  book: 'M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z M4 21a2 2 0 0 1 2-2h13v2H6 M9 7h6',
  arrow: 'M5 12h14 M13 6l6 6-6 6',
  back: 'M19 12H5 M11 6l-6 6 6 6',
  lock: 'M6 11h12v10H6z M8 11V7a4 4 0 0 1 8 0v4',
  save: 'M5 3h11l3 3v15H5z M8 3v5h7V3 M8 21v-7h8v7',
  load: 'M12 3v12 M7 10l5 5 5-5 M4 21h16',
  edit: 'M4 20h4L19 9l-4-4L4 16z M13 7l4 4',
  skull: 'M12 3a8 8 0 0 0-5 14v3h10v-3a8 8 0 0 0-5-14z M9 11h.01 M15 11h.01 M10 20v-2 M14 20v-2',
  crown: 'M3 8l4 4 5-7 5 7 4-4-2 11H5z',
  coin: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z M12 7v10 M9 9.5c0-1 1-1.5 3-1.5s3 .7 3 1.7-1 1.3-3 1.8-3 .8-3 1.8 1 1.7 3 1.7 3-.5 3-1.5',
  gem: 'M6 3h12l4 6-10 12L2 9z M2 9h20 M9 3l3 18 3-18',
  bolt: 'M13 2L4 14h7l-1 8 9-12h-7z',
  scroll: 'M7 3h11a2 2 0 0 1 2 2v2h-4 M16 7v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2h10v2a2 2 0 0 0 2 2 M7 3a2 2 0 0 0-2 2v12 M9 8h4 M9 12h4',
  gear: 'M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1',
  play: 'M7 4l13 8-13 8z',
  restart: 'M4 12a8 8 0 1 0 2.4-5.7 M4 3v5h5',
  exit: 'M14 4h5a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-5 M10 8l-4 4 4 4 M6 12h10',
  fast: 'M3 5l8 7-8 7z M12 5l8 7-8 7z',
  palette: 'M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2 0-1.5-1.5-1.8-1.5-3 0-1 .8-1.8 2-1.8H17a4 4 0 0 0 4-4C21 6 17 3 12 3z M7.5 11h.01 M10 7h.01 M14.5 7h.01 M17 10.5h.01',
};

/** inline SVG glyph: `<app-icon name="tower" />` — size follows font-size (1em) unless `size` is set */
@Component({
  imports: [UiSymbolComponent],
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (art(); as src) { <img [src]="src" [style.width]="size() === null ? '1em' : size() + 'px'" [style.height]="size() === null ? '1em' : size() + 'px'" alt="" aria-hidden="true" decoding="async" /> } @else if (symbol()) { <app-ui-symbol [name]="name()" [size]="size()" /> } @else { <svg viewBox="0 0 24 24" [attr.width]="size() ?? '1em'" [attr.height]="size() ?? '1em'" fill="none" stroke="currentColor"
    [attr.stroke-width]="stroke()" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="d()" /></svg> }`,
  styles: ['img { object-fit: contain; transform: scale(1.3); pointer-events: none; } :host { display: inline-flex; line-height: 0; flex: none; }'],
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly symbol = computed(() => UI_SYMBOL_ART[this.name()]);
  readonly art = computed(() => GENERATED_ICONS[this.name()]);
  readonly size = input<number | null>(null);
  readonly stroke = input(1.7);
  readonly d = computed(() => ICON_PATHS[this.name()] ?? ICON_PATHS["star"]);
}

import { UI_SYMBOL_ART } from '../core/data/ui-symbol-art';
import { UiSymbolComponent } from './ui-symbol.component';
import { GENERATED_ICONS } from '../core/data/generated-art';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const GLYPHS: Record<string, string> = {
  home: 'M2 15 16 3 30 15 27 18 16 8 5 18ZM7 17 16 10 25 17V29H19V20H13V29H7Z',
  heroes: 'M16 2 5 8V21L11 27V17L8 14H14V31H18V14H24L21 17V27L27 21V8ZM15 3H17V12H15Z',
  armory: 'M3 2 8 4 21 19 18 22 4 8ZM29 2 24 4 11 19 14 22 28 8ZM15 19 20 14 22 16 17 21ZM10 14 17 21 15 23 8 16ZM23 22 29 28 27 30 21 24ZM9 22 3 28 5 30 11 24Z',
  team: 'M3 2 8 4 21 19 18 22 4 8ZM29 2 24 4 11 19 14 22 28 8ZM10 14 17 21 15 23 8 16ZM15 19 20 14 22 16 17 21ZM23 22 29 28 27 30 21 24ZM9 22 3 28 5 30 11 24Z',
  shield: 'M16 2 29 7V17C29 23 23 28 16 31 9 28 3 23 3 17V7ZM16 5 6 9V17C6 22 11 26 16 28 21 26 26 22 26 17V9Z',
  tower: 'M3 62 10 57 12 24 9 24V16H12L14 4 15 16H20L22 1 24 16H28L30 7 31 16H34V24H31L34 57 42 62 27 59 25 31 22 25 19 31 17 59ZM14 20V25H17V20ZM26 20V25H29V20ZM13 31 12 53 14 51 16 31ZM28 31 30 53 32 55 30 31Z',
  summon: 'M16 1 19 11 29 15 19 19 16 30 13 19 3 15 13 11ZM16 9 14 14 9 15 14 17 16 22 18 17 23 15 18 14ZM5 1 6 5 10 6 6 7 5 11 4 7 0 6 4 5ZM27 22 28 25 32 26 28 27 27 31 26 27 22 26 26 25Z',
  compass: 'M15 0H17V6H15ZM15 26H17V32H15ZM0 15H6V17H0ZM26 15H32V17H26ZM16 4A12 12 0 1 1 16 28 12 12 0 1 1 16 4ZM16 6A10 10 0 1 0 16 26 10 10 0 1 0 16 6ZM16 9 18 14 23 16 18 18 16 23 14 18 9 16 14 14Z',
  people: 'M12 6A4 4 0 1 1 12 14 4 4 0 1 1 12 6ZM23 8A3 3 0 1 1 23 14 3 3 0 1 1 23 8ZM4 9A3 3 0 1 1 4 15 3 3 0 1 1 4 9ZM8 16H16L20 28H4ZM21 16H26L30 27H22ZM2 17H5L2 27H0Z',
  sword: 'M26 1 30 2 29 7 13 23 9 19ZM6 15 17 26 14 29 3 18ZM7 23 10 26 5 31 1 27Z',
  bow: 'M5 3C23 4 28 10 29 28L26 29C25 14 18 7 4 6ZM5 4 28 27 27 28 4 5ZM8 26 27 7 23 6 29 1 31 3 26 9 25 5 6 24 7 29 2 30 3 25Z',
  healer: 'M11 2H21V11H30V21H21V30H11V21H2V11H11Z',
  gem: 'M10 2 24 6 29 16 15 31 3 23ZM11 6 7 22 14 26 25 15 21 9Z',
  coin: 'M16 1A15 15 0 1 1 16 31 15 15 0 1 1 16 1ZM16 4A12 12 0 1 0 16 28 12 12 0 1 0 16 4ZM17 6 10 17H15L13 26 23 13H17Z',
  gear: 'M13 1H19L20 5 24 7 28 6 31 12 28 15V19L31 22 28 28 24 27 20 29 19 32H13L12 28 8 26 4 27 1 21 4 18V14L1 11 4 5 8 6 12 4ZM16 10A6 6 0 1 0 16 22 6 6 0 1 0 16 10Z',
  arrow: 'M11 4 23 16 11 28 7 24 15 16 7 8Z',
  lock: 'M9 13V8A7 7 0 0 1 23 8V13H27V30H5V13ZM12 13H20V8A4 4 0 0 0 12 8ZM15 19V25H17V19Z',
  palette: 'M16 2A14 14 0 1 0 16 30C21 30 17 25 20 23H24C32 22 31 14 27 9 24 5 20 2 16 2ZM8 14A2 2 0 1 1 8 18 2 2 0 1 1 8 14ZM12 7A2 2 0 1 1 12 11 2 2 0 1 1 12 7ZM21 9A2 2 0 1 1 21 13 2 2 0 1 1 21 9Z',
  fullscreen: 'M2 2H12V5H5V12H2ZM20 2H30V12H27V5H20ZM2 20H5V27H12V30H2ZM27 20H30V30H20V27H27Z',
};

/** Solid ivory/gold silhouettes from the reference visual language; no emoji or platform fonts. */
@Component({
  imports: [UiSymbolComponent],
  selector: 'app-citadel-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (art(); as src) { <img [src]="src" [style.width]="size() + 'px'" [style.height]="size() + 'px'" alt="" aria-hidden="true" decoding="async" /> } @else if (symbol()) { <app-ui-symbol [name]="name()" [size]="size()" /> } @else { <svg [attr.viewBox]="name() === 'tower' ? '0 0 44 64' : '0 0 32 32'" [attr.width]="size()" [attr.height]="size()" aria-hidden="true" focusable="false"><path [attr.d]="path()" fill="currentColor" fill-rule="evenodd" />
    @if (name() === 'gem') { <path d="M11 6 21 9 17 23 7 22Z" fill="#31b9ff"/><path d="M11 6 17 10 7 22Z" fill="#a3f3ff"/><path d="M17 10 21 9 25 15 17 23Z" fill="#147ae5"/> }
    @if (name() === 'coin') { <circle cx="16" cy="16" r="11" fill="#df9416"/><path d="M17 6 10 17H15L13 26 23 13H17Z" fill="#fff0ae"/> }
  </svg> }`,
  styles: ['img { object-fit: contain; transform: scale(1.3); pointer-events: none; } :host { display: inline-flex; flex: none; line-height: 0; } svg { overflow: visible; filter: drop-shadow(0 1px 1px #0009); }'],
})
export class CitadelIconComponent {
  readonly name = input.required<string>();
  readonly symbol = computed(() => UI_SYMBOL_ART[this.name()]);
  readonly art = computed(() => GENERATED_ICONS[this.name()]);
  readonly size = input(28);
  readonly path = computed(() => GLYPHS[this.name()] ?? GLYPHS['summon']);
}

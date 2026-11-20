import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Thin-line glyphs for the K7 home screen (24-unit grid, stroke = currentColor). */
const PATHS: Record<string, string> = {
  hero: 'M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM4 21c1-5 15-5 16 0',
  squad: 'M5 19L19 5M14 5h5v5M5 5l5 5M14 14l5 5',
  gear: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
  summon: 'M12 2l2.4 7.3H22l-6 4.4 2.3 7.3L12 16.6 5.7 21l2.3-7.3-6-4.4h7.6z',
  isle: 'M3 13c3-1 6-1.4 9-1.4s6 .4 9 1.4M6 13l2.5 6h7L18 13M12 11.6V4l4 3.5',
  arena: 'M5 19L19 5M14 5h5v5M5 5l5 5M14 14l5 5',
  daily: 'M4 20V9l8-5 8 5v11M9 20v-6h6v6',
  event: 'M12 3l1.8 5.4H19l-4.3 3.2 1.6 5.4L12 13.8 7.7 17l1.6-5.4L5 8.4h5.2zM5 21h14',
  mission: 'M6 4h12v16l-6-4-6 4zM9.5 9l2 2 3.5-3.5',
  achieve: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 13v4M8 21h8M9.5 17h5',
  login: 'M4 5h16v15H4zM4 9h16M8 3v4M16 3v4M9 14l2 2 4-4',
  mail: 'M3 5h18v14H3zM3 7l9 6 9-6',
  news: 'M3 10v4h4l6 4V6L7 10zM16 9a4 4 0 0 1 0 6M18.5 7a7 7 0 0 1 0 10',
  forge: 'M4 15h11l3-4H8zM8 15l-1 5h10l-1-5M15 11V5l-4 2',
  account: 'M3 3h18v18H3zM12 5.5a3.5 3.5 0 1 1 0 7a3.5 3.5 0 1 1 0-7zM5.5 19c1.2-3.5 11.8-3.5 13 0',
  settings: 'M12 9a3 3 0 1 1 0 6a3 3 0 1 1 0-6zM12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1',
  grid: 'M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z',
  boss: 'M12 3a7 7 0 0 0-7 7c0 2.5 1.3 4.2 3 5.2V19h8v-3.8c1.7-1 3-2.7 3-5.2a7 7 0 0 0-7-7z',
  close: 'M6 6l12 12M18 6L6 18',
  banner: 'M3 5h18v14H3zM3 16l5-5 4 4 3-3 6 6M15.5 7.5a1.5 1.5 0 1 1 0 3a1.5 1.5 0 1 1 0-3z',
};
const FILLS: Record<string, string> = {
  boss: 'M9.5 9.3a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4zM14.5 9.3a1.2 1.2 0 1 1 0 2.4a1.2 1.2 0 1 1 0-2.4z',
};

@Component({
  selector: 'app-line-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 24 24" fill="none" stroke="currentColor" [attr.stroke-width]="weight()"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path [attr.d]="d()" />@if (fill(); as f) {<path [attr.d]="f" fill="currentColor" stroke="none" />}</svg>`,
  styles: [':host { display: inline-grid; place-items: center; line-height: 0; flex: none; }'],
})
export class LineIconComponent {
  readonly name = input.required<string>();
  readonly size = input(22);
  readonly weight = input(1.5);
  readonly d = computed(() => PATHS[this.name()] ?? '');
  readonly fill = computed(() => FILLS[this.name()] ?? null);
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { ITEMS } from '../../core/data/economy';

/** Temporary/mock art for real item ids. Batch art backlog: docs/art/material-icons/README.md. */
@Component({
  selector: 'app-dungeon-reward-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<svg viewBox="0 0 64 64" fill="none">
    @switch (kind()) {
      @case ('EXP_POTION') {
        <path d="M26 8H40L38 23C54 33 52 51 39 57L22 53C11 42 18 31 27 22Z" fill="#142832" stroke="#edd79e" stroke-width="1.8"/>
        <path d="M24 31C30 34 39 32 44 35C48 44 44 51 37 53L25 50C19 44 20 37 24 31Z" [attr.fill]="color()"/>
        <path d="M28 7H40V14H27Z M25 20 39 23 38 28 24 25Z" fill="#b98b40" stroke="#fbe2a1" stroke-width="1.4"/>
        <path d="M26 35C22 40 22 44 26 47 M30 31 28 20" stroke="#f4fff0" stroke-opacity=".75" stroke-width="2" stroke-linecap="round"/>
        <circle cx="38" cy="40" r="2" fill="#eafeea" opacity=".7"/>
      }
      @case ('SKILL_TOME') {
        <path d="M14 13 45 7 53 46 22 56 12 47Z" fill="#624222" stroke="#e8ca83" stroke-width="1.7"/>
        <path d="M18 13 44 10 50 43 22 51Z" [attr.fill]="color()" stroke="#ebd091"/>
        <path d="M21 49 48 42 50 48 23 55Z" fill="#e4d1a5"/>
        <path d="M22 18 40 15 45 38 25 44Z M33 22 39 28 35 36 29 29Z" stroke="#f1ca76" stroke-width="1.3"/>
        <path d="M19 14 25 42 M26 53 47 47" stroke="#aa7835" stroke-width="1.6"/>
      }
      @case ('HERO_MEMORY') {
        <path d="M32 6 38 23 56 30 38 37 32 56 26 37 8 30 26 23Z" fill="#c7a559" stroke="#ffecb4" stroke-width="1.6"/>
        <path d="M32 15 36 27 47 30 35 34 32 46 29 34 17 30 29 27Z" fill="#eaf5ff"/>
      }
      @default {
        <path d="M31 6 49 20 45 43 27 58 13 39 17 17Z" [attr.fill]="color()" stroke="#f4d9a4" stroke-width="1.6"/>
        <path d="M31 6 27 29 17 17 M27 29 49 20 M27 29 45 43 M27 29 27 58 M13 39 27 29" stroke="#e8f3ff" stroke-opacity=".75" stroke-width="1.2"/>
        <path d="M31 6 27 29 49 20Z" fill="#fff7d0" opacity=".4"/><path d="M13 39 27 29 27 58Z" fill="#162d5c" opacity=".45"/>
      }
    }
  </svg>`,
  styles: [`:host{display:block;width:42px;height:42px;filter:drop-shadow(0 0 5px #f2bd4b33);}svg{display:block;width:100%;height:100%;}`],
})
export class DungeonRewardIconComponent {
  readonly itemId = input.required<string>();
  readonly kind = computed(() => ITEMS[this.itemId()]?.kind);
  readonly color = computed(() => {
    const id = this.itemId();
    if (id === 'exp_potion_s') return '#56b88b';
    if (id === 'exp_potion_m') return '#4d9fd9';
    if (id === 'exp_potion_l') return '#a784df';
    if (id.startsWith('skill_tome')) return id.endsWith('3') ? '#8b6331' : id.endsWith('2') ? '#284d7a' : '#466947';
    return id.endsWith('3') ? '#8fbddf' : id.endsWith('2') ? '#65a6d9' : '#d9a448';
  });
}

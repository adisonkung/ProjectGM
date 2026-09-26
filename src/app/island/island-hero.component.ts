import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HeroClass } from '../core/models/hero';

/** what the scene needs to draw one hero (runtime only — built from the sim every frame) */
export interface IslandHeroView {
  uid: number;
  templateId: string;
  name: string;
  cls: HeroClass;
  x: number;
  y: number;
  walking: boolean;
  facingLeft: boolean;
  isMain: boolean;
  /** 0–1 walk / idle cycle phase */
  phase: number;
  /** at a building (small interaction sparkle) */
  interacting: boolean;
}

/** placeholder hero colours per class (swap for sprites later — the view model stays the same) */
export const CLASS_TINT: Record<HeroClass, string> = {
  tank: '#6f8fd8', fighter: '#e0703a', assassin: '#8a5ad8', archer: '#56b06a', mage: '#4fb0e0', healer: '#f0d070',
};

/** PlaceholderHeroRenderer: capsule body + head, name tag; the main hero gets a gold ring and a crown */
@Component({
  selector: 'g[appIslandHero]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let h = hero();
    <svg:g [attr.transform]="'translate(' + h.x + ' ' + h.y + ')'">
      @if (h.isMain) {
        <svg:ellipse cx="0" cy="0" rx="20" ry="7" fill="#f6dfa033" stroke="#f6dfa0" stroke-width="2" class="ring" />
      } @else {
        <svg:ellipse cx="0" cy="0" rx="13" ry="5" fill="#0006" />
      }
      <svg:g [attr.transform]="'translate(0 ' + bob() + ') scale(' + (h.facingLeft ? -1 : 1) * size() + ' ' + size() + ')'">
        <svg:rect x="-9" y="-34" width="18" height="30" rx="9" [attr.fill]="tint()" stroke="#0b0914" stroke-width="2" />
        <svg:circle cx="0" cy="-40" r="8" fill="#f1dcc0" stroke="#0b0914" stroke-width="2" />
        <svg:circle cx="3" cy="-41" r="1.6" fill="#0b0914" />
        <svg:rect x="-9" y="-20" width="18" height="4" [attr.fill]="'#0005'" />
      </svg:g>
      @if (h.isMain) {
        <svg:path [attr.transform]="'translate(0 ' + (bob() - 58 * size()) + ')'" d="M-8 0 L-8 -8 L-4 -4 L0 -10 L4 -4 L8 -8 L8 0 Z" fill="#f6dfa0" stroke="#8a6a2e" stroke-width="1.5" />
      }
      @if (h.interacting) { <svg:text x="12" [attr.y]="-46 * size()" class="spark">✦</svg:text> }
      <svg:text x="0" y="16" text-anchor="middle" class="name" [class.main]="h.isMain">{{ h.name }}</svg:text>
    </svg:g>
  `,
})
export class IslandHeroComponent {
  readonly hero = input.required<IslandHeroView>();
  readonly tint = computed(() => CLASS_TINT[this.hero().cls] ?? '#aaa');
  readonly size = computed(() => (this.hero().isMain ? 1.18 : 1));
  /** walk = hop, idle = slow breathe */
  readonly bob = computed(() => {
    const h = this.hero();
    return h.walking ? -Math.abs(Math.sin(h.phase * Math.PI * 2)) * 4 : Math.sin(h.phase * Math.PI * 2) * 0.8;
  });
}

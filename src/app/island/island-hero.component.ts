import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { HERO_BY_ID } from '../core/data/heroes';
import { HeroClass } from '../core/models/hero';
import { UnitSpriteComponent } from '../battle/unit-sprite/unit-sprite.component';

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

/** placeholder tint per class (heroes without a sprite sheet) */
export const CLASS_TINT: Record<HeroClass, string> = {
  tank: '#6f8fd8', fighter: '#e0703a', assassin: '#8a5ad8', archer: '#56b06a', mage: '#4fb0e0', healer: '#f0d070',
};

/**
 * Hero on the island (world units): the battle sprite sheet (idle / walk) when the hero has one, else the class token.
 * Feet sit on (x, y); the main hero gets a gold ring + crown.
 */
@Component({
  selector: 'app-island-hero',
  imports: [UnitSpriteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let h = hero();
    <span class="ring" [class.main]="h.isMain"></span>
    <span class="body" [class.bob]="!sprite() && h.walking">
      <app-unit-sprite [cls]="h.cls" [sprite]="sprite()" [star]="star()" [anim]="h.walking ? 'walk' : 'idle'" [flip]="h.facingLeft" />
    </span>
    @if (h.isMain) { <span class="crown" aria-hidden="true">♛</span> }
    @if (h.interacting) { <span class="spark" aria-hidden="true">✦</span> }
    <span class="name" [class.main]="h.isMain">{{ h.name }}</span>
  `,
  styles: `
    :host { position: absolute; width: 0; height: 0; pointer-events: auto; cursor: pointer; }
    .ring { position: absolute; left: -26px; top: -9px; width: 52px; height: 18px; border-radius: 50%; background: #0007; }
    .ring.main { left: -34px; top: -11px; width: 68px; height: 22px; background: #f6dfa033; box-shadow: 0 0 0 3px #f6dfa0, 0 0 18px #f6dfa0aa; animation: ring 2.4s ease-in-out infinite; }
    .body { position: absolute; left: -50px; top: -56px; width: 100px; height: 76px; pointer-events: none; }
    .body.bob { animation: bob 0.35s ease-in-out infinite alternate; }
    .crown { position: absolute; left: -12px; top: -104px; font-size: 26px; color: #f6dfa0; text-shadow: 0 0 8px #f0b54a, 0 2px 0 #3a2a10; animation: float 2.2s ease-in-out infinite; }
    .spark { position: absolute; left: 16px; top: -84px; font-size: 20px; color: #f6dfa0; animation: float 1.2s ease-in-out infinite; }
    .name { position: absolute; left: -100px; width: 200px; top: 12px; text-align: center; font: 600 19px var(--body); color: #efe7d6;
      text-shadow: 0 2px 0 #0b0914, 0 0 6px #0b0914, 2px 0 0 #0b0914, -2px 0 0 #0b0914; white-space: nowrap; pointer-events: none; }
    .name.main { font: 700 21px var(--title); color: #f6dfa0; }
    @keyframes ring { 50% { opacity: .55; } }
    @keyframes float { 50% { transform: translateY(-6px); } }
    @keyframes bob { to { transform: translateY(-6px); } }
  `,
})
export class IslandHeroComponent {
  readonly hero = input.required<IslandHeroView>();
  readonly sprite = computed(() => HERO_BY_ID[this.hero().templateId]?.sprite);
  readonly star = computed(() => HERO_BY_ID[this.hero().templateId]?.star ?? 1);
}

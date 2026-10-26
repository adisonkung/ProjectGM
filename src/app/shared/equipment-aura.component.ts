import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, input, signal } from '@angular/core';
import { Rarity } from '../core/models/equipment';

export type EquipmentArtFamily = 'sword' | 'armor' | 'necklace' | 'ring';

/** Decorative GPU-transformed orbit layers; no game loop or saved state. */
@Component({
  selector: 'app-equipment-aura',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class.moving]': 'moving()', '[attr.data-family]': 'family()', '[attr.data-tier]': 'rank()', '[style.--aura-color]': 'color()', '[style.--aura-strength]': 'strength()' },
  template: `
    <div class="bloom"></div>
    @if (rank() > 1) {
      <div class="orbit-plane plane-one"><svg viewBox="0 0 200 200" fill="none"><g class="orbit clockwise"><circle cx="100" cy="100" r="78"/><circle class="inner" cx="100" cy="100" r="71"/><path class="comet" d="M100 22A78 78 0 0 1 178 100"/><circle class="head" cx="178" cy="100" r="2.2"/></g></svg></div>
      <div class="orbit-plane plane-two"><svg viewBox="0 0 200 200" fill="none"><g class="orbit counter"><circle cx="100" cy="100" r="74" stroke-dasharray="35 8 3 8"/><path class="comet" d="M26 100A74 74 0 0 0 100 174"/></g></svg></div>
    }
    @if (family() === 'sword' && rank() > 1) { <svg class="energy-helix" viewBox="0 0 200 200" fill="none"><path d="M42 179C-8 143 194 139 154 103S24 77 65 33"/><path class="comet" d="M42 179C-8 143 194 139 154 103S24 77 65 33"/></svg> }
    @if (family() === 'armor') {
      <svg class="ward" viewBox="0 0 200 200" fill="none"><path d="M100 15 173 57V142L100 184 27 142V57Z M100 24 165 61V137L100 175 35 137V61Z"/><path class="ward-runes" d="M100 4V28 M17 52 40 65 M17 148 40 135 M100 196V172 M183 148 160 135 M183 52 160 65"/></svg>
    }
    @if (family() === 'necklace') {
      <svg class="ribbons" viewBox="0 0 200 200" fill="none"><path d="M52 180C8 126 173 121 128 75S37 34 81 8 M145 187C199 116 35 127 73 73S163 34 119 7"/><path class="comet" d="M52 180C8 126 173 121 128 75S37 34 81 8"/></svg>
    }
    @if (family() === 'ring' || rank() > 3) {
      <svg class="rune-wheel" viewBox="0 0 200 200" fill="none"><g class="orbit counter"><circle cx="100" cy="100" r="88" stroke-dasharray="1 8 12 8"/><path d="M100 7 104 18 100 29 96 18Z M193 100 182 104 171 100 182 96Z M100 193 96 182 100 171 104 182Z M7 100 18 96 29 100 18 104Z"/></g></svg>
    }
    @if (rank() === 5) { <div class="crown-rays"></div> }
    @if (animated()) { <div class="sparks">@for (p of particles(); track $index) { <i [class.star]="$index % 4 === 0" [style.left.%]="p.x" [style.top.%]="p.y" [style.--delay]="p.delay + 's'" [style.--duration]="p.duration + 's'" [style.--drift]="p.drift + 'px'"></i> }</div> }
  `,
  styleUrl: './equipment-aura.component.scss',
})
export class EquipmentAuraComponent {
  readonly rarity = input<Rarity>('RARE');
  readonly family = input<EquipmentArtFamily>('sword');
  readonly animated = input(false);
  private readonly document = inject(DOCUMENT);
  readonly hidden = signal(this.document.hidden);
  readonly moving = computed(() => this.animated() && !this.hidden());
  readonly rank = computed(() => ({ COMMON: 1, UNCOMMON: 2, RARE: 3, ELITE: 4, EPIC: 5 })[this.rarity()]);
  readonly color = computed(() => ({ COMMON: '#c2d0df', UNCOMMON: '#63edac', RARE: '#70cfff', ELITE: '#d393ff', EPIC: '#ffc860' })[this.rarity()]);
  readonly strength = computed(() => [.1, .23, .43, .6, .82][this.rank() - 1]);
  readonly particles = computed(() => Array.from({ length: [3, 8, 14, 20, 28][this.rank() - 1] }, (_, i) => ({ x: 12 + (i * 37 + 11) % 77, y: 17 + (i * 23 + 3) % 73, delay: -i * .47, duration: 2.7 + i % 5 * .43, drift: (i % 2 ? 1 : -1) * (8 + i % 13) })));
  @HostListener('document:visibilitychange') visibilityChanged(): void { this.hidden.set(this.document.hidden); }
}

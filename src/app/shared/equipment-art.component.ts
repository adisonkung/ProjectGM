import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EQUIPMENT_DEFS } from '../core/data/equipment';
import { Rarity } from '../core/models/equipment';

/** Shared artwork: the identical sword master is used in the forge, bag and equipped slots. */
@Component({
  selector: 'app-equipment-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="art" [class.showcase]="context() === 'forge'" [attr.data-rarity]="rarity()">
      @if (foreground(); as src) {
        <img class="aura" [src]="aura()" [style.opacity]="intensity()" alt="" aria-hidden="true" decoding="async" />
        <img class="foreground" [src]="src" [alt]="label()" decoding="async" />
      } @else { <span role="img" [attr.aria-label]="label()">?</span> }
      @if (level() !== null) { <b class="level">+{{ level() }}</b> }
    </span>
  `,
  styles: `
    :host { display: block; width: 100%; aspect-ratio: 1; }
    .art { --ink: #7b899d; position: relative; display: block; width: 100%; height: 100%; border: 1px solid var(--ink); border-radius: 5px; background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--ink) 20%, #10171d), #080e14 75%); box-shadow: inset 0 0 0 2px #ffffff05; isolation: isolate; }
    [data-rarity='UNCOMMON'] { --ink: #70b98b; } [data-rarity='RARE'] { --ink: #72b6ed; } [data-rarity='ELITE'] { --ink: #ba8beb; } [data-rarity='EPIC'] { --ink: #e3bc73; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
    .aura { z-index: 0; } .foreground { z-index: 1; }
    .showcase { background: none; border: 0; box-shadow: none; }
    .level { position: absolute; z-index: 2; top: 3px; right: 5px; color: #ffe4a8; font: 600 11px var(--title); text-shadow: 0 1px 3px #000; }
  `,
})
export class EquipmentArtComponent {
  readonly definitionId = input.required<string>();
  readonly rarity = input<Rarity>('RARE');
  readonly level = input<number | null>(null);
  readonly context = input<'inventory' | 'forge'>('inventory');
  readonly definition = computed(() => EQUIPMENT_DEFS[this.definitionId()]);
  readonly label = computed(() => this.definition()?.name ?? 'อุปกรณ์');
  readonly tier = computed(() => this.rarity().toLowerCase());
  readonly foreground = computed(() => {
    const def = this.definition();
    if (!def) return null;
    return def.slot === 'WEAPON'
      ? `/ui/generated/equipment/swords/foreground/${this.tier()}.webp`
      : `/ui/generated/equipment/bases/${def.slot === 'ARMOR' ? 'guard_armor' : 'trinket'}.webp`;
  });
  readonly aura = computed(() => `/ui/generated/equipment/swords/aura/${this.tier()}.webp`);
  readonly intensity = computed(() => ({ COMMON: .22, UNCOMMON: .5, RARE: .75, ELITE: .85, EPIC: 1 })[this.rarity()]);
}

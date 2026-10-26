import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EQUIPMENT_DEFS } from '../core/data/equipment';
import { EquipmentAuraComponent, EquipmentArtFamily } from './equipment-aura.component';
import { Rarity } from '../core/models/equipment';

/** Shared artwork: the identical sword master is used in the forge, bag and equipped slots. */
@Component({
  selector: 'app-equipment-art',
  imports: [EquipmentAuraComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="art" [class.showcase]="context() !== 'inventory'" [class.animated]="context() !== 'inventory'" [attr.data-rarity]="rarity()" [attr.data-family]="family()">
      @if (foreground(); as src) {
        <app-equipment-aura #aura [rarity]="rarity()" [family]="family()" [animated]="context() !== 'inventory'" />
        <img [style.animation-play-state]="aura.moving() ? 'running' : 'paused'" class="foreground" [src]="src" [alt]="label()" decoding="async" />
        @if (context() !== 'inventory') { <span [style.animation-play-state]="aura.moving() ? 'running' : 'paused'" class="surface-glint" [style.mask-image]="'url(' + src + ')'" aria-hidden="true"></span>@if (rarity() !== 'COMMON') { <svg class="front-orbit" viewBox="0 0 200 200" fill="none" aria-hidden="true"><path d="M29 128C68 151 142 142 174 89"/><path [style.animation-play-state]="aura.moving() ? 'running' : 'paused'" class="bright" d="M29 128C68 151 142 142 174 89"/></svg> } }
      } @else { <span role="img" [attr.aria-label]="label()">?</span> }
      @if (level() !== null) { <b class="level">+{{ level() }}</b> }
    </span>
  `,
  styles: `
    :host { display: block; width: 100%; aspect-ratio: 1; }
    .art { --ink: #7b899d; position: relative; display: block; width: 100%; height: 100%; border: 1px solid var(--ink); border-radius: 5px; background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--ink) 20%, #10171d), #080e14 75%); box-shadow: inset 0 0 0 2px #ffffff05; isolation: isolate; }
    [data-rarity='UNCOMMON'] { --ink: #70b98b; } [data-rarity='RARE'] { --ink: #72b6ed; } [data-rarity='ELITE'] { --ink: #ba8beb; } [data-rarity='EPIC'] { --ink: #e3bc73; }
    img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; pointer-events: none; }
    app-equipment-aura { z-index: 0; } .foreground { z-index: 1; }
    .animated .foreground { animation: equipment-hover var(--hover-speed,5.5s) ease-in-out infinite; transform-origin: 50% 62%; }
    [data-family='armor'] { --hover-speed:7s; }
    .showcase .foreground { filter:drop-shadow(0 6px 5px #10233355); }
    .surface-glint { position:absolute;inset:0;z-index:3;pointer-events:none;mask-size:contain;mask-repeat:no-repeat;mask-position:center;background:linear-gradient(130deg,transparent 44%,#fff8da99 48%,transparent 52%);background-size:350% 350%;opacity:.42;transform-origin:50% 62%;animation:equipment-hover var(--hover-speed,5.5s) ease-in-out infinite,metal-glint 7.5s ease-in-out infinite; }
    .front-orbit { position:absolute;inset:0;width:100%;height:100%;z-index:2;pointer-events:none;color:var(--ink);stroke:currentColor;stroke-width:1.1;opacity:.65;filter:drop-shadow(0 0 3px currentColor); }
    .front-orbit .bright { stroke:#fff5d5;stroke-width:2.1;stroke-dasharray:18 170;animation:front-flow 5s linear infinite; }
    @keyframes metal-glint { 0%,35% { background-position:100% 0; } 65%,100% { background-position:0 100%; } }
    @keyframes front-flow { to { stroke-dashoffset:-188; } }
    @keyframes equipment-hover { 50% { transform: translateY(-7px) rotate(.8deg); } }
    @media(prefers-reduced-motion:reduce) { .animated .foreground,.surface-glint,.front-orbit .bright { animation: none; } .surface-glint { display:none; } }
    .showcase { background: none; border: 0; box-shadow: none; }
    .level { position: absolute; z-index: 2; top: 3px; right: 5px; color: #ffe4a8; font: 600 11px var(--title); text-shadow: 0 1px 3px #000; }
  `,
})
export class EquipmentArtComponent {
  readonly definitionId = input.required<string>();
  readonly rarity = input<Rarity>('RARE');
  readonly level = input<number | null>(null);
  readonly context = input<'inventory' | 'forge' | 'inspect'>('inventory');
  readonly instanceId = input<number | null>(null);
  readonly appearance = input<EquipmentArtFamily | null>(null);
  readonly definition = computed(() => EQUIPMENT_DEFS[this.definitionId()]);
  readonly label = computed(() => this.definition()?.name ?? 'อุปกรณ์');
  readonly tier = computed(() => this.rarity().toLowerCase());
  readonly family = computed<EquipmentArtFamily>(() => {
    if (this.appearance()) return this.appearance()!;
    const slot = this.definition()?.slot;
    if (slot === 'WEAPON') return 'sword';
    if (slot === 'ARMOR') return 'armor';
    const seed = this.instanceId();
    if (seed === null) return 'necklace';
    // Stable cosmetic variant only; the same owned accessory looks identical in every view.
    const mixed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    return ((mixed ^ (mixed >>> 16)) & 1) ? 'ring' : 'necklace';
  });
  readonly foreground = computed(() => {
    if (!this.definition()) return null;
    if (this.family() === 'sword' && this.context() === 'inventory') return `/ui/generated/equipment/swords/foreground/${this.tier()}.webp`;
    const suffix = this.context() === 'inventory' ? '' : '-large';
    return `/ui/equipment/tiered/${this.family()}/${this.tier()}${suffix}.webp`;
  });
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { EQUIPMENT_DEFS } from '../core/data/equipment';
import { Rarity } from '../core/models/equipment';

let nextArtId = 0;
/** Temporary vector illustrations for the six existing bases; no item or rarity data is fabricated. */
@Component({
  selector: 'app-equipment-art',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="art" [attr.data-rarity]="rarity()">
      <svg viewBox="0 0 100 100" role="img" [attr.aria-label]="label()">
        <defs>
          <linearGradient [attr.id]="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f4f4eb"/><stop offset=".32" stop-color="#a4c7df"/><stop offset=".5" stop-color="#3b526c"/><stop offset=".67" stop-color="#e2edf3"/><stop offset="1" stop-color="#536981"/></linearGradient>
          <linearGradient [attr.id]="gold" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fff0bc"/><stop offset=".45" stop-color="#b9924a"/><stop offset=".7" stop-color="#ebd293"/><stop offset="1" stop-color="#69502d"/></linearGradient>
        </defs>
        <g [attr.fill]="'url(#' + metal + ')'" stroke="#dbe9ef" stroke-width="1" stroke-linejoin="round">
          @switch (definitionId()) {
            @case ('heavy_blade') {
              <path d="M22 75L64 15L82 10L79 31L34 80Z"/><path d="M29 73L72 20L35 79Z" fill="#7594b5"/><path d="M21 65L42 82L38 88L16 71Z" [attr.fill]="'url(#' + gold + ')'"/><path d="M24 78L15 90L10 86L19 74Z" fill="#453441"/><path d="M12 85L18 91L13 96L7 90Z" [attr.fill]="'url(#' + gold + ')'"/>
            }
            @case ('twin_daggers') {
              <g><path d="M20 16L39 26L67 64L59 71L29 37Z"/><path d="M24 22L62 65L56 61L33 32Z" fill="#739dc0"/><path d="M53 68L65 58L70 62L58 74Z" [attr.fill]="'url(#' + gold + ')'"/><path d="M63 70L79 88L83 84L68 66Z" fill="#415c73"/></g>
              <g><path d="M80 16L61 26L33 64L41 71L71 37Z"/><path d="M76 22L38 65L44 61L67 32Z" fill="#739dc0"/><path d="M47 68L35 58L30 62L42 74Z" [attr.fill]="'url(#' + gold + ')'"/><path d="M37 70L21 88L17 84L32 66Z" fill="#415c73"/></g><path d="M50 44L57 51L50 58L43 51Z" fill="#9ce0ff"/>
            }
            @case ('longbow') {
              <path d="M22 15Q98 19 80 80L73 87Q76 34 17 23Z" [attr.fill]="'url(#' + gold + ')'"/><path d="M22 18L75 83" fill="none" stroke="#c5def0"/><path d="M20 81L78 23M68 24L80 20L77 32M17 76L25 84" fill="none" stroke-width="3"/>
            }
            @case ('focus_staff') {
              <path d="M40 34L48 37L34 91L29 94L27 88Z" [attr.fill]="'url(#' + gold + ')'"/><path d="M36 38Q16 20 38 10L45 17L57 9Q73 30 48 40L43 31Z"/><circle cx="45" cy="24" r="10" fill="#ab98ff" stroke="#e4dcff"/><path d="M45 13L49 23L45 34L41 24Z" fill="#e8dcff"/>
            }
            @case ('guard_armor') {
              <path d="M33 14L41 22H59L67 14L85 24L92 44L76 50L73 84Q50 97 27 84L24 50L8 44L15 24Z"/>
              <path d="M34 15Q50 38 66 15L61 40H39Z" fill="#192339" stroke="#d4b77b" stroke-width="2"/><path d="M24 49L33 28L43 41L50 83L29 79Z M76 49L67 28L57 41L50 83L71 79Z" fill="#526b8b"/><path d="M50 43L61 57L50 76L39 57Z" [attr.fill]="'url(#' + gold + ')'"/><path d="M15 27L31 20L22 42L10 40Z M85 27L69 20L78 42L90 40Z" [attr.fill]="'url(#' + gold + ')'"/><path d="M29 80Q50 92 71 80M50 44V77" fill="none" stroke="#f2d28c" stroke-width="2"/>
            }
            @default {
              <path d="M38 18Q13 34 26 56L50 81L74 56Q87 34 62 18" fill="none" [attr.stroke]="'url(#' + gold + ')'" stroke-width="7"/><path d="M50 39L70 59L50 89L30 59Z" fill="#657cd1" stroke="#ead190" stroke-width="3"/><path d="M50 44L58 59L50 82L42 59Z" fill="#bddaff"/><circle cx="50" cy="29" r="8" [attr.fill]="'url(#' + gold + ')'"/>
            }
          }
        </g>
      </svg>
      @if (level() !== null) { <b class="level">+{{ level() }}</b> }
    </span>
  `,
  styles: `
    :host { display: block; width: 100%; aspect-ratio: 1; }
    .art { --ink: #7b899d; position: relative; display: grid; place-items: center; width: 100%; height: 100%; border: 1px solid var(--ink); border-radius: 7px; background: radial-gradient(ellipse at 50% 60%, color-mix(in srgb, var(--ink) 30%, #101729), #080e19 75%); box-shadow: inset 0 0 0 3px #ffffff05; }
    [data-rarity='UNCOMMON'] { --ink: #70b98b; } [data-rarity='RARE'] { --ink: #72b6ed; } [data-rarity='ELITE'] { --ink: #ba8beb; } [data-rarity='EPIC'] { --ink: #e3bc73; }
    :host-context(.preview-gear) .art { background: none; border: 0; box-shadow: none; }
    svg { width: 85%; height: 85%; overflow: visible; filter: drop-shadow(0 4px 5px #0009); }
    .level { position: absolute; top: 3px; right: 5px; color: #ffe4a8; font: 600 11px var(--title); text-shadow: 0 1px 3px #000; }
  `,
})
export class EquipmentArtComponent {
  readonly definitionId = input.required<string>();
  readonly rarity = input<Rarity>('RARE');
  readonly level = input<number | null>(null);
  readonly label = computed(() => EQUIPMENT_DEFS[this.definitionId()]?.name ?? 'อุปกรณ์');
  readonly metal = `gear-metal-${++nextArtId}`;
  readonly gold = `gear-gold-${nextArtId}`;
}

import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Rarity } from '../core/models/equipment';
import { AFFIX_ART, equipmentAffixLabel } from '../core/data/affix-art';

/** Decorative badge beside the actual equipment affix description. */
@Component({
  selector: 'app-affix-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[attr.title]': 'label()', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `@if (art(); as a) { <span [style.background-image]="'url(' + a.sheet + ')'" [style.background-position]="position()"></span> } @else { <span class="fallback">◇</span> }`,
  styles: `:host{display:inline-block;vertical-align:middle;flex:none;overflow:hidden;box-sizing:border-box;border:1px solid #967b49;border-radius:4px;background:radial-gradient(ellipse,#26323b,#080e14);box-shadow:inset 0 0 0 1px #0008}span{display:block;width:100%;height:100%;background-size:300% 300%;background-repeat:no-repeat}.fallback{display:grid;place-items:center;color:#d8c391;font-size:12px}`,
})
export class AffixIconComponent {
  readonly affixId = input.required<string>();
  readonly size = input(28);
  readonly rarity = input<Rarity>('RARE');
  readonly art = computed(() => AFFIX_ART[this.affixId()]);
  readonly label = computed(() => equipmentAffixLabel(this.affixId(), this.rarity()) || this.affixId());
  readonly position = computed(() => { const a = this.art(); return a ? `${a.col * 50}% ${a.row * 50}%` : '50% 50%'; });
}

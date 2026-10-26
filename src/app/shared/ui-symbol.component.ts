import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { UI_SYMBOL_ART } from '../core/data/ui-symbol-art';

/** Transparent decorative icon; parent button/link supplies its accessible name. */
@Component({
  selector: 'app-ui-symbol',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[style.width]': 'dimension()', '[style.height]': 'dimension()' },
  template: `@if (art(); as a) { <span [style.background-image]="'url(' + a.sheet + ')'" [style.background-position]="position()"></span> }`,
  styles: `:host{display:inline-block;flex:none;line-height:0;vertical-align:middle;pointer-events:none}span{display:block;width:100%;height:100%;background-size:300% 300%;background-repeat:no-repeat}`,
})
export class UiSymbolComponent {
  readonly name = input.required<string>();
  readonly size = input<number | null>(null);
  readonly art = computed(() => UI_SYMBOL_ART[this.name()]);
  readonly dimension = computed(() => this.size() === null ? '1em' : `${this.size()}px`);
  readonly position = computed(() => { const a = this.art(); return a ? `${a.col * 50}% ${a.row * 50}%` : '50% 50%'; });
}

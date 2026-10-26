import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STATUS_ART } from '../core/data/status-art';

/** One complete sprite-atlas cell; retains the artwork silhouette and transparent gutter. */
@Component({
  selector: 'app-status-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'img', '[attr.aria-label]': 'label()', '[attr.title]': 'label()', '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `@if (art(); as a) { <span class="symbol" [style.background-image]="'url(' + a.sheet + ')'" [style.background-position]="position()" aria-hidden="true"></span> } @else { <span class="fallback" aria-hidden="true">◇</span> }`,
  styles: `:host{display:inline-block;position:relative;vertical-align:middle;flex:none;overflow:hidden;border:1px solid #a2844d;border-radius:4px;background:radial-gradient(ellipse,#26343f,#080e15 80%);box-shadow:inset 0 0 0 1px #0009,0 1px 3px #0009;box-sizing:border-box}.symbol{display:block;position:absolute;inset:0;background-size:300% 300%;background-repeat:no-repeat}.fallback{display:grid;place-items:center;height:100%;color:#e1c58d;font-size:12px}`,
})
export class StatusIconComponent {
  readonly statusId = input.required<string>();
  readonly size = input(22);
  readonly remaining = input<number | null>(null);
  readonly art = computed(() => STATUS_ART[this.statusId()]);
  readonly label = computed(() => (this.art()?.label ?? this.statusId()) + (this.remaining() === null ? '' : ` · ${Math.max(0, this.remaining()!).toFixed(1)} วินาที`));
  readonly position = computed(() => { const a = this.art(); return a ? `${a.col * 50}% ${a.row * 50}%` : '50% 50%'; });
}

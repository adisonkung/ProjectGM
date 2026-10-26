import { ChangeDetectionStrategy, Component, input } from '@angular/core';
/** Decorative three-cell metal atlas; never controls outcomes, rewards or battle state. */
@Component({
  selector: 'app-battle-emblem',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `<div class="seal"><img src="/ui/eldervane/battle-seals.webp" alt="" draggable="false" [style.left.%]="kind() === 'victory' ? 0 : kind() === 'defeat' ? -100 : -200" /></div>`,
  styles: [':host{display:grid;place-items:center;width:200px;height:150px;pointer-events:none}.seal{position:relative;width:150px;height:150px;overflow:hidden}img{position:absolute;top:0;width:300%;height:100%;max-width:none;display:block}'],
})
export class BattleEmblemComponent {
  readonly kind = input<'victory' | 'defeat' | 'pause'>('victory');
}

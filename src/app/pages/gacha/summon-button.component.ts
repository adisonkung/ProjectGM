import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { SUMMON_SEALS, SUMMON_SEAL_COST } from '../../core/data/summon-seals';

/** One shared live cost/label layout for the gate and the book's repeat action. */
@Component({
  selector: 'app-summon-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="summon-button" [class.single]="count() === 1" [class.multi]="count() === 10"
      [class.repeat]="tone() === 'repeat'" [class.gold-seal]="seal() === 'special'" [class.aurora-seal]="seal() === 'aurora'"
      [disabled]="disabled()" [attr.aria-label]="label() + ' ' + count() + ' ครั้ง ใช้' + currency().name + ' ' + cost() + ' แผ่น'"
      (click)="activate.emit()">
      <span class="price"><img [src]="currency().icon" alt="" aria-hidden="true" /><span class="amount">×{{ cost() }}</span></span>
      <span class="price-divider" aria-hidden="true"></span>
      <span class="summon-label">{{ label() }}<small>{{ count() }} ครั้ง</small></span>
    </button>`,
  styleUrl: './summon-button.component.scss',
})
export class SummonButtonComponent {
  readonly count = input.required<1 | 10>();
  readonly label = input('อัญเชิญ');
  readonly tone = input<'gate' | 'repeat'>('gate');
  readonly seal = input<keyof typeof SUMMON_SEALS>('standard');
  readonly disabled = input(false);
  readonly activate = output<void>();
  readonly currency = computed(() => SUMMON_SEALS[this.seal()]);
  readonly cost = computed(() => this.count() === 10 ? SUMMON_SEAL_COST.multi : SUMMON_SEAL_COST.single);
}

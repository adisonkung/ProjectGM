import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { TowerOrnamentComponent } from '../tower/tower-ornament.component';
import { IconComponent } from '../../shared/icon.component';

/** Presentation metadata only. Future campaigns still require real pool/rate/service support. */
export interface SummonCampaign {
  id: string;
  kind: 'standard' | 'limited' | 'ur' | 'new';
  label: string;
  title: string;
  subtitle: string;
  art: string | undefined;
}

@Component({
  selector: 'app-summon-campaign',
  imports: [TowerOrnamentComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" class="campaign" [attr.data-kind]="campaign().kind" (click)="details.emit()" aria-label="ดูรายละเอียดแบนเนอร์อัญเชิญ">
      <app-tower-ornament [grooved]="true" [ornate]="true" />
      @if (campaign().art) { <img class="campaign-art" [src]="campaign().art" alt="" decoding="async" /> }
      <span class="campaign-shade" aria-hidden="true"></span>
      <span class="campaign-seal"><app-icon name="summon" [size]="18" />{{ campaign().label }}</span>
      <span class="campaign-orbit" aria-hidden="true">✦</span>
      <span class="campaign-copy"><small>THE CELESTIAL SANCTUM</small><strong>{{ campaign().title }}</strong><span>{{ campaign().subtitle }}</span><span class="campaign-rule" aria-hidden="true">◆</span><span class="campaign-open">ดูรายละเอียด <app-icon name="arrow" [size]="18" /></span></span>
      <span class="campaign-gleam" aria-hidden="true"></span>
    </button>
  `,
  styleUrl: './summon-campaign.component.scss',
})
export class SummonCampaignComponent {
  readonly campaign = input.required<SummonCampaign>();
  readonly details = output<void>();
}

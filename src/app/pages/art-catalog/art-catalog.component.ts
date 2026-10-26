import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { GENERATED_ART } from '../../core/data/generated-art';
import { EquipmentArtComponent } from '../../shared/equipment-art.component';

/** GM art review; examples and superseded concepts are explicitly separated from active runtime art. */
@Component({
  selector: 'app-art-catalog',
  imports: [RouterLink, EquipmentArtComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section><header><a routerLink="/account">‹ กลับบัญชี</a><h1>คลังอาร์ต Eldervane</h1><p>ภาพทั้งหมด {{ all.length }} ไฟล์ · ใช้งานแล้ว / แบบร่าง / ตัวอย่างที่พักไว้</p></header>
      <nav aria-label="หมวดอาร์ต">@for (g of groups; track g) { <button type="button" [class.on]="group() === g" [attr.aria-pressed]="group() === g" (click)="group.set(g)">{{ g === 'all' ? 'ทั้งหมด' : g }}</button> }</nav>
      @if (group() === 'all' || group() === 'sword-foreground') {
        <h2>ดาบ 5 Tier · ภาพเดียวกับเตาหลอม / กระเป๋า / ช่องสวมใส่</h2><div class="tiers">@for (t of tiers; track t) { <article><app-equipment-art definitionId="heavy_blade" [rarity]="t" /><b>{{ t }}</b></article> }</div>
      }
      <h2>ไฟล์แยกรายภาพ</h2><div class="assets">@for (a of visible(); track a.id) {
        <article [class.board]="a.group === 'concept-board'"><a [href]="a.url" target="_blank" rel="noopener"><img [src]="a.url" [alt]="a.label" loading="lazy" /></a><h3>{{ a.label }}</h3><small>{{ a.group }}</small><span class="status" [class.active]="a.status === 'active'">{{ statusLabel[a.status] }}</span></article>
      }</div>
    </section>
  `,
  styles: `
    :host { display: block; background: #0d151be8; color: #f5e6c6; min-height: 100vh; } section { max-width: 1400px; margin: auto; padding: 24px; } h1 { font-size: 28px; } p,small { color: #c9b794; } a { color: #efce8b; } nav { display: flex; flex-wrap: wrap; gap: 8px; padding: 18px 0; } button { padding: 10px 16px; border: 1px solid #9d783d; color: #f4ddae; background: #15212a; cursor: pointer; }.on { background: #7e131a; } .assets,.tiers { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 16px; } article { min-width: 0; padding: 12px; border: 1px solid #8c6d38; background: #10191f; } article>a { display: block; background: radial-gradient(#313b44,#090e14); } img { display: block; width: 100%; aspect-ratio: 1; object-fit: contain; } h3 { font-size: 14px; overflow-wrap: anywhere; } .status { display: block; margin-top: 8px; color: #f4b879; font-size: 12px; } .active { color: #90d6ba; } .board { grid-column: span 2; } .board img { aspect-ratio: 1.5; } .tiers b { display: block; text-align: center; margin-top: 10px; font-size: 12px; } @media(max-width:800px) { section { padding: 16px; }.assets,.tiers { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; } }
  `,
})
export class ArtCatalogComponent {
  readonly all = GENERATED_ART;
  readonly groups = ['all', ...new Set(GENERATED_ART.map(a => a.group))];
  readonly group = signal('all');
  readonly visible = computed(() => this.all.filter(a => this.group() === 'all' || a.group === this.group()));
  readonly tiers = ['COMMON', 'UNCOMMON', 'RARE', 'ELITE', 'EPIC'] as const;
  readonly statusLabel: Record<string, string> = { active: 'เชื่อมใช้งานแล้ว', example_paused: 'ตัวอย่างไป๋หลง · พักรอเปลี่ยน Portrait', concept_only: 'แบบร่าง · ยังไม่ใช่ไอเทมใช้งาน', superseded: 'แบบเก่า · ถูกแทนด้วยดาบแล้ว' };
}

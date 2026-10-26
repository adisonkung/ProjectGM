import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ITEMS } from '../core/data/economy';
import { GENERATED_ICONS } from '../core/data/generated-art';
import { SaveService } from '../core/services/save.service';
import { CitadelFrameComponent } from './citadel-frame.component';
import { IconComponent } from './icon.component';

/** Read-only stock ledger: actual item definitions/counts, including partial tome fragments. */
@Component({
  selector: 'app-material-inventory',
  imports: [IconComponent, CitadelFrameComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <details class="material-stock" open>
      <summary><app-icon name="bag" [size]="28" /><span>คลังวัสดุ <small>จำนวนที่มีอยู่</small></span><span class="chevron" aria-hidden="true">⌄</span></summary>
      <ul aria-label="วัสดุของคุณ">
        @for (item of stock(); track item.id) {
          <li class="citadel-surface" [class.empty]="item.count === 0"><app-citadel-frame [cut]="12" />
            <app-icon [name]="item.id" [size]="52" />
            <div><b>{{ item.name }}</b><small>{{ item.hint }}</small><strong [attr.aria-label]="'มี ' + item.count + ' ชิ้น'">×{{ item.count.toLocaleString() }}</strong></div>
          </li>
        }
      </ul>
    </details>
  `,
  styles: `
    :host{display:block;margin-top:24px;color:#f2e5c9}.material-stock{padding:18px;background:linear-gradient(140deg,#172128f5,#080f15f5);border:1px solid #92703a;box-shadow:inset 0 0 0 3px #0b1319,0 5px 18px #0005}summary{display:flex;align-items:center;gap:14px;cursor:pointer;font:600 21px var(--title);list-style:none}summary::-webkit-details-marker{display:none}summary small{display:block;font:400 12px var(--body);color:#b8aa90}.chevron{margin-left:auto}details[open] .chevron{transform:rotate(180deg)}ul{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;list-style:none;padding:20px 0 0;margin:0}li{display:flex;align-items:center;gap:14px;padding:18px 14px;min-width:0}li>app-icon{flex:none}li>div{min-width:0}b{display:block;font-size:13px;overflow-wrap:anywhere}li small{display:block;font-size:11px;color:#b8aa90;line-height:1.5;margin-top:4px}strong{display:block;color:#f2ce85;font-size:17px;margin-top:5px}.empty strong{color:#a4a29b}@media(max-width:1200px){ul{grid-template-columns:repeat(3,minmax(0,1fr))}}@media(max-width:650px){ul{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}li{flex-direction:column;align-items:flex-start;padding:16px;gap:12px}.material-stock{padding:14px}summary{font-size:19px}}
  `,
})
export class MaterialInventoryComponent {
  private readonly save = inject(SaveService);
  readonly stock = computed(() => Object.values(ITEMS).filter(item => GENERATED_ICONS[item.id]).map(item => ({
    id: item.id, name: item.name, count: this.save.state().inventory[item.id] ?? 0,
    hint: item.exp ? `EXP +${item.exp.toLocaleString()}` : item.combinesInto ? `${item.fragmentsPerItem} เศษ → ${ITEMS[item.combinesInto]?.name ?? item.combinesInto}` : item.id === 'universal_memory' ? 'ใช้พัฒนาดาวฮีโร่' : item.kind === 'SKILL_TOME' ? 'ใช้พัฒนาสกิล' : item.kind === 'EQUIPMENT_FRAGMENT' ? 'ใช้หลอมสร้างอุปกรณ์' : 'ใช้ตีบวกอุปกรณ์',
  })));
}

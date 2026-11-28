import { A11yModule } from '@angular/cdk/a11y';
import { ChangeDetectionStrategy, Component, computed, HostListener, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SaveService } from '../../core/services/save.service';
import { formatCurrency } from '../../shared/format-currency';
import { HomeBagComponent } from '../home/home-bag.component';
import { LineIconComponent } from '../home/line-icon.component';
import { MOCK_MAIL, MENU_TILES } from '../home/home-mock';
import { CollectionIconComponent } from './collection-icon.component';

/** optional page-specific currency shown before gems (e.g. summon seals on /gacha) */
export interface HeaderResource { icon: string; label: string; value: string | number; }

@Component({
  selector: 'app-collection-header',
  imports: [A11yModule, RouterLink, HomeBagComponent, LineIconComponent, CollectionIconComponent],
  templateUrl: './collection-header.component.html',
  styleUrl: './collection-header.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CollectionHeaderComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input.required<string>();
  readonly headingId = input.required<string>();
  readonly extra = input<HeaderResource | null>(null);
  private readonly save = inject(SaveService);

  readonly menuOpen = signal(false);
  readonly bagOpen = signal(false);
  readonly notice = signal('');
  readonly mail = MOCK_MAIL;
  readonly menuBadge = MENU_TILES.filter(t => t.badge || t.dot).length;
  readonly gems = computed(() => formatCurrency(this.save.state().gems));
  readonly gold = computed(() => formatCurrency(this.save.state().gold));
  readonly gemsFull = computed(() => this.save.state().gems.toLocaleString('en-US'));
  readonly goldFull = computed(() => this.save.state().gold.toLocaleString('en-US'));
  readonly destinations = [
    { path: '/home', name: 'หน้าหลัก', icon: 'isle' },
    { path: '/team', name: 'จัดทัพ', icon: 'squad' },
    { path: '/gacha', name: 'อัญเชิญ', icon: 'summon' },
    { path: '/armory', name: 'อุปกรณ์', icon: 'gear' },
    { path: '/tower', name: 'ผจญภัย', icon: 'daily' },
    { path: '/account', name: 'ตั้งค่าและบัญชี', icon: 'settings' },
  ];
  soon(): void { this.notice.set('ฟังก์ชันนี้จะเปิดให้ใช้งานเร็ว ๆ นี้'); }
  @HostListener('document:keydown.escape')
  closePanels(): void { this.menuOpen.set(false); this.bagOpen.set(false); this.notice.set(''); }
}

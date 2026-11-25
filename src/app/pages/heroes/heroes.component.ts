import { A11yModule } from '@angular/cdk/a11y';
import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CLASS_NAME } from '../../core/data/classes';
import { HEROES } from '../../core/data/heroes';
import { HeroClass } from '../../core/models/hero';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { HeroStarsComponent } from '../../shared/hero-stars.component';
import { heroArt } from '../../core/data/hero-art';
import { heroStar } from '../../core/rules/stars';
import { formatCurrency } from '../../shared/format-currency';
import { HomeBagComponent } from '../home/home-bag.component';
import { LineIconComponent } from '../home/line-icon.component';
import { MOCK_MAIL, MENU_TILES } from '../home/home-mock';
import { CollectionIconComponent } from './collection-icon.component';

export type HeroSort = 'roster' | 'power' | 'level' | 'star' | 'name';

/** Approved charcoal portrait collection; all filters and progression read the existing save. */
@Component({
  selector: 'app-heroes',
  imports: [A11yModule, HeroStarsComponent, RouterLink, HeroPortraitComponent, HomeBagComponent, LineIconComponent, CollectionIconComponent],
  templateUrl: './heroes.component.html',
  styleUrl: './heroes.component.scss',
})
export class HeroesComponent {
  private readonly save = inject(SaveService);
  private readonly roster = inject(RosterService);
  readonly classes: (HeroClass | 'all')[] = ['all', 'fighter', 'tank', 'assassin', 'archer', 'mage', 'healer'];
  readonly className = (c: HeroClass | 'all') => (c === 'all' ? 'ทั้งหมด' : CLASS_NAME[c]);
  readonly sorts: { id: HeroSort; label: string }[] = [
    { id: 'roster', label: 'ลำดับฮีโร่' }, { id: 'power', label: 'พลัง' }, { id: 'level', label: 'เลเวล' }, { id: 'star', label: 'ดาว' }, { id: 'name', label: 'ชื่อ' },
  ];
  readonly menuOpen = signal(false);
  readonly bagOpen = signal(false);
  readonly notice = signal('');
  readonly mail = MOCK_MAIL;
  readonly menuBadge = MENU_TILES.filter(t => t.badge || t.dot).length;
  readonly gems = computed(() => formatCurrency(this.save.state().gems));
  readonly gold = computed(() => formatCurrency(this.save.state().gold));
  readonly gemsFull = computed(() => this.save.state().gems.toLocaleString('en-US'));
  readonly goldFull = computed(() => this.save.state().gold.toLocaleString('en-US'));
  readonly catalogCount = HEROES.length;
  readonly ownedCount = computed(() => new Set(this.cards().map(h => h.id)).size);
  readonly destinations = [
    { path: '/home', name: 'หน้าหลัก', icon: 'isle' },
    { path: '/team', name: 'จัดทัพ', icon: 'squad' },
    { path: '/gacha', name: 'อัญเชิญ', icon: 'summon' },
    { path: '/armory', name: 'อุปกรณ์', icon: 'gear' },
    { path: '/tower', name: 'ผจญภัย', icon: 'daily' },
    { path: '/account', name: 'ตั้งค่าและบัญชี', icon: 'settings' },
  ];
  readonly classColor: Record<HeroClass | 'all', string> = {
    all: '#252525', fighter: '#ff2345', tank: '#ffce24', assassin: '#c954ff',
    archer: '#ff9a25', mage: '#48e4ff', healer: '#49ef69',
  };
  readonly shortName = (name: string) => name.split(' ')[0];
  soon(): void { this.notice.set('ฟังก์ชันนี้จะเปิดให้ใช้งานเร็ว ๆ นี้'); }
  @HostListener('document:keydown.escape')
  closePanels(): void { this.menuOpen.set(false); this.bagOpen.set(false); this.notice.set(''); }
  readonly cls = signal<HeroClass | 'all'>('all');
  readonly query = signal('');
  readonly sort = signal<HeroSort>('roster');
  readonly featuredUid = computed(() => this.cards().find(h => h.isMain)?.uid ?? this.cards()[0]?.uid);
  readonly teamCount = computed(() => this.cards().filter(h => h.inTeam).length);
  readonly readyCount = computed(() => this.cards().filter(h => h.btReady || h.skillReady || h.canLevel).length);

  readonly cards = computed(() => {
    const s = this.save.state();
    const team = new Set(s.team.map(t => t.uid));
    const slots = new Set(s.trainingSlots);
    const main = s.island?.mainIslandHeroId ?? null;
    const hasPotion = ['exp_potion_s', 'exp_potion_m', 'exp_potion_l'].some(id => (s.inventory[id] ?? 0) > 0);
    return s.heroes.map(h => {
      const t = this.roster.template(h);
      const p = this.roster.progress(h);
      const skillReady = this.roster.skills(h).some(v => v.next && !v.blocked);
      return {
        uid: h.uid, id: t.id, portrait: heroArt(t.id)?.portrait, name: t.name, cls: t.cls, star: heroStar(h), level: h.level, cap: p.levelCap,
        power: this.roster.power(h),
        inTeam: team.has(h.uid), training: slots.has(h.uid), isMain: h.uid === main,
        btReady: p.state === 'BREAKTHROUGH_READY', skillReady,
        canLevel: hasPotion && p.state !== 'MAX' && p.state !== 'BREAKTHROUGH_READY',
        expPct: p.state === 'MAX' ? 100 : Math.min(100, (p.exp / p.expToNext) * 100),
      };
    });
  });

  readonly shown = computed(() => {
    const c = this.cls();
    const q = this.query().trim().toLocaleLowerCase('th');
    const list = this.cards().filter(x => (c === 'all' || x.cls === c) && (!q || `${x.name} ${x.id}`.toLocaleLowerCase('th').includes(q)));
    const by: Record<HeroSort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      roster: (a, b) => HEROES.findIndex(t => t.id === a.id) - HEROES.findIndex(t => t.id === b.id) || a.uid - b.uid,
      power: (a, b) => b.power - a.power,
      level: (a, b) => b.level - a.level || b.power - a.power,
      star: (a, b) => b.star - a.star || b.power - a.power,
      name: (a, b) => a.name.localeCompare(b.name, 'th'),
    };
    return [...list].sort(by[this.sort()]);
  });

  readonly count = (c: HeroClass | 'all') => (c === 'all' ? this.cards().length : this.cards().filter(x => x.cls === c).length);
  readonly classLabel = (c: HeroClass) => CLASS_NAME[c];
}

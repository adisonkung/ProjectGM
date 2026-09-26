import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CLASS_NAME } from '../../core/data/classes';
import { HeroClass } from '../../core/models/hero';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { IconComponent } from '../../shared/icon.component';

export type HeroSort = 'power' | 'level' | 'star' | 'name';

/** Hero roster: portrait cards, class filter, sort, "ready" badges (breakthrough / skill rank-up / potions) */
@Component({
  selector: 'app-heroes',
  imports: [RouterLink, HeroPortraitComponent, IconComponent],
  templateUrl: './heroes.component.html',
  styleUrl: './heroes.component.scss',
})
export class HeroesComponent {
  private readonly save = inject(SaveService);
  private readonly roster = inject(RosterService);
  readonly classes: (HeroClass | 'all')[] = ['all', 'tank', 'fighter', 'assassin', 'archer', 'mage', 'healer'];
  readonly className = (c: HeroClass | 'all') => (c === 'all' ? 'ทั้งหมด' : CLASS_NAME[c]);
  readonly sorts: { id: HeroSort; label: string }[] = [
    { id: 'power', label: 'พลัง' }, { id: 'level', label: 'เลเวล' }, { id: 'star', label: 'ดาว' }, { id: 'name', label: 'ชื่อ' },
  ];
  readonly cls = signal<HeroClass | 'all'>('all');
  readonly sort = signal<HeroSort>('power');

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
        uid: h.uid, id: t.id, name: t.name, cls: t.cls, star: t.star, level: h.level, cap: p.levelCap,
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
    const list = this.cards().filter(x => c === 'all' || x.cls === c);
    const by: Record<HeroSort, (a: (typeof list)[0], b: (typeof list)[0]) => number> = {
      power: (a, b) => b.power - a.power,
      level: (a, b) => b.level - a.level || b.power - a.power,
      star: (a, b) => b.star - a.star || b.power - a.power,
      name: (a, b) => a.name.localeCompare(b.name, 'th'),
    };
    return [...list].sort(by[this.sort()]);
  });

  readonly count = (c: HeroClass | 'all') => (c === 'all' ? this.cards().length : this.cards().filter(x => x.cls === c).length);
  readonly stars = (n: number) => '★'.repeat(n);
  readonly classLabel = (c: HeroClass) => CLASS_NAME[c];
}

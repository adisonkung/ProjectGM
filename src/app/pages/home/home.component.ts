import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BACKGROUNDS } from '../../core/data/backgrounds';
import { DAILY_BONUS, FARM_DUNGEONS } from '../../core/data/economy';
import { FLOOR_BANDS } from '../../core/data/progression';
import { STAGES } from '../../core/data/stages';
import { ProgressionService } from '../../core/services/progression.service';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { TeamService } from '../../core/services/team.service';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { IconComponent } from '../../shared/icon.component';
import { TeamPresetsComponent } from '../../shared/team-presets.component';

/** Home hub: tower progress + next floor, current team, daily bonus clears left, heroes ready to grow, quick links */
@Component({
  selector: 'app-home',
  imports: [RouterLink, HeroPortraitComponent, IconComponent, TeamPresetsComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  private readonly save = inject(SaveService);
  private readonly roster = inject(RosterService);
  private readonly team = inject(TeamService);
  private readonly prog = inject(ProgressionService);

  readonly total = STAGES.length;
  readonly cleared = computed(() => this.save.state().cleared);
  readonly done = computed(() => this.cleared() >= this.total);
  /** the floor to challenge next (the last one again once the tower is cleared) */
  readonly next = computed(() => {
    const n = Math.min(this.cleared() + 1, this.total);
    const s = STAGES[n - 1];
    const band = FLOOR_BANDS[n];
    return { floor: n, name: s.name ?? `ชั้น ${n}`, level: s.recommendedLevel ?? band?.levels[0] ?? 1, bg: s.background ? BACKGROUNDS[s.background]?.file : null };
  });
  readonly floors = computed(() => STAGES.map(s => ({ n: s.floor, done: s.floor <= this.cleared(), next: s.floor === this.cleared() + 1 })));

  readonly squad = computed(() => {
    const heroes = this.save.state().heroes;
    return this.team.slots().map(t => heroes.find(h => h.uid === t.uid)).filter(h => !!h).map(h => ({ uid: h.uid, id: h.templateId, level: h.level, power: this.roster.power(h) }));
  });
  readonly squadPower = computed(() => this.squad().reduce((a, h) => a + h.power, 0));
  readonly avgLevel = computed(() => {
    const s = this.squad();
    return s.length ? Math.round((s.reduce((a, h) => a + h.level, 0) / s.length) * 10) / 10 : 0;
  });

  readonly daily = computed(() => {
    this.save.state(); // re-read after runs
    const pools = [
      { id: 'TRAINING', label: 'Training', icon: 'shield' },
      { id: 'ASCENSION', label: 'Ascension', icon: 'crown' },
      { id: 'HUNT', label: 'Hunt', icon: 'coin' },
      { id: 'SKILL', label: 'Skill Trial', icon: 'scroll' },
    ];
    return pools.map(p => {
      const left = this.prog.bonusLeft(p.id);
      const max = DAILY_BONUS[p.id] ?? 0;
      const unlock = Math.min(...FARM_DUNGEONS.filter(d => d.dailyBonusPool === p.id).map(d => d.unlockFloor));
      return { ...p, left, max, unlock, pips: Array.from({ length: max }, (_, i) => i < left) };
    });
  });

  /** heroes with something to do: breakthrough ready, a skill rank-up affordable */
  readonly ready = computed(() => {
    const out: { uid: number; id: string; name: string; what: string; tone: string }[] = [];
    for (const h of this.save.state().heroes) {
      const t = this.roster.template(h);
      if (this.roster.progress(h).state === 'BREAKTHROUGH_READY') out.push({ uid: h.uid, id: t.id, name: t.name, what: 'Breakthrough', tone: 'ember' });
      else if (this.roster.skills(h).some(v => v.next && !v.blocked)) out.push({ uid: h.uid, id: t.id, name: t.name, what: 'อัปสกิลได้', tone: 'arcane' });
    }
    return out.slice(0, 6);
  });

  readonly links = [
    { path: '/heroes', icon: 'heroes', label: 'หอวีรชน', sub: 'เลเวล · สกิล · Breakthrough' },
    { path: '/armory', icon: 'armory', label: 'คลังอาวุธ', sub: 'สวม ตีบวก คราฟต์' },
    { path: '/tower', icon: 'tower', label: 'ดันเจี้ยน', sub: 'Training · Ascension · Hunt · Trial' },
    { path: '/gacha', icon: 'summon', label: 'ประตูอัญเชิญ', sub: 'เร็ว ๆ นี้' },
  ];
}

import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CLASS_NAME } from '../../core/data/classes';
import { EXP_POTIONS, ITEMS, TRAINING_SLOTS } from '../../core/data/economy';
import { FLAT_STATS, RARITY_NAME, SLOTS, STAT_LABEL } from '../../core/data/equipment';
import { heroArt } from '../../core/data/hero-art';
import { kitOf } from '../../core/data/hero-skills';
import { TOME_CONVERSION } from '../../core/data/skill-ranks';
import { EquipmentInstance, EquipmentSlot, EquipStat, Rarity } from '../../core/models/equipment';
import { SkillKind } from '../../core/models/progression';
import { SkillUpgradeError } from '../../core/models/skill-rank';
import { heroGearTotals, itemLines, itemName } from '../../core/rules/equipment';
import { heroStats } from '../../core/rules/stats';
import { starMultiplier } from '../../core/data/classes';
import { MAX_STAR, STAR_PERKS, STAR_VISUAL } from '../../core/data/stars';
import { heroStar } from '../../core/rules/stars';
import { RosterService } from '../../core/services/roster.service';
import { SaveService } from '../../core/services/save.service';
import { IslandService } from '../../core/services/island.service';
import { HeroPortraitComponent } from '../../shared/hero-portrait.component';
import { IconComponent } from '../../shared/icon.component';

const UPGRADE_ERROR: Record<SkillUpgradeError, string> = {
  MAX_RANK: 'ระดับสูงสุดแล้ว', RANK_CAP: 'ติดเพดานระดับ — ต้อง Breakthrough', NEED_LEVEL: 'เลเวลไม่ถึง',
  NEED_BREAKTHROUGH: 'ต้อง Breakthrough ก่อน', NEED_MATERIALS: 'Skill Tome ไม่พอ', NEED_GOLD: 'ทองไม่พอ', NO_HERO: '',
};
const RARITY_TIER: Record<Rarity, number> = { COMMON: 1, UNCOMMON: 2, RARE: 3, ELITE: 4, EPIC: 5 };
const SLOT_LABEL: Record<EquipmentSlot, string> = { WEAPON: 'อาวุธ', ARMOR: 'เกราะ', ACCESSORY: 'เครื่องประดับ' };
const SLOT_ICON: Record<EquipmentSlot, string> = { WEAPON: 'sword', ARMOR: 'shield', ACCESSORY: 'gem' };

/** Hero detail: stats breakdown (base / gear), level · EXP · potions · breakthrough, skills with rank-up, gear, training slot */
@Component({
  selector: 'app-hero-detail',
  imports: [RouterLink, HeroPortraitComponent, IconComponent],
  templateUrl: './hero-detail.component.html',
  styleUrl: './hero-detail.component.scss',
})
export class HeroDetailComponent {
  private readonly save = inject(SaveService);
  private readonly router = inject(Router);
  readonly roster = inject(RosterService);
  private readonly isl = inject(IslandService);
  /** Main Island Hero = identity / cosmetic only (no stats, not the party leader) */
  readonly isMain = computed(() => this.isl.mainHeroUid() === this.uid());

  readonly uid = toSignal(inject(ActivatedRoute).paramMap.pipe(map(p => Number(p.get('uid')))), { initialValue: 0 });
  readonly hero = computed(() => this.save.state().heroes.find(h => h.uid === this.uid()) ?? null);
  readonly t = computed(() => { const h = this.hero(); return h ? this.roster.template(h) : null; });
  readonly message = signal<{ text: string; ok: boolean } | null>(null);

  // ---------------------------------------------------------------- star development (Hero Memory → 6★)
  readonly MAX_STAR = MAX_STAR;
  readonly star = computed(() => { const h = this.hero(); return h ? heroStar(h) : 1; });
  readonly starView = computed(() => { const h = this.hero(); return h ? this.roster.starView(h) : null; });
  /** raw stat gain of the next star (HP / ATK / DEF) */
  readonly nextStarGain = computed(() => {
    const s = this.star();
    return s >= MAX_STAR ? 0 : Math.round((starMultiplier(s + 1) / starMultiplier(s) - 1) * 1000) / 10;
  });
  /** 4★ / 5★ / 6★ perks + visual evolution, reached or not */
  readonly starSteps = computed(() => [4, 5, 6].map(n => ({ n, perk: STAR_PERKS[n].label, visual: STAR_VISUAL[n].label, reached: this.star() >= n, gain: Math.round((starMultiplier(n) - 1) * 100) })));
  starUp(): void {
    const s = this.star();
    if (this.roster.starUp(this.uid())) this.say(`อัปเป็น ${s + 1}★ แล้ว`);
    else this.say('Memory ไม่พอ', false);
  }

  readonly inventory = computed(() => this.save.state().inventory);
  /** owned count of an item (missing = 0) */
  have(id: string): number {
    return (this.inventory() as Partial<Record<string, number>>)[id] ?? 0;
  }
  readonly gold = computed(() => this.save.state().gold);
  readonly inTeam = computed(() => this.save.state().team.some(t => t.uid === this.uid()));
  readonly training = computed(() => this.save.state().trainingSlots.includes(this.uid()));
  readonly slotsFull = computed(() => this.save.state().trainingSlots.length >= TRAINING_SLOTS.count);
  readonly slotShare = TRAINING_SLOTS.expShare;

  readonly progress = computed(() => { const h = this.hero(); return h ? this.roster.progress(h) : null; });
  readonly power = computed(() => { const h = this.hero(); return h ? this.roster.power(h) : 0; });

  /** base (no gear) vs final — the gear share of each core stat */
  readonly statRows = computed(() => {
    const h = this.hero(), t = this.t();
    if (!h || !t) return [];
    const fin = heroStats(t, h);
    const base = heroStats(t, { ...h, gear: undefined });
    const row = (label: string, icon: string, b: number, f: number, digits = 0) => ({ label, icon, base: b.toFixed(digits), total: f.toFixed(digits), bonus: f - b > 1e-6 ? '+' + (f - b).toFixed(digits) : '' });
    return [
      row('พลังชีวิต', 'shield', base.hp, fin.hp),
      row('พลังโจมตี', 'sword', base.atk, fin.atk),
      row('พลังป้องกัน', 'shield', base.def, fin.def),
      row('ความเร็วโจมตี', 'bolt', base.atkSpeed, fin.atkSpeed, 2),
      row('ความเร็วเดิน', 'arrow', base.moveSpeed, fin.moveSpeed, 2),
      row('ระยะโจมตี', 'star', base.range, fin.range),
    ];
  });

  /** gear utility lines (crit, CDR, healing …) that are not already in the core stat rows */
  readonly extraStats = computed(() => {
    const h = this.hero();
    if (!h) return [];
    const tot = heroGearTotals(h);
    const core: EquipStat[] = ['atkPct', 'atkFlat', 'hpPct', 'defPct', 'attackSpeed', 'moveSpeed'];
    return (Object.keys(tot) as EquipStat[]).filter(s => tot[s] && !core.includes(s)).map(s => this.fmt(s, tot[s]));
  });

  /** wide key art behind the header (heroes that have one) */
  readonly banner = computed(() => heroArt(this.t()?.id)?.banner);

  readonly skills = computed(() => {
    const h = this.hero(), t = this.t();
    if (!h || !t) return [];
    const kit = kitOf(t.id, t.cls);
    const art = heroArt(t.id);
    const icon: Record<SkillKind, string | undefined> = { skill: art?.s1, skill2: art?.s2, ult: art?.ult };
    return this.roster.skills(h).map(v => ({ ...v, def: kit[v.slot], icon: icon[v.slot] }));
  });

  readonly gear = computed(() => {
    const h = this.hero();
    return SLOTS.map(slot => {
      const it = h?.gear?.[slot];
      return { slot, label: SLOT_LABEL[slot], icon: SLOT_ICON[slot], item: it ?? null, tier: it ? RARITY_TIER[it.rarity] : 0, lines: it ? this.lines(it) : [] };
    });
  });

  readonly potions = computed(() => EXP_POTIONS.map(id => ({ id, name: ITEMS[id]?.name ?? id, n: this.inventory()[id] ?? 0 })).filter(p => p.n > 0));
  readonly conversions = TOME_CONVERSION;

  /** prev / next hero in roster order */
  readonly siblings = computed(() => {
    const list = this.save.state().heroes;
    const i = list.findIndex(h => h.uid === this.uid());
    if (i < 0 || list.length < 2) return null;
    return { prev: list[(i - 1 + list.length) % list.length].uid, next: list[(i + 1) % list.length].uid };
  });

  readonly className = (c: string) => CLASS_NAME[c as keyof typeof CLASS_NAME];
  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly gearName = itemName;
  readonly rarityName = RARITY_NAME;
  readonly slotTag: Record<SkillKind, string> = { skill: 'สกิล 1', skill2: 'สกิล 2', ult: 'ท่าไม้ตาย' };
  readonly errorText = (e: SkillUpgradeError | null) => (e ? UPGRADE_ERROR[e] : '');
  readonly stars = (n: number) => '★'.repeat(n);
  readonly pct = (a: number, b: number) => Math.min(100, (a / Math.max(1, b)) * 100);

  private fmt(stat: EquipStat, v: number) {
    return `${STAT_LABEL[stat]} ${v >= 0 ? '+' : ''}${FLAT_STATS.includes(stat) ? v : (v * 100).toFixed(1) + '%'}`;
  }
  private lines(i: EquipmentInstance) {
    return itemLines(i).slice(0, 1 + i.secondaries.length).map(l => this.fmt(l.stat, l.value));
  }
  private say(text: string, ok = true) { this.message.set({ text, ok }); }

  use(id: string, n: number | 'max') {
    const used = this.roster.usePotion(this.uid(), id, n);
    this.say(used ? `ใช้ ${this.itemName(id)} ×${used}` : 'ใช้ไม่ได้ตอนนี้', !!used);
  }
  useMax() { this.roster.usePotionsToCap(this.uid()); this.say('ใช้ยาจนถึงเพดานเลเวลแล้ว'); }
  breakthrough() {
    const err = this.roster.breakthrough(this.uid());
    this.say(err === 'NEED_ITEMS' ? 'หิน Breakthrough ไม่พอ' : err === 'NEED_EXP' ? 'EXP ยังไม่ครบ' : err ? 'ทำไม่ได้' : 'Breakthrough สำเร็จ! เพดานเลเวลเพิ่มขึ้น', !err);
  }
  toggleSlot() {
    if (!this.roster.toggleTrainingSlot(this.uid())) this.say(`ช่องฝึกเต็ม (${TRAINING_SLOTS.count} ช่อง)`, false);
  }
  upgrade(slot: SkillKind) {
    const err = this.roster.upgradeSkill(this.uid(), slot);
    this.say(err ? UPGRADE_ERROR[err] : 'อัปสกิลสำเร็จ!', !err);
  }
  convert(from: string) { if (this.roster.convertTomes(from)) this.say('แลก Skill Tome แล้ว'); }
  setMain() { if (this.isl.setMainHero(this.uid())) this.say('ตั้งเป็นฮีโร่หลักบนเกาะแล้ว'); }
  go(uid: number) { this.message.set(null); this.router.navigate(['/heroes', uid]); }
}

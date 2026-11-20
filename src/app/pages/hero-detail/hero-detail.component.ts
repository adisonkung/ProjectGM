import { StateEmblemComponent } from '../../shared/state-emblem.component';
import { EquipmentArtComponent } from '../../shared/equipment-art.component';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { CLASS_NAME } from '../../core/data/classes';
import { EXP_POTIONS, ITEMS, TRAINING_SLOTS } from '../../core/data/economy';
import { FLAT_STATS, RARITY_NAME, SLOTS, STAT_LABEL } from '../../core/data/equipment';
import { heroArt } from '../../core/data/hero-art';
import { GENERATED_ICONS } from '../../core/data/generated-art';
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
import { AwakenedStarComponent, HeroStarsComponent } from '../../shared/hero-stars.component';
import { IconComponent } from '../../shared/icon.component';
import { CitadelFrameComponent } from '../../shared/citadel-frame.component';
import { CitadelIconComponent } from '../../shared/citadel-icon.component';
import { SheetFxComponent } from '../../shared/sheet-fx.component';

const UPGRADE_ERROR: Record<SkillUpgradeError, string> = {
  MAX_RANK: 'ระดับสูงสุดแล้ว', RANK_CAP: 'ติดเพดานระดับ — ต้อง Breakthrough', NEED_LEVEL: 'เลเวลไม่ถึง',
  NEED_BREAKTHROUGH: 'ต้อง Breakthrough ก่อน', NEED_MATERIALS: 'Skill Tome ไม่พอ', NEED_GOLD: 'ทองไม่พอ', NO_HERO: '',
};
type DetailTab = 'overview' | 'stats' | 'skills' | 'gear' | 'growth' | 'star';

/** Latin display line above the Thai name (two-syllable wuxia names get a space). */
const LATIN_NAME: Record<string, string> = { bailong: 'Bai Long', yuezheng: 'Yue Zheng', moye: 'Mo Ye', tangxun: 'Tang Xun', linxue: 'Lin Xue' };

const RARITY_TIER: Record<Rarity, number> = { COMMON: 1, UNCOMMON: 2, RARE: 3, ELITE: 4, EPIC: 5 };
const SLOT_LABEL: Record<EquipmentSlot, string> = { WEAPON: 'อาวุธ', ARMOR: 'เกราะ', ACCESSORY: 'เครื่องประดับ' };
const SLOT_ICON: Record<EquipmentSlot, string> = { WEAPON: 'sword', ARMOR: 'shield', ACCESSORY: 'gem' };

/** Hero detail (Gilded Ember): fixed key art, vertical tabs, floating identity + panel, roster strip. */
@Component({
  selector: 'app-hero-detail',
  imports: [AwakenedStarComponent, HeroStarsComponent, StateEmblemComponent, EquipmentArtComponent, SheetFxComponent, RouterLink, HeroPortraitComponent, IconComponent, CitadelFrameComponent, CitadelIconComponent],
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
  readonly starRow = computed(() => Array.from({ length: MAX_STAR }, (_, i) => {
    const n = i + 1, s = this.star();
    return { n, state: n <= s ? 'lit' : n === s + 1 ? 'next' : 'locked' };
  }));
  readonly maxPerks = [4, 5, 6].map(n => STAR_PERKS[n].label).join(' · ');
  readonly ordinal = (n: number) => ['FIRST', 'SECOND', 'THIRD', 'FOURTH', 'FIFTH', 'SIXTH'][n - 1] ?? '';
  /** HP / ATK / DEF now vs after the next star */
  readonly starDeltas = computed(() => {
    const h = this.hero(), t = this.t();
    if (!h || !t || this.star() >= MAX_STAR) return [];
    const a = heroStats(t, h), b = heroStats(t, { ...h, star: this.star() + 1 });
    const row = (label: string, icon: string, x: number, y: number) => ({ label, icon, cur: Math.round(x), next: Math.round(y), delta: Math.round(y) - Math.round(x) });
    return [row('HP', 'base-stat-hp', a.hp, b.hp), row('ATK', 'base-stat-atk', a.atk, b.atk), row('DEF', 'base-stat-def', a.def, b.def)];
  });
  readonly universalIcon = GENERATED_ICONS['universal_memory'];
  /** the perk the next star unlocks (4★–6★), if any */
  readonly nextPerk = computed(() => STAR_PERKS[this.star() + 1]?.label ?? '');
  starUp(): void {
    const uid = this.uid();
    if (this.roster.starUp(uid)) {
      this.message.set(null);
      this.starFx.set({ uid, n: this.star() });
    } else {
      this.say('Memory ไม่พอ', false);
    }
  }
  /** Gilded Ember pack (public/ui/gilded): icons + one-shot VFX sheets */
  readonly gild = (name: string) => `ui/gilded/${name}.webp`;
  readonly starImg = (n: number, lit: boolean) => this.gild(!lit ? 'star_empty' : n > MAX_STAR ? 'star_awakened' : 'star_lit');
  /** Short gold shimmer centered on the newly unlocked star. */
  readonly starFx = signal<{ uid: number; n: number } | null>(null);
  readonly levelFx = signal<{ key: number; kind: 'level' | 'breakthrough' } | null>(null);

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
      row('พลังชีวิต', 'base-stat-hp', base.hp, fin.hp),
      row('พลังโจมตี', 'base-stat-atk', base.atk, fin.atk),
      row('พลังป้องกัน', 'base-stat-def', base.def, fin.def),
      row('ความเร็วโจมตี', 'base-stat-atkSpeed', base.atkSpeed, fin.atkSpeed, 2),
      row('ความเร็วเดิน', 'base-stat-moveSpeed', base.moveSpeed, fin.moveSpeed, 2),
      row('ระยะโจมตี', 'base-stat-range', base.range, fin.range),
    ];
  });

  /** gear utility lines (crit, CDR, healing …) that are not already in the core stat rows */
  readonly extraStats = computed(() => {
    const h = this.hero();
    if (!h) return [];
    const tot = heroGearTotals(h);
    const core: EquipStat[] = ['atkPct', 'atkFlat', 'hpPct', 'defPct', 'attackSpeed', 'moveSpeed'];
    return (Object.keys(tot) as EquipStat[]).filter(s => tot[s] && !core.includes(s)).map(s => ({ stat: s, text: this.fmt(s, tot[s]) }));
  });

  /** wide key art behind the header (heroes that have one) */
  readonly banner = computed(() => heroArt(this.t()?.id)?.banner);
  /** key art whose hero stands right of centre is mirrored so the info column never covers them */
  readonly bannerMirror = computed(() => !!heroArt(this.t()?.id)?.bannerMirror);
  readonly bannerDrop = computed(() => heroArt(this.t()?.id)?.bannerDrop ?? 0);
  private readonly reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** looping animated banner (muted); reduced motion keeps the still */
  readonly bannerVideo = computed(() => (this.reducedMotion ? undefined : heroArt(this.t()?.id)?.bannerVideo));
  readonly portrait = computed(() => heroArt(this.t()?.id)?.portrait);
  readonly attack = computed(() => { const t = this.t(); return t ? kitOf(t.id, t.cls).attack : null; });
  readonly tab = signal<DetailTab>(inject(ActivatedRoute).snapshot?.queryParamMap?.get('tab') === 'skills' ? 'skills' : 'overview');
  readonly statBreakdown = signal(false);
  readonly tabs: { id: DetailTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'ภาพรวม', icon: 'heroes' },
    { id: 'stats', label: 'ค่าสถานะ', icon: 'sword' },
    { id: 'skills', label: 'สกิล', icon: 'bolt' },
    { id: 'gear', label: 'อุปกรณ์', icon: 'armory' },
    { id: 'growth', label: 'เลเวล', icon: 'crystal' },
    { id: 'star', label: 'อัปดาว', icon: 'star' },
  ];

  readonly numerals = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  /** drifting embers over the key art: [left %, top %, delay s] */
  readonly motes = [[22, 70, 0], [34, 78, 1.4], [44, 64, 2.8], [27, 58, 4.1], [48, 82, 5.3]];
  readonly skillSel = signal(0);
  /** overview: which skill icon is open (null = none) */
  readonly overviewSkill = signal<number | null>(null);
  toggleOverviewSkill(i: number): void { this.overviewSkill.set(this.overviewSkill() === i ? null : i); }

  onTabKey(event: KeyboardEvent): void {
    const keys = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const i = this.tabs.findIndex(t => t.id === this.tab());
    const back = event.key === 'ArrowLeft' || event.key === 'ArrowUp';
    const n = event.key === 'Home' ? 0 : event.key === 'End' ? this.tabs.length - 1
      : (i + (back ? -1 : 1) + this.tabs.length) % this.tabs.length;
    this.tab.set(this.tabs[n].id);
    (event.currentTarget as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]')[n]?.focus();
  }

  readonly latinName = computed(() => { const id = this.t()?.id ?? ''; return LATIN_NAME[id] ?? id.charAt(0).toUpperCase() + id.slice(1); });
  readonly classIcon = computed(() => GENERATED_ICONS['class-' + (this.t()?.cls ?? '')]);
  readonly expRound = computed(() => Math.floor(this.expPct()));
  readonly expPct = computed(() => { const p = this.progress(); return !p ? 0 : p.state === 'MAX' ? 100 : this.pct(p.exp, p.expToNext); });

  /** roster strip: the current hero first (left), then the next heroes in roster order (wraps), up to 7 */
  readonly strip = computed(() => {
    const list = this.save.state().heroes;
    const i = list.findIndex(h => h.uid === this.uid());
    if (i < 0) return [];
    const n = Math.min(7, list.length);
    return Array.from({ length: n }, (_, k) => list[(i + k) % list.length]).map(h => {
      const t = this.roster.template(h);
      return { uid: h.uid, name: t?.name ?? '', portrait: heroArt(t?.id)?.portrait };
    });
  });

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
    if (used) this.levelFx.set({ key: Date.now(), kind: 'level' });
  }
  useMax() { this.roster.usePotionsToCap(this.uid()); this.say('ใช้ยาจนถึงเพดานเลเวลแล้ว'); this.levelFx.set({ key: Date.now(), kind: 'level' }); }
  breakthrough() {
    const err = this.roster.breakthrough(this.uid());
    this.say(err === 'NEED_ITEMS' ? 'หิน Breakthrough ไม่พอ' : err === 'NEED_EXP' ? 'EXP ยังไม่ครบ' : err ? 'ทำไม่ได้' : 'Breakthrough สำเร็จ! เพดานเลเวลเพิ่มขึ้น', !err);
    if (!err) this.levelFx.set({ key: Date.now(), kind: 'breakthrough' });
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
  go(uid: number) { this.message.set(null); this.skillSel.set(0); this.router.navigate(['/heroes', uid]); }
}

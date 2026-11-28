import { HeroStarsComponent } from '../../shared/hero-stars.component';
import { Component, computed, HostListener, inject, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { BreakpointObserver } from '@angular/cdk/layout';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DEV_FLAGS } from '../../core/data/dev-flags';
import { ASCENSION_DAY_LABEL, ascensionBossFor, ascensionSelection, DAILY_BONUS, FARM_DUNGEONS, ITEMS } from '../../core/data/economy';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { HERO_BY_ID } from '../../core/data/heroes';
import { heroArt } from '../../core/data/hero-art';
import { RARITY_NAME } from '../../core/data/equipment';
import { wavesOf } from '../../core/models/stage';
import { EquipmentInstance } from '../../core/models/equipment';
import { MonsterRank, MonsterSkillDefinition } from '../../core/models/monster';
import { SweepRun } from '../../core/rules/rewards';
import { TowerLayout } from '../tower/tower-layout';
import { CollectionHeaderComponent } from '../heroes/collection-header.component';
import { EquipmentArtComponent } from '../../shared/equipment-art.component';
import { ASCENSION_BOSSES, DUNGEON_MONSTERS } from '../../core/data/monsters-dungeon';
import { HuntTarget } from '../../core/models/equipment';
import { FarmDungeonDefinition } from '../../core/models/economy';
import { EquipmentService } from '../../core/services/equipment.service';
import { ProgressionService } from '../../core/services/progression.service';
import { SaveService } from '../../core/services/save.service';
import { TowerOrnamentComponent } from '../tower/tower-ornament.component';
import { TowerMonsterComponent } from '../tower/tower-monster.component';
import { BACKGROUNDS } from '../../core/data/backgrounds';
import { IconComponent } from '../../shared/icon.component';
import { DungeonRewardIconComponent } from './dungeon-reward-icon.component';

/** one farm dungeon family = one menu (its own page, own mode) */
export interface DungeonType {
  id: string;
  pool: string;
  name: string;
  label: string;
  mode: string;
  icon: string;
  tone: string;
  blurb: string;
  rules: string[];
  reward: string;
}

export const DUNGEON_TYPES: DungeonType[] = [
  {
    id: 'training', pool: 'TRAINING', name: 'Training Ground', label: 'สนามฝึก', mode: 'ต้านคลื่น', icon: 'training', tone: 'survival',
    blurb: 'ศัตรูเดินเข้ามาไม่หยุด — ยืนให้รอดจนหมดเวลา ยิ่งล้มศัตรูได้มากยิ่งได้ดาวมาก',
    rules: ['ชนะเมื่อรอดครบเวลา', 'ดาวตามจำนวนที่ฆ่า (3★ ต้องไม่มีใครล้ม)', 'ฮีโร่ในช่องฝึกได้ EXP ส่วนแบ่ง'],
    reward: 'EXP ฮีโร่ + ยา EXP',
  },
  {
    id: 'ascension', pool: 'ASCENSION', name: 'Ascension Trial', label: 'บททดสอบเลื่อนขั้น', mode: 'ตีบอสเดี่ยว', icon: 'ascension', tone: 'boss_duel',
    blurb: 'ดวลผู้พิทักษ์ศาลเทพตัวเดียว (เลือกผู้พิทักษ์ได้ทุกวัน) ล้มให้ได้ก่อนมันคลั่ง — เกินเวลาแล้วบอสแรงขึ้นมาก',
    rules: ['บอสตัวเดียว เลือดหนา', 'ถึงเวลาที่กำหนดบอสจะคลั่ง', '3★ = ไม่มีใครล้ม + ทันเวลา'],
    reward: 'หิน Breakthrough',
  },
  {
    id: 'hunt', pool: 'HUNT', name: 'Equipment Hunt', label: 'ล่าอุปกรณ์', mode: 'ล่าสมบัติ', icon: 'hunt', tone: 'treasure',
    blurb: 'โคโบลด์ขนทองจะวิ่งหนีเมื่อถูกตีหรืออยู่นานเกิน (ใกล้ตายจะปาระเบิดควันวาร์ปหนี) — จับให้ได้ก่อนมันหลุดขอบสนาม',
    rules: ['ตัวที่จับได้เท่านั้นที่ดรอปอุปกรณ์', 'ตัวที่หนีไม่นับ แต่ไม่ทำให้แพ้', 'ดาวตามจำนวนที่จับได้'],
    reward: 'อุปกรณ์ + Ore + เศษอุปกรณ์',
  },
  {
    id: 'trial', pool: 'SKILL', name: 'Skill Trial', label: 'บททดสอบสกิล', mode: 'Echo Trial', icon: 'skillhall', tone: 'challenge',
    blurb: 'Hall of Reflection — เผชิญ Echo ของทีมที่จัดลงสนามในห้องเดียว เพื่อรับวัตถุดิบอัปเกรดสกิล',
    rules: ['Echo สะท้อนฮีโร่และตำแหน่งของทีมคุณ', 'ใช้โจมตีปกติ + สกิล 1/2 แต่ไม่มีอัลติเมต', 'ล้ม Echo ทั้งทีมในหนึ่งเวฟเพื่อรับ Skill Tome'],
    reward: 'Skill Tome',
  },
];

const RANK_ORDER: Record<MonsterRank, number> = { COMMON: 1, SPECIAL: 2, ELITE: 3, BOSS: 4, FINAL_BOSS: 5 };
const SKILL_KIND: Record<MonsterSkillDefinition['type'], string> = { ATTACK: 'attack', BUFF: 'buff', SUPPORT: 'buff', SUMMON: 'summon', MOVEMENT: 'move', SPECIAL: 'attack' };
/** Echo Trial has no monster skills of its own — the mirrored team's rules instead */
const ECHO_SKILLS = [
  { name: 'โจมตีปกติ', label: 'BASIC ATTACK', who: 'Echo ทีมคุณ', kind: 'attack', tag: 'สะท้อนทีม', tagKind: 'plain', timing: '', note: 'ยืนตำแหน่งเดียวกับทีมที่จัดไว้' },
  { name: 'สกิล 1 และ สกิล 2', label: 'SKILL 1 / 2', who: 'Echo ทีมคุณ', kind: 'attack', tag: 'สะท้อนทีม', tagKind: 'plain', timing: '', note: 'ใช้สกิลเดียวกับฮีโร่ของคุณ' },
  { name: 'ไม่มีอัลติเมต', label: 'NO ULTIMATE', who: 'Echo ทีมคุณ', kind: 'buff', tag: 'กติกา', tagKind: 'plain', timing: '', note: 'ล้ม Echo ทั้งทีมในหนึ่งเวฟเพื่อรับ Skill Tome' },
];
export interface SweepTile { id: string; name: string; count: string; lucky: boolean; kind: 'exp' | 'gold' | 'item' }
export interface SweepView { title: string; type: DungeonType; runs: { no: number; tiles: SweepTile[]; gear: EquipmentInstance[] }[]; total: SweepTile[]; gear: EquipmentInstance[]; carry: string; left: number }

/** Farm dungeons menu: one tab per dungeon type, each with its tiers (I–V) */
@Component({
  selector: 'app-dungeons',
  imports: [HeroStarsComponent, RouterLink, IconComponent, TowerOrnamentComponent, DungeonRewardIconComponent, CollectionHeaderComponent, TowerMonsterComponent, EquipmentArtComponent],
  templateUrl: './dungeons.component.html',
  styleUrls: ['./dungeons.component.scss', './dungeon-codex.scss'],
})
export class DungeonsComponent {
  private readonly save = inject(SaveService);
  private readonly prog = inject(ProgressionService);
  readonly eq = inject(EquipmentService);
  readonly types = DUNGEON_TYPES;
  private readonly param = toSignal(inject(ActivatedRoute).paramMap.pipe(map(p => p.get('type'))), { initialValue: null });
  readonly type = computed(() => DUNGEON_TYPES.find(t => t.id === this.param()) ?? DUNGEON_TYPES[0]);

  readonly cleared = computed(() => this.save.state().cleared);
  readonly farm = computed(() => this.save.state().farm);
  /** first-clear bonus already taken for this dungeon (no record yet = not taken) */
  firstClearDone(id: string): boolean {
    return !!(this.farm() as Partial<ReturnType<typeof this.farm>>)[id]?.firstClearDone;
  }
  readonly tiers = computed(() => FARM_DUNGEONS.filter(d => d.dailyBonusPool === this.type().pool));
  readonly unlockOf = (t: DungeonType) => Math.min(...FARM_DUNGEONS.filter(d => d.dailyBonusPool === t.pool).map(d => d.unlockFloor));
  readonly bonus = computed(() => {
    this.save.state();
    const left = this.prog.bonusLeft(this.type().pool);
    const max = DAILY_BONUS[this.type().pool] ?? 0;
    return { left, max, pips: Array.from({ length: max }, (_, i) => i < left) };
  });
  readonly leftOf = (t: DungeonType) => { this.save.state(); return this.prog.bonusLeft(t.pool); };

  readonly itemName = (id: string) => ITEMS[id]?.name ?? id;
  readonly pct = (x: number) => Math.round(x * 100);
  readonly sceneOf = (d: FarmDungeonDefinition) => '/' + (BACKGROUNDS[d.stage.background ?? 'forest-1'] ?? BACKGROUNDS['forest-1']).file;
  readonly itemIcon = (id: string) => id.startsWith('bt_') ? 'crystal' : id;
  readonly repeatPct = computed(() => this.pct(this.tiers()[0].repeatRewardMultiplier));
  readonly bonusMultiplier = computed(() => this.tiers()[0].dailyBonusMultiplier);
  readonly roman = (d: FarmDungeonDefinition) => d.name.split(' ').pop() ?? '';
  readonly open = (d: FarmDungeonDefinition) => this.cleared() >= d.unlockFloor;

  // Hunt: favoured drop slot
  readonly targets: HuntTarget[] = ['ANY', 'WEAPON', 'ARMOR', 'ACCESSORY'];
  readonly freeGuardians = DEV_FLAGS.ascensionFreeChoice;
  readonly selectedGuardian = signal(ascensionBossFor());
  /** Future calendar retained behind the temporary free-choice flag. */
  readonly guardians = ASCENSION_BOSSES.map(id => ({ id, name: DUNGEON_MONSTERS[id].name, days: DEV_FLAGS.ascensionFreeChoice ? 'ทุกวัน' : ASCENSION_DAY_LABEL[id] }));
  readonly targetLabel: Record<HuntTarget, string> = { ANY: 'ทุกช่อง', WEAPON: 'อาวุธ', ARMOR: 'เกราะ', ACCESSORY: 'เครื่องประดับ' };

  // ---------------------------------------------------------------- desktop Codex (design B) + sweep
  readonly desktop = inject(TowerLayout).desktop;
  private readonly wide = toSignal(inject(BreakpointObserver).observe('(min-width: 1280px)').pipe(map(x => x.matches)), { initialValue: false });
  /** banner sprites: full size on wide screens, smaller in the 1024–1279 middle column */
  readonly foeHeight = computed(() => (this.wide() ? 168 : 118));
  readonly rarityName = RARITY_NAME;
  readonly bestOf = (id: string) => this.farm()[id]?.bestRating ?? 0;
  /** highest open tier with 3★ (sweepable once today's runs are left) */
  private readonly sweepTierOf = (t: DungeonType) => {
    this.save.state();
    return [...FARM_DUNGEONS.filter(d => d.dailyBonusPool === t.pool)].reverse().find(d => this.open(d) && this.bestOf(d.id) >= 3) ?? null;
  };
  readonly rail = computed(() => DUNGEON_TYPES.map(t => {
    const left = this.leftOf(t), max = DAILY_BONUS[t.pool] ?? 0, sw = this.sweepTierOf(t);
    return { t, left, max, pips: Array.from({ length: max }, (_, i) => i < left), locked: this.cleared() < this.unlockOf(t), upTo: sw && left > 0 ? this.roman(sw) : null };
  }));
  /** the selected tier — on entering a dungeon: the highest sweepable tier, else the highest open one */
  readonly pickedId = linkedSignal(() => {
    const t = this.type(), tiers = FARM_DUNGEONS.filter(d => d.dailyBonusPool === t.pool);
    return (this.sweepTierOf(t) ?? [...tiers].reverse().find(d => this.open(d)) ?? tiers[0]).id;
  });
  readonly picked = computed(() => this.tiers().find(d => d.id === this.pickedId()) ?? this.tiers()[0]);
  readonly stage = computed(() => {
    const d = this.picked();
    return this.type().id === 'ascension' ? ascensionSelection(Number(d.id.split('_')[1]), this.selectedGuardian()) : d.stage;
  });
  readonly echo = computed(() => this.type().id === 'trial');
  readonly squad = computed(() => this.save.state().team.map(slot => this.save.state().heroes.find(h => h.uid === slot.uid)).filter(h => !!h)
    .map(h => ({ uid: h!.uid, name: HERO_BY_ID[h!.templateId]?.name ?? h!.templateId, portrait: '/' + (heroArt(h!.templateId)?.portrait ?? 'portraits/' + h!.templateId + '.webp') })));
  /** the stage's distinct monsters, strongest first */
  private readonly monsters = computed(() => {
    const ids = new Set<string>();
    for (const w of wavesOf(this.stage())) for (const sp of [...w.spawns, ...(w.reinforcements ?? []).flatMap(r => r.spawns)]) if (MONSTERS[sp.monsterId]) ids.add(sp.monsterId);
    return [...ids].sort((a, b) => RANK_ORDER[MONSTERS[b].rank] - RANK_ORDER[MONSTERS[a].rank]);
  });
  readonly foes = computed(() => this.monsters().slice(0, 3).map(id => ({ id, name: MONSTERS[id].name })));
  readonly skills = computed(() => {
    if (this.echo()) return ECHO_SKILLS;
    const seen = new Set<string>(), out = [];
    for (const id of this.monsters()) for (const sk of MONSTERS[id].skills ?? []) {
      const def = MONSTER_SKILLS[sk];
      if (!def || seen.has(def.name)) continue;
      seen.add(def.name);
      const tag = def.breakRequired ? 'ต้องเบรก' : def.interruptible ? 'ขัดได้' : 'ขัดไม่ได้';
      out.push({ name: def.name, label: def.label, who: MONSTERS[id].name, kind: SKILL_KIND[def.type] ?? 'attack', tag,
        tagKind: def.breakRequired ? 'break' : def.interruptible ? 'stop' : 'plain', timing: def.castTime ? `ร่าย ${def.castTime} วิ · คูลดาวน์ ${def.cooldown} วิ` : `คูลดาวน์ ${def.cooldown} วิ`, note: '' });
    }
    return out.slice(0, 6);
  });
  readonly emblemPos: Record<string, string> = { training: '0 0', ascension: '100% 0', hunt: '0 100%', trial: '100% 100%' };

  // sweep
  readonly sweepMax = computed(() => { this.save.state(); return this.prog.sweepable(this.picked().id); });
  readonly sweepPick = linkedSignal(() => this.sweepMax());
  readonly sweepN = computed(() => Math.min(Math.max(1, this.sweepPick()), this.sweepMax()));
  readonly sweepWhy = computed(() => {
    const d = this.picked();
    if (!this.open(d)) return `ปลดล็อกเมื่อผ่านหอคอยชั้น ${d.unlockFloor}`;
    if (this.bonus().left === 0) return 'ใช้รอบวันนี้ครบแล้ว · พรุ่งนี้กวาดได้ใหม่';
    return 'ผ่านระดับนี้ 3★ ก่อนจึงกวาดได้';
  });
  /** what the chosen number of runs gives before random drops (amounts × daily bonus) */
  readonly sweepPreview = computed((): SweepTile[] => {
    const d = this.picked(), k = d.dailyBonusMultiplier * this.sweepN(), r = d.baseRewards, out: SweepTile[] = [];
    const fmt = (x: number) => (x >= 10 ? String(Math.round(x)) : String(Math.round(x * 10) / 10));
    if (r.heroExp) out.push({ id: 'exp', name: 'EXP ฮีโร่', count: '+' + fmt(r.heroExp * k), lucky: false, kind: 'exp' });
    for (const it of r.items ?? []) out.push({ id: it.itemId, name: this.itemName(it.itemId), count: '×' + fmt(it.count * k), lucky: false, kind: 'item' });
    if (r.gold) out.push({ id: 'gold', name: 'ทอง', count: '+' + fmt(r.gold * k), lucky: false, kind: 'gold' });
    return out;
  });
  stepSweep(delta: number): void { this.sweepPick.set(Math.min(this.sweepMax(), Math.max(1, this.sweepN() + delta))); }
  readonly sweepResult = signal<SweepView | null>(null);

  sweep(): void {
    const d = this.picked(), n = this.sweepN();
    if (this.sweepMax() < 1) return;
    const before = this.save.state().inventory;
    const runs = this.prog.sweepFarm(d.id, n);
    if (runs.length) this.sweepResult.set(this.sweepView(d, runs, before));
  }
  /** mobile list: sweep all of today's runs of one tier */
  sweepTier(d: FarmDungeonDefinition): void { this.pickedId.set(d.id); this.sweepPick.set(this.prog.sweepable(d.id)); this.sweep(); }
  readonly canSweepTier = (d: FarmDungeonDefinition) => { this.save.state(); return this.prog.sweepable(d.id) > 0; };
  closeSweep(): void { this.sweepResult.set(null); }
  @HostListener('document:keydown.escape') onEscape(): void { this.closeSweep(); }

  private sweepView(d: FarmDungeonDefinition, runs: SweepRun[], before: Record<string, number>): SweepView {
    const tiles = (gained: Record<string, number>, exp: number, gold: number, lucky: string[]): SweepTile[] => [
      ...(exp > 0 ? [{ id: 'exp', name: 'EXP ฮีโร่', count: '+' + exp, lucky: false, kind: 'exp' as const }] : []),
      ...Object.entries(gained).map(([id, n]) => ({ id, name: this.itemName(id), count: '×' + n, lucky: lucky.includes(id), kind: 'item' as const })),
      ...(gold > 0 ? [{ id: 'gold', name: 'ทอง', count: '+' + gold, lucky: false, kind: 'gold' as const }] : []),
    ];
    // the total is the bag difference (fragments that combined in a later run count once, as the stone)
    const after = this.save.state().inventory, sum: Record<string, number> = {};
    for (const [id, v] of Object.entries(after)) if (v - (before[id] ?? 0) > 0) sum[id] = v - (before[id] ?? 0);
    const exp = runs.reduce((n, r) => n + r.breakdown.final.heroExp, 0), gold = runs.reduce((n, r) => n + r.breakdown.final.gold, 0);
    const ids = new Set((d.baseRewards.items ?? []).flatMap(it => [it.itemId, ITEMS[it.itemId]?.fragmentId].filter((x): x is string => !!x)));
    const carry = Object.entries(this.save.state().rewardCarry).filter(([id, v]) => ids.has(id) && v > 1e-6).map(([id, v]) => `${this.itemName(id)} ${Math.round(v * 100) / 100}`).join(' · ');
    const t = this.type();
    return {
      title: `${t.label} ${this.roman(d)}`, type: t,
      runs: runs.map((r, i) => ({ no: i + 1, tiles: tiles(r.gained, r.breakdown.final.heroExp, r.breakdown.final.gold, r.lucky), gear: r.breakdown.equipment ?? [] })),
      total: tiles(sum, exp, gold, []), gear: runs.flatMap(r => r.breakdown.equipment ?? []), carry, left: this.prog.bonusLeft(t.pool),
    };
  }
}

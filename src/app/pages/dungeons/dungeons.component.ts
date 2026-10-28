import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DEV_FLAGS } from '../../core/data/dev-flags';
import { ASCENSION_DAY_LABEL, ascensionBossFor, DAILY_BONUS, FARM_DUNGEONS, ITEMS } from '../../core/data/economy';
import { ASCENSION_BOSSES, DUNGEON_MONSTERS } from '../../core/data/monsters-dungeon';
import { HuntTarget } from '../../core/models/equipment';
import { FarmDungeonDefinition } from '../../core/models/economy';
import { EquipmentService } from '../../core/services/equipment.service';
import { ProgressionService } from '../../core/services/progression.service';
import { SaveService } from '../../core/services/save.service';
import { TowerOrnamentComponent } from '../tower/tower-ornament.component';
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
    id: 'trial', pool: 'SKILL', name: 'Skill Trial', label: 'บททดสอบสกิล', mode: 'ภารกิจทดสอบ', icon: 'skillhall', tone: 'challenge',
    blurb: 'ด่านมีกฎเฉพาะ เช่น ห้ามปล่อยให้ศัตรูร่ายสำเร็จ หรือต้องล้มหมอผีให้ทัน — พลาดกฎ = ล้มเหลว',
    rules: ['อ่านเป้าหมายของแต่ละด่านก่อนลง', 'ใช้ท่าตัดร่าย / Break / โฟกัส', 'ดาวตามจำนวนครั้งที่พลาด'],
    reward: 'Skill Tome',
  },
];

/** Farm dungeons menu: one tab per dungeon type, each with its tiers (I–V) */
@Component({
  selector: 'app-dungeons',
  imports: [RouterLink, IconComponent, TowerOrnamentComponent, DungeonRewardIconComponent],
  templateUrl: './dungeons.component.html',
  styleUrl: './dungeons.component.scss',
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
}

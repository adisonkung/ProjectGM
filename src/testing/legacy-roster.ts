/**
 * TEST FIXTURE — the pre-remodel roster (removed from the game 2026-10, Bai Long is the only shipped hero).
 * The engine still supports every class mechanic (taunt, shields, heals, resurrection, poison, dives, interrupts …)
 * for the remodelled heroes to come; these specs keep exercising them through the old heroes. Importing this module
 * registers the old templates (sprite-less now: their sheets were deleted → token timing), their kits and the old
 * starter team into the live data tables. Never imported by app code.
 */
import { CLASS_KITS, HERO_DEFINITIONS } from '../app/core/data/hero-skills';
import { HERO_BY_ID, HEROES } from '../app/core/data/heroes';
import { STARTER_BENCH, STARTER_TEAM } from '../app/core/data/starter';
import { SKILL_PRIORITY_BY_HERO } from '../app/core/data/skill-ranks';
import { HeroDefinition, HeroKit, SkillDefinition } from '../app/core/models/combat';
import { HeroTemplate } from '../app/core/models/hero';

/** what the game ships (captured before the fixture adds the old roster) */
export const SHIPPED_HERO_IDS: readonly string[] = HEROES.map(h => h.id);
export const SHIPPED_STARTER_TEAM: readonly string[] = [...STARTER_TEAM];
export const SHIPPED_STARTER_BENCH: readonly string[] = [...STARTER_BENCH];

const { tank, fighter, assassin, archer, mage, healer } = CLASS_KITS;
const meleeAttack = fighter.attack;
const resurrection = (id: string, name: string, label: string): SkillDefinition => ({ ...healer.ult, id, name, label });
const rename = (k: HeroKit, names: [string, string, string]): HeroKit => ({
  ...k,
  skill: { ...k.skill, name: names[0] },
  skill2: { ...k.skill2, name: names[1] },
  ult: { ...k.ult, name: names[2] },
});

export const LEGACY_HEROES: HeroTemplate[] = [
  { id: 'bron',     name: 'บรอน',     cls: 'tank',    star: 1 },
  { id: 'tim',      name: 'ทิม',      cls: 'fighter', star: 1 },
  { id: 'lila',     name: 'ลิลา',     cls: 'archer',  star: 1 },
  { id: 'noa',      name: 'โนอา',     cls: 'mage',    star: 1 },
  { id: 'pin',      name: 'ปิ่น',      cls: 'healer',  star: 1 },
  { id: 'gorran',   name: 'กอร์แรน',  cls: 'tank',    star: 2 },
  { id: 'kaede',    name: 'คาเอเดะ',  cls: 'fighter', star: 2 },
  { id: 'wren',     name: 'เรน',      cls: 'archer',  star: 2 },
  { id: 'ossian',   name: 'ออสเซียน', cls: 'mage',    star: 2 },
  { id: 'mira',     name: 'มิรา',     cls: 'healer',  star: 2 },
  { id: 'heidel',   name: 'ไฮเดล',    cls: 'tank',    star: 3 },
  { id: 'saki',     name: 'ซากิ',     cls: 'fighter', star: 3 },
  { id: 'fey',      name: 'เฟย์',     cls: 'archer',  star: 3 },
  { id: 'lucian',   name: 'ลูเซียน',  cls: 'mage',    star: 3 },
  { id: 'valgas',   name: 'วัลกาส',   cls: 'tank',    star: 3 },
  { id: 'iria',     name: 'อิเรีย',   cls: 'archer',  star: 3 },
  { id: 'celine',   name: 'เซลีน',    cls: 'healer',  star: 3 },
  { id: 'jin',      name: 'จิน',      cls: 'fighter', star: 3 },
  { id: 'sylvie',   name: 'ซิลวี',    cls: 'archer',  star: 3 },
  { id: 'lumina',   name: 'ลูมิน่า',  cls: 'healer',  star: 3 },
  { id: 'aria',     name: 'อาเรีย',   cls: 'mage',    star: 3 },
  { id: 'shade',    name: 'เชด',      cls: 'assassin', star: 3 },
  { id: 'morgan',   name: 'โมร์แกน',  cls: 'tank',    star: 3 },
  { id: 'ragnar',   name: 'แร็กนาร์', cls: 'fighter', star: 3 },
  { id: 'corvin',   name: 'คอร์วิน',  cls: 'healer',  star: 3 },
  { id: 'nox',      name: 'น็อกซ์',   cls: 'assassin', star: 3 },
  { id: 'velma',    name: 'เวลมา',    cls: 'mage',    star: 3 },
  { id: 'aurel',    name: 'ออเรล',    cls: 'tank',    star: 3 },
];

export const LEGACY_DEFINITIONS: Record<string, HeroDefinition> = {
  // ออเรล — Dawn Bastion (3★ Tank): ตัวเลข Tank baseline ทั้งหมด (id / rank table เดิม) แค่ชื่อท่าตามอาร์ตชุดใหม่
  aurel: {
    id: 'aurel', cls: 'tank', identity: 'Tank · Taunt · Shield · Close-range Interrupt',
    kit: {
      ...tank,
      skill: { ...tank.skill, name: 'โล่กระแทก', label: 'Shield Bash' },
      skill2: { ...tank.skill2, name: 'พุ่งพิทักษ์', label: 'Guardian Rush' },
      ult: { ...tank.ult, name: 'ป้อมปราการรุ่งอรุณ', label: 'Bastion of Dawn' },
    },
  },
  morgan: {
    id: 'morgan', cls: 'tank', identity: 'Tank · Taunt · Shield · Close-range Interrupt (Aurel mechanics, dark visuals)',
    kit: rename(tank, ['ป้อมปราการมืด', 'โล่กระแทก', 'ระเบิดโล่ทมิฬ']),
  },
  jin: { id: 'jin', cls: 'fighter', identity: 'Formation Cleave · Multi-target Melee DPS', kit: fighter },
  ragnar: {
    id: 'ragnar', cls: 'fighter', identity: 'Bruiser · Frontline Pressure · Self Rampage',
    kit: {
      attack: meleeAttack,
      skill: {
        id: 'axe_storm', name: 'พายุขวาน', label: 'Axe Storm', slot: 'skill', cooldown: 5, target: 'CURRENT',
        effects: [
          { type: 'DAMAGE', area: 'FRONT_ARC', center: 'SELF', primary: 1.5, secondary: 1.5 },
          { type: 'APPLY_STATUS', status: 'axe_frenzy', to: 'SELF', minHits: 2 },
        ],
        ai: { tier: 'NORMAL' },
      },
      skill2: {
        id: 'blood_rage', name: 'โทสะเลือด', label: 'Blood Rage', slot: 'skill2', cooldown: 10, target: 'CURRENT',
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.5 },
          { type: 'APPLY_STATUS', status: 'blood_rage', to: 'SELF' },
        ],
        ai: { tier: 'NORMAL' },
      },
      ult: {
        id: 'lava_axe_crash', name: 'ขวานถล่มลาวา', label: 'Lava Axe Crash', slot: 'ult', range: 2, target: 'NEAREST_ENEMY',
        effects: [{ type: 'DAMAGE', area: 'LINE_3', primary: 2.4, secondary: 1.6 }],
        ai: { tier: 'NORMAL' },
      },
    },
  },
  shade: { id: 'shade', cls: 'assassin', identity: 'Priority Target · Poison · Guaranteed-Crit Execution', kit: assassin },
  nox: {
    id: 'nox', cls: 'assassin', identity: 'Backline Dive · Mobility · Low-HP Execution',
    kit: {
      attack: meleeAttack,
      skill: {
        id: 'vanish_into_shadow', name: 'หายวับในเงา', label: 'Vanish into Shadow', slot: 'skill', cooldown: 6, range: Infinity,
        target: 'FARTHEST_BACKROW', fallback: ['LOWEST_HP_ENEMY'], movement: { type: 'BLINK_BEHIND' },
        effects: [
          { type: 'DAMAGE', area: 'SINGLE', primary: 1.8 },
          { type: 'APPLY_STATUS', status: 'shadow_evasion', to: 'SELF' },
        ],
        ai: { tier: 'NORMAL' },
      },
      skill2: {
        id: 'ghost_dash', name: 'พุ่งผี', label: 'Ghost Dash', slot: 'skill2', cooldown: 12, target: 'CURRENT',
        movement: { type: 'DASH_THROUGH' },
        effects: [{ type: 'DAMAGE', area: 'LINE_2', primary: 1.7, secondary: 1.2 }],
        ai: { tier: 'NORMAL' },
      },
      ult: {
        id: 'soul_reap', name: 'เก็บเกี่ยววิญญาณ', label: 'Soul Reap', slot: 'ult', range: 4, target: 'LOWEST_HP_ENEMY',
        movement: { type: 'BLINK_BEHIND' },
        effects: [{ type: 'DAMAGE', area: 'SINGLE', primary: 3.2, executeBonus: { hpBelow: 0.35, mul: 1.35 } }],
        ai: { tier: 'NORMAL' },
      },
    },
  },
  sylvie: { id: 'sylvie', cls: 'archer', identity: 'Physical Ranged DPS · Projectiles · Long-range Interrupt', kit: archer },
  velma: { id: 'velma', cls: 'mage', identity: 'Magic AoE · Root / Movement Control · Burst', kit: mage },
  lumina: { id: 'lumina', cls: 'healer', identity: 'Burst Healing · Emergency Healing · Resurrection', kit: healer },
  corvin: {
    id: 'corvin', cls: 'healer', identity: 'Healing-over-Time · Poison Support · Resurrection',
    kit: {
      ...healer,
      skill: {
        id: 'healing_mist', name: 'หมอกเยียวยา', label: 'Healing Mist', slot: 'skill', cooldown: 8, target: 'SELF',
        effects: [
          { type: 'HEAL', area: 'RADIUS_2', center: 'SELF', atk: 0.7 },
          { type: 'APPLY_STATUS', status: 'healing_mist', to: 'AREA', area: 'RADIUS_2', center: 'SELF', team: 'ALLY' },
        ],
        // high priority when ≥ 2 allies are below 55%; also the emergency heal (skill 2 is offensive)
        ai: { tier: 'HEAL', allyHpBelow: 0.55, alliesBelowCount: 2, emergencyHpBelow: 0.35, countArea: 'RADIUS_2' },
      },
      skill2: {
        id: 'poison_cloud', name: 'เมฆพิษ', label: 'Poison Cloud', slot: 'skill2', cooldown: 15, target: 'CURRENT',
        effects: [
          { type: 'DAMAGE', area: 'ADJACENT_8', center: 'TARGET', primary: 1.1, secondary: 1.1, damageType: 'MAGIC' },
          { type: 'APPLY_STATUS', status: 'poison', to: 'HIT' },
        ],
        ai: { tier: 'NORMAL' },
      },
      ult: resurrection('spirit_wings', 'ปีกวิญญาณคืนชีพ', 'Spirit Wings Resurrection'),
    },
  },
};

if (!HERO_BY_ID['aurel']) {
  for (const t of LEGACY_HEROES) {
    HEROES.push(t);
    HERO_BY_ID[t.id] = t;
  }
  Object.assign(HERO_DEFINITIONS, LEGACY_DEFINITIONS);
  Object.assign(SKILL_PRIORITY_BY_HERO, {
    ragnar: { critical: 'skill', important: 'skill2', secondary: 'ult' },
    corvin: { critical: 'skill', important: 'ult', secondary: 'skill2' },
  });
  STARTER_TEAM.splice(0, STARTER_TEAM.length, 'aurel', 'jin', 'shade', 'sylvie', 'lumina');
  STARTER_BENCH.splice(0, STARTER_BENCH.length, 'morgan', 'ragnar', 'nox', 'velma', 'corvin', 'bailong');
}

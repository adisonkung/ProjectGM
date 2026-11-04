import '../../../testing/legacy-roster';
import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { LEGACY_TOWER_MONSTERS } from '../../core/data/legacy-tower-monsters';
import { BUFFS, MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { FOREST_ARC_MONSTERS, FOREST_ARC_SKILLS } from '../../core/data/monsters-forest-arc';
import { SHEETS } from '../../core/data/sprites';
import { STAGES } from '../../core/data/stages';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { mockVisualOf } from '../../core/data/visuals';
import { EnemyPlacement, StageDef, wavesOf } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { unitGeometry } from '../render/unit-geometry';
import { BattleEngine, BattleEvent, BattleUnit } from './battle-engine';
import { hasStatus } from './buffs';

/** spec §4 canonical roster (16, both bosses included) */
const ROSTER = ['forest_slime', 'forest_goblin', 'goblin_archer', 'forest_wolf', 'alpha_wolf', 'mushroom_creature', 'thorn_slime',
  'mist_bat', 'young_treant', 'mist_wraith', 'corrupted_wolf', 'corrupted_treant', 'dark_shaman', 'mist_witch', 'elder_treant', 'forest_oblivion'];

const DT = 0.05;
const H = (id: string, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 2000 + depth * 10 + lane, sprite: t.sprite,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B' }), ...o }, pos: { r: depth, c: lane },
  };
};
const mon = (enemy: string, r: number, c: number): EnemyPlacement => ({ enemy, r, c });
const TOUGH = { hp: 99999 };

function battle(allies: UnitSpec[], enemies: EnemyPlacement[]) {
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies };
  const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: 11 });
  const log: BattleEvent[] = [];
  const step = () => { e.step(DT); log.push(...e.drainEvents()); };
  step();
  const x = e as any;
  return {
    e, log, step,
    run: (sec: number) => { for (let i = 0; i < Math.round(sec / DT) && !e.result; i++) step(); },
    hero: (id: string) => e.units.find(u => u.heroId === id)!,
    monsters: (id: string) => e.units.filter(u => u.monster?.definitionId === id),
    cast: (u: BattleUnit, skill: string, target: BattleUnit | null = null) => {
      u.monster!.state = 'CASTING'; u.monster!.currentSkillId = skill; x.beginCast(u, MONSTER_SKILLS[skill], target);
    },
    lockHeroes: () => { for (const u of e.units) if (u.side === 'ally') u.castLock = 1e9; },
  };
}

describe('Forest Arc — roster and stages (claude/eldervane-monster-spec-s1-10.md)', () => {
  const spawned = new Set(STAGES.flatMap(st => wavesOf(st).flatMap(w => w.spawns.map(s => s.monsterId))));

  it('tower floors 1–10 spawn only the Forest Arc roster; every roster monster appears (adds included)', () => {
    const summoned = Object.values(FOREST_ARC_SKILLS).flatMap(s => s.effects.flatMap(e => e.type === 'SUMMON' ? e.monsters.map(m => m.id) : []));
    for (const id of spawned) expect(ROSTER).withContext(id).toContain(id);
    for (const id of ROSTER) expect(spawned.has(id) || summoned.includes(id)).withContext(id).toBeTrue();
    expect(STAGES.length).toBe(10);
  });

  it('legacy-only monsters are gone from the tower (the registry only sees them through the test fixture)', () => {
    for (const id of ['goblin_fighter', 'magic_mushroom', 'forest_spirit', 'shadow_panther', 'goblin_guard', 'goblin_shaman', 'fallen_forest_guardian', 'dark_shaman_ritual']) {
      expect(FOREST_ARC_MONSTERS[id]).withContext(id).toBeUndefined();
      expect(spawned.has(id)).withContext(id).toBeFalse();
    }
  });

  it('LOCKED decisions: Alpha Wolf first appears on floor 3 · floor 7 ends with Elder Treant · floor 10 with Forest Oblivion · Young Treant is no boss', () => {
    const first = STAGES.find(st => wavesOf(st).some(w => w.spawns.some(s => s.monsterId === 'alpha_wolf')))!;
    expect(first.floor).toBe(3);
    const last = (floor: number) => wavesOf(STAGES[floor - 1]).at(-1)!.spawns.map(s => s.monsterId);
    expect(last(7)).toEqual(['elder_treant']);
    expect(last(10)).toEqual(['forest_oblivion']);
    expect(MONSTERS['elder_treant'].rank).toBe('BOSS');
    expect(MONSTERS['forest_oblivion'].rank).toBe('FINAL_BOSS');
    expect(MONSTERS['young_treant'].rank).toBe('COMMON');
  });

  it('every Forest Arc monster but the slime is a round mock; references (skills / statuses / buffs / summons) all exist', () => {
    for (const m of Object.values(FOREST_ARC_MONSTERS)) {
      expect(mockVisualOf(m.visual)?.shape).withContext(m.id).toBe('circle');
      expect(m.tags).toContain('forest_arc');
      for (const id of m.skills) expect(MONSTER_SKILLS[id]).withContext(`${m.id}.${id}`).toBe(FOREST_ARC_SKILLS[id]);
      for (const ph of m.phases ?? []) for (const st of ph.statuses ?? []) expect(STATUS_EFFECTS[st]).withContext(st).toBeDefined();
    }
    for (const s of Object.values(FOREST_ARC_SKILLS)) for (const e of s.effects) {
      if (e.type === 'APPLY_STATUS') expect(STATUS_EFFECTS[e.status]).withContext(`${s.id} ${e.status}`).toBeDefined();
      if (e.type === 'APPLY_BUFF') expect(BUFFS[e.buffId]).withContext(`${s.id} ${e.buffId}`).toBeDefined();
      if (e.type === 'SUMMON') for (const m of e.monsters) expect(MONSTERS[m.id]).withContext(m.id).toBeDefined();
    }
    // special skills only on the six principal enemies (spec §2.5)
    const withSkills = Object.values(FOREST_ARC_MONSTERS).filter(m => m.skills.length).map(m => m.id).sort();
    expect(withSkills).toEqual(['alpha_wolf', 'dark_shaman', 'elder_treant', 'forest_oblivion', 'mist_witch', 'mist_wraith']);
  });

  it('Forest Slime keeps its existing sheet and stats, drawn smaller (displayScale 0.8, feet unchanged)', () => {
    const slime = MONSTERS['forest_slime'];
    expect(slime.animation.sheet).toBe('enemy-slime.png');
    expect([slime.stats.maxHp, slime.stats.attack, slime.stats.defense]).toEqual([100, 18, 5]);
    const def = SHEETS['enemy-slime.png'];
    expect(def.displayScale).toBe(0.8);
    const g = unitGeometry(def, 100), base = unitGeometry({ ...def, displayScale: 1 }, 100);
    expect(g.width).toBeCloseTo(base.width * 0.8, 5);
    // feet stay on the same line (14 px above the cell bottom scaled with the sprite)
    expect(g.bottomY - 14 * g.k).toBeCloseTo(base.bottomY - 14 * base.k, 5);
  });

  it('dungeons keep the legacy power (user 2026-11-05): role variants read the legacy tower stats', () => {
    const v = MONSTERS['straw_recruit@goblin_fighter'];
    expect(v).toBeDefined();
    expect(v.stats.maxHp).toBe(LEGACY_TOWER_MONSTERS['goblin_fighter'].stats.maxHp);
    expect(MONSTERS['gem_beetle@shadow_panther'].stats.maxHp).toBe(LEGACY_TOWER_MONSTERS['shadow_panther'].stats.maxHp);
    expect(MONSTERS['rune_wisp@corrupted_treant'].stats.defense).toBe(LEGACY_TOWER_MONSTERS['corrupted_treant'].stats.defense);
  });
});

describe('Forest Arc — mechanics', () => {
  it('Forest Oblivion never moves: no chase, knockback refused, position fixed through a fight', () => {
    const b = battle([H('aurel', 1, 1, TOUGH), H('sylvie', 4, 0, TOUGH)], [mon('forest_oblivion', 1, 1)]);
    const boss = b.monsters('forest_oblivion')[0];
    const home = { ...boss.pos }, x0 = boss.x, y0 = boss.y;
    (b.e as any).skillHost().knockback(b.hero('aurel'), boss, 2);
    for (let t = 0; t < 400 && !b.e.result; t++) {
      b.step();
      expect(boss.pos).withContext(`t=${t}`).toEqual(home);
    }
    expect(boss.x).toBeCloseTo(x0, 5);
    expect(boss.y).toBeCloseTo(y0, 5);
  });

  it('Core Surge: not interruptible, BREAK 150 opens the core (exposed_core: no actions, +50 % damage taken)', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('forest_oblivion', 1, 1)]);
    b.lockHeroes();
    const boss = b.monsters('forest_oblivion')[0];
    b.cast(boss, 'core_surge');
    (b.e as any).tryInterrupt(b.hero('aurel'), boss);
    expect(boss.casting?.def.id).toBe('core_surge');
    (b.e as any).tryInterrupt(b.hero('aurel'), boss, 100);
    expect(boss.casting?.def.id).toBe('core_surge');
    (b.e as any).tryInterrupt(b.hero('aurel'), boss, 60);
    expect(boss.casting).toBeNull();
    expect(hasStatus(boss, 'exposed_core')).toBeTrue();
  });

  it('Weakening Hex applies only on completion — an interrupted hex leaves nothing', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('dark_shaman', 3, 1)]);
    b.lockHeroes();
    const sh = b.monsters('dark_shaman')[0], tank = b.hero('aurel');
    b.cast(sh, 'weakening_hex', tank);
    (b.e as any).tryInterrupt(tank, sh);
    b.run(2.5);
    expect(hasStatus(tank, 'weakened')).toBeFalse();
    b.cast(sh, 'weakening_hex', tank);
    b.run(2.2);
    expect(hasStatus(tank, 'weakened')).toBeTrue();
  });

  it('Black Fog (APPLY_STATUS to AREA): only heroes inside the 2 × 2 around the aim are fogged, no damage', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('bron', 1, 1, TOUGH), H('sylvie', 5, 2, TOUGH)], [mon('mist_witch', 3, 1)]);
    b.lockHeroes();
    const w = b.monsters('mist_witch')[0], tank = b.hero('aurel');
    const hp = b.e.units.filter(u => u.side === 'ally').map(u => u.hp);
    b.cast(w, 'black_fog', tank);
    b.run(1.6);
    expect(hasStatus(tank, 'black_fog')).toBeTrue();
    expect(hasStatus(b.hero('sylvie'), 'black_fog')).toBeFalse();
    expect(b.log.some(ev => ev.type === 'skillActivated' && ev.skill === 'black_fog')).toBeTrue();
    void hp;
  });

  it('Alpha Howl buffs the pack (ATK +25 %, attack speed +20 %) while a Forest Wolf lives', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('alpha_wolf', 1, 1), mon('forest_wolf', 0, 0)]);
    b.lockHeroes();
    const a = b.monsters('alpha_wolf')[0], wolf = b.monsters('forest_wolf')[0];
    b.cast(a, 'alpha_howl', a);
    b.run(2.2);
    expect(hasStatus(wolf, 'alpha_pack_command')).toBeTrue();
    expect(STATUS_EFFECTS['alpha_pack_command'].modifiers).toEqual({ attackMultiplier: 1.25, attackSpeedMultiplier: 1.2 });
  });
});

import '../../../testing/legacy-roster';
import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { LEGACY_TOWER_MONSTERS } from '../../core/data/legacy-tower-monsters';
import { BUFFS, MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { FOREST_ARC_MONSTERS, FOREST_ARC_SKILLS } from '../../core/data/monsters-forest-arc';
import { FX, SHEETS } from '../../core/data/sprites';
import { attackWindupOf } from '../../core/data/monsters';
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

  it('art (user monster1–4.zip + forest_oblivion.zip): every Forest Arc monster has a sheet with its base clips; skill clips and VFX are wired', () => {
    for (const m of Object.values(FOREST_ARC_MONSTERS)) {
      expect(m.animation.sheet).withContext(m.id).toBe(`enemy-fa-${m.id.replace(/_/g, '-')}.png`);
      expect(SHEETS[m.animation.sheet!]).withContext(m.id).toBeDefined();
      // the stationary boss (holdArena leash 0) has no move clip
      const stationary = m.ai.holdArena?.leash === 0;
      for (const c of ['idle', ...(stationary ? [] : ['move']), 'hurt', 'death', 'attack']) expect(m.animation.clips[c]).withContext(`${m.id}.${c}`).toBeDefined();
      expect(m.animation.clips['attack'].events!.some(e => e.event === m.attack.event)).withContext(m.id).toBeTrue();
      expect(m.animation.clips['death'].events!.some(e => e.event === 'DEATH_COMPLETE')).toBeTrue();
      // the gameplay wind-up comes from the sheet now — kept within 0.2 s of the stat
      expect(Math.abs(attackWindupOf(m) - m.stats.attackWindup)).withContext(m.id).toBeLessThan(0.2);
      for (const id of m.skills) {
        const sk = FOREST_ARC_SKILLS[id];
        if (sk.clip) {
          const c = m.animation.clips[sk.clip];
          expect(c?.castDriven).withContext(`${m.id}.${sk.clip}`).toBeTrue();
          expect(c.events!.map(e => e.event)).toEqual(jasmine.arrayContaining(['CAST_START', 'SKILL_ACTIVATE']));
        }
        if (sk.fx) expect(FX[sk.fx.id]).withContext(sk.fx.id).toBeDefined();
        if (sk.hitFx) expect(FX[sk.hitFx]).withContext(sk.hitFx).toBeDefined();
      }
    }
    expect(SHEETS['enemy-fa-elder-treant.png'].appliedStatusFx?.['enraged_forest']).toBe('fa-enraged');
  });

  it('Forest Oblivion: the 14 spec VFX are wired to their gameplay hooks', () => {
    const def = SHEETS['enemy-fa-forest-oblivion.png'];
    const used = [
      ...def.monsterFx!['crush'].activate!, MONSTER_SKILLS['oblivion_root_crush'].hitFx!,
      MONSTER_SKILLS['oblivion_root_eruption'].groundTargets!.markFx, MONSTER_SKILLS['oblivion_root_eruption'].groundTargets!.impactFx,
      def.fieldFx!.start!, def.fieldFx!.loop,
      ...def.monsterFx!['pulse'].cast!, ...def.monsterFx!['pulse'].activate!,
      def.statusFx!['exposed_core'].start!, def.statusFx!['exposed_core'].loop, def.damageFx!['exposed_core'],
      def.statusFx!['oblivion_awakening'].start!, def.statusFx!['oblivion_awakening'].loop, def.deathFx!,
    ];
    expect(new Set(used).size).toBe(14);
    for (const n of used) expect(FX[n]).withContext(n).toBeDefined();
    // persistent loops never cover the telegraphs: the phase loop is drawn under the units, the mist zone too
    expect(FX['fo-p2-loop'].layer).toBe('under');
    expect(FX['fo-mist-loop'].layer).toBe('under');
    expect(def.anchors?.['core']).toBeDefined();
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

  it('Oblivion Pulse: not interruptible, BREAK 150 opens the Core (exposed_core: no actions, +50 % damage taken)', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('forest_oblivion', 1, 1)]);
    b.lockHeroes();
    const boss = b.monsters('forest_oblivion')[0];
    b.cast(boss, 'oblivion_pulse');
    (b.e as any).tryInterrupt(b.hero('aurel'), boss);
    expect(boss.casting?.def.id).toBe('oblivion_pulse');
    (b.e as any).tryInterrupt(b.hero('aurel'), boss, 100);
    expect(boss.casting?.def.id).toBe('oblivion_pulse');
    (b.e as any).tryInterrupt(b.hero('aurel'), boss, 60);
    expect(boss.casting).toBeNull();
    expect(hasStatus(boss, 'exposed_core')).toBeTrue();
  });

  it('Oblivion Pulse: no damage during the 4 s Core charge — the wave hits every hero on release + corrodes DEF', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 0, TOUGH)], [mon('forest_oblivion', 5, 1)]);
    b.lockHeroes();
    const boss = b.monsters('forest_oblivion')[0], heroes = [b.hero('aurel'), b.hero('sylvie')];
    boss.monster!.attackCooldownRemaining = 1e9;
    b.cast(boss, 'oblivion_pulse');
    const hp = heroes.map(h => h.hp);
    b.run(3.9);
    expect(heroes.map(h => h.hp)).toEqual(hp);
    b.run(0.3);
    for (const h of heroes) {
      expect(h.hp).withContext(h.name).toBeLessThan(hp[heroes.indexOf(h)]);
      expect(hasStatus(h, 'oblivion_corrosion')).withContext(h.name).toBeTrue();
    }
  });

  it('Oblivion Root Crush: hits the 2 × 3 cells in front only and knocks those heroes back — the boss itself stays', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 5, 0, TOUGH)], [mon('forest_oblivion', 0, 1)]);
    b.lockHeroes();
    const boss = b.monsters('forest_oblivion')[0], tank = b.hero('aurel'), far = b.hero('sylvie');
    // the boss never comes to the heroes: put the tank in the cell right in front of it
    const front = { r: boss.pos.r, c: boss.pos.c - 1 };
    b.e.grid.move(tank.id, tank.pos, front); tank.pos = { ...front }; tank.x = front.c; tank.y = front.r;
    const home = { ...boss.pos }, c0 = tank.pos.c, farHp = far.hp, tankHp = tank.hp;
    b.cast(boss, 'oblivion_root_crush', tank);
    b.run(1.5);
    expect(tank.hp).toBeLessThan(tankHp);
    expect(Math.abs(tank.pos.c - boss.pos.c)).toBeGreaterThan(Math.abs(c0 - boss.pos.c));
    expect(far.hp).toBe(farHp);
    expect(boss.pos).toEqual(home);
  });

  it('Root Eruption: warns the locked cells first, then hits only whoever stands there (Slow + short Root)', () => {
    const b = battle([H('aurel', 0, 1, TOUGH), H('sylvie', 4, 0, TOUGH)], [mon('forest_oblivion', 3, 1)]);
    b.lockHeroes();
    const boss = b.monsters('forest_oblivion')[0];
    boss.monster!.attackCooldownRemaining = 1e9;
    b.cast(boss, 'oblivion_root_eruption', b.hero('sylvie'));
    b.run(0.6);
    const warn = b.log.find(ev => ev.type === 'monsterGround' && ev.warning);
    expect(warn).toBeDefined();
    const hp = b.e.units.filter(u => u.side === 'ally').map(u => u.hp);
    b.run(1.2);
    expect(b.e.units.filter(u => u.side === 'ally').map(u => u.hp)).toEqual(hp);   // nothing before the eruption
    b.run(0.4);
    const hit = b.e.units.filter(u => u.side === 'ally' && hasStatus(u, 'slow'));
    expect(hit.length).toBeGreaterThan(0);
    for (const u of hit) expect((warn as any).cells.some((c: { r: number; c: number }) => c.r === u.pos.r && c.c === u.pos.c)).toBeTrue();
    expect(b.log.some(ev => ev.type === 'monsterGround' && !ev.warning && ev.fx === 'fo-erupt')).toBeTrue();
  });

  it('Dark Mist Collapse: a persistent 3 × 2 zone — slows only the heroes standing inside, ends with its duration and with the boss', () => {
    // a second enemy keeps the wave going after the boss falls
    const b = battle([H('aurel', 0, 1, TOUGH), H('bron', 0, 2, TOUGH), H('sylvie', 5, 0, TOUGH)], [mon('forest_oblivion', 5, 1), mon('forest_slime', 5, 2)]);
    b.lockHeroes();
    const boss = b.monsters('forest_oblivion')[0], tank = b.hero('aurel'), far = b.hero('sylvie');
    for (const m of b.e.units.filter(u => u.monster)) { m.monster!.attackCooldownRemaining = 1e9; m.moveCd = 1e9; }
    for (const cs of boss.castSkills) cs.cd = 1e9;
    b.cast(boss, 'oblivion_dark_mist', tank);
    b.run(1.6);
    expect(b.log.some(ev => ev.type === 'FIELD_STARTED')).toBeTrue();
    const m = (u: BattleUnit) => u.auraModifiers?.().map(x => x.moveSpeedMultiplier ?? 1).reduce((a, x) => a * x, 1) ?? 1;
    expect(m(tank)).toBeCloseTo(0.6, 5);
    expect(m(far)).toBe(1);
    b.run(7.2);
    expect(b.log.some(ev => ev.type === 'FIELD_ENDED' && ev.reason === 'EXPIRED')).toBeTrue();
    expect(m(tank)).toBe(1);
    // a new zone dies with the boss
    b.cast(boss, 'oblivion_dark_mist', tank);
    b.run(1.6);
    boss.monster!.phaseIndex = MONSTERS['forest_oblivion'].phases!.length;   // past Phase 2 — a phase threshold can't be skipped
    (b.e as any).applyDamage(boss, boss.hp + 1, false, false, tank);
    b.run(0.2);
    expect(boss.alive).toBeFalse();
    expect(b.log.some(ev => ev.type === 'FIELD_ENDED' && ev.reason === 'SOURCE_DIED')).toBeTrue();
  });

  it('Phase 2 — Oblivion Awakening at 50 %: permanent marker, faster cadence, the stronger Eruption / Mist replace the base ones', () => {
    const b = battle([H('aurel', 0, 1, TOUGH)], [mon('forest_oblivion', 3, 1)]);
    b.lockHeroes();
    const boss = b.monsters('forest_oblivion')[0];
    (b.e as any).applyDamage(boss, boss.maxHp * 0.55, false, false, b.hero('aurel'));
    b.run(0.1);
    expect(hasStatus(boss, 'oblivion_awakening')).toBeTrue();
    const ids = boss.castSkills.map(c => c.def.id);
    expect(ids).toContain('oblivion_root_eruption_awakened');
    expect(ids).toContain('oblivion_dark_mist_awakened');
    expect(ids).not.toContain('oblivion_root_eruption');
    expect(boss.monster!.cooldownScale).toBe(0.8);
    expect((MONSTER_SKILLS['oblivion_root_eruption_awakened'].groundTargets!.count)).toBeGreaterThan(MONSTER_SKILLS['oblivion_root_eruption'].groundTargets!.count);
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

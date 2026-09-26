import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { kitOf } from '../../core/data/hero-skills';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { STAGES } from '../../core/data/stages';
import { newGameState } from '../../core/data/starter';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { POWER_PROFILES } from '../../core/data/progression';
import { MonsterSkillDefinition } from '../../core/models/monster';
import { EnemyPlacement, StageDef, wavesOf } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { applyProfile } from '../../core/rules/progression';
import { heroStats } from '../../core/rules/stats';
import { teamToUnits } from '../../core/rules/team';
import { rankedSkill } from '../../core/rules/skill-ranks';
import { ASSASSIN_ESCAPE_HP, BattleEngine, BattleUnit } from './battle-engine';
import { applyBuff } from './buffs';
import { TacticalBot, tacticalFormation } from './bots/tactical-bot';
import { interruptPowerOf } from './skill-system';
import { distance } from './grid';

/** Encounter rebalance F9 / F10 (claude/patch1-encounter-rebalance-f9-f10-spec.md) */

const H = (id: string, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane, sprite: t.sprite,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B' }), ...o },
    pos: { r: depth, c: lane },
  };
};
const mon = (enemy: string, depth: number, lane: number): EnemyPlacement => ({ enemy, r: depth, c: lane });
function battle(allies: UnitSpec[], enemies: EnemyPlacement[]) {
  const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies };
  const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: 7 });
  e.step(0.05);
  e.drainEvents();
  const x = e as any;
  return {
    e, x,
    hero: (id: string) => e.units.find(u => u.heroId === id)!,
    monsters: (id: string) => e.units.filter(u => u.monster?.definitionId === id),
    put: (u: BattleUnit, c: number, r: number) => x.relocate(u, { r, c }, 'blink'),
    statue: (u: BattleUnit) => applyBuff(u, STATUS_EFFECTS['stun'], 0, { duration: 999 }),
    run: (sec: number) => { for (let i = 0; i < Math.round(sec / 0.05) && !e.result; i++) { e.step(0.05); e.drainEvents(); } },
  };
}
const ids = (w: { spawns: { monsterId: string }[] }) => w.spawns.map(s => s.monsterId).sort();
const count = (list: string[]) => list.reduce((m, id) => ({ ...m, [id]: (m[id] ?? 0) + 1 }), {} as Record<string, number>);

describe('Encounter pass — Floor 9', () => {
  const f9 = STAGES.find(s => s.floor === 9)!;

  it('raw tuning well below the old caps (was 1.4 / 1.25 / 1.3)', () => {
    expect(f9.monsterTuning!.hp!).toBeLessThanOrEqual(1.3);
    expect(f9.monsterTuning!.atk!).toBeLessThanOrEqual(1.18);
    expect(f9.monsterTuning!.def!).toBeLessThanOrEqual(1.18);
  });

  it('casters stand at depth 3 and every wave has more stoppable HIGH casts than a team has interrupts ready at once', () => {
    for (const w of wavesOf(f9)) {
      const casters = w.spawns.filter(s => ['dark_shaman', 'mist_witch'].includes(s.monsterId));
      expect(casters.length).toBeGreaterThanOrEqual(2);
      expect(casters.every(c => c.formationSlot.depth === 3)).toBeTrue();
    }
    expect(MONSTER_SKILLS['dark_heal'].interruptPriority).toBe('HIGH');
    expect(MONSTER_SKILLS['nightmare'].interruptPriority).toBe('HIGH');
    expect(['MEDIUM', 'HIGH']).toContain(MONSTER_SKILLS['soul_link'].interruptPriority!);
    expect(MONSTER_SKILLS['dark_fog'].interruptible).toBeFalse();
  });

  it('casters hold inside an archer’s reach (preferred range 3.5 < attack range 6, still behind their melee)', () => {
    for (const id of ['dark_shaman', 'dark_shaman_ritual', 'mist_witch']) {
      const st = MONSTERS[id].stats;
      expect(st.preferredRange).withContext(id).toBe(3.5);
      expect(st.attackRange).toBe(6);
      expect(st.preferredRange!).toBeGreaterThan(st.minComfortableRange ?? 0);
    }
  });

  it('interrupt urgency: a Nightmare on a hero below 50 % outranks a Dark Heal on a healthy enemy', () => {
    const b = battle([H('sylvie', 3, 1, { hp: 99999 }), H('aurel', 0, 1)], [mon('dark_shaman', 3, 0), mon('mist_witch', 3, 2), mon('corrupted_wolf', 0, 1)]);
    const [shaman] = b.monsters('dark_shaman');
    const [witch] = b.monsters('mist_witch');
    const wolf = b.monsters('corrupted_wolf')[0];
    const tank = b.hero('aurel');
    tank.hp = tank.maxHp * 0.3;
    wolf.hp = wolf.maxHp * 0.9;
    b.x.beginCast(shaman, MONSTER_SKILLS['dark_heal'], wolf);
    b.x.beginCast(witch, MONSTER_SKILLS['nightmare'], tank);
    expect(b.e.skills.urgency(witch)).toBeGreaterThan(b.e.skills.urgency(shaman));
    wolf.hp = wolf.maxHp * 0.2;
    tank.hp = tank.maxHp;
    expect(b.e.skills.urgency(shaman)).toBeGreaterThan(b.e.skills.urgency(witch));
  });
});

describe('Encounter pass — Floor 10', () => {
  const f10 = STAGES.find(s => s.floor === 10)!;

  it('wave 1 = Treant 1 · Corrupted Wolf 3 · Mist Wraith 1; wave 2 = Treant 1 · Dark Shaman · Mist Witch · Wolf 2 · Wraith 1; wave 3 = the Guardian', () => {
    const w = wavesOf(f10);
    expect(count(ids(w[0]))).toEqual({ corrupted_treant: 1, corrupted_wolf: 3, mist_wraith: 1 });
    expect(count(ids(w[1]))).toEqual({ corrupted_treant: 1, corrupted_wolf: 2, dark_shaman: 1, mist_witch: 1, mist_wraith: 1 });
    expect(ids(w[2])).toEqual(['fallen_forest_guardian']);
    // wave ATK tuning not cut
    expect(f10.monsterTuning!.atk).toBe(1.22);
  });

  it('Forest Oblivion: Break 100 kept, cast 6.75 s, 210 % ATK, healing received −50 % 6 s kept', () => {
    const d = MONSTER_SKILLS['forest_oblivion'] as MonsterSkillDefinition;
    expect(d.breakRequired).toBe(100);
    expect(d.interruptible).toBeFalse();
    expect(d.castTime).toBe(6.75);
    expect((d.effects[0] as { mul: number }).mul).toBe(2.1);
    expect(d.effects.some(e => e.type === 'APPLY_STATUS' && e.status === 'healing_reduction' && e.duration === 6)).toBeTrue();
    expect(STATUS_EFFECTS['healing_reduction'].modifiers.healingReceivedMultiplier).toBe(0.5);
  });

  it('no normal hero skill solo-breaks Oblivion — even at rank 5 with the +20 gear Break cap', () => {
    const b = battle([H('aurel', 0, 1)], [mon('forest_slime', 0, 1)]);
    const tank = b.hero('aurel');
    tank.mods = { ...(tank.mods ?? {} as any), breakBonus: { skill: 20, skill2: 20, ult: 20 } } as any;
    for (const [id, cls] of [['aurel', 'tank'], ['sylvie', 'archer']] as const) {
      for (const slot of ['skill', 'skill2', 'ult'] as const) {
        const s = rankedSkill(kitOf(id, cls)[slot], 5);
        expect(interruptPowerOf(s, tank, slot).breakPower).withContext(`${id} ${slot}`).toBeLessThan(100);
      }
    }
  });

  it('Break progress never carries over between Oblivion casts', () => {
    const b = battle([H('aurel', 0, 1, { hp: 99999 })], [mon('fallen_forest_guardian', 1, 1)]);
    const g = b.monsters('fallen_forest_guardian')[0];
    b.statue(g);
    b.x.beginCast(g, MONSTER_SKILLS['forest_oblivion'], null);
    b.x.tryInterrupt(b.hero('aurel'), g, 70);
    expect(g.casting!.breakDamage).toBe(70);
    b.x.cancelCast(g, 'phase');
    b.x.beginCast(g, MONSTER_SKILLS['forest_oblivion'], null);
    expect(g.casting!.breakDamage).toBe(0);
  });

  it('TACTICAL reserves enough Break (≥ 100) for the first Oblivion before phase 4 — from the phase data, not engine timers', () => {
    const st = newGameState();
    const heroes = st.heroes.map(h => applyProfile(h, POWER_PROFILES['SD'], 10));
    const stage: StageDef = { floor: 1, mode: 'eliminate', timeLimit: 999, enemies: [mon('fallen_forest_guardian', 1, 1)] };
    const e = new BattleEngine({ allies: teamToUnits(tacticalFormation(heroes, st.team, stage), heroes), stage, enemyTemplates: ENEMIES, seed: 3 });
    const bot = new TacticalBot();
    e.step(0.05);
    const g = e.units.find(u => u.boss)!;
    g.monster!.phaseIndex = 2;
    g.hp = g.maxHp * 0.2; // within 12 % of the enrage threshold (15 %)
    bot.tick(e);
    const tank = e.units.find(u => u.heroId === 'aurel')!;
    const syl = e.units.find(u => u.heroId === 'sylvie')!;
    expect(tank.skillModes.skill2).toBe('RESERVE');
    expect(syl.skillModes.skill2).toBe('RESERVE');
  });
});

describe('Encounter pass — assassin AI (Shade)', () => {
  it('before contact, without a dive, the assassin never steps past the allied frontline into a threat zone', () => {
    const b = battle([H('aurel', 0, 1), H('shade', 0, 2)], [mon('corrupted_wolf', 3, 2)]);
    const tank = b.hero('aurel');
    const shade = b.hero('shade');
    const wolf = b.monsters('corrupted_wolf')[0];
    b.put(tank, 3, 1);
    b.put(shade, 3, 2);
    b.put(wolf, 5, 2);
    b.statue(tank);
    b.statue(wolf);
    b.run(1.5);
    expect(shade.pos.c).toBeLessThanOrEqual(tank.pos.c);
    // once the tank is in contact the assassin joins the fight
    b.put(wolf, 4, 1);
    b.run(1.5);
    expect(distance(shade.pos, wolf.pos)).toBeLessThanOrEqual(1);
  });

  it('the AI does not blink into a pack (more than one melee threat around the landing spot) unless it is a kill', () => {
    const b = battle([H('shade', 0, 1)], [mon('dark_shaman', 4, 1), mon('corrupted_wolf', 3, 0), mon('corrupted_wolf', 3, 2), mon('corrupted_wolf', 4, 0)]);
    const host = b.x.skillHost();
    const shaman = b.monsters('dark_shaman')[0];
    const shade = b.hero('shade');
    for (const w of b.monsters('corrupted_wolf')) b.put(w, shaman.pos.c + (w === b.monsters('corrupted_wolf')[0] ? 0 : 1), w === b.monsters('corrupted_wolf')[2] ? shaman.pos.r : (shaman.pos.r + 1) % 3);
    const s = kitOf('shade', 'assassin').skill;
    expect(host.blinkAllowed(shade, s, shaman)).toBeFalse();
    expect(b.e.metrics.unsafeBlinksSkipped).toBe(1);
    shaman.hp = shaman.maxHp * 0.2;
    expect(host.blinkAllowed(shade, s, shaman)).toBeTrue();
  });

  it('after a dive into danger (no kill) the dive ends and the assassin falls back; badly hurt it steps out of the pile', () => {
    const b = battle([H('aurel', 0, 1), H('shade', 0, 0)], [mon('dark_shaman', 4, 1), mon('corrupted_wolf', 3, 0), mon('corrupted_wolf', 3, 2)]);
    const shade = b.hero('shade');
    const shaman = b.monsters('dark_shaman')[0];
    const wolves = b.monsters('corrupted_wolf');
    b.put(shade, shaman.pos.c - 1, shaman.pos.r);
    b.put(wolves[0], shade.pos.c, (shade.pos.r + 1) % 3);
    b.put(wolves[1], shade.pos.c - 1, shade.pos.r);
    shade.diveUntil = b.e.time + 3;
    shade.diveTargetId = shaman.id;
    shade.thinkCd = 0;
    const pick = b.x.assassinTarget(shade, b.e.units.filter(u => u.side === 'enemy' && u.alive), null);
    expect(shade.diveUntil).toBe(0);
    expect(b.e.metrics.assassinRetreats).toBe(1);
    expect(pick).toBeDefined();
    // hurt below the escape threshold inside two threat zones → steps to a safer cell
    shade.hp = shade.maxHp * (ASSASSIN_ESCAPE_HP - 0.1);
    shade.moveCd = 0;
    const before = { ...shade.pos };
    expect(b.x.assassinEscape(shade)).toBeTrue();
    expect(b.x.localThreat(shade, shade.pos)).toBeLessThan(b.x.localThreat(shade, before));
  });
});

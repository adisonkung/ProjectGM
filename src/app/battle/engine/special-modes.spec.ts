import { FARM_BY_ID, FARM_DUNGEONS } from '../../core/data/economy';
import { HERO_BY_ID } from '../../core/data/heroes';
import { newGameState } from '../../core/data/starter';
import { EnemyPlacement, StageDef, StageModeRules } from '../../core/models/stage';
import { UnitSpec } from '../../core/models/unit';
import { clearRating, completeFarmRun } from '../../core/rules/rewards';
import { heroStats } from '../../core/rules/stats';
import { migrate } from '../../core/services/save.service';
import { createBattle, modeStatus, outcomeOf } from '../battle-session';
import { BattleEvent } from './battle-engine';
import { hasStatus } from './buffs';
import { ModeScore } from './stage/types';

/** Phase 3: farm dungeons as special modes (SURVIVAL / BOSS DUEL / TREASURE / CHALLENGE) + no injuries */

const DT = 0.05;
type Ev = BattleEvent & { t: number };

const H = (id: string, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => {
  const t = HERO_BY_ID[id];
  return {
    name: t.name, cls: t.cls, heroId: id, heroUid: 1000 + depth * 10 + lane,
    stats: { ...heroStats(t, { uid: 0, templateId: id, level: 1, potential: 'B' }), ...o },
    pos: { r: depth, c: lane },
  };
};
const mon = (enemy: string, depth: number, lane: number): EnemyPlacement => ({ enemy, r: depth, c: lane });

function session(stage: StageDef, allies: UnitSpec[]) {
  const e = createBattle({ allies, stage, seed: 5 });
  const log: Ev[] = [];
  const run = (sec: number, each?: () => void) => {
    for (let i = 0; i < Math.round(sec / DT) && !e.result; i++) {
      e.step(DT);
      for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
      each?.();
    }
  };
  const of = <T extends BattleEvent['type']>(type: T) => log.filter(x => x.type === type) as (Ev & Extract<BattleEvent, { type: T }>)[];
  return { e, log, run, of };
}

const stageWith = (special: StageModeRules, enemies: EnemyPlacement[], extra: Partial<StageDef> = {}): StageDef => ({
  floor: 0, id: 'test', mode: 'eliminate', timeLimit: 300, enemies, special, ...extra,
});

describe('Special stage modes (farm dungeons)', () => {
  it('SURVIVAL: the horde keeps walking in (never above maxAlive), kills are counted, surviving the timer wins', () => {
    const stage = stageWith(
      { kind: 'SURVIVAL', goal: 'test', horde: { every: 3, maxAlive: 4, groups: [[{ monsterId: 'forest_slime', formationSlot: { depth: 1, lane: 1 } }]] }, killStars: [3, 6] },
      [mon('forest_slime', 0, 1)], { mode: 'survive', rulePreset: 'defense', timeLimit: 20 },
    );
    const s = session(stage, [H('aurel', 0, 1), H('sylvie', 3, 1)]);
    let maxAlive = 0;
    s.run(30, () => (maxAlive = Math.max(maxAlive, s.e.units.filter(u => u.side !== 'ally' && u.alive).length)));
    expect(s.e.result).toBe('win');
    expect(maxAlive).toBeLessThanOrEqual(4);
    const r = s.e.stageResult!;
    expect(r.mode!.kind).toBe('SURVIVAL');
    expect(r.mode!.kills).toBeGreaterThan(3);
    expect(s.of('spawn').length).toBeGreaterThan(3);
  });

  it('BOSS DUEL: the boss enrages (duel_enrage) at the soft limit instead of the run timing out', () => {
    const stage = stageWith({ kind: 'BOSS_DUEL', goal: 'test', enrage: { at: 3, status: 'duel_enrage' } }, [mon('stone_sentinel', 1, 1)], { rulePreset: 'arena' });
    const s = session(stage, [H('aurel', 0, 1, { hp: 99999 })]);
    s.run(2.5);
    const boss = s.e.units.find(u => u.monster?.definitionId === 'stone_sentinel')!;
    expect(hasStatus(boss, 'duel_enrage')).toBeFalse();
    s.run(1);
    expect(hasStatus(boss, 'duel_enrage')).toBeTrue();
    expect(s.of('BOSS_ENRAGED').length).toBe(1);
    expect(modeStatus(s.e)!.line).toContain('คลั่ง');
  });

  it('TREASURE: a hit carrier runs for the edge and escapes — not a kill, not required for the wave clear', () => {
    const stage = stageWith({ kind: 'TREASURE', goal: 'test' }, [mon('treasure_goblin', 0, 1), mon('forest_slime', 0, 0)]);
    const s = session(stage, [H('aurel', 5, 0, { hp: 99999, atk: 1 })]);
    s.run(0.2);
    const carrier = s.e.units.find(u => u.monster?.definitionId === 'treasure_goblin')!;
    (s.e as any).applyDamage(carrier, 1, false);
    expect(carrier.monster!.fleeing).toBeFalse();
    s.run(0.2);
    expect(carrier.monster!.fleeing).toBeTrue();
    s.run(15);
    expect(s.of('TREASURE_ESCAPED').length).toBe(1);
    expect(carrier.alive).toBeFalse();
    expect(carrier.required).toBeFalse();
    const score = s.e.flow.score;
    expect([score.carriersTotal, score.carriersKilled, score.escaped]).toEqual([1, 0, 1]);
    expect(score.kills).toBe(0);
  });

  it('TREASURE: a carrier caught counts as a kill and a carrier', () => {
    const stage = stageWith({ kind: 'TREASURE', goal: 'test' }, [mon('treasure_goblin', 0, 1)]);
    const s = session(stage, [H('aurel', 0, 1)]);
    s.run(0.2);
    const carrier = s.e.units.find(u => u.monster?.definitionId === 'treasure_goblin')!;
    (s.e as any).applyDamage(carrier, carrier.hp + 1, false);
    s.run(1);
    expect(s.e.result).toBe('win');
    expect(s.e.stageResult!.mode!.carriersKilled).toBe(1);
  });

  it('CHALLENGE CAST_LIMIT: completed stoppable casts are strikes; one over the limit fails the stage with the rule label', () => {
    const stage = stageWith(
      { kind: 'CHALLENGE', goal: 'test', challenge: [{ type: 'CAST_LIMIT', max: 1, skills: ['alpha_howl'], label: 'HOWL x2' }] },
      [mon('alpha_wolf', 1, 1), mon('forest_wolf', 0, 0), mon('forest_wolf', 0, 2)],
    );
    const s = session(stage, [H('lumina', 5, 1, { hp: 99999, atk: 1 })]);
    s.run(40);
    expect(s.e.result).toBe('lose');
    expect(s.e.stageResult!.failReason).toBe('HOWL x2');
    expect(s.of('CHALLENGE_STRIKE').length).toBe(2);
    expect(outcomeOf(s.e).failReason).toBe('HOWL x2');
  });

  it('CHALLENGE KILL_BEFORE: a caster left alive too long fails the stage', () => {
    const stage = stageWith(
      { kind: 'CHALLENGE', goal: 'test', challenge: [{ type: 'KILL_BEFORE', monsterId: 'goblin_shaman', seconds: 4, label: 'shaman' }] },
      [mon('goblin_shaman', 4, 1)],
    );
    const s = session(stage, [H('aurel', 5, 0, { hp: 99999, atk: 1 })]);
    s.run(6);
    expect(s.e.result).toBe('lose');
    expect(s.e.stageResult!.failReason).toBe('shaman');
  });

  it('every farm dungeon is playable end to end (starter team, a few seconds) without runtime errors', () => {
    const st = newGameState();
    for (const d of FARM_DUNGEONS) {
      const e = createBattle({ allies: [H('aurel', 0, 1), H('sylvie', 3, 1)], stage: d.stage, seed: 1, autoUlt: true });
      expect(() => { for (let i = 0; i < 200 && !e.result; i++) e.step(DT); }).withContext(d.id).not.toThrow();
      expect(modeStatus(e)).withContext(d.id).not.toBeNull();
    }
    expect(st.heroes.length).toBeGreaterThan(0);
  });
});

describe('Special mode rewards', () => {
  const score = (o: Partial<ModeScore>): ModeScore => ({ kind: 'STORY', kills: 0, carriersKilled: 0, carriersTotal: 3, escaped: 0, strikes: 0, maxStrikes: 0, enraged: false, ...o });

  it('stars by mode: survival kills (3★ needs no death), carriers caught, challenge strikes, boss time', () => {
    const t = FARM_BY_ID['training_1'];
    const [a, b] = t.stage.special!.killStars!;
    expect(clearRating(t, { deaths: 0, time: 75, mode: score({ kind: 'SURVIVAL', kills: a - 1 }) })).toBe(1);
    expect(clearRating(t, { deaths: 0, time: 75, mode: score({ kind: 'SURVIVAL', kills: a }) })).toBe(2);
    expect(clearRating(t, { deaths: 1, time: 75, mode: score({ kind: 'SURVIVAL', kills: b }) })).toBe(2);
    expect(clearRating(t, { deaths: 0, time: 75, mode: score({ kind: 'SURVIVAL', kills: b }) })).toBe(3);
    const h = FARM_BY_ID['hunt_1'];
    expect([0, 1, 2, 3].map(n => clearRating(h, { deaths: 0, time: 1, mode: score({ kind: 'TREASURE', carriersKilled: n }) }))).toEqual([1, 1, 2, 3]);
    const c = FARM_BY_ID['trial_1'];
    const max = c.stage.special!.challenge![0].type === 'CAST_LIMIT' ? 1 : 0;
    expect(clearRating(c, { deaths: 0, time: 1, mode: score({ kind: 'CHALLENGE', strikes: 0, maxStrikes: max }) })).toBe(3);
    const a1 = FARM_BY_ID['ascension_1'];
    expect(clearRating(a1, { deaths: 0, time: a1.targetTime - 1, mode: score({ kind: 'BOSS_DUEL' }) })).toBe(3);
    expect(clearRating(a1, { deaths: 0, time: a1.targetTime + 1, mode: score({ kind: 'BOSS_DUEL' }) })).toBe(2);
  });

  it('TREASURE loot: one equipment roll per carrier caught (none caught = only the guaranteed first-clear item)', () => {
    const def = FARM_BY_ID['hunt_1'];
    const base = { ...newGameState(), cleared: 3, farm: { hunt_1: { clears: 1, firstClearDone: true, bestRating: 1 } } };
    const run = (n: number) => ({ win: true, deaths: 0, time: 80, participants: base.team.map(t => t.uid), mode: score({ kind: 'TREASURE', carriersKilled: n }) });
    const always = () => 0; // every roll succeeds
    const day = new Date(2026, 8, 26);
    expect(completeFarmRun(base, def, run(0), always, day).breakdown!.equipment!.length).toBe(0);
    expect(completeFarmRun(base, def, run(3), always, day).breakdown!.equipment!.length).toBe(3);
  });
});

describe('Injury system removed', () => {
  it('old saves lose the injury counter; every hero can be deployed', () => {
    const s = newGameState() as unknown as { version: number; heroes: Record<string, unknown>[] };
    s.heroes[0] = { ...s.heroes[0], injury: 2 };
    const m = migrate(s)!;
    expect('injury' in m.heroes[0]).toBeFalse();
  });
});

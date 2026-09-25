import { CLASS_BASE } from '../../../core/data/classes';
import { ENEMIES } from '../../../core/data/enemies';
import { BUFFS } from '../../../core/data/monsters';
import { HeroClass } from '../../../core/models/hero';
import { EnemyPlacement, StageDef, wavesOf } from '../../../core/models/stage';
import { UnitSpec } from '../../../core/models/unit';
import { BattleEngine, BattleEvent, BattleUnit } from '../battle-engine';
import { applyBuff, buffRemaining } from '../buffs';
import { BOARD_COLS, ENEMY_ZONE_START, toBoard } from '../grid';
import { StageBattleRules } from './rules';
import { BattlePhase, WaveTransitionMode } from './types';

// ------------------------------------------------------------------ harness

const DT = 0.05;
type Ev = BattleEvent & { t: number };

let uid = 100;
/** hero: pos = { r: depth (0 = front), c: lane } */
const hero = (name: string, cls: HeroClass, depth: number, lane: number, o: Partial<UnitSpec['stats']> = {}): UnitSpec => ({
  name, cls, heroUid: ++uid, heroId: name.toLowerCase(),
  stats: { ...CLASS_BASE[cls], hp: 5000, ...o },
  pos: { r: depth, c: lane },
});
const mon = (enemy: string, depth: number, lane: number): EnemyPlacement => ({ enemy, r: depth, c: lane });
const wave = () => [mon('forest_slime', 0, 1)];

const PARTY = () => [
  hero('Tank', 'tank', 0, 1),
  hero('Warrior', 'fighter', 0, 0),
  hero('Mage', 'mage', 3, 0),
  hero('Healer', 'healer', 4, 1),
  hero('Archer', 'archer', 3, 2),
];

function session(opts: { waves?: number; rules?: Partial<StageBattleRules>; allies?: UnitSpec[]; mode?: 'eliminate' | 'survive'; timeLimit?: number } = {}) {
  const n = opts.waves ?? 3;
  const stage: StageDef = {
    floor: 1, mode: opts.mode ?? 'eliminate', timeLimit: opts.timeLimit ?? 999,
    enemies: wave(), rounds: Array.from({ length: n - 1 }, wave),
  };
  const allies = opts.allies ?? PARTY();
  const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: 7, rules: opts.rules });
  const log: Ev[] = [];
  let frozen = false;
  const step = () => {
    // frozen heroes never act (castLock is reset by transitions, so re-apply every tick)
    if (frozen) e.units.filter(u => u.side === 'ally' && u.alive).forEach(u => (u.castLock = 1e9));
    e.step(DT);
    for (const ev of e.drainEvents()) log.push({ ...ev, t: e.time });
  };
  const run = (sec: number, each?: () => void) => {
    for (let i = 0; i < Math.round(sec / DT) && !e.result; i++) {
      step();
      each?.();
    }
  };
  const until = (cond: () => boolean, max = 30, each?: () => void) => {
    for (let t = 0; t < max && !cond() && !e.result; t += DT) {
      step();
      each?.();
    }
    return cond();
  };
  const h = (name: string) => e.units.find(u => u.side === 'ally' && u.name === name)!;
  const of = <T extends BattleEvent['type']>(type: T) => log.filter(x => x.type === type) as (Ev & Extract<BattleEvent, { type: T }>)[];
  const kill = (u: BattleUnit) => (e as any).applyDamage(u, u.hp + u.shield + 1, false);
  /** defeat every required enemy of the current wave */
  const clearWave = () => e.units.filter(u => u.side === 'enemy' && u.alive && u.wave === e.waveIndex).forEach(kill);
  const phaseIs = (p: BattlePhase) => () => e.phase === p;
  return { e, log, allies, run, until, h, of, kill, clearWave, phaseIs, freeze: () => (frozen = true), unfreeze: () => (frozen = false), step };
}

const anchorDist = (e: BattleEngine, u: BattleUnit) => {
  const a = e.formation.anchorOf(u.id)!;
  return Math.hypot(a.x - u.x, a.y - u.y);
};

// ------------------------------------------------------------------ core flow

describe('Stage / Wave / Transition flow', () => {
  it('1. a Stage can contain three Waves (generic WaveDefinitions)', () => {
    const s = session();
    expect(s.e.totalWaves).toBe(3);
    expect(wavesOf({ floor: 1, mode: 'eliminate', timeLimit: 1, enemies: wave(), rounds: [wave(), wave()] }).length).toBe(3);
    expect(s.e.phase).toBe(BattlePhase.PREPARATION);
    s.step();
    expect(s.of('STAGE_STARTED')[0].totalWaves).toBe(3);
    expect(s.e.phase).toBe(BattlePhase.COMBAT);
  });

  it('2. Wave 2 does not begin before Wave 1 is cleared', () => {
    const s = session();
    s.freeze();
    s.run(8);
    expect(s.e.waveIndex).toBe(0);
    expect(s.of('WAVE_STARTED').filter(w => w.wave === 1).length).toBe(0);
    s.clearWave();
    expect(s.until(() => s.e.waveIndex === 1)).toBeTrue();
  });

  it('3. the party advances after Wave Clear (and WAVE_CLEARED fires once)', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    s.clearWave();
    s.until(s.phaseIs(BattlePhase.ADVANCING));
    expect(s.of('WAVE_CLEARED').length).toBe(1);
    const clearT = s.of('WAVE_CLEARED')[0].t;
    const advT = s.of('ADVANCE_STARTED')[0].t;
    expect(advT - clearT).toBeCloseTo(s.e.rules.waveClearPause, 1);
  });

  it('4. the formation origin moves forward by advanceDistance', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    s.clearWave();
    s.until(() => s.of('ADVANCE_COMPLETED').length > 0);
    expect(s.of('ADVANCE_COMPLETED')[0].origin).toBe(4);
    expect(s.e.formation.originPosition).toBe(4);
    expect(s.e.cameraX).toBe(4);
  });

  it('5 + 7. living heroes follow the Advance without teleporting', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    s.clearWave();
    s.until(s.phaseIs(BattlePhase.ADVANCING));
    const x0 = new Map(s.e.units.filter(u => u.side === 'ally').map(u => [u.id, u.x]));
    let maxStep = 0;
    let prev = new Map(x0);
    s.until(() => s.e.phase !== BattlePhase.ADVANCING, 10, () => {
      for (const u of s.e.getAliveHeroes()) {
        maxStep = Math.max(maxStep, Math.abs(u.x - prev.get(u.id)!));
        prev.set(u.id, u.x);
      }
    });
    for (const u of s.e.getAliveHeroes()) expect(u.x - x0.get(u.id)!).toBeCloseTo(4, 5);
    expect(maxStep).toBeLessThan(0.25); // continuous: ≤ a quarter cell per 0.05 s tick
  });

  it('6. living heroes regroup around the NEW formation anchors', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    // pull a hero out of formation (as if it had chased an enemy)
    s.h('Warrior').x += 3;
    s.h('Warrior').y = 2;
    s.clearWave();
    s.until(() => s.of('REGROUP_COMPLETED').length > 0);
    const done = s.of('REGROUP_COMPLETED')[0];
    expect(done.timedOut).toBeFalse();
    for (const u of s.e.getAliveHeroes()) expect(anchorDist(s.e, u)).toBeLessThanOrEqual(s.e.rules.regroupTolerance + 1e-9);
    // anchor = moved origin + slot offset
    const a = s.e.formation.anchorOf(s.h('Warrior').id)!;
    expect(a.x).toBe(4 + toBoard('ally', { r: 0, c: 0 }).c);
  });

  it('8. the next Wave starts even if one hero cannot reach its anchor (maxRegroupDuration)', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    s.h('Mage').moveSpeed = 0; // stuck
    s.h('Mage').x -= 3;
    s.clearWave();
    s.until(() => s.e.waveIndex === 1, 20);
    const done = s.of('REGROUP_COMPLETED')[0];
    expect(done.timedOut).toBeTrue();
    expect(done.notReady).toEqual([s.h('Mage').id]);
    const start = s.of('REGROUP_STARTED')[0].t;
    expect(done.t - start).toBeLessThanOrEqual(s.e.rules.maxRegroupDuration + DT + 1e-6);
  });

  // ---------------------------------------------------------------- persistence

  const toNextWave = (s: ReturnType<typeof session>) => {
    s.freeze();
    s.run(0.5);
    s.h('Tank').hp = 3200;
    s.h('Warrior').hp = 2050;
    s.h('Healer').mana = 76;
    s.h('Archer').cd1 = 3.5;
    s.clearWave();
    s.until(() => s.of('WAVE_CLEARED').length > 0);
    const at = { t: s.e.time, tank: s.h('Tank').hp, war: s.h('Warrior').hp, mana: s.h('Healer').mana, cd: s.h('Archer').cd1 };
    s.until(() => s.e.waveIndex === 1);
    return at;
  };

  it('9 + 13. HP persists between Waves — no automatic recovery', () => {
    const s = session();
    const at = toNextWave(s);
    expect(s.h('Tank').hp).toBe(at.tank);
    expect(s.h('Warrior').hp).toBe(at.war);
  });

  it('10 + 12. the ultimate gauge persists and does not grow during the transition', () => {
    const s = session();
    const at = toNextWave(s);
    expect(s.h('Healer').mana).toBe(76);
    expect(at.mana).toBe(76);
    // even getting hit during a transition (e.g. environmental damage) adds no gauge
    const s2 = session();
    s2.freeze();
    s2.run(0.2);
    s2.clearWave();
    s2.until(s2.phaseIs(BattlePhase.ADVANCING));
    const m = s2.h('Tank').mana;
    (s2.e as any).applyDamage(s2.h('Tank'), 10, false);
    expect(s2.h('Tank').mana).toBe(m);
  });

  it('11. skill cooldowns keep counting down during the transition', () => {
    const s = session();
    const at = toNextWave(s);
    const elapsed = s.e.time - at.t;
    expect(elapsed).toBeGreaterThan(2);
    expect(s.h('Archer').cd1).toBeCloseTo(Math.max(-10, at.cd - elapsed), 5);
  });

  it('14. buff durations continue during the transition (unless pauseDuringWaveTransition)', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    const tank = s.h('Tank');
    s.clearWave();
    s.until(() => s.of('WAVE_CLEARED').length > 0);
    applyBuff(tank, { ...BUFFS['alpha_howl_buff'], duration: 30 }, tank.id);
    applyBuff(tank, { ...BUFFS['alpha_howl_buff'], id: 'paused', duration: 30, pauseDuringWaveTransition: true }, tank.id);
    const t0 = s.e.time;
    s.until(() => s.e.waveIndex === 1);
    const elapsed = s.e.time - t0;
    expect(buffRemaining(tank, 'alpha_howl_buff')).toBeCloseTo(30 - elapsed, 5);
    // paused one only ran during WAVE_START (combat-side time)
    expect(buffRemaining(tank, 'paused')).toBeGreaterThan(30 - elapsed + 1);
  });

  // ---------------------------------------------------------------- death

  it('15. hero death disables targeting and combat behaviour', () => {
    const s = session();
    s.run(1);
    const mage = s.h('Mage');
    mage.targetId = 99;
    s.kill(mage);
    expect(mage.life).toBe('DEAD_VISIBLE');
    expect(mage.alive).toBeFalse();
    expect(mage.targetable).toBeFalse();
    expect(mage.targetId).toBeNull();
    expect(mage.activity).toBe('DEAD');
    const slime = s.e.units.find(u => u.side === 'enemy')!;
    expect(s.e.isValidTarget(slime, mage)).toBeFalse();
    const since = s.e.time;
    s.run(3);
    expect(s.log.filter(x => x.t > since && 'src' in x && x.src === mage.id).length).toBe(0);
    expect(s.of('HERO_DIED').map(d => d.unit)).toEqual([mage.id]);
  });

  it('16 + 17. the corpse stays visible during its Wave, then is hidden after Wave Clear', () => {
    const s = session();
    s.freeze();
    s.run(0.3);
    const mage = s.h('Mage');
    s.kill(mage);
    s.run(1);
    expect(mage.visible).toBeTrue();
    expect(mage.life).toBe('DEAD_VISIBLE');
    s.clearWave();
    s.until(() => s.of('WAVE_CLEARED').length > 0);
    expect(mage.life).toBe('DEAD_VISIBLE'); // short clear beat: still the same wave
    s.until(s.phaseIs(BattlePhase.ADVANCING));
    expect(mage.life).toBe('DEAD_HIDDEN');
    expect(mage.visible).toBeFalse();
    expect(s.of('HERO_HIDDEN_AFTER_DEATH').map(x => x.unit)).toEqual([mage.id]);
  });

  it('18 + 19 + 20. a dead hero does not advance, regroup, or appear in the next Wave', () => {
    const s = session();
    s.freeze();
    s.run(0.3);
    const mage = s.h('Mage');
    s.kill(mage);
    const deathX = mage.x;
    s.h('Warrior').x -= 3;
    s.clearWave();
    s.until(s.phaseIs(BattlePhase.REGROUPING));
    expect(mage.x).toBe(deathX);
    expect(s.of('REGROUP_STARTED')[0].heroes).not.toContain(mage.id);
    s.until(() => s.e.phase === BattlePhase.COMBAT && s.e.waveIndex === 1);
    expect(mage.x).toBe(deathX);
    expect(mage.visible).toBeFalse();
    expect(s.e.getActiveBattlefieldHeroes().map(u => u.name).sort()).toEqual(['Archer', 'Healer', 'Tank', 'Warrior']);
    for (let c = 0; c < BOARD_COLS; c++) for (let r = 0; r < 3; r++) expect(s.e.grid.occupants({ r, c })).not.toContain(mage.id);
    // does not return automatically at Wave Start
    s.run(2);
    expect(mage.life).toBe('DEAD_HIDDEN');
  });

  it('21 + 22. the dead hero keeps its Formation Slot reserved; nobody is compressed into it', () => {
    const s = session();
    s.freeze();
    s.run(0.3);
    const mage = s.h('Mage');
    const before = s.e.formation.slots.map(x => ({ id: x.slotId, off: { ...x.localOffset }, who: x.assignedUnitId }));
    s.kill(mage);
    s.clearWave();
    s.until(() => s.e.waveIndex === 1);
    const slot = s.e.formation.slotOf(mage.id)!;
    expect(slot.assignedUnitId).toBe(mage.id);
    expect(slot.activeOccupant).toBeNull();
    expect(s.e.formation.slots.map(x => ({ id: x.slotId, off: x.localOffset, who: x.assignedUnitId }))).toEqual(before);
  });

  it('23. enemies cannot target a DEAD_HIDDEN hero', () => {
    const s = session();
    s.freeze();
    s.run(0.3);
    const mage = s.h('Mage');
    s.kill(mage);
    s.clearWave();
    s.until(() => s.e.phase === BattlePhase.COMBAT && s.e.waveIndex === 1);
    const targeted: (number | null)[] = [];
    s.run(4, () => s.e.units.filter(u => u.monster && u.alive).forEach(m => targeted.push(m.monster!.currentTargetId)));
    expect(targeted).not.toContain(mage.id);
    for (const m of s.e.units.filter(u => u.side === 'enemy')) expect(s.e.isValidTarget(m, mage)).toBeFalse();
    expect(s.log.filter(x => x.type === 'damage' && x.dst === mage.id && x.t > s.of('WAVE_CLEARED')[0].t).length).toBe(0);
  });

  it('24. the hidden dead hero remains in the Battle Session data', () => {
    const s = session();
    s.freeze();
    s.run(0.3);
    const mage = s.h('Mage');
    s.kill(mage);
    s.clearWave();
    s.until(() => s.e.waveIndex === 1);
    expect(s.e.units).toContain(mage);
    expect(s.e.getDeadHiddenHeroes()).toEqual([mage]);
    expect(s.e.getAllPartyHeroes().length).toBe(5);
    expect(mage.heroUid).toBeDefined();
    expect(mage.diedOnWave).toBe(0);
  });

  // ---------------------------------------------------------------- revive

  /** mage dies in wave 1, party moves on to wave 2 */
  const deadInWave2 = () => {
    const s = session();
    s.freeze();
    s.run(0.3);
    const mage = s.h('Mage');
    s.kill(mage);
    const deathX = mage.x;
    s.clearWave();
    s.until(() => s.e.phase === BattlePhase.COMBAT && s.e.waveIndex === 1);
    return { s, mage, deathX };
  };

  it('25 + 26 + 27. a DEAD_HIDDEN hero can be revived near its CURRENT anchor, not where it died', () => {
    const { s, mage, deathX } = deadInWave2();
    const res = s.e.reviveHero({ unitId: mage.id, sourceId: 'item:test' });
    expect(res).toEqual({ ok: true, hidden: true });
    expect(mage.life).toBe('REVIVING');
    expect(mage.visible).toBeTrue();
    expect(anchorDist(s.e, mage)).toBeLessThanOrEqual(s.e.rules.reviveSearchRadius * Math.SQRT2 + 1e-9);
    expect(Math.abs(mage.x - deathX)).toBeGreaterThanOrEqual(3);
    expect(s.e.grid.occupants(mage.pos)).toContain(mage.id);
    expect(s.e.formation.slotOf(mage.id)!.activeOccupant).toBe(mage.id);
    s.step();
    expect(s.of('HERO_REVIVE_STARTED')[0]).toEqual(jasmine.objectContaining({ unit: mage.id, fromHidden: true, sourceId: 'item:test' }));
  });

  it('28. the revived hero gets the configured HP percentage', () => {
    const { s, mage } = deadInWave2();
    s.e.reviveHero({ unitId: mage.id, sourceId: 'x' });
    expect(mage.hp).toBe(Math.round(mage.maxHp * 0.3));
    const b = deadInWave2();
    b.s.e.reviveHero({ unitId: b.mage.id, sourceId: 'x', reviveHpPercent: 0.5 });
    expect(b.mage.hp).toBe(Math.round(b.mage.maxHp * 0.5));
  });

  it('29 + 30. the revived hero becomes targetable after materialising and resumes auto combat', () => {
    const { s, mage } = deadInWave2();
    s.unfreeze();
    s.e.reviveHero({ unitId: mage.id, sourceId: 'x' });
    expect(mage.targetable).toBeFalse();
    const slime = s.e.units.find(u => u.side === 'enemy' && u.wave === 1)!;
    expect(s.e.isValidTarget(slime, mage)).toBeFalse();
    s.run(s.e.rules.reviveInvulnerabilityDuration + DT);
    expect(mage.life).toBe('ALIVE');
    expect(mage.targetable).toBeTrue();
    expect(s.e.isValidTarget(slime, mage)).toBeTrue();
    expect(s.of('HERO_REVIVED').map(x => x.unit)).toEqual([mage.id]);
    const since = s.e.time;
    s.until(() => s.log.some(x => x.t > since && (x.type === 'attack' || x.type === 'cast' || x.type === 'projectile') && 'src' in x && x.src === mage.id), 8);
    expect(s.log.some(x => x.t > since && 'src' in x && x.src === mage.id && (x.type === 'attack' || x.type === 'cast' || x.type === 'projectile'))).toBeTrue();
  });

  it('31. revive never creates a duplicate entity (second revive in the same tick is rejected)', () => {
    const { s, mage } = deadInWave2();
    const n = s.e.units.length;
    expect(s.e.reviveHero({ unitId: mage.id, sourceId: 'a' }).ok).toBeTrue();
    expect(s.e.reviveHero({ unitId: mage.id, sourceId: 'b' })).toEqual({ ok: false, reason: 'not-dead' });
    s.run(1);
    expect(s.e.units.length).toBe(n);
    expect(s.e.units.filter(u => u.name === 'Mage').length).toBe(1);
  });

  it('32. a revived hero can die again (full lifecycle repeats)', () => {
    const { s, mage } = deadInWave2();
    s.e.reviveHero({ unitId: mage.id, sourceId: 'x' });
    s.run(1);
    s.kill(mage);
    s.step();
    expect(mage.life).toBe('DEAD_VISIBLE');
    expect(mage.revivedCount).toBe(1);
    expect(s.of('HERO_DIED').filter(x => x.unit === mage.id).length).toBe(2);
    expect(s.e.reviveHero({ unitId: mage.id, sourceId: 'again' }).ok).toBeTrue();
    expect(mage.revivedCount).toBe(2);
  });

  // ---------------------------------------------------------------- stage end

  it('33. a party wipe fails the Stage (one death does not)', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    s.kill(s.h('Mage'));
    s.run(0.2);
    expect(s.e.phase).toBe(BattlePhase.COMBAT);
    for (const u of s.e.getAliveHeroes()) s.kill(u);
    s.run(0.1);
    expect(s.e.phase).toBe(BattlePhase.STAGE_FAILED);
    expect(s.e.result).toBe('lose');
    expect(s.of('STAGE_FAILED').length).toBe(1);
  });

  it('34 + 35. the final Wave clears the Stage and does not run an Advance', () => {
    const s = session();
    s.freeze();
    for (let w = 0; w < 3; w++) {
      s.until(() => s.e.phase === BattlePhase.COMBAT && s.e.waveIndex === w);
      s.clearWave();
      s.run(0.1);
    }
    s.until(() => !!s.e.result);
    expect(s.e.phase).toBe(BattlePhase.STAGE_CLEAR);
    expect(s.e.result).toBe('win');
    expect(s.of('ADVANCE_STARTED').length).toBe(2);
    const final = s.of('WAVE_CLEARED').pop()!;
    expect(final.final).toBeTrue();
    expect(s.of('STAGE_CLEARED')[0].t).toBe(final.t);
    expect(s.e.getAliveHeroes().every(u => u.activity === 'VICTORY')).toBeTrue();
  });

  it('36 + 37. StageResult keeps dead / surviving / revived heroes; combat never deletes roster data', () => {
    const s = session();
    const allies = s.allies.map(a => ({ ...a }));
    s.freeze();
    s.run(0.2);
    const mage = s.h('Mage');
    const warrior = s.h('Warrior');
    s.kill(mage);
    s.kill(warrior);
    s.e.reviveHero({ unitId: warrior.id, sourceId: 'x' });
    for (let w = 0; w < 3; w++) {
      s.until(() => s.e.phase === BattlePhase.COMBAT && s.e.waveIndex === w);
      s.clearWave();
    }
    s.until(() => !!s.e.result);
    const r = s.e.stageResult!;
    expect(r.cleared).toBeTrue();
    expect(r.deadHeroIds).toEqual([mage.heroUid!]);
    expect(r.revivedHeroIds).toEqual([warrior.heroUid!]);
    expect(r.survivingHeroIds.length).toBe(4);
    expect(r.wavesCleared).toBe(3);
    expect(r.battleDuration).toBeCloseTo(s.e.time, 5);
    expect(s.of('HERO_DIED_IN_STAGE').map(x => x.heroUid)).toEqual([mage.heroUid]);
    // roster input untouched, unit still carries its identity + slot
    expect(s.allies).toEqual(allies);
    expect(mage.heroUid).toBe(allies[2].heroUid);
    expect(s.e.formation.slotOf(mage.id)).toBeDefined();
  });

  // ---------------------------------------------------------------- transition modes

  const phasesOf = (s: ReturnType<typeof session>) => s.of('PHASE_CHANGED').map(p => p.phase);
  const runAll = (s: ReturnType<typeof session>) => {
    s.freeze();
    for (let w = 0; w < s.e.totalWaves; w++) {
      s.until(() => s.e.phase === BattlePhase.COMBAT && s.e.waveIndex === w);
      s.clearWave();
    }
    s.until(() => !!s.e.result);
  };

  it('38. ADVANCE_AND_REGROUP: clear → advance → regroup → next wave, origin moves 4 per transition', () => {
    const s = session();
    runAll(s);
    expect(s.e.result).toBe('win');
    expect(phasesOf(s).slice(0, 8)).toEqual([
      BattlePhase.WAVE_START, BattlePhase.COMBAT, BattlePhase.WAVE_CLEAR, BattlePhase.ADVANCING,
      BattlePhase.REGROUPING, BattlePhase.NEXT_WAVE_READY, BattlePhase.WAVE_START, BattlePhase.COMBAT,
    ]);
    expect(s.e.formation.originPosition).toBe(8);
  });

  it('39. REGROUP_ONLY: reform in place, no advance', () => {
    const s = session({ rules: { waveTransitionMode: WaveTransitionMode.REGROUP_ONLY } });
    s.freeze();
    s.run(0.2);
    s.h('Warrior').x += 2;
    runAll(s);
    expect(s.e.result).toBe('win');
    expect(phasesOf(s)).not.toContain(BattlePhase.ADVANCING);
    expect(phasesOf(s)).toContain(BattlePhase.REGROUPING);
    expect(s.e.formation.originPosition).toBe(0);
    expect(s.of('REGROUP_COMPLETED').every(x => !x.timedOut)).toBeTrue();
  });

  it('40. HOLD_POSITION: stay put, next enemies arrive — same combat code', () => {
    const s = session({ rules: { waveTransitionMode: WaveTransitionMode.HOLD_POSITION } });
    s.freeze();
    s.run(0.2);
    s.h('Warrior').x += 2;
    s.clearWave();
    s.until(() => s.of('WAVE_CLEARED').length > 0);
    const x = s.h('Warrior').x;
    s.until(() => s.e.waveIndex === 1);
    expect(s.h('Warrior').x).toBe(x);
    runAll(s);
    expect(s.e.result).toBe('win');
    expect(phasesOf(s)).not.toContain(BattlePhase.ADVANCING);
    expect(phasesOf(s)).not.toContain(BattlePhase.REGROUPING);
  });

  // ---------------------------------------------------------------- edge cases

  it('edge: hero and the last enemy die in the same tick → all events resolve first, then the party wipe wins', () => {
    const s = session({ waves: 1, allies: [hero('Solo', 'fighter', 0, 1)] });
    s.freeze();
    s.run(0.2);
    s.kill(s.h('Solo'));
    s.clearWave();
    s.run(0.1);
    expect(s.e.result).toBe('lose');
    expect(s.of('WAVE_CLEARED').length).toBe(0);
  });

  it('edge: a hero dying during Advance goes straight to DEAD_HIDDEN', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    s.clearWave();
    s.until(s.phaseIs(BattlePhase.ADVANCING));
    const w = s.h('Warrior');
    w.poison = 1e6;
    w.poisonTime = 1;
    s.run(0.6);
    expect(w.life).toBe('DEAD_HIDDEN');
    expect(w.visible).toBeFalse();
    expect(s.of('HERO_HIDDEN_AFTER_DEATH').map(x => x.unit)).toContain(w.id);
  });

  it('edge: a hero revived during Regroup spawns at its current anchor and takes part in the regroup', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    const mage = s.h('Mage');
    s.kill(mage);
    s.h('Warrior').x -= 3; // someone out of formation, so the regroup takes a moment
    s.clearWave();
    s.until(s.phaseIs(BattlePhase.REGROUPING));
    expect(s.e.reviveHero({ unitId: mage.id, sourceId: 'shrine' }).ok).toBeTrue();
    // the Warrior is walking through the Mage's anchor → nudged to a free spot next to it
    expect(anchorDist(s.e, mage)).toBeLessThanOrEqual(1 + 1e-9);
    s.until(() => s.e.waveIndex === 1);
    expect(s.of('HERO_REGROUP_READY').map(x => x.unit)).toContain(mage.id);
    expect(s.e.grid.occupants(mage.pos)).toContain(mage.id);
  });

  it('edge: revive right as the next wave starts creates exactly one battlefield instance', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    const mage = s.h('Mage');
    s.kill(mage);
    s.clearWave();
    s.until(s.phaseIs(BattlePhase.WAVE_START));
    s.e.reviveHero({ unitId: mage.id, sourceId: 'x' });
    s.run(1.5);
    let count = 0;
    for (let c = 0; c < BOARD_COLS; c++) for (let r = 0; r < 3; r++) count += s.e.grid.occupants({ r, c }).filter(id => id === mage.id).length;
    expect(count).toBe(1);
  });

  it('edge: revive on a living / nonexistent hero is rejected safely', () => {
    const s = session();
    s.run(0.1);
    expect(s.e.reviveHero({ unitId: s.h('Tank').id, sourceId: 'x' })).toEqual({ ok: false, reason: 'not-dead' });
    expect(s.e.reviveHero({ unitId: 9999, sourceId: 'x' })).toEqual({ ok: false, reason: 'not-found' });
    const off = session({ rules: { allowRevive: false } });
    off.run(0.1);
    off.kill(off.h('Mage'));
    expect(off.e.reviveHero({ unitId: off.h('Mage').id, sourceId: 'x' })).toEqual({ ok: false, reason: 'revive-disabled' });
  });

  it('edge: an occupied anchor → the revive searches a nearby free cell (no overlap)', () => {
    const { s, mage } = deadInWave2();
    const anchor = s.e.formation.localAnchorOf(mage.id)!;
    const tank = s.h('Tank');
    s.e.grid.remove(tank.id, tank.pos);
    tank.pos = anchor;
    s.e.grid.place(tank.id, anchor);
    s.e.reviveHero({ unitId: mage.id, sourceId: 'x' });
    expect(mage.pos).not.toEqual(anchor);
    expect(Math.max(Math.abs(mage.pos.r - anchor.r), Math.abs(mage.pos.c - anchor.c))).toBe(1);
    expect(s.e.grid.occupants(mage.pos)).toEqual([mage.id]);
    expect(mage.pos.c).toBeLessThan(ENEMY_ZONE_START);
  });

  it('edge: a DEAD_VISIBLE hero revives at its corpse (same wave)', () => {
    const s = session();
    s.freeze();
    s.run(0.3);
    const mage = s.h('Mage');
    s.kill(mage);
    const at = { ...mage.pos };
    expect(s.e.reviveHero({ unitId: mage.id, sourceId: 'x' })).toEqual({ ok: true, hidden: false });
    expect(mage.pos).toEqual(at);
  });

  it('edge: death removes temporary buffs; persistThroughDeath effects stay; gauge policy is configurable', () => {
    const { s, mage } = deadInWave2();
    const s2 = session();
    s2.run(0.2);
    const t = s2.h('Tank');
    applyBuff(t, BUFFS['alpha_howl_buff'], t.id);
    applyBuff(t, { ...BUFFS['alpha_howl_buff'], id: 'injury', persistThroughDeath: true }, t.id);
    t.shield = 100;
    s2.kill(t);
    expect(t.buffs.map(b => b.def.id)).toEqual(['injury']);
    expect(t.shield).toBe(0);
    mage.mana = 80;
    s.e.reviveHero({ unitId: mage.id, sourceId: 'x', gaugePolicy: 'RESET_TO_ZERO' });
    expect(mage.mana).toBe(0);
  });

  it('edge: later waves spawn relative to the moved encounter origin and walk in (no teleport)', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    s.clearWave();
    s.until(s.phaseIs(BattlePhase.WAVE_START));
    const slime = s.e.units.find(u => u.side === 'enemy' && u.wave === 1)!;
    const anchorX = s.e.formation.originPosition + slime.pos.c;
    expect(slime.pos.c).toBe(ENEMY_ZONE_START);
    expect(slime.x).toBeGreaterThan(anchorX + 1); // still off to the right
    let maxStep = 0;
    let prev = slime.x;
    s.until(s.phaseIs(BattlePhase.COMBAT), 5, () => {
      maxStep = Math.max(maxStep, Math.abs(slime.x - prev));
      prev = slime.x;
    });
    expect(slime.x).toBe(anchorX);
    expect(maxStep).toBeLessThan(0.6);
    expect(s.e.isValidTarget(s.h('Tank'), slime)).toBeTrue();
  });

  it('edge: nobody can be targeted outside COMBAT', () => {
    const s = session();
    s.freeze();
    s.run(0.2);
    s.clearWave();
    s.until(s.phaseIs(BattlePhase.WAVE_START));
    const slime = s.e.units.find(u => u.side === 'enemy' && u.wave === 1)!;
    expect(s.e.isValidTarget(s.h('Tank'), slime)).toBeFalse();
    expect(s.e.isValidTarget(slime, s.h('Tank'))).toBeFalse();
  });

  it('events: subscribers receive every event as it happens', () => {
    const s = session({ waves: 1 });
    const seen: string[] = [];
    const off = s.e.subscribe(ev => seen.push(ev.type));
    s.freeze();
    s.run(0.2);
    s.clearWave();
    s.run(0.2);
    off();
    expect(seen).toContain('STAGE_STARTED');
    expect(seen).toContain('WAVE_CLEARED');
    expect(seen).toContain('STAGE_CLEARED');
  });

  it('survive stages use HOLD_POSITION and clear on the timer', () => {
    const s = session({ mode: 'survive', timeLimit: 3, waves: 1 });
    expect(s.e.rules.waveTransitionMode).toBe(WaveTransitionMode.HOLD_POSITION);
    s.freeze();
    s.run(4);
    expect(s.e.result).toBe('win');
  });
});

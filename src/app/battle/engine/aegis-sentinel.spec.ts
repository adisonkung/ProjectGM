import { AEGIS_SENTINEL, AEGIS_SKILLS } from '../../core/data/aegis-sentinel';
import { HERO_BY_ID } from '../../core/data/heroes';
import { MONSTERS, castTimeline } from '../../core/data/monsters';
import { SHEETS, FX } from '../../core/data/sprites';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { UnitSpec } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';
import { createBattle } from '../battle-session';
import { StatusFxPlayback } from '../render/status-fx';
import { clipTimeline } from '../render/unit-clip';
import { BattleEvent } from './battle-engine';
import { hasStatus } from './buffs';

function duel(skill: string) {
  const h = HERO_BY_ID['bailong'];
  const ally: UnitSpec = { name: h.name, cls: h.cls, heroId: h.id, heroUid: 1,
    stats: { ...heroStats(h, { uid: 1, templateId: h.id, level: 1, potential: 'B' }), hp: 999999, atk: 1 }, pos: { r: 0, c: 1 } };
  const e = createBattle({ allies: [ally], seed: 7, stage: { floor: 0, id: 'aegis-test', mode: 'eliminate',
    timeLimit: 300, enemies: [{ enemy: 'aegis_sentinel@1', r: 0, c: 1 }], rulePreset: 'arena' } });
  const boss = e.units.find(u => u.monster)!;
  for (const cs of boss.castSkills) cs.cd = cs.def.id === skill ? .1 : Infinity;
  for (const slot of ['skill','skill2','ult'] as const) e.setSkillMode(e.units[0].id, slot, 'MANUAL');
  const events: BattleEvent[] = [];
  const run = (seconds: number, until?: () => boolean) => {
    for (let i = 0; i < seconds / .05; i++) { e.step(.05); events.push(...e.drainEvents()); if (until?.()) break; }
  };
  return { e, boss, events, run };
}

describe('Aegis Sentinel integration', () => {
  it('all tiers share the three-skill kit and original guardian base stat progression', () => {
    for (const tier of [1,2,3]) {
      const d = MONSTERS[`aegis_sentinel@${tier}`];
      expect(d.skills).toEqual(['aegis_guard','aegis_lance','aegis_judgement']);
      expect(d.animation.sheet).toBe('enemy-aegis-sentinel.png');
    }
    expect(AEGIS_SENTINEL.stats.maxHp).toBe(20000);
    expect(AEGIS_SENTINEL.attack.delivery).toBe('MELEE');
  });

  it('guard activates after the semantic cast, reduces damage for eight seconds without invented shield HP, then expires', () => {
    const s = duel('aegis_guard');
    s.run(8, () => hasStatus(s.boss, 'aegis_guard'));
    expect(hasStatus(s.boss, 'aegis_guard')).toBeTrue();
    expect(s.boss.shield).toBe(0);
    const appliedAt = s.e.time;
    expect(s.boss.buffs.find(b => b.def.id === 'aegis_guard')!.remaining).toBeCloseTo(8, 1);
    expect(STATUS_EFFECTS['aegis_guard'].modifiers.damageTakenMultiplier).toBe(.4);
    s.run(7.8);
    expect(hasStatus(s.boss, 'aegis_guard')).toBeTrue();
    expect(s.events.filter(x => x.type === 'attack' && x.src === s.boss.id).length).toBe(0);
    s.run(.3);
    expect(hasStatus(s.boss, 'aegis_guard')).toBeFalse();
    expect(s.e.time - appliedAt).toBeCloseTo(8.1, 1);
  });

  it('S2 applies one semantic release and unique recipients, without moving the caster', () => {
    const s = duel('aegis_lance');
    s.run(10, () => s.boss.casting?.def.id === 'aegis_lance');
    const start = { ...s.boss.pos };
    s.run(3, () => s.events.some(e => e.type === 'skillActivated' && e.skill === 'aegis_lance'));
    const release = s.events.find(e => e.type === 'skillActivated' && e.skill === 'aegis_lance');
    expect(release).toBeDefined();
    if (release?.type === 'skillActivated') {
      expect(release.targets.length).toBeGreaterThan(0);
      expect(new Set(release.targets).size).toBe(release.targets.length);
    }
    expect(s.boss.pos).toEqual(start);
  });

  it('guard pose and visual lifetime match the real buff; refresh retains the same orbit and death/expiry removes it', () => {
    const sh = SHEETS['enemy-aegis-sentinel.png'];
    const tl = clipTimeline(sh.casts!['guard'], 'cast', { anim: 'cast', castClip: 'guard', castTime: 2.5 });
    expect(tl.duration).toBeCloseTo(10.5, 6);
    expect(castTimeline(AEGIS_SKILLS['aegis_judgement'], AEGIS_SENTINEL.animation).activation).toBe(3);
    let next = 0;
    const shown = new Map<number,string>();
    const playback = new StatusFxPlayback({ spawn: name => { shown.set(++next,name); return next; }, remove: ids => ids.forEach(id => shown.delete(id)) });
    const instance = { target: 2, source: 2, status: 'aegis_guard', sprite: 'enemy-aegis-sentinel.png', at: { r: 1,c: 10 } };
    playback.sync([instance],0);
    expect([...shown.values()]).toEqual(['ae-s1-in','ae-s1-loop']);
    playback.sync([instance],.5);
    playback.sync([instance],7); // refreshing the status does not spawn another orbit.
    expect(next).toBe(2);
    expect([...shown.values()]).toEqual(['ae-s1-loop']);
    playback.sync([],8);
    expect(shown.size).toBe(0);
    expect(FX['ae-s1-loop'].frames * FX['ae-s1-loop'].frameMs).toBe(1600);
    expect(sh.casts!['broken'].frames * sh.casts!['broken'].ms!).toBe(3000);
  });
});

/**
 * Bai Long ultimate — target-locked area vs ground-targeted "cell in front" (simulation only, no game data changed).
 *   npm run bailong-ult-sim -- [runs=40] [level=10]
 * Variants (same 25 / 30 / 45 % strike split, same multipliers 2.8 main / 1.4 rest):
 *   CURRENT    lock the nearest enemy (range 2), 3 × 3 around it — main = the locked unit only
 *   FRONT_CELL hit every unit standing in the cell in front of Bai Long (all at 2.8) — nothing else
 *   FRONT_3X3  3 × 3 centred on the cell in front — everyone in the front cell 2.8, the ring 1.4
 * Sampling mode: Bai Long's gauge is refilled after every ult (ult as often as the AI finds a target) — so win % /
 * time are NOT balance numbers; they show how each variant behaves cast after cast.
 * Reported per variant and floor: win %, time, ults / battle, waiting time with a full gauge, units hit per strike,
 * strikes that hit ≥ 2 units stacked in one cell, Bai Long's damage share.
 */
import { BattleEngine, BattleEvent } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { HERO_DEFINITIONS } from '../../src/app/core/data/hero-skills';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { teamToUnits } from '../../src/app/core/rules/team';
import { SkillDefinition } from '../../src/app/core/models/combat';

declare const process: { argv: string[] };
const runs = Number(process.argv[2] ?? 40);
const level = Number(process.argv[3] ?? 10);

const base = HERO_DEFINITIONS['bailong'].kit.ult;
const dmg = base.effects.find(e => e.type === 'DAMAGE') as Extract<SkillDefinition['effects'][number], { type: 'DAMAGE' }>;
const VARIANTS: Record<string, SkillDefinition> = {
  CURRENT: base,
  FRONT_CELL: {
    ...base, range: 1,
    effects: base.effects.map(e => (e.type === 'DAMAGE' ? { ...e, area: 'FRONT_CELL' as const, center: undefined, secondary: dmg.primary } : e)),
    ai: { ...(base.ai ?? { tier: 'NORMAL' }), minTargets: 1 },
  },
  FRONT_3X3: {
    ...base, range: 1,
    effects: base.effects.map(e => (e.type === 'DAMAGE' ? { ...e, area: 'FRONT_3X3' as const, center: undefined } : e)),
    ai: { ...(base.ai ?? { tier: 'NORMAL' }), minTargets: 1 },
  },
};

const state = newGameState();
const heroes = state.heroes.map(h => ({ ...h, level, ...(h.templateId === 'jin' ? { templateId: 'bailong' } : {}) }));
const allies = teamToUnits(state.team, heroes);
if (!allies.some(a => a.heroId === 'bailong')) throw new Error('Bai Long is not in the team');

const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`Bai Long ult — ${runs} runs / floor, team Lv${level} (Jin's slot → Bai Long), AUTO ult\n`);
const summary: Record<string, number[]> = {};
for (const [name, ult] of Object.entries(VARIANTS)) {
  (HERO_DEFINITIONS['bailong'].kit as { ult: SkillDefinition }).ult = ult;
  console.log(`== ${name}`);
  console.log(' floor  win%   time  ults/b  wait(s)  hit/strike  stacked%  BL dmg%');
  let tot = [0, 0, 0, 0, 0, 0];
  for (const stage of STAGES) {
    let wins = 0, time = 0, ults = 0, wait = 0, strikes = 0, hitN = 0, stacked = 0, blDmg = 0, allDmg = 0;
    for (let s = 1; s <= runs; s++) {
      const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: s, autoUlt: true });
      const bl = e.units.find(u => u.heroId === 'bailong')!;
      let fullAt: number | null = null;
      const pos = new Map<number, string>();
      e.subscribe((ev: BattleEvent) => {
        if (ev.type === 'cast' && ev.src === bl.id && ev.kind === 'ult') {
          ults++;
          if (fullAt != null) wait += e.time - fullAt;
          fullAt = null;
        }
        if (ev.type === 'impact' && ev.src === bl.id && ev.kind === 'ult') {
          strikes++;
          const hits = ev.hits ?? [];
          hitN += hits.length;
          const cells = new Map<string, number>();
          for (const id of hits) {
            const u = e.units.find(x => x.id === id);
            if (u) cells.set(`${u.pos.r},${u.pos.c}`, (cells.get(`${u.pos.r},${u.pos.c}`) ?? 0) + 1);
          }
          if ([...cells.values()].some(n => n >= 2)) stacked++;
        }
      });
      while (!e.result && e.time < 300) {
        e.step(0.05);
        // sampling mode: the gauge refills right after each ult → many casts per battle to measure their quality
        if (bl.alive && bl.mana < bl.maxMana && fullAt == null && e.time > 1) bl.mana = bl.maxMana;
        if (bl.alive && bl.mana >= bl.maxMana && fullAt == null) fullAt = e.time;
      }
      void pos;
      if (e.result === 'win') wins++;
      time += e.time;
      const st = e.metrics.byUnit;
      blDmg += st[bl.id]?.dealt ?? 0;
      allDmg += Object.entries(st).filter(([id]) => e.units.find(u => u.id === +id)?.side === bl.side).reduce((a, [, v]) => a + v.dealt, 0);
    }
    const row = [wins / runs * 100, time / runs, ults / runs, ults ? wait / ults : 0, strikes ? hitN / strikes : 0, strikes ? stacked / strikes * 100 : 0, allDmg ? blDmg / allDmg * 100 : 0];
    tot = tot.map((v, i) => v + row[i]);
    console.log(` F${pad(stage.floor, 2)}  ${pad(row[0].toFixed(0), 4)}  ${pad(row[1].toFixed(0), 5)}  ${pad(row[2].toFixed(2), 6)}  ${pad(row[3].toFixed(1), 7)}  ${pad(row[4].toFixed(2), 10)}  ${pad(row[5].toFixed(0), 8)}  ${pad(row[6].toFixed(1), 7)}`);
  }
  summary[name] = tot.map(v => v / STAGES.length);
}
console.log('\n== average over floors');
for (const [n, r] of Object.entries(summary)) console.log(` ${n.padEnd(10)} win ${r[0].toFixed(0)}% · time ${r[1].toFixed(0)}s · ults/b ${r[2].toFixed(2)} · wait ${r[3].toFixed(1)}s · hit/strike ${r[4].toFixed(2)} · stacked ${r[5].toFixed(0)}%`);

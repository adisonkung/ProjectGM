/**
 * Balance sweep for Stage 4–10: win rate of the starter team with two player policies.
 *   AUTO     = blind auto (AUTO ult, no Focus)
 *   TACTICAL = AUTO ult + Focus on the dangerous support / caster the backline can already shoot (tools/dev/policy.ts)
 * npm run balance -- [runs] [level] [floor] [monsterScale]
 */
import { BattleEngine } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { teamToUnits } from '../../src/app/core/rules/team';
import { focusPriority } from './policy';

declare const process: { argv: string[] };
const runs = Number(process.argv[2] ?? 40);
const level = Number(process.argv[3] ?? 1);
const onlyFloor = process.argv[4] ? Number(process.argv[4]) : null;
const scale = process.argv[5] ? Number(process.argv[5]) : null;
const state = newGameState();
const heroes = state.heroes.map(h => ({ ...h, level }));
const allies = teamToUnits(state.team, heroes);

for (const base of STAGES) {
  if (onlyFloor != null ? base.floor !== onlyFloor : base.floor < 4) continue;
  const stage = scale != null ? { ...base, monsterScale: scale } : base;
  const out: string[] = [];
  for (const policy of ['AUTO', 'TACTICAL'] as const) {
    let wins = 0;
    let time = 0;
    let deaths = 0;
    let lastWave = 0;
    for (let s = 1; s <= runs; s++) {
      const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: s, autoUlt: true });
      while (!e.result && e.time < 400) {
        if (policy === 'TACTICAL') {
          const f = focusPriority(e);
          if (f != null && f !== e.focusTargetId) e.setFocus(f);
        }
        e.step(0.05);
        e.drainEvents();
      }
      if (e.result === 'win') wins++;
      time += e.time;
      deaths += e.fallenHeroUids().length;
      lastWave += e.waveIndex + 1;
    }
    out.push(`${policy} ${String(Math.round((wins / runs) * 100)).padStart(3)}% t=${(time / runs).toFixed(0)}s dead=${(deaths / runs).toFixed(1)} wave=${(lastWave / runs).toFixed(1)}`);
  }
  console.log(`Lv${level} F${String(stage.floor).padEnd(2)} x${stage.monsterScale ?? 1} | ${out.join(' | ')}`);
}

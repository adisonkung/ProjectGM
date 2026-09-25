/** Debug: print a battle's event log for one floor. npm run trace -- <floor> [seed] */
import { BattleEngine } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { teamToUnits } from '../../src/app/core/rules/team';

declare const process: { argv: string[] };
const floor = Number(process.argv[2] ?? 1);
const seed = Number(process.argv[3] ?? 1);
const state = newGameState();
const e = new BattleEngine({ allies: teamToUnits(state.team, state.heroes), stage: STAGES[floor - 1], enemyTemplates: ENEMIES, seed, autoUlt: true });
const name = (id?: number) => (id == null ? '-' : `${e.units.find(u => u.id === id)?.name}#${id}`);
const skip = new Set(['move', 'castProgress']);
while (!e.result && e.time < 300) {
  e.step(0.05);
  for (const ev of e.drainEvents()) {
    if (skip.has(ev.type)) continue;
    const { type, ...rest } = ev as any;
    const txt = Object.entries(rest).map(([k, v]) => (k === 'src' || k === 'dst' ? `${k}=${name(v as number)}` : `${k}=${JSON.stringify(v)}`)).join(' ');
    console.log(`${e.time.toFixed(2).padStart(6)} ${type.padEnd(15)} ${txt}`);
  }
}
console.log('result', e.result, e.time.toFixed(1));

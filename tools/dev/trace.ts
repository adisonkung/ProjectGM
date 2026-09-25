/** Debug: print a battle's event log for one floor. npm run trace -- <floor> [seed] [monsterScale] [tactical] */
import { BattleEngine } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { teamToUnits } from '../../src/app/core/rules/team';
import { focusPriority } from './policy';

declare const process: { argv: string[] };
const floor = Number(process.argv[2] ?? 1);
const seed = Number(process.argv[3] ?? 1);
const scale = process.argv[4] ? Number(process.argv[4]) : null;
const tactical = process.argv[5] === 'tactical';
const state = newGameState();
const base = STAGES[floor - 1];
const stage = scale != null ? { ...base, monsterScale: scale } : base;
const e = new BattleEngine({ allies: teamToUnits(state.team, state.heroes), stage, enemyTemplates: ENEMIES, seed, autoUlt: true });
const name = (id?: number) => (id == null ? '-' : `${e.units.find(u => u.id === id)?.name}#${id}`);
const skip = new Set(['move', 'castProgress']);
while (!e.result && e.time < 300) {
  if (tactical) {
    const f = focusPriority(e);
    if (f != null && f !== e.focusTargetId) e.setFocus(f);
  }
  e.step(0.05);
  for (const ev of e.drainEvents()) {
    if (skip.has(ev.type)) continue;
    const { type, ...rest } = ev as any;
    const txt = Object.entries(rest).map(([k, v]) => (k === 'src' || k === 'dst' ? `${k}=${name(v as number)}` : `${k}=${JSON.stringify(v)}`)).join(' ');
    console.log(`${e.time.toFixed(2).padStart(6)} ${type.padEnd(15)} ${txt}`);
  }
}
console.log('result', e.result, e.time.toFixed(1));

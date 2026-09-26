/** Debug: print a battle's event log for one floor. npm run trace -- <floor|farm id> [seed] [level|rec] [tactical] [--tune=hp,atk,def] */
import { BattleEngine } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { STAGES } from '../../src/app/core/data/stages';
import { FARM_BY_ID } from '../../src/app/core/data/economy';
import { newGameState } from '../../src/app/core/data/starter';
import { teamToUnits } from '../../src/app/core/rules/team';
import { TacticalBot, tacticalFormation } from './policy';

declare const process: { argv: string[] };
// <floor> or a farm dungeon id (training_1, hunt_4 …)
const farm = FARM_BY_ID[process.argv[2] ?? ''];
const floor = farm ? 0 : Number(process.argv[2] ?? 1);
const seed = Number(process.argv[3] ?? 1);
const tuneArg = process.argv.find(a => a.startsWith('--tune='));
const tune = tuneArg ? tuneArg.slice(7).split(',').map(Number) : null;
const base = farm ? farm.stage : STAGES[floor - 1];
const stage = tune ? { ...base, monsterTuning: { hp: tune[0], atk: tune[1], def: tune[2] } } : base;
const level = !process.argv[4] || process.argv[4] === 'rec' ? stage.recommendedLevel ?? 1 : Number(process.argv[4]);
const tactical = process.argv[5] === 'tactical';
const state = newGameState();
const heroes = state.heroes.map(h => ({ ...h, level }));
const allies = teamToUnits(tactical ? tacticalFormation(heroes, state.team, stage) : state.team, heroes);
const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed, autoUlt: true });
const bot = tactical ? new TacticalBot() : null;
const name = (id?: number) => (id == null ? '-' : `${e.units.find(u => u.id === id)?.name}#${id}`);
const skip = new Set(['move', 'castProgress']);
while (!e.result && e.time < 300) {
  bot?.tick(e);
  e.step(0.05);
  for (const ev of e.drainEvents()) {
    if (skip.has(ev.type)) continue;
    const { type, ...rest } = ev as any;
    const txt = Object.entries(rest).map(([k, v]) => (k === 'src' || k === 'dst' ? `${k}=${name(v as number)}` : `${k}=${JSON.stringify(v)}`)).join(' ');
    console.log(`${e.time.toFixed(2).padStart(6)} ${type.padEnd(15)} ${txt}`);
  }
}
console.log('result', e.result, e.time.toFixed(1));

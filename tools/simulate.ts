// balance reference = the pre-remodel roster (test fixture) until the remodelled heroes exist
import '../src/testing/legacy-roster';
/**
 * จำลองการต่อสู้แบบไม่แสดงผล เพื่อดูอัตราชนะของทีมเริ่มต้นในแต่ละชั้น
 * รัน: npm run sim   (หรือ npm run sim -- 500 เพื่อกำหนดจำนวนรอบ)
 */
import { BattleEngine } from '../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../src/app/core/data/enemies';
import { STAGES } from '../src/app/core/data/stages';
import { newGameState } from '../src/app/core/data/starter';
import { teamToUnits } from '../src/app/core/rules/team';

declare const process: { argv: string[] };
const runs = Number(process.argv[2] ?? 200);
const state = newGameState();

for (const level of [1, 10, 20]) {
  const heroes = state.heroes.map(h => ({ ...h, level }));
  const allies = teamToUnits(state.team, heroes);
  const row: string[] = [];
  for (const stage of STAGES) {
    let wins = 0;
    let time = 0;
    for (let s = 1; s <= runs; s++) {
      const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: s, autoUlt: true });
      if (e.run() === 'win') wins++;
      time += e.time;
    }
    row.push(`F${stage.floor}:${Math.round((wins / runs) * 100)}%(${(time / runs).toFixed(0)}s)`);
  }
  console.log(`ทีมเริ่มต้น Lv${String(level).padStart(2)} | ${row.join('  ')}`);
}

/**
 * Balance sweep for Stage 4–10: AUTO bot vs TACTICAL bot (tools/dev/policy.ts), heroes at the stage's recommended
 * level (or a fixed one), with decision metrics — so a loss can be traced to strategy instead of raw stats.
 * npm run balance -- [runs] [level|rec] [floor|-] [--metrics] [--star=N (what-if: every hero at N★)]
 */
import { BattleEngine } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { teamToUnits } from '../../src/app/core/rules/team';
import { heroStats } from '../../src/app/core/rules/stats';
import { HERO_BY_ID } from '../../src/app/core/data/heroes';
import { BotName, TacticalBot, tacticalFormation } from './policy';

declare const process: { argv: string[] };
const args = process.argv.slice(2);
const runs = Number(args[0] ?? 40);
const levelArg = args[1] ?? 'rec';
const onlyFloor = args[2] && args[2] !== '-' ? Number(args[2]) : null;
const showMetrics = args.includes('--metrics');
const starArg = args.find(a => a.startsWith('--star='));
const star = starArg ? Number(starArg.slice(7)) : null;
const state = newGameState();

const pct = (n: number) => `${String(Math.round(n * 100)).padStart(3)}%`;

for (const stage of STAGES) {
  if (onlyFloor != null ? stage.floor !== onlyFloor : stage.floor < 4) continue;
  const level = levelArg === 'rec' ? stage.recommendedLevel ?? 1 : Number(levelArg);
  const heroes = state.heroes.map(h => ({ ...h, level }));
  const out: string[] = [];
  const metricLines: string[] = [];
  for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
    const team = bot === 'TACTICAL' ? tacticalFormation(heroes, state.team) : state.team;
    const allies = teamToUnits(team, heroes).map(u => {
      if (star == null) return u;
      const h = heroes.find(x => x.uid === u.heroUid)!;
      return { ...u, star, stats: heroStats({ ...HERO_BY_ID[h.templateId], star: star as 1 }, h) };
    });
    const a = {
      wins: 0, time: 0, deaths: 0, revives: 0, wave: 0, dealt: 0, taken: 0, heal: 0, opp: 0, att: 0, succ: 0, crit: 0,
      resHit: 0, resMiss: 0, focusUp: 0, unsafe: 0, anchor: 0, threatDeaths: 0, phase: 0, brk: 0, brkFail: 0,
    };
    for (let s = 1; s <= runs; s++) {
      const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: s, autoUlt: true });
      const tactical = bot === 'TACTICAL' ? new TacticalBot() : null;
      while (!e.result && e.time < 400) {
        tactical?.tick(e);
        e.step(0.05);
        e.drainEvents();
      }
      const m = e.metrics;
      if (e.result === 'win') a.wins++;
      a.time += e.time;
      a.deaths += m.deaths;
      a.revives += m.revives;
      a.wave += e.waveIndex + 1;
      a.dealt += m.damageDealt;
      a.taken += m.damageTaken;
      a.heal += m.healing;
      a.opp += m.interruptOpportunities;
      a.att += m.interruptAttempts;
      a.succ += m.interruptSuccesses;
      a.crit += m.criticalCastsCompleted;
      a.resHit += m.reservedSkillHits;
      a.resMiss += m.reservedSkillMisses;
      a.focusUp += m.focusUptime;
      a.unsafe += m.unsafeFocusChaseCount;
      a.anchor += m.avgAnchorDistance;
      a.threatDeaths += m.rangedDeathsInThreat;
      a.phase += m.bossPhaseReached;
      a.brk += m.breakSuccess;
      a.brkFail += m.breakFailure;
    }
    const n = runs;
    const f = (v: number, d = 1) => (v / n).toFixed(d);
    out.push(`${bot} ${pct(a.wins / n)} t=${f(a.time, 0)}s dead=${f(a.deaths)} wave=${f(a.wave)}`);
    metricLines.push(
      `    ${bot.padEnd(8)} dealt ${f(a.dealt, 0)} taken ${f(a.taken, 0)} heal ${f(a.heal, 0)} revives ${f(a.revives)}` +
      ` | casts ${f(a.opp)} attempts ${f(a.att)} stopped ${f(a.succ)} important-completed ${f(a.crit)}` +
      ` | reserve on-cast/other ${f(a.resHit)}/${f(a.resMiss)} | focus uptime ${pct(a.focusUp / n)} unsafe chases ${f(a.unsafe, 2)}` +
      ` | anchor dist ${f(a.anchor, 2)} ranged deaths in threat ${f(a.threatDeaths, 2)}` +
      ` | boss phase ${f(a.phase)} break ok/landed ${f(a.brk, 2)}/${f(a.brkFail, 2)}`,
    );
  }
  console.log(`${star ?? 5}★ Lv${level} F${String(stage.floor).padEnd(2)} | ${out.join(' | ')}`);
  if (showMetrics) metricLines.forEach(l => console.log(l));
}

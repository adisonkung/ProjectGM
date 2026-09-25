/**
 * Balance sweep: AUTO bot vs TACTICAL bot (tools/dev/policy.ts), heroes at the stage's recommended level (or a fixed one).
 * Mechanic exposure first (did the boss / casters get time to act?), then win rate, decision metrics and power snapshots.
 * npm run balance -- [runs] [level|rec] [floor|-] [--metrics] [--exposure] [--power] [--star=N] [--tune=hp,atk,def]
 *   --metrics   decision metrics (interrupts, focus, positioning, break)
 *   --exposure  per-skill casts (started / completed / interrupted / broken) + boss lifetime / phases / statuses
 *   --power     hero + monster power snapshots (final stats, DPS, HPS, ult uses; authored vs tuned monster stats)
 *   --all-floors  also Stage 1–3 when no floor is given
 */
import { BattleEngine, MONSTER_TUNING_LIMITS, monsterTuningReview } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { MONSTERS } from '../../src/app/core/data/monsters';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { teamToUnits } from '../../src/app/core/rules/team';
import { heroStats } from '../../src/app/core/rules/stats';
import { HERO_BY_ID } from '../../src/app/core/data/heroes';
import { wavesOf } from '../../src/app/core/models/stage';
import { BotName, TacticalBot, tacticalFormation } from './policy';

declare const process: { argv: string[] };
const args = process.argv.slice(2);
const pos = args.filter(a => !a.startsWith('--'));
const runs = Number(pos[0] ?? 40);
const levelArg = pos[1] ?? 'rec';
const onlyFloor = pos[2] && pos[2] !== '-' ? Number(pos[2]) : null;
const flag = (f: string) => args.includes(f);
const starArg = args.find(a => a.startsWith('--star='));
const star = starArg ? Number(starArg.slice(7)) : null;
const tuneArg = args.find(a => a.startsWith('--tune='));
const tune = tuneArg ? tuneArg.slice(7).split(',').map(Number) : null;
const state = newGameState();

const pct = (n: number) => `${String(Math.round(n * 100)).padStart(3)}%`;
const f1 = (v: number, d = 1) => v.toFixed(d);

interface Agg {
  wins: number; time: number; deaths: number; revives: number; wave: number; dealt: number; taken: number; heal: number;
  opp: number; att: number; succ: number; crit: number; resHit: number; resMiss: number; focusUp: number; unsafe: number;
  anchor: number; threatDeaths: number; phase: number; brk: number; brkFail: number; fight: number; ults: number;
  // exposure
  bossRuns: number; bossLife: number; bossKilled: number; sealBroken: number;
  skills: Record<string, { started: number; completed: number; interrupted: number; broken: number; cancelled: number }>;
  phaseReached: Record<string, number>; phaseTime: number[]; phaseTimeRuns: number[]; status: Record<string, number>;
}
const newAgg = (): Agg => ({
  wins: 0, time: 0, deaths: 0, revives: 0, wave: 0, dealt: 0, taken: 0, heal: 0, opp: 0, att: 0, succ: 0, crit: 0,
  resHit: 0, resMiss: 0, focusUp: 0, unsafe: 0, anchor: 0, threatDeaths: 0, phase: 0, brk: 0, brkFail: 0, fight: 0, ults: 0,
  bossRuns: 0, bossLife: 0, bossKilled: 0, sealBroken: 0, skills: {}, phaseReached: {}, phaseTime: [], phaseTimeRuns: [], status: {},
});

const floors = STAGES.filter(s => (onlyFloor != null ? s.floor === onlyFloor : s.floor >= 4 || flag('--all-floors')));
const summary: string[] = [];

for (let stage of floors) {
  if (tune) stage = { ...stage, monsterTuning: { hp: tune[0], atk: tune[1], def: tune[2] } };
  const level = levelArg === 'rec' ? stage.recommendedLevel ?? 1 : Number(levelArg);
  const heroes = state.heroes.map(h => ({ ...h, level }));
  const aggs: Record<BotName, Agg> = { AUTO: newAgg(), TACTICAL: newAgg() };
  let heroSnapshot: string[] = [];
  const phaseIds: string[] = [];

  for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
    const a = aggs[bot];
    const team = bot === 'TACTICAL' && !flag('--noform') ? tacticalFormation(heroes, state.team) : state.team;
    const allies = teamToUnits(team, heroes).map(u => {
      if (star == null) return u;
      const h = heroes.find(x => x.uid === u.heroUid)!;
      return { ...u, star, stats: heroStats({ ...HERO_BY_ID[h.templateId], star: star as 1 }, h) };
    });
    heroSnapshot = allies.map(u => `${u.name} ${u.star ?? '?'}★ Lv${level} HP ${u.stats.hp} ATK ${u.stats.atk} DEF ${u.stats.def} AS ${u.stats.atkSpeed}`);
    for (let s = 1; s <= runs; s++) {
      const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: s, autoUlt: true });
      const tactical = bot === 'TACTICAL'
        ? new TacticalBot({ focus: !flag('--nofocus'), reserveInterrupts: !flag('--noreserve'), reserveHealerUlt: !flag('--nohealult'), interruptPriority: !flag('--noprio') })
        : null;
      while (!e.result && e.time < 400) {
        tactical?.tick(e);
        e.step(0.05);
        for (const ev of e.drainEvents()) {
          if (ev.type === 'cast' && (ev as { kind?: string }).kind === 'ult' && e.units.find(u => u.id === ev.src)?.side === 'ally') a.ults++;
        }
      }
      const m = e.metrics;
      if (e.result === 'win') a.wins++;
      a.time += e.time;
      a.fight += e.fightTime;
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
      for (const [id, st] of Object.entries(m.skillStats)) {
        const t = (a.skills[id] ??= { started: 0, completed: 0, interrupted: 0, broken: 0, cancelled: 0 });
        t.started += st.started; t.completed += st.completed; t.interrupted += st.interrupted; t.broken += st.broken; t.cancelled += st.cancelled;
      }
      for (const [id, n] of Object.entries(m.statusApplied)) a.status[id] = (a.status[id] ?? 0) + n;
      if (m.bossSpawnedAt != null) {
        a.bossRuns++;
        a.bossLife += m.bossLifetime(e.time) ?? 0;
        if (m.bossDiedAt != null) a.bossKilled++;
        if (m.sealBrokenAt != null) a.sealBroken++;
        for (const p of m.bossPhases) {
          a.phaseReached[p.id] = (a.phaseReached[p.id] ?? 0) + 1;
          if (!phaseIds.includes(p.id)) phaseIds.push(p.id);
        }
        m.phaseDurations(e.time).forEach((d, i) => {
          a.phaseTime[i] = (a.phaseTime[i] ?? 0) + d;
          a.phaseTimeRuns[i] = (a.phaseTimeRuns[i] ?? 0) + 1;
        });
      }
    }
  }

  const n = runs;
  const [A, T] = [aggs.AUTO, aggs.TACTICAL];
  console.log(`\n=== F${stage.floor} ${stage.name} · ${star ?? 5}★ Lv${level} · tuning ${JSON.stringify(stage.monsterTuning ?? {})} ===`);
  const review = monsterTuningReview(stage);
  if (review.length) console.log(`  ⚠ MECHANIC / COMPOSITION / HERO POWER REVIEW REQUIRED: ${review.join(', ')} (engine clamps to the limits)`);
  for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
    const a = aggs[bot];
    console.log(`  ${bot.padEnd(8)} win ${pct(a.wins / n)} · time ${f1(a.time / n, 0)}s · deaths ${f1(a.deaths / n)} · waves ${f1(a.wave / n)}`);
  }
  summary.push(`F${String(stage.floor).padEnd(2)} Lv${level} | AUTO ${pct(A.wins / n)} | TACTICAL ${pct(T.wins / n)}` +
    (A.bossRuns + T.bossRuns ? ` | boss life ${f1(A.bossRuns ? A.bossLife / A.bossRuns : 0, 0)}s / ${f1(T.bossRuns ? T.bossLife / T.bossRuns : 0, 0)}s` : ''));

  if (flag('--exposure')) {
    for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
      const a = aggs[bot];
      console.log(`  -- exposure ${bot} (per run)`);
      if (a.bossRuns) {
        const phases = phaseIds.map(id => `${id} ${pct((a.phaseReached[id] ?? 0) / a.bossRuns)}`).join(' · ');
        const times = a.phaseTime.map((t, i) => `P${i + 1} ${f1(t / a.phaseTimeRuns[i], 0)}s`).join(' ');
        console.log(`     boss reached ${pct(a.bossRuns / n)} · killed ${pct(a.bossKilled / Math.max(1, a.bossRuns))} · lifetime ${f1(a.bossLife / a.bossRuns)}s · phases: ${phases || '-'} · time in phase: ${times}` +
          (a.sealBroken ? ` · seal broken ${pct(a.sealBroken / a.bossRuns)}` : ''));
      }
      for (const [id, st] of Object.entries(a.skills).sort()) {
        console.log(`     ${id.padEnd(22)} started ${f1(st.started / n, 2)} · completed ${f1(st.completed / n, 2)} · interrupted ${f1(st.interrupted / n, 2)} · broken ${f1(st.broken / n, 2)} · cancelled ${f1(st.cancelled / n, 2)}`);
      }
      const statuses = ['ancient_protection', 'broken', 'guardian_empowered', 'guardian_enrage', 'enraged_forest', 'soul_link', 'dark_fog', 'bleed']
        .filter(id => a.status[id]).map(id => `${id} ${f1(a.status[id] / n, 2)}`).join(' · ');
      if (statuses) console.log(`     statuses: ${statuses}`);
    }
  }

  if (flag('--metrics')) {
    for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
      const a = aggs[bot];
      console.log(
        `  -- metrics ${bot}: dealt ${f1(a.dealt / n, 0)} taken ${f1(a.taken / n, 0)} heal ${f1(a.heal / n, 0)} revives ${f1(a.revives / n)}` +
        ` | casts ${f1(a.opp / n)} attempts ${f1(a.att / n)} stopped ${f1(a.succ / n)} important-completed ${f1(a.crit / n)}` +
        ` | reserve on-cast/other ${f1(a.resHit / n)}/${f1(a.resMiss / n)} | focus uptime ${pct(a.focusUp / n)} unsafe chases ${f1(a.unsafe / n, 2)}` +
        ` | anchor dist ${f1(a.anchor / n, 2)} ranged deaths in threat ${f1(a.threatDeaths / n, 2)}` +
        ` | boss phase ${f1(a.phase / n)} break ok/landed ${f1(a.brk / n, 2)}/${f1(a.brkFail / n, 2)}`,
      );
    }
  }

  if (flag('--power')) {
    console.log(`  -- heroes: ${heroSnapshot.join(' | ')}`);
    for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
      const a = aggs[bot];
      console.log(`     ${bot}: team DPS ${f1(a.dealt / a.fight, 0)} · HPS ${f1(a.heal / a.fight, 1)} · ult uses ${f1(a.ults / n)} per run`);
    }
    const t = stage.monsterTuning ?? {};
    const k = {
      hp: Math.min(MONSTER_TUNING_LIMITS.hp, Math.max(1, t.hp ?? 1)),
      atk: Math.min(MONSTER_TUNING_LIMITS.atk, Math.max(1, t.atk ?? 1)),
      def: Math.min(MONSTER_TUNING_LIMITS.def, Math.max(1, t.def ?? 1)),
    };
    const ids = [...new Set(wavesOf(stage).flatMap(w => w.spawns.map(sp => sp.monsterId)))].filter(id => MONSTERS[id]);
    const mons = ids.map(id => {
      const st = MONSTERS[id].stats;
      return `${id} HP ${st.maxHp}→${Math.round(st.maxHp * k.hp)} ATK ${st.attack}→${Math.round(st.attack * k.atk)} DEF ${st.defense}→${Math.round(st.defense * k.def)}`;
    });
    console.log(`  -- monsters (authored→final): ${mons.join(' | ')}`);
  }
}

console.log('\n=== summary ===');
summary.forEach(l => console.log(l));

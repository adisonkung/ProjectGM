/**
 * Balance sweep: AUTO bot vs TACTICAL bot (tools/dev/policy.ts), heroes at the stage's recommended level (or a fixed one).
 * Mechanic exposure first (did the boss / casters get time to act?), then win rate, decision metrics and power snapshots.
 * npm run balance -- [runs] [level|rec] [floor|-] [--profile=A–F (default: the floor's band profile)] [--metrics] [--exposure] [--power] [--star=N] [--tune=hp,atk,def]
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
import { FLOOR_BANDS, POWER_PROFILES } from '../../src/app/core/data/progression';
import { FARM_BY_ID, FARM_DUNGEONS } from '../../src/app/core/data/economy';
import { applyProfile } from '../../src/app/core/rules/progression';

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
const profileArg = args.find(a => a.startsWith('--profile='))?.slice(10);
// what-if authored monster stats (tool only): --mon=id:hp=300,atk=60,def=20;id2:hp=...
const monArg = args.find(a => a.startsWith('--mon='))?.slice(6);
for (const part of monArg ? monArg.split(';') : []) {
  const [id, kv] = part.split(':');
  const st = MONSTERS[id]?.stats as unknown as Record<string, number>;
  if (!st) throw new Error(`unknown monster ${id}`);
  const key: Record<string, string> = { hp: 'maxHp', atk: 'attack', def: 'defense' };
  for (const x of kv.split(',')) {
    const [k, v] = x.split('=');
    st[key[k] ?? k] = Number(v);
  }
}
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
  deathRuns: number; reviveRuns: number; wipes: number; timeouts: number;
  heroes: Record<string, { dealt: number; healed: number; skills: number; ults: number; deaths: number; revives: number }>;
  bonusHits: Record<string, number>; aims: Record<string, { total: number; marked: number }>; bossStatus: Record<string, number>; gear: Record<string, number>;
}
const newAgg = (): Agg => ({
  wins: 0, time: 0, deaths: 0, revives: 0, wave: 0, dealt: 0, taken: 0, heal: 0, opp: 0, att: 0, succ: 0, crit: 0,
  resHit: 0, resMiss: 0, focusUp: 0, unsafe: 0, anchor: 0, threatDeaths: 0, phase: 0, brk: 0, brkFail: 0, fight: 0, ults: 0,
  bossRuns: 0, bossLife: 0, bossKilled: 0, sealBroken: 0, skills: {}, phaseReached: {}, phaseTime: [], phaseTimeRuns: [], status: {},
  deathRuns: 0, reviveRuns: 0, wipes: 0, timeouts: 0, heroes: {}, bonusHits: {}, aims: {}, bossStatus: {}, gear: {},
});

// --farm=training_1,ascension_2 (or --farm=all): farm dungeon encounters instead of tower floors
const farmArg = args.find(a => a.startsWith('--farm='))?.slice(7);
const floors = farmArg
  ? FARM_DUNGEONS.filter(d => farmArg === 'all' || farmArg.split(',').includes(d.id)).map(d => d.stage)
  : STAGES.filter(s => (onlyFloor != null ? s.floor === onlyFloor : s.floor >= 4 || flag('--all-floors')));
const summary: string[] = [];

for (let stage of floors) {
  if (tune) stage = { ...stage, monsterTuning: { hp: tune[0], atk: tune[1], def: tune[2] } };
  // power profile: --profile=X (A–F) or the floor's recommended profile; level = the profile's level clamped to the
  // floor band ('rec') or the given number
  const farmDef = stage.id ? FARM_BY_ID[stage.id] : undefined;
  // farm: the team that just cleared the unlock floor (that floor band's profile) at the dungeon's lower recommended level
  const band = farmDef ? { levels: farmDef.recommendedLevel, simProfile: FLOOR_BANDS[Math.max(1, farmDef.unlockFloor)].simProfile, role: farmDef.type, simLevel: farmDef.recommendedLevel[0] } as unknown as typeof FLOOR_BANDS[number] : FLOOR_BANDS[stage.floor];
  const profile = POWER_PROFILES[profileArg ?? band?.simProfile ?? 'A'];
  const level = levelArg === 'rec'
    ? (profileArg ? profile.level : band?.simLevel ?? Math.min(band?.levels[1] ?? profile.level, Math.max(band?.levels[0] ?? 1, profile.level)))
    : Number(levelArg);
  // --noaffix: the same gear without tactical affixes (affix ablation) · --affix=id: only that affix is removed
  const dropAffix = flag('--noaffix') ? () => true : (args.find(a => a.startsWith('--affix='))?.slice(8) ? (id?: string) => id === args.find(a => a.startsWith('--affix='))!.slice(8) : () => false);
  const heroes = state.heroes.map(h => applyProfile(h, profile, level)).map(h => ({
    ...h, gear: Object.fromEntries(Object.entries(h.gear ?? {}).map(([k, i]) => [k, i && dropAffix(i.affix) ? { ...i, affix: undefined } : i])),
  }));
  const aggs: Record<BotName, Agg> = { AUTO: newAgg(), TACTICAL: newAgg() };
  let heroSnapshot: string[] = [];
  const phaseIds: string[] = [];

  for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
    const a = aggs[bot];
    const team = bot === 'TACTICAL' && !flag('--noform') ? tacticalFormation(heroes, state.team, stage) : state.team;
    const allies = teamToUnits(team, heroes).map(u => {
      if (star == null) return u;
      const h = heroes.find(x => x.uid === u.heroUid)!;
      return { ...u, star, stats: heroStats({ ...HERO_BY_ID[h.templateId], star: star as 1 }, h) };
    });
    heroSnapshot = allies.map(u => `${u.name} (${u.cls}) ${u.star ?? '?'}★ Lv${level} HP ${u.stats.hp} ATK ${u.stats.atk} DEF ${u.stats.def} AS ${u.stats.atkSpeed} R ${u.stats.range}`);
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
      if (m.deaths > 0) a.deathRuns++;
      if (m.revives > 0) a.reviveRuns++;
      if (e.stageResult?.outcome === 'lose') a.wipes++;
      if (e.stageResult?.outcome === 'timeout' || (!e.result && e.time >= 400)) a.timeouts++;
      for (const u of e.units.filter(x => x.side === 'ally')) {
        const st = m.byUnit[u.id];
        if (!st) continue;
        const h = (a.heroes[u.name] ??= { dealt: 0, healed: 0, skills: 0, ults: 0, deaths: 0, revives: 0 });
        h.dealt += st.dealt; h.healed += st.healed; h.skills += st.skills; h.ults += st.ults; h.deaths += st.deaths; h.revives += st.revives;
      }
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
      for (const [id, n] of Object.entries(m.bonusHits)) a.bonusHits[id] = (a.bonusHits[id] ?? 0) + n;
      for (const [id, x] of Object.entries(m.skillAims)) {
        const t = (a.aims[id] ??= { total: 0, marked: 0 });
        t.total += x.total; t.marked += x.marked;
      }
      for (const [id, t] of Object.entries(m.bossStatusTime)) a.bossStatus[id] = (a.bossStatus[id] ?? 0) + t;
      for (const [id, n] of Object.entries(m.gearProcs)) a.gear[id] = (a.gear[id] ?? 0) + n;
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
  console.log(`\n=== ${farmDef ? farmDef.id : 'F' + stage.floor} ${stage.name} · profile ${profile.id} (${profile.label}: gear ${typeof profile.gear === 'object' && profile.gear ? JSON.stringify(profile.gear) : profile.gear ?? '-'}, ranks ${profile.ranks.skill}/${profile.ranks.skill2}/${profile.ranks.ult}) · ${star ?? 5}★ Lv${level} · band Lv${band?.levels.join('–')} ${band?.role ?? ''} · tuning ${JSON.stringify(stage.monsterTuning ?? {})} ===`);
  const review = monsterTuningReview(stage);
  if (review.length) console.log(`  ⚠ MECHANIC / COMPOSITION / HERO POWER REVIEW REQUIRED: ${review.join(', ')} (engine clamps to the limits)`);
  for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
    const a = aggs[bot];
    console.log(`  ${bot.padEnd(8)} win ${pct(a.wins / n)} · time ${f1(a.time / n, 0)}s · deaths ${f1(a.deaths / n, 2)}/run · runs with a death ${pct(a.deathRuns / n)} · with a revive ${pct(a.reviveRuns / n)} · wipes ${pct(a.wipes / n)} · timeouts ${pct(a.timeouts / n)} · waves ${f1(a.wave / n)}`);
  }
  summary.push(`${farmDef ? farmDef.id : 'F' + String(stage.floor).padEnd(2)} ${profile.id} Lv${String(level).padEnd(2)} | AUTO ${pct(A.wins / n)} (deaths ${f1(A.deaths / n)}) | TACTICAL ${pct(T.wins / n)} (deaths ${f1(T.deaths / n)})` +
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
      const statuses = ['ancient_protection', 'broken', 'guardian_empowered', 'guardian_enrage', 'ancient_rage', 'soul_link', 'dark_fog', 'bleed']
        .filter(id => a.status[id]).map(id => `${id} ${f1(a.status[id] / n, 2)}`).join(' · ');
      if (statuses) console.log(`     statuses: ${statuses}`);
      for (const [id, x] of Object.entries(a.aims)) {
        console.log(`     ${id} aimed ${f1(x.total / n, 2)}/run · at a marked (status) hero ${pct(x.total ? x.marked / x.total : 0)} · bonus-damage hits ${f1((a.bonusHits[id] ?? 0) / n, 2)}/run`);
      }
      const bs = Object.entries(a.bossStatus).filter(([id]) => id !== 'phase_shift').map(([id, t]) => `${id} ${f1(t / n, 1)}s`).join(' · ');
      if (bs && a.bossRuns) console.log(`     boss status uptime per run: ${bs} (boss lifetime ${f1(a.bossLife / a.bossRuns, 1)}s)`);
      const dh = Object.entries(a.heroes).map(([name, h]) => `${name} ${f1(h.deaths / n, 2)}`).join(' · ');
      console.log(`     deaths per hero per run: ${dh}`);
      const gp = Object.entries(a.gear).map(([id, v]) => `${id} ${f1(v / n, 1)}`).join(' · ');
      if (gp) console.log(`     gear procs per run: ${gp}`);
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
      console.log('       ' + Object.entries(a.heroes).map(([name, h]) =>
        `${name} DPS ${f1(h.dealt / a.fight, 0)} HPS ${f1(h.healed / a.fight, 1)} skills ${f1(h.skills / n)} ults ${f1(h.ults / n, 2)} deaths ${f1(h.deaths / n, 2)} revived ${f1(h.revives / n, 2)}`).join(' | '));
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

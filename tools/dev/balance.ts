/**
 * Balance sweep: AUTO bot vs TACTICAL bot (tools/dev/policy.ts), heroes at the stage's recommended level (or a fixed one).
 * Mechanic exposure first (did the boss / casters get time to act?), then win rate, decision metrics and power snapshots.
 * npm run balance -- [runs] [level|rec] [floor|-] [--profile=A–F (default: the floor's band profile)] [--metrics] [--exposure] [--power] [--star=N] [--tune=hp,atk,def]
 *   --metrics   decision metrics (interrupts, focus, positioning, break)
 *   --exposure  per-skill casts (started / completed / interrupted / broken) + boss lifetime / phases / statuses
 *   --power     hero + monster power snapshots (final stats, DPS, HPS, ult uses; authored vs tuned monster stats)
 *   --all-floors  also Stage 1–3 when no floor is given
 */
import { clearRating } from '../../src/app/core/rules/rewards';
import { BattleEngine, MONSTER_TUNING_LIMITS, monsterTuningReview } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { MONSTER_SKILLS, MONSTERS } from '../../src/app/core/data/monsters';
/** castStart / castDone carry the skill NAME — map back to ids */
const SKILL_ID_BY_NAME: Record<string, string> = Object.fromEntries(Object.values(MONSTER_SKILLS).map(d => [d.name, d.id]));
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
import { ENEMY_ZONE_START, distance } from '../../src/app/battle/engine/grid';

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
  mode?: { runs: number; kills: number; carriers: number; strikes: number; enraged: number; stars: number[]; fails: Record<string, number> };
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
  enc: Enc;
}
/** --encounter: pre-boss / Forest Oblivion / caster metrics (encounter rebalance spec) */
interface Enc {
  wave1: number; wave2: number; bossReach: number; deathsBeforeBoss: number; shadeBeforeBoss: number; shadeDeaths: number;
  hpAtBoss: number; gaugeAtBoss: number; aliveAtBoss: number;
  obl: { started: number; broken: number; completed: number; cancelled: number; breakSum: number; ends: number; deaths: number; runs1: number; wins1: number; runs2: number; wins2: number; p4: number; p4runs: number };
  stopsBy: Record<string, number>; breakHitsBy: Record<string, number>;
  casterDepth: number; casterDist: number; casterCasts: number; duration: number; winTime: number;
}
const newEnc = (): Enc => ({
  wave1: 0, wave2: 0, bossReach: 0, deathsBeforeBoss: 0, shadeBeforeBoss: 0, shadeDeaths: 0, hpAtBoss: 0, gaugeAtBoss: 0, aliveAtBoss: 0,
  obl: { started: 0, broken: 0, completed: 0, cancelled: 0, breakSum: 0, ends: 0, deaths: 0, runs1: 0, wins1: 0, runs2: 0, wins2: 0, p4: 0, p4runs: 0 },
  stopsBy: {}, breakHitsBy: {}, casterDepth: 0, casterDist: 0, casterCasts: 0, duration: 0, winTime: 0,
});
const newAgg = (): Agg => ({
  wins: 0, time: 0, deaths: 0, revives: 0, wave: 0, dealt: 0, taken: 0, heal: 0, opp: 0, att: 0, succ: 0, crit: 0,
  resHit: 0, resMiss: 0, focusUp: 0, unsafe: 0, anchor: 0, threatDeaths: 0, phase: 0, brk: 0, brkFail: 0, fight: 0, ults: 0,
  bossRuns: 0, bossLife: 0, bossKilled: 0, sealBroken: 0, skills: {}, phaseReached: {}, phaseTime: [], phaseTimeRuns: [], status: {},
  deathRuns: 0, reviveRuns: 0, wipes: 0, timeouts: 0, heroes: {}, bonusHits: {}, aims: {}, bossStatus: {}, gear: {}, enc: newEnc(),
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
    // --star=N develops every hero to N★ (stats + star perks, the same path as the game)
    const allies = teamToUnits(team, star == null ? heroes : heroes.map(h => ({ ...h, star })));
    heroSnapshot = allies.map(u => `${u.name} (${u.cls}) ${u.star ?? '?'}★ Lv${level} HP ${u.stats.hp} ATK ${u.stats.atk} DEF ${u.stats.def} AS ${u.stats.atkSpeed} R ${u.stats.range}`);
    for (let s = 1; s <= runs; s++) {
      const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: s, autoUlt: true });
      const tactical = bot === 'TACTICAL'
        ? new TacticalBot({ focus: !flag('--nofocus'), reserveInterrupts: !flag('--noreserve'), reserveHealerUlt: !flag('--nohealult'), interruptPriority: !flag('--noprio') })
        : null;
      // --encounter tracking (events as they happen)
      const E = a.enc;
      const cleared = new Set<number>();
      let bossSeen = false;
      let oblBreak = 0;
      let oblDone = 0;
      let oblHitAt = -1;
      let deathsThisTick: number[] = [];
      const heroOf = (id: number) => e.units.find(x => x.id === id);
      const unsub = e.subscribe(ev => {
        const t = ev.type as string;
        if (t === 'WAVE_CLEARED') cleared.add((ev as { wave: number }).wave);
        else if (t === 'death') {
          const u = heroOf((ev as { dst: number }).dst);
          if (u?.side !== 'ally') return;
          if (u.heroId === 'shade') E.shadeDeaths++;
          if (!bossSeen) { E.deathsBeforeBoss++; if (u.heroId === 'shade') E.shadeBeforeBoss++; }
          deathsThisTick.push(e.time);
          if (oblHitAt >= 0 && e.time - oblHitAt <= 0.3) E.obl.deaths++;
        } else if (t === 'interrupt' || t === 'broken') {
          const u = heroOf((ev as { src: number }).src);
          if (u?.side === 'ally') E.stopsBy[u.name] = (E.stopsBy[u.name] ?? 0) + 1;
          if (t === 'broken' && (ev as { skill: string }).skill === 'forest_oblivion') { E.obl.broken++; E.obl.breakSum += 100; E.obl.ends++; }
        } else if (t === 'breakGauge') {
          const g = ev as { src: number; skill: string; value: number };
          const u = heroOf(g.src);
          if (u?.side === 'ally') E.breakHitsBy[u.name] = (E.breakHitsBy[u.name] ?? 0) + 1;
          if (g.skill === 'forest_oblivion') oblBreak = g.value;
        } else if (t === 'castStart') {
          const c = { ...(ev as { src: number; skill: string }) };
          c.skill = SKILL_ID_BY_NAME[c.skill] ?? c.skill;
          if (c.skill === 'forest_oblivion') { E.obl.started++; oblBreak = 0; }
          const m = heroOf(c.src);
          if (m?.monster && ['dark_shaman', 'mist_witch', 'dark_shaman_ritual'].includes(m.monster.definitionId)) {
            const heroes = e.units.filter(x => x.side === 'ally' && x.alive);
            E.casterCasts++;
            E.casterDepth += m.pos.c - ENEMY_ZONE_START;
            E.casterDist += heroes.length ? Math.min(...heroes.map(h => distance(h.pos, m.pos))) : 0;
          }
        } else if (t === 'skillActivated' && (ev as { skill: string }).skill === 'forest_oblivion') {
          // the damage (and its deaths) is applied before this event in the same tick
          E.obl.deaths += deathsThisTick.filter(x => x >= e.time - 1e-9).length;
          oblHitAt = e.time + 1e-6;
        } else if (t === 'castDone' && SKILL_ID_BY_NAME[(ev as { skill: string }).skill] === 'forest_oblivion') {
          E.obl.completed++; oblDone++; E.obl.breakSum += oblBreak; E.obl.ends++;
        } else if (t === 'castCancel' && (ev as { skill: string }).skill === 'forest_oblivion') {
          E.obl.cancelled++; E.obl.breakSum += oblBreak; E.obl.ends++;
        }
      });
      while (!e.result && e.time < 400) {
        if (!bossSeen && e.metrics.bossSpawnedAt != null) {
          bossSeen = true;
          const party = e.units.filter(x => x.side === 'ally');
          E.bossReach++;
          E.hpAtBoss += party.reduce((q, x) => q + (x.alive ? x.hp : 0), 0) / party.reduce((q, x) => q + x.maxHp, 0);
          const alive = party.filter(x => x.alive);
          E.aliveAtBoss += alive.length;
          E.gaugeAtBoss += alive.length ? alive.reduce((q, x) => q + x.mana / x.maxMana, 0) / alive.length : 0;
        }
        tactical?.tick(e);
        deathsThisTick = [];
        e.step(0.05);
        for (const ev of e.drainEvents()) {
          if (ev.type === 'cast' && (ev as { kind?: string }).kind === 'ult' && e.units.find(u => u.id === ev.src)?.side === 'ally') a.ults++;
        }
      }
      unsub();
      if (cleared.has(0)) E.wave1++;
      if (cleared.has(1)) E.wave2++;
      E.duration += e.time;
      if (e.result === 'win') E.winTime += e.time;
      if (oblDone >= 1) { E.obl.runs1++; if (e.result === 'win') E.obl.wins1++; }
      if (oblDone >= 2) { E.obl.runs2++; if (e.result === 'win') E.obl.wins2++; }
      const pd = e.metrics.phaseDurations(e.time);
      if (pd.length >= 4 && e.metrics.bossPhases.length >= 3) { E.obl.p4 += pd[3]; E.obl.p4runs++; }
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
      // special modes (farm dungeons): what the run scored
      const ms = e.stageResult?.mode;
      if (ms) {
        const x = (a.mode ??= { runs: 0, kills: 0, carriers: 0, strikes: 0, enraged: 0, stars: [0, 0, 0, 0], fails: {} as Record<string, number> });
        x.runs++;
        x.kills += ms.kills;
        x.carriers += ms.carriersKilled;
        x.strikes += ms.strikes;
        if (ms.enraged) x.enraged++;
        if (e.stageResult?.failReason) x.fails[e.stageResult.failReason] = (x.fails[e.stageResult.failReason] ?? 0) + 1;
        if (e.result === 'win' && farmDef) x.stars[clearRating(farmDef, { deaths: m.deaths, time: e.fightTime, mode: ms })]++;
      }
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
  console.log(`\n=== ${farmDef ? farmDef.id : 'F' + stage.floor} ${stage.name} · profile ${profile.id} (${profile.label}: gear ${typeof profile.gear === 'object' && profile.gear ? JSON.stringify(profile.gear) : profile.gear ?? '-'}, ranks ${profile.skillProfile ?? `${profile.ranks.skill}/${profile.ranks.skill2}/${profile.ranks.ult}`}) · ${star ?? 5}★ Lv${level} · band Lv${band?.levels.join('–')} ${band?.role ?? ''} · tuning ${JSON.stringify(stage.monsterTuning ?? {})} ===`);
  const review = monsterTuningReview(stage);
  if (review.length) console.log(`  ⚠ MECHANIC / COMPOSITION / HERO POWER REVIEW REQUIRED: ${review.join(', ')} (engine clamps to the limits)`);
  for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
    const a = aggs[bot];
    console.log(`  ${bot.padEnd(8)} win ${pct(a.wins / n)} · time ${f1(a.time / n, 0)}s · deaths ${f1(a.deaths / n, 2)}/run · runs with a death ${pct(a.deathRuns / n)} · with a revive ${pct(a.reviveRuns / n)} · wipes ${pct(a.wipes / n)} · timeouts ${pct(a.timeouts / n)} · waves ${f1(a.wave / n)}`);
    const x = a.mode;
    if (x) {
      const fails = Object.entries(x.fails).map(([k, v]) => `${k} ${pct(v / n)}`).join(', ');
      console.log(`  ${''.padEnd(8)} MODE ${stage.special?.kind}: fight ${f1(a.fight / n, 0)}s · kills ${f1(x.kills / n)} · carriers ${f1(x.carriers / n, 2)} · strikes ${f1(x.strikes / n, 2)} · enraged ${pct(x.enraged / n)} · stars 1/2/3 ${x.stars.slice(1).join('/')}${fails ? ' · fails: ' + fails : ''}`);
    }
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

  if (flag('--encounter')) {
    for (const bot of ['AUTO', 'TACTICAL'] as BotName[]) {
      const a = aggs[bot];
      const E = a.enc;
      const o = E.obl;
      const sk = (id: string) => { const x = a.skills[id]; return x ? `${f1(x.started / n, 2)}/${f1(x.completed / n, 2)}/${f1(x.interrupted / n, 2)}` : '-'; };
      console.log(`  -- encounter ${bot} (${n} runs): win ${pct(a.wins / n)} · duration ${f1(E.duration / n, 0)}s (wins ${f1(a.wins ? E.winTime / a.wins : 0, 0)}s) · deaths ${f1(a.deaths / n, 2)} · revives ${f1(a.revives / n, 2)}`);
      console.log(`     casts started/completed/interrupted per run: dark_heal ${sk('dark_heal')} · soul_link ${sk('soul_link')} · nightmare ${sk('nightmare')} · dark_fog ${sk('dark_fog')} · sacrifice ${sk('sacrifice')}`);
      if (E.casterCasts) console.log(`     casters at cast start: depth ${f1(E.casterDepth / E.casterCasts, 2)} (0 = front of enemy zone) · nearest hero ${f1(E.casterDist / E.casterCasts, 2)} cells`);
      console.log(`     stops (interrupt / break) per run by hero: ${Object.entries(E.stopsBy).map(([k, v]) => `${k} ${f1(v / n, 2)}`).join(' · ') || '-'} · break hits: ${Object.entries(E.breakHitsBy).map(([k, v]) => `${k} ${f1(v / n, 2)}`).join(' · ') || '-'}`);
      console.log(`     wave 1 survived ${pct(E.wave1 / n)} · wave 2 survived ${pct(E.wave2 / n)} · boss reached ${pct(E.bossReach / n)} · deaths before boss ${f1(E.deathsBeforeBoss / n, 2)} (Shade ${f1(E.shadeBeforeBoss / n, 2)}; Shade total ${f1(E.shadeDeaths / n, 2)})` +
        (E.bossReach ? ` · entering boss: team HP ${pct(E.hpAtBoss / E.bossReach)} · alive ${f1(E.aliveAtBoss / E.bossReach, 2)} · ult gauge ${pct(E.gaugeAtBoss / E.bossReach)}` : ''));
      if (o.started) {
        console.log(`     Forest Oblivion: started ${f1(o.started / n, 2)}/run · broken ${pct(o.broken / o.started)} · landed ${pct(o.completed / o.started)} · cancelled ${pct(o.cancelled / o.started)} · avg Break at cast end ${f1(o.ends ? o.breakSum / o.ends : 0, 1)}` +
          ` · deaths from it ${f1(o.deaths / n, 2)}/run · runs with ≥1 landed ${pct(o.runs1 / n)} → won ${pct(o.runs1 ? o.wins1 / o.runs1 : 0)} · ≥2 landed ${pct(o.runs2 / n)} → won ${pct(o.runs2 ? o.wins2 / o.runs2 : 0)}` +
          ` · boss lifetime ${f1(a.bossRuns ? a.bossLife / a.bossRuns : 0, 1)}s · phase 4 ${f1(o.p4runs ? o.p4 / o.p4runs : 0, 1)}s`);
      }
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

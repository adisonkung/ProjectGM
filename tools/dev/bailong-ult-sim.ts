/**
 * Bai Long — target-locked areas (old) vs ground-targeted cells in front (new), normal battles.
 *   npm run bailong-ult-sim -- [runs=40] [level=10]
 * OLD  S1 LINE_2 on the target 180 / 120 · S2 3 × 3 around himself 170 / 100 · ult 3 × 3 around the target 280 / 140
 * NEW  S1 [main][main] ahead 180 · S2 column in front 170 · ult cross in front 280 main / 140 splash
 * Reported per floor: win %, time, casts and units hit per cast for S1 / S2 / ult (per strike), Bai Long damage share.
 */
import { BattleEngine, BattleEvent } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { CLASS_KITS, HERO_DEFINITIONS } from '../../src/app/core/data/hero-skills';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { teamToUnits } from '../../src/app/core/rules/team';
import { HeroKit } from '../../src/app/core/models/combat';

declare const process: { argv: string[] };
const runs = Number(process.argv[2] ?? 40);
const level = Number(process.argv[3] ?? 10);
// 'refill': Bai Long's ult gauge refills after every ult (many casts per battle → ult hit stats; win % not balance)
const refill = process.argv[4] === 'refill';

const NEW = HERO_DEFINITIONS['bailong'].kit;
const f = CLASS_KITS.fighter;
const OLD: HeroKit = {
  ...NEW,
  skill: { ...f.skill2, slot: 'skill', name: NEW.skill.name, label: NEW.skill.label },
  skill2: { ...f.skill, slot: 'skill2', name: NEW.skill2.name, label: NEW.skill2.label },
  ult: { ...f.ult, name: NEW.ult.name, label: NEW.ult.label, repeat: NEW.ult.repeat },
};

const state = newGameState();
const heroes = state.heroes.map(h => ({ ...h, level, ...(h.templateId === 'jin' ? { templateId: 'bailong' } : {}) }));
const allies = teamToUnits(state.team, heroes);
const pad = (s: string | number, n: number) => String(s).padStart(n);
console.log(`Bai Long areas — ${runs} runs / floor, team Lv${level} (Jin's slot → Bai Long), AUTO ult\n`);
const avg: Record<string, number[]> = {};
for (const [name, kit] of [['OLD', OLD], ['NEW', NEW]] as const) {
  (HERO_DEFINITIONS['bailong'] as { kit: HeroKit }).kit = kit;
  console.log(`== ${name}`);
  console.log(' floor  win%  time   S1 n/hit   S2 n/hit   ult n/hit(strike)  stacked%  BL dmg%');
  const tot = new Array(10).fill(0);
  for (const stage of STAGES) {
    const n = { s1: 0, s1h: 0, s2: 0, s2h: 0, u: 0, uh: 0, st: 0, stk: 0 };
    let wins = 0, time = 0, bl = 0, all = 0;
    for (let s = 1; s <= runs; s++) {
      const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed: s, autoUlt: true });
      const me = e.units.find(u => u.heroId === 'bailong')!;
      e.subscribe((ev: BattleEvent) => {
        if (ev.type !== 'impact' || ev.src !== me.id) return;
        const h = ev.hits ?? [];
        if (ev.kind === 'skill') (n.s1++, n.s1h += h.length);
        if (ev.kind === 'skill2') (n.s2++, n.s2h += h.length);
        if (ev.kind === 'ult') {
          if ((ev.index ?? 0) === 0) n.u++;
          n.st++; n.uh += h.length;
          const cells = new Map<string, number>();
          for (const id of h) { const u = e.units.find(x => x.id === id); if (u) cells.set(`${u.pos.r},${u.pos.c}`, (cells.get(`${u.pos.r},${u.pos.c}`) ?? 0) + 1); }
          if ([...cells.values()].some(k => k >= 2)) n.stk++;
        }
      });
      while (!e.result && e.time < 300) {
        e.step(0.05);
        if (refill && me.alive && e.time > 1) me.mana = me.maxMana;
      }
      if (e.result === 'win') wins++;
      time += e.time;
      bl += e.metrics.byUnit[me.id]?.dealt ?? 0;
      all += e.units.filter(u => u.side === me.side).reduce((a, u) => a + (e.metrics.byUnit[u.id]?.dealt ?? 0), 0);
    }
    const r = (a: number, b: number) => (b ? a / b : 0);
    const row = [wins / runs * 100, time / runs, n.s1 / runs, r(n.s1h, n.s1), n.s2 / runs, r(n.s2h, n.s2), n.u / runs, r(n.uh, n.st), r(n.stk, n.st) * 100, r(bl, all) * 100];
    row.forEach((v, i) => (tot[i] += v));
    console.log(` F${pad(stage.floor, 2)}  ${pad(row[0].toFixed(0), 4)}  ${pad(row[1].toFixed(0), 4)}  ${pad(row[2].toFixed(1), 4)}/${row[3].toFixed(2)}  ${pad(row[4].toFixed(1), 4)}/${row[5].toFixed(2)}  ${pad(row[6].toFixed(2), 6)}/${row[7].toFixed(2)}         ${pad(row[8].toFixed(0), 4)}     ${pad(row[9].toFixed(1), 5)}`);
  }
  avg[name] = tot.map(v => v / STAGES.length);
}
console.log('\n== average over floors (win · time · S1 casts/hits · S2 casts/hits · ult casts/hits per strike · BL dmg share)');
for (const [k, r] of Object.entries(avg))
  console.log(` ${k}  win ${r[0].toFixed(0)}% · ${r[1].toFixed(0)}s · S1 ${r[2].toFixed(1)}×${r[3].toFixed(2)} · S2 ${r[4].toFixed(1)}×${r[5].toFixed(2)} · ult ${r[6].toFixed(2)}×${r[7].toFixed(2)} · BL ${r[9].toFixed(1)}%`);

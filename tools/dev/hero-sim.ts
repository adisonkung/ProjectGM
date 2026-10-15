/**
 * ตัวจำลองการต่อสู้ของฮีโร่ชุดจริงในเกม (ไม่ใช่ legacy roster) — ให้เอนจินสู้เองหลายร้อยรอบแล้วสรุป:
 *   1) ไล่ชั้น 1–10 ด้วยทีมเริ่มต้น: อัตราชนะ AUTO (ปล่อย AI เล่นเอง) / TACTICAL (บอทเล่นแบบผู้เล่นเก่ง), เวลา, ตาย, หมดเวลา
 *      ระดับ/อุปกรณ์/ดาว ตาม FLOOR_BANDS ของแต่ละชั้น (โปรไฟล์ A–E เดียวกับ `npm run balance`)
 *   2) ฮีโร่แต่ละตัว: ส่วนแบ่งดาเมจ / ฮีล, ตายต่อรอบ, อัลติต่อรอบ
 *   3) --combos: ทีม 5 จาก 7 ทุกแบบ (21 ทีม) บนชั้นที่เลือก → ฮีโร่ตัวไหน "มีแล้วชนะเพิ่ม" กี่ % (ผลต่างอัตราชนะ มี − ไม่มี)
 *   ธง: ชั้นที่ยากกระโดด (อัตราชนะตกเกิน 35 แต้มจากชั้นก่อน), ชั้นที่ชนะ 100 % ทั้งที่เป็นด่านกำแพง, ฮีโร่ที่แรง/อ่อนเกิน
 * npm run hero-sim -- [runs=30] [--combos] [--floors=7-10] [--bot=AUTO|TACTICAL|both] [--team=kael,linxue,...] [--lv=N|+N] [--html]
 *   --nosprite  heroes without their sprite timing (token timing) — measures what the animation lengths cost
 *   --stats  print the team's final stats per floor
 *   --lv=+1  every floor one level above its recommendation (does a wall open with one more level?)
 *   --html  เขียนรายงาน dist/sim-report/hero-sim.html (+ .json)
 */
import { BattleEngine } from '../../src/app/battle/engine/battle-engine';
import { TacticalBot, tacticalFormation } from '../../src/app/battle/engine/bots/tactical-bot';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { HERO_BY_ID, HEROES } from '../../src/app/core/data/heroes';
import { FLOOR_BANDS, POWER_PROFILES } from '../../src/app/core/data/progression';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { StageDef } from '../../src/app/core/models/stage';
import { OwnedHero } from '../../src/app/core/models/hero';
import { applyProfile } from '../../src/app/core/rules/progression';
import { autoPlace, teamToUnits } from '../../src/app/core/rules/team';

declare const process: { argv: string[]; hrtime: { bigint(): bigint } };
declare function require(m: string): { mkdirSync(p: string, o: object): void; writeFileSync(p: string, d: string): void };

const args = process.argv.slice(2);
const opt = (k: string) => args.find(a => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const runs = Number(args.find(a => !a.startsWith('--')) ?? 30);
const bots: Bot[] = (opt('bot') ?? 'both') === 'both' ? ['AUTO', 'TACTICAL'] : [opt('bot') as Bot];
const range = (s: string) => {
  const [a, b] = s.split('-').map(Number);
  return STAGES.filter(st => st.floor >= a && st.floor <= (b ?? a));
};
type Bot = 'AUTO' | 'TACTICAL';

/** shipped roster (every playable hero) */
const ROSTER = HEROES.map(h => h.id);
const state = newGameState();

// ------------------------------------------------------------------ one batch of battles
export interface HeroAgg {
  dealt: number;
  healed: number;
  deaths: number;
  ults: number;
  skills: number;
  attacks: number;
  runs: number;
}
export interface Batch {
  wins: number;
  timeouts: number;
  runs: number;
  time: number;
  deaths: number;
  heroes: Record<string, HeroAgg>;
}

/** the floor's development (level / gear / skill ranks) — the same 'rec' rule as `npm run balance` */
function developed(stage: StageDef, ids: string[]): { heroes: OwnedHero[]; level: number; profile: string } {
  const band = FLOOR_BANDS[stage.floor];
  const profile = POWER_PROFILES[band?.simProfile ?? 'A'];
  const lvArg = opt('lv');
  const rec = band?.simLevel ?? Math.min(band?.levels[1] ?? profile.level, Math.max(band?.levels[0] ?? 1, profile.level));
  // --lv=N fixed level · --lv=+N the floor's recommended level + N (how many levels would fix a wall?)
  const level = lvArg ? (/^[+-]/.test(lvArg) ? Math.max(1, rec + Number(lvArg)) : Number(lvArg)) : rec;
  const owned = ids.map((templateId, i) => state.heroes.find(h => h.templateId === templateId) ?? { ...state.heroes[0], uid: 100 + i, templateId });
  return { heroes: owned.map(h => applyProfile(h, profile, level)), level, profile: band?.simProfile ?? 'A' };
}

function battle(stage: StageDef, ids: string[], bot: Bot, n: number): Batch {
  const { heroes } = developed(stage, ids);
  const base = autoPlace(heroes);
  const team = bot === 'TACTICAL' ? tacticalFormation(heroes, base, stage) : base;
  // --nosprite: the same heroes with token timing (no clip lengths) — is the art's timing what costs DPS?
  const allies = teamToUnits(team, heroes).map(u => (args.includes('--nosprite') ? { ...u, sprite: undefined } : u));
  if (args.includes('--stats') && bot === bots[0] && n === runs)
    console.log(`  F${stage.floor} ` + allies.map(u => `${u.name} ${u.star}★ HP ${u.stats.hp} ATK ${u.stats.atk} DEF ${u.stats.def} AS ${u.stats.atkSpeed} R ${u.stats.range}`).join(' | '));
  const b: Batch = { wins: 0, timeouts: 0, runs: 0, time: 0, deaths: 0, heroes: {} };
  for (let seed = 1; seed <= n; seed++) {
    const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed, autoUlt: true });
    const tb = bot === 'TACTICAL' ? new TacticalBot({ focus: true, reserveInterrupts: true, reserveHealerUlt: true, interruptPriority: true }) : null;
    const atk: Record<number, number> = {};
    while (!e.result && e.time < 300) {
      tb?.tick(e);
      e.step(0.05);
      for (const ev of e.drainEvents()) if (ev.type === 'attack') atk[ev.src] = (atk[ev.src] ?? 0) + 1;
    }
    const res = e.result ?? 'timeout';
    b.runs++;
    if (res === 'win') b.wins++;
    if (res === 'timeout' || (res !== 'win' && e.time >= (stage.timeLimit ?? 1e9) - 0.1)) b.timeouts++;
    b.time += e.time;
    b.deaths += e.metrics.deaths;
    for (const u of e.units) {
      if (u.side !== 'ally' || !u.heroId) continue;
      const s = e.metrics.byUnit[u.id];
      const h = (b.heroes[u.heroId] ??= { dealt: 0, healed: 0, deaths: 0, ults: 0, skills: 0, attacks: 0, runs: 0 });
      h.skills += s?.skills ?? 0;
      h.attacks += atk[u.id] ?? 0;
      h.runs++;
      h.dealt += s?.dealt ?? 0;
      h.healed += s?.healed ?? 0;
      h.deaths += s?.deaths ?? 0;
      h.ults += s?.ults ?? 0;
    }
  }
  if (args.includes('--stats') && bot === bots[0] && n === runs) {
    const T = b.time;
    console.log(`     ${bot} DPS ` + Object.entries(b.heroes).map(([id, h]) => `${HERO_BY_ID[id].name} ${(h.dealt / T).toFixed(0)}${h.healed ? ` (HPS ${(h.healed / T).toFixed(0)})` : ''} ตี/วิ ${(h.attacks / T).toFixed(2)} sk ${(h.skills / h.runs).toFixed(1)} ult ${(h.ults / h.runs).toFixed(1)} ตาย ${(h.deaths / h.runs).toFixed(2)}`).join(' | ') + ` · ทีม ${(Object.values(b.heroes).reduce((x, h) => x + h.dealt, 0) / T).toFixed(0)}`);
  }
  return b;
}

// ------------------------------------------------------------------ report helpers
const pct = (x: number) => `${Math.round(x * 100)}%`;
const name = (id: string) => `${HERO_BY_ID[id]?.name ?? id} (${id})`;
const combos = <T>(xs: T[], k: number): T[][] =>
  k === 0 ? [[]] : xs.flatMap((x, i) => combos(xs.slice(i + 1), k - 1).map(c => [x, ...c]));

interface FloorRow {
  floor: number;
  name: string;
  role: string;
  level: number;
  profile: string;
  bots: Partial<Record<Bot, { win: number; time: number; deaths: number; timeouts: number }>>;
  flags: string[];
}

const t0 = process.hrtime.bigint();
const teamIds = opt('team')?.split(',') ?? state.team.map(s => state.heroes.find(h => h.uid === s.uid)!.templateId);
for (const id of [...teamIds, ...ROSTER]) if (!HERO_BY_ID[id]) throw new Error(`unknown hero ${id}`);

// 1) floor sweep
const floors = opt('floors') ? range(opt('floors')!) : STAGES.filter(s => s.floor >= 1 && s.floor <= 10);
const rows: FloorRow[] = [];
const heroTotals: Record<string, HeroAgg & { teamDealt: number; teamHealed: number }> = {};
console.log(`\nทีม: ${teamIds.map(name).join(', ')} · ${runs} รอบ/ชั้น/บอท\n`);
console.log('ชั้น  บทบาท        Lv โปรไฟล์ ' + bots.map(b => `${b.padEnd(8)} ชนะ  เวลา  ตาย`).join(' | '));
for (const stage of floors) {
  const band = FLOOR_BANDS[stage.floor];
  const { level, profile } = developed(stage, teamIds);
  const row: FloorRow = { floor: stage.floor, name: stage.name ?? "", role: String(band?.role ?? '-'), level, profile, bots: {}, flags: [] };
  for (const bot of bots) {
    const b = battle(stage, teamIds, bot, runs);
    row.bots[bot] = { win: b.wins / b.runs, time: b.time / b.runs, deaths: b.deaths / b.runs, timeouts: b.timeouts / b.runs };
    if (bot === bots[0]) {
      const td = Object.values(b.heroes).reduce((s, h) => s + h.dealt, 0);
      const th = Object.values(b.heroes).reduce((s, h) => s + h.healed, 0);
      for (const [id, h] of Object.entries(b.heroes)) {
        const t = (heroTotals[id] ??= { dealt: 0, healed: 0, deaths: 0, ults: 0, skills: 0, attacks: 0, runs: 0, teamDealt: 0, teamHealed: 0 });
        t.dealt += h.dealt;
        t.healed += h.healed;
        t.deaths += h.deaths;
        t.ults += h.ults;
        t.runs += h.runs;
        t.teamDealt += td;
        t.teamHealed += th;
      }
    }
  }
  rows.push(row);
}
// flags
for (let i = 0; i < rows.length; i++) {
  const r = rows[i];
  const prev = rows[i - 1];
  for (const bot of bots) {
    const w = r.bots[bot]!.win;
    if (prev && prev.bots[bot]!.win - w >= 0.35) r.flags.push(`${bot}: ยากกระโดด (${pct(prev.bots[bot]!.win)} → ${pct(w)})`);
    if ((r.role === 'WALL' || r.role === 'ENDGAME') && w >= 0.999) r.flags.push(`${bot}: ด่าน${r.role === 'WALL' ? 'กำแพง' : 'ท้าย'}แต่ชนะ 100 %`);
    if (r.bots[bot]!.timeouts >= 0.25) r.flags.push(`${bot}: หมดเวลา ${pct(r.bots[bot]!.timeouts)}`);
  }
  if (r.role === 'ONBOARDING' && r.bots[bots[0]]!.win < 0.9) r.flags.push(`ด่านสอนเล่นแต่ ${bots[0]} ชนะแค่ ${pct(r.bots[bots[0]]!.win)}`);
  const cells = bots.map(b => {
    const s = r.bots[b]!;
    return `${pct(s.win).padStart(13)} ${s.time.toFixed(0).padStart(5)}s ${s.deaths.toFixed(1).padStart(4)}`;
  });
  console.log(`F${String(r.floor).padEnd(3)} ${r.role.padEnd(12)} ${String(r.level).padStart(2)} ${r.profile.padEnd(7)} ${cells.join(' | ')}${r.flags.length ? '  ⚑ ' + r.flags.join(' · ') : ''}`);
}

// 2) heroes in the team
console.log(`\nฮีโร่ในทีม (${bots[0]}, ทุกชั้นรวมกัน)`);
const heroRows = Object.entries(heroTotals).map(([id, h]) => ({
  id,
  dmgShare: h.teamDealt ? h.dealt / h.teamDealt : 0,
  healShare: h.teamHealed ? h.healed / h.teamHealed : 0,
  deaths: h.deaths / h.runs,
  ults: h.ults / h.runs,
}));
for (const h of heroRows.sort((a, b) => b.dmgShare - a.dmgShare)) {
  console.log(`  ${name(h.id).padEnd(26)} ดาเมจ ${pct(h.dmgShare).padStart(4)}  ฮีล ${pct(h.healShare).padStart(4)}  ตาย/รอบ ${h.deaths.toFixed(2)}  อัลติ/รอบ ${h.ults.toFixed(1)}`);
}

// 3) every 5-of-7 team
interface ComboRow { ids: string[]; win: number }
const comboRows: ComboRow[] = [];
const impact: { id: string; with: number; without: number; delta: number }[] = [];
if (args.includes('--combos')) {
  const cf = opt('floors') ? floors : range('7-10');
  const bot = bots[bots.length - 1];
  const n = Math.max(6, Math.round(runs / 2));
  console.log(`\nทุกทีม 5 จาก ${ROSTER.length} (${bot}, ชั้น ${cf.map(s => s.floor).join(',')}, ${n} รอบ/ชั้น)`);
  for (const ids of combos(ROSTER, Math.min(5, ROSTER.length))) {
    let w = 0;
    for (const st of cf) w += battle(st, ids, bot, n).wins / n;
    comboRows.push({ ids, win: w / cf.length });
  }
  comboRows.sort((a, b) => b.win - a.win);
  for (const c of comboRows) console.log(`  ${pct(c.win).padStart(4)}  ${c.ids.map(i => HERO_BY_ID[i].name).join(', ')}`);
  for (const id of ROSTER) {
    const yes = comboRows.filter(c => c.ids.includes(id));
    const no = comboRows.filter(c => !c.ids.includes(id));
    const avg = (xs: ComboRow[]) => (xs.length ? xs.reduce((s, c) => s + c.win, 0) / xs.length : 0);
    impact.push({ id, with: avg(yes), without: avg(no), delta: avg(yes) - avg(no) });
  }
  impact.sort((a, b) => b.delta - a.delta);
  console.log('\nผลต่อทีม (อัตราชนะเฉลี่ยของทีมที่มี − ไม่มี ฮีโร่ตัวนั้น)');
  for (const x of impact) {
    const tag = x.without <= 0.02 && x.with > 0.05 ? '  ⚑ ขาดไม่ได้ (ทีมที่ไม่มีแทบไม่ชนะ)' : x === impact[impact.length - 1] && x.delta < -0.05 ? '  ⚑ ช่วยทีมน้อยสุด — ควรดู' : '';
    console.log(`  ${name(x.id).padEnd(26)} ${(x.delta >= 0 ? '+' : '') + Math.round(x.delta * 100)} แต้ม  (มี ${pct(x.with)} / ไม่มี ${pct(x.without)})${tag}`);
  }
}
const sec = Number(process.hrtime.bigint() - t0) / 1e9;
console.log(`\nใช้เวลา ${sec.toFixed(1)} วิ`);

// ------------------------------------------------------------------ HTML report
if (args.includes('--html')) {
  const fs = require('fs');
  fs.mkdirSync('dist/sim-report', { recursive: true });
  const data = { at: new Date().toISOString(), runs, team: teamIds, bots, rows, heroes: heroRows, combos: comboRows, impact };
  fs.writeFileSync('dist/sim-report/hero-sim.json', JSON.stringify(data, null, 2));
  fs.writeFileSync('dist/sim-report/hero-sim.html', html(data));
  console.log('รายงาน: dist/sim-report/hero-sim.html');
}

function html(d: { at: string; runs: number; team: string[]; bots: Bot[]; rows: FloorRow[]; heroes: typeof heroRows; combos: ComboRow[]; impact: typeof impact }): string {
  const bar = (x: number, color: string) =>
    `<div class="bar"><i style="width:${Math.round(x * 100)}%;background:${color}"></i><span>${pct(x)}</span></div>`;
  const winColor = (x: number) => (x >= 0.8 ? '#4fbf7a' : x >= 0.4 ? '#e3b341' : '#e5534b');
  const esc = (s: string) => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const floorRows = d.rows
    .map(
      r => `<tr${r.flags.length ? ' class="flag"' : ''}><td>F${r.floor}</td><td>${esc(r.name)}<small>${r.role} · Lv${r.level} · โปรไฟล์ ${r.profile}</small></td>${d.bots
        .map(b => {
          const s = r.bots[b]!;
          return `<td>${bar(s.win, winColor(s.win))}<small>${s.time.toFixed(0)} วิ · ตาย ${s.deaths.toFixed(1)}${s.timeouts ? ` · หมดเวลา ${pct(s.timeouts)}` : ''}</small></td>`;
        })
        .join('')}<td>${r.flags.map(f => `<div class="f">⚑ ${esc(f)}</div>`).join('')}</td></tr>`,
    )
    .join('');
  const heroRowsHtml = d.heroes
    .map(h => `<tr><td>${esc(name(h.id))}</td><td>${bar(h.dmgShare, '#d9734b')}</td><td>${bar(h.healShare, '#4fbf7a')}</td><td>${h.deaths.toFixed(2)}</td><td>${h.ults.toFixed(1)}</td></tr>`)
    .join('');
  const impactHtml = d.impact.length
    ? `<h2>ฮีโร่ตัวไหนช่วยทีมมากสุด</h2><p class="note">อัตราชนะเฉลี่ยของทุกทีมที่มีฮีโร่ตัวนั้น ลบด้วยทีมที่ไม่มี (ทีม 5 จาก ${ROSTER.length} ทุกแบบ)</p><table><tr><th>ฮีโร่</th><th>ผลต่อทีม</th><th>มี</th><th>ไม่มี</th><th></th></tr>${d.impact
        .map(x => `<tr><td>${esc(name(x.id))}</td><td class="${x.delta >= 0 ? 'up' : 'down'}">${x.delta >= 0 ? '+' : ''}${Math.round(x.delta * 100)} แต้ม</td><td>${pct(x.with)}</td><td>${pct(x.without)}</td><td class="f">${x.without <= 0.02 && x.with > 0.05 ? 'ขาดไม่ได้' : x === d.impact[d.impact.length - 1] && x.delta < -0.05 ? 'ช่วยทีมน้อยสุด — ควรดู' : ''}</td></tr>`)
        .join('')}</table><h2>ทุกทีม</h2><table><tr><th>ชนะ</th><th>ทีม</th></tr>${d.combos
        .map(c => `<tr><td>${bar(c.win, winColor(c.win))}</td><td>${c.ids.map(i => esc(HERO_BY_ID[i].name)).join(', ')}</td></tr>`)
        .join('')}</table>`
    : '';
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hero Sim Report</title>
<style>
:root{--bg:#14161c;--card:#1d2029;--fg:#e8e6e1;--mut:#9aa0ab;--line:#2c303b}
@media (prefers-color-scheme: light){:root{--bg:#f6f4ef;--card:#fff;--fg:#1d1f24;--mut:#666;--line:#e3e0d8}}
body{margin:0;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,'IBM Plex Sans Thai',sans-serif;padding:16px}
main{max-width:1000px;margin:auto}h1{font-size:20px}h2{font-size:16px;margin-top:28px}.note,small{color:var(--mut)}small{display:block;font-size:12px}
table{width:100%;border-collapse:collapse;background:var(--card);border-radius:10px;overflow:hidden}th,td{padding:8px 10px;border-bottom:1px solid var(--line);text-align:left;vertical-align:top}
th{font-size:12px;color:var(--mut);font-weight:600}tr.flag td:first-child{box-shadow:inset 3px 0 #e5534b}.f{color:#e5534b;font-size:12px}
.bar{position:relative;height:18px;background:var(--line);border-radius:4px;min-width:90px}.bar i{position:absolute;inset:0 auto 0 0;border-radius:4px}.bar span{position:relative;padding-left:6px;font-size:12px;font-weight:600}
.up{color:#4fbf7a;font-weight:600}.down{color:#e5534b;font-weight:600}.wrap{overflow-x:auto}
</style></head><body><main>
<h1>รายงานจำลองการต่อสู้</h1>
<p class="note">${new Date(d.at).toLocaleString('th-TH')} · ${d.runs} รอบต่อชั้นต่อบอท · ทีม: ${d.team.map(i => esc(HERO_BY_ID[i].name)).join(', ')}<br>
AUTO = ปล่อย AI เล่นเอง · TACTICAL = บอทเล่นแบบผู้เล่นเก่ง (โฟกัส ตัดร่าย เก็บอัลติ จัดแถว) · ระดับ/อุปกรณ์ตามที่แนะนำของแต่ละชั้น</p>
<h2>อัตราชนะรายชั้น</h2><div class="wrap"><table><tr><th>ชั้น</th><th>ด่าน</th>${d.bots.map(b => `<th>${b}</th>`).join('')}<th>ข้อสังเกต</th></tr>${floorRows}</table></div>
<h2>ฮีโร่ในทีม</h2><p class="note">${d.bots[0]} ทุกชั้นรวมกัน · ส่วนแบ่งดาเมจ / ฮีลของทั้งทีม</p>
<div class="wrap"><table><tr><th>ฮีโร่</th><th>ดาเมจ</th><th>ฮีล</th><th>ตาย/รอบ</th><th>อัลติ/รอบ</th></tr>${heroRowsHtml}</table></div>
${impactHtml}
</main></body></html>`;
}

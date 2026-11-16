/**
 * Motion audit — does the body slide while an action clip plays, and does walking stall?
 * Runs real battles of the shipped starter team and measures, per tick, the drawn position (x / y) of every unit:
 *   START-MOVING  an attack / skill clip began while the body was still travelling
 *   SLIDE         distance the body moved while its attack / skill clip was playing (dashes of skills are excluded)
 *   STALL         a walking body that stopped for 1–3 ticks and then went on (stop-and-go)
 *   SPEED JUMP    tick-to-tick change of walking speed above 50 % of the unit's move speed
 * npm run motion-audit -- [floors=1,3,5,8] [seeds=5] [--verbose]
 */
import { BattleEngine, BattleUnit } from '../../src/app/battle/engine/battle-engine';
import { ENEMIES } from '../../src/app/core/data/enemies';
import { FLOOR_BANDS, POWER_PROFILES } from '../../src/app/core/data/progression';
import { animTiming } from '../../src/app/core/data/sprites';
import { STAGES } from '../../src/app/core/data/stages';
import { newGameState } from '../../src/app/core/data/starter';
import { applyProfile } from '../../src/app/core/rules/progression';
import { autoPlace, teamToUnits } from '../../src/app/core/rules/team';

declare const process: { argv: string[] };
const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
const verbose = process.argv.includes('--verbose');
const floors = (args[0] ?? '1,3,5,8').split(',').map(Number);
const seeds = Number(args[1] ?? 5);
const DT = 0.05;

interface Track {
  x: number;
  y: number;
  speed: number;
  /** clip playing until (battle time) + its label · the logical cell it began in (a changed cell = skill movement / knockback) */
  clipEnd: number;
  cell: string;
  clip: string;
  hitAt: number;
  /** ticks of the current walking run / stopped ticks inside it */
  walking: number;
  stopped: number;
}
interface Agg {
  clips: number;
  startMoving: number;
  slideClips: number;
  slideDist: number;
  slidePre: number;
  slidePost: number;
  walkTicks: number;
  stalls: number;
  jumps: number;
}
const blank = (): Agg => ({ clips: 0, startMoving: 0, slideClips: 0, slideDist: 0, slidePre: 0, slidePost: 0, walkTicks: 0, stalls: 0, jumps: 0 });
const total: Record<string, Agg> = { hero: blank(), monster: blank() };
const worst: string[] = [];

const state = newGameState();
for (const floor of floors) {
  const stage = STAGES[floor - 1];
  const band = FLOOR_BANDS[floor];
  const profile = POWER_PROFILES[band?.simProfile ?? 'A'];
  const heroes = state.team.map(s => state.heroes.find(h => h.uid === s.uid)!).map(h => applyProfile(h, profile, band?.simLevel ?? profile.level));
  const allies = teamToUnits(autoPlace(heroes), heroes);
  for (let seed = 1; seed <= seeds; seed++) {
    const e = new BattleEngine({ allies, stage, enemyTemplates: ENEMIES, seed, autoUlt: true });
    const tracks = new Map<number, Track>();
    const slid = new Map<number, number>();
    while (!e.result && e.time < 300) {
      const combat = e.phase === 'COMBAT';
      const cells = new Map((e.units as BattleUnit[]).map(u => [u.id, `${u.pos.c},${u.pos.r}`]));
      e.step(DT);
      const evs = e.drainEvents();
      for (const u of e.units as BattleUnit[]) {
        const side = u.monster || u.side !== 'ally' ? 'monster' : 'hero';
        const a = total[side];
        let t = tracks.get(u.id);
        if (!t) {
          tracks.set(u.id, (t = { x: u.x, y: u.y, speed: 0, clipEnd: -1, cell: '', clip: '', hitAt: -1, walking: 0, stopped: 0 }));
          continue;
        }
        const d = Math.hypot(u.x - t.x, u.y - t.y);
        const speed = d / DT;
        const prev = t.speed;
        t.x = u.x; t.y = u.y; t.speed = speed;
        if (!u.alive || !combat || speed > 8) { t.walking = 0; t.stopped = 0; continue; }
        // clip start events of this tick
        for (const ev of evs) {
          if ((ev.type !== 'attack' && ev.type !== 'cast') || ev.src !== u.id) continue;
          const kind = ev.type === 'attack' ? 'attack' : (ev as { kind: 'skill' | 'skill2' | 'ult' }).kind;
          const tm = animTiming(u.sprite, kind);
          if (t.clipEnd > e.time && slid.get(u.id)) closeClip(u, t, a, slid);
          t.clipEnd = e.time + tm.total; t.hitAt = e.time + tm.hit; t.clip = `${u.name} ${kind}`;
          t.cell = cells.get(u.id) ?? '';
          slid.set(u.id, 0);
          a.clips++;
          // the body still travelled in the tick the clip began (its own cell: not a charge / blink)
          if (speed > 0.15 && t.cell === `${u.pos.c},${u.pos.r}`) {
            a.startMoving++;
            if (verbose) worst.push(`F${floor} s${seed} ${e.time.toFixed(2)} START-MOVING ${t.clip} speed ${speed.toFixed(2)}`);
          }
        }
        const inClip = e.time <= t.clipEnd + 1e-9;
        if (inClip && !u.dashMotion && d > 1e-4 && t.cell === `${u.pos.c},${u.pos.r}`) {
          slid.set(u.id, (slid.get(u.id) ?? 0) + d);
          if (e.time <= t.hitAt) a.slidePre += d; else a.slidePost += d;
        }
        if (!inClip && t.clipEnd > 0 && slid.has(u.id)) closeClip(u, t, a, slid);
        // walking smoothness (outside clips)
        if (!inClip) {
          const ms = Math.max(u.moveSpeed, 1);
          if (speed > 0.05) {
            if (t.walking > 0 && t.stopped > 0 && t.stopped <= 3) {
              a.stalls++;
              if (verbose) worst.push(`F${floor} s${seed} ${e.time.toFixed(2)} STALL ${u.name} ${t.stopped} tick`);
            }
            if (t.walking > 1 && t.stopped === 0 && Math.abs(speed - prev) > ms * 0.5) a.jumps++;
            t.walking++; t.stopped = 0; a.walkTicks++;
          } else if (t.walking > 0) {
            if (++t.stopped > 3) { t.walking = 0; t.stopped = 0; }
          }
        } else { t.walking = 0; t.stopped = 0; }
      }
    }
  }
}
function closeClip(u: BattleUnit, t: Track, a: Agg, slid: Map<number, number>): void {
  const d = slid.get(u.id) ?? 0;
  slid.delete(u.id);
  if (d > 0.05) {
    a.slideClips++;
    a.slideDist += d;
    if (verbose) worst.push(`SLIDE ${t.clip} moved ${d.toFixed(2)} cells during the clip`);
  }
}
for (const [k, a] of Object.entries(total)) {
  console.log(`${k.padEnd(8)} clips ${a.clips} | started while moving ${a.startMoving} (${pct(a.startMoving, a.clips)}) | slid during clip ${a.slideClips} (${pct(a.slideClips, a.clips)}) avg ${(a.slideDist / Math.max(1, a.slideClips)).toFixed(2)} cells [before hit ${a.slidePre.toFixed(1)} / after hit ${a.slidePost.toFixed(1)}]`);
  console.log(`${''.padEnd(8)} walk ticks ${a.walkTicks} | stalls ${a.stalls} (1 per ${(a.walkTicks * DT / Math.max(1, a.stalls)).toFixed(1)} s walked) | speed jumps ${a.jumps} (${pct(a.jumps, a.walkTicks)})`);
}
function pct(n: number, d: number): string { return `${(100 * n / Math.max(1, d)).toFixed(1)} %`; }
if (verbose) console.log(worst.slice(0, 120).join('\n'));

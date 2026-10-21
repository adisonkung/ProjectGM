import { FX, SHEETS, SkillKind } from '../../core/data/sprites';
import type { FxView } from '../board/board.component';
import type { FxTrack } from '../../core/models/fx';
import { BOARD_COLS, BOARD_ROWS } from '../engine/grid';

type PlannedFx = Omit<FxView, 'id'>;
/** One bounded visual plan per cast. Curves share the board clock; visual RNG never consumes combat RNG. */
export function sequenceFx(sprite: string | undefined, kind: SkillKind, source: number, target: number | undefined,
  seed: number, position: (id: number) => { r: number; c: number }, left = false, variant?: string): PlannedFx[] {
  const cues = sprite ? SHEETS[sprite]?.sequenceFx?.[kind] : undefined;
  if (!cues) return [];
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const poses: string[] = [], usedDirections: number[] = [];
  const result: PlannedFx[] = [];
  // Two-cell vectors at0/±30deg: diagonals fit all three real combat lanes from the middle lane.
  const directions = [[-Math.sqrt(3),-1],[-2,0],[-Math.sqrt(3),1],[Math.sqrt(3),-1],[2,0],[Math.sqrt(3),1]];
  for (const cue of cues) {
    const choices = (cue.variants?.[variant ?? ''] ?? cue.names).filter(name => !cue.outward || !poses.includes(name));
    const name = choices[Math.floor(random() * choices.length)];
    const d = FX[name];
    if (!d || d.at === 'target' && target == null) continue;
    const follow = d.at === 'target' ? target! : source, p = position(follow);
    const offset: [number,number] = cue.offset ? [...cue.offset] : [d.dx ?? 0,d.dy ?? 0];
    const view: PlannedFx = { ...p, name, angle: 0, flip: left, offset, follow, followY: cue.floor === 'source' ? source : undefined,
      delayMs: Math.round(cue.at*1000), scale: cue.scale ? cue.scale[0]+random()*(cue.scale[1]-cue.scale[0]) : 1,
      track: cue.track, role: cue.role, owner: source, managed: true, under: d.layer === 'under',
      lockAfterMs: cue.freezeAtStart ? 0 : undefined };
    if (!cue.outward) { result.push(view); continue; }
    poses.push(name);
    const { peak, fadeMs, attackMs, trails } = cue.outward;
    const valid = directions.map((v,i)=>({v:v.map(n=>n*cue.outward!.cells/2),i})).filter(({v}) =>
      p.c+v[0]>=0 && p.c+v[0]<=BOARD_COLS-1 && p.r+v[1]>=0 && p.r+v[1]<=BOARD_ROWS-1);
    const unused = valid.filter(({i})=>!usedDirections.includes(i));
    const candidates = unused.length ? unused : valid.filter(({i})=>i!==usedDirections.at(-1));
    const selected = (candidates.length ? candidates : valid)[Math.floor(random()*(candidates.length || valid.length))];
    if (!selected) continue;
    const repeats=usedDirections.filter(i=>i===selected.i).length;
    usedDirections.push(selected.i);
    const x=selected.v[0]*(1-repeats*.025);
    const y=selected.v[1]+(p.r+selected.v[1]<=0?.06:-.06)*repeats;
    const flip = x<0, until = Math.round((peak-cue.at)*1000), durationMs = until+fadeMs;
    const fade = (level:number): [number,number][] => [[until,level],[until+40,level*.78],
      [until+fadeMs*.5,level*.34],[until+fadeMs*.8,level*.07],[durationMs,0]];
    const motion: NonNullable<FxTrack['motion']> = [[0,0,0],[attackMs,Math.abs(x)*100,y*100],[durationMs,Math.abs(x)*100,y*100]];
    // Capture the target at the attack's start; bodies/trails then remain stable in world space.
    const body = { ...view, flip, outward: [x,y] as [number,number], lockAfterMs: 0, under: true };
    result.push({ ...body, role: 'rim', additive: true, track: { durationMs, motion,
      alpha: [[0,.85],[35,.4],[attackMs,.14],[until-1,.14],...fade(.7)] } });
    result.push({ ...body, role: 'phantom', track: { durationMs, motion,
      alpha: [[0,1],[35,1],[attackMs,.68],[until-1,.68],...fade(.98)] } });
    const trailName = trails[Math.floor(random()*trails.length)], td = FX[trailName];
    result.push({ ...view, name: trailName, role: 'trail', flip: false, scale: 1.32, lockAfterMs: 0, outward: [x,y],
      offset: [td.dx ?? 0, td.dy ?? 0], angle: Math.atan2(y,x)*180/Math.PI, under: false,
      track: { durationMs, reveal: [[0,.05625],[attackMs,1],[durationMs,1]],
        cycle: { fromMs: attackMs, untilMs: until, periodMs: 240, alpha: [.82,1.1], reveal: [.94,1] },
        alpha: [[0,1],[attackMs*.7,.9],[attackMs,.78],[until-1,.78],...fade(.95)] } });
  }
  return result;
}

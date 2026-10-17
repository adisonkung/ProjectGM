/** Export final Mirelle Sync from runtime data + isolated real-engine casts; JSON on stdout. */
import { FX, SHEETS, animEvents, animTiming, clipClock, fxOffset } from '../../src/app/core/data/sprites';
import { MIRELLE_PRODUCTION } from '../../src/app/core/data/mirelle-production';
import { kitOf } from '../../src/app/core/data/hero-skills';
import { MONSTERS } from '../../src/app/core/data/monsters';
import { skillReview } from '../../src/app/pages/sprite-lab/skill-review';
import { fxPlacement, fxPoseAt, groundFxCell, projectilePlacement, projectilePoseAt } from '../../src/app/battle/render/fx-clip';
import { Cell } from '../../src/app/core/models/unit';

declare const console: { log(s: string): void };
const sprite = 'hero-mirelle.png';
const sheet = SHEETS[sprite];
const kit = kitOf('mirelle', 'mage');
const caster: Cell = { r: 1, c: 5 };
const targets = [{ id: 2, pos: { r: 1, c: 9 }, statuses: ['chill'] }, { id: 3, pos: { r: 1, c: 10 } },
  { id: 4, pos: { r: 2, c: 9 } }, { id: 5, pos: { r: 2, c: 10 } }];
const cell = 80, ground = 330, rootX = 130, fps = 60;
const corner = (at: Cell) => ({ x: rootX - cell / 2 + (at.c - caster.c) * cell,
  y: ground - cell * 0.7725 + (at.r - caster.r) * cell });
const foeSprite = MONSTERS['forest_slime'].animation!.sheet!;
const data = (['skill', 'skill2', 'ult'] as const).map(slot => {
  const review = skillReview('mirelle', slot, caster, slot === 'skill' ? targets.slice(0, 1) : targets);
  const raw = review.samples.flatMap(s => s.events.map(event => ({ t: s.t, event })));
  const clip = sheet.anims[slot]!;
  const clock = clipClock(clip);
  const total = slot === 'skill' ? 3.1 : slot === 'skill2' ? 5.2 : 8.4;
  const count = Math.round(total * fps) + 1;
  const hit = raw.find(x => x.event.type === 'impact')?.t;
  const field = raw.find(x => x.event.type === 'FIELD_STARTED');
  const end = raw.find(x => x.event.type === 'FIELD_ENDED');
  const shot = raw.find(x => x.event.type === 'projectile');
  const root = raw.find(x => x.event.type === 'buff' && x.event.buff === 'root');
  const idCell = (id: number) => targets.find(t => t.id === review.ids.get(id))?.pos ?? caster;
  const scheduled: { name: string; at: Cell; start: number; end?: number; loop?: boolean }[] = [];
  if (slot === 'skill' && hit != null) scheduled.push({ name: 'mf-s1-impact', at: targets[0].pos, start: hit });
  if (slot === 'skill2' && hit != null) {
    scheduled.push({ name: 'mf-s2-main', at: groundFxCell(FX['mf-s2-main'], caster, targets[0].pos), start: hit });
    if (root?.event.type === 'buff') scheduled.push({ name: 'mf-s2-bind', at: idCell(root.event.dst), start: root.t });
  }
  if (slot === 'ult' && field?.event.type === 'FIELD_STARTED') {
    const charge = raw.find(x => x.event.type === 'animEvent' && x.event.event === 'CHARGE_START');
    if (charge) scheduled.push({ name: 'mf-ult-charge', at: caster, start: charge.t });
    scheduled.push({ name: 'mf-ult-main', at: field.event.at, start: field.t, end: end?.t });
    scheduled.push({ name: 'mf-ult-field', at: field.event.at, start: field.t, end: end?.t, loop: true });
    if (end?.event.type === 'FIELD_ENDED' && end.event.reason === 'EXPIRED') {
      for (const name of ['mf-ult-shatter', 'mf-ult-residual']) scheduled.push({ name, at: field.event.at, start: end.t });
    }
  }
  let sample = 0;
  const frames = Array.from({ length: count }, (_, T) => {
    const t = T / fps;
    while (sample + 1 < review.samples.length && review.samples[sample + 1].t <= t + 1e-9) sample++;
    const playing = t < clock.total - 1e-9;
    let step = 0;
    while (step + 1 < clock.count && clock.at(step + 1) <= t + 1e-9) step++;
    const pose = playing ? clock.art(step)
      : Math.floor((t - clock.total) / 0.15 + 1e-9) % sheet.anims.idle!.frames;
    const effects = scheduled.flatMap(s => {
      if (t + 1e-9 < s.start || s.end != null && t + 1e-9 >= s.end) return [];
      const d = FX[s.name], p = fxPoseAt(d, Math.max(0, t - s.start) + 1e-9, !!s.loop);
      if (!p.visible || p.done) return [];
      const at = corner(s.at);
      return [{ name: s.name, ...p, ...fxPlacement(d, cell, at.x, at.y, false, 0, fxOffset(s.name)), under: d.layer === 'under' }];
    });
    let projectile;
    if (shot?.event.type === 'projectile' && t + 1e-9 >= shot.t) {
      const p = projectilePoseAt(FX['mf-s1-projectile'], shot.event.flight, t - shot.t);
      if (!p.done) {
        const a = corner(caster), b = corner(targets[0].pos);
        projectile = { name: 'mf-s1-projectile', ...p,
          ...projectilePlacement(FX['mf-s1-projectile'], cell, { x: a.x / cell, y: a.y / cell }, { x: b.x / cell, y: b.y / cell }, p.k) };
      }
    }
    return { T, t, char: playing ? pose + 1 : clip.frames + 1, row: playing ? clip.row : 0, pose,
      effects, projectile, statuses: review.samples[sample].statuses };
  });
  return { slot, label: kit[slot].label, syncSheet: MIRELLE_PRODUCTION.clips[slot].syncSheet,
    clip, nominalEvents: animEvents(sprite, slot), timing: animTiming(sprite, slot), scheduled,
    events: raw.filter(x => x.event.type !== 'buff' || !x.event.refreshed), frames,
    flight: shot?.event.type === 'projectile' ? shot.event.flight : null,
    pulseTimes: review.samples.filter(s => s.events.some(e => e.type === 'damage')).map(s => s.t),
    fieldDuration: field?.event.type === 'FIELD_STARTED' ? field.event.duration : null };
});
console.log(JSON.stringify({ schema: 1, status: 'FINAL_SYNC', fps, sprite, sheet, fx: Object.fromEntries(Object.entries(FX).filter(([k]) => k.startsWith('mf-'))),
  monster: { sprite: foeSprite, sheet: SHEETS[foeSprite] }, canvas: { width: 760, height: 480, rootX, ground, cell }, caster, targets, skills: data }, null, 1));

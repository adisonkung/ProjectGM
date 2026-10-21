/** Export the supplied S2 timeline and isolated actual-engine casts; no save access or kit mutation. */
import { FX, SHEETS, animEvents, animTiming } from '../../src/app/core/data/sprites';
import { kitOf } from '../../src/app/core/data/hero-skills';
import { skillReview } from '../../src/app/pages/sprite-lab/skill-review';
declare const console: { log(s: string): void };
const sprite = 'hero-vaelric.png';
const reviews = [1, -1].map(direction => {
  const c = direction > 0 ? 5 : 8;
  const review = skillReview('vaelric', 'skill2', { r: 1, c }, [0, 1, 2].flatMap(r => [1, 2].map((n, i) =>
    ({ id: 2 + r * 2 + i, pos: { r, c: c + n * direction } }))));
  return { direction, samples: review.samples, ids: [...review.ids] };
});
console.log(JSON.stringify({ clip: SHEETS[sprite].anims.skill2, kit: kitOf('vaelric', 'assassin').skill2,
  events: animEvents(sprite, 'skill2'), timing: animTiming(sprite, 'skill2'),
  fx: Object.fromEntries(Object.entries(FX).filter(([key]) => key.startsWith('vn-s2'))), reviews }));

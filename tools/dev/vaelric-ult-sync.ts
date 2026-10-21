/** Reproducible workbook timeline + actual fixed-step engine export. No player save access. */
import { FX, SHEETS, animEvents, animTiming } from '../../src/app/core/data/sprites';
import { kitOf } from '../../src/app/core/data/hero-skills';
import { skillReview } from '../../src/app/pages/sprite-lab/skill-review';
declare const console: { log(s: string): void };
const sprite = 'hero-vaelric.png';
const reviews = [1, -1].map(direction => {
  const c = direction > 0 ? 5 : 8;
  const review = skillReview('vaelric', 'ult', { r: 1, c },
    [0, 1, 2].map((r, i) => ({ id: i + 2, pos: { r, c: c + direction } })));
  return { direction, samples: review.samples, ids: [...review.ids] };
});
console.log(JSON.stringify({ clip: SHEETS[sprite].anims.ult, cues: SHEETS[sprite].sequenceFx?.ult,
  kit: kitOf('vaelric', 'assassin').ult, events: animEvents(sprite, 'ult'), timing: animTiming(sprite, 'ult'),
  fx: Object.fromEntries(Object.entries(FX).filter(([key]) => key.startsWith('vn-ult'))), reviews }));

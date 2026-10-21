import { groundCell, resolveArea } from './area';

/** ground-targeted shapes (Bai Long): fixed cells in front of the caster, every stacked unit in them is hit */
describe('ground-targeted areas', () => {
  const u = (id: number, c: number, r: number) => ({ id, pos: { r, c } });
  const caster = u(0, 2, 1);
  const hits = (pattern: any, cands: ReturnType<typeof u>[], primary = cands[0]) =>
    resolveArea({ pattern, caster, primary, candidates: cands }).map(x => x.id).sort();

  it('FRONT_LINE_2: the 2 cells straight ahead, all stacked units, nothing diagonal / 3 ahead', () => {
    const c = [u(1, 3, 1), u(2, 3, 1), u(3, 3, 1), u(4, 4, 1), u(5, 3, 0), u(6, 5, 1)];
    expect(hits('FRONT_LINE_2', c)).toEqual([1, 2, 3, 4]);
  });

  it('FRONT_COLUMN_3: up / front / down of the next column only', () => {
    const c = [u(1, 3, 1), u(2, 3, 0), u(3, 3, 2), u(4, 3, 2), u(5, 4, 1), u(6, 2, 0)];
    expect(hits('FRONT_COLUMN_3', c)).toEqual([1, 2, 3, 4]);
  });

  it('FRONT_CROSS: main = the front cell (every stacked unit), splash above / below / one further, not 3 × 3', () => {
    const c = [u(1, 3, 1), u(2, 3, 1), u(3, 3, 0), u(4, 3, 2), u(5, 4, 1), u(6, 4, 0), u(7, 2, 0)];
    expect(hits('FRONT_CROSS', c)).toEqual([1, 2, 3, 4, 5]);
    expect([1, 2, 3, 5].map(i => groundCell('FRONT_CROSS', caster, c[0], c, c[i - 1]))).toEqual([true, true, false, false]);
  });

  it('mirrors when the target is on the left', () => {
    const c = [u(1, 1, 1), u(2, 0, 1), u(3, 3, 1)];
    expect(hits('FRONT_LINE_2', c)).toEqual([1, 2]);
  });
});

describe('locked forward 2×3 footprint', () => {
  it('includes six forward cells and stacked units, excluding own/behind/third columns at either facing', () => {
    for (const left of [false, true]) {
      const direction = left ? -1 : 1;
      const caster = { id: 1, pos: { r: 1, c: 8 }, actionFacing: { left } };
      const candidates = [0,1,2].flatMap(r => [1,2].map(n => ({ id: r * 2 + n + 1, pos: { r, c: 8 + n * direction } })));
      const outside = [{ id: 20, pos: { r: 1, c: 8 } }, { id: 21, pos: { r: 1, c: 8 - direction } }, { id: 22, pos: { r: 1, c: 8 + 3 * direction } }];
      const stacked = { id: 23, pos: { r: 1, c: 8 + direction } };
      const hits = resolveArea({ pattern: 'FRONT_RECT_2X3', caster, primary: outside[1], candidates: [...candidates, ...outside, stacked] });
      expect(hits.map(h => h.id).sort()).toEqual([...candidates, stacked].map(h => h.id).sort());
    }
  });
});

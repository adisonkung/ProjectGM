import { frameChunk } from './tex-chunks';

describe('frameChunk (sheets over the GPU texture limit)', () => {
  it('cuts a long FX strip into chunks of whole frames under the limit', () => {
    // Lin Xue ult main: 11 174 px, 8192 limit, 446 px frames → 18 frames per chunk
    const fw = 446;
    const a = frameChunk(17, 0, fw, 129, 11174, 129, 8192);
    expect([a.cx, a.sx, a.fx, a.sw]).toEqual([0, 0, 17 * fw, 18 * fw]);
    const b = frameChunk(18, 0, fw, 129, 11174, 129, 8192);
    expect([b.cx, b.sx, b.fx]).toEqual([1, 18 * fw, 0]);
    expect(b.sw).toBe(11174 - 18 * fw);
    expect(b.sw).toBeLessThanOrEqual(8192);
  });

  it('chunks rows too and keeps each chunk within the limit', () => {
    for (let col = 0; col < 20; col++) {
      for (let row = 0; row < 8; row++) {
        const c = frameChunk(col, row, 420, 170, 8400, 1360, 1024);
        expect(c.sw).toBeLessThanOrEqual(1024);
        expect(c.sh).toBeLessThanOrEqual(1024);
        expect(c.fx + 420).toBeLessThanOrEqual(c.sw + 1e-9);
        expect(c.fy + 170).toBeLessThanOrEqual(c.sh + 1e-9);
      }
    }
  });
});

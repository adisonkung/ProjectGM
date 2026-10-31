import { battleViewport } from './battle-viewport';
describe('battle viewport presentation', () => {
  it('caps tall desktop scenery at reference proportions instead of filling the screen vertically', () => {
    const v = battleViewport(1586,1050);
    expect(v.extraRows).toBeCloseTo(.65,4);
    expect(v.width).toBeLessThanOrEqual(1586-32);
    expect(v.height).toBeLessThan(1050-112);
    expect(v.foot/v.cell).toBeGreaterThan(2.25);
  });
  it('keeps the short landscape battlefield and party dock inside the phone', () => {
    const v = battleViewport(844,390);
    expect(v.extraRows).toBe(0);
    expect(v.width).toBeLessThanOrEqual(844-8);
    expect(v.height).toBeLessThanOrEqual(390-8);
  });
  it('fits a wide short desktop without stretching its square cells', () => {
    const v = battleViewport(1920,720);
    expect(v.width).toBeCloseTo(v.cell*16+2,4);
    expect(v.height).toBeLessThanOrEqual(720-112);
    expect(v.extraRows).toBeGreaterThanOrEqual(0);
  });
  it('reserves decorative floor without adding combat lanes, including short phones', () => {
    for (const [w,h] of [[1440,900],[932,430],[844,390],[1920,720]]) {
      const v=battleViewport(w,h);
      expect(v.groundRows).toBe(.8);
      expect(v.height).toBeCloseTo(v.cell*(5+v.extraRows+v.groundRows)+v.foot+2,5);
      expect(v.height).toBeLessThanOrEqual(h-(h<=500?8:112));
    }
  });
  it('moves spare floor to sky in Solar without shrinking cells, heroes or the large boss',()=>{
    for(const [w,h] of [[1440,900],[932,430],[844,390]]){
      const previous=battleViewport(w,h,.8),solar=battleViewport(w,h,.45,.35);
      expect(solar.cell).toBeCloseTo(previous.cell,8);
      expect(solar.extraRows).toBeCloseTo(previous.extraRows+.35,8);
      expect(solar.height).toBeCloseTo(previous.height,8);
      expect(solar.height).toBeLessThanOrEqual(h-(h<=500?8:112));
    }
  });
  it('fits raised Aegis spear effects while preserving the decorative floor margin',()=>{
    for(const [w,h]of [[1440,900],[932,430],[844,390]]){
      const view=battleViewport(w,h,.8,1.4);
      expect(view.extraRows).toBeGreaterThanOrEqual(1.4);
      expect(view.height).toBeLessThanOrEqual(h-(h<=500?8:112));
      expect(view.groundRows).toBe(.8);
    }
  });
  it('does not expand the scene behind the portrait rotation prompt', () => {
    const v = battleViewport(390,844);
    expect(v.extraRows).toBe(0);
    expect(v.width).toBeLessThanOrEqual(390-32);
  });
});

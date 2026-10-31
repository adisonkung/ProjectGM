import { SHEETS } from '../../core/data/sprites';
import { bossPoint } from '../../core/data/boss-presentation-scale';
import { unitGeometry } from './unit-geometry';

describe('feet-anchored character scale', () => {
  it('enlarges both guardians without moving their feet at desktop or mobile cell sizes', () => {
    for(const [id,previous,scale]of [['aegis',1,1.6],['jadecrest',1.25,1.8]] as const){
      const def=SHEETS[`enemy-${id==='aegis'?'aegis-sentinel':'jadecrest-guardian'}.png`];
      for(const cell of [44,80,100]){
        const old=unitGeometry({...def,displayScale:previous},cell),scaled=unitGeometry(def,cell);
        expect(scaled.width/old.width).toBeCloseTo(scale/previous,8);
        expect(scaled.height/old.height).toBeCloseTo(scale/previous,8);
        expect(scaled.bottomY-14*scaled.k).toBeCloseTo(old.bottomY-14*old.k,8);
      }
    }
  });
  it('keeps an authored shield/mouth point registered through a size change',()=>{
    for(const [sprite,previous,anchor,point]of [
      ['enemy-aegis-sentinel.png',1,'shieldCore',[0,-44]],
      ['enemy-jadecrest-guardian.png',1.25,'mouth',[165,-196.8125]],
    ] as const){
      const def=SHEETS[sprite],old=unitGeometry({...def,displayScale:previous}),next=unitGeometry(def);
      const sourceY=def.cellH!+(50+point[1]-old.bottomY)/old.k;
      expect(def.anchors![anchor][1]).toBeCloseTo(next.bottomY+(sourceY-def.cellH!)*next.k-50,7);
      expect(def.anchors![anchor]).toEqual(bossPoint(point,def.displayScale!/previous));
    }
  });
});

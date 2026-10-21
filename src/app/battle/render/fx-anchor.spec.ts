import { FxAnchors } from './fx-anchor';

describe('frozen visual strike anchors', () => {
  it('keeps explosion X on the target while its ground plane follows the caster in a different lane',()=>{
    const a=new FxAnchors(2),fx={id:11,r:0,c:8,follow:2,followY:1};
    let caster={x:400,y:400},target={x:800,y:200};
    const sync=(t:number,camera=0)=>a.sync([fx],t,camera,id=>id===1?caster:target);
    sync(0);expect(a.at(11)!.x).toBe(800);expect(a.at(11)!.y).toBe(400);expect(a.at(11)!.axis).toBeTrue();
    caster={x:500,y:300};target={x:900,y:350};sync(1);
    expect(a.at(11)!.x).toBe(900);expect(a.at(11)!.y).toBe(300);
    caster={x:400,y:300};target={x:800,y:350};sync(2,100);
    expect(a.at(11)!.x).toBe(800);expect(a.at(11)!.y).toBe(300);
    expect(target.y).toBe(350);a.clear();expect(a.at(11)).toBeUndefined();
  });
  it('rechecks outward directions when a delayed attack starts after the target reaches a boundary', () => {
    const a=new FxAnchors(2), fx={id:9,r:1,c:7,follow:2,delayMs:2320,lockAfterMs:0,outward:[-Math.sqrt(3),-1] as [number,number]};
    let target={x:700,y:300};
    a.sync([fx],0,0,()=>target);expect(a.at(9)!.outward).toBeUndefined();
    target={x:0,y:200};a.sync([fx],2.32,0,()=>target);
    expect(a.at(9)!.outward!.flip).toBeFalse();expect(a.at(9)!.outward!.dySign).toBe(-1);
    expect(a.at(9)!.outward!.angle).toBeCloseTo(30,6);
    target={x:1500,y:400};a.sync([fx],3.7,0,()=>target);
    expect(a.at(9)!.x).toBe(0);expect(a.at(9)!.y).toBe(200);expect(a.at(9)!.outward!.flip).toBeFalse();
  });
  it('follows a moving target until attack ends, freezes world position during LINGER, and compensates camera motion', () => {
    const a = new FxAnchors();
    const fx = { id: 1, r: 0, c: 0, follow: 2, delayMs: 1520, lockAfterMs: 65 };
    let target = { x: 600, y: 300 };
    const sync=(t:number,camera=0)=>a.sync([fx],t,camera,()=>target);
    sync(0); sync(1.52); expect(a.at(1)!.x).toBe(600);
    target={x:620,y:310}; sync(1.57); expect(a.at(1)!.x).toBe(620);
    sync(1.59); expect(a.at(1)!.locked).toBeTrue();
    target={x:900,y:400}; sync(3.2); expect(a.at(1)!.x).toBe(620);expect(a.at(1)!.y).toBe(310);
    sync(3.4,100); expect(a.at(1)!.x).toBe(520);
    const slot=a.at(1); sync(3.5,100); expect(a.at(1)).toBe(slot);
    a.sync([],3.95,100,()=>target); expect(a.at(1)).toBeUndefined();
    a.sync([fx],4,100,()=>target); expect(a.at(1)!.locked).toBeFalse();
    expect(a.complete(1)).toBeTrue();expect(a.complete(1)).toBeFalse();
    a.clear(); expect(a.at(1)).toBeUndefined();
  });
  it('a tracked cut/aura continues following the target and never changes a gameplay position', () => {
    const a=new FxAnchors(2), fx={id:7,r:0,c:3,follow:2};
    a.sync([fx],0,0,()=>undefined); expect(a.at(7)!.y).toBe(200);
    const target={x:400,y:350}; a.sync([fx],1,0,()=>target);
    target.x=700; a.sync([fx],3.4,0,()=>target);expect(a.at(7)!.x).toBe(700);
    expect(target).toEqual({x:700,y:350}); expect(a.at(7)!.locked).toBeFalse();
  });
});

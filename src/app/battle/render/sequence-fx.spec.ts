import { FX, SHEETS, animTiming } from '../../core/data/sprites';
import { clipTimeline } from './unit-clip';
import { fxLength, fxPoseAt } from './fx-clip';
import { sequenceFx } from './sequence-fx';

describe('V5 outward phantom execution presentation', () => {
  const sprite='hero-vaelric.png';
  const plan=(seed:number,r=1,c=7)=>sequenceFx(sprite,'ult',1,2,seed,id=>id===2?{r,c}:{r:1,c:5});
  it('loops visible ribbon energy without replaying the opening strike, then exits the cycle at execution',()=>{
    const f=plan(7).find(f=>f.role==='trail')!,d=FX[f.name],start=f.delayMs!/1000;
    const pose=(ms:number)=>fxPoseAt(d,ms/1000,false,f.track);
    const a=pose(180),b=pose(420),mid=pose(240);
    expect(a.alpha).toBeCloseTo(b.alpha,8);expect(a.reveal).toBeCloseTo(b.reveal!,8);
    expect(mid.alpha).toBeGreaterThan(a.alpha);expect(a.alpha).toBeGreaterThan(.57);
    expect([a,b,mid].every(p=>p.frame===0&&p.reveal!>=.94)).toBeTrue();
    const peak=(3.93-start)*1000;
    expect(pose(peak+.001).alpha).toBeGreaterThan(.84);
    expect(pose(peak+401).done).toBeTrue();
  });
  it('compares original VAN F8–F10 and F9–F10 on reappearance without changing other visual cues',()=>{
    const full=plan(7),short=sequenceFx(sprite,'ult',1,2,7,id=>id===2?{r:1,c:7}:{r:1,c:5},false,'short');
    const a=full.find(f=>f.role==='return')!,b=short.find(f=>f.role==='return')!;
    expect(a.delayMs).toBe(3320);expect(b.delayMs).toBe(3320);
    const frames=(f:typeof a)=>[.001,.081,.161].map(t=>fxPoseAt(FX[f.name],t,false,f.track).frame+1);
    expect(frames(a)).toEqual([8,9,10]);expect(frames(b)).toEqual([9,10,10]);
    expect(full.filter(f=>f.role!=='return')).toEqual(short.filter(f=>f.role!=='return'));
    expect(FX['vn-ult-cuts'].scale).toBe(.4);
  });
  it('opens forward and reverses the retreat, then charges immediately with the original main VAN sequence and complete Impact',()=>{
    const all=plan(7),retreat=all.filter(f=>f.role==='retreat');
    expect(retreat.map(f=>f.delayMs)).toEqual([0,400]);
    const show=(f:typeof retreat[number],t:number)=>fxPoseAt(FX[f.name],t,false,f.track);
    expect([0,1,2,3,4].map(i=>show(retreat[0],i*.08+.001).frame)).toEqual([0,1,2,3,4]);
    expect([0,1,2,3,4].map(i=>show(retreat[1],i*.08+.001).frame)).toEqual([4,3,2,1,0]);
    expect(retreat.every(f=>f.lockAfterMs===0)).toBeTrue();
    expect(retreat[1].delayMs!+retreat[1].track!.durationMs).toBe(800);
    const main=all.filter(f=>['vn-ult-charge','vn-ult-loop','vn-ult-vanish'].includes(f.name));
    expect(main[0].delayMs).toBe(800);
    const shown=(t:number)=>main.flatMap(f=>{const p=fxPoseAt(FX[f.name],t-f.delayMs!/1000);return p.visible?[p.frame+1]:[];});
    expect([0.8,0.88,0.96,1.04,1.16,1.28,1.4,1.52,1.6,1.68,1.76,1.84].map(t=>shown(t+.001)[0]))
      .toEqual([1,2,3,4,5,4,5,6,7,8,9,10]);
    expect(shown(1.921)).toEqual([]);
    const impact=all.find(f=>f.name==='vn-ult-impact')!;
    expect(impact.follow).toBe(2);expect(impact.followY).toBe(1);
    expect(impact.delayMs).toBe(3770);expect(fxLength(FX[impact.name])).toBe(.48);
    expect(fxPoseAt(FX[impact.name],.161).frame).toBe(4);
  });
  it('holds all original17 poses: preparation during reappearance, main F8, F9 return and exactly300ms F10 silence',()=>{
    const tl=clipTimeline(SHEETS[sprite].anims.ult!,'ult',{anim:'ult'});
    expect(tl.duration).toBeCloseTo(4.12,8);
    for(const t of [0,.32,.4,.449]) expect(tl.frameAt(t)).toBe(0);
    expect(tl.frameAt(.451)).toBe(1);expect(tl.frameAt(.701)).toBe(6);
    expect(tl.opacityAt(.321)).toBe(0);expect(tl.opacityAt(.401)).toBeGreaterThan(0);expect(tl.opacityAt(.721)).toBe(1);
    for(const t of [.751,1.52,2.2,3.319]) expect(tl.frameAt(t)).toBe(7);
    expect(tl.opacityAt(1.68)).toBeCloseTo(0,6);expect(tl.opacityAt(3.32)).toBeCloseTo(1,8);
    expect(tl.frameAt(3.321)).toBe(8);expect(tl.frameAt(3.471)).toBe(9);expect(tl.frameAt(3.769)).toBe(9);
    for(let i=0;i<7;i++) expect(tl.frameAt(3.771+i*.05)).toBe(10+i);
    expect(animTiming(sprite,'ult').hits[0]).toBeCloseTo(3.93,8);
  });
  it('launches exactly six outward120ms attacks, then preserves68% stable shadows through silence and fades400ms',()=>{
    const all=plan(7),clones=all.filter(f=>f.role==='phantom'),trails=all.filter(f=>f.role==='trail');
    expect(clones.length).toBe(6);expect(trails.length).toBe(6);
    expect(clones.map(f=>f.delayMs)).toEqual([1920,2100,2280,2500,2740,2970]);
    const pose=(f:typeof clones[number],t:number)=>fxPoseAt(FX[f.name],t-f.delayMs!/1000,false,f.track);
    for(const f of clones){
      const start=f.delayMs!/1000,end=pose(f,start+.121);
      expect(pose(f,start+.001).dx).toBeLessThan(2);expect(Math.hypot(end.dx!,end.dy!)).toBeCloseTo(200,6);
      expect(f.lockAfterMs).toBe(0);expect(pose(f,3.32).alpha).toBeCloseTo(.68,6);expect(pose(f,3.769).alpha).toBeCloseTo(.68,6);
      expect(pose(f,3.931).alpha).toBeGreaterThan(.85);
      const fade=[3.97,4.05,4.15,4.25,4.329].map(t=>pose(f,t).alpha);
      expect(fade.every((a,i)=>i===0||a<fade[i-1])).toBeTrue();expect(pose(f,4.331).done).toBeTrue();
    }
    for(const f of trails){expect(pose(f,f.delayMs!/1000+.01).reveal).toBeLessThan(.2);expect(pose(f,3.7).alpha).toBeGreaterThan(.57);expect(f.under).toBeFalse();expect(f.scale).toBe(1.32);}
    const cuts=all.filter(f=>f.role==='cut');expect(cuts.length).toBe(1);
    expect([1.921,2.101,2.281,2.501,2.741,2.971].map(t=>pose(cuts[0],t).frame)).toEqual([0,1,2,3,4,5]);
    expect(pose(cuts[0],3.76).frame).toBe(5);expect(pose(cuts[0],3.931).alpha).toBeGreaterThan(.9);
    const aura=all.find(f=>f.role==='aura')!;expect(pose(aura,3).alpha).toBeGreaterThan(pose(aura,2).alpha);
    expect(all.filter(f=>f.track).every(f=>!pose(f,4.331).visible)).toBeTrue();expect(all.length).toBe(30);
  });
  it('randomizes all six original poses/directions and five ribbons independently of caster facing; edges stay visible',()=>{
    const seenTrails=new Set<string>(),seenOrders=new Set<string>();
    for(let seed=0;seed<40;seed++){
      const all=plan(seed);expect(all).toEqual(plan(seed));
      const clones=all.filter(f=>f.role==='phantom');expect(new Set(clones.map(f=>f.name)).size).toBe(6);
      expect(clones.every(f=>f.scale!>=.9&&f.scale!<=1&&f.owner===1&&f.follow===2)).toBeTrue();
      const ends=clones.map(f=>{const p=fxPoseAt(FX[f.name],.121,false,f.track);return [p.dx!*(f.flip?-1:1),p.dy!];});
      expect(new Set(ends.map(v=>v.join(','))).size).toBe(6);seenOrders.add(ends.map(v=>v.join(',')).join('|'));
      all.filter(f=>f.role==='trail').forEach(f=>seenTrails.add(f.name));
      for(const [r,c] of [[0,0],[2,15],[0,7],[2,7]]) for(const f of plan(seed,r,c).filter(f=>f.role==='phantom')){
        const p=fxPoseAt(FX[f.name],.121,false,f.track),x=c+p.dx!*(f.flip?-1:1)/100,y=r+p.dy!/100;
        expect(x).toBeGreaterThanOrEqual(0);expect(x).toBeLessThanOrEqual(15);expect(y).toBeGreaterThanOrEqual(0);expect(y).toBeLessThanOrEqual(2);
      }
    }
    expect(seenTrails.size).toBe(5);expect(seenOrders.size).toBeGreaterThan(10);
    expect(sequenceFx(undefined,'ult',1,2,7,()=>({r:0,c:0}))).toEqual([]);
  });
});

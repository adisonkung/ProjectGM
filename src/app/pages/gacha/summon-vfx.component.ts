import { AfterViewInit, ChangeDetectionStrategy, Component, effect, ElementRef, inject, input, NgZone, OnDestroy, viewChild } from '@angular/core';

export type SummonVfxMode = 'ambient' | 'charge' | 'burst' | 'cards' | 'spotlight' | 'out';

/** Procedural presentation only: never reads RNG, writes saves or controls the reveal timeline. */
@Component({
  selector: 'app-summon-vfx',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '<canvas #canvas aria-hidden="true"></canvas>',
  styles: [':host{position:absolute;inset:0;display:block;pointer-events:none;overflow:hidden;contain:strict;}canvas{display:block;width:100%;height:100%;}@media print{:host{display:none;}}'],
})
export class SummonVfxComponent implements AfterViewInit, OnDestroy {
  readonly mode = input<SummonVfxMode>('ambient');
  readonly paused = input(false);
  readonly canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly zone = inject(NgZone);
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private observer?: ResizeObserver;
  private ctx: CanvasRenderingContext2D | null = null;
  private width = 0;
  private height = 0;
  private frame = 0;
  private previous = 0;
  private elapsed = 0;
  private lastMode: SummonVfxMode = 'ambient';
  private modeStart = 0;
  private ready = false;
  private destroyed = false;
  private inView = true;
  private intersection?: IntersectionObserver;
  private readonly syncListener = () => this.zone.runOutsideAngular(() => this.sync());

  constructor() { effect(() => { this.paused(); this.mode(); if (this.ready) this.syncListener(); }); }
  ngAfterViewInit(): void {
    const canvas = this.canvas().nativeElement;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) return;
    this.ready = true;
    this.zone.runOutsideAngular(() => {
      this.observer = new ResizeObserver(() => {
        const r = canvas.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 1.5);
        this.width = r.width; this.height = r.height;
        canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
        this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.draw();
      });
      this.observer.observe(canvas);
      this.intersection = new IntersectionObserver(entries => { this.inView = entries[0]?.isIntersecting ?? false; this.sync(); });
      this.intersection.observe(canvas);
      document.addEventListener('visibilitychange', this.syncListener);
      this.motion.addEventListener('change', this.syncListener);
      this.sync();
    });
  }
  private sync(): void {
    if (this.destroyed || !this.ready) return;
    if (this.motion.matches || this.paused() || document.hidden || !this.inView || this.mode() === 'out') {
      cancelAnimationFrame(this.frame); this.frame = 0; this.previous = 0;
      this.draw(); return;
    }
    if (!this.frame) this.frame = requestAnimationFrame(this.animate);
  }
  private readonly animate = (now: number): void => {
    this.frame = requestAnimationFrame(this.animate);
    if (this.previous && now - this.previous < 1000 / 30) return;
    this.elapsed += this.previous ? Math.min((now - this.previous) / 1000, .1) : 0;
    this.previous = now;
    this.draw();
  };
  private draw(): void {
    const c = this.ctx, w = this.width, h = this.height;
    if (!c || !w || !h) return;
    c.clearRect(0, 0, w, h);
    const mode = this.mode();
    if (mode !== this.lastMode) { this.lastMode = mode; this.modeStart = this.elapsed; }
    const reduced = this.motion.matches;
    const t = reduced ? 1.2 : this.elapsed, progress = Math.max(0, t - this.modeStart);
    const ambient = mode === 'ambient', burst = mode === 'burst', intro = mode === 'charge' || burst;
    if (mode === 'out') return;
    const cx = w * (ambient ? .70 : mode === 'spotlight' && w > 600 ? .34 : .5);
    const cy = h * (ambient ? .43 : mode === 'spotlight' ? .45 : .49);
    const radius = Math.min(w * (ambient ? .27 : .30), h * .37);
    const strength = ambient ? .64 : intro ? .95 : .48;
    c.save(); c.globalCompositeOperation = 'screen';
    const halo = c.createRadialGradient(cx,cy,0,cx,cy,radius*1.4);
    halo.addColorStop(0,`rgba(255,228,160,${intro ? .16 : .025})`);halo.addColorStop(.48,'rgba(117,211,255,.025)');halo.addColorStop(1,'rgba(70,164,255,0)');
    c.fillStyle = halo;c.fillRect(0,0,w,h);
    c.globalCompositeOperation = 'source-over';
    const alloy = c.createLinearGradient(cx-radius,cy-radius,cx+radius,cy+radius);
    alloy.addColorStop(0,'#c1a46c');alloy.addColorStop(.24,'#6e4b25');alloy.addColorStop(.48,'#dfc28b');alloy.addColorStop(.72,'#725028');alloy.addColorStop(1,'#c5a16a');
    for (let ring = 0; ring < 3; ring++) {
      const r = radius * (1 + ring * .19), angle = t * (ring % 2 ? -.065 : .055) + ring * .48;
      c.save();c.translate(cx,cy);c.rotate(angle);
      c.strokeStyle = alloy;c.globalAlpha = strength * (ring === 1 ? .5 : .8);c.lineWidth = ring === 0 ? 2 : 1;
      c.beginPath();c.ellipse(0,0,r,r*(ring===1?.77:1),0,0,Math.PI*2);c.stroke();
      c.setLineDash([r*.02,r*.035]);c.beginPath();c.arc(0,0,r*.97,0,Math.PI*2);c.stroke();c.setLineDash([]);
      for(let k=0;k<12;k++){
        const a=k*Math.PI/6, x=Math.cos(a)*r, y=Math.sin(a)*r*(ring===1?.77:1);
        c.save();c.translate(x,y);c.rotate(a);c.beginPath();c.moveTo(-4,0);c.lineTo(0,-7);c.lineTo(4,0);c.lineTo(0,7);c.closePath();c.stroke();
        if(k%3===0){c.beginPath();c.moveTo(-11,0);c.lineTo(11,0);c.moveTo(0,-14);c.lineTo(0,14);c.stroke();}c.restore();
      }
      c.restore();
    }
    c.globalAlpha = 1;c.globalCompositeOperation = 'screen';
    // Orbiting ribbons and comet heads, with no per-frame filters or allocations of DOM nodes.
    for(let j=0;j<(intro?5:2);j++){
      const angle=t*(j%2?-.35:.3)+j*1.9, r=radius*(1.1+j*.08);
      c.strokeStyle=`rgba(${j%2?'139,218,255':'255,213,135'},${strength*.55})`;c.lineWidth=j%2?1:1.6;
      c.beginPath();for(let k=0;k<=60;k++){const a=angle+k/60*1.4,x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r*.62; k?c.lineTo(x,y):c.moveTo(x,y);}c.save();c.globalAlpha=.12;c.lineWidth=intro?14:8;c.stroke();c.restore();c.stroke();
      const x=cx+Math.cos(angle+1.4)*r,y=cy+Math.sin(angle+1.4)*r*.62;
      this.star(c,x,y,intro?9:5,strength);
    }
    const count = w < 600 ? 36 : 70;
    for(let i=0;i<count;i++){
      const seed=((i*73+19)%101)/101, speed=.055+(i%7)*.009;
      const travel=(t*speed+seed)%1, x=ambient ? w*(.3+((i*41)%71)/100)+Math.sin(t+i)*8 : cx+Math.cos(i*2.399+t*.06)*radius*(.25+seed*1.2);
      const y=intro ? h*(1-travel) : h*(1.12-travel*1.3);
      const alpha=Math.sin(travel*Math.PI)*strength*(i%5===0?.9:.42);
      c.fillStyle=`rgba(${i%3?'240,204,136':'149,222,255'},${alpha})`;
      c.fillRect(x,y,i%4===0?2:1,i%4===0?5:2);
      if(i%14===0)this.star(c,x,y,4,alpha);
    }
    if (intro && !reduced) {
      // A single expanding shockwave per burst rather than repeated full-screen flashing.
      if(burst){const p=Math.min(progress/1.2,1);c.strokeStyle=`rgba(255,222,159,${(1-p)*.85})`;c.lineWidth=3*(1-p)+.5;c.beginPath();c.ellipse(cx,cy,radius*(.1+p*2.8),radius*(.1+p*2.8)*.66,0,0,Math.PI*2);c.stroke();}
      const beam = c.createLinearGradient(cx-radius*.22,0,cx+radius*.22,0);
      beam.addColorStop(0,'rgba(97,197,255,0)');beam.addColorStop(.43,'rgba(139,219,255,.12)');beam.addColorStop(.5,burst?'rgba(255,251,218,.65)':'rgba(255,243,200,.3)');beam.addColorStop(.57,'rgba(139,219,255,.12)');beam.addColorStop(1,'rgba(97,197,255,0)');c.fillStyle=beam;c.fillRect(cx-radius*.22,0,radius*.44,h*.75);
      this.star(c,cx,cy,radius*(burst?.15:.08),.9);
      if(burst){
        const p=Math.min(progress/1.25,1);
        for(let k=0;k<28;k++){
          const a=k*2.399, near=radius*(.2+p*.35),far=near+radius*(.15+(k%5)*.1)*Math.sin(p*Math.PI);
          c.strokeStyle=`rgba(${k%2?'255,228,173':'145,221,255'},${(1-p)*.65})`;c.lineWidth=k%3?1:2;
          c.beginPath();c.moveTo(cx+Math.cos(a)*near,cy+Math.sin(a)*near*.7);c.lineTo(cx+Math.cos(a)*far,cy+Math.sin(a)*far*.7);c.stroke();
        }
      }
    }
    c.restore();
  }
  private star(c: CanvasRenderingContext2D,x:number,y:number,r:number,alpha:number):void {
    c.save();c.globalAlpha=alpha;c.fillStyle='#ffebbd';c.beginPath();c.moveTo(x-r,y);c.quadraticCurveTo(x-1,y-1,x,y-r*1.5);c.quadraticCurveTo(x+1,y-1,x+r,y);c.quadraticCurveTo(x+1,y+1,x,y+r*1.5);c.quadraticCurveTo(x-1,y+1,x-r,y);c.fill();c.restore();
  }
  ngOnDestroy(): void {
    this.destroyed = true; cancelAnimationFrame(this.frame); this.observer?.disconnect(); this.intersection?.disconnect();
    document.removeEventListener('visibilitychange', this.syncListener);this.motion.removeEventListener('change', this.syncListener);
  }
}

import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, input, OnDestroy, viewChild } from '@angular/core';

/** Decorative scene only. Gold light and cards never select or alter a summon result. */
@Component({
  selector: 'app-summon-sanctum',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="art" aria-hidden="true"></div>
    <div class="shade" aria-hidden="true"></div>
    <canvas #light aria-hidden="true"></canvas>
    <div class="cards" aria-hidden="true">
      @for (card of cards; track $index) {
        <div class="card-place" [style.left.%]="card.x" [style.top.%]="card.y" [style.--tilt]="card.tilt + 'deg'" [style.--delay]="card.delay + 's'" [style.--duration]="card.duration + 's'" [style.--size]="card.size">
          <img src="/ui/summon-card.jpg" alt="" draggable="false" />
        </div>
      }
    </div>
  `,
  styleUrl: './summon-sanctum.component.scss',
})
export class SummonSanctumComponent implements AfterViewInit, OnDestroy {
  readonly paused = input(false);
  readonly light = viewChild.required<ElementRef<HTMLCanvasElement>>('light');
  readonly cards = [
    { x: 44, y: 42, tilt: -15, delay: -1.2, duration: 5.8, size: .9 },
    { x: 61, y: 49, tilt: 17, delay: -3.8, duration: 6.6, size: 1 },
    { x: 53, y: 31, tilt: 8, delay: -2.5, duration: 6.2, size: .65 },
    { x: 48, y: 58, tilt: -8, delay: -4.8, duration: 7, size: .6 },
  ];
  private observer?: ResizeObserver;
  private raf = 0;
  private width = 0;
  private height = 0;
  private last = 0;
  private time = 0;
  private readonly motion = matchMedia('(prefers-reduced-motion: reduce)');
  private readonly onMotion = () => { this.last = 0; this.draw(0); this.schedule(); };
  private readonly onVisibility = () => { this.last = 0; this.schedule(); };

  ngAfterViewInit(): void {
    const canvas = this.light().nativeElement;
    this.observer = new ResizeObserver(([entry]) => {
      this.width = entry.contentRect.width;
      this.height = entry.contentRect.height;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(this.width * dpr);
      canvas.height = Math.round(this.height * dpr);
      this.draw(this.time);
      this.schedule();
    });
    this.observer.observe(canvas);
    this.motion.addEventListener('change', this.onMotion);
    document.addEventListener('visibilitychange', this.onVisibility);
  }
  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
    this.motion.removeEventListener('change', this.onMotion);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }
  private schedule(): void {
    cancelAnimationFrame(this.raf);
    if (!this.motion.matches && !document.hidden) this.raf = requestAnimationFrame(now => this.frame(now));
  }
  private frame(now: number): void {
    // Decorative light is capped at 30fps; skip paint under the existing summon cinematic.
    if (!this.last || now - this.last >= 1000 / 30) {
      this.time += this.last ? Math.min(.1, (now - this.last) / 1000) : 0;
      this.last = now;
      if (!this.paused()) this.draw(this.time);
    }
    this.schedule();
  }
  private draw(t: number): void {
    const canvas = this.light().nativeElement, ctx = canvas.getContext('2d');
    const w = this.width, h = this.height;
    if (!ctx || !w || !h) return;
    ctx.setTransform(canvas.width / w, 0, 0, canvas.height / h, 0, 0);
    ctx.clearRect(0, 0, w, h);
    // Coordinates follow the static art's centred cover crop, including narrow phones.
    const scale = Math.max(w / 1280, h / 720);
    const x = w / 2, bottom = h / 2 + (500 - 360) * scale;
    const top = h / 2 + (210 - 360) * scale;
    const length = bottom - top, pulse = .8 + Math.sin(t * .9) * .08;
    const project = (px: number, py: number) => ({ x: x + (px - 640) * scale, y: h / 2 + (py - 360) * scale });
    ctx.globalCompositeOperation = 'lighter';

    // Soft gold atmosphere around a slender white-gold shaft, with tapered ends.
    ctx.save();
    ctx.translate(x, top + length * .58);
    ctx.scale(46 * scale, length * .7);
    const haze = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    haze.addColorStop(0, '#ffe7a34d'); haze.addColorStop(.45, '#eab2541a'); haze.addColorStop(1, 'transparent');
    ctx.fillStyle = haze; ctx.globalAlpha = pulse; ctx.fillRect(-1, -1, 2, 2);
    ctx.restore();
    const shaft = ctx.createLinearGradient(0, top, 0, bottom);
    shaft.addColorStop(0, 'transparent'); shaft.addColorStop(.12, '#ffe5a0');
    shaft.addColorStop(.7, '#fff6d4'); shaft.addColorStop(1, '#fffbed');
    ctx.beginPath(); ctx.moveTo(x, top);
    ctx.bezierCurveTo(x - 2 * scale, top + length * .4, x + 2 * scale, bottom - length * .2, x, bottom);
    ctx.strokeStyle = shaft; ctx.lineCap = 'round';
    for (const [width, alpha] of [[22, .035], [9, .10], [3.5, .26], [1.25, .85]]) {
      ctx.globalAlpha = alpha * pulse; ctx.lineWidth = width * scale; ctx.stroke();
    }

    // Open energy paths flow into the altar from different directions. No orbit or coil.
    const trails = [
      [125, 305, 320, 365, 500, 410],
      [1150, 270, 995, 360, 835, 445],
      [220, 525, 370, 530, 515, 455],
      [1100, 435, 920, 465, 825, 525],
      [480, 190, 535, 275, 595, 355],
    ];
    trails.forEach(([ax, ay, bx, by, cx, cy], j) => {
      const a = project(ax, ay), b = project(bx, by + Math.sin(t * .35 + j) * 6);
      const c = project(cx, cy + Math.sin(t * .28 + j * 1.7) * 9);
      const point = (p: number) => {
        const q = 1 - p;
        return { x: q ** 3 * a.x + 3 * q * q * p * b.x + 3 * q * p * p * c.x + p ** 3 * x,
          y: q ** 3 * a.y + 3 * q * q * p * b.y + 3 * q * p * p * c.y + p ** 3 * bottom };
      };
      const path = (start: number, end: number) => {
        ctx.beginPath();
        for (let i = 0; i <= 55; i++) {
          const v = point(start + (end - start) * i / 55);
          if (!i) ctx.moveTo(v.x, v.y); else ctx.lineTo(v.x, v.y);
        }
      };
      const light = ctx.createLinearGradient(a.x, a.y, x, bottom);
      light.addColorStop(0, 'transparent'); light.addColorStop(.22, '#e9bd71');
      light.addColorStop(.8, '#ffe9b2'); light.addColorStop(1, '#fff8dc');
      path(0, 1); ctx.strokeStyle = light;
      ctx.globalAlpha = .07; ctx.lineWidth = 7 * scale; ctx.stroke();
      ctx.globalAlpha = .35; ctx.lineWidth = .8 * scale; ctx.stroke();
      const head = (t * (.12 + j * .008) + j * .21) % 1;
      path(Math.max(0, head - .13), head);
      ctx.globalAlpha = Math.sin(head * Math.PI) * .8; ctx.lineWidth = 1.6 * scale; ctx.stroke();
      const v = point(head);
      ctx.fillStyle = '#fff3ce'; ctx.fillRect(v.x - .8 * scale, v.y - .8 * scale, 1.6 * scale, 1.6 * scale);
    });

    const radius = 64 * scale;
    const glow = ctx.createRadialGradient(x, bottom, 0, x, bottom, radius);
    glow.addColorStop(0, '#fff9deb3'); glow.addColorStop(.18, '#ffdf9c55'); glow.addColorStop(1, 'transparent');
    ctx.globalAlpha = pulse; ctx.fillStyle = glow;
    ctx.fillRect(x - radius, bottom - radius, radius * 2, radius * 2);
    ctx.save(); ctx.translate(x, bottom); ctx.scale(1, .28);
    const floorGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, radius * 1.5);
    floorGlow.addColorStop(0, '#fff4cf99'); floorGlow.addColorStop(.3, '#f7c97755'); floorGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = floorGlow; ctx.globalAlpha = .45;
    ctx.fillRect(-radius * 1.5, -radius * 1.5, radius * 3, radius * 3); ctx.restore();
    for (let i = 0; i < 32; i++) {
      const p = (i / 32 + t * (.07 + (i % 3) * .012)) % 1;
      const px = x + Math.sin(i * 2.4 + t * .3) * (24 + (i % 6) * 17) * scale;
      const py = bottom - p * length;
      ctx.globalAlpha = Math.sin(p * Math.PI) * .8; ctx.fillStyle = '#ffeac1';
      const r = (i % 4 === 0 ? 2 : 1) * Math.min(scale, 1.5);
      ctx.fillRect(px - r / 2, py - r / 2, r, r);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}

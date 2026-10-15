import { ParticleDef } from '../../core/data/particles';

/**
 * Particle simulation (pure, cells / seconds) for the Pixi renderer: an emitter spawns its burst at once and, with a
 * `rate`, keeps emitting for its duration; every particle integrates gravity + drag on the board's game clock, so a
 * hit-stop or pause freezes them like everything else. Drawing: `render/pixi-units.ts`.
 */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: number;
  rot: number;
  spin: number;
}

/** small deterministic RNG (mulberry32) — tests can seed it */
export function particleRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (r: () => number, [a, b]: [number, number]) => a + (b - a) * r();

export class Emitter {
  readonly particles: Particle[] = [];
  private age = 0;
  private owed = 0;
  readonly duration: number;

  constructor(
    readonly def: ParticleDef,
    /** spawn point (cells) */
    readonly x: number,
    readonly y: number,
    /** facing left: launch angles and the spawn box mirror */
    readonly flip: boolean,
    private readonly rng: () => number,
    fxLength = 0.5,
  ) {
    this.duration = def.rate ? (def.duration ?? fxLength) : 0;
    this.emit(def.count);
  }

  private emit(n: number): void {
    const d = this.def;
    const [aw, ah] = d.area ?? [0, 0];
    for (let i = 0; i < n; i++) {
      let deg = lerp(this.rng, d.angle);
      if (this.flip) deg = 180 - deg;
      const rad = (deg * Math.PI) / 180;
      const sp = lerp(this.rng, d.speed);
      this.particles.push({
        x: this.x + (this.rng() - 0.5) * aw,
        y: this.y + (this.rng() - 0.5) * ah,
        vx: Math.cos(rad) * sp,
        vy: Math.sin(rad) * sp,
        age: 0,
        life: lerp(this.rng, d.life),
        size: lerp(this.rng, d.size),
        color: d.colors[Math.floor(this.rng() * d.colors.length) % d.colors.length],
        rot: this.rng() * Math.PI * 2,
        spin: d.spin ? (lerp(this.rng, d.spin) * Math.PI) / 180 : 0,
      });
    }
  }

  /** advance by dt game seconds (0 = frozen) */
  step(dt: number): void {
    if (dt <= 0) return;
    const d = this.def;
    if (d.rate && this.age < this.duration) {
      this.owed += d.rate * Math.min(dt, this.duration - this.age);
      const n = Math.floor(this.owed);
      this.owed -= n;
      this.emit(n);
    }
    this.age += dt;
    const keep = Math.pow(d.drag ?? 1, dt);
    for (const p of this.particles) {
      p.age += dt;
      p.vy += d.gravity * dt;
      p.vx *= keep;
      p.vy *= keep;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) if (this.particles[i].age >= this.particles[i].life) this.particles.splice(i, 1);
  }

  /** 0 → 1 over the particle's life */
  static k(p: Particle): number {
    return Math.min(1, p.age / p.life);
  }

  alphaOf(p: Particle): number {
    const end = this.def.alphaEnd ?? 0;
    return 1 + (end - 1) * Emitter.k(p);
  }

  sizeOf(p: Particle): number {
    return p.size * (1 + ((this.def.sizeEnd ?? 1) - 1) * Emitter.k(p));
  }

  get done(): boolean {
    return this.age >= this.duration && this.particles.length === 0;
  }
}

import { SKY_EDGES, SKY_NODES, SKY_PLOTS, SKY_SPAWN } from '../core/data/sky-city';
import { HeroClass } from '../core/models/hero';
import { SimHeroInput } from './island-sim';

/**
 * Sky City hero roaming (pure TS, deterministic with an injected rng): heroes walk the road graph of
 * sky-city-layout.json, idle a while, and like to visit the fronts of unlocked landmarks.
 * Same public shape as IslandSim (heroes / step / setUnlocked) so the island page drives either one.
 */
export interface CityHero {
  heroId: number;
  templateId: string;
  cls: HeroClass;
  isMainHero: boolean;
  currentPosition: { x: number; y: number };
  path: string[];
  at: string;
  wait: number;
  walking: boolean;
  facingLeft: boolean;
  currentState: 'IDLE' | 'WALKING' | 'BUILDING_IDLE';
}

export const CITY_WALK_SPEED = 95; // world px / s (the city art is ~1.5× the classic island scale)

const ADJ: Record<string, string[]> = {};
for (const [a, b] of SKY_EDGES) {
  (ADJ[a] ??= []).push(b);
  (ADJ[b] ??= []).push(a);
}
const d = (a: string, b: string) => Math.hypot(SKY_NODES[a].x - SKY_NODES[b].x, SKY_NODES[a].y - SKY_NODES[b].y);

/** shortest node path [from, …, to] (Dijkstra, ~25 nodes) */
export function cityPath(from: string, to: string): string[] | null {
  if (!SKY_NODES[from] || !SKY_NODES[to]) return null;
  const dist: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set([from]);
  while (open.size) {
    let cur = '';
    for (const x of open) if (!cur || dist[x] < dist[cur]) cur = x;
    open.delete(cur);
    if (cur === to) break;
    for (const nb of ADJ[cur] ?? []) {
      const nd = dist[cur] + d(cur, nb);
      if (dist[nb] == null || nd < dist[nb]) {
        dist[nb] = nd;
        prev[nb] = cur;
        open.add(nb);
      }
    }
  }
  if (dist[to] == null) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

export class CitySim {
  readonly heroes: CityHero[];
  private unlocked: Set<string>;

  constructor(input: SimHeroInput[], unlockedBuildings: Iterable<string>, private readonly rng: () => number = Math.random) {
    this.unlocked = new Set(unlockedBuildings);
    const nodes = Object.keys(SKY_NODES);
    this.heroes = input.map((h, i) => {
      const at = h.isMain ? SKY_SPAWN : nodes[Math.floor(this.rng() * nodes.length)] ?? SKY_SPAWN;
      return {
        heroId: h.uid, templateId: h.templateId, cls: h.cls, isMainHero: h.isMain,
        currentPosition: { ...SKY_NODES[at] }, path: [], at, wait: 0.5 + i * 0.7 + this.rng() * 2,
        walking: false, facingLeft: this.rng() < 0.5, currentState: 'IDLE',
      };
    });
  }

  setUnlocked(ids: Iterable<string>): void {
    this.unlocked = new Set(ids);
  }

  /** where to go next: a landmark front (unlocked) half the time, else any road node */
  private pickTarget(h: CityHero): string {
    const fronts = Object.values(SKY_PLOTS).filter(p => this.unlocked.has(p.id)).map(p => p.front).filter(f => f !== h.at);
    const all = Object.keys(SKY_NODES).filter(n => n !== h.at);
    const pool = fronts.length && this.rng() < 0.5 ? fronts : all;
    return pool[Math.floor(this.rng() * pool.length)] ?? SKY_SPAWN;
  }

  step(dt: number): void {
    for (const h of this.heroes) {
      if (!h.path.length) {
        h.walking = false;
        h.wait -= dt;
        if (h.wait > 0) continue;
        const to = this.pickTarget(h);
        h.path = (cityPath(h.at, to) ?? [h.at]).slice(1);
        if (!h.path.length) h.wait = 2;
        continue;
      }
      const next = SKY_NODES[h.path[0]];
      const dx = next.x - h.currentPosition.x, dy = next.y - h.currentPosition.y;
      const len = Math.hypot(dx, dy);
      const stepLen = CITY_WALK_SPEED * dt;
      h.walking = true;
      h.currentState = 'WALKING';
      if (Math.abs(dx) > 0.5) h.facingLeft = dx < 0;
      if (len <= stepLen) {
        h.currentPosition = { ...next };
        h.at = h.path.shift()!;
        if (!h.path.length) {
          h.walking = false;
          const atFront = Object.values(SKY_PLOTS).some(p => p.front === h.at && this.unlocked.has(p.id));
          h.currentState = atFront ? 'BUILDING_IDLE' : 'IDLE';
          h.wait = (atFront ? 4 : 2) + this.rng() * 4;
        }
      } else {
        h.currentPosition = { x: h.currentPosition.x + (dx / len) * stepLen, y: h.currentPosition.y + (dy / len) * stepLen };
      }
    }
  }
}

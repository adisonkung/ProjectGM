import { BUILDING_BY_ID, CLASS_HANGOUTS, NAV_BY_ID, NAV_EDGES, NAV_NODES, PLOT_BY_ID } from '../core/data/island-layout';
import { HeroClass } from '../core/models/hero';
import { IslandHeroActivity, IslandHeroState, NavNode, Vec2 } from '../core/models/island';

/**
 * Home Island hero roaming — lightweight, pure TS (no Angular), deterministic with an injected rng.
 * Heroes only ever stand on navigation nodes or move along navigation edges; the layout guarantees every node / edge is
 * inside the island and outside every building footprint (island-layout.spec), so no per-frame collision is needed.
 * Nothing here is saved: positions are rebuilt locally each visit.
 */

// ------------------------------------------------------------------ graph

const ADJ: Record<string, string[]> = {};
for (const [a, b] of NAV_EDGES) {
  (ADJ[a] ??= []).push(b);
  (ADJ[b] ??= []).push(a);
}
export const neighbours = (id: string) => ADJ[id] ?? [];
const dist = (a: Vec2, b: Vec2) => Math.hypot(a.x - b.x, a.y - b.y);

/** shortest node path (Dijkstra on ~40 nodes) — [from, …, to]; null when unreachable */
export function findPath(from: string, to: string): string[] | null {
  if (!NAV_BY_ID[from] || !NAV_BY_ID[to]) return null;
  const d: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const open = new Set([from]);
  const done = new Set<string>();
  while (open.size) {
    let cur = '';
    for (const x of open) if (!cur || d[x] < d[cur]) cur = x;
    open.delete(cur);
    if (cur === to) break;
    done.add(cur);
    for (const nb of neighbours(cur)) {
      if (done.has(nb)) continue;
      const nd = d[cur] + dist(NAV_BY_ID[cur].pos, NAV_BY_ID[nb].pos);
      if (d[nb] == null || nd < d[nb]) {
        d[nb] = nd;
        prev[nb] = cur;
        open.add(nb);
      }
    }
  }
  if (d[to] == null) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

/** nodes reachable within `hops` edges */
function nearby(id: string, hops: number): string[] {
  let frontier = [id];
  const seen = new Set([id]);
  for (let i = 0; i < hops; i++) {
    const next: string[] = [];
    for (const f of frontier) for (const nb of neighbours(f)) if (!seen.has(nb)) { seen.add(nb); next.push(nb); }
    frontier = next;
  }
  seen.delete(id);
  return [...seen];
}

export const nearestNode = (p: Vec2): NavNode => NAV_NODES.reduce((best, x) => (dist(x.pos, p) < dist(best.pos, p) ? x : best));

// ------------------------------------------------------------------ simulation

export interface SimHeroInput {
  uid: number;
  templateId: string;
  cls: HeroClass;
  isMain: boolean;
}

export interface SimHero extends IslandHeroState {
  cls: HeroClass;
  /** remaining nodes to walk through (first = next node) */
  path: string[];
  /** node the hero last stood on */
  at: string;
  wait: number;
  /** seconds spent in the current moving activity (anti-stuck) */
  busy: number;
  facingLeft: boolean;
  walking: boolean;
  /** area to return to after a building visit */
  homeArea: 'PLAZA' | 'HOME';
}

export const HERO_WALK_SPEED = 55; // world units / s
const MAX_BUSY = 30; // s — safety net: a walk longer than this snaps the hero to its nearest node

export class IslandSim {
  readonly heroes: SimHero[];
  private unlocked: Set<string>;

  constructor(input: SimHeroInput[], unlockedBuildings: Iterable<string>, private readonly rng: () => number = Math.random) {
    this.unlocked = new Set(unlockedBuildings);
    const starts = ['plaza', 'plaza_w', 'plaza_e', 'plaza_s', 'home_w', 'home_e', 'home', 'tower_l', 'tower_r'];
    this.heroes = input.map((h, i) => {
      const at = starts[i % starts.length];
      return {
        heroId: h.uid, templateId: h.templateId, cls: h.cls, isMainHero: h.isMain,
        currentPosition: { ...NAV_BY_ID[at].pos }, currentState: 'IDLE' as IslandHeroActivity, targetWaypoint: at,
        path: [], at, wait: 0.4 + this.rng() * 2.2, busy: 0, facingLeft: this.rng() < 0.5, walking: false,
        homeArea: i % 2 === 0 ? 'PLAZA' : 'HOME',
      };
    });
  }

  setUnlocked(ids: Iterable<string>): void {
    this.unlocked = new Set(ids);
  }

  /** nodes claimed as a destination / standing spot by other heroes (idle & social spots hold one hero) */
  private claimed(except: SimHero): Set<string> {
    const s = new Set<string>();
    for (const h of this.heroes) if (h !== except) s.add(h.path.length ? h.targetWaypoint : h.at);
    return s;
  }

  private pick<T>(xs: T[]): T | undefined {
    return xs.length ? xs[Math.floor(this.rng() * xs.length)] : undefined;
  }

  /** buildings this hero may visit: its class hangouts that are built, else the tower / any built building */
  private buildingSpots(h: SimHero, free: (id: string) => boolean): { node: string; building?: string } | null {
    const wants = CLASS_HANGOUTS[h.cls] ?? [];
    const spots: { node: string; building?: string }[] = [];
    for (const w of wants) {
      if (w === 'PLAZA_EDGE') { for (const n of ['plaza_w', 'plaza_e']) if (free(n)) spots.push({ node: n }); continue; }
      if (!this.unlocked.has(w)) continue;
      const plot = PLOT_BY_ID[BUILDING_BY_ID[w].plotId];
      for (const n of plot.heroIdlePoints) if (free(n)) spots.push({ node: n, building: w });
    }
    if (!spots.length) {
      for (const b of this.unlocked) {
        const def = BUILDING_BY_ID[b];
        if (!def || def.future) continue;
        for (const n of PLOT_BY_ID[def.plotId].heroIdlePoints) if (free(n)) spots.push({ node: n, building: b });
      }
    }
    return this.pick(spots) ?? null;
  }

  /** choose the next activity for a hero standing still */
  private decide(h: SimHero): void {
    const taken = this.claimed(h);
    const free = (id: string) => !taken.has(id) || NAV_BY_ID[id].kind === 'PATH' || NAV_BY_ID[id].kind === 'FRONT';
    const r = this.rng();
    let target: string | undefined;
    let state: IslandHeroActivity = 'WANDER';
    let building: string | undefined;

    if (h.currentState === 'BUILDING_IDLE') {
      state = 'RETURN_TO_AREA';
      target = this.pick(NAV_NODES.filter(n => n.area === h.homeArea && free(n.id)).map(n => n.id)) ?? (h.homeArea === 'PLAZA' ? 'plaza' : 'home');
    } else if (r < (h.isMainHero ? 0.3 : 0.45)) {
      const spot = this.buildingSpots(h, free);
      if (spot) { target = spot.node; building = spot.building; state = spot.building ? 'WALK_TO_BUILDING' : 'WANDER'; }
    } else if (r < 0.75) {
      target = this.pick(nearby(h.at, 2).filter(free));
      state = 'WANDER';
    } else {
      target = this.pick(NAV_NODES.filter(n => n.kind === 'SOCIAL' && free(n.id)).map(n => n.id));
      state = 'WANDER';
    }
    const path = target && target !== h.at ? findPath(h.at, target) : null;
    if (!path || path.length < 2) { h.currentState = 'IDLE'; h.wait = 0.8 + this.rng() * 1.5; return; }
    h.path = path.slice(1);
    h.targetWaypoint = target!;
    h.targetBuildingId = building;
    h.currentState = state;
    h.busy = 0;
  }

  private arrive(h: SimHero): void {
    h.walking = false;
    const node = NAV_BY_ID[h.at];
    if (h.currentState === 'WALK_TO_BUILDING') {
      h.currentState = 'BUILDING_IDLE';
      h.wait = 3 + this.rng() * 4;
      // face the building
      const b = h.targetBuildingId ? PLOT_BY_ID[BUILDING_BY_ID[h.targetBuildingId].plotId].position : node.pos;
      h.facingLeft = b.x < node.pos.x - 4 ? true : b.x > node.pos.x + 4 ? false : h.facingLeft;
    } else if (node.kind === 'SOCIAL') {
      h.currentState = 'SOCIAL_IDLE';
      h.wait = 2.5 + this.rng() * 3.5;
      h.targetBuildingId = undefined;
    } else {
      h.currentState = 'IDLE';
      h.wait = 1 + this.rng() * 2.5;
      h.targetBuildingId = undefined;
    }
  }

  step(dt: number): void {
    for (const h of this.heroes) {
      if (!h.path.length) {
        h.wait -= dt;
        if (h.wait <= 0) this.decide(h);
        continue;
      }
      h.busy += dt;
      if (h.busy > MAX_BUSY) { // safety net (should never trigger — layout is validated)
        const n = nearestNode(h.currentPosition);
        h.currentPosition = { ...n.pos };
        h.at = n.id;
        h.path = [];
        h.walking = false;
        h.currentState = 'IDLE';
        h.wait = 1;
        continue;
      }
      let move = HERO_WALK_SPEED * dt;
      h.walking = true;
      while (move > 0 && h.path.length) {
        const to = NAV_BY_ID[h.path[0]].pos;
        const dx = to.x - h.currentPosition.x, dy = to.y - h.currentPosition.y;
        const d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.5) h.facingLeft = dx < 0;
        if (d <= move) {
          h.currentPosition = { ...to };
          h.at = h.path.shift()!;
          move -= d;
        } else {
          h.currentPosition = { x: h.currentPosition.x + (dx / d) * move, y: h.currentPosition.y + (dy / d) * move };
          move = 0;
        }
      }
      if (!h.path.length) this.arrive(h);
    }
  }
}

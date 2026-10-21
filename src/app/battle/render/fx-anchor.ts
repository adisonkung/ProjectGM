import { BOARD_COLS, BOARD_ROWS } from '../engine/grid';
export interface OutwardPose { flip: boolean; angle: number; dySign: number }
interface AnchoredFx { id: number; r: number; c: number; follow?: number; followY?: number; delayMs?: number; lockAfterMs?: number; outward?: [number,number] }
interface Anchor { born: number; worldX: number; y: number; x: number; locked: boolean; completed: boolean; follow?: number; freezes: boolean; axis?: boolean; outward?: OutwardPose }
/** Reused per-instance slots. Lock in world space after a visual strike, independent of camera and target movement. */
export class FxAnchors {
  constructor(private readonly rowOffset = 0) {}
  private readonly slots = new Map<number, Anchor>();
  sync(list: AnchoredFx[], now: number, camera: number, position: (id: number) => { x: number; y: number } | undefined): void {
    const seen = new Set<number>();
    for (const f of list) {
      seen.add(f.id);
      let slot = this.slots.get(f.id);
      if (!slot) {
        slot = { born: now, worldX: f.c * 100 + camera, x: f.c * 100, y: (f.r + this.rowOffset) * 100, locked: false, completed: false, follow: f.follow, freezes: f.lockAfterMs != null, axis: f.followY != null };
        this.slots.set(f.id, slot);
      }
      if (!slot.locked && f.follow != null) {
        const p = position(f.follow);
        if (p) { slot.worldX = p.x + camera; slot.y = p.y; }
        const floor=f.followY != null ? position(f.followY) : undefined;
        if (floor) slot.y=floor.y;
        if (f.lockAfterMs != null && (now - slot.born) * 1000 >= (f.delayMs ?? 0) + f.lockAfterMs) {
          slot.locked = true;
          if (f.outward) {
            let [dx,dy]=f.outward;
            const c=(slot.worldX-camera)/100,r=slot.y/100-this.rowOffset;
            if(c+dx<0||c+dx>BOARD_COLS-1) dx=-dx;
            if(r+dy<0||r+dy>BOARD_ROWS-1) dy=-dy;
            slot.outward={flip:dx<0,angle:Math.atan2(dy,dx)*180/Math.PI,dySign:dy===f.outward[1]?1:-1};
          }
        }
      }
      slot.x = slot.worldX - camera;
    }
    for (const id of this.slots.keys()) if (!seen.has(id)) this.slots.delete(id);
  }
  at(id: number): Readonly<Anchor> | undefined { return this.slots.get(id); }
  complete(id: number): boolean {
    const slot=this.slots.get(id);
    if (!slot || slot.completed) return false;
    slot.completed=true;return true;
  }
  clear(): void { this.slots.clear(); }
}

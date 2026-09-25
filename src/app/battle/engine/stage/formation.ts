import { Cell, Side } from '../../../core/models/unit';
import { FRONT_DEPTH, toBoard } from '../grid';

export type FormationRow = 'FRONT' | 'BACK';

/**
 * One slot of a team formation.
 * Assignment (who owns the slot) is separate from the active occupant (who is on the battlefield now):
 * a dead unit keeps its slot reserved (activeOccupant = null) and gets it back when revived.
 */
export interface FormationSlot {
  /** e.g. "BACK_3_1" = back row, depth 3, lane 1 */
  slotId: string;
  row: FormationRow;
  /** depth 0–5 from the neutral zone (0 = front) */
  columnIndex: number;
  /** lane 0–2 */
  slotIndex: number;
  /** offset from the formation origin (x = columns, y = lanes) */
  localOffset: { x: number; y: number };
  assignedUnitId: number | null;
  activeOccupant: number | null;
}

/**
 * A team's formation in world space.
 * World anchor = originPosition + slot.localOffset — moving the origin (Advance) moves every anchor,
 * so the party can keep progressing through a side-scrolling level.
 * Encounter-local board column = world x − encounter origin (the encounter origin is the player formation origin).
 */
export class FormationRuntime {
  /** world x of board column 0 of the current encounter */
  originPosition: number;
  readonly slots: FormationSlot[] = [];

  constructor(
    readonly side: Side,
    origin = 0,
  ) {
    this.originPosition = origin;
  }

  static slotId(side: Side, depth: number, lane: number): string {
    return `${side === 'ally' ? '' : 'E_'}${depth < FRONT_DEPTH ? 'FRONT' : 'BACK'}_${depth}_${lane}`;
  }

  /**
   * assign a unit to its slot (depth × lane); returns the slot.
   * `cell` = the board cell it actually spawned on (default: the slot's own cell)
   */
  assign(unitId: number, depth: number, lane: number, cell?: Cell, offset?: { x: number; y: number }): FormationSlot {
    const id = FormationRuntime.slotId(this.side, depth, lane);
    let slot = this.slots.find(s => s.slotId === id && s.assignedUnitId == null);
    if (!slot) {
      const at = cell ?? toBoard(this.side, { r: depth, c: lane });
      slot = {
        slotId: this.slots.some(s => s.slotId === id) ? `${id}#${this.slots.length}` : id,
        row: depth < FRONT_DEPTH ? 'FRONT' : 'BACK',
        columnIndex: depth,
        slotIndex: lane,
        localOffset: { x: at.c + (offset?.x ?? 0), y: at.r + (offset?.y ?? 0) },
        assignedUnitId: null,
        activeOccupant: null,
      };
      this.slots.push(slot);
    }
    slot.assignedUnitId = unitId;
    slot.activeOccupant = unitId;
    return slot;
  }

  slotOf(unitId: number): FormationSlot | undefined {
    return this.slots.find(s => s.assignedUnitId === unitId);
  }

  /** current world anchor of a unit's slot */
  anchorOf(unitId: number): { x: number; y: number } | null {
    const s = this.slotOf(unitId);
    return s ? { x: this.originPosition + s.localOffset.x, y: s.localOffset.y } : null;
  }

  /** encounter-local anchor cell (board column / lane) */
  localAnchorOf(unitId: number): { r: number; c: number } | null {
    const s = this.slotOf(unitId);
    return s ? { r: Math.round(s.localOffset.y), c: Math.round(s.localOffset.x) } : null;
  }

  /** unit left the battlefield (death / hide) — the slot stays assigned to it */
  vacate(unitId: number): void {
    const s = this.slotOf(unitId);
    if (s && s.activeOccupant === unitId) s.activeOccupant = null;
  }

  /** unit is back on the battlefield (revive) — takes its own slot again */
  occupy(unitId: number): void {
    const s = this.slotOf(unitId);
    if (s) s.activeOccupant = unitId;
  }

  /** drop every slot (enemy formation between waves) */
  clear(): void {
    this.slots.length = 0;
  }
}

import { BACKGROUNDS } from '../../core/data/backgrounds';
import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, signal } from '@angular/core';
import { CLASS_NAME } from '../../core/data/classes';
import { ENEMIES } from '../../core/data/enemies';
import { heroArt } from '../../core/data/hero-art';
import { HeroClass, OwnedHero } from '../../core/models/hero';
import { StageDef } from '../../core/models/stage';
import { LANES, SIDE_DEPTH, TEAM_SIZE } from '../../core/rules/team';
import { RosterService } from '../../core/services/roster.service';
import { TeamService } from '../../core/services/team.service';
import { BOARD_COLS, BOARD_ROWS, FRONT_DEPTH, SCENERY_ROWS, toBoard } from '../engine/grid';
import { FieldComponent } from '../field/field.component';
import { UnitSpriteComponent } from '../unit-sprite/unit-sprite.component';

/** ช่องในฝั่งเรา (r = ความลึก 0 หน้าสุด ติดเส้นกลาง, c = เลน) พร้อมตำแหน่งบนกระดาน */
interface AllyCell {
  r: number;
  c: number;
  row: number;
  col: number;
}

interface EnemyCell {
  row: number;
  col: number;
  enemy?: { name: string; cls: HeroClass; boss: boolean; sprite?: string };
}

/** ตำแหน่ง grid (เริ่มที่ 1) ของช่องในฝั่งนั้น */
const place = (side: 'ally' | 'enemy', r: number, c: number) => {
  const b = toBoard(side, { r, c });
  return { row: b.r + SCENERY_ROWS + 1, col: b.c + 1 };
};

interface HeroView {
  uid: number;
  name: string;
  cls: HeroClass;
  clsName: string;
  star: number;
  level: number;
  power: number;
  range: number;
  sprite?: string;
  injury: number;
  portrait?: string;
}

/**
 * กระดานจัดตำแหน่งก่อนต่อสู้ (แนวนอน): ฝั่งขวาแสดงศัตรูของชั้นที่เลือก (ดูอย่างเดียว)
 * ฝั่งซ้าย (ลึก 6 x 3 เลน, 2 แถวบนเป็นฉาก) ลากฮีโร่จากม้านั่งมาวาง / ลากสลับ / ลากกลับม้านั่งเพื่อถอดออก
 * หรือแตะเลือกฮีโร่แล้วแตะช่อง (ใช้ได้ทั้งมือถือและคีย์บอร์ด)
 */
@Component({
  selector: 'app-placement',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, UnitSpriteComponent, FieldComponent],
  templateUrl: './placement.component.html',
  styleUrl: './placement.component.scss',
})
export class PlacementComponent {
  private readonly team = inject(TeamService);
  private readonly roster = inject(RosterService);

  /** ด่านที่ใช้แสดงตำแหน่งศัตรู (ไม่ใส่ = ครึ่งบนว่าง) */
  readonly stage = input<StageDef | null>(null);
  readonly background = computed(() => BACKGROUNDS[this.stage()?.background ?? ''] ?? null);

  readonly teamSize = TEAM_SIZE;
  readonly cols = BOARD_COLS;
  readonly rows = BOARD_ROWS + SCENERY_ROWS;
  readonly scenery = SCENERY_ROWS;
  readonly frontDepth = FRONT_DEPTH;
  readonly selected = signal<number | null>(null);
  readonly message = signal<string | null>(null);

  readonly allyCells: AllyCell[] = Array.from({ length: SIDE_DEPTH * LANES }, (_, i) => {
    const r = Math.floor(i / LANES);
    const c = i % LANES;
    return { r, c, ...place('ally', r, c) };
  });

  private readonly heroes = computed(() => {
    const map = new Map<number, HeroView>();
    for (const h of this.roster.heroes()) map.set(h.uid, this.view(h));
    return map;
  });

  /** ฮีโร่ในแต่ละช่อง คีย์ = r*7+c */
  readonly occupied = computed(() => {
    const map = new Map<number, HeroView>();
    for (const s of this.team.slots()) {
      const h = this.heroes().get(s.uid);
      if (h) map.set(s.r * LANES + s.c, h);
    }
    return map;
  });

  readonly bench = computed(() => {
    const inTeam = new Set(this.team.slots().map(s => s.uid));
    return [...this.heroes().values()]
      .filter(h => !inTeam.has(h.uid))
      .sort((a, b) => a.injury - b.injury || b.star - a.star || b.power - a.power);
  });

  readonly count = computed(() => this.team.slots().length);
  readonly totalPower = computed(() => this.team.slots().reduce((a, s) => a + (this.heroes().get(s.uid)?.power ?? 0), 0));
  readonly selectedHero = computed(() => {
    const uid = this.selected();
    return uid == null ? null : (this.heroes().get(uid) ?? null);
  });
  readonly selectedInTeam = computed(() => this.team.slots().some(s => s.uid === this.selected()));

  /** ช่องฝั่งศัตรูทั้งหมด พร้อมศัตรูของชั้นที่เลือก */
  readonly enemyCells = computed<EnemyCell[]>(() => {
    const cells: EnemyCell[] = Array.from({ length: SIDE_DEPTH * LANES }, (_, i) =>
      place('enemy', Math.floor(i / LANES), i % LANES),
    );
    for (const p of this.stage()?.enemies ?? []) {
      const t = ENEMIES[p.enemy];
      if (t) cells[p.r * LANES + p.c].enemy = { name: t.name, cls: t.cls, boss: !!t.boss, sprite: t.sprite };
    }
    return cells;
  });

  private lastDrag = 0;
  private msgTimer?: ReturnType<typeof setTimeout>;

  at(cell: AllyCell): HeroView | undefined {
    return this.occupied().get(cell.r * LANES + cell.c);
  }

  // ------------------------------------------------------------ ลากวาง

  canEnterCell = (drag: CdkDrag<number>) => (this.heroes().get(drag.data)?.injury ?? 1) === 0;

  dropOnCell(e: CdkDragDrop<AllyCell, unknown, number>): void {
    this.lastDrag = Date.now();
    this.placeAt(e.item.data, e.container.data);
  }

  dropOnBench(e: CdkDragDrop<unknown, unknown, number>): void {
    this.lastDrag = Date.now();
    if (e.previousContainer !== e.container) this.team.remove(e.item.data);
  }

  dragStarted(uid: number): void {
    this.selected.set(uid);
  }

  // ------------------------------------------------------------ แตะเลือก

  tapCell(cell: AllyCell): void {
    if (this.justDragged()) return;
    const sel = this.selected();
    const here = this.at(cell);
    if (sel == null) {
      if (here) this.selected.set(here.uid);
      return;
    }
    if (here?.uid === sel) {
      this.selected.set(null);
      return;
    }
    this.placeAt(sel, cell);
  }

  tapHero(uid: number, ev: Event): void {
    ev.stopPropagation();
    if (this.justDragged()) return;
    const h = this.heroes().get(uid);
    if (h && h.injury > 0) {
      this.flash(`${h.name} บาดเจ็บ พักอีก ${h.injury} รอบ`);
      return;
    }
    this.selected.update(s => (s === uid ? null : uid));
  }

  /** แตะม้านั่ง: ถ้าเลือกตัวที่อยู่บนกระดานอยู่ ให้ถอดออก */
  tapBench(): void {
    if (this.justDragged()) return;
    const sel = this.selected();
    if (sel != null && this.selectedInTeam()) this.team.remove(sel);
    this.selected.set(null);
  }

  removeSelected(): void {
    const sel = this.selected();
    if (sel != null) this.team.remove(sel);
    this.selected.set(null);
  }

  auto(): void {
    this.team.auto();
    this.selected.set(null);
  }

  clear(): void {
    this.team.clear();
    this.selected.set(null);
  }

  cellLabel(cell: AllyCell): string {
    const h = this.at(cell);
    const where = `เลน ${cell.c + 1} ลึก ${cell.r + 1}`;
    return h ? `${where}: ${h.name} ${h.clsName}` : `${where}: ว่าง`;
  }

  // ------------------------------------------------------------ ภายใน

  private placeAt(uid: number, cell: AllyCell): void {
    const h = this.heroes().get(uid);
    if (!h) return;
    if (h.injury > 0) {
      this.flash(`${h.name} บาดเจ็บ ลงสนามไม่ได้`);
      return;
    }
    if (!this.team.place(uid, cell.r, cell.c)) {
      this.flash(`ทีมเต็มแล้ว (${TEAM_SIZE} ตัว) ลากตัวใดตัวหนึ่งออกก่อน หรือวางทับเพื่อสลับ`);
      return;
    }
    this.selected.set(null);
  }

  private justDragged(): boolean {
    return Date.now() - this.lastDrag < 250;
  }

  private flash(text: string): void {
    clearTimeout(this.msgTimer);
    this.message.set(text);
    this.msgTimer = setTimeout(() => this.message.set(null), 2600);
  }

  private view(h: OwnedHero): HeroView {
    const t = this.roster.template(h);
    const s = this.roster.stats(h);
    return {
      uid: h.uid,
      name: t.name,
      cls: t.cls,
      clsName: CLASS_NAME[t.cls],
      star: t.star,
      level: h.level,
      power: this.roster.power(h),
      range: s.range,
      sprite: t.sprite,
      injury: h.injury,
      portrait: heroArt(t.id)?.portrait,
    };
  }
}

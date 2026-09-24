import { CdkDrag, CdkDragDrop, CdkDropList, CdkDropListGroup } from '@angular/cdk/drag-drop';
import { Component, computed, inject, input, signal } from '@angular/core';
import { CLASS_NAME } from '../../core/data/classes';
import { ENEMIES } from '../../core/data/enemies';
import { HeroClass, OwnedHero } from '../../core/models/hero';
import { StageDef } from '../../core/models/stage';
import { SIDE_COLS, SIDE_ROWS, TEAM_SIZE } from '../../core/rules/team';
import { RosterService } from '../../core/services/roster.service';
import { TeamService } from '../../core/services/team.service';
import { BOARD_ROWS } from '../engine/grid';
import { UnitSpriteComponent } from '../unit-sprite/unit-sprite.component';

/** ช่องในครึ่งกระดานของเรา (r=0 แถวหน้า ติดกลางสนาม) */
interface AllyCell {
  r: number;
  c: number;
}

interface EnemyCell {
  c: number;
  enemy?: { name: string; cls: HeroClass; boss: boolean };
}

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
}

/**
 * กระดานจัดตำแหน่งก่อนต่อสู้: ครึ่งบนแสดงศัตรูของชั้นที่เลือก (ดูอย่างเดียว)
 * ครึ่งล่าง 4x7 ลากฮีโร่จากม้านั่งมาวาง / ลากสลับ / ลากกลับม้านั่งเพื่อถอดออก
 * หรือแตะเลือกฮีโร่แล้วแตะช่อง (ใช้ได้ทั้งมือถือและคีย์บอร์ด)
 */
@Component({
  selector: 'app-placement',
  imports: [CdkDropListGroup, CdkDropList, CdkDrag, UnitSpriteComponent],
  templateUrl: './placement.component.html',
  styleUrl: './placement.component.scss',
})
export class PlacementComponent {
  private readonly team = inject(TeamService);
  private readonly roster = inject(RosterService);

  /** ด่านที่ใช้แสดงตำแหน่งศัตรู (ไม่ใส่ = ครึ่งบนว่าง) */
  readonly stage = input<StageDef | null>(null);

  readonly teamSize = TEAM_SIZE;
  readonly cols = SIDE_COLS;
  readonly rows = BOARD_ROWS;
  readonly selected = signal<number | null>(null);
  readonly message = signal<string | null>(null);

  readonly allyCells: AllyCell[] = Array.from({ length: SIDE_ROWS * SIDE_COLS }, (_, i) => ({
    r: Math.floor(i / SIDE_COLS),
    c: i % SIDE_COLS,
  }));

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
      if (h) map.set(s.r * SIDE_COLS + s.c, h);
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

  /** แถวของศัตรูเรียงจากบนลงล่าง (แถวหลังสุดของศัตรูอยู่บนสุด) */
  readonly enemyRows = computed<EnemyCell[][]>(() => {
    const rows: EnemyCell[][] = Array.from({ length: SIDE_ROWS }, () =>
      Array.from({ length: SIDE_COLS }, (_, c) => ({ c })),
    );
    for (const p of this.stage()?.enemies ?? []) {
      const t = ENEMIES[p.enemy];
      if (t) rows[SIDE_ROWS - 1 - p.r][p.c].enemy = { name: t.name, cls: t.cls, boss: !!t.boss };
    }
    return rows;
  });

  private lastDrag = 0;
  private msgTimer?: ReturnType<typeof setTimeout>;

  at(cell: AllyCell): HeroView | undefined {
    return this.occupied().get(cell.r * SIDE_COLS + cell.c);
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
    const where = `แถว ${cell.r + 1} ช่อง ${cell.c + 1}`;
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
    };
  }
}

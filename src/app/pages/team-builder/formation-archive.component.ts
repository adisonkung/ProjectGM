import { NgTemplateOutlet } from '@angular/common';
import {
  afterNextRender, ChangeDetectionStrategy, Component, computed, DestroyRef,
  ElementRef, HostListener, inject, signal, viewChild,
} from '@angular/core';
import { CLASS_NAME } from '../../core/data/classes';
import { heroArt } from '../../core/data/hero-art';
import { HeroClass } from '../../core/models/hero';
import { LANES, SIDE_DEPTH, TEAM_SIZE } from '../../core/rules/team';
import { RosterService } from '../../core/services/roster.service';
import { TeamService } from '../../core/services/team.service';
import { HeroStarsComponent } from '../../shared/hero-stars.component';
import { IconComponent } from '../../shared/icon.component';
import { UnitSpriteComponent } from '../../battle/unit-sprite/unit-sprite.component';
import { HERO_CLASS_COLORS } from '../heroes/collection-class-colors';
import { CollectionHeaderComponent } from '../heroes/collection-header.component';
import { CollectionIconComponent } from '../heroes/collection-icon.component';

const ZONES = ['แนวหลัง', 'แนวกลาง', 'แนวหน้า'];
const CELLS = Array.from({ length: LANES * SIDE_DEPTH }, (_, index) => {
  const lane = Math.floor(index / SIDE_DEPTH);
  const column = index % SIDE_DEPTH;
  return { r: SIDE_DEPTH - 1 - column, c: lane, zone: Math.floor(column / (SIDE_DEPTH / ZONES.length)) };
});
const MIN_PAGE_SIZE = 9;
const CARD_GAP = 8;
const DRAG_DISTANCE = 6;
const LANDING_DURATION_MS = 620;

interface BoardPoint { x: number; y: number }
interface DragState {
  pointer: number;
  uid: number;
  source: HTMLElement;
  start: BoardPoint;
  fromField: boolean;
  previousHero: number | null;
  previousCell: number | null;
}

@Component({
  selector: 'app-formation-archive',
  imports: [NgTemplateOutlet, CollectionHeaderComponent, CollectionIconComponent, HeroStarsComponent, IconComponent, UnitSpriteComponent],
  templateUrl: './formation-archive.component.html',
  styleUrl: './formation-archive.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormationArchiveComponent {
  readonly team = inject(TeamService);
  private readonly roster = inject(RosterService);
  private readonly root = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly field = viewChild.required<ElementRef<HTMLElement>>('field');
  private readonly rail = viewChild.required<ElementRef<HTMLElement>>('rail');

  readonly cells = CELLS;
  readonly zones = ZONES;
  readonly classNames = CLASS_NAME;
  readonly classColors = HERO_CLASS_COLORS;
  readonly classes = Object.keys(HERO_CLASS_COLORS) as HeroClass[];
  readonly teamSize = TEAM_SIZE;
  readonly teamPips = Array.from({ length: TEAM_SIZE }, (_, index) => index);
  readonly columns = SIDE_DEPTH;
  readonly rosterSize = signal(MIN_PAGE_SIZE);
  readonly rosterGap = CARD_GAP;

  readonly heroes = computed(() => this.roster.heroes().map(owned => {
    const hero = this.roster.template(owned);
    return {
      uid: owned.uid, name: hero.name, shortName: hero.name.split(' ')[0], cls: hero.cls, sprite: hero.sprite,
      portrait: heroArt(hero.id)?.portrait, level: owned.level, star: this.roster.star(owned),
    };
  }));
  readonly heroByUid = computed(() => new Map(this.heroes().map(hero => [hero.uid, hero])));
  readonly formation = computed(() => {
    const positions = new Map(this.team.slots().map(slot => [`${slot.r},${slot.c}`, slot.uid]));
    return this.cells.map(cell => positions.get(`${cell.r},${cell.c}`) ?? null);
  });

  readonly preset = signal(Math.max(0, this.team.activePreset()));
  readonly editingPreset = signal<number | null>(null);
  readonly selected = signal<number | null>(null);
  readonly pendingCell = signal<number | null>(null);
  readonly notice = signal('');
  readonly landingPulses = signal<{ cell: number; id: number }[]>([]);
  readonly filter = signal<HeroClass | 'all'>('all');
  readonly page = signal(0);
  readonly filtered = computed(() => this.heroes().filter(hero => this.filter() === 'all' || hero.cls === this.filter()));
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.rosterSize())));
  readonly currentPage = computed(() => Math.min(this.page(), this.pageCount() - 1));
  readonly pageHeroes = computed(() => this.filtered().slice(this.currentPage() * this.rosterSize(), (this.currentPage() + 1) * this.rosterSize()));
  readonly anchors = signal<BoardPoint[]>([]);
  readonly dragPoint = signal<BoardPoint | null>(null);
  private readonly destination = signal<number | 'outside' | null>(null);
  readonly dropCell = computed(() => {
    const destination = this.destination();
    return typeof destination === 'number' ? destination : null;
  });
  readonly dragRemovesHero = computed(() => this.destination() === 'outside' && this.drag?.fromField === true);
  readonly draggingHero = signal<number | null>(null);
  readonly deployed = computed(() => new Set(this.team.slots().map(slot => slot.uid)));
  private drag: DragState | null = null;
  private ignoreClick = false;
  private landingId = 0;
  private landingTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => clearTimeout(this.landingTimer));
    afterNextRender(() => {
      const field = this.field().nativeElement;
      const rail = this.rail().nativeElement;
      const measure = () => {
        const bounds = field.getBoundingClientRect();
        // Measure real projected points so the standing portraits and their ground slots share the same geometry.
        this.anchors.set(Array.from(field.querySelectorAll('.slot-anchor'), anchor => {
          const rect = anchor.getBoundingClientRect();
          return { x: rect.left - bounds.left, y: rect.top - bounds.top };
        }));
        // Fit more portraits at wider Desktop ratios without stretching the cards horizontally.
        if (rail.clientHeight > 0) {
          const cardWidth = rail.clientHeight * .8;
          const capacity = Math.floor((rail.clientWidth + CARD_GAP) / (cardWidth + CARD_GAP));
          this.rosterSize.set(Math.max(MIN_PAGE_SIZE, capacity));
        }
      };
      const observer = new ResizeObserver(measure);
      observer.observe(field);
      observer.observe(rail);
      measure();
      destroy.onDestroy(() => observer.disconnect());
    });
  }

  selectPreset(index: number): void {
    this.clearLanding();
    this.preset.set(index);
    this.team.loadPreset(index);
    this.resetSelection();
  }

  editPreset(index: number): void {
    this.editingPreset.set(index);
    requestAnimationFrame(() => {
      const input = this.root.querySelector<HTMLInputElement>('.preset input');
      input?.focus();
      input?.select();
    });
  }

  renamePreset(index: number, name: string): void {
    if (this.editingPreset() !== index) return;
    this.team.renamePreset(index, name);
    this.editingPreset.set(null);
  }

  savePreset(): void {
    this.team.savePreset(this.preset());
    this.notice.set(`บันทึก ${this.team.presets()[this.preset()].name} แล้ว`);
  }

  auto(): void {
    this.clearLanding();
    this.team.auto();
    this.resetSelection();
    this.notice.set('จัดทีมอัตโนมัติแล้ว');
  }

  setFilter(value: HeroClass | 'all'): void {
    this.filter.set(value);
    this.page.set(0);
    const selected = this.selected();
    if (selected !== null && !this.deployed().has(selected)
      && value !== 'all' && this.heroByUid().get(selected)?.cls !== value) this.selected.set(null);
  }

  selectHero(uid: number): void {
    if (this.ignoreClick) return;
    const pending = this.pendingCell();
    if (pending !== null) {
      this.placeAt(uid, pending);
      return;
    }
    this.notice.set('');
    this.selected.update(current => current === uid ? null : uid);
  }

  selectCell(index: number): void {
    if (this.ignoreClick) return;
    const here = this.formation()[index];
    const selected = this.selected();
    this.notice.set('');
    if (selected !== null && selected !== here) {
      this.placeAt(selected, index);
    } else if (here !== null) {
      this.selectHero(here);
    } else {
      this.pendingCell.update(current => current === index ? null : index);
    }
  }

  remove(uid: number, index: number): void {
    if (this.ignoreClick) return;
    this.removeFromField(uid);
    this.root.querySelector<HTMLElement>(`[data-ground-cell="${index}"]`)?.focus({ preventScroll: true });
  }

  beginDrag(event: PointerEvent, uid: number, fromField: boolean): void {
    if (event.button !== 0 || !event.isPrimary || this.drag) return;
    this.ignoreClick = false;
    this.drag = {
      pointer: event.pointerId, uid, fromField, source: event.currentTarget as HTMLElement,
      start: { x: event.clientX, y: event.clientY },
      previousHero: this.selected(), previousCell: this.pendingCell(),
    };
  }

  @HostListener('window:pointermove', ['$event'])
  moveDrag(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    const point = { x: event.clientX, y: event.clientY };
    if (this.draggingHero() === null) {
      if (Math.hypot(point.x - drag.start.x, point.y - drag.start.y) < DRAG_DISTANCE) return;
      drag.source.setPointerCapture(drag.pointer);
      this.pendingCell.set(null);
      this.selected.set(drag.uid);
      this.draggingHero.set(drag.uid);
      this.notice.set('');
    }
    this.dragPoint.set(point);
    this.destination.set(this.dropAt(point));
  }

  @HostListener('window:pointerup', ['$event'])
  endDrag(event: PointerEvent): void {
    const drag = this.drag;
    if (!drag || event.pointerId !== drag.pointer) return;
    const destination = this.draggingHero() === null ? null : this.dropAt({ x: event.clientX, y: event.clientY });
    this.finishDrag();
    if (typeof destination === 'number') this.placeAt(drag.uid, destination);
    else if (destination === 'outside' && drag.fromField) this.removeFromField(drag.uid);
  }

  @HostListener('window:pointercancel', ['$event'])
  cancelPointer(event: PointerEvent): void {
    if (this.drag?.pointer === event.pointerId) this.cancelDrag();
  }

  @HostListener('window:blur')
  @HostListener('keydown.escape')
  cancelDrag(): void {
    if (this.drag && this.draggingHero() !== null) {
      this.selected.set(this.drag.previousHero);
      this.pendingCell.set(this.drag.previousCell);
    }
    this.finishDrag();
  }

  private finishDrag(): void {
    const moved = this.draggingHero() !== null;
    const drag = this.drag;
    this.drag = null;
    this.dragPoint.set(null);
    this.destination.set(null);
    this.draggingHero.set(null);
    if (moved) {
      this.ignoreClick = true;
      setTimeout(() => { this.ignoreClick = false; });
    }
    if (drag?.source.hasPointerCapture(drag.pointer)) drag.source.releasePointerCapture(drag.pointer);
  }

  private dropAt(point: BoardPoint): number | 'outside' | null {
    const hits = this.root.ownerDocument.elementsFromPoint(point.x, point.y);
    // Floor slots take priority even behind a nearer portrait. The rest of a portrait also accepts swaps.
    const cell = hits.find(element => element.matches('[data-ground-cell]') && this.root.contains(element));
    if (cell) return Number(cell.getAttribute('data-ground-cell'));
    const card = hits.find(element => element.matches('[data-card-cell]') && this.root.contains(element));
    if (card) return Number(card.getAttribute('data-card-cell'));
    return hits.some(element => element.matches('.ground') && this.root.contains(element)) ? null : 'outside';
  }

  private resetSelection(): void {
    this.selected.set(null);
    this.pendingCell.set(null);
    this.notice.set('');
  }

  private placeAt(uid: number, index: number): void {
    const { r, c } = this.cells[index];
    if (this.formation()[index] === uid) {
      this.resetSelection();
    } else if (this.team.place(uid, r, c)) {
      this.resetSelection();
      this.clearLanding();
      this.landingPulses.set([{ cell: index, id: ++this.landingId }]);
      this.landingTimer = setTimeout(() => this.landingPulses.set([]), LANDING_DURATION_MS);
    } else {
      this.notice.set(`ทีมเต็ม ${TEAM_SIZE} คน วางทับการ์ดเดิมเพื่อเปลี่ยนตัว`);
    }
  }

  private clearLanding(): void {
    clearTimeout(this.landingTimer);
    this.landingPulses.set([]);
  }

  private removeFromField(uid: number): void {
    this.clearLanding();
    this.team.remove(uid);
    this.resetSelection();
    this.notice.set(`ถอด ${this.heroByUid().get(uid)?.name} ออกจากทีมแล้ว`);
  }
}

import { MockVisual } from '../../core/data/visuals';
import { BackgroundDef } from '../../core/data/backgrounds';
import { Component, computed, input, output } from '@angular/core';
import { HeroClass } from '../../core/models/hero';
import { Side } from '../../core/models/unit';
import { BOARD_COLS, BOARD_ROWS, SCENERY_ROWS } from '../engine/grid';
import { CastBarComponent, CastView } from '../cast-bar/cast-bar.component';
import { FieldComponent } from '../field/field.component';
import { FocusMarkComponent } from '../focus-mark/focus-mark.component';
import { FxSpriteComponent } from '../fx-sprite/fx-sprite.component';
import { ProjectileComponent } from '../projectile/projectile.component';
import { SpriteAnim, UnitSpriteComponent } from '../unit-sprite/unit-sprite.component';

/** ข้อมูลยูนิตสำหรับแสดงผล (สแนปช็อตจากเอนจินในแต่ละเฟรม) */
export interface UnitView {
  id: number;
  side: Side;
  name: string;
  cls: HeroClass;
  /** screen position in cells (continuous): r = lane, c = column inside the camera window */
  r: number;
  c: number;
  hpPct: number;
  manaPct: number;
  /** โล่เทียบกับเลือดสูงสุด (%) */
  shieldPct: number;
  alive: boolean;
  /** resurrection materialising (visible, untargetable) */
  reviving?: boolean;
  taunt: boolean;
  star?: number;
  level?: number;
  sprite?: string;
  boss?: boolean;
  /** หันซ้าย */
  flip?: boolean;
  /** เพิ่งวาร์ป: ย้ายทันทีไม่ต้องเลื่อน แล้วค่อย ๆ ปรากฏ */
  blink?: boolean;
  /** ผู้เล่นกดท่าไม้ตายแล้ว รอจังหวะร่าย */
  queued?: boolean;
  /** ศัตรูกำลังร่ายสกิล (แถบร่าย) */
  cast?: CastView;
  /** ฮีโร่: ท่าไม้ตายตัดการร่ายได้ */
  interrupter?: boolean;
  /** แนวรบตามฟอร์เมชัน */
  line?: 'front' | 'back';
  /** STEP 9: เป็นเป้าโฟกัส / ถูกเลือกอยู่ (ศัตรู) · เหตุผลการเลือกเป้า (ฮีโร่) */
  focused?: boolean;
  selected?: boolean;
  intent?: string;
  /** ฮีโร่: กำลังตีเป้าโฟกัสอยู่ */
  onFocus?: boolean;
  /** ฮีโร่: id ต้นแบบ (ภาพ) + คูลดาวน์ที่เหลือ/เต็ม ของสกิล 1 และ 2 (วิ) */
  heroId?: string;
  cd1?: number;
  cd2?: number;
  cd1Max?: number;
  cd2Max?: number;
  /** monster: elite rank / seconds per step (movement tween) / buffed / token icon */
  elite?: boolean;
  moveSec?: number;
  buffed?: boolean;
  icon?: string;
  /** hero AI use modes per slot (party bar chips) */
  modes?: Partial<Record<'skill' | 'skill2' | 'ult', string>>;
  /** BOSS / FINAL_BOSS (boss bar) */
  bossRank?: string;
  /** placeholder art for monsters without a sheet (+ name / HP% label under it) */
  mock?: MockVisual;
  /** status icons over the head */
  statuses?: { id: string; icon: string; left: number }[];
  /** mist form / boss seal: can't be targeted (drawn faded) */
  untargetable?: boolean;
  /** BROKEN by a Break (boss) */
  broken?: boolean;
  /** enraged boss phase (red aura) */
  enraged?: boolean;
  /** combat debug lines (dev builds only) + current target id for the target line */
  debug?: string[];
  targetId?: number | null;
}

/** mock FX: a telegraphed / flashing area on the board (screen cells) */
export interface ZoneView {
  id: number;
  r: number;
  c: number;
  w: number;
  h: number;
  color: string;
  /** telegraph = growing outline during the cast · flash = activation burst */
  kind: 'telegraph' | 'flash';
  /** telegraph length (game s) */
  sec?: number;
}

export interface FloatText {
  id: number;
  r: number;
  c: number;
  text: string;
  kind: 'dmg' | 'crit' | 'heal' | 'skill' | 'poison' | 'shield' | 'revive' | 'interrupt' | 'immune' | 'buff' | 'miss' | 'break';
}

/** เอฟเฟกต์สกิลที่กำลังเล่นบนกระดาน */
export interface FxView {
  id: number;
  r: number;
  c: number;
  name: string;
  angle: number;
  flip?: boolean;
  /** resolved [dx, dy] on the owner's anchor (`fxOffset`) */
  offset?: [number, number];
  /** drawn below the units (FxDef.layer 'under') */
  under?: boolean;
}

/** กระสุนที่กำลังบิน: ตำแหน่งเป็นจำนวนช่องบนจอ (รวมแถวฉากแล้ว) */
export interface ProjectileView {
  id: number;
  name: string;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** ms ที่ความเร็ว x1 */
  flight: number;
}

/** debug world overlay (dev builds): formation anchors, zones, advance target, regroup radius — screen cells */
export interface WorldDebug {
  anchors: { x: number; y: number; team: 'ally' | 'enemy'; label: string; empty: boolean }[];
  neutral: { x0: number; x1: number };
  advanceTarget: number | null;
  regroupRadius: number;
}

export interface AnimState {
  anim: SpriteAnim;
  key: number;
  /** anim 'cast': cast time in game seconds */
  castTime?: number;
  /** anim 'cast': the skill's clip (sheets with several cast rows) */
  castClip?: string;
  /** play over a running attack/cast (interrupt → hurt) */
  force?: boolean;
}

@Component({
  selector: 'app-board',
  imports: [UnitSpriteComponent, FxSpriteComponent, FieldComponent, ProjectileComponent, CastBarComponent, FocusMarkComponent],
  templateUrl: './board.component.html',
  styleUrl: './board.component.scss',
})
export class BoardComponent {
  readonly units = input<UnitView[]>([]);
  readonly floats = input<FloatText[]>([]);
  readonly fx = input<FxView[]>([]);
  readonly zones = input<ZoneView[]>([]);
  readonly projectiles = input<ProjectileView[]>([]);
  readonly anims = input<Partial<Record<number, AnimState>>>({});
  readonly speed = input(1);
  /** แตะศัตรู (เลือกเพื่อโฟกัส) */
  readonly pick = output<number>();
  /** camera x in cells (background parallax follows it continuously) */
  readonly scroll = input(0);
  /** ภาพพื้นหลังของด่าน */
  readonly background = input<BackgroundDef | null | undefined>(null);
  /** combat debug overlay (states, targets) */
  readonly debug = input(false);
  /** debug: formation anchors / zones / regroup radius */
  readonly world = input<WorldDebug | null>(null);
  /** real ms between two snapshots (positions tween linearly over it) */
  readonly tickMs = input(50);
  /** debug: lines from each monster to its target (board cell coordinates incl. scenery rows) */
  readonly targetLines = computed(() => {
    if (!this.debug()) return [];
    const byId = new Map(this.units().map(u => [u.id, u]));
    return this.units()
      .filter(u => u.alive && u.debug && u.targetId != null && byId.get(u.targetId!)?.alive)
      .map(u => {
        const t = byId.get(u.targetId!)!;
        return { id: u.id, x1: u.c + 0.5, y1: u.r + SCENERY_ROWS + 0.5, x2: t.c + 0.5, y2: t.r + SCENERY_ROWS + 0.5 };
      });
  });

  readonly rows = BOARD_ROWS + SCENERY_ROWS;
  readonly cols = BOARD_COLS;

  /**
   * ตัวที่ยืนช่องเดียวกัน: เลื่อนให้เหลื่อมกันเป็นชั้น ๆ (ซ้าย-ขวา และสูง-ต่ำสลับกัน)
   * คืน [dx%, dy%, ลำดับชั้น, ลำดับในกอง (ยกหลอดเลือดขึ้นทีละชั้นไม่ให้ทับกัน)] ตาม id
   */
  readonly spread = computed(() => {
    const groups = new Map<number, UnitView[]>();
    for (const u of this.units()) {
      if (!u.alive) continue;
      const k = Math.round(u.r) * 1000 + Math.round(u.c);
      groups.set(k, [...(groups.get(k) ?? []), u]);
    }
    const out = new Map<number, [number, number, number, number]>();
    for (const list of groups.values()) {
      const n = list.length;
      list.forEach((u, i) => {
        if (n === 1) {
          out.set(u.id, [0, 0, 0, 0]);
          return;
        }
        const dx = (i - (n - 1) / 2) * (56 / n);
        const dy = i % 2 ? -10 : 6;
        out.set(u.id, [dx, dy, dy > 0 ? 2 : 1, i]);
      });
    }
    return out;
  });

  pos(r: number, c: number, dx = 0, dy = 0): string {
    return `translate(${c * 100 + dx}%, ${(r + SCENERY_ROWS) * 100 + dy}%)`;
  }

  unitPos(u: UnitView): string {
    const [dx, dy] = this.spread().get(u.id) ?? [0, 0];
    return this.pos(u.r, u.c, dx, dy);
  }

  /** caster standing in the outer columns: its cast bar hugs the inside of the field */
  edgeOf(u: UnitView): 'l' | 'r' | '' {
    return u.c < 1 ? 'l' : u.c > this.cols - 2 ? 'r' : '';
  }

  /** ตัวที่อยู่ต่ำกว่า (ใกล้จอ) วาดทับตัวที่อยู่สูงกว่า */
  unitZ(u: UnitView): number {
    return (u.r + SCENERY_ROWS) * 10 + (this.spread().get(u.id)?.[2] ?? 0) + (u.alive ? 3 : 0);
  }
}

import { BACKGROUNDS } from '../../core/data/backgrounds';
import { Component, computed, effect, HostListener, inject, isDevMode, OnDestroy, signal, untracked } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ENEMIES } from '../../core/data/enemies';
import { STAGES } from '../../core/data/stages';
import { power } from '../../core/rules/stats';
import { TeamService } from '../../core/services/team.service';
import { AnimState, BoardComponent, FloatText, FxView, ProjectileView, UnitView, WorldDebug, ZoneView } from '../../battle/board/board.component';
import { projectileLife } from '../../battle/projectile/projectile.component';
import { ENEMY_ZONE_START, SCENERY_ROWS, SIDE_DEPTH } from '../../battle/engine/grid';
import { BattlePhase } from '../../battle/engine/stage/types';
import { PartyBarComponent } from '../../battle/party-bar/party-bar.component';
import { kitInterrupts, kitOf } from '../../core/data/hero-skills';
import { hasStatus } from '../../battle/engine/buffs';
import { PlacementComponent } from '../../battle/placement/placement.component';
import { fxDuration } from '../../battle/fx-sprite/fx-sprite.component';
import { CLASS_PROJECTILE, FX, SHEETS, SkillKind } from '../../core/data/sprites';
import { BattleEngine, BattleEvent, BattleResult, BattleUnit } from '../../battle/engine/battle-engine';
import { monsterSnapshot } from '../../battle/engine/monster-controller';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { mockVisualOf, STATUS_ICONS } from '../../core/data/visuals';
import { isBossRank, MonsterSkillDefinition } from '../../core/models/monster';
import { AreaPattern } from '../../core/models/combat';
import { hasFlag } from '../../battle/engine/buffs';

const TICK = 0.05;

/**
 * ห้องทดลองต่อสู้: เลือกชั้น จัดตำแหน่งบนกระดาน แล้วดูทีมปัจจุบันสู้กับศัตรูบนกระดาน 8x7
 * ผลการต่อสู้ไม่มีผลกับเซฟ (แต่การจัดตำแหน่งบันทึกลงทีม) ใช้ทดสอบเอนจินและปรับสมดุล
 */
@Component({
  selector: 'app-battle',
  imports: [BoardComponent, PlacementComponent, PartyBarComponent],
  templateUrl: './battle.component.html',
  styleUrl: './battle.component.scss',
})
export class BattleComponent implements OnDestroy {
  private readonly team = inject(TeamService);

  readonly stages = STAGES;
  readonly floor = signal(1);
  readonly speed = signal(1);
  readonly running = signal(false);
  readonly result = signal<BattleResult | null>(null);
  readonly time = signal(0);
  readonly views = signal<UnitView[]>([]);
  readonly floats = signal<FloatText[]>([]);
  readonly fx = signal<FxView[]>([]);
  /** mock FX: telegraphed cast areas / activation flashes */
  readonly zones = signal<ZoneView[]>([]);
  /** boss bar (BOSS / FINAL_BOSS on the field): name, HP%, phase label, state */
  readonly bossBar = computed(() => {
    const v = this.views().find(x => x.side === 'enemy' && x.alive && x.boss && x.bossRank);
    return v ? { name: v.name, hpPct: v.hpPct, phase: this.bossPhase(), final: v.bossRank === 'FINAL_BOSS', sealed: !!v.untargetable, broken: !!v.broken, enraged: !!v.enraged } : null;
  });
  readonly bossPhase = signal<string | null>(null);
  readonly projectiles = signal<ProjectileView[]>([]);
  readonly anims = signal<Record<number, AnimState>>({});
  readonly simReport = signal<string | null>(null);
  /** เวฟปัจจุบัน (เริ่ม 0) / ทั้งหมด · ช่วงของการต่อสู้ (BattlePhase) */
  readonly wave = signal(0);
  readonly totalWaves = signal(1);
  readonly phase = signal<BattlePhase>(BattlePhase.PREPARATION);
  /** ตำแหน่งกล้องในโลก (ช่อง) — ฉากเลื่อนตามอย่างต่อเนื่องตอน Advance */
  readonly scroll = signal(0);
  readonly tickMs = TICK * 1000;
  /** debug: stage header + every hero (incl. DEAD_HIDDEN ones that aren't on the board) */
  readonly stageDebug = signal<{ header: string; heroes: { id: number; lines: string[] }[] } | null>(null);
  readonly worldDebug = signal<WorldDebug | null>(null);
  /** สรุปผลด่าน (ฮีโร่ที่รอด/ล้ม/ถูกชุบ) */
  readonly summary = signal<string | null>(null);
  /** ป้ายกลางจอ เช่น "เวฟ 2/3" */
  readonly banner = signal<string | null>(null);
  /** ฝั่งเราร่ายท่าไม้ตายเองเมื่อเกจเต็ม */
  readonly autoUlt = signal(false);
  /** combat debug overlay (dev builds only): ?debug=1 or key D */
  readonly debug = signal(false);
  /** running cast FX per unit (removed on fxStop) */
  private castFx = new Map<number, number>();
  /** ฮีโร่ของเรา เรียงตามทีม (ซ้าย→ขวาในแถบด้านล่าง) */
  readonly party = computed(() => this.views().filter(v => v.side === 'ally'));
  /** STEP 9: ศัตรูที่แตะเลือกไว้ และเป้าโฟกัสของทีม */
  readonly selectedId = signal<number | null>(null);
  readonly focusId = signal<number | null>(null);
  /** การ์ดข้อมูลศัตรู: เป้าโฟกัส หรือตัวที่เลือกอยู่ */
  readonly focusCard = computed(() => {
    const id = this.selectedId() ?? this.focusId();
    const v = this.views().find(x => x.id === id && x.alive && x.side === 'enemy');
    return v ? { ...v, isFocus: v.id === this.focusId() } : null;
  });
  /** ฮีโร่ที่ตีเป้าโฟกัสอยู่ / ทั้งหมด */
  readonly focusCount = computed(() => {
    const p = this.party().filter(v => v.alive);
    return { on: p.filter(v => v.onFocus).length, total: p.length };
  });
  /** debug: can at least one hero engage the Focus Target safely right now? */
  readonly focusSafe = signal(true);
  /** ศัตรูที่กำลังร่ายสกิล (แสดงแถบเตือนเหนือสนาม) */
  readonly casts = computed(() => this.views().filter(v => v.alive && v.cast));
  /** มีสกิลร่ายที่ตัดได้อยู่ตอนนี้ → ไฮไลต์ฮีโร่ที่ท่าไม้ตายตัดได้ */
  readonly cuttable = computed(() => this.casts().some(v => v.cast!.interruptible));

  readonly stage = computed(() => STAGES[this.floor() - 1]);
  readonly background = computed(() => BACKGROUNDS[this.stage().background ?? ''] ?? null);
  /** ก่อนกดเริ่ม: แสดงกระดานจัดตำแหน่ง */
  readonly placing = computed(() => !this.running() && !this.result());
  readonly teamPower = computed(() => this.team.units().reduce((a, u) => a + power(u.stats), 0));
  readonly timeLeft = computed(() => Math.max(0, Math.ceil(this.stage().timeLimit - this.time())));

  private engine!: BattleEngine;
  private timer?: ReturnType<typeof setInterval>;
  private floatId = 0;
  /** ทิศที่แต่ละตัวหันอยู่ (true = ซ้าย) คงไว้เมื่อเป้าอยู่คอลัมน์เดียวกัน */
  private facing = new Map<number, boolean>();
  /** ตัวที่เพิ่งวาร์ป: ปิดการเลื่อนตัวบนจอชั่วครู่ (เวลาเอนจินที่หมดผล) */
  private blinkUntil = new Map<number, number>();
  private animKey = 0;
  private walkTick = 0;
  private bannerTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const qp = inject(ActivatedRoute).snapshot.queryParamMap;
    const q = Number(qp.get('floor'));
    if (isDevMode() && qp.get('debug') === '1') this.debug.set(true);
    if (q >= 1 && q <= STAGES.length) this.floor.set(q);
    // จัดทีมใหม่ระหว่างรอเริ่ม: สร้างการต่อสู้ใหม่ให้ตรงกับตำแหน่งล่าสุด
    effect(() => {
      this.team.units();
      untracked(() => {
        if (!this.running()) this.prepare();
      });
    });
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  selectFloor(n: number): void {
    this.floor.set(n);
    this.prepare();
  }

  /** สร้างการต่อสู้ใหม่และแสดงตำแหน่งเริ่มต้น */
  prepare(): void {
    clearInterval(this.timer);
    this.running.set(false);
    this.result.set(null);
    this.simReport.set(null);
    this.floats.set([]);
    this.fx.set([]);
    this.zones.set([]);
    this.bossPhase.set(null);
    this.projectiles.set([]);
    this.anims.set({});
    this.engine = new BattleEngine({
      allies: this.team.units(),
      stage: this.stage(),
      enemyTemplates: ENEMIES,
      autoUlt: this.autoUlt(),
    });
    this.time.set(0);
    this.wave.set(0);
    this.totalWaves.set(this.engine.totalWaves);
    this.phase.set(this.engine.phase);
    this.scroll.set(this.engine.cameraX);
    this.summary.set(null);
    this.banner.set(null);
    this.lastX.clear();
    this.selectedId.set(null);
    this.focusId.set(null);
    this.facing.clear();
    this.blinkUntil.clear();
    this.snapshot();
  }

  start(): void {
    if (this.running()) return;
    if (this.result()) this.prepare();
    if (!this.engine.alive('ally').length) return;
    this.running.set(true);
    this.timer = setInterval(() => this.tick(), TICK * 1000);
  }

  /** แตะรูปตัวละคร (หรือกดปุ่ม 1–5): ใช้ท่าไม้ตายเมื่อเกจเต็ม */
  useUlt(id: number): void {
    if (this.running() && this.engine.requestUlt(id)) this.snapshot();
  }

  /** แตะไอคอนสกิลที่พร้อม: ใช้ทันที (สั่งเอง ใช้ได้แม้สกิลตั้งเป็น เก็บไว้ / กดเอง) */
  useSkill(ev: { id: number; slot: 'skill' | 'skill2' }): void {
    if (this.running() && this.engine.requestSkill(ev.id, ev.slot)) this.snapshot();
  }

  /** แตะชิปโหมด: AUTO → RESERVE (เก็บไว้) → MANUAL (กดเอง) → AUTO */
  cycleMode(ev: { id: number; slot: 'skill' | 'skill2' | 'ult' }): void {
    const u = this.engine?.units.find(x => x.id === ev.id);
    if (!u) return;
    const order = ['AUTO', 'RESERVE', 'MANUAL'] as const;
    const cur = this.engine.skills.mode(u, ev.slot);
    const next = order[(order.indexOf(cur as (typeof order)[number]) + 1) % order.length];
    this.engine.setSkillMode(ev.id, ev.slot, next);
    this.snapshot();
  }

  /** แตะศัตรู: ครั้งแรก = เลือก (ขึ้นการ์ด) · แตะซ้ำ = 🎯 โฟกัส · แตะเป้าโฟกัส = ยกเลิก */
  pickEnemy(id: number): void {
    if (!this.running()) return;
    if (id === this.focusId()) return this.cancelFocus();
    if (id === this.selectedId()) return this.setFocus(id);
    this.selectedId.set(id);
  }

  setFocus(id: number | null): void {
    if (!this.engine || id == null) return this.cancelFocus();
    if (id !== this.engine.focusTargetId) this.engine.setFocus(id);
    this.selectedId.set(null);
    this.focusId.set(this.engine.focusTargetId);
    this.snapshot();
  }

  cancelFocus(): void {
    if (this.engine?.focusTargetId != null) this.engine.setFocus(this.engine.focusTargetId);
    this.selectedId.set(null);
    this.focusId.set(null);
    this.snapshot();
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') return this.cancelFocus();
    if ((e.key === 'd' || e.key === 'D') && isDevMode()) {
      this.debug.update(v => !v);
      return this.snapshot();
    }
    if ((e.key === 'f' || e.key === 'F') && this.selectedId() != null) return this.setFocus(this.selectedId());
    const n = Number(e.key);
    if (!this.running() || !Number.isInteger(n) || n < 1) return;
    const u = this.party()[n - 1];
    if (u) this.useUlt(u.id);
  }

  toggleAuto(): void {
    this.autoUlt.update(v => !v);
    if (this.engine) this.engine.autoUlt = this.autoUlt();
  }

  setSpeed(v: number): void {
    this.speed.set(v);
  }

  /** จำลอง 100 รอบแบบไม่แสดงผล เพื่อดูอัตราชนะ */
  simulate(runs = 100): void {
    let wins = 0;
    let t = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const e = new BattleEngine({ allies: this.team.units(), stage: this.stage(), enemyTemplates: ENEMIES, seed, autoUlt: true });
      if (e.run() === 'win') wins++;
      t += e.time;
    }
    this.simReport.set(`จำลอง ${runs} รอบ: ชนะ ${Math.round((wins / runs) * 100)}% · เฉลี่ย ${(t / runs).toFixed(1)} วินาที`);
  }

  private tick(): void {
    for (let i = 0; i < this.speed() && !this.engine.result; i++) this.engine.step(TICK);
    this.handleEvents(this.engine.drainEvents());
    this.time.set(this.engine.fightTime);
    this.phase.set(this.engine.phase);
    this.scroll.set(this.engine.cameraX);
    // outside combat (advance / regroup / enemies walking in): play the walk cycle for whoever is moving
    if (this.engine.phase !== BattlePhase.COMBAT && ++this.walkTick % 8 === 0) this.marchAnim();
    this.snapshot();
    if (this.engine.result) {
      clearInterval(this.timer);
      this.running.set(false);
      this.result.set(this.engine.result);
      const r = this.engine.stageResult;
      if (r) {
        const names = (ids: number[]) => this.engine.units.filter(u => u.side === 'ally' && ids.includes(u.heroUid ?? u.id)).map(u => u.name).join(', ') || '-';
        this.summary.set(`เคลียร์ ${r.wavesCleared}/${r.totalWaves} เวฟ · รอด: ${names(r.survivingHeroIds)} · ล้ม: ${names(r.deadHeroIds)}${r.revivedHeroIds.length ? ' · ถูกชุบ: ' + names(r.revivedHeroIds) : ''} · ดาเมจที่รับ ${r.damageTaken}`);
      }
    }
  }

  /** screen position (cells) of a unit: continuous world position minus the camera */
  private screenOf(u: BattleUnit): { r: number; c: number } {
    return { r: u.y, c: u.x - this.engine.cameraX };
  }

  private snapshot(): void {
    const e = this.engine;
    const byId = new Map(e.units.map(u => [u.id, u]));
    const combat = e.phase === BattlePhase.COMBAT;
    for (const u of e.units) {
      const t = u.targetId != null ? byId.get(u.targetId) : undefined;
      const dx = u.x - (this.lastFacingX.get(u.id) ?? u.x);
      this.lastFacingX.set(u.id, u.x);
      // transitions: face where you walk (heroes default forward) · combat: face the target
      if (!combat && Math.abs(dx) > 1e-3) this.facing.set(u.id, dx < 0);
      else if (!combat && u.side === 'ally' && u.life === 'ALIVE' && e.phase !== BattlePhase.REGROUPING) this.facing.set(u.id, false);
      else if (t && t.pos.c !== u.pos.c) this.facing.set(u.id, t.pos.c < u.pos.c);
      else if (!this.facing.has(u.id)) this.facing.set(u.id, u.side === 'enemy');
    }
    const dbg = this.debug() ? e.flow.debugInfo() : null;
    const focus = e.focusTargetId != null ? byId.get(e.focusTargetId) : undefined;
    this.focusSafe.set(!focus || e.units.some(h => h.side === 'ally' && h.alive && e.canEngage(h, focus)));
    this.stageDebug.set(dbg);
    this.worldDebug.set(this.debug() ? this.buildWorldDebug() : null);
    const heroDbg = new Map(dbg?.heroes.map(h => [h.id, h.lines]) ?? []);
    this.views.set(
      // only what is physically on the battlefield: DEAD_HIDDEN heroes and old waves' corpses are not rendered
      e.units.filter(u => u.visible).map(u => ({
        id: u.id,
        side: u.side,
        name: u.name,
        cls: u.cls,
        ...this.screenOf(u),
        hpPct: (u.hp / u.maxHp) * 100,
        manaPct: u.maxMana > 0 ? (u.mana / u.maxMana) * 100 : 0,
        shieldPct: (u.shield / u.maxHp) * 100,
        alive: u.alive,
        reviving: u.life === 'REVIVING',
        taunt: hasStatus(u, 'taunt_guard'),
        star: u.star,
        level: u.level,
        sprite: u.sprite,
        boss: u.boss,
        flip: this.facing.get(u.id),
        blink: (this.blinkUntil.get(u.id) ?? 0) > this.engine.time,
        queued: u.ultQueued,
        focused: u.id === e.focusTargetId,
        selected: u.id === this.selectedId(),
        intent: u.side === 'ally' ? u.intent : undefined,
        heroId: u.heroId,
        cd1: Math.max(0, u.cd1),
        cd2: Math.max(0, u.cd2),
        cd1Max: kitOf(u.heroId, u.cls).skill.cooldown ?? 1,
        cd2Max: kitOf(u.heroId, u.cls).skill2.cooldown ?? 1,
        onFocus: u.side === 'ally' && e.focusTargetId != null && u.targetId === e.focusTargetId,
        elite: u.elite,
        moveSec: u.monster ? Math.min(0.6, 1 / u.moveSpeed) : undefined,
        buffed: u.buffs.some(b => (b.def.modifiers.attackMultiplier ?? 1) > 1),
        icon: u.monster ? MONSTERS[u.monster.definitionId]?.animation.tokenIcon : undefined,
        mock: u.sprite ? undefined : mockVisualOf(u.monster ? MONSTERS[u.monster.definitionId]?.visual : undefined),
        bossRank: u.monster && isBossRank(MONSTERS[u.monster.definitionId]?.rank ?? 'COMMON') ? MONSTERS[u.monster.definitionId].rank : undefined,
        statuses: u.buffs.filter(b => STATUS_ICONS[b.def.id]).map(b => ({ id: b.def.id, icon: STATUS_ICONS[b.def.id], left: b.remaining })),
        untargetable: hasFlag(u, 'untargetable'),
        broken: hasFlag(u, 'broken'),
        enraged: u.buffs.some(b => b.def.id === 'guardian_enrage' || b.def.id === 'enraged_forest'),
        debug: this.debug() ? (u.monster ? this.debugLines(u, byId) : heroDbg.get(u.id)) : undefined,
        targetId: u.targetId,
        line: u.line,
        interrupter: u.side === 'ally' && kitInterrupts(kitOf(u.heroId, u.cls), 'ult'),
        modes: u.side === 'ally' ? { skill: e.skills.mode(u, 'skill'), skill2: e.skills.mode(u, 'skill2'), ult: e.skills.mode(u, 'ult') } : undefined,
        cast: u.casting && !(u.casting.def as MonsterSkillDefinition).untargetableWhileCasting
          ? {
              label: u.casting.def.label,
              name: u.casting.def.name,
              pct: (1 - u.casting.left / u.casting.def.castTime) * 100,
              left: Math.max(0, u.casting.left),
              interruptible: u.casting.def.interruptible,
              breakPct: (u.casting.def as MonsterSkillDefinition).breakRequired
                ? (u.casting.breakDamage / (u.casting.def as MonsterSkillDefinition).breakRequired!) * 100
                : undefined,
            }
          : undefined,
      })),
    );
  }

  /** debug overlay text for a monster: name, state, target, HP, cooldowns, skill / cast */
  private debugLines(u: BattleUnit, byId: Map<number, BattleUnit>): string[] {
    const m = monsterSnapshot(u)!;
    const t = m.currentTargetId != null ? byId.get(m.currentTargetId) : undefined;
    const lines = [
      `${u.name} · ${m.state}`,
      `→ ${t ? t.name : '-'} · HP ${Math.ceil(u.hp)}/${u.maxHp}`,
      `atkCD ${m.attackCooldownRemaining.toFixed(1)}`,
    ];
    for (const [id, cd] of Object.entries(m.skillCooldowns)) {
      const casting = u.casting?.def.id === id;
      const tag = casting ? `CASTING ${m.castTimer.toFixed(1)}s` : m.state === 'RECOVERING' && cd > 0 && this.interrupted.has(u.id) ? `INTERRUPTED ${cd.toFixed(1)}` : cd > 0 ? `COOLDOWN ${cd.toFixed(1)}` : 'READY';
      lines.push(`${id}: ${tag}`);
    }
    if (u.buffs.length) lines.push(u.buffs.map(b => `${b.def.id} ${b.remaining.toFixed(1)}s`).join(', '));
    return lines;
  }

  /** units whose last cast was interrupted (debug label) */
  private interrupted = new Set<number>();

  /** last world x seen by the walk animation / facing (movement detection outside combat) */
  private lastX = new Map<number, number>();
  private lastFacingX = new Map<number, number>();

  private marchAnim(): void {
    const anims = { ...this.anims() };
    for (const u of this.engine.units) {
      const moved = Math.abs(u.x - (this.lastX.get(u.id) ?? u.x)) > 0.02;
      this.lastX.set(u.id, u.x);
      if (u.alive && u.visible && moved) anims[u.id] = { anim: 'walk', key: ++this.animKey };
    }
    this.anims.set(anims);
  }

  /** debug overlay in screen cells: anchors (both formations), neutral zone, advance target, regroup radius */
  private buildWorldDebug(): WorldDebug {
    const e = this.engine;
    const cam = e.cameraX;
    const f = e.flow;
    const anchors: WorldDebug['anchors'] = [];
    for (const [form, team] of [[f.formation, 'ally'], [f.enemyFormation, 'enemy']] as const) {
      for (const s of form.slots) {
        anchors.push({
          x: form.originPosition + s.localOffset.x - cam,
          y: s.localOffset.y,
          team,
          label: s.slotId.replace(/_\d+_\d+$/, '') + (s.activeOccupant == null ? ' ∅' : ''),
          empty: s.activeOccupant == null,
        });
      }
    }
    const origin = f.formation.originPosition;
    return {
      anchors,
      neutral: { x0: origin + SIDE_DEPTH - cam, x1: origin + ENEMY_ZONE_START - cam },
      advanceTarget: e.phase === BattlePhase.ADVANCING ? origin + SIDE_DEPTH - cam : null,
      regroupRadius: e.rules.regroupTolerance,
    };
  }

  private showBanner(text: string, ms: number): void {
    clearTimeout(this.bannerTimer);
    this.banner.set(text);
    this.bannerTimer = setTimeout(() => this.banner.set(null), ms / this.speed());
  }

  // ---------------------------------------------------------------- mock FX (independent of the skill data)

  /** screen rectangle of a skill area around a unit (approximation for telegraphs) */
  private areaRect(area: AreaPattern, center: BattleUnit, caster: BattleUnit): { r: number; c: number; w: number; h: number } {
    const p = this.screenOf(center);
    const k = area === 'ADJACENT_8' || area === 'CROSS_1' ? 1 : area === 'RADIUS_2' ? 2 : area === 'RADIUS_3' ? 3 : 0;
    if (area === 'ALL_ENEMIES' || area === 'ALL_ALLIES') {
      const team = this.engine.units.filter(u => u.alive && u.visible && u.side === center.side).map(u => this.screenOf(u));
      if (!team.length) return { r: p.r, c: p.c, w: 1, h: 1 };
      const c0 = Math.min(...team.map(q => q.c)), c1 = Math.max(...team.map(q => q.c));
      return { r: 0, c: c0 - 0.2, w: c1 - c0 + 1.4, h: 3 };
    }
    if (area === 'FRONT_ARC') {
      const q = this.screenOf(caster);
      const dir = this.facing.get(caster.id) ? -1 : 1;
      return { r: q.r - 1, c: dir > 0 ? q.c : q.c - 2, w: 3, h: 3 };
    }
    return { r: p.r - k, c: p.c - k, w: 2 * k + 1, h: 2 * k + 1 };
  }

  private skillByName(u: BattleUnit, name: string): MonsterSkillDefinition | undefined {
    return Object.values(MONSTER_SKILLS).find(s => s.name === name || s.id === name) as MonsterSkillDefinition | undefined;
  }

  private zoneOwner = new Map<number, number[]>();

  private telegraph(src: number, skillName: string, castTime: number, dst?: number): void {
    const u = this.engine.units.find(x => x.id === src);
    const sk = u ? this.skillByName(u, skillName) : undefined;
    if (!u || !sk?.mockFx) return;
    const center = dst != null ? this.engine.units.find(x => x.id === dst) ?? u : sk.target.type === 'ALL_HEROES' ? this.engine.alive('ally')[0] ?? u : u;
    const z: ZoneView = { id: ++this.floatId, ...this.areaRect(sk.mockFx.area, center, u), color: sk.mockFx.color, kind: 'telegraph', sec: castTime / this.speed() };
    this.zones.update(l => [...l, z]);
    this.zoneOwner.set(src, [...(this.zoneOwner.get(src) ?? []), z.id]);
  }

  private dropZones(src: number): void {
    const ids = new Set(this.zoneOwner.get(src) ?? []);
    if (!ids.size) return;
    this.zoneOwner.delete(src);
    this.zones.update(l => l.filter(z => !ids.has(z.id)));
  }

  private flash(src: number, skillId: string): void {
    const u = this.engine.units.find(x => x.id === src);
    const sk = u ? this.skillByName(u, skillId) : undefined;
    const rects = this.zoneOwner.get(src) ?? [];
    const last = this.zones().find(z => z.id === rects[rects.length - 1]);
    this.dropZones(src);
    if (!sk?.mockFx || !last) return;
    const z: ZoneView = { ...last, id: ++this.floatId, kind: 'flash' };
    this.zones.update(l => [...l, z]);
    setTimeout(() => this.zones.update(l => l.filter(x => x.id !== z.id)), 500);
  }

  private flashHeroes(color: string): void {
    const hero = this.engine.alive('ally')[0];
    if (!hero) return;
    const z: ZoneView = { id: ++this.floatId, ...this.areaRect('ALL_ALLIES', hero, hero), color, kind: 'flash' };
    this.zones.update(l => [...l, z]);
    setTimeout(() => this.zones.update(l => l.filter(x => x.id !== z.id)), 500);
  }

  private handleEvents(events: BattleEvent[]): void {
    if (!events.length) return;
    const anims = { ...this.anims() };
    const floats: FloatText[] = [];
    const fx: FxView[] = [];
    const unitOf = (id: number) => this.engine.units.find(u => u.id === id)!;
    const posOf = (id: number) => this.screenOf(unitOf(id));
    const set = (id: number, anim: AnimState['anim'], extra: Partial<AnimState> = {}) => (anims[id] = { anim, key: ++this.animKey, ...extra });
    /** เอฟเฟกต์ของสกิลนี้ เล่นตอนเริ่มท่าหรือตอนโดน ตามที่ตั้งไว้ใน FX */
    const addFx = (src: number, dst: number | undefined, kind: SkillKind, when: 'cast' | 'impact') => {
      const name = SHEETS[unitOf(src).sprite ?? '']?.fx?.[kind];
      const def = name ? FX[name] : undefined;
      if (!name || !def || (def.on ?? 'impact') !== when) return;
      const p = posOf(src);
      const q = def.at === 'target' && dst != null ? posOf(dst) : p;
      const rotate = q !== p && def.orient !== 'flip';
      const angle = rotate ? (Math.atan2(q.r - p.r, q.c - p.c) * 180) / Math.PI : 0;
      // หันตามผู้ใช้ (หรือตามทิศไปหาเป้าหมาย ถ้าเป้าไม่ได้อยู่คอลัมน์เดียวกัน)
      const flip = rotate ? false : q.c !== p.c ? q.c < p.c : !!this.facing.get(src);
      fx.push({ id: ++this.floatId, r: q.r, c: q.c, name, angle, flip });
    };

    for (const e of events) {
      switch (e.type) {
        case 'WAVE_STARTED':
          this.wave.set(e.wave);
          if (e.wave > 0) this.showBanner(`เวฟ ${e.wave + 1}/${e.totalWaves} ศัตรูบุก!`, 1200);
          break;
        case 'WAVE_CLEARED':
          if (!e.final) this.showBanner(`เคลียร์เวฟ ${e.wave + 1}/${e.totalWaves}!`, 900);
          break;
        case 'ADVANCE_STARTED':
          this.fx.set([]);
          this.floats.set([]);
          this.projectiles.set([]);
          this.showBanner(`เดินหน้า… ไปเวฟ ${this.wave() + 2}/${this.totalWaves()}`, e.duration * 1000);
          break;
        case 'REGROUP_STARTED':
          this.fx.set([]);
          this.projectiles.set([]);
          break;
        case 'HERO_HIDDEN_AFTER_DEATH':
          this.castFx.delete(e.unit);
          break;
        case 'HERO_REVIVED':
          set(e.unit, 'idle');
          break;
        case 'attack':
          set(e.src, 'attack');
          break;
        case 'move':
          if (anims[e.src]?.anim !== 'die') set(e.src, 'walk');
          break;
        case 'cast': {
          set(e.src, e.kind);
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.skill, kind: 'skill' });
          addFx(e.src, e.dst, e.kind, 'cast');
          break;
        }
        case 'impact':
          addFx(e.src, e.dst, e.kind, 'impact');
          break;
        case 'blink':
          // วาร์ป: ย้ายทันที + ค่อย ๆ ปรากฏ (ไม่ไถลข้ามสนาม)
          this.blinkUntil.set(e.src, this.engine.time + 0.3);
          break;
        case 'damage': {
          if (!e.poison && e.hurt !== false && anims[e.dst]?.anim !== 'die') set(e.dst, 'hurt');
          const p = posOf(e.dst);
          const text = e.amount > 0 ? `-${e.amount}` : 'บล็อก';
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text, kind: e.poison ? 'poison' : e.crit ? 'crit' : 'dmg' });
          break;
        }
        case 'shield': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `+โล่ ${e.amount}`, kind: 'shield' });
          // ตัวผู้ให้มีเอฟเฟกต์ท่าไม้ตายอยู่แล้ว ส่วนเพื่อนได้โดมโล่เล็ก
          const ward = SHEETS[unitOf(e.src).sprite ?? '']?.shieldFx;
          if (e.src !== e.dst && ward && FX[ward]) fx.push({ id: ++this.floatId, r: p.r, c: p.c, name: ward, angle: 0 });
          break;
        }
        case 'projectile': {
          const src = unitOf(e.src);
          const name = SHEETS[src.sprite ?? '']?.projectile?.[e.kind] ?? CLASS_PROJECTILE[src.cls];
          if (!name || !FX[name]) break;
          const p = posOf(e.src), q = posOf(e.dst);
          const to = { x: q.c, y: q.r + SCENERY_ROWS };
          // ตกจากฟ้า: เริ่มเหนือเป้า 3 ช่อง เยื้องมาทางฝั่งผู้ยิง
          const dir = src.side === 'ally' ? -1 : 1;
          const from = e.sky ? { x: to.x + dir * 1.2, y: to.y - 3.2 } : { x: p.c, y: p.r + SCENERY_ROWS };
          const pv: ProjectileView = { id: ++this.floatId, name, from, to, flight: e.flight * 1000 };
          const sp = this.speed();
          this.projectiles.update(l => [...l, pv]);
          setTimeout(() => this.projectiles.update(l => l.filter(x => x.id !== pv.id)), projectileLife(pv.flight, sp));
          const hit = FX[name].hitFx;
          if (hit && FX[hit]) {
            setTimeout(() => {
              const f: FxView = { id: ++this.floatId, r: q.r, c: q.c, name: hit, angle: 0 };
              this.fx.update(l => [...l, f]);
              setTimeout(() => this.fx.update(l => l.filter(x => x.id !== f.id)), fxDuration(hit, sp) + 50);
            }, pv.flight / sp);
          }
          break;
        }
        case 'revive': {
          set(e.dst, 'idle');
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `คืนชีพ! +${e.amount}`, kind: 'revive' });
          break;
        }
        case 'heal': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `+${e.amount}`, kind: 'heal' });
          // เอฟเฟกต์ฮีลของผู้รักษา (ถ้าแผ่นกำหนดไว้)
          const hf = e.src != null ? SHEETS[unitOf(e.src).sprite ?? '']?.healFx : undefined;
          if (hf && FX[hf]) fx.push({ id: ++this.floatId, r: p.r, c: p.c, name: hf, angle: 0 });
          break;
        }
        case 'focus':
          this.focusId.set(e.dst);
          if (e.dst == null && e.reason === 'dead') this.showBanner('🎯 เป้าโฟกัสล้มแล้ว — ทีมกลับไปใช้ AI ปกติ', 1400);
          break;
        case 'breakGauge': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `BREAK ${e.value}/${e.max}`, kind: 'break' });
          break;
        }
        case 'broken': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'BREAK!!', kind: 'break' });
          this.dropZones(e.dst);
          this.showBanner('💥 BREAK! บอสเสียหลัก 3 วิ — รับดาเมจ +25%', 1600);
          set(e.dst, 'hurt', { force: true });
          break;
        }
        case 'bossPhase':
          this.bossPhase.set(e.label);
          this.dropZones(e.src);
          this.showBanner(`⚠ ${unitOf(e.src).name}: ${e.label}`, 1800);
          break;
        case 'sealBroken':
          this.showBanner('🔓 ผนึกแตก! โจมตีบอสได้แล้ว', 1400);
          break;
        case 'pulse': {
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.name, kind: 'skill' });
          this.flashHeroes('#6b2bd6');
          break;
        }
        case 'soulLink': {
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: `🔗-${e.amount}`, kind: 'dmg' });
          break;
        }
        case 'castStart': {
          this.telegraph(e.src, e.skill, e.castTime, e.dst);
          // monster cast clip (e.g. Alpha Howl): frames stretched over the cast time; sheets without one fall back
          if (SHEETS[unitOf(e.src).sprite ?? '']?.anims.cast) set(e.src, 'cast', { castTime: e.castTime });
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.skill, kind: 'skill' });
          break;
        }
        case 'fx': {
          // cast FX (e.g. Alpha Howl) — started by the engine so its activation frame lands on SKILL_ACTIVATE
          const p = posOf(e.src);
          const f: FxView = { id: ++this.floatId, r: p.r, c: p.c, name: e.name, angle: 0, flip: !!this.facing.get(e.src) };
          this.castFx.set(e.src, f.id);
          fx.push(f);
          break;
        }
        case 'fxStop': {
          const id = this.castFx.get(e.src);
          if (id != null) this.fx.update(l => l.filter(x => x.id !== id));
          this.castFx.delete(e.src);
          break;
        }
        case 'skillActivated': {
          this.flash(e.src, e.skill);
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: e.name + '!', kind: 'skill' });
          this.castFx.delete(e.src);
          this.interrupted.delete(e.src);
          break;
        }
        case 'buff': {
          const p = posOf(e.dst);
          const text = e.buff === 'alpha_howl_buff' ? (e.refreshed ? 'ATK↑ ต่อเวลา' : 'ATK +25%') : e.refreshed ? '' : e.name;
          if (text) floats.push({ id: ++this.floatId, r: p.r, c: p.c, text, kind: 'buff' });
          break;
        }
        case 'miss': {
          const p = posOf(e.src);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'MISS', kind: 'miss' });
          break;
        }
        case 'interrupt': {
          this.dropZones(e.dst);
          this.interrupted.add(e.dst);
          const p = posOf(e.dst);
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: 'INTERRUPTED!', kind: 'interrupt' });
          set(e.dst, 'hurt', { force: true });
          break;
        }
        case 'immune': {
          const p = posOf(e.dst);
          const casting = unitOf(e.dst).casting?.def.name === e.skill;
          floats.push({ id: ++this.floatId, r: p.r, c: p.c, text: casting ? 'UNINTERRUPTIBLE' : `IMMUNE ${e.skill}`, kind: 'immune' });
          break;
        }
        case 'castCancel':
          this.dropZones(e.src);
          break;
        case 'death':
          this.dropZones(e.dst);
          set(e.dst, 'die');
          break;
      }
    }
    this.anims.set(anims);
    for (const f of fx) {
      this.fx.update(list => [...list, f]);
      setTimeout(() => this.fx.update(list => list.filter(x => x.id !== f.id)), fxDuration(f.name, this.speed()) + 50);
    }
    if (floats.length) {
      this.floats.update(f => [...f, ...floats].slice(-40));
      const ids = new Set(floats.map(f => f.id));
      setTimeout(() => this.floats.update(f => f.filter(x => !ids.has(x.id))), 900);
    }
  }
}

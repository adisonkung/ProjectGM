import { BattleEngine, BattleEvent, BattleUnit } from '../../battle/engine/battle-engine';
import { applyBuff } from '../../battle/engine/buffs';
import { ENEMIES } from '../../core/data/enemies';
import { HERO_BY_ID } from '../../core/data/heroes';
import { kitOf } from '../../core/data/hero-skills';
import { MONSTERS } from '../../core/data/monsters';
import { STATUS_EFFECTS } from '../../core/data/status-effects';
import { animTiming, SkillKind } from '../../core/data/sprites';
import { Cell } from '../../core/models/unit';
import { heroStats } from '../../core/rules/stats';

export interface ReviewTarget { id: number; pos: Cell; statuses?: string[] }
export interface ReviewSample {
  t: number;
  events: BattleEvent[];
  statuses: Record<number, { id: string; left: number; sourceId: number }[]>;
}

/** Isolated training targets, one actual engine cast. Never reads/writes the player's save or changes kit data. */
export function skillReview(heroId: string, slot: SkillKind, casterCell: Cell, targets: ReviewTarget[], monsterId = 'forest_slime') {
  const hero = HERO_BY_ID[heroId];
  const enemy = MONSTERS[monsterId] ? monsterId : 'forest_slime';
  const engine = new BattleEngine({
    allies: [{ heroId, name: hero.name, cls: hero.cls, sprite: hero.sprite, pos: { r: 0, c: 1 },
      stats: heroStats(hero, { uid: 1, templateId: heroId, level: 1, potential: 'B' }) }],
    stage: { floor: 1, mode: 'eliminate', timeLimit: 999,
      enemies: targets.map((_, i) => ({ enemy, r: i % 6, c: i % 3 })) },
    enemyTemplates: ENEMIES, monsters: MONSTERS, seed: 7,
  });
  const freeze = () => engine.units.forEach(u => { u.castLock = 1e6; u.cd1 = u.cd2 = 1e6; });
  freeze(); // suppress the opening automatic attack before the first combat step, too
  engine.step(0.05);
  const caster = engine.units.find(u => u.heroId === heroId)!;
  const foes = engine.units.filter(u => u.side === 'enemy' && u.alive);
  const ids = new Map<number, number>([[caster.id, 1]]);
  const place = (u: BattleUnit, at: Cell) => {
    engine.grid.move(u.id, u.pos, at); u.pos = { ...at }; u.x = at.c; u.y = at.r;
  };
  place(caster, casterCell);
  foes.forEach((u, i) => {
    place(u, targets[i].pos);
    ids.set(u.id, targets[i].id);
    // Training HP keeps all four targets visible; source hero uses its real 3★ Lv1 stats.
    u.hp = u.maxHp = 100000;
    for (const status of targets[i].statuses ?? []) {
      if (STATUS_EFFECTS[status]) applyBuff(u, STATUS_EFFECTS[status], caster.id);
    }
  });
  freeze();
  engine.drainEvents();
  const start = engine.time;
  const samples: ReviewSample[] = [];
  const snapshot = () => samples.push({ t: engine.time - start, events: engine.drainEvents(),
    statuses: Object.fromEntries(engine.units.filter(u => ids.has(u.id)).map(u =>
      [ids.get(u.id)!, u.buffs.map(b => ({ id: b.def.id, left: b.remaining, sourceId: ids.get(b.sourceId) ?? b.sourceId }))])) });
  snapshot();
  const skill = kitOf(heroId, hero.cls)[slot];
  engine.skills.use(caster, slot, skill, foes[0]);
  snapshot();
  // Combat's fixed 50 ms step, including status expiry; automatic attacks/movement stay frozen for the demo.
  const fieldDuration = Math.max(0, ...skill.effects.filter(e => e.type === 'FIELD').map(e => e.field.duration));
  const seconds = Math.max(animTiming(hero.sprite, slot).total + 1, animTiming(hero.sprite, slot).hit + Math.max(4.2, fieldDuration + 1.2));
  for (let i = 0; i < Math.ceil(seconds / 0.05); i++) { freeze(); engine.step(0.05); snapshot(); }
  return { ids, samples };
}

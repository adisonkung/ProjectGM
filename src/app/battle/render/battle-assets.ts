import { enemyInfo } from '../../core/data/enemies';
import { MONSTER_SKILLS, MONSTERS } from '../../core/data/monsters';
import { CLASS_PROJECTILE, FX, SHEETS, SheetDef } from '../../core/data/sprites';
import { StageDef, wavesOf } from '../../core/models/stage';

/**
 * Every FX name a sheet can put on the board (skills, basic attack, projectiles, status / field / motion / sequence
 * cues, death / contact sparks). Shared by the Pixi texture warm-up and the pre-battle loading screen.
 */
export function sheetFxNames(def: SheetDef): string[] {
  return [...(def.preloadFx ?? []), def.deathFx, ...Object.values(def.damageFx ?? {}),
    ...Object.values(def.monsterFx ?? {}).flatMap(f => [...(f.cast ?? []), ...(f.activate ?? [])]),
    ...Object.values(def.fx ?? {}).flat(), ...(def.attackFx ?? []), ...Object.values(def.projectile ?? {}).flat(),
    ...Object.values(def.motionFx ?? {}).flatMap(f => [f.start, f.loop]),
    ...Object.values(def.appliedStatusFx ?? {}), ...Object.values(def.retaliateFx ?? {}),
    ...Object.values(def.statusFx ?? {}).flatMap(f => [f.start, f.loop]),
    ...[def.fieldFx?.start, def.fieldFx?.loop, def.fieldFx?.end, def.fieldFx?.residual, def.fieldFx?.wave?.rain, def.fieldFx?.wave?.impact],
    ...Object.values(def.sequenceFx ?? {}).flatMap(cues => cues.flatMap(cue => [...cue.names, ...Object.values(cue.variants ?? {}).flat(), ...(cue.outward?.trails ?? [])]))]
    .filter((n): n is string => !!n);
}

/** Image files of the FX names (+ their impact FX), unknown names skipped. */
export function fxFiles(names: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const n of names) {
    const d = FX[n];
    if (!d) continue;
    out.add(d.file);
    if (d.hitFx && FX[d.hitFx]) out.add(FX[d.hitFx].file);
  }
  return [...out];
}

/**
 * Sprite sheets of every monster a stage can field: all waves, reinforcements, survival hordes, and whatever those
 * monsters summon (skills + boss phases), followed transitively.
 */
export function stageMonsterSprites(stage: StageDef): string[] {
  const ids: string[] = [];
  for (const w of wavesOf(stage)) {
    ids.push(...w.spawns.map(s => s.monsterId));
    for (const r of w.reinforcements ?? []) ids.push(...r.spawns.map(s => s.monsterId));
  }
  for (const g of stage.special?.horde?.groups ?? []) ids.push(...g.map(s => s.monsterId));
  ids.push(...(stage.waves ?? []));
  const seen = new Set<string>();
  const sprites = new Set<string>();
  while (ids.length) {
    const id = ids.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const sprite = enemyInfo(id)?.sprite;
    if (sprite) sprites.add(sprite);
    const def = MONSTERS[id] ?? MONSTERS[id.split('@')[0]];
    if (!def) continue;
    for (const sk of def.skills) for (const e of MONSTER_SKILLS[sk]?.effects ?? []) if (e.type === 'SUMMON') ids.push(...e.monsters.map(m => m.id));
    for (const p of def.phases ?? []) ids.push(...(p.summon ?? []).map(s => s.id));
  }
  return [...sprites];
}

/** Everything the board draws for these units' sheets: the sheets themselves + all their FX / projectile strips. */
export function battleSpriteFiles(sprites: Iterable<string | undefined>): string[] {
  const out = new Set<string>();
  const names: string[] = Object.values(CLASS_PROJECTILE).filter((n): n is string => !!n);
  for (const s of sprites) {
    const def = s ? SHEETS[s] : undefined;
    if (!s || !def) continue;
    out.add(s);
    names.push(...sheetFxNames(def));
  }
  for (const f of fxFiles(names)) out.add(f);
  return [...out];
}

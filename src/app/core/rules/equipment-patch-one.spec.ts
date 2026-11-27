import { EQUIPMENT_TIERS, ORDINARY_SLOTS, PATCH_RARITIES, SUBSTAT_COUNT, TIER_CONFIG } from '../data/equipment-patch-one';
import { newGameState } from '../data/starter';
import { HERO_BY_ID } from '../data/heroes';
import { EquipmentTier } from '../models/equipment';
import { prepare } from '../services/save.service';
import { activeGearSets, craftTier, equip, gearTotals, heroGearTotals, mainValue, rollItem, rollTierItem, slotOf, unequipSlot, upgradeTo } from './equipment';
import { heroStats } from './stats';

const low = () => 0;
const high = () => .9999;
const huntClear = { clears: 1, firstClearDone: true, bestRating: 3 };

describe('tiered Patch 1 equipment', () => {
  it('gates crafting by floor, Hunt clear and that tier’s own resources', () => {
    const fresh = newGameState();
    const stocked = { ...fresh, gold: 10000, inventory: { equip_frag_epic: 110 } };
    expect(craftTier({ ...stocked, cleared: 7, farm: { hunt_5: huntClear } }, 5, 'RING', 'precision', high)).toEqual({ error: 'TIER_LOCKED' });
    expect(craftTier({ ...stocked, cleared: 8 }, 5, 'RING', 'precision', high)).toEqual({ error: 'TIER_LOCKED' });
    expect(craftTier({ ...stocked, cleared: 8, farm: { hunt_5: huntClear }, inventory: { equip_frag_basic: 500 } }, 5, 'RING', 'precision', high)).toEqual({ error: 'NEED_FRAGMENTS' });
    const ready = { ...stocked, cleared: 8, farm: { hunt_5: huntClear } };
    expect(craftTier(ready, 6 as EquipmentTier, 'RING', 'precision', high)).toEqual({ error: 'NO_RECIPE' });
    const result = craftTier(ready, 5, 'RING', 'precision', high);
    if ('error' in result) fail(result.error);
    else {
      const item = result.item!;
      expect([item.tier, slotOf(item), item.set, item.rarity, item.upgradeLevel]).toEqual([5, 'RING', 'precision', 'LEGENDARY', 0]);
      expect(result.state.inventory['equip_frag_epic']).toBe(0);
      expect(result.state.gold).toBe(ready.gold - TIER_CONFIG[5].gold);
      expect(ready.inventory.equip_frag_epic).toBe(110);
    }
  });

  it('has valid rarity tables and generates exactly the eligible number of distinct substats for every main choice', () => {
    for (const tier of EQUIPMENT_TIERS) {
      expect(TIER_CONFIG[tier].craft.every(n => n >= 0)).toBeTrue();
      expect(TIER_CONFIG[tier].craft.reduce((a, b) => a + b, 0)).toBe(100);
    }
    for (const slot of ORDINARY_SLOTS) for (const rarity of PATCH_RARITIES) for (const rng of [low, high]) {
      const item = rollTierItem(3, slot, 'guardian', rarity, rng, 1);
      const stats = item.secondaries.map(line => line.stat);
      expect(new Set(stats).size).toBe(SUBSTAT_COUNT[rarity]);
      expect(stats.length).toBe(SUBSTAT_COUNT[rarity]);
      expect(stats).not.toContain(item.main.stat);
    }
    expect(rollTierItem(1, 'WEAPON', 'assault', 'COMMON', low, 1).main.stat).toBe('atkFlat');
    expect(rollTierItem(1, 'HELMET', 'assault', 'COMMON', low, 1).main.stat).toBe('hpFlat');
    expect(rollTierItem(1, 'ARMOR', 'assault', 'COMMON', low, 1).main.stat).toBe('defFlat');
  });

  it('applies 0/1/2/4/5 persisted rolls in one transaction and rejects replay and +11', () => {
    const rolls = [0, 1, 2, 4, 5];
    for (const [index, rarity] of PATCH_RARITIES.entries()) {
      const item = rollTierItem(1, 'WEAPON', 'assault', rarity, low, 1);
      const state = { ...newGameState(), equipment: [item], gold: 100000, inventory: { enhancement_ore: 10000 } };
      const rng = jasmine.createSpy('rng').and.returnValue(0);
      const result = upgradeTo(state, 1, 0, 10, rng);
      expect(rng).toHaveBeenCalledTimes(rolls[index] * 2);
      if ('error' in result) { fail(result.error); continue; }
      const restored = prepare(JSON.parse(JSON.stringify(result.state)))!;
      const advanced = restored.equipment[0];
      expect(advanced).toEqual(result.state.equipment[0]);
      expect(advanced.secondaries.map(line => line.stat)).toEqual(item.secondaries.map(line => line.stat));
      expect(mainValue(advanced)).toBeGreaterThan(mainValue(item));
      expect(upgradeTo(restored, 1, 0, 10, rng)).toEqual({ error: 'STALE_UPGRADE' });
      expect(upgradeTo(restored, 1, 10, 11, rng)).toEqual({ error: 'MAX_LEVEL' });
      expect(rng).toHaveBeenCalledTimes(rolls[index] * 2);
    }
  });

  it('activates only the highest threshold per set and supports mixed sets', () => {
    const items = ORDINARY_SLOTS.map((slot, index) => rollTierItem(1, slot, 'assault', 'COMMON', high, index + 1));
    expect([1, 2, 3, 4, 5].map(count => activeGearSets(items.slice(0, count))[0].threshold)).toEqual([0, 2, 3, 3, 5]);
    expect(gearTotals(items).atkPct).toBe(.22);
    const mixed = items.map((item, i) => i < 3 ? item : { ...item, set: 'precision' as const });
    expect(gearTotals(mixed).atkPct).toBe(.12);
    expect(gearTotals(mixed).critChance).toBe(.05);
  });

  it('keeps legacy rolls and upgrades intact and returns a trinket when replacing its Necklace position', () => {
    const fresh = newGameState();
    const hero = fresh.heroes[0];
    const legacy = { ...rollItem('trinket', 'EPIC', low, 1), upgradeLevel: 13, equippedHeroId: hero.uid };
    const ring = rollTierItem(2, 'RING', 'vitality', 'COMMON', low, 2);
    const necklace = rollTierItem(2, 'NECKLACE', 'vitality', 'COMMON', low, 3);
    const helmet = rollTierItem(2, 'HELMET', 'vitality', 'COMMON', low, 4);
    const initial = { ...fresh, heroes: [{ ...hero, gear: { ACCESSORY: legacy } }, ...fresh.heroes.slice(1)], equipment: [ring, necklace, helmet] };
    let state = prepare(JSON.parse(JSON.stringify(initial)))!;
    expect(state.heroes[0].gear?.ACCESSORY).toEqual(legacy);
    for (const item of [ring, necklace, helmet]) {
      const result = equip(state, hero.uid, item.instanceId);
      if ('error' in result) { fail(result.error); return; }
      state = result.state;
    }
    expect(state.equipment).toEqual([{ ...legacy, equippedHeroId: null }]);
    const geared = state.heroes[0];
    const unhelmeted = unequipSlot(state, hero.uid, 'HELMET').heroes[0];
    expect(heroGearTotals(geared).hpFlat).toBeGreaterThan(0);
    expect(heroStats(HERO_BY_ID[hero.templateId], geared).hp).toBeGreaterThan(heroStats(HERO_BY_ID[hero.templateId], unhelmeted).hp);
    expect(geared.gear?.RING?.instanceId).toBe(ring.instanceId);
  });
});

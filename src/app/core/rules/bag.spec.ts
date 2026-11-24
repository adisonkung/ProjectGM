import { ITEMS } from '../data/economy';
import { EQUIPMENT_DEFS } from '../data/equipment';
import { newGameState } from '../data/starter';
import { SUMMON_SEALS } from '../data/summon-seals';
import { BAG_STACK_LIMIT, bagSlots, BagCategory, KIND_CATEGORY, seedBag, splitStacks } from './bag';

describe('bag rules', () => {
  it('splits stacks at 999 per slot', () => {
    expect(BAG_STACK_LIMIT).toBe(999);
    expect(splitStacks(2500)).toEqual([999, 999, 502]);
    expect(splitStacks(999)).toEqual([999]);
    expect(splitStacks(1000)).toEqual([999, 1]);
    expect(splitStacks(1)).toEqual([1]);
    expect(splitStacks(0)).toEqual([]);
    expect(splitStacks(-3)).toEqual([]);
  });

  it('a 2500 stack becomes three slots with the same total', () => {
    const s = { ...newGameState(), inventory: { exp_potion_s: 2500 }, equipment: [] };
    const slots = bagSlots(s).filter(x => x.id === 'exp_potion_s');
    expect(slots.map(x => x.count)).toEqual([999, 999, 502]);
    expect(slots.every(x => x.total === 2500)).toBeTrue();
    expect(new Set(slots.map(x => x.key)).size).toBe(3);
  });

  it('every registered item id lands in a real tab', () => {
    const tabs: BagCategory[] = ['equipment', 'materials', 'summon'];
    for (const def of Object.values(ITEMS)) expect(tabs).toContain(KIND_CATEGORY[def.kind]);
    const s = seedBag({ ...newGameState(), inventory: {}, equipment: [] });
    const cat = (id: string) => bagSlots(s).find(x => x.type === 'item' && x.id === id)?.category;
    expect(cat('enhancement_ore')).toBe('equipment');
    expect(cat('equip_frag_epic')).toBe('equipment');
    expect(cat('exp_potion_l')).toBe('materials');
    expect(cat('bt_stone_3')).toBe('materials');
    expect(cat('skill_tome_frag_2')).toBe('materials');
    expect(cat('universal_memory')).toBe('materials');
    for (const seal of Object.values(SUMMON_SEALS)) expect(cat(seal.id)).toBe('summon');
  });

  it('seed adds one of every item id and one item per equipment base', () => {
    const base = { ...newGameState(), inventory: { exp_potion_s: 4 }, equipment: [] };
    const s = seedBag(base);
    for (const id of Object.keys(ITEMS)) expect(s.inventory[id]).toBe(id === 'exp_potion_s' ? 5 : 1);
    expect(s.equipment.map(i => i.definitionId).sort()).toEqual(Object.keys(EQUIPMENT_DEFS).sort());
    expect(new Set(s.equipment.map(i => i.instanceId)).size).toBe(s.equipment.length);
    expect(s.nextItemId).toBe(base.nextItemId + Object.keys(EQUIPMENT_DEFS).length);
    expect(base.inventory).toEqual({ exp_potion_s: 4 });
  });

  it('equipment slots carry the sell price; other items cannot be sold', () => {
    const s = seedBag({ ...newGameState(), inventory: {}, equipment: [] });
    const slots = bagSlots(s);
    expect(slots.filter(x => x.type === 'equipment').every(x => x.sellGold === 80 && x.category === 'equipment')).toBeTrue();
    expect(slots.filter(x => x.type === 'item').every(x => x.sellGold === null && !!x.sellNote)).toBeTrue();
    const locked = { ...s, equipment: s.equipment.map(i => ({ ...i, locked: true })) };
    expect(bagSlots(locked).filter(x => x.type === 'equipment').every(x => x.sellGold === null)).toBeTrue();
  });

  it('shows per-hero Memory under materials', () => {
    const s = { ...newGameState(), inventory: {}, equipment: [], heroMemory: { kael: 1200 } };
    const slots = bagSlots(s).filter(x => x.type === 'memory');
    expect(slots.map(x => x.count)).toEqual([999, 201]);
    expect(slots[0].category).toBe('materials');
  });
});

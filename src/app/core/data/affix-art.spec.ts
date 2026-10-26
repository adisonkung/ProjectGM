import { equipmentAffixLabel } from './affix-art';

describe('Equipment affix text', () => {
  it('shows the Epic effect without scaling the Execution HP condition', () => {
    expect(equipmentAffixLabel('execution', 'EPIC')).toBe('Execution — +10 % damage to enemies below 30 % HP');
  });
  it('shows the rounded flat Break bonus and percentage reduction used by Epic equipment', () => {
    expect(equipmentAffixLabel('breaker', 'EPIC')).toBe('Breaker — Interrupt / Break power +13');
    expect(equipmentAffixLabel('poison_ward', 'EPIC')).toBe('Poison Ward — Poison duration −25 %');
    expect(equipmentAffixLabel('focus', 'EPIC')).toBe('Focus — Skill cooldowns −5 %');
  });
  it('retains base values for Rare equipment and handles missing optional affixes', () => {
    expect(equipmentAffixLabel('bleed_guard', 'RARE')).toBe('Bleed Guard — Bleed damage taken −20 %');
    expect(equipmentAffixLabel(undefined)).toBe('');
  });
});

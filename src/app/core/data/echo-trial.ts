/** Provisional encounter values; independent of player equipment, stars, ranks and level. */
export interface EchoCombatProfile {
  level: number;
  hpMultiplier: number;
  damageMultiplier: number;
  defenseMultiplier: number;
  cooldownMultiplier: number;
  healingMultiplier: number;
  shieldMultiplier: number;
  maxCrowdControlDuration: number;
}
export const ECHO_PROFILE: EchoCombatProfile = {
  level: 5, hpMultiplier: 1, damageMultiplier: 1, defenseMultiplier: 1,
  cooldownMultiplier: 1, healingMultiplier: .60, shieldMultiplier: .70,
  maxCrowdControlDuration: 3,
};
export const ECHO_GOAL = 'เผชิญทีม Echo ของฮีโร่ที่จัดลงสนาม — ใช้โจมตีปกติ + สกิล 1/2 ไม่มีอัลติเมต · ชนะเพื่อรับ Skill Tome';

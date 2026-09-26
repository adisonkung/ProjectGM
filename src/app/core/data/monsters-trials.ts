import { MonsterDefinition, MonsterSkillDefinition } from '../models/monster';

/**
 * Skill Trial roster (claude/patch1-skill-upgrade-spec.md): trial-only monsters, pure data like Stage 4–10.
 * Trial Warden = the Break-coordination check of Skill Trial IV: WARDEN SEAL cannot be interrupted, only broken
 * (Break Gauge 100 — no single hero skill reaches it, so two breakers must commit to the same cast).
 */
const mock = { clips: {} };

export const TRIAL_SKILLS: Record<string, MonsterSkillDefinition> = {
  warden_seal: {
    id: 'warden_seal', name: 'ผนึกผู้คุม', label: 'WARDEN SEAL', type: 'ATTACK',
    castTime: 4.5, cooldown: 13, interruptible: false, interruptPriority: 'CRITICAL', breakRequired: 100, brokenStatus: 'broken', firstCastDelay: 4,
    target: { type: 'ALL_HEROES' },
    effects: [
      { type: 'DAMAGE', mul: 1.6, area: 'ALL_ENEMIES', center: 'SELF' },
      { type: 'APPLY_STATUS', status: 'healing_reduction', to: 'HIT', duration: 5 },
    ],
    mockFx: { color: '#e0b030', area: 'ALL_ENEMIES' },
    conditions: [], recovery: 0.5, interruptRecovery: 0,
  },
};

export const TRIAL_MONSTERS: Record<string, MonsterDefinition> = {
  trial_warden: {
    id: 'trial_warden', name: 'ผู้คุมบททดสอบ', rank: 'ELITE', role: 'BREAK CHECK / TANK', tags: ['trial'],
    displayClass: 'tank', visual: 'mock_trial_warden', immune: ['KNOCKBACK', 'TAUNT'],
    stats: {
      maxHp: 1400, attack: 70, defense: 32, moveSpeed: 1.2, attackRange: 1.5, preferredRange: 1.3, attackCooldown: 1.8,
      attackWindup: 0.4, attackRecovery: 0.25, targetThinkInterval: 0.3, hitReactionDuration: 0.1, minHitReactionInterval: 3, collisionRadius: 0.6,
    },
    ai: { targeting: { strategy: 'NEAREST_REACHABLE_FRONT', targetLockDuration: 2 }, movement: 'MELEE_CHASE', skillPriority: ['warden_seal'] },
    attack: { id: 'warden_mace', damageType: 'PHYSICAL', damageMultiplier: 1.1, delivery: 'MELEE', clip: 'attack', event: 'DAMAGE', hitTolerance: 0.4 },
    skills: ['warden_seal'], animation: mock,
  },
};

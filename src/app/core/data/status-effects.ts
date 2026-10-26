import { StatusEffectDefinition } from '../models/combat';

/**
 * Every status effect in the game (heroes and monsters use the same system).
 * Poison is one definition used by Shade and Corvin: same source refreshes, different sources coexist.
 */
export const STATUS_EFFECTS: Record<string, StatusEffectDefinition> = {
  // Vaelric Phase A, user 2026-10-20: provisional DEF reduction; refresh never compounds it.
  curse_mark: {
    id: 'curse_mark', name: 'ตราคำสาป', duration: 4, stackPolicy: 'REFRESH_DURATION',
    modifiers: { defenseMultiplier: 0.8 },
  },
  // Mirelle Phase A (2026-10-17, user): provisional control values, no new class.
  slow: {
    id: 'slow', name: 'เชื่องช้า', duration: 2, stackPolicy: 'REFRESH_DURATION',
    refreshModifiers: 'MINIMUM', modifiers: { moveSpeedMultiplier: 0.75 },
  },
  chill: {
    id: 'chill', name: 'เย็นเยือก', duration: 4, stackPolicy: 'REFRESH_DURATION', modifiers: {},
  },
  frost_fatigue: {
    id: 'frost_fatigue', name: 'ความเหน็บหนาว', duration: 1.1, stackPolicy: 'REFRESH_DURATION',
    modifiers: { attackSpeedMultiplier: 0.9 },
  },
  // ---- control
  taunted: {
    id: 'taunted', name: 'ถูกยั่วยุ', duration: 3, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['taunted'],
  },
  stun: {
    id: 'stun', name: 'มึน', duration: 0.8, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['stun'],
  },
  root: {
    id: 'root', name: 'ถูกตรึง', duration: 1.5, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['root'],
  },

  // ---- damage over time
  poison: {
    id: 'poison', name: 'พิษ', duration: 4, stackPolicy: 'INDEPENDENT_BY_SOURCE',
    modifiers: {}, tick: { kind: 'DAMAGE', perSecond: 0.25, interval: 0.5 },
  },

  // ---- hero buffs
  taunt_guard: {
    id: 'taunt_guard', name: 'ตั้งรับ', duration: 3, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0.6 },
  },
  axe_frenzy: {
    id: 'axe_frenzy', name: 'คลั่งขวาน', duration: 3, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackSpeedMultiplier: 1.15 },
  },
  blood_rage: {
    id: 'blood_rage', name: 'โทสะเลือด', duration: 6, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageMultiplier: 1.25, attackSpeedMultiplier: 1.25 },
  },
  shadow_evasion: {
    id: 'shadow_evasion', name: 'เงาพราง', duration: 2, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { dodgeChance: 0.3 },
  },
  healing_mist: {
    id: 'healing_mist', name: 'หมอกเยียวยา', duration: 4, stackPolicy: 'INDEPENDENT_BY_SOURCE', buff: true,
    modifiers: {}, tick: { kind: 'HEAL', perSecond: 0.25, interval: 1 },
  },

  // ---- Stage 4–10 statuses
  bleed: {
    id: 'bleed', name: 'เลือดไหล', duration: 5, stackPolicy: 'INDEPENDENT_BY_SOURCE',
    modifiers: {}, tick: { kind: 'DAMAGE', perSecond: 0.15, interval: 0.5 },
  },
  /** Entangling Roots / Death Root damage over time: 20% of the boss ATK per second */
  corruption: {
    id: 'corruption', name: 'คำสาปพฤกษา', duration: 3, stackPolicy: 'INDEPENDENT_BY_SOURCE',
    modifiers: {}, tick: { kind: 'DAMAGE', perSecond: 0.2, interval: 0.5 },
  },
  untargetable: {
    id: 'untargetable', name: 'ร่างหมอก', duration: 1.5, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['untargetable'],
  },
  /** boss seal (Dark Mist Dominion): untargetable until the phase adds die (removed by the phase logic) */
  boss_seal: {
    id: 'boss_seal', name: 'ผนึกหมอกมืด', duration: Infinity, stackPolicy: 'NONE',
    modifiers: {}, flags: ['untargetable'],
  },
  dark_fog: {
    id: 'dark_fog', name: 'หมอกมืด', duration: 8, stackPolicy: 'REFRESH_DURATION',
    modifiers: { rangedAttackMultiplier: 0.75, rangedSkillMultiplier: 0.85 },
  },
  /** carrier = Dark Shaman, source = protector (Corrupted Treant) — 70% of the shaman's final damage goes to the treant */
  soul_link: {
    id: 'soul_link', name: 'พันธะวิญญาณ', duration: 8, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: {}, damageTransfer: 0.7,
  },
  broken: {
    id: 'broken', name: 'BROKEN', duration: 3, stackPolicy: 'REFRESH_DURATION', bossValid: true,
    modifiers: { damageTakenMultiplier: 1.25 }, flags: ['broken'],
  },
  /** Tang Xun Severing Chain (throw 3): the severed wound — takes +10 % damage */
  open_wound: {
    id: 'open_wound', name: 'แผลเปิด', duration: 5, stackPolicy: 'REFRESH_DURATION',
    modifiers: { damageTakenMultiplier: 1.1 },
  },
  /** Garrick Brace for Impact: the first foe to land a hit during the stance is staggered (taunt_guard carries the DR) */
  brace_counter: {
    id: 'brace_counter', name: 'ตั้งรับสวนกลับ', duration: 3, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: {}, counterStatus: { status: 'stagger', duration: 0.6 },
  },
  /** STAGGER: a short stun from a counter (bosses resist unless boss-valid) */
  stagger: {
    id: 'stagger', name: 'เซ', duration: 0.6, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['stun'],
  },
  /** Garrick Hold the Gate (allies): −15 % damage taken, 25 % of what is left is taken by Garrick instead */
  gate_ward: {
    id: 'gate_ward', name: 'ประตูเหล็ก', duration: 6, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0.85 }, damageTransfer: 0.25,
  },
  /** Garrick Hold the Gate (self): planted — −20 % damage taken, no stun / root / knockback */
  gate_stance: {
    id: 'gate_stance', name: 'ยืนหยัด', duration: 6, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0.8 }, flags: ['unstoppable'],
  },
  /** Draeven Blood Debt (self): taunted foes' hits build Blood Debt — 5 stacks erupt as Blood Reprisal (Crimson Spike
   *  Eruption): 140 % ATK to foes within 1 cell, heal 3 % max HP per stack (cap 15 %). Provisional numbers */
  blood_debt: {
    id: 'blood_debt', name: 'หนี้เลือด', duration: 6, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: {}, retaliation: { hits: 5, radius: 1, damage: 1.4, healPerStack: 0.03, healCap: 0.15, delay: 0.16 },
  },
  /** Draeven Blood Brand (foes): ATK −15 %; Draeven's own hits on a branded foe heal him for 12 % of the damage */
  blood_brand: {
    id: 'blood_brand', name: 'ตราโลหิต', duration: 5, stackPolicy: 'REFRESH_DURATION',
    modifiers: { attackMultiplier: 0.85 }, drainToSource: 0.12,
  },
  /** Draeven Sovereign's Dominion (self, Ultimate): −20 % damage taken for 6 s */
  sovereign_dominion: {
    id: 'sovereign_dominion', name: 'อำนาจจอมราชัน', duration: 6, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0.8 },
  },
  healing_reduction: {
    id: 'healing_reduction', name: 'ฮีลลดลง', duration: 6, stackPolicy: 'REFRESH_DURATION',
    modifiers: { healingReceivedMultiplier: 0.5 },
  },
  panther_frenzy: {
    id: 'panther_frenzy', name: 'สัญชาตญาณล่า', duration: 3, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackSpeedMultiplier: 1.2 },
  },
  /** Elder Treant ≤ 50 % HP (with Thorn Pulse) */
  ancient_rage: {
    id: 'ancient_rage', name: 'Ancient Rage', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.15 },
  },
  /** Elder Treant: while any Call-of-the-Forest add lives (removed by the engine when the last one dies) */
  /** boss phase setup (~1 s): thresholds can't be burst through before the phase mechanics start */
  phase_shift: {
    id: 'phase_shift', name: 'เปลี่ยนเฟส', duration: 1, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0 },
  },
  ancient_protection: {
    id: 'ancient_protection', name: 'พรพงไพรโบราณ', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { damageTakenMultiplier: 0.85 },
  },
  guardian_empowered: {
    id: 'guardian_empowered', name: 'พลังบูชายัญ', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackMultiplier: 1.2 },
  },
  guardian_enrage: {
    id: 'guardian_enrage', name: 'คลั่งสุดขีด', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.4, damageMultiplier: 1.3 },
  },

  // ---- farm-dungeon bosses (monsters-farm.ts) + BOSS DUEL enrage
  stone_skin: {
    id: 'stone_skin', name: 'ผิวศิลา', duration: 8, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0.4 },
  },
  sentinel_fury: {
    id: 'sentinel_fury', name: 'หินแตกคลั่ง', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.25 },
  },
  pack_fury: {
    id: 'pack_fury', name: 'พลังฝูง', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackMultiplier: 1.3 },
  },
  lord_frenzy: {
    id: 'lord_frenzy', name: 'จันทร์สีเลือด', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.3 },
  },
  /** BOSS DUEL soft time limit: the boss enrages after the duel's `enrage.at` seconds of combat */
  duel_enrage: {
    id: 'duel_enrage', name: 'คลั่ง (หมดเวลา)', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackMultiplier: 1.6, attackSpeedMultiplier: 1.3 },
  },

  // ---- special-dungeon monsters (monsters-dungeon.ts)
  jade_weight: {
    id: 'jade_weight', name: 'หยกถ่วง', duration: 4, stackPolicy: 'REFRESH_DURATION',
    modifiers: { attackSpeedMultiplier: 0.75 },
  },
  rally_haste: {
    id: 'rally_haste', name: 'รวมพล!', duration: 6, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackSpeedMultiplier: 1.3 },
  },
  jade_awakening: {
    id: 'jade_awakening', name: 'หยกตื่น', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.2 },
  },
  /** Moonblade Ronin: hits taken are reflected (60 % as TRUE damage) — a stun or knockback ends the stance */
  mirror_stance: {
    id: 'mirror_stance', name: 'ท่ากระจกจันทร์', duration: 2.5, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { reflectDamage: 0.6 }, endOnControl: true,
  },
  twin_moon: {
    id: 'twin_moon', name: 'จันทร์คู่', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.2 },
  },
  seraph_ascend: {
    id: 'seraph_ascend', name: 'เทวรูปตื่น', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { damageMultiplier: 1.15 },
  },
  crystal_shell: {
    id: 'crystal_shell', name: 'เปลือกผลึก', duration: 4, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { damageTakenMultiplier: 0.4 },
  },
  /** Arcane Examiner: no skills / ultimates (basic attacks still allowed) */
  silence: {
    id: 'silence', name: 'ถูกผนึกเวท', duration: 4, stackPolicy: 'REFRESH_DURATION',
    modifiers: {}, flags: ['silence'],
  },
  pop_quiz: {
    id: 'pop_quiz', name: 'สอบซ่อม', duration: Infinity, stackPolicy: 'NONE', buff: true,
    modifiers: { attackSpeedMultiplier: 1.15 },
  },

  // ---- monster buffs
  alpha_howl_buff: {
    id: 'alpha_howl_buff', name: 'เสียงหอนจ่าฝูง', duration: 10, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackMultiplier: 1.25 },
  },
  /** legacy enemy cast BERSERK (lich): attack + attack speed ×1.5 */
  berserk: {
    id: 'berserk', name: 'คลั่ง', duration: 8, stackPolicy: 'REFRESH_DURATION', buff: true,
    modifiers: { attackMultiplier: 1.5, attackSpeedMultiplier: 1.5 },
  },
};

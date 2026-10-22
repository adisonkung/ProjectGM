# Draeven Morcant — The Bloodwrought Sovereign · Phase A

> Status: **PHASE A (base combat + S1 character clip), provisional kit / timing** · Claude, 2026-10-22, branch
> `wip/claude-hero-draeven` (base `origin/master` 41e828f). Awaiting user review — not merged.

## Design (user handoff 2026-10-22 — current working design)

- **Role label:** Tank / Fighter → implemented on the **existing `tank` class** (hybrid label rule, CONTENT_PIPELINE).
- **Combat identity:** Blood Retaliation / Sustain Bruiser Tank · keyword **PUNISH**
  (Yue Zheng = PROTECT, Garrick = STOP). Take pressure → punish attackers → sustain himself → dominate the frontline.
- **Never:** shield barriers as main mechanic, ally damage interception, team protection field, shield charge,
  major stun / knockback, high Break, immortality, team healing.
- **Visual authority:** the APPROVED master reference (`assets/heroes/Draeven/reference/draeven_master_reference.png`).
  Western / Gothic dark-fantasy warlord; black armour, antique gold, crimson, off-white tabard, black fur mantle.
- **Weapon:** Bloodforged Bastard Sword — straight, broad, double-edged, silver edges, crimson core, symmetrical
  Western crossguard. Rigid; never curved / serrated / resized between frames.
- **Motion language:** heavy, controlled, grounded, deliberate — no spins, flips, juggling, assassin speed.

### Skills

| Slot | Name | Flow | Implemented (provisional numbers) |
|---|---|---|---|
| S1 | **Blood Debt** → **Blood Reprisal** | short taunt activation, he keeps fighting · each foe hit = 1 Blood Debt · threshold → radial Crimson Spike Eruption | taunt foes within 2 · `blood_debt` 6 s: **5 hits** → 140 % ATK to foes within 1 cell + heal 3 % max HP / stack, **cap 15 %**, status ends |
| S2 | **Sovereign's Reprisal** | Charge VFX hides the idle → strike transition · forward sword release · crimson blood wave · impact | `FRONT_RECT_2X3` (2 columns ahead, front cell 160 %, rest 100 %) + `blood_brand` 5 s (ATK −15 %, his hits on a branded foe heal him 12 % of the damage) |
| Ult | **Bloodwrought Execution** | Momentum raise → **HOLD / CHARGE** → ONE heavy downward FINAL HIT → impact → recovery (never a 2-hit combo) | `FRONT_T3` 280 % / 120 % + `blood_brand` on the hit + `sovereign_dominion` (−20 % dmg taken 6 s) + fresh taunt + Blood Debt re-armed |

Tank class skill ids / cooldowns kept (rank tables apply). No interrupt, no Break, no stun, no knockback, no shield.

## Generic engine mechanics added

- `StatusEffectDefinition.retaliation { hits, radius, damage, damageType?, healPerStack, healCap }` — direct foe hits
  (not DoT, not transferred damage, not allies / self) stack on the carrier (`ActiveBuff.debt`); at `hits` the carrier
  erupts once around itself (8-direction `radius`), heals `min(healCap, healPerStack × stacks)` × max HP, and the
  status ends. Events `retaliateStack`, `retaliate` (battle page floats "โลหิตตอบแทน").
- `StatusEffectDefinition.drainToSource` — damage the status source deals to the carrier heals the source by that share.
- Statuses: `blood_debt`, `blood_brand`, `sovereign_dominion` (+ icons in `visuals.ts`).

## Art pipeline

`python3 tools/sprites/draeven.py` → `public/sprites/hero-draeven.png` (28 × 8 cells 260 × 170, root 130,155, idle body
80 px, soft alpha / not pixelated) + temporary portrait `public/portraits/draeven.webp` (cropped from the master
reference). Then `npm run sprites:optimize`.

Sources (user Autosprite sheets, tracked, do not edit): `assets/heroes/Draeven/`

| File | Grid | Used for |
|---|---|---|
| `base/draeven_idle.png` | 7 × 7 @ 768 | idle (every 4th of 48 → 12) |
| `base/draeven_run.png` | 8 × 7 @ 512 | walk (one cycle, frames 18–32 step 2) |
| `base/draeven_attack.png` | 5 × 5 @ 1024 | basic attack (21 frames, 19 played, 0.8 s, damage 0.34 s) · Ult reuses this row |
| `base/draeven_death.png` | 8 × 7 @ 768 | die (14) · hurt (provisional: the opening stagger, 3 frames) |
| `skill/draeven_s1_taunt.png` | 8 × 7 @ 512 | S1 taunt beckon (56 → 28 frames, 1.6 s) — user-approved "final" |
| `skill/draeven_s2_release_v2.jpg` | 8 × 7 @ 1000, white bg JPEG | **S2 (user 2026-10-22)**: 27 frames (raise → draw back → forward release → crouch → stance); keyed from white; the baked wave / burst / grey disc on F18–F24 stripped (body only) |
| `skill/draeven_ult.jpg` | 8 × 7 @ 1000, white bg JPEG | **Ult (user 2026-10-22)**: 28 frames (raise → crouch + spin → overhead hold → one slam → recover); baked white motion smears kept |
| `skill/draeven_s2_sword_release.png` | 12 × 11 @ 512 | superseded (kept as source, no longer baked) |
| `reference/draeven_master_reference.png` | 1254² magenta | visual authority + portrait crop |

Each sheet is mapped into idle space with one similarity transform (SIFT vs idle F0; constants in the script).

## Pending (not done in Phase A)

- **VFX — none supplied yet:** S1 Taunt Activation / Taunt Loop / Crimson Spike Eruption; S2 Charge / Main Wave /
  Impact; Ult Charge / Final-hit slash + impact. Missing FX are skipped (gameplay unaffected).
- **Hurt clip** (provisional stagger). S2 (row 6, 1.43 s, release F9, damage F11) and Ult (row 7, 2.07 s, charge hold F13
  0.6 s, single slam damage F17) now use the user's own sheets (2026-10-22); their VFX layers + Timeline Sync are pending.
  Both sheets open / close on a raised-sword stance that differs from the idle (sword low) — a small pose change at the
  start / end of the clips.
- Skill icons + banner (portrait is a temporary crop). Final Timeline Sync for all three skills.
- The design doc `Dark_Fantasy_Cursed_Vanguard_Character_Details.docx` is **not in this repository** — this file and
  the claude.ai project doc `claude/hero-draeven-bloodwrought-sovereign.md` carry the current design until it is supplied.
- No balance pass (roster not complete). hero-sim smoke (10 runs, team draeven/yuezheng/moye/tangxun/linxue): F1–F6
  80–100 %, F7–F9 0 %, F10 TACTICAL 30 % — same walls as the existing roster; Draeven 15 % of team damage, 9 % of healing.

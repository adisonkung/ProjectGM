# Combat Rules

> Canonical since 2026-10-16 (approved by the user).
> Baseline = the user's spec (2026-10-16). Where the repository holds a newer, approved value, **the repository value is used** (the user instruction: "if information is old, use the current state"). Each such case is listed under *Differences*.
> Balance is frozen until the full roster is done (user decision). Do not tune numbers to "fix" a difference below without asking.

## Team and board

- Active team: **5 heroes**.
- Board: 5 × 16 cells. The 3 bottom lanes are playable.
- Zones: our zone is columns 0–5, the neutral zone is 6–9 (no placement), the enemy zone is 10–15.
- Square cells, 8-direction range (a diagonal step = 1 cell).
- Units may share a cell during combat.

## Stars

- Base pull rarity: 1★–3★. Highest is **3★**.
- Every hero can be raised to **6★** with Hero Memory or Universal Memory.

| Star | 1★ | 2★ | 3★ | 4★ | 5★ | 6★ |
|---|---|---|---|---|---|---|
| HP / ATK / DEF multiplier | 0.91 | 0.955 | 1.00 | 1.05 | 1.10 | **1.18** |

The multipliers live in `STAR_STAT_MULTIPLIER` (`core/data/classes.ts`). They apply to HP, ATK and DEF only, not to attack speed or range.

Memory to the next star (`STAR_UP_COST`, `core/data/stars.ts`):

| Step | Cost |
|---|---|
| 1★ → 2★ | 40 |
| 2★ → 3★ | 70 |
| 3★ → 4★ | 100 |
| 4★ → 5★ | 150 |
| 5★ → 6★ | 250 |

- 3★ → 6★ costs **500** in total.
- A duplicate pull gives 60 / 80 / 110 Memory by base rarity. A duplicate of a 6★ hero converts to Universal Memory at 50 %.

Star perks (`STAR_PERKS`) are utility, not raw stats:

- 4★: starting gauge 10.
- 5★: cooldown −5 %.
- 6★: starting gauge 20 and crit +3 %.

## Damage

`battle/engine/damage-resolver.ts` (`DamageResolver.resolve`; every hit goes through it).

```
raw        = ATK_effective × SkillMultiplier × outgoing mods
             × variance (±10 %)        — heroes only; monsters are deterministic
             × crit (×1.5)              — base crit chance 10 % (CRIT_CHANCE), + gear / 6★ perk
             × target damageTaken mods
mitigation = 100 / (100 + DEF × (1 − attacker.defenseIgnore))     PHYSICAL: DEF · MAGIC: magicDefense ?? DEF · TRUE: 0
final      = max(1, round(raw × mitigation))
```

## Ultimate gauge

Constants are in `core/data/classes.ts`. Logic is in `battle-engine.ts`.

- **Gains:**
  - +3 for a successful normal attack (`MANA_PER_ATTACK`). A projectile counts when it arrives, and a heal bolt counts too.
  - +2 when hit by damage (`MANA_PER_HIT`), at most once per **0.5 s** (`RECEIVE_GAUGE_ICD`). Poison and other DoT give nothing.
  - Skills and ultimates give no gauge.
- **Maximum:** 100 (`maxMana` per class).
- **Between waves:**
  - The gauge **persists between waves**.
  - It does not grow during transitions.
  - On revive, the default policy is PRESERVE.
- **Use:** activating the ultimate resets the gauge to **0**.
- **Dev switch:** `DEV_FLAGS.fullUltAtStart` (currently ON) starts the battle page with a full gauge. It is a test switch, not a rule.

## Skills and cooldowns

- Skills start at 50 % of their cooldown (`START_CD`). Cooldowns keep running between waves.
- Skill modes per slot: AUTO, CONDITIONAL, RESERVE, MANUAL. The player can always trigger a skill manually.

## Revive

- At most **1** limited revive per stage, for the whole party (`StageBattleRules.partyReviveLimit`).
- Revive HP is **40 %** everywhere: hero skills (`REVIVE.hpPct` 0.4, e.g. Lin Xue's ult) and the stage default for revives without an explicit value (`StageBattleRules.reviveHpDefaultPercent` 0.4).
- Revive gauge policy: PRESERVE, RESET_TO_ZERO or SET_PERCENT.

## Break and interrupt

- **Interrupt** is an explicit effect (`DAMAGE.interrupt` / `INTERRUPT`). Plain damage, stun and root do not interrupt.
- **Break:**
  - Casts with `breakRequired` fill a Break gauge from `breakPower`.
  - When the gauge is full, the cast is cancelled and the caster gets BROKEN for 3 s plus a full cooldown.
  - Break-only damage (`breakPower` without `interrupt`) fills the gauge but never cancels an interruptible cast.
- **Independent of damage:** Break is separate from raw damage. The gauge only counts `breakPower` values from data.
- **No sprite dependency:** Break logic does not read sprite or PNG sizes.
- **Interrupt priority** (LOW / MEDIUM / HIGH / CRITICAL) and reservation:
  - Interrupt priority comes from the monster skill data.
  - The commit window is 1.5 s.

## Positioning and targeting (summary)

- **Formation:** depth 0–2 is FRONT and depth 3–5 is BACK. Roles have leash ranges and safe ranges (`ROLE_BEHAVIOR`).
- **Focus target** is a soft priority. Heroes attack it only when they can do so safely.
- **Ground-targeted skills** (Bai Long, Garrick S2, Kael ult) hit fixed cells in front of the caster (`GROUND_SHAPES`).

## AUTO / TACTICAL philosophy

- **AUTO is the baseline.** TacticalBot (`battle/engine/bots/tactical-bot.ts`) models a deciding player.
- **Tactical play rewards:**
  - positioning and formation;
  - interrupt timing and ultimate timing;
  - target priority and skill-mode choices.
- **Tactical play must not replace progression:**
  - Level, gear, skill ranks, stars and team composition must still matter.
  - Hard floors (F7–F10) are meant to need both decisions and preparation.
- **First-clear targets:** TACTICAL win rates at the recommended profile, F7 / F8 ~70–85 %, F9 ~55–70 %, F10 25–45 %. These were set for the legacy roster and **are not met by the shipped roster yet** (hero-sim 2026-10). This is a known open item, deferred by the user until the roster is complete.

## Animation and gameplay timing (rule + current state)

- **Rule:** gameplay reacts to **semantic timeline events** (DAMAGE, IMPACT, VFX_SPAWN …), never to raw frame checks.
- **Current state:**
  - Hero clips declare events in `AnimDef.events`; monster clips declare frame numbers that are converted to events.
  - The engine schedules damage and cast-lock from these event times. So **clip length and event placement are gameplay-relevant**: slowing a clip slows that skill.
  - Changing a hero's clip timing is therefore a balance-relevant change. Mention it in the commit message.

## Differences: spec baseline vs repository

| Topic | CURRENT IMPLEMENTATION | SPEC BASELINE (2026-10-16 prompt) | DIFFERENCE / resolution |
|---|---|---|---|
| 6★ multiplier | 1.18 (`STAR_STAT_MULTIPLIER`, star spec in project doc `star-gacha-memory-spec.md`) | 1.17 | Repository is newer and approved, so **1.18 is canonical** (per user: newer data wins). |
| Default revive HP for revives without an explicit value | **0.4** since 2026-10-16 (`reviveHpDefaultPercent`, was 0.3) | 40 % | Resolved: user chose 40 % everywhere. |
| Variance and crit for monsters | Monsters: no variance and no crit (deterministic) | ±10 % and 10 % crit stated generally | Documented as: heroes roll, monsters are deterministic. |
| Crit chance | 10 % base + gear crit (cap +20 %) + 6★ perk +3 % | 10 % | Consistent. Additive sources are documented. |
| Gameplay timing tied to clips | Event times derived from clip data | "Avoid gameplay tied to frame numbers" | Uses events, so it complies in form. Clip length still drives DPS (hero-sim: F5 0 % with sprites vs 100 % with `--nosprite`). Open design question, deferred to the balance pass. |

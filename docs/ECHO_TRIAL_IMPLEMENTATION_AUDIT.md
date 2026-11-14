# Echo Trial implementation audit

Scope: continue the playable rework against `ECHO_TRIAL_SPEC.md` and `ECHO_TRIAL_ACCEPTANCE_SPEC.md`. The user explicitly confirmed **Shadow Violet** during this audit; the cyan/teal paragraph in the pasted checklist does not change that choice.

## Runtime implementation

| Concern | Implementation |
| --- | --- |
| Encounter / tiers / rewards | `src/app/core/data/economy.ts`: four Skill tiers, one dynamically filled wave, no static monsters/boss/reinforcements; existing Skill Tome rewards and daily/first-clear multipliers. |
| Shared combat profile | `src/app/core/data/echo-trial.ts`: HP, ATK (`attackMultiplier`), DEF, cooldown, healing, shield and CC limits. Each `TRIAL_TIERS` entry may override the shared defaults with `echo`. |
| Derived runtime identity / stats / kit | `src/app/core/rules/echo-trial.ts`: original hero identity, sprite, class and Basic/S1/S2; class reference stats × standard growth at the tier's configured level × multipliers. Player gear, stars, skill ranks, buffs and current HP are not copied. Display level can match the selected hero. |
| Runtime spawn / lifecycle | `src/app/battle/engine/battle-engine.ts`: one enemy battle instance per deployed hero, mirrored cells; Echoes are scoped to that session. `dispose()` releases scheduled callbacks, fields, projectiles, grid occupants, units, source references, status caches and listeners. |
| Skill execution | `src/app/battle/engine/skill-system.ts`: the same authored targeting/effect system; Echo kit copies remove REVIVE; skill execution blocks Ultimate. Session disposal also clears cached impact recipients. |
| Reward display | `battle.component.ts` / `.html`: format fractional quantities with DecimalPipe; existing item artwork and granted quantities are unchanged. Browser evidence waits for image decoding. |
| Scene ownership | `src/app/pages/battle/battle.component.ts`: releases the previous engine before retry/rebuild, and on route destruction. Results retain the current scene for the existing short outro/result presentation; replacing/leaving it disposes the runtime units. |
| Appearance | Existing DOM/Pixi Shadow Violet profile, shared `public/vfx/echo-shadow-wisp.svg`, small marker/fragments, original hero animation/VFX assets. `/echo-lab` still previews all 15 heroes. |

No permanent Echo hero definitions, saved hero records, database documents, server texture generation or copied artwork are introduced. This project uses a local save; transient Echoes are not written into it. No new service or persistent data model was needed in this audit.

## Ultimate and safety

- Echoes have zero maximum/current Ultimate gauge. Gauge generation and engine Ultimate selection/execution are blocked; direct SkillSystem Ultimate execution is also blocked.
- Basic and S1/S2 use the original authored identities, with rank-one runtime copies and the configured cooldown multiplier.
- Revive components are removed without removing heal/cleanse components, and the execution host rejects Echo revival.
- Healing and shield multipliers apply at the source through shared execution paths. Player healing/shields are unchanged.
- Echo control durations are capped; infinite status durations and unbounded stacking are normalized without changing playable definitions.

## Faction behavior

Skills query living allies/foes relative to the caster's `side`. The audit exercises lowest-HP ally, nearest enemy, team heal/shield/cleanse/buff and enemy AoE/debuff resolution. Existing movement and area-direction helpers use caster/target positions and faction. Player focus and manual commands remain player-only. Healer Heal Bolt uses the basic-action animation/event but heals allies; the browser audit distinguishes this from offensive basic attacks.

## Validation artifacts

`tools/dev/echo-trial-browser.cjs` runs the actual Angular game with an isolated browser save. Use an installed Playwright module (or expose it with `NODE_PATH`), Chromium via `CHROME_BIN`, and the dev server at `ECHO_TEST_URL` (default localhost:4200). It observes runtime events through Angular's development API; it does not change live combat HP, cooldowns or skill effects.

- Report and actual screenshots: `docs/reviews/echo-trial/end-to-end/`.
- Full five-hero menu → battle → victory → daily/first-clear Skill Materials.
- Real Echo healer heals Echo teammates; offensive Echo basics hit players; S1/S2 cast automatically; no Echo Ultimate/gauge.
- Mirrored identity/formation, three-member Tank/DPS/Healer team, defeat without a first-clear reward.
- Retry, SPA leave and re-entry: old engines are disposed with zero remaining runtime units and no extra enemies in the new session.
- Tier-four Echo HP/ATK/DEF stay identical for player level 1 versus 10; unit tests additionally vary final player stats/stars.
- Browser regression smoke runs for Training, Equipment Hunt and normal Tower combat; existing unit/regression tests cover their rules and rewards.
- Isolated engine tests execute heal/shield/cleanse/buffs, AoE damage/debuffs, CC caps, revival rejection, tier overrides and disposed callbacks.

Validation: app/spec TypeScript checks passed; full Karma suite 985/985 passed; 20 shipped-roster simulation battles completed without errors. Actual-browser report: 9 scenarios, zero JavaScript errors, including a real player Ultimate. Production build passed.

## Fixes and limits

An early screenshot showed empty-looking tiles before the existing artwork had decoded. The browser audit now waits for decoded item images and the result transition; the original icon component is retained. The reward quantity label also now formats fractional values (for example `0.30000000000000004` → `0.3`) without changing grants or storage.

This audit adds explicit session teardown rather than relying only on canceled animation frames and eventual garbage collection. It also makes per-tier profile overrides explicit and names the ATK control `attackMultiplier`. No faction-targeting defect was found in the current shared SkillSystem; the expanded tests verify its actual outcomes.

The current hero effect model has no summon, pet or transformation effect. No shipped S1/S2 is skipped for that reason. Future such effects need enemy-faction support and a safety review before enabling them for Echoes. Per-character eye masks remain outside the shared visual treatment; artwork and player abilities were not changed. Difficulty values are provisional, without a general roster/equipment rebalance.

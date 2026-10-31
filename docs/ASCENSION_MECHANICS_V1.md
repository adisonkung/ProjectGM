# Ascension specialist mechanics V1

> Layout update, 1 November 2026: Aegis and Jade now use asymmetric **4×2** footprints. Earlier 3×2 descriptions/screenshots below are historical. See [GUARDIAN_4X2_LAYOUT.md](GUARDIAN_4X2_LAYOUT.md) for current anchors, skill origins and upper room.
User-authorized follow-up to the three-boss audit (2026-10-31). This branch builds on the reviewed Solar/Aegis/Jade integration at `fef69f1`. The shared 3×2 bodies, arenas, large sprites, base HP/ATK/DEF, tier multipliers, rewards, unlocks and free-choice schedule remain as before. No hero kit or equipment balance changes.

## Aegis — original specialist V1 (S2/S3 order superseded)

Current slot order is S1 Guard → S2 ground Judgement → S3 Light Lance; Break/exposure moved to the beam. See [AEGIS_SLOT_ORDER.md](AEGIS_SLOT_ORDER.md). The following records the pre-swap V1.

- Guard still has a 2.5-second interruptible setup. If it completes, it reduces incoming damage by **80% for 12 seconds**, while the boss resumes fighting. It is finite protection, not immunity or shield HP.
- Interrupting Guard gives **Exposed Core for 4 seconds**: the boss cannot act and takes **75% more damage**. Existing core VFX and break pose communicate that window.
- Judgement still needs **100 Break** during its 3-second cast. A successful Break removes an existing Guard and applies Exposed Core. The exposure replaces ordinary BROKEN for this skill; it does not multiply with a second BROKEN status.
- Guards expire naturally if the party cannot interrupt; developed teams can overpower the encounter. Kael's existing bonus vs Guard remains useful without making a named hero mandatory.
- The break banner reads actual status duration/modifiers, rather than incorrectly claiming every exposure lasts 3 seconds/+25%.

## Jadecrest — protect the marked backliner

- Pounce chooses the highest-ATK living **back-row** hero in range, falling back to the highest-ATK available hero. The ordinary tank/taunt target does not silently replace this declared skill target.
- A native green warning follows the chosen hero for the **1.2-second crouch**. At takeoff, the engine commits a free destination for the full 3×2 body. A fixed warning then identifies the landing for the **0.6-second flight**. Moving the hero after takeoff cannot redirect the leap.
- Existing landing damage is physical ×1.3 in radius 2. Target shielding, protection fields, spread formation and the existing Backline Guard affix remain answers. No movement command is required to survive the warning.
- Roar now winds up for **1.6 seconds**, with its charge visuals retimed. It retains its ×1 physical front-area hit and 0.8-second stun. It is **not Breakable**, separating it from the other two guardians' burst-interrupt checks.
- First Roar is at 6 seconds; first Pounce at 10 seconds. A completed Roar brings Pounce's cooldown forward to 1.8 seconds if it is enabled. Roar's recovery and Pounce's windup leave a defensive response window after the stun expires; it is not an unavoidable stun-to-instant-kill sequence.
- A disabled skill (`Infinity` cooldown in fixtures/special encounters) stays disabled. Other monster skills do not acquire combos.

## Solar — fair marks and sustained party pressure

- Seals still locks two distinct cells 0.8 seconds into the 2.7-second cast. It selects **least previously marked living heroes first, then highest effective ATK**, with position/ID used only for exact ties. Target history belongs to this encounter and increments at a successful lock, not on cancelled pre-lock casts. A distinct cell is never marked twice in one cast.
- The fixed warning still hurts the current occupant at release; a hero who leaves is safe. This is ready for future movement controls, without claiming a dodge command already exists.
- Sweep fires **four pulses**: top→middle→bottom→top, then bottom→middle→top→bottom on the next completed cast. Pulses are 0.95 seconds apart, so the first lane is exposed twice. Recovery is 3.6 seconds. The native beam/emitter still share the eye origin and exit the viewport without shrinking their height.
- Eclipse remains a 3-second, **100 Break** cast. If released, it deals **three party-wide magic hits**, each ×0.65 ATK, **0.8 seconds apart**. Shields absorb the hits and healing/mitigation between them matters. Recovery is 2.8 seconds. Each real pulse emits the native impact at its current recipients' feet.
- Source death or wave/battle teardown cancels remaining pulses. Breaking the windup prevents all three; it does not remove the independent Seals/Sweep pressure from the rest of the encounter.

## Engine and presentation scope

Optional data fields (`onStopped`, `followUp`, target warnings, rotating ground selection, repeated lane/team pulses) drive the common executor. No monster-ID-specific combat branch was added. Existing skills without those fields keep their previous behavior. All damage uses DamageResolver and the normal shields; logical cells, not image sizes, own targeting/collision.

Native PNGs are unchanged; presentation definitions reuse existing green warning rings, exposed-core VFX and Solar impact/beam strips. Encounter goals now tell the player each boss's tactical problem. Warning events distinguish following a target from a committed ground point.

## Balance intent and limits

This is the requested provisional mechanics pass, not a final roster balance. Distinct teams/builds should gain an advantage near progression limits; a versatile party may still succeed with good commands. Strong developed teams should retain automatic farming. There are no level-based automatic losses, named-hero locks or permanent damage immunities. Final thresholds need the complete roster and real player feedback.

Reproduction: `tools/dev/ascension-mechanics-audit.cjs` after `npx tsc -p tsconfig.sim.json`. It compares the current roster across five fixed teams, four power profiles, three tiers, three guardians, AUTO/TACTICAL and ten seeds per combination. Neither side uses the battle page's development-only full-ultimate flag. Baseline/current results and real screenshots are under `docs/review-images/2026-10-31-ascension-mechanics/`.

## Verified outcome

Both typechecks, production build, 922/922 Karma specs and real desktop/mobile review passed. The before/after audit contains 3,600 battles on each revision. The developed starter party retains AUTO clears; low-level Jade/Solar Tier III are no longer automatic starter clears. Lv8 Mid starter still clears all three, so mandatory roster differentiation at every new unlock remains a balance target, not a proven result. See [simulation report](review-images/2026-10-31-ascension-mechanics/simulation-report.md) for exact counts and limits.

Presentation size follow-up: Aegis now uses displayScale1.6 and Jadecrest1.8, with corresponding physical FX anchors and larger Jade charge/landing circles. Bodies and gameplay are unchanged; see [GUARDIAN_SIZE_REVIEW.md](GUARDIAN_SIZE_REVIEW.md). The subsequent user correction applies the S2/S3 swap; see AEGIS_SLOT_ORDER.md.

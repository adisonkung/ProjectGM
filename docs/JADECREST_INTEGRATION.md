# Jadecrest Guardian integration — 2026-10-31

User-approved second Ascension guardian: พยัคฆ์พิทักษ์หยก (`jadecrest_guardian`). Aegis remains first, Astral Seraph remains third until Solarian's full actions/VFX are supplied. All guardians remain selectable every weekday; the temporary free-choice flag is unchanged. Old Moonblade and Shishi IDs/tiers remain registered for saved/review encounters.

## Approved presentation

- Sources: 18 original native-alpha PNGs under `assets/bosses/Jadecrest/source`, SHA256 in `manifest.json`.
- Character: idle, stable-mane walk, idle-based recoil, normal attack, death, stomp, pounce, roar, death-onset-derived Break/recovery. Canonical right-facing atlas; enemy facing flips at runtime. No new AI-generated art.
- S1 V4: enlarged ground-charge-in, hold its last image; no ground-charge-held substitution. Native front-impact F4–F8 retains original direction and draws last over the boss. Paw-charge F8 is a single 100ms peak +140ms fade at the distal cell, lifted from V3's low tail.
- All ground charges V5: periodic motion in the green upper aura, fixed gold base/foot pivot, moving filaments and glints. Ground and foreground rim are separate layers.
- S2 V5: 1.2s crouch +0.6s committed travel, damage on landing; padded/edge-softened impact around the feet, low front rim and a complete code ellipse. Texture edges missing from the source cannot be reconstructed; code light fills the visible boundary.
- S3 V6: charge moved 25 preview pixels toward the mouth, charge alpha×1.55 / wave alpha×1.65 / RGB+8%; waves originate at mouth. Supplied Break-core and death-dissolve are also installed.
- Source camera angles differ between front three-quarter idle/stomp and side-view walk/pounce/death. Body scales/feet are normalized, but the source viewpoint change remains visible.

## Provisional gameplay

The outgoing second guardian's base HP20,000 / ATK100 / DEF24 and global tier scaling are retained. No roster balance pass.

| Action | Cast / recovery | Cooldown | Effect |
|---|---|---|---|
| Normal claw | contact0.4s | attack1.4s | Physical×1.1 |
| S1 stomp | 1.3 /0.8s | 13s | Physical×1.2, two columns ahead × three lanes, board-clipped |
| S2 pounce | 1.8 /0.8s | 16s | commit landing at1.2s, travel0.6s, Physical×1.3 radius2 at landing |
| S3 roar | 1.05 /1.7s | 14s | Physical×1, forward two-column×three-lane area +0.8s stun; Break100 |

These are initial integration values, not a declaration that the roster is balanced. Logical hit areas never come from PNG alpha. The current broad body uses the existing 3×2 lower-centre footprint: first spawn root(11,2), no normal chase, returns home2.5s after a pounce. Destination selection checks the whole body for board bounds and occupied/reserved cells. One health bar; targets are hit once.

`MonsterSkillDefinition.leapTravel` is opt-in and applies only to LEAP_BEHIND casts. It commits the destination during the last travel interval, reuses the existing exact-duration dash position, and leaves all damage at semantic SKILL_ACTIVATE. A moving/dead target does not trigger a second relocation at activation. Legacy leap skills retain their existing timing. Monster cast facing now persists through its recovery and clears on recovery/hurt exit, interruption or death.

The movement event no longer replaces an active monster cast with walk, so the airborne body pose continues. The delayed trail uses game-clock frame/motion keys and follows the air arc; it is not a wall-clock timer. Cast-owned effects stop on activation/interrupt/death. Break uses the real status-owned playback.

## Build / review

`python3 tools/sprites/jadecrest.py` then `npm run sprites:optimize`. The helpers register/cut compressed panels without changing originals, stabilize the jade mane, and bake separate character and FX strips. Runtime atlas cells320×280; maximum strip width stays inside WebP's16,383px limit. No manual sprite-atlas edits.

Real desktop/mobile screenshots and approved preview references: `docs/review-images/2026-10-31-jadecrest/`. Browser setup disables hero automatic skills and raises fixture hero HP only in isolated browser memory; it does not change saved production stats. See review README and verification JSON for the exact checks and any remaining differences.

# Sylvara Windwhisper — The Emerald Huntress · Phase A

User scope, 2026-10-17: implement the reported foundation plan from the character concept and `sylvara_base.zip`. Team: Classic Fantasy — Kingdom Adventurers. This is base art + provisional gameplay, not finished skill production.

## Repository base and registration

- Fresh shell fetch confirmed `origin/master` at `895369a043ebd920f7eb5cd130b321df1473671c`, after the reviewed Mirelle merge. Working tree was clean; branch `work` and cached remote previously held `e29bc20`. No local `master` exists in this cloud clone, so a local/remote master comparison is unavailable.
- Read the 15 latest remote commits and Mirelle changes before implementation. Created `wip/codex-hero-sylvara` locally and on GitHub before the first edit. Shell push identity `webuilddeveloper` returns403; the connected owner account `adisonkung` can publish this task branch.
- `HEROES` now contains9 heroes, ending in Mirelle then Sylvara. ID `sylvara`, Thai name ซิลวารา วินด์วิสเปอร์, existing `archer` class, provisional3★. No new class/stat override, equipment/progression table or starter/bench grant.
- Gacha discovers Sylvara through `HEROES`; existing saves retain their team. New IDs need no removal/rename migration.
- `sylvara-production.ts` is an inventory/status note, not a registration of missing assets. S1/S2 names remain proposed until their actual source/runtime review.

## Provisional gameplay at R1

| Slot | Skill | Behavior |
|---|---|---|
| Basic | Arrow | Existing Archer ranged Physical basic. |
| S1 | Emerald Piercer / ศรมรกตทะลวง | One Physical220% ATK projectile; focus when valid/in range, else lowest HP% in range. Cooldown6s. No inherited Rapid Shot repeats. |
| S2 | Verdant Snare / พันธนาการพฤกษา | One arrow, then Physical80% ATK to every2×2 occupant on contact. Successfully damaged survivors receive Root2s. Cooldown11s. No persistent damage or reapplying Root field. |
| Ult | Emerald Skyfall / ฝนศรมรกต | One activation creates a fixed3-column×2-lane field. Physical60% ATK per occupant per wave; first wave after1s, then through second5: exactly5 waves. No launch damage or ending explosion. |

Damage, cooldown, duration, rarity and timing are placeholders for the future roster/balance pass. No existing hero, class stats, stage, status definition or rank table changed.

- Keep class skill IDs `rapid_shot`, `arrow_rain`, `heavenly_arrow_rain` for progression compatibility. Rank scaling traverses existing FIELD children; it does not change the five-wave count, geometry or Root duration. Inherited Break upgrades do nothing because this kit has no interrupt/Break effects.
- Root uses existing status/immunity/Unstoppable behavior; it prevents voluntary movement, not attacking/casting. Synergy is positional: no hidden bonus damage on Rooted targets.
- S1/S2 effects land on projectile arrival, not release. For now S2 uses existing homing delivery and resolves its area around the target's arrival cell; it does not pre-mark a fixed ground cell at cast start. Ground-shot delivery may be revised explicitly with S2 production.
- Ult locks its anchor at activation. Later waves query current living/targetable occupants; entrants can be hit and leavers escape. Target death/movement does not move/end it; caster death cancels it. Stage end/wave advance clear it, using the existing combat clock/lifecycle.
- Gameplay creates the rain once. The required single ascending-arrow visual and five rain/impact visuals remain pending source art; the basic-arrow image is not used as a fake upward launch. Character recovery does not control field expiry.

## Generic geometry

- `RECT_3X2` / `rect3x2Center()` in `battle/engine/area.ts`: three columns centred on the primary; primary lane plus next lane (previous lane at bottom edge). At either column edge, shift the footprint inside the board to retain six valid cells. Independent of caster facing and PNG size.
- FIELD accepts this shape using the existing scheduler; AI uses the same resolver via `countArea`. Existing2×2/3×3 fields retain their behavior.
- Field lifecycle events retain the original aimed cell as anchor; future3×2 presentation must use `rect3x2Center(anchor)` for the actual footprint centre. No field FX is registered yet.
- Skill detail text now correctly labels3×2 fields rather than2×2.

## Approved base art

Only two PNGs are supplied; there are no embedded instructions, skill sheets, separate VFX, UI art or timing workbooks in the ZIP.

| Source | SHA-256 |
|---|---|
| `Sylvara_base_combat.png` (1484×1060) | `0b5d35e73d54d21c6b81f5ec1fb8acc356b1eccb7bdbce5b3cc457b1999a64cf` |
| `Sylvara_master_reference.png` (1448×1086) | `6736b2f7c4dbdff7b9145ca5348d680d208fe8e6ad854ab4aa62f6dc23d8749c` |

The archive remains in `/workspace/attachments/83e5b249-2485-415b-9227-0d65b38128f7/sylvara_base.zip`. Byte-identical read-only copies for this session are `/workspace/attachments/sylvara-originals/{base,reference}.png`. Neither originals nor `art/incoming/**` are modified. Other clones can provide the same bytes in `art/incoming/sylvara/{base,reference}.png`, the script's default source slots.

Rebuild:

```bash
python3 tools/sprites/sylvara.py /path/to/read-only/source
npm run sprites:optimize
```

Dependencies match the shared pipeline: Pillow, numpy, scipy, scikit-image. This cloud session installed them outside the repository at `/tmp/sylvara-pydeps`; prepend `PYTHONPATH=/tmp/sylvara-pydeps` here when rebaking.

- Shared Bai Long/Aurel keying, body watershed, feet roots and torso stabilization; one scale0.3768116, idle body78px. Walk uses one source ground line to retain airborne poses.
- `hero-sylvara.png`:7×8 atlas,260×170 cells/root130,155. Base rows5/7/4/7/6; reserved skill rows5–7 are blank and never selected.
- Detached arrow pixels from the approved base are cut separately as `fx-sylvara-basic-arrow.png` (18×5), FX key `sw-basic-arrow`. No replacement art is generated.
- Reference close-up supplies the temporary288×288 transparent portrait. No palette swatches/panel edges in its crop. Dedicated portrait, icons and banner remain pending.
- Source pixels are not redesigned. Bake reports zero clipped character pixels. Optimizer generates only Sylvara outputs plus the atlas entries; other hero artifacts stay byte-identical.
- S1/S2 temporarily reuse the basic attack object. Ult reuses its poses with one activation event and no ascending-projectile event. At85ms/pose the fallback releases/activates at0.34s nominal,0.35s on the50ms engine clock; clip length0.595s. These affect provisional cast-lock/damage timing and are not final skill timings or Sync Sheets.

## Validation and next production boundary

- `emerald-huntress.spec.ts`: arrival-only precision shot, focus/range, dead projectile target, area Root/immunities, five-wave field, occupancy changes, target/source death, encounter cleanup, rank copies, AI and mirrored/edge geometry.
- `roster-remodel.spec.ts`: shipped registries, base rows, pending asset state and no fake final skill/field art. Bai Long's explicit semantic-sheet registry expectation includes Sylvara.
- Required validation: both typechecks, full Karma, production build, default and Sylvara-team10-run/floor sims, native DPR2 Pixi/DOM/mirrored base previews. Actual results are recorded in `AI_HANDOFF.md` after execution.

Base preview: `/sprite-lab?hero=sylvara&compare=mirelle,kael&enemy=forest_slime&bg=forest-1&distance=4&render=pixi` (or `render=dom`). Captures live in ignored `tmp/sylvara-preview/`.

Next: obtain S1 character/Charge/projectile/Impact sources; reconcile the proposed name, implement/review the actual skill, then Sync. Continue S2 and Ult individually after their reviews. Ult sources must preserve one upward launch,3×2 ground field,five downward rain waves with impacts,and residual. Never infer final timing or fabricate missing art from this base ZIP.

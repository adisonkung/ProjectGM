# Expanded animation test room

User request: enlarge the animation room, select game monsters/bosses to review their actions, and adjust caster and target cells independently.

The existing /sprite-lab now has:

- A caster picker grouped into heroes, sprite-backed monsters and bosses, including registered variants. Monster action buttons use their actual skill names; the native Break pose is available when supplied.
- A separate target picker (training dummy or registered sprite-backed monster/boss), 1–6 targets subject to fitting full footprints, and independent row/column controls per unit.
- A clickable 3×16 grid: select a unit in the setup panel, then click a cell to place it. UI coordinates are one-based (rows1–3, columns1–16). Large bodies must fit entirely on board and cannot overlap another reserved body. Ordinary point-sized units retain stacking support.
- Automatic target packing prefers the caster's forward side. If fewer large targets fit than requested, the room reports the fitted count. The grid tracks current review positions while setup inputs retain starting positions.
- A wider room wrapper up to1560px and cell size up to90px;1.5 extra sky rows and1 extra lower scenery row. Shared gameplay stays3×16; these margins are visual room for raised weapons, leaping actors and floor effects.
- A scene selector and the existing loop, facing, speed, renderer and anchor tools. Reset/actor/target/position changes cancel pending events.

## Playback and isolation

Monster skills are sampled from an isolated real BattleEngine using monsterReview. Normal AI attacks/movement are frozen and targets have training HP. The new requestMonsterSkill API triggers only an owned ready skill on a living non-casting monster with a valid aimed target; it rejects unknown/unowned/on-cooldown casts. Manual review bypasses the AI's decision to choose that skill, while retaining its actual effects, cast duration, movement, ground marks, lane sequences and status lifetime. Normal gameplay AI does not call this API.

Native charge/release FX come from the same SheetDef/FxDef bindings as battle. Engine monsterGround and monsterBeam events drive Solar marks and lane beams; Jade commits its actual leap destination. Aegis uses the existing forward-art/recoil helper and held firing pose. Release events explicitly enter the native release pose so delayed rendering cannot leave a charge pose playing over its impact. Basic Idle/Walk/Attack/Hurt/Die/Break are presentation previews; basic attack preview does not claim real damage calculations.

Targets selected as monsters use the selected sprite and logical footprint; isolated training recipients retain durable training vitals. Existing hero engine-review paths use the chosen target type/cells. Nothing writes character progression, rewards, combat balance or saves. The existing GM access policy remains in place: player-only access still exposes S1/S2/Ultimate and cannot enable monster tools through direct selection calls.

## Validation

The new regressions cover native Aegis S2 damage recipients, unowned-cast rejection/global-registry integrity, Jade committed landing warnings, Solar's four lane releases, caster selection/named slots, full-body placement, packing, forward target placement, release synchronization, reset cancellation and player access. Full Karma/typecheck/build results and actual desktop/mobile review are recorded in [the review folder](review-images/expanded-sprite-lab/README.md).

Native sprite PNGs are unchanged, so the atlas optimizer is not needed. The room is broader/taller than the original Sheet15 reference by user request; its existing frame/color/navigation treatment is retained. This work is a task-branch review, not a production deployment.

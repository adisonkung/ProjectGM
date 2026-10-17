# Sylvara — S2 Verdant Snare · provisional visual review

User requested S2 on2026-10-17 and supplied `sylvara-s2-source.zip`. Continue `wip/codex-hero-sylvara` after fresh fetch: master remains895369a, task branch505dfc3, clean tree/no new agent work. This request authorizes S2 production; it does not finalize S1 timing or authorize Ult production.

## Source audit and reconciliation

Read-only archive/extraction: `/workspace/attachments/48a0083f-8daf-472c-9a91-3e8cd97e986d/{sylvara-s2-source.zip,extracted/}`. Original PNG/XLSX bytes remain untouched; no writes to `art/incoming/**`. Other clones can use `art/incoming/sylvara/s2/` as the source slot.

| Source | Actual content | SHA-256 |
|---|---|---|
|`s2_character.png`|1774×887,2×5=10 poses|`81e59bb0e325bf6d8afc9dcfd3b8143d2a42eddbfef22965b02a083844de962c`|
|`s2_main.png`|1672×941,5+4=9 stages|`8d6c36c55f88576a7fcd7fb99b4ecf812ec106bb79dd5ee7adadd6ebebd491ee`|
|`s2_impact.png`|1448×1086,2×4=8 stages,real alpha|`cf6b05aedda14eaddbd18ab78223a4c76517f0fa4e760b630e5758b9a8e3bdd7`|
|`s2_root.png`|1774×887,2×5=10 stages|`5630d947466ef58e5d734159de9410df6e69d73887cbf5155e57f49a14509ba1`|
|`SYLVARA_S2_UNIVERSAL_TIMELINE_V2.xlsx`|design/frame/event/asset/QA proposal|`620ff9ef683dc80ad8ba34258a41376a6292e469c12eb826b4c6122d6f989cb3`|

- Workbook explicitly says frame count/release unverified,12FPS/F7 provisional, and existing game values/area must win. Treat embedded contracts as design input, not permission to add event-ID, physics, LOS, damage or optional dissolve systems.
- Actual F4 still has an arrow nocked; F5 has released/empty bow; F6 follows through. Release is therefore F5 for this review, not proposed F7.
- Source F7 has four projectile streaks painted across/beyond the bow. Preserve the full source/atlas pose, but do not display it as four extra arrows: provisional playback sequence `[0,1,2,3,4,5,5,7,8,9]` holds clean F6 during that slot. Ten playback steps, nine distinct poses. No weapon redraw or source edits. This choice is visible/reversible at review.
- Explicit source ownership keeps F7's long detached arrowheads with F7 rather than the nearby F8 hair, so they cannot leak into recovery via the shared watershed cutter.
- Name matches current proposed **Verdant Snare**. No final production timing/name approval is inferred.

## Asset pipeline

- `sylvara.py` adds row6 to the10×8/260×170 atlas, using one S2 scale.2644068 from the ready pose to match78px base body/root130,155 and shared torso stabilization. Base/S1 rows remain pixel-identical; Ult row stays blank. Both skill source sets are now required for combined rebakes, preventing silent fallback rollback.
- `sylvara_s2.py`: unmix magenta Main/Root, respect Impact's real alpha, discard matte specks and split by audited row/component centres. No equal-grid cuts through overlapping bounds. Character, projectile, Impact and Root are separate files.
- Main1–2 are buildup; Main3–9 are7 flight stages plus a transparent terminal cell: `fx-sylvara-s2-projectile.png`,8×148×31,72px peak visible width/tip-centred. One engine projectile/area hit, no additional launch/terminal damage.
- `fx-sylvara-s2-impact.png`:8×116×116, fit2 cells. One burst at the logical2×2 footprint centre (`groundArea:SQUARE_2`), not one burst per recipient or a gameplay area inferred from pixels.
- `fx-sylvara-s2-root.png`:10×84×100, foot pivot.5/.92. Stages1–5 grow for.5s; only stable coil stages6–10 loop after that. Each successfully Rooted recipient gets its own attached root. Source formation-to-coil size change is preserved for review. No dissolve source exists, so none is fabricated.
- Optimizer generates atlas/optimized outputs; no existing hero assets, S1 FX/basic arrow or portrait are changed.

Current rebuild:

```bash
PYTHONPATH=/tmp/sylvara-pydeps python3 tools/sprites/sylvara.py /workspace/attachments/sylvara-originals public/sprites public/portraits /workspace/attachments/1db55958-a47f-4fab-9c75-c5f332813310/extracted /workspace/attachments/48a0083f-8daf-472c-9a91-3e8cd97e986d/extracted
python3 tools/sprites/sylvara_s2.py /workspace/attachments/48a0083f-8daf-472c-9a91-3e8cd97e986d/extracted
npm run sprites:optimize
```

## Timing, gameplay and visual lifetime

- Trial12FPS/10 steps: one release F5=.3333s nominal/.35s engine; recovery step8=.5833s; end.8333s. Previous fallback release.34s/engine.35s and end.595s. Actual release remains on the same engine step, but cast-lock grows.2383s. This is combat-relevant review timing, not a balance change/final Sync.
- Keep Physical80% ATK,2×2,Root2s,CD11s,rank ID `arrow_rain`,AI and target policy unchanged. Existing homing arrival resolves the area around the arrival cell. At distance4: release.35s/contact.7s. Four recipients take damage once; only successful Root applications create roots. No persistent damage, reapplying field, Break or interrupt.
- New generic `SheetDef.statusFx` + `StatusFxPlayback` consume live statuses/source metadata. Growth plays once, stable loop survives refresh without restarting growth, and both disappear when status is absent (expiry/cleanse/death/despawn/reset), even before delayed loop startup. Root can outlast the character ending; source death does not end an existing status contrary to gameplay rules. No hero-ID branches or combat changes.
- Battle reads actual live buff instances. Sprite lab uses the same presentation owner with actual-engine status snapshots, including source IDs. Projectile-area skills now automatically use engine playback in the lab; `combat=1` also enables engine playback explicitly. It displays the real engine projectile, one impact, actual damage text and Root applications instead of faking an instant hit.
- Existing projectile origin remains cell-centre, not exact arrow-nock coordinates. No source-pixel collision or new projectile physics is added.
- Basic/S1/Ult timing and all other heroes remain unchanged. S1 and S2 final Sync remain pending; Ult production is not started.

## Review and verification

`/sprite-lab?hero=sylvara&enemy=forest_slime&bg=forest-1&distance=4&formation=square&combat=1&render=pixi` (or DOM). Select **Verdant Snare**. `status=gate_stance` makes only the primary Unstoppable for a visual immunity check; this is disposable training data, never a player save change.

Tests cover one actual projectile/four area hits, Root immunity, status-source mapping, expiry, growth/loop refresh/cleanup and lab reset while in flight. App/spec/sim typechecks, optimizer, **676/676 Karma**, production build and Sylvara-team10-run/floor simulation pass. Native Pixi/DOM right/left/reset checks have zero errors/missing assets; normal status check has4 stable loops, primary Unstoppable has3, and both have0 after expiry. Source hashes, earlier rows and optimized visible pixels/alpha are verified; strip edges are unclipped. Full results are recorded in `AI_HANDOFF.md`. Captures/videos are in ignored `tmp/sylvara-s2-preview/`.

Stop for S2 visual review. Any final S1/S2 Timeline Sync, changes to source-pose handling or Ult production require subsequent user steering; none is inferred from the workbook.

# Elira Ultimate — recipient-centred fixed sanctuary

2026-10-18:User requested casting on the lowest-health ally with that ally as the field centre. User explicitly chose a fixed field at the recipient position when the skill activates.

## Behavior

- Select the lowest living ally **HP percentage**,including Elira. Range is unlimited. Existing ties use distance then unit ID. Dead allies/enemies are ineligible.
- AUTO keeps the existing75%injured/35%emergency thresholds; manual use needs only a valid recipient. It can now protect an injured ally outside the original home zone.
- Lock the selected recipient when casting begins. Capture their **current position at activation**,F7/.50s. Injuries to other allies during anticipation do not redirect this cast.
- If recipient or caster dies before activation,no field is created. There is no automatic replacement target. After creation,recipient movement/death does not change the fixed field; caster death still cancels it under the existing source-owned policy.
- Duration6s,incoming damage reduction20%,no shield/heal/revival/damage added. Cast timing and all FX phases remain unchanged. Natural expiry uses Dissolve; reset/stage clear/source death clean up normally.

## Geometry and presentation

New generic RECT_6X3_CENTERED uses the actual activation point(r,c) for both effects and visuals. Unlike legacy RECT_6X3,it does not shift the rectangle at the edges or add a half-column midpoint offset. Column bounds are[c−3,c+3),lane bounds[r−1.5,r+1.5). Half-open horizontal bounds avoid a seventh integer column on the border. Interior integer centres cover18 cells; at board edges the offboard portion is clipped. The centre remains on the recipient.

FieldSystem aura occupancy and support AI use the same resolveArea geometry. FieldFxPlayback uses the lifecycle event's exact point throughout Formation→Loop→Dissolve and reprojects it with camera movement. All three dome tracks now use the existing feet offset27.25%cell(previous35%),so the common ground root aligns with the recipient's feet. PNG/WebP art,frames,pivots and sizes remain byte-identical; no optimizer run is needed for placement-only definitions.

The skill tooltip says the field is placed on the lowest-HP% ally. Sprite-lab formation=field separates a40%-HP recipient from the full-health caster,with inside/outside witnesses and mirrored placement.

## Validation

App/spec typechecks,711/711 Karma,production build and10-run/floor/bot Elira-team smoke passed. Team:yuezheng,kael,sylvara,mirelle,elira;F1–3 both100%,F4 AUTO40%/TACTICAL0%,F5–10 both0%,same smoke result as the preceding checkpoint. Regression tests cover:

- Lowest HP% rather than raw HP,self,dead ally exclusion,unlimited range and AUTO/manual behavior outside home zones.
- No field beforeF7,recipient movement during anticipation,locked recipient despite later injuries,and no redirect when recipient/caster dies.
- Interior18-cell geometry,exact target centres at corners,entry/exit/side filtering,no lingering reduction,and fixed field after recipient movement/death.
- Field visual centre through Formation/Loop/Dissolve and camera motion; mirrored real-engine lab lifecycle at.5→6.5s; no damage/healing/shield/projectile added.

Native Pixi/DOM DPR2 review passes (Pixi canvas creation also verified) with zero page errors/missing assets and zero owned FX after expiry/reset; it verifies the field on the injured recipient instead of the caster,in both facings,with one full lifecycle and reset cleanup. Artifacts/screenshots and verification.json:ignored tmp/elira-target-review. Smoke simulation is a regression check; no balance tuning is part of this change.

Fresh origin/master72a3f34,published scale fix27edd69,clean tree; task fix/elira-ultimate-target includes the unmerged Elira/scale work. Publish only this task branch. Confirmed canonical-local sync metadata is unchanged.

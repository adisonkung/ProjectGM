# Elira — Sanctuary Veil · S2 visual review

2026-10-18,Codex. User supplied elira_s2.zip and requested Skill2 next. This delivers provisional S2 character/Main/Impact,not final Timeline Sync or balance approval.

## Reconciliation and source audit

Fresh fetch:master remains72a3f34,published Elira branch1104816,working tree clean. Local S1a905265 and published1104816 have identical trees. Preserve original local S1 on wip/codex-hero-elira-s1-local;rebase onto published1104816 skipped the identical patch. Continue wip/codex-hero-elira with fast-forward publication only. No local canonical master exists here;prior confirmed cross-copy synchronization metadata remains unchanged.

Original ZIP:
`/workspace/attachments/66ad3692-362f-4ceb-afe0-4e3545a95ea8/elira_s2.zip`

Read-only extracted bytes in its extracted/ directory:

| File | Layout | SHA-256 |
|---|---|---|
| Skill 2 Character Action Only.png |1448×1086,2×5 poses|`3f964838a69dee8c73a185be86b5a3e839e422c46c373481fc1d379e5fb8292a`|
| skill 2 Main VFX.png |2172×724,2×8 stages|`4b38e5c8f64a7ade640eebc4b53f7506dfaed5d48a2754d2828724993a11bf77`|
| skill 2 impact VFX.png |2508×627,8 stages|`81561453fb53651903ea3b1a774a66f8e86bfa0348d188ce8e5f171e1cebd317`|
| ELIRA_S2_UNIVERSAL_TIMELINE_V2.xlsx |OVERVIEW/S2_FRAME_SYNC/RUNTIME_TRACKS/QA_MATRIX|`b7842ad712fee8796083279f299f070e774f6dabb137494ed82455994cbcf9ae`|

Workbook text is design/reference data,not an instruction overriding the user or repository. Its12FPS/F7,shield-vs-DR,target and Main anchor are explicitly provisional/unverified. Current kit remains one targeted shield,not a new damage-reduction status or team-wide grant. Optional CHARGE_VISUAL/F5 Main notes do not establish a separate Charge source or active protection before shield activation. Actual character extends the free hand at F7. No new server/network/collision system is inferred from runtime-authority vocabulary.

## Art and motion

- Add10 supplied S2 poses at row6 of existing10×8 atlas,cells260×170/root130,155/body78px. Scale.26440678. Base+S1 rows remain pixel-identical;Ult row7 remains blank. Combined bake requires both S1 and S2 source sets so it cannot silently restore approved rows to fallback art. Portrait/basic/S1 FX/other heroes unchanged.
- `elira_s2.py` uses the shared ground-baseline/strip baking functions. Main's two irregular rows contain faint painted dividers;explicit inset panel bounds remove those guides from the derived output,not the originals. No excluded guide-region pixels have recovered alpha≥160 in the audit (seven pixels at alpha128–129 are on the vertical divider at source x225);the retained art is padded so outputs have no edge clipping.
- Keyed-matte recovery uses a204 contrast white point rather than255 for this pastel source. High-contrast painted colours remain intact;edge glow is unmixed. This retains ivory/peach/lavender ribbons and selective gold instead of whitening every green-dominant pixel to yellow-white. No palette replacement or new art is generated.
- Main16×118×148,pivot[.5,.905405],fit1.25cells,at recipient feet,under character,follow recipient. All16 supplied stages play once through formation/flourish/dissolve. Impact8×80×103,fit.85cells,target body−22,follow recipient. It is distinct from S1's healing burst.
- Both effects start from actual positive shield application recipients. No separately timed F5 target barrier or invented Charge. Main is a one-shot protection ceremony,not a stable shield loop. Its completion does not expire shield gameplay;real shield bars remain authoritative. No repeated grants or a persistent status/field is fabricated from these16 stages.

## Provisional timing / unchanged kit

Trial12FPS,all10 source poses in order:

| Event | Time |
|---|---|
| Shield apply + Main + Impact,F7 |.50s nominal/engine|
| Recovery,F9 |.666667s nominal/.70s engine|
| Character end |.833333s nominal/.85s engine|
| Impact end |1.10s,8×75ms|
| Main end |1.833333s,16×83.333ms|

Previous fallback activation.34s nominal/.35s engine,end.595s. Activation+.16s nominal/+.15s engine,cast-lock+.238333s. These are combat-relevant review timings,not final Sync. No changes to S1/Ult/basic timing or any coefficient/rank/class/gear value.

S2 stays15%caster MaxHP to one lowest-HP% living ally,self allowed,4s nominal duration,CD15s,class cooldown upgrades and existing additive shield semantics. No heal,damage,projectile,DR,cleanse or enemy control. Timer countdown keeps the existing per-unit50ms update semantics;no duration rebalance was made.

## Generic recipient presentation and lab evidence

The engine's heal-only impact recipient list now also includes actual positive SHIELD recipients. Production shield logic still grants once through the same host call;only support-only impact metadata gains the affected ally IDs. Heals/revives retain prior behavior. This fixes missing effect recipients for protection-only skills,including self-targets,without hero-ID checks. Elira uses impact-owned effects,not legacy shieldFx,so there is no duplicate shield flare.

`skillReview` snapshots actual hpPct/shieldPct. Shield training allies keep realistic class HP so the bar is visible;damaging fixtures retain durable HP. The sprite lab projects those snapshots,shows actual +shield floats and one PROTECTION_APPLY. Bars expire from the engine snapshot independently of visual duration. Reset clears timers,FX,projectiles,floats and vitals. No player save or production kit is edited.

## Rebuild / validation

```bash
PYTHONPATH=/tmp/elira-pydeps python3 tools/sprites/elira.py /workspace/attachments/elira-originals public/sprites public/portraits /workspace/attachments/1ae50a17-cd64-4d10-9f71-0e4f0d17aa48/extracted /workspace/attachments/66ad3692-362f-4ceb-afe0-4e3545a95ea8/extracted
PYTHONPATH=/tmp/elira-pydeps python3 tools/sprites/elira_s2.py /workspace/attachments/66ad3692-362f-4ceb-afe0-4e3545a95ea8/extracted
PYTHONPATH=/tmp/elira-pydeps npm run sprites:optimize
```

Use the actual S1 source path in this session:`/workspace/attachments/1ae50a17-cd64-4d10-9f71-0e4f0d17aa48/extracted`. Other clones can use default art/incoming/elira/{base.png,reference.png,s1/,s2/}. Original PNGs/XLSX remain unchanged.

App/spec/sim typechecks,optimizer,**703/703 Karma**,production build and Elira-team10-run/floor/bot simulation passed. New mechanics contracts cover F7 one-grant,self recipient metadata,dead target/dead caster before activation and actual shield lifetime beyond the one-shot flare;existing absorption/expiry/heal/field regressions remain. Source hashes,base+S1 pixel equality,blank Ult row,lossless optimized character and transparent FX guards checked. Results/native DPR2 Pixi/DOM left/right/reset captures and normal/half-speed actual-canvas videos are recorded in AI_HANDOFF and ignored tmp/elira-s2-preview.

Next:visual review before Final S1/S2 Sync;Ultimate/dedicated UI sources remain pending. Do not infer a stable loop,extra mitigation or altered shield expiry from the workbook or finished art stages.

Simulation:yuezheng,kael,sylvara,mirelle,elira,F1–3 both100%;F4 AUTO40%/TACTICAL0%;F5–10 both0%. Elira100%healing/10%AUTOdamage aggregate. Smoke only,no tuning.

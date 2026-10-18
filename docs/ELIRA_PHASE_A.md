# Elira Dawnmere — Keeper of the Hearthlight · Phase A

Subsequent S2 integration:see `ELIRA_S2_REVIEW.md`; S1/S2 now have separate provisional clips, Ult remains on its base fallback.

Subsequent S1 source integration (2026-10-18): see `ELIRA_S1_REVIEW.md`. S1 now has its supplied row/Main/Impact and provisional review timing; base-only fallback descriptions below are historical. S2/Ult and Final Timeline Sync remain pending.

User authorized the reported foundation plan on 2026-10-17. Classic Fantasy — Kingdom Adventurers. This checkpoint delivers approved base art plus provisional gameplay; it is not finished skill/VFX production or Final Timeline Sync.

## Reconciliation and source inventory

Fresh fetch verified `origin/master`72a3f34, after Mirelle and Sylvara including Sylvara UI art. The initial `work` branch was clean at e29bc20,19 commits behind; no local master exists in this cloud clone. Read current remote history, registries, canonical rules, other-agent diffs and handoff before editing. Created `wip/codex-hero-elira` locally and on GitHub before the first edit. Shell push identity webuilddeveloper returns403; the connected repository owner adisonkung is used for publication. Only this task branch is authorized for publication; no master merge or branch deletion.

The supplied `Elira_master_base.zip` contains exactly two indexed PNGs, each1448×1086:

| Source | SHA-256 |
|---|---|
| Elira Dawnmere Cleric Sprite Sheet.png | `bc5d315a1ee50f30065b48a6af63501b9544dde608f746e21378257f18939409` |
| Sunrise Cleric Character Concept Sheet.png | `3104c273ad2831344c77e655ed859310a23acb8104461892d7c5e3ba5b39eba5` |

The concept says S1/S2/Ult are created, but their files are not in this archive. No embedded text documents, workbooks or instructions were present. The user's concept/request is the design source; filenames and image content supply art, not implementation instructions. Byte-identical source copies: `/workspace/attachments/elira-originals/{base,reference}.png`. Archive: `/workspace/attachments/41721053-4d72-452f-adc4-224456ca134c/Elira_master_base.zip`. Originals and `art/incoming/**` remain untouched.

## Registration and provisional R1 gameplay

Roster10: bailong,yuezheng,moye,tangxun,linxue,garrick,kael,mirelle,sylvara,elira. ID elira, Thai name เอลิรา ดอว์นเมียร์, existing healer class, provisional3★. No new class, stat override, equipment/progression change or starter grant. Gacha discovers the new ID via HEROES; existing saves retain their team.

| Slot | Behavior |
|---|---|
| Basic | Healer Light Bolt: ranged Magic damage with Holy art theme. No automatic Heal Bolt conversion. |
| S1 Hearthlight Blessing / พรแห่งแสงอุ่น | One instant targeted heal at activation:220% caster ATK +10% recipient Max HP. Lowest living ally HP%, self included, unlimited targeting range. CD8s. Heal AI below80%, emergency35%. No enemy damage, splash, cleanse or projectile. |
| S2 Sanctuary Veil / ม่านพิทักษ์ศักดิ์สิทธิ์ | One ally shield at activation:15% caster Max HP,4s. Lowest ally HP%, self included, unlimited range. CD15s. AI below75%, emergency35%. Uses existing additive shield/expiry/gear behavior; no heal or damage. |
| Ult Hearthlight Sanctuary / เขตพิทักษ์แสงอุ่น | Fixed home-zone6×3 sanctuary for6s,20% incoming damage reduction through the existing damage resolver while an ally occupies the zone. Ally source columns0–5, enemy source10–15; all three lanes. No burst, periodic damage/heal, revive or control. AUTO below75%/emergency35% considers occupants only; manual cast remains available. |

All values, names, rarity and fallback timing remain provisional pending actual skill sources/review and roster balance. Class progression IDs retained:prayer/holy_blessing/holy_resurrection. Existing heal rank upgrades scale S1; S2 inherits class cooldown progression (R4–5:14.25s), but the class HEAL rank modifier does not change shields. Ult's inherited HEAL/REVIVE upgrades do not invent either effect or scale the aura. Shield amount/DR/duration stay authored until an explicit progression/balance pass; equipment/rankPower effects retain existing engine behavior.

## Generic spatial protection

- `RECT_6X3` in AreaResolver:18 cells, clamped at board edges; the integer anchor is the left-middle column (footprint anchor−2..anchor+3). Source-side home-zone anchor selected through `FieldDefinition.anchor: HOME_ZONE`, not a hero-ID branch. Geometry remains independent of image pixels.
- `FieldDefinition.aura` holds team relation and modifiers. FieldSystem records source side and returns current eligible modifiers. Battle units expose the live query through Buffable.auraModifiers; DamageResolver and existing modifier consumers compose it with timed statuses without changing base stats.
- Protection starts at field creation, independently of pulse cadence. Movement into/out of the footprint changes the next query immediately. Source movement never relocates the field. Source death removes protection immediately even before the next field tick; natural expiry, wave/stage clear cancel ownership without lingering buffs. Revive cannot revive an already-removed field.
- Existing status reductions and simultaneous active fields multiply through the normal modifier product; no special stacking exception introduced. Field aura is not a timed buff, so cleanse does not remove a still-active zone. Existing direct-damage/DoT paths retain their existing damage semantics.
- Existing damage fields retain delayed first pulses/final-boundary behavior. Elira has no pulse effects; lifecycle pulses carry no healing/damage. AI shares fieldAnchor and AreaResolver with activation.
- Dedicated Dome art/presentation is pending. No fieldFx is registered, and no fake instant dome/burst is substituted. Planned production:Charge → Formation → persistent Loop → natural Dissolve; source death/reset must cancel owned visuals. Runtime6×3 geometry is authoritative;1024×704 export target must be checked against real board projection, not treated as a fixed CSS size.

## Base bake and temporary timing

`tools/sprites/elira.py` reuses Bai Long/Aurel chroma key, watershed body cuts, feet roots and torso stabilization. Idle body78px, scale0.39393939; atlas1820×1360 (7×8),260×170 cells/root130,155. Rows0–4 contain5/7/4/7/6 poses. Running uses one source-row ground line to preserve airborne feet. Rows5–7 remain blank. A detached white-gold star from the supplied normal-attack row supplies `el-basic-light`,16×16; the reference close-up supplies a temporary288×288 WebP portrait. Skill icons/banner remain pending. No lotus or replacement source art generated.

Skill slots explicitly reuse the base attack poses with support activation markers, not projectile markers. Activation0.34s nominal/0.35s engine, recovery0.425s, end0.595s. These timings affect combat/cast-lock and are provisional; no final skill poses, separate Healing Burst/Veil/Dome or final Sync Sheet is claimed. `elira-production.ts` records AWAITING_SOURCE/PENDING.

Rebuild from identical read-only source bytes:

```bash
PYTHONPATH=/tmp/elira-pydeps python3 tools/sprites/elira.py /workspace/attachments/elira-originals
PYTHONPATH=/tmp/elira-pydeps npm run sprites:optimize
```

Other clones may use the default `art/incoming/elira` source slots. Dependencies:Pillow,numpy,scipy,scikit-image. Optimizer changes only the two new Elira outputs and generated atlas entries; all previously tracked optimized assets remain byte-identical. Zero character pixels clipped; optimized alpha and visible RGB match the character bake exactly.

## Validation and next boundary

- `hearthlight-keeper.spec.ts`: targeting by HP%, exact activation, heal reduction/dead target, one-ally shield/expiry/absorption,18-cell geometry, immediate entry/exit, source movement/death, expiry/clear, mirrored teams, actual damage formula/status composition, AUTO occupancy/manual use and rank-copy isolation.
- Roster/sheet tests include Elira and assert explicit base fallbacks/no skill FX; Bai Long semantic-sheet registry updated. Existing shipped heroes/starter setup unchanged.
- Final validation results and native Pixi/DOM captures are recorded in AI_HANDOFF after execution. No balance tuning is authorized.

Next: supply S1 character/Healing Burst and optional Charge sources, then review S1 before proceeding through S2 and Ult. All four dome phases must follow actual field lifetime independently of character recovery. Dedicated UI sources and final skill Timeline Sync remain pending.

Current Ultimate follow-up: supplied tracks are integrated for provisional review; see [ELIRA_ULT_REVIEW.md](ELIRA_ULT_REVIEW.md). Earlier pending-Ultimate statements above describe that earlier checkpoint.

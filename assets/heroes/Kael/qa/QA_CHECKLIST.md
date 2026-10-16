# QA CHECKLIST — Kael Universal V2

## Source and frame integrity
- [ ] Verify Skill2 source 1774×887 has 14 discrete character poses in two rows of seven; left-to-right/top-to-bottom.
- [ ] Every frame sliced without cropping sword, cape, boots or antialiased edges; no frames touching.
- [ ] Normalize cells / feet to ground pivot, while maintaining same body height & rigid sword scale.
- [ ] Review F4→F5→F6: **horizontal CUT**, not sword THRUST; F6 full follow-through.
- [ ] Review F9→F10→F11: **rising reverse diagonal CUT**, not another horizontal jab; F11 follow-through.
- [ ] Review F12–F14 recovery to original stance; no accidental third hit.
- [ ] Verify hands hold same longsword, guard, grip and pommel consistently; no merged arms.

## Timing and VFX
- [ ] Skill1 exactly one damage at F7 and one impact, with Main VFX offset independently.
- [ ] Skill2 exactly two hits at F5 and F10, same target permitted but no duplicate hit per index.
- [ ] Skill2 Impact VFX spawns twice, **no Main VFX**.
- [ ] Ultimate F8 one wave emitted, range 1×4, damage per target triggered by collision only, impact follows actual collision.
- [ ] Actual frame FPS and VFX FPS confirmed against engine; override the provisional 12 FPS when necessary.
- [ ] All VFX positions honor facing, camera orientation, and unified root scale without double scaling.

## Runtime and combat
- [ ] Event firing frame-crossing stable under dropped frames and frame-rate changes.
- [ ] Animation interruption/cancel blocks future damaging events.
- [ ] Cast ID + hit index + target ID prevents duplicate damage.
- [ ] Target missing/dead/untargetable behavior follows engine rules; no crashes.
- [ ] Wave crosses tiles in order; has no additional duplicate explosion damage.
- [ ] Damage/Break read from existing balance config (do not invent multipliers).
- [ ] Run full playback loop + in-game scale comparison against Kael Base Combat.
- [ ] Keep untouched source backed up; produce comparison GIF/video + event trace before merge.

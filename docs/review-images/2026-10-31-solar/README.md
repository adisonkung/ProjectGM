# Solar — actual game visual review

Actual running Angular/Pixi battle, desktop 1440×900 and landscape mobile 932×430 at DPR 1. The screenshots are not composites or generated gameplay images. `references/` contains the approved standalone V2 presentation images; the labelled reference/game comparison combines them without retouching either source.

Fixture: clear/unlock the dungeon locally, use the actual saved starter heroes at level 8, raise their HP and lower ATK to keep the encounter alive, disable automatic hero skills, and select boss cooldowns to review each skill. Break and death are injected through the real engine methods for visual inspection. This does not assert that a particular starter hero supplies 100 Break power.

Reviewed: all three arena assignments; Solar S1 charge/locked ground marks and impact; S2 charge and offscreen beam; S3 centred ground circle, eye charge and impacts; Broken and Death. Solar is enlarged 25% while retaining its 3×2 logical body and matching attached FX anchors. The input art, geometry metadata and source hashes are preserved by the pipeline.

Differences from standalone: actual game HUD and heroes, actual board footprint and camera crop, provisional encounter timings, and a compact/shorter shutdown to fit the runtime cell and existing result outro. The maps are cropped to cover the actual game viewport; no missing scenery was generated.

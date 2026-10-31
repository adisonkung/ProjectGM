# Aegis slot swap and requested cell diagrams

Actual running game at1440×900 and932×430. Orange rectangle = actual boss3×2 footprint; O is its lower-centre anchor. Each hero is1×1. Colors/IDs:1BL Bai Long,2YZ Yuezheng,3MY Moye,4TX Tang Xun,5LX Lin Xue. R/C are zero-based, counting only the three playable rows. Dots mark the authored foot plane; sprite art and melee approach can extend outside the logical rectangle.

The SVG/DOM grid is an explicitly labelled diagnostic overlay added only for review screenshots, not a shipped product control. Clean screenshots sit beside corresponding cell screenshots. Multiple names/nested outlines indicate real heroes sharing one logical cell; they have not been repositioned to fake separation.

Jade is shown standing and after a real committed leap. The archer is moved to r2,c7 via the engine for this visual fixture. Hero HP5000/low ATK/manual skills and selected boss cooldowns keep the scene available for review. No character/effect compositing. All game screenshots and both JSON logs report zero page errors. Previous unannotated size references remain in `../2026-10-31-guardian-size/`.

Current order: S1 Guard, S2 physical ground Judgement, S3 three-second magic Light Lance with Break100/core exposure. Asset filenames retain their original s2/s3 prefixes. The current S3 hit all five test heroes across the three lanes through the real engine.

Validation: app/spec typechecks,926/926 Karma specs, production build,180 targeted Aegis encounters. The smoke sim uses starter/break parties, B/D/G6 profiles, all3 tiers, AUTO/TACTICAL,5 seeds each. All starter AUTO rows in this small sample remain5/5; this is not a claim that mandatory specialist-roster balance is finalized.

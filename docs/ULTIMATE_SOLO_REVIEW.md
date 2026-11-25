# Exclusive Ultimate playback — 25 November 2026

The battle page now holds the rest of the battlefield until the active party hero finishes Ultimate. The existing short cut-in reveal remains; after it, the caster's authored action and its new effects play while other actors, older effects and battle timers stay held. The next manual/AUTO Ultimate can start after the action and its tagged delayed hits/projectiles finish. Persistent fields and buffs resume with ordinary combat rather than keeping the action gate open for their entire lifetime.

## Runtime boundary

- `createBattle({ exclusiveUltimates: true })` enables the battle-page policy. Standalone engine/simulation callers retain the previous concurrent default. This opt-in changes action ordering and holds combat time as requested; it is not a balance-equivalence claim.
- The engine tags callbacks created by the committed action, including nested delayed effects and hero projectile arrivals. Only those callbacks and caster motion advance. Other callbacks and absolute deadlines retain their remaining time; AI, cooldowns, statuses, shields, existing fields, hostile projectiles, reinforcements and `fightTime` wait. Wave/result evaluation waits for the action too.
- Pending manual Ultimate requests have priority over AUTO; additional requests are rejected instead of queued during the action. Dead hero requests clear. The party portrait/ULT buttons, hotkeys and special/ordinary skill actions share the gate. Menu pause suspends the current action; leaving/restarting disposes the gate and pending presentation work.
- Pixi retains the last rendered non-caster pose and advances per-instance clocks only for the caster/new action effects. DOM holds existing animations and defers clip requests. Old FX/projectile/float cleanup, field/status startup and FX anchor lock timing use the same held time. On resume, animations continue from their held time rather than catching up to the global action clock. Damage flashes/HP changes can still show the active Ultimate landing.
- No authored clip/event timings, hero art, damage/range values, gauge cost/gain amounts, progression or save schema changed. No Mobile work, master merge or deployment.

## Native evidence

[Desktop gallery / preserved reference](reviews/ultimate-solo/index.html) · [Pixi during Ultimate](reviews/ultimate-solo/pixi-ultimate.png) · [DOM during Ultimate](reviews/ultimate-solo/dom-ultimate.png) · [normal combat resumed](reviews/ultimate-solo/pixi-resumed.png).

At1440×860, real hotkeys1then2 produce only Bai Long's first Ultimate. After its reveal, his native Pixi animation visits18distinct atlas cells while the other actors' sampled cells, logical positions, cooldowns, monster cast timers and `fightTime` remain unchanged. The action lasts approximately3.3game seconds. The next hero's button is disabled and another request is rejected; a later real hotkey2 starts Yue Zheng only after release. Both Pixi and DOM pass and report no page errors. No timeline is paused or replaced to create the functional reports. The stills are ordinary screenshots of those native runs.

[Native renderer report](reviews/ultimate-solo/browser-report.json) · [×4 / pause / AUTO / cancellation report](reviews/ultimate-solo/speed-pause-report.json). The latter verifies ×4 playback, menu pause with an unchanged action clock, serial AUTO casts, cancellation during an active cast, and clean re-entry. Software/headless Chromium is not a real-device FPS benchmark. Full sampled reports remain in `/workspace/artifacts/ultimate-solo/`.

This task changes behavior, not cut-in layout/art. The gallery links the previously approved Bai Long cut-in screenshot for visual continuity; the current native capture uses the same assets and styling. Actor positions, combat numbers and aura phases differ with the live encounter.

## Checks

App/spec TypeScript checks and the full1105/1105Karma suite pass. Optimized production build passes with the existing external fonts:false override; existing style/template/CommonJS warnings remain. The unchanged standalone hero-sim smoke ran20battles (one seed per floor1–10 for AUTO and TACTICAL), without tuning data. Engine regressions cover all15shipped hero actions plus existing legacy fixtures, delayed-hit completion, held fields/pending work, AUTO/manual priority, last-enemy recovery, dead request cleanup and disposal. Renderer tests cover held clock/anchor timing and deferred DOM clip requests.

The environment's existing Google Fonts403 requires the documented external `fonts:false` production-build override; no repository font/build configuration is changed for this workaround.

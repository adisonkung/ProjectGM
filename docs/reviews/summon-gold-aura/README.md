# Gold-card aura — Desktop review, 22 November 2026

The user requested a smaller aura around moving gold summon cards while keeping it clearly visible.
The reference is the existing in-game dark-smoke/gold-flame treatment at `89e7c7e`; the change preserves
that treatment, card art, layout and reveal sequence. [Open paired images](index.html).

The old transparent aura plane was included in BokehPass's override-material depth render. Its full
rectangle therefore kept the background sharp even where the aura's own shader had zero alpha.
UV edge fading alone could not remove that rectangle. The aura now renders in a separate transparent
pass after depth of field and before bloom/grading, with a card-shaped transparent centre. This keeps
the flame detail clear without putting its quad into the depth image. The pass's geometry/materials
are included in the normal scene disposal.

The nominal quad changes from 1.75 × 2.4 to 1.5 × 2.1 card-width units (14.3% narrower / 12.5% shorter).
It follows the card's actual animated scale and rotation, including landing/flip, instead of remaining
a full-size camera-facing sheet. Smoke has a shorter falloff; inner gold flame/rim contrast increases.

## Evidence and limits

- `before-*` and `after-*`: actual 1280×720 game screenshots, isolated saves, real ×1/×10 confirmation,
  the same deterministic RNG and corresponding paused animation phases: moving, waiting and summary.
- `after-1-opened.png`: gold-card tap → character intro → tap to close → actual opened card/summary.
- `before-report.json` / `after-report.json`: runtime aura counts, transforms/depth participation,
  unchanged committed save during presentation/skip, and page/local-resource/shader errors.
- The QA script intercepts the development scene module only to suppress intermediate GPU draws.
  All scene/particle/DOM updates still run in 100 ms steps; screenshots render through the game's
  real shaders/postprocessing. This is paused visual inspection, not a native-speed video or FPS test.
- External Google Fonts requests are unavailable in this cloud environment and recorded separately.
  Both reference and actual use the same environment; local art and WebGL must load without errors.
- Desktop only under the user's current phase policy. No new Mobile work or gameplay/economy changes.

App/spec typechecks and full Karma **1026/1026** pass. Desktop browser scenarios pass for ×1 actual gold
opening and ×10 Skip; all1/10 auras are present, follow their cards and stay out of the depth render.
No extra transaction, page/local-resource/shader errors. The captured aura remains clearly visible
while the old rectangular sharp-background patch is absent.

Reproduce from the repository root with the dev server on port4200 and Playwright available:

```bash
AURA_CAPTURE=after node tools/dev/summon-aura-browser.cjs
```

`AURA_COUNTS=1` or `AURA_COUNTS=10` limits the capture. Baseline capture uses `AURA_CAPTURE=before`
on the unmodified source. The interception must match the development module or the script fails.

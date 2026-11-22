# Summon gate: larger left banners and steady framing

Desktop review, 23 November 2026 (Bangkok). The user requested wider/taller left pool banners,
slightly lower details, and a fix for the banner making the screen look as if it sways.

The reference is the current layout B game at `c6a9f0e`. [Paired reference/actual images](index.html)
retain the same art, dark/gold material, typography, dialogs, pity/actions and summon behavior.

Only a Desktop CSS override in `gacha.component.scss` changes:

- Pool rail width132→164px; thumbnail ratio2:1→7:4. The standard pool button grows from
  132×100.6 to164×127px (about24% wider /26% taller).
- Details move down with a static32–56px offset:43.2px at1280×720,54px at1600×900.
- The full-banner16s `key-breathe` scale/translation is disabled on Desktop. It previously moved
  the1280px viewport's image boundary from x204.8/y0 to x183.8/y−12.6 and enlarged it3%.
  The new framing has identical bounds at both ends of that animation cycle. The existing muted
  character video still plays; its internal hair/cloth/VFX movement is retained.
- The override applies above1000px wide and500px tall. Existing Mobile/short-landscape rules
  are preserved, following the user's Desktop-first phase.

`before-{1280,1600}.png` and `after-{1280,1600}.png` are actual game screenshots, not edited mockups.
The video is paused at1s and the old CSS motion at its0s phase for consistent art composition.
The before/after reports separately inspect the existing CSS animation at0/16s; these are visual
and geometric checks, not FPS measurements. External Google Fonts failures in this environment
are recorded separately; no local-resource or page errors occurred.

The isolated-save browser check covers both Desktop sizes, larger tabs/lower details, stable banner
bounds, no viewport overflow, banner/rates/pool/memory dialogs, the disabled event placeholder,
and single-summon cancellation without spending or changing the save. Reproduce with a dev server
on4200 and Playwright available:

```bash
BANNER_CAPTURE=after node tools/dev/summon-banner-browser.cjs
```

Baseline capture uses `BANNER_CAPTURE=before` on the unmodified source. See `before-report.json`
and `after-report.json` for the actual bounds and browser results.

Validation: app/spec typechecks, full Karma **1026/1026**, and both Desktop browser scenarios pass.

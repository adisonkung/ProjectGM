# Full-screen summon art and floating pool banners

Desktop review, 23 November 2026 (Bangkok). The user requested wider/shorter pool banners with
edge-to-edge images and bottom-right captions, a slightly wider selected banner, full-screen
background art, and smaller pool details just above the information buttons.

The reference is the preceding in-game revision at `2d249dd`, copied without editing from
`summon-banner-layout/after-*`. [Compare reference and actual game images](index.html).
The latest user directions intentionally change the earlier layout's proportions and placement.

| Desktop | Selected banner | Unselected banner | Main title | Details → information buttons |
| --- | --- | --- | --- | --- |
|1280×720|243.2×104px|227.2×104px|28.8px|16px|
|1600×900|288×104px|272×104px|32px|16px|

Both banners were164×127px in the reference. The selected banner now extends16px beyond the
other; `.active` drives this state without changing selection or enabling the unavailable event pool.
The standard pool's real image fills the complete tile; its caption is inset12px from the right
and9px from the bottom over a readability fade. The locked event placeholder remains unavailable
and does not invent event art/content.

The main art now spans x0/y0 through the viewport's entire width/height, with a softer left shade
instead of a reserved dark sidebar. Pool tiles float over that art. A two-column Desktop grid
anchors the smaller title/facts/name block immediately above rates/pool/Memory, independently
of the pity/actions at bottom right. The existing character video and steady framing are retained.
Existing Mobile/short-landscape styles and gameplay/preload/aura code are unchanged.

`before-*` / `after-*` are real game screenshots at the stated Desktop sizes. Video is paused at1s
for consistent composition; these are visual/layout evidence, not a native-speed/FPS benchmark.
The baseline reports/images come from the preceding verified revision. The new browser reports
record full-screen art bounds, selected/unselected widths, full-bleed image/caption bounds, reduced
text sizes, the16px detail/button gap, no overlap/overflow, and unchanged framing over the old
animation cycle. Banner/rates/pool/Memory dialogs, disabled event placeholder and summon-cancel
work with no transaction, page errors or failed local resources. External Google Fonts failures
are recorded separately in this environment.

Validation: app/spec typechecks, full Karma **1026/1026**, both Desktop browser scenarios,
and optimized production compilation/budgets pass. Production validation disables only external
font inlining through an Architect runtime override because Google Fonts is unavailable in this
cloud; no tracked build configuration changes. The existing style/CommonJS warnings remain;
the gacha component is23.30kB under its24kB maximum.

Reproduce with a dev server on4200 and Playwright available:

```bash
BANNER_LAYOUT=fullscreen node tools/dev/summon-banner-browser.cjs
```

Use `BANNER_CAPTURE=before` on the reference source to recapture the baseline if necessary.

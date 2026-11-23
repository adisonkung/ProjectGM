# Compact summon prices / gray single action

User follow-up: reduce page icon, quantity and black price box slightly; restore the gray left action. Task `fix/summon-price-sizing` continues `ef254d9` (ancient-page integration). Inventory/payment code and original page art are unchanged.

- Page icon37×39→30×32px; quantity20→18px.
- Black field45→38% of button width and48→44px tall; minimum internal gap8→7px, with page at the left and quantity at the right, both inset12px. Gate buttons remain76px high, with the original action typography and vertical divider.
- Left×1 uses the unfiltered original gray/silver atlas row and dark label. Right×10 stays orange-gold. Repeat retains its lavender tone for both counts, now reduced410×76→370×68px with a34%-width,40px-high black field and4px vertical/12px horizontal padding. Its30×32px icon,18px amount and21px action label are retained.

Reference: [original gray/orange controls](../summon-classic-controls/buttons-1280.png). Previous actual UI: [33×35px icon before latest reduction](before-smaller-paper.png). Current actual: [detail](gate-buttons-10.png), [1280×720 gate](gate-10.png), [1600×900 gate](gate-1600.png), [single result](summary-1.png), [ten result](summary-10.png), [repeat detail](repeat-button-10.png). [Paired reference/native review](index.html); [measured report](browser-report.json). All actual screenshots are native captures, not generated or retouched. Scene frame control is only for inspection, not an FPS claim.

Reproduce with the development server and `NODE_PATH=<Playwright install> node tools/dev/summon-pages-browser.cjs`; optional SUMMON_URL. Isolated Desktop saves only; no Mobile work, master merge or deployment.

Validation: app/spec typechecks and full Karma1028/1028 pass. Optimized build and unchanged budgets pass with the same external no-font-inline Architect override for the known Google Fonts403; tracked config is unchanged. Native single/ten cases assert exact30×32px icons,18px amounts,44px/38% gate fields,370×68px Repeat with40px/34% field, and exact12px left/right content insets, silver/orange skins, containment/divider and centred lavender Repeat. Paid-mode pulls deduct once, preserve gems/other page balances, and Repeat→Cancel preserves the committed save. No page errors or missing local resources. Existing free-test runtime flag is unchanged.

Latest repeat-size reference: [before button](before-repeat-resize.png) / [before full summary](before-repeat-summary.png); current [repeat button](repeat-button-10.png) / [summary](summary-10.png). Original action stays centred at the same bottom22px inset.

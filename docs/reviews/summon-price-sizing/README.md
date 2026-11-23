# Compact summon prices / gray single action

User follow-up: reduce page icon, quantity and black price box slightly; restore the gray left action. Task `fix/summon-price-sizing` continues `ef254d9` (ancient-page integration). Inventory/payment code and original page art are unchanged.

- Page icon37×39→33×35px; quantity20→18px.
- Black field45→43% of button width and48→44px tall; internal gap8→7px. Outer button remains76px high, with the original action typography and vertical divider.
- Left×1 uses the unfiltered original gray/silver atlas row and dark label. Right×10 stays orange-gold. Repeat retains its lavender tone for both counts, with the shared smaller price layout.

Reference: [original gray/orange controls](../summon-classic-controls/buttons-1280.png). Previous actual UI: [larger prices / two orange buttons](../summon-ancient-pages/gate-buttons-10.png). Current actual: [detail](gate-buttons-10.png), [1280×720 gate](gate-10.png), [1600×900 gate](gate-1600.png), [single result](summary-1.png), [ten result](summary-10.png), [repeat detail](repeat-button-10.png). [Paired reference/native review](index.html); [measured report](browser-report.json). All actual screenshots are native captures, not generated or retouched. Scene frame control is only for inspection, not an FPS claim.

Reproduce with the development server and `NODE_PATH=<Playwright install> node tools/dev/summon-pages-browser.cjs`; optional SUMMON_URL. Isolated Desktop saves only; no Mobile work, master merge or deployment.

Validation: app/spec typechecks and full Karma1028/1028 pass. Optimized build and unchanged budgets pass with the same external no-font-inline Architect override for the known Google Fonts403; tracked config is unchanged. Native single/ten cases assert exact33×35px icons,18px amounts,44px fields/43% basis, silver/orange skins, containment/divider and centred lavender Repeat. Paid-mode pulls deduct once, preserve gems/other page balances, and Repeat→Cancel preserves the committed save. No page errors or missing local resources. Existing free-test runtime flag is unchanged.

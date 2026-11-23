# Ancient summoning pages / orange gate review

Requested: install the selected flat loose-page artwork, with dark silver / antique gold / saturated rainbow corners, and restore the orange summon-page buttons. This task continues the existing unmerged seal-controls work on `fix/summon-ancient-pages`.

- Original reference: [approved generated sheet](../../../assets/ui/summon-pages/pages-source.png). Exact source SHA256 `965db1f7c4c7798ec55fffb454edda10d2cf0c14beef017b3a7d9716e5d5f9d7`; generation output and copied source match byte-for-byte. Alpha bounds plus12px padding and mechanical WebP scaling only. All corners/edges preserved.
- Orange skin reference: [previous approved controls](../summon-classic-controls/buttons-1280.png). The unchanged atlas's orange row is now used for BOTH gate counts, as requested; old reference has silver for×1. Quantity is now the existing page×1/×10 cost, not the earlier gem100/900.
- Native game: [1280×720 gate](gate-10.png), [1600×900 gate](gate-1600.png), [button detail](gate-buttons-10.png), [rates](rates-10.png), [confirmation](confirm-10.png), [single summary](summary-1.png), [ten summary](summary-10.png), [repeat detail](repeat-button-10.png). Native screenshots are unretouched; frame control pauses the existing scene for inspection and is not an FPS claim.
- [Reference/native paired page](index.html), [measured browser report](browser-report.json).

Integration: all three page variants are registered and served; standard pool alone uses standard pages. Inventory IDs and balances remain intact. Display names are หน้าตำราดารา / หน้าตำราทอง / หน้าตำราออโรรา and unitsแผ่น. Existing black price area, divider, geometry, typography and lavender result repeat are retained. No new pool, rate change, grants, conversions, save migration, Mobile work, merge or deployment.

Validation: app/spec typechecks pass. Full Karma1028/1028 passes. Both actual paid-mode pulls debit exactly1/10 standard items, preserve gems/other items and only request confirmation on Repeat; cancelling it leaves the committed save unchanged. All gate/repeat icons and amounts fit inside the price field; divider separates it from the label. Gate skins are unfiltered original orange in both counts. No page errors or missing local resources. Normal runtime still retains the existing authorized free-test flag; paid mode is exercised only on isolated browser saves.

Plain `npm run build` is blocked by the existing external Google Fonts403. An external untracked Architect override disables only font inlining; optimized scripts/styles and original budgets pass, with existing size/CommonJS warnings. Tracked build configuration is unchanged.

Reproduce: `python3 tools/ui/export_summon_pages.py`; run development server, then `NODE_PATH=<playwright installation> node tools/dev/summon-pages-browser.cjs` (optional `SUMMON_URL`). Uses Chromium and disposable saves.

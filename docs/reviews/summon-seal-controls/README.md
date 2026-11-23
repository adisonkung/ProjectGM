# Summon seals and unified action buttons — 2026-11-23

User selected the centered-bottom focus layout, moved Back to the top left, and requested the supplied silver/gold rectangular skin in different colours. Currency art and quantity must both fit inside a wider black cost rectangle, with a vertical separator before the summon label. After considering paper tickets, the user requested Eldervane rune stones in blue/silver, gold and purple/pink rainbow. The user explicitly selected one unit per single pull and ten units per ten-pull.

## Design and actual game

- Main gate: [1280×720](gate-10.png) · [button detail](gate-buttons-10.png)
- Results: [single](summary-1.png) · [ten-pull](summary-10.png)
- Repeat detail: [single](repeat-button-1.png) · [ten-pull](repeat-button-10.png)
- [Actual geometry and transactions](browser-report.json)
- Selected layout reference: in-conversation `summon-anime-buttons.html`, variant “โฟกัสปุ่มเดียว”; skin reference: supplied gold900/×10 screenshot. Original matching skin artwork is retained in assets/ui/summon-classic/buttons-source.png.

SummonButtonComponent owns the identical live cost/label template for both routes. The original skin receives presentation-only colour filters: silver single, cyan multi and lavender repeat. Both the icon and×1/×10 fit within the black field; its width grows from the previous approximately101px at291px button width to131px. A separate vertical separator divides price from action. Text uses the clean local Noto Sans Thai of the chosen modern-gacha direction. Repeat is centered at the bottom; Back sits at24px/16px in the upper left. This is the chosen focus layout with the subsequently supplied metal-frame skin, not the earlier minimalist white button.

Images are unretouched actual Angular/three.js game frames, not generated/composited game screenshots. Raw stone art and delivery/source manifests are under assets/ui/summon-seals. All three colours are original generated inventory art. Gold and aurora are prepared for future use; no special pool has been enabled.

## Payment and compatibility

Standard pool now requests1/10 `astral_summon_seal` items through the existing pure pull rule's new optional itemCost. Gems, other seal types, rates, pity and rewards are preserved. The legacy default gem-priced helper remains for existing callers/sims. Missing item counts are zero; insufficient funds return null before mutation. No save version change or implicit grants/conversions are added: the existing inventory record supports these registered IDs.

The existing user-requested `DEV_FLAGS.freeSummons` stays enabled; while it is on, both wallets remain unchanged and nominal1/10 costs remain visible. Confirmation/rates copy uses the new resource. Under paid mode, page affordability, confirm debit and repeat affordability all use standard seals. The repeat action opens the usual same-count confirmation without spending again. The two reserved seal colours are never spent by standard pulls.

## Verification

App/spec typechecks, Karma1028/1028 and optimized production compilation/budgets pass. Production validation uses the existing untracked Architect override disabling external-font inlining due to this environment's Google Fonts403; tracked build config is unchanged. New service coverage checks zero-gem funded pulls, absent balances, failed-payment immutability, exact ten-seal debit and preservation of gems/gold/aurora. Existing confirmation/double-click/pending-readiness cases now cover seal balances.

`tools/dev/summon-seal-controls-browser.cjs` runs the actual Desktop game at1280×720 with paid mode and explicit stock in isolated test saves. Single/ten cases assert all price content stays inside the black box, divider order, repeat bottom-center, Back upper-left, exact one-time1/10 spending, unchanged gems/other seals, and repeat→confirmation→cancel with no further transaction. No page/local-resource errors. External font requests are reported separately. Native scene RAF is advanced in100ms steps for final-frame capture, and finite CSS entry animations finish normally; these are presentation checks, not native-speed/FPS measurements. No dedicated Mobile work or new master merge/deployment.

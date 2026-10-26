# Forge review — 24 Oct 2026

User accepted the widened2×2 Armory layout and asked for the next page. Continue Forge craft/enhance/salvage on fix/codex-forge-review from3ee6fca. No deployment authorized.

Read the existing design archive and opened sheet06 (sheet05 craft reference was opened in the preceding Armory work). Preserve actual equipment registry/rules, three functional slot categories, real material costs, limits and yields. Relic remains the noninteractive future preview on Armory; no Relic craft/equipment rules are added.

Changes:

- Framed material summary beside the title, with real gold/ore/fragments; stacked on mobile. Shared Home lacquer tabs and controls retain the approved material.
- Craft rarity choices use two roomy columns and shallow cut panels; base/stat/action controls have no rectangular backing competing with the gold contours. Original equipment preview, recipe options and costs are retained.
- Enhance selection becomes a card grid with one large accessible button per actual item. The art/name/stats are inside the same target, selected lacquer matches Home, and the existing live current/next/cost panel remains on the right (below on phones).
- Salvage rows receive continuous cut-gold frames, larger real-item details, padded lock control and a crimson action. Native confirmation still shows the actual single item's dismantle rewards. The reference's unsupported bulk-selection system or illustrated gold rewards are not invented.
- Feedback messages use the same frame; empty/insufficient-material/locked states remain real. No equipment service, save, economy or balance changes.

Validation: app/spec typechecks, Karma809/809, production build with unchanged warning/error budgets, and actual Chromium15 tab/viewport cases (320/390/768/1024/1586). Real craft, upgrade resource use, filter fallback, lock blocking dismantle, cancel preserving save, confirmed dismantle/yields, keyboard tabs and initial empty/insufficient states are exercised. Screenshots use disposable starter/progression fixtures backed by existing registry/rules. Evidence/scripts under ignored work/forge-review.

Armory is visually accepted. Forge now awaits user review; no production/runtime ref update or deployment.

Latest Forge screenshots: https://github.com/adisonkung/ProjectGM/blob/403719459b9f15e9c1a20c8e84f98cebce328d14/docs/review-images/2026-10-24-forge/README.md . All15 files verifiedHTTP200/hash; docs-only unattached snapshot. No deployment; user review pending.

## Random crafting and selectable batch salvage (user requested)

User explicitly asked to remove the base/wielder ('ทุกสาย') and main-stat selectors and show random crafting, then asked for checkboxes, multi-item salvage and selectable salvage-all. This changes the player-facing crafting behavior, not merely the wording:

- UI retains rarity and functional equipment-slot selection. `craftRandom` uniformly picks an existing base in that slot, then a legal main stat, and delegates to the existing craft/roll/cost rules. It checks affordability before RNG; costs, rarity tables and item values are unchanged. The illustrated base is labeled as an example; the actual rolled item/stats appear after crafting. The older explicit-base pure helper/API remains for existing callers/tests.
- Salvage has native per-item/select-all/indeterminate checkboxes. Locked items are disabled and excluded. Locking an item clears its selection. The summary aggregates actual `dismantleRewards` and shows selected count before a single confirmation.
- `dismantleMany` deduplicates ids and computes an immutable result; if any selected item is missing, locked or equipped, it returns an error and EquipmentService does not commit any partial result. One valid batch applies through one save update. Confirming clears selection; cancelling changes no save and keeps the user's selection.
- No bulk gold payout is invented. Rewards remain the same ore/fragments/refund per item. Relic remains unavailable; no item registry/save-schema/balance-number changes.

Validation: app/spec typechecks, production build,812/812 tests including legal random base/main variation, exact single charge, no RNG on insufficient resources, deduplicated rewards, locked/missing/equipped atomic failure and UI eligible selection/cancel. Actual browser checks10 route/viewport cases plus random craft, partial/indeterminate selection, select-all exclusion of locks, cancellation and confirmed batch preserving the locked item. Screenshots and report under work/forge-random. No deployment.

Random craft / bulk salvage review: https://github.com/adisonkung/ProjectGM/blob/69e83fc11dc712b0c254fccb46fb68250fb6c065/docs/review-images/2026-10-24-forge-random-bulk/README.md . All14 files verifiedHTTP200/hash. No deployment; user review pending.

User outcome (24 Oct2026): “ยืนยัน หน้าต่อไปเลย” — Forge random craft and bulk salvage approved visually; continue Tower. This is not deployment authorization.

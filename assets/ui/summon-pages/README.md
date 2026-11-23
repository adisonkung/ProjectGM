# Ancient summoning pages

User-approved replacement for the stone art (2026-11-23): one loose ancient page, no rolled spine, with distinct dark-silver, antique-gold and saturated aurora edges/corners. `pages-source.png` is the exact unmodified generated sheet, copied from `exec-7ed2cd6f-b477-410e-a8d6-2ee0f3737ce1.png`.

Export with `python3 tools/ui/export_summon_pages.py`. The three horizontal cells are measured at alpha ≥8, padded by12px, cropped and scaled to512px height as WebP quality88. No painting, recolouring, masking or invented corners; the full folded corners and outer borders are retained. `exports.json` records source size/crops/runtime URLs.

Runtime images: `/ui/summon-pages/{standard,gold,aurora}.webp`, selected through `core/data/summon-seals.ts`. Names are หน้าตำราดารา, หน้าตำราทอง and หน้าตำราออโรรา. Existing `astral_summon_seal`, `golden_summon_seal`, `aurora_summon_seal` IDs and the `SUMMON_SEAL` kind are intentionally stable: this is an art/display-name replacement, so inventory balances do not require migration. Only the standard pool exists/spends standard pages at1/10; no pools, grants, conversions, rates or payment rules were added.

The prior stone source/deliveries remain under `assets/ui/summon-seals` and `public/ui/summon-seals` as superseded art. The current gate uses the original gray/silver skin for×1 and orange-gold skin for×10 (follow-up user refinement). Its price icon is30×32px, amount18px and black field38% wide by44px tall, with page/quantity at opposite ends and12px horizontal padding. The outer button geometry, divider and action typography are retained. Result Repeat retains lavender, with a370×68px button and a34%-width,40px-high cost field (4px vertical/12px horizontal padding).

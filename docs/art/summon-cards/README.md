# Summon card backs — 25 October 2026 (Asia/Bangkok)

User explicitly requested regenerated card art and natural flight, then ordinary 1★/2★ backs. All three new assets are pending visual review, not deployment. Material icon art is still deferred.

| Existing hero star | New asset under public/ui/eldervane | Art direction |
|---|---|---|
| 1★ | summon-card-common.webp | Plain matte steel/silver, dark blue paper/leather, small central star |
| 2★ | summon-card-uncommon.webp | Restrained aged bronze, simple star/circle and thin border |
| 3★ | summon-card-celestial.webp | Antique gold, celestial ring, ice-blue crystal and small tower motif |

Generated with image_gen, transparent exterior, opaque-looking face (the generated PNG interior alpha is near255). Runtime copies are640px WebP quality94, alphaQuality100. Original generated PNGs remain unchanged in `/workspace/generated_images/` for this workspace; manifest records source and optimized hashes. No programmatic background removal, recoloring or hero art editing. Original old JPGs remain in the repository.

`pages/gacha/summon-card-art.ts` selects art by existing numeric star, shared by physical flight and sealed-card grid. No new rarity, hero template, pool, rate or save schema. Current roster is all3★ and retains the documented empty-tier fallback; 1★/2★ files are renderer art previews, not evidence that these heroes were added or pulled.

Flight lighting and motion belong to the runtime component: clean alpha shape, moving foil masked by the same texture, depth/perspective, smooth sampled trajectories, directional wakes and floor light. The image alone does not provide motion or a rigid-body simulation. See `docs/SUMMON_REFERENCE_REVIEW.md` for the current review.

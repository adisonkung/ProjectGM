# Eldervane — Gilded Ember UI + VFX

15 original generated assets, inspired by the refined gacha item rendering of Genshin Impact / Honkai: Star Rail.

- 10 square icons: 1024 × 1024, PNG alpha.
- divider.png: 2048 × 256, PNG alpha.
- 4 VFX sheets: 2048 × 1536, 4 columns × 3 rows, 512 × 512 per frame, opaque black for additive blending.
- Read frames left to right, top to bottom. Frame 12 is fully black.
- Open preview.html in a browser to review icons and animated VFX. Suggested starting playback: 12 fps (1 second).

## Preparation

Original artwork was created with image generation. Technical preparation resized images, added transparent icon margins, cropped empty divider margins and standardized final VFX frames to black. Source artwork is unchanged in the original generated images.

## Integration notes

Use the names in manifest.json. For the workflow in the supplied spec, place PNGs under assets/ui/gilded/ and generate the runtime WebP files separately. Review at 24/32/64 px before final approval. Star variants were edited from the same reference; pixel-identical silhouettes and visual centers still require checking in the game. Pivot values in the manifest are suggestions, not verified runtime anchors. Do not auto-trim each animation frame independently. Use additive/screen blending for VFX. These files have not been integrated or tested in the game. No game code or WebP runtime assets are included.

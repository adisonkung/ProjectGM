# Full-screen forest map sources

The user's ZIP `iloveimg-compressed (16).zip` contains these three original 1672×941 PNGs. Copies here preserve every uploaded byte; SHA-256 hashes are in manifest.json. Runtime images in public/backgrounds use lossless WebP; RGB pixels were verified identical to the supplied PNGs.

- forest-1.png: Sunlit Pixel Meadow and Sakura Forest (1).png
- twilight-1.png: Eldervane Twilight Forest Battle Clearing.png
- misty-1.png: Pixel-art forest ruin battlefield.png

To re-export one map without altering its pixels:

```python
from PIL import Image
Image.open('assets/backgrounds/fullscreen-2026-11-18/forest-1.png').save('public/backgrounds/forest-1.webp', 'WEBP', lossless=True, method=6)
```

These are single authored scenes, not horizontally tiled/parallax assets. The current stage-to-background mapping is retained (forest floors 1–3, twilight 4–7, misty 8–10). See docs/reviews/fullscreen-maps for actual-game evidence.

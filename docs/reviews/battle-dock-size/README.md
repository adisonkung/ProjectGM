# Larger battle hero cards

User follow-up to the map preview: enlarge the bottom hero card frames to use the free strip beneath the lanes. Same review branch `fix/fullscreen-map-art`; no master merge/deployment.

[Previous reference and updated game, side by side](comparison.html). Both sides are actual game captures with the same viewport/starter party, paused immediately after starting floor 1. Desktop: 1440×860; landscape phone: 844×390.

The full-screen party row now spans the safe viewport width. Its `.bar.compact` opts out of the generic menu `.bar` 75% zoom and fits the existing dock height. Desktop cards increase from about 164×87 to 243×126 px. Mobile cards use portrait/name/skills in two columns within the short bottom strip; card width is about 148 px. Existing terrain/grid geometry is unchanged. The controls remain below all three combat lanes; safe-area insets and existing reduced-motion behavior are retained.

[Measured bounds and browser page errors](report.json). Both viewport checks verify the dock/card tops stay beneath the lane boundary and card bottoms stay inside the viewport. No gameplay, save or control event handling changes.

Validation: app/spec typechecks and 1004/1004 Karma specs pass. No new tests were needed for these size/layout-only CSS changes.

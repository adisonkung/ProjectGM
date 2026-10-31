# Jade pounce landing and actual damage cells

Actual running-game capture, desktop1440×900 and landscape mobile932×430. Diagnostic SVG overlays only; gameplay and native art/effects are unchanged.

- Red: all board cells whose Chebyshev distance from Jade's occupied body is at most2, matching the actual pounce BODY/RADIUS_2 damage resolver. This is wider than the visible circular landing art.
- Orange: the committed4×2 landing reservation.
- Green O cell: the lower-right logical landing anchor. The current actor art is one cell forward of O.
- Hero labels:1BL,2YZ,3MY,4TX,5LX. Their existing colored1×1 boxes remain visible.

[Desktop](desktop-jade-landing-damage.png) · [Mobile](mobile-jade-landing-damage.png).

The fixture uses native shipped heroes with HP5000/lowATK/manual skills, only Jade pounce enabled. The archer is placed at row2/column7 via the actual engine relocation method to make the committed landing clear. This is a controlled review battle, not a balance example. Verification JSON records original boss anchor, committed warning cell, landing footprint, marked damage cells and actual release targets. No product code changed and no image generation or compositing was used.

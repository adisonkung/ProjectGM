# Bai Long: separately generated natural VFX

Replaces the rejected geometric rings, SVG lines, CSS droplets and generic sweep/rays on Bai Long with two separately generated transparent textures: water wake/mist and sparse foam/spray. Both layers sit behind the unchanged portrait/frame/italic lettering, move by small different translations and fade independently. No circles, regular vector outlines or scaled ellipse effects remain. Other heroes retain their effects. Reduced motion hides both layers. Team loading preloads the generated textures before combat.

PNG sources and hashes/dimensions: assets/ui/cutins/bailong-water-layers.json. Lossless WebP runtime exports: public/ui/cutins/bailong-water-{wake,spray}.webp. Re-export all Bai Long cut-in assets using tools/ui/export_bailong_cutin.py. Original art and font source/runtime hashes are unchanged.

Five real manual-cast browser checks: Bai Long desktop 1440x860, phone 844x390, phone reduced-motion, plus two Yue Zheng regression cases. Screenshots pause CSS at 400 ms for consistent inspection. Native recorded clips run at normal speed with no image-generation/composited game frames. Before/after page links the previous real game recording and screenshots, clearly distinguished from the new frames. Art below is generated VFX source, not a gameplay screenshot.

Validation: app/spec typechecks, Karma 1005/1005, no page errors/overflow, both layer images decode before inspection, no duplicate live lettering, reduced motion hides new FX, overlay cleanup after two native manual-cast recordings. Gameplay timing/damage unchanged. No master merge or deployment.

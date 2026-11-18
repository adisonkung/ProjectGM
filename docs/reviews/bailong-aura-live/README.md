# Bai Long: actual imported aura cut-in

The selected premium readable Thai type is now lightly italic. New generated cut-in art contains only the isolated character/frame/water aura, with real alpha and correct ไป๋หลง / ลำดับเก้ามังกร lettering. Source and runtime hash/dimensions are recorded in assets/ui/cutins/bailong-aura-italic.json. Re-export losslessly with tools/ui/export_bailong_cutin.py.

Runtime VFX: three expanding aura rings, two animated current strokes, a moving gold edge glint, and twelve drifting droplets. Existing sweep/rays avoid the text panel. Reduced motion hides all new water motion. Top-left anchor, .9 scale, actual engine/skill timing and damage stay intact. Only Bai Long's art/VFX changed; the other heroes keep the committed implementation.

Actual desktop 1440x860 and landscape phone 844x390 frames are captured after real manual ult clicks. Inspection screenshots pause CSS animation at 400 ms and pause combat to keep a consistent comparison. Videos are native browser recordings at normal speed with no animation freezing, image generation or composited game frames. The earlier generated concept is clearly labeled; its separate battlefield wave is not a new gameplay effect in this change. Actual combat uses the existing hero sprites/skill FX, so it differs from the illustrative mockup.

The rejected screenshot-extraction experiment is archived outside the repository, not shipped. No master merge/deployment.

Validation: app/spec typechecks, Karma 1005/1005, production compilation (temporary font-inlining bypass; config restored), five browser cases, two native recordings. No page errors, overflow or overlay cleanup failures.

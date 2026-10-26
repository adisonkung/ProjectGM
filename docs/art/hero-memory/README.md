# Hero Memory — Bai Long illustration

2026-10-25 · ผู้ใช้ขอgenภาพการ์ดความทรงจำ/คริสตัลฟ้า/แท่นทองตามตัวอย่าง แล้วระบุให้ตัวละครเป็นฮีโร่ในเกมและนำไปแทนในหน้าจอ

- Runtime: `public/ui/eldervane/hero-memory-bailong.webp` · 960×1200 WebP quality94
- Imagegen output: `/workspace/generated_images/exec-04665251-f0b6-481c-9d40-e853676503da.png` (ต้นฉบับคงเดิม)
- Composition reference: ภาพgenรอบก่อน `/workspace/generated_images/exec-8192c22a-0283-4202-bf0c-e470f1a5ac99.png`
- Character references: `public/portraits/bailong.webp` + `public/banners/bailong.webp` อ่านจากHERO_ART/HEROESจริง และเปิดดูภาพทั้งคู่ก่อนeditด้วยimage_gen
- เปลี่ยนตัวละครในการ์ดจากหนุ่มgenericรอบก่อนเป็นไป๋หลงตามreference:ใบหน้าจริงที่เคร่งขึ้น มัดผมสูงพร้อมเครื่องประดับน้ำเงินทอง ชุดนักรบขาว/คอเสื้อน้ำเงิน/ลายทอง หอกเงินด้ามดำพร้อมส่วนพันน้ำเงิน และมังกรขาว

เป็นภาพประกอบinformationpanel ไม่ใช่การเปลี่ยนportrait/banner/sprite/rarity/ตัวละครในregistry ภาพฮีโร่ต้นฉบับไม่ถูกเขียนทับ ภาพeditเป็นimage-guided generation ไม่อ้างว่าเป็นpixel-identical pasteจากportrait การปรับไฟล์หลังgenมีเพียงresize/encodeWebP ไม่crop/recolor/compositeภาพด้วยscript

`manifest.json` เก็บhashต้นฉบับ/asset/reference อาร์ตใหม่ใช้เฉพาะช่องHero Memoryแทนcardback+portrait+SVGprismsเดิม มือถือเพิ่มความสูงภาพ320pxและล้างmask/max-heightเดิมเพื่อไม่ให้ภาพจางหรือเหลือช่องว่าง ไม่แก้materialinventoryiconsหรือbacklog21รายการ และไม่เปลี่ยนแอนิเมชันการ์ดบิน

Source local branch fix/codex-hero-memory-art, no Deploy. เผยแพร่หลักฐานreviewเป็นnative screenshots/index/validation ไม่ใช่runtimeasset/source patchหรือref update

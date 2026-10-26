# Eldervane — ตรวจ UI ทุกหน้า (24 ต.ค. 2026)

ผู้ใช้ให้ไล่ปรับทุกหน้าต่อเนื่อง และรวบรวมภาพเพื่อตรวจครั้งเดียว **ยังไม่ Deploy ชุดนี้**

ชุดภาพและเช็กลิสต์: [เปิดรีวิวทั้ง 8 หมวด](https://github.com/adisonkung/ProjectGM/blob/c10c56ca5b71dfbdedc4b04fc4980f054544d255/docs/review-images/2026-10-24-all-pages/README.md) — PDF คอม/มือถือ, ZIP ภาพแยก, manifest, ผลตรวจ และ patch ซอร์ส เท่านั้น ไม่มีการอัปเดต branch ref

## สถานะที่ผู้ใช้ตรวจแล้ว

| หน้า | ผลตรวจจากผู้ใช้ | Production |
|---|---|---|
| ห้องทดลอง /lab และ /sprite-lab | ให้ทำหน้าถัดไปหลังชุด Labs พร้อมทุกคนเป็นGMชั่วคราว | ยังไม่เผยแพร่ |
| หน้าต่างบนเกาะ: อาคาร/ล็อก/ฮีโร่/ธีม | ผู้ใช้โอเคชุด9b08155แล้วให้ทำหน้าถัดไป | ยังไม่เผยแพร่ |
| รายการ/empty/error +กรอบและพื้นหลังกระเป๋า | ผู้ใช้ให้ทำต่อหลังชุด57b634d | ยังไม่เผยแพร่ |
| หน้าหลัก /home | อนุมัติหัวเมนู โลโก้ รอยต่อทอง และทีมมุมล่าง | เผยแพร่แล้วจาก PR #9 |
| รายการฮีโร่ /heroes | อนุมัติการ์ดคอมแถวละ 5 | ยังไม่เผยแพร่ |
| ภาพรวมฮีโร่ /heroes/:uid | เลือกโปสเตอร์ A และขอเพิ่มความชัดของตัวอักษร จากนั้นให้ทำหน้าถัดไป | ยังไม่เผยแพร่ |
| จัดทัพ /team | อนุมัติสนามกระชับ ระยะปุ่ม A/B/C และกรอบทองตัดมุม แล้วให้ทำหน้าถัดไป | ยังไม่เผยแพร่ |
| คลังอุปกรณ์ /armory | อนุมัติฝั่งซ้าย460px และ2×2 รวมช่องตัวอย่าง Relic ที่ยังไม่เปิดใช้ | ยังไม่เผยแพร่ |
| โรงตีเหล็ก /forge | ยืนยันการคราฟต์สุ่มและติ๊กย่อยหลายชิ้น/เลือกทั้งหมด แล้วให้ทำหน้าถัดไป | ยังไม่เผยแพร่ |
| หอคอย /tower | อนุมัติรอบพรีเมียม แสง รายการชั้นและปุ่มตามRefล่าสุด แล้วให้ทำหน้าถัดไป | ยังไม่เผยแพร่ |
| ดันเจี้ยน /dungeons/* | อนุมัติรอบขอบทองเข้มและรายการ material ชั่วคราว แล้วให้ทำหน้าถัดไป | ยังไม่เผยแพร่ |
| อัญเชิญ /gacha | ผู้ใช้เลือกใช้แบบล่าสุดไปก่อน และให้ทำหน้าถัดไป | ยังไม่เผยแพร่ |
| Hero Detail: Stats/Skills/Gear/Growth | ผู้ใช้ให้ต่อหน้าถัดไปหลังชุดรีวิว 25 ต.ค. | ยังไม่เผยแพร่ |
| ต่อสู้ /battle | ผู้ใช้ให้ทำหน้าถัดไปหลังแก้ชัยชนะชุด62b6187 (ตรา/เงา/ริบบอนในกรอบ) | ยังไม่เผยแพร่ |
| เริ่มเกม/บัญชี/ย้ายเซฟ | ผู้ใช้ให้ต่อหน้าถัดไปหลังชุด8fe59a1 | ยังไม่เผยแพร่ |

ผู้ใช้ให้ทำหน้าถัดไปหลังชุด Hero Detail panels (25 ต.ค.) จึงบันทึกว่าผ่านรอบนี้ แต่ยังไม่อนุมัติ Deploy การทดสอบอัตโนมัติไม่ถือว่าเป็นการอนุมัติจากผู้ใช้

## หน้าที่ยังรอผู้ใช้ตรวจ

- หน้าต่างข้อมูลกาชาแยกหัวข้อ: รายชื่อฮีโร่ในตู้ / อัตราและเงื่อนไข / Hero Memory (รีวิวภาพ17รอบละเอียดล่าสุด)

เส้นทาง /island, /lobby และ /dungeons เป็นทางเข้า/redirect ของหน้าข้างต้น ไม่ใช่หน้า UI เพิ่ม ส่วน /battle และ /lab ใช้ component ร่วมกัน แต่ตรวจทั้งโหมดเล่นจริงและ sandbox

## สิ่งที่เปลี่ยน

อ่าน README และภาพใน `docs/design/eldervane-ui/` ก่อนปรับ ใช้ภาพต้นฉบับฮีโร่/เกาะและข้อมูลจาก registry ปัจจุบันต่อไป ภาพแบบมีตัวเลข รูปฮีโร่ และเงื่อนไขระบบที่ไม่ตรงเกมจริง จึงเทียบภาษาในการจัดวาง วัสดุ ขอบ มุม สี และความชัด โดยไม่คัดลอกข้อมูลสมมติจากภาพ

- หัวเมนู 6 รายการ/โลโก้ champagne/กรอบทรัพยากร ใช้ชุด Home ที่ตรวจแล้วกับทุกหน้าของเกม ปุ่มทองมีรอยตัดและขอบต่อเนื่อง ปุ่มหลัก/แท็บที่เลือกใช้แดง lacquer เดียวกัน
- `CitadelFrameComponent` เป็นวัสดุร่วมแบบ SVG รองรับขนาดจริง ปุ่มและ panel ใน template ใช้กรอบนี้อย่างชัดเจน ไม่สร้างภาพ UI ปลอมมาทับฟังก์ชันจริง
- `_citadel-material.scss` แทนพื้นหลัง/ขอบแบบเดิมภายใน component ที่เปลี่ยน; `_citadel-pages.scss` เก็บการจัดวางและวัสดุของแต่ละระบบร่วมกัน แยกจาก CSS ของรายละเอียดฮีโร่ที่ใกล้เพดาน bundle
- รายละเอียดฮีโร่คงโปสเตอร์ A; ปรับการ์ดสกิล/ข้อมูลพัฒนา และช่องอุปกรณ์แสดงภาพตาม `definitionId` จริง
- จัดทัพคง 18 ช่องและตำแหน่งจริง ปรับกรอบรายชื่อ ทีมที่บันทึก ตัวกรอง และปุ่ม บนมือถือใช้ชื่อทีมเหนือปุ่มบันทึก/แก้ชื่อ
- คลังใช้ภาพฮีโร่ ช่องอุปกรณ์ และกระเป๋าจริง เพิ่มยืนยันขายพร้อมราคาจาก `SELL_GOLD` ก่อนเรียก service เดิม
- โรงตีเหล็กเพิ่มการเลือกดูอุปกรณ์ตีบวกในแผงขวา แสดงค่าปัจจุบัน/ถัดไปจาก `itemLines` และเพดานเดิม ตัวกรองที่ซ่อนของที่เลือกจะเลือกของชิ้นแรกที่ยังตรงตัวกรอง หรือแสดงว่าง เพิ่มยืนยันย่อยพร้อมผลจาก `dismantleRewards`
- หอคอย/ดันเจี้ยนรักษาระดับ รางวัล เงื่อนไขล็อก โบนัสรายวันและเป้าหมาย Hunt เดิมทั้งหมด
- อัญเชิญปรับทั้งหน้าหลัก ข้อมูล/ยืนยัน ฉาก/ไพ่/เปิดตัว และผลรวม ราคา อัตรา pity และโหมดอัญเชิญฟรีทดสอบที่มีอยู่เดิมยังแสดงตามค่าจริง
- บัญชี/เริ่มเกมยังใช้การตั้งชื่อและการนำเข้า/ส่งออกเดิม ปรับกรอบ ลำดับข้อมูล ช่องกรอก ปุ่ม และ error/preview
- ต่อสู้ปรับ HUD/ปุ่ม/หน้าต่างและวัสดุการ์ดทีม ตัวเลือกสลับ renderer อยู่ในโหมด lab; หน้าหยุดต่อสู้ปกติเหลือการกระทำสำหรับผู้เล่น สนามยังเป็น 5×16 และแถบ scenery 2 แถว
- ห้องทดสอบท่าคำนวณขนาดช่องจาก container และกำหนดให้ host ของ board ใช้ขนาดเดียวกัน ป้องกันสนามล้นที่จอแท็บเล็ต โดยไม่เปลี่ยนพิกัดหรือข้อมูลแอนิเมชัน
- หน้าต่างเหตุการณ์บนเกาะและปุ่มปิดใช้กรอบร่วม ส่วน layout หน้าหลักที่อนุมัติคงเดิม

ไม่มีการแก้ engine, balance, เนื้อหา registry, sprite sheet, เศรษฐกิจ หรือรูปแบบ save

## หลักฐานและวิธีอ่านภาพ

ภาพในชุดรีวิวเป็น screenshot ของ production build ที่รันใน Chromium ไม่ใช่ภาพออกแบบจาก image generation มีภาพคอมและมือถือ รวมทั้งภาพเลื่อนลงถึงส่วนล่างแยกไว้ เพราะการจับ full-page บนมือถือทำให้พื้นหลัง fixed และ dock ผิดตำแหน่ง

- ภาพสถานะเริ่มต้นใช้ 7 ฮีโร่จริง/ทีม 5 คน/เพชร 1,500/ทอง 600
- ภาพที่ต้องมีอุปกรณ์หรือปลดล็อกใช้ **เซฟทดสอบแยก**: cleared สูงสุด 10 ตามหอคอยปัจจุบัน, ของจาก `rollItem` และ registry จริง, วัสดุทดสอบ/ทอง 10,000 ข้อมูลเปลี่ยนตามการกดจริงใน flow เช่น ขาย/ตีบวก/คราฟต์/อัญเชิญ
- ภาพ Breakthrough/เต็มเลเวลใช้สถานะที่กฎปัจจุบันรองรับในเซฟทดสอบ ไม่ใช่ข้อมูลบัญชีผู้ใช้
- ภาพผลชนะ/แพ้เกิดจาก battle engine จริง ชนะชั้น 1 ด้วยทีมเริ่มต้น และแพ้ชั้น 10 ด้วยทีมฮีลเลอร์เดี่ยว ไม่มีการยัดผลสมมติเข้า UI
- การยกเลิกขาย/ย่อยตรวจว่า save ไม่เปลี่ยน การยืนยันขายตรวจจำนวนของและทองจริง ตีบวกตรวจการใช้ ore/ทอง และยืนยันผลอัญเชิญครบ 10 รายการ
- หน้า UI ใช้ normal/reduced-motion ที่มีอยู่เดิม ภาพนิ่งเก็บใน reduced-motion เพื่อเปรียบเทียบกรอบและตัวหนังสือ

ภาพ WebP ใช้ขนาด screenshot เดิมและคุณภาพสูงเพื่อเปิดดูได้เร็ว เก็บต้นฉบับ PNG และสคริปต์ตรวจใน `work/all-pages/` (ไม่ติด Git) ภาพอุปกรณ์ vector เดิมเป็นภาพแทนชั่วคราวของฐานอุปกรณ์จริง ไม่ได้เพิ่ม item catalog ใหม่

## การตรวจทางเทคนิค

- Typecheck แอปและ spec
- ชุดทดสอบ Karma 809/809 รวมกรณีตัวกรองตีบวกต้องไม่ค้าง preview ของของที่ถูกซ่อน และไม่ใช้ทรัพยากรขณะเลือกดู
- Production build ผ่านโดยไม่เพิ่มเพดาน budget; มี initial/style budget warning และ Pixi CommonJS warning แต่ยังต่ำกว่าเพดาน error
- ตรวจ 17 หน้าทางเข้า × 5 ขนาด: 320, 390, 768, 1024 และ 1586 px; ตรวจทุกแท็บรายละเอียดฮีโร่เพิ่มเติม
- เก็บ flow ขาย/ย่อย/ตีบวก/คราฟต์/Hunt/โอนเซฟ/อัญเชิญจริง พร้อม error/empty/locked และส่วนล่างมือถือ
- ตรวจเตรียมรบ สนามจริง pause/resume, ผลชนะ/แพ้, portrait rotation, lab simulation และ sprite action
- รายงานละเอียด: `route-report.json`, `states-report.json`, `battle-report.json`, `sections-report.json`, `progression-report.json`, `final-check-report.json` ในโฟลเดอร์หลักฐานรีวิว

## ขอบเขตการเผยแพร่

Production ยังเป็น Home ที่อนุมัติจาก `origin/master` 2b06592cd8a56e1faa432a55fa89e85435dd5eee (tree 933de2b1448b464e521d5980c8d8b2a47a62339a) ตรวจตรงกันอีกครั้งระหว่างงานนี้

งานใหม่อยู่บน `wip/codex-all-pages-reference` ซึ่งต่อจากงานฮีโร่ที่ผู้ใช้ให้ทำต่อ ไม่มีการ merge, update production ref หรือสั่ง Cloudflare deploy ชุดนี้ ชุดหลักฐานเผยแพร่เป็น docs-only Git object โดยไม่ขยับ branch เพื่อให้ผู้ใช้ตรวจภาพก่อน

## 2026-10-25 — รายละเอียดฮีโร่ (รอตรวจ)

กาชาใช้ flexible-card ล่าสุดไปก่อนตามผู้ใช้ รอบนี้ส่ง Stats / Skills / Gear / Growth แยกหัวข้อ: [เปิดสารบัญ Desktop/Mobile](https://github.com/adisonkung/ProjectGM/blob/7439f88d3dc23bdf1f3174e4c217aefc3e2da9d1/docs/review-images/2026-10-25-hero-panels/README.md) อ้างอิงภาพ03/04และโปสเตอร์ A ใช้ข้อมูล/เงื่อนไขจริง โค้ดอยู่ใน local branch fix/codex-hero-panels-review; ยังไม่ Deploy ดู HERO_PANELS_REFERENCE_REVIEW.md

## 2026-10-25 — Battle (รอตรวจ)

[เปิดภาพเตรียมรบ / สนาม / พักรบ / ชนะ / แพ้ / รางวัล Training I แยกหัวข้อ](https://github.com/adisonkung/ProjectGM/blob/dad22f9976115b8f99e4c5fe527e896caa67c8ac/docs/review-images/2026-10-25-battle/README.md) รวม Desktop และมือถือแนวนอน ผลจากเอนจินจริง Typecheck/build/818 tests ผ่าน ยังไม่ Deploy ดู BATTLE_REFERENCE_REVIEW.md

## 2026-10-25 — Battle รอบคู่เทียบ (รอตรวจใหม่)

ผู้ใช้ปฏิเสธชุด dad22f9 ว่าไม่ตรงแบบ จึงแก้โครงและเพิ่มกฎ UI_REFERENCE_RULES.md รอบใหม่ต้องดูภาพจริงคู่กับแบบตาม BATTLE_REFERENCE_MATCH_REVIEW.md ไม่ใช้ผลเทสต์แทนอนุมัติ และยังไม่ Deploy

[เปิดคู่เทียบ Battle รอบใหม่ ซ้ายแบบ/ขวาเกมจริง](https://github.com/adisonkung/ProjectGM/blob/789173a5255a1038afeefa566e8034b9f59320ff/docs/review-images/2026-10-25-battle-match/README.md) — แยกเตรียมรบ/สนาม/พัก/ชนะ/แพ้ พร้อมภาพต้นฉบับและภาพจริง/มือถือ ยังไม่อนุมัติ Deploy

## 2026-10-25 — Battle: ครั้งแรก/เงา/สนามเต็มจอ (รอตรวจ)

ผู้ใช้ขอแก้จากชุด789173a: ป้ายครั้งแรกสีแดง, เงาดำให้อ่านชัดตามแบบ, ขยายฉากด้านบน2–3ช่องเพื่อลดพื้นที่ว่างล่าง ดู BATTLE_HEADROOM_LABELS_REVIEW.md สำหรับภาพจริงคู่ตัวอย่างล่าสุด คง3แถวต่อสู้และข้อมูลเดิม ยังไม่Deploy

[เปิดคู่เทียบและภาพจริง/ต้นฉบับแยกหัวข้อ](https://github.com/adisonkung/ProjectGM/blob/fef3871c69a6656bc1e42bb71fbd2a3bbdc67097/docs/review-images/2026-10-25-battle-contrast-fullfield/README.md) — รอบป้ายครั้งแรก/เงา/สนามเต็มจอ ยังรอตรวจ ยังไม่ Deploy

## 2026-10-25 — Battle แก้สัดส่วนรอบล่าสุด (รอตรวจ)

ผู้ใช้ปฏิเสธชุดfef3871เรื่องชัยชนะ/ริบบอน/ฉากยืด/กรอบฮีโร่ ดู BATTLE_PROPORTIONS_REVIEW.md สำหรับรอบใหม่ ยังไม่Deploy

[เปิดภาพคู่เทียบล่าสุดแยกหัวข้อ](https://github.com/adisonkung/ProjectGM/blob/a4787add9272da25966673d319460fbf33047432/docs/review-images/2026-10-25-battle-proportions/README.md) — source local / visual approval pending / no Deploy

## 2026-10-25 — Victory title/shadow/inset (รอตรวจ)

ผู้ใช้ปฏิเสธชัยชนะชุดa4787ad รอบล่าสุดรวมตรา/อักษร ลดเงาเฉพาะกลาง เพิ่มความสูงรางวัล และย้ายริบบอนเข้ากรอบ ดู BATTLE_VICTORY_INSET_REVIEW.md ยังไม่Deploy

[เปิดภาพคู่เทียบชัยชนะรอบล่าสุด](https://github.com/adisonkung/ProjectGM/blob/62b618746090f4edc31f8e62d7a4fac977b20151/docs/review-images/2026-10-25-victory-inset/README.md) — ภาพ/ผลตรวจเท่านั้น รอผู้ใช้ตรวจ ยังไม่Deploy

## 2026-10-25 — Welcome / Account / Save review (รอตรวจ)

ต่อจากผู้ใช้โอเคชัยชนะแล้วให้ต่อ หน้าเริ่มเกม/บัญชี/เปลี่ยนชื่อ/ส่งออก/นำเข้า/preview/confirm/error/undo อ่านแผ่น12/13/18ก่อนแก้ ดู ACCOUNT_REFERENCE_REVIEW.md ยังไม่Deploy

[เปิดภาพคู่เทียบ Welcome / Account แยกหัวข้อ](https://github.com/adisonkung/ProjectGM/blob/8fe59a12ef5186131adf0257b72ca799dd8afc1b/docs/review-images/2026-10-25-account-reference/README.md) — ภาพ/สารบัญ/ผลตรวจเท่านั้น ยังรอตรวจ ไม่Deploy

## 2026-10-25 — Labs / GM action access (รอตรวจ)

ต่อจากผู้ใช้ให้ไปหน้าถัดไปหลังAccount ภาพ15A/B ห้องทดลอง/ห้องทดสอบท่า และผู้ใช้ยืนยันให้ทุกคนเป็นGMชั่วคราว เตรียมผู้เล่นS1/S2/ULTพร้อมmethodguardไว้แต่ยังไม่เปิดใช้ ดู LABS_REFERENCE_REVIEW.md ไม่Deploy


[เปิดภาพคู่เทียบ Lab / ท่าทดลอง พร้อมภาพจริง Desktop และมือถือ](https://github.com/adisonkung/ProjectGM/blob/f5dcb9a7098a6440f8e8520bbea09d33d5d5d998/docs/review-images/2026-10-25-labs-reference/README.md) — ตรวจ17ลิงก์ HTTP200/ไฟล์ตรงต้นฉบับแล้ว ภาพ/สารบัญ/ผลตรวจเท่านั้น ยังไม่Deploy


## 2026-10-25 — Island details / reference16 (รอตรวจ)

ผู้ใช้ให้ต่อหลังLabs จัดหน้าต่างอาคาร/ล็อก/ฮีโร่/ธีมเกาะตามแผ่น16 อ่าน ISLAND_DETAILS_REFERENCE_REVIEW.md ใช้map/hero/themesและเงื่อนไขจริง ไม่เปลี่ยนหน้าHomeที่ตรวจแล้ว ยังคงรายการ/empty/notfoundstatesรอบละเอียดเป็นงานถัดไป ไม่มีDeploy

[เปิดภาพคู่เทียบรายละเอียดอาคาร / ล็อก / ฮีโร่ / ธีมเกาะ พร้อมภาพจริงและมือถือ](https://github.com/adisonkung/ProjectGM/blob/9b0815536b26e9b6777ce92a6586f4a1fa237938/docs/review-images/2026-10-25-island-details-reference/README.md) — ภาพ/index/validationเท่านั้น ไม่มีref update/Deploy


## 2026-10-25 — Lists / empty / recovery states (รอตรวจ)

ผู้ใช้โอเคหน้าต่างเกาะแล้วให้ต่อ ตามแผ่น18 รายการฮีโร่/ค้นหาไม่พบ/สายว่าง/UIDไม่พบ/กระเป๋าว่าง/ประเภทว่าง พร้อมตรวจซ้ำรหัสผิด/ข้อความสำเร็จ/ปุ่มวัสดุไม่พอจากหน้าเดิม ดูLIST_EMPTY_REFERENCE_REVIEW.md คงArmory2×2และgrid5colsที่ตรวจไว้ ไม่มีDeploy

[เปิดคู่เทียบรายการ / ค้นหาไม่พบ / กระเป๋าว่าง / UIDไม่พบ พร้อมภาพจริงและมือถือ](https://github.com/adisonkung/ProjectGM/blob/31eb4ea5fefc9f4899523a54998919feae22ff9f/docs/review-images/2026-10-25-list-empty-reference/README.md) — ภาพ/index/validationเท่านั้น ไม่Deployหรืออัปเดตref


### Bag frame follow-up — 25 Oct2026

User requested a frame around the equipment bag after31eb4e review. Branch fix/codex-armory-empty-frame fromb2036c0. Restore the existing double-gold cut-corner CitadelFrame around bag heading/filters/content when empty (including filter-empty), with transparent/soft-tinted SVG face so the existing scene/ivory empty-state stays readable. No gameplay/layout/data changes. App/spec/build+824tests; native320/390/768/1024 frame sizing/overflow, Hunt/Forge links and save invariance checked. Before/after uses the same1280×1000 viewport and isolated fixture; no screenshot retouch. Source local, publish screenshots/index/validation only, no ref update/Deploy.

[เปิดภาพกรอบกระเป๋าล่าสุด Desktop / มือถือ / ก่อน–หลัง](https://github.com/adisonkung/ProjectGM/blob/36b9272c1899aa1b8264ccd47d2935397c70c860/docs/review-images/2026-10-25-armory-empty-frame/README.md) — ภาพ/index/validationเท่านั้น ยังไม่Deploy


### Bag background follow-up — 25 Oct2026

User clarified the framed bag also needs a background. Branch fix/codex-armory-bag-background from1265341. Keep double-gold cut-corner frame, restore original opaque CitadelFrame charcoal gradient like equipped panel, replace ivory empty glow with subtle gold and change bag-empty heading/body to ivory/muted gold. CSS-only; actual data, approved2×2 and Hunt/Forge actions unchanged. App/spec/build/824tests +native desktop/mobile/frame sizing/contrast/save checks. Publish screenshots/index/validation only, no ref update/Deploy.

[เปิดภาพพื้นหลังกระเป๋าล่าสุด Desktop / มือถือ / ก่อน–หลัง](https://github.com/adisonkung/ProjectGM/blob/57b634dbca44b220c455f328be0c48f0ba3f7c11/docs/review-images/2026-10-25-armory-bag-background/README.md) — ภาพ/index/validationเท่านั้น ยังไม่Deploy


## 2026-10-25 — Summon information dialogs / sheet17 (รอตรวจ)

Routeหลักครบตามรายการแล้ว ผู้ใช้ให้ต่อจึงแยกส่งข้อมูลกาชาที่ยังไม่ได้ยืนยันรายหน้าต่าง: pool/rates/Memory ตาม17 ไม่แก้cinematic/flight/revealที่เลือกไว้ก่อน ดูSUMMON_INFORMATION_REFERENCE_REVIEW.md คงกติกา/ข้อมูลจริงและNoDeploy

[เปิดคู่เทียบรายชื่อฮีโร่ / อัตรา / Hero Memory พร้อมภาพจริงและมือถือ](https://github.com/adisonkung/ProjectGM/blob/0fdc3280e5c035b2be0df4a9db1b8a74585d19b5/docs/review-images/2026-10-25-summon-information-reference/README.md) — ภาพ/index/validationเท่านั้น ไม่มีref update/Deploy


## Hero Memory generated art replacement — 25 Oct2026

User requested a generated image like the reference, then clarified the figure must be an actual game hero and asked to replace the panel. Branch fix/codex-hero-memory-art from533d891. Imagegen edit uses canonical Bai Long portrait+banner as identity references and prior generated composition, preserving crystal/ritual/gold frame while restoring actual ponytail/white-navy embroidered robes/silver spear/white dragon. New hero-memory-bailong.webp (960px q94) only in Memory; original hero art unchanged. Replace old layered card/portrait/SVG markup with one optimized illustration, preserve frame/three explanation rows/actual values/actions, remove old mobile image max-height/mask. See docs/art/hero-memory/README.md +manifest. App/spec/build/824tests/native desktop+mobile/asset decode/rules/save checks. Source local; screenshot/index/validation publication only; no ref update/Deploy.

[เปิดภาพHero Memoryใหม่ที่อ้างอิงไป๋หลงในเกม พร้อม Desktop / มือถือ / คู่เทียบ](https://github.com/adisonkung/ProjectGM/blob/bb70d6f9a75fbeb08d4332a42986ac9bd0ce2324/docs/review-images/2026-10-25-hero-memory-art/README.md) — native screenshots/index/validationเท่านั้น ยังไม่Deploy

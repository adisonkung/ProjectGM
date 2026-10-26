# Battle — เตรียมรบ สนาม พักรบ และผลการต่อสู้

2026-10-25 · ผู้ใช้ให้ทำหน้าถัดไปหลัง Hero Detail panels · ยังไม่ Deploy

## แบบและขอบเขต

อ่าน `docs/design/eldervane-ui/README.md` และเปิดภาพ 11A/11B และ13 ก่อนปรับ ใช้ภาพแมพจริงจาก `STAGES.background → BACKGROUNDS` ทั้งสนามและภาพส่วนหัวของหน้าต่าง ยึดกรอบทองเข้ม ปุ่ม crimson lacquer และตัวอักษรไทย local Trirong ตามงานที่ตรวจมาก่อน

- เตรียมรบ: ขยายสนามให้สัมพันธ์กับความกว้างจอ เพิ่มเส้นกริดและแถบแบ่งเขตทีม/กลาง/ศัตรู ย้าย preset ลงใต้สนาม ใช้ compact preset ที่มีพื้นที่ปุ่มบันทึก/แก้ชื่อ และ CTA ดาบ/เริ่มต่อสู้/ลูกศร
- สนามจริง: กรอบ TowerOrnament แบบไม่มีพื้นทึบทับฉาก ปรับแถบเวฟ/เวลา/ความเร็ว และกรอบทีมใต้สนาม ส่วนเสริมอยู่ในแถบ scenery หรือ foot ไม่เปลี่ยนพิกัดของยูนิต
- พักรบ: หน้าต่างกลางจอ ปุ่มเล่นต่อ/เริ่มใหม่/ออกจากด่าน พร้อม CDK focus trap และคืนโฟกัสเมื่อปิด
- ผลชนะ/แพ้/หมดเวลา: ภาพแมพตรงกับด่าน ไอคอน tower/shield เดิม ชื่อด่าน เวลา/จำนวนฮีโร่ล้ม รางวัล/EXP จริง ปุ่มทำต่อเห็นชัด ไม่คัดลอกเงิน/เพชรที่วาดใน draft
- มือถือ: เตรียมรบ responsive; การสู้ใช้แนวนอนและการหยุดรอให้หมุนจอเดิม หน้าต่างผลลัพธ์ใช้คอลัมน์เพื่อให้เห็น actions ในจอเตี้ย

CSS ใหม่ scope ที่ `.lab.reference-battle` สำหรับ tower/farm ใน `_battle-reference.scss` ไม่เพิ่มงบ component styles; lab ยังคงรูปแบบเดิม (menu ใช้ focus trap ร่วมกัน) Placement มีเพียงหัวเขตแบบซ่อนเป็นค่าเริ่มต้นและแสดงใน scope นี้ ไม่เปลี่ยนหน้า Formation ที่อนุมัติ

**ไม่เปลี่ยน** battle engine, renderer/animation timing, grid 5×16 / scenery2 / playable3, ทีม5, placement coordinates, seed/rates, rewards, save schema หรือบริการธุรกรรม การเลือก retry/next/exit/auto/special ใช้ callback เดิม

## ภาพและข้อมูลทดสอบ

ภาพทั้งหมดเป็น screenshot ของ production build ที่รัน Chromium จริง ใช้ save ทดสอบแยกจากผู้เล่น: ทีมเริ่มต้นห้าตัว Lv1 และ presetA ที่บันทึกทีมนี้ไว้; สำหรับภาพแพ้ใช้ฮีลเลอร์เดี่ยวบนชั้น10ที่ปลดล็อกใน fixture ไม่ได้ยัดผลแพ้ชนะเข้า signal/engine

ผลหอคอยชั้น1 และ Training I เกิดจากการเล่นจริง รายการและจำนวนใน popup มาจาก `reward.breakdown.final` / `expStrip` เดิมทุกตัว รวมโบนัสรายวันและ reward carry เดิม ไอคอนวัสดุเป็น generic SVG ตามชนิด item ที่มีจริง รอ artwork ตาม `docs/art/material-icons/README.md` ไม่ได้ gen ไอเทมใหม่

## ตรวจสอบ

- App/spec typecheck, production build และ Karma818 ผ่าน (warning bundle/component budgets/Pixi CommonJS ยังมี; ไม่เพิ่ม budget)
- Browser: เตรียมรบ320/390/768/1024px ไม่ล้นแนวนอน; desktop1586×1050 และ landscape844×390
- พักรบหยุด clock, ไม่เปลี่ยนเซฟ/รางวัล, Tab อยู่ใน dialog; resume และ speed1→2→4
- ชนะชั้น1จริง รางวัลเขียนครั้งเดียว; แพ้ชั้น10จริง ลองใหม่และออกไปจัดตำแหน่งได้
- หน้ารอหมุนโทรศัพท์ตรวจในบริบทที่ browser policy ไม่อนุญาต fullscreen เพื่อทดสอบ fallback จริงที่มีอยู่ โดยไม่แก้ state เกม
- Training I ชนะจริง แสดง rating, material และ EXP ที่ระบบคำนวณ ตรวจตำแหน่ง action buttons ไม่ถูกขอบ dialog/viewport ตัดทั้ง desktop และ landscape

## ชุดภาพ

[เปิดภาพแยกหัวข้อ Desktop/Mobile](https://github.com/adisonkung/ProjectGM/blob/dad22f9976115b8f99e4c5fe527e896caa67c8ac/docs/review-images/2026-10-25-battle/README.md) — 15 artifacts เฉพาะ screenshot/index/ผลตรวจ แบบ docs-only ไม่ขยับ branch หรือ Deploy ไม่มี source patch

ยังรอผู้ใช้ตรวจความสวยงาม ไม่ถือว่าเทสต์อัตโนมัติอนุมัติแทนผู้ใช้

## สถานะหลังส่งภาพ

ผู้ใช้ปฏิเสธรอบนี้ว่าไม่เหมือนตัวอย่างทุกหน้า และสั่งเพิ่มกฎให้ส่งภาพจริงคู่กับแบบ จึงไม่ถือว่ารอบนี้ผ่าน ดู BATTLE_REFERENCE_MATCH_REVIEW.md และ UI_REFERENCE_RULES.md แทน ยังไม่ Deploy

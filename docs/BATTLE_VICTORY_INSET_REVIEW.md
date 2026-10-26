# Battle victory — unified title / local shadow / inset reward ribbon

2026-10-25 · ผู้ใช้ปฏิเสธชุดa4787adเรื่องตรา/ข้อความไม่สัมพันธ์ เงายาว รางวัลเตี้ยและริบบอนทับกรอบ · ยังรอตรวจ ไม่Deploy

- เปิดภาพ13และcropล่าสุดจริงก่อนแก้ สร้างvictory-title.webpด้วยimage_genจากภาพ13: หอคอย/ลอเรล/อักษรชัยชนะเป็นภาพRGBAเดียว ไม่แยกฟอนต์ให้เคลื่อนสัมพันธ์กัน h2คงข้อความให้screen readerและเลขชั้น/ชื่อด่านจริง
- อาร์ตนี้เป็นการสร้างอ้างอิง ไม่ใช่ไฟล์เวกเตอร์ต้นฉบับหรือการextractตรงทุกpixel ดูpublic/ui/eldervane/victory-title.mdต้นทาง/โปร่งใส1536×1024/แปลงWebP losslessโดยไม่resizeหรือwarp
- แยก_victory-inset.scss scopeผลชนะเท่านั้น เงาradialฟุ้งเฉพาะกลาง ยกเลิกแถบดำยาวทั้งหัวข้อและเลขชั้น
- ยกเลิกnegative margin/full-bleedของreward-heading ให้paddingจากกรอบจริงdesktopบน16/ข้าง14px ริบบอนอยู่ข้างใน ช่องไอเทมmin-height104px desktop/84pxlandscape
- ไม่แก้engine/reward/save/สนาม/party/แพ้/พักรบ

## การตรวจ

App/spec typecheck+production build+822testsผ่าน คงwarning/budgetเดิม เกมจริงชนะชั้น1และเล่นซ้ำ ไม่ให้Memoryแรกซ้ำ ป้ายแรกหายเมื่อซ้ำ เปิดEXPทั้ง5คนได้ ตรวจกลางภาพ/หัวข้อ/เลขชั้น ภาพไม่warp เงาเล็กกว่ากรอบ ริบบอนinsetชัด ช่องไอเทมสูงไม่ชนหัวข้อ ป้ายไม่ชนปิด และไม่ล้นviewport desktop1280×900/mobile844×390

มือถือtouchแนวตั้ง390×844แสดงrotation guardคลุมผลตามflowเดิม ภาพแนวตั้งระบุว่าเป็นรอหมุนจอ ไม่อ้างว่าเป็นภาพผลชนะที่เห็นได้ แม้DOMของผลยังอยู่ข้างหลัง

## ภาพคู่เทียบ

[เปิดภาพคู่เทียบชัยชนะรอบล่าสุด](https://github.com/adisonkung/ProjectGM/blob/62b618746090f4edc31f8e62d7a4fac977b20151/docs/review-images/2026-10-25-victory-inset/README.md) — ตรวจ13URLs HTTP200/ตรงไฟล์ต้นทางครบ: ภาพเต็มหน้าต่าง หัวตรา/เงาขยาย และกรอบรางวัลขยาย ซ้ายต้นฉบับ13/ขวาภาพเกมจริง ไม่รีทัชscreenshot แปลงWebP losslessตรวจpixel round-trip

ยังต่างตามข้อมูลจริง: Memory10+EXPรวม250แทนทอง/เพชรสมมติ อาร์ต/กรอบสร้างอ้างอิงต้องให้ผู้ใช้ตรวจ ไม่ถือว่าเทสต์ผ่านแล้วเหมือนต้นฉบับทุกpixel ไม่มีDeployหรือremote ref update เผยแพร่ภาพ/สารบัญ/ผลตรวจเท่านั้น

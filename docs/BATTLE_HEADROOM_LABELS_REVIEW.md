# Battle — ป้ายครั้งแรก เงาข้อความ และขยายสนาม

2026-10-25 · ต่อจากคำขอให้ชัยชนะ/พ่ายแพ้เหมือนตัวอย่าง อ่านชัด และขยายฉากด้านบน2–3ช่องเพื่อลดช่องว่างใต้สนาม · ยังไม่ Deploy

## เปลี่ยนเฉพาะการแสดงผล

- แยกป้าย `ครั้งแรก` สีแดง/ขอบทองออกจากหัวข้อรางวัล แสดงเฉพาะ `reward.breakdown.kind === TOWER_FIRST` จากระบบจริง
- ชนะ/แพ้/พักรบมีแถบเงาดำฟุ้งหลังชื่อและข้อความ สีอักษร ivory/gold; คำแนะนำแพ้มีพื้นดำและเส้นทองตามภาพ13 รางวัล/Memory/EXPยังเป็นข้อมูลจริง
- จอ desktop ใช้ความกว้างตาม viewport และเพิ่มเฉพาะ sky projection สูงได้ไม่เกิน3ความสูงช่อง (จอกว้าง1586×1050เพิ่มประมาณ2.95ช่อง) จอแนวนอนเตี้ยไม่เพิ่มส่วนนี้
- เตรียมรบ desktop ขยายเฉพาะฉากเหนือกริด2ความสูงช่องตามคำขอ ผู้เล่นยังแตะ/ลากได้เฉพาะ18ช่องฝั่งเราเดิม
- `battleViewport()` คำนวณ cell/extra sky/ขนาดแผงจาก viewport; ไม่มีค่าที่บันทึกลง save หรือส่งเข้า engine
- Board เพิ่ม offset ที่ `.cam` ร่วมกันทั้ง DOM, Pixi, projectile, FX และ hit targets; Field ยืดเฉพาะชั้นภาพด้านบน ขอบต่อพื้นหญ้าและขนาดช่องพื้นเดิมไม่ยืด
- คง `BOARD_ROWS=3`, `SCENERY_ROWS=2`, `BOARD_COLS=16` และตำแหน่ง/การเดิน/ระยะ/การเล็งในโมเดลเดิมทั้งหมด ชื่อ `sceneryExtraRows` หมายถึงช่องว่างภาพเพิ่มเติม ไม่ใช่แถวที่เล่นได้
- เริ่มรบเลื่อนกลับด้านบนทันที ป้องกันตำแหน่ง scroll จากหน้าเตรียมรบทำให้กรอบถูก headerบัง; ลบ padding ล่างของ lobby เฉพาะ real battle ที่กำลังสู้ เพื่อไม่เหลือพื้นที่ scroll ว่างจากหน้าก่อน

ค่าเริ่มต้นของ input ใหม่เป็น0 จัดทัพ standaloneและlabใช้ projectionเดิม ไม่มีการแก้engine/สูตร/transaction/อาร์ตตัวละคร/ฉากแมพต้นฉบับ

## ตรวจสอบจริง

- App/spec typecheck + production build + Karma **822** ผ่าน (เพิ่ม4เคส geometry: จอกว้าง/จอเตี้ย/landscape/portrait; ไม่ปรับbudget)
- Browser actual engine: ชนะชั้น1, แพ้ชั้น10, pause/focus/resume/speed/retry, phone rotate fallback, SVGframe resize และหลายviewportไม่ล้นแนวนอน
- 1280×900 ตรวจ5 logical rows, cellCSSตรงกับcellRenderer, sky/groundต่อกัน, camoffsetเท่ากันกับPixi และscrollกลับ0
- 1586×1050: fieldกว้าง1552px สูง936px ขอบบน100/ล่าง1036ภายในจอ, camera offset286px, ทั้งDOMและPixiใช้offsetเดียวกัน; กดเลือกศัตรูในDOMได้จริง
- ชนะซ้ำจริงในcontextเดิม: ป้ายครั้งแรกหายไป และUniversal Memoryจากfirst clearไม่ถูกให้ซ้ำ
- เมนูsave preset, แตะการ์ดแล้ววาง, clear/auto, Formation18ช่อง และLabไม่มีexpanded sceneryตรวจซ้ำ

## ภาพคู่เทียบ

[เปิดคู่เทียบและภาพจริง/ต้นฉบับแยกหัวข้อ](https://github.com/adisonkung/ProjectGM/blob/fef3871c69a6656bc1e42bb71fbd2a3bbdc67097/docs/review-images/2026-10-25-battle-contrast-fullfield/README.md) — ตรวจลิงก์ภาพ/สารบัญ/ผลตรวจและต้นฉบับรวม26ไฟล์ HTTP200 และตรงกับไฟล์ต้นทาง ภาพจริงรันเกม desktop1280×900/wide1586×1050/landscape844×390 พร้อมต้นฉบับ11/13แยกเปิด ภาพคู่แสดงต้นฉบับที่ไม่แก้ไฟล์ข้างscreenshotจริง ไม่มีการรีทัชภาพเกม ใช้WebP losslessและตรวจpixel round-trip

[กฎUIที่ผู้ใช้เพิ่ม](UI_REFERENCE_RULES.md) ยังคงมีผล ไม่ใช้เทสต์แทนการอนุมัติความเหมือนจากผู้ใช้ ไม่มีDeploy/merge/update remote ref

## สถานะล่าสุด

ผู้ใช้ปฏิเสธสัดส่วน/การยืด/alignและกรอบทีมในชุดfef3871 ดู BATTLE_PROPORTIONS_REVIEW.md สำหรับรอบแก้ล่าสุด ไม่ใช้ภาพชุดนี้เป็นแบบที่ผ่าน

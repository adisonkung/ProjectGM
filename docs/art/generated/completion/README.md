# เติมภาพ Gen ที่ตกหล่น — 26 ต.ค. 2026

สถานะ: แก้ในสาขางานแล้ว รอตรวจภาพก่อน merge/Deploy

## เปิดดูหลักฐาน

- [คลังวัสดุ15ประเภท — ภาพเกมจริง](images/materials-desktop.webp) · [มือถือ](images/materials-mobile.webp)
- [วัสดุเทียบอาร์ตต้นแบบ](materials-comparison.webp)
- [ช่องรางวัลดันเจี้ยน ก่อน/หลัง](dungeon-comparison.webp)
- [ยาในสนามฝึก](images/training-desktop.webp) · [ตำราในบททดลองสกิล](images/trial-desktop.webp) · [เศษ/แร่ในล่าอุปกรณ์](images/hunt-desktop.webp)
- [มือถือ: ยา](images/training-mobile.webp) · [ตำรา](images/trial-mobile.webp) · [เศษ/แร่](images/hunt-mobile.webp)
- [EXPหอคอย](images/tower-exp-desktop.webp) · [แร่/ทองในต้นทุนตีบวก](images/enhancement-cost-desktop.webp)
- [ภาพปุ่มพักรบจริงเทียบต้นแบบ](pause-comparison.webp) · [ภาพพักรบเต็ม](images/pause-desktop.webp)
- [เลื่อนขั้นยังใช้หินกลาง](images/ascension-desktop.webp) · [มือถือ](images/ascension-mobile.webp): ไม่ใช้หน้าไป๋หลงแทนหินทุกฮีโร่

## ขอบเขตและผลตรวจ

- เปลี่ยนเฉพาะภาพ/ข้อความอธิบาย/หน้าดูจำนวนวัสดุ ไม่แก้ราคา โอกาสดรอป สูตร ผลรางวัล กติกาอุปกรณ์ หรือsave schema
- ตรวจจริง13ภาพที่1440×1000และ390×844; ภาพคลังวัสดุถ่ายเฉพาะcomponentเต็มเพื่อเห็นทุกชิ้น ภาพหน้าจออื่นเป็นviewport screenshot ไม่แต่งเฟรมเกม
- ใช้local fixtureที่มี15วัสดุ รวมเศษตำรา3/7/9ชิ้นและรายการจำนวน0; จำนวนในรูปเป็นfixtureสำหรับตรวจ ไม่ใช่ยอดเซฟผู้เล่น การเปิดดู/พับคลัง/เปลี่ยนหน้าที่ตรวจไม่เปลี่ยนเซฟ
- App/spec typecheckผ่าน, production buildผ่าน, unit tests827/827ผ่าน; มีstylesheet/Pixi warningsเดิม ไม่เปลี่ยนbudget
- [ผลตรวจ browser](validation.json): ไฟล์ภาพคลัง119รายการdecodeครบ ไม่มีpage error/HTTPรูปหาย/แนวนอนล้น; ตรวจimgในช่องรางวัลจริง ไม่ใช้การมีไฟล์เพียงอย่างเดียวสรุปว่าเชื่อมแล้ว
- [Auditภาพและรายการที่ยังพัก](asset-audit.json):119ภาพหลัก97active/12superseded/6example_paused/4concept_only; runtimeมี139WebPเมื่อรวมรุ่นภาพใหญ่และแบบเก่า ภาพหลัก97รายการมีrenderer แต่บางภาพปรากฏตามไอเทม/stat/สถานะปุ่ม หลักฐานหน้าที่ไม่ได้แก้ในรอบนี้อยู่ใน[รีวิวเดิม](../review/README.md)และ[Forgeรอบใหม่](../../forge-tier-showcase/README.md)
- ตัวอย่างหินรายฮีโร่/หินรวมconcept/board/เวอร์ชันถูกแทนยังดูได้ในคลังGMพร้อมป้ายสถานะ และไม่ใช้แทนข้อมูลจริง ไม่คืนเวอร์ชันที่ผู้ใช้ปฏิเสธ

อ้างอิง: [วัสดุที่Gen](../review/references/materials.webp) · [ชุดปุ่มต่อสู้ที่Gen](../review/references/battle.webp) · [ภาพก่อนเปลี่ยนช่องรางวัล](../review/images/training-desktop.webp) · [รายการงานที่ยังไม่ได้ผลิต/ระบบที่ยังไม่มี](../README.md#งานที่ยังไม่ได้ทำ)

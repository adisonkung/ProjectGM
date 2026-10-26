# Welcome / Account / save transfer — reference review

2026-10-25 · ผู้ใช้ “โอเค ต่อไปเลย” หลังชัยชนะชุด62b6187 · source branch fix/codex-account-reference จาก4bd5506 · ยังไม่Deploy

อ่านภาพ12/13/18จริงก่อนแก้ ใช้Citadel backgroundและwordmarkchampagneเดิม กรอบdark goldตัดมุม ลายengraving และred lacquerร่วมกับHome/ปุ่มเกม

- Welcome: wordmarkเหนือpanelกลาง, label/ช่องชื่อ/dice, ชื่อ2–16ตามname rulesจริง, errorเดี่ยว, ปุ่มเริ่มแดงและทางย้ายเซฟ ไม่มีdaily/cloudระบบใหม่
- Account: headingplaque/profilethumbnail/name, คอลัมน์ส่งออก–นำเข้า, numberedsteps/สร้างรหัส/ดาวน์โหลด/copy, codeจริงและpreviewข้อมูลจริง
- Rename: modalอ้างอิง13พร้อมชื่อปัจจุบัน ช่องเดียว/counter/errorจริง, focus trap/ปิด/Escape/cancel/บันทึกเรียกAccountServiceเดิม ภาพdraftที่มีสองช่องเป็นตัวอย่างหลายstate ไม่แสดงสองฟอร์มพร้อมกัน
- SaveImport: label/textarea/file/check/preview/error อ้างอิง12/18; กดนำเข้าเซฟนี้เปิดconfirm modal13ก่อนเรียกapplyเดิม เพิ่มเฉพาะUI pending ไม่เปลี่ยนcodec/migration/backup/service/รูปแบบเซฟ
- Previewยังไม่apply กดยกเลิกไม่เปลี่ยนข้อมูล ยืนยันใช้AccountService.applyและundoเดิม ไม่มีการใช้เซฟผู้ใช้จริง ทดสอบบนisolated localStorage

## ข้อมูล/ข้อจำกัด

กฎชื่อยัง2–16 ไม่คัดลอก20/24สมมติจากภาพ รหัสST1Zจริงอาจยาว/หลายบรรทัดกว่าดราฟ ฮีโร่จริง7ตัวไม่ใช่5จากภาพ ส่วนpreviewมีเพชร/เวลาส่งออกและactionที่เปิดยืนยัน เป็นข้อมูลจริง ต้องตรวจความเหมือนจากภาพคู่ ไม่ใช้เทสต์แทนอนุมัติ

ไม่มีการแก้Home/Battleที่อนุมัติ, engine, roster, artของฮีโร่, เศรษฐกิจ, AccountService/SaveService, codec, migration หรือcloudlogin

## ภาพ/ผลตรวจ

[เปิดภาพคู่เทียบ Welcome / Account แยกหัวข้อ](https://github.com/adisonkung/ProjectGM/blob/8fe59a12ef5186131adf0257b72ca799dd8afc1b/docs/review-images/2026-10-25-account-reference/README.md) — ตรวจ29URLs HTTP200/ตรงไฟล์ต้นทางครบแล้ว Desktop/mobileและภาพขยายdialog ส่งคู่ซ้ายแบบ/ขวาเกมจริงพร้อมต้นฉบับแยก ภาพเกมไม่รีทัช WebP losslessตรวจpixel round-trip

## ผลตรวจ

App/spec typecheck, production buildและKarma822ผ่าน คงbudget/warningsเดิม Browserใช้isolated contextใหม่: welcomeชื่อสั้นถูกปิด/สุ่มชื่อถูกกฎ/ตั้งชื่อไปHome, exportST1Z+clipboard+downloadJSONจริง, previewไม่แก้state, renameปิด/Escape/cancelไม่แก้ชื่อและบันทึกชื่อถูกต้อง, codeเสีย/fileJSONเสียไม่แก้state, confirmมีfocus trapและcancelไม่replace, confirmapplyจริงแล้วundoคืนname/gold/heroesเดิม, filepreviewไม่applyเอง และwelcomeimportเซฟมีชื่อแล้วไปHome มี320/390/768/1024ตรวจไม่ล้นและภาพmodalมือถือ

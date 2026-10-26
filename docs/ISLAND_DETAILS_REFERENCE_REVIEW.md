# Island details — reference16 review

2026-10-25 · ต่อจากผู้ใช้ให้ผ่าน Labs ไปหน้าถัดไป · branch fix/codex-island-details-reference จาก dc0d1a4 · ไม่มี Deploy

อ่าน README/UI_REFERENCE_RULES และเปิดภาพ16ต้นฉบับจริงก่อนแก้ คงองค์ประกอบหน้าHomeที่ตรวจแล้ว ใช้หน้าต่างรายละเอียด4แบบตามแผ่น16: อาคารใช้งานได้ / อาคารล็อก / โปรไฟล์ฮีโร่ / ธีมเกาะ

- หน้าต่างกว้างแบ่งภาพซ้าย/ข้อมูลขวา ปุ่มตัดมุมแถวล่าง ขอบทองสองชั้นพร้อมร่องดำและลายสลัก ใช้ TowerOrnament เดิม ปุ่มแดงมีผิวแสงเฉียง; มือถือเรียงภาพ/ข้อมูล/ปุ่ม เลื่อนภายในโดยกรอบกับปิดยังอยู่
- IslandDetailArtComponent วาดภาพนิ่งจาก SKY_BASE/SKY_PLOTS และlandmarkที่ปลดล็อกจริง ไม่genอาคารจำลอง สำหรับclassicใช้buildingDrawและtheme/skinOverridesจริงจากrendererเดิม แสดงเฟรมแรกของsheet ภาพนี้เป็นstillpreviewไม่ใช่canvasที่เล่นเอฟเฟกต์ทั้งหมด
- ชื่อ/คำบรรยาย/เลเวล/เงื่อนไข/การพัฒนาถัดไป/เส้นทาง/สถานะactionอ่านจากbuildingSheet/registryเดิม ไม่ใช้ชั้น3ที่draftสมมติสำหรับทุกอาคาร
- F0โรงช่างเป็นซาก แต่คลัง/โรงตีเหล็กใช้ได้; Huntยังล็อกF3 และฟื้นฟูF6 คงเงื่อนไขแยกของฟีเจอร์/อาคาร ไม่เปลี่ยนunlockหรือซ่อนเมนูที่ใช้งานได้
- อาคารล็อกมีภาพmapcrop+lock/กรอบเงื่อนไขและสถานะ ยังไม่แสดงปุ่มactionที่เปิดไม่ได้ทั้งหมด; ฟีเจอร์อนาคตระบุชัด ไม่มีระบบเดินทาง/ร้านค้า/ค่าพลังใหม่
- ฮีโร่ใช้banner/portraitของจริง ดาวพัฒนาจากRosterService, level/power/class/ชื่อ3สกิลจริง ไม่เขียนชีวประวัติสมมติจากdraft ตั้งฮีโร่หลักยังเปลี่ยนเฉพาะidentity; ปุ่มสกิลส่งtab=skillsให้HeroDetailเปิดแท็บเดิมโดยตรง ไม่เปลี่ยนคำนวณหรือUIแท็บนั้น
- ธีมDesktopเป็นแถบแนวนอนเลื่อนดูได้เพื่อรักษาสัดส่วนตามแบบ มือถือเลื่อนภายในแนวตั้ง แสดงนครลอยฟ้าจริง +6classic themesที่มีอยู่ แทนclassicA/Bสมมติในภาพ ใช้thumbและassetท้องฟ้า/หอคอยเดิม ไม่เพิ่มthemeหรือเปลี่ยนgeneratedassets
- มีfocus trap/autocapture/คืนfocusเมื่อปิด, Escapeและคลิกพื้นหลังปิดได้ โฮมเดิมยังเป็นฉากหลัง; แบนเนอร์eventใช้กรอบ/วัสดุเดียวกัน คิว/timing/reveal/acknowledge/skipเดิม

## Validation

App/spec typecheck, production build และ824testsผ่าน ปรับselectorของ4specเดิมให้ตรงsemanticหน้าต่างใหม่ ไม่มีการเปลี่ยนexpectationด้านgameplay Budgetคงเดิม มีwarningเดิมของโปรเจกต์

ผลbrowserและภาพจริงอยู่ในreview indexด้านล่าง ใช้isolated saveทดสอบ ไม่ใช่บัญชีผู้ใช้ ไม่รีทัชscreenshot/ไม่เปลี่ยนต้นฉบับภาพแบบ ภาพWebPแบบlosslessตรวจpixel round-trip

## คู่เทียบและภาพแยก

[เปิดภาพคู่เทียบรายละเอียดอาคาร / ล็อก / ฮีโร่ / ธีมเกาะ พร้อมภาพจริงและมือถือ](https://github.com/adisonkung/ProjectGM/blob/9b0815536b26e9b6777ce92a6586f4a1fa237938/docs/review-images/2026-10-25-island-details-reference/README.md) — ภาพ/index/validationเท่านั้น ไม่มีref update/Deploy

ซ้ายภาพ16ต้นฉบับ/ขวาหน้าต่างเกมจริง ครอปการแสดงผลเฉพาะแผงจากscreenshotจริง พร้อมลิงก์fullviewportและมือถือแยก

สิ่งที่ต่างตามข้อมูลจริง: รูปอาคาร/ฮีโร่จากเกม, จำนวน3ปุ่มโรงช่างรวมHuntแทน2ปุ่มmock, ชื่อ/ค่าpower/สกิล/เงื่อนไขพัฒนา, 6classic themesจริงแทน2themeสมมติ และใช้skillnamesแทนชีวประวัติที่ไม่มีในregistry ไม่อ้างว่ากรอบ/แสง/สัดส่วนผ่านผู้ใช้แล้วเพียงเพราะเทสต์ผ่าน รอผู้ใช้ตรวจภาพ ไม่มีsource publication/ref update/Deploy

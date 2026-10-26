# Eldervane — สัญลักษณ์และเครื่องมือ18แบบ

26 ต.ค.2026 · ต่อจากชุดสถานะ31แบบในสาขา `wip/codex-status-icon-art` · รอตรวจภาพก่อนmerge/Deploy

## เปิดดู

- [ครบ18แบบในคลังเกมจริง](review/symbols-desktop.webp) · [มือถือ](review/symbols-mobile.webp)
- [อาร์ตต้นฉบับเทียบกับขนาดแสดงจริง](review/art-comparison.webp)
- [หน้าบัญชี — ส่งออก/นำเข้า/กลุ่มคน](review/account-desktop.webp) · [มือถือ](review/account-mobile.webp)
- [เครื่องมือบนเกาะ](review/home-tools-desktop.webp) · [เปิดเมนูธีม](review/home-themes-desktop.webp)
- [เติบโต/คริสตัล](review/hero-growth-desktop.webp) · [สกิล/หนังสือ](review/hero-skills-desktop.webp)
- แผ่นอาร์ตโปร่งใส: [เครื่องมือ](../../../public/ui/symbols/utility.webp) · [สัญลักษณ์พื้นฐาน](../../../public/ui/symbols/emblems.webp)

## รายการ

เครื่องมือ9: นำเข้า/โหลด, ส่งออก, ห้องทดลอง, เต็มจอ, เปลี่ยนธีม, กลุ่มคน, ยืนยัน/สำเร็จ, ม้วนคัมภีร์, หนังสือ

สัญลักษณ์9: ดาบ, ธนู, รักษา, ดาว, คริสตัล, ยา, กะโหลก, มงกุฎ, สายฟ้า

Genใหม่เป็น2แผ่นโปร่งใส3×3และใช้CSSแสดงช่องเต็ม ไม่ตัดหรือแต่งทับภาพต้นฉบับ สีสื่อหน้าที่ เช่นฟ้าโหลด/ส่งออก เขียวสำเร็จ/รักษา แดงยา เหลืองสายฟ้า; ดาบและธนูทรงเรียว ไม่เปลี่ยนรูปอาชีพชุดที่ผู้ใช้เลือก

`IconComponent`และ`CitadelIconComponent`ใช้รูปเดิมที่อนุมัติก่อนเสมอ ถ้าkeyนั้นยังไม่มีรูปเดิมจึงใช้ `UiSymbolComponent`/`UI_SYMBOL_ART`; keyที่ยังไม่มีอาร์ตใช้fallbackเดิม ไม่มีการเปลี่ยนข้อมูลเกม

เปลี่ยนinline SVGในหัวข้อส่งออกเซฟ/เครื่องหมายยืนยันและใช้ภาพค้นหาที่มีแล้วในปุ่มตรวจรหัส รูปใหม่ที่ใช้ในปุ่มถูกซ่อนจากscreen reader โดยปุ่มคงชื่อaccessibilityเดิม รองรับsizeตัวเลขและ1emตามเดิม

## ตรวจแล้ว

- App/spec typecheck, production build และunit tests **831/831ผ่าน**; warningsงบstyle/Pixiยังคงอยู่ ไม่แก้budget
- [Browser validation](review/validation.json):18ช่องอาร์ตไม่ซ้ำ แสดง72/28/18px; desktop1440×1000และmobile390×844ไม่มีแนวนอนล้น/page error/ไฟล์ภาพหาย
- ภาพหน้าจอจริง8ภาพ ไม่มีการแต่งเฟรมเกม ตรวจเปิด/ปิดแก้ชื่อเกาะ เปิดธีม ดูข้อมูลฮีโร่แล้วเซฟคงเดิม และไอคอนอาชีพนักสู้ยังใช้ไฟล์เดิม
- [Manifest](manifest.json) มีprompt/ตำแหน่ง/source/hash/alpha; PNGต้นฉบับคงอยู่ในgenerated_images

## ยังเหลือ

ไอคอนเฉพาะAffix, สถานะนอกชุด31รายการที่ยังไม่มีbadge, มอนสเตอร์/บอสที่ยังเป็นmock, หินฮีโร่ที่พักรอPortrait และอาร์ตRelic/ชุดฮีโร่เปลี่ยนตามอุปกรณ์ ยังไม่ได้ผลิตในชุดนี้

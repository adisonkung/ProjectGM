# Eldervane — อาร์ตAffixอุปกรณ์13แบบ

26 ต.ค.2026 · สาขา `wip/codex-status-icon-art` ต่อจากสถานะ31และสัญลักษณ์18 · รอตรวจภาพก่อนmerge/Deploy

## เปิดดู

- [ไอคอนครบ13แบบจากคลังเกมจริง](review/affixes-desktop.webp) · [มือถือ](review/affixes-mobile.webp)
- [อาร์ตต้นฉบับเทียบในเกม](review/art-comparison.webp)
- [รายละเอียดอุปกรณ์พร้อมPoison Ward](review/bag-poison-detail.webp) · [หน้ากระเป๋าเต็ม](review/bag-poison-desktop.webp) · [มือถือ](review/bag-poison-mobile.webp)
- [หน้าตีบวก](review/forge-affix-desktop.webp) · [มือถือ](review/forge-affix-mobile.webp)
- [ผลหลอมEpicจริงพร้อมAffixที่สุ่มได้](review/crafted-affix.webp)
- แผ่นต้นฉบับ: [ป้องกัน7แบบ](../../../public/ui/affixes/wards.webp) · [โจมตี/สนับสนุน6แบบ](../../../public/ui/affixes/offense.webp)

## ชุดภาพ

ป้องกัน: Bleed Guard, Poison Ward, Rootbreaker, Guardian, Medic, Backline Guard, Bulwark

โจมตี/สนับสนุน: Mist Hunter, Breaker, Execution, Focus, Keen Eye, Mender

Genเป็น2แผ่นโปร่งใส3×3 เว้นช่องที่ไม่ใช้ (7/6ภาพ) ใช้CSSแสดงช่องเต็มในAffixIconComponent ภาพมีสี/รูปทรงแยกกันตามหน้าที่ ไม่ใช้รูปstatหรือstatusเดิมเปลี่ยนสี อาร์ต/ตำแหน่ง/source/hash/alpha/promptอยู่ใน [manifest](manifest.json)

## การเชื่อมและค่าจริง

- ใช้IDจากAFFIXESทั้ง13รายการเดิม ไม่เพิ่มชนิดไอเทมหรือเปลี่ยนสูตร/โอกาสสุ่ม/กติกา
- กระเป๋าแสดงbadgeข้างชื่อคุณสมบัติ; Forgeแสดงในหน้าตีบวกและผลหลอมที่ได้รับAffixจริง คลังGMเพิ่มหมวดaffix-icons/affix-atlas พร้อมตัวอย่าง72/28/24px
- ข้อความชื่อ/คำอธิบายใช้registryเดิม; แก้การแสดงค่าให้คูณrarity scaleเหมือนitemLines ไม่ปรับค่าengine เช่นEpicกันพิษ25%, Focus5%, Break13 และExecution10%โดยเงื่อนไขHPต่ำกว่า30%คงเดิม
- ในคลังอาร์ตแสดงค่าพื้นฐานRare/Elite; ในอุปกรณ์ที่ครอบครองแสดงค่าตามrarityของชิ้นนั้น ภาพไอคอนไม่เปลี่ยนความหมายตามTier
- ไอคอนตกแต่งซ่อนจากscreen readerเพราะมีข้อความจริงอยู่ข้างกัน; tooltipของไอคอนแสดงค่าตามrarityด้วย

## ตรวจแล้ว

- App/spec typecheck, production build และ **834/834unit testsผ่าน** รวมการตรวจค่าของEpic/เงื่อนไขHP/ค่าflatที่ปัดเศษ; warningsstyle/Pixiเดิมคงอยู่ ไม่แก้budget
- [Browser validation](review/validation.json):13ช่องอาร์ตไม่ซ้ำ ดูอุปกรณ์fixtureครบ13Affix, ค่ากันพิษEpic25%, เงื่อนไขHP30%ยังอยู่;8ภาพเดสก์ท็อป1440×1000/มือถือ390×844 ไม่มีแนวนอนล้น/pageerror/HTTPรูปหาย
- ใช้fixtureเซฟแยกที่มี13อุปกรณ์Epicและวัสดุสำหรับตรวจ การเปิดดูไม่แก้เซฟ; ทดสอบหลอมEpicจริงใช้110เศษ/4000ทอง เพิ่มอุปกรณ์มีAffixและแสดงbadgeตรงIDผลจริง ไม่บังคับผลสุ่ม
- ภาพจากbrowserไม่แต่งเฟรมเกม ภาพต้นฉบับGenแยกจากscreenshotชัดเจน ยังรอตรวจความสวยงามจากผู้ใช้

## ยังเหลือ

มอนสเตอร์/บอสที่ยังเป็นmock, หินรายฮีโร่ที่พักรอPortrait, Relicและภาพฮีโร่เปลี่ยนชุดตามอุปกรณ์ และการเลือกbadgeสำหรับสถานะนอกชุด31ที่เดิมยังไม่แสดง ยังอยู่นอกชุดนี้

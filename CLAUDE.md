# ProjectGM — Summon Tower

เกมกาชา + จัดทีม + ต่อสู้อัตโนมัติแบบ TFT บนกระดานแนวนอน 7 แถว × 10 คอลัมน์ (ฝั่งละ ลึก 5 × 7 เลน, เราซ้าย ศัตรูขวา) ทีมละ 5 ตัว
Angular 19, standalone components, signals. เอกสารออกแบบอยู่ในโปรเจกต์ "Game Demo" บน claude.ai

## กฎที่ล็อกไว้
- ไม่มีตายถาวร → ฮีโร่ที่ล้มบาดเจ็บ พัก 2 รอบ หรือจ่ายทองรักษา
- เงื่อนไขชนะใน Demo: กำจัดศัตรู (eliminate) และเอาตัวรอด (survive)
- ช่องสี่เหลี่ยม ระยะแบบ 8 ทิศ (แนวทแยง = 1 ช่อง)
- พิกัดในฝั่ง (TeamSlot, ตำแหน่งศัตรูในด่าน): `r` = ความลึก 0–4 (0 = ติดเส้นกลาง), `c` = เลน 0–6 · แปลงเป็นพิกัดกระดานด้วย `toBoard()` ใน `battle/engine/grid.ts` (ค่าคงที่ `SIDE_DEPTH`, `LANES`)
- ตัวละครวาดหันขวา: ฝั่งเราหันขวา ศัตรูกลับภาพ (`flip`) และหันตามเป้าหมายระหว่างสู้

## โครงสร้าง
- `src/app/core/models` ชนิดข้อมูล · `core/data` ข้อมูลเกม (ฮีโร่ ศัตรู ด่าน ค่าสาย) · `core/rules` สูตรคำนวณ (pure)
- `src/app/core/services` สถานะเกมผ่าน `SaveService.state` (signal เดียว บันทึก localStorage อัตโนมัติ)
- `src/app/battle/engine` เอนจินต่อสู้ TypeScript ล้วน ห้าม import Angular — ใช้ได้ทั้งในเกมและ `npm run sim`
- `src/app/battle/board`, `unit-sprite` แสดงผลกระดานและแอนิเมชัน (ตัวที่ไม่มีแถว walk ในแผ่น → กระเด้งทั้งตัวแทน, โทเคนไม่มี sprite → ย่อ/ขยาย/กะพริบตามท่า)
- `src/app/battle/placement` กระดานจัดตำแหน่ง (CDK drag-drop): ฝั่งขวาโชว์ศัตรูของชั้นที่เลือก, ฝั่งซ้าย 5×7 แต่ละช่องเป็น cdkDropList (วางด้วย grid-row/column ตาม toBoard), ม้านั่งเป็น drop list ถอดออก · แตะเลือกแล้วแตะช่องก็ได้ · บันทึกผ่าน `TeamService.place/remove/clear/auto`
  - `.unit` ที่เป็น cdkDrag ห้ามใช้ `inset`/`right`/`bottom` (CDK ซ่อนตัวต้นฉบับด้วย left:-999em → กลายเป็นแผ่นบังจอ ทำให้วางไม่ลง)
- `src/app/pages/*` หน้าจอ (ใช้งานได้: `/team` จัดทีม, `/lab?floor=N` ห้องทดลองต่อสู้ — ก่อนกดเริ่มจะแสดงกระดานจัดตำแหน่ง)
- `public/sprites` แผ่น sprite ช่องละ 132×100 (เท้า y=86, กลาง x=66, หันขวา) — จำนวนแถว/คอลัมน์และท่าของแต่ละแผ่นกำหนดใน `core/data/sprites.ts` (SHEETS) พร้อมเอฟเฟกต์สกิล (FX)
  - `hero-draken.png` 10×6: idle, hurt, die, attack, skill, skill2
  - `hero-aurel.png` 8×8: idle, walk, hurt, attack, skill, skill2, ult, die + `fx-aurel-{defense,charge,ult}.png` (สร้างด้วย `tools/sprites/extract-aurel.py`)
  - `hero-shade.png` 9×8: idle, walk, hurt, die, attack, skill, skill2, ult + `fx-shade-{teleport,smoke,phantom}.png` (`tools/sprites/extract-shade.py`) · FX ที่ `orient: 'flip'` ไม่หมุน แค่กลับซ้าย/ขวา
- นักฆ่า (assassin, เชด): สกิลสลับ จู่โจมเงา (วาร์ปไปข้างหลังศัตรูที่เลือด % ต่ำสุด ฟัน 200%) ↔ ควันพิษ (120% + พิษรอบเป้า 1 ช่อง 25% atk/วิ 4 วิ) · ท่าไม้ตายครั้งเดียวเมื่อมีศัตรูเลือด < 35% ในระยะ 4 ช่อง (วาร์ปไปฟัน 350% คริแน่นอน)
- แทงก์: สกิลสลับ ยั่วยุ ↔ พุ่งชนโล่ (160% ผลักถอย มึน 1 วิ) · ท่าไม้ตายครั้งเดียวเมื่อเลือด < 40% (โล่ตัวเอง 30% / เพื่อนในระยะ 2 ช่อง 15% ของเลือดสูงสุดแทงก์ 6 วิ + ยั่วยุ)

## คำสั่ง
- `npm start` รันเกมที่ http://localhost:4200
- `npm test` ยูนิตเทสต์ (เอนจินต่อสู้, TeamService, หน้าจัดทีม/ห้องทดลอง)
- `npm run sim -- 200` จำลองการต่อสู้ทุกชั้นแบบไม่แสดงผล ดูอัตราชนะ

## Roadmap
0 ตั้งโปรเจกต์ ✅ · 1 เอนจินต่อสู้ ✅ · 2 กระดานลากวาง + ภาพ ✅ · 3 หอคอยและโหมด · 4 ฐาน/รายชื่อ · 5 กาชา · 6 ปรับสมดุล

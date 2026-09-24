# ProjectGM — Summon Tower

เกมกาชา + จัดทีม + ต่อสู้อัตโนมัติแบบ TFT บนกระดาน 8×7 (ฝั่งละ 4×7) ทีมละ 5 ตัว
Angular 19, standalone components, signals. เอกสารออกแบบอยู่ในโปรเจกต์ "Game Demo" บน claude.ai

## กฎที่ล็อกไว้
- ไม่มีตายถาวร → ฮีโร่ที่ล้มบาดเจ็บ พัก 2 รอบ หรือจ่ายทองรักษา
- เงื่อนไขชนะใน Demo: กำจัดศัตรู (eliminate) และเอาตัวรอด (survive)
- ช่องสี่เหลี่ยม ระยะแบบ 8 ทิศ (แนวทแยง = 1 ช่อง)

## โครงสร้าง
- `src/app/core/models` ชนิดข้อมูล · `core/data` ข้อมูลเกม (ฮีโร่ ศัตรู ด่าน ค่าสาย) · `core/rules` สูตรคำนวณ (pure)
- `src/app/core/services` สถานะเกมผ่าน `SaveService.state` (signal เดียว บันทึก localStorage อัตโนมัติ)
- `src/app/battle/engine` เอนจินต่อสู้ TypeScript ล้วน ห้าม import Angular — ใช้ได้ทั้งในเกมและ `npm run sim`
- `src/app/battle/board`, `unit-sprite` แสดงผลกระดานและแอนิเมชัน (ตัวที่ไม่มีแถว walk ในแผ่น → กระเด้งทั้งตัวแทน, โทเคนไม่มี sprite → ย่อ/ขยาย/กะพริบตามท่า)
- `src/app/battle/placement` กระดานจัดตำแหน่ง (CDK drag-drop): ครึ่งบนโชว์ศัตรูของชั้นที่เลือก, ครึ่งล่าง 4×7 แต่ละช่องเป็น cdkDropList, ม้านั่งเป็น drop list ถอดออก · แตะเลือกแล้วแตะช่องก็ได้ · บันทึกผ่าน `TeamService.place/remove/clear/auto`
  - `.unit` ที่เป็น cdkDrag ห้ามใช้ `inset`/`right`/`bottom` (CDK ซ่อนตัวต้นฉบับด้วย left:-999em → กลายเป็นแผ่นบังจอ ทำให้วางไม่ลง)
- `src/app/pages/*` หน้าจอ (ใช้งานได้: `/team` จัดทีม, `/lab?floor=N` ห้องทดลองต่อสู้ — ก่อนกดเริ่มจะแสดงกระดานจัดตำแหน่ง)
- `public/sprites` แผ่น sprite ช่องละ 132×100 (เท้า y=86, กลาง x=66, หันขวา) — จำนวนแถว/คอลัมน์และท่าของแต่ละแผ่นกำหนดใน `core/data/sprites.ts` (SHEETS) พร้อมเอฟเฟกต์สกิล (FX)
  - `hero-draken.png` 10×6: idle, hurt, die, attack, skill, skill2
  - `hero-aurel.png` 8×8: idle, walk, hurt, attack, skill, skill2, ult, die + `fx-aurel-{defense,charge,ult}.png` (สร้างด้วย `tools/sprites/extract-aurel.py`)
- แทงก์: สกิลสลับ ยั่วยุ ↔ พุ่งชนโล่ (160% ผลักถอย มึน 1 วิ) · ท่าไม้ตายครั้งเดียวเมื่อเลือด < 40% (โล่ตัวเอง 30% / เพื่อนในระยะ 2 ช่อง 15% ของเลือดสูงสุดแทงก์ 6 วิ + ยั่วยุ)

## คำสั่ง
- `npm start` รันเกมที่ http://localhost:4200
- `npm test` ยูนิตเทสต์ (เอนจินต่อสู้, TeamService, หน้าจัดทีม/ห้องทดลอง)
- `npm run sim -- 200` จำลองการต่อสู้ทุกชั้นแบบไม่แสดงผล ดูอัตราชนะ

## Roadmap
0 ตั้งโปรเจกต์ ✅ · 1 เอนจินต่อสู้ ✅ · 2 กระดานลากวาง + ภาพ ✅ · 3 หอคอยและโหมด · 4 ฐาน/รายชื่อ · 5 กาชา · 6 ปรับสมดุล

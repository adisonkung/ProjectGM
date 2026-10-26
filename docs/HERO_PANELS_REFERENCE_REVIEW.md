# รายละเอียดฮีโร่ — ค่าสถานะ / สกิล / อุปกรณ์ / พัฒนา

2026-10-25 · ต่อจากผู้ใช้เลือกใช้กาชาแบบล่าสุดไปก่อน · ยังไม่ Deploy

อ่าน `docs/design/eldervane-ui/README.md` และเปิดภาพ 03 (stats/skills), 04 (equipment) ก่อนปรับ ส่วน banner ยึดโปสเตอร์ A ที่ผู้ใช้เลือก ไม่กลับไปใช้แผ่นข้อมูลลอยทับด้านขวา

- ค่าสถานะ: หกค่าจริง แยกพื้นฐาน/อุปกรณ์/รวม พร้อม Memory และปุ่มไปพัฒนา
- สกิล: โจมตีปกติและสามสกิลจริง ภาพเดิม ระดับปัจจุบัน/ระดับถัดไป เงื่อนไข วัสดุและทองจริง การแลกตำราอยู่ในแถบขยาย
- อุปกรณ์: สามช่องจริง อาวุธ/เกราะ/เครื่องประดับ พร้อมผลรวมจากของที่สวมและลิงก์คลัง/โรงตีเหล็ก ไม่เพิ่ม Relic gameplay
- พัฒนา: เพิ่มแท็บเข้าถึงอัปดาว ยา EXP, Breakthrough และช่องฝึก โดยใช้ handler/service เดิมทั้งหมด ภาพรวมยังเข้าถึงการพัฒนาได้เช่นเดิม
- กรอบทองเข้มหลายชั้น ปุ่มแดง lacquer และมุมตัดยึดงาน Tower/Dungeons ล่าสุด แยก stylesheet global ที่ scope เฉพาะ Hero Detail non-overview เพื่อไม่เพิ่ม component CSS ที่ใกล้งบจำกัด
- ภาพรวมเปลี่ยนเฉพาะการเพิ่มแท็บที่ห้า ส่วนโปสเตอร์ A/ข้อมูล/ส่วนประกอบเดิมคงไว้ แท็บย่อยใช้โปสเตอร์เตี้ยลงและปรับจุดวางภาพเพื่อให้เห็นเนื้อหาง่ายขึ้น

## ข้อมูลและภาพ

หลักฐานเป็น screenshot ของ production build ที่รันจริงบน Chromium ด้วย save fixture แยกจากผู้เล่น: เริ่มต้น Lv1, Lv3 สวมของจาก equipment rule จริง, Lv5 รอ Breakthrough และ Lv10/6★/R5 ใช้ template/registry จริงทั้งหมด ไม่คัดลอกตัวเลขใน design draft และไม่แก้สูตร/เศรษฐกิจ/save schema

EquipmentArtComponent ยังเป็น SVG ชั่วคราวเดิมของเกม ไม่ได้ gen งานอุปกรณ์ใหม่ ส่วน material mock inventory ดู `docs/art/material-icons/README.md` และ `backlog.json` (รอทำ art ภายหลังตามผู้ใช้)

## ตรวจสอบ

App/spec typecheck, production build และ Karma 818 tests ผ่าน ตรวจ interaction จริงบน fixture: สกิล R1→R2 ใช้ 300 ทอง/ตำรา1×2, 3★→4★ ใช้ 100 Hero Memory, Breakthrough Lv5→6/tier1 และวัสดุตรง pure rule รวมทั้ง keyboard tabs และ responsive หลายขนาด ดู validation.json ในชุดภาพ

ยังรอผู้ใช้ตรวจความสวยงามของแต่ละแท็บ ไม่ใช่การอนุมัติแทนผู้ใช้ มี warning เดิมเรื่อง bundle/component CSS และ Pixi CommonJS; build ไม่มี error และไม่ได้เพิ่ม budget

## ชุดภาพ

[เปิดสารบัญภาพ Desktop/Mobile และสถานะอื่น](https://github.com/adisonkung/ProjectGM/blob/7439f88d3dc23bdf1f3174e4c217aefc3e2da9d1/docs/review-images/2026-10-25-hero-panels/README.md) — docs-only ไม่ขยับ branch หรือ deploy

การเผยแพร่หลักฐานรอบนี้ไม่แนบ implementation.patch: automatic approval review ปฏิเสธการอัปโหลด source patch เนื่องจากยังไม่เห็นการอนุญาตเผยแพร่โค้ดสำหรับขั้นตอนนี้ จึงส่งเฉพาะภาพและผลตรวจ โค้ดอยู่ใน local task branch; ไม่มีการ retry patch ผ่านช่องทางอื่น

## สถานะหลังส่งภาพ

2026-10-25 ผู้ใช้ตอบ “ต่อเลย” หลังชุดภาพนี้ จึงผ่านรอบรีวิวและเริ่ม Battle ต่อ ยังไม่ใช่การอนุมัติ Deploy

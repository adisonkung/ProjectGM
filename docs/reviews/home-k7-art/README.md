# รีวิวภาพและแอนิเมชันหน้าหลัก K7

ภาพเกมจับจาก `/home` ใน Chrome ด้วยเซฟทดสอบชื่อจันทราพฤกษา ใช้ Bai Long เป็นภาพหน้าหลัก อ้างอิงตำแหน่งและสัดส่วนจากภาพบันทึก K7 ที่อยู่ใน repo ก่อนเพิ่มอาร์ต ส่วนผิวโลหะและโทนแสงอ้างอิงภาพ Hero Memory และ Fighter ตามสเปก ต้นฉบับ mockup ใน Claude Canvas ไม่อยู่ใน checkout นี้

| สถานะ | ภาพอ้างอิง K7 ใน repo | ภาพจากเกมจริง | คู่เทียบ |
|---|---|---|---|
| หน้าหลัก 1440 × 860 | [อ้างอิง](../home-k7/desktop-1440.jpg) | [เกมจริง](desktop.png) | [ภาพเทียบ](desktop-comparison.jpg) |
| มือถือแนวนอน 844 × 390 | [อ้างอิง](../home-k7/phone-844x390.jpg) | [เกมจริง](phone-landscape.png) | [ภาพเทียบ](phone-comparison.jpg) |
| เปิดเมนู 1440 × 860 | [อ้างอิง](../home-k7/desktop-menu-open.jpg) | [เกมจริง](desktop-menu.png) | [ภาพเทียบ](menu-comparison.jpg) |

ภาพอื่นจากเกมจริง [ดาบไขว้หลังฟันสองครั้ง](desktop-arena-crossed.png) · [ประตูดันเจี้ยนยกขึ้น](desktop-daily-open.png) · [เปิดเมนูบนมือถือ](phone-menu.png) · [Reduced Motion บนมือถือ](phone-reduced-motion.png)

คลิปจากเกมจริง [เดสก์ท็อป 1440 × 860](desktop.mp4) · [มือถือแนวนอน 844 × 390](phone-landscape.mp4)

ภาพใหม่ใช้หอคอย โคลอสเซียม และปากดันเจี้ยนเป็นฉากการ์ด พร้อมไอคอนโลหะที่วาดใหม่ ตำแหน่งการ์ดและปุ่มยึดภาพบันทึก K7 ไว้ จุดเปลี่ยนที่เห็นชัดคือเข็มทิศอยู่เต็มวงภายในกรอบ และหัวข้อผจญภัยใช้สีทองสว่างเพื่อให้อ่านง่ายบนฉากใหม่

ImageGen สร้างภาพแยกตามคำอธิบายรายไฟล์ใน [ชุดคำสั่งของสเปก K7](../../art/HOME_K7_ART_SPEC.md) โดยใช้ภาพสองชิ้นเป็นตัวอย่างวัสดุ [Hero Memory](../../../public/ui/gilded/hero_memory.webp) · [Fighter](../../../public/ui/generated/class/fighter.webp)

ต้นฉบับ PNG มี 40 ไฟล์และเก็บใน [assets/ui/home-k7](../../../assets/ui/home-k7) การส่งออก WebP ใช้ [import_home_k7.py](../../../tools/ui/import_home_k7.py) และแปลงพื้นดำของ VFX 4 แผ่นเป็น alpha

Typecheck ของแอปและเทสต์ผ่านทั้งหมด Production build ผ่าน และ Karma ผ่าน 1,014 เทสต์ ผลตรวจจังหวะใน Chrome อยู่ใน [browser-report.json](browser-report.json)

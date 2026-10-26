# Summon information — sheet17 review

2026-10-25 · ผู้ใช้ให้ต่อหลังกรอบ+พื้นหลังกระเป๋าชุด57b634d · branch fix/codex-summon-information-reference จากacbfd64 · ไม่Deploy

Routeหลักครบตามreview checklistแล้ว จึงแยกตรวจหน้าต่างย่อยอัญเชิญที่ก่อนหน้านี้อยู่ใต้รีวิวกาชารวม: รายชื่อในตู้ / อัตราและเงื่อนไข / Hero Memory เปิดอ่านREADMEและภาพ17ต้นฉบับก่อนแก้ ไม่แก้cinematic/flight/flutter/reveal/confirmation/resultหรือบริการสุ่ม

## การปรับ

- Classreference-summon-infoเฉพาะ3หน้าต่าง ไม่ครอบbanner/confirm/results ขอบทองสองชั้นมีร่องดำ/ลายมุม หัวข้อพร้อมiconทอง/คำอธิบาย/เส้นคั่น ใช้TowerOrnament+CitadelFrameเดิม โทนcharcoal/ทองเก่า/แดงไวน์ตามภาพ
- รายชื่อ:6คอลัมน์Desktop/3Mobile/2ที่จอแคบ320 อ่าน12ฮีโร่จริงจากHEROES พร้อมportrait/สาย/ดาวจริง มีชื่อตัวละครเพื่ออ่านรายชื่อ ไม่ใช้ฮีโร่หรือชื่อจำลองในภาพ นับจริง12/12
- Rates:ตารางระดับที่สุ่มได้60/32/8%, จำนวนฮีโร่จริง0/0/12, ราคาเดิม100/900จากGACHA, free-test flag/50pity/×10ขั้นต่ำระดับ2/empty-tier fallback/ไม่มีrateupยังชัดเจน ไม่ทำให้เข้าใจว่าอัตราดาวของฮีโร่ที่ได้รับตรงกับrolledtierในregistryปัจจุบัน
- Memory:ภาพประกอบใช้celestialcardbackกับportraitไป๋หลงที่มีอยู่ เพิ่มปริซึม/วงอัญเชิญSVGตกแต่ง ไม่ใช่ไอเทมหรือmaterialartใหม่ แบ่ง3แผงตามภาพ:ตัวซ้ำ→Memory60/80/110ตามbase tier, พัฒนาได้ถึง6ดาว/3→6ใช้500ตามSTAR_UP_COST, ตัวซ้ำเมื่อmax→Universalเดิม ปุ่มไปพัฒนาฮีโร่ยังrouteจริง
- กรอบdialog/หัวข้อ/ปิดอยู่กับที่ เลื่อนbodyภายในได้; openInfoรีเซ็ตscrollTopเป็น0เมื่อเปลี่ยน/เปิดข้อมูล เพื่อไม่ค้างตำแหน่งจากหน้าก่อน NativeEscape/focusrestoreเดิม
- Bannerยังใช้class/materialเดิม เพิ่มเฉพาะresetตำแหน่งเลื่อนร่วมของข้อมูล ไม่มีการเปลี่ยนcampaign/UR/limited/pool/rates/transactions/duplicateformula/economy/save

## ตรวจ

App/spec typecheck/productionbuild/824tests และNative browser Desktop1280×1000/Mobile390×844,320/768/1024: actualpool/class/star/count, rates/prices/pity/free/fallback, Memory60/80/110/500/Universal, bodyไม่ล้น/เลื่อนได้ถึงท้าย/ปิดยังมองเห็น/Escape/คืนfocus/เปิดใหม่เริ่มบน; ไปHeroesจริง; info/cancelไม่เปลี่ยนเซฟและไม่เริ่มอัญเชิญ; banner/confirmไม่รับclassใหม่

Warning/budgetเดิมคงอยู่ ไม่แก้budget ภาพจากisolatedsave ไม่ใช่บัญชีผู้ใช้ ไม่มีรีทัชหรือgenภาพจริง WebP losslessตรวจpixel round-trip

[เปิดคู่เทียบรายชื่อฮีโร่ / อัตรา / Hero Memory พร้อมภาพจริงและมือถือ](https://github.com/adisonkung/ProjectGM/blob/0fdc3280e5c035b2be0df4a9db1b8a74585d19b5/docs/review-images/2026-10-25-summon-information-reference/README.md) — ภาพ/index/validationเท่านั้น ไม่มีref update/Deploy

คู่เทียบซ้ายแบบ17/ขวาเกมจริง มีภาพเต็มจอ/เฉพาะdialog/mobileบนและล่าง/ต้นฉบับครบ ความต่างตามของจริง:portrait/รายชื่อ/ชื่อสาย, เพิ่มชื่อฮีโร่และข้อมูลจำนวน0/0/12/fallbackเพื่อไม่สื่ออัตราผิด และใช้artเดิมแทนMemoryillustrationสมมติ ไม่อ้างว่าทดสอบผ่านคือความเหมือนผ่านผู้ใช้ รอรีวิว ไม่มีDeploy เผยแพร่เฉพาะภาพ/index/validationไม่มีsource patch/ref update


## Hero Memory generated art replacement — 25 Oct2026

User requested a generated image like the reference, then clarified the figure must be an actual game hero and asked to replace the panel. Branch fix/codex-hero-memory-art from533d891. Imagegen edit uses canonical Bai Long portrait+banner as identity references and prior generated composition, preserving crystal/ritual/gold frame while restoring actual ponytail/white-navy embroidered robes/silver spear/white dragon. New hero-memory-bailong.webp (960px q94) only in Memory; original hero art unchanged. Replace old layered card/portrait/SVG markup with one optimized illustration, preserve frame/three explanation rows/actual values/actions, remove old mobile image max-height/mask. See docs/art/hero-memory/README.md +manifest. App/spec/build/824tests/native desktop+mobile/asset decode/rules/save checks. Source local; screenshot/index/validation publication only; no ref update/Deploy.

[เปิดภาพHero Memoryใหม่ที่อ้างอิงไป๋หลงในเกม พร้อม Desktop / มือถือ / คู่เทียบ](https://github.com/adisonkung/ProjectGM/blob/bb70d6f9a75fbeb08d4332a42986ac9bd0ce2324/docs/review-images/2026-10-25-hero-memory-art/README.md) — native screenshots/index/validationเท่านั้น ยังไม่Deploy

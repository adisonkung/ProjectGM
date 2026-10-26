# Lists, empty and error states — reference18

2026-10-25 · ผู้ใช้โอเคIslandรายละเอียดชุด9b08155แล้วให้ต่อ · branch fix/codex-list-empty-reference จาก4e6d801 · ไม่Deploy

อ่านREADMEและเปิดภาพ18จริงก่อนแก้ เปรียบเทียบรายการฮีโร่/ค้นหาว่าง/คลังว่าง/validation โดยรักษาภาพโปสเตอร์และหน้าอุปกรณ์2×2ที่ผู้ใช้เลือกไว้

- Hero list: portraitจริงครอปแนวนอน, ชื่อ+สาย, Lv, พลัง, ดาวและchevron ข้อมูลจากcardsเดิม7ตัวในเซฟทดสอบ ไม่ใช้5ตัว/พลังสมมติจากdraft Grid5คอลัมน์เดิมไม่เปลี่ยน
- Search: ปุ่มล้างคำค้นเฉพาะquery; browser native duplicate cancelซ่อน; emptyแสดงqueryที่escapeโดยAngularและแยกกรณีสายที่ไม่มีฮีโร่ ปุ่มดูทั้งหมดล้างquery+classเหมือนเดิม
- StateEmblemComponent: วงเข็มทิศSVGลายทองและiconsearch/เสื้อเกราะวาดเป็นUIvector ไม่ใช่materialartใหม่ ไม่แก้assetที่อนุมัติ
- Empty: ไม่มีแผงดำครอบกลาง ใช้แสงivoryเฉพาะหลังข้อความ สีเข้มอ่านบนฉากสว่าง ปุ่มแดงทองให้ทางกลับที่ใช้งานจริง พร้อมมือถือ
- Bag empty: คงhero/equipped2×2+Relicfutureทางซ้ายตามคำสั่งผู้ใช้ที่ใหม่กว่าreference18 จึงไม่แทนด้วยsidebarจำลองตามdraft ฝั่งกระเป๋ามีseal/ข้อความและHunt/Forge; filterไม่พบของมีปุ่มreset และข้อความถูกต้องเมื่อในกระเป๋ามีประเภทอื่น ไม่เหมารวมว่าไม่มีอุปกรณ์ทั้งบัญชี
- Hero UIDไม่พบ: ใช้ภาษาempty-state18Bพร้อมทางกลับcollection แบบไม่มีหน้าUIDผิดเฉพาะ จึงระบุความต่างในคู่เทียบ ไม่อ้างว่าเป็นstateเดียวกับค้นหา
- Account import error/success และForge disabledตรวจซ้ำจากหน้าเดิมที่ผู้ใช้ให้ผ่านรอบก่อน ไม่มีการออกแบบทับหน้าAccountหรือสูตร/codec

ไม่เปลี่ยนservices/rules/save/schema/gameplay/วัสดุ/เศรษฐกิจ ไม่มีDeployหรือsource publication

## ตรวจ

App/spec typecheck/productionbuild/824testsผ่าน มีwarning/budgetเดิม Browser native pointer+keyboardด้วยisolated save:7ฮีโร่จริง/list/filter/search/reset/clear/sort, unknownuid recovery, bagempty/Hunt/Forge, weaponfixture+accessoryempty/reset, invalidimportไม่เปลี่ยนเซฟ, rename noticeจริง, insufficientmaterials disabled,320/390/768/1024ไม่มีpagehorizontaloverflow

ภาพจริงไม่รีทัช ภาพแบบเดิมคงครบ LosslessWebPตรวจpixel round-trip บางภาพscrollบนมือถือเพื่อเปิดส่วนที่ต้องตรวจ ไม่ใช่ภาพmock

[เปิดคู่เทียบรายการ / ค้นหาไม่พบ / กระเป๋าว่าง / UIDไม่พบ พร้อมภาพจริงและมือถือ](https://github.com/adisonkung/ProjectGM/blob/31eb4ea5fefc9f4899523a54998919feae22ff9f/docs/review-images/2026-10-25-list-empty-reference/README.md) — ภาพ/index/validationเท่านั้น ไม่Deployหรืออัปเดตref

ซ้ายภาพ18ต้นฉบับ/ขวาเกมจริง มีfullviewport/mobile/สถานะแยกในindex รอผู้ใช้ตรวจสี/กรอบ/สัดส่วน ไม่ถือว่าผ่านงานภาพด้วยเทสต์ ไม่มีDeploy


### Bag frame follow-up — 25 Oct2026

User requested a frame around the equipment bag after31eb4e review. Branch fix/codex-armory-empty-frame fromb2036c0. Restore the existing double-gold cut-corner CitadelFrame around bag heading/filters/content when empty (including filter-empty), with transparent/soft-tinted SVG face so the existing scene/ivory empty-state stays readable. No gameplay/layout/data changes. App/spec/build+824tests; native320/390/768/1024 frame sizing/overflow, Hunt/Forge links and save invariance checked. Before/after uses the same1280×1000 viewport and isolated fixture; no screenshot retouch. Source local, publish screenshots/index/validation only, no ref update/Deploy.

[เปิดภาพกรอบกระเป๋าล่าสุด Desktop / มือถือ / ก่อน–หลัง](https://github.com/adisonkung/ProjectGM/blob/36b9272c1899aa1b8264ccd47d2935397c70c860/docs/review-images/2026-10-25-armory-empty-frame/README.md) — ภาพ/index/validationเท่านั้น ยังไม่Deploy


### Bag background follow-up — 25 Oct2026

User clarified the framed bag also needs a background. Branch fix/codex-armory-bag-background from1265341. Keep double-gold cut-corner frame, restore original opaque CitadelFrame charcoal gradient like equipped panel, replace ivory empty glow with subtle gold and change bag-empty heading/body to ivory/muted gold. CSS-only; actual data, approved2×2 and Hunt/Forge actions unchanged. App/spec/build/824tests +native desktop/mobile/frame sizing/contrast/save checks. Publish screenshots/index/validation only, no ref update/Deploy.

[เปิดภาพพื้นหลังกระเป๋าล่าสุด Desktop / มือถือ / ก่อน–หลัง](https://github.com/adisonkung/ProjectGM/blob/57b634dbca44b220c455f328be0c48f0ba3f7c11/docs/review-images/2026-10-25-armory-bag-background/README.md) — ภาพ/index/validationเท่านั้น ยังไม่Deploy

# Labs — Battle and animation review

2026-10-25 · ผู้ใช้ให้ต่อจากWelcome/Account แล้วขอ2เงื่อนไขท่าทดลอง ก่อนยืนยัน “ให้ตอนนี้เป็น GM ไปทั้งหมดก่อน” · source branch fix/codex-labs-reference จาก8b09074 · ยังไม่Deploy

อ่านภาพ15จริงก่อนแก้และกฎCombat/AnimationPipeline คงengine/คลิป/VFX/registry/เลนและจุดยืนเดิม ไม่ปรับbalanceหรือเปลี่ยนsprite

## UX/UI

- Lab: header/เลือก10ชั้น/ฉาก/ทีมA-B-C/จัดอัตโนมัติ/เริ่ม/จำลอง100รอบ/สำรอง/ตารางผลจริงตาม15A ใช้Placement.battleLayoutแบบopt-in โครงกริด5×16ยังเดิม มี18ช่องที่จัดได้ ครอปเฉพาะsceneryบน1แถวจาก2แถวเพื่อกระชับ โดยไม่ยืดภาพ/ลดจำนวนช่อง
- เมนูpresetมีz-indexเหนือการ์ด ปุ่มmobileจัดเป็นเริ่มเต็มแถวและauto+simulateแถวถัดไป; ตารางเลื่อนภายในได้ จอ320/390/768/1024ไม่ล้น
- SpriteLab: header/รูปเลือกฮีโร่/ฉากหุ่นฟาง/8actiontabs/ตัวเลือกเล่น/ข้อมูลคลิปและeventlogตาม15B ใช้ฉากforestจริงเป็นdefaultแต่querybgที่ถูกต้องยังเลือกฉากเดิมได้ ครอปเฉพาะsceneบน0.75แถวโดยคงboard/anchorในcoordinateเดิม
- metadataใช้animOf/clipClockจากregistryจริง (idleใช้IDLE_FRAME_MSตามrenderer) ระบุFPS/ความยาวที่×1; log/จังหวะเอฟเฟกต์เดิม ไม่ใส่ตัวเลข24/30/256จากmock

## GM / ผู้เล่น

- GameAccessServiceอ่านDEV_FLAGS.allPlayersAreGm ซึ่งตั้งtrueตามคำสั่งล่าสุด ทุกคนตอนนี้เป็นGM; ไม่มีระบบlogin/identityจริงเพิ่มในงานนี้
- GMเห็นIdle/Walk/Attack/Hurt/Die/S1/S2/ULTครบ8ท่า รวมcontrolRoot/Anchor/rendererและข้อมูลคลิป/log
- เมื่อเงื่อนไขGMเป็นfalse ผู้เล่นเห็นเฉพาะS1/S2/ULT ตรวจในplay()ด้วยก่อนclear/เปลี่ยนanimation ไม่ใช่ซ่อนแค่ปุ่ม GMในURLหรือsaveไม่เปลี่ยนนโยบายนี้
- flagเป็นจุดชั่วคราวก่อนผูกสิทธิ์บัญชีจริง ไม่เพิ่มGM toggleบนหน้าเว็บหรือเก็บroleในsave; โหมดผู้เล่นยังไม่เปิดใช้ตอนนี้
- ทุกskillใช้kit/clipจริงและfallbackที่มีอยู่เมื่อยังไม่มีclipเฉพาะ ไม่สร้างอาร์ตท่าใหม่ให้ดูเหมือนมีcontentเพิ่ม

## ตรวจจริง

App/spec typecheck, production buildและKarma824ผ่าน (เพิ่ม2เคสGM8ท่า/ผู้เล่น3ท่า+ปฏิเสธdirect basic actionแม้URLมีgm=1) Budgetไม่เพิ่ม มีwarningชุดเดิม

Browserใช้isolated save: 10stageจริง/18legalcellsอยู่ครบในกรอบcroppedscene; engineจำลอง100จริงผลรวมwin+nonwin100และเวลาเฉลี่ยจริง ไม่มีGameStateเปลี่ยน; presetBsave/load/tapวาง/auto5ทำงาน; sandboxจริงpause/resume/resultไม่ให้รางวัลและไม่เปลี่ยนGameState; SpriteGM8actions/S1semanticFX/S2/ULTlog/loop/speed/flip/anchors/Pixi↔DOM/hero picker/metadataจริงและไม่แก้GameState; mobile320/390/768/1024ไม่ล้น; realbattle routeยังเป็นreference-battleไม่ถูกlabstyles

การจัดทีมยังใช้TeamServiceและบันทึกตำแหน่งตามเดิม จึงระบุในheaderชัดเจนว่าผลต่อสู้ไม่กระทบเซฟ แต่จัดทีมร่วมกับเกม ไม่อ้างว่าทุกinteractionในLabไม่มีผลกับเซฟ

## ภาพคู่เทียบ

[เปิดภาพคู่เทียบ Lab / ท่าทดลอง พร้อมภาพจริง Desktop และมือถือ](https://github.com/adisonkung/ProjectGM/blob/f5dcb9a7098a6440f8e8520bbea09d33d5d5d998/docs/review-images/2026-10-25-labs-reference/README.md) — ตรวจ17ลิงก์ HTTP200/ไฟล์ตรงต้นฉบับแล้ว ภาพ/สารบัญ/ผลตรวจเท่านั้น ยังไม่Deploy

ซ้ายภาพ15ต้นฉบับ/ขวาเกมจริง พร้อมแยกnativeDesktop/mobile/combat/result/renderer และผลตรวจ WebP losslessตรวจpixel round-trip ไม่มีการรีทัชscreenshot

ความต่างที่คงของจริง: ชื่อ/รูป/สกิล/ขนาดsheet/FPS/เวลา/ผลจำลอง/ศัตรูจากstageจริง และ5×16/18ช่อง ไม่ใช้การยืน5ตัวแถวเดียวหรือมอนสเตอร์สมมติจากdraft กรอบวาดใหม่/ฉากจริงต้องให้ผู้ใช้ตรวจ ไม่อ้างว่าเหมือนทุกpixelจากเทสต์ผ่าน ไม่มีDeploy/remote ref update เผยแพร่เฉพาะภาพ/index/validation

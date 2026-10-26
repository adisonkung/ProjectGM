# เพิ่มสถานะฮีโร่5แบบ — Eldervane

26 ต.ค.2026 · ต่อจากชุด31เดิม รวมเป็น36สถานะ · สาขา `wip/codex-status-icon-art` · ยังไม่merge/Deploy

## ภาพตรวจ

- [เฉพาะ5แบบใหม่จากเกมจริง](review/new-five-desktop.webp)
- [อาร์ตต้นฉบับเทียบภาพในเกม](review/art-comparison.webp) · [แผ่นอาร์ตโปร่งใส](../../../../public/ui/status/hero-guards.webp)
- [Garrick S1: ตั้งรับ + ตั้งรับสวนกลับ](review/garrick-s1-desktop.webp) · [จอแนวนอน](review/garrick-s1-landscape.webp)
- [Garrick Ultimate: ประตูเหล็ก + ยืนหยัด](review/garrick-ult-desktop.webp)
- [Tang Xun S2: แผลเปิดหลังมีดครั้งที่3](review/tangxun-s2-desktop.webp)
- [สถานะครบ36แบบ](review/all36-desktop.webp) · [มือถือ](review/all36-mobile.webp)

## ขอบเขต

| IDเดิม | ชื่อ | ภาพ |
| --- | --- | --- |
| taunt_guard | ตั้งรับ | โล่ฟ้าปัดลูกศรแดง |
| open_wound | แผลเปิด | รอยแยกแดงในเกราะแตก |
| brace_counter | ตั้งรับสวนกลับ | โล่/ดาบ/ลูกศรวนกลับทอง |
| gate_ward | ประตูเหล็ก | ซุ้มป้องกันฟ้าเชื่อมโล่พันธมิตร3จุด |
| gate_stance | ยืนหยัด | รองเท้าฝังฐานหินและรูนยึดพื้นทอง |

- Gen1แผ่นโปร่งใส3×3 มี5ช่องใช้จริง/4ช่องว่าง; runtimeWebP1024 แสดงช่องเต็มผ่านStatusIconComponentเดิม ไม่ตัดแต่งชิ้นงาน
- เพิ่ม5IDในdisplay allowlist `STATUS_ICONS` จึงแสดงได้จริงในBattle/Sprite Lab ไม่ได้มีเพียงรูปในคลัง
- แก้snapshotแสดงผลของSprite Labให้รวมสถานะของผู้ร่ายเอง เดิมมีเฉพาะสถานะเป้าหุ่นฝึก ทำให้บัฟตนเองไม่ปรากฏในหน้าทดลองแม้engineคำนวณแล้ว
- กติกาeffects/ค่าพลัง/ระยะเวลา/เงื่อนไขมีดครั้งที่3/เซฟ ไม่เปลี่ยน ไม่มีอาร์ตหรือไฟล์มอนสเตอร์ถูกแก้ในงานนี้
- ตามคำสั่งผู้ใช้: **พักGenมอนสเตอร์/บอสจนฮีโร่ครบ** และหินรายฮีโร่ยังพักรอPortrait

## ผลตรวจ

App/spec typecheck, production build, **835/835testsผ่าน** รวมtestผู้ร่ายGarrickแสดงS1/Ultimate guardsจริง ยังคงมีstyle/Pixi warningsตามเดิม ไม่เพิ่มbudget

[Native validation](review/validation.json):สถานะรวม36แบบ ภาพdesktop1440×1000/mobile390×844/landscape844×390, enginepreviewจริงของGarrickและTangXun, เวลาคงเหลือลดลงจริง ไม่มีfallbackรูปหาย/pageerror/แนวนอนล้น และเซฟไม่เปลี่ยน การแสดงผลDOM/Pixiใช้Boardร่วมกัน

ภาพจากbrowserไม่แต่งเฟรมเกม; คลังแสดง72/28/22pxสำหรับเทียบความอ่านง่าย ไฟล์ต้นฉบับ/คำอธิบาย/hash/alpha/ตำแหน่งอยู่ใน[manifest](manifest.json)

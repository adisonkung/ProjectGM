# สเปกภาพ: ไอคอน UI + VFX (Gilded Ember) — ชุดที่ 1 · หน้าฮีโร่ / แท็บพัฒนา

> สำหรับให้ผู้ใช้ gen ภาพด้วย AI แล้วส่ง ZIP กลับมา · Claude ตัดพื้น ตั้ง pivot และใส่เข้าเกมเอง
> ทิศทางภาพ = Gilded Ember (`src/app/shared/_gilded.scss`): ดำอุ่น · ทองแชมเปญ · แดงเบอร์กันดี · ลายหลักคือดาวประกาย 4 แฉก + วงแหวนทองโลหะ · ห้ามม่วงหรือน้ำเงินเป็นสีหลัก
> **ภาพอ้างอิงสไตล์ที่ต้องการ**: `public/ui/generated/items/materials/universal_memory.webp`, `public/ui/generated/class/fighter.webp`
> (ทองโลหะขัดเงา + อัญมณีใส ลายเส้นภาพวาดคมระดับเกมกาชา ไม่ใช่ flat icon / pixel art)

## กติกาไฟล์ (ทุกชิ้น)

| ประเภท | ขนาด | พื้นหลัง | หมายเหตุ |
|---|---|---|---|
| **ไอคอน** (ข้อ A–C) | 1024 × 1024 ต่อชิ้น | **โปร่งใส (PNG alpha)** ถ้าทำไม่ได้ ใช้พื้นขาวล้วน | วัตถุอยู่กลางภาพ เว้นขอบ ~8 % · มุมมองตรงหน้า · 1 ไฟล์ = 1 ไอคอน |
| **VFX** (ข้อ D) | แผ่นเดียว กริด **4 × 3 = 12 เฟรม** ช่องละ 512 × 512 | **ดำสนิท #000000** (แสงบวก) | ทุกเฟรมจุดศูนย์กลางเดียวกัน · ห้ามมีตัวเลข/ป้าย/เส้นกริด · เฟรม 1 = เริ่ม, 12 = จางหมด |

ตั้งชื่อไฟล์ตามคอลัมน์ "ชื่อไฟล์" แล้วรวมเป็น ZIP เดียว

## Prompt หลัก (ใส่หน้าทุก prompt)

```
premium fantasy gacha game UI icon, polished champagne gold metal with fine engraved filigree,
warm amber inner glow, crystal-clear gemstone facets, painterly high-detail rendering,
soft rim light, centered, front view, isolated on transparent background, no text, no border
```

สำหรับ VFX ใช้ prompt นี้แทน:

```
fantasy game VFX sprite sheet, 4 columns x 3 rows grid, 12 animation frames read left-to-right,
top-to-bottom, golden and warm white light, champagne gold sparks, additive glow,
pure black background, same center point every frame, no text, no grid lines
```

## A. ดาว (แทนดาวที่วาดด้วยโค้ดทั้งหมด)

| ชื่อไฟล์ | คืออะไร | prompt เพิ่ม |
|---|---|---|
| `star_lit.png` | ดาวที่ได้แล้ว | `a five-pointed star medallion of polished gold with a faceted amber-gold gem core, radiant, slightly 3D bevel` |
| `star_empty.png` | ช่องดาวที่ยังไม่ได้ | `the same five-pointed star shape as an empty dark bronze socket, unlit, engraved outline, no gem, matte` |
| `star_awakened.png` | ดาว 6★ (ตื่นพลัง) | `the same star medallion in rose-gold with a pink crystal core and tiny floating sparkles` |

ทั้ง 3 ภาพต้อง**รูปทรงและขนาดดาวเท่ากันเป๊ะ** (สลับกันแล้วไม่ขยับ) — แนะนำ gen `star_lit` ก่อน แล้วสั่งแก้จากภาพนั้นเป็นอีก 2 แบบ

## B. กรอบและเครื่องประดับ

| ชื่อไฟล์ | คืออะไร | prompt เพิ่ม |
|---|---|---|
| `ring_frame.png` | วงแหวนทองรอบไอคอน (ไอคอนยา/หิน/สกิล/ฮีโร่) | `an ornate circular gold ring frame, thin double rim, four small four-pointed star ornaments at top/bottom/left/right, hollow transparent center` |
| `sparkle.png` | ดาวประกาย 4 แฉก (ลายหลัก) | `a single four-pointed sparkle star, gold and white light, sharp thin rays, soft glow` |
| `divider.png` | เส้นคั่นหัวข้อ (กว้าง 2048 × 256) | `a thin horizontal gold filigree divider line fading at both ends, a four-pointed sparkle in the center` |

## C. ไอคอนพัฒนาฮีโร่

| ชื่อไฟล์ | คืออะไร | prompt เพิ่ม |
|---|---|---|
| `hero_memory.png` | Hero Memory (ของเฉพาะตัวฮีโร่) | `a glowing memory crystal shard in a small gold cradle, warm amber light swirling inside, faint silhouette of a warrior inside the crystal` |
| `star_up.png` | ไอคอนปุ่ม/หัวข้อ "พัฒนาดาว" | `a gold star rising above an ornate gold pedestal with an upward arrow of light` |
| `level_up.png` | ไอคอน "เลเวล" | `an ornate gold upward chevron emblem with an amber gem, rays of light` |
| `breakthrough.png` | ไอคอน Breakthrough | `a cracked crimson-and-gold seal breaking open with golden light bursting from the crack` |
| `training_slot.png` | ช่องฝึก | `a gold training dummy emblem on a small round shield, crossed practice swords behind` |

## D. VFX (เล่นตอนกดพัฒนา)

| ชื่อไฟล์ | ใช้ตอน | prompt เพิ่ม |
|---|---|---|
| `vfx_starup_pillar.png` | กดอัปดาว: ลำแสงพุ่งขึ้นจากเหรียญดาว | `a vertical pillar of golden light rising from a glowing ground ring, frames 1-4 ignite, 5-8 full intensity with sparks spiraling upward, 9-12 fade out` |
| `vfx_starup_burst.png` | ดาวดวงใหม่ติดไฟ | `a golden star ignites and bursts: frames 1-3 small bright core, 4-6 explosive radial burst with eight long light rays and gold shards, 7-12 shards drift outward and fade` |
| `vfx_levelup_ring.png` | ใช้ยา / เลเวลอัป | `an expanding golden shockwave ring on the ground seen at a slight angle, with rising gold motes, ring grows from small to large and fades` |
| `vfx_breakthrough.png` | Breakthrough สำเร็จ | `a crimson-and-gold seal circle shatters into glowing fragments with a bright white-gold flash in the center` |

## หลังได้ภาพ (ฝั่ง Claude)

1. วางต้นฉบับใน `assets/ui/gilded/` (track แล้ว ห้ามแก้) → สคริปต์ตัดพื้น/ปรับขนาด → `public/ui/gilded/*.webp` (ไอคอน 256 px, VFX ย่อเป็นแผ่นเฟรม)
2. ดาวทุกจุด (แท็บพัฒนา, ข้างชื่อ, รายชื่อฮีโร่) ใช้ `star_lit` / `star_empty` / `star_awakened` แทนดาวเดิม
3. ฉากอัปดาว: จอมืดลงนิดหนึ่ง → `vfx_starup_pillar` บนเหรียญดาวถัดไป → `vfx_starup_burst` ตอนดาวติด → ตัวเลขค่าพลังนับขึ้น (Pixi/DOM; ลดการเคลื่อนไหว = แค่เปลี่ยนสถานะ)
4. เทียบภาพก่อน/หลังในเกมจริง แล้วส่งให้ผู้ใช้ดูก่อน merge

ตอนนี้ (ก่อนได้ภาพชุดนี้) ใช้ดาวทองจากชุดที่มีอยู่ `public/ui/symbols/emblems.webp` (`app-ui-symbol name="star"`) ไปก่อน

"""Export S2 review PNG/XLSX/JSON from actual runtime data; no source sprite edits.
python3 tools/sprites/vaelric_s2_sync.py runtime.json [output dir]
"""
import json
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from openpyxl import Workbook

runtime = json.loads(Path(sys.argv[1]).read_text())
out = Path(sys.argv[2] if len(sys.argv)>2 else 'docs/timelines/vaelric')
out.mkdir(parents=True,exist_ok=True)
clip=runtime['clip'];ms=clip['ms'];hits=clip['events']['DAMAGE'];weights=runtime['kit']['repeat']['weights']
character=[]
for f in range(25):
    hit=hits.index(f) if f in hits else None
    character.append({'frame':f+1,'start':f*ms/1000,'end':(f+1)*ms/1000,
                      'event':f'HIT {hit+1}' if hit is not None else 'PREPARE' if f<8 else 'RECOVERY' if f>=19 else 'FOLLOW_THROUGH',
                      'weight':weights[hit] if hit is not None else None,
                      'impactRow':hit+1 if hit is not None else None,'defDown':hit==2})
fx=[]
for row,start in enumerate(runtime['timing']['hits'],1):
    for frame in range(8):
        fx.append({'row':row,'frame':frame+1,'start':start+frame/24,'end':start+(frame+1)/24,'attach':'FIXED_FORWARD_2X3_AREA'})
actual=[]
for review in runtime['reviews']:
    for sample in review['samples']:
        damage=[e for e in sample['events'] if e['type']=='damage']
        if damage:actual.append({'direction':review['direction'],'time':sample['t'],'hits':len(damage),
                               'defDown':len([e for e in sample['events'] if e['type']=='buff' and e['buff']=='curse_mark'])})
data={'hero':'vaelric','skill':'Hollow Requiem','characterFps':20,'impactFps':24,'area':'2 forward columns x3 lanes',
      'character':character,'impact':fx,'actualEngine':actual,'notes':['Stationary, facing locked until1.25s',
      'One shared middle-lane Main per hit, content-cut complete poses at retained12.5% enlargement, visible base locked to caster feet; damage area remains2x3',
      'Fixed source waist anchor removes VFX-driven body recoil; poses/timing/scale unchanged',
      'F24 isolated white fragments removed by user request; originals unchanged','All25 poses/main baked slashes preserved']}
(out/'vaelric-s2-sync.json').write_text(json.dumps(data,indent=2)+'\n')
wb=Workbook();wb.remove(wb.active)
for name,rows in [('Character',character),('Impact',fx),('ActualEngine',actual)]:
    ws=wb.create_sheet(name);keys=list(rows[0]);ws.append(keys)
    for row in rows:ws.append([row[k] for k in keys])
    ws.freeze_panes='A2';ws.auto_filter.ref=ws.dimensions
    for col in ws.columns:ws.column_dimensions[col[0].column_letter].width=24
wb.save(out/'vaelric-s2-sync.xlsx')
font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',17)
small=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',14)
im=Image.new('RGB',(1100,1050),'#131824');d=ImageDraw.Draw(im)
d.text((25,20),'VAELRIC - HOLLOW REQUIEM / S2 TIMELINE',font=font,fill='#f1dac4')
d.text((25,50),'25 original poses at20FPS | stationary2x3 area | impacts3x8 at24FPS',font=small,fill='#c2c9d6')
atlas=Image.open('public/sprites/hero-vaelric.png').convert('RGBA')
for i,row in enumerate(character):
    x=25+i%5*215;y=95+i//5*175
    d.rectangle((x,y,x+205,y+165),outline='#d77587' if row['impactRow'] else '#3a4255',width=2)
    f=atlas.crop((i*260,6*170,(i+1)*260,7*170));f.thumbnail((200,130))
    im.paste(f,(x+3,y+5),f)
    d.text((x+8,y+133),f"F{i+1:02}  {row['start']:.2f}s"+(f" HIT{row['impactRow']}" if row['impactRow'] else ''),font=small,fill='#f3c0c9' if row['impactRow'] else '#ccd4e3')
d.text((25,985),'Hits:0.40 /0.65 /0.90s | DEF Down only on successful Hit3 | End1.25s',font=small,fill='#edd1bd')
d.text((25,1015),'Grounded Main: every visible base at caster feet; damage2x3; each lasts0.333s.',font=small,fill='#c2c9d6')
im.save(out/'vaelric-s2-sync.png')
print('Exported PNG, XLSX and JSON runtime sync tables')

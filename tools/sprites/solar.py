"""Bake approved Solar V2 sources; physical eye/halo poses and native VFX remain separate.
python3 tools/sprites/solar.py; then npm run sprites:optimize.
"""
from pathlib import Path
from PIL import Image,ImageDraw,ImageOps
import math,numpy as np,json,subprocess,sys,tempfile,hashlib
from solar_motion import animation_pose,env,smooth,star,TAU
from solar_light import charge_light
R=Path(__file__).resolve().parents[2];SRC=R/'assets/bosses/Solar';OUT=R/'public/sprites';REPORT=R/'docs/art/solar';REPORT.mkdir(parents=True,exist_ok=True)
T=Path(tempfile.mkdtemp(prefix='solar-bake-'));(T/'source').symlink_to((SRC/'source/fx').resolve())
subprocess.run([sys.executable,str(Path(__file__).with_name('solar_fx_cut.py')),str(T)],check=True)
meta=json.loads((T/'vfx-manifest.json').read_text());FX={}
for n,m in meta.items():
 im=Image.open(T/'prepared'/f'{n}.png').convert('RGBA');w,h=m['preparedCell'];FX[n]=[im.crop((i*w,0,(i+1)*w,h)) for i in range(m['frames'])]
banks=[];scales=[260/336,260/252];pivots=[(256,255),(256,254)]
for bi,p in enumerate([SRC/'source/character/2222-attack1.png',SRC/'source/character/2222-attack2 (3).png']):
 im=Image.open(p).convert('RGBA');bank=[];s=scales[bi]*.5
 for i in range(56):
  x=i%8*512;y=i//8*512;tile=im.crop((x,y,x+512,y+512));tile=tile.resize((round(512*s),round(512*s)),Image.Resampling.LANCZOS)
  bank.append(tile)
 banks.append(bank)
layers=[]
for p in sorted((SRC/'source/halo').glob('*.png')):
 im=Image.open(p).convert('RGBA');l,t,r,b=im.getbbox();tile=im.crop((l,t,r,b));tile=tile.resize((round(tile.width*.2),round(tile.height*.2)),Image.Resampling.LANCZOS)
 cx=((l+r)/2-627)*.2;cy=((t+b)/2-620)*.2
 if p.stem=='halo-top-tip':cy-=8
 if p.stem=='halo-bottom-tip':cy+=8
 layers.append((tile,cx,cy))
W,H,COLS=336,360,48;CX,CY=168,198

def actor(name,t,dur):
 p=animation_pose(name,t,dur);out=Image.new('RGBA',(W,H))
 for j,(tile,cx,cy) in enumerate(layers):
  a=math.radians(p['angle']);op=1+p['opening'];xx=(cx*math.cos(a)-cy*math.sin(a))*op;yy=(cx*math.sin(a)+cy*math.cos(a))*op;rot=p['angle'];drop=0
  if name=='break':rot+=p['opening']*math.sin(t*3+j)*36
  if name=='death':
   # Compact shutdown keeps every still-visible physical part inside its runtime cell.
   xx=cx*(1+p['death']*.05);yy=cy*(1+p['death']*.05);drop=p['death']**2*12;rot+=(j-3.5)*p['death']*10
  f=tile
  if p['dim']!=1:
   from PIL import ImageEnhance
   f=ImageEnhance.Brightness(f).enhance(max(.2,min(1.2,p['dim'])))
  if p['opacity']<1:f=f.copy();f.putalpha(f.getchannel('A').point(lambda a:round(a*p['opacity'])))
  f=f.rotate(-rot,Image.Resampling.BICUBIC,expand=True)
  out.alpha_composite(f,(round(CX+xx-f.width/2),round(CY+p['hover']*.5+yy+drop-f.height/2)))
 bi=p['bank'];s=scales[bi]*.5;px,py=pivots[bi];tile=banks[bi][p['idx']]
 from PIL import ImageEnhance
 if p['dim']!=1:tile=ImageEnhance.Brightness(tile).enhance(p['dim'])
 if p['opacity']<1:tile=tile.copy();tile.putalpha(tile.getchannel('A').point(lambda a:round(a*p['opacity'])))
 if p['tilt']:tile=tile.rotate(-p['tilt'],Image.Resampling.BICUBIC)
 out.alpha_composite(tile,(round(CX-px*s+p['kick']*.5),round(CY-py*s+p['hover']*.5)))
 # Canonical right-facing source, enemy renderer mirrors once at runtime.
 return ImageOps.mirror(out)
rows=[];mapping=[]
def row(clip,name,times,dur):
 rows.append([actor(name,t,dur) for t in times]);mapping.append({'clip':clip,'row':len(rows),'samples':times})
row('idle','idle',[i*6/48 for i in range(48)],6);row('move','idle',[i*6/24 for i in range(24)],6)
row('hurt','hurt',[.8+i*.04 for i in range(6)],4);row('death','death',[.65+i*.22 for i in range(20)],6)
row('attack','normal',[.65+i*.05 for i in range(28)],6)
row('seals','skill-1',[.65+i*2.7/30 if i<=30 else 3.35+(i-30)*.06 for i in range(48)],6)
row('sweep','skill-2',[.65+i*2/24 if i<=24 else 2.65+(i-24)*.11 for i in range(48)],8)
row('eclipse','skill-3',[.65+i*3/30 if i<=30 else 3.65+(i-30)*.08 for i in range(48)],8)
row('broken','break',[.75+i*.1 if i<4 else 1.15+(i-4)*3.1/20 if i<24 else 4.25+(i-24)*.1 for i in range(30)],6)
a=Image.new('RGBA',(W*COLS,H*len(rows)))
for y,frames in enumerate(rows):
 for x,f in enumerate(frames):a.alpha_composite(f,(x*W,y*H))
a.save(OUT/'enemy-solar-oculus.png',optimize=True)

outmeta={}
def save(key,frames,size=None):
 if size:frames=[f.resize(size,Image.Resampling.LANCZOS) for f in frames]
 w,h=frames[0].size;a=Image.new('RGBA',(w*len(frames),h))
 for i,f in enumerate(frames):a.alpha_composite(f,(i*w,0))
 file=f'fx-solar-{key}.png';a.save(OUT/file,optimize=True);outmeta[key]={'file':file,'frames':len(frames),'w':w,'h':h}

def alpha(f,a):
 f=f.copy();f.putalpha(f.getchannel('A').point(lambda x:round(x*max(0,min(1,a)))));return f

def charge(t):
 f=Image.new('RGBA',(384,384));age=t
 if age<.5:parts=[(FX['solar-eye-charge-in'][min(7,int(age/.5*8))],1)]
 else:
  c=smooth((age-.5)/.15);parts=[(FX['solar-eye-charge-in'][7],1-c),(FX['solar-eye-charge-held'][0],c)]
 for c,a in parts:
  c=alpha(c,a);f.alpha_composite(c.resize((360,360),Image.Resampling.LANCZOS),(12,12))
 d=ImageDraw.Draw(f);charge_light(d,192,192,t,1,1.05)
 return f
save('charge',[charge(i*.05) for i in range(60)],(256,256));save('charge-short',[charge(i*.05) for i in range(19)],(256,256))

def floor_stream(prefix,n):
 frames=[]
 for i in range(n):
  t=i*.05
  if t<.62:f=FX[prefix+'-in'][min(7,int(t/.62*8))].copy()
  else:
   c=smooth((t-.62)/.18);f=alpha(FX[prefix+'-in'][7],1-c);f.alpha_composite(alpha(FX[prefix+'-held'][0],c))
  d=ImageDraw.Draw(f)
  for j in range(7):
   q=t*1.7+j*TAU/7;star(d,256+202*math.cos(q),380+40*math.sin(q),4,(255,241,182,220))
  frames.append(f)
 return frames
save('seal',floor_stream('solar-seal',40),(256,256));save('ground-charge',floor_stream('solar-ground-charge',60),(360,360))
save('seal-impact',FX['solar-seal-impact'],(320,320));save('judgement-impact',FX['solar-judgement-impact'],(360,360));save('hit',FX['solar-hit-impact'],(160,160));save('death',FX['solar-death-dissolve'],(320,320))
save('emitter',[ImageOps.mirror(FX['solar-beam-emitter'][0])],(256,256))
# Native shaft repeated with overlap and room above/below the glow. Only this texture may change length.
beams=[]
for c in FX['solar-beam-body']:
 c=c.resize((384,120),Image.Resampling.LANCZOS);f=Image.new('RGBA',(768,120))
 for x in range(0,768,352):f.alpha_composite(c,(x,0))
 beams.append(f)
save('beam',beams)
# Projectile head is centred; separate transparent arrival frame prevents a lingering arrow on the target.
c=ImageOps.mirror(FX['solar-bolt'][0]);f=Image.new('RGBA',(256,128));c=c.resize((205,205),Image.Resampling.LANCZOS);f.alpha_composite(c,(round(128-384*.4),round(64-256*.4)))
save('bolt',[f,Image.new('RGBA',(256,128))])
save('break',[alpha(f,.4) for f in FX['solar-hit-impact'][4:]],(160,160))
# Retain the three exact uploaded arenas; public copies are encoded for runtime loading.
from PIL import Image as PILImage
for key,name in [('aegis','Celestial Palace Battle Terrace.png'),('jadecrest','Misty Temple Courtyard Arena.png'),('solar','Celestial Observatory Arena at Eclipse (1).png')]:
 PILImage.open(R/'assets/backgrounds/ascension'/name).convert('RGB').save(R/'public/backgrounds'/f'ascension-{key}.webp',quality=93,method=6)
(REPORT/'bake.json').write_text(json.dumps({'character':{'file':'enemy-solar-oculus.png','cols':COLS,'cell':[W,H],'root':[CX,H-14],'rows':mapping},'fx':outmeta,'nativeFx':meta,'sources':json.loads((SRC/'manifest.json').read_text()),'reference':'Solar V2 charge + fade-only offscreen beam','death':'compact physical-part shutdown to keep visible parts inside the runtime cell'},indent=2))
print('Solar bake complete:',len(rows),'character rows,',len(outmeta),'FX strips, 3 arenas',flush=True)

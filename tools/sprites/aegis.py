"""Bake user-supplied Aegis assets. No redraw of character art; native alpha, shared scale and anchors.
Run: python3 tools/sprites/aegis.py [source-directory]
RGB VFX checkerboards are keyed/unmixed; barrier idle = one held dome + periodic code-drawn orbit.
"""
from pathlib import Path
import sys,json,math
from functools import lru_cache
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageOps,ImageChops
ROOT=Path(__file__).resolve().parents[2]
SRC=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'assets/bosses/Aegis'
OUT=ROOT/'public/sprites';REPORT=ROOT/'docs/art/aegis';REPORT.mkdir(parents=True,exist_ok=True)
W,H=340,280;COLS=24;SCALE=180/252  # helmet-to-sole body, excluding upright spear
# Source bodies face left. Bake canonical right; enemy facing is applied by the game.
@lru_cache(None)
def source(name):return Image.open(SRC/(name+'.png')).convert('RGBA')
def frame(name,i):
 im=source(name)
 return im.crop((i%8*512,i//8*512,i%8*512+512,i//8*512+512))
def actor(im,dx=0):
 im=ImageOps.mirror(im).resize((round(512*SCALE),round(512*SCALE)),Image.Resampling.NEAREST)
 dst=Image.new('RGBA',(W,H));dst.paste(im,(round(W/2-(512-264)*SCALE+dx),round(H-14-414*SCALE)),im)
 return dst
# Use one cycle of idle, corrected 24-frame walk, base recoil; S2 pose reused for thrust.
rows=[('idle',list(range(0,48,2))),('aegis-walk-loop-24',list(range(24))),('idle',[0]*6),
 ('death',[0,8,11,13,15,17,19,21,23,25,27,29,31,33,35,39,43,47,51,55]),
 ('skill2',[0,8,10,12,14,16,17,17,16,13,10,0]),
 ('skill1',[0,4,8,12,16,22,16,12,8,4,0]),
 # Lower the spear, hold a stable aiming pose through charge/release, then lift it back.
 ('skill2',[0,8,10,12,14,16,16,16,16,16,16,16,16,16,16,16,16,16,16,42,44,48,52,55]),
 ('ultimate',[0,3,5,7,8,9,10,11,12,13,13,14,16,17,18,19,20,21,23,27,31,35,39,47]),
 ('kneel-break',[0,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46,49,52,54,55])]
atlas=Image.new('RGBA',(COLS*W,H*len(rows)));mapping=[]
for r,(name,indices) in enumerate(rows):
 for j,i in enumerate(indices):
  dx=([0,-1,-3,-2,-1,0][j] if r==2 else [0,0,0,1,3,5,7,5,3,1,0,0][j] if r==4 else 0)
  body=frame(name,i)
  if r==7 and i>=16:
   # Old white contact dust is baked into the slam pose. Separate it from the
   # replacement world-space impact without touching coloured spear/arm/armour.
   a=np.array(body);yy,xx=np.indices(a.shape[:2]);rgb=a[:,:,:3].astype(int)
   dust=(xx<250)&(yy>190)&(rgb.max(2)-rgb.min(2)<45)&(rgb.min(2)>90)
   a[dust,3]=0;body=Image.fromarray(a)
  atlas.paste(actor(body,dx),(j*W,r*H))
 mapping.append({'row':r+1,'source':name,'frames1Based':[i+1 for i in indices]})
atlas.save(OUT/'enemy-aegis-sentinel.png',optimize=True)

def key(im):
 if im.mode=='RGBA':return im.convert('RGBA')
 a=np.asarray(im.convert('RGB')).astype(float);sat=a.max(2)-a.min(2)
 # Reject the neutral checker and unmix colored light; pure white-on-white cores cannot be recovered.
 alpha=np.clip((255-a.min(2))/255,0,1)
 mask=sat>8
 alpha[~mask]=0
 alpha[alpha<.025]=0
 safe=np.maximum(alpha,.025)[...,None];col=np.clip((a-255*(1-safe))/safe,0,255)
 return Image.fromarray(np.dstack((col,alpha*255)).astype('uint8'))

def panels(filename,cols,rows):
 im=Image.open(SRC/filename);out=[]
 for j in range(cols*rows):
  box=(round((j%cols)*im.width/cols),round((j//cols)*im.height/rows),round((j%cols+1)*im.width/cols),round((j//cols+1)*im.height/rows))
  out.append(key(im.crop(box)))
 return out
meta={}
def strip(name,frames,size):
 out=Image.new('RGBA',(size[0]*len(frames),size[1]));
 for i,f in enumerate(frames):out.paste(f.resize(size,Image.Resampling.LANCZOS),(i*size[0],0))
 out.save(OUT/('fx-aegis-'+name+'.png'),optimize=True);meta[name]={'frames':len(frames),'w':size[0],'h':size[1]}
 return frames
bar=panels('01-fx-aegis-s1-barrier-loop.png',5,2)
# Keep original per-cell coordinates; fit dome to canvas, fixed base, no per-frame fit/rescale.
bar=[f.resize((300,250),Image.Resampling.LANCZOS) for f in bar]
strip('barrier-in',bar[:5],(300,250))
# The supplied dome is the only shell. No additional outline or external orbit ring.
base=bar[4];rgba=np.array(base);rgba[:,:,3]=(rgba[:,:,3]*.78).astype('uint8');base=Image.fromarray(rgba)
field=Image.new('RGBA',(340,280));field.alpha_composite(base,(20,5))
# Light is clipped to the actual painted VFX (including its hex pattern), not a second geometric dome.
paint_mask=field.getchannel('A').point(lambda a:255 if a>=5 else 0).filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(1))
loops=[]
def star(d,x,y,r,color,alpha):
 d.polygon([(x-r,y),(x-r*.2,y-r*.2),(x,y-r*1.6),(x+r*.2,y-r*.2),(x+r,y),
            (x+r*.2,y+r*.2),(x,y+r*1.6),(x-r*.2,y+r*.2)],fill=(*color,round(alpha)))
def clipped_light(canvas,layer):
 glow=layer.filter(ImageFilter.GaussianBlur(3))
 glow.putalpha(ImageChops.multiply(glow.getchannel('A'),paint_mask))
 layer.putalpha(ImageChops.multiply(layer.getchannel('A'),paint_mask))
 canvas.alpha_composite(glow);canvas.alpha_composite(layer)
for i in range(64):
 phase=math.tau*i/64;canvas=Image.new('RGBA',(340,280))
 for front in [False,True]:
  if front:
   breathing=field.copy();a=np.array(breathing);a[:,:,3]=(a[:,:,3]*(.9+.1*math.sin(phase))).astype('uint8');canvas.alpha_composite(Image.fromarray(a))
  light=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(light)
  # Three short travelling ribbons following the dome's interior, never a complete external ring.
  for j,(rx,cy,ry,velocity) in enumerate([(83,105,15,1),(111,153,19,-1),(101,190,12,2)]):
   head=phase*velocity+j*2.1
   def pt(a):return(170+rx*math.cos(a),cy+ry*math.sin(a)-9*math.cos(a))
   color=(255,214,118) if j!=1 else (91,235,255)
   for k in range(36):
    a=head-k*.024*(1 if velocity>0 else -1);b=a-.024*(1 if velocity>0 else -1)
    if (math.sin(a)>=0)!=front:continue
    fade=(1-k/36)**1.7;d.line((pt(a),pt(b)),fill=(*color,round(230*fade)),width=3)
   if (math.sin(head)>=0)==front:
    x,y=pt(head);star(d,x,y,6.5,color,245);star(d,x,y,2.5,(244,255,255),255)
  if front:
   # Large bright motes rise and circulate over the original surface; phase wraps where opacity is zero.
   for j in range(40):
    u=(j*.61803398875+i/64*(1 if j%3 else 2))%1
    y=221-u*180;rx=117*math.sqrt(max(0,1-((y-211)/188)**2))
    angle=phase*(1+j%2)+j*2.39996323
    x=170+math.sin(angle)*rx*(.3+.65*((j*37%97)/97))
    env=math.sin(math.pi*u)**1.2;alpha=230*env*(.62+.38*math.sin(phase*2+j)**2)
    color=(255,221,139) if j%3==0 else (124,242,255)
    size=3+(j%5)*.8
    star(d,x,y,size,color,alpha)
   # Highlight the existing central gold crest without adding a new frame.
   star(d,170,147,7,(255,234,167),150+90*math.sin(phase)**2)
  clipped_light(canvas,light)
 loops.append(canvas)
strip('barrier-loop',loops,(340,280))
strip('barrier-hit',panels('02-fx-aegis-s1-barrier-hit.png',4,2),(128,128))
charge=panels('03-fx-aegis-s2-tip-charge.png',4,2)
# Pulse one steady frame rather than looping drifting generated art.
held=charge[3];charges=[]
for i in range(24):
 q=held.copy();a=np.array(q);a[:,:,3]=(a[:,:,3]*(.82+.18*math.sin(math.tau*i/24))).astype('uint8');charges.append(Image.fromarray(a))
strip('tip-charge',charges,(120,120))
# S2 only: inward-moving light spirals converge at the fixed spear-tip anchor.
# Keep S3's approved charge strip unchanged.
spirals=[]
for i in range(32):
 phase=i/32;light=Image.new('RGBA',(180,180));d=ImageDraw.Draw(light)
 for arm in range(3):
  for k in range(28):
   u=(phase+k/84+arm/3)%1
   radius=77*(1-u)**.85;angle=math.tau*(u*1.65+arm/3)
   x=90+math.cos(angle)*radius;y=90+math.sin(angle)*radius*.8
   color=(255,220,135) if arm==0 else (80,229,255)
   # Short connected flashes share the inward spiral's direction, rather than isolated dots only.
   v=(u+.018)%1;r2=77*(1-v)**.85;a2=math.tau*(v*1.65+arm/3)
   if v>u:d.line((x,y,90+math.cos(a2)*r2,90+math.sin(a2)*r2*.8),fill=(*color,round(100+145*u)),width=2)
   star(d,x,y,1.6+u*2.6,color,70+round(175*u))
 glow=light.filter(ImageFilter.GaussianBlur(3));glow.alpha_composite(light)
 core=ImageDraw.Draw(glow);pulse=2+math.sin(phase*math.tau)**2
 star(core,90,90,5+pulse,(198,253,255),250)
 spirals.append(glow)
strip('s2-charge',spirals,(180,180))
strip('impact',panels('05-fx-aegis-s2-impact.png',4,2),(160,128))
strip('shockwave',panels('06-fx-aegis-s3-ground-shockwave.png',4,2),(300,160))
core=panels('07-fx-aegis-core-exposed-loop.png',5,2)
strip('core',core[1:7]+core[5:1:-1],(100,100))
strip('death',panels('08-fx-aegis-death-dissolve.png',5,2),(210,180))
# New supplied native-alpha S2 emitter and beam. Only discard effectively invisible black alpha noise.
def clean_native(im):
 a=np.array(im.convert('RGBA'));a[a[:,:,3]<=2,3]=0
 return Image.fromarray(a)
emitter=panels('10-fx-aegis-s2-emitter.png',4,2)
# Source faces LEFT. Keep a fixed 356,222 source-pixel core; canonicalize RIGHT for runtime facing.
strip('beam-muzzle',[ImageOps.mirror(clean_native(f)) for f in emitter],(256,256))
beams=panels('09-fx-aegis-s2-beam-loop.png',4,2)
# Common crop on every frame: keep the white beam centre at y=254, remove unused transparent top/bottom.
shafts=[]
for f in beams:
 q=np.array(ImageOps.mirror(clean_native(f).crop((8,132,436,376))))
 # Blend the repeatable body's near edge under the separate emitter, avoiding a hard rectangular seam.
 x=np.clip(np.arange(q.shape[1])/(q.shape[1]*.16),0,1);feather=x*x*(3-2*x)
 q[:,:,3]=(q[:,:,3]*feather[None,:]).astype('uint8');shafts.append(Image.fromarray(q))
strip('beam',shafts,(384,219))
# Small normal thrust flash, transparent and distinct from the long S2 release.
thrust=[]
for i in range(6):
 im=Image.new('RGBA',(120,48));d=ImageDraw.Draw(im);x=28+i*13;alpha=round(255*(1-i/6));d.line((max(0,x-46),24,x,24),fill=(75,228,255,alpha),width=3);d.polygon([(x-12,18),(x+12,24),(x-12,30)],fill=(237,254,255,alpha));thrust.append(im)
strip('thrust',thrust,(120,48))
from aegis_s3 import bake_s3
bake_s3(SRC,OUT,REPORT,strip,star)
(REPORT/'bake-report.json').write_text(json.dumps({'character':{'cols':COLS,'rows':len(rows),'w':W,'h':H,'scale':SCALE,'canonicalFacing':'right','mapping':mapping},'fx':meta,'notes':['RGB checkerboard FX alpha reconstructed; originals preserved unchanged.','Barrier idle: fixed frame + procedural 64-frame light within painted VFX; no generated frame-to-frame warping.','Native-alpha supplied S2 emitter kept separate; only the supplied beam body stretches to the edge.']},indent=2))
# Dark-background alpha inspection plates.
for name in ['barrier-loop','barrier-hit','tip-charge','beam','shockwave']:
 im=Image.open(OUT/('fx-aegis-'+name+'.png'));m=meta[name];f=im.crop((0,0,m['w'],m['h']));bg=Image.new('RGBA',f.size,'#162630');bg.alpha_composite(f);bg.convert('RGB').save(REPORT/(name+'-alpha-check.jpg'))
print(json.dumps(meta))

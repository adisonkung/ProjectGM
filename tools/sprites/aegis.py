"""Bake user-supplied Aegis assets. No redraw of character art; native alpha, shared scale and anchors.
Run: python3 tools/sprites/aegis.py [source-directory]
RGB VFX checkerboards are keyed/unmixed; barrier idle = one held dome + periodic code-drawn orbit.
"""
from pathlib import Path
import sys,json,math
from functools import lru_cache
import numpy as np
from PIL import Image,ImageDraw,ImageFilter,ImageOps
ROOT=Path(__file__).resolve().parents[2]
SRC=Path(sys.argv[1]) if len(sys.argv)>1 else ROOT/'assets/bosses/Aegis'
OUT=ROOT/'public/sprites';REPORT=ROOT/'docs/art/aegis';REPORT.mkdir(parents=True,exist_ok=True)
W,H=340,280;COLS=25;SCALE=180/252  # helmet-to-sole body, excluding upright spear
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
 ('skill1',[0,4,8,12,16]+[22]*20),
 ('skill2',[0,8,10,12,14,16,18,20,22,24,26,28,30,32,35,38,40,42,44,46,48,50,52,55]),
 ('ultimate',[0,3,5,7,8,9,10,11,12,13,13,14,16,17,18,19,20,21,23,27,31,35,39,47]),
 ('kneel-break',[0,4,7,10,13,16,19,22,25,28,31,34,37,40,43,46,49,52,54,55])]
atlas=Image.new('RGBA',(COLS*W,H*len(rows)));mapping=[]
for r,(name,indices) in enumerate(rows):
 for j,i in enumerate(indices):
  dx=([0,-1,-3,-2,-1,0][j] if r==2 else [0,0,0,1,3,5,7,5,3,1,0,0][j] if r==4 else 0)
  atlas.paste(actor(frame(name,i),dx),(j*W,r*H))
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
# First full dome is stable; low-opacity center keeps the character legible.
base=bar[4];rgba=np.array(base);rgba[:,:,3]=(rgba[:,:,3]*.9).astype('uint8');base=Image.fromarray(rgba)
loops=[]
for i in range(32):
 phase=math.tau*i/32;canvas=Image.new('RGBA',(340,280))
 # Stationary shield; only the light travels. Fixed base anchor at (170,245).
 for front in [False,True]:
  if front:
   canvas.alpha_composite(base,(20,5))
   rim=Image.new('RGBA',canvas.size);rd=ImageDraw.Draw(rim)
   pts=[(170+141*math.cos(math.pi*k/100),218-188*math.sin(math.pi*k/100)) for k in range(101)]
   rd.line(pts,fill=(69,222,255,210),width=2)
   rd.ellipse((29,201,311,235),outline=(90,230,255,220),width=2)
   canvas.alpha_composite(rim.filter(ImageFilter.GaussianBlur(4)));canvas.alpha_composite(rim)
  light=Image.new('RGBA',canvas.size);d=ImageDraw.Draw(light)
  for k in range(72):
   a=phase-k*.021;b=a-.021
   if (math.sin(a)>=0)!=front:continue
   def pt(v):return(170+158*math.cos(v),157+31*math.sin(v)-16*math.cos(v))
   fade=(1-k/72)**2;d.line((pt(a),pt(b)),fill=(255,218,127,round(240*fade)),width=2)
  if (math.sin(phase)>=0)==front:
   x=170+158*math.cos(phase);y=157+31*math.sin(phase)-16*math.cos(phase)
   d.line((x-5,y,x+5,y),fill=(255,251,220,255),width=2);d.line((x,y-7,x,y+7),fill=(255,251,220,255),width=1)
  canvas.alpha_composite(light.filter(ImageFilter.GaussianBlur(3)));canvas.alpha_composite(light)
 loops.append(canvas)
strip('barrier-loop',loops,(340,280))
strip('barrier-hit',panels('02-fx-aegis-s1-barrier-hit.png',4,2),(128,128))
charge=panels('03-fx-aegis-s2-tip-charge.png',4,2)
# Pulse one steady frame rather than looping drifting generated art.
held=charge[3];charges=[]
for i in range(24):
 q=held.copy();a=np.array(q);a[:,:,3]=(a[:,:,3]*(.82+.18*math.sin(math.tau*i/24))).astype('uint8');charges.append(Image.fromarray(a))
strip('tip-charge',charges,(120,120))
strip('impact',panels('05-fx-aegis-s2-impact.png',4,2),(160,128))
strip('shockwave',panels('06-fx-aegis-s3-ground-shockwave.png',4,2),(300,160))
core=panels('07-fx-aegis-core-exposed-loop.png',5,2)
strip('core',core[1:7]+core[5:1:-1],(100,100))
strip('death',panels('08-fx-aegis-death-dissolve.png',5,2),(210,180))
# Beam: keep the supplied crescent at the muzzle, synthesize shaft/tip separately so its ornament never stretches.
beams=panels('04-fx-aegis-s2-beam.png',4,2)
muzzle=beams[2].crop((0,0,round(beams[2].width*.42),beams[2].height))
strip('beam-muzzle',[muzzle],(110,144))
shaft=[]
for i in range(8):
 a=Image.new('RGBA',(384,80));d=ImageDraw.Draw(a);env=math.sin(math.pi*(i+1)/9)
 for thickness,col in [(26,(20,178,255,round(65*env))),(12,(43,215,255,round(180*env))),(4,(228,254,255,round(255*env)))]:
  d.line((12,40,356,40),fill=col,width=thickness)
 d.polygon([(350,34),(380,40),(350,46)],fill=(224,254,255,round(255*env)))
 shaft.append(a)
strip('beam',shaft,(384,80))
# Small normal thrust flash, transparent and distinct from the long S2 release.
thrust=[]
for i in range(6):
 im=Image.new('RGBA',(120,48));d=ImageDraw.Draw(im);x=28+i*13;alpha=round(255*(1-i/6));d.line((max(0,x-46),24,x,24),fill=(75,228,255,alpha),width=3);d.polygon([(x-12,18),(x+12,24),(x-12,30)],fill=(237,254,255,alpha));thrust.append(im)
strip('thrust',thrust,(120,48))
(REPORT/'bake-report.json').write_text(json.dumps({'character':{'cols':COLS,'rows':len(rows),'w':W,'h':H,'scale':SCALE,'canonicalFacing':'right','mapping':mapping},'fx':meta,'notes':['RGB checkerboard FX alpha reconstructed; originals preserved unchanged.','Barrier idle: fixed frame + procedural 32-frame closed orbit; no generated frame-to-frame warping.','Beam crescent kept separate; shaft generated from code, not stretched source ornament.']},indent=2))
# Dark-background alpha inspection plates.
for name in ['barrier-loop','barrier-hit','tip-charge','beam','shockwave']:
 im=Image.open(OUT/('fx-aegis-'+name+'.png'));m=meta[name];f=im.crop((0,0,m['w'],m['h']));bg=Image.new('RGBA',f.size,'#162630');bg.alpha_composite(f);bg.convert('RGB').save(REPORT/(name+'-alpha-check.jpg'))
print(json.dumps(meta))

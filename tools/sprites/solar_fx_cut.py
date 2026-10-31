from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,json,hashlib,sys
R=Path(sys.argv[1])
(R/'prepared').mkdir(exist_ok=True)
SINGLES={'solar-bolt','solar-eye-charge-held','solar-ground-charge-held','solar-seal-held','solar-beam-emitter'}
RINGS={'solar-ground-charge-in','solar-ground-charge-held','solar-seal-in','solar-seal-held'}
GROUND={'solar-seal-impact','solar-judgement-impact'}
FX={};META={}
def clear_matte(im):
 a=np.array(im.convert('RGBA')).astype(float);al=a[:,:,3]
 # Suppress low-alpha matte haze, retaining the bright native light cores.
 z=np.clip((al-12)/60,0,1);z=z*z*(3-2*z);al*=z
 a[:,:,3]=al;a[al<1]=0
 return Image.fromarray(np.clip(a,0,255).astype('uint8'))
def bbox(im):
 a=np.array(im)[:,:,3];y,x=np.where(a>90)
 if not len(x):y,x=np.where(a>15)
 return (int(x.min()),int(y.min()),int(x.max()+1),int(y.max()+1))
def floor_anchor(im):
 a=np.array(im)[:,:,3];l,t,r,b=bbox(im);y,x=np.mgrid[:a.shape[0],:a.shape[1]]
 mask=(a>110)&((x<l+(r-l)*.07)|(x>r-(r-l)*.07))
 ys=y[mask];w=a[mask].astype(float)
 if len(ys):
  order=np.argsort(ys);ys=ys[order];w=w[order];cy=float(ys[np.searchsorted(np.cumsum(w),w.sum()/2)])
 else:cy=(t+b)/2
 return ((l+r)/2,cy)
def transform(im,pivot,sx,sy,target=(256,256),canvas=(512,512)):
 tw,th=canvas;tx,ty=target;px,py=pivot
 return im.transform((tw,th),Image.Transform.AFFINE,(1/sx,0,px-tx/sx,0,1/sy,py-ty/sy),Image.Resampling.BICUBIC)
for p in sorted((R/'source').glob('*.png')):
 name=p.stem;im=Image.open(p).convert('RGBA');w,h=im.size
 raw=[clear_matte(im)] if name in SINGLES else [clear_matte(im.crop((round(i%4*w/4),round(i//4*h/2),round((i%4+1)*w/4),round((i//4+1)*h/2)))) for i in range(8)]
 boxes=[bbox(c) for c in raw];anchors=[];frames=[];pivot=(256,256)
 if name in RINGS:
  l,t,r,b=boxes[-1];sx=400/(r-l);pivot=(256,380)
  last_origin=floor_anchor(raw[-1]);up=95/max(1,last_origin[1]-t);down=50/max(1,b-last_origin[1]);sy=[up,down]
  for c in raw:
   origin=floor_anchor(c);anchors.append(origin)
   top=transform(c,origin,sx,up,pivot);bottom=transform(c,origin,sx,down,pivot)
   out=np.array(top);other=np.array(bottom);out[380:]=other[380:];frames.append(Image.fromarray(out))
 elif name in GROUND:
  sx=400/max(b[2]-b[0] for b in boxes);sy=sx*.92;pivot=(256,380)
  ys=[339,317,317,321,331,319,317,317] if name=='solar-seal-impact' else [363]*4+[341]*4
  for i,c in enumerate(raw):
   origin=(c.width/2,ys[i]);anchors.append(origin);frames.append(transform(c,origin,sx,sy,pivot))
 elif name=='solar-beam-body':
  pivot=(256,80)
  for c in raw:
   a=np.array(c);rgb=a[:,:,:3].astype(float);core=(rgb.min(2)>200)&(a[:,:,3]>200)
   ys,xs=np.where(core);cy=float(np.median(ys)) if len(ys) else c.height/2
   # Trim tiny frame-edge seams before repeating the texture in the preview.
   strip=c.crop((8,round(cy)-80,c.width-8,round(cy)+80)).resize((512,160),Image.Resampling.LANCZOS)
   frames.append(strip);anchors.append((c.width/2,cy))
  sx=sy=1
 elif name=='solar-bolt':
  pivot=(128,256);sx=sy=.28;origin=(330,443);anchors=[origin];frames=[transform(raw[0],origin,sx,sy,pivot)]
 else:
  width={'solar-hit-impact':350,'solar-death-dissolve':380,'solar-beam-emitter':270}.get(name,220)
  sx=sy=width/max(b[2]-b[0] for b in boxes)
  for i,c in enumerate(raw):
   if name in ['solar-eye-charge-held','solar-beam-emitter']:
    a=np.array(c);rr=a[:,:,:3].astype(float);yy,xx=np.mgrid[:c.height,:c.width]
    weight=(rr.min(2)/255)**8*(a[:,:,3]/255)
    # Prefer the central bright core over long directional energy fins.
    weight*=np.exp(-((xx-c.width/2)**2+(yy-c.height/2)**2)/(c.width*.22)**2)
    origin=(float((xx*weight).sum()/weight.sum()),float((yy*weight).sum()/weight.sum()))
   elif name=='solar-eye-charge-in':
    l,t,r,b=boxes[i];origin=((l+r)/2,(t+b)/2)
   else:origin=(c.width/2,c.height/2)
   anchors.append(origin);frames.append(transform(c,origin,sx,sy,pivot))
 # Soften sheet-boundary bleed; background pixels remain true alpha.
 for j,c in enumerate(frames):
  a=np.array(c);hh,ww=a.shape[:2];yy,xx=np.mgrid[:hh,:ww];edge=np.minimum.reduce([xx,ww-1-xx,yy,hh-1-yy]);fade=np.clip(edge/7,0,1)
  a[:,:,3]=(a[:,:,3]*fade).astype('uint8');a[a[:,:,3]==0]=0;frames[j]=Image.fromarray(a)
 fw,fh=frames[0].size;atlas=Image.new('RGBA',(fw*len(frames),fh))
 for i,c in enumerate(frames):atlas.alpha_composite(c,(fw*i,0))
 atlas.save(R/'prepared'/(name+'.png'))
 FX[name]=frames
 META[name]={'source':p.name,'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'sourceSize':[w,h],'frames':len(frames),'sourceGrid':None if name in SINGLES else [4,2],'preparedCell':[fw,fh],'pivot':list(pivot),'sourceAnchors':[list(v) for v in anchors],'scale':[sx,sy],'alphaCleanup':'soft low-alpha matte suppression (12..72) and 7px cell edge feather'}
(R/'vfx-manifest.json').write_text(json.dumps(META,indent=2))
# A concise atlas contact sheet with registration markers.
cv=Image.new('RGB',(1280,960),(8,16,28));d=ImageDraw.Draw(cv);font=ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',12)
for j,(name,frames) in enumerate(FX.items()):
 c=frames[min(3,len(frames)-1)];tile=c.copy();tile.thumbnail((300,200));x=j%4*320;y=j//4*240
 cv.paste(tile,(x+(320-tile.width)//2,y+30),tile);d.text((x+8,y+8),name,font=font,fill=(236,206,143))
cv.save(R/'prepared-overview.jpg',quality=94)
print('Prepared all 13 VFX assets; originals retained unchanged.',flush=True)
